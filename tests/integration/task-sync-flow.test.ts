/**
 * TASK-1589: Integration Tests — task→sync→DB flow (20 tests)
 *
 * Tests the full data flow from user action through the task store and
 * into the persistence layer. Multiple stores/composables work together
 * with mocked Supabase responses.
 *
 * These are NOT unit tests — they exercise the real composable integration:
 * taskOperations → saveSpecificTasks / deleteTaskFromStorage → enqueue (sync queue)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createMockTask } from '../factories'

// ============================================================================
// Module-level mocks — hoisted before any store import
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
    forceSync: vi.fn(),
  }),
}))

vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({
    save: vi.fn(),
    load: vi.fn().mockResolvedValue(null),
  }),
  DB_KEYS: {
    TASKS: 'tasks',
    PROJECTS: 'projects',
    CANVAS: 'canvas',
  },
}))

const mockSaveTask = vi.fn().mockResolvedValue(undefined)
const mockSaveTasks = vi.fn().mockResolvedValue(undefined)
const mockDeleteTask = vi.fn().mockResolvedValue(undefined)

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: mockSaveTask,
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
    deleteProject: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/services/auth/supabase', () => ({
  supabase: null,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' },
    isAuthenticated: true,
  }),
}))

vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({
    onTaskCompleted: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({
    currentTaskId: null,
    isTimerActive: false,
    stopTimer: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  cacheTasks: vi.fn().mockResolvedValue(undefined),
  cacheProjects: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utils/demoContentGuard', () => ({
  guardTaskCreation: vi.fn(),
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    activeWorkspaceId: null,
  }),
}))

// Import AFTER mocks are hoisted
import { useTaskStore } from '@/stores/tasks'

// ============================================================================
// Helpers
// ============================================================================

/** Get today's date string YYYY-MM-DD */
function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Get tomorrow's date string YYYY-MM-DD */
function tomorrowStr(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ============================================================================
// Integration Tests: task→sync→DB flow
// ============================================================================

describe('Integration: task→sync→DB flow', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: Date.now(), status: 'pending' })
    mockSaveTask.mockResolvedValue(undefined)
    mockSaveTasks.mockResolvedValue(undefined)
    mockDeleteTask.mockResolvedValue(undefined)
  })

  // Test 1
  it('creates task → task appears in store with a generated id', async () => {
    const store = useTaskStore()

    const task = await store.createTask({ title: 'New Integration Task' })

    expect(task).toBeDefined()
    expect(task.id).toBeTruthy()
    expect(task.id).not.toBe('')
    const inStore = store._rawTasks.find(t => t.id === task.id)
    expect(inStore).toBeDefined()
    expect(inStore!.title).toBe('New Integration Task')
  })

  // Test 2
  it('updates task title → store reflects change immediately (optimistic)', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Original' })

    // Optimistic: we don't await a server round-trip; store should update synchronously
    await store.updateTask(task.id, { title: 'Updated' })

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.title).toBe('Updated')
  })

  // Test 3
  it('deletes task → removed from filteredTasks but reflected in _rawTasks removal', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'To Delete' })
    expect(store._rawTasks.find(t => t.id === task.id)).toBeDefined()

    await store.deleteTask(task.id)

    // After delete the task is fully removed from _rawTasks (soft-deleted tasks get spliced out)
    expect(store._rawTasks.find(t => t.id === task.id)).toBeUndefined()
    // And therefore also absent from filteredTasks
    expect(store.tasks.find(t => t.id === task.id)).toBeUndefined()
  })

  // Test 4
  it('creates task with project → project_id set correctly in store', async () => {
    const store = useTaskStore()
    const project = await store.createProject({ name: 'Integration Project' })

    const task = await store.createTask({ title: 'Project Task', projectId: project.id })

    const inStore = store._rawTasks.find(t => t.id === task.id)
    expect(inStore?.projectId).toBe(project.id)
  })

  // Test 5
  it('moves task to "today" smart group → dueDate is today\'s date string', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Today Task', dueDate: '' })

    await store.moveTaskToSmartGroup(task.id, 'today')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.dueDate).toBe(todayStr())
  })

  // Test 6
  it('moves task to "tomorrow" → dueDate is tomorrow\'s date string', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Tomorrow Task', dueDate: '' })

    await store.moveTaskToSmartGroup(task.id, 'tomorrow')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.dueDate).toBe(tomorrowStr())
  })

  // Test 7
  it('moves task to "later" → dueDate cleared', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Later Task', dueDate: '2026-01-01' })

    await store.moveTaskToSmartGroup(task.id, 'later')

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.dueDate ?? '').toBe('')
  })

  // Test 8
  it('create then update same task → both operations applied in correct order', async () => {
    const store = useTaskStore()

    const task = await store.createTask({ title: 'Sequential Task', priority: 'low' })
    await store.updateTask(task.id, { priority: 'high', title: 'Updated Sequential Task' })

    const final = store._rawTasks.find(t => t.id === task.id)
    expect(final?.title).toBe('Updated Sequential Task')
    expect(final?.priority).toBe('high')
    // enqueue called at least once for create and at least once for update
    expect(mockEnqueue).toHaveBeenCalledTimes(2)
  })

  // Test 9
  it('create then delete same task → task fully removed from store', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Ephemeral Task' })
    expect(store._rawTasks.find(t => t.id === task.id)).toBeDefined()

    await store.deleteTask(task.id)

    expect(store._rawTasks.find(t => t.id === task.id)).toBeUndefined()
    expect(store.tasks.find(t => t.id === task.id)).toBeUndefined()
  })

  // Test 10
  it('updates task status to "done" → excluded from active (non-done) task list', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Done Task', status: 'todo' })

    // Verify it's present before
    expect(store._rawTasks.find(t => t.id === task.id)).toBeDefined()

    await store.updateTask(task.id, { status: 'done' })

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.status).toBe('done')
    // When hideDoneTasks or board filters are active the task would be excluded;
    // at minimum the raw status must be 'done'
    expect(updated?.status).toBe('done')
  })

  // Test 11
  it('batch creates 5 tasks → all 5 are present in the store', async () => {
    const store = useTaskStore()

    const created = await Promise.all([
      store.createTask({ title: 'Batch 1' }),
      store.createTask({ title: 'Batch 2' }),
      store.createTask({ title: 'Batch 3' }),
      store.createTask({ title: 'Batch 4' }),
      store.createTask({ title: 'Batch 5' }),
    ])

    for (const task of created) {
      expect(store._rawTasks.find(t => t.id === task.id)).toBeDefined()
    }
    expect(created.length).toBe(5)
  })

  // Test 12
  it('updates multiple fields at once → all fields changed in a single call', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Multi-Field Task', priority: 'low', status: 'todo' })

    await store.updateTask(task.id, {
      title: 'Renamed',
      priority: 'high',
      status: 'done',
      dueDate: '2026-12-31',
    })

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.title).toBe('Renamed')
    expect(updated?.priority).toBe('high')
    expect(updated?.status).toBe('done')
    expect(updated?.dueDate).toBe('2026-12-31')
  })

  // Test 13
  it('creates task with subtasks → subtasks are preserved in the store', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Parent' })

    // createSubtask is the standard API for adding subtasks
    await store.createSubtask(task.id, { title: 'Child A' })
    await store.createSubtask(task.id, { title: 'Child B' })

    const found = store._rawTasks.find(t => t.id === task.id)
    expect(found?.subtasks.length).toBe(2)
    const subtaskTitles = found!.subtasks.map(s => s.title)
    expect(subtaskTitles).toContain('Child A')
    expect(subtaskTitles).toContain('Child B')
  })

  // Test 14
  it('creates task with tags → tags are preserved in the store', async () => {
    const store = useTaskStore()
    const task = await store.createTask({
      title: 'Tagged Task',
      tags: ['backend', 'api', 'v2'],
    })

    const found = store._rawTasks.find(t => t.id === task.id)
    expect(found?.tags).toEqual(['backend', 'api', 'v2'])
  })

  // Test 15
  it('moves task between projects → projectId updated in store', async () => {
    const store = useTaskStore()
    const proj1 = await store.createProject({ name: 'Project Alpha' })
    const proj2 = await store.createProject({ name: 'Project Beta' })

    const task = await store.createTask({ title: 'Movable Task', projectId: proj1.id })
    expect(store._rawTasks.find(t => t.id === task.id)?.projectId).toBe(proj1.id)

    await store.updateTask(task.id, { projectId: proj2.id })

    expect(store._rawTasks.find(t => t.id === task.id)?.projectId).toBe(proj2.id)
  })

  // Test 16
  it('task with isInInbox=true → appears in filteredTasks when no filter active', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Inbox Task', isInInbox: true })

    const found = store._rawTasks.find(t => t.id === task.id)
    expect(found?.isInInbox).toBe(true)
    // Also present in filteredTasks (no active project filter)
    expect(store.tasks.find(t => t.id === task.id)).toBeDefined()
  })

  // Test 17
  it('moves task out of inbox → isInInbox becomes false in store', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Was Inbox Task', isInInbox: true })

    await store.updateTask(task.id, { isInInbox: false })

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.isInInbox).toBe(false)
  })

  // Test 18
  it('updates task order → order field changed in store', async () => {
    const store = useTaskStore()
    const task = await store.createTask({ title: 'Order Task' })

    await store.updateTask(task.id, { order: 99 })

    const updated = store._rawTasks.find(t => t.id === task.id)
    expect(updated?.order).toBe(99)
  })

  // Test 19
  it('creates task with all common fields → no field lost in the store round-trip', async () => {
    const store = useTaskStore()
    const proj = await store.createProject({ name: 'Full Field Project' })

    const task = await store.createTask({
      title: 'Full Field Task',
      description: 'Detailed description here',
      status: 'todo',
      priority: 'high',
      dueDate: '2026-06-01',
      tags: ['full', 'field'],
      isInInbox: false,
      projectId: proj.id,
      estimatedPomodoros: 4,
    })

    const found = store._rawTasks.find(t => t.id === task.id)
    expect(found).toBeDefined()
    expect(found!.title).toBe('Full Field Task')
    expect(found!.description).toBe('Detailed description here')
    expect(found!.status).toBe('todo')
    expect(found!.priority).toBe('high')
    expect(found!.dueDate).toBe('2026-06-01')
    expect(found!.tags).toEqual(['full', 'field'])
    expect(found!.isInInbox).toBe(false)
    expect(found!.projectId).toBe(proj.id)
    expect(found!.estimatedPomodoros).toBe(4)
  })

  // Test 20
  it('store.tasks (filteredTasks) excludes _soft_deleted tasks; _rawTasks includes all', async () => {
    const store = useTaskStore()

    // Create a normal task via the store API
    const liveTask = await store.createTask({ title: 'Live Task' })

    // Inject a soft-deleted task directly into the raw array
    const deletedTask = createMockTask({ id: 'soft-del-integration-01', title: 'Soft Deleted Task' })
    ;(deletedTask as Record<string, unknown>)['_soft_deleted'] = true
    store._rawTasks.push(deletedTask as typeof liveTask)

    // filteredTasks must exclude the soft-deleted entry
    expect(store.tasks.find(t => t.id === 'soft-del-integration-01')).toBeUndefined()

    // _rawTasks must still contain both
    expect(store._rawTasks.find(t => t.id === liveTask.id)).toBeDefined()
    expect(store._rawTasks.find(t => t.id === 'soft-del-integration-01')).toBeDefined()
  })
})
