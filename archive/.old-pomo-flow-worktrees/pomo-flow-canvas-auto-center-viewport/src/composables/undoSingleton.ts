// Undo System Singleton - Ensures shared instance across the entire application
// This solves initialization order issues between App.vue and globalKeyboardHandlerSimple.ts

import { ref, computed } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import { useTaskStore } from '@/stores/tasks'

// Global singleton refHistory instance - created only ONCE
let refHistoryInstance: ReturnType<typeof useManualRefHistory<any>> | null = null
let unifiedState: any = null
let canUndo: any = null
let canRedo: any = null
let undoCount: any = null
let redoCount: any = null
let history: any = null
let undo: any = null
let redo: any = null
let commit: any = null
let clear: any = null

/**
 * Initialize the single refHistory instance
 */
function initializeRefHistory() {
  if (refHistoryInstance) return

  console.log('🔄 Creating SINGLE refHistory instance for entire application...')

  const taskStore = useTaskStore()
  unifiedState = ref([...taskStore.tasks])

  // Create the SINGLE useManualRefHistory instance
  refHistoryInstance = useManualRefHistory(unifiedState, {
    capacity: 50
  })

  // Extract all the reactive properties
  canUndo = computed(() => refHistoryInstance!.canUndo.value)
  canRedo = computed(() => refHistoryInstance!.canRedo.value)
  // useManualRefHistory provides history tracking
  undoCount = computed(() => {
    if (!refHistoryInstance) return 0
    return refHistoryInstance.undoStack.value.length
  })
  redoCount = computed(() => {
    if (!refHistoryInstance) return 0
    return refHistoryInstance.redoStack.value.length
  })
  history = computed(() => refHistoryInstance!.history.value)

  // Bind the methods
  undo = refHistoryInstance.undo.bind(refHistoryInstance)
  redo = refHistoryInstance.redo.bind(refHistoryInstance)
  commit = refHistoryInstance.commit.bind(refHistoryInstance)
  clear = refHistoryInstance.clear.bind(refHistoryInstance)

  // Also store on window for direct access
  if (typeof window !== 'undefined') {
    (window as any).__pomoFlowUndoSystem = {
      canUndo,
      canRedo,
      undoCount,
      redoCount,
      history,
      undo,
      redo,
      commit,
      clear
    }
  }

  console.log('✅ SINGLE refHistory instance created and shared across app')
}

/**
 * Get the global undo system functions that use the shared refHistory instance
 */
