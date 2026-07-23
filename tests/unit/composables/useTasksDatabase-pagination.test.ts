import { describe, expect, it, vi } from 'vitest'

const gtCalls = vi.hoisted(() => [] as string[])
const selectCalls = vi.hoisted(() => [] as unknown[][])
const taskCache = vi.hoisted(() => new Map<string, unknown>())
const rows = vi.hoisted(() => Array.from({ length: 1001 }, (_, index) => ({
  id: `task-${String(index).padStart(4, '0')}`,
  title: `Task ${index}`,
  is_deleted: false,
})))

vi.mock('@/composables/supabase/_infrastructure', () => ({
  swrCache: {
    checkUserChange: vi.fn(),
    getOrFetch: async (key: string, fetcher: () => Promise<unknown>) => {
      if (taskCache.has(key)) return taskCache.get(key)
      const value = await fetcher()
      taskCache.set(key, value)
      return value
    },
  },
  invalidateCache: { tasks: vi.fn(() => taskCache.clear()) },
  getSupabase: () => ({
    from: () => {
      let afterId: string | null = null
      const builder: Record<string, unknown> & PromiseLike<unknown> = {
        select: (...args: unknown[]) => {
          selectCalls.push(args)
          return builder
        },
        eq: () => builder,
        is: () => builder,
        order: () => builder,
        limit: () => builder,
        gt: (_column: string, value: string) => {
          afterId = value
          gtCalls.push(value)
          return builder
        },
        then: (resolve: (value: unknown) => unknown) => {
          const eligible = afterId ? rows.filter(row => row.id > afterId!) : rows
          // Simulate a VPS PostgREST max_rows cap lower than the requested limit.
          // Count follows the current keyset filter, as PostgREST does.
          return Promise.resolve({ data: eligible.slice(0, 400), error: null, count: eligible.length }).then(resolve)
        },
      }
      return builder
    },
  }),
}))

vi.mock('@/utils/supabaseMappers', () => ({
  fromSupabaseTask: (row: Record<string, unknown>) => row,
  toSupabaseTask: vi.fn(),
  toDbStatus: vi.fn(),
}))

vi.mock('@/stores/tasks/taskOperations', () => ({ UNCATEGORIZED_PROJECT_ID: 'uncategorized' }))

import { useTasksDatabase } from '@/composables/supabase/useTasksDatabase'

describe('useTasksDatabase authoritative pagination', () => {
  it('uses count-aware ID keyset pages when the server cap is lower than requested', async () => {
    const database = useTasksDatabase({
      authStore: { isInitialized: true, initialize: vi.fn() },
      isSyncing: { value: false },
      lastSyncError: { value: null },
      getUserIdSafe: () => 'user-1',
      withRetry: async (operation: () => Promise<unknown>) => operation(),
      handleError: vi.fn(),
    } as never)

    const result = await database.fetchTasks(null)

    expect(result).toHaveLength(1001)
    expect(gtCalls).toEqual(['task-0399', 'task-0799'])
    expect(selectCalls.every(call => JSON.stringify(call) === JSON.stringify(['*', { count: 'exact' }]))).toBe(true)
  })

  it('bypasses cached rows for an authoritative backup inventory read', async () => {
    const database = useTasksDatabase({
      authStore: { isInitialized: true, initialize: vi.fn() },
      isSyncing: { value: false },
      lastSyncError: { value: null },
      getUserIdSafe: () => 'user-1',
      withRetry: async (operation: () => Promise<unknown>) => operation(),
      handleError: vi.fn(),
    } as never)

    await database.fetchTasks(undefined)
    const queriesAfterCachedRead = selectCalls.length
    await database.fetchTasks(undefined)
    expect(selectCalls).toHaveLength(queriesAfterCachedRead)

    await database.fetchTasks(undefined, { forceFresh: true })

    expect(selectCalls.length).toBeGreaterThan(queriesAfterCachedRead)
  })
})
