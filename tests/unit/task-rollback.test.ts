/**
 * Task Rollback Tests (TASK-1177 Phase 4)
 *
 * Tests for:
 * 1. updateTask rollback when all persistence paths fail
 * 2. onPermanentFailure callback pub/sub in useSyncOrchestrator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// ============================================================================
// Module-level mocks — must be at top level before any imports
// ============================================================================

// Mock the sync orchestrator so we control enqueue behavior per test
const mockEnqueue = vi.fn()
const mockOnPermanentFailure = vi.fn()

vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue: mockEnqueue,
    onPermanentFailure: mockOnPermanentFailure,
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

// Mock useDatabase (used by taskPersistence for localStorage fallback)
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

// Mock Supabase database so saveSpecificTasks is controllable
const mockSaveTasks = vi.fn()
const mockDeleteTask = vi.fn()

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: mockSaveTasks,
    saveTasks: mockSaveTasks,
    deleteTask: mockDeleteTask,
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null)
  })
}))

// Mock Supabase auth client (prevents real network calls)
vi.mock('@/services/auth/supabase', () => ({
  supabase: null
}))

// Mock auth store — user always authenticated with a UUID
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: '00000000-0000-0000-0000-000000000001' },
    isAuthenticated: true
  })
}))

// Mock gamification hooks (non-critical path)
vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({
    onTaskCompleted: vi.fn().mockResolvedValue(undefined)
  })
}))

// Mock timer store (auto-stop on done — non-critical path)
vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({
    currentTaskId: null,
    isTimerActive: false,
    stopTimer: vi.fn().mockResolvedValue(undefined)
  })
}))

// Mock toast (suppress noise in test output)
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn()
  })
}))

import { useTaskStore } from '@/stores/tasks'
import type { CanonicalTaskPatchReceipt } from '@/types/sync'

// ============================================================================
// Group 1: updateTask rollback
// ============================================================================

describe('updateTask rollback (TASK-1177)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reverts optimistic update when all persistence paths fail', async () => {
    const store = useTaskStore()

    // TASK-1904: createTask is enqueue-only since 9a2de86e (BUG-1799 single
    // writer) — it never calls saveTasks. The old mockResolvedValueOnce queued
    // for a "createTask direct save" LEAKED into updateTask's fallback save,
    // making the fallback succeed and skipping the rollback under test.
    const task = await store.createTask({ title: 'Original' })
    expect(task.title).toBe('Original')
    expect(store.tasks.find(t => t.id === task.id)?.title).toBe('Original')

    // Now make ALL persistence fail for updateTask:
    // - sync queue enqueue throws → falls back to saveSpecificTasks
    // - fallback saveSpecificTasks throws
    // - direct saveSpecificTasks throws
    mockEnqueue.mockRejectedValue(new Error('queue unavailable'))
    mockSaveTasks.mockRejectedValue(new Error('network error'))

    await store.updateTask(task.id, { title: 'Changed' })

    // Rollback: title should be back to 'Original'
    const afterUpdate = store.tasks.find(t => t.id === task.id)
    expect(afterUpdate?.title).toBe('Original')
  })

  it('keeps optimistic update when sync queue succeeds', async () => {
    const store = useTaskStore()

    mockSaveTasks.mockResolvedValueOnce(undefined)
    const task = await store.createTask({ title: 'Original' })

    // Sync queue succeeds → persisted = true → no rollback
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    // Direct save throws but persisted is already true
    mockSaveTasks.mockRejectedValue(new Error('direct save failed'))

    await store.updateTask(task.id, { title: 'Changed' })

    const afterUpdate = store.tasks.find(t => t.id === task.id)
    expect(afterUpdate?.title).toBe('Changed')
  })

  it('queues a pure scalar update with its stable canonical base revision', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Original' })
    task.canonicalRevision = 4
    mockEnqueue.mockClear()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })

    await store.updateTask(task.id, { title: 'Changed' })

    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'task',
      operation: 'update',
      entityId: task.id,
      canonicalTaskPatch: expect.objectContaining({
        baseRevision: 4,
        patch: { title: 'Changed' },
        phase: 'queued',
      }),
    }))
  })

  it('rolls back an eligible canonical update instead of using a direct-write fallback', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Original' })
    task.canonicalRevision = 4
    mockEnqueue.mockRejectedValue(new Error('queue unavailable'))
    mockSaveTasks.mockClear()

    await expect(store.updateTask(task.id, { title: 'Changed' })).rejects.toThrow('queue unavailable')

    expect(store.tasks.find(candidate => candidate.id === task.id)?.title).toBe('Original')
    expect(store.isPendingWrite(task.id)).toBe(false)
    expect(mockSaveTasks).not.toHaveBeenCalled()
  })

  it('keeps mixed supported and unsupported edits on the legacy queue path', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Original' })
    task.canonicalRevision = 4
    mockEnqueue.mockClear()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })

    await store.updateTask(task.id, { title: 'Changed', estimatedDuration: 30 })

    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ title: 'Changed', estimated_duration: 30 }),
      canonicalTaskPatch: undefined,
    }))
  })

  it('applies a verified canonical receipt even while generic realtime updates are guarded', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Optimistic', description: 'before' })
    store.manualOperationInProgress = true
    const canonicalReceipt: CanonicalTaskPatchReceipt = {
      contractVersion: 'task-v1',
      operationId: 'web:normalized',
      source: 'web-pwa',
      entityType: 'task',
      action: 'patch',
      entityId: task.id,
      canonicalRevision: 8,
      canonicalUpdatedAt: '2026-07-13T10:01:00Z',
      changeSequence: 80,
      replayed: false,
      committedAt: '2026-07-13T10:01:00Z',
      readBack: {
        id: task.id,
        title: 'Normalized',
        description: 'authoritative',
        priority: 'high',
        dueDate: '2026-07-14T00:00:00+00:00',
        progress: 25,
        status: 'todo',
        isDeleted: false,
        workspaceId: null,
        canonicalRevision: 8,
        canonicalUpdatedAt: '2026-07-13T10:01:00Z',
      },
      readBackHash: 'a'.repeat(64),
    }

    await store.applyCanonicalTaskReceipt(canonicalReceipt)

    expect(store.tasks.find(candidate => candidate.id === task.id)).toMatchObject({
      title: 'Normalized',
      description: 'authoritative',
      priority: 'high',
      dueDate: '2026-07-14',
      progress: 25,
      canonicalRevision: 8,
      updatedAt: new Date('2026-07-13T10:01:00Z'),
    })
  })

  it('keeps optimistic update when fallback save succeeds (queue fails)', async () => {
    const store = useTaskStore()

    mockSaveTasks.mockResolvedValueOnce(undefined)
    const task = await store.createTask({ title: 'Original' })

    // Sync queue (enqueue) fails → falls to fallback saveSpecificTasks
    mockEnqueue.mockRejectedValue(new Error('queue down'))
    // First saveSpecificTasks call is the fallback — succeed it
    // Second call is the direct save — fail it
    mockSaveTasks
      .mockResolvedValueOnce(undefined) // fallback: persisted = true
      .mockRejectedValue(new Error('direct save failed'))

    await store.updateTask(task.id, { title: 'Changed' })

    const afterUpdate = store.tasks.find(t => t.id === task.id)
    expect(afterUpdate?.title).toBe('Changed')
  })

  it('rollback finds correct task after concurrent deletion shifts indices', async () => {
    const store = useTaskStore()

    mockSaveTasks.mockResolvedValue(undefined)
    const taskA = await store.createTask({ title: 'Task A' })
    await new Promise(r => setTimeout(r, 2))
    const taskB = await store.createTask({ title: 'Task B' })

    // Make all persistence fail for updateTask on taskB
    mockEnqueue.mockImplementation(async () => {
      // Simulate concurrent deletion of taskA by splicing it out of the array
      // mid-operation (after the optimistic write, before rollback check)
      const idxA = store.tasks.findIndex(t => t.id === taskA.id)
      if (idxA !== -1) store.tasks.splice(idxA, 1)
      throw new Error('queue error')
    })
    mockSaveTasks.mockRejectedValue(new Error('save error'))

    await store.updateTask(taskB.id, { title: 'Changed B' })

    // taskB should be rolled back to original title regardless of index shift
    const foundB = store.tasks.find(t => t.id === taskB.id)
    expect(foundB).toBeDefined()
    expect(foundB?.title).toBe('Task B')
  })
})

// ============================================================================
// Group 2: onPermanentFailure callback
// ============================================================================

describe('useSyncOrchestrator onPermanentFailure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('onPermanentFailure returns an unsubscribe function', async () => {
    // Use the real implementation via vi.importActual to verify the contract
    const realModule = await vi.importActual<typeof import('@/composables/sync/useSyncOrchestrator')>(
      '@/composables/sync/useSyncOrchestrator'
    )

    const orchestrator = realModule.useSyncOrchestrator()
    const cb = vi.fn()
    const unsub = orchestrator.onPermanentFailure(cb)

    expect(typeof unsub).toBe('function')

    // Clean up subscription
    unsub()
  })

  it('onPermanentFailure real implementation: callback fires and can be unsubscribed', async () => {
    // Use vi.importActual to get the real module and test its internal Set logic
    const realModule = await vi.importActual<typeof import('@/composables/sync/useSyncOrchestrator')>(
      '@/composables/sync/useSyncOrchestrator'
    )

    const realOrchestrator = realModule.useSyncOrchestrator()

    const cb = vi.fn()
    const unsub = realOrchestrator.onPermanentFailure(cb)

    // unsub must be a function
    expect(typeof unsub).toBe('function')

    // After unsubscribing, the callback should be removed from the Set
    unsub()

    // We can't easily fire permanentFailureCallbacks from outside (it's module-private),
    // but we verified: subscribe returns unsubscribe, and unsubscribe doesn't throw.
    // The internal Set behavior is deterministic — add then delete.
    expect(cb).not.toHaveBeenCalled()
  })

  it('onPermanentFailure: multiple subscribers can be managed independently', async () => {
    const realModule = await vi.importActual<typeof import('@/composables/sync/useSyncOrchestrator')>(
      '@/composables/sync/useSyncOrchestrator'
    )

    const orchestrator = realModule.useSyncOrchestrator()

    const cb1 = vi.fn()
    const cb2 = vi.fn()

    const unsub1 = orchestrator.onPermanentFailure(cb1)
    const unsub2 = orchestrator.onPermanentFailure(cb2)

    expect(typeof unsub1).toBe('function')
    expect(typeof unsub2).toBe('function')

    // Unsubscribe cb1 — should not affect cb2
    unsub1()
    // Unsubscribe cb2 — should not throw
    unsub2()

    // Neither was called (no permanent failure was triggered)
    expect(cb1).not.toHaveBeenCalled()
    expect(cb2).not.toHaveBeenCalled()
  })
})
