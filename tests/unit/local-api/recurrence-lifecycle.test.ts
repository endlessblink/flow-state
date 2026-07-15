import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/recurrence-lifecycle.cjs')
const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260716010000_canonical_recurrence_lifecycle.sql')
const sqlContractPath = resolve(process.cwd(), 'scripts/db/test-recurrence-lifecycle-rpc.sql')

const taskId = '11111111-1111-4111-8111-111111111111'
const historyTaskId = '22222222-2222-4222-8222-222222222222'
const currentTaskId = '33333333-3333-4333-8333-333333333333'
const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const operationId = 'TASK-1965-edit-weekly-series'
const requestHash = 'a'.repeat(64)
const previewDigest = 'b'.repeat(64)
const previewExpiresAt = '2026-07-16T12:15:00.000Z'
const rule = { pattern: 'weekly', interval: 1, weekdays: [1, 4], endType: 'never' }

function context(rpc: ReturnType<typeof vi.fn>, overrides = {}) {
  return {
    signedUser: true,
    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    activeWorkspaceId: workspaceId,
    supabase: { rpc },
    ...overrides,
  }
}

function chainProjection(overrides = {}) {
  const projection = {
    ok: true,
    fresh: true,
    contractVersion: 'task-v1',
    seriesId: taskId,
    workspaceId,
    lifecycleStatus: 'active',
    definition: rule,
    seriesRevision: 7,
    history: [{
      id: '22222222-2222-4222-8222-222222222222', recurrenceCount: 1,
      dueDate: '2026-07-09', status: 'done', completedAt: '2026-07-09T08:00:00.000Z',
      canonicalRevision: 3, canonicalUpdatedAt: '2026-07-09T08:00:00.000Z',
    }],
    currentOccurrence: {
      id: taskId, recurrenceCount: 2, dueDate: '2026-07-16', status: 'todo',
      canonicalRevision: 7, canonicalUpdatedAt: '2026-07-16T08:00:00.000Z',
    },
    nextOccurrence: { dueDate: '2026-07-20', recurrenceCount: 3 },
    ...overrides,
  }
  return {
    ...projection,
    id: projection.seriesId,
    canonicalRevision: projection.seriesRevision,
    canonicalUpdatedAt: projection.currentOccurrence?.canonicalUpdatedAt || '2026-07-16T09:00:00.000Z',
  }
}

function affected(
  readBack: any,
  status: 'committed' | 'replayed' = 'committed',
  entityId = taskId,
  requestedTaskId = taskId,
) {
  const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs'))
  const entityReadBack = {
    id: entityId,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-16T09:00:00.000Z',
  }
  return {
    ok: true,
    result: 'committed',
    action: 'recurrence_edit_future',
    operationId,
    requestHash,
    receipt: {
      ok: true, status, replayed: status === 'replayed', operationId, requestHash,
      contractVersion: 'task-v1', source: 'local-api', entityType: 'task',
      action: 'recurrence_edit_future', entityId, canonicalRevision: 8,
      canonicalUpdatedAt: '2026-07-16T09:00:00.000Z', changeSequence: 19,
      committedAt: '2026-07-16T09:00:00.000Z', readBack,
      readBackHash: canonicalHash(readBack),
      affected: [{
        entityId, entityType: 'task', action: 'update', canonicalRevision: 8,
        changeSequence: 19, readBack: entityReadBack, readBackHash: canonicalHash(entityReadBack),
      }],
      operationContext: {
        action: 'recurrence_edit_future', seriesId: readBack.seriesId,
        requestedTaskId, currentTaskId: entityId,
      },
    },
  }
}

