import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMockTask } from '../../factories'

const { rpc, enqueue, saveTask, saveTasks } = vi.hoisted(() => ({
  rpc: vi.fn(),
  enqueue: vi.fn(),
  saveTask: vi.fn(),
  saveTasks: vi.fn(),
}))

vi.mock('@/services/auth/supabase', () => ({ supabase: { rpc } }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: '00000000-0000-4000-8000-000000000001' },
    isAuthenticated: true,
  }),
}))
vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({ activeWorkspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
}))
vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue,
    onPermanentFailure: vi.fn(),
    status: { value: 'idle' }, pendingCount: { value: 0 }, failedCount: { value: 0 },
    lastSyncAt: { value: null }, lastError: { value: null }, isOnline: { value: true },
    isProcessing: { value: false }, hasPendingChanges: { value: false }, hasErrors: { value: false },
    retryFailed: vi.fn(), clearFailed: vi.fn(), getQueueStats: vi.fn(), forceSync: vi.fn(),
  }),
}))
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    saveTask, saveTasks, deleteTask: vi.fn(), fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]), saveGroup: vi.fn(), deleteGroup: vi.fn(),
    fetchUserSettings: vi.fn().mockResolvedValue(null), saveProject: vi.fn(), saveProjects: vi.fn(),
    fetchProjects: vi.fn().mockResolvedValue([]), deleteProject: vi.fn(),
  }),
}))
vi.mock('@/composables/useDatabase', () => ({
  useDatabase: () => ({ save: vi.fn(), load: vi.fn().mockResolvedValue(null) }),
  DB_KEYS: { TASKS: 'tasks', PROJECTS: 'projects', CANVAS: 'canvas' },
}))
vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({ onTaskCompleted: vi.fn() }),
}))
vi.mock('@/stores/timer', () => ({
  useTimerStore: () => ({ currentTaskId: null, isTimerActive: false, stopTimer: vi.fn() }),
}))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }))
vi.mock('@/services/offline/readCacheDB', () => ({ cacheTasks: vi.fn(), cacheProjects: vi.fn() }))
vi.mock('@/utils/demoContentGuard', () => ({ guardTaskCreation: vi.fn() }))

import { useTaskStore } from '@/stores/tasks'
import { canonicalWorkBlockJsonHash } from '@/services/sync/canonicalWorkBlockBatch'

const TASK_ID = '11111111-1111-4111-8111-111111111111'
const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const originalBlock = {
  id: 'block-a', taskId: TASK_ID, scheduledDate: '2026-07-16', scheduledTime: '09:00',
  duration: 30, status: 'scheduled' as const,
}

function parentTask(instances = [originalBlock]) {
  return createMockTask({
    id: TASK_ID,
    title: 'Prepare launch brief',
    workspaceId: WORKSPACE_ID,
    canonicalRevision: 7,
    isInInbox: instances.length === 0,
    instances,
  })
}

