/**
 * TASK-1977 — vector: general-user-undo-redo-action-graph-integrity [high].
 *
 * Existing suites (undo-task-operations, undo-race-condition, canvas-*-undo)
 * cover three-cycle round-trips and rollback-on-failure per operation type.
 * The distinct facet proved here is the ACTION-GRAPH invariant: undo/redo is a
 * single linear branch. After undoing, performing a NEW action must discard the
 * redo branch — otherwise a later redo would resurrect state the user has since
 * diverged from (a classic corruption: redo re-applies a change to a task that
 * has moved on). Also proves the in-memory stacks start empty (a fresh renderer
 * after reload cannot redo a stale pre-reload operation).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

const mockEnqueue = vi.fn();
vi.mock("@/composables/sync/useSyncOrchestrator", () => ({
  useSyncOrchestrator: () => ({
    enqueue: mockEnqueue,
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
const mockSaveTasks = vi.fn();
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
vi.mock("@/composables/useToast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("@/stores/canvas", () => ({
  useCanvasStore: () => ({
    groups: [],
    sections: [],
    selectedNodeIds: [],
    setSelectedNodes: vi.fn(),
    setGroups: vi.fn(),
  }),
}));
vi.mock("@/stores/canvas/canvasUi", () => ({
  useCanvasUiStore: () => ({ requestSync: vi.fn() }),
}));

import { useTaskStore } from "@/stores/tasks";
import { getUndoSystem } from "@/composables/undoSingleton";

async function seedTask(store: ReturnType<typeof useTaskStore>, title: string) {
  mockSaveTasks.mockResolvedValue(undefined);
  return store.createTask({ title });
}

describe("undo/redo action-graph integrity", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockEnqueue.mockResolvedValue({ id: 1, status: "pending" });
    mockSaveTasks.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with empty undo and redo stacks (a fresh renderer cannot redo a pre-reload op)", () => {
    const undo = getUndoSystem();
    expect(undo.getOperationStack()).toHaveLength(0);
    expect(undo.getRedoOperationStack()).toHaveLength(0);
  });

  it("a new action after an undo discards the redo branch", async () => {
    const store = useTaskStore();
    const undo = getUndoSystem();
    const task = await seedTask(store, "Graph task");

    // Action A, then undo it → it becomes redoable.
    await undo.updateTaskWithUndo(task.id, { title: "Title A" });
    const redoableBefore = undo.getRedoOperationStack().length;
    await undo.undo();
    expect(undo.getRedoOperationStack().length).toBe(redoableBefore + 1);

    // Diverge: perform a NEW action B instead of redoing A.
    await undo.updateTaskWithUndo(task.id, { title: "Title B" });

    // The redo branch (A) must be gone — you cannot redo down a branch you left.
    expect(undo.getRedoOperationStack()).toHaveLength(0);

    // And redo is a no-op that does not resurrect Title A over Title B.
    await undo.redo();
    const current = store._rawTasks.find((t) => t.id === task.id);
    expect(current?.title).toBe("Title B");
  });

  it("undo then redo returns to the same post-action state (linear round-trip)", async () => {
    const store = useTaskStore();
    const undo = getUndoSystem();
    const task = await seedTask(store, "Original");

    await undo.updateTaskWithUndo(task.id, { title: "Changed" });
    expect(store._rawTasks.find((t) => t.id === task.id)?.title).toBe(
      "Changed",
    );

    await undo.undo();
    expect(store._rawTasks.find((t) => t.id === task.id)?.title).toBe(
      "Original",
    );

    await undo.redo();
    expect(store._rawTasks.find((t) => t.id === task.id)?.title).toBe(
      "Changed",
    );
  });

  it("pushing a real action grows the undo stack and clears any prior redo branch", async () => {
    const store = useTaskStore();
    const undo = getUndoSystem();
    const task = await seedTask(store, "Seed");

    await undo.updateTaskWithUndo(task.id, { title: "One" });
    await undo.undo();
    expect(undo.getRedoOperationStack().length).toBeGreaterThan(0);

    const undoBefore = undo.getOperationStack().length;
    await undo.updateTaskWithUndo(task.id, { title: "Two" });

    expect(undo.getOperationStack().length).toBe(undoBefore + 1);
    expect(undo.getRedoOperationStack()).toHaveLength(0);
  });
});
