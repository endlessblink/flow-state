import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  executeCanonicalWorkBlockBatch,
  type CanonicalWorkBlockBatchRequest,
} from '@/services/sync/canonicalWorkBlockBatch'

const TASK_A = '11111111-1111-4111-8111-111111111111'
const TASK_B = '22222222-2222-4222-8222-222222222222'
const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OPERATION_ID = 'web:work-block:operation-1'
const REQUEST_HASH = 'c'.repeat(64)
const PREVIEW_DIGEST = 'a'.repeat(64)
const EXPIRES_AT = '2026-07-15T21:15:00.000Z'

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

const operations = [
  {
    kind: 'move' as const,
    taskId: TASK_A,
    baseRevision: 7,
    workBlockId: 'block-a',
    baseWorkBlockHash: 'b'.repeat(64),
    scheduledDate: '2026-07-16',
    scheduledTime: '09:30',
  },
  {
    kind: 'create' as const,
    taskId: TASK_B,
    baseRevision: 3,
    clientId: 'calendar-drop-1',
    scheduledDate: '2026-07-16',
    scheduledTime: '10:30',
    duration: 25,
  },
]

const normalizedOperations = operations.map(operation => operation.kind === 'create'
  ? { ...operation, workBlockId: 'generated-block-b' }
  : operation)

function readBacks(revisions = [8, 4]) {
  return [
    {
      id: TASK_A,
      title: 'First task',
      status: 'todo',
      workspaceId: WORKSPACE_ID,
      canonicalRevision: revisions[0],
      canonicalUpdatedAt: '2026-07-15T21:01:00.000Z',
      isInInbox: false,
      instances: [{
        id: 'block-a', taskId: TASK_A, scheduledDate: '2026-07-16',
        scheduledTime: '09:30', duration: 30, status: 'scheduled',
      }],
    },
    {
      id: TASK_B,
      title: 'Second task',
      status: 'todo',
      workspaceId: WORKSPACE_ID,
      canonicalRevision: revisions[1],
      canonicalUpdatedAt: '2026-07-15T21:01:00.000Z',
      isInInbox: false,
      instances: [{
        id: 'generated-block-b', clientId: 'calendar-drop-1', taskId: TASK_B,
        scheduledDate: '2026-07-16', scheduledTime: '10:30', duration: 25,
        status: 'scheduled', timeZone: 'Asia/Jerusalem',
      }],
    },
  ]
}

function request(overrides: Partial<CanonicalWorkBlockBatchRequest> = {}): CanonicalWorkBlockBatchRequest {
  return {
    workspaceId: WORKSPACE_ID,
    operationId: OPERATION_ID,
    timeZone: 'Asia/Jerusalem',
    finishBy: '2026-07-16T12:00:00.000+03:00',
    operations,
    ...overrides,
  }
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'task-v1',
    action: 'work_block_batch',
    operationId: OPERATION_ID,
    workspaceId: WORKSPACE_ID,
    timeZone: 'Asia/Jerusalem',
    finishBy: '2026-07-16T12:00:00.000+03:00',
    requestHash: REQUEST_HASH,
    previewDigest: PREVIEW_DIGEST,
    previewExpiresAt: EXPIRES_AT,
    normalizedPayload: {
      operations: normalizedOperations,
      timeZone: 'Asia/Jerusalem',
      finishBy: '2026-07-16T12:00:00.000+03:00',
    },
    overlapWarnings: [],
    readBack: readBacks([7, 3]),
    ...overrides,
  }
}

function receipt(overrides: Record<string, unknown> = {}) {
  const readBack = readBacks()
  const affected = readBack.map((task, index) => ({
    entityId: task.id,
    entityType: 'task',
    action: 'update',
    canonicalRevision: task.canonicalRevision,
    changeSequence: 71 + index,
    readBack: task,
    readBackHash: hash(task),
  }))
  return {
    ok: true,
    status: 'committed',
    contractVersion: 'task-v1',
    operationId: OPERATION_ID,
    requestHash: REQUEST_HASH,
    source: 'web-pwa',
    entityType: 'batch',
    entityId: OPERATION_ID,
    action: 'work_block_batch',
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T21:01:00.000Z',
    changeSequence: 72,
    replayed: false,
    committedAt: '2026-07-15T21:01:00.010Z',
    affected,
    readBack,
    readBackHash: hash(readBack),
    ...overrides,
  }
}

