import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')) as {
  canonicalHash: (value: unknown) => string
}

function harness(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error })
  const notify = vi.fn()
  const { executeMergeTasks } = require('../../../server/local-api/merge-tasks.cjs') as {
    executeMergeTasks: (
      context: { supabase: { rpc: typeof rpc }; activeWorkspaceId: string | null },
      survivorId: string,
      body: Record<string, unknown>,
      notifyMutation: typeof notify,
    ) => Promise<{ status: number; body: unknown }>
  }
  return { executeMergeTasks, notify, rpc }
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
  survivor: { id: 'survivor-1', title: 'Keep' },
  duplicate: { id: 'duplicate-1', title: 'Archive' },
}

function committedReceipt(overrides: Record<string, unknown> = {}) {
  const survivorReadBack = {
    id: 'survivor-1', title: 'Keep', status: 'todo', completedAt: null,
    dueDate: null, isDeleted: false, deletedAt: null, workspaceId: null,
    canonicalRevision: 8, canonicalUpdatedAt: '2026-07-15T12:00:00.000Z',
    recurrenceRule: null, recurrenceParentId: null, recurrenceCount: 0,
    isCompletionRecord: false,
  }
  const duplicateReadBack = {
    id: 'duplicate-1', title: 'Archive', status: 'todo', completedAt: null,
    dueDate: null, isDeleted: true, deletedAt: '2026-07-15T12:00:00.000Z',
    workspaceId: null, canonicalRevision: 5,
    canonicalUpdatedAt: '2026-07-15T12:00:00.000Z', recurrenceRule: null,
    recurrenceParentId: null, recurrenceCount: 0, isCompletionRecord: false,
  }
  const readBack = {
    ...survivorReadBack,
    survivorTaskId: 'survivor-1',
    duplicateTaskId: 'duplicate-1',
    duplicateArchived: true,
  }
  return {
    ok: true,
    status: 'committed',
    operationId: 'operation-1',
    requestHash,
    contractVersion: 'task-v1',
    source: 'local-api',
    entityType: 'task',
    action: 'merge',
    entityId: 'survivor-1',
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T12:00:00.000Z',
    changeSequence: 43,
    committedAt: '2026-07-15T12:00:01.000Z',
    replayed: false,
    affected: [
      {
        entityId: 'survivor-1', entityType: 'task', action: 'update',
        canonicalRevision: 8, changeSequence: 43,
        readBack: survivorReadBack, readBackHash: canonicalHash(survivorReadBack),
      },
      {
        entityId: 'duplicate-1', entityType: 'task', action: 'archive',
        canonicalRevision: 5, changeSequence: 42,
        readBack: duplicateReadBack, readBackHash: canonicalHash(duplicateReadBack),
      },
    ],
    readBack,
    readBackHash: canonicalHash(readBack),
    ...overrides,
  }
}

const applyBody = {
  duplicateTaskId: 'duplicate-1',
  preview: false,
  requestId: 'operation-1',
  requestHash,
  previewVersion,
}

