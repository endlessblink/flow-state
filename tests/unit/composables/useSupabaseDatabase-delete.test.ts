import { beforeEach, describe, expect, it, vi } from 'vitest'

type QueryResponse = {
  data?: any
  error?: any
  count?: number | null
}

type QueryCall = {
  table: string
  method: string
  args: any[]
}

const queryCalls: QueryCall[] = []
const responseQueue = new Map<string, QueryResponse[]>()

const authStoreMock = {
  user: { id: 'user-1' } as { id: string } | null,
  isInitialized: true,
  initialize: vi.fn().mockResolvedValue(undefined)
}

const refreshSessionMock = vi.fn().mockResolvedValue({ data: null, error: null })
const rpcMock = vi.fn()
const reportMock = vi.fn()

const queueResponse = (table: string, responses: QueryResponse[]): void => {
  responseQueue.set(table, [...responses])
}

const createQueryBuilder = (table: string) => {
  const builder: any = {}

  const chain = (method: string) => (...args: any[]) => {
    queryCalls.push({ table, method, args })
    return builder
  }

  builder.select = chain('select')
  builder.eq = chain('eq')
  builder.upsert = chain('upsert')
  builder.delete = chain('delete')
  builder.maybeSingle = chain('maybeSingle')

  builder.then = (resolve: (value: QueryResponse) => unknown, reject?: (reason: unknown) => unknown) => {
    const queue = responseQueue.get(table) ?? []
    const next = queue.length > 0 ? queue.shift()! : { data: null, error: null, count: null }
    responseQueue.set(table, queue)
    return Promise.resolve(next).then(resolve, reject)
  }

  return builder
}

const fromMock = vi.fn((table: string) => createQueryBuilder(table))

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    auth: {
      refreshSession: refreshSessionMock
    }
  }
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock
}))

vi.mock('@/utils/errorHandler', () => ({
  errorHandler: {
    report: reportMock
  },
  ErrorSeverity: {
    WARNING: 'WARNING',
    ERROR: 'ERROR'
  },
  ErrorCategory: {
    SYNC: 'SYNC'
  }
}))

describe('useSupabaseDatabase permanent task delete', () => {
  beforeEach(async () => {
    queryCalls.length = 0
    responseQueue.clear()
    fromMock.mockClear()
    refreshSessionMock.mockClear()
    rpcMock.mockReset()
    reportMock.mockClear()
    authStoreMock.user = { id: 'user-1' }

    const { invalidateCache } = await import('@/composables/useSupabaseDatabase')
    invalidateCache.all()
  })

  it('permanently deletes a single task through the authorized atomic RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { deleted_ids: ['task-1'], deleted_count: 1 },
      error: null
    })

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.permanentlyDeleteTask('task-1')

    expect(rpcMock).toHaveBeenCalledWith('flowstate_permanently_delete_tasks', {
      p_task_ids: ['task-1'],
      p_user_id: 'user-1',
      p_request_id: expect.any(String)
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('surfaces an atomic RPC permission failure without issuing a direct delete', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied for function flowstate_can_write_workspace_v1' }
    })

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await expect(db.permanentlyDeleteTask('task-visible')).rejects.toThrow(
      'permission denied for function flowstate_can_write_workspace_v1'
    )

    expect(fromMock).not.toHaveBeenCalled()
  })

  it('fails closed when the atomic receipt does not confirm the requested task', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { deleted_ids: [], deleted_count: 0 },
      error: null
    })

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await expect(db.permanentlyDeleteTask('task-absent')).rejects.toThrow(
      'receipt did not confirm every requested task'
    )

    expect(fromMock).not.toHaveBeenCalled()
  })

  it('does not attempt fallback tombstone persistence after an incomplete RPC receipt', async () => {
    rpcMock.mockResolvedValueOnce({
      data: { deleted_ids: [], deleted_count: 0 },
      error: null
    })
    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await expect(db.permanentlyDeleteTask('task-absent')).rejects.toThrow(
      'receipt did not confirm every requested task'
    )
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('does not issue a direct delete when the atomic RPC is unavailable', async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'PostgREST unavailable' }
    })

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await expect(db.permanentlyDeleteTask('task-error')).rejects.toMatchObject({
      message: 'PostgREST unavailable'
    })

    expect(fromMock).not.toHaveBeenCalled()
  })

  it('permanently deletes a complete task batch in one transactional RPC', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        deleted_ids: ['task-a', 'task-b'],
        deleted_count: 2
      },
      error: null
    })

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.bulkPermanentlyDeleteTasks(['task-a', 'task-b'])

    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('flowstate_permanently_delete_tasks', {
      p_task_ids: ['task-a', 'task-b'],
      p_user_id: 'user-1',
      p_request_id: expect.any(String)
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('fails a permanent-delete batch closed when the receipt is incomplete', async () => {
    rpcMock.mockResolvedValueOnce({
      data: {
        deleted_ids: ['task-a'],
        deleted_count: 1
      },
      error: null
    })

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await expect(db.bulkPermanentlyDeleteTasks(['task-a', 'task-b'])).rejects.toThrow(
      'receipt did not confirm every requested task'
    )
  })
})