describe('canonical renderer work-block batch', () => {
  it('binds an atomic multi-parent preview and apply to identity, revisions, timezone, and finish boundary', async () => {
    const committed = receipt()
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          result: 'committed',
          action: 'work_block_batch',
          operationId: OPERATION_ID,
          requestHash: REQUEST_HASH,
          receipt: committed,
        },
        error: null,
      })

    const result = await executeCanonicalWorkBlockBatch({ rpc }, request())

    expect(result).toEqual({ receipt: committed, readBack: readBacks(), overlapWarnings: [] })
    expect(rpc).toHaveBeenNthCalledWith(1, 'flowstate_work_block_batch_v1', {
      p_contract_version: 'task-v1',
      p_finish_by: '2026-07-16T12:00:00.000+03:00',
      p_operation_id: OPERATION_ID,
      p_operations: operations,
      p_preview: true,
      p_preview_digest: null,
      p_preview_expires_at: null,
      p_request_hash: null,
      p_source: 'web-pwa',
      p_time_zone: 'Asia/Jerusalem',
      p_workspace_id: WORKSPACE_ID,
    })
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_preview: false,
      p_preview_digest: PREVIEW_DIGEST,
      p_preview_expires_at: EXPIRES_AT,
      p_request_hash: REQUEST_HASH,
    })
    expect(rpc.mock.calls[1][1].p_operation_id).toBe(rpc.mock.calls[0][1].p_operation_id)
  })

  it('fails closed on a stale parent without applying or synthesizing local state', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        ok: false,
        result: 'conflict',
        error: { code: 'stale_revision', message: 'Task changed', currentRevision: 9, taskId: TASK_A },
      },
      error: null,
    })

    await expect(executeCanonicalWorkBlockBatch({ rpc }, request())).rejects.toMatchObject({
      code: 'stale_revision',
      currentRevision: 9,
      taskId: TASK_A,
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('accepts an offset-normalized finish boundary only when the normalized payload binds the same instant', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview({
        finishBy: '2026-07-16T09:00:00.000Z',
        normalizedPayload: {
          operations: normalizedOperations,
          timeZone: 'Asia/Jerusalem',
          finishBy: '2026-07-16T09:00:00.000Z',
        },
      }), error: null })
      .mockResolvedValueOnce({ data: {
        ok: true, result: 'committed', action: 'work_block_batch',
        operationId: OPERATION_ID, requestHash: REQUEST_HASH, receipt: receipt(),
      }, error: null })

    await expect(executeCanonicalWorkBlockBatch({ rpc }, request())).resolves.toMatchObject({
      readBack: readBacks(),
    })

    const forged = vi.fn().mockResolvedValue({ data: preview({
      normalizedPayload: {
        operations: normalizedOperations,
        timeZone: 'Asia/Jerusalem',
        finishBy: '2026-07-16T10:00:00.000Z',
      },
    }), error: null })
    await expect(executeCanonicalWorkBlockBatch({ rpc: forged }, request())).rejects.toMatchObject({
      code: 'invalid_canonical_work_block_preview',
    })

    const unbound = vi.fn().mockResolvedValue({ data: preview({
      normalizedPayload: { operations: normalizedOperations, timeZone: 'Asia/Jerusalem' },
    }), error: null })
    await expect(executeCanonicalWorkBlockBatch({ rpc: unbound }, request())).rejects.toMatchObject({
      code: 'invalid_canonical_work_block_preview',
    })
  })

  it('recovers a lost apply response by accepting the committed replay on the next preview call', async () => {
    const replay = receipt({ status: 'replayed', replayed: true })
    const firstRpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockRejectedValueOnce(new Error('response lost after commit'))

    await expect(executeCanonicalWorkBlockBatch({ rpc: firstRpc }, request())).rejects.toMatchObject({
      code: 'canonical_work_block_transport_failed',
    })

    const retryRpc = vi.fn().mockResolvedValueOnce({ data: {
      ok: true,
      result: 'committed',
      action: 'work_block_batch',
      operationId: OPERATION_ID,
      requestHash: REQUEST_HASH,
      receipt: replay,
    }, error: null })
    await expect(executeCanonicalWorkBlockBatch({ rpc: retryRpc }, request())).resolves.toEqual({
      receipt: replay,
      readBack: readBacks(),
      overlapWarnings: [],
    })
    expect(retryRpc).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['wrong operation identity', { operationId: 'web:work-block:other' }],
    ['missing affected parent', { affected: receipt().affected.slice(0, 1) }],
    ['changed sibling', (() => {
      const readBack = readBacks()
      readBack[0].instances = []
      return { readBack, readBackHash: hash(readBack) }
    })()],
    ['wrong read-back hash', { readBackHash: '0'.repeat(64) }],
    ['missing top-level revision', { canonicalRevision: 0 }],
    ['missing top-level sequence', { changeSequence: 0 }],
    ['committed marked replayed', { status: 'committed', replayed: true }],
    ['replayed marked fresh', { status: 'replayed', replayed: false }],
  ])('rejects malformed committed proof: %s', async (_label, malformed) => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockResolvedValueOnce({
        data: {
          ok: true,
          result: 'committed',
          action: 'work_block_batch',
          operationId: OPERATION_ID,
          requestHash: REQUEST_HASH,
          receipt: receipt(malformed),
        },
        error: null,
      })

    await expect(executeCanonicalWorkBlockBatch({ rpc }, request())).rejects.toMatchObject({
      code: 'invalid_canonical_work_block_receipt',
    })
  })

  it('rejects invalid timezone, local interval, and operation shapes before network access', async () => {
    const rpc = vi.fn()
    await expect(executeCanonicalWorkBlockBatch({ rpc }, request({ timeZone: 'Not/AZone' })))
      .rejects.toMatchObject({ code: 'invalid_work_block_request' })
    await expect(executeCanonicalWorkBlockBatch({ rpc }, request({
      operations: [{ ...operations[1], scheduledTime: '25:00' }],
    })))
      .rejects.toMatchObject({ code: 'invalid_work_block_request' })
    await expect(executeCanonicalWorkBlockBatch({ rpc }, request({ finishBy: '2026-07-16' })))
      .rejects.toMatchObject({ code: 'invalid_work_block_request' })
    expect(rpc).not.toHaveBeenCalled()
  })
})
