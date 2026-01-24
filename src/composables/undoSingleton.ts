// Undo System Singleton - Ensures shared instance across the entire application
// This solves initialization order issues between App.vue and globalKeyboardHandlerSimple.ts
// UPDATED: Now tracks both tasks AND canvas groups for unified undo/redo (ISSUE-008 fix)

import { ref, computed, nextTick } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import type { Task } from '../stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import type { CanvasGroup } from '@/types/canvas'
import { guardTaskCreation } from '../utils/demoContentGuard'
import { useToast } from './useToast'

interface UndoSystemState {
  canUndo: ComputedRef<boolean> | null
  canRedo: ComputedRef<boolean> | null
  undoCount: ComputedRef<number> | null
  redoCount: ComputedRef<number> | null
  history: ComputedRef<any[]> | null
  undo: (() => void) | null
  redo: (() => void) | null
  commit: (() => void) | null
  clear: (() => void) | null
  collectFilter: Record<string, unknown>
}

declare global {
  interface Window {
    __pomoFlowUndoSystem?: UndoSystemState
  }
}

// Combined state interface for tracking both tasks and groups
interface UnifiedUndoState {
  tasks: Task[]
  groups: CanvasGroup[]
}

// =============================================================================
// BUG-309-B: Operation-Scoped Undo System
// =============================================================================
// Instead of restoring full snapshots, we track which entities were affected
// by each operation and only restore those. This prevents position drift where
// undoing task B's creation would incorrectly revert task A's position.

/**
 * Describes what type of operation was performed for selective restoration
 */
export type UndoOperationType =
  | 'task-create'
  | 'task-delete'
  | 'task-update'
  | 'task-move'
  | 'task-bulk-delete'
  | 'group-create'
  | 'group-delete'
  | 'group-update'
  | 'group-resize'
  | 'legacy' // For backward compatibility with entries that don't have metadata

/**
 * Operation metadata stored alongside each undo snapshot
 */
export interface UndoOperation {
  type: UndoOperationType
  affectedIds: string[]  // Which tasks/groups were actually modified
  description: string    // Human-readable description for debugging
  timestamp: number      // When the operation occurred
}

/**
 * Extended snapshot that includes operation metadata
 */
interface OperationSnapshot {
  operation: UndoOperation
  snapshotBefore: UnifiedUndoState  // State before the operation (for undo)
  snapshotAfter: UnifiedUndoState   // State after the operation (for redo)
}

// Separate operation history that parallels VueUse's refHistory
// This allows us to associate metadata with each history entry
let operationStack: OperationSnapshot[] = []
let redoOperationStack: OperationSnapshot[] = []

// Flag to track if we're in operation-aware mode
let useOperationAwareUndo = true

