import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { executeCanonicalSubtaskBatch } from '@/services/sync/canonicalSubtaskBatch'

const TASK_ID = '11111111-1111-4111-8111-111111111111'
const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OPERATION_ID = 'web:subtask:operation-1'
const REQUEST_HASH = 'c'.repeat(64)
const PREVIEW_DIGEST = 'a'.repeat(64)
const PREVIEW_EXPIRES_AT = '2026-07-15T21:15:00.000Z'

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string' || typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
}

function hash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

const requestedOperations = [
  {
    kind: 'create' as const,
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
    parentTaskId: TASK_ID,
    order: 0,
    title: 'Collect the source material',
    doneEnough: 'The relevant links are in one note',
    estimateMinutes: 15,
    isCompleted: false,
  },
  {
    id: '21111111-1111-4111-8111-111111111111',
    clientId: 'outline-step',
    parentTaskId: TASK_ID,
    order: 1,
    title: 'Draft the smallest useful outline',
    doneEnough: 'Five ordered bullets cover the decision',
    estimateMinutes: 25,
    isCompleted: false,
  },
]

function readBack(revision = 8) {
  return {
    id: TASK_ID,
    title: 'Prepare launch brief',
    status: 'todo',
    workspaceId: WORKSPACE_ID,
    canonicalRevision: revision,
    canonicalUpdatedAt: '2026-07-15T21:01:00.000Z',
    subtasks: canonicalSubtasks,
  }
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'task-v1',
    action: 'subtask_batch',
    operationId: OPERATION_ID,
    taskId: TASK_ID,
    baseRevision: 7,
    requestHash: REQUEST_HASH,
    previewDigest: PREVIEW_DIGEST,
    previewExpiresAt: PREVIEW_EXPIRES_AT,
    normalizedPayload: { taskId: TASK_ID, operations: requestedOperations },
    readBack: { ...readBack(7), subtasks: [canonicalSubtasks[0]] },
    ...overrides,
  }
}

function receipt(overrides: Record<string, unknown> = {}) {
  const authoritative = readBack()
  const readBackHash = hash(authoritative)
  return {
    ok: true,
    status: 'committed',
    contractVersion: 'task-v1',
    operationId: OPERATION_ID,
    requestHash: REQUEST_HASH,
    source: 'web-pwa',
    entityType: 'task',
    action: 'subtask_batch',
    entityId: TASK_ID,
    canonicalRevision: 8,
    canonicalUpdatedAt: authoritative.canonicalUpdatedAt,
    changeSequence: 61,
    replayed: false,
    committedAt: '2026-07-15T21:01:00.010Z',
    affected: [{
      entityId: TASK_ID,
      entityType: 'task',
      action: 'update',
      canonicalRevision: 8,
      changeSequence: 61,
      readBack: authoritative,
      readBackHash,
    }],
    readBack: authoritative,
    readBackHash,
    ...overrides,
  }
}

function receiptWithSubtasks(subtasks: unknown[]) {
  const authoritative = { ...readBack(), subtasks }
  const readBackHash = hash(authoritative)
  return receipt({
    readBack: authoritative,
    readBackHash,
    affected: [{
      entityId: TASK_ID,
      entityType: 'task',
      action: 'update',
      canonicalRevision: 8,
      changeSequence: 61,
      readBack: authoritative,
      readBackHash,
    }],
  })
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    taskId: TASK_ID,
    workspaceId: WORKSPACE_ID,
    baseRevision: 7,
    operationId: OPERATION_ID,
    operations: requestedOperations,
    ...overrides,
  }
}

