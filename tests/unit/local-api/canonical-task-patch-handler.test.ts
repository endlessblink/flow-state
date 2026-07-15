import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/canonical-task-patch.cjs')
const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')) as {
  canonicalHash: (value: unknown) => string
}
const moduleExists = existsSync(modulePath)

type RpcResult = { data: unknown; error: unknown }
type HandlerResult = { status: number; body: Record<string, unknown> }
type ExecuteCanonicalTaskPatch = (
  context: {
    supabase: { rpc: ReturnType<typeof vi.fn> }
    activeWorkspaceId: string | null
  },
  taskId: string,
  body: Record<string, unknown>,
  notifyTaskMutation: ReturnType<typeof vi.fn>,
) => Promise<HandlerResult>

function harness(result: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(result)
  const notifyTaskMutation = vi.fn()
  const { executeCanonicalTaskPatch } = require(modulePath) as {
    executeCanonicalTaskPatch: ExecuteCanonicalTaskPatch
  }

  return { executeCanonicalTaskPatch, notifyTaskMutation, rpc }
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
  previewExpiresAt: '2026-07-13T12:15:00.000Z',
  normalizedPayload: { title: 'Canonical title' },
  readBack: { id: 'task-1', title: 'Before', canonicalRevision: 7 },
}

function committedReceipt(overrides: Record<string, unknown> = {}) {
  const readBack = {
    id: 'task-1',
    title: 'Canonical title',
    status: 'todo',
    completedAt: null,
    dueDate: '2026-07-16T00:00:00+00:00',
    isDeleted: false,
    deletedAt: null,
    workspaceId: null,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-13T12:01:00.000Z',
    recurrenceRule: null,
    recurrenceParentId: null,
    recurrenceCount: 0,
    isCompletionRecord: false,
  }
  return {
    ok: true,
    status: 'committed',
    contractVersion: 'task-v1',
    operationId: 'operation-1',
    requestHash: 'c'.repeat(64),
    source: 'local-api',
    entityType: 'task',
    action: 'patch',
    entityId: 'task-1',
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-13T12:01:00.000Z',
    changeSequence: 42,
    replayed: false,
    committedAt: '2026-07-13T12:01:00.010Z',
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

describe('TASK-1945 canonical Local API task patch handler', () => {
  it('ships a dedicated canonical task patch adapter', () => {
    expect(moduleExists).toBe(true)
  })

  describe.skipIf(!moduleExists)('adapter contract', () => {
    it('defaults to a non-mutating preview and does not notify the renderer', async () => {
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: preview, error: null })

      await expect(executeCanonicalTaskPatch(
        context(rpc),
        'task-1',
        { operationId: 'operation-1', baseRevision: 7, patch: { title: 'Canonical title' } },
        notifyTaskMutation,
      )).resolves.toEqual({ status: 200, body: preview })

      expect(rpc).toHaveBeenCalledWith('flowstate_patch_task_v1', {
        p_base_revision: 7,
        p_contract_version: 'task-v1',
        p_operation_id: 'operation-1',
        p_patch: { title: 'Canonical title' },
        p_preview: true,
        p_preview_digest: null,
        p_preview_expires_at: null,
        p_request_hash: null,
        p_source: 'local-api',
        p_task_id: 'task-1',
        p_workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      })
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('requires the complete issued approval binding before apply', async () => {
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: null, error: null })
      const complete = {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }

      for (const required of ['operationId', 'baseRevision', 'previewDigest', 'previewExpiresAt', 'requestHash']) {
        const body = { ...complete }
        delete body[required as keyof typeof body]
        await expect(executeCanonicalTaskPatch(
          context(rpc), 'task-1', body, notifyTaskMutation,
        )).resolves.toEqual({
          status: 400,
          body: {
            ok: false,
            error: {
              code: 'approval_receipt_required',
              message: 'operationId, baseRevision, previewDigest, previewExpiresAt, and requestHash are required for apply',
            },
          },
        })
      }
      expect(rpc).not.toHaveBeenCalled()
    })

    it('forwards the exact approval binding to the canonical RPC', async () => {
      const response = { ok: true, result: 'committed', requestHash: 'c'.repeat(64), receipt: committedReceipt() }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })

      await executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)

      expect(rpc).toHaveBeenCalledWith('flowstate_patch_task_v1', {
        p_base_revision: 7,
        p_contract_version: 'task-v1',
        p_operation_id: 'operation-1',
        p_patch: { title: 'Canonical title' },
        p_preview: false,
        p_preview_digest: 'a'.repeat(64),
        p_preview_expires_at: '2026-07-13T12:15:00.000Z',
        p_request_hash: 'c'.repeat(64),
        p_source: 'local-api',
        p_task_id: 'task-1',
        p_workspace_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      })
    })

    it('accepts only a complete matching committed receipt before notifying', async () => {
      const response = { ok: true, result: 'committed', requestHash: 'c'.repeat(64), receipt: committedReceipt() }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })

      await expect(executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)).resolves.toEqual({ status: 200, body: response })

      expect(notifyTaskMutation).toHaveBeenCalledOnce()
      expect(notifyTaskMutation).toHaveBeenCalledWith('update', 'task-1')
    })

    it.each([
      ['title', 'Forged title'],
      ['status', 'in_progress'],
      ['dueDate', '2026-08-01T00:00:00+00:00'],
    ])('rejects a SQL-shaped receipt whose top read-back recomputes a different %s', async (field, value) => {
      const receipt = committedReceipt()
      const readBack = { ...(receipt.readBack as Record<string, unknown>), [field]: value }
      const response = {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: { ...receipt, readBack, readBackHash: canonicalHash(readBack) },
      }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })

      const result = await executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)

      expect(result.status).toBe(502)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('allows enriched top read-back fields after binding every primary field', async () => {
      const receipt = committedReceipt()
      const readBack = {
        ...(receipt.readBack as Record<string, unknown>),
        operationEvidence: { retained: true },
      }
      const response = {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: { ...receipt, readBack, readBackHash: canonicalHash(readBack) },
      }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })

      const result = await executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)

      expect(result.status).toBe(200)
      expect(notifyTaskMutation).toHaveBeenCalledOnce()
    })

    it('rejects a committed envelope with a mismatched request hash', async () => {
      const response = {
        ok: true,
        result: 'committed',
        requestHash: 'd'.repeat(64),
        receipt: committedReceipt(),
      }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })

      const result = await executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)

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
      const response = {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: committedReceipt({ affected }),
      }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })

      const result = await executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)

      expect(result.status).toBe(502)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it.each([
      ['operationId', 'another-operation'],
      ['entityType', 'project'],
      ['action', 'delete'],
      ['entityId', 'another-task'],
      ['canonicalRevision', null],
      ['canonicalUpdatedAt', null],
      ['changeSequence', null],
      ['committedAt', null],
      ['readBack', null],
      ['readBackHash', null],
    ])('rejects a committed receipt with invalid %s', async (field, value) => {
      const response = {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: committedReceipt({ [field]: value }),
      }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })

      const result = await executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)

      expect(result).toEqual({
        status: 502,
        body: {
          ok: false,
          error: { code: 'invalid_canonical_receipt', message: 'Canonical task receipt could not be verified' },
        },
      })
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('rejects malformed ok responses instead of treating HTTP success as commitment', async () => {
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({
        data: { ok: true },
        error: null,
      })

      await expect(executeCanonicalTaskPatch(
        context(rpc),
        'task-1',
        { operationId: 'operation-1', baseRevision: 7, patch: { title: 'Canonical title' } },
        notifyTaskMutation,
      )).resolves.toEqual({
        status: 502,
        body: {
          ok: false,
          error: { code: 'invalid_canonical_response', message: 'Canonical task response could not be verified' },
        },
      })
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('rejects a preview with a malformed server digest', async () => {
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({
        data: { ...preview, previewDigest: 'not-a-digest' },
        error: null,
      })

      const result = await executeCanonicalTaskPatch(
        context(rpc),
        'task-1',
        { operationId: 'operation-1', baseRevision: 7, patch: { title: 'Canonical title' } },
        notifyTaskMutation,
      )

      expect(result.status).toBe(502)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('rejects a committed receipt with a malformed read-back hash', async () => {
      const response = {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: committedReceipt({ readBackHash: 'f'.repeat(64) }),
      }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })

      const result = await executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)

      expect(result.status).toBe(502)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it.each([
      ['invalid_request', 400],
      ['unsupported_patch', 400],
      ['invalid_title', 400],
      ['invalid_description', 400],
      ['invalid_priority', 400],
      ['invalid_due_date', 400],
      ['invalid_progress', 400],
      ['not_authenticated', 401],
      ['not_found', 404],
      ['stale_revision', 409],
      ['idempotency_conflict', 409],
      ['preview_mismatch', 409],
      ['preview_expired', 409],
    ])('maps typed canonical error %s to HTTP %s', async (code, status) => {
      const domainError = { ok: false, result: 'rejected', error: { code, message: 'safe message' } }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: domainError, error: null })

      await expect(executeCanonicalTaskPatch(
        context(rpc),
        'task-1',
        { operationId: 'operation-1', baseRevision: 7, patch: { title: 'Canonical title' } },
        notifyTaskMutation,
      )).resolves.toEqual({ status, body: domainError })
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('notifies renderer reconciliation for a valid replayed receipt', async () => {
      const response = {
        ok: true,
        result: 'committed',
        requestHash: 'c'.repeat(64),
        receipt: committedReceipt({ status: 'replayed', replayed: true }),
      }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })

      await executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)

      expect(notifyTaskMutation).toHaveBeenCalledOnce()
      expect(notifyTaskMutation).toHaveBeenCalledWith('update', 'task-1')
    })

    it.each([
      [{ status: 'done' }, ['status']],
      [{ title: 'Allowed', surprise: true }, ['surprise']],
    ])('refuses status and unknown patch fields before the RPC', async (patch, fields) => {
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: null, error: null })

      await expect(executeCanonicalTaskPatch(
        context(rpc),
        'task-1',
        { operationId: 'operation-1', baseRevision: 7, patch },
        notifyTaskMutation,
      )).resolves.toEqual({
        status: 400,
        body: {
          ok: false,
          error: {
            code: 'unsupported_patch',
            message: 'The patch contains unsupported task fields',
            fields,
          },
        },
      })
      expect(rpc).not.toHaveBeenCalled()
    })

    it('redacts database error details', async () => {
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({
        data: null,
        error: { message: 'postgres private table and user identifiers' },
      })

      await expect(executeCanonicalTaskPatch(
        context(rpc),
        'task-1',
        { operationId: 'operation-1', baseRevision: 7, patch: { title: 'Canonical title' } },
        notifyTaskMutation,
      )).resolves.toEqual({
        status: 500,
        body: {
          ok: false,
          error: { code: 'canonical_task_patch_failed', message: 'Task patch could not be completed' },
        },
      })
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('refuses canonical writes from standalone service-role mode', async () => {
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: preview, error: null })

      const result = await executeCanonicalTaskPatch(
        { ...context(rpc), signedUser: false },
        'task-1',
        { operationId: 'operation-1', baseRevision: 7, patch: { title: 'Canonical title' } },
        notifyTaskMutation,
      )

      expect(result).toEqual({
        status: 401,
        body: {
          ok: false,
          error: {
            code: 'signed_user_required',
            message: 'Canonical task patches require a signed-in user session',
          },
        },
      })
      expect(rpc).not.toHaveBeenCalled()
    })

    it('redacts thrown connector errors', async () => {
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: preview, error: null })
      rpc.mockRejectedValueOnce(new Error('private connector and credential details'))

      const result = await executeCanonicalTaskPatch(
        context(rpc),
        'task-1',
        { operationId: 'operation-1', baseRevision: 7, patch: { title: 'Canonical title' } },
        notifyTaskMutation,
      )

      expect(result.status).toBe(500)
      expect(JSON.stringify(result)).not.toContain('private connector')
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('returns the durable receipt when renderer reconciliation notification fails', async () => {
      const response = { ok: true, result: 'committed', requestHash: 'c'.repeat(64), receipt: committedReceipt() }
      const { executeCanonicalTaskPatch, notifyTaskMutation, rpc } = harness({ data: response, error: null })
      notifyTaskMutation.mockImplementationOnce(() => { throw new Error('parent port closed') })

      const result = await executeCanonicalTaskPatch(context(rpc), 'task-1', {
        preview: false,
        operationId: 'operation-1',
        baseRevision: 7,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-13T12:15:00.000Z',
        requestHash: 'c'.repeat(64),
        patch: { title: 'Canonical title' },
      }, notifyTaskMutation)

      expect(result).toEqual({ status: 200, body: response })
    })
  })
})