// Global singleton refHistory instance - created only ONCE
let refHistoryInstance: ReturnType<typeof useManualRefHistory<UnifiedUndoState>> | null = null
let unifiedState: Ref<UnifiedUndoState> | null = null
let canUndo: ComputedRef<boolean> | null = null
let canRedo: ComputedRef<boolean> | null = null
let undoCount: ComputedRef<number> | null = null
let redoCount: ComputedRef<number> | null = null
let history: ComputedRef<import('@vueuse/core').UseRefHistoryRecord<UnifiedUndoState>[]> | null = null
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
      if (unifiedState && taskStore.tasks && Array.isArray(taskStore.tasks)) {
        unifiedState.value.tasks = [...taskStore.tasks]
      }
      if (unifiedState && canvasStore.groups && Array.isArray(canvasStore.groups)) {
        unifiedState.value.groups = [...canvasStore.groups]
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

// =============================================================================
// BUG-309-B: SELECTIVE RESTORATION (Operation-Aware Undo/Redo)
// =============================================================================
// Instead of restoring the entire state, we only restore the entities that
// were affected by the operation. This prevents position drift.

/**
 * Perform selective undo based on operation type
 * Only restores entities that were actually affected by the operation
 */
const performSelectiveUndo = async (operationSnapshot: OperationSnapshot): Promise<boolean> => {
  const { operation, snapshotBefore } = operationSnapshot
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()
  const { useCanvasUiStore } = await import('../stores/canvas/canvasUi')
  const canvasUiStore = useCanvasUiStore()

  console.log(`🔄 [UNDO] Selective undo for: ${operation.type} (${operation.description})`)

  switch (operation.type) {
    case 'task-create': {
      // Undo creation = delete the created task
      const taskId = operation.affectedIds[0]
      if (taskId) {
        console.log(`🔄 [UNDO] Removing created task: ${taskId}`)
        await taskStore.deleteTask(taskId)
      }
      break
    }

    case 'task-delete': {
      // Undo deletion = restore the deleted task from snapshot
      const taskId = operation.affectedIds[0]
      console.log('🔴 [UNDO] task-delete undo, looking for task:', taskId)
      console.log('🔴 [UNDO] snapshotBefore has', snapshotBefore.tasks.length, 'tasks')
      const deletedTask = snapshotBefore.tasks.find(t => t.id === taskId)
      if (deletedTask) {
        console.log(`🔄 [UNDO] Restoring deleted task: ${deletedTask.title}`)
        await taskStore.createTask(deletedTask)
        console.log('🔴 [UNDO] createTask completed')
      } else {
        console.error('❌ [UNDO] Could not find task in snapshot:', taskId)
      }
      break
    }

    case 'task-bulk-delete': {
      // Undo bulk deletion = restore all deleted tasks
      for (const taskId of operation.affectedIds) {
        const deletedTask = snapshotBefore.tasks.find(t => t.id === taskId)
        if (deletedTask) {
          console.log(`🔄 [UNDO] Restoring deleted task: ${deletedTask.title}`)
          await taskStore.createTask(deletedTask)
        }
      }
      break
    }

    case 'task-update':
    case 'task-move': {
      // Undo update/move = restore previous state of affected tasks only
      for (const taskId of operation.affectedIds) {
        const previousTask = snapshotBefore.tasks.find(t => t.id === taskId)
        if (previousTask) {
          console.log(`🔄 [UNDO] Restoring task state: ${previousTask.title}`)
          // Use updateTask to restore all properties including position
          // Use 'USER' as the source since this is a user-initiated undo
          await taskStore.updateTask(taskId, { // BUG-1051: AWAIT to ensure persistence
            ...previousTask,
            // Ensure position fields are included
            canvasPosition: previousTask.canvasPosition,
            parentId: previousTask.parentId,
            positionFormat: previousTask.positionFormat
          }, 'USER')
        }
      }
      break
    }

    case 'group-create': {
      // Undo group creation = delete the created group
      const groupId = operation.affectedIds[0]
      if (groupId) {
        console.log(`🔄 [UNDO] Removing created group: ${groupId}`)
        await canvasStore.deleteGroup(groupId)
      }
      break
    }

    case 'group-delete': {
      // Undo group deletion = restore the deleted group from snapshot
      const groupId = operation.affectedIds[0]
      const deletedGroup = snapshotBefore.groups.find(g => g.id === groupId)
      if (deletedGroup) {
        console.log(`🔄 [UNDO] Restoring deleted group: ${deletedGroup.name}`)
        await canvasStore.createGroup(deletedGroup)
      }
      break
    }

    case 'group-update':
    case 'group-resize': {
      // Undo group update/resize = restore previous state of affected groups only
      for (const groupId of operation.affectedIds) {
        const previousGroup = snapshotBefore.groups.find(g => g.id === groupId)
        if (previousGroup) {
          console.log(`🔄 [UNDO] Restoring group state: ${previousGroup.name}`)
          await canvasStore.updateGroup(groupId, {
            ...previousGroup,
            position: previousGroup.position,
            parentGroupId: previousGroup.parentGroupId
          })
        }
      }
      break
    }

    case 'legacy':
    default: {
      // Fall back to full-state restoration for legacy entries
      console.log(`🔄 [UNDO] Legacy mode - restoring full state`)
      canvasStore.setGroups([...snapshotBefore.groups])
      await taskStore.restoreState(snapshotBefore.tasks)
      break
    }
  }

  // Request canvas sync after restoration
  try {
    canvasUiStore.requestSync('user:undo')
  } catch (error) {
    console.warn('⚠️ [UNDO] Could not request canvas sync:', error)
  }

  return true
}

/**
 * Perform selective redo based on operation type
 */
const performSelectiveRedo = async (operationSnapshot: OperationSnapshot): Promise<boolean> => {
  const { operation, snapshotAfter } = operationSnapshot
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()
  const { useCanvasUiStore } = await import('../stores/canvas/canvasUi')
  const canvasUiStore = useCanvasUiStore()

  console.log(`🔁 [REDO] Selective redo for: ${operation.type} (${operation.description})`)

  switch (operation.type) {
    case 'task-create': {
      // Redo creation = recreate the task
      const taskId = operation.affectedIds[0]
      const createdTask = snapshotAfter.tasks.find(t => t.id === taskId)
      if (createdTask) {
        console.log(`🔁 [REDO] Re-creating task: ${createdTask.title}`)
        await taskStore.createTask(createdTask)
      }
      break
    }

    case 'task-delete': {
      // Redo deletion = delete the task again
      const taskId = operation.affectedIds[0]
      console.log(`🔁 [REDO] Re-deleting task: ${taskId}`)
      await taskStore.deleteTask(taskId)
      break
    }

    case 'task-bulk-delete': {
      // Redo bulk deletion = delete all tasks again
      for (const taskId of operation.affectedIds) {
        console.log(`🔁 [REDO] Re-deleting task: ${taskId}`)
        await taskStore.deleteTask(taskId)
      }
      break
    }

    case 'task-update':
    case 'task-move': {
      // Redo update/move = apply the after state to affected tasks
      for (const taskId of operation.affectedIds) {
        const afterTask = snapshotAfter.tasks.find(t => t.id === taskId)
        if (afterTask) {
          console.log(`🔁 [REDO] Re-applying task state: ${afterTask.title}`)
          // Use 'USER' as the source since this is a user-initiated redo
          await taskStore.updateTask(taskId, { // BUG-1051: AWAIT to ensure persistence
            ...afterTask,
            canvasPosition: afterTask.canvasPosition,
            parentId: afterTask.parentId,
            positionFormat: afterTask.positionFormat
          }, 'USER')
        }
      }
      break
    }

    case 'group-create': {
      // Redo group creation = recreate the group
      const groupId = operation.affectedIds[0]
      const createdGroup = snapshotAfter.groups.find(g => g.id === groupId)
      if (createdGroup) {
        console.log(`🔁 [REDO] Re-creating group: ${createdGroup.name}`)
        await canvasStore.createGroup(createdGroup)
      }
      break
    }

    case 'group-delete': {
      // Redo group deletion = delete the group again
      const groupId = operation.affectedIds[0]
      console.log(`🔁 [REDO] Re-deleting group: ${groupId}`)
      await canvasStore.deleteGroup(groupId)
      break
    }

    case 'group-update':
    case 'group-resize': {
      // Redo group update/resize = apply the after state
      for (const groupId of operation.affectedIds) {
        const afterGroup = snapshotAfter.groups.find(g => g.id === groupId)
        if (afterGroup) {
          console.log(`🔁 [REDO] Re-applying group state: ${afterGroup.name}`)
          await canvasStore.updateGroup(groupId, {
            ...afterGroup,
            position: afterGroup.position,
            parentGroupId: afterGroup.parentGroupId
          })
        }
      }
      break
    }

    case 'legacy':
    default: {
      // Fall back to full-state restoration for legacy entries
      console.log(`🔁 [REDO] Legacy mode - restoring full state`)
      canvasStore.setGroups([...snapshotAfter.groups])
      await taskStore.restoreState(snapshotAfter.tasks)
      break
    }
  }

  // Request canvas sync after restoration
  try {
    canvasUiStore.requestSync('user:redo')
  } catch (error) {
    console.warn('⚠️ [REDO] Could not request canvas sync:', error)
  }

  return true
}

// =============================================================================
// TASK-140: Undo/Redo Visual Feedback
// =============================================================================
/**
 * Show toast notification for undo/redo operations
 * Respects user's showUndoRedoToasts setting
 */
const showUndoRedoToast = async (action: 'undo' | 'redo', description: string) => {
  try {
    // Dynamic import to avoid circular dependencies
    const { useSettingsStore } = await import('../stores/settings')
    const settingsStore = useSettingsStore()

    // Check if user wants toast notifications
    if (!settingsStore.showUndoRedoToasts) {
      return
    }

    const { showToast } = useToast()
    const prefix = action === 'undo' ? 'Undone' : 'Redone'

    // Clean up the description (remove "Delete task: " prefix style for cleaner display)
    const cleanDescription = description
      .replace(/^(Delete|Create|Update|Move|Resize|Bulk delete \d+) (task|group): /i, '')
      .trim()

    showToast(`${prefix}: ${cleanDescription}`, 'info', { duration: 2500 })
  } catch (error) {
    console.warn('⚠️ [UNDO] Could not show toast:', error)
  }
}

// ✅ FIXED - Functions defined at module level (outside return object)
// FIX: Made async to properly await restoreState which is an async function
// UPDATED: Now restores both tasks AND groups (ISSUE-008 fix)
// BUG-309-B: Enhanced with operation-aware selective restoration
const performUndo = async () => {
  console.log('🔴 [UNDO] performUndo called, operationStack length:', operationStack.length)

  // BUG-309-B: Try operation-aware undo first
  if (useOperationAwareUndo && operationStack.length > 0) {
    console.log('🔴 [UNDO] Using operation-aware undo')
    const operationSnapshot = operationStack.pop()!
    redoOperationStack.push(operationSnapshot)

    // BUG-336 FIX: Don't call refHistoryInstance.undo() here
    // The operation stack is the source of truth in operation-aware mode.
    // Calling VueUse undo creates a "ghost" undo that requires double Ctrl+Z.

    const result = await performSelectiveUndo(operationSnapshot)

    // TASK-140: Show toast notification for undo
    if (result) {
      showUndoRedoToast('undo', operationSnapshot.operation.description)
    }

    return result
  }

  // Fall back to legacy full-state undo
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
    }).catch((err: Error) => {
      console.error('❌ [UNDO] Task store restore failed:', err)
    })

    // TASK-140: Show toast notification for legacy undo
    showUndoRedoToast('undo', 'previous state')

    return true
  }
  return false
}

