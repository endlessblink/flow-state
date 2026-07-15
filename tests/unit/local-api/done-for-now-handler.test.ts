import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')) as {
  canonicalHash: (value: unknown) => string
}

type RpcResult = { data: unknown; error: { message: string } | null }

function createHarness(result: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(result)
  const notifyTaskMutation = vi.fn()
  const { executeDoneForNow } = require('../../../server/local-api/done-for-now.cjs') as {
    executeDoneForNow: (
      context: { supabase: { rpc: typeof rpc }; activeWorkspaceId?: string | null },
      taskId: string,
      body: Record<string, unknown>,
      notify: typeof notifyTaskMutation,
    ) => Promise<{ status: number; body: Record<string, unknown> }>
  }
  return { executeDoneForNow, notifyTaskMutation, rpc }
}

const requestHash = 'a'.repeat(64)
const previewVersion = 'b'.repeat(64)

const preview = {
  ok: true,
  result: 'preview',
  preview: true,
  contractVersion: 'task-v1',
  operationId: 'operation-1',
  requestHash,
  previewVersion,
  task: { id: 'task-1', title: 'Recurring fixture' },
  currentOccurrence: { dueDate: '2026-07-12', statusBefore: 'todo', statusAfter: 'done' },
  recurrence: { nextDueDateAfter: '2026-07-16', cadencePreserved: true },
}

function committedReceipt(overrides: Record<string, unknown> = {}) {
  const livingReadBack = {
    id: 'task-1', title: 'Recurring fixture', status: 'todo', completedAt: null,
    dueDate: '2026-07-16T00:00:00+00:00', isDeleted: false, deletedAt: null,
    workspaceId: null, canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T12:00:00.000Z',
    recurrenceRule: { pattern: 'weekly', interval: 1 }, recurrenceParentId: null,
    recurrenceCount: 2, isCompletionRecord: false,
  }
  const completionReadBack = {
    id: 'history-1', title: 'Recurring fixture', status: 'done',
    completedAt: '2026-07-15T12:00:00.000Z', dueDate: '2026-07-12T00:00:00+00:00',
    isDeleted: false, deletedAt: null, workspaceId: null, canonicalRevision: 1,
    canonicalUpdatedAt: '2026-07-15T12:00:00.000Z', recurrenceRule: null,
    recurrenceParentId: 'task-1', recurrenceCount: 1, isCompletionRecord: true,
  }
  const readBack = {
    ...livingReadBack,
    completedOccurrence: {
      id: 'history-1', status: 'done', dueDate: '2026-07-12',
      completedAt: '2026-07-15T12:00:00.000Z',
    },
    nextOccurrence: {
      id: 'instance-2', taskId: 'task-1', status: 'todo', dueDate: '2026-07-16',
      scheduledTime: '09:00', duration: 30,
    },
  }
  return {
    ok: true,
    status: 'committed',
    operationId: 'operation-1',
    requestHash,
    contractVersion: 'task-v1',
    source: 'local-api',
    entityType: 'task',
    action: 'done_for_now',
    entityId: 'task-1',
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T12:00:00.000Z',
    changeSequence: 42,
    committedAt: '2026-07-15T12:00:01.000Z',
    replayed: false,
    affected: [
      {
        entityId: 'task-1', entityType: 'task', action: 'update',
        canonicalRevision: 8, changeSequence: 42,
        readBack: livingReadBack, readBackHash: canonicalHash(livingReadBack),
      },
      {
        entityId: 'history-1', entityType: 'task', action: 'create',
        canonicalRevision: 1, changeSequence: 41,
        readBack: completionReadBack, readBackHash: canonicalHash(completionReadBack),
      },
    ],
    readBack,
    readBackHash: canonicalHash(readBack),
    ...overrides,
  }
}

const applyBody = {
  preview: false,
  requestId: 'operation-1',
  requestHash,
  previewVersion,
  nextDueDate: '2026-07-16',
}

