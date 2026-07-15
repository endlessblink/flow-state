import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/complete-task.cjs')
const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')) as {
  canonicalHash: (value: unknown) => string
}
const moduleExists = existsSync(modulePath)

type RpcResult = { data: unknown; error: unknown }
type HandlerResult = { status: number; body: Record<string, unknown> }
type ExecuteCompleteTask = (
  context: {
    supabase: { rpc: ReturnType<typeof vi.fn> }
    activeWorkspaceId: string | null
    signedUser?: boolean
  },
  taskId: string,
  body: Record<string, unknown>,
  notifyTaskMutation: ReturnType<typeof vi.fn>,
) => Promise<HandlerResult>

function harness(result: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(result)
  const notifyTaskMutation = vi.fn()
  const { executeCompleteTask } = require(modulePath) as {
    executeCompleteTask: ExecuteCompleteTask
  }

  return { executeCompleteTask, notifyTaskMutation, rpc }
}

const context = (rpc: ReturnType<typeof vi.fn>) => ({
  supabase: { rpc },
  activeWorkspaceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  signedUser: true,
})

const preview = {
  ok: true,
  result: 'preview',
  contractVersion: 'task-v1',
  operationId: 'operation-1',
  baseRevision: 7,
  requestHash: 'c'.repeat(64),
  previewDigest: 'a'.repeat(64),
  previewExpiresAt: '2026-07-15T12:15:00.000Z',
  normalizedPayload: { status: 'done' },
  willSetCompletedAt: true,
  readBack: { id: 'task-1', title: 'Before', status: 'todo', canonicalRevision: 7 },
}

function committedReceipt(overrides: Record<string, unknown> = {}) {
  const readBack = {
    id: 'task-1',
    title: 'Before',
    status: 'done',
    completedAt: '2026-07-15T12:01:00.000Z',
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T12:01:00.000Z',
  }
  return {
    ok: true,
    status: 'committed',
    contractVersion: 'task-v1',
    operationId: 'operation-1',
    requestHash: 'c'.repeat(64),
    source: 'local-api',
    entityType: 'task',
    action: 'complete',
    entityId: 'task-1',
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T12:01:00.000Z',
    changeSequence: 42,
    replayed: false,
    committedAt: '2026-07-15T12:01:00.000Z',
    affected: [{
      entityId: 'task-1', entityType: 'task', action: 'update',
      canonicalRevision: 8, changeSequence: 42,
      readBack, readBackHash: canonicalHash(readBack),
    }],
    readBack,
    readBackHash: canonicalHash(readBack),
    ...overrides,
  }
}

const applyBody = {
  preview: false,
  operationId: 'operation-1',
  baseRevision: 7,
  previewDigest: 'a'.repeat(64),
  previewExpiresAt: '2026-07-15T12:15:00.000Z',
  requestHash: 'c'.repeat(64),
}