// FIX: Made async to properly await restoreState which is an async function
// UPDATED: Now restores both tasks AND groups (ISSUE-008 fix)
// BUG-309-B: Enhanced with operation-aware selective restoration
const performRedo = async () => {
  // BUG-309-B: Try operation-aware redo first
  if (useOperationAwareUndo && redoOperationStack.length > 0) {
    const operationSnapshot = redoOperationStack.pop()!
    operationStack.push(operationSnapshot)

    // BUG-336 FIX: Don't call refHistoryInstance.redo() here
    // Operation stack is source of truth in operation-aware mode.

    const result = await performSelectiveRedo(operationSnapshot)

    // TASK-140: Show toast notification for redo
    if (result) {
      showUndoRedoToast('redo', operationSnapshot.operation.description)
    }

    return result
  }

  // Fall back to legacy full-state redo
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
    }).catch((err: Error) => {
      console.error('❌ [REDO] Task store restore failed:', err)
    })

    // TASK-140: Show toast notification for legacy redo
    showUndoRedoToast('redo', 'next state')

    return true
  }
  return false
}

// =============================================================================
// OPERATION-AWARE STATE MANAGEMENT (BUG-309-B)
// =============================================================================

/**
 * Capture current state as a snapshot (deep clone)
 */
const captureCurrentState = async (): Promise<UnifiedUndoState> => {
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()

  return {
    tasks: JSON.parse(JSON.stringify(taskStore.tasks)),
    groups: JSON.parse(JSON.stringify(canvasStore.groups))
  }
}

