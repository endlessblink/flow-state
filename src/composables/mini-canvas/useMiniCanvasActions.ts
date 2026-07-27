import { useTaskStore } from "@/stores/tasks";
import { useToast } from "@/composables/useToast";
import type {
  Subtask,
  PlanningNote,
  Task,
  MiniCanvasEdge,
} from "@/types/tasks";

/**
 * Mini-canvas CRUD actions for subtasks and planning notes.
 * Both data types live on the parent task (subtasks[] and planningNotes[]).
 *
 * TASK-1977: every action below writes through the parent task and must await
 * that write. Dispatching it fire-and-forget left a rejected write showing on
 * screen as if it had saved, with the failure visible only as an unhandled
 * promise — the change was simply gone on the next load.
 */
export function useMiniCanvasActions(taskId: () => string | null) {
  const taskStore = useTaskStore();
  const { showToast } = useToast();

  const getTask = (): Task | undefined => {
    const id = taskId();
    if (!id) return undefined;
    return taskStore._rawTasks.find((t) => t.id === id);
  };

  /**
   * Persist a change to the parent task, surfacing failure to the user.
   * Returns whether the write is durable, so callers never treat a failed
   * edit as applied.
   */
  const persist = async (
    id: string,
    updates: Partial<Task>,
    action: string,
  ): Promise<boolean> => {
    try {
      await taskStore.updateTaskWithUndo(id, updates);
      return true;
    } catch (error) {
      console.error(`Error ${action} in mini-canvas:`, error);
      showToast(`Could not be ${action}. Refresh and try again.`, "error");
      return false;
    }
  };

  // ── Subtask Actions ──

  const addSubtask = async (position: { x: number; y: number }, title = "") => {
    const task = getTask();
    if (!task) return;

    const subtask: Subtask = {
      id: crypto.randomUUID(),
      parentTaskId: task.id,
      title,
      description: "",
      completedPomodoros: 0,
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      canvasPosition: position,
    };

    const updated = [...(task.subtasks || []), subtask];
    const saved = await persist(
      task.id,
      { subtasks: updated } as Partial<Task>,
      "added",
    );
    return saved ? subtask.id : undefined;
  };

  const updateSubtaskPosition = async (
    subtaskId: string,
    position: { x: number; y: number },
  ) => {
    const task = getTask();
    if (!task) return;

    const updated = (task.subtasks || []).map((s) =>
      s.id === subtaskId
        ? { ...s, canvasPosition: position, updatedAt: new Date() }
        : s,
    );
    await persist(task.id, { subtasks: updated } as Partial<Task>, "moved");
  };

  const updateSubtaskTitle = async (subtaskId: string, title: string) => {
    const task = getTask();
    if (!task) return;

    const updated = (task.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, title, updatedAt: new Date() } : s,
    );
    await persist(task.id, { subtasks: updated } as Partial<Task>, "renamed");
  };

  const toggleSubtaskCompletion = async (subtaskId: string) => {
    const task = getTask();
    if (!task) return;

    const updated = (task.subtasks || []).map((s) =>
      s.id === subtaskId
        ? { ...s, isCompleted: !s.isCompleted, updatedAt: new Date() }
        : s,
    );
    await persist(task.id, { subtasks: updated } as Partial<Task>, "updated");
  };

  const updateSubtaskDescription = async (
    subtaskId: string,
    description: string,
  ) => {
    const task = getTask();
    if (!task) return;

    const updated = (task.subtasks || []).map((s) =>
      s.id === subtaskId ? { ...s, description, updatedAt: new Date() } : s,
    );
    await persist(task.id, { subtasks: updated } as Partial<Task>, "updated");
  };

  const deleteSubtask = async (subtaskId: string) => {
    const task = getTask();
    if (!task) return;

    const updated = (task.subtasks || []).filter((s) => s.id !== subtaskId);
    await persist(task.id, { subtasks: updated } as Partial<Task>, "deleted");
  };

  // ── Planning Note Actions ──

  const addNote = async (
    position: { x: number; y: number },
    title = "New note",
    description = "",
    imageUrl?: string,
  ) => {
    const task = getTask();
    if (!task) return;

    const note: PlanningNote = {
      id: crypto.randomUUID(),
      title,
      description,
      imageUrl,
      canvasPosition: position,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = [...(task.planningNotes || []), note];
    const saved = await persist(
      task.id,
      { planningNotes: updated } as Partial<Task>,
      "added",
    );
    return saved ? note.id : undefined;
  };

  const updateNotePosition = async (
    noteId: string,
    position: { x: number; y: number },
  ) => {
    const task = getTask();
    if (!task) return;

    const updated = (task.planningNotes || []).map((n) =>
      n.id === noteId
        ? {
            ...n,
            canvasPosition: position,
            updatedAt: new Date().toISOString(),
          }
        : n,
    );
    await persist(
      task.id,
      { planningNotes: updated } as Partial<Task>,
      "moved",
    );
  };

  const updateNoteTitle = async (noteId: string, title: string) => {
    const task = getTask();
    if (!task) return;

    const updated = (task.planningNotes || []).map((n) =>
      n.id === noteId
        ? { ...n, title, updatedAt: new Date().toISOString() }
        : n,
    );
    await persist(
      task.id,
      { planningNotes: updated } as Partial<Task>,
      "renamed",
    );
  };

  const updateNoteDescription = async (noteId: string, description: string) => {
    const task = getTask();
    if (!task) return;

    const updated = (task.planningNotes || []).map((n) =>
      n.id === noteId
        ? { ...n, description, updatedAt: new Date().toISOString() }
        : n,
    );
    await persist(
      task.id,
      { planningNotes: updated } as Partial<Task>,
      "updated",
    );
  };

  const deleteNote = async (noteId: string) => {
    const task = getTask();
    if (!task) return;

    const updated = (task.planningNotes || []).filter((n) => n.id !== noteId);
    await persist(
      task.id,
      { planningNotes: updated } as Partial<Task>,
      "deleted",
    );
  };

  // ── Mini-Canvas User-Drawn Edge Actions ──

  const addMiniCanvasEdge = async (edge: MiniCanvasEdge) => {
    const task = getTask();
    if (!task) return;

    const existing = task.miniCanvasEdges ?? [];
    if (existing.some((e) => e.id === edge.id)) return;

    await persist(
      task.id,
      { miniCanvasEdges: [...existing, edge] } as Partial<Task>,
      "connected",
    );
  };

  const removeMiniCanvasEdge = async (edgeId: string) => {
    const task = getTask();
    if (!task || !task.miniCanvasEdges?.length) return;

    const next = task.miniCanvasEdges.filter((e) => e.id !== edgeId);
    await persist(
      task.id,
      { miniCanvasEdges: next } as Partial<Task>,
      "disconnected",
    );
  };

  const removeMiniCanvasEdgesForNode = async (nodeId: string) => {
    const task = getTask();
    if (!task || !task.miniCanvasEdges?.length) return;

    const next = task.miniCanvasEdges.filter(
      (e) => e.source !== nodeId && e.target !== nodeId,
    );
    if (next.length === task.miniCanvasEdges.length) return;

    await persist(
      task.id,
      { miniCanvasEdges: next } as Partial<Task>,
      "disconnected",
    );
  };

  return {
    addSubtask,
    updateSubtaskPosition,
    updateSubtaskTitle,
    updateSubtaskDescription,
    toggleSubtaskCompletion,
    deleteSubtask,
    addNote,
    updateNotePosition,
    updateNoteTitle,
    updateNoteDescription,
    deleteNote,
    addMiniCanvasEdge,
    removeMiniCanvasEdge,
    removeMiniCanvasEdgesForNode,
  };
}
