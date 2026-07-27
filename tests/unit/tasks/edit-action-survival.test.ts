/**
 * TASK-1977 — vector: view-lifecycle-warning-and-action-survival [high]
 * (evidence was MISSING).
 *
 * When a task edit is saved and the persistence fails, the change must NOT
 * silently vanish: the user must be told, the modal must stay open (return
 * false → caller does not emit close), and the dirty state must NOT be marked
 * saved, so the edit survives for retry. Conversely a successful save must
 * close and mark saved exactly once. This is the write-failure-visibility
 * contract at the edit surface, and it had no direct coverage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref, computed } from "vue";
import type { Task } from "@/types/tasks";

const showToast = vi.fn();
vi.mock("@/composables/useToast", () => ({ useToast: () => ({ showToast }) }));

const updateTaskWithUndo = vi.fn();
const removePendingWrite = vi.fn();
const taskStore = {
  getTask: (id: string) => ({ id, title: "Original" }),
  updateTaskWithUndo,
  removePendingWrite,
  addPendingWrite: vi.fn(),
};
vi.mock("@/stores/tasks", () => ({
  useTaskStore: () => taskStore,
}));
vi.mock("@/stores/canvas", () => ({ useCanvasStore: () => ({ groups: [] }) }));
vi.mock("@/stores/canvas/canvasUi", () => ({
  useCanvasUiStore: () => ({ requestSync: vi.fn() }),
}));

import { useTaskEditActions } from "@/composables/tasks/useTaskEditActions";

const baseTask = (): Task =>
  ({
    id: "task-1",
    title: "Original",
    description: "",
    status: "todo",
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: "",
    projectId: "p1",
    instances: [],
  }) as Task;

function setup(opts: { dirty?: boolean; valid?: boolean } = {}) {
  const emit = vi.fn();
  const isSaving = ref(false);
  const editedTask = ref<Task>({ ...baseTask(), title: "Edited title" });
  const markCurrentTaskSaved = vi.fn();
  const actions = useTaskEditActions(
    { task: baseTask() },
    emit,
    editedTask,
    isSaving,
    {
      isFormValid: computed(() => opts.valid ?? true),
      isFormDirty: computed(() => opts.dirty ?? true),
      markCurrentTaskSaved,
    },
  );
  return { actions, emit, isSaving, editedTask, markCurrentTaskSaved };
}

const errorToasts = () =>
  showToast.mock.calls.filter(([, level]) => level === "error");

describe("task edit action survival (write-failure-visibility)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateTaskWithUndo.mockResolvedValue(undefined);
  });

  it("a failed save warns the user, keeps the modal open, and does not mark saved", async () => {
    updateTaskWithUndo.mockRejectedValue(new Error("sync unavailable"));
    const { actions, emit, markCurrentTaskSaved } = setup({
      dirty: true,
      valid: true,
    });

    const saved = await actions.saveTask({ close: true });

    expect(saved).toBe(false);
    expect(errorToasts().length).toBeGreaterThan(0);
    expect(emit).not.toHaveBeenCalledWith("close");
    expect(markCurrentTaskSaved).not.toHaveBeenCalled();
  });

  it("a successful save closes and marks saved exactly once", async () => {
    const { actions, emit, markCurrentTaskSaved } = setup({
      dirty: true,
      valid: true,
    });

    const saved = await actions.saveTask({
      close: true,
      showSuccessToast: false,
    });

    expect(saved).toBe(true);
    expect(updateTaskWithUndo).toHaveBeenCalledTimes(1);
    expect(markCurrentTaskSaved).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("close");
  });

  it("refuses to persist an invalid edit and reports why", async () => {
    const { actions, emit } = setup({ dirty: true, valid: false });

    const saved = await actions.saveTask({ close: true });

    expect(saved).toBe(false);
    expect(updateTaskWithUndo).not.toHaveBeenCalled();
    expect(errorToasts().length).toBeGreaterThan(0);
    expect(emit).not.toHaveBeenCalledWith("close");
  });

  it("closes without error and without a write when nothing changed", async () => {
    const { actions, emit } = setup({ dirty: false, valid: true });

    const saved = await actions.saveTask({ close: true });

    expect(saved).toBe(true);
    expect(updateTaskWithUndo).not.toHaveBeenCalled();
    expect(errorToasts()).toHaveLength(0);
    expect(emit).toHaveBeenCalledWith("close");
  });

  it("does not double-save when a save is already in flight", async () => {
    const { actions, isSaving } = setup({ dirty: true, valid: true });
    isSaving.value = true;

    const saved = await actions.saveTask({ close: true });

    expect(saved).toBe(false);
    expect(updateTaskWithUndo).not.toHaveBeenCalled();
  });
});
