/**
 * Canvas Delete Contract Tests (BUG-1739)
 *
 * Regression tests for the fix that changed the non-permanent canvas Delete key
 * path from calling `deleteTask` (which soft-deleted tasks from the entire system)
 * to calling `updateTask` with `{ isInInbox: true, canvasPosition: undefined,
 * canvasDismissed: true }` via `bulkMoveToInboxWithUndo`.
 *
 * Key invariants:
 *  1. Tasks are moved to inbox, NOT deleted from the system.
 *  2. Each task gets isInInbox=true, canvasPosition=undefined, canvasDismissed=true.
 *  3. A single undo entry (type: 'task-move') is pushed for the entire batch.
 *  4. The entry's affectedIds contains every task ID that was processed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ============================================================================
// Module-level mocks — must be declared before any imports
// ============================================================================

const mockEnqueue = vi.fn()

vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue: mockEnqueue,
    status: { value: 'idle' },
    pendingCount: { value: 0 },
    failedCount: { value: 0 },
    lastSyncAt: { value: null },
    lastError: { value: null },
    isOnline: { value: true },
    isProcessing: { value: false },
    hasPendingChanges: { value: false },
    hasErrors: { value: false },
    retryFailed: vi.fn(),
    clearFailed: vi.fn(),
    getQueueStats: vi.fn(),
    forceSync: vi.fn()
  })
}))

vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({ save: vi.fn(), load: vi.fn().mockResolvedValue(null) }),
  DB_KEYS: { TASKS: 'tasks', PROJECTS: 'projects', CANVAS: 'canvas' }
}))

const mockSaveTasks = vi.fn()

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: mockSaveTasks,
    saveTasks: mockSaveTasks,
    deleteTask: vi.fn(),
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null)
  })
}))

vi.mock('@/services/auth/supabase', () => ({ supabase: null }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: '00000000-0000-0000-0000-000000000001' },
    isAuthenticated: true
  })
}))

vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({
    onTaskCompleted: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({
    currentTaskId: null,
    isTimerActive: false,
    stopTimer: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ showToast: vi.fn() })
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    groups: [],
    sections: [],
    selectedNodeIds: [],
    setSelectedNodes: vi.fn(),
    setGroups: vi.fn()
  })
}))

vi.mock('@/stores/canvas/canvasUi', () => ({
  useCanvasUiStore: () => ({
    requestSync: vi.fn()
  })
}))

// ============================================================================
// Subject under test (imported after mocks)
// ============================================================================

import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem } from '@/composables/undoSingleton'
import { createMockTask } from '../factories'

// ============================================================================
// Helpers
// ============================================================================

/** Seed a task directly into the store's raw task list, bypassing persistence. */
function seedTask(taskStore: ReturnType<typeof useTaskStore>, overrides: Parameters<typeof createMockTask>[0] = {}) {
  const task = createMockTask(overrides)
  taskStore._rawTasks.push(task)
  return task
}

// ============================================================================
// Tests
// ============================================================================

describe('bulkMoveToInboxWithUndo (BUG-1739)', () => {
  let taskStore: ReturnType<typeof useTaskStore>
  let undoSystem: ReturnType<typeof getUndoSystem>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Make persistence calls succeed by default so updateTask does not rollback
    mockSaveTasks.mockResolvedValue(undefined)
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })

    taskStore = useTaskStore()
    undoSystem = getUndoSystem()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // Invariant 1 & 2: tasks land in inbox with correct field values
  // --------------------------------------------------------------------------

  it('sets isInInbox=true, canvasPosition=undefined, canvasDismissed=true on each task', async () => {
    const taskA = seedTask(taskStore, { title: 'Task A', isInInbox: false })
    const taskB = seedTask(taskStore, { title: 'Task B', isInInbox: false })

    await undoSystem.bulkMoveToInboxWithUndo([taskA.id, taskB.id])

    const afterA = taskStore._rawTasks.find(t => t.id === taskA.id)
    const afterB = taskStore._rawTasks.find(t => t.id === taskB.id)

    expect(afterA?.isInInbox).toBe(true)
    expect(afterA?.canvasPosition).toBeUndefined()
    expect(afterA?.canvasDismissed).toBe(true)

    expect(afterB?.isInInbox).toBe(true)
    expect(afterB?.canvasPosition).toBeUndefined()
    expect(afterB?.canvasDismissed).toBe(true)
  })

  // --------------------------------------------------------------------------
  // Invariant 2 (critical): tasks must NOT be soft-deleted
  // --------------------------------------------------------------------------

  it('does NOT soft-delete tasks — they remain in the system with is_deleted falsy', async () => {
    const task = seedTask(taskStore, { title: 'Kept Task' })

    await undoSystem.bulkMoveToInboxWithUndo([task.id])

    const after = taskStore._rawTasks.find(t => t.id === task.id)
    expect(after).toBeDefined()
    // isDeleted / is_deleted must remain falsy — the task must still exist
    expect((after as Record<string, unknown>)?.isDeleted).toBeFalsy()
    expect((after as Record<string, unknown>)?.is_deleted).toBeFalsy()
  })

  // --------------------------------------------------------------------------
  // Invariant 3: exactly one undo entry is added for the entire batch
  // --------------------------------------------------------------------------

  it('pushes exactly one entry onto the operation stack for a multi-task batch', async () => {
    const stackBefore = undoSystem.getOperationStack().length

    const taskA = seedTask(taskStore)
    const taskB = seedTask(taskStore)
    const taskC = seedTask(taskStore)

    await undoSystem.bulkMoveToInboxWithUndo([taskA.id, taskB.id, taskC.id])

    const stackAfter = undoSystem.getOperationStack()
    expect(stackAfter.length).toBe(stackBefore + 1)
  })

  // --------------------------------------------------------------------------
  // Invariant 4: the undo entry has type 'task-move'
  // --------------------------------------------------------------------------

  it('records the undo entry with type "task-move"', async () => {
    const task = seedTask(taskStore)

    await undoSystem.bulkMoveToInboxWithUndo([task.id])

    const stack = undoSystem.getOperationStack()
    const entry = stack[stack.length - 1]
    expect(entry.operation.type).toBe('task-move')
  })

  // --------------------------------------------------------------------------
  // Invariant 5: affectedIds contains all processed task IDs
  // --------------------------------------------------------------------------

  it('records all task IDs in affectedIds of the undo entry', async () => {
    const taskA = seedTask(taskStore)
    const taskB = seedTask(taskStore)

    await undoSystem.bulkMoveToInboxWithUndo([taskA.id, taskB.id])

    const stack = undoSystem.getOperationStack()
    const entry = stack[stack.length - 1]
    expect(entry.operation.affectedIds).toContain(taskA.id)
    expect(entry.operation.affectedIds).toContain(taskB.id)
    expect(entry.operation.affectedIds).toHaveLength(2)
  })

  // --------------------------------------------------------------------------
  // Edge case: empty array is a no-op — no undo entry added
  // --------------------------------------------------------------------------

  it('is a no-op when called with an empty array', async () => {
    const stackBefore = undoSystem.getOperationStack().length

    await undoSystem.bulkMoveToInboxWithUndo([])

    expect(undoSystem.getOperationStack().length).toBe(stackBefore)
  })
})
