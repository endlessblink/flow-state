// @vitest-environment node

import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { executeTaskInstanceMove, PREVIEW_TTL_MS } = require(
  resolve(process.cwd(), 'server/local-api/task-instance-move.cjs'),
) as {
  executeTaskInstanceMove: (
    context: { supabase: unknown; userId: string },
    taskId: string,
    instanceId: string,
    body: unknown,
    notify: (operation: string, taskId: string) => void,
    options?: { now?: () => Date; previewKey?: Buffer },
  ) => Promise<{ status: number; body: Record<string, any> }>
  PREVIEW_TTL_MS: number
}

const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const TASK = 'task-1'
const KEY = Buffer.alloc(32, 7)
const T0 = new Date('2026-10-11T08:00:00.000Z')

type Row = Record<string, any>

// Minimal PostgREST-shaped fake: evaluates .eq() filters against in-memory rows
// so the handler's ownership, soft-delete and compare-and-swap guards really run.
function fakeSupabase(rows: Row[]) {
  const updates: Row[] = []
  function query(mode: 'select' | 'update', patch?: Row) {
    const filters: Array<[string, unknown]> = []
    const builder: any = {
      select: () => builder,
      eq: (column: string, value: unknown) => { filters.push([column, value]); return builder },
      maybeSingle: async () => {
        const hit = rows.find(row => filters.every(([c, v]) => row[c] === v))
        if (!hit) return { data: null, error: null }
        if (mode === 'update') {
          Object.assign(hit, structuredClone(patch))
          updates.push(structuredClone(patch!))
        }
        return { data: structuredClone(hit), error: null }
      },
    }
    return builder
  }
  return {
    updates,
    client: {
      from: (table: string) => {
        expect(table).toBe('tasks')
        return { select: () => query('select'), update: (patch: Row) => query('update', patch) }
      },
    },
  }
}

function taskRow(overrides: Row = {}): Row {
  return {
    id: TASK,
    user_id: USER,
    is_deleted: false,
    title: 'Desk block',
    updated_at: '2026-10-11T07:00:00.000000+00:00',
    instances: [
      { id: 'inst-a', scheduledDate: '2026-10-12', scheduledTime: '10:00', duration: 60, extra: 'kept' },
      { id: 'inst-b', scheduledDate: '2026-10-13', scheduledTime: '09:00', duration: 30 },
    ],
    ...overrides,
  }
}

function run(rows: Row[], body: unknown, opts: { instanceId?: string; now?: Date; userId?: string } = {}) {
  const db = fakeSupabase(rows)
  const notify = vi.fn()
  const promise = executeTaskInstanceMove(
    { supabase: db.client, userId: opts.userId ?? USER },
    TASK,
    opts.instanceId ?? 'inst-a',
    body,
    notify,
    { now: () => opts.now ?? T0, previewKey: KEY },
  )
  return { db, notify, promise }
}

const MOVE = { scheduledDate: '2026-10-12', scheduledTime: '15:00' }

async function previewThenApply(rows: Row[], body: Row = MOVE) {
  const preview = await run(rows, body).promise
  expect(preview.status).toBe(200)
  const applyBody = {
    ...body,
    preview: false,
    previewDigest: preview.body.previewDigest,
    previewExpiresAt: preview.body.previewExpiresAt,
  }
  return { preview, applyBody }
}

