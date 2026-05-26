/**
 * Regression tests for BUG-1739: undo fails to restore canvasPosition
 *
 * Root cause: `captureCurrentState` uses JSON.parse(JSON.stringify(...)) to clone
 * task snapshots. When `canvasPosition` is set to `undefined`, JSON.stringify strips
 * the key entirely, so the "after" snapshot has no `canvasPosition` entry.
 * The original comparison loop only iterated `Object.keys(afterTask)`, so the missing
 * key was never detected and the field was never restored.
 *
 * Fix: a second loop in `performSelectiveUndo` checks for keys present in
 * `previousTask` but absent from `afterTask` and adds them to `changedFields`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ============================================================================
// Module-level mocks — must be declared before any imports that transitively
// pull in the mocked modules.
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
  useCanvasUiStore: () => ({ requestSync: vi.fn() })
}))

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem, resetUndoSystem } from '@/composables/undoSingleton'
import { createMockTask } from '../factories/index'

// ============================================================================
// Test 1: JSON.stringify strips undefined values
// ============================================================================

describe('JSON.stringify strips undefined values (BUG-1739 precondition)', () => {
  it('produces an empty object when canvasPosition is undefined', () => {
    const original = { canvasPosition: undefined as unknown }
    const cloned = JSON.parse(JSON.stringify(original))
    // The key must be gone — this is what causes the bug
    expect('canvasPosition' in cloned).toBe(false)
    expect(cloned).toEqual({})
  })

  it('preserves canvasPosition when it has a real value', () => {
    const original = { canvasPosition: { x: 100, y: 200 } }
    const cloned = JSON.parse(JSON.stringify(original))
    expect(cloned.canvasPosition).toEqual({ x: 100, y: 200 })
  })
})

// ============================================================================
// Tests 2–4: field-comparison logic that mirrors performSelectiveUndo
// ============================================================================

/**
 * Replicates the comparison logic from performSelectiveUndo (lines 297-310)
 * so we can unit-test it in isolation without spinning up the full undo stack.
 */
function computeChangedFields(
  previousTask: Record<string, unknown>,
  afterTask: Record<string, unknown>
): Record<string, unknown> {
  const changedFields: Record<string, unknown> = {}

  // First loop: fields present in afterTask that differ from previousTask
  for (const key of Object.keys(afterTask)) {
    if (JSON.stringify(afterTask[key]) !== JSON.stringify(previousTask[key])) {
      changedFields[key] = previousTask[key]
    }
  }

  // BUG-1739 fix: second loop — keys present in previousTask but MISSING from afterTask
  for (const key of Object.keys(previousTask)) {
    if (!(key in afterTask) && !(key in changedFields)) {
      changedFields[key] = previousTask[key]
    }
  }

  return changedFields
}

describe('performSelectiveUndo field-comparison logic (BUG-1739)', () => {
  it('detects a removed field (canvasPosition stripped by JSON.stringify)', () => {
    // previousTask had canvasPosition; afterTask is its JSON-round-tripped form
    // where canvasPosition: undefined was stripped by JSON.stringify
    const previousTask = {
      id: 'task-001',
      title: 'My Task',
      isInInbox: false,
      canvasPosition: { x: 100, y: 200 }
    }

    // Simulate what captureCurrentState does to a task that was updated with
    // canvasPosition: undefined — the key disappears after safeClone
    const afterTask = JSON.parse(
      JSON.stringify({ ...previousTask, canvasPosition: undefined })
    ) as Record<string, unknown>

    // afterTask must NOT have canvasPosition (confirms the precondition)
    expect('canvasPosition' in afterTask).toBe(false)

    const changed = computeChangedFields(
      previousTask as unknown as Record<string, unknown>,
      afterTask
    )

    // The fix must restore canvasPosition from previousTask
    expect(changed).toHaveProperty('canvasPosition', { x: 100, y: 200 })
  })

  it('detects a changed field (title differs between snapshots)', () => {
    const previousTask = { id: 'task-001', title: 'Before', isInInbox: false }
    const afterTask    = { id: 'task-001', title: 'After',  isInInbox: false }

    const changed = computeChangedFields(previousTask, afterTask)

    expect(changed).toHaveProperty('title', 'Before')
    // Fields that did not change must be absent
    expect(changed).not.toHaveProperty('id')
    expect(changed).not.toHaveProperty('isInInbox')
  })

  it('skips fields that are identical in both snapshots', () => {
    const previousTask = {
      id: 'task-001',
      title: 'Same',
      isInInbox: false,
      canvasPosition: { x: 50, y: 50 }
    }
    const afterTask = {
      id: 'task-001',
      title: 'Same',
      isInInbox: false,
      canvasPosition: { x: 50, y: 50 }
    }

    const changed = computeChangedFields(
      previousTask as unknown as Record<string, unknown>,
      afterTask as unknown as Record<string, unknown>
    )

    // Nothing changed — changedFields should be empty
    expect(Object.keys(changed)).toHaveLength(0)
  })
})

// ============================================================================
// Test 5: End-to-end round-trip via bulkMoveToInboxWithUndo + undo()
// ============================================================================

describe('bulkMoveToInboxWithUndo undo restores canvasPosition (BUG-1739 e2e)', () => {
  beforeEach(() => {
    resetUndoSystem()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Allow persistence to succeed silently
    mockSaveTasks.mockResolvedValue(undefined)
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
  })

  afterEach(() => {
    resetUndoSystem()
    vi.restoreAllMocks()
  })

  it('restores and clears canvasPosition across three undo/redo cycles when it was cleared to undefined', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()

    // Seed a task with a known canvasPosition directly in the store
    const taskId = 'undo-test-task-001'
    const seedTask = createMockTask({
      id: taskId,
      title: 'Canvas Task',
      isInInbox: false,
      canvasPosition: { x: 300, y: 400 } as unknown as undefined
    })

    // Push directly into _rawTasks so the store has it
    taskStore._rawTasks.push(seedTask as Parameters<typeof taskStore._rawTasks.push>[0])

    // Confirm initial state
    const before = taskStore._rawTasks.find(t => t.id === taskId)
    expect(before?.canvasPosition).toEqual({ x: 300, y: 400 })

    // Execute the operation that triggers BUG-1739:
    // bulkMoveToInboxWithUndo sets canvasPosition: undefined
    await undoSystem.bulkMoveToInboxWithUndo([taskId])

    // Confirm the task was moved to inbox and canvasPosition was cleared
    const afterMove = taskStore._rawTasks.find(t => t.id === taskId)
    expect(afterMove?.isInInbox).toBe(true)
    // canvasPosition may be undefined or absent — either way it's not {x:300,y:400}
    expect(afterMove?.canvasPosition).not.toEqual({ x: 300, y: 400 })

    for (let i = 0; i < 3; i += 1) {
      // Undo — should restore the original canvasPosition
      await undoSystem.undo()

      const afterUndo = taskStore._rawTasks.find(t => t.id === taskId)
      expect(afterUndo).toBeDefined()
      expect(afterUndo?.canvasPosition).toEqual({ x: 300, y: 400 })
      expect(afterUndo?.isInInbox).toBe(false)

      // Redo — should clear canvasPosition again, even though undefined is stripped from snapshots
      await undoSystem.redo()

      const afterRedo = taskStore._rawTasks.find(t => t.id === taskId)
      expect(afterRedo).toBeDefined()
      expect(afterRedo?.canvasPosition).toBeUndefined()
      expect(afterRedo?.isInInbox).toBe(true)
    }
  })
})
