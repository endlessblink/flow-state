import { useTaskStore } from '@/stores/tasks'
import type { Subtask, PlanningNote, Task, MiniCanvasEdge } from '@/types/tasks'

/**
 * Mini-canvas CRUD actions for subtasks and planning notes.
 * Both data types live on the parent task (subtasks[] and planningNotes[]).
 */
export function useMiniCanvasActions(taskId: () => string | null) {
  const taskStore = useTaskStore()

  const getTask = (): Task | undefined => {
    const id = taskId()
    if (!id) return undefined
    return taskStore._rawTasks.find(t => t.id === id)
  }

  // ── Subtask Actions ──

  const addSubtask = (position: { x: number; y: number }, title = '') => {
    const task = getTask()
    if (!task) return

    const subtask: Subtask = {
      id: crypto.randomUUID(),
      parentTaskId: task.id,
      title,
      description: '',
      completedPomodoros: 0,
      isCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      canvasPosition: position,
    }

    const updated = [...(task.subtasks || []), subtask]
    taskStore.updateTask(task.id, { subtasks: updated } as Partial<Task>)
    return subtask.id
  }

  const updateSubtaskPosition = (subtaskId: string, position: { x: number; y: number }) => {
    const task = getTask()
    if (!task) return

    const updated = (task.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, canvasPosition: position, updatedAt: new Date() } : s
    )
    taskStore.updateTask(task.id, { subtasks: updated } as Partial<Task>)
  }

  const updateSubtaskTitle = (subtaskId: string, title: string) => {
    const task = getTask()
    if (!task) return

    const updated = (task.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, title, updatedAt: new Date() } : s
    )
    taskStore.updateTask(task.id, { subtasks: updated } as Partial<Task>)
  }

  const toggleSubtaskCompletion = (subtaskId: string) => {
    const task = getTask()
    if (!task) return

    const updated = (task.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted, updatedAt: new Date() } : s
    )
    taskStore.updateTask(task.id, { subtasks: updated } as Partial<Task>)
  }

  const updateSubtaskDescription = (subtaskId: string, description: string) => {
    const task = getTask()
    if (!task) return

    const updated = (task.subtasks || []).map(s =>
      s.id === subtaskId ? { ...s, description, updatedAt: new Date() } : s
    )
    taskStore.updateTask(task.id, { subtasks: updated } as Partial<Task>)
  }

  const deleteSubtask = (subtaskId: string) => {
    const task = getTask()
    if (!task) return

    const updated = (task.subtasks || []).filter(s => s.id !== subtaskId)
    taskStore.updateTask(task.id, { subtasks: updated } as Partial<Task>)
  }

  // ── Planning Note Actions ──

  const addNote = (position: { x: number; y: number }, title = 'New note', description = '', imageUrl?: string) => {
    const task = getTask()
    if (!task) return

    const note: PlanningNote = {
      id: crypto.randomUUID(),
      title,
      description,
      imageUrl,
      canvasPosition: position,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const updated = [...(task.planningNotes || []), note]
    taskStore.updateTask(task.id, { planningNotes: updated } as Partial<Task>)
    return note.id
  }

  const updateNotePosition = (noteId: string, position: { x: number; y: number }) => {
    const task = getTask()
    if (!task) return

    const updated = (task.planningNotes || []).map(n =>
      n.id === noteId ? { ...n, canvasPosition: position, updatedAt: new Date().toISOString() } : n
    )
    taskStore.updateTask(task.id, { planningNotes: updated } as Partial<Task>)
  }

  const updateNoteTitle = (noteId: string, title: string) => {
    const task = getTask()
    if (!task) return

    const updated = (task.planningNotes || []).map(n =>
      n.id === noteId ? { ...n, title, updatedAt: new Date().toISOString() } : n
    )
    taskStore.updateTask(task.id, { planningNotes: updated } as Partial<Task>)
  }

  const updateNoteDescription = (noteId: string, description: string) => {
    const task = getTask()
    if (!task) return

    const updated = (task.planningNotes || []).map(n =>
      n.id === noteId ? { ...n, description, updatedAt: new Date().toISOString() } : n
    )
    taskStore.updateTask(task.id, { planningNotes: updated } as Partial<Task>)
  }

  const deleteNote = (noteId: string) => {
    const task = getTask()
    if (!task) return

    const updated = (task.planningNotes || []).filter(n => n.id !== noteId)
    taskStore.updateTask(task.id, { planningNotes: updated } as Partial<Task>)
  }

  // ── Mini-Canvas User-Drawn Edge Actions ──

  const addMiniCanvasEdge = (edge: MiniCanvasEdge) => {
    const task = getTask()
    if (!task) return

    const existing = task.miniCanvasEdges ?? []
    if (existing.some(e => e.id === edge.id)) return

    taskStore.updateTask(task.id, { miniCanvasEdges: [...existing, edge] } as Partial<Task>)
  }

  const removeMiniCanvasEdge = (edgeId: string) => {
    const task = getTask()
    if (!task || !task.miniCanvasEdges?.length) return

    const next = task.miniCanvasEdges.filter(e => e.id !== edgeId)
    taskStore.updateTask(task.id, { miniCanvasEdges: next } as Partial<Task>)
  }

  const removeMiniCanvasEdgesForNode = (nodeId: string) => {
    const task = getTask()
    if (!task || !task.miniCanvasEdges?.length) return

    const next = task.miniCanvasEdges.filter(e => e.source !== nodeId && e.target !== nodeId)
    if (next.length === task.miniCanvasEdges.length) return

    taskStore.updateTask(task.id, { miniCanvasEdges: next } as Partial<Task>)
  }

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
  }
}