function installRpc(resultInstances: unknown[]) {
  rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
    const preview = Boolean(args.p_preview)
    const readBack = {
      id: TASK_ID,
      title: 'Prepare launch brief',
      status: 'todo',
      workspaceId: WORKSPACE_ID,
      canonicalRevision: preview ? 7 : 8,
      canonicalUpdatedAt: '2026-07-15T21:01:00.000Z',
      isInInbox: resultInstances.length === 0,
      instances: resultInstances,
    }
    const normalizedOperations = (args.p_operations as Array<Record<string, unknown>>).map(operation => (
      operation.kind === 'create' ? { ...operation, workBlockId: 'generated-block' } : operation
    ))
    if (preview) {
      return { data: {
        ok: true, result: 'preview', contractVersion: 'task-v1', action: 'work_block_batch',
        operationId: args.p_operation_id, workspaceId: WORKSPACE_ID,
        timeZone: args.p_time_zone, finishBy: args.p_finish_by,
        requestHash: 'c'.repeat(64), previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-15T21:15:00.000Z',
        normalizedPayload: {
          operations: normalizedOperations,
          timeZone: args.p_time_zone,
          finishBy: args.p_finish_by,
        }, overlapWarnings: [], readBack: [readBack],
      }, error: null }
    }
    const readBackHash = await canonicalWorkBlockJsonHash(readBack)
    const receipt = {
      ok: true, status: 'committed', contractVersion: 'task-v1',
      operationId: args.p_operation_id, requestHash: 'c'.repeat(64), source: 'web-pwa',
      entityType: 'batch', entityId: args.p_operation_id, action: 'work_block_batch',
      canonicalRevision: 8, canonicalUpdatedAt: readBack.canonicalUpdatedAt,
      changeSequence: 61, replayed: false, committedAt: '2026-07-15T21:01:00.010Z',
      affected: [{ entityId: TASK_ID, entityType: 'task', action: 'update',
        canonicalRevision: 8, changeSequence: 61, readBack, readBackHash }],
      readBack: [readBack], readBackHash: await canonicalWorkBlockJsonHash([readBack]),
    }
    return { data: {
      ok: true, result: 'committed', action: 'work_block_batch',
      operationId: args.p_operation_id, requestHash: 'c'.repeat(64), receipt,
    }, error: null }
  })
}

