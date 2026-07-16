import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/subtask-batch.cjs')
const serverPath = resolve(process.cwd(), 'server/local-api/server.cjs')
const moduleExists = existsSync(modulePath)
const serverSource = readFileSync(serverPath, 'utf8')
const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')) as {
  canonicalHash: (value: unknown) => string
}

const taskId = '11111111-1111-4111-8111-111111111111'
const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const operationId = 'subtask-breakdown-1'
const requestHash = 'c'.repeat(64)
const previewDigest = 'a'.repeat(64)
const previewExpiresAt = '2026-07-15T21:15:00.000Z'

const requestedOperations = [
  {
    kind: 'update',
    subtaskId: 'existing-step',
    order: 0,
    isCompleted: true,
    completedPomodoros: 2,
    canvasPosition: { x: 420, y: 260 },
  },
  {
    kind: 'delete',
    subtaskId: 'obsolete-step',
  },
  {
    kind: 'create',
    clientId: 'outline-step',
    title: 'Draft the smallest useful outline',
    doneEnough: 'Five ordered bullets cover the decision',
    estimateMinutes: 25,
    order: 1,
  },
]

const canonicalSubtasks = [
  {
    id: 'existing-step',
    parentTaskId: taskId,
    order: 0,
    title: 'Collect the source material',
    doneEnough: 'The relevant links are in one note',
    estimateMinutes: 15,
    isCompleted: true,
    completedPomodoros: 2,
    canvasPosition: { x: 420, y: 260 },
    legacyMarker: 'preserve-me',
  },
  {
    id: '21111111-1111-4111-8111-111111111111',
    clientId: 'outline-step',
    parentTaskId: taskId,
    order: 1,
    title: 'Draft the smallest useful outline',
    doneEnough: 'Five ordered bullets cover the decision',
    estimateMinutes: 25,
    isCompleted: false,
  },
]

type HandlerResult = { status: number; body: Record<string, unknown> }
type ExecuteSubtaskBatch = (
  context: {
    supabase: { rpc: ReturnType<typeof vi.fn> }
    activeWorkspaceId: string | null
    signedUser?: boolean
  },
  taskId: string,
  body: Record<string, unknown>,
  notifyTaskMutation: ReturnType<typeof vi.fn>,
) => Promise<HandlerResult>

function context(rpc: ReturnType<typeof vi.fn>, activeWorkspaceId: string | null = workspaceId) {
  return { supabase: { rpc }, activeWorkspaceId, signedUser: true }
}

function harness(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error })
  const notifyTaskMutation = vi.fn()
  const { executeSubtaskBatch } = require(modulePath) as {
    executeSubtaskBatch: ExecuteSubtaskBatch
  }
  return { executeSubtaskBatch, notifyTaskMutation, rpc }
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'task-v1',
    action: 'subtask_batch',
    operationId,
    baseRevision: 7,
    requestHash,
    previewDigest,
    previewExpiresAt,
    normalizedPayload: { taskId, operations: requestedOperations },
    readBack: {
      id: taskId,
      workspaceId,
      status: 'planned',
      canonicalRevision: 7,
      subtasks: canonicalSubtasks,
    },
    ...overrides,
  }
}

function committed(overrides: Record<string, unknown> = {}) {
  const readBack = {
    id: taskId,
    workspaceId,
    status: 'planned',
    completedAt: null,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T21:01:00.000Z',
    subtasks: canonicalSubtasks,
  }
  return {
    ok: true,
    result: 'committed',
    operationId,
    requestHash,
    receipt: {
      ok: true,
      status: 'committed',
      contractVersion: 'task-v1',
      operationId,
      requestHash,
      source: 'local-api',
      entityType: 'task',
      action: 'subtask_batch',
      entityId: taskId,
      canonicalRevision: 8,
      canonicalUpdatedAt: '2026-07-15T21:01:00.000Z',
      changeSequence: 61,
      replayed: false,
      committedAt: '2026-07-15T21:01:00.010Z',
      affected: [{
        entityId: taskId,
        entityType: 'task',
        action: 'update',
        canonicalRevision: 8,
        changeSequence: 61,
        readBack,
        readBackHash: canonicalHash(readBack),
      }],
      readBack,
      readBackHash: canonicalHash(readBack),
      ...overrides,
    },
  }
}

const applyBody = {
  operationId,
  baseRevision: 7,
  operations: requestedOperations,
  preview: false,
  previewDigest,
  previewExpiresAt,
  requestHash,
}

