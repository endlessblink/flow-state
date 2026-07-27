/**
 * TASK-1977 — a silently broken safety net is worse than no safety net.
 *
 * Auto-backup runs on a timer and calls createBackup('auto'). createBackup
 * signals failure by returning null and parking a message on state.error — it
 * does not throw. The scheduler awaited that call and discarded the result, so
 * every failure mode (contradictory permanent-delete inventory, a suspiciously
 * small backup, storage errors) meant backups quietly stopped happening while
 * the user carried on believing their data was protected. Nothing in the UI
 * changed, and the next signal would be a failed restore.
 *
 * Live proof this is reachable: the backup-restore E2E aborted with
 * "Backup refused because contradictory permanent-delete inventory contains
 * live task 3d853bb6-…" — a real refusal produced during an ordinary run.
 *
 * Contract proved here:
 *   1. a failed auto-backup is reported to the user, once, on the transition
 *      into failure — not silently, and not every tick;
 *   2. the failure stays observable in state while it persists;
 *   3. recovery is reported and re-arms the warning.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const showToast = vi.fn();
vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ showToast }),
}));

const createBackup = vi.fn();
vi.mock("@/composables/backup/backupCore", () => ({
  createCoreOperations: () => ({ createBackup }),
}));
vi.mock("@/composables/backup/backupHistory", () => ({
  createHistoryOperations: () => ({
    getLatestBackup: vi.fn(),
    clearHistory: vi.fn(),
    loadHistory: vi.fn().mockResolvedValue([]),
  }),
}));
vi.mock("@/composables/backup/backupGolden", () => ({
  createGoldenOperations: () => ({}),
}));
vi.mock("@/composables/backup/backupRestore", () => ({
  createRestoreOperations: () => ({
    restoreBackup: vi.fn(),
    analyzeRestore: vi.fn(),
  }),
}));
vi.mock("@/composables/backup/backupExport", () => ({
  createExportOperations: () => ({
    exportBackup: vi.fn(),
    importBackup: vi.fn(),
    downloadBackup: vi.fn(),
    restoreFromFile: vi.fn(),
  }),
}));
vi.mock("@/stores/tasks", () => ({
  useTaskStore: () => ({ tasks: [], _rawTasks: [] }),
}));
vi.mock("@/stores/projects", () => ({
  useProjectStore: () => ({ projects: [] }),
}));
vi.mock("@/stores/canvas", () => ({ useCanvasStore: () => ({ groups: [] }) }));
vi.mock("@/composables/useSupabaseDatabase", () => ({
  useSupabaseDatabase: () => ({}),
}));

import { useBackupSystem } from "@/composables/backup/useBackupSystem";

const INTERVAL = 1000;

describe("auto-backup failure is visible", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Advance one auto-backup tick and let its awaited work settle. */
  const tick = async (times = 1) => {
    for (let i = 0; i < times; i += 1) {
      await vi.advanceTimersByTimeAsync(INTERVAL);
    }
  };

  it("tells the user when a scheduled backup did not happen", async () => {
    createBackup.mockResolvedValue(null);
    const backup = useBackupSystem({
      autoSaveInterval: INTERVAL,
      enabled: true,
    });

    backup.startAutoBackup();
    await tick();

    const errorToasts = showToast.mock.calls.filter(
      ([, level]) => level === "error",
    );
    expect(errorToasts.length).toBeGreaterThan(0);
    backup.stopAutoBackup();
  });

  it("does not nag on every tick while the failure persists", async () => {
    createBackup.mockResolvedValue(null);
    const backup = useBackupSystem({
      autoSaveInterval: INTERVAL,
      enabled: true,
    });

    backup.startAutoBackup();
    await tick(4);

    const errorToasts = showToast.mock.calls.filter(
      ([, level]) => level === "error",
    );
    expect(errorToasts).toHaveLength(1);
    backup.stopAutoBackup();
  });

  it("keeps the failure observable in state while it persists", async () => {
    createBackup.mockResolvedValue(null);
    const backup = useBackupSystem({
      autoSaveInterval: INTERVAL,
      enabled: true,
    });

    backup.startAutoBackup();
    await tick(2);

    expect(backup.state.value.autoBackupHealthy).toBe(false);
    backup.stopAutoBackup();
  });

  it("reports recovery and re-arms the warning for the next failure", async () => {
    createBackup.mockResolvedValue(null);
    const backup = useBackupSystem({
      autoSaveInterval: INTERVAL,
      enabled: true,
    });

    backup.startAutoBackup();
    await tick();
    createBackup.mockResolvedValue({ id: "backup_1" });
    await tick();

    expect(backup.state.value.autoBackupHealthy).toBe(true);

    createBackup.mockResolvedValue(null);
    await tick();

    const errorToasts = showToast.mock.calls.filter(
      ([, level]) => level === "error",
    );
    expect(errorToasts).toHaveLength(2);
    backup.stopAutoBackup();
  });

  it("treats a thrown scheduler error the same as a refused backup", async () => {
    createBackup.mockRejectedValue(new Error("storage unavailable"));
    const backup = useBackupSystem({
      autoSaveInterval: INTERVAL,
      enabled: true,
    });

    backup.startAutoBackup();
    await tick();

    expect(backup.state.value.autoBackupHealthy).toBe(false);
    const errorToasts = showToast.mock.calls.filter(
      ([, level]) => level === "error",
    );
    expect(errorToasts.length).toBeGreaterThan(0);
    backup.stopAutoBackup();
  });
});