describe('task store canonical work-block authority', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('creates from canonical read-back with a stable client identity and no generic task write', async () => {
    const created = { id: 'generated-block', clientId: 'calendar-drop-1', taskId: TASK_ID,
      scheduledDate: '2026-07-16', scheduledTime: '10:00', duration: 25, status: 'scheduled' }
    installRpc([created])
    const store = useTaskStore()
    store._rawTasks.push(parentTask([]))

    const result = await store.createTaskInstance(TASK_ID, {
      clientId: 'calendar-drop-1', scheduledDate: '2026-07-16', scheduledTime: '10:00', duration: 25,
      status: 'scheduled',
    })

    expect(result).toMatchObject(created)
    expect(store._rawTasks[0].instances).toEqual([created])
    expect(store._rawTasks[0].canonicalRevision).toBe(8)
    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[0][0]).toBe('flowstate_work_block_batch_v1')
    expect(rpc.mock.calls[0][1].p_operations).toEqual([expect.objectContaining({
      kind: 'create', taskId: TASK_ID, baseRevision: 7, clientId: 'calendar-drop-1',
    })])
    expect(enqueue).not.toHaveBeenCalled()
    expect(saveTask).not.toHaveBeenCalled()
    expect(saveTasks).not.toHaveBeenCalled()
  })

  it('reuses generated operation and client identities after a committed response is lost', async () => {
    const created = { id: 'generated-block', clientId: '', taskId: TASK_ID,
      scheduledDate: '2026-07-16', scheduledTime: '10:00', duration: 25, status: 'scheduled' }
    let committedOperationId = ''
    let committedClientId = ''
    let calls = 0
    rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      calls += 1
      const operation = (args.p_operations as Array<Record<string, unknown>>)[0]
      created.clientId = String(operation.clientId)
      const readBack = {
        id: TASK_ID, title: 'Prepare launch brief', status: 'todo', workspaceId: WORKSPACE_ID,
        canonicalRevision: calls === 1 ? 7 : 8,
        canonicalUpdatedAt: '2026-07-15T21:01:00.000Z', isInInbox: false, instances: [created],
      }
      if (calls === 1) return { data: {
        ok: true, result: 'preview', contractVersion: 'task-v1', action: 'work_block_batch',
        operationId: args.p_operation_id, workspaceId: WORKSPACE_ID, timeZone: args.p_time_zone,
        finishBy: null, requestHash: 'c'.repeat(64), previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-15T21:15:00.000Z', normalizedPayload: {
          operations: [{ ...operation, workBlockId: 'generated-block' }],
          timeZone: args.p_time_zone,
          finishBy: null,
        }, overlapWarnings: [], readBack: [{ ...readBack, instances: [] }],
      }, error: null }
      if (calls === 2) {
        committedOperationId = String(args.p_operation_id)
        committedClientId = String(operation.clientId)
        throw new Error('response lost after commit')
      }
      const affected = [{ entityId: TASK_ID, entityType: 'task', action: 'update',
        canonicalRevision: 8, changeSequence: 61, readBack,
        readBackHash: await canonicalWorkBlockJsonHash(readBack) }]
      const replayReceipt = {
        ok: true, status: 'replayed', contractVersion: 'task-v1', operationId: args.p_operation_id,
        requestHash: 'c'.repeat(64), source: 'web-pwa', entityType: 'batch',
        entityId: args.p_operation_id, action: 'work_block_batch', canonicalRevision: 8,
        canonicalUpdatedAt: readBack.canonicalUpdatedAt, changeSequence: 61, replayed: true,
        committedAt: '2026-07-15T21:01:00.010Z', affected, readBack: [readBack],
        readBackHash: await canonicalWorkBlockJsonHash([readBack]),
      }
      return { data: { ok: true, result: 'committed', action: 'work_block_batch',
        operationId: args.p_operation_id, requestHash: 'c'.repeat(64), receipt: replayReceipt }, error: null }
    })
    const store = useTaskStore()
    store._rawTasks.push(parentTask([]))
    const input = {
      scheduledDate: '2026-07-16', scheduledTime: '10:00', duration: 25,
      status: 'scheduled' as const,
    }

    await expect(store.createTaskInstance(TASK_ID, input)).rejects.toThrow('authority is unavailable')
    await expect(store.createTaskInstance(TASK_ID, input)).resolves.toMatchObject({ id: 'generated-block' })

    expect(rpc.mock.calls[2][1].p_operation_id).toBe(committedOperationId)
    expect((rpc.mock.calls[2][1].p_operations as Array<Record<string, unknown>>)[0].clientId)
      .toBe(committedClientId)
    expect(rpc).toHaveBeenCalledTimes(3)
  })

  it('moves the exact canonical block without replacing siblings locally', async () => {
    const moved = { ...originalBlock, scheduledTime: '09:30' }
    installRpc([moved])
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    await store.updateTaskInstance(TASK_ID, originalBlock.id, { scheduledTime: '09:30' })

    expect(rpc.mock.calls[0][1].p_operations).toEqual([expect.objectContaining({
      kind: 'move', taskId: TASK_ID, workBlockId: originalBlock.id,
      scheduledDate: originalBlock.scheduledDate, scheduledTime: '09:30',
      baseWorkBlockHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })])
    expect(store._rawTasks[0].instances).toEqual([moved])
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('resizes the exact canonical block from canonical read-back', async () => {
    const resized = { ...originalBlock, duration: 45 }
    installRpc([resized])
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    await store.updateTaskInstance(TASK_ID, originalBlock.id, { duration: 45 })

    expect(rpc.mock.calls[0][1].p_operations).toEqual([expect.objectContaining({
      kind: 'resize', taskId: TASK_ID, workBlockId: originalBlock.id, duration: 45,
      baseWorkBlockHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })])
    expect(store._rawTasks[0].instances).toEqual([resized])
    expect(enqueue).not.toHaveBeenCalled()
  })

  it.each(['completed', 'scheduled'] as const)(
    'accepts signed status-only block compatibility updates without an unsafe whole-array write: %s',
    async status => {
      const store = useTaskStore()
      store._rawTasks.push(parentTask([{ ...originalBlock, status: status === 'completed' ? 'scheduled' : 'completed' }]))

      await expect(store.updateTaskInstance(TASK_ID, originalBlock.id, { status })).resolves.toBeUndefined()

      expect(store._rawTasks[0].instances?.[0].status).toBe(status)
      expect(rpc).not.toHaveBeenCalled()
      expect(enqueue).not.toHaveBeenCalled()
      expect(saveTask).not.toHaveBeenCalled()
    },
  )

  it.each(['move', 'resize', 'remove'] as const)(
    'preserves the canonical server hash across a local status projection before %s',
    async action => {
      const nextBlock = action === 'move'
        ? { ...originalBlock, scheduledTime: '09:30' }
        : action === 'resize' ? { ...originalBlock, duration: 45 } : null
      installRpc(nextBlock ? [nextBlock] : [])
      const store = useTaskStore()
      store._rawTasks.push(parentTask())

      await store.updateTaskInstance(TASK_ID, originalBlock.id, { status: 'completed' })
      if (action === 'move') {
        await store.updateTaskInstance(TASK_ID, originalBlock.id, { scheduledTime: '09:30' })
      } else if (action === 'resize') {
        await store.updateTaskInstance(TASK_ID, originalBlock.id, { duration: 45 })
      } else {
        await store.deleteTaskInstance(TASK_ID, originalBlock.id)
      }

      expect(rpc.mock.calls[0][1].p_operations[0]).toEqual(expect.objectContaining({
        kind: action,
        baseWorkBlockHash: await canonicalWorkBlockJsonHash(originalBlock),
      }))
    },
  )

  it('clears the local status hash shadow when authoritative block state is reloaded', async () => {
    const moved = { ...originalBlock, scheduledTime: '09:30' }
    installRpc([moved])
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    await store.updateTaskInstance(TASK_ID, originalBlock.id, { status: 'completed' })
    store._rawTasks[0].instances = [{ ...originalBlock }]
    await store.updateTaskInstance(TASK_ID, originalBlock.id, { scheduledTime: '09:30' })

    expect(rpc.mock.calls[0][1].p_operations[0].baseWorkBlockHash)
      .toBe(await canonicalWorkBlockJsonHash(originalBlock))
    expect(store._rawTasks[0].instances).toEqual([moved])
  })

  it('lets calendar completion derive block status while keeping the canonical instances array out of generic writes', async () => {
    enqueue.mockResolvedValue(1)
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    await expect(store.updateTask(TASK_ID, {
      status: 'done',
      instances: [{ ...originalBlock, status: 'completed' }],
    })).resolves.toBeUndefined()

    expect(store._rawTasks[0].status).toBe('done')
    expect(store._rawTasks[0].instances?.[0].status).toBe('completed')
    expect(rpc).not.toHaveBeenCalled()
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue.mock.calls[0][0].payload).not.toHaveProperty('instances')
  })

  it('converts legacy whole-array calendar snapshots into an exact canonical move', async () => {
    const moved = { ...originalBlock, scheduledDate: '2026-07-17', scheduledTime: '11:15', duration: 45 }
    installRpc([moved])
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    await store.updateTask(TASK_ID, { instances: [moved] })

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[0][1].p_operations).toEqual([expect.objectContaining({
      kind: 'move', taskId: TASK_ID, workBlockId: originalBlock.id,
      scheduledDate: moved.scheduledDate, scheduledTime: moved.scheduledTime, duration: 45,
    })])
    expect(store._rawTasks[0].instances).toEqual([moved])
    expect(enqueue).not.toHaveBeenCalled()
    expect(saveTask).not.toHaveBeenCalled()
  })

  it('removes only the exact canonical block and accepts the server-derived inbox state', async () => {
    installRpc([])
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    await store.deleteTaskInstance(TASK_ID, originalBlock.id)

    expect(rpc.mock.calls[0][1].p_operations).toEqual([expect.objectContaining({
      kind: 'remove', taskId: TASK_ID, workBlockId: originalBlock.id,
      baseWorkBlockHash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })])
    expect(store._rawTasks[0].instances).toEqual([])
    expect(store._rawTasks[0].isInInbox).toBe(true)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('keeps local state unchanged when canonical authority reports a stale revision', async () => {
    rpc.mockResolvedValue({ data: { ok: false, result: 'conflict', error: {
      code: 'stale_revision', message: 'Task changed', currentRevision: 9, taskId: TASK_ID,
    } }, error: null })
    const store = useTaskStore()
    store._rawTasks.push(parentTask())

    await expect(store.updateTaskInstance(TASK_ID, originalBlock.id, { duration: 45 }))
      .rejects.toMatchObject({ code: 'stale_revision', currentRevision: 9 })
    expect(store._rawTasks[0].instances).toEqual([originalBlock])
    expect(store._rawTasks[0].canonicalRevision).toBe(7)
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('moves a ripple set through one atomic canonical batch', async () => {
    const secondId = '22222222-2222-4222-8222-222222222222'
    const secondBlock = { ...originalBlock, id: 'block-b', taskId: secondId, scheduledTime: '10:00' }
    const store = useTaskStore()
    store._rawTasks.push(parentTask(), createMockTask({
      ...parentTask([secondBlock]), id: secondId, canonicalRevision: 4, instances: [secondBlock],
    }))
    rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => {
      const previewMode = Boolean(args.p_preview)
      const ops = args.p_operations as Array<Record<string, unknown>>
      const readBack = ops.map((operation, index) => ({
        id: operation.taskId,
        title: index === 0 ? 'Prepare launch brief' : 'Second task',
        status: 'todo', workspaceId: WORKSPACE_ID,
        canonicalRevision: Number(operation.baseRevision) + (previewMode ? 0 : 1),
        canonicalUpdatedAt: '2026-07-15T21:01:00.000Z', isInInbox: false,
        instances: [{ ...(index === 0 ? originalBlock : secondBlock),
          scheduledDate: operation.scheduledDate, scheduledTime: operation.scheduledTime }],
      }))
      if (previewMode) return { data: {
        ok: true, result: 'preview', contractVersion: 'task-v1', action: 'work_block_batch',
        operationId: args.p_operation_id, workspaceId: WORKSPACE_ID, timeZone: args.p_time_zone,
        finishBy: null, requestHash: 'c'.repeat(64), previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-15T21:15:00.000Z', normalizedPayload: {
          operations: ops, timeZone: args.p_time_zone, finishBy: null,
        },
        overlapWarnings: [], readBack,
      }, error: null }
      const affected = await Promise.all(readBack.map(async task => ({
        entityId: task.id, entityType: 'task', action: 'update',
        canonicalRevision: task.canonicalRevision, changeSequence: 70,
        readBack: task, readBackHash: await canonicalWorkBlockJsonHash(task),
      })))
      const receipt = {
        ok: true, status: 'committed', contractVersion: 'task-v1', operationId: args.p_operation_id,
        requestHash: 'c'.repeat(64), source: 'web-pwa', entityType: 'batch',
        entityId: args.p_operation_id, action: 'work_block_batch', committedAt: '2026-07-15T21:01:01Z',
        canonicalRevision: readBack[0].canonicalRevision, changeSequence: 70, replayed: false,
        affected, readBack, readBackHash: await canonicalWorkBlockJsonHash(readBack),
      }
      return { data: { ok: true, result: 'committed', action: 'work_block_batch',
        operationId: args.p_operation_id, requestHash: 'c'.repeat(64), receipt }, error: null }
    })

    await store.moveTaskInstancesBatch([
      { id: TASK_ID, instanceId: 'block-a', scheduledDate: '2026-07-17', scheduledTime: '11:00' },
      { id: secondId, instanceId: 'block-b', scheduledDate: '2026-07-17', scheduledTime: '11:30' },
    ])

    expect(rpc).toHaveBeenCalledTimes(2)
    expect(rpc.mock.calls[0][1].p_operations).toHaveLength(2)
    expect(store._rawTasks[0].instances?.[0].scheduledTime).toBe('11:00')
    expect(store._rawTasks[1].instances?.[0].scheduledTime).toBe('11:30')
  })
})
