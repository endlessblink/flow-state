import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { canonicalHash } = require('../../../server/local-api/canonical-receipt.cjs') as {
  canonicalHash: (value: unknown) => string
}

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const operationId = 'subtask-batch-operation-1'
const taskId = '11111111-1111-4111-8111-111111111111'
const subtaskId = '22222222-2222-4222-8222-222222222222'

const operations = [{
  action: 'create',
  subtask: {
    id: subtaskId,
    title: 'First step',
    description: '',
    isCompleted: false,
    completedPomodoros: 0,
    doneEnough: 'The first step has a concrete result',
    estimateMinutes: null,
  },
  order: 0,
}]

function normalizedRequest(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 'subtask-batch-v1',
    source: 'local-api',
    action: 'subtask_batch',
    taskId,
    baseRevision: 7,
    workspaceId,
    operations,
    ...overrides,
  }
}

function preview(overrides: Record<string, unknown> = {}) {
  const normalizedPayload = normalizedRequest()
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'subtask-batch-v1',
    operationId,
    action: 'subtask_batch',
    taskId,
    baseRevision: 7,
    requestHash: canonicalHash(normalizedPayload),
    previewDigest: 'a'.repeat(64),
    previewExpiresAt: '2026-07-15T15:15:00.000Z',
    normalizedPayload,
    readBack: {
      id: taskId,
      workspaceId,
      canonicalRevision: 7,
      canonicalUpdatedAt: '2026-07-15T15:00:00.000Z',
      subtasks: operations.map(operation => operation.subtask),
    },
    ...overrides,
  }
}

function committedResponse(overrides: Record<string, unknown> = {}) {
  const requestHash = canonicalHash(normalizedRequest())
  const readBack = {
    id: taskId,
    workspaceId,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T15:01:00.000Z',
    subtasks: operations.map(operation => operation.subtask),
  }
  const receipt = {
    contractVersion: 'subtask-batch-v1',
    operationId,
    source: 'local-api',
    status: 'committed',
    requestHash,
    entityType: 'task',
    action: 'subtask_batch',
    entityId: taskId,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T15:01:00.000Z',
    changeSequence: 53,
    replayed: false,
    committedAt: '2026-07-15T15:01:00.010Z',
    readBack,
    readBackHash: canonicalHash(readBack),
  }
  return {
    ok: true,
    result: 'committed',
    status: 'committed',
    requestHash,
    receipt,
    ...overrides,
  }
}

function harness(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result)
  const notify = vi.fn()
  const { executeCanonicalSubtaskBatch } = require('../../../server/local-api/canonical-subtask-batch.cjs') as {
    executeCanonicalSubtaskBatch: (
      context: { supabase: { rpc: typeof rpc }; activeWorkspaceId: string | null; signedUser: boolean },
      taskId: string,
      body: Record<string, unknown>,
      notifyTaskMutation: typeof notify,
    ) => Promise<{ status: number; body: unknown }>
  }
  return { executeCanonicalSubtaskBatch, notify, rpc }
}

const context = (rpc: ReturnType<typeof vi.fn>, signedUser = true) => ({
  supabase: { rpc },
  activeWorkspaceId: workspaceId,
  signedUser,
})