describe('TASK-1963 canonical Local API subtask batch', () => {
  it('ships a dedicated canonical adapter for the process-local batch route', () => {
    expect(moduleExists).toBe(true)
    expect(serverSource).toContain("require('./subtask-batch.cjs')")
    expect(serverSource).toContain('executeSubtaskBatch')
  })

  describe.skipIf(!moduleExists)('executeSubtaskBatch contract', () => {
    it('defaults to a zero-write preview with the exact ordered breakdown', async () => {
      const expected = preview()
      const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(expected)

      const result = await executeSubtaskBatch(
        context(rpc), taskId,
        { operationId, baseRevision: 7, operations: requestedOperations },
        notifyTaskMutation,
      )

      expect(result).toEqual({ status: 200, body: expected })
      expect(rpc).toHaveBeenCalledWith('flowstate_subtask_batch_v1', {
        p_base_revision: 7,
        p_contract_version: 'task-v1',
        p_operation_id: operationId,
        p_preview: true,
        p_preview_digest: null,
        p_preview_expires_at: null,
        p_request_hash: null,
        p_source: 'local-api',
        p_operations: requestedOperations,
        p_task_id: taskId,
        p_workspace_id: workspaceId,
      })
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('rejects a preview that changes order, done-enough criteria, or estimates', async () => {
      const altered = [
        [...requestedOperations].reverse(),
        requestedOperations.map((item, index) => index === 2
          ? { ...item, doneEnough: 'Something else' }
          : item),
        requestedOperations.map((item, index) => index === 2
          ? { ...item, estimateMinutes: 90 }
          : item),
      ]

      for (const operations of altered) {
        const forged = preview({
          normalizedPayload: { taskId, operations },
        })
        const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(forged)
        const result = await executeSubtaskBatch(
          context(rpc), taskId,
          { operationId, baseRevision: 7, operations: requestedOperations },
          notifyTaskMutation,
        )

        expect(result.status).toBe(502)
        expect((result.body.error as { code: string }).code).toBe('invalid_canonical_response')
        expect(notifyTaskMutation).not.toHaveBeenCalled()
      }
    })

    it.each(['operationId', 'baseRevision', 'previewDigest', 'previewExpiresAt', 'requestHash'])(
      'requires %s from the exact approved preview before apply',
      async (field) => {
        const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(null)
        const body: Record<string, unknown> = { ...applyBody }
        delete body[field]

        const result = await executeSubtaskBatch(context(rpc), taskId, body, notifyTaskMutation)

        expect(result.status).toBe(400)
        expect((result.body.error as { code: string }).code).toBe('approval_receipt_required')
        expect(rpc).not.toHaveBeenCalled()
      },
    )

    it.each([
      ['create title', { kind: 'create', clientId: 'long-title', title: 'x'.repeat(501) }],
      ['update title', { kind: 'update', subtaskId: 'existing-step', title: 'x'.repeat(501) }],
      ['create description', {
        kind: 'create', clientId: 'long-description', title: 'Step', description: 'x'.repeat(10001),
      }],
      ['update description', {
        kind: 'update', subtaskId: 'existing-step', description: 'x'.repeat(10001),
      }],
      ['create doneEnough', {
        kind: 'create', clientId: 'long-done-enough', title: 'Step', doneEnough: 'x'.repeat(2001),
      }],
      ['update doneEnough', {
        kind: 'update', subtaskId: 'existing-step', doneEnough: 'x'.repeat(2001),
      }],
    ])('rejects over-limit %s before calling the canonical RPC', async (_label, operation) => {
      const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(null)

      const result = await executeSubtaskBatch(
        context(rpc),
        taskId,
        { operationId, baseRevision: 7, operations: [operation] },
        notifyTaskMutation,
      )

      expect(result).toEqual({
        status: 400,
        body: {
          ok: false,
          error: { code: 'invalid_operations', message: 'Subtask operations are invalid' },
        },
      })
      expect(rpc).not.toHaveBeenCalled()
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it.each([
      ['create title', { kind: 'create', clientId: 'max-title', title: 'x'.repeat(500) }],
      ['update title', { kind: 'update', subtaskId: 'existing-step', title: 'x'.repeat(500) }],
      ['create description', {
        kind: 'create', clientId: 'max-description', title: 'Step', description: 'x'.repeat(10000),
      }],
      ['update description', {
        kind: 'update', subtaskId: 'existing-step', description: 'x'.repeat(10000),
      }],
      ['create doneEnough', {
        kind: 'create', clientId: 'max-done-enough', title: 'Step', doneEnough: 'x'.repeat(2000),
      }],
      ['update doneEnough', {
        kind: 'update', subtaskId: 'existing-step', doneEnough: 'x'.repeat(2000),
      }],
    ])('keeps the exact %s boundary valid', (_label, operation) => {
      const { normalizeOperation } = require(modulePath) as {
        normalizeOperation: (value: unknown) => unknown
      }

      expect(normalizeOperation(operation)).toEqual(operation)
    })

    it('maps a durable same-operation changed-payload conflict after handler recreation', async () => {
      const conflict = {
        ok: false,
        error: { code: 'idempotency_conflict', message: 'operationId already binds another payload' },
      }
      const first = harness(conflict)
      let result = await first.executeSubtaskBatch(
        context(first.rpc), taskId, applyBody, first.notifyTaskMutation,
      )
      expect(result.status).toBe(409)

      vi.resetModules()
      const second = harness(conflict)
      result = await second.executeSubtaskBatch(
        context(second.rpc), taskId,
        {
          ...applyBody,
          operations: [{
            kind: 'create', clientId: 'changed-step', title: 'Changed after restart',
            doneEnough: 'Different output', estimateMinutes: 60, order: 0,
          }],
        },
        second.notifyTaskMutation,
      )

      expect(result.status).toBe(409)
      expect((result.body.error as { code: string }).code).toBe('idempotency_conflict')
      expect(first.notifyTaskMutation).not.toHaveBeenCalled()
      expect(second.notifyTaskMutation).not.toHaveBeenCalled()
    })

    it.each([
      ['invalid_operations', 400],
      ['invalid_existing_subtasks', 409],
      ['client_id_conflict', 409],
      ['subtask_id_conflict', 409],
    ])('maps typed canonical failure %s without reporting an internal error', async (code, status) => {
      const failure = { ok: false, error: { code, message: code } }
      const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(failure)

      const result = await executeSubtaskBatch(
        context(rpc), taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(status)
      expect(result.body).toEqual(failure)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it.each([
      ['stale_revision', { currentRevision: 9 }],
      ['preview_mismatch', {}],
      ['preview_expired', {}],
    ])(
      'maps %s as a conflict without a mutation notification',
      async (code, details) => {
        const failure = { ok: false, error: { code, message: code, ...details } }
        const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(failure)
        const result = await executeSubtaskBatch(
          context(rpc), taskId, applyBody, notifyTaskMutation,
        )

        expect(result.status).toBe(409)
        expect(result.body).toEqual(failure)
        expect(notifyTaskMutation).not.toHaveBeenCalled()
      },
    )

    it('accepts a replayed canonical receipt without issuing a second notification', async () => {
      const response = committed({ status: 'replayed', replayed: true })
      const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(response)

      const result = await executeSubtaskBatch(
        context(rpc), taskId, applyBody, notifyTaskMutation,
      )

      expect(result).toEqual({ status: 200, body: response })
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('recovers a response-loss retry from a status-only replay without notifying twice', async () => {
      const response = committed({ status: 'replayed', replayed: undefined })
      const rpc = vi.fn()
        .mockRejectedValueOnce(new Error('connection closed after commit'))
        .mockResolvedValueOnce({ data: response, error: null })
      const notifyTaskMutation = vi.fn()
      const { executeSubtaskBatch } = require(modulePath) as {
        executeSubtaskBatch: ExecuteSubtaskBatch
      }

      const lost = await executeSubtaskBatch(
        context(rpc), taskId, applyBody, notifyTaskMutation,
      )
      const replayed = await executeSubtaskBatch(
        context(rpc), taskId, applyBody, notifyTaskMutation,
      )

      expect(lost.status).toBe(500)
      expect((lost.body.error as { code: string }).code).toBe('canonical_subtask_batch_failed')
      expect(replayed).toEqual({ status: 200, body: response })
      expect(rpc).toHaveBeenCalledTimes(2)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('preserves partial completion without completing the parent task', async () => {
      const response = committed()
      const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(response)

      const result = await executeSubtaskBatch(
        context(rpc), taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(200)
      expect((result.body.receipt as { readBack: { status: string; completedAt: null } }).readBack)
        .toMatchObject({ status: 'planned', completedAt: null })
      expect(notifyTaskMutation).toHaveBeenCalledOnce()
      expect(notifyTaskMutation).toHaveBeenCalledWith('update', taskId)
    })

    it('rejects a committed receipt that partially wrote or reordered the approved breakdown', async () => {
      const partial = committed()
      const receipt = partial.receipt as Record<string, unknown>
      const readBack = {
        ...(receipt.readBack as object),
        subtasks: canonicalSubtasks.slice(0, 1),
      }
      const response = committed({ readBack })
      const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(response)

      const result = await executeSubtaskBatch(
        context(rpc), taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(502)
      expect((result.body.error as { code: string }).code).toBe('invalid_canonical_response')
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('rejects a cryptographically self-consistent receipt with the wrong approved field outcome', async () => {
      const response = committed()
      const receipt = response.receipt as Record<string, any>
      const forgedReadBack = {
        ...receipt.readBack,
        subtasks: canonicalSubtasks.map((subtask, index) => index === 0
          ? { ...subtask, canvasPosition: { x: 999, y: 999 } }
          : subtask),
      }
      const forgedHash = canonicalHash(forgedReadBack)
      receipt.readBack = forgedReadBack
      receipt.readBackHash = forgedHash
      receipt.affected[0].readBack = forgedReadBack
      receipt.affected[0].readBackHash = forgedHash
      const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(response)

      const result = await executeSubtaskBatch(
        context(rpc), taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(502)
      expect((result.body.error as { code: string }).code).toBe('invalid_canonical_response')
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('maps workspace denial to 403 and never notifies', async () => {
      const denied = { ok: false, error: { code: 'scope_denied', message: 'workspace denied' } }
      const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(denied)

      const result = await executeSubtaskBatch(
        context(rpc), taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(403)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('returns a stable failure and no notification when the RPC rolls back', async () => {
      const { executeSubtaskBatch, notifyTaskMutation, rpc } = harness(
        null,
        { message: 'injected rollback' },
      )

      const result = await executeSubtaskBatch(
        context(rpc), taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(500)
      expect((result.body.error as { code: string }).code).toBe('canonical_subtask_batch_failed')
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })
  })
})
