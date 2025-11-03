import { ref, computed, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useQuickSortStore } from '@/stores/quickSort'
import type { Task } from '@/types/tasks'
import type { CategoryAction } from '@/stores/quickSort'

export function useQuickSort() {
  const taskStore = useTaskStore()
  const quickSortStore = useQuickSortStore()

  // State
  const currentIndex = ref(0)

  // Getters
  const uncategorizedTasks = computed<Task[]>(() => {
    return taskStore.tasks.filter(
      (task) => !task.projectId || task.projectId === '' || task.projectId === null
    )
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

    // Move to next task automatically
    moveToNext()
  }

  function moveToNext() {
    if (hasNext.value) {
      currentIndex.value++
    } else if (isComplete.value) {
      // All tasks categorized
      endSession()
    }
  }

  function moveToPrevious() {
    if (hasPrevious.value) {
      currentIndex.value--
    }
  }

  function skipTask() {
    // Skip without categorizing
    moveToNext()
  }

  function undoLastCategorization() {
    const action = quickSortStore.undo()
    if (!action) return

    // Revert the task update
    taskStore.updateTask(action.taskId, { projectId: action.oldProjectId })

    // Adjust index if needed
    if (currentIndex.value > 0) {
      currentIndex.value--
    }
  }

  function redoLastCategorization() {
    const action = quickSortStore.redo()
    if (!action) return

    // Reapply the task update
    taskStore.updateTask(action.taskId, { projectId: action.newProjectId })

    // Move forward
    moveToNext()
  }

  function cancelSession() {
    quickSortStore.cancelSession()
    currentIndex.value = 0
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
    moveToNext,
    moveToPrevious,
    skipTask,
    undoLastCategorization,
    redoLastCategorization,
    cancelSession,
    goToTask
  }
}