describe.runIf(moduleExists)('executeCompleteTask', () => {
  it('rejects service-role contexts without a signed user session', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({ data: preview, error: null })

    const result = await executeCompleteTask(
      { ...context(rpc), signedUser: false },
      'task-1',
      { operationId: 'operation-1', baseRevision: 7 },
      notifyTaskMutation,
    )

    expect(result.status).toBe(401)
    expect((result.body.error as { code: string }).code).toBe('signed_user_required')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects an invalid request body without calling the database', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({ data: preview, error: null })

    const result = await executeCompleteTask(context(rpc), 'task-1', [] as never, notifyTaskMutation)

    expect(result.status).toBe(400)
    expect((result.body.error as { code: string }).code).toBe('invalid_request')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('requires the full approval binding for apply', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({ data: preview, error: null })

    const result = await executeCompleteTask(
      context(rpc),
      'task-1',
      { preview: false, operationId: 'operation-1', baseRevision: 7 },
      notifyTaskMutation,
    )

    expect(result.status).toBe(400)
    expect((result.body.error as { code: string }).code).toBe('approval_receipt_required')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('requires the server-issued request hash for apply', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({ data: preview, error: null })
    const { requestHash: _requestHash, ...withoutRequestHash } = applyBody

    const result = await executeCompleteTask(
      context(rpc), 'task-1', withoutRequestHash, notifyTaskMutation,
    )

    expect(result.status).toBe(400)
    expect((result.body.error as { code: string }).code).toBe('approval_receipt_required')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('forwards exact preview parameters including personal null workspace scope', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({ data: preview, error: null })

    const result = await executeCompleteTask(
      { supabase: { rpc }, activeWorkspaceId: null, signedUser: true },
      'task-1',
      { operationId: 'operation-1', baseRevision: 7 },
      notifyTaskMutation,
    )

    expect(result.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('flowstate_complete_task_v1', {
      p_base_revision: 7,
      p_contract_version: 'task-v1',
      p_operation_id: 'operation-1',
      p_preview: true,
      p_preview_digest: null,
      p_preview_expires_at: null,
      p_request_hash: null,
      p_source: 'local-api',
      p_task_id: 'task-1',
      p_workspace_id: null,
    })
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('maps recurring_task rejections to a typed 409', async () => {
    const rejection = {
      ok: false,
      result: 'rejected',
      error: { code: 'recurring_task', message: 'Recurring tasks must be completed with the recurring flow' },
    }
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({ data: rejection, error: null })

    const result = await executeCompleteTask(context(rpc), 'task-1', applyBody, notifyTaskMutation)

    expect(result.status).toBe(409)
    expect(result.body).toEqual(rejection)
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('maps already_completed conflicts to a typed 409', async () => {
    const conflict = {
      ok: false,
      result: 'conflict',
      error: { code: 'already_completed', message: 'Task is already completed' },
    }
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({ data: conflict, error: null })

    const result = await executeCompleteTask(context(rpc), 'task-1', applyBody, notifyTaskMutation)

    expect(result.status).toBe(409)
    expect(result.body).toEqual(conflict)
  })

  it('redacts database errors instead of exposing internals', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "canonical_operations_pkey"' },
    })

    const result = await executeCompleteTask(context(rpc), 'task-1', applyBody, notifyTaskMutation)

    expect(result.status).toBe(500)
    expect(result.body).toEqual({
      ok: false,
      error: { code: 'canonical_task_complete_failed', message: 'Task completion could not be committed' },
    })
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('rejects previews that do not prove completedAt will be set', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({
      data: { ...preview, willSetCompletedAt: undefined },
      error: null,
    })

    const result = await executeCompleteTask(
      context(rpc),
      'task-1',
      { operationId: 'operation-1', baseRevision: 7 },
      notifyTaskMutation,
    )

    expect(result.status).toBe(502)
    expect((result.body.error as { code: string }).code).toBe('invalid_canonical_response')
  })

  it('accepts a verified committed receipt and notifies the renderer once', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({
      data: { ok: true, result: 'committed', requestHash: 'c'.repeat(64), receipt: committedReceipt() },
      error: null,
    })

    const result = await executeCompleteTask(context(rpc), 'task-1', applyBody, notifyTaskMutation)

    expect(result.status).toBe(200)
    expect(notifyTaskMutation).toHaveBeenCalledTimes(1)
    expect(notifyTaskMutation).toHaveBeenCalledWith('update', 'task-1')
  })

  it('rejects a committed envelope with a mismatched request hash', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({
      data: {
        ok: true,
        result: 'committed',
        requestHash: 'd'.repeat(64),
        receipt: committedReceipt(),
      },
      error: null,
    })

    const result = await executeCompleteTask(context(rpc), 'task-1', applyBody, notifyTaskMutation)

    expect(result.status).toBe(502)
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it.each([
    ['missing affected evidence', undefined],
    ['mismatched primary id', [{
      ...committedReceipt().affected[0], entityId: 'another-task',
    }]],
    ['mismatched primary revision', [{
      ...committedReceipt().affected[0], canonicalRevision: 9,
    }]],
    ['mismatched primary sequence', [{
      ...committedReceipt().affected[0], changeSequence: 43,
    }]],
    ['forged primary read-back hash', [{
      ...committedReceipt().affected[0], readBackHash: 'f'.repeat(64),
    }]],
  ])('rejects %s before renderer notification', async (_label, affected) => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({
      data: {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: committedReceipt({ affected }),
      },
      error: null,
    })

    const result = await executeCompleteTask(context(rpc), 'task-1', applyBody, notifyTaskMutation)

    expect(result.status).toBe(502)
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('rejects a receipt whose read-back does not prove completion', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({
      data: {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: committedReceipt({
          readBack: { id: 'task-1', title: 'Before', status: 'todo', completedAt: null, canonicalRevision: 8 },
        }),
      },
      error: null,
    })

    const result = await executeCompleteTask(context(rpc), 'task-1', applyBody, notifyTaskMutation)

    expect(result.status).toBe(502)
    expect((result.body.error as { code: string }).code).toBe('invalid_canonical_receipt')
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('rejects a receipt with a malformed read-back hash', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({
      data: {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: committedReceipt({ readBackHash: 'f'.repeat(64) }),
      },
      error: null,
    })

    const result = await executeCompleteTask(context(rpc), 'task-1', applyBody, notifyTaskMutation)

    expect(result.status).toBe(502)
    expect((result.body.error as { code: string }).code).toBe('invalid_canonical_receipt')
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })

  it('rejects a receipt for a different action', async () => {
    const { executeCompleteTask, notifyTaskMutation, rpc } = harness({
      data: {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: committedReceipt({ action: 'patch' }),
      },
      error: null,
    })

    const result = await executeCompleteTask(context(rpc), 'task-1', applyBody, notifyTaskMutation)

    expect(result.status).toBe(502)
    expect(notifyTaskMutation).not.toHaveBeenCalled()
  })
})
