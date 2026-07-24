// Undo System Singleton - Ensures shared instance across the entire application
// This solves initialization order issues between App.vue and globalKeyboardHandlerSimple.ts
// UPDATED: Now tracks both tasks AND canvas groups for unified undo/redo (ISSUE-008 fix)

import { ref, computed, nextTick, toRaw } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { useManualRefHistory } from '@vueuse/core'
import type { Task } from '../stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import type { CanvasGroup } from '@/types/canvas'
import { guardTaskCreation } from '../utils/demoContentGuard'
import { useToast } from './useToast'
import { supabase } from '@/services/auth/supabase'
import { beginPermanentDeleteTrace, endPermanentDeleteTrace, logPermanentDeleteTrace } from '@/utils/permanentDeleteTrace'

interface UndoSystemState {
  canUndo: ComputedRef<boolean> | null
  canRedo: ComputedRef<boolean> | null
  undoCount: ComputedRef<number> | null
  redoCount: ComputedRef<number> | null
  history: ComputedRef<import('@vueuse/core').UseRefHistoryRecord<UnifiedUndoState>[]> | null
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
  | 'canvas-connection'
  | 'canvas-geometry'
  | 'image-delete'  // TASK-1690: Canvas image deletion (undo restores image)
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

const computeChangedFields = (
  sourceTask: Task,
  comparisonTask: Task
): Record<string, unknown> => {
  const changedFields: Record<string, unknown> = {}

  for (const key of Object.keys(sourceTask) as Array<keyof typeof sourceTask>) {
    if (JSON.stringify(sourceTask[key]) !== JSON.stringify((comparisonTask as typeof sourceTask)[key])) {
      changedFields[key] = sourceTask[key]
    }
  }

  for (const key of Object.keys(comparisonTask) as Array<keyof typeof comparisonTask>) {
    if (!(key in sourceTask) && !(key in changedFields)) {
      changedFields[key as string] = undefined
    }
  }

  return changedFields
}

// Separate operation history that parallels VueUse's refHistory
// This allows us to associate metadata with each history entry
// TASK-1722 FIX: Use Vue ref so computed() properties (canUndo, canRedo, etc.) react to mutations
const operationStack = ref<OperationSnapshot[]>([])
const redoOperationStack = ref<OperationSnapshot[]>([])

// Flag to track if we're in operation-aware mode
const useOperationAwareUndo = true

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
      // Use _rawTasks (all tasks) not tasks (filtered) to avoid losing hidden tasks
      if (unifiedState && taskStore._rawTasks && Array.isArray(taskStore._rawTasks)) {
        unifiedState.value.tasks = [...taskStore._rawTasks]
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
    capacity: 30,
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
 * TASK-1722: Remove tombstone so undo can re-create a permanently deleted task.
 * Safe to call for soft-deleted tasks — no tombstone exists, DELETE is a no-op.
 */
async function clearTombstoneForUndo(taskId: string): Promise<void> {
  try {
    const sb = supabase
    if (!sb?.auth) return
    const { data: { session } } = await sb.auth.getSession()
    if (!session?.user) return
    await sb.from('tombstones').delete()
      .eq('entity_type', 'task').eq('entity_id', taskId).eq('user_id', session.user.id)
  } catch (e) {
    console.warn('[UNDO] Tombstone cleanup error:', e)
  }
}

/**
 * Perform selective undo based on operation type
 * Only restores entities that were actually affected by the operation
 */
const performSelectiveUndo = async (operationSnapshot: OperationSnapshot): Promise<boolean> => {
  const { operation, snapshotBefore, snapshotAfter } = operationSnapshot
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()
  const { useCanvasUiStore } = await import('../stores/canvas/canvasUi')
  const canvasUiStore = useCanvasUiStore()

  switch (operation.type) {
    case 'task-create': {
      // Undo creation = delete the created task
      const taskId = operation.affectedIds[0]
      if (taskId) {
        await taskStore.deleteTask(taskId, 'undo:revert-create')
        // Cancel only pending CREATEs — keep the DELETE we just enqueued
        try {
          const { deleteOperationsByType } = await import('@/services/offline/writeQueueDB')
          await deleteOperationsByType('task', taskId, 'create')
        } catch (e) {
          console.warn('[UNDO] Failed to cancel pending sync ops:', e)
        }
      }
      break
    }

    case 'task-delete': {
      // Undo deletion = restore the deleted task from snapshot
      const taskId = operation.affectedIds[0]
      const deletedTask = snapshotBefore.tasks.find(t => t.id === taskId)
      if (deletedTask) {
        // BUG-1737: Block realtime echoes FIRST (sync, before any await)
        taskStore.addPendingWrite(taskId)
        await clearTombstoneForUndo(taskId) // TASK-1722: Remove tombstone so createTask isn't blocked
        // BUG-1737: Cancel queue DELETE BEFORE enqueueing CREATE to prevent race
        // (sync orchestrator's BUG-1534 logic cancels CREATEs when processing DELETEs)
        try {
          const { deleteOperationsByType } = await import('@/services/offline/writeQueueDB')
          await deleteOperationsByType('task', taskId, 'delete')
        } catch (e) {
          console.warn('[UNDO] Failed to cancel pending sync ops:', e)
        }
        await taskStore.createTask(deletedTask)
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
          // BUG-1737: Block realtime echoes FIRST (sync, before any await)
          taskStore.addPendingWrite(taskId)
          await clearTombstoneForUndo(taskId) // TASK-1722: Remove tombstone so createTask isn't blocked
          // BUG-1737: Cancel queue DELETE BEFORE enqueueing CREATE
          try {
            const { deleteOperationsByType } = await import('@/services/offline/writeQueueDB')
            await deleteOperationsByType('task', taskId, 'delete')
          } catch (e) {
            console.warn('[UNDO] Failed to cancel pending sync ops:', e)
          }
          await taskStore.createTask(deletedTask)
        }
      }
      break
    }

    case 'task-update':
    case 'task-move': {
      // Undo update/move = restore only the fields that actually changed in the original operation
      // This prevents overwriting concurrent remote edits to fields not touched by this operation
      for (const taskId of operation.affectedIds) {
        const previousTask = snapshotBefore.tasks.find(t => t.id === taskId)
        const afterTask = snapshotAfter.tasks.find(t => t.id === taskId)
        if (previousTask && afterTask) {
          const changedFields = computeChangedFields(previousTask, afterTask)
          if (Object.keys(changedFields).length > 0) {
            await taskStore.updateTask(taskId, changedFields as Partial<Task>, 'USER') // BUG-1051: AWAIT to ensure persistence
          }
        } else if (previousTask) {
          // afterTask missing (shouldn't happen for update/move) — fall back to full restore
          await taskStore.updateTask(taskId, { ...previousTask }, 'USER')
        }
      }
      break
    }

    case 'group-create': {
      // Undo group creation = delete the created group
      const groupId = operation.affectedIds[0]
      if (groupId) {
        await canvasStore.deleteGroup(groupId)
      }
      break
    }

    case 'group-delete': {
      // Undo group deletion = restore the deleted group from snapshot
      const groupId = operation.affectedIds[0]
      const deletedGroup = snapshotBefore.groups.find(g => g.id === groupId)
      if (deletedGroup) {
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
          await canvasStore.updateGroup(groupId, {
            ...previousGroup,
            position: previousGroup.position,
            parentGroupId: previousGroup.parentGroupId
          })
        }
      }
      break
    }

    case 'canvas-connection': {
      for (const groupId of operation.affectedIds) {
        const previousGroup = snapshotBefore.groups.find(g => g.id === groupId)
        if (previousGroup) {
          await canvasStore.updateGroup(groupId, { linkedParentTaskId: previousGroup.linkedParentTaskId ?? null })
        }
      }
      break
    }

    case 'canvas-geometry': {
      for (const taskId of operation.affectedIds) {
        const previousTask = snapshotBefore.tasks.find(t => t.id === taskId)
        const afterTask = snapshotAfter.tasks.find(t => t.id === taskId)
        if (previousTask && afterTask) {
          const changedFields = computeChangedFields(previousTask, afterTask)
          if (Object.keys(changedFields).length > 0) {
            await taskStore.updateTask(taskId, changedFields as Partial<Task>, 'DRAG')
          }
        }
      }

      for (const groupId of operation.affectedIds) {
        const previousGroup = snapshotBefore.groups.find(g => g.id === groupId)
        const afterGroup = snapshotAfter.groups.find(g => g.id === groupId)
        if (previousGroup && afterGroup) {
          await canvasStore.updateGroup(groupId, {
            ...previousGroup,
            position: previousGroup.position,
            parentGroupId: previousGroup.parentGroupId
          })
        }
      }
      break
    }

    case 'image-delete': {
      // TASK-1690: Undo image deletion = restore the image from snapshot
      // TASK-1722: Return early — images are managed outside task/group sync,
      // so requestSync('user:undo') is unnecessary and can cause cascading wipes
      const imageData = (snapshotBefore as unknown as Record<string, unknown>)._imageData
      if (imageData) {
        const { useCanvasImagesStore } = await import('@/stores/canvasImages')
        const store = useCanvasImagesStore()
        store.restoreCanvasImage(imageData as import('@/stores/canvas/types').CanvasImage)
      } else {
        console.error('❌ [UNDO] image-delete: no _imageData in snapshot!')
      }
      return true  // Early return — skip requestSync
    }

    case 'legacy':
    default: {
      // Fall back to full-state restoration for legacy entries
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
  const { operation, snapshotBefore, snapshotAfter } = operationSnapshot
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()
  const { useCanvasUiStore } = await import('../stores/canvas/canvasUi')
  const canvasUiStore = useCanvasUiStore()

  switch (operation.type) {
    case 'task-create': {
      // Redo creation = recreate the task
      const taskId = operation.affectedIds[0]
      const createdTask = snapshotAfter.tasks.find(t => t.id === taskId)
      if (createdTask) {
        await taskStore.createTask(createdTask)
        // Cancel only pending DELETEs — keep the CREATE we just enqueued
        try {
          const { deleteOperationsByType } = await import('@/services/offline/writeQueueDB')
          await deleteOperationsByType('task', taskId, 'delete')
        } catch (e) {
          console.warn('[REDO] Failed to cancel pending sync ops:', e)
        }
      }
      break
    }

    case 'task-delete': {
      // Redo deletion = delete the task again
      const taskId = operation.affectedIds[0]
      await taskStore.deleteTask(taskId, 'redo:re-delete')
        // Cancel only pending CREATEs — keep the DELETE we just enqueued
        try {
          const { deleteOperationsByType } = await import('@/services/offline/writeQueueDB')
          await deleteOperationsByType('task', taskId, 'create')
        } catch (e) {
          console.warn('[REDO] Failed to cancel pending sync ops:', e)
        }
      break
    }

    case 'task-bulk-delete': {
      // Redo bulk deletion = delete all tasks again
      await taskStore.bulkDeleteTasks(operation.affectedIds)
      for (const taskId of operation.affectedIds) {
        // Cancel only pending CREATEs — keep the DELETE we just enqueued
        try {
          const { deleteOperationsByType } = await import('@/services/offline/writeQueueDB')
          await deleteOperationsByType('task', taskId, 'create')
        } catch (e) {
          console.warn('[REDO] Failed to cancel pending sync ops:', e)
        }
      }
      break
    }

    case 'task-update':
    case 'task-move': {
      // Redo update/move = apply only the fields that actually changed in the original operation
      // This prevents overwriting concurrent remote edits to fields not touched by this operation
      for (const taskId of operation.affectedIds) {
        const beforeTask = snapshotBefore.tasks.find(t => t.id === taskId)
        const afterTask = snapshotAfter.tasks.find(t => t.id === taskId)
        if (afterTask && beforeTask) {
          const changedFields = computeChangedFields(afterTask, beforeTask)
          if (Object.keys(changedFields).length > 0) {
            await taskStore.updateTask(taskId, changedFields as Partial<Task>, 'USER') // BUG-1051: AWAIT to ensure persistence
          }
        } else if (afterTask) {
          // beforeTask missing (shouldn't happen for update/move) — fall back to full apply
          await taskStore.updateTask(taskId, { ...afterTask }, 'USER')
        }
      }
      break
    }

    case 'group-create': {
      // Redo group creation = recreate the group
      const groupId = operation.affectedIds[0]
      const createdGroup = snapshotAfter.groups.find(g => g.id === groupId)
      if (createdGroup) {
        await canvasStore.createGroup(createdGroup)
      }
      break
    }

    case 'group-delete': {
      // Redo group deletion = delete the group again
      const groupId = operation.affectedIds[0]
      await canvasStore.deleteGroup(groupId)
      break
    }

    case 'group-update':
    case 'group-resize': {
      // Redo group update/resize = apply the after state
      for (const groupId of operation.affectedIds) {
        const afterGroup = snapshotAfter.groups.find(g => g.id === groupId)
        if (afterGroup) {
          await canvasStore.updateGroup(groupId, {
            ...afterGroup,
            position: afterGroup.position,
            parentGroupId: afterGroup.parentGroupId
          })
        }
      }
      break
    }

    case 'canvas-connection': {
      for (const groupId of operation.affectedIds) {
        const afterGroup = snapshotAfter.groups.find(g => g.id === groupId)
        if (afterGroup) {
          await canvasStore.updateGroup(groupId, { linkedParentTaskId: afterGroup.linkedParentTaskId ?? null })
        }
      }
      break
    }

    case 'canvas-geometry': {
      for (const taskId of operation.affectedIds) {
        const beforeTask = snapshotBefore.tasks.find(t => t.id === taskId)
        const afterTask = snapshotAfter.tasks.find(t => t.id === taskId)
        if (afterTask && beforeTask) {
          const changedFields = computeChangedFields(afterTask, beforeTask)
          if (Object.keys(changedFields).length > 0) {
            await taskStore.updateTask(taskId, changedFields as Partial<Task>, 'DRAG')
          }
        }
      }

      for (const groupId of operation.affectedIds) {
        const afterGroup = snapshotAfter.groups.find(g => g.id === groupId)
        const beforeGroup = snapshotBefore.groups.find(g => g.id === groupId)
        if (afterGroup && beforeGroup) {
          await canvasStore.updateGroup(groupId, {
            ...afterGroup,
            position: afterGroup.position,
            parentGroupId: afterGroup.parentGroupId
          })
        }
      }
      break
    }

    case 'image-delete': {
      // TASK-1690: Redo image deletion = remove the image again
      // TASK-1722: Return early — skip requestSync (images managed separately)
      const imageData = (snapshotBefore as unknown as Record<string, unknown>)._imageData
      if (imageData) {
        const { useCanvasImagesStore } = await import('@/stores/canvasImages')
        const store = useCanvasImagesStore()
        await store.removeCanvasImage((imageData as { id: string }).id)
      }
      return true  // Early return — skip requestSync
    }

    case 'legacy':
    default: {
      // Fall back to full-state restoration for legacy entries
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
  // BUG-309-B: Try operation-aware undo first
  if (useOperationAwareUndo && operationStack.value.length > 0) {
    const operationSnapshot = operationStack.value.pop()!
    redoOperationStack.value.push(operationSnapshot)

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
  if (useOperationAwareUndo && redoOperationStack.value.length > 0) {
    const operationSnapshot = redoOperationStack.value.pop()!
    operationStack.value.push(operationSnapshot)

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
 * Capture current state as a snapshot (deep clone).
 * When affectedIds is provided, only the affected tasks are cloned — reducing
 * memory from O(all tasks × all ops) to O(affected tasks × all ops).
 * The legacy undo path receives a full snapshot (affectedIds omitted).
 */
const captureCurrentState = async (affectedIds?: string[]): Promise<UnifiedUndoState> => {
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const canvasStore = useCanvasStore()
  const safeClone = <T>(value: T, fallback: T): T => {
    try {
      if (value == null) return fallback
      const raw = toRaw(value)
      const serialized = JSON.stringify(raw)
      if (serialized == null) return fallback
      return JSON.parse(serialized) as T
    } catch (error) {
      console.warn('⚠️ [UNDO] Failed to clone snapshot state, using fallback:', error)
      try { return JSON.parse(JSON.stringify(toRaw(fallback))) as T } catch { return fallback }
    }
  }

  const rawTasks = taskStore._rawTasks ?? []
  // Partial snapshot: only clone affected tasks to keep memory bounded
  const tasksToSnapshot =
    affectedIds && affectedIds.length > 0
      ? rawTasks.filter(t => affectedIds.includes(t.id))
      : rawTasks

  return {
    // Use _rawTasks (all tasks) not tasks (filtered) to avoid snapshotting only visible tasks
    tasks: tasksToSnapshot.map(t => safeClone(t, t)),
    groups: safeClone(canvasStore.groups ?? [], [])
  }
}

/**
 * Handle returned by beginOperation and passed back to commitOperation.
 * Each in-flight operation owns its own handle; there is no shared module-level
 * state, so overlapping operations cannot clobber each other.
 */
type OperationHandle = {
  before: UnifiedUndoState
  operation: UndoOperation
}

const beginOperation = async (operation: Omit<UndoOperation, 'timestamp'>): Promise<OperationHandle> => {
  // Pass affectedIds so captureCurrentState only clones the relevant tasks
  const before = await captureCurrentState(operation.affectedIds)
  return {
    before,
    operation: {
      ...operation,
      timestamp: Date.now()
    }
  }
}

/**
 * Complete the operation and save the undo entry.
 * Pass the handle returned by beginOperation. No-arg call is retained as a
 * safe no-op (warns and returns false) for paths like bulkMoveToInboxWithUndo
 * that bypass the begin/commit API entirely (BUG-1739).
 */
const commitOperation = async (handle?: OperationHandle) => {
  if (!handle) {
    console.warn('⚠️ [UNDO] commitOperation called without beginOperation')
    return false
  }

  const snapshotAfter = await captureCurrentState(handle.operation.affectedIds)

  // Push to operation stack (limit capacity to 30 to bound memory usage)
  operationStack.value.push({
    operation: handle.operation,
    snapshotBefore: handle.before,
    snapshotAfter
  })
  if (operationStack.value.length > 30) {
    operationStack.value.shift()
  }

  // Clear redo stack on new operation
  redoOperationStack.value = []

  // Also update VueUse's refHistory for backward compatibility
  if (unifiedState && commit) {
    unifiedState.value = snapshotAfter
    commit()
  }

  return true
}

// UPDATED: Now saves both tasks AND groups (ISSUE-008 fix)
// BUG-309-B: Enhanced to support operation metadata for selective restoration
const saveState = async (_description?: string, _operation?: Omit<UndoOperation, 'timestamp'>) => {
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
    // Use _rawTasks (all tasks) not tasks (filtered) to avoid saving only visible tasks
    if (unifiedState) {
      unifiedState.value = {
        tasks: [...taskStore._rawTasks],
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

  const taskSource = Array.isArray(taskStore.rawTasks) ? taskStore.rawTasks : taskStore.tasks
  const taskToDelete = taskSource.find(t => t.id === taskId)
  if (!taskToDelete) {
    console.warn('⚠️ Task not found for deletion:', taskId)
    return
  }

  const handle = await beginOperation({
    type: 'task-delete',
    affectedIds: [taskId],
    description: `Delete task: ${taskToDelete.title}`
  })

  try {
    await taskStore.deleteTask(taskId, 'deleteTaskWithUndo')
    await nextTick()
    await commitOperation(handle)
  } catch (error) {
    console.error('❌ deleteTaskWithUndo failed:', error)
    throw error
  }
}

/**
 * Permanently delete a task with undo support (Shift+Delete from canvas)
 * Uses the same undo mechanism as soft delete - undo will recreate the task from snapshot
 */
const permanentlyDeleteTaskWithUndo = async (taskId: string) => {
  beginPermanentDeleteTrace(taskId, 'undoSingleton.permanentlyDeleteTaskWithUndo')
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  const taskSource = Array.isArray(taskStore.rawTasks) ? taskStore.rawTasks : taskStore.tasks
  const taskToDelete = taskSource.find(t => t.id === taskId)
  logPermanentDeleteTrace(taskId, 'undo.lookup', {
    found: Boolean(taskToDelete),
    rawTaskCount: taskStore.rawTasks?.length,
    visibleTaskCount: taskStore.tasks?.length,
    title: taskToDelete?.title,
  })
  if (!taskToDelete) {
    console.warn('⚠️ Task not found for permanent deletion:', taskId)
    endPermanentDeleteTrace(taskId, 'undo.not-found')
    return
  }

  const handle = await beginOperation({
    type: 'task-delete',
    affectedIds: [taskId],
    description: `Permanently delete task: ${taskToDelete.title}`
  })

  try {
    logPermanentDeleteTrace(taskId, 'undo.before-store-delete')
    await taskStore.permanentlyDeleteTask(taskId)
    logPermanentDeleteTrace(taskId, 'undo.after-store-delete', {
      stillInRawTasks: taskStore.rawTasks.some(t => t.id === taskId),
      rawTaskCount: taskStore.rawTasks.length,
    })

    await nextTick()
    await commitOperation(handle)
    endPermanentDeleteTrace(taskId, 'undo.committed')
  } catch (error) {
    logPermanentDeleteTrace(taskId, 'undo.error', {
      error: error instanceof Error ? error.message : String(error),
    })
    console.error('❌ permanentlyDeleteTaskWithUndo failed:', error)
    throw error
  }
}

const updateTaskWithUndo = async (taskId: string, updates: Partial<Task>) => {
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  const taskSource = Array.isArray(taskStore.rawTasks) ? taskStore.rawTasks : taskStore.tasks
  const taskToUpdate = taskSource.find(t => t.id === taskId)
  if (!taskToUpdate) {
    throw new Error(`Task update target no longer exists: ${taskId}`)
  }

  // BUG-309-B: Determine operation type based on what's being updated
  const isPositionUpdate = 'canvasPosition' in updates || 'parentId' in updates
  const operationType: UndoOperationType = isPositionUpdate ? 'task-move' : 'task-update'

  const handle = await beginOperation({
    type: operationType,
    affectedIds: [taskId],
    description: `${operationType === 'task-move' ? 'Move' : 'Update'} task: ${taskToUpdate.title}`
  })

  // BUG-1051: AWAIT to ensure persistence
  await taskStore.updateTask(taskId, updates)

  await nextTick()
  await commitOperation(handle)
}

const bulkUpdateTasksWithUndo = async (
  taskUpdates: Array<{ id: string; updates: Partial<Task> }>,
  description?: string
) => {
  const uniqueUpdates = taskUpdates.filter((update, index, allUpdates) =>
    update.id && allUpdates.findIndex(candidate => candidate.id === update.id) === index
  )
  if (uniqueUpdates.length === 0) return

  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const affectedIds = uniqueUpdates.map(update => update.id)
  const isPositionUpdate = uniqueUpdates.some(({ updates }) =>
    'canvasPosition' in updates || 'parentId' in updates
  )
  const operationType: UndoOperationType = isPositionUpdate ? 'task-move' : 'task-update'

  const handle = await beginOperation({
    type: operationType,
    affectedIds,
    description: description ?? `Bulk update ${uniqueUpdates.length} task${uniqueUpdates.length > 1 ? 's' : ''}`
  })

  const appliedUpdates: typeof uniqueUpdates = []
  const hasCompletionSideEffects = uniqueUpdates.some(({ updates }) => 'status' in updates)
  try {
    for (const { id, updates } of uniqueUpdates) {
      await taskStore.updateTask(id, updates, 'USER', { throwOnPersistenceFailure: true })
      appliedUpdates.push({ id, updates })
    }
    await nextTick()
    await commitOperation(handle)
  } catch (error) {
    if (hasCompletionSideEffects) {
      const partialError = new Error(
        `Bulk task status change stopped after ${appliedUpdates.length} of ${uniqueUpdates.length}; `
        + 'successful tasks remain changed'
      )
      const { showToast } = useToast()
      showToast(partialError.message, 'error')
      console.error('❌ bulkUpdateTasksWithUndo status change partially failed:', error)
      throw partialError
    }

    const rollbackErrors: unknown[] = []
    for (const { id, updates } of [...appliedUpdates].reverse()) {
      const previousTask = handle.before.tasks.find(task => task.id === id)
      if (!previousTask) continue
      const rollbackUpdates = Object.fromEntries(
        Object.keys(updates).map(key => [
          key,
          previousTask[key as keyof Task],
        ])
      ) as Partial<Task>
      try {
        await taskStore.updateTask(
          id,
          rollbackUpdates,
          'USER',
          { throwOnPersistenceFailure: true }
        )
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    const { showToast } = useToast()
    showToast(
      rollbackErrors.length === 0
        ? 'The batch change failed. Earlier task changes were rolled back.'
        : 'The batch change was only partly rolled back. Sync recovery needs attention.',
      'error'
    )
    console.error('❌ bulkUpdateTasksWithUndo failed:', error)
    if (rollbackErrors.length > 0) {
      const compensationError = new Error(
        'Bulk task update failed and its compensation was incomplete'
      ) as Error & { errors: unknown[] }
      compensationError.errors = [error, ...rollbackErrors]
      throw compensationError
    }
    throw error
  }
}

const createTaskWithUndo = async (taskData: Partial<Task>) => {
  // TASK-061: Demo content guard - defense in depth (also checked in taskStore.createTask)
  if (taskData.title) {
    guardTaskCreation(taskData.title)
  }

  // Begin tracking (we don't know ID yet, will update after creation)
  const handle = await beginOperation({
    type: 'task-create',
    affectedIds: [],
    description: `Create task: ${taskData.title || 'Untitled'}`
  })

  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()
  const newTask = await taskStore.createTask(taskData)

  if (newTask) {
    handle.operation.affectedIds = [newTask.id]
  }

  await nextTick()
  await commitOperation(handle)
  return newTask
}

// BUG-309-B: Operation-aware group operations
const createGroupWithUndo = async (groupData: Omit<CanvasGroup, 'id'>) => {
  const canvasStore = useCanvasStore()

  const handle = await beginOperation({
    type: 'group-create',
    affectedIds: [],
    description: `Create group: ${groupData.name || 'Untitled'}`
  })

  try {
    const newGroup = await canvasStore.createGroup(groupData)

    if (newGroup) {
      handle.operation.affectedIds = [newGroup.id]
    }

    await nextTick()
    await commitOperation(handle)
    return newGroup
  } catch (error) {
    console.error('❌ createGroupWithUndo failed:', error)
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

  const handle = await beginOperation({
    type: operationType,
    affectedIds: [groupId],
    description: `${operationType === 'group-resize' ? 'Resize' : 'Update'} group: ${groupToUpdate.name}`
  })

  try {
    await canvasStore.updateGroup(groupId, updates)
    await nextTick()
    await commitOperation(handle)
  } catch (error) {
    console.error('❌ updateGroupWithUndo failed:', error)
    throw error
  }
}

const canvasConnectionWithUndo = async (
  description: string,
  affectedIds: string[],
  applyConnectionChange: () => Promise<void>
) => {
  const handle = await beginOperation({
    type: 'canvas-connection',
    affectedIds: [...new Set(affectedIds)],
    description
  })

  try {
    await applyConnectionChange()
    await nextTick()
    await commitOperation(handle)
  } catch (error) {
    console.error('❌ canvasConnectionWithUndo failed:', error)
    throw error
  }
}

const canvasGeometryWithUndo = async (
  description: string,
  affectedIds: string[],
  applyGeometryChange: () => Promise<boolean | void>
) => {
  const uniqueAffectedIds = [...new Set(affectedIds)]
  if (uniqueAffectedIds.length === 0) {
    await applyGeometryChange()
    return
  }

  const handle = await beginOperation({
    type: 'canvas-geometry',
    affectedIds: uniqueAffectedIds,
    description
  })

  try {
    const changed = await applyGeometryChange()
    if (changed === false) return

    await nextTick()
    const snapshotAfter = await captureCurrentState(uniqueAffectedIds)
    const tasksChanged = handle.before.tasks.some(beforeTask => {
      const afterTask = snapshotAfter.tasks.find(task => task.id === beforeTask.id)
      return afterTask && Object.keys(computeChangedFields(beforeTask, afterTask)).length > 0
    })
    const groupsChanged = handle.before.groups.some(beforeGroup => {
      if (!uniqueAffectedIds.includes(beforeGroup.id)) return false
      const afterGroup = snapshotAfter.groups.find(group => group.id === beforeGroup.id)
      return afterGroup && JSON.stringify(beforeGroup) !== JSON.stringify(afterGroup)
    })

    if (!tasksChanged && !groupsChanged) return

    operationStack.value.push({
      operation: handle.operation,
      snapshotBefore: handle.before,
      snapshotAfter
    })
    if (operationStack.value.length > 30) operationStack.value.shift()
    redoOperationStack.value = []

    if (unifiedState && commit) {
      unifiedState.value = snapshotAfter
      commit()
    }
  } catch (error) {
    console.error('❌ canvasGeometryWithUndo failed:', error)
    throw error
  }
}

const pushCanvasGeometryUndoSnapshot = (
  description: string,
  affectedIds: string[],
  snapshotBefore: UnifiedUndoState,
  snapshotAfter: UnifiedUndoState
) => {
  const uniqueAffectedIds = [...new Set(affectedIds)]
  if (uniqueAffectedIds.length === 0) return false

  operationStack.value.push({
    operation: {
      type: 'canvas-geometry',
      affectedIds: uniqueAffectedIds,
      description,
      timestamp: Date.now()
    },
    snapshotBefore,
    snapshotAfter
  })
  if (operationStack.value.length > 30) operationStack.value.shift()
  redoOperationStack.value = []

  if (unifiedState && commit) {
    unifiedState.value = snapshotAfter
    commit()
  }

  return true
}

const deleteGroupWithUndo = async (groupId: string) => {
  const canvasStore = useCanvasStore()

  const groupToDelete = canvasStore.groups.find(g => g.id === groupId)
  if (!groupToDelete) {
    console.warn('⚠️ Group not found for deletion:', groupId)
    return
  }

  const handle = await beginOperation({
    type: 'group-delete',
    affectedIds: [groupId],
    description: `Delete group: ${groupToDelete.name}`
  })

  try {
    await canvasStore.deleteGroup(groupId)
    await nextTick()
    await commitOperation(handle)
  } catch (error) {
    console.error('❌ deleteGroupWithUndo failed:', error)
    throw error
  }
}

// BUG-309-B: Operation-aware bulk delete
const bulkDeleteTasksWithUndo = async (taskIds: string[]) => {
  // Dynamic import
  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  const handle = await beginOperation({
    type: 'task-bulk-delete',
    affectedIds: [...taskIds],
    description: `Bulk delete ${taskIds.length} tasks`
  })

  try {
    if (taskStore.bulkDeleteTasks) {
      await taskStore.bulkDeleteTasks(taskIds)
    } else {
      console.warn('⚠️ taskStore.bulkDeleteTasks not found, falling back to individual')
      for (const id of taskIds) {
        await taskStore.deleteTask(id, 'deleteTaskWithUndo')
      }
    }

    await nextTick()
    await commitOperation(handle)
  } catch (error) {
    console.error('❌ bulkDeleteTasksWithUndo failed:', error)
    throw error
  }
}

// BUG-1850: Batch HARD delete with a single undo operation (canvas Shift+Delete / permanent delete).
// The store uses one transactional database operation so the selection cannot be
// stranded in a partially deleted state.
// Uses the same handle-based begin/commit API (the old "corrupts pendingOperation" hazard is gone).
// Undo restores via the 'task-bulk-delete' case, which clears each tombstone first (TASK-1722).
const bulkPermanentlyDeleteTasksWithUndo = async (taskIds: string[]) => {
  if (!taskIds.length) return
  for (const id of taskIds) {
    beginPermanentDeleteTrace(id, 'undoSingleton.bulkPermanentlyDeleteTasksWithUndo', {
      batchSize: taskIds.length,
    })
  }

  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  const handle = await beginOperation({
    type: 'task-bulk-delete',
    affectedIds: [...taskIds],
    description: `Permanently delete ${taskIds.length} task${taskIds.length > 1 ? 's' : ''}`
  })

  try {
    for (const id of taskIds) {
      logPermanentDeleteTrace(id, 'bulk.before-store-delete', {
        batchSize: taskIds.length,
      })
    }
    await taskStore.bulkPermanentlyDeleteTasks(taskIds)
    for (const id of taskIds) {
      logPermanentDeleteTrace(id, 'bulk.after-store-delete', {
        stillInRawTasks: taskStore.rawTasks.some(t => t.id === id),
        rawTaskCount: taskStore.rawTasks.length,
      })
    }
    await nextTick()
    await commitOperation(handle)
    for (const id of taskIds) {
      endPermanentDeleteTrace(id, 'bulk.committed')
    }
  } catch (error) {
    for (const id of taskIds) {
      logPermanentDeleteTrace(id, 'bulk.error', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
    console.error('❌ bulkPermanentlyDeleteTasksWithUndo failed:', error)
    throw error
  }
}

// BUG-1739: Batch move-to-inbox with a single undo operation.
// Bypasses global beginOperation/commitOperation to avoid race condition
// with drag-settling's stale commitOperation stealing pendingOperation.
const bulkMoveToInboxWithUndo = async (taskIds: string[]) => {
  if (taskIds.length === 0) return

  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  // Capture "before" snapshot directly (not via beginOperation)
  const snapshotBefore = await captureCurrentState(taskIds)

  // Perform all updates
  const updates = { isInInbox: true, canvasPosition: undefined, canvasDismissed: true }
  for (const id of taskIds) {
    await taskStore.updateTask(id, updates)
  }

  // Capture "after" snapshot
  await nextTick()
  const snapshotAfter = await captureCurrentState(taskIds)

  // Push directly to operation stack (bypasses global pendingOperation)
  const operation: UndoOperation = {
    type: 'task-move',
    affectedIds: [...taskIds],
    description: `Remove ${taskIds.length} task${taskIds.length > 1 ? 's' : ''} from canvas`,
    timestamp: Date.now()
  }
  operationStack.value.push({ operation, snapshotBefore, snapshotAfter })
  if (operationStack.value.length > 30) operationStack.value.shift()
  redoOperationStack.value = []

  // Update VueUse refHistory for backward compatibility
  if (unifiedState && commit) {
    unifiedState.value = snapshotAfter
    commit()
  }
}

// TASK-1785: Shift+drag ripple-push reschedule on the calendar.
// Pushes one combined undo entry that covers re-timing N tasks (the dragged task
// plus every later same-day task that ripple-shifted with it).
// Bypasses beginOperation/commitOperation deliberately — same reason as
// bulkMoveToInboxWithUndo above (BUG-1739: drag-settling can steal pendingOperation).
const rippleShiftWithUndo = async (
  taskUpdates: Array<{ id: string; scheduledDate: string; scheduledTime: string; instanceId?: string }>,
  description?: string
) => {
  if (taskUpdates.length === 0) return

  const { useTaskStore } = await import('../stores/tasks')
  const taskStore = useTaskStore()

  const affectedIds = taskUpdates.map(u => u.id)
  const snapshotBefore = await captureCurrentState(affectedIds)

  // Apply schedule updates in order. updateTaskWithSchedule is atomic per task
  // and respects existing pending-write echo suppression.
  for (const update of taskUpdates) {
    await taskStore.updateTaskWithSchedule(update.id, {
      scheduledDate: update.scheduledDate,
      scheduledTime: update.scheduledTime,
      instanceId: update.instanceId
    })
  }

  await nextTick()
  const snapshotAfter = await captureCurrentState(affectedIds)

  const operation: UndoOperation = {
    type: 'task-move',
    affectedIds: [...affectedIds],
    description: description ?? `Ripple shift ${taskUpdates.length} task${taskUpdates.length > 1 ? 's' : ''}`,
    timestamp: Date.now()
  }
  operationStack.value.push({ operation, snapshotBefore, snapshotAfter })
  if (operationStack.value.length > 30) operationStack.value.shift()
  redoOperationStack.value = []

  if (unifiedState && commit) {
    unifiedState.value = snapshotAfter
    commit()
  }
}

// TASK-1690: Push an image deletion onto the global operation stack for Ctrl+Z support.
// This is called by useCanvasHotkeys and CanvasView context menu after removing an image.
export function pushImageDeleteUndo(imageData: { id: string; imageUrl: string; position: { x: number; y: number }; createdAt: string }) {
  operationStack.value.push({
    operation: {
      type: 'image-delete',
      affectedIds: [imageData.id],
      description: `Delete canvas image`,
      timestamp: Date.now()
    },
    // Store image data on snapshotBefore._imageData for the undo/redo handlers
    snapshotBefore: { tasks: [], groups: [], _imageData: imageData } as unknown as UnifiedUndoState,
    snapshotAfter: { tasks: [], groups: [] },
  })
  if (operationStack.value.length > 30) operationStack.value.shift()
  redoOperationStack.value = [] // Clear redo on new operation
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
    if (useOperationAwareUndo && operationStack.value.length > 0) {
      return true
    }
    return canUndo?.value ?? false
  })

  const operationAwareCanRedo = computed(() => {
    if (useOperationAwareUndo && redoOperationStack.value.length > 0) {
      return true
    }
    return canRedo?.value ?? false
  })

  const operationAwareUndoCount = computed(() => {
    if (useOperationAwareUndo) {
      return operationStack.value.length
    }
    return undoCount?.value ?? 0
  })

  const operationAwareRedoCount = computed(() => {
    if (useOperationAwareUndo) {
      return redoOperationStack.value.length
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
    bulkPermanentlyDeleteTasksWithUndo,
    bulkMoveToInboxWithUndo,
    rippleShiftWithUndo,
    updateTaskWithUndo,
    bulkUpdateTasksWithUndo,
    createTaskWithUndo,

    // Group operations with undo (ISSUE-008 fix / BUG-008 fix)
    createGroupWithUndo,
    updateGroupWithUndo,
    deleteGroupWithUndo,
    canvasConnectionWithUndo,
    canvasGeometryWithUndo,
    pushCanvasGeometryUndoSnapshot,

    // BUG-309-B: Debugging/inspection
    getOperationStack: () => [...operationStack.value],
    getRedoOperationStack: () => [...redoOperationStack.value],
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
  operationStack.value = []
  redoOperationStack.value = []

  if (typeof window !== 'undefined') {
    delete (window as Window & typeof globalThis).__pomoFlowUndoSystem
  }
}