describe('TASK-1965 recurrence lifecycle Local API authority', () => {
  it('starts red until the recurrence lifecycle module exists', () => {
    expect(existsSync(modulePath)).toBe(true)
  })

  it('returns an exact signed-scope chain projection', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: chainProjection(), error: null })
    const { readRecurrenceChain } = require(modulePath)
    const result = await readRecurrenceChain(context(rpc), taskId)
    expect(result).toEqual({ status: 200, body: chainProjection() })
    expect(rpc).toHaveBeenCalledWith('flowstate_recurrence_chain_v1', {
      p_contract_version: 'task-v1', p_task_id: taskId, p_workspace_id: workspaceId,
    })
  })

  it('accepts an exact history occurrence request while preserving the canonical series root', async () => {
    const projection = chainProjection()
    const rpc = vi.fn().mockResolvedValue({ data: projection, error: null })
    const { readRecurrenceChain } = require(modulePath)

    expect(await readRecurrenceChain(context(rpc), historyTaskId)).toEqual({ status: 200, body: projection })
    expect(rpc).toHaveBeenCalledWith('flowstate_recurrence_chain_v1', expect.objectContaining({
      p_task_id: historyTaskId,
    }))
  })

  it('rejects a chain projection that does not contain the exact requested occurrence', async () => {
    const { readRecurrenceChain } = require(modulePath)
    const result = await readRecurrenceChain(
      context(vi.fn().mockResolvedValue({ data: chainProjection(), error: null })),
      '44444444-4444-4444-8444-444444444444',
    )

    expect(result.status).toBe(502)
    expect(result.body.error.code).toBe('invalid_canonical_response')
  })

  it.each([
    ['ambiguous_current_occurrence', chainProjection({ currentOccurrence: null, ambiguity: { code: 'ambiguous_current_occurrence' } })],
    ['ambiguous_history', chainProjection({ history: [], ambiguity: { code: 'ambiguous_history' } })],
  ])('fails closed when the canonical read reports %s', async (code, payload) => {
    const { readRecurrenceChain } = require(modulePath)
    const result = await readRecurrenceChain(context(vi.fn().mockResolvedValue({ data: payload })), taskId)
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe(code)
  })

  it('rejects forged history with duplicate occurrence dates or a reused current count', () => {
    const { validChainProjection } = require(modulePath)
    const duplicateDate = chainProjection({
      history: [
        chainProjection().history[0],
        { ...chainProjection().history[0], id: '33333333-3333-4333-8333-333333333333', recurrenceCount: 2 },
      ],
    })
    const reusedCount = chainProjection({
      currentOccurrence: { ...chainProjection().currentOccurrence, recurrenceCount: 1 },
    })
    expect(validChainProjection(duplicateDate)).toBe(false)
    expect(validChainProjection(reusedCount)).toBe(false)
  })

  it('rejects a chain whose top authority disagrees with the current occurrence', () => {
    const { validChainProjection } = require(modulePath)
    const revisionMismatch = chainProjection({
      currentOccurrence: {
        ...chainProjection().currentOccurrence,
        canonicalRevision: 6,
      },
    })
    const timestampMismatch = {
      ...chainProjection(),
      canonicalUpdatedAt: '2026-07-16T08:00:01.000Z',
    }

    expect(validChainProjection(revisionMismatch)).toBe(false)
    expect(validChainProjection(timestampMismatch)).toBe(false)
  })

  it('accepts native weekly and monthly rule variants without narrowing app semantics', () => {
    const { normalizeRule } = require(modulePath)
    expect(normalizeRule({ pattern: 'weekly', interval: 2, endType: 'never' })).toEqual({
      pattern: 'weekly', interval: 2, endType: 'never',
    })
    expect(normalizeRule({ pattern: 'monthly', interval: 1, endType: 'never' })).toEqual({
      pattern: 'monthly', interval: 1, endType: 'never',
    })
    expect(normalizeRule({
      pattern: 'monthly', interval: 1, monthWeekday: { nth: -1, day: 5 }, endType: 'never',
    })).not.toBeNull()
  })

  it('requires a signed user for reads and writes', async () => {
    const { readRecurrenceChain, executeRecurrenceLifecycle } = require(modulePath)
    const unsigned = context(vi.fn(), { signedUser: false })
    expect((await readRecurrenceChain(unsigned, taskId)).status).toBe(401)
    expect((await executeRecurrenceLifecycle(unsigned, { operationId, taskId, action: 'pause', baseRevision: 7 }, vi.fn())).status).toBe(401)
  })

  it('previews an edit-future definition by default and binds normalized input', async () => {
    const preview = {
      ok: true, result: 'preview', preview: true, contractVersion: 'task-v1',
      action: 'recurrence_edit_future', operationId, requestHash, previewDigest,
      previewExpiresAt, seriesId: taskId, workspaceId, baseRevision: 7,
      normalizedPayload: { action: 'edit_future', recurrenceRule: rule, nextDueDate: '2026-07-20' },
      readBack: chainProjection({ definition: rule, seriesRevision: 7 }),
    }
    const rpc = vi.fn().mockResolvedValue({ data: preview, error: null })
    const { executeRecurrenceLifecycle } = require(modulePath)
    const result = await executeRecurrenceLifecycle(context(rpc), {
      operationId, taskId, action: 'edit_future', baseRevision: 7,
      recurrenceRule: rule, nextDueDate: '2026-07-20', timeZone: 'Asia/Jerusalem',
    }, vi.fn())
    expect(result).toEqual({ status: 200, body: preview })
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_action: 'edit_future', p_preview: true, p_base_revision: 7,
      p_recurrence_rule: rule, p_next_due_date: '2026-07-20', p_time_zone: 'Asia/Jerusalem',
    })
  })

  it('accepts a history-member command preview rooted at the canonical series', async () => {
    const preview = {
      ok: true, result: 'preview', preview: true, contractVersion: 'task-v1',
      action: 'recurrence_pause', operationId, requestHash, previewDigest,
      previewExpiresAt, seriesId: taskId, workspaceId, baseRevision: 7,
      normalizedPayload: { action: 'pause', recurrenceRule: null, nextDueDate: null },
      readBack: chainProjection(),
    }
    const { executeRecurrenceLifecycle } = require(modulePath)
    const result = await executeRecurrenceLifecycle(context(vi.fn().mockResolvedValue({ data: preview })), {
      operationId, taskId: historyTaskId, action: 'pause', baseRevision: 7,
      timeZone: 'Asia/Jerusalem',
    }, vi.fn())

    expect(result.status).toBe(200)
    expect(result.body.seriesId).toBe(taskId)
    expect(result.body.readBack.id).toBe(taskId)
  })

  it('rejects apply without the complete approval receipt', async () => {
    const { executeRecurrenceLifecycle } = require(modulePath)
    const result = await executeRecurrenceLifecycle(context(vi.fn()), {
      preview: false, operationId, taskId, action: 'pause', baseRevision: 7,
      timeZone: 'Asia/Jerusalem',
    }, vi.fn())
    expect(result).toEqual({
      status: 400,
      body: { ok: false, error: { code: 'approval_receipt_required', message: expect.any(String) } },
    })
  })

  it.each(['pause', 'resume', 'end_series'])('normalizes and sends the %s lifecycle action', async action => {
    const preview = {
      ok: true, result: 'preview', preview: true, contractVersion: 'task-v1',
      action: `recurrence_${action}`, operationId, requestHash, previewDigest,
      previewExpiresAt, seriesId: taskId, workspaceId, baseRevision: 7,
      normalizedPayload: { action }, readBack: chainProjection(),
    }
    const rpc = vi.fn().mockResolvedValue({ data: preview })
    const { executeRecurrenceLifecycle } = require(modulePath)
    expect((await executeRecurrenceLifecycle(context(rpc), {
      operationId, taskId, action, baseRevision: 7, timeZone: 'Asia/Jerusalem',
    }, vi.fn())).status).toBe(200)
    expect(rpc.mock.calls[0][1].p_action).toBe(action)
  })

  it('accepts a verified commit, notifies once, and preserves exact history evidence', async () => {
    const readBack = chainProjection({
      seriesRevision: 8,
      definition: rule,
      currentOccurrence: {
        ...chainProjection().currentOccurrence,
        canonicalRevision: 8,
        canonicalUpdatedAt: '2026-07-16T09:00:00.000Z',
      },
    })
    const rpc = vi.fn().mockResolvedValue({ data: affected(readBack), error: null })
    const notify = vi.fn()
    const { executeRecurrenceLifecycle } = require(modulePath)
    const result = await executeRecurrenceLifecycle(context(rpc), {
      preview: false, operationId, taskId, action: 'edit_future', baseRevision: 7,
      recurrenceRule: rule, nextDueDate: '2026-07-20', timeZone: 'Asia/Jerusalem',
      requestHash, previewDigest, previewExpiresAt,
    }, notify)
    expect(result.status).toBe(200)
    expect(result.body.receipt.readBack.history).toEqual(readBack.history)
    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('update', taskId)
  })

  it('binds a member-requested commit to the mutated current occurrence and series-root readback', async () => {
    const readBack = chainProjection({
      seriesRevision: 8,
      currentOccurrence: {
        ...chainProjection().currentOccurrence,
        id: currentTaskId,
        canonicalRevision: 8,
        canonicalUpdatedAt: '2026-07-16T09:00:00.000Z',
      },
    })
    const payload = affected(readBack, 'committed', currentTaskId, historyTaskId)
    const notify = vi.fn()
    const { executeRecurrenceLifecycle } = require(modulePath)
    const result = await executeRecurrenceLifecycle(context(vi.fn().mockResolvedValue({ data: payload })), {
      preview: false, operationId, taskId: historyTaskId, action: 'edit_future', baseRevision: 7,
      recurrenceRule: rule, timeZone: 'Asia/Jerusalem', requestHash, previewDigest, previewExpiresAt,
    }, notify)

    expect(result.status).toBe(200)
    expect(result.body.receipt.entityId).toBe(currentTaskId)
    expect(result.body.receipt.readBack.id).toBe(taskId)
    expect(notify).toHaveBeenCalledWith('update', currentTaskId)
  })

  it('treats response-loss retry as stable replay without duplicate notification', async () => {
    const readBack = chainProjection({
      seriesRevision: 8,
      currentOccurrence: {
        ...chainProjection().currentOccurrence,
        canonicalRevision: 8,
        canonicalUpdatedAt: '2026-07-16T09:00:00.000Z',
      },
    })
    const notify = vi.fn()
    const { executeRecurrenceLifecycle } = require(modulePath)
    const result = await executeRecurrenceLifecycle(
      context(vi.fn().mockResolvedValue({ data: affected(readBack, 'replayed') })),
      { preview: false, operationId, taskId, action: 'edit_future', baseRevision: 7,
        recurrenceRule: rule, timeZone: 'Asia/Jerusalem', requestHash, previewDigest, previewExpiresAt },
      notify,
    )
    expect(result.status).toBe(200)
    expect(result.body.receipt.replayed).toBe(true)
    expect(notify).not.toHaveBeenCalled()
  })

  it('maps typed domain conflicts without claiming success', async () => {
    const { executeRecurrenceLifecycle } = require(modulePath)
    const result = await executeRecurrenceLifecycle(
      context(vi.fn().mockResolvedValue({ data: { ok: false, error: { code: 'stale_revision', currentRevision: 9 } } })),
      { operationId, taskId, action: 'pause', baseRevision: 7, timeZone: 'Asia/Jerusalem' },
      vi.fn(),
    )
    expect(result.status).toBe(409)
    expect(result.body.error.currentRevision).toBe(9)
  })
})

