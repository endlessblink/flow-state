/**
 * Regression tests for BUG-1739: bulkMoveToInboxWithUndo race condition fix.
 *
 * The original bug: bulkMoveToInboxWithUndo used beginOperation/commitOperation globals.
 * Drag settling's stale commitOperation could steal pendingOperation during an `await`,
 * causing a null reference crash. The fix bypasses the global pattern entirely —
 * snapshots are captured directly and pushed to operationStack.
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
  useDatabase: () => ({
    save: vi.fn(),
    load: vi.fn().mockResolvedValue(null)
  }),
  DB_KEYS: {
    TASKS: 'tasks',
    PROJECTS: 'projects',
    CANVAS: 'canvas'
  }
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
  useCanvasUiStore: () => ({ requestSync: vi.fn() })
}))

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem } from '@/composables/undoSingleton'
import { createMockTask } from '../factories'

// ============================================================================
// Helpers
// ============================================================================

/** Seed N tasks into the store and return their IDs. */
async function seedTasks(store: ReturnType<typeof useTaskStore>, count: number): Promise<string[]> {
  mockSaveTasks.mockResolvedValue(undefined)
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const task = await store.createTask({ title: `Task ${i + 1}` })
    ids.push(task.id)
  }
  return ids
}

// ============================================================================
// Tests
// ============================================================================

describe('BUG-1739: bulkMoveToInboxWithUndo race condition regression', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Succeed all persistence calls by default
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockSaveTasks.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // Test 1: Single undo entry for N tasks
  // --------------------------------------------------------------------------

  it('adds exactly one entry to the operation stack for a 3-task bulk move', async () => {
    const store = useTaskStore()
    const undoSystem = getUndoSystem()

    const stackBefore = undoSystem.getOperationStack().length
    const ids = await seedTasks(store, 3)

    await undoSystem.bulkMoveToInboxWithUndo(ids)

    const stackAfter = undoSystem.getOperationStack()
    expect(stackAfter.length).toBe(stackBefore + 1)
  })

  // --------------------------------------------------------------------------
  // Test 2: Operation type is 'task-move'
  // --------------------------------------------------------------------------

  it("records the operation with type 'task-move'", async () => {
    const store = useTaskStore()
    const undoSystem = getUndoSystem()

    const ids = await seedTasks(store, 2)
    await undoSystem.bulkMoveToInboxWithUndo(ids)

    const stack = undoSystem.getOperationStack()
    const entry = stack[stack.length - 1]

    expect(entry.operation.type).toBe('task-move')
  })

  // --------------------------------------------------------------------------
  // Test 3: All affected IDs tracked
  // --------------------------------------------------------------------------

  it('records all 3 task IDs in affectedIds', async () => {
    const store = useTaskStore()
    const undoSystem = getUndoSystem()

    const ids = await seedTasks(store, 3)
    await undoSystem.bulkMoveToInboxWithUndo(ids)

    const stack = undoSystem.getOperationStack()
    const entry = stack[stack.length - 1]

    expect(entry.operation.affectedIds).toHaveLength(3)
    for (const id of ids) {
      expect(entry.operation.affectedIds).toContain(id)
    }
  })

  // --------------------------------------------------------------------------
  // Test 4: Does not corrupt pendingOperation — commitOperation warns, not crash
  // --------------------------------------------------------------------------

  it('does not corrupt pendingOperation — commitOperation warns without crashing', async () => {
    const store = useTaskStore()
    const undoSystem = getUndoSystem()

    const ids = await seedTasks(store, 2)

    // bulkMoveToInboxWithUndo must NOT call beginOperation, so pendingOperation stays null.
    // Calling commitOperation afterward should warn (false return), not throw.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await undoSystem.bulkMoveToInboxWithUndo(ids)

    let result: boolean | undefined
    await expect(async () => {
      result = await undoSystem.commitOperation()
    }).not.toThrow()

    // commitOperation returns false and emits a console.warn when there is no pending op
    expect(result).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('commitOperation called without beginOperation')
    )

    warnSpy.mockRestore()
  })

  // --------------------------------------------------------------------------
  // Test 5: Redo stack cleared after operation
  // --------------------------------------------------------------------------

  it('clears the redo stack after a bulk move', async () => {
    const store = useTaskStore()
    const undoSystem = getUndoSystem()

    const ids = await seedTasks(store, 2)
    await undoSystem.bulkMoveToInboxWithUndo(ids)

    expect(undoSystem.getRedoOperationStack()).toHaveLength(0)
  })
})
