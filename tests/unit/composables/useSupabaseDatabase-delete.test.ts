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

  it('hard deletes a visible task and relies on the database trigger for tombstone creation', async () => {
    queueResponse('tasks', [{ data: [{ id: 'task-1' }], error: null }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.permanentlyDeleteTask('task-1')

    expect(queryCalls).toEqual([
      { table: 'tasks', method: 'delete', args: [] },
      { table: 'tasks', method: 'eq', args: ['id', 'task-1'] },
      { table: 'tasks', method: 'select', args: ['id'] }
    ])
    expect(fromMock).not.toHaveBeenCalledWith('tombstones')
  })

  it('throws when a task is visible but delete affects zero rows', async () => {
    queueResponse('tasks', [
      { data: [], error: null },
      { data: { id: 'task-visible' }, error: null }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await expect(db.permanentlyDeleteTask('task-visible')).rejects.toThrow(
      'row task-visible is visible but DELETE affected 0 rows'
    )

    expect(queryCalls).toContainEqual({ table: 'tasks', method: 'maybeSingle', args: [] })
    expect(fromMock).not.toHaveBeenCalledWith('tombstones')
  })

  it('fails closed when a zero-row delete cannot establish task ownership scope', async () => {
    queueResponse('tasks', [
      { data: [], error: null },
      { data: null, error: null }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await expect(db.permanentlyDeleteTask('task-absent')).rejects.toThrow(
      'cannot establish deletion scope'
    )

    expect(queryCalls).toContainEqual({ table: 'tasks', method: 'maybeSingle', args: [] })
    expect(fromMock).not.toHaveBeenCalledWith('tombstones')
  })

  it('does not attempt fallback tombstone persistence after an unscoped zero-row delete', async () => {
    queueResponse('tasks', [
      { data: [], error: null },
      { data: null, error: null }
    ])
    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await expect(db.permanentlyDeleteTask('task-absent')).rejects.toThrow(
      'cannot establish deletion scope'
    )
    expect(fromMock).not.toHaveBeenCalledWith('tombstones')
  })

  it('throws when the fallback visibility check errors and does not create a tombstone', async () => {
    queueResponse('tasks', [
      { data: [], error: null },
      { data: null, error: { message: 'PostgREST unavailable' } }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await expect(db.permanentlyDeleteTask('task-error')).rejects.toMatchObject({
      message: 'PostgREST unavailable'
    })

    expect(fromMock).not.toHaveBeenCalledWith('tombstones')
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
