import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

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
  user: null as { id: string } | null,
  isInitialized: true,
  initialize: vi.fn().mockResolvedValue(undefined)
}

const refreshSessionMock = vi.fn().mockResolvedValue({ data: null, error: null })

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
  builder.order = chain('order')
  builder.upsert = chain('upsert')
  builder.delete = chain('delete')
  builder.update = chain('update')
  builder.insert = chain('insert')
  builder.gte = chain('gte')
  builder.maybeSingle = chain('maybeSingle')
  builder.limit = chain('limit')

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
    auth: {
      refreshSession: refreshSessionMock
    }
  }
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authStoreMock
}))

const reportMock = vi.fn()

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

const mapperSpies = vi.hoisted(() => ({
  toSupabaseTask: vi.fn((task: any, userId: string) => ({
    id: task.id,
    user_id: userId,
    parent_task_id: task.parentTaskId ?? null
  })),
  fromSupabaseTask: vi.fn((row: any) => ({
    id: row.id,
    title: row.title
  })),
  toSupabaseProject: vi.fn((project: any, userId: string) => ({
    id: project.id,
    user_id: userId,
    name: project.name ?? 'project'
  })),
  fromSupabaseProject: vi.fn((row: any) => ({
    id: row.id,
    name: row.name
  })),
  toSupabaseGroup: vi.fn((group: any, userId: string) => ({
    id: group.id,
    user_id: userId,
    name: group.name ?? 'group'
  })),
  fromSupabaseGroup: vi.fn((row: any) => ({
    id: row.id,
    name: row.name
  })),
  toSupabaseTimerSession: vi.fn((session: any, userId: string, deviceId: string) => ({
    id: session.id,
    user_id: userId,
    device_id: deviceId
  })),
  fromSupabaseTimerSession: vi.fn((row: any) => ({
    id: row.id
  })),
  toSupabaseUserSettings: vi.fn((settings: any, userId: string) => ({
    user_id: userId,
    theme: settings.theme ?? 'system'
  })),
  fromSupabaseUserSettings: vi.fn((row: any) => ({
    theme: row.theme
  }))
}))

vi.mock('@/utils/supabaseMappers', async () => {
  const actual = await vi.importActual<any>('@/utils/supabaseMappers')
  return {
    ...actual,
    toSupabaseTask: mapperSpies.toSupabaseTask,
    fromSupabaseTask: mapperSpies.fromSupabaseTask,
    toSupabaseProject: mapperSpies.toSupabaseProject,
    fromSupabaseProject: mapperSpies.fromSupabaseProject,
    toSupabaseGroup: mapperSpies.toSupabaseGroup,
    fromSupabaseGroup: mapperSpies.fromSupabaseGroup,
    toSupabaseTimerSession: mapperSpies.toSupabaseTimerSession,
    fromSupabaseTimerSession: mapperSpies.fromSupabaseTimerSession,
    toSupabaseUserSettings: mapperSpies.toSupabaseUserSettings,
    fromSupabaseUserSettings: mapperSpies.fromSupabaseUserSettings
  }
})

