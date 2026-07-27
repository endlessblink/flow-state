/**
 * TASK-1977 — Mini-canvas actions must not fail silently.
 *
 * Every subtask / note / edge action writes through the parent task. Those
 * writes were dispatched fire-and-forget: not awaited, no catch, no user
 * feedback. When the durable write rejected, the node stayed on screen as if
 * it had been saved, the rejection surfaced only as an unhandled promise, and
 * the change was gone on the next load.
 *
 * The contract proved here: a rejected write is reported to the user and the
 * caller can observe the failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: "pending" });

vi.mock("@/composables/sync/useSyncOrchestrator", () => ({
  useSyncOrchestrator: () => ({
    enqueue: mockEnqueue,
    onPermanentFailure: vi.fn(),
    status: { value: "idle" },
    pendingCount: { value: 0 },
    failedCount: { value: 0 },
    lastSyncAt: { value: null },
    lastError: { value: null },
    isOnline: { value: true },
    isProcessing: { value: false },
    hasPendingChanges: { value: false },
    hasErrors: { value: false },
    retryFailed: vi.fn(),
    clearFailed: vi.fn(),
    getQueueStats: vi.fn(),
    forceSync: vi.fn(),
  }),
}));

vi.mock("@/composables/useDatabase", () => ({
  useDatabase: () => ({ save: vi.fn(), load: vi.fn().mockResolvedValue(null) }),
  DB_KEYS: { TASKS: "tasks", PROJECTS: "projects", CANVAS: "canvas" },
}));

const mockSaveTasks = vi.fn().mockResolvedValue(undefined);
vi.mock("@/composables/useSupabaseDatabase", () => ({
  useSupabaseDatabase: () => ({
    saveTask: mockSaveTasks,
    saveTasks: mockSaveTasks,
    deleteTask: vi.fn(),
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock("@/services/auth/supabase", () => ({ supabase: null }));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: "00000000-0000-0000-0000-000000000001" },
    isAuthenticated: true,
  }),
}));

vi.mock("@/composables/useGamificationHooks", () => ({
  useGamificationHooks: () => ({
    onTaskCompleted: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/stores/timer", () => ({
  useTimerStore: () => ({
    currentTaskId: null,
    isTimerActive: false,
    stopTimer: vi.fn().mockResolvedValue(undefined),
  }),
}));

const showToast = vi.fn();
vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ showToast }),
}));

import { useTaskStore } from "@/stores/tasks";
import { useMiniCanvasActions } from "@/composables/mini-canvas/useMiniCanvasActions";

const errorToasts = () =>
  showToast.mock.calls.filter(([, level]) => level === "error");

describe("mini-canvas write failures are visible", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockSaveTasks.mockResolvedValue(undefined);
    mockEnqueue.mockResolvedValue({ id: 1, status: "pending" });
  });

  const failingSetup = async () => {
    const store = useTaskStore();
    const task = await store.createTask({ title: "parent" });
    const actions = useMiniCanvasActions(() => task.id);
    vi.spyOn(store, "updateTaskWithUndo").mockRejectedValue(
      new Error("durable write rejected"),
    );
    showToast.mockClear();
    return { store, task, actions };
  };

  it("reports a failed subtask creation instead of leaving it silently unsaved", async () => {
    const { actions } = await failingSetup();

    await actions.addSubtask({ x: 10, y: 20 }, "write me");

    expect(errorToasts().length).toBeGreaterThan(0);
  });

  it("reports a failed subtask completion toggle", async () => {
    const { actions } = await failingSetup();

    await actions.toggleSubtaskCompletion("any-subtask-id");

    expect(errorToasts().length).toBeGreaterThan(0);
  });

  it("reports a failed subtask deletion", async () => {
    const { actions } = await failingSetup();

    await actions.deleteSubtask("any-subtask-id");

    expect(errorToasts().length).toBeGreaterThan(0);
  });

  it("reports a failed note creation", async () => {
    const { actions } = await failingSetup();

    await actions.addNote({ x: 5, y: 5 }, "New note");

    expect(errorToasts().length).toBeGreaterThan(0);
  });

  it("reports a failed note deletion", async () => {
    const { actions } = await failingSetup();

    await actions.deleteNote("any-note-id");

    expect(errorToasts().length).toBeGreaterThan(0);
  });

  it("reports a failed node move so the position is not assumed saved", async () => {
    const { actions } = await failingSetup();

    await actions.updateSubtaskPosition("any-subtask-id", { x: 1, y: 2 });

    expect(errorToasts().length).toBeGreaterThan(0);
  });

  it("reports a failed edge creation", async () => {
    const { actions } = await failingSetup();

    await actions.addMiniCanvasEdge({
      id: "user-a-b",
      source: "a",
      target: "b",
    });

    expect(errorToasts().length).toBeGreaterThan(0);
  });

  it("never leaves a rejected write as an unhandled promise", async () => {
    const { actions } = await failingSetup();

    // If the action swallowed the promise, this resolves without ever
    // observing the rejection — which is exactly the silent-loss shape.
    await expect(
      actions.addSubtask({ x: 0, y: 0 }, "x"),
    ).resolves.not.toThrow();
    expect(errorToasts().length).toBeGreaterThan(0);
  });
});
