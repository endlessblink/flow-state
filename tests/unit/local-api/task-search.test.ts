import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

type SearchModule = {
  buildTaskSearchQuery: (
    context: { supabase: FakeSupabase; userId: string; activeWorkspaceId: string | null },
    input: { query: string; limit: number },
  ) => FakeBuilder
  parseTaskSearchParams: (searchParams: URLSearchParams) =>
    | { ok: true; query: string; limit: number }
    | { ok: false; error: string }
}

function loadSearchModule(): SearchModule {
  return require('../../../server/local-api/task-search.cjs') as SearchModule
}

class FakeBuilder {
  calls: Array<[string, ...unknown[]]> = []

  select(...args: unknown[]) { this.calls.push(['select', ...args]); return this }
  eq(...args: unknown[]) { this.calls.push(['eq', ...args]); return this }
  is(...args: unknown[]) { this.calls.push(['is', ...args]); return this }
  ilike(...args: unknown[]) { this.calls.push(['ilike', ...args]); return this }
  order(...args: unknown[]) { this.calls.push(['order', ...args]); return this }
  limit(...args: unknown[]) { this.calls.push(['limit', ...args]); return this }
}

class FakeSupabase {
  builder = new FakeBuilder()
  table: string | null = null
  from(table: string) { this.table = table; return this.builder }
}

describe('Local API task search query', () => {
  it('normalizes a bounded non-empty query and limit', () => {
    const { parseTaskSearchParams } = loadSearchModule()

    expect(parseTaskSearchParams(new URLSearchParams('q=%20Laundry%20&limit=10'))).toEqual({
      ok: true,
      query: 'Laundry',
      limit: 10,
    })
    expect(parseTaskSearchParams(new URLSearchParams('q='))).toEqual({
      ok: false,
      error: 'q is required',
    })
    expect(parseTaskSearchParams(new URLSearchParams(`q=${'a'.repeat(201)}`))).toEqual({
      ok: false,
      error: 'q must be at most 200 characters',
    })
    expect(parseTaskSearchParams(new URLSearchParams('q=test&limit=26'))).toEqual({
      ok: false,
      error: 'limit must be an integer from 1 to 25',
    })
  })

  it('searches only personal, live, non-history tasks and escapes title wildcards', () => {
    const { buildTaskSearchQuery } = loadSearchModule()
    const supabase = new FakeSupabase()

    const builder = buildTaskSearchQuery(
      { supabase, userId: 'user-1', activeWorkspaceId: null },
      { query: '50%_done', limit: 10 },
    )

    expect(supabase.table).toBe('tasks')
    expect(builder.calls).toContainEqual(['eq', 'user_id', 'user-1'])
    expect(builder.calls).toContainEqual(['is', 'workspace_id', null])
    expect(builder.calls).toContainEqual(['eq', 'is_deleted', false])
    expect(builder.calls).toContainEqual(['eq', 'is_completion_record', false])
    expect(builder.calls).toContainEqual(['ilike', 'title', '%50\\%\\_done%'])
    expect(builder.calls).toContainEqual(['limit', 10])
  })

  it('uses workspace membership RLS instead of restricting results to the row creator', () => {
    const { buildTaskSearchQuery } = loadSearchModule()
    const supabase = new FakeSupabase()
    const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

    const builder = buildTaskSearchQuery(
      { supabase, userId: 'user-1', activeWorkspaceId: workspaceId },
      { query: 'shared', limit: 25 },
    )

    expect(builder.calls).toContainEqual(['eq', 'workspace_id', workspaceId])
    expect(builder.calls).not.toContainEqual(['eq', 'user_id', 'user-1'])
  })
})