describe('canonical renderer subtask batch', () => {
  it('binds preview and apply to one operation, parent revision, workspace, and normalized batch', async () => {
    const committed = receipt()
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          result: 'committed',
          operationId: OPERATION_ID,
          action: 'subtask_batch',
          taskId: TASK_ID,
          requestHash: REQUEST_HASH,
          receipt: committed,
        },
        error: null,
      })

    const result = await executeCanonicalSubtaskBatch({ rpc }, request())

    expect(result).toEqual({ receipt: committed, readBack: readBack() })
    expect(rpc).toHaveBeenNthCalledWith(1, 'flowstate_subtask_batch_v1', {
      p_base_revision: 7,
      p_contract_version: 'task-v1',
      p_operation_id: OPERATION_ID,
      p_operations: requestedOperations,
      p_preview: true,
      p_preview_digest: null,
      p_preview_expires_at: null,
      p_request_hash: null,
      p_source: 'web-pwa',
      p_task_id: TASK_ID,
      p_workspace_id: WORKSPACE_ID,
    })
    expect(rpc).toHaveBeenNthCalledWith(2, 'flowstate_subtask_batch_v1', {
      p_base_revision: 7,
      p_contract_version: 'task-v1',
      p_operation_id: OPERATION_ID,
      p_operations: requestedOperations,
      p_preview: false,
      p_preview_digest: PREVIEW_DIGEST,
      p_preview_expires_at: PREVIEW_EXPIRES_AT,
      p_request_hash: REQUEST_HASH,
      p_source: 'web-pwa',
      p_task_id: TASK_ID,
      p_workspace_id: WORKSPACE_ID,
    })
  })

  it.each([
    ['create', requestedOperations, canonicalSubtasks],
    [
      'update',
      [{ kind: 'update', subtaskId: 'existing-step', title: 'Collect verified source material' }],
      [{ ...canonicalSubtasks[0], title: 'Collect verified source material' }],
    ],
    ['delete', [{ kind: 'delete', subtaskId: 'existing-step' }], []],
  ])('preserves the exact %s operation through preview, apply, and read-back', async (
    _kind,
    operations,
    expectedSubtasks,
  ) => {
    const expectedPreview = preview({
      normalizedPayload: { taskId: TASK_ID, operations },
    })
    const committed = receiptWithSubtasks(expectedSubtasks)
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: expectedPreview, error: null })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          result: 'committed',
          operationId: OPERATION_ID,
          action: 'subtask_batch',
          taskId: TASK_ID,
          requestHash: REQUEST_HASH,
          receipt: committed,
        },
        error: null,
      })

    const result = await executeCanonicalSubtaskBatch({ rpc }, request({ operations }))

    expect(rpc.mock.calls[0][1]).toMatchObject({ p_operations: operations })
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_operations: operations })
    expect(rpc.mock.calls[0][1].p_operation_id).toBe(rpc.mock.calls[1][1].p_operation_id)
    expect(result.readBack.subtasks).toEqual(expectedSubtasks)
  })

  it('surfaces stale authority without applying or synthesizing a local result', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: false,
        result: 'conflict',
        error: { code: 'stale_revision', message: 'Task changed', currentRevision: 9 },
      },
      error: null,
    })

    await expect(executeCanonicalSubtaskBatch({ rpc }, request())).rejects.toMatchObject({
      code: 'stale_revision',
      currentRevision: 9,
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('fails closed when offline without issuing a legacy write', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('network offline'))

    await expect(executeCanonicalSubtaskBatch({ rpc }, request())).rejects.toMatchObject({
      code: 'canonical_subtask_transport_failed',
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['operation identity', { operationId: 'web:subtask:other' }],
    ['workspace read-back', { readBack: { ...readBack(), workspaceId: 'workspace-other' } }],
    ['canonical revision', { canonicalRevision: 9 }],
    ['affected proof', { affected: [] }],
    ['exact read-back', (() => {
      const wrongReadBack = { ...readBack(), subtasks: canonicalSubtasks.slice(0, 1) }
      return {
        readBack: wrongReadBack,
        affected: [{
          ...receipt().affected[0],
          readBack: wrongReadBack,
        }],
      }
    })()],
  ])('rejects malformed committed proof: %s', async (_label, receiptOverride) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          result: 'committed',
          operationId: OPERATION_ID,
          action: 'subtask_batch',
          taskId: TASK_ID,
          requestHash: REQUEST_HASH,
          receipt: receipt(receiptOverride),
        },
        error: null,
      })

    await expect(executeCanonicalSubtaskBatch({ rpc }, request())).rejects.toMatchObject({
      code: 'invalid_canonical_subtask_receipt',
    })
  })
})
