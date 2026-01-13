// Undo System Singleton - Ensures shared instance across the entire application
// This solves initialization order issues between App.vue and globalKeyboardHandlerSimple.ts
// UPDATED: Now tracks both tasks AND canvas groups for unified undo/redo (ISSUE-008 fix)

import { ref, computed, nextTick } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import type { Task } from '../stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import type { CanvasGroup } from '@/stores/canvas/types'
import { guardTaskCreation } from '../utils/demoContentGuard'

declare global {
  interface Window {
    __pomoFlowUndoSystem?: any
  }
}

// Combined state interface for tracking both tasks and groups
interface UnifiedUndoState {
  tasks: Task[]
  groups: CanvasGroup[]
}

// Global singleton refHistory instance - created only ONCE
let refHistoryInstance: ReturnType<typeof useManualRefHistory<UnifiedUndoState>> | null = null
let unifiedState: Ref<UnifiedUndoState> | null = null
let canUndo: ComputedRef<boolean> | null = null
let canRedo: ComputedRef<boolean> | null = null
let undoCount: ComputedRef<number> | null = null
let redoCount: ComputedRef<number> | null = null
let history: ComputedRef<unknown[]> | null = null
let undo: (() => void) | null = null
let redo: (() => void) | null = null
let commit: (() => void) | null = null
let clear: (() => void) | null = null

/**
 * Initialize the single refHistory instance
 */
function initializeRefHistory() {
  if (refHistoryInstance) {
    return
  }

  // CRITICAL FIX: Start with empty state to avoid circular dependency during store setup
  // The state will be populated after stores are fully initialized
  // This is called during useTaskStore() setup, so we can't access taskStore.tasks yet
  unifiedState = ref<UnifiedUndoState>({
    tasks: [],
    groups: []
  })

  // Schedule state population after stores are ready (next tick ensures store setup is complete)
  nextTick(async () => {
    try {
      // Dynamic import to break circular dependency (tasks -> taskHistory -> undoSingleton -> tasks)
      const { useTaskStore } = await import('../stores/tasks')
      const taskStore = useTaskStore()
      const canvasStore = useCanvasStore()

      // Now safely populate the state - stores should be fully initialized
      if (taskStore.tasks && Array.isArray(taskStore.tasks)) {
        unifiedState!.value.tasks = [...taskStore.tasks]
      }
      if (canvasStore.groups && Array.isArray(canvasStore.groups)) {
        unifiedState!.value.groups = [...canvasStore.groups]
      }
    } catch (error) {
      console.warn('⚠️ [UNDO] Could not populate initial state (stores may not be ready):', error)
    }
  })

  // Create the SINGLE useManualRefHistory instance with proper VueUse configuration
  // NOTE: deep: true was intentionally removed for performance reasons (deep watchers issue)
  refHistoryInstance = useManualRefHistory(unifiedState, {
    capacity: 50,
    clone: true
  })

  // Extract all the reactive properties
  canUndo = computed(() => refHistoryInstance?.canUndo.value ?? false)
  canRedo = computed(() => refHistoryInstance?.canRedo.value ?? false)
  // useManualRefHistory provides history tracking
  undoCount = computed(() => {
    if (!refHistoryInstance) return 0
    return refHistoryInstance.undoStack.value.length
  })
  redoCount = computed(() => {
    if (!refHistoryInstance) return 0
    return refHistoryInstance.redoStack.value.length
  })
  history = computed(() => refHistoryInstance?.history.value ?? [])

  // Bind the methods
  undo = refHistoryInstance.undo.bind(refHistoryInstance)
  redo = refHistoryInstance.redo.bind(refHistoryInstance)
  commit = refHistoryInstance.commit.bind(refHistoryInstance)
  clear = refHistoryInstance.clear.bind(refHistoryInstance)

  // Also store on window for direct access
  if (typeof window !== 'undefined') {
    (window as Window & typeof globalThis).__pomoFlowUndoSystem = {
      canUndo,
      canRedo,
      undoCount,
      redoCount,
      history,
      undo,
      redo,
      commit,
      clear,
      collectFilter: {
        matchDueDate: null, // Was false, fixed to match CollectFilterSettings
        matchPriority: undefined,
        matchStatus: undefined,
        matchDuration: 'quick'
      }
    }
  }
}

