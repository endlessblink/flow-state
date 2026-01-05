// Undo System Singleton - Ensures shared instance across the entire application
// This solves initialization order issues between App.vue and globalKeyboardHandlerSimple.ts
// UPDATED: Now tracks both tasks AND canvas groups for unified undo/redo (ISSUE-008 fix)

import { ref, computed, nextTick } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import { useTaskStore } from '@/stores/tasks'
import type { Task } from '@/stores/tasks'
import { useCanvasStore, type CanvasGroup } from '@/stores/canvas'
import { guardTaskCreation } from '@/utils/demoContentGuard'

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
    console.log('🔄 [UNDO-INIT] Early return - refHistoryInstance already exists')
    return
  }

  console.log('🔄 Creating SINGLE refHistory instance for entire application (tasks + groups)...')

  // CRITICAL FIX: Start with empty state to avoid circular dependency during store setup
  // The state will be populated after stores are fully initialized
  // This is called during useTaskStore() setup, so we can't access taskStore.tasks yet
  unifiedState = ref<UnifiedUndoState>({
    tasks: [],
    groups: []
  })

  // Schedule state population after stores are ready (next tick ensures store setup is complete)
  nextTick(() => {
    try {
      const taskStore = useTaskStore()
      const canvasStore = useCanvasStore()

      // Now safely populate the state - stores should be fully initialized
      if (taskStore.tasks && Array.isArray(taskStore.tasks)) {
        unifiedState!.value.tasks = [...taskStore.tasks]
        console.log('✅ [UNDO] Populated tasks state:', taskStore.tasks.length, 'tasks')
      }
      if (canvasStore.groups && Array.isArray(canvasStore.groups)) {
        unifiedState!.value.groups = [...canvasStore.groups]
        console.log('✅ [UNDO] Populated groups state:', canvasStore.groups.length, 'groups')
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
      clear
    }
  }

  console.log('✅ SINGLE refHistory instance created and shared across app')
}

// ✅ FIXED - Functions defined at module level (outside return object)
// FIX: Made async to properly await restoreState which is an async function
// UPDATED: Now restores both tasks AND groups (ISSUE-008 fix)
const performUndo = async () => {
  if (!refHistoryInstance || !unifiedState) return false
  console.log('🔄 Executing undo with SHARED refHistory instance (tasks + groups)...')
  refHistoryInstance.undo()

  // After undo, unifiedState.value now contains the previous state
  // Restore both tasks and groups
  const previousState = unifiedState.value
  if (previousState && typeof previousState === 'object' && 'tasks' in previousState) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    console.log('🔄 [UNDO] Restoring:', previousState.tasks.length, 'tasks,', previousState.groups.length, 'groups')

    // DEBUG: Log canvas tasks being restored
    const canvasTasks = previousState.tasks.filter(t => t.isInInbox === false && t.canvasPosition)
    console.log(`🔄 [UNDO-DEBUG] Restoring ${canvasTasks.length} canvas tasks`)

    // BUG-008 FIX: Restore groups FIRST (synchronous, no DB dependency)
    // This ensures groups are restored immediately even if task DB save hangs
    canvasStore.restoreGroups(previousState.groups)
    console.log('🔄 [UNDO] Canvas store now has:', canvasStore.groups.length, 'groups')

    // Request canvas sync IMMEDIATELY after group restore
    try {
      canvasStore.requestSync()
      console.log('🔄 [UNDO] Requested canvas sync after group restore')
    } catch (error) {
      console.warn('⚠️ [UNDO] Could not request canvas sync:', error)
    }

    // Restore tasks (async - may take time for DB operations)
    // Don't await - let it run in background to avoid blocking UI
    taskStore.restoreState(previousState.tasks).then(() => {
      console.log('🔄 [UNDO] Task store restore completed. Tasks:', taskStore.tasks.length)
    }).catch((err) => {
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
  console.log('🔄 Executing redo with SHARED refHistory instance (tasks + groups)...')
  refHistoryInstance.redo()

  // After redo, unifiedState.value now contains the next state
  // Restore both tasks and groups
  const nextState = unifiedState.value
  if (nextState && typeof nextState === 'object' && 'tasks' in nextState) {
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    console.log('🔄 [REDO] Restoring:', nextState.tasks.length, 'tasks,', nextState.groups.length, 'groups')

    // BUG-008 FIX: Restore groups FIRST (synchronous, no DB dependency)
    canvasStore.restoreGroups(nextState.groups)
    console.log('🔄 [REDO] Canvas store now has:', canvasStore.groups.length, 'groups')

    // Request canvas sync IMMEDIATELY after group restore
    try {
      canvasStore.requestSync()
      console.log('🔄 [REDO] Requested canvas sync after group restore')
    } catch (error) {
      console.warn('⚠️ [REDO] Could not request canvas sync:', error)
    }

    // Restore tasks (async - may take time for DB operations)
    // Don't await - let it run in background to avoid blocking UI
    taskStore.restoreState(nextState.tasks).then(() => {
      console.log('🔄 [REDO] Task store restore completed. Tasks:', taskStore.tasks.length)
    }).catch((err) => {
      console.error('❌ [REDO] Task store restore failed:', err)
    })

    return true
  }
  return false
}

// UPDATED: Now saves both tasks AND groups (ISSUE-008 fix)
const saveState = (description?: string) => {
  // BUG-008 DEBUG: Log when refHistoryInstance is null
  if (!refHistoryInstance) {
    console.error('❌ [UNDO-CRITICAL] saveState() called but refHistoryInstance is NULL! Calling initializeRefHistory()...')
    initializeRefHistory()
    if (!refHistoryInstance) {
      console.error('❌ [UNDO-CRITICAL] Still null after init retry!')
      return false
    }
    console.log('✅ [UNDO-CRITICAL] refHistoryInstance recovered after init')
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
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    // Save combined state (tasks + groups)
    unifiedState!.value = {
      tasks: [...taskStore.tasks],
      groups: [...canvasStore.groups]
    }

    // DEBUG: Log what's being saved
    const canvasTasks = taskStore.tasks.filter(t => t.isInInbox === false && t.canvasPosition)
    console.log(`💾 [UNDO-DEBUG] Saving state: ${canvasTasks.length} canvas tasks, ${canvasStore.groups.length} groups`)

    commit()
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

const updateTaskWithUndo = async (taskId: string, updates: Partial<Task>) => {
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

const createTaskWithUndo = async (taskData: Partial<Task>) => {
  console.log('➕ createTaskWithUndo called with:', taskData)

  // TASK-061: Demo content guard - defense in depth (also checked in taskStore.createTask)
  if (taskData.title) {
    guardTaskCreation(taskData.title)
  }

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

// NEW: Create group with undo support (BUG-008 fix)
const createGroupWithUndo = async (groupData: Omit<CanvasGroup, 'id'>) => {
  console.log('➕ createGroupWithUndo called with:', groupData.name)
  const canvasStore = useCanvasStore()

  // Save state before operation
  saveState('Before group creation')

  try {
    // Perform the creation
    const newGroup = canvasStore.createGroup(groupData)
    console.log(`✅ Group created: ${newGroup.name}`)

    // Save state after operation
    await nextTick()
    saveState('After group creation')
    return newGroup
  } catch (error) {
    console.error('❌ createGroupWithUndo failed:', error)
    throw error
  }
}

// NEW: Update group with undo support (BUG-008 fix)
const updateGroupWithUndo = async (groupId: string, updates: Partial<CanvasGroup>) => {
  console.log('✏️ updateGroupWithUndo called for:', groupId, updates)
  const canvasStore = useCanvasStore()

  const groupToUpdate = canvasStore.groups.find(g => g.id === groupId)
  if (!groupToUpdate) {
    console.warn('⚠️ Group not found for update:', groupId)
    return
  }

  console.log(`✏️ Updating group: ${groupToUpdate.name}`)

  // Save state before operation
  saveState('Before group update')

  try {
    // Perform the update
    canvasStore.updateGroup(groupId, updates)
    console.log(`✅ Group updated: ${groupId}`)

    // Save state after operation
    await nextTick()
    saveState('After group update')
  } catch (error) {
    console.error('❌ updateGroupWithUndo failed:', error)
    throw error
  }
}

// NEW: Delete group with undo support (ISSUE-008 fix)
const deleteGroupWithUndo = async (groupId: string) => {
  console.log('🗑️ deleteGroupWithUndo called for:', groupId)
  const canvasStore = useCanvasStore()

  const groupToDelete = canvasStore.groups.find(g => g.id === groupId)
  if (!groupToDelete) {
    console.warn('⚠️ Group not found for deletion:', groupId)
    return
  }

  console.log(`🗑️ Deleting group: ${groupToDelete.name}`)

  // Save state before operation
  saveState('Before group deletion')

  try {
    // Perform the deletion
    canvasStore.deleteGroup(groupId)
    console.log(`✅ Group deleted. Current groups count: ${canvasStore.groups.length}`)

    // Save state after operation
    await nextTick()
    saveState('After group deletion')
  } catch (error) {
    console.error('❌ deleteGroupWithUndo failed:', error)
    throw error
  }
}

// BUG-036 FIX: Batch delete support in singleton
const bulkDeleteTasksWithUndo = async (taskIds: string[]) => {
  console.log(`🗑️ bulkDeleteTasksWithUndo called for ${taskIds.length} tasks`)
  const taskStore = useTaskStore()

  saveState(`Before bulk delete of ${taskIds.length} tasks`)

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
    console.log(`✅ Bulk delete completed. Current tasks: ${taskStore.tasks.length}`)

    await nextTick()
    saveState('After bulk delete')
  } catch (error) {
    console.error('❌ bulkDeleteTasksWithUndo failed:', error)
    throw error
  }
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
  console.log('🔄 UndoSingleton: Reset global refHistory instance')
}