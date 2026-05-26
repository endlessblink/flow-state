// Unified Undo/Redo System for Pomo-Flow
// CONSOLIDATED VERSION - Uses singleton pattern exclusively
// RESOLVES: Multiple competing undo implementations
// VERSION: Singleton-Consolidation-v1 - 2025-10-23T06:56:00Z

import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import { getUndoSystem } from './undoSingleton'

export const useUnifiedUndoRedo = () => {
  const taskStore = useTaskStore()

  // DELEGATE to singleton system exclusively
  const singletonUndo = getUndoSystem()

  // Export singleton interface for backward compatibility
  const {
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    history,
    undo,
    redo,
    saveState: _saveState
  } = singletonUndo

  // Sync state from store (call after operations that don't use undo)
  const syncFromStore = () => {
    // Note: No longer needed with singleton pattern
    // Kept for backward compatibility
  }

  // Task operations with undo support - Use proper VueUse pattern
  const deleteTaskWithUndo = async (taskId: string) => {
    return await singletonUndo.deleteTaskWithUndo(taskId)
  }

  const bulkDeleteTasksWithUndo = async (taskIds: string[]) => {
    return await singletonUndo.bulkDeleteTasksWithUndo(taskIds)
  }

  const updateTaskWithUndo = async (taskId: string, updates: Partial<Task>) => {
    return await singletonUndo.updateTaskWithUndo(taskId, updates)
  }

  const createTaskWithUndo = async (taskData: Partial<Task>) => {
    return await singletonUndo.createTaskWithUndo(taskData)
  }

  const moveTaskWithUndo = async (taskId: string, newStatus: string) => {
    return await singletonUndo.updateTaskWithUndo(taskId, { status: newStatus as Task['status'] })
  }

  const moveTaskToProjectWithUndo = async (taskId: string, projectId: string) => {
    return await singletonUndo.updateTaskWithUndo(taskId, { projectId })
  }

  // Computed properties for UI state
  const lastAction = computed(() => {
    if (history?.value && history.value.length > 0) {
      const time = new Date().toLocaleTimeString()
      return `Last action at ${time} (${history.value.length} states in history)`
    }
    return 'No actions yet'
  })

  return {
    // State tracking (from singleton)
    history,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    lastAction,

    // Core actions (from singleton)
    undo,
    redo,
    syncFromStore,

    // Task operations with undo support
    deleteTaskWithUndo,
    bulkDeleteTasksWithUndo,
    updateTaskWithUndo,
    createTaskWithUndo,
    moveTaskWithUndo,
    moveTaskToProjectWithUndo
  }
}

// Export type for TypeScript support
export type UnifiedUndoRedo = ReturnType<typeof useUnifiedUndoRedo>

// Export the singleton function for external access
export { getUndoSystem } from './undoSingleton'