// ✅ FIXED - Functions defined at module level (outside return object)
// FIX: Made async to properly await restoreState which is an async function
// UPDATED: Now restores both tasks AND groups (ISSUE-008 fix)
const performUndo = async () => {
  if (!refHistoryInstance || !unifiedState) return false
  refHistoryInstance.undo()

  // After undo, unifiedState.value now contains the previous state
  // Restore both tasks and groups
  const previousState = unifiedState.value
  if (previousState && typeof previousState === 'object' && 'tasks' in previousState) {
    // Dynamic import
    const { useTaskStore } = await import('../stores/tasks')
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const { useCanvasUiStore } = await import('../stores/canvas/canvasUi')
    const canvasUiStore = useCanvasUiStore()

    // BUG-008 FIX: Restore groups FIRST (synchronous, no DB dependency)
    // This ensures groups are restored immediately even if task DB save hangs
    canvasStore.setGroups([...previousState.groups])

    // Request canvas sync IMMEDIATELY after group restore
    try {
      canvasUiStore.requestSync('user:undo')
    } catch (error) {
      console.warn('⚠️ [UNDO] Could not request canvas sync:', error)
    }

    // Restore tasks (async - may take time for DB operations)
    // Don't await - let it run in background to avoid blocking UI
    taskStore.restoreState(previousState.tasks).then(() => {
    }).catch((err: any) => {
      console.error('❌ [UNDO] Task store restore failed:', err)
    })

    return true
  }
  return false
}

// FIX: Made async to properly await restoreState which is an async function
// UPDATED: Now restores both tasks AND groups (ISSUE-008 fix)
const performRedo = async () => {
  if (!refHistoryInstance || !unifiedState) return false
  refHistoryInstance.redo()

  // After redo, unifiedState.value now contains the next state
  // Restore both tasks and groups
  const nextState = unifiedState.value
  if (nextState && typeof nextState === 'object' && 'tasks' in nextState) {
    // Dynamic import
    const { useTaskStore } = await import('../stores/tasks')
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const { useCanvasUiStore } = await import('../stores/canvas/canvasUi')
    const canvasUiStore = useCanvasUiStore()

    // BUG-008 FIX: Restore groups FIRST (synchronous, no DB dependency)
    canvasStore.setGroups([...nextState.groups])

    // Request canvas sync IMMEDIATELY after group restore
    try {
      canvasUiStore.requestSync('user:redo')
    } catch (error) {
      console.warn('⚠️ [REDO] Could not request canvas sync:', error)
    }

    // Restore tasks (async - may take time for DB operations)
    // Don't await - let it run in background to avoid blocking UI
    taskStore.restoreState(nextState.tasks).then(() => {
    }).catch((err: any) => {
      console.error('❌ [REDO] Task store restore failed:', err)
    })

    return true
  }
  return false
}

// UPDATED: Now saves both tasks AND groups (ISSUE-008 fix)
const saveState = async (description?: string) => {
  // BUG-008 DEBUG: Log when refHistoryInstance is null
  if (!refHistoryInstance) {
    console.error('❌ [UNDO-CRITICAL] saveState() called but refHistoryInstance is NULL! Calling initializeRefHistory()...')
    initializeRefHistory()
    if (!refHistoryInstance) {
      console.error('❌ [UNDO-CRITICAL] Still null after init retry!')
      return false
    }
  }
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
    // Dynamic import
    const { useTaskStore } = await import('../stores/tasks')
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    // Save combined state (tasks + groups)
    unifiedState!.value = {
      tasks: [...taskStore.tasks],
      groups: [...canvasStore.groups]
    }

    commit()
    return true
  } catch (error) {
    console.error('❌ Failed to save state:', error)
    return false
  }
}

const deleteTaskWithUndo = async (taskId: string) => {
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  const taskToDelete = taskStore.tasks.find(t => t.id === taskId)
  if (!taskToDelete) {
    console.warn('⚠️ Task not found for deletion:', taskId)
    return
  }

  // FIXED: Use proper VueUse pattern - save state before operation
  await saveState('Before task deletion')

  try {
    // Perform the deletion
    await taskStore.deleteTask(taskId)

    // FIXED: Save state after operation
    await nextTick()
    await saveState('After task deletion')
  } catch (error) {
    console.error('❌ deleteTaskWithUndo failed:', error)
    throw error
  }
}

