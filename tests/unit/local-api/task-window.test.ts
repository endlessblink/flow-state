import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const api = () => require('../../../server/local-api/task-window.cjs')
const day = '2026-10-01'

class Query {
  calls: unknown[][] = []
  result: any = { data: [], error: null }
  select(...args: unknown[]) { this.calls.push(['select', ...args]); return this }
  eq(...args: unknown[]) { this.calls.push(['eq', ...args]); return this }
  neq(...args: unknown[]) { this.calls.push(['neq', ...args]); return this }
  is(...args: unknown[]) { this.calls.push(['is', ...args]); return this }
  or(...args: unknown[]) { this.calls.push(['or', ...args]); return this }
  order(...args: unknown[]) { this.calls.push(['order', ...args]); return this }
  limit(...args: unknown[]) { this.calls.push(['limit', ...args]); return this }
  abortSignal(...args: unknown[]) { this.calls.push(['abortSignal', ...args]); return this }
  then(resolve: any) { return Promise.resolve(this.result).then(resolve) }
}
const context = (query: Query, workspace: string | null = null) => ({
  supabase: { from: () => query }, userId: 'user-1', activeWorkspaceId: workspace,
})
const row = (id: string, extra = {}) => ({
  id, title: id, status: 'planned', due_date: null, instances: [], ...extra,
})

describe('bounded read-only planning window', () => {
  it('advertises the route before callers try it', () => {
    const { HERMES_ROUTE_CAPABILITIES } = require('../../../server/local-api/hermes-route-capabilities.cjs')
    expect(HERMES_ROUTE_CAPABILITIES).toContainEqual({
      method: 'GET', path: '/api/tasks/window', contractVersion: 'task-window-v1', available: true,
    })
  })
  it('validates actual calendar dates, sorts/deduplicates and bounds the window', () => {
    expect(api().parseTaskWindowParams(new URLSearchParams(`days=2026-10-02,${day},${day}`)))
      .toEqual({ ok: true, days: [day, '2026-10-02'] })
    for (const input of ['', '2026-02-30', '2026-1-01', '2026-10-01)']) {
      expect(api().parseTaskWindowParams(new URLSearchParams({ days: input })).ok).toBe(false)
    }
    const days = Array.from({ length: 32 }, (_, i) => new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10))
    expect(api().parseTaskWindowParams(new URLSearchParams({ days: days.join(',') })).ok).toBe(false)
  })
  it('selects only dates on the server, with personal scope and a truncation sentinel', async () => {
    const query = new Query()
    await api().readTaskWindow(context(query), { days: [day] })
    expect(query.calls).toContainEqual(['eq', 'user_id', 'user-1'])
    expect(query.calls).toContainEqual(['is', 'workspace_id', null])
    expect(query.calls).toContainEqual(['eq', 'is_deleted', false])
    expect(query.calls).toContainEqual(['eq', 'is_completion_record', false])
    expect(query.calls).toContainEqual(['neq', 'status', 'done'])
    expect(query.calls).toContainEqual(['limit', 501])
    expect(query.calls).toContainEqual(['or', `due_date.in.(${day}),instances.cs.[{"scheduledDate":"${day}"}]`])
    expect(query.calls.find(c => c[0] === 'abortSignal')).toBeDefined()
    const shared = new Query()
    await api().readTaskWindow(context(shared, 'workspace-1'), { days: [day] })
    expect(shared.calls).toContainEqual(['eq', 'workspace_id', 'workspace-1'])
    expect(shared.calls).not.toContainEqual(['eq', 'user_id', 'user-1'])
  })
  it('keeps all active blocks, their overrides and local dates without UTC conversion', async () => {
    const query = new Query()
    query.result.data = [row('scheduled-only', { instances: [
      { id: 'early', scheduledDate: day, scheduledTime: '00:05', duration: 30, isRecurring: true },
      { id: 'late', scheduledDate: day, scheduledTime: '23:55', duration: 5, isModified: true },
      { scheduledDate: day, status: 'completed' }, { scheduledDate: day, isSkipped: true },
      { scheduledDate: day, status: 'skipped' }, { scheduledDate: day, isLater: true },
      { scheduledDate: '2026-10-02' },
    ] }), row('due-only', { due_date: day, due_time: '10:00', estimated_duration: 45 })]
    const result = await api().readTaskWindow(context(query), { days: [day] })
    expect(result.complete).toBe(true)
    expect(result.fresh).toBe(true)
    expect(result.tasks[0].instances.map((x: any) => x.id)).toEqual(['early', 'late'])
    expect(result.tasks[0].instances[1]).toMatchObject({ duration: 5, isModified: true })
    expect(result.tasks[1]).toMatchObject({ dueDate: day, dueTime: '10:00', estimatedDuration: 45 })
  })
  it('does not pretend a truncated window is complete', async () => {
    const query = new Query()
    query.result.data = Array.from({ length: 501 }, (_, i) => row(String(i), { due_date: day }))
    const result = await api().readTaskWindow(context(query), { days: [day] })
    expect(result.complete).toBe(false)
    expect(result.tasks).toEqual([])
    expect(result.error.code).toBe('window_too_large')
  })
  it('fails closed on backend errors and malformed scheduled data', async () => {
    const query = new Query()
    query.result.error = { message: 'private backend detail' }
    expect(JSON.stringify(await api().readTaskWindow(context(query), { days: [day] }))).not.toContain('private')
    query.result = { data: [row('bad', { instances: 'not-an-array' })], error: null }
    expect((await api().readTaskWindow(context(query), { days: [day] })).complete).toBe(false)
  })
})
