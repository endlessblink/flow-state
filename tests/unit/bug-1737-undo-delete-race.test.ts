/**
 * BUG-1737: Undo/Delete Race Condition Tests
 *
 * Verifies three fixes:
 * 1. deleteOperationsByType skips 'syncing' (in-flight) operations
 * 2. deleteOperationsByType deletes 'pending' operations
 * 3. deleteTask does NOT call deleteTaskFromStorage directly (single-write path)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// ============================================================================
// writeQueueDB tests must run before store tests (no mocking of IndexedDB here)
// ============================================================================

import {
  enqueueOperation,
  deleteOperationsByType,
  getOperationsForEntity,
  updateOperation,
  clearAll
} from '@/services/offline/writeQueueDB'

describe('BUG-1737 — deleteOperationsByType: skips syncing operations', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('does NOT delete in-flight (syncing) operations and returns 0', async () => {
    const op = await enqueueOperation({
      operation: 'delete',
      entityType: 'task',
      entityId: 'task-abc-123',
      payload: {},
      userId: 'user-1'
    })
    // Simulate: sync has started, operation is now in-flight
    await updateOperation(op.id!, { status: 'syncing' })

    const deleted = await deleteOperationsByType('task', 'task-abc-123', 'delete')

    expect(deleted).toBe(0)
    const remaining = await getOperationsForEntity('task', 'task-abc-123')
    expect(remaining).toHaveLength(1)
    expect(remaining[0].status).toBe('syncing')
  })
})

describe('BUG-1737 — deleteOperationsByType: deletes pending operations', () => {
  beforeEach(async () => {
    await clearAll()
  })

  it('deletes pending delete operations and returns count', async () => {
    await enqueueOperation({
      operation: 'delete',
      entityType: 'task',
      entityId: 'task-def-456',
      payload: {},
      userId: 'user-1'
    })

    const deleted = await deleteOperationsByType('task', 'task-def-456', 'delete')

    expect(deleted).toBe(1)
    const remaining = await getOperationsForEntity('task', 'task-def-456')
    expect(remaining).toHaveLength(0)
  })

  it('leaves non-matching operation types untouched', async () => {
    await enqueueOperation({
      operation: 'create',
      entityType: 'task',
      entityId: 'task-ghi-789',
      payload: { title: 'Restored' },
      userId: 'user-1'
    })

    const deleted = await deleteOperationsByType('task', 'task-ghi-789', 'delete')

    expect(deleted).toBe(0)
    const remaining = await getOperationsForEntity('task', 'task-ghi-789')
    expect(remaining).toHaveLength(1)
  })
})

// ============================================================================
// Task store test: deleteTask must NOT call deleteTaskFromStorage directly
// ============================================================================

const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: 'pending' })

vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue: mockEnqueue,
    onPermanentFailure: vi.fn(),
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

const mockDeleteTask = vi.fn().mockResolvedValue(undefined)
const mockSaveTasks = vi.fn().mockResolvedValue(undefined)

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: mockSaveTasks,
    saveTasks: mockSaveTasks,
    deleteTask: mockDeleteTask,
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null),
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveProjects: vi.fn().mockResolvedValue(undefined),
    fetchProjects: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/services/auth/supabase', () => ({ supabase: null }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { id: '00000000-0000-0000-0000-000000000001' }, isAuthenticated: true })
}))
vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({ onTaskCompleted: vi.fn().mockResolvedValue(undefined) })
}))
vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({ currentTaskId: null, isTimerActive: false, stopTimer: vi.fn().mockResolvedValue(undefined) })
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('@/services/offline/readCacheDB', () => ({
  cacheTasks: vi.fn().mockResolvedValue(undefined),
  cacheProjects: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('@/utils/demoContentGuard', () => ({ guardTaskCreation: vi.fn() }))
vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({ activeWorkspaceId: null })
}))

import { setActivePinia, createPinia } from 'pinia'
import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem } from '@/composables/undoSingleton'

const deferred = <T = void>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('BUG-1737 — deleteTask: single-write path (no direct Supabase delete)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockDeleteTask.mockResolvedValue(undefined)
    mockSaveTasks.mockResolvedValue(undefined)
  })

  it('deleteTask does NOT call deleteTaskFromStorage directly', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Race Condition Task' })

    await store.deleteTask(task.id)

    expect(mockDeleteTask).not.toHaveBeenCalled()
  })

  it('deleteTaskWithUndo commits delete undo before slow persistence finishes', async () => {
    const store = useTaskStore()
    const undo = getUndoSystem()
    const task = await undo.createTaskWithUndo({ title: 'Fast Undo Race Task' })
    const slowDeleteSave = deferred()

    mockSaveTasks.mockImplementation((_payload: unknown, context?: string) => {
      if (context === 'deleteTask') return slowDeleteSave.promise
      return Promise.resolve(undefined)
    })

    const deletePromise = undo.deleteTaskWithUndo(task.id)

    await vi.waitFor(() => {
      expect(store.rawTasks.some(t => t.id === task.id)).toBe(false)
    })

    await undo.undo()

    expect(store.rawTasks.some(t => t.id === task.id)).toBe(true)
    slowDeleteSave.resolve()
    await deletePromise
  })

  it('restores immediately across repeated fast delete undo cycles', async () => {
    const store = useTaskStore()
    const undo = getUndoSystem()
    const task = await undo.createTaskWithUndo({ title: 'Repeated Fast Undo Task' })

    for (let cycle = 0; cycle < 3; cycle++) {
      const slowDeleteSave = deferred()
      mockSaveTasks.mockImplementation((_payload: unknown, context?: string) => {
        if (context === 'deleteTask') return slowDeleteSave.promise
        return Promise.resolve(undefined)
      })

      const deletePromise = undo.deleteTaskWithUndo(task.id)

      await vi.waitFor(() => {
        expect(store.rawTasks.some(t => t.id === task.id)).toBe(false)
      })

      await undo.undo()

      expect(store.rawTasks.some(t => t.id === task.id)).toBe(true)
      expect(store.rawTasks.find(t => t.id === task.id)?.title).toBe('Repeated Fast Undo Task')

      slowDeleteSave.resolve()
      await deletePromise
    }
  })
})