describe('Local API recurring Done for now handler', () => {
  it('rejects a malformed request without calling the database', async () => {
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: null, error: null })
    const result = await executeDoneForNow(
      { supabase: { rpc } }, 'task-1', null as never, notifyTaskMutation,
    )
    expect(result).toMatchObject({ status: 400, body: { error: { code: 'invalid_request' } } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('validates the canonical preview without notifying the renderer', async () => {
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: preview, error: null })

    await expect(executeDoneForNow(
      { supabase: { rpc }, activeWorkspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
      'task-1',
      { requestId: 'operation-1', preview: true, nextDueDate: '2026-07-16' },
      notifyTaskMutation,
    )).resolves.toEqual({ status: 200, body: preview })

    expect(rpc).toHaveBeenCalledWith('flowstate_done_for_now', {
      p_next_due_date: '2026-07-16',
      p_preview: true,
      p_preview_version: null,
      p_request_hash: null,
      p_request_id: 'operation-1',
      p_task_id: 'task-1',
      p_workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it.each(['requestId', 'previewVersion', 'requestHash'])('requires %s before apply', async (field) => {
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: null, error: null })
    const body = { ...applyBody }
    delete body[field as keyof typeof body]

    const result = await executeDoneForNow(
      { supabase: { rpc }, activeWorkspaceId: null }, 'task-1', body, notifyTaskMutation,
    )

    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({ ok: false, error: { code: 'approval_receipt_required' } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['requestId', ' operation-1'],
    ['requestId', 'operation-1 '],
    ['requestHash', ` ${requestHash}`],
    ['requestHash', `${requestHash} `],
  ])('rejects padded %s before the RPC', async (field, value) => {
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: null, error: null })
    const result = await executeDoneForNow(
      { supabase: { rpc }, activeWorkspaceId: null }, 'task-1', { ...applyBody, [field]: value }, notifyTaskMutation,
    )

    expect(result.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('accepts only a canonical committed receipt before notifying both affected tasks', async () => {
    const receipt = committedReceipt()
    const response = { ok: true, result: 'committed', requestHash, receipt }
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: response, error: null })

    const result = await executeDoneForNow(
      { supabase: { rpc }, activeWorkspaceId: null }, 'task-1', applyBody, notifyTaskMutation,
    )

    expect(result).toEqual({ status: 200, body: response })
    expect(rpc).toHaveBeenCalledWith('flowstate_done_for_now', expect.objectContaining({
      p_request_hash: requestHash,
      p_request_id: 'operation-1',
    }))
    expect(notifyTaskMutation).toHaveBeenNthCalledWith(1, 'create', 'history-1')
    expect(notifyTaskMutation).toHaveBeenNthCalledWith(2, 'update', 'task-1')
  })

  it.each([
    ['HTTP-only success', { ok: true }],
    ['forged hash', { ok: true, result: 'committed', requestHash, receipt: committedReceipt({ readBackHash: 'f'.repeat(64) }) }],
    ['operation mismatch', { ok: true, result: 'committed', requestHash, receipt: committedReceipt({ operationId: 'other' }) }],
    ['missing affected revisions', { ok: true, result: 'committed', requestHash, receipt: committedReceipt({ affected: [] }) }],
    ['forged affected read-back', {
      ok: true, result: 'committed', requestHash,
      receipt: committedReceipt({
        affected: committedReceipt().affected.map((entry: Record<string, unknown>, index: number) => (
          index === 0 ? { ...entry, readBackHash: 'f'.repeat(64) } : entry
        )),
      }),
    }],
    ['wrong affected entity type', {
      ok: true, result: 'committed', requestHash,
      receipt: committedReceipt({
        affected: committedReceipt().affected.map((entry: Record<string, unknown>, index: number) => (
          index === 1 ? { ...entry, entityType: 'project' } : entry
        )),
      }),
    }],
    ['duplicate affected identity', {
      ok: true, result: 'committed', requestHash,
      receipt: committedReceipt({
        affected: committedReceipt().affected.map((entry: Record<string, unknown>, index: number) => (
          index === 1 ? { ...entry, entityId: 'task-1' } : entry
        )),
      }),
    }],
  ])('rejects %s before renderer notification', async (_label, data) => {
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data, error: null })

    const result = await executeDoneForNow(
      { supabase: { rpc }, activeWorkspaceId: null }, 'task-1', applyBody, notifyTaskMutation,
    )

    expect(result.status).toBe(502)
    expect(result.body).toMatchObject({ ok: false, error: { code: 'invalid_canonical_receipt' } })
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('accepts a replay receipt when the optional replayed alias is absent', async () => {
    const receipt = committedReceipt({ status: 'replayed', replayed: undefined })
    const response = { ok: true, result: 'committed', requestHash, receipt }
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: response, error: null })

    const result = await executeDoneForNow(
      { supabase: { rpc }, activeWorkspaceId: null }, 'task-1', applyBody, notifyTaskMutation,
    )

    expect(result.status).toBe(200)
    expect(notifyTaskMutation).toHaveBeenCalledTimes(2)
  })

  it('rejects a contradictory replay alias before notification', async () => {
    const receipt = committedReceipt({ status: 'replayed', replayed: false })
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({
      data: { ok: true, result: 'committed', requestHash, receipt }, error: null,
    })

    const result = await executeDoneForNow(
      { supabase: { rpc }, activeWorkspaceId: null }, 'task-1', applyBody, notifyTaskMutation,
    )

    expect(result.status).toBe(502)
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('rejects a malformed preview instead of returning HTTP-only success', async () => {
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: { ok: true }, error: null })

    const result = await executeDoneForNow(
      { supabase: { rpc } }, 'task-1', { requestId: 'operation-1' }, notifyTaskMutation,
    )

    expect(result.status).toBe(502)
    expect(result.body).toMatchObject({ error: { code: 'invalid_canonical_response' } })
  })

  it.each([
    ['not_found', 404], ['not_recurring', 409], ['already_completed', 409],
    ['idempotency_conflict', 409], ['state_conflict', 409], ['invalid_next_date', 400],
    ['recurrence_calculation_failed', 422], ['recurrence_exhausted', 409], ['not_authenticated', 401],
  ])('maps typed domain error %s to HTTP %s', async (code, status) => {
    const domainError = { ok: false, error: { code, message: 'safe message' } }
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({ data: domainError, error: null })

    const result = await executeDoneForNow(
      { supabase: { rpc } }, 'task-1', { requestId: 'operation-1' }, notifyTaskMutation,
    )

    expect(result).toEqual({ status, body: domainError })
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('redacts database failures', async () => {
    const { executeDoneForNow, notifyTaskMutation, rpc } = createHarness({
      data: null, error: { message: 'private database detail' },
    })
    const result = await executeDoneForNow(
      { supabase: { rpc } }, 'task-1', { requestId: 'operation-1' }, notifyTaskMutation,
    )
    expect(result).toEqual({
      status: 500,
      body: { error: { code: 'recurrence_transaction_failed', message: 'Done for now could not be completed' }, ok: false },
    })
  })
})