describe('Local API duplicate-task merge handler', () => {
  it('rejects a malformed request without calling the database', async () => {
    const { executeMergeTasks, notify, rpc } = harness(null)
    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null }, 'survivor-1', null as never, notify,
    )
    expect(result).toMatchObject({ status: 400, body: { error: { code: 'invalid_request' } } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('validates a non-mutating preview and passes exact scope', async () => {
    const { executeMergeTasks, notify, rpc } = harness(preview)

    await expect(executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: 'workspace-1' },
      'survivor-1',
      { duplicateTaskId: 'duplicate-1', requestId: 'operation-1' },
      notify,
    )).resolves.toEqual({ status: 200, body: preview })

    expect(rpc).toHaveBeenCalledWith('flowstate_merge_tasks', {
      p_duplicate_task_id: 'duplicate-1',
      p_preview: true,
      p_preview_version: null,
      p_request_hash: null,
      p_request_id: 'operation-1',
      p_survivor_task_id: 'survivor-1',
      p_workspace_id: 'workspace-1',
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('routes explicit recurrence through the same canonical envelope contract', async () => {
    const recurrence = { pattern: 'daily', interval: 3, endType: 'never' }
    const recurrencePreview = { ...preview, recurrenceResolution: recurrence }
    const { executeMergeTasks, notify, rpc } = harness(recurrencePreview)

    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1',
      { duplicateTaskId: 'duplicate-1', requestId: 'operation-1', recurrenceResolution: recurrence },
      notify,
    )

    expect(result.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('flowstate_merge_tasks_with_recurrence', expect.objectContaining({
      p_recurrence_resolution: recurrence,
      p_request_id: 'operation-1',
      p_request_hash: null,
    }))
  })

  it.each(['requestId', 'previewVersion', 'requestHash'])('requires %s before apply', async (field) => {
    const { executeMergeTasks, notify, rpc } = harness(null)
    const body = { ...applyBody }
    delete body[field as keyof typeof body]

    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null }, 'survivor-1', body, notify,
    )
    expect(result).toMatchObject({ status: 400, body: { error: { code: 'approval_receipt_required' } } })
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['requestId', ' operation-1'],
    ['requestId', 'operation-1 '],
    ['requestHash', ` ${requestHash}`],
    ['requestHash', `${requestHash} `],
  ])('rejects padded %s before the RPC', async (field, value) => {
    const { executeMergeTasks, notify, rpc } = harness(null)
    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', { ...applyBody, [field]: value }, notify,
    )

    expect(result.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects identical task identities without an RPC or notification', async () => {
    const { executeMergeTasks, notify, rpc } = harness(null)
    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', { ...applyBody, duplicateTaskId: 'survivor-1' }, notify,
    )

    expect(result.status).toBe(400)
    expect(rpc).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('notifies only after a canonical receipt proves both affected task rows', async () => {
    const receipt = committedReceipt()
    const response = { ok: true, result: 'committed', requestHash, receipt }
    const { executeMergeTasks, notify, rpc } = harness(response)

    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null }, 'survivor-1', applyBody, notify,
    )

    expect(result).toEqual({ status: 200, body: response })
    expect(rpc).toHaveBeenCalledWith('flowstate_merge_tasks', expect.objectContaining({ p_request_hash: requestHash }))
    expect(notify).toHaveBeenNthCalledWith(1, 'update', 'survivor-1')
    expect(notify).toHaveBeenNthCalledWith(2, 'delete', 'duplicate-1')
  })

  it.each([
    ['title', 'Forged survivor title'],
    ['status', 'in_progress'],
    ['dueDate', '2026-08-01T00:00:00+00:00'],
  ])('rejects a SQL-shaped receipt whose top read-back recomputes a different %s', async (field, value) => {
    const receipt = committedReceipt()
    const readBack = { ...(receipt.readBack as Record<string, unknown>), [field]: value }
    const response = {
      ok: true,
      result: 'committed',
      requestHash,
      receipt: { ...receipt, readBack, readBackHash: canonicalHash(readBack) },
    }
    const { executeMergeTasks, notify, rpc } = harness(response)

    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null }, 'survivor-1', applyBody, notify,
    )

    expect(result.status).toBe(502)
    expect(notify).not.toHaveBeenCalled()
  })

  it('accepts the migrated recurrence merge receipt through operation context and primary read-back', async () => {
    const recurrenceResolution = { pattern: 'daily', interval: 3, endType: 'never' }
    const base = committedReceipt()
    const survivorReadBack = {
      ...(base.affected[0].readBack as Record<string, unknown>),
      recurrenceRule: recurrenceResolution,
    }
    const readBack = {
      ...(base.readBack as Record<string, unknown>),
      recurrenceRule: recurrenceResolution,
    }
    const receipt = {
      ...base,
      operationContext: { recurrenceResolution },
      affected: [
        { ...base.affected[0], readBack: survivorReadBack, readBackHash: canonicalHash(survivorReadBack) },
        base.affected[1],
      ],
      readBack,
      readBackHash: canonicalHash(readBack),
    }
    const response = { ok: true, result: 'committed', requestHash, receipt }
    const { executeMergeTasks, notify, rpc } = harness(response)

    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', { ...applyBody, recurrenceResolution }, notify,
    )

    expect(result.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('flowstate_merge_tasks_with_recurrence', expect.objectContaining({
      p_recurrence_resolution: recurrenceResolution,
      p_request_hash: requestHash,
    }))
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['HTTP-only success', { ok: true }],
    ['forged hash', { ok: true, result: 'committed', requestHash, receipt: committedReceipt({ readBackHash: 'f'.repeat(64) }) }],
    ['request mismatch', { ok: true, result: 'committed', requestHash, receipt: committedReceipt({ requestHash: 'c'.repeat(64) }) }],
    ['missing affected revisions', { ok: true, result: 'committed', requestHash, receipt: committedReceipt({ affected: [] }) }],
    ['mismatched primary affected id', {
      ok: true, result: 'committed', requestHash,
      receipt: committedReceipt({
        affected: committedReceipt().affected.map((entry: Record<string, unknown>, index: number) => (
          index === 0 ? { ...entry, entityId: 'other-task' } : entry
        )),
      }),
    }],
    ['mismatched primary affected revision', {
      ok: true, result: 'committed', requestHash,
      receipt: committedReceipt({
        affected: committedReceipt().affected.map((entry: Record<string, unknown>, index: number) => (
          index === 0 ? { ...entry, canonicalRevision: 9 } : entry
        )),
      }),
    }],
    ['mismatched primary affected sequence', {
      ok: true, result: 'committed', requestHash,
      receipt: committedReceipt({
        affected: committedReceipt().affected.map((entry: Record<string, unknown>, index: number) => (
          index === 0 ? { ...entry, changeSequence: 44 } : entry
        )),
      }),
    }],
    ['forged affected read-back', {
      ok: true, result: 'committed', requestHash,
      receipt: committedReceipt({
        affected: committedReceipt().affected.map((entry: Record<string, unknown>, index: number) => (
          index === 1 ? { ...entry, readBackHash: 'f'.repeat(64) } : entry
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
          index === 1 ? { ...entry, entityId: 'survivor-1' } : entry
        )),
      }),
    }],
  ])('rejects %s before renderer notification', async (_label, data) => {
    const { executeMergeTasks, notify, rpc } = harness(data)

    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null }, 'survivor-1', applyBody, notify,
    )
    expect(result.status).toBe(502)
    expect(result.body).toMatchObject({ ok: false, error: { code: 'invalid_canonical_receipt' } })
    expect(notify).not.toHaveBeenCalled()
  })

  it('accepts a replay receipt when the optional replayed alias is absent', async () => {
    const receipt = committedReceipt({ status: 'replayed', replayed: undefined })
    const response = { ok: true, result: 'committed', requestHash, receipt }
    const { executeMergeTasks, notify, rpc } = harness(response)

    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null }, 'survivor-1', applyBody, notify,
    )

    expect(result.status).toBe(200)
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('rejects a contradictory replay alias before notification', async () => {
    const receipt = committedReceipt({ status: 'replayed', replayed: false })
    const { executeMergeTasks, notify, rpc } = harness({ ok: true, result: 'committed', requestHash, receipt })

    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null }, 'survivor-1', applyBody, notify,
    )

    expect(result.status).toBe(502)
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects malformed preview success', async () => {
    const { executeMergeTasks, notify, rpc } = harness({ ok: true })
    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', { duplicateTaskId: 'duplicate-1', requestId: 'operation-1' }, notify,
    )
    expect(result.status).toBe(502)
    expect(result.body).toMatchObject({ error: { code: 'invalid_canonical_response' } })
  })

  it('preserves unresolved recurrence as a stop-and-clarify action', async () => {
    const body = {
      ok: false,
      error: { code: 'incompatible_recurrence', message: 'Recurrences differ' },
    }
    const { executeMergeTasks, notify, rpc } = harness(body)
    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', { duplicateTaskId: 'duplicate-1', requestId: 'operation-1' }, notify,
    )
    expect(result).toEqual({
      status: 409,
      body: { ...body, action: 'stop_mutations_and_request_recurrence_resolution' },
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('preserves established recurrence history as a stop-and-report action', async () => {
    const body = {
      ok: false,
      error: { code: 'recurrence_history_unsupported', message: 'History cannot be merged' },
    }
    const { executeMergeTasks, notify, rpc } = harness(body)
    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', {
        duplicateTaskId: 'duplicate-1', requestId: 'operation-1',
        recurrenceResolution: { pattern: 'daily', interval: 3, endType: 'never' },
      }, notify,
    )
    expect(result).toEqual({
      status: 409,
      body: { ...body, action: 'stop_mutations_and_report_recurrence_history' },
    })
  })

  it('sanitizes database failures', async () => {
    const { executeMergeTasks, notify, rpc } = harness(null, { message: 'private database detail' })
    const result = await executeMergeTasks(
      { supabase: { rpc }, activeWorkspaceId: null },
      'survivor-1', { duplicateTaskId: 'duplicate-1', requestId: 'operation-1' }, notify,
    )
    expect(result).toEqual({
      status: 500,
      body: { ok: false, error: { code: 'merge_transaction_failed', message: 'Tasks could not be merged' } },
    })
  })
})