describe('useSupabaseDatabase - Supabase integration behavior', () => {
  beforeEach(async () => {
    queryCalls.length = 0
    responseQueue.clear()
    fromMock.mockClear()
    refreshSessionMock.mockClear()
    reportMock.mockClear()
    authStoreMock.initialize.mockClear()

    mapperSpies.toSupabaseTask.mockClear()
    mapperSpies.fromSupabaseTask.mockClear()
    mapperSpies.toSupabaseProject.mockClear()
    mapperSpies.fromSupabaseProject.mockClear()
    mapperSpies.toSupabaseGroup.mockClear()
    mapperSpies.fromSupabaseGroup.mockClear()
    mapperSpies.toSupabaseTimerSession.mockClear()
    mapperSpies.fromSupabaseTimerSession.mockClear()
    mapperSpies.toSupabaseUserSettings.mockClear()
    mapperSpies.fromSupabaseUserSettings.mockClear()

    authStoreMock.user = { id: 'user-1' }
    authStoreMock.isInitialized = true

    const { invalidateCache } = await import('@/composables/useSupabaseDatabase')
    invalidateCache.all()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches active tasks and maps rows via fromSupabaseTask', async () => {
    queueResponse('tasks', [
      {
        data: [
          { id: 'task-1', title: 'Task One', is_deleted: false },
          { id: 'task-2', title: 'Task Two', is_deleted: false }
        ],
        error: null
      }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    const result = await db.fetchTasks()

    expect(fromMock).toHaveBeenCalledWith('tasks')
    expect(queryCalls).toEqual([
      { table: 'tasks', method: 'select', args: ['*'] },
      { table: 'tasks', method: 'eq', args: ['is_deleted', false] },
      { table: 'tasks', method: 'order', args: ['order', { ascending: true }] },
      { table: 'tasks', method: 'order', args: ['created_at', { ascending: true }] }
    ])

    expect(mapperSpies.fromSupabaseTask).toHaveBeenCalledTimes(2)
    expect(result).toEqual([
      { id: 'task-1', title: 'Task One' },
      { id: 'task-2', title: 'Task Two' }
    ])
  })

  it('serves repeated fetchTasks calls from SWR cache without a second query', async () => {
    queueResponse('tasks', [
      {
        data: [{ id: 'task-1', title: 'Task One', is_deleted: false }],
        error: null
      }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    const first = await db.fetchTasks()
    const second = await db.fetchTasks()

    expect(first).toEqual([{ id: 'task-1', title: 'Task One' }])
    expect(second).toEqual(first)
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('skips saveTask for guest users', async () => {
    authStoreMock.user = null

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveTask({ id: 'task-guest' } as any)

    expect(mapperSpies.toSupabaseTask).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('retries saveProject on 401 by refreshing auth session', async () => {
    vi.useFakeTimers()

    queueResponse('projects', [
      { error: { status: 401, message: 'token expired' } },
      { error: null }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    const savePromise = db.saveProject({ id: 'project-1', name: 'Alpha' } as any)
    await vi.advanceTimersByTimeAsync(500)
    await savePromise

    const upsertCalls = queryCalls.filter(call => call.table === 'projects' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(2)
    expect(refreshSessionMock).toHaveBeenCalledTimes(1)
    expect(mapperSpies.toSupabaseProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'project-1' }),
      'user-1'
    )
  })

  it('retries saveTask once when parent_task_id FK constraint fails', async () => {
    queueResponse('tasks', [
      { error: { code: '23503', message: 'violates foreign key constraint on parent_task_id' } },
      { error: null }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveTask({ id: 'task-1', parentTaskId: 'missing-parent' } as any)

    const upsertCalls = queryCalls.filter(call => call.table === 'tasks' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(2)
    expect(upsertCalls[0]?.args[0]).toEqual({
      id: 'task-1',
      user_id: 'user-1',
      parent_task_id: 'missing-parent'
    })
    expect(upsertCalls[1]?.args[0]).toEqual({
      id: 'task-1',
      user_id: 'user-1',
      parent_task_id: null
    })
  })

  it('fetches projects via fromSupabaseProject and waits for auth init when needed', async () => {
    authStoreMock.isInitialized = false

    queueResponse('projects', [
      {
        data: [
          { id: 'project-1', name: 'Alpha' },
          { id: 'project-2', name: 'Beta' }
        ],
        error: null
      }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()
    const projects = await db.fetchProjects()

    expect(authStoreMock.initialize).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('projects')
    expect(queryCalls).toEqual([
      { table: 'projects', method: 'select', args: ['*'] },
      { table: 'projects', method: 'order', args: ['created_at', { ascending: true }] }
    ])
    expect(mapperSpies.fromSupabaseProject).toHaveBeenCalledTimes(2)
    expect(projects).toEqual([
      { id: 'project-1', name: 'Alpha' },
      { id: 'project-2', name: 'Beta' }
    ])
  })

  it('skips saveProject and deleteTask for guest users', async () => {
    authStoreMock.user = null

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveProject({ id: 'project-guest', name: 'Guest' } as any)
    await db.deleteTask('task-guest')

    expect(mapperSpies.toSupabaseProject).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('saves bulk tasks via mapper and verifies select payload shape', async () => {
    queueResponse('tasks', [
      {
        data: [
          { id: 'task-1', position: [0, 0] },
          { id: 'task-2', position: null }
        ],
        error: null
      }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveTasks([
      { id: 'task-1', parentTaskId: 'parent-1' } as any,
      { id: 'task-2' } as any
    ])

    expect(mapperSpies.toSupabaseTask).toHaveBeenCalledTimes(2)
    const upsertCalls = queryCalls.filter(call => call.table === 'tasks' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.args[0]).toEqual([
      { id: 'task-1', user_id: 'user-1', parent_task_id: 'parent-1' },
      { id: 'task-2', user_id: 'user-1', parent_task_id: null }
    ])
    expect(queryCalls).toContainEqual({ table: 'tasks', method: 'select', args: ['id, position'] })
  })

  it('retries saveTask on 403 by refreshing auth session', async () => {
    vi.useFakeTimers()

    queueResponse('tasks', [
      { error: { status: 403, message: 'invalid_token' } },
      { error: null }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    const savePromise = db.saveTask({ id: 'task-auth-retry' } as any)
    await vi.advanceTimersByTimeAsync(500)
    await savePromise

    const upsertCalls = queryCalls.filter(call => call.table === 'tasks' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(2)
    expect(refreshSessionMock).toHaveBeenCalledTimes(1)
  })

  it('retries saveProject on transient network failures without refreshing auth', async () => {
    vi.useFakeTimers()

    queueResponse('projects', [
      { error: { message: 'Failed to fetch' } },
      { error: null }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    const savePromise = db.saveProject({ id: 'project-net', name: 'Network' } as any)
    await vi.advanceTimersByTimeAsync(500)
    await savePromise

    const upsertCalls = queryCalls.filter(call => call.table === 'projects' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(2)
    expect(refreshSessionMock).not.toHaveBeenCalled()
  })

  it('soft-deletes task rows with update + select count query', async () => {
    queueResponse('tasks', [{ error: null, count: 1 }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.deleteTask('task-delete-1')

    expect(queryCalls).toContainEqual({
      table: 'tasks',
      method: 'update',
      args: [expect.objectContaining({ is_deleted: true, deleted_at: expect.any(String) })]
    })
    expect(queryCalls).toContainEqual({ table: 'tasks', method: 'eq', args: ['id', 'task-delete-1'] })
    expect(queryCalls).toContainEqual({ table: 'tasks', method: 'select', args: ['*', { count: 'exact' }] })
  })

  // GROUP TESTS
  it('fetches groups and maps rows via fromSupabaseGroup', async () => {
    queueResponse('groups', [
      {
        data: [
          { id: 'group-1', name: 'Group One', is_deleted: false },
          { id: 'group-2', name: 'Group Two', is_deleted: false }
        ],
        error: null
      }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    const result = await db.fetchGroups()

    expect(fromMock).toHaveBeenCalledWith('groups')
    expect(queryCalls).toEqual([
      { table: 'groups', method: 'select', args: ['*'] },
      { table: 'groups', method: 'eq', args: ['is_deleted', false] }
    ])

    expect(mapperSpies.fromSupabaseGroup).toHaveBeenCalledTimes(2)
    expect(result).toEqual([
      { id: 'group-1', name: 'Group One' },
      { id: 'group-2', name: 'Group Two' }
    ])
  })

  it('saves group successfully', async () => {
    queueResponse('groups', [
      {
        data: [{ id: 'group-1', position_json: { x: 0, y: 0, width: 100, height: 100 } }],
        error: null
      }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveGroup({ id: 'group-1', name: 'Group 1' } as any)

    expect(mapperSpies.toSupabaseGroup).toHaveBeenCalledTimes(1)
    const upsertCalls = queryCalls.filter(call => call.table === 'groups' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.args[0]).toEqual({
      id: 'group-1',
      user_id: 'user-1',
      name: 'Group 1'
    })
    expect(upsertCalls[0]?.args[1]).toEqual({ onConflict: 'id' })
    expect(queryCalls).toContainEqual({ table: 'groups', method: 'select', args: ['id, position_json'] })
  })

  it('permanently deletes a group and records tombstone', async () => {
    queueResponse('tombstones', [{ error: null }])
    queueResponse('groups', [{ error: null }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.permanentlyDeleteGroup('group-delete-perm')

    expect(queryCalls).toContainEqual({
      table: 'tombstones',
      method: 'upsert',
      args: [expect.objectContaining({ entity_type: 'group', entity_id: 'group-delete-perm', user_id: 'user-1' }), { onConflict: 'entity_type,entity_id,user_id' }]
    })
    expect(queryCalls).toContainEqual({ table: 'groups', method: 'delete', args: [] })
    expect(queryCalls).toContainEqual({ table: 'groups', method: 'eq', args: ['id', 'group-delete-perm'] })
  })

  // TIMER TESTS
  it('fetches active timer session', async () => {
    queueResponse('timer_sessions', [
      {
        data: { id: 'session-1', is_active: true },
        error: null
      }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    const result = await db.fetchActiveTimerSession()

    expect(fromMock).toHaveBeenCalledWith('timer_sessions')
    expect(queryCalls).toContainEqual({ table: 'timer_sessions', method: 'select', args: ['*'] })
    expect(queryCalls).toContainEqual({ table: 'timer_sessions', method: 'eq', args: ['user_id', 'user-1'] })
    expect(queryCalls).toContainEqual({ table: 'timer_sessions', method: 'eq', args: ['is_active', true] })
    expect(queryCalls).toContainEqual({ table: 'timer_sessions', method: 'order', args: ['updated_at', { ascending: false }] })
    expect(queryCalls).toContainEqual({ table: 'timer_sessions', method: 'limit', args: [1] })
    expect(queryCalls).toContainEqual({ table: 'timer_sessions', method: 'maybeSingle', args: [] })

    expect(mapperSpies.fromSupabaseTimerSession).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ id: 'session-1' })
  })

  it('saves active timer session', async () => {
    queueResponse('timer_sessions', [{ error: null }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveActiveTimerSession({ id: 'session-1' } as any, 'device-1')

    expect(mapperSpies.toSupabaseTimerSession).toHaveBeenCalledTimes(1)
    const upsertCalls = queryCalls.filter(call => call.table === 'timer_sessions' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.args[0]).toEqual({
      id: 'session-1',
      user_id: 'user-1',
      device_id: 'device-1'
    })
  })

  it('deletes a timer session', async () => {
    queueResponse('timer_sessions', [{ error: null }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.deleteTimerSession('session-delete-1')

    expect(queryCalls).toContainEqual({ table: 'timer_sessions', method: 'delete', args: [] })
    expect(queryCalls).toContainEqual({ table: 'timer_sessions', method: 'eq', args: ['id', 'session-delete-1'] })
  })

  // SETTINGS TESTS
  it('fetches user settings', async () => {
    queueResponse('user_settings', [
      {
        data: { theme: 'dark' },
        error: null
      }
    ])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    const result = await db.fetchUserSettings()

    expect(fromMock).toHaveBeenCalledWith('user_settings')
    expect(queryCalls).toContainEqual({ table: 'user_settings', method: 'select', args: ['*'] })
    expect(queryCalls).toContainEqual({ table: 'user_settings', method: 'eq', args: ['user_id', 'user-1'] })
    expect(queryCalls).toContainEqual({ table: 'user_settings', method: 'maybeSingle', args: [] })

    expect(mapperSpies.fromSupabaseUserSettings).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ theme: 'dark' })
  })

  it('saves user settings', async () => {
    queueResponse('user_settings', [{ error: null }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveUserSettings({ theme: 'light' } as any)

    expect(mapperSpies.toSupabaseUserSettings).toHaveBeenCalledTimes(1)
    const upsertCalls = queryCalls.filter(call => call.table === 'user_settings' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.args[0]).toEqual({
      user_id: 'user-1',
      theme: 'light'
    })
    expect(upsertCalls[0]?.args[1]).toEqual({ onConflict: 'user_id' })
  })

  // NOTIFICATION TESTS
  it('handles sync local notifications to db correctly', async () => {
    queueResponse('notifications', [{ error: null }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveNotifications([{ id: 'notif-1' }] as any)

    const upsertCalls = queryCalls.filter(call => call.table === 'notifications' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.args[0]).toEqual([
      expect.objectContaining({ id: 'notif-1', user_id: 'user-1' })
    ])
    expect(upsertCalls[0]?.args[1]).toEqual({ onConflict: 'id' })
  })

  // PINNED TASKS TESTS
  it('saves pinned tasks successfully', async () => {
    queueResponse('pinned_tasks', [{ error: null }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.reorderPinnedTasks([{ id: 'pin-1' }] as any)

    const upsertCalls = queryCalls.filter(call => call.table === 'pinned_tasks' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.args[0]).toEqual([
      expect.objectContaining({ id: 'pin-1', user_id: 'user-1' })
    ])
    expect(upsertCalls[0]?.args[1]).toEqual({ onConflict: 'id' })
  })

  // WORK PROFILE TESTS
  it('saves work profile', async () => {
    queueResponse('ai_work_profiles', [{ error: null }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveWorkProfile({ name: 'Work' } as any)

    const upsertCalls = queryCalls.filter(call => call.table === 'ai_work_profiles' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.args[0]).toEqual(expect.objectContaining({
      user_id: 'user-1',
      name: 'Work'
    }))
    expect(upsertCalls[0]?.args[1]).toEqual({ onConflict: 'user_id' })
  })

  // QUICK SORT TESTS
  it('saves quick sort session', async () => {
    queueResponse('quick_sort_sessions', [{ error: null }])

    const { useSupabaseDatabase } = await import('@/composables/useSupabaseDatabase')
    const db = useSupabaseDatabase()

    await db.saveQuickSortSession({ session_id: 'session-1' } as any)

    const upsertCalls = queryCalls.filter(call => call.table === 'quick_sort_sessions' && call.method === 'upsert')
    expect(upsertCalls).toHaveLength(1)
    expect(upsertCalls[0]?.args[1]).toEqual({ onConflict: 'id' })
  })
})
