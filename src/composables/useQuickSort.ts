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

  // State
  const currentIndex = ref(0)

  // Getters
  // Fixed: Use direct filtering instead of mutating store state (antipattern)
  // TASK-243: Use raw tasks so Quick Sort sees ALL uncategorized tasks regardless of active smart view
  const uncategorizedTasks = computed<Task[]>(() => {
    return taskStore.rawTasks.filter(task => !task._soft_deleted && isUncategorizedTask(task))
  })

  // Watch for list updates to clamp index
  // This handles cases where tasks are removed or the list shrinks
  watch(uncategorizedTasks, (newTasks) => {
    if (newTasks.length === 0) {
      if (quickSortStore.isActive && !isComplete.value) {
          // Logic handled by isComplete view watcher mostly, but ensuring internal consistency
      }
    } else if (currentIndex.value >= newTasks.length) {
      // If we were at the end and items were removed, wrap to start
      // Or if list shrank significantly
      currentIndex.value = 0
    }
  })

  const currentTask = computed<Task | null>(() => {
    if (currentIndex.value < 0 || currentIndex.value >= uncategorizedTasks.value.length) {
      return null
    }
    return uncategorizedTasks.value[currentIndex.value]
  })

  const hasNext = computed(() => currentIndex.value < uncategorizedTasks.value.length - 1)

  const hasPrevious = computed(() => currentIndex.value > 0)

  const progress = computed(() => {
    const total = uncategorizedTasks.value.length
    if (total === 0) return { current: 0, total: 0, percentage: 100 }

    return {
      current: currentIndex.value + 1,
      total,
      percentage: Math.round(((currentIndex.value + 1) / total) * 100)
    }
  })

  const isComplete = computed(() => uncategorizedTasks.value.length === 0)

  const motivationalMessage = computed(() => {
    const percent = progress.value.percentage
    if (percent < 25) return "Great start! 🚀"
    if (percent < 50) return "You're on fire! 🔥"
    if (percent < 75) return "Almost there! 💪"
    if (percent < 100) return "Final push! 🎯"
    return "All done! 🎉"
  })

  // Actions
  function startSession() {
    quickSortStore.startSession()
    currentIndex.value = 0
  }

  function endSession() {
    const summary = quickSortStore.endSession()
    currentIndex.value = 0
    return summary
  }

  function handleTaskProcessed() {
    // Called when a task is removed from the list (categorized, done, deleted)
    // The list will update reactively.
    // The watcher will handle clamping if currentIndex becomes invalid.

    // Check completion
    if (isComplete.value) {
      endSession()
    }

    // Note: We DO NOT increment currentIndex here.
    // Because the current item was removed, the next item slides into this index.
    // So we are effectively looking at the next item already.
  }

  function categorizeTask(taskId: string, projectId: string) {
    const task = taskStore.tasks.find((t) => t.id === taskId)
    if (!task) return

    const oldProjectId = task.projectId || null

    // Create action for undo/redo
    const action: CategoryAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'CATEGORIZE_TASK',
      taskId,
      oldProjectId,
      newProjectId: projectId,
      timestamp: Date.now()
    }

    // Update task
    taskStore.updateTask(taskId, { projectId })

    // Record action
    quickSortStore.recordAction(action)

    handleTaskProcessed()
  }

  // Renamed from moveToNext to avoid confusion - this is for SKIPPING
  function skipTask() {
    if (uncategorizedTasks.value.length === 0) return

    // Increment index
    currentIndex.value++

    // Wrap around if we reach the end
    if (currentIndex.value >= uncategorizedTasks.value.length) {
      currentIndex.value = 0
    }
  }

  function moveToPrevious() {
    if (hasPrevious.value) {
      currentIndex.value--
    }
  }

  function undoLastCategorization() {
    const action = quickSortStore.undo()
    if (!action) return

    // Revert the task update
    taskStore.updateTask(action.taskId, { projectId: action.oldProjectId || undefined })

    // Adjust index if needed
    // If the restored task reappears at the current index, we might not need to move.
    // But if we want to "go back" to it, we might need to decrement.
    // Current logic:
    if (currentIndex.value > 0) {
      currentIndex.value--
    }
  }

  function redoLastCategorization() {
    const action = quickSortStore.redo()
    if (!action) return

    // Reapply the task update
    taskStore.updateTask(action.taskId, { projectId: action.newProjectId })

    handleTaskProcessed()
  }

  function cancelSession() {
    quickSortStore.cancelSession()
    currentIndex.value = 0
  }

  function markTaskDone(taskId: string) {
    // Mark task as done
    taskStore.updateTask(taskId, { status: 'done' })

    // Create action for undo/redo
    const action: CategoryAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'CATEGORIZE_TASK',
      taskId,
      oldProjectId: undefined,
      newProjectId: undefined,
      timestamp: Date.now()
    }

    // Record action
    quickSortStore.recordAction(action)

    handleTaskProcessed()
  }

  function markDoneAndDeleteTask(taskId: string) {
    // First mark as done (for consistent history tracking/logging usually)
    // But here we just delete it.

    // Create action for undo/redo - treat as categorize for now to keep simple
    const action: CategoryAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'CATEGORIZE_TASK',
      taskId,
      oldProjectId: undefined,
      newProjectId: undefined,
      timestamp: Date.now()
    }

    // Record action
    quickSortStore.recordAction(action)

    // Delete the task
    taskStore.deleteTask(taskId)

    handleTaskProcessed()
  }

  function goToTask(index: number) {
    if (index >= 0 && index < uncategorizedTasks.value.length) {
      currentIndex.value = index
    }
  }

  // Cleanup
  onUnmounted(() => {
    // Save any pending session data if active
    if (quickSortStore.isActive) {
      quickSortStore.saveToLocalStorage()
    }
  })

  return {
    // State
    currentIndex,

    // Getters
    uncategorizedTasks,
    currentTask,
    hasNext,
    hasPrevious,
    progress,
    isComplete,
    motivationalMessage,
    canUndo: quickSortStore.canUndo,
    canRedo: quickSortStore.canRedo,
    currentStreak: quickSortStore.currentStreak,

    // Actions
    startSession,
    endSession,
    categorizeTask,
    markTaskDone,
    markDoneAndDeleteTask,
    moveToNext: skipTask, // Alias for backward compatibility if needed, or just use skipTask
    moveToPrevious,
    skipTask,
    undoLastCategorization,
    redoLastCategorization,
    cancelSession,
    goToTask
  }
}