describe('POST /api/tasks/:id/instances/:instanceId/move', () => {
  it('previews by default without writing and binds a digest + expiry', async () => {
    const rows = [taskRow()]
    const { db, notify, promise } = run(rows, MOVE)
    const result = await promise

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      ok: true,
      preview: true,
      task: { id: TASK, title: 'Desk block' },
      before: { id: 'inst-a', scheduledDate: '2026-10-12', scheduledTime: '10:00', duration: 60 },
      instance: { id: 'inst-a', scheduledDate: '2026-10-12', scheduledTime: '15:00', duration: 60 },
    })
    expect(result.body.previewDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(Date.parse(result.body.previewExpiresAt)).toBe(T0.getTime() + PREVIEW_TTL_MS)
    expect(db.updates).toHaveLength(0)
    expect(notify).not.toHaveBeenCalled()
  })

  it('applies the approved move in place: one instance, new time, siblings and extra fields untouched', async () => {
    const rows = [taskRow()]
    const { applyBody } = await previewThenApply(rows, { ...MOVE, duration: 90 })
    const { db, notify, promise } = run(rows, applyBody)
    const result = await promise

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({
      ok: true,
      preview: false,
      instance: { id: 'inst-a', scheduledDate: '2026-10-12', scheduledTime: '15:00', duration: 90 },
    })
    expect(db.updates).toHaveLength(1)
    expect(rows[0].instances).toEqual([
      { id: 'inst-a', scheduledDate: '2026-10-12', scheduledTime: '15:00', duration: 90, extra: 'kept' },
      { id: 'inst-b', scheduledDate: '2026-10-13', scheduledTime: '09:00', duration: 30 },
    ])
    expect(rows[0].instances.filter((i: Row) => i.id === 'inst-a')).toHaveLength(1)
    expect(notify).toHaveBeenCalledWith('update', TASK)
  })

  it('refuses apply without the preview digest', async () => {
    const result = await run([taskRow()], { ...MOVE, preview: false }).promise
    expect(result.status).toBe(400)
    expect(result.body.error.code).toBe('approval_required')
  })

  it('rejects an apply whose body differs from the preview', async () => {
    const rows = [taskRow()]
    const { applyBody } = await previewThenApply(rows)
    const result = await run(rows, { ...applyBody, scheduledTime: '16:00' }).promise
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('preview_mismatch')
    expect(rows[0].instances[0].scheduledTime).toBe('10:00')
  })

  it('rejects an apply when the instance changed after the preview', async () => {
    const rows = [taskRow()]
    const { applyBody } = await previewThenApply(rows)
    rows[0].instances[0].scheduledTime = '11:00'
    const result = await run(rows, applyBody).promise
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('preview_mismatch')
  })

  it('rejects a forged expiry and an expired preview', async () => {
    const rows = [taskRow()]
    const { applyBody } = await previewThenApply(rows)
    const forged = await run(rows, { ...applyBody, previewExpiresAt: '2030-01-01T00:00:00.000Z' }).promise
    expect(forged.body.error.code).toBe('preview_mismatch')

    const late = new Date(T0.getTime() + PREVIEW_TTL_MS + 1)
    const expired = await run(rows, applyBody, { now: late }).promise
    expect(expired.status).toBe(409)
    expect(expired.body.error.code).toBe('preview_expired')
    expect(rows[0].instances[0].scheduledTime).toBe('10:00')
  })

  it('returns state_conflict when the task changes between read and write', async () => {
    const rows = [taskRow()]
    const { applyBody } = await previewThenApply(rows)
    const db = fakeSupabase(rows)
    const client = {
      from: (table: string) => {
        const real = db.client.from(table)
        return {
          select: real.select,
          update: (patch: Row) => {
            rows[0].updated_at = '2026-10-11T07:59:59.000000+00:00'
            return real.update(patch)
          },
        }
      },
    }
    const result = await executeTaskInstanceMove(
      { supabase: client, userId: USER }, TASK, 'inst-a', applyBody, vi.fn(), { now: () => T0, previewKey: KEY },
    )
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('state_conflict')
    expect(rows[0].instances[0].scheduledTime).toBe('10:00')
  })

  it('answers a retried apply from live state without writing again', async () => {
    const rows = [taskRow()]
    const { applyBody } = await previewThenApply(rows)
    expect((await run(rows, applyBody).promise).status).toBe(200)
    const { db, promise } = run(rows, applyBody)
    const retry = await promise
    expect(retry.status).toBe(200)
    expect(retry.body.alreadyApplied).toBe(true)
    expect(db.updates).toHaveLength(0)
  })

  it('keeps the same 404 boundary as the instance POST: unknown, cross-user, deleted task; unknown instance', async () => {
    expect((await run([taskRow()], MOVE, { userId: 'someone-else' }).promise).status).toBe(404)
    expect((await run([taskRow({ is_deleted: true })], MOVE).promise).status).toBe(404)
    expect((await run([], MOVE).promise).status).toBe(404)
    const missing = await run([taskRow()], MOVE, { instanceId: 'nope' }).promise
    expect(missing.status).toBe(404)
    expect(missing.body.error.code).toBe('instance_not_found')
  })

  it('validates date, time, duration and unknown fields like the instance POST', async () => {
    const cases: Array<[unknown, string]> = [
      [{ ...MOVE, scheduledDate: '2026-02-30' }, 'scheduledDate'],
      [{ ...MOVE, scheduledTime: '25:00' }, 'scheduledTime'],
      [{ ...MOVE, duration: 0 }, 'duration'],
      [{ ...MOVE, duration: 1441 }, 'duration'],
      [{ ...MOVE, preview: 'yes' }, 'preview'],
      [{ ...MOVE, title: 'x' }, 'unknown field'],
      [null, 'body'],
    ]
    for (const [body, message] of cases) {
      const result = await run([taskRow()], body).promise
      expect(result.status, JSON.stringify(body)).toBe(400)
      expect(result.body.error.message).toContain(message)
    }
  })

  it('rejects a no-op preview and an ambiguous instance id', async () => {
    const noop = await run([taskRow()], { scheduledDate: '2026-10-12', scheduledTime: '10:00' }).promise
    expect(noop.status).toBe(409)
    expect(noop.body.error.code).toBe('no_change')

    const dup = taskRow()
    dup.instances.push({ id: 'inst-a', scheduledDate: '2026-10-14', scheduledTime: '08:00', duration: 15 })
    const ambiguous = await run([dup], MOVE).promise
    expect(ambiguous.status).toBe(409)
    expect(ambiguous.body.error.code).toBe('ambiguous_instance')
  })
})
