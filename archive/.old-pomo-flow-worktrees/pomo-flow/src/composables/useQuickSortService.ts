/**
 * SERVICE-ORCHESTRATOR-BASED QUICK SORT
 *
 * Replaces direct task store access with ServiceOrchestrator integration.
 * Provides Quick Sort functionality through the unified service layer.
 */

import { ref, computed, onUnmounted, watch } from 'vue'
import { useServiceOrchestrator } from '@/services/ServiceOrchestrator'
import { useQuickSortStore } from '@/stores/quickSort'
import type { Task } from '@/types/task'
import type { CategoryAction } from '@/stores/quickSort'

export function useQuickSortService() {
  const serviceOrchestrator = useServiceOrchestrator()
  const quickSortStore = useQuickSortStore()

  // State
  const currentIndex = ref(0)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters using ServiceOrchestrator filtering
  const uncategorizedTasks = computed<Task[]>(() => {
    console.log(`🔍 [QUICK-SORT-SERVICE] Filtering tasks for uncategorized tasks...`)

    const filtered = serviceOrchestrator.getFilteredTasks({
      smartView: 'uncategorized',
      hideDoneTasks: true, // Don't show completed tasks
      includeCompleted: false
    })

    console.log(`🔍 [QUICK-SORT-SERVICE] Found ${filtered.length} uncategorized tasks`)

    return filtered
  })

  const currentTask = computed<Task | null>(() => {
    if (currentIndex.value < 0 || currentIndex.value >= uncategorizedTasks.value.length) {
      return null
    }
    return uncategorizedTasks.value[currentIndex.value]
  })

  // Watch for changes in uncategorizedTasks to adjust currentIndex if needed
  watch(uncategorizedTasks, (newTasks, oldTasks) => {
    if (newTasks.length !== oldTasks?.length) {
      console.log(`🔄 [QUICK-SORT-SERVICE] Tasks array changed from ${oldTasks?.length || 0} to ${newTasks.length} tasks`)

      // Adjust currentIndex if it's now out of bounds
      if (currentIndex.value >= newTasks.length) {
        const oldIndex = currentIndex.value
        currentIndex.value = Math.max(0, newTasks.length - 1)
        console.log(`🔄 [QUICK-SORT-SERVICE] Adjusted currentIndex from ${oldIndex} to ${currentIndex.value}`)
      }

      // If no tasks left, reset to 0
      if (newTasks.length === 0) {
        currentIndex.value = 0
        console.log(`🔄 [QUICK-SORT-SERVICE] No tasks remaining, reset currentIndex to 0`)
      }
    }
  }, { immediate: true })

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

  // Actions using ServiceOrchestrator
  async function startSession() {
    isLoading.value = true
    error.value = null

    try {
      quickSortStore.startSession()
      // Set the main view to show uncategorized tasks to synchronize with Quick Sort
      // Note: ServiceOrchestrator handles view state through filtering
      currentIndex.value = 0
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start session'
    } finally {
      isLoading.value = false
    }
  }

  function endSession() {
    try {
      const summary = quickSortStore.endSession()
      currentIndex.value = 0
      return summary
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to end session'
      return null
    }
  }

  async function categorizeTask(taskId: string, projectId: string) {
    isLoading.value = true
    error.value = null

    try {
      // Update task using ServiceOrchestrator
      const result = await serviceOrchestrator.updateTask(taskId, { projectId })

      if (!result.success) {
        throw new Error(result.error || 'Failed to categorize task')
      }

      // Record simple session statistics only
      quickSortStore.recordAction({
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'CATEGORIZE_TASK',
        taskId,
        timestamp: Date.now()
      } as CategoryAction)

      // Move to next task automatically
      moveToNext()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to categorize task'
    } finally {
      isLoading.value = false
    }
  }

  async function markTaskDone(taskId: string) {
    isLoading.value = true
    error.value = null

    try {
      // Update task status to done using ServiceOrchestrator
      const result = await serviceOrchestrator.updateTask(taskId, { status: 'done' })

      if (!result.success) {
        throw new Error(result.error || 'Failed to mark task as done')
      }

      // Record simple session statistics only
      quickSortStore.recordAction({
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'MARK_DONE',
        taskId,
        timestamp: Date.now()
      } as CategoryAction)

      // Move to next task automatically
      moveToNext()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to mark task as done'
    } finally {
      isLoading.value = false
    }
  }

  async function markDoneAndDeleteTask(taskId: string) {
    isLoading.value = true
    error.value = null

    try {
      // Delete task using ServiceOrchestrator
      const result = await serviceOrchestrator.deleteTask(taskId)

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete task')
      }

      // Record simple session statistics only
      quickSortStore.recordAction({
        id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'MARK_DONE_AND_DELETE',
        taskId,
        timestamp: Date.now()
      } as CategoryAction)

      // Move to next task automatically (index stays same since task was removed)
      // No need to call moveToNext, just stay at current index
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete task'
    } finally {
      isLoading.value = false
    }
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

  async function undoLastCategorization() {
    isLoading.value = true
    error.value = null

    try {
      // Use ServiceOrchestrator undo
      const success = await serviceOrchestrator.undo()

      if (!success) {
        throw new Error('Failed to undo last action')
      }

      // Adjust index if needed
      if (currentIndex.value > 0) {
        currentIndex.value--
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to undo'
    } finally {
      isLoading.value = false
    }
  }

  async function redoLastCategorization() {
    isLoading.value = true
    error.value = null

    try {
      // Use ServiceOrchestrator redo
      const success = await serviceOrchestrator.redo()

      if (!success) {
        throw new Error('Failed to redo last action')
      }

      // Move forward
      moveToNext()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to redo'
    } finally {
      isLoading.value = false
    }
  }

  function cancelSession() {
    try {
      quickSortStore.cancelSession()
      currentIndex.value = 0
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to cancel session'
    }
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

  // Utility methods
  const clearError = () => {
    error.value = null
  }

  return {
    // State
    currentIndex,
    isLoading,
    error,

    // Getters
    uncategorizedTasks,
    currentTask,
    hasNext,
    hasPrevious,
    progress,
    isComplete,
    motivationalMessage,
    canUndo: serviceOrchestrator.canUndo,
    canRedo: serviceOrchestrator.canRedo,
    currentStreak: quickSortStore.currentStreak,

    // Actions
    startSession,
    endSession,
    categorizeTask,
    markTaskDone,
    markDoneAndDeleteTask,
    moveToNext,
    moveToPrevious,
    skipTask,
    undoLastCategorization,
    redoLastCategorization,
    cancelSession,
    goToTask,

    // Utility methods
    clearError,

    // Service access
    serviceOrchestrator
  }
}