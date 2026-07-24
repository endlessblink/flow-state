import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))
const mockCacheTasks = vi.hoisted(() => vi.fn())

const mockEnqueue = vi.fn()
const mockSaveTasks = vi.fn()
const mockDeleteTask = vi.fn()
const mockBulkDeleteTasks = vi.fn()
const mockPermanentDeleteTask = vi.fn()
const mockBulkPermanentlyDeleteTasks = vi.fn()

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

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask: mockSaveTasks,
    saveTasks: mockSaveTasks,
    deleteTask: mockDeleteTask,
    bulkDeleteTasks: mockBulkDeleteTasks,
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    saveGroup: vi.fn(),
    deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null)
  })
}))

vi.mock('@/services/auth/supabase', () => ({ supabase: { rpc: mockRpc } }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: '00000000-0000-0000-0000-000000000001' },
    isAuthenticated: true
  })
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({ activeWorkspaceId: null })
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

vi.mock('@/services/trash/TrashService', () => ({
  trashService: {
    permanentlyDeleteTask: mockPermanentDeleteTask,
    bulkPermanentlyDeleteTasks: mockBulkPermanentlyDeleteTasks
  }
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  cacheTasks: mockCacheTasks,
}))

import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem, resetUndoSystem } from '@/composables/undoSingleton'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { createMockTask } from '../factories'