const updateTaskWithUndo = async (taskId: string, updates: Partial<Task>) => {
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  const taskToUpdate = taskStore.tasks.find(t => t.id === taskId)
  if (!taskToUpdate) {
    console.warn('⚠️ Task not found for update:', taskId)
    return
  }

  // FIXED: Use proper VueUse pattern - save state before operation
  await saveState('Before task update')

  // Perform the update
  taskStore.updateTask(taskId, updates)

  // FIXED: Save state after operation
  await nextTick()
  await saveState('After task update')
}

const createTaskWithUndo = async (taskData: Partial<Task>) => {
  // TASK-061: Demo content guard - defense in depth (also checked in taskStore.createTask)
  if (taskData.title) {
    guardTaskCreation(taskData.title)
  }

  // FIXED: Use proper VueUse pattern - save state before operation
  await saveState('Before task creation')

  // Create the task
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const newTask = await taskStore.createTask(taskData)

  // FIXED: Save state after operation
  await nextTick()
  await saveState('After task creation')
  return newTask
}

// NEW: Create group with undo support (BUG-008 fix)
const createGroupWithUndo = async (groupData: Omit<CanvasGroup, 'id'>) => {
  const canvasStore = useCanvasStore()

  // Save state before operation
  await saveState('Before group creation')

  try {
    // Perform the creation
    const newGroup = await canvasStore.createGroup(groupData)

    // Save state after operation
    await nextTick()
    await saveState('After group creation')
    return newGroup
  } catch (error) {
    console.error('❌ createGroupWithUndo failed:', error)
    throw error
  }
}

// NEW: Update group with undo support (BUG-008 fix)
const updateGroupWithUndo = async (groupId: string, updates: Partial<CanvasGroup>) => {
  const canvasStore = useCanvasStore()

  const groupToUpdate = canvasStore.groups.find(g => g.id === groupId)
  if (!groupToUpdate) {
    console.warn('⚠️ Group not found for update:', groupId)
    return
  }

  // Save state before operation
  await saveState('Before group update')

  try {
    // Perform the update
    await canvasStore.updateGroup(groupId, updates)

    // Save state after operation
    await nextTick()
    await saveState('After group update')
  } catch (error) {
    console.error('❌ updateGroupWithUndo failed:', error)
    throw error
  }
}

// NEW: Delete group with undo support (ISSUE-008 fix)
const deleteGroupWithUndo = async (groupId: string) => {
  const canvasStore = useCanvasStore()

  const groupToDelete = canvasStore.groups.find(g => g.id === groupId)
  if (!groupToDelete) {
    console.warn('⚠️ Group not found for deletion:', groupId)
    return
  }

  // Save state before operation
  await saveState('Before group deletion')

  try {
    // Perform the deletion
    await canvasStore.deleteGroup(groupId)

    // Save state after operation
    await nextTick()
    await saveState('After group deletion')
  } catch (error) {
    console.error('❌ deleteGroupWithUndo failed:', error)
    throw error
  }
}

// BUG-036 FIX: Batch delete support in singleton
const bulkDeleteTasksWithUndo = async (taskIds: string[]) => {
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  await saveState(`Before bulk delete of ${taskIds.length} tasks`)

  try {
    if (taskStore.bulkDeleteTasks) {
      await taskStore.bulkDeleteTasks(taskIds)
    } else {
      console.warn('⚠️ taskStore.bulkDeleteTasks not found, falling back to individual')
      // Fallback for safety (though store should have it now)
      for (const id of taskIds) {
        await taskStore.deleteTask(id)
      }
    }

    await nextTick()
    await saveState('After bulk delete')
  } catch (error) {
    console.error('❌ bulkDeleteTasksWithUndo failed:', error)
    throw error
  }
}

/**
 * Get the global undo system functions that use the shared refHistory instance
 */
export function getUndoSystem() {
  if (!refHistoryInstance) {
    initializeRefHistory()
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
    bulkDeleteTasksWithUndo,
    updateTaskWithUndo,
    createTaskWithUndo,

    // Group operations with undo (ISSUE-008 fix / BUG-008 fix)
    createGroupWithUndo,
    updateGroupWithUndo,
    deleteGroupWithUndo
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
    delete (window as Window & typeof globalThis).__pomoFlowUndoSystem
  }
}