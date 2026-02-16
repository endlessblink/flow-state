import { ref, computed, onUnmounted, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useQuickSortStore } from '@/stores/quickSort'
import { useSmartViews } from '@/composables/useSmartViews'
import type { Task } from '@/types/tasks'
import type { CategoryAction } from '@/stores/quickSort'

export function useQuickSort() {
  const taskStore = useTaskStore()
  const quickSortStore = useQuickSortStore()
  const { isUncategorizedTask } = useSmartViews()

  // State - pin by ID instead of index
  const currentTaskId = ref<string | null>(null)

  // Session-scoped set of processed task IDs (saved/done/deleted)
  const processedTaskIds = ref<Set<string>>(new Set())

  // Dirty state tracking for save/undo
  interface TaskSnapshot {
    projectId: string | null | undefined
    dueDate: string | undefined
    priority: 'low' | 'medium' | 'high' | undefined
  }

  const taskSnapshot = ref<TaskSnapshot | null>(null)

  function snapshotCurrentTask() {
    const task = currentTask.value
    if (task) {
      taskSnapshot.value = {
        projectId: task.projectId || null,
        dueDate: task.dueDate || undefined,
        priority: task.priority || undefined
      }
    } else {
      taskSnapshot.value = null
    }
  }

  const isTaskDirty = computed(() => {
    if (!currentTask.value || !taskSnapshot.value) return false
    const task = currentTask.value
    const snap = taskSnapshot.value
    return (
      (task.projectId || null) !== (snap.projectId || null) ||
      (task.dueDate || undefined) !== (snap.dueDate || undefined) ||
      (task.priority || undefined) !== (snap.priority || undefined)
    )
  })

  // Getters
  // TASK-243: Use raw tasks so Quick Sort sees ALL uncategorized tasks regardless of active smart view
  // Filter out processedTaskIds so saved/done tasks don't reappear
  const uncategorizedTasks = computed<Task[]>(() => {
    return taskStore.rawTasks.filter(task =>
      !task._soft_deleted &&
      isUncategorizedTask(task) &&
      !processedTaskIds.value.has(task.id)
    )
  })

  // Look up current task by ID from rawTasks (reactive to live edits)
  const currentTask = computed<Task | null>(() => {
    if (!currentTaskId.value) return null
    const task = taskStore.rawTasks.find(t => t.id === currentTaskId.value)
    // If task was deleted externally or soft-deleted, return null
    if (!task || task._soft_deleted) return null
    return task
  })

  const progress = computed(() => {
    const processed = processedTaskIds.value.size
    const remaining = uncategorizedTasks.value.length
    const total = processed + remaining
    if (total === 0) return { current: processed, total: 0, percentage: 100 }

    return {
      current: processed,
      total,
      percentage: Math.round((processed / total) * 100)
    }
  })

  const isComplete = computed(() => uncategorizedTasks.value.length === 0 && currentTask.value === null)

  const motivationalMessage = computed(() => {
    const percent = progress.value.percentage
    if (percent < 25) return "Great start! 🚀"
    if (percent < 50) return "You're on fire! 🔥"
    if (percent < 75) return "Almost there! 💪"
    if (percent < 100) return "Final push! 🎯"
    return "All done! 🎉"
  })

  // Navigation helpers
  function advanceToNextTask() {
    const tasks = uncategorizedTasks.value
    if (tasks.length === 0) {
      currentTaskId.value = null
      return
    }
    // Pick the first available task from the queue
    currentTaskId.value = tasks[0].id
    snapshotCurrentTask()
  }

  // Actions
  function startSession() {
    quickSortStore.startSession()
    processedTaskIds.value.clear()
    // Pin to first task
    const tasks = uncategorizedTasks.value
    if (tasks.length > 0) {
      currentTaskId.value = tasks[0].id
      snapshotCurrentTask()
    } else {
      currentTaskId.value = null
    }
  }

  function endSession() {
    const summary = quickSortStore.endSession()
    currentTaskId.value = null
    processedTaskIds.value.clear()
    taskSnapshot.value = null
    return summary
  }

  async function saveTask() {
    if (!currentTask.value) return

    const task = currentTask.value
    const snap = taskSnapshot.value

    // Record SAVE_TASK action for undo
    const action: CategoryAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'SAVE_TASK',
      taskId: task.id,
      oldProjectId: snap?.projectId ?? null,
      newProjectId: task.projectId || undefined,
      oldDueDate: snap?.dueDate,
      newDueDate: task.dueDate || undefined,
      oldPriority: snap?.priority,
      newPriority: task.priority || undefined,
      timestamp: Date.now()
    }

    quickSortStore.recordAction(action)
    processedTaskIds.value.add(task.id)
    advanceToNextTask()
  }

  async function categorizeTask(taskId: string, projectId: string) {
    const task = taskStore.tasks.find((t) => t.id === taskId)
    if (!task) return

    const oldProjectId = task.projectId || null

    const action: CategoryAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'CATEGORIZE_TASK',
      taskId,
      oldProjectId,
      newProjectId: projectId,
      timestamp: Date.now()
    }

    // Update task - AWAIT to ensure persistence (BUG-1051)
    await taskStore.updateTask(taskId, { projectId })

    // Record action
    quickSortStore.recordAction(action)
    // NO handleTaskProcessed() - task stays visible for further edits
  }

  function skipTask() {
    const tasks = uncategorizedTasks.value
    if (tasks.length === 0) return

    // Find current task index in uncategorized list (it may not be there if edited)
    const currentIdx = currentTaskId.value
      ? tasks.findIndex(t => t.id === currentTaskId.value)
      : -1

    // Move to next, wrapping around
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % tasks.length : 0

    // If we'd loop back to the same task (only one in queue), stay
    if (tasks[nextIdx].id === currentTaskId.value && tasks.length === 1) return

    currentTaskId.value = tasks[nextIdx].id
    snapshotCurrentTask()
  }

  async function markTaskDone(taskId: string) {
    // Mark task as done - AWAIT to ensure persistence (BUG-1051)
    await taskStore.updateTask(taskId, { status: 'done' })

    const action: CategoryAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'MARK_DONE',
      taskId,
      oldProjectId: undefined,
      newProjectId: undefined,
      timestamp: Date.now()
    }

    quickSortStore.recordAction(action)
    processedTaskIds.value.add(taskId)
    advanceToNextTask()
  }

  async function markDoneAndDeleteTask(taskId: string) {
    const action: CategoryAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'MARK_DONE_AND_DELETE',
      taskId,
      oldProjectId: undefined,
      newProjectId: undefined,
      timestamp: Date.now()
    }

    quickSortStore.recordAction(action)
    processedTaskIds.value.add(taskId)
    // Delete the task - MUST await so task is removed before advancing
    await taskStore.deleteTask(taskId)
    advanceToNextTask()
  }

  async function undoLastCategorization() {
    const action = quickSortStore.undo()
    if (!action) return

    if (action.type === 'SAVE_TASK') {
      // Restore snapshot fields
      const updates: Record<string, unknown> = {}
      if (action.oldProjectId !== undefined) updates.projectId = action.oldProjectId || undefined
      if (action.oldDueDate !== undefined) updates.dueDate = action.oldDueDate || ''
      if (action.oldPriority !== undefined) updates.priority = action.oldPriority || undefined

      if (Object.keys(updates).length > 0) {
        await taskStore.updateTask(action.taskId, updates)
      }

      // Remove from processedTaskIds so it reappears
      processedTaskIds.value.delete(action.taskId)
      // Re-pin to this task
      currentTaskId.value = action.taskId
      snapshotCurrentTask()
    } else if (action.type === 'CATEGORIZE_TASK') {
      // Revert project assignment - AWAIT to ensure persistence (BUG-1051)
      await taskStore.updateTask(action.taskId, { projectId: action.oldProjectId || undefined })
    } else {
      // MARK_DONE or MARK_DONE_AND_DELETE - revert status
      await taskStore.updateTask(action.taskId, { projectId: action.oldProjectId || undefined })
      processedTaskIds.value.delete(action.taskId)
      currentTaskId.value = action.taskId
      snapshotCurrentTask()
    }
  }

  async function redoLastCategorization() {
    const action = quickSortStore.redo()
    if (!action) return

    if (action.type === 'SAVE_TASK') {
      // Re-apply changes
      const updates: Record<string, unknown> = {}
      if (action.newProjectId !== undefined) updates.projectId = action.newProjectId
      if (action.newDueDate !== undefined) updates.dueDate = action.newDueDate || ''
      if (action.newPriority !== undefined) updates.priority = action.newPriority || undefined

      if (Object.keys(updates).length > 0) {
        await taskStore.updateTask(action.taskId, updates)
      }
      processedTaskIds.value.add(action.taskId)
      advanceToNextTask()
    } else if (action.type === 'CATEGORIZE_TASK') {
      // Reapply project assignment - AWAIT to ensure persistence (BUG-1051)
      await taskStore.updateTask(action.taskId, { projectId: action.newProjectId })
    } else {
      // MARK_DONE or MARK_DONE_AND_DELETE
      await taskStore.updateTask(action.taskId, { projectId: action.newProjectId })
      processedTaskIds.value.add(action.taskId)
      advanceToNextTask()
    }
  }

  function cancelSession() {
    quickSortStore.cancelSession()
    currentTaskId.value = null
    processedTaskIds.value.clear()
    taskSnapshot.value = null
  }

  // Watch for external task deletion (task deleted while viewing)
  watch(currentTask, (task) => {
    if (!task && currentTaskId.value) {
      // Task was deleted externally, advance
      advanceToNextTask()
    }
  })

  // Watch for tasks loading after session start (race condition: tasks load async from DB)
  // If session is active but no task is selected yet, pick the first available task
  watch(uncategorizedTasks, (tasks) => {
    if (!currentTaskId.value && tasks.length > 0 && quickSortStore.isActive) {
      currentTaskId.value = tasks[0].id
      snapshotCurrentTask()
    }
  })

  // Cleanup
  onUnmounted(() => {
    // Save any pending session data if active
    if (quickSortStore.isActive) {
      quickSortStore.saveToLocalStorage()
    }
  })

  return {
    // State
    currentTaskId,
    processedTaskIds,

    // Getters
    uncategorizedTasks,
    currentTask,
    progress,
    isComplete,
    isTaskDirty,
    motivationalMessage,
    canUndo: quickSortStore.canUndo,
    canRedo: quickSortStore.canRedo,
    currentStreak: quickSortStore.currentStreak,

    // Actions
    startSession,
    endSession,
    categorizeTask,
    saveTask,
    markTaskDone,
    markDoneAndDeleteTask,
    skipTask,
    undoLastCategorization,
    redoLastCategorization,
    cancelSession
  }
}
