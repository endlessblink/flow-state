import { ref, shallowRef, triggerRef, computed, onUnmounted, watch } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useQuickSortStore } from '@/stores/quickSort'
import { useSmartViews } from '@/composables/useSmartViews'
import type { Task } from '@/types/tasks'
import type { CategoryAction } from '@/stores/quickSort'
import {
  DEFAULT_QUICK_SORT_SOURCES,
  QUICK_SORT_SOURCES,
  normalizeQuickSortSources,
  selectQuickSortTasks,
  type QuickSortSource
} from '@/utils/quickSortTaskFilters'

export function useQuickSort() {
  const taskStore = useTaskStore()
  const quickSortStore = useQuickSortStore()
  const { isUncategorizedTask } = useSmartViews()

  // State - pin by ID instead of index
  const currentTaskId = ref<string | null>(null)
  const selectedSources = ref<QuickSortSource[]>([...quickSortStore.lastSelectedSources])
  const queuedTaskIds = ref<string[]>([])

  // Session-scoped set of processed task IDs (saved/done/deleted)
  // Use shallowRef + triggerRef to ensure Set mutations trigger reactivity
  const processedTaskIds = shallowRef<Set<string>>(new Set())

  function addProcessedId(id: string) {
    processedTaskIds.value.add(id)
    triggerRef(processedTaskIds)
  }

  function clearProcessedIds() {
    processedTaskIds.value.clear()
    triggerRef(processedTaskIds)
  }

  // Dirty state tracking for save/undo
  interface TaskSnapshot {
    taskId: string
    projectId: string | null | undefined
    dueDate: string
    priority: 'low' | 'medium' | 'high' | undefined
  }

  const taskSnapshot = ref<TaskSnapshot | null>(null)

  function snapshotCurrentTask() {
    const task = currentTask.value
    if (task) {
      taskSnapshot.value = {
        taskId: task.id,
        projectId: task.projectId || null,
        dueDate: task.dueDate || '',
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
    if (snap.taskId !== task.id) return false
    return (
      (task.projectId || null) !== (snap.projectId || null) ||
      (task.dueDate || undefined) !== (snap.dueDate || undefined) ||
      (task.priority || undefined) !== (snap.priority || undefined)
    )
  })

  const sourcePreviewTasks = computed<Task[]>(() => {
    return selectQuickSortTasks(taskStore.rawTasks, selectedSources.value, isUncategorizedTask)
  })

  const sourceCounts = computed<Record<QuickSortSource, number>>(() => {
    return Object.fromEntries(QUICK_SORT_SOURCES.map(source => [
      source,
      selectQuickSortTasks(taskStore.rawTasks, [source], isUncategorizedTask).length
    ])) as Record<QuickSortSource, number>
  })
  const isSessionActive = computed(() => quickSortStore.isActive)
  const tasksSortedInSession = computed(() => quickSortStore.tasksSortedInSession)
  const canUndo = computed(() => quickSortStore.canUndo)
  const canRedo = computed(() => quickSortStore.canRedo)
  const reschedulingTaskId = ref<string | null>(null)
  const isRescheduling = computed(() => reschedulingTaskId.value !== null)

  // A session captures IDs once. Task edits therefore cannot make the current card
  // disappear, and newly-created matching tasks wait for the next session.
  const quickSortTasks = computed<Task[]>(() => {
    return queuedTaskIds.value.flatMap(taskId => {
      const task = taskStore.rawTasks.find(candidate => candidate.id === taskId)
      if (!task || task._soft_deleted || task.status === 'done' || processedTaskIds.value.has(task.id)) return []
      return [task]
    })
  })

  // Backward-compatible alias while view consumers migrate to the accurate name.
  const uncategorizedTasks = quickSortTasks

  // Look up current task by ID from rawTasks (reactive to live edits)
  const currentTask = computed<Task | null>(() => {
    if (!currentTaskId.value) return null
    const task = taskStore.rawTasks.find(t => t.id === currentTaskId.value)
    // If task was deleted externally or soft-deleted, return null
    if (!task || task._soft_deleted || task.status === 'done') return null
    return task
  })

  const progress = computed(() => {
    const processed = processedTaskIds.value.size
    const remaining = quickSortTasks.value.length
    const total = processed + remaining
    if (total === 0) return { current: processed, total: 0, percentage: 100 }

    return {
      current: processed,
      total,
      percentage: Math.round((processed / total) * 100)
    }
  })

  const isComplete = computed(() => quickSortStore.isActive && quickSortTasks.value.length === 0 && currentTask.value === null)

  const motivationalMessage = computed(() => {
    const percent = progress.value.percentage
    if (percent < 25) return "Great start! 🚀"
    if (percent < 50) return "You're on fire! 🔥"
    if (percent < 75) return "Almost there! 💪"
    if (percent < 100) return "Final push! 🎯"
    return "All done! 🎉"
  })

  // TASK-1450: Persist active session state to localStorage for crash recovery
  function persistSession() {
    quickSortStore.saveActiveSession({
      currentTaskId: currentTaskId.value,
      processedTaskIds: processedTaskIds.value,
      sources: selectedSources.value,
      queuedTaskIds: queuedTaskIds.value
    })
  }

  // Navigation helpers
  function advanceToNextTask() {
    const tasks = quickSortTasks.value
    if (tasks.length === 0) {
      currentTaskId.value = null
      persistSession()
      return
    }
    // Pick the first available task from the queue
    currentTaskId.value = tasks[0].id
    snapshotCurrentTask()
    persistSession()
  }

  // Actions
  function startSession(sources: readonly QuickSortSource[] = DEFAULT_QUICK_SORT_SOURCES) {
    selectedSources.value = normalizeQuickSortSources(sources)
    quickSortStore.setLastSelectedSources(selectedSources.value)
    queuedTaskIds.value = selectQuickSortTasks(
      taskStore.rawTasks,
      selectedSources.value,
      isUncategorizedTask
    ).map(task => task.id)
    quickSortStore.startSession()
    clearProcessedIds()
    // Pin to first task
    const tasks = quickSortTasks.value
    if (tasks.length > 0) {
      currentTaskId.value = tasks[0].id
      snapshotCurrentTask()
    } else {
      currentTaskId.value = null
    }
    persistSession()
  }

  // TASK-1450: Resume an interrupted session
  function tryResumeSession(): boolean {
    const data = quickSortStore.resumeSession()
    if (!data) return false

    processedTaskIds.value = new Set(data.processedTaskIds)
    selectedSources.value = normalizeQuickSortSources(data.sources)
    queuedTaskIds.value = Array.isArray(data.queuedTaskIds)
      ? [...data.queuedTaskIds]
      : selectQuickSortTasks(taskStore.rawTasks, selectedSources.value, isUncategorizedTask).map(task => task.id)
    currentTaskId.value = data.currentTaskId

    // Verify the current task still exists
    if (currentTaskId.value) {
      const task = taskStore.rawTasks.find(t => t.id === currentTaskId.value)
      if (!task || task._soft_deleted || task.status === 'done') {
        // Task was deleted while offline — advance
        advanceToNextTask()
      } else {
        snapshotCurrentTask()
      }
    } else {
      advanceToNextTask()
    }

    persistSession()
    return true
  }

  function endSession() {
    const summary = quickSortStore.endSession()
    currentTaskId.value = null
    clearProcessedIds()
    queuedTaskIds.value = []
    taskSnapshot.value = null
    return summary
  }

  async function commitCurrentTask() {
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
      newDueDate: task.dueDate || '',
      oldPriority: snap?.priority,
      newPriority: task.priority || undefined,
      timestamp: Date.now()
    }

    quickSortStore.recordAction(action)
    addProcessedId(task.id)
    advanceToNextTask()
  }

  async function saveTask() {
    if (isRescheduling.value) return
    await commitCurrentTask()
  }

  async function rescheduleCurrentTask(dueDate: string): Promise<boolean> {
    if (!currentTask.value) return false
    const taskId = currentTask.value.id
    const oldDueDate = taskSnapshot.value?.dueDate ?? currentTask.value.dueDate ?? ''
    if (reschedulingTaskId.value === taskId) return false
    reschedulingTaskId.value = taskId
    try {
      await taskStore.updateTask(taskId, { dueDate })
      if (currentTaskId.value !== taskId || processedTaskIds.value.has(taskId)) return false
      quickSortStore.recordAction({
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'SAVE_TASK',
        taskId,
        oldDueDate,
        newDueDate: dueDate,
        advancesTask: false,
        timestamp: Date.now()
      })
      if (taskSnapshot.value?.taskId === taskId) taskSnapshot.value.dueDate = dueDate
      else snapshotCurrentTask()
      persistSession()
      return true
    } finally {
      if (reschedulingTaskId.value === taskId) reschedulingTaskId.value = null
    }
  }

  async function categorizeTask(taskId: string, projectId: string) {
    if (isRescheduling.value) return
    const task = taskStore.rawTasks.find((t) => t.id === taskId)
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
    persistSession()
  }

  function skipTask() {
    if (isRescheduling.value) return
    const tasks = quickSortTasks.value
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
    persistSession()
  }

  async function markTaskDone(taskId: string) {
    if (isRescheduling.value) return
    const oldStatus = taskStore.rawTasks.find(task => task.id === taskId)?.status ?? 'todo'

    // Mark task as done - AWAIT to ensure persistence (BUG-1051)
    await taskStore.updateTask(taskId, { status: 'done' })

    const action: CategoryAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'MARK_DONE',
      taskId,
      oldStatus,
      newStatus: 'done',
    oldProjectId: undefined,
    newProjectId: undefined,
    timestamp: Date.now()
  }

    quickSortStore.recordAction(action)
    addProcessedId(taskId)
    advanceToNextTask()
  }

  async function markDoneAndDeleteTask(taskId: string) {
    if (isRescheduling.value) return
    // Capture full task data before deletion so undo can recreate it
    const taskToDelete = taskStore._rawTasks.find(t => t.id === taskId)

    const action: CategoryAction = {
    id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'MARK_DONE_AND_DELETE',
    taskId,
    oldStatus: taskToDelete?.status ?? 'todo',
    newStatus: 'done',
    oldProjectId: undefined,
    newProjectId: undefined,
    deletedTask: taskToDelete ? { ...taskToDelete } : undefined,
      timestamp: Date.now()
    }

    quickSortStore.recordAction(action)
    addProcessedId(taskId)
    // Trigger recurrence clone-on-complete BEFORE deleting (Bug 3: recurrence system
    // only fires inside updateTask on a status transition to 'done')
    await taskStore.updateTask(taskId, { status: 'done' })
    // Delete the task - MUST await so task is removed before advancing
    await taskStore.deleteTask(taskId, 'quicksort')
    advanceToNextTask()
  }

  async function undoLastCategorization() {
    if (isRescheduling.value) return
    const action = quickSortStore.undo()
    if (!action) return

    if (action.type === 'SAVE_TASK') {
      // Restore snapshot fields
      const updates: Record<string, unknown> = {}
      if (action.oldProjectId !== undefined) updates.projectId = action.oldProjectId || undefined
      if (action.oldDueDate !== undefined) updates.dueDate = action.oldDueDate
      if (action.oldPriority !== undefined) updates.priority = action.oldPriority || undefined

      if (Object.keys(updates).length > 0) {
        await taskStore.updateTask(action.taskId, updates)
      }

      currentTaskId.value = action.taskId
      if (action.advancesTask !== false) {
        // Remove from processedTaskIds so it reappears
        processedTaskIds.value.delete(action.taskId)
        triggerRef(processedTaskIds)
        snapshotCurrentTask()
      } else if (taskSnapshot.value?.taskId === action.taskId) {
        // Postpone is only a due-date edit. Preserve the baseline for any other
        // unsaved fields while moving its due-date baseline with undo.
        taskSnapshot.value.dueDate = action.oldDueDate ?? ''
      } else {
        snapshotCurrentTask()
      }
    } else if (action.type === 'CATEGORIZE_TASK') {
      // Revert project assignment - AWAIT to ensure persistence (BUG-1051)
      await taskStore.updateTask(action.taskId, { projectId: action.oldProjectId || undefined })
    } else if (action.type === 'MARK_DONE') {
      // Revert status back to todo
      await taskStore.updateTask(action.taskId, {
        status: action.oldStatus ?? 'todo',
        projectId: action.oldProjectId || undefined
      })
      processedTaskIds.value.delete(action.taskId)
      triggerRef(processedTaskIds)
      currentTaskId.value = action.taskId
      snapshotCurrentTask()
    } else {
      // MARK_DONE_AND_DELETE - task was deleted; recreate it from stored snapshot
      if (action.deletedTask) {
        await taskStore.createTask({ ...action.deletedTask, status: action.oldStatus ?? 'todo' })
      }
      processedTaskIds.value.delete(action.taskId)
      triggerRef(processedTaskIds)
      currentTaskId.value = action.taskId
      snapshotCurrentTask()
    }
    persistSession()
  }

  async function redoLastCategorization() {
    if (isRescheduling.value) return
    const action = quickSortStore.redo()
    if (!action) return

    if (action.type === 'SAVE_TASK') {
      // Re-apply changes
      const updates: Record<string, unknown> = {}
      if (action.newProjectId !== undefined) updates.projectId = action.newProjectId
      if (action.newDueDate !== undefined) updates.dueDate = action.newDueDate
      if (action.newPriority !== undefined) updates.priority = action.newPriority || undefined

      if (Object.keys(updates).length > 0) {
        await taskStore.updateTask(action.taskId, updates)
      }
      if (action.advancesTask !== false) {
        addProcessedId(action.taskId)
        advanceToNextTask()
      } else {
        currentTaskId.value = action.taskId
        if (taskSnapshot.value?.taskId === action.taskId) taskSnapshot.value.dueDate = action.newDueDate ?? ''
        else snapshotCurrentTask()
      }
    } else if (action.type === 'CATEGORIZE_TASK') {
      // Reapply project assignment - AWAIT to ensure persistence (BUG-1051)
      await taskStore.updateTask(action.taskId, { projectId: action.newProjectId })
    } else if (action.type === 'MARK_DONE') {
      await taskStore.updateTask(action.taskId, {
        status: action.newStatus ?? 'done',
        projectId: action.newProjectId
      })
      addProcessedId(action.taskId)
      advanceToNextTask()
    } else {
      if (taskStore.rawTasks.some(task => task.id === action.taskId && !task._soft_deleted)) {
        await taskStore.updateTask(action.taskId, { status: action.newStatus ?? 'done' })
        await taskStore.deleteTask(action.taskId, 'quicksort-redo')
      }
      addProcessedId(action.taskId)
      advanceToNextTask()
    }
    persistSession()
  }

  function cancelSession() {
    quickSortStore.cancelSession()
    currentTaskId.value = null
    clearProcessedIds()
    queuedTaskIds.value = []
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
  watch(quickSortTasks, (tasks) => {
    if (!currentTaskId.value && tasks.length > 0 && quickSortStore.isActive) {
      currentTaskId.value = tasks[0].id
      snapshotCurrentTask()
    }
  })

  // Cleanup
  onUnmounted(() => {
    // Save any pending session data if active
    if (quickSortStore.isActive) {
      persistSession()
    }
  })

  return {
    // State
    currentTaskId,
    processedTaskIds,
    selectedSources,
    queuedTaskIds,
    isSessionActive,
    tasksSortedInSession,

    // Getters
    uncategorizedTasks,
    quickSortTasks,
    sourcePreviewTasks,
    sourceCounts,
    currentTask,
    progress,
    isComplete,
    isTaskDirty,
    isRescheduling,
    motivationalMessage,
    canUndo,
    canRedo,
    currentStreak: quickSortStore.currentStreak,

    // Actions
    startSession,
    endSession,
    previewSessionSummary: quickSortStore.previewSessionSummary,
    categorizeTask,
    saveTask,
    rescheduleCurrentTask,
    markTaskDone,
    markDoneAndDeleteTask,
    skipTask,
    undoLastCategorization,
    redoLastCategorization,
    cancelSession,
    tryResumeSession
  }
}
