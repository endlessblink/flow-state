import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

type Row = {
  id: string
  title: string
  status: string
  priority: string | null
  due_date: string | null
  project_id: string | null
  updated_at: string
  created_at: string
  canonical_revision: number
}

function row(index: number, overrides: Partial<Row> = {}): Row {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    title: `Task ${index}`,
    status: 'planned',
    priority: null,
    due_date: null,
    project_id: null,
    updated_at: new Date(Date.UTC(2026, 6, 14, 12, 0, 0, -index)).toISOString(),
    created_at: new Date(Date.UTC(2026, 5, 1, 12, 0, 0, index)).toISOString(),
    canonical_revision: index + 1,
    ...overrides,
  }
}

function loadInventoryModule() {
  return require('../../../server/local-api/task-inventory.cjs')
}

function stableDeps(fetchPage: (...args: any[]) => any, overrides: Record<string, unknown> = {}) {
  return {
    fetchPage,
    readSequence: async () => ({ value: 7, error: null }),
    findInvalidRow: async () => ({ data: null, error: null }),
    ...overrides,
  }
}

describe('Local API complete task inventory', () => {
  it('records workspace departures so the source scope sequence also advances', () => {
    const migration = readFileSync(
      'supabase/migrations/20260714030000_task_scope_departure_change.sql',
      'utf8',
    )

    expect(migration).toContain('OLD.workspace_id IS DISTINCT FROM NEW.workspace_id')
    expect(migration).toContain('OLD.workspace_id')
    expect(migration).toContain("'scope_departure'")
    expect(migration).toContain('AFTER UPDATE OF workspace_id ON public.tasks')
  })

  it('rejects cursors on full reads so snapshot provenance cannot be rewritten', () => {
    const { parseTaskInventoryParams } = loadInventoryModule()
    const params = new URLSearchParams({ cursor: 'opaque-cursor' })

    expect(parseTaskInventoryParams(params)).toEqual({
      ok: false,
      error: 'cursor requires mode=page',
    })
  })

  it('reads every page, deduplicates exact UUIDs, and emits a complete receipt', async () => {
    const { readCompleteTaskInventory } = loadInventoryModule()
    const rows = Array.from({ length: 151 }, (_, index) => row(index))
    const fetchPage = async ({ cursor }: { cursor: { id: string } | null }) => {
      const start = cursor ? Number(cursor.id.slice(-12)) + 1 : 0
      const data = rows.slice(start, start + 26)
      if (start > 0) data.unshift(rows[start - 1])
      return { data, error: null }
    }

    const result = await readCompleteTaskInventory(
      { userId: 'user-1', activeWorkspaceId: null },
      { limit: 25, appVersion: '1.4.260', capturedAt: '2026-07-14T12:00:00.000Z' },
      stableDeps(fetchPage),
    )

    expect(result.complete).toBe(true)
    expect(result.fresh).toBe(true)
    expect(result.total).toBe(151)
    expect(result.items).toHaveLength(151)
    expect(new Set(result.items.map((item: { id: string }) => item.id)).size).toBe(151)
    expect(result.items.every((item: Record<string, unknown>) => (
      Number.isInteger(item.canonicalRevision)
      && Number(item.canonicalRevision) > 0
      && !Object.hasOwn(item, 'revision')
    ))).toBe(true)
    expect(result.page).toEqual({ limit: 25, nextCursor: null, hasMore: false })
    expect(result.source).toBe('flowstate')
    expect(result.scope).toBe('all open tasks visible to the authenticated user')
  })

  it('never emits an exact total when a later page fails', async () => {
    const { readCompleteTaskInventory } = loadInventoryModule()
    const rows = Array.from({ length: 30 }, (_, index) => row(index))
    let page = 0
    const fetchPage = async () => {
      page += 1
      return page === 1
        ? { data: rows.slice(0, 26), error: null }
        : { data: null, error: new Error('page unavailable') }
    }

    const result = await readCompleteTaskInventory(
      { userId: 'user-1', activeWorkspaceId: null },
      { limit: 25, appVersion: '1.4.260', capturedAt: '2026-07-14T12:00:00.000Z' },
      stableDeps(fetchPage),
    )

    expect(result.complete).toBe(false)
    expect(result.fresh).toBe(true)
    expect(result).not.toHaveProperty('total')
    expect(result.page.hasMore).toBe(true)
    expect(result.page.nextCursor).toEqual(expect.any(String))
    expect(result.error.code).toBe('inventory_page_failed')
  })

  it('returns a truthful page receipt when more rows exist', async () => {
    const { readTaskInventoryPage } = loadInventoryModule()
    const data = Array.from({ length: 26 }, (_, index) => row(index))

    const result = await readTaskInventoryPage(
      { userId: 'user-1', activeWorkspaceId: null },
      { limit: 25, appVersion: '1.4.260', capturedAt: '2026-07-14T12:00:00.000Z' },
      { fetchPage: async () => ({ data, error: null }) },
    )

    expect(result.complete).toBe(false)
    expect(result).not.toHaveProperty('total')
    expect(result.items).toHaveLength(25)
    expect(result.page.hasMore).toBe(true)
    expect(result.page.nextCursor).toEqual(expect.any(String))
  })

  it('never labels a terminal stateless page as the complete inventory', async () => {
    const { readTaskInventoryPage } = loadInventoryModule()
    const result = await readTaskInventoryPage(
      { userId: 'user-1', activeWorkspaceId: null },
      { limit: 25, appVersion: '1.4.260', capturedAt: '2026-07-14T12:00:00.000Z' },
      { fetchPage: async () => ({ data: [row(30)], error: null }) },
    )

    expect(result.complete).toBe(false)
    expect(result).not.toHaveProperty('total')
    expect(result.page).toEqual({ limit: 25, nextCursor: null, hasMore: false })
  })

  it('keeps later rows reachable when their mutable updated_at changes between pages', async () => {
    const { readCompleteTaskInventory } = loadInventoryModule()
    const rows = Array.from({ length: 30 }, (_, index) => row(index, {
      created_at: index < 20 ? '2026-06-01T12:00:00.000Z' : '2026-06-02T12:00:00.000Z',
    }))
    let page = 0
    const fetchPage = async ({ cursor }: { cursor: { id: string } | null }) => {
      page += 1
      if (page === 2) rows[26].updated_at = '2026-07-14T13:00:00.000Z'
      const start = cursor ? rows.findIndex((item) => item.id === cursor.id) + 1 : 0
      return { data: rows.slice(start, start + 26), error: null }
    }

    const result = await readCompleteTaskInventory(
      { userId: 'user-1', activeWorkspaceId: null },
      { limit: 25, appVersion: '1.4.260', capturedAt: '2026-07-14T12:00:00.000Z' },
      stableDeps(fetchPage),
    )

    expect(result.complete).toBe(true)
    expect(result.total).toBe(30)
    expect(result.items.some((item: { id: string }) => item.id === rows[26].id)).toBe(true)
  })

  it('retries when task membership changes during traversal and never mixes snapshots', async () => {
    const { readCompleteTaskInventory } = loadInventoryModule()
    const rows = Array.from({ length: 30 }, (_, index) => row(index))
    const sequences = [10, 11, 11, 11]
    let scan = 0
    const fetchPage = async ({ cursor }: { cursor: { id: string } | null }) => {
      if (!cursor) scan += 1
      const visible = scan === 1 ? rows : rows.filter((item) => item.id !== rows[26].id)
      const start = cursor ? visible.findIndex((item) => item.id === cursor.id) + 1 : 0
      return { data: visible.slice(start, start + 26), error: null }
    }

    const result = await readCompleteTaskInventory(
      { userId: 'user-1', activeWorkspaceId: null },
      { limit: 25, appVersion: '1.4.260', capturedAt: '2026-07-14T12:00:00.000Z' },
      stableDeps(fetchPage, {
        readSequence: async () => ({ value: sequences.shift(), error: null }),
      }),
    )

    expect(scan).toBe(2)
    expect(result.complete).toBe(true)
    expect(result.total).toBe(29)
    expect(result.changeSequence).toBe(11)
    expect(result.items.some((item: { id: string }) => item.id === rows[26].id)).toBe(false)
  })

  it('fails closed without a total when every consistency attempt observes a change', async () => {
    const { readCompleteTaskInventory } = loadInventoryModule()
    const rows = Array.from({ length: 30 }, (_, index) => row(index))
    const sequences = [10, 11, 12, 13, 14, 15]
    let scans = 0
    const fetchPage = async ({ cursor }: { cursor: { id: string } | null }) => {
      if (!cursor) scans += 1
      const start = cursor ? Number(cursor.id.slice(-12)) + 1 : 0
      return { data: rows.slice(start, start + 26), error: null }
    }

    const result = await readCompleteTaskInventory(
      { userId: 'user-1', activeWorkspaceId: null },
      { limit: 25, appVersion: '1.4.260', capturedAt: '2026-07-14T12:00:00.000Z' },
      stableDeps(fetchPage, {
        readSequence: async () => ({ value: sequences.shift(), error: null }),
      }),
    )

    expect(scans).toBe(3)
    expect(result.complete).toBe(false)
    expect(result).not.toHaveProperty('total')
    expect(result.items).toEqual([])
    expect(result.page.hasMore).toBe(true)
    expect(result.error.code).toBe('inventory_changed_during_read')
  })

  it('rejects a personal cursor after switching to a workspace scope', async () => {
    const { readTaskInventoryPage } = loadInventoryModule()
    const rows = Array.from({ length: 26 }, (_, index) => row(index))
    const input = {
      limit: 25,
      appVersion: '1.4.260',
      capturedAt: '2026-07-14T12:00:00.000Z',
    }
    const personal = await readTaskInventoryPage(
      { userId: 'user-1', activeWorkspaceId: null },
      input,
      { fetchPage: async () => ({ data: rows, error: null }) },
    )
    const workspace = await readTaskInventoryPage(
      { userId: 'user-1', activeWorkspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      { ...input, cursor: personal.page.nextCursor },
      { fetchPage: async () => { throw new Error('cross-scope cursor must fail before querying') } },
    )

    expect(personal.page.nextCursor).toEqual(expect.any(String))
    expect(workspace.complete).toBe(false)
    expect(workspace.error.code).toBe('invalid_inventory_cursor')
    expect(workspace.scopeFingerprint).not.toBe(personal.scopeFingerprint)
  })

  it('rejects forged cursor IDs and invalid row IDs without claiming completeness', async () => {
    const { readTaskInventoryPage } = loadInventoryModule()
    const context = { userId: 'user-1', activeWorkspaceId: null }
    const forged = Buffer.from(JSON.stringify({
      v: 1,
      scope: 'personal:user-1',
      capturedAt: '2026-07-14T12:00:00.000Z',
      createdAt: '2026-06-01T12:00:00.000Z',
      id: 'bad),status.eq.done',
    })).toString('base64url')

    const cursorResult = await readTaskInventoryPage(context, {
      limit: 25,
      cursor: forged,
      appVersion: '1.4.260',
      capturedAt: '2026-07-14T12:00:00.000Z',
    })
    expect(cursorResult.error.code).toBe('invalid_inventory_cursor')

    const rowResult = await readTaskInventoryPage(
      context,
      { limit: 25, appVersion: '1.4.260', capturedAt: '2026-07-14T12:00:00.000Z' },
      { fetchPage: async () => ({ data: [row(1, { id: 'not-a-uuid' })], error: null }) },
    )
    expect(rowResult.complete).toBe(false)
    expect(rowResult).not.toHaveProperty('total')
    expect(rowResult.error.code).toBe('invalid_inventory_row')
  })

  it('builds a stable scoped query that excludes deleted, done, and completion-history rows', () => {
    const { buildTaskInventoryQuery } = loadInventoryModule()
    const calls: Array<[string, ...unknown[]]> = []
    const builder = new Proxy({}, {
      get: (_target, key: string) => (...args: unknown[]) => {
        calls.push([key, ...args])
        return builder
      },
    })
    const supabase = { from: (table: string) => { calls.push(['from', table]); return builder } }

    buildTaskInventoryQuery(
      { supabase, userId: 'user-1', activeWorkspaceId: null },
      { limit: 25, capturedAt: '2026-07-14T12:00:00.000Z', cursor: null },
    )

    expect(calls).toContainEqual(['eq', 'is_deleted', false])
    expect(calls).toContainEqual(['eq', 'is_completion_record', false])
    expect(calls).toContainEqual(['neq', 'status', 'done'])
    expect(calls).toContainEqual(['eq', 'user_id', 'user-1'])
    expect(calls).toContainEqual(['is', 'workspace_id', null])
    expect(calls).toContainEqual(['order', 'created_at', { ascending: true }])
    expect(calls).toContainEqual(['order', 'id', { ascending: true }])
    expect(calls).toContainEqual(['limit', 26])
  })
})