export function getUndoSystem() {
  console.log('🔍 [DEBUG] getUndoSystem() called - creating or returning singleton instance')
  if (!refHistoryInstance) {
    console.log('🔍 [DEBUG] No refHistoryInstance exists, calling initializeRefHistory()')
    initializeRefHistory()
  } else {
    console.log('🔍 [DEBUG] refHistoryInstance already exists, reusing it')
  }

  const taskStore = useTaskStore()

  return {
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    history,

    // Standard undo/redo operations
    undo: () => {
      if (!refHistoryInstance || !unifiedState) return false
      console.log('🔄 Executing undo with SHARED refHistory instance...')
      refHistoryInstance.undo()

      // After undo, unifiedState.value now contains the previous state
      // Restore it to the task store
      const previousState = unifiedState.value
      if (previousState && Array.isArray(previousState)) {
        console.log('🔄 [VUE-REACTIVITY-FIX] Using store.restoreState for:', previousState.length, 'tasks')
        console.log('🔄 [VUE-REACTIVITY-FIX] Previous state sample:', previousState.slice(0, 2))

        // Use the new store action that uses $patch internally
        taskStore.restoreState(previousState)

        console.log('🔄 [VUE-REACTIVITY-FIX] Task store now has:', taskStore.tasks.length, 'tasks')
        return true
      }
      return false
    },

    redo: () => {
      if (!refHistoryInstance || !unifiedState) return false
      console.log('🔄 Executing redo with SHARED refHistory instance...')
      refHistoryInstance.redo()

      // After redo, unifiedState.value now contains the next state
      // Restore it to the task store
      const nextState = unifiedState.value
      if (nextState && Array.isArray(nextState)) {
        console.log('🔄 [VUE-REACTIVITY-FIX] Using store.restoreState for redo:', nextState.length, 'tasks')
        console.log('🔄 [VUE-REACTIVITY-FIX] Next state sample:', nextState.slice(0, 2))

        // Use the new store action that uses $patch internally
        taskStore.restoreState(nextState)

        console.log('🔄 [VUE-REACTIVITY-FIX] Task store now has:', taskStore.tasks.length, 'tasks')
        return true
      }
      return false
    },

    // State management for task operations
    saveStateBefore: (description?: string) => {
      if (!refHistoryInstance) return false
      try {
        const taskStore = useTaskStore()
        unifiedState.value = [...taskStore.tasks]
        commit()
        console.log(`💾 State saved BEFORE change: ${description || 'Before operation'}. History length: ${refHistoryInstance.history.value.length}`)
        return true
      } catch (error) {
        console.error('❌ Failed to save state before change:', error)
        return false
      }
    },

    saveStateAfter: (description?: string) => {
      if (!refHistoryInstance) return false
      try {
        const taskStore = useTaskStore()
        unifiedState.value = [...taskStore.tasks]
        commit()
        console.log(`💾 State saved AFTER change: ${description || 'After operation'}. History length: ${refHistoryInstance.history.value.length}`)
        return true
      } catch (error) {
        console.error('❌ Failed to save state after change:', error)
        return false
      }
    },

    // Task operations that use the shared refHistory
    deleteTaskWithUndo: (taskId: string) => {
      console.log('🗑️ [SINGLETON-V3-22:58] deleteTaskWithUndo called for:', taskId)

      // Save state BEFORE deletion
      const globalUndo = getUndoSystem()
      globalUndo.saveStateBefore('Before task deletion')

      // Perform the deletion
      const task = taskStore.tasks.find(t => t.id === taskId)
      if (task) {
        console.log(`🗑️ Deleting task: ${task.title}`)
        taskStore.deleteTask(taskId)
        console.log(`✅ Task deleted. Current tasks count: ${taskStore.tasks.length}`)
      }

      // Save state AFTER deletion
      globalUndo.saveStateAfter('After task deletion')
    },

    updateTaskWithUndo: (taskId: string, updates: any) => {
      console.log('✏️ updateTaskWithUndo called for:', taskId, updates)

      // Save state BEFORE update
      const globalUndo = getUndoSystem()
      globalUndo.saveStateBefore('Before task update')

      // Perform the update
      taskStore.updateTask(taskId, updates)
      console.log(`✅ Task updated: ${taskId}`)

      // Save state AFTER update
      globalUndo.saveStateAfter('After task update')
    },

    createTaskWithUndo: (taskData: any) => {
      console.log('➕ [SINGLETON] createTaskWithUndo called with:', taskData)

      // Save state BEFORE creation
      const globalUndo = getUndoSystem()
      globalUndo.saveStateBefore('Before task creation')

      // Create the task
      const newTask = taskStore.createTask(taskData)
      console.log(`✅ Task created: ${newTask.title}`)

      // Save state AFTER creation
      globalUndo.saveStateAfter('After task creation')
      return newTask
    }
  }
}

/**
 * Check if the undo system is initialized
 */
export function isUndoSystemInitialized(): boolean {
  return refHistoryInstance !== null
}

/**
 * Reset the undo system (useful for testing)
 */
export function resetUndoSystem() {
  refHistoryInstance = null
  unifiedState = null
  canUndo = null
  canRedo = null
  undoCount = null
  redoCount = null
  history = null
  undo = null
  redo = null
  commit = null
  clear = null
  if (typeof window !== 'undefined') {
    delete (window as any).__pomoFlowUndoSystem
  }
  console.log('🔄 UndoSingleton: Reset global refHistory instance')
}