/**
 * Track the state BEFORE an operation starts
 * Call this BEFORE performing the operation
 */
let pendingOperationBefore: UnifiedUndoState | null = null
let pendingOperation: UndoOperation | null = null

const beginOperation = async (operation: Omit<UndoOperation, 'timestamp'>) => {
  pendingOperationBefore = await captureCurrentState()
  pendingOperation = {
    ...operation,
    timestamp: Date.now()
  }
}

/**
 * Complete the operation and save the undo entry
 * Call this AFTER performing the operation
 */
const commitOperation = async () => {
  if (!pendingOperationBefore || !pendingOperation) {
    console.warn('⚠️ [UNDO] commitOperation called without beginOperation')
    return false
  }

  const snapshotAfter = await captureCurrentState()

  // Push to operation stack (limit capacity to 50)
  operationStack.push({
    operation: pendingOperation,
    snapshotBefore: pendingOperationBefore,
    snapshotAfter
  })
  if (operationStack.length > 50) {
    operationStack.shift()
  }

  // Clear redo stack on new operation
  redoOperationStack = []

  // Also update VueUse's refHistory for backward compatibility
  if (unifiedState && commit) {
    unifiedState.value = snapshotAfter
    commit()
  }

  // Capture description before clearing
  const operationDescription = pendingOperation.description

  // Clear pending state
  pendingOperationBefore = null
  pendingOperation = null

  console.log(`✅ [UNDO] Committed operation: ${operationDescription}`)
  return true
}

