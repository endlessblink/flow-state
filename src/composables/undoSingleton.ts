// Undo System Singleton - Ensures shared instance across the entire application
// This solves initialization order issues between App.vue and globalKeyboardHandlerSimple.ts

import { ref, computed, nextTick } from 'vue'
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

  // Create the SINGLE useManualRefHistory instance with proper VueUse configuration
  // NOTE: deep: true was intentionally removed for performance reasons (deep watchers issue)
  refHistoryInstance = useManualRefHistory(unifiedState, {
    capacity: 50,
    clone: true
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

// ✅ FIXED - Functions defined at module level (outside return object)
const performUndo = () => {
  if (!refHistoryInstance || !unifiedState) return false
  console.log('🔄 Executing undo with SHARED refHistory instance...')
  refHistoryInstance.undo()

  // After undo, unifiedState.value now contains the previous state
  // Restore it to the task store
  const previousState = unifiedState.value
  if (previousState && Array.isArray(previousState)) {
    const taskStore = useTaskStore()
    console.log('🔄 [VUE-REACTIVITY-FIX] Using store.restoreState for:', previousState.length, 'tasks')
    console.log('🔄 [VUE-REACTIVITY-FIX] Previous state sample:', previousState.slice(0, 2))

    // Use the new store action that uses $patch internally
    taskStore.restoreState(previousState)

    console.log('🔄 [VUE-REACTIVITY-FIX] Task store now has:', taskStore.tasks.length, 'tasks')
    return true
  }
  return false
}

const performRedo = () => {
  if (!refHistoryInstance || !unifiedState) return false
  console.log('🔄 Executing redo with SHARED refHistory instance...')
  refHistoryInstance.redo()

  // After redo, unifiedState.value now contains the next state
  // Restore it to the task store
  const nextState = unifiedState.value
  if (nextState && Array.isArray(nextState)) {
    const taskStore = useTaskStore()
    console.log('🔄 [VUE-REACTIVITY-FIX] Using store.restoreState for redo:', nextState.length, 'tasks')
    console.log('🔄 [VUE-REACTIVITY-FIX] Next state sample:', nextState.slice(0, 2))

    // Use the new store action that uses $patch internally
    taskStore.restoreState(nextState)

    console.log('🔄 [VUE-REACTIVITY-FIX] Task store now has:', taskStore.tasks.length, 'tasks')
    return true
  }
  return false
}

const saveState = (description?: string) => {
  if (!refHistoryInstance) return false
  // FIX: Add null check for commit function to prevent silent failures
  if (!commit) {
    console.error('❌ [UNDO] commit function not initialized - calling initializeRefHistory()')
    initializeRefHistory()
    if (!commit) {
      console.error('❌ [UNDO] commit function still not initialized after retry')
      return false
    }
  }
  try {
    const taskStore = useTaskStore()
    // FIXED: Use raw tasks, not filteredTasks to prevent state synchronization issues
    unifiedState.value = [...taskStore.tasks]
    commit()
    console.log(`💾 State saved: ${description || 'Operation'}. History length: ${refHistoryInstance.history.value.length}`)
    return true
  } catch (error) {
    console.error('❌ Failed to save state:', error)
    return false
  }
}

const deleteTaskWithUndo = async (taskId: string) => {
  console.log('🗑️ deleteTaskWithUndo called for:', taskId)
  const taskStore = useTaskStore()

  const taskToDelete = taskStore.tasks.find(t => t.id === taskId)
  if (!taskToDelete) {
    console.warn('⚠️ Task not found for deletion:', taskId)
    return
  }

  console.log(`🗑️ Deleting task: ${taskToDelete.title}`)

  // FIXED: Use proper VueUse pattern - save state before operation
  saveState('Before task deletion')

  try {
    // Perform the deletion
    await taskStore.deleteTask(taskId)
    console.log(`✅ Task deleted. Current tasks count: ${taskStore.tasks.length}`)

    // FIXED: Save state after operation
    await nextTick()
    saveState('After task deletion')
  } catch (error) {
    console.error('❌ deleteTaskWithUndo failed:', error)
    throw error
  }
}

const updateTaskWithUndo = async (taskId: string, updates: any) => {
  console.log('✏️ updateTaskWithUndo called for:', taskId, updates)
  const taskStore = useTaskStore()

  const taskToUpdate = taskStore.tasks.find(t => t.id === taskId)
  if (!taskToUpdate) {
    console.warn('⚠️ Task not found for update:', taskId)
    return
  }

  console.log(`✏️ Updating task: ${taskToUpdate.title}`)

  // FIXED: Use proper VueUse pattern - save state before operation
  saveState('Before task update')

  // Perform the update
  taskStore.updateTask(taskId, updates)
  console.log(`✅ Task updated: ${taskId}`)

  // FIXED: Save state after operation
  await nextTick()
  saveState('After task update')
}

const createTaskWithUndo = async (taskData: any) => {
  console.log('➕ createTaskWithUndo called with:', taskData)

  // FIXED: Use proper VueUse pattern - save state before operation
  saveState('Before task creation')

  // Create the task
  const taskStore = useTaskStore()
  const newTask = await taskStore.createTask(taskData)
  console.log(`✅ Task created: ${newTask.title}`)

  // FIXED: Save state after operation
  await nextTick()
  saveState('After task creation')
  return newTask
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

  return {
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    history,

    // Standard undo/redo operations
    undo: performUndo,
    redo: performRedo,

    // FIXED: Unified state management using VueUse pattern
    saveState,               // Use unified saveState function instead of before/after

    // Task operations that use the shared refHistory
    deleteTaskWithUndo,
    updateTaskWithUndo,
    createTaskWithUndo
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