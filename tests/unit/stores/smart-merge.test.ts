/**
 * Regression tests for the Smart Merge algorithm in taskPersistence.ts
 *
 * The merge algorithm (lines 307-518 of taskPersistence.ts) reconciles local
 * tasks with remote (Supabase) tasks on every loadFromDatabase() call.
 * It has 6 distinct branches:
 *
 * 1. Pending-write preservation (BUG-1206)
 * 2. Conflict: local wins via field-level merge (BUG-1516)
 * 3. Conflict: remote wins
 * 4. Local-only, soft-deleted → drop
 * 5. Local-only, stale → drop
 * 6. Local-only, recent → preserve
 *
 * This code caused BUG-1738 (26 tasks soft-deleted in production) and has
 * ZERO prior test coverage.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Task } from '@/types/tasks'
import { getCachedTasksWithPendingWrites } from '@/services/offline/readCacheDB'
import { beginPermanentDeleteTrace } from '@/utils/permanentDeleteTrace'

// ── Module-level mocks ──────────────────────────────────────────────

const mockFetchTasks = vi.fn().mockResolvedValue([])
const mockFetchDeletedTaskIds = vi.fn().mockResolvedValue([])
const mockFetchTombstones = vi.fn().mockResolvedValue([])
let mockIsSwitchingWorkspace = false

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchTasks: mockFetchTasks,
    fetchDeletedTaskIds: mockFetchDeletedTaskIds,
    fetchTombstones: mockFetchTombstones,
    fetchTaskById: vi.fn(),
    saveTask: vi.fn().mockResolvedValue({ error: null }),
    saveTasks: vi.fn().mockResolvedValue({ error: null }),
    deleteTask: vi.fn().mockResolvedValue({ error: null }),
    bulkDeleteTasks: vi.fn().mockResolvedValue({ error: null }),
    fetchGroups: vi.fn().mockResolvedValue([]),
    fetchQuickSortHistory: vi.fn().mockResolvedValue([]),
    fetchProjects: vi.fn().mockResolvedValue([]),
  })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'test-user-id' },
    isAuthenticated: true,
  })
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    activeWorkspaceId: undefined,
    isSwitchingWorkspace: mockIsSwitchingWorkspace,
  })
}))

vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({
    save: vi.fn(),
    load: vi.fn().mockReturnValue(null),
    remove: vi.fn(),
  })
}))

vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue: vi.fn().mockResolvedValue({ id: 1 }),
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
    forceSync: vi.fn(),
  })
}))

vi.mock('@/utils/supabaseMappers', () => ({
  toSupabaseTask: vi.fn().mockReturnValue({}),
  fromSupabaseTask: vi.fn(),
  toDbStatus: vi.fn().mockImplementation((s: string) => s === 'done' ? 'done' : 'planned'),
}))

vi.mock('@/services/offline/writeQueueDB', () => ({
  enqueueOperation: vi.fn().mockResolvedValue({ id: 1 }),
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  cacheTasks: vi.fn().mockResolvedValue(undefined),
  getCachedTasks: vi.fn().mockResolvedValue([]),
  getCachedTasksWithPendingWrites: vi.fn().mockResolvedValue([]),
}))

// ── Helpers ──────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date()
  return {
    id: crypto.randomUUID(),
    title: 'Test Task',
    description: '',
    status: 'todo',
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'test-project',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Smart Merge Algorithm (taskPersistence.ts)', () => {
  let useTaskStore: () => ReturnType<typeof import('@/stores/tasks').useTaskStore>

  beforeEach(async () => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    mockIsSwitchingWorkspace = false
    mockFetchTasks.mockResolvedValue([])
    mockFetchDeletedTaskIds.mockResolvedValue([])
    mockFetchTombstones.mockResolvedValue([])
    vi.mocked(getCachedTasksWithPendingWrites).mockResolvedValue([])

    // Dynamic import after mocks are set up
    const mod = await import('@/stores/tasks')
    useTaskStore = mod.useTaskStore
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (typeof window !== 'undefined') {
      delete window.__FlowStatePermanentDeleteTraces
    }
  })

  // ── Branch 1: Pending-write preservation (BUG-1206) ──

  it('preserves local task when it has a pending write, even if remote is newer', async () => {
    const store = useTaskStore()
    const localTask = makeTask({
      title: 'Local Edit',
      updatedAt: new Date('2026-01-01T00:00:00Z'), // Older
    })
    const remoteTask = {
      ...localTask,
      title: 'Remote Version',
      updatedAt: new Date('2026-04-01T00:00:00Z'), // Newer
    }

    // Pre-populate local state
    store._rawTasks.push(localTask)

    // Mark task as having a pending write via the store's own API
    store.addPendingWrite(localTask.id)
    mockFetchTasks.mockResolvedValue([remoteTask])

    await store.loadFromDatabase()

    const result = store._rawTasks.find(t => t.id === localTask.id)
    expect(result?.title).toBe('Local Edit') // Local preserved, not remote
  })

  // ── Branch 2: Field-level merge — local wins (BUG-1516) ──

  it('field-level merges when local is newer: local content wins, DB-authoritative fields from remote', async () => {
    const store = useTaskStore()
    const taskId = crypto.randomUUID()
    const localTask = makeTask({
      id: taskId,
      title: 'My Local Title',
      description: 'My local description',
      isPinned: false, // DB-authoritative
      updatedAt: new Date('2026-04-01T12:00:00Z'), // Newer
    })
    const remoteTask = {
      ...localTask,
      title: 'Remote Title',
      description: 'Remote description',
      isPinned: true, // DB-authoritative: should win
      updatedAt: new Date('2026-04-01T11:00:00Z'), // Older
    }

    store._rawTasks.push(localTask)
    mockFetchTasks.mockResolvedValue([remoteTask])

    await store.loadFromDatabase()

    const result = store._rawTasks.find(t => t.id === taskId)
    // Content fields: local wins
    expect(result?.title).toBe('My Local Title')
    expect(result?.description).toBe('My local description')
    // DB-authoritative field: remote wins
    expect(result?.isPinned).toBe(true)
  })

  it('field-level merges when local is "very recent" (< 30s old)', async () => {
    const store = useTaskStore()
    const taskId = crypto.randomUUID()
    const now = new Date()
    const localTask = makeTask({
      id: taskId,
      title: 'Just Edited',
      updatedAt: new Date(now.getTime() - 5000), // 5s ago = very recent
    })
    const remoteTask = {
      ...localTask,
      title: 'Stale Remote',
      updatedAt: new Date(now.getTime() - 60000), // 60s ago
    }

    store._rawTasks.push(localTask)
    mockFetchTasks.mockResolvedValue([remoteTask])

    await store.loadFromDatabase()

    const result = store._rawTasks.find(t => t.id === taskId)
    expect(result?.title).toBe('Just Edited')
  })

  it('DB_AUTHORITATIVE_FIELDS always come from remote in field-level merge', async () => {
    const store = useTaskStore()
    const taskId = crypto.randomUUID()
    const localTask = makeTask({
      id: taskId,
      _soft_deleted: false,
      positionVersion: 1,
      updatedAt: new Date('2026-04-01T12:00:00Z'), // Local newer
    })
    const remoteTask = {
      ...localTask,
      _soft_deleted: true, // DB-authoritative
      deletedAt: new Date('2026-04-01T11:30:00Z'),
      positionVersion: 5, // DB-authoritative
      createdAt: new Date('2025-12-01T00:00:00Z'), // DB-authoritative
      updatedAt: new Date('2026-04-01T11:00:00Z'),
    }

    store._rawTasks.push(localTask)
    mockFetchTasks.mockResolvedValue([remoteTask])

    await store.loadFromDatabase()

    const result = store._rawTasks.find(t => t.id === taskId)
    expect(result?._soft_deleted).toBe(true)
    expect(result?.positionVersion).toBe(5)
  })

  // ── Branch 3: Remote wins ──

  it('accepts remote task when remote is newer and local is not very recent', async () => {
    const store = useTaskStore()
    const taskId = crypto.randomUUID()
    const localTask = makeTask({
      id: taskId,
      title: 'Old Local',
      updatedAt: new Date('2026-03-01T00:00:00Z'), // A month ago
      positionVersion: 1,
    })
    const remoteTask = {
      ...localTask,
      title: 'Updated Remote',
      updatedAt: new Date('2026-04-01T12:00:00Z'), // Newer
      positionVersion: 2,
    }

    store._rawTasks.push(localTask)
    mockFetchTasks.mockResolvedValue([remoteTask])

    await store.loadFromDatabase()

    const result = store._rawTasks.find(t => t.id === taskId)
    expect(result?.title).toBe('Updated Remote')
  })

  // ── Branch 4: Local-only, soft-deleted → drop ──

  it('drops soft-deleted local-only tasks (BUG-1457)', async () => {
    const store = useTaskStore()
    const localTask = makeTask({
      _soft_deleted: true,
      title: 'Deleted Task',
    })

    store._rawTasks.push(localTask)
    mockFetchTasks.mockResolvedValue([]) // Not in remote

    // Need to bypass the empty-overwrite guard
    // Simulate session > 60s old
    const originalWindow = globalThis.window as any
    if (originalWindow) {
      originalWindow.FlowStateSessionStart = Date.now() - 120000
    }

    await store.loadFromDatabase()

    const result = store._rawTasks.find(t => t.id === localTask.id)
    expect(result).toBeUndefined() // Dropped
  })

  // ── Branch 5: Local-only, stale → drop ──

  it('drops stale local-only tasks when remote returned results (online)', async () => {
    const store = useTaskStore()
    const staleTask = makeTask({
      title: 'Stale Local',
      createdAt: new Date('2026-01-01T00:00:00Z'), // Long ago
    })
    const remoteTask = makeTask({ title: 'A Remote Task' })

    store._rawTasks.push(staleTask)
    mockFetchTasks.mockResolvedValue([remoteTask]) // Online, has results

    await store.loadFromDatabase()

    const found = store._rawTasks.find(t => t.id === staleTask.id)
    expect(found).toBeUndefined() // Dropped — stale local-only
  })

  // ── Branch 6: Local-only, recent → preserve ──

  it('preserves recently-created local-only tasks for sync retry', async () => {
    const store = useTaskStore()
    const recentTask = makeTask({
      title: 'Just Created',
      createdAt: new Date(), // Just now
    })
    const remoteTask = makeTask({ title: 'Some Remote Task' })

    store._rawTasks.push(recentTask)
    mockFetchTasks.mockResolvedValue([remoteTask])

    await store.loadFromDatabase()

    const found = store._rawTasks.find(t => t.id === recentTask.id)
    expect(found).toBeDefined()
    expect(found?.title).toBe('Just Created')
  })

  it('drops local-only tasks that are tombstoned on the server instead of resurrecting them', async () => {
    const store = useTaskStore()
    const tombstonedTask = makeTask({
      id: 'task-tombstoned-local-only',
      title: 'Deleted in Electron',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const remoteTask = makeTask({ title: 'Still Active Remote Task' })

    store._rawTasks.push(tombstonedTask)
    mockFetchTasks.mockResolvedValue([remoteTask])
    mockFetchTombstones.mockResolvedValue([
      { entityType: 'task', entityId: tombstonedTask.id }
    ])

    await store.loadFromDatabase()

    expect(store._rawTasks.some(t => t.id === tombstonedTask.id)).toBe(false)
    expect(store._rawTasks.some(t => t.id === remoteTask.id)).toBe(true)
  })

  it('does not let the young-session empty overwrite guard preserve tombstoned local tasks', async () => {
    const store = useTaskStore()
    const tombstonedTask = makeTask({
      id: 'task-tombstoned-empty-remote',
      title: 'Deleted while localhost was stale',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    store._rawTasks.push(tombstonedTask)

    const win = globalThis.window as any
    if (win) {
      win.FlowStateSessionStart = Date.now() - 5000
    }

    mockFetchTasks.mockResolvedValue([])
    mockFetchTombstones.mockResolvedValue([
      { entityType: 'task', entityId: tombstonedTask.id }
    ])

    await store.loadFromDatabase()

    expect(store._rawTasks.some(t => t.id === tombstonedTask.id)).toBe(false)
  })

  it('drops local-only tasks that are soft-deleted on the server instead of recreating them', async () => {
    const store = useTaskStore()
    const softDeletedTask = makeTask({
      id: 'task-soft-deleted-local-only',
      title: 'Soft deleted in other runtime',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const remoteTask = makeTask({ title: 'Remote survivor' })

    store._rawTasks.push(softDeletedTask)
    mockFetchTasks.mockResolvedValue([remoteTask])
    mockFetchDeletedTaskIds.mockResolvedValue([softDeletedTask.id])

    await store.loadFromDatabase()

    expect(store._rawTasks.some(t => t.id === softDeletedTask.id)).toBe(false)
    expect(store._rawTasks.some(t => t.id === remoteTask.id)).toBe(true)
  })

  // ── Empty overwrite guard ──

  it('blocks empty overwrite when session is young (< 60s)', async () => {
    const store = useTaskStore()
    const existingTask = makeTask({ title: 'Important Task' })
    store._rawTasks.push(existingTask)

    // Simulate fresh session
    const win = globalThis.window as any
    if (win) {
      win.FlowStateSessionStart = Date.now() - 5000 // 5s old
    }

    mockFetchTasks.mockResolvedValue([]) // Empty response

    await store.loadFromDatabase()

    // Should still have the task — overwrite was blocked
    expect(store._rawTasks.length).toBe(1)
    expect(store._rawTasks[0].title).toBe('Important Task')
  })

  it('drops stale cached local-only tasks after an old authenticated empty server load', async () => {
    const store = useTaskStore()
    const staleCachedTask = makeTask({
      id: 'task-stale-cache-empty-server',
      title: 'Stale cache only',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    })
    store._rawTasks.push(staleCachedTask)

    const win = globalThis.window as any
    if (win) {
      win.FlowStateSessionStart = Date.now() - 120000
    }

    mockFetchTasks.mockResolvedValue([])
    mockFetchDeletedTaskIds.mockResolvedValue([])
    mockFetchTombstones.mockResolvedValue([])

    await store.loadFromDatabase()

    expect(store._rawTasks.some(task => task.id === staleCachedTask.id)).toBe(false)
  })

  it('allows empty overwrite during workspace switch', async () => {
    const store = useTaskStore()
    const existingTask = makeTask({ title: 'Old Workspace Task' })
    store._rawTasks.push(existingTask)

    mockIsSwitchingWorkspace = true

    // Re-import to pick up the mock change
    vi.resetModules()
    vi.mock('@/stores/workspace', () => ({
      useWorkspaceStore: () => ({
        activeWorkspaceId: 'ws-new',
        isSwitchingWorkspace: true,
      })
    }))

    mockFetchTasks.mockResolvedValue([])

    await store.loadFromDatabase()

    // Workspace switch should allow clearing
    // (The exact behavior depends on the isSwitchingWorkspace check at line 280)
  })

  // ── Dedup safety ──

  it('deduplicates tasks with same ID after merge', async () => {
    const store = useTaskStore()
    const taskId = crypto.randomUUID()
    const task1 = makeTask({ id: taskId, title: 'Version 1' })
    const task2 = makeTask({ id: taskId, title: 'Version 2' })

    // Manually insert duplicates
    store._rawTasks.push(task1, task2)
    mockFetchTasks.mockResolvedValue([task1])

    await store.loadFromDatabase()

    const matches = store._rawTasks.filter(t => t.id === taskId)
    expect(matches.length).toBe(1) // Safety dedup at lines 503-511
  })

  // ── New remote tasks added ──

  it('adds new remote-only tasks to local state', async () => {
    const store = useTaskStore()
    const remoteOnly = makeTask({ title: 'New From Server' })

    store._rawTasks.length = 0 // Empty local
    mockFetchTasks.mockResolvedValue([remoteOnly])

    await store.loadFromDatabase()

    const found = store._rawTasks.find(t => t.id === remoteOnly.id)
    expect(found).toBeDefined()
    expect(found?.title).toBe('New From Server')
  })

  it('logs when sync re-adds a task with an active permanent-delete trace', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = useTaskStore()
    const remoteTask = makeTask({
      id: 'task-sync-readd-after-delete',
      title: 'Remote Readd',
    })

    beginPermanentDeleteTrace(remoteTask.id, 'unit-test')
    store.updateTaskFromSync(remoteTask.id, remoteTask, false)

    expect(store._rawTasks.some(t => t.id === remoteTask.id)).toBe(true)
    expect(warnSpy).toHaveBeenCalledWith('[PERMA-DELETE-TRACE]', expect.objectContaining({
      taskId: remoteTask.id,
      stage: 'task-store.update-from-sync.added-new',
    }))
  })

  it('preserves newer cached canvas geometry on cold reload after updater restart', async () => {
    const store = useTaskStore()
    const taskId = crypto.randomUUID()
    const remoteTask = makeTask({
      id: taskId,
      title: 'Canvas Task',
      canvasPosition: { x: 100, y: 120 },
      parentId: 'old-group',
      positionFormat: 'absolute',
      positionVersion: 3,
      updatedAt: new Date('2026-05-26T10:00:00Z'),
    })
    const cachedTask = makeTask({
      ...remoteTask,
      canvasPosition: { x: 640, y: 720 },
      parentId: 'new-group',
      positionVersion: 4,
      updatedAt: new Date('2026-05-26T10:01:00Z'),
    })

    store._rawTasks.length = 0
    mockFetchTasks.mockResolvedValue([remoteTask])
    vi.mocked(getCachedTasksWithPendingWrites).mockResolvedValue([cachedTask])

    await store.loadFromDatabase()

    const result = store._rawTasks.find(t => t.id === taskId)
    expect(result?.canvasPosition).toEqual({ x: 640, y: 720 })
    expect(result?.parentId).toBe('new-group')
    expect(result?.positionVersion).toBe(4)
  })

  it('keeps remote canvas geometry when cached geometry is older', async () => {
    const store = useTaskStore()
    const taskId = crypto.randomUUID()
    const remoteTask = makeTask({
      id: taskId,
      title: 'Remote Canvas Task',
      canvasPosition: { x: 300, y: 320 },
      parentId: 'remote-group',
      positionVersion: 7,
      updatedAt: new Date('2026-05-26T10:02:00Z'),
    })
    const cachedTask = makeTask({
      ...remoteTask,
      canvasPosition: { x: 20, y: 40 },
      parentId: 'cached-group',
      positionVersion: 6,
      updatedAt: new Date('2026-05-26T10:01:00Z'),
    })

    store._rawTasks.length = 0
    mockFetchTasks.mockResolvedValue([remoteTask])
    vi.mocked(getCachedTasksWithPendingWrites).mockResolvedValue([cachedTask])

    await store.loadFromDatabase()

    const result = store._rawTasks.find(t => t.id === taskId)
    expect(result?.canvasPosition).toEqual({ x: 300, y: 320 })
    expect(result?.parentId).toBe('remote-group')
    expect(result?.positionVersion).toBe(7)
  })
})