// UPDATED: Now saves both tasks AND groups (ISSUE-008 fix)
// BUG-309-B: Enhanced to support operation metadata for selective restoration
const saveState = async (_description?: string, operation?: Omit<UndoOperation, 'timestamp'>) => {
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
    if (unifiedState) {
      unifiedState.value = {
        tasks: [...taskStore.tasks],
        groups: [...canvasStore.groups]
      }
    }

    commit()
    return true
  } catch (error) {
    console.error('❌ Failed to save state:', error)
    return false
  }
}

// BUG-309-B: Operation-aware task operations
const deleteTaskWithUndo = async (taskId: string) => {
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  const taskToDelete = taskStore.tasks.find(t => t.id === taskId)
  if (!taskToDelete) {
    console.warn('⚠️ Task not found for deletion:', taskId)
    return
  }

  // BUG-309-B: Begin operation-aware tracking
  await beginOperation({
    type: 'task-delete',
    affectedIds: [taskId],
    description: `Delete task: ${taskToDelete.title}`
  })

  try {
    // Perform the deletion
    await taskStore.deleteTask(taskId)

    // BUG-309-B: Commit the operation
    await nextTick()
    await commitOperation()
  } catch (error) {
    console.error('❌ deleteTaskWithUndo failed:', error)
    // Clear pending operation on error
    pendingOperationBefore = null
    pendingOperation = null
    throw error
  }
}

/**
 * Permanently delete a task with undo support (Shift+Delete from canvas)
 * Uses the same undo mechanism as soft delete - undo will recreate the task from snapshot
 */
