/**
 * SERVICE-ORCHESTRATOR-BASED UNDO/REDO SYSTEM
 *
 * Replaces direct task store access with ServiceOrchestrator integration.
 * Provides unified undo/redo functionality through the service layer.
 */

import { computed } from 'vue'
import { useServiceOrchestrator } from '@/services/ServiceOrchestrator'
import type { Task } from '@/types/task'

export function useUndoRedoService() {
  const serviceOrchestrator = useServiceOrchestrator()

  // Computed properties from ServiceOrchestrator
  const canUndo = computed(() => serviceOrchestrator.canUndo())
  const canRedo = computed(() => serviceOrchestrator.canRedo())

  // Task operations with undo support through ServiceOrchestrator
  const createTaskWithUndo = async (taskData: Partial<Task>): Promise<Task | null> => {
    try {
      const result = await serviceOrchestrator.createTask(taskData)
      if (result.success && result.data) {
        return result.data
      }
      return null
    } catch (error) {
      console.error('❌ createTaskWithUndo failed:', error)
      return null
    }
  }

  const updateTaskWithUndo = async (taskId: string, updates: Partial<Task>): Promise<Task | null> => {
    try {
      const result = await serviceOrchestrator.updateTask(taskId, updates)
      if (result.success && result.data) {
        return result.data
      }
      return null
    } catch (error) {
      console.error('❌ updateTaskWithUndo failed:', error)
      return null
    }
  }

  const deleteTaskWithUndo = async (taskId: string): Promise<boolean> => {
    try {
      const result = await serviceOrchestrator.deleteTask(taskId)
      return result.success
    } catch (error) {
      console.error('❌ deleteTaskWithUndo failed:', error)
      return false
    }
  }

  // Move operations with undo
  const moveTaskWithUndo = async (taskId: string, newStatus: string): Promise<boolean> => {
    try {
      const result = await serviceOrchestrator.updateTask(taskId, { status: newStatus })
      return result.success
    } catch (error) {
      console.error('❌ moveTaskWithUndo failed:', error)
      return false
    }
  }

  const moveTaskToProjectWithUndo = async (taskId: string, projectId: string): Promise<boolean> => {
    try {
      const result = await serviceOrchestrator.updateTask(taskId, { projectId })
      return result.success
    } catch (error) {
      console.error('❌ moveTaskToProjectWithUndo failed:', error)
      return false
    }
  }

  // Core undo/redo operations
  const undo = async (): Promise<boolean> => {
    try {
      return await serviceOrchestrator.undo()
    } catch (error) {
      console.error('❌ Undo failed:', error)
      return false
    }
  }

  const redo = async (): Promise<boolean> => {
    try {
      return await serviceOrchestrator.redo()
    } catch (error) {
      console.error('❌ Redo failed:', error)
      return false
    }
  }

  // Computed property for UI state
  const lastAction = computed(() => {
    const stores = serviceOrchestrator.getStores()
    const undoRedo = stores.undoRedo

    if (undoRedo?.history && undoRedo.history.length > 0) {
      const time = new Date().toLocaleTimeString()
      return `Last action at ${time} (${undoRedo.history.length} states in history)`
    }
    return 'No actions yet'
  })

  // Batch operations with undo support
  const createMultipleTasksWithUndo = async (tasksData: Partial<Task>[]) => {
    try {
      const result = await serviceOrchestrator.createMultipleTasks(tasksData)
      return result
    } catch (error) {
      console.error('❌ createMultipleTasksWithUndo failed:', error)
      return {
        success: false,
        results: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        summary: { total: tasksData.length, successful: 0, failed: tasksData.length }
      }
    }
  }

  const deleteMultipleTasksWithUndo = async (taskIds: string[]) => {
    try {
      const result = await serviceOrchestrator.deleteMultipleTasks(taskIds)
      return result
    } catch (error) {
      console.error('❌ deleteMultipleTasksWithUndo failed:', error)
      return {
        success: false,
        results: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: [],
        summary: { total: taskIds.length, successful: 0, failed: taskIds.length }
      }
    }
  }

  // Checkpoint management for complex operations
  const createCheckpoint = (description: string): string => {
    const stores = serviceOrchestrator.getStores()
    const undoRedo = stores.undoRedo

    if (undoRedo?.createCheckpoint) {
      return undoRedo.createCheckpoint(description)
    }

    // Fallback - return a timestamp-based ID
    return `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  const restoreCheckpoint = async (checkpointId: string): Promise<boolean> => {
    const stores = serviceOrchestrator.getStores()
    const undoRedo = stores.undoRedo

    if (undoRedo?.restoreCheckpoint) {
      try {
        return await undoRedo.restoreCheckpoint(checkpointId)
      } catch (error) {
        console.error('❌ restoreCheckpoint failed:', error)
        return false
      }
    }

    console.warn('⚠️ restoreCheckpoint not available in current undo/redo implementation')
    return false
  }

  // Statistics and debugging
  const getUndoRedoStatistics = () => {
    const stores = serviceOrchestrator.getStores()
    const undoRedo = stores.undoRedo

    return {
      canUndo: canUndo.value,
      canRedo: canRedo.value,
      undoCount: undoRedo?.undoCount || 0,
      redoCount: undoRedo?.redoCount || 0,
      historyLength: undoRedo?.history?.length || 0,
      totalActions: undoRedo?.totalActions || 0,
      lastAction: lastAction.value
    }
  }

  // Clear history (for maintenance or debugging)
  const clearHistory = (): boolean => {
    const stores = serviceOrchestrator.getStores()
    const undoRedo = stores.undoRedo

    if (undoRedo?.clearHistory) {
      try {
        undoRedo.clearHistory()
        console.log('🗑️ Undo/redo history cleared')
        return true
      } catch (error) {
        console.error('❌ Failed to clear undo/redo history:', error)
        return false
      }
    }

    console.warn('⚠️ clearHistory not available in current undo/redo implementation')
    return false
  }

  return {
    // State
    canUndo,
    canRedo,
    lastAction,

    // Core operations
    undo,
    redo,

    // Task operations with undo
    createTaskWithUndo,
    updateTaskWithUndo,
    deleteTaskWithUndo,
    moveTaskWithUndo,
    moveTaskToProjectWithUndo,

    // Batch operations
    createMultipleTasksWithUndo,
    deleteMultipleTasksWithUndo,

    // Checkpoint management
    createCheckpoint,
    restoreCheckpoint,

    // Statistics and debugging
    getUndoRedoStatistics,
    clearHistory,

    // Service access
    serviceOrchestrator
  }
}

// Export type for TypeScript support
export type UndoRedoService = ReturnType<typeof useUndoRedoService>