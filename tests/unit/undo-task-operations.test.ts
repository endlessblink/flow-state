import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

const mockEnqueue = vi.fn()
const mockSaveTasks = vi.fn()
const mockDeleteTask = vi.fn()
const mockBulkDeleteTasks = vi.fn()
const mockPermanentDeleteTask = vi.fn()

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
    permanentlyDeleteTask: mockPermanentDeleteTask
  }
}))

import { useTaskStore } from '@/stores/tasks'
import { getUndoSystem, resetUndoSystem } from '@/composables/undoSingleton'
import { useUnifiedUndoRedo } from '@/composables/useUnifiedUndoRedo'
import { canonicalWorkBlockJsonHash } from '@/services/sync/canonicalWorkBlockBatch'
import { createMockTask } from '../factories'

type RippleBlock = {
  id: string
  taskId: string
  scheduledDate: string
  scheduledTime: string
  duration: number
  status: 'scheduled'
}

type RippleParent = {
  id: string
  title: string
  canonicalRevision: number
  instances: RippleBlock[]
}

function installAtomicRippleAuthority(
  parents: RippleParent[],
  stale: { taskId: string | null },
) {
  const serverParents = new Map(parents.map(parent => [parent.id, structuredClone(parent)]))

  mockRpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
    const operations = args.p_operations as Array<Record<string, unknown>>
    const preview = Boolean(args.p_preview)
    const readBack = operations.map(operation => {
      const parent = serverParents.get(String(operation.taskId))!
      return {
        id: parent.id,
        title: parent.title,
        status: 'todo',
        workspaceId: null,
        canonicalRevision: parent.canonicalRevision,
        canonicalUpdatedAt: '2026-07-15T21:01:00.000Z',
        isInInbox: false,
        instances: structuredClone(parent.instances),
      }
    })

    if (preview) {
      return { data: {
        ok: true,
        result: 'preview',
        contractVersion: 'task-v1',
        action: 'work_block_batch',
        operationId: args.p_operation_id,
        workspaceId: null,
        timeZone: args.p_time_zone,
        finishBy: null,
        requestHash: 'c'.repeat(64),
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-15T21:15:00.000Z',
        normalizedPayload: {
          operations,
          timeZone: args.p_time_zone,
          finishBy: args.p_finish_by,
        },
        overlapWarnings: [],
        readBack,
      }, error: null }
    }

    if (stale.taskId && operations.some(operation => operation.taskId === stale.taskId)) {
      const parent = serverParents.get(stale.taskId)!
      return { data: { ok: false, result: 'conflict', error: {
        code: 'stale_revision',
        message: 'One ripple parent changed after preview',
        currentRevision: parent.canonicalRevision + 1,
        taskId: stale.taskId,
      } }, error: null }
    }

    const committedReadBack = operations.map(operation => {
      const parent = serverParents.get(String(operation.taskId))!
      const block = parent.instances.find(candidate => candidate.id === operation.workBlockId)!
      block.scheduledDate = String(operation.scheduledDate)
      block.scheduledTime = String(operation.scheduledTime)
      parent.canonicalRevision += 1
      return {
        id: parent.id,
        title: parent.title,
        status: 'todo',
        workspaceId: null,
        canonicalRevision: parent.canonicalRevision,
        canonicalUpdatedAt: '2026-07-15T21:01:01.000Z',
        isInInbox: false,
        instances: structuredClone(parent.instances),
      }
    })
    const affected = await Promise.all(committedReadBack.map(async (parent, index) => ({
      entityId: parent.id,
      entityType: 'task',
      action: 'update',
      canonicalRevision: parent.canonicalRevision,
      changeSequence: 70 + index,
      readBack: parent,
      readBackHash: await canonicalWorkBlockJsonHash(parent),
    })))
    const receipt = {
      ok: true,
      status: 'committed',
      contractVersion: 'task-v1',
      operationId: args.p_operation_id,
      requestHash: 'c'.repeat(64),
      source: 'web-pwa',
      entityType: 'batch',
      entityId: args.p_operation_id,
      action: 'work_block_batch',
      canonicalRevision: Math.max(...committedReadBack.map(parent => parent.canonicalRevision)),
      changeSequence: 70,
      replayed: false,
      committedAt: '2026-07-15T21:01:01.010Z',
      affected,
      readBack: committedReadBack,
      readBackHash: await canonicalWorkBlockJsonHash(committedReadBack),
    }
    return { data: {
      ok: true,
      result: 'committed',
      action: 'work_block_batch',
      operationId: args.p_operation_id,
      requestHash: 'c'.repeat(64),
      receipt,
    }, error: null }
  })
}

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

  it('keeps a signed-in ripple move atomic when one parent is stale during undo', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskAId = '11111111-1111-4111-8111-111111111111'
    const taskBId = '22222222-2222-4222-8222-222222222222'
    const blockA: RippleBlock = {
      id: 'block-a', taskId: taskAId, scheduledDate: '2026-07-16',
      scheduledTime: '09:00', duration: 30, status: 'scheduled',
    }
    const blockB: RippleBlock = {
      id: 'block-b', taskId: taskBId, scheduledDate: '2026-07-16',
      scheduledTime: '10:00', duration: 30, status: 'scheduled',
    }
    const stale = { taskId: null as string | null }
    installAtomicRippleAuthority([
      { id: taskAId, title: 'Ripple A', canonicalRevision: 7, instances: [blockA] },
      { id: taskBId, title: 'Ripple B', canonicalRevision: 4, instances: [blockB] },
    ], stale)
    taskStore._rawTasks.push(
      createMockTask({ id: taskAId, title: 'Ripple A', canonicalRevision: 7, instances: [blockA] }),
      createMockTask({ id: taskBId, title: 'Ripple B', canonicalRevision: 4, instances: [blockB] }),
    )

    await undoSystem.rippleShiftWithUndo([
      { id: taskAId, instanceId: blockA.id, scheduledDate: '2026-07-17', scheduledTime: '11:00' },
      { id: taskBId, instanceId: blockB.id, scheduledDate: '2026-07-17', scheduledTime: '11:30' },
    ])
    expect(taskStore._rawTasks.map(task => task.instances?.[0]?.scheduledTime)).toEqual(['11:00', '11:30'])

    stale.taskId = taskBId
    mockRpc.mockClear()
    await expect(undoSystem.undo()).rejects.toMatchObject({
      code: 'stale_revision',
      taskId: taskBId,
    })

    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockRpc.mock.calls[1][1].p_operations).toHaveLength(2)
    expect(taskStore._rawTasks.map(task => task.instances?.[0]?.scheduledTime)).toEqual(['11:00', '11:30'])
    expect(undoSystem.getOperationStack()).toHaveLength(1)
    expect(undoSystem.getRedoOperationStack()).toHaveLength(0)
  })

  it('undoes and redoes a signed-in ripple through one batch built from current proofs', async () => {
    const taskStore = useTaskStore()
    const undoSystem = getUndoSystem()
    const taskAId = '33333333-3333-4333-8333-333333333333'
    const taskBId = '44444444-4444-4444-8444-444444444444'
    const blockA: RippleBlock = {
      id: 'block-c', taskId: taskAId, scheduledDate: '2026-07-16',
      scheduledTime: '09:00', duration: 30, status: 'scheduled',
    }
    const blockB: RippleBlock = {
      id: 'block-d', taskId: taskBId, scheduledDate: '2026-07-16',
      scheduledTime: '10:00', duration: 30, status: 'scheduled',
    }
    installAtomicRippleAuthority([
      { id: taskAId, title: 'Ripple C', canonicalRevision: 7, instances: [blockA] },
      { id: taskBId, title: 'Ripple D', canonicalRevision: 4, instances: [blockB] },
    ], { taskId: null })
    taskStore._rawTasks.push(
      createMockTask({ id: taskAId, title: 'Ripple C', canonicalRevision: 7, instances: [blockA] }),
      createMockTask({ id: taskBId, title: 'Ripple D', canonicalRevision: 4, instances: [blockB] }),
    )

    await undoSystem.rippleShiftWithUndo([
      { id: taskAId, instanceId: blockA.id, scheduledDate: '2026-07-17', scheduledTime: '11:00' },
      { id: taskBId, instanceId: blockB.id, scheduledDate: '2026-07-17', scheduledTime: '11:30' },
    ])
    const movedBlocks = taskStore._rawTasks.map(task => JSON.parse(JSON.stringify(task.instances?.[0])))

    mockRpc.mockClear()
    await undoSystem.undo()
    const undoApply = mockRpc.mock.calls.find(call => call[1].p_preview === false)?.[1]
    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(undoApply?.p_operations).toEqual([
      expect.objectContaining({
        taskId: taskAId, baseRevision: 8, workBlockId: blockA.id,
        baseWorkBlockHash: await canonicalWorkBlockJsonHash(movedBlocks[0]),
        scheduledDate: blockA.scheduledDate, scheduledTime: blockA.scheduledTime,
      }),
      expect.objectContaining({
        taskId: taskBId, baseRevision: 5, workBlockId: blockB.id,
        baseWorkBlockHash: await canonicalWorkBlockJsonHash(movedBlocks[1]),
        scheduledDate: blockB.scheduledDate, scheduledTime: blockB.scheduledTime,
      }),
    ])
    expect(taskStore._rawTasks.map(task => task.instances?.[0]?.scheduledTime)).toEqual(['09:00', '10:00'])

    const restoredBlocks = taskStore._rawTasks.map(task => JSON.parse(JSON.stringify(task.instances?.[0])))
    mockRpc.mockClear()
    await undoSystem.redo()
    const redoApply = mockRpc.mock.calls.find(call => call[1].p_preview === false)?.[1]
    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(redoApply?.p_operations).toEqual([
      expect.objectContaining({
        taskId: taskAId, baseRevision: 9, workBlockId: blockA.id,
        baseWorkBlockHash: await canonicalWorkBlockJsonHash(restoredBlocks[0]),
        scheduledDate: '2026-07-17', scheduledTime: '11:00',
      }),
      expect.objectContaining({
        taskId: taskBId, baseRevision: 6, workBlockId: blockB.id,
        baseWorkBlockHash: await canonicalWorkBlockJsonHash(restoredBlocks[1]),
        scheduledDate: '2026-07-17', scheduledTime: '11:30',
      }),
    ])
    expect(taskStore._rawTasks.map(task => task.instances?.[0]?.scheduledTime)).toEqual(['11:00', '11:30'])
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

    // Real hard delete per id → trg_task_tombstone writes the tombstone that blocks resurrection.
    expect(mockPermanentDeleteTask).toHaveBeenCalledTimes(2)
    expect(mockPermanentDeleteTask).toHaveBeenCalledWith(taskA.id)
    expect(mockPermanentDeleteTask).toHaveBeenCalledWith(taskB.id)
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