const permanentlyDeleteTaskWithUndo = async (taskId: string) => {
  console.log('🔴 [UNDO] permanentlyDeleteTaskWithUndo called:', taskId)

  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  const taskToDelete = taskStore.tasks.find(t => t.id === taskId)
  if (!taskToDelete) {
    console.warn('⚠️ Task not found for permanent deletion:', taskId)
    return
  }

  console.log('🔴 [UNDO] Task found, capturing snapshot before deletion:', taskToDelete.title)

  // BUG-309-B: Begin operation-aware tracking
  await beginOperation({
    type: 'task-delete',
    affectedIds: [taskId],
    description: `Permanently delete task: ${taskToDelete.title}`
  })

  console.log('🔴 [UNDO] beginOperation completed, pendingOperationBefore has', pendingOperationBefore?.tasks.length, 'tasks')

  try {
    // Perform permanent deletion (hard delete from database)
    await taskStore.permanentlyDeleteTask(taskId)
    console.log('🔴 [UNDO] permanentlyDeleteTask completed')

    // BUG-309-B: Commit the operation
    await nextTick()
    await commitOperation()
    console.log('🔴 [UNDO] commitOperation completed, operationStack length:', operationStack.length)
  } catch (error) {
    console.error('❌ permanentlyDeleteTaskWithUndo failed:', error)
    // Clear pending operation on error
    pendingOperationBefore = null
    pendingOperation = null
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

  // BUG-309-B: Determine operation type based on what's being updated
  const isPositionUpdate = 'canvasPosition' in updates || 'parentId' in updates
  const operationType: UndoOperationType = isPositionUpdate ? 'task-move' : 'task-update'

  await beginOperation({
    type: operationType,
    affectedIds: [taskId],
    description: `${operationType === 'task-move' ? 'Move' : 'Update'} task: ${taskToUpdate.title}`
  })

  // Perform the update
  await taskStore.updateTask(taskId, updates) // BUG-1051: AWAIT to ensure persistence

  // BUG-309-B: Commit the operation
  await nextTick()
  await commitOperation()
}

const createTaskWithUndo = async (taskData: Partial<Task>) => {
  // TASK-061: Demo content guard - defense in depth (also checked in taskStore.createTask)
  if (taskData.title) {
    guardTaskCreation(taskData.title)
  }

  // BUG-309-B: Begin operation-aware tracking (we don't know ID yet, will update)
  await beginOperation({
    type: 'task-create',
    affectedIds: [], // Will be updated after creation
    description: `Create task: ${taskData.title || 'Untitled'}`
  })

  // Create the task
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const newTask = await taskStore.createTask(taskData)

  // BUG-309-B: Update affectedIds with the actual new task ID
  if (pendingOperation && newTask) {
    pendingOperation.affectedIds = [newTask.id]
  }

  // BUG-309-B: Commit the operation
  await nextTick()
  await commitOperation()
  return newTask
}

// BUG-309-B: Operation-aware group operations
const createGroupWithUndo = async (groupData: Omit<CanvasGroup, 'id'>) => {
  const canvasStore = useCanvasStore()

  // BUG-309-B: Begin operation-aware tracking
  await beginOperation({
    type: 'group-create',
    affectedIds: [], // Will be updated after creation
    description: `Create group: ${groupData.name || 'Untitled'}`
  })

  try {
    // Perform the creation
    const newGroup = await canvasStore.createGroup(groupData)

    // BUG-309-B: Update affectedIds with the actual new group ID
    if (pendingOperation && newGroup) {
      pendingOperation.affectedIds = [newGroup.id]
    }

    // BUG-309-B: Commit the operation
    await nextTick()
    await commitOperation()
    return newGroup
  } catch (error) {
    console.error('❌ createGroupWithUndo failed:', error)
    pendingOperationBefore = null
    pendingOperation = null
    throw error
  }
}

const updateGroupWithUndo = async (groupId: string, updates: Partial<CanvasGroup>) => {
  const canvasStore = useCanvasStore()

  const groupToUpdate = canvasStore.groups.find(g => g.id === groupId)
  if (!groupToUpdate) {
    console.warn('⚠️ Group not found for update:', groupId)
    return
  }

  // BUG-309-B: Determine operation type based on what's being updated
  const isResizeUpdate = updates.position && ('width' in updates.position || 'height' in updates.position)
  const operationType: UndoOperationType = isResizeUpdate ? 'group-resize' : 'group-update'

  await beginOperation({
    type: operationType,
    affectedIds: [groupId],
    description: `${operationType === 'group-resize' ? 'Resize' : 'Update'} group: ${groupToUpdate.name}`
  })

  try {
    // Perform the update
    await canvasStore.updateGroup(groupId, updates)

    // BUG-309-B: Commit the operation
    await nextTick()
    await commitOperation()
  } catch (error) {
    console.error('❌ updateGroupWithUndo failed:', error)
    pendingOperationBefore = null
    pendingOperation = null
    throw error
  }
}

const deleteGroupWithUndo = async (groupId: string) => {
  const canvasStore = useCanvasStore()

  const groupToDelete = canvasStore.groups.find(g => g.id === groupId)
  if (!groupToDelete) {
    console.warn('⚠️ Group not found for deletion:', groupId)
    return
  }

  // BUG-309-B: Begin operation-aware tracking
  await beginOperation({
    type: 'group-delete',
    affectedIds: [groupId],
    description: `Delete group: ${groupToDelete.name}`
  })

  try {
    // Perform the deletion
    await canvasStore.deleteGroup(groupId)

    // BUG-309-B: Commit the operation
    await nextTick()
    await commitOperation()
  } catch (error) {
    console.error('❌ deleteGroupWithUndo failed:', error)
    pendingOperationBefore = null
    pendingOperation = null
    throw error
  }
}

// BUG-309-B: Operation-aware bulk delete
const bulkDeleteTasksWithUndo = async (taskIds: string[]) => {
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  // BUG-309-B: Begin operation-aware tracking
  await beginOperation({
    type: 'task-bulk-delete',
    affectedIds: [...taskIds],
    description: `Bulk delete ${taskIds.length} tasks`
  })

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

    // BUG-309-B: Commit the operation
    await nextTick()
    await commitOperation()
  } catch (error) {
    console.error('❌ bulkDeleteTasksWithUndo failed:', error)
    pendingOperationBefore = null
    pendingOperation = null
    throw error
  }
}

