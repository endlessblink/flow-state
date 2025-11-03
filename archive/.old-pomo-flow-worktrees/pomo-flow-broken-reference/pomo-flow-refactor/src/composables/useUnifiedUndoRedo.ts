// Unified Undo/Redo System for Pomo-Flow
// CONSOLIDATED VERSION - Uses singleton pattern exclusively
// RESOLVES: Multiple competing undo implementations
// VERSION: Singleton-Consolidation-v1 - 2025-10-23T06:56:00Z

import { computed } from 'vue'
import { useTaskStore } from '@/stores/tasks'
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
    saveStateBefore,
    saveStateAfter
  } = singletonUndo

  // Sync state from store (call after operations that don't use undo)
  const syncFromStore = () => {
    // Note: No longer needed with singleton pattern
    // Kept for backward compatibility
    console.log('🔄 syncFromStore called - using singleton pattern')
  }

  // Task operations with undo support - DELEGATE to singleton
  const deleteTaskWithUndo = (taskId: string) => {
    console.log('🗑️ [CONSOLIDATED] deleteTaskWithUndo called for:', taskId)
    return singletonUndo.deleteTaskWithUndo(taskId)
  }

  const updateTaskWithUndo = (taskId: string, updates: any) => {
    console.log('✏️ [CONSOLIDATED] updateTaskWithUndo called for:', taskId, updates)
    return singletonUndo.updateTaskWithUndo(taskId, updates)
  }

  const createTaskWithUndo = (taskData: any) => {
    console.log('➕ [CONSOLIDATED] createTaskWithUndo called with:', taskData)

    // Save state BEFORE creation
    saveStateBefore('Before task creation')

    // Create the task
    const newTask = taskStore.createTask(taskData)
    console.log(`✅ Task created: ${newTask.title}`)

    // Save state AFTER creation
    saveStateAfter('After task creation')
    return newTask
  }

  // Move operations with undo
  const moveTaskWithUndo = (taskId: string, newStatus: string) => {
    console.log('📍 [CONSOLIDATED] moveTaskWithUndo called for:', taskId, 'to:', newStatus)

    saveStateBefore('Before task move')
    taskStore.moveTask(taskId, newStatus)
    saveStateAfter('After task move')
    console.log(`✅ Task moved: ${taskId} to ${newStatus}`)
  }

  const moveTaskToProjectWithUndo = (taskId: string, projectId: string) => {
    console.log('🏢 [CONSOLIDATED] moveTaskToProjectWithUndo called for:', taskId, 'to:', projectId)

    saveStateBefore('Before project move')
    taskStore.moveTaskToProject(taskId, projectId)
    saveStateAfter('After project move')
    console.log(`✅ Task moved to project: ${taskId} to ${projectId}`)
  }

  // Computed properties for UI state
  const lastAction = computed(() => {
    if (history.value && history.value.length > 0) {
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