describe('task operation undo/redo three-cycle invariants', () => {
  beforeEach(() => {
    resetUndoSystem()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockEnqueue.mockResolvedValue({ id: 1, status: 'pending' })
    mockSaveTasks.mockResolvedValue(undefined)
    mockDeleteTask.mockResolvedValue(undefined)
    mockBulkDeleteTasks.mockResolvedValue(undefined)
    mockPermanentDeleteTask.mockResolvedValue(undefined)
    mockBulkPermanentlyDeleteTasks.mockResolvedValue(undefined)
    mockCacheTasks.mockResolvedValue(undefined)
    mockRpc.mockReset()
  })

  afterEach(() => {
    resetUndoSystem()
    vi.restoreAllMocks()
  })

  it('undoes and redoes task creation three consecutive times with the same task id', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()

    const createdTask = await undoSystem.createTaskWithUndo({
      title: 'Undo create coverage',
      status: 'todo',
      priority: 'medium'
    })

    expect(createdTask).toBeDefined()
    expect(taskStore._rawTasks.find(task => task.id === createdTask?.id)?.title).toBe('Undo create coverage')

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(taskStore._rawTasks.some(task => task.id === createdTask?.id)).toBe(false)

      await undoSystem.redo()

      const restored = taskStore._rawTasks.find(task => task.id === createdTask?.id)
      expect(restored).toBeDefined()
      expect(restored?.title).toBe('Undo create coverage')
      expect(restored?.id).toBe(createdTask?.id)
    }
  })

  it('undoes and redoes task updates three consecutive times without touching task identity', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-update-cycle',
      title: 'Before update',
      priority: 'low',
      isInInbox: false
    })
    taskStore._rawTasks.push(task)

    await undoSystem.updateTaskWithUndo(task.id, {
      title: 'After update',
      priority: 'high'
    })

    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)?.title).toBe('After update')

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const afterUndo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterUndo).toBeDefined()
      expect(afterUndo?.title).toBe('Before update')
      expect(afterUndo?.priority).toBe('low')

      await undoSystem.redo()

      const afterRedo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterRedo).toBeDefined()
      expect(afterRedo?.title).toBe('After update')
      expect(afterRedo?.priority).toBe('high')
    }
  })

  it('undoes and redoes the public moveTaskWithUndo status wrapper three consecutive times', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-status-move-cycle',
      title: 'Status move cycle',
      status: 'todo'
    })
    taskStore._rawTasks.push(task)

    await taskStore.moveTaskWithUndo(task.id, 'done')

    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)?.status).toBe('done')

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const afterUndo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterUndo).toBeDefined()
      expect(afterUndo?.status).toBe('todo')

      await undoSystem.redo()

      const afterRedo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterRedo).toBeDefined()
      expect(afterRedo?.status).toBe('done')
    }
  })

  it('restores the previous status when a done action cannot queue or save remotely', async () => {
    const taskStore = useTaskStore()
    const task = createMockTask({
      id: 'task-done-no-durable-write',
      title: 'Done must not disappear only locally',
      status: 'todo'
    })
    taskStore._rawTasks.push(task)
    mockEnqueue.mockRejectedValueOnce(new Error('IndexedDB queue unavailable'))
    mockSaveTasks.mockRejectedValueOnce(new Error('Supabase unavailable'))

    await taskStore.updateTask(task.id, { status: 'done' })

    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)?.status).toBe('todo')
  })

  it('advances recurring done-for-now only after the canonical transaction returns a receipt', async () => {
    const taskStore = useTaskStore()
    const task = createMockTask({
      id: 'task-recurring-done-for-now-auth-recovery',
      title: 'Recurring done for now auth recovery',
      status: 'todo',
      dueDate: '2026-07-12',
      recurrenceRule: {
        pattern: 'weekly',
        interval: 1,
        weekdays: [4],
        endType: 'never'
      },
      recurrenceCount: 0,
      instances: [{
        id: 'instance-current',
        taskId: 'task-recurring-done-for-now-auth-recovery',
        scheduledDate: '2026-07-12',
        scheduledTime: '20:00',
        duration: 25,
        status: 'scheduled'
      }]
    })
    taskStore._rawTasks.push(task)

    mockRpc
      .mockResolvedValueOnce({
        data: {
          ok: true,
          preview: true,
          previewVersion: 'task-recurring-done-for-now-auth-recovery:0:2026-07-12:v1',
          requestHash: 'request-hash-1',
          recurrence: { nextDueDateAfter: '2026-07-16', cadencePreserved: true }
        },
        error: null
      })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          preview: false,
          requestId: 'receipt-request',
          taskId: task.id,
          currentOccurrence: { dueDate: '2026-07-12' },
          completedOccurrence: {
            id: 'completion-record-1',
            status: 'done',
            dueDate: '2026-07-12',
            completedAt: '2026-07-12T20:30:00.000Z'
          },
          nextOccurrence: {
            id: 'instance-next',
            taskId: task.id,
            status: 'todo',
            dueDate: '2026-07-16',
            scheduledTime: '20:00',
            duration: 25
          },
          recurrence: { nextDueDateAfter: '2026-07-16', cadencePreserved: true }
        },
        error: null
      })

    await expect(taskStore.doneForNow(task.id)).resolves.toBeUndefined()

    const advancedTask = taskStore._rawTasks.find(candidate => candidate.id === task.id)
    expect(advancedTask).toMatchObject({
      status: 'todo',
      dueDate: '2026-07-16',
      recurrenceCount: 1,
      isInInbox: true
    })
    expect(advancedTask?.instances).toEqual([expect.objectContaining({
      id: 'instance-next',
      scheduledDate: '2026-07-16',
      scheduledTime: '20:00',
      status: 'scheduled'
    })])
    expect(advancedTask?.completedAt).toBeUndefined()
    expect(taskStore._rawTasks).toContainEqual(expect.objectContaining({
      id: 'completion-record-1',
      isCompletionRecord: true,
      status: 'done',
      dueDate: '2026-07-12',
      recurrenceParentId: task.id,
      recurrenceCount: 0
    }))
    expect(mockSaveTasks).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockRpc).toHaveBeenNthCalledWith(2, 'flowstate_done_for_now', expect.objectContaining({
      p_request_hash: 'request-hash-1',
    }))
  })

  it('undoes and redoes the public moveTaskToProjectWithUndo wrapper three consecutive times', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const { moveTaskToProjectWithUndo } = useUnifiedUndoRedo()
    const task = createMockTask({
      id: 'task-project-move-cycle',
      title: 'Project move cycle',
      projectId: 'project-before'
    })
    taskStore._rawTasks.push(task)

    await moveTaskToProjectWithUndo(task.id, 'project-after')

    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)?.projectId).toBe('project-after')

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const afterUndo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterUndo).toBeDefined()
      expect(afterUndo?.projectId).toBe('project-before')

      await undoSystem.redo()

      const afterRedo = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(afterRedo).toBeDefined()
      expect(afterRedo?.projectId).toBe('project-after')
    }
  })

  it('undoes and redoes a Kanban-style multi-field drop update three consecutive times', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-kanban-drop-cycle',
      title: 'Kanban drop cycle',
      status: 'todo',
      isInInbox: true,
      projectId: 'project-before',
      priority: 'low'
    })
    taskStore._rawTasks.push(task)

    await taskStore.updateTaskWithUndo(task.id, {
      status: 'done',
      isInInbox: false,
      projectId: 'project-after',
      priority: 'high'
    })

    expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)).toMatchObject({
      status: 'done',
      isInInbox: false,
      projectId: 'project-after',
      priority: 'high'
    })

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)).toMatchObject({
        status: 'todo',
        isInInbox: true,
        projectId: 'project-before',
        priority: 'low'
      })

      await undoSystem.redo()

      expect(taskStore._rawTasks.find(candidate => candidate.id === task.id)).toMatchObject({
        status: 'done',
        isInInbox: false,
        projectId: 'project-after',
        priority: 'high'
      })
    }
  })

  it('undoes and redoes an atomic bulk task update three consecutive times', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskA = createMockTask({
      id: 'task-bulk-update-a',
      title: 'Bulk update A',
      status: 'todo',
      priority: 'low'
    })
    const taskB = createMockTask({
      id: 'task-bulk-update-b',
      title: 'Bulk update B',
      status: 'todo',
      priority: 'medium'
    })
    taskStore._rawTasks.push(taskA, taskB)

    await undoSystem.bulkUpdateTasksWithUndo([
      { id: taskA.id, updates: { status: 'done', priority: 'high' } },
      { id: taskB.id, updates: { status: 'done', priority: 'high' } }
    ], 'Bulk mark done and high priority')

    expect(undoSystem.getOperationStack()).toHaveLength(1)
    expect(undoSystem.getOperationStack()[0]?.operation.affectedIds).toEqual([taskA.id, taskB.id])
    expect(taskStore._rawTasks.find(candidate => candidate.id === taskA.id)).toMatchObject({ status: 'done', priority: 'high' })
    expect(taskStore._rawTasks.find(candidate => candidate.id === taskB.id)).toMatchObject({ status: 'done', priority: 'high' })

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(taskStore._rawTasks.find(candidate => candidate.id === taskA.id)).toMatchObject({ status: 'todo', priority: 'low' })
      expect(taskStore._rawTasks.find(candidate => candidate.id === taskB.id)).toMatchObject({ status: 'todo', priority: 'medium' })

      await undoSystem.redo()

      expect(taskStore._rawTasks.find(candidate => candidate.id === taskA.id)).toMatchObject({ status: 'done', priority: 'high' })
      expect(taskStore._rawTasks.find(candidate => candidate.id === taskB.id)).toMatchObject({ status: 'done', priority: 'high' })
    }
  })

  it('reports a partial bulk update and compensates every earlier successful task', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskA = createMockTask({ id: 'bulk-update-rollback-a', title: 'Rollback A', priority: 'low' })
    const taskB = createMockTask({ id: 'bulk-update-rollback-b', title: 'Rollback B', priority: 'low' })
    taskStore._rawTasks.push(taskA, taskB)
    mockEnqueue
      .mockResolvedValueOnce({ id: 1, status: 'pending' })
      .mockRejectedValueOnce(new Error('second queue write failed'))
      .mockResolvedValueOnce({ id: 2, status: 'pending' })
    mockSaveTasks.mockRejectedValueOnce(new Error('second direct save failed'))

    await expect(undoSystem.bulkUpdateTasksWithUndo([
      { id: taskA.id, updates: { priority: 'high' } },
      { id: taskB.id, updates: { priority: 'high' } },
    ], 'Set priorities')).rejects.toThrow('second direct save failed')

    expect(taskStore.getTask(taskA.id)?.priority).toBe('low')
    expect(taskStore.getTask(taskB.id)?.priority).toBe('low')
    expect(mockEnqueue).toHaveBeenCalledTimes(3)
  })

  it('does not claim field-only rollback for a partly applied status batch', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskA = createMockTask({ id: 'bulk-status-partial-a', title: 'Status A', status: 'todo' })
    const taskB = createMockTask({ id: 'bulk-status-partial-b', title: 'Status B', status: 'todo' })
    taskStore._rawTasks.push(taskA, taskB)
    mockEnqueue
      .mockResolvedValueOnce({ id: 1, status: 'pending' })
      .mockRejectedValueOnce(new Error('second status queue failed'))
    mockSaveTasks.mockRejectedValueOnce(new Error('second status save failed'))

    await expect(undoSystem.bulkUpdateTasksWithUndo([
      { id: taskA.id, updates: { status: 'done' } },
      { id: taskB.id, updates: { status: 'done' } },
    ], 'Mark tasks done')).rejects.toThrow(
      'stopped after 1 of 2; successful tasks remain changed'
    )

    expect(taskStore.getTask(taskA.id)?.status).toBe('done')
    expect(taskStore.getTask(taskB.id)?.status).toBe('todo')
    expect(mockEnqueue).toHaveBeenCalledTimes(2)
  })

  it('undoes and redoes task deletion three consecutive times with the same restored task id', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-delete-cycle',
      title: 'Delete cycle task'
    })
    taskStore._rawTasks.push(task)

    await undoSystem.deleteTaskWithUndo(task.id)

    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const restored = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(restored).toBeDefined()
      expect(restored?.title).toBe('Delete cycle task')

      await undoSystem.redo()

      expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)
    }
  })

  it('keeps a soft delete removed when saving remaining cached tasks fails', async () => {
    const taskStore = useTaskStore()
    const task = createMockTask({
      id: 'task-soft-delete-save-fails',
      title: 'Soft delete should stay gone'
    })
    const remainingCachedTask = createMockTask({
      id: 'task-soft-delete-remaining-inaccessible',
      title: 'Remaining cached task'
    })
    taskStore._rawTasks.push(task, remainingCachedTask)

    mockSaveTasks.mockRejectedValueOnce(new Error('remaining cached tasks are inaccessible on server'))

    await expect(taskStore.deleteTask(task.id, 'regression-test')).resolves.toBeUndefined()

    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)
    expect(taskStore._rawTasks.some(candidate => candidate.id === remainingCachedTask.id)).toBe(true)
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'task',
      operation: 'delete',
      entityId: task.id
    }))
  })

  it('rolls back a soft delete when durable queue enrollment fails', async () => {
    const taskStore = useTaskStore()
    const task = createMockTask({
      id: 'task-soft-delete-queue-fails',
      title: 'Delete must not disappear only locally'
    })
    taskStore._rawTasks.push(task)
    mockEnqueue.mockRejectedValueOnce(new Error('IndexedDB queue unavailable'))

    await expect(taskStore.deleteTask(task.id, 'regression-test')).rejects.toThrow('IndexedDB queue unavailable')

    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(true)
  })

  it('undoes and redoes permanent task deletion three consecutive times locally', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-permanent-delete-cycle',
      title: 'Permanent delete cycle task'
    })
    taskStore._rawTasks.push(task)

    await undoSystem.permanentlyDeleteTaskWithUndo(task.id)

    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      const restored = taskStore._rawTasks.find(candidate => candidate.id === task.id)
      expect(restored).toBeDefined()
      expect(restored?.title).toBe('Permanent delete cycle task')

      await undoSystem.redo()

      expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)
    }
  })

  it('keeps a permanent delete removed when the post-delete bulk save of remaining tasks fails', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-permanent-delete-save-fails',
      title: 'Delete should stay gone'
    })
    const remainingCachedTask = createMockTask({
      id: 'task-still-cached-but-server-inaccessible',
      title: 'Remaining cached task'
    })
    taskStore._rawTasks.push(task)
    taskStore._rawTasks.push(remainingCachedTask)

    mockPermanentDeleteTask.mockResolvedValueOnce(undefined)
    mockSaveTasks.mockRejectedValueOnce(new Error('remaining cached tasks are inaccessible on server'))

    await expect(undoSystem.permanentlyDeleteTaskWithUndo(task.id)).resolves.toBeUndefined()

    expect(mockPermanentDeleteTask).toHaveBeenCalledWith(task.id)
    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)
    expect(taskStore._rawTasks.some(candidate => candidate.id === remainingCachedTask.id)).toBe(true)
  })

  it('keeps a permanent delete removed and queues fallback sync when remote hard delete fails during auth recovery', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-permanent-delete-auth-recovery',
      title: 'Auth recovery permanent delete'
    })
    taskStore._rawTasks.push(task)

    mockPermanentDeleteTask.mockRejectedValueOnce({
      message: 'Invalid Refresh Token: Already Used',
      status: 400
    })
    mockEnqueue.mockClear()

    await expect(undoSystem.permanentlyDeleteTaskWithUndo(task.id)).resolves.toBeUndefined()

    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(false)
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'task',
      operation: 'delete',
      entityId: task.id,
      payload: expect.objectContaining({
        permanentDelete: true
      })
    }))
  })

  it('rolls back a permanent delete when both the remote delete and fallback queue fail', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-permanent-delete-no-durable-write',
      title: 'Permanent delete must remain truthful'
    })
    taskStore._rawTasks.push(task)

    mockPermanentDeleteTask.mockRejectedValueOnce({
      message: 'Invalid Refresh Token: Already Used',
      status: 400
    })
    mockEnqueue.mockRejectedValueOnce(new Error('IndexedDB queue unavailable'))

    await expect(undoSystem.permanentlyDeleteTaskWithUndo(task.id)).rejects.toThrow('IndexedDB queue unavailable')

    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(true)
  })

  it('still rolls back permanent delete when the server proves RLS blocks visible-row hard delete', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const task = createMockTask({
      id: 'task-permanent-delete-rls-blocked',
      title: 'RLS blocked permanent delete'
    })
    taskStore._rawTasks.push(task)

    mockPermanentDeleteTask.mockRejectedValueOnce(new Error(
      `permanentlyDeleteTask: row ${task.id} is visible but DELETE affected 0 rows — RLS delete policy is blocking it`
    ))

    await expect(undoSystem.permanentlyDeleteTaskWithUndo(task.id)).rejects.toThrow('RLS delete policy is blocking it')

    expect(taskStore._rawTasks.some(candidate => candidate.id === task.id)).toBe(true)
    expect(mockEnqueue).not.toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'task',
      operation: 'delete',
      entityId: task.id
    }))
  })

  // BUG-1850 regression: canvas permanent delete (Shift+Delete / context-menu Permanent Delete)
  // must take the REAL hard-delete path so the DB trigger writes a tombstone — otherwise the sync
  // layer resurrects the task and the delete appears to do nothing. The previous coverage was a
  // logic-simulation + source grep that asserted the BUGGY soft-delete routing, so it never failed.
  // This drives the real undo singleton and asserts the DB hard delete is invoked, not the soft one.
  it('BUG-1850: bulkPermanentlyDeleteTasksWithUndo hard-deletes (tombstone), never soft-deletes', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskA = createMockTask({ id: 'bug1850-a', title: 'Permanent A' })
    const taskB = createMockTask({ id: 'bug1850-b', title: 'Permanent B' })
    taskStore._rawTasks.push(taskA, taskB)

    mockPermanentDeleteTask.mockClear()
    mockBulkDeleteTasks.mockClear()

    await undoSystem.bulkPermanentlyDeleteTasksWithUndo([taskA.id, taskB.id])

    // One transactional RPC hard-deletes the complete selection and writes every tombstone.
    expect(mockBulkPermanentlyDeleteTasks).toHaveBeenCalledTimes(1)
    expect(mockBulkPermanentlyDeleteTasks).toHaveBeenCalledWith([taskA.id, taskB.id])
    expect(mockPermanentDeleteTask).not.toHaveBeenCalled()
    // The soft-delete routing that caused BUG-1850 must NOT be used.
    expect(mockBulkDeleteTasks).not.toHaveBeenCalled()

    // Removed locally...
    expect(taskStore._rawTasks.some(c => c.id === taskA.id)).toBe(false)
    expect(taskStore._rawTasks.some(c => c.id === taskB.id)).toBe(false)

    // ...and single-press undo restores both (one combined operation).
    await undoSystem.undo()
    expect(taskStore._rawTasks.find(c => c.id === taskA.id)?.title).toBe('Permanent A')
    expect(taskStore._rawTasks.find(c => c.id === taskB.id)?.title).toBe('Permanent B')
  })

  it('restores the complete permanent-delete batch when the atomic server operation fails', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskA = createMockTask({ id: 'permanent-batch-failure-a', title: 'Permanent failure A' })
    const taskB = createMockTask({ id: 'permanent-batch-failure-b', title: 'Permanent failure B' })
    taskStore._rawTasks.push(taskA, taskB)
    mockBulkPermanentlyDeleteTasks.mockRejectedValueOnce(new Error('batch transaction rolled back'))

    await expect(
      undoSystem.bulkPermanentlyDeleteTasksWithUndo([taskA.id, taskB.id])
    ).rejects.toThrow('batch transaction rolled back')

    expect(taskStore._rawTasks.map(task => task.id)).toEqual([taskA.id, taskB.id])
    expect(mockPermanentDeleteTask).not.toHaveBeenCalled()
  })

  it('disables surviving local recurrence before an atomic permanent-delete request can yield', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const recurrenceRule = { pattern: 'daily' as const, interval: 1, endType: 'never' as const }
    const livingTask = createMockTask({
      id: 'permanent-recurring-living',
      title: 'Recurring living task',
      recurrenceRule,
    })
    const completedAncestor = createMockTask({
      id: 'permanent-recurring-history',
      title: 'Recurring history',
      status: 'done',
      recurrenceRule,
      recurrenceParentId: livingTask.id,
      isCompletionRecord: true,
    })
    taskStore._rawTasks.push(livingTask, completedAncestor)

    let releaseDelete!: () => void
    mockBulkPermanentlyDeleteTasks.mockImplementationOnce(() => new Promise<void>(resolve => {
      releaseDelete = resolve
    }))

    const deletePromise = undoSystem.bulkPermanentlyDeleteTasksWithUndo([livingTask.id])
    await vi.waitFor(() => expect(mockBulkPermanentlyDeleteTasks).toHaveBeenCalledTimes(1))

    expect(taskStore.getTask(completedAncestor.id)?.recurrenceRule).toBeUndefined()

    releaseDelete()
    await deletePromise
  })

  it('undoes and redoes bulk task deletion three consecutive times with all original ids', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskA = createMockTask({ id: 'task-bulk-delete-a', title: 'Bulk delete A' })
    const taskB = createMockTask({ id: 'task-bulk-delete-b', title: 'Bulk delete B' })
    taskStore._rawTasks.push(taskA, taskB)

    await undoSystem.bulkDeleteTasksWithUndo([taskA.id, taskB.id])

    expect(taskStore._rawTasks.some(candidate => candidate.id === taskA.id)).toBe(false)
    expect(taskStore._rawTasks.some(candidate => candidate.id === taskB.id)).toBe(false)

    for (let i = 0; i < 3; i += 1) {
      await undoSystem.undo()

      expect(taskStore._rawTasks.find(candidate => candidate.id === taskA.id)?.title).toBe('Bulk delete A')
      expect(taskStore._rawTasks.find(candidate => candidate.id === taskB.id)?.title).toBe('Bulk delete B')

      await undoSystem.redo()

      expect(taskStore._rawTasks.some(candidate => candidate.id === taskA.id)).toBe(false)
      expect(taskStore._rawTasks.some(candidate => candidate.id === taskB.id)).toBe(false)
    }
  })

  it('BUG-1934: removes the complete local batch before queued sync finishes', async () => {
    const taskStore = useTaskStore()
    const taskA = createMockTask({
      id: 'task-bulk-delete-instant-a',
      title: 'Instant bulk delete A',
      positionVersion: 4
    })
    const taskB = createMockTask({
      id: 'task-bulk-delete-instant-b',
      title: 'Instant bulk delete B',
      positionVersion: 9
    })
    const untouchedTask = createMockTask({
      id: 'task-bulk-delete-untouched',
      title: 'Untouched task'
    })
    taskStore._rawTasks.push(taskA, taskB, untouchedTask)

    let releaseFirstQueueWrite!: (value: { id: number; status: string }) => void
    const firstQueueWrite = new Promise<{ id: number; status: string }>(resolve => {
      releaseFirstQueueWrite = resolve
    })
    mockEnqueue.mockImplementationOnce(() => firstQueueWrite)

    const deletePromise = taskStore.bulkDeleteTasks([taskA.id, taskB.id])

    expect(taskStore._rawTasks.map(task => task.id)).toEqual([untouchedTask.id])
    await vi.waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(1))
    expect(taskStore._rawTasks.map(task => task.id)).toEqual([untouchedTask.id])
    expect(mockEnqueue).toHaveBeenNthCalledWith(1, expect.objectContaining({
      entityType: 'task',
      operation: 'delete',
      entityId: taskA.id,
      payload: { id: taskA.id },
      baseVersion: 4
    }))

    releaseFirstQueueWrite({ id: 1, status: 'pending' })
    await deletePromise

    expect(mockEnqueue).toHaveBeenNthCalledWith(2, expect.objectContaining({
      entityType: 'task',
      operation: 'delete',
      entityId: taskB.id,
      payload: { id: taskB.id },
      baseVersion: 9
    }))
  })

  it('BUG-1934: redo removes the complete local batch before queued sync finishes', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskA = createMockTask({ id: 'task-bulk-redo-instant-a', title: 'Instant bulk redo A' })
    const taskB = createMockTask({ id: 'task-bulk-redo-instant-b', title: 'Instant bulk redo B' })
    taskStore._rawTasks.push(taskA, taskB)

    await undoSystem.bulkDeleteTasksWithUndo([taskA.id, taskB.id])
    await undoSystem.undo()
    expect(taskStore._rawTasks.map(task => task.id)).toEqual([taskA.id, taskB.id])

    mockEnqueue.mockClear()
    let releaseFirstQueueWrite!: (value: { id: number; status: string }) => void
    const firstQueueWrite = new Promise<{ id: number; status: string }>(resolve => {
      releaseFirstQueueWrite = resolve
    })
    mockEnqueue.mockImplementationOnce(() => firstQueueWrite)

    const redoPromise = undoSystem.redo()

    await vi.waitFor(() => expect(mockEnqueue).toHaveBeenCalledTimes(1))
    expect(taskStore._rawTasks).toHaveLength(0)

    releaseFirstQueueWrite({ id: 1, status: 'pending' })
    await redoPromise
  })

  it('restores only bulk deletes that could not be durably queued and reports the partial failure', async () => {
    const taskStore = useTaskStore()
    const durableTask = createMockTask({ id: 'task-bulk-delete-durable', title: 'Durable delete' })
    const failedTask = createMockTask({ id: 'task-bulk-delete-failed', title: 'Failed delete' })
    taskStore._rawTasks.push(durableTask, failedTask)
    mockEnqueue
      .mockResolvedValueOnce({ id: 1, status: 'pending' })
      .mockRejectedValueOnce(new Error('IndexedDB write failed'))

    await expect(taskStore.bulkDeleteTasks([durableTask.id, failedTask.id])).rejects.toThrow(
      'could not be durably queued'
    )

    expect(taskStore._rawTasks.some(task => task.id === durableTask.id)).toBe(false)
    expect(taskStore._rawTasks.some(task => task.id === failedTask.id)).toBe(true)
  })

  it('keeps a bulk delete removed when saving remaining cached tasks fails', async () => {
    const taskStore = useTaskStore()
    const taskA = createMockTask({ id: 'task-bulk-delete-save-fails-a', title: 'Bulk delete A' })
    const taskB = createMockTask({ id: 'task-bulk-delete-save-fails-b', title: 'Bulk delete B' })
    const remainingCachedTask = createMockTask({
      id: 'task-bulk-delete-remaining-inaccessible',
      title: 'Remaining cached task'
    })
    taskStore._rawTasks.push(taskA, taskB, remainingCachedTask)

    mockSaveTasks.mockRejectedValueOnce(new Error('remaining cached tasks are inaccessible on server'))

    await expect(taskStore.bulkDeleteTasks([taskA.id, taskB.id])).resolves.toBeUndefined()

    expect(taskStore._rawTasks.some(candidate => candidate.id === taskA.id)).toBe(false)
    expect(taskStore._rawTasks.some(candidate => candidate.id === taskB.id)).toBe(false)
    expect(taskStore._rawTasks.some(candidate => candidate.id === remainingCachedTask.id)).toBe(true)
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'task',
      operation: 'delete',
      entityId: taskA.id
    }))
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'task',
      operation: 'delete',
      entityId: taskB.id
    }))
  })
})