/**
 * Get the global undo system functions that use the shared refHistory instance
 * BUG-309-B: Enhanced with operation-aware undo/redo support
 */
export function getUndoSystem() {
  if (!refHistoryInstance) {
    initializeRefHistory()
  }

  // BUG-309-B: Override canUndo/canRedo to consider operation stack
  const operationAwareCanUndo = computed(() => {
    if (useOperationAwareUndo && operationStack.length > 0) {
      return true
    }
    return canUndo?.value ?? false
  })

  const operationAwareCanRedo = computed(() => {
    if (useOperationAwareUndo && redoOperationStack.length > 0) {
      return true
    }
    return canRedo?.value ?? false
  })

  const operationAwareUndoCount = computed(() => {
    if (useOperationAwareUndo) {
      return operationStack.length
    }
    return undoCount?.value ?? 0
  })

  const operationAwareRedoCount = computed(() => {
    if (useOperationAwareUndo) {
      return redoOperationStack.length
    }
    return redoCount?.value ?? 0
  })

  return {
    // BUG-309-B: Use operation-aware computed refs
    canUndo: operationAwareCanUndo,
    canRedo: operationAwareCanRedo,
    undoCount: operationAwareUndoCount,
    redoCount: operationAwareRedoCount,
    history,

    // Standard undo/redo operations
    undo: performUndo,
    redo: performRedo,

    // FIXED: Unified state management using VueUse pattern
    saveState,               // Use unified saveState function instead of before/after

    // BUG-309-B: Operation-aware API for fine-grained control
    beginOperation,
    commitOperation,

    // Task operations that use the shared refHistory
    deleteTaskWithUndo,
    permanentlyDeleteTaskWithUndo,
    bulkDeleteTasksWithUndo,
    updateTaskWithUndo,
    createTaskWithUndo,

    // Group operations with undo (ISSUE-008 fix / BUG-008 fix)
    createGroupWithUndo,
    updateGroupWithUndo,
    deleteGroupWithUndo,

    // BUG-309-B: Debugging/inspection
    getOperationStack: () => [...operationStack],
    getRedoOperationStack: () => [...redoOperationStack],
    isOperationAwareMode: () => useOperationAwareUndo
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
 * BUG-309-B: Also clears operation stacks
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

  // BUG-309-B: Clear operation stacks
  operationStack = []
  redoOperationStack = []
  pendingOperationBefore = null
  pendingOperation = null

  if (typeof window !== 'undefined') {
    delete (window as Window & typeof globalThis).__pomoFlowUndoSystem
  }
}