describe('canonical Local API subtask batch handler', () => {
  it('defaults to preview and forwards one normalized ordered batch', async () => {
    const data = preview()
    const { executeCanonicalSubtaskBatch, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalSubtaskBatch(context(rpc), taskId, {
      operationId,
      baseRevision: 7,
      operations: [{
        action: 'create',
        subtask: {
          id: subtaskId,
          title: '  First step  ',
          doneEnough: 'The first step has a concrete result',
        },
        order: 0,
      }],
    }, notify)).resolves.toEqual({ status: 200, body: data })

    expect(rpc).toHaveBeenCalledWith('flowstate_subtask_batch_v1', {
      p_base_revision: 7,
      p_contract_version: 'subtask-batch-v1',
      p_operation_id: operationId,
      p_operations: operations,
      p_approved_subtask_ids: null,
      p_preview: true,
      p_preview_digest: null,
      p_preview_expires_at: null,
      p_source: 'local-api',
      p_task_id: taskId,
      p_workspace_id: workspaceId,
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('normalizes update, complete, reorder, and delete operations without dropping explicit values', async () => {
    const normalizedOperations = [
      { action: 'update', subtaskId, patch: { title: 'Renamed', isCompleted: true, completedPomodoros: 2, doneEnough: 'Outline has five headings', estimateMinutes: null }, order: 1 },
      { action: 'update', subtaskId: '33333333-3333-4333-8333-333333333333', patch: {}, order: 0 },
      { action: 'delete', subtaskId: '44444444-4444-4444-8444-444444444444' },
    ]
    const normalizedPayload = normalizedRequest({ operations: normalizedOperations })
    const data = preview({
      requestHash: canonicalHash(normalizedPayload),
      normalizedPayload,
    })
    const { executeCanonicalSubtaskBatch, notify, rpc } = harness({ data, error: null })

    await executeCanonicalSubtaskBatch(context(rpc), taskId, {
      operationId,
      baseRevision: 7,
      operations: normalizedOperations,
    }, notify)

    expect(rpc).toHaveBeenCalledWith('flowstate_subtask_batch_v1', expect.objectContaining({
      p_operations: normalizedOperations,
    }))
  })

  it('requires the exact preview binding before apply', async () => {
    const { executeCanonicalSubtaskBatch, notify, rpc } = harness({ data: null, error: null })
    const complete = {
      operationId,
      baseRevision: 7,
      operations,
      preview: false,
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T15:15:00.000Z',
      approvedSubtaskIds: [subtaskId],
    }

    for (const field of ['previewDigest', 'previewExpiresAt', 'approvedSubtaskIds']) {
      const body = { ...complete }
      delete body[field as keyof typeof body]
      await expect(executeCanonicalSubtaskBatch(context(rpc), taskId, body, notify)).resolves.toMatchObject({
        status: 400,
        body: { ok: false, error: { code: 'approval_receipt_required' } },
      })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects malformed or over-large batches before the RPC', async () => {
    const { executeCanonicalSubtaskBatch, notify, rpc } = harness({ data: null, error: null })
    const invalidOperations = [
      [],
      Array.from({ length: 51 }, () => operations[0]),
      [{ action: 'create', subtask: { id: subtaskId, title: '' } }],
      [{ action: 'create', subtask: { id: subtaskId, title: 'Task' } }],
      [{ action: 'create', subtask: { id: 'not-a-uuid', title: 'Task', doneEnough: 'A result exists' } }],
      [{ action: 'create', subtask: { id: subtaskId, title: 'Task', unexpected: true } }],
      [{ action: 'update', subtaskId, patch: {} }],
      [{ action: 'update', subtaskId, patch: { isCompleted: 'yes' } }],
      [{ action: 'update', subtaskId, patch: { completedPomodoros: 100001 } }],
      [{ action: 'update', subtaskId, patch: { doneEnough: '' } }],
      [{ action: 'update', subtaskId, patch: { doneEnough: null } }],
      [{ action: 'delete', subtaskId, order: 1 }],
      [{ action: 'update', subtaskId, patch: {}, order: 100001 }],
      [{ action: 'unknown', subtaskId }],
    ]

    for (const candidate of invalidOperations) {
      await expect(executeCanonicalSubtaskBatch(context(rpc), taskId, {
        operationId,
        baseRevision: 7,
        operations: candidate,
      }, notify)).resolves.toMatchObject({ status: 400, body: { ok: false } })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('accepts an exact committed parent receipt and only then reconciles the renderer', async () => {
    const data = committedResponse()
    const { executeCanonicalSubtaskBatch, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalSubtaskBatch(context(rpc), taskId, {
      operationId,
      baseRevision: 7,
      operations,
      preview: false,
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T15:15:00.000Z',
      approvedSubtaskIds: [subtaskId],
    }, notify)).resolves.toEqual({ status: 200, body: data })

    expect(rpc).toHaveBeenCalledWith('flowstate_subtask_batch_v1', expect.objectContaining({
      p_approved_subtask_ids: [subtaskId],
    }))
    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('update', taskId)
  })

  it('preserves typed validation and conflict responses from the canonical writer', async () => {
    for (const [code, status] of [
      ['invalid_subtask', 400],
      ['subtask_not_found', 409],
      ['invalid_existing_subtasks', 409],
    ] as const) {
      const data = { ok: false, result: 'rejected', error: { code, message: code } }
      const { executeCanonicalSubtaskBatch, notify, rpc } = harness({ data, error: null })
      await expect(executeCanonicalSubtaskBatch(context(rpc), taskId, {
        operationId, baseRevision: 7, operations,
      }, notify)).resolves.toEqual({ status, body: data })
      expect(notify).not.toHaveBeenCalled()
    }
  })

  it.each([
    ['request hash', (data: ReturnType<typeof committedResponse>) => ({ ...data, requestHash: 'b'.repeat(64) })],
    ['receipt action', (data: ReturnType<typeof committedResponse>) => ({ ...data, receipt: { ...data.receipt, action: 'patch' } })],
    ['read-back hash', (data: ReturnType<typeof committedResponse>) => ({ ...data, receipt: { ...data.receipt, readBackHash: 'b'.repeat(64) } })],
    ['read-back workspace', (data: ReturnType<typeof committedResponse>) => ({
      ...data,
      receipt: { ...data.receipt, readBack: { ...data.receipt.readBack, workspaceId: null } },
    })],
    ['missing created subtask', (data: ReturnType<typeof committedResponse>) => ({
      ...data,
      receipt: { ...data.receipt, readBack: { ...data.receipt.readBack, subtasks: [] } },
    })],
    ['created subtask order', (data: ReturnType<typeof committedResponse>) => {
      const legacy = {
        id: 'legacy-subtask',
        title: 'Legacy',
        description: '',
        isCompleted: false,
        completedPomodoros: 0,
      }
      const readBack = { ...data.receipt.readBack, subtasks: [legacy, ...data.receipt.readBack.subtasks] }
      return {
        ...data,
        receipt: { ...data.receipt, readBack, readBackHash: canonicalHash(readBack) },
      }
    }],
    ['committed revision jump', (data: ReturnType<typeof committedResponse>) => {
      const readBack = { ...data.receipt.readBack, canonicalRevision: 9 }
      return {
        ...data,
        receipt: {
          ...data.receipt,
          canonicalRevision: 9,
          readBack,
          readBackHash: canonicalHash(readBack),
        },
      }
    }],
  ])('rejects a mismatched %s without renderer reconciliation', async (_label, mutate) => {
    const { executeCanonicalSubtaskBatch, notify, rpc } = harness({ data: mutate(committedResponse()), error: null })
    const result = await executeCanonicalSubtaskBatch(context(rpc), taskId, {
      operationId,
      baseRevision: 7,
      operations,
      preview: false,
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T15:15:00.000Z',
      approvedSubtaskIds: [subtaskId],
    }, notify)

    expect(result).toMatchObject({ status: 502, body: { error: { code: 'invalid_canonical_receipt' } } })
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects a valid-hash final order that differs from an early approved reorder followed by delete', async () => {
    const deletedId = '33333333-3333-4333-8333-333333333333'
    const survivorId = '44444444-4444-4444-8444-444444444444'
    const batchOperations = [
      { action: 'update', subtaskId, patch: {}, order: 0 },
      { action: 'delete', subtaskId: deletedId },
    ]
    const normalized = normalizedRequest({ operations: batchOperations })
    const requestHash = canonicalHash(normalized)
    const base = committedResponse()
    const target = base.receipt.readBack.subtasks[0]
    const survivor = { ...target, id: survivorId, title: 'Survivor' }
    const wrongReadBack = {
      ...base.receipt.readBack,
      subtasks: [survivor, target],
    }
    const data = {
      ...base,
      requestHash,
      receipt: {
        ...base.receipt,
        requestHash,
        readBack: wrongReadBack,
        readBackHash: canonicalHash(wrongReadBack),
      },
    }
    const { executeCanonicalSubtaskBatch, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalSubtaskBatch(context(rpc), taskId, {
      operationId,
      baseRevision: 7,
      operations: batchOperations,
      preview: false,
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T15:15:00.000Z',
      approvedSubtaskIds: [subtaskId, survivorId],
    }, notify)).resolves.toMatchObject({
      status: 502,
      body: { error: { code: 'invalid_canonical_receipt' } },
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('fails closed for unsigned sessions and mismatched workspaces', async () => {
    const { executeCanonicalSubtaskBatch, notify, rpc } = harness({ data: preview(), error: null })
    await expect(executeCanonicalSubtaskBatch(context(rpc, false), taskId, {
      operationId, baseRevision: 7, operations,
    }, notify)).resolves.toMatchObject({ status: 401 })
    await expect(executeCanonicalSubtaskBatch(context(rpc), taskId, {
      operationId, baseRevision: 7, operations,
      workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }, notify)).resolves.toMatchObject({ status: 409, body: { error: { code: 'workspace_mismatch' } } })
    expect(rpc).not.toHaveBeenCalled()
  })
})
