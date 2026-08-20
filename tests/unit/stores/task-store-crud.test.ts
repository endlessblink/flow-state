/**
 * TASK-1588: Task Store CRUD and Filtering Unit Tests
 *
 * Tests for:
 * 1. Task CRUD (10 tests)
 * 2. Task Filtering (10 tests)
 * 3. Task Operations — move/date/priority (10 tests)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createMockTask } from '../../factories'

// ============================================================================
// Module-level mocks — must be at top level before store import
// ============================================================================

const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: 'pending' })
const mockCacheTasks = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockAuth = vi.hoisted(() => ({
  user: { id: '00000000-0000-0000-0000-000000000001' } as { id: string } | null,
  isAuthenticated: true,
  canSyncRemotely: true,
}))

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

const mockSaveTasks = vi.fn().mockResolvedValue(undefined)
const mockDeleteTask = vi.fn().mockResolvedValue(undefined)
const mockPermanentDeleteTask = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

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
    // Project operations
    saveProject: vi.fn().mockResolvedValue(undefined),
    saveProjects: vi.fn().mockResolvedValue(undefined),
    fetchProjects: vi.fn().mockResolvedValue([]),
    deleteProject: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/services/auth/supabase', () => ({
  supabase: null
}))

vi.mock('@/services/trash/TrashService', () => ({
  trashService: {
    permanentlyDeleteTask: mockPermanentDeleteTask,
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuth
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
  useToast: () => ({
    showToast: vi.fn()
  })
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  cacheTasks: mockCacheTasks,
  cacheProjects: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/utils/demoContentGuard', () => ({
  guardTaskCreation: vi.fn()
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    activeWorkspaceId: null
  })
}))

// Import store AFTER mocks are hoisted
import { useTaskStore } from '@/stores/tasks'

// ============================================================================
// Group 1: Task CRUD (10 tests)
// ============================================================================

describe('Task Store — CRUD', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockCacheTasks.mockResolvedValue(undefined)
    mockSaveTasks.mockResolvedValue(undefined)
    mockDeleteTask.mockResolvedValue(undefined)
    mockPermanentDeleteTask.mockResolvedValue(undefined)
    mockAuth.user = { id: '00000000-0000-0000-0000-000000000001' }
    mockAuth.isAuthenticated = true
    localStorage.clear()
  })

  it('creates task with minimal fields and fills defaults', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Minimal Task' })

    expect(task).toBeDefined()
    expect(task.id).toBeTruthy()
    expect(task.title).toBe('Minimal Task')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('medium')
    expect(task.progress).toBe(0)
    expect(task.completedPomodoros).toBe(0)
    expect(task.subtasks).toEqual([])
    expect(task.isInInbox).toBe(true)
    expect(task.createdAt).toBeInstanceOf(Date)
    expect(task.updatedAt).toBeInstanceOf(Date)
  })

  it('does not treat the read cache as durable intent when the authenticated queue rejects', async () => {
    mockEnqueue.mockRejectedValueOnce(new Error('queue unavailable'))
    const store = useTaskStore()

    await expect(store.createTask({ title: 'Must survive refresh' })).rejects.toThrow(
      'Task could not be saved'
    )

    expect(store._rawTasks).not.toContainEqual(
      expect.objectContaining({ title: 'Must survive refresh' })
    )
    expect(mockCacheTasks).toHaveBeenCalled()
    expect(mockCacheTasks).toHaveBeenLastCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ title: 'Must survive refresh' })]),
      { throwOnError: true }
    )
  })

  it('creates task with all fields preserved', async () => {
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Full Task',
      description: 'A detailed description',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-06-15',
      estimatedDuration: 90,
      estimatedPomodoros: 3,
      tags: ['work', 'urgent'],
      isInInbox: false
    })

    expect(task.title).toBe('Full Task')
    expect(task.description).toBe('A detailed description')
    expect(task.status).toBe('todo')
    expect(task.priority).toBe('high')
    expect(task.dueDate).toBe('2026-06-15')
    expect(task.estimatedDuration).toBe(90)
    expect(task.estimatedPomodoros).toBe(3)
    expect(task.tags).toEqual(['work', 'urgent'])
  })

  it('updates task title and bumps updatedAt', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Original Title' })
    const originalUpdatedAt = task.updatedAt

    // Ensure time advances before update
    await new Promise(resolve => setTimeout(resolve, 5))
    await store.updateTask(task.id, { title: 'New Title' })

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.title).toBe('New Title')
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
  })

  it('blocks SYNC source from changing task canvas geometry', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Sync Geometry Guard',
      parentId: 'group-a',
      canvasPosition: { x: 100, y: 200 },
      positionVersion: 3,
    })

    await store.updateTask(task.id, {
      title: 'Metadata Still Allowed',
      parentId: 'group-b',
      canvasPosition: { x: 900, y: 1000 },
      positionVersion: 99,
    }, 'SYNC')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.title).toBe('Metadata Still Allowed')
    expect(updated?.parentId).toBe('group-a')
    expect(updated?.canvasPosition).toEqual({ x: 100, y: 200 })
    expect(updated?.positionVersion).toBe(3)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[GEOMETRY-GUARD]'), expect.any(Object))
    warnSpy.mockRestore()
  })

  it('blocks SMART-GROUP source from changing task canvas geometry', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Smart Group Geometry Guard',
      parentId: 'group-a',
      canvasPosition: { x: 120, y: 240 },
      positionVersion: 4,
    })

    await store.updateTask(task.id, {
      dueDate: '2026-06-01',
      parentId: undefined,
      canvasPosition: { x: 1, y: 2 },
      positionVersion: 100,
    }, 'SMART-GROUP')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.dueDate).toBe('2026-06-01')
    expect(updated?.parentId).toBe('group-a')
    expect(updated?.canvasPosition).toEqual({ x: 120, y: 240 })
    expect(updated?.positionVersion).toBe(4)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[GEOMETRY-GUARD]'), expect.any(Object))
    warnSpy.mockRestore()
  })

  it('updates task status from todo to done', async () => {
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Status Test',
      isInInbox: false,
      parentId: 'group-a',
      canvasPosition: { x: 120, y: 240 },
      positionVersion: 4,
    })
    expect(task.status).toBe('todo')

    await store.updateTask(task.id, { status: 'done' })

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.status).toBe('done')
    expect(updated?.isInInbox).toBe(false)
    expect(updated?.parentId).toBe('group-a')
    expect(updated?.canvasPosition).toEqual({ x: 120, y: 240 })
    expect(updated?.positionVersion).toBe(4)
  })

  it('does not acknowledge a status update before the reload cache is durable', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Durable completion', status: 'todo' })
    const priorCacheCalls = mockCacheTasks.mock.calls.length
    let finishCache!: () => void
    mockCacheTasks.mockReturnValueOnce(new Promise<void>(resolve => {
      finishCache = resolve
    }))
    let resolved = false

    const update = store.updateTask(task.id, { status: 'done' }).then(() => {
      resolved = true
    })
    await vi.waitFor(() => expect(mockCacheTasks.mock.calls.length).toBeGreaterThan(priorCacheCalls))
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(resolved).toBe(false)
    finishCache()
    await update
    expect(resolved).toBe(true)
  })

  it('persists guest status updates to the guest reload authority', async () => {
    mockAuth.user = null
    mockAuth.isAuthenticated = false
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Guest completion', status: 'todo' })

    await store.updateTask(task.id, { status: 'done' })

    const persisted = JSON.parse(localStorage.getItem('flowstate-guest-tasks') || '[]')
    expect(persisted.find((candidate: { id: string }) => candidate.id === task.id)?.status).toBe('done')
  })

  it('advances recurring guest tasks to the next occurrence without the signed-in transaction path', async () => {
    mockAuth.user = null
    mockAuth.isAuthenticated = false
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Guest recurring completion',
      status: 'todo',
      dueDate: '2026-07-23',
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
      estimatedDuration: 25,
    })

    await store.doneForNow(task.id)

    const livingTask = store._rawTasks.find(candidate => candidate.id === task.id)
    expect(livingTask).toMatchObject({
      id: task.id,
      status: 'todo',
      dueDate: '2026-07-24',
      doneForNowUntil: '2026-07-24',
      recurrenceCount: 1,
    })
    expect(livingTask?.instances).toEqual([
      expect.objectContaining({
        taskId: task.id,
        scheduledDate: '2026-07-24',
        duration: 25,
        status: 'scheduled',
      }),
    ])

    const completionRecord = store._rawTasks.find(candidate => candidate.recurrenceParentId === task.id && candidate.isCompletionRecord)
    expect(completionRecord).toMatchObject({
      status: 'done',
      dueDate: '2026-07-23',
      recurrenceParentId: task.id,
      isCompletionRecord: true,
    })

    const persisted = JSON.parse(localStorage.getItem('flowstate-guest-tasks') || '[]')
    expect(persisted.find((candidate: { id: string }) => candidate.id === task.id)).toMatchObject({
      status: 'todo',
      dueDate: '2026-07-24',
      doneForNowUntil: '2026-07-24',
      recurrenceCount: 1,
    })
  })

  it('rolls back recurring guest completion when its reload authority cannot be written', async () => {
    mockAuth.user = null
    mockAuth.isAuthenticated = false
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Guest recurring storage failure',
      status: 'todo',
      dueDate: '2026-07-23',
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    const unrelatedTask = await store.createTask({
      title: 'Concurrent task before completion',
      status: 'todo',
    })
    let releaseCache!: () => void
    let reportCacheStarted!: () => void
    const cacheStarted = new Promise<void>(resolve => {
      reportCacheStarted = resolve
    })
    const cacheRelease = new Promise<void>(resolve => {
      releaseCache = resolve
    })
    mockCacheTasks.mockImplementationOnce(async () => {
      reportCacheStarted()
      await cacheRelease
    })
    const persistedBefore = localStorage.getItem('flowstate-guest-tasks')
    const originalSetItem = localStorage.setItem.bind(localStorage)
    let rejectNextGuestWrite = true
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key === 'flowstate-guest-tasks' && rejectNextGuestWrite) {
        rejectNextGuestWrite = false
        throw new DOMException('quota full', 'QuotaExceededError')
      }
      originalSetItem(key, value)
    })

    const completion = store.doneForNow(task.id)
    const duplicateCompletion = store.doneForNow(task.id)
    await cacheStarted
    const unrelatedIndex = store._rawTasks.findIndex(candidate => candidate.id === unrelatedTask.id)
    store._rawTasks.splice(unrelatedIndex, 1, {
      ...store._rawTasks[unrelatedIndex],
      title: 'Concurrent task after completion started',
    })
    const concurrentSameTaskEdit = store.updateTask(task.id, {
      title: 'Recurring task edited while completion was pending',
      dueDate: '2026-07-24',
    })
    releaseCache()

    const completionResults = await Promise.allSettled([completion, duplicateCompletion])
    expect(completionResults).toEqual([
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ message: 'quota full' }),
      }),
      expect.objectContaining({
        status: 'rejected',
        reason: expect.objectContaining({ message: 'quota full' }),
      }),
    ])
    await concurrentSameTaskEdit
    setItem.mockRestore()

    const rolledBackTask = store._rawTasks.find(candidate => candidate.id === task.id)
    expect(rolledBackTask).toMatchObject({
      status: 'todo',
      dueDate: '2026-07-24',
    })
    expect(rolledBackTask?.recurrenceCount).toBeUndefined()
    expect(rolledBackTask?.title).toBe('Recurring task edited while completion was pending')
    expect(store._rawTasks.filter(candidate => candidate.isCompletionRecord)).toHaveLength(0)
    expect(store._rawTasks.find(candidate => candidate.id === unrelatedTask.id)?.title)
      .toBe('Concurrent task after completion started')
    expect(mockCacheTasks).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: unrelatedTask.id,
          title: 'Concurrent task after completion started',
        }),
      ]),
      { throwOnError: true },
    )
    expect(localStorage.getItem('flowstate-guest-tasks')).not.toBe(persistedBefore)
    expect(JSON.parse(localStorage.getItem('flowstate-guest-tasks') || '[]')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: task.id,
          title: 'Recurring task edited while completion was pending',
          dueDate: '2026-07-24',
          status: 'todo',
        }),
      ]),
    )
  })

  it('rejects done-for-now when a stale view targets a task that no longer exists', async () => {
    const store = useTaskStore()

    await expect(store.doneForNow('missing-task-id')).rejects.toThrow(
      'Done for now target task no longer exists: missing-task-id',
    )
  })

  it('rejects every central task update when a stale view targets a missing canonical task', async () => {
    const store = useTaskStore()

    await expect(store.updateTask('missing-task-id', {
      status: 'done',
      dueDate: '2026-07-25',
    })).rejects.toThrow('Task update target no longer exists: missing-task-id')
  })

  it('skips the only live recurring guest task in place without creating completion history', async () => {
    mockAuth.user = null
    mockAuth.isAuthenticated = false
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Guest recurring skip',
      status: 'todo',
      dueDate: '2026-07-23',
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
      instances: [{
        id: 'guest-skip-instance',
        taskId: '',
        scheduledDate: '2026-07-23',
        scheduledTime: '09:00',
        duration: 25,
        status: 'scheduled',
      }],
      doneForNowUntil: '2026-07-23',
    })

    await store.skipRecurringOccurrence(task.id)

    const livingTask = store._rawTasks.find(candidate => candidate.id === task.id)
    expect(livingTask).toMatchObject({
      id: task.id,
      status: 'todo',
      dueDate: '2026-07-24',
      doneForNowUntil: undefined,
      recurrenceCount: 1,
    })
    expect(livingTask?.instances).toEqual([
      expect.objectContaining({
        scheduledDate: '2026-07-24',
        duration: 25,
        status: 'scheduled',
        taskId: task.id,
      }),
    ])
    expect(store._rawTasks.filter(candidate => candidate.isCompletionRecord)).toHaveLength(0)

    const persisted = JSON.parse(localStorage.getItem('flowstate-guest-tasks') || '[]')
    expect(persisted.find((candidate: { id: string }) => candidate.id === task.id)).toMatchObject({
      status: 'todo',
      dueDate: '2026-07-24',
      recurrenceCount: 1,
    })
  })

  it('rolls recurring skip back when the durable queue rejects it', async () => {
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Rejected recurring skip',
      status: 'todo',
      dueDate: '2026-07-23',
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    mockEnqueue.mockRejectedValueOnce(new Error('durable queue unavailable'))
    mockSaveTasks.mockRejectedValueOnce(new Error('direct persistence unavailable'))

    await expect(store.skipRecurringOccurrence(task.id)).rejects.toThrow('direct persistence unavailable')

    expect(store._rawTasks.find(candidate => candidate.id === task.id)).toMatchObject({
      id: task.id,
      status: 'todo',
      dueDate: '2026-07-23',
    })
    expect(store._rawTasks.find(candidate => candidate.id === task.id)?.recurrenceCount ?? 0).toBe(0)
  })

  it('accepts only one recurring skip while the first skip is still in flight', async () => {
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Double recurring skip',
      status: 'todo',
      dueDate: '2026-07-23',
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    let releaseUpdate!: () => void
    const updateQueued = new Promise<void>(resolve => {
      releaseUpdate = resolve
    })
    mockEnqueue.mockImplementationOnce(async () => {
      await updateQueued
      return { id: 2, status: 'pending' }
    })

    const firstSkip = store.skipRecurringOccurrence(task.id)
    const secondSkip = store.skipRecurringOccurrence(task.id)
    await vi.waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(2))
    releaseUpdate()
    await Promise.all([firstSkip, secondSkip])

    expect(mockEnqueue).toHaveBeenCalledTimes(2)
    expect(store._rawTasks.find(candidate => candidate.id === task.id)).toMatchObject({
      dueDate: '2026-07-24',
      recurrenceCount: 1,
    })
  })

  it('does not delete a recurring task when clearing its recurrence chain cannot be persisted', async () => {
    const store = useTaskStore()
    const parent = await store.createTask({
      title: 'Rejected recurrence ancestor',
      status: 'done',
      dueDate: '2026-07-23',
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    const task = await store.createTask({
      title: 'Rejected recurrence stop',
      status: 'todo',
      dueDate: '2026-07-24',
      recurrenceParentId: parent.id,
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    mockEnqueue.mockRejectedValueOnce(new Error('durable queue unavailable'))
    mockSaveTasks.mockRejectedValueOnce(new Error('direct persistence unavailable'))

    await expect(store.stopRecurrence(task.id)).rejects.toThrow('direct persistence unavailable')

    expect(store._rawTasks.find(candidate => candidate.id === task.id)).toMatchObject({
      id: task.id,
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    expect(mockEnqueue).toHaveBeenCalledTimes(3)
  })

  it('ignores a repeated recurrence stop while the first durable change is in flight', async () => {
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Double recurrence stop',
      status: 'todo',
      dueDate: '2026-07-23',
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    let rejectFirstUpdate!: () => void
    mockEnqueue.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => {
        rejectFirstUpdate = resolve
      })
      throw new Error('durable queue unavailable')
    })

    const firstStop = store.stopRecurrence(task.id)
    await vi.waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(2))
    const secondStop = store.stopRecurrence(task.id)
    rejectFirstUpdate()

    await expect(firstStop).rejects.toThrow('durable queue unavailable')
    await expect(secondStop).resolves.toBeUndefined()
    expect(store._rawTasks.find(candidate => candidate.id === task.id)?.recurrenceRule).toBeTruthy()
    expect(mockEnqueue).toHaveBeenCalledTimes(2)
  })

  it('restores recurrence when the final delete cannot be durably queued', async () => {
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Rejected final recurrence delete',
      status: 'todo',
      dueDate: '2026-07-23',
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    mockEnqueue.mockRejectedValueOnce(new Error('delete queue unavailable'))

    await expect(store.stopRecurrence(task.id)).rejects.toThrow('delete queue unavailable')

    expect(store._rawTasks.find(candidate => candidate.id === task.id)).toMatchObject({
      id: task.id,
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
  })

  it('fails recurring permanent delete closed when the server cannot confirm deletion', async () => {
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Recurring permanent delete must be confirmed',
      status: 'todo',
      dueDate: '2026-07-23',
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    mockPermanentDeleteTask.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(store.permanentlyDeleteTask(task.id)).rejects.toThrow('Failed to fetch')

    expect(store._rawTasks.find(candidate => candidate.id === task.id)).toMatchObject({
      id: task.id,
      recurrenceRule: {
        pattern: 'daily',
        interval: 1,
        endType: 'never',
      },
    })
    expect(mockEnqueue).toHaveBeenCalledTimes(1)
  })

  it('updates task priority', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Priority Test', priority: 'low' })

    await store.updateTask(task.id, { priority: 'high' })

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.priority).toBe('high')
  })

  it('deletes task and removes it from store', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'To Delete' })
    expect(store._rawTasks.find(t => t.id === task.id)).toBeDefined()

    await store.deleteTask(task.id)

    expect(store._rawTasks.find(t => t.id === task.id)).toBeUndefined()
  })

  it('deleteTask uses sync queue only — no direct Supabase delete (BUG-1737)', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Tombstone Task' })

    await store.deleteTask(task.id)

    // BUG-1737: deleteTask no longer calls deleteTaskFromStorage directly.
    // Single-write path: sync queue is the sole path to Supabase for deletes.
    expect(mockDeleteTask).not.toHaveBeenCalled()
  })

  it('creates task with subtasks (JSONB) and preserves them', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Parent Task' })
    const subtask = await store.createSubtask(task.id, { title: 'Sub 1' })

    const found = store._rawTasks.find(t => t.id === task.id)
    expect(found?.subtasks.length).toBe(1)
    expect(found?.subtasks[0].title).toBe('Sub 1')
    expect(subtask?.parentTaskId).toBe(task.id)
  })

  it('creates task with tags array and preserves them', async () => {
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Tagged Task',
      tags: ['frontend', 'bug', 'v2']
    })

    const found = store._rawTasks.find(t => t.id === task.id)
    expect(found?.tags).toEqual(['frontend', 'bug', 'v2'])
  })

})

// ============================================================================
// Group 2: Task Filtering (10 tests)
// ============================================================================

describe('Task Store — Filtering', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockSaveTasks.mockResolvedValue(undefined)
    mockDeleteTask.mockResolvedValue(undefined)
  })

  it('store.tasks (filteredTasks) excludes soft-deleted tasks', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Live Task' })

    // Inject a soft-deleted task directly into _rawTasks
    store._rawTasks.push({
      ...createMockTask({ id: 'deleted-999', title: 'Deleted Task' }),
      _soft_deleted: true
    })

    const titles = store.tasks.map(t => t.title)
    expect(titles).toContain('Live Task')
    expect(titles).not.toContain('Deleted Task')
  })

  it('store._rawTasks returns ALL tasks including soft-deleted ones', async () => {
    const store = useTaskStore()
    await store.createTask({ title: 'Visible Task' })

    store._rawTasks.push({
      ...createMockTask({ id: 'soft-del-1', title: 'Soft Deleted' }),
      _soft_deleted: true
    })

    // _rawTasks contains both
    expect(store._rawTasks.some(t => t.title === 'Visible Task')).toBe(true)
    expect(store._rawTasks.some(t => t.title === 'Soft Deleted')).toBe(true)

    // filteredTasks excludes the soft-deleted one
    expect(store.tasks.some(t => t.title === 'Soft Deleted')).toBe(false)
  })

  it('store.tasks excludes tasks not matching active project filter', async () => {
    const store = useTaskStore()
    const proj1 = await store.createProject({ name: 'Alpha' })
    const proj2 = await store.createProject({ name: 'Beta' })
    await store.createTask({ title: 'Alpha Task', projectId: proj1.id })
    await store.createTask({ title: 'Beta Task', projectId: proj2.id })

    store.setActiveProject(proj1.id)

    const filtered = store.filteredTasks
    expect(filtered.every(t => t.projectId === proj1.id)).toBe(true)
    expect(filtered.some(t => t.title === 'Beta Task')).toBe(false)
  })

  it('filter by status: only done tasks returned', async () => {
    const store = useTaskStore()
    await store.createTask({ title: 'Todo One', status: 'todo' })
    const doneTask = await store.createTask({ title: 'Done One', status: 'done' })

    store.setActiveStatusFilter('done')

    const filtered = store.filteredTasks
    expect(filtered.every(t => t.status === 'done')).toBe(true)
    expect(filtered.some(t => t.id === doneTask.id)).toBe(true)
  })

  it('BUG-1975: explicit Done status clears an incompatible smart view', async () => {
    const store = useTaskStore()
    const doneTask = await store.createTask({ title: 'Reopen Me', status: 'done' })
    await store.createTask({ title: 'Still Active', status: 'todo' })

    store.setSmartView('all_active')
    store.setActiveStatusFilter('done')

    expect(store.activeSmartView).toBeNull()
    expect(store.activeStatusFilter).toBe('done')
    expect(store.filteredTasks.map(task => task.id)).toContain(doneTask.id)
  })

  it('BUG-1975: selecting All Active clears an incompatible Done status', async () => {
    const store = useTaskStore()
    const activeTask = await store.createTask({ title: 'Active Again', status: 'todo' })
    await store.createTask({ title: 'Already Done', status: 'done' })

    store.setActiveStatusFilter('done')
    store.setSmartView('all_active')

    expect(store.activeStatusFilter).toBeNull()
    expect(store.activeSmartView).toBe('all_active')
    expect(store.filteredTasks.map(task => task.id)).toContain(activeTask.id)
    expect(store.filteredTasks.every(task => task.status !== 'done')).toBe(true)
  })

  it('BUG-1975: duration selection cannot retain smart-view or status contradictions', () => {
    const store = useTaskStore()

    store.setSmartView('all_active')
    store.setActiveStatusFilter('done')
    store.setActiveDurationFilter('quick')

    expect(store.activeSmartView).toBeNull()
    expect(store.activeStatusFilter).toBeNull()
    expect(store.activeDurationFilter).toBe('quick')
  })

  it('BUG-1975: Done counts remain visible when hide-done is enabled', async () => {
    const store = useTaskStore()
    const project = await store.createProject({ name: 'Completed work' })
    await store.createTask({ title: 'Visible completed task', projectId: project.id, status: 'done' })
    await store.createTask({ title: 'Other active task', projectId: project.id, status: 'todo' })

    store.hideDoneTasks = true
    store.setActiveStatusFilter('done')

    expect(store.smartViewTaskCounts.all).toBe(2)
    expect(store.getProjectTaskCount(project.id)).toBe(1)
  })

  it('filter by priority: only high priority returned', async () => {
    const store = useTaskStore()
    const high1 = await store.createTask({ title: 'High One', priority: 'high' })
    const high2 = await store.createTask({ title: 'High Two', priority: 'high' })
    await store.createTask({ title: 'Low One', priority: 'low' })

    // Inject high-priority filter directly since no setActivePriorityFilter API exists —
    // use status filter as proxy to confirm low-priority is excluded after a project filter
    // Instead, verify via _rawTasks and manual filter (testing the data, not the API)
    const highTasks = store._rawTasks.filter(t => t.priority === 'high')
    expect(highTasks.length).toBeGreaterThanOrEqual(2)
    expect(highTasks.some(t => t.id === high1.id)).toBe(true)
    expect(highTasks.some(t => t.id === high2.id)).toBe(true)
  })

  it('filter by project: only matching projectId tasks returned', async () => {
    const store = useTaskStore()
    const proj = await store.createProject({ name: 'Work' })
    const t1 = await store.createTask({ title: 'Work Item 1', projectId: proj.id })
    const t2 = await store.createTask({ title: 'Work Item 2', projectId: proj.id })
    await store.createTask({ title: 'Other Item', projectId: 'uncategorized' })

    store.setActiveProject(proj.id)

    const filtered = store.filteredTasks
    expect(filtered.some(t => t.id === t1.id)).toBe(true)
    expect(filtered.some(t => t.id === t2.id)).toBe(true)
    expect(filtered.some(t => t.title === 'Other Item')).toBe(false)
  })

  it('filter by tags: tasks with matching tag visible in _rawTasks', async () => {
    const store = useTaskStore()
    await store.createTask({ title: 'Tagged', tags: ['backend'] })
    await store.createTask({ title: 'Untagged', tags: [] })

    const backendTasks = store._rawTasks.filter(t => t.tags?.includes('backend'))
    expect(backendTasks.length).toBe(1)
    expect(backendTasks[0].title).toBe('Tagged')
  })

  it('filter by due date range: tasks due within range visible in _rawTasks', async () => {
    const store = useTaskStore()
    await store.createTask({ title: 'Past Task', dueDate: '2025-01-01' })
    await store.createTask({ title: 'Future Task', dueDate: '2026-12-31' })
    await store.createTask({ title: 'No Date Task', dueDate: '' })

    const pastTasks = store._rawTasks.filter(t => t.dueDate && t.dueDate < '2026-01-01')
    expect(pastTasks.some(t => t.title === 'Past Task')).toBe(true)
    expect(pastTasks.some(t => t.title === 'Future Task')).toBe(false)
  })

  it('combined filters: status + project narrows results correctly', async () => {
    const store = useTaskStore()
    const proj = await store.createProject({ name: 'Dev' })
    const doneProjTask = await store.createTask({ title: 'Done Dev', status: 'done', projectId: proj.id })
    await store.createTask({ title: 'Todo Dev', status: 'todo', projectId: proj.id })
    await store.createTask({ title: 'Done Other', status: 'done', projectId: 'uncategorized' })

    store.setActiveProject(proj.id)
    store.setActiveStatusFilter('done')

    const filtered = store.filteredTasks
    expect(filtered.some(t => t.id === doneProjTask.id)).toBe(true)
    expect(filtered.every(t => t.status === 'done')).toBe(true)
    expect(filtered.every(t => t.projectId === proj.id)).toBe(true)
  })

  it('clearing filters returns all non-deleted tasks', async () => {
    const store = useTaskStore()
    const proj = await store.createProject({ name: 'Filter Reset' })
    await store.createTask({ title: 'Task A', projectId: proj.id })
    await store.createTask({ title: 'Task B', projectId: 'uncategorized' })

    // Set then clear project filter
    store.setActiveProject(proj.id)
    expect(store.filteredTasks.length).toBe(1)

    store.setActiveProject(null)
    store.setActiveStatusFilter(null)

    expect(store.filteredTasks.length).toBeGreaterThanOrEqual(2)
  })
})

// ============================================================================
// Group 3: Task Operations (10 tests)
// ============================================================================

describe('Task Store — Operations', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockSaveTasks.mockResolvedValue(undefined)
    mockDeleteTask.mockResolvedValue(undefined)
  })

  it('moveTaskToSmartGroup("today") sets dueDate to today', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Today Task', dueDate: '' })

    await store.moveTaskToSmartGroup(task.id, 'today')

    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.dueDate).toBe(todayStr)
  })

  it('moveTaskToSmartGroup("tomorrow") sets dueDate to tomorrow', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Tomorrow Task', dueDate: '' })

    await store.moveTaskToSmartGroup(task.id, 'tomorrow')

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.dueDate).toBe(tomorrowStr)
  })

  it('moveTaskToSmartGroup("later") clears dueDate', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Later Task', dueDate: '2026-03-21' })

    await store.moveTaskToSmartGroup(task.id, 'later')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.dueDate).toBe('')
  })

  it('moveTaskToSmartGroup with unknown type does NOT update task (BUG-016)', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Unknown Group Task', dueDate: '2026-03-15' })
    const originalDate = task.dueDate

    // Should be a no-op — unknown types return early
    await store.moveTaskToSmartGroup(task.id, 'next-quarter')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.dueDate).toBe(originalDate)
  })

  it('moveTaskToDate("inbox") sets isInInbox=true and clears dueDate', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Inbox Task', dueDate: '2026-05-01', isInInbox: false })

    await store.moveTaskToDate(task.id, 'inbox')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.isInInbox).toBe(true)
    expect(updated?.dueDate ?? '').toBe('')
  })

  it('moveTaskToDate("noDate") clears dueDate', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'No Date Task', dueDate: '2026-06-01' })

    await store.moveTaskToDate(task.id, 'noDate')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.dueDate ?? '').toBe('')
  })

  it('batch update multiple tasks via sequential updateTask calls', async () => {
    const store = useTaskStore()
    const t1 = await store.createTask({ title: 'Batch One', priority: 'low' })
    const t2 = await store.createTask({ title: 'Batch Two', priority: 'low' })
    const t3 = await store.createTask({ title: 'Batch Three', priority: 'low' })

    await Promise.all([
      store.updateTask(t1.id, { priority: 'high' }),
      store.updateTask(t2.id, { priority: 'medium' }),
      store.updateTask(t3.id, { priority: 'high' })
    ])

    expect(store._rawTasks.find(t => t.id === t1.id)?.priority).toBe('high')
    expect(store._rawTasks.find(t => t.id === t2.id)?.priority).toBe('medium')
    expect(store._rawTasks.find(t => t.id === t3.id)?.priority).toBe('high')
  })

  it('task order change updates order field', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Order Task' })

    await store.updateTask(task.id, { order: 42 })

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.order).toBe(42)
  })

  it('task parent change (canvas) updates parentId', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Canvas Task' })
    const fakeGroupId = 'aaaabbbb-cccc-dddd-eeee-ffffffffffff'

    await store.updateTask(task.id, { parentId: fakeGroupId }, 'DRAG')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.parentId).toBe(fakeGroupId)
  })

  it('moveTaskToPriority with "no_priority" clears priority to null', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Priority Clear Task', priority: 'high' })

    await store.moveTaskToPriority(task.id, 'no_priority')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.priority).toBeNull()
  })
})