describe('TASK-1965 recurrence lifecycle SQL contract source', () => {
  it('defines signed exact-read and preview/apply RPCs plus rollback-only proof', () => {
    expect(existsSync(migrationPath)).toBe(true)
    expect(existsSync(sqlContractPath)).toBe(true)
    const migration = readFileSync(migrationPath, 'utf8')
    const contract = readFileSync(sqlContractPath, 'utf8')
    expect(migration).toContain('flowstate_recurrence_chain_v1')
    expect(migration).toContain('flowstate_recurrence_lifecycle_v1')
    expect(migration).toContain('ambiguous_current_occurrence')
    expect(migration).toContain('ambiguous_history')
    expect(migration).toContain('canonical_operation_previews')
    expect(migration).toContain('canonical_operations')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('auth.uid()')
    expect(migration).toContain('public.flowstate_can_read_workspace_v1(p_workspace_id)')
    expect(migration).toContain('REVOKE ALL ON FUNCTION')
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION')
    expect(contract).toContain('TASK-1965')
    expect(contract).toContain('history changed during recurrence lifecycle mutation')
    expect(contract).toContain('response-loss replay')
    expect(contract).toContain('workspace viewer can read recurrence evidence')
    expect(contract).toContain('workspace viewer cannot mutate recurrence')
    expect(contract).toContain('injected recurrence lifecycle rollback')
    expect(contract).toContain('ROLLBACK;')
  })
})
