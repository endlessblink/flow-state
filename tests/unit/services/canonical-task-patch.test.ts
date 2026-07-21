import { describe, expect, it, vi } from 'vitest'
import type { CanonicalTaskPatchReceipt, CanonicalTaskPatchState, WriteOperation } from '@/types/sync'
import {
  createCanonicalTaskPatchState,
  executeQueuedCanonicalTaskPatch,
} from '@/services/sync/canonicalTaskPatch'

const REQUEST_HASH = 'c'.repeat(64)

function operation(): WriteOperation {
  return {
    id: 1,
    entityType: 'task',
    operation: 'update',
    entityId: 'task-1',
    payload: { title: 'New title', updated_at: '2026-07-13T10:00:00Z' },
    status: 'pending',
    retryCount: 0,
    createdAt: 1,
    userId: 'user-1',
    workspaceId: null,
    canonicalTaskPatch: createCanonicalTaskPatchState(
      { title: 'New title', updated_at: '2026-07-13T10:00:00Z' },
      4,
      'web:operation-1',
    ),
  }
}

function receipt(overrides: Partial<CanonicalTaskPatchReceipt> = {}): CanonicalTaskPatchReceipt {
  return {
    contractVersion: 'task-v1',
    operationId: 'web:operation-1',
    source: 'web-pwa',
    entityType: 'task',
    action: 'patch',
    entityId: 'task-1',
    canonicalRevision: 5,
    canonicalUpdatedAt: '2026-07-13T10:01:00Z',
    changeSequence: 20,
    replayed: false,
    committedAt: '2026-07-13T10:01:00Z',
    requestHash: REQUEST_HASH,
    readBack: {
      id: 'task-1', title: 'New title', description: '', priority: null, dueDate: null,
      progress: 0, status: 'todo', isDeleted: false, workspaceId: null,
      canonicalRevision: 5, canonicalUpdatedAt: '2026-07-13T10:01:00Z',
    },
    readBackHash: 'a'.repeat(64),
    ...overrides,
  }
}

function preview() {
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'task-v1',
    operationId: 'web:operation-1',
    baseRevision: 4,
    previewDigest: 'b'.repeat(64),
    previewExpiresAt: '2026-07-13T10:15:00Z',
    requestHash: REQUEST_HASH,
    normalizedPayload: { title: 'New title' },
    readBack: {
      id: 'task-1', title: 'Old title', description: '', priority: null, dueDate: null,
      progress: 0, status: 'todo', isDeleted: false, workspaceId: null,
      canonicalRevision: 4, canonicalUpdatedAt: '2026-07-13T10:00:00Z',
    },
  }
}

describe('canonical queued task patch', () => {
  it('classifies only pure supported scalar payloads with a canonical base revision', () => {
    expect(createCanonicalTaskPatchState({ title: 'A', due_date: null, updated_at: 'now' }, 7, 'op')).toMatchObject({
      operationId: 'op',
      baseRevision: 7,
      patch: { title: 'A', dueDate: null },
      phase: 'queued',
    })
    expect(createCanonicalTaskPatchState({ title: 'A', status: 'todo' }, 7, 'op')).toBeUndefined()
    expect(createCanonicalTaskPatchState({ title: 'A' }, undefined, 'op')).toBeUndefined()
    expect(createCanonicalTaskPatchState({ title: '   ' }, 7, 'op')).toBeUndefined()
    expect(createCanonicalTaskPatchState({ progress: 10.5 }, 7, 'op')).toBeUndefined()
    expect(createCanonicalTaskPatchState({ progress: 101 }, 7, 'op')).toBeUndefined()
    expect(createCanonicalTaskPatchState({ due_date: 'tomorrow' }, 7, 'op')).toBeUndefined()
    expect(createCanonicalTaskPatchState({ due_date: '2026-02-30' }, 7, 'op')).toBeUndefined()
  })

  it('persists preview binding and validated receipt before reporting success', async () => {
    const op = operation()
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockResolvedValueOnce({ data: { ok: true, result: 'committed', receipt: receipt() }, error: null })
    const persist = vi.fn().mockResolvedValue(undefined)

    const result = await executeQueuedCanonicalTaskPatch({ rpc }, op, persist)

    expect(result.success).toBe(true)
    expect(result.canonicalReceipt).toEqual(receipt())
    expect(persist).toHaveBeenNthCalledWith(1, expect.objectContaining({
      phase: 'previewed',
      previewDigest: 'b'.repeat(64),
      normalizedPatch: { title: 'New title' },
    }))
    expect(persist).toHaveBeenNthCalledWith(2, expect.objectContaining({
      phase: 'committed',
      receipt: receipt(),
    }))
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_preview: true, p_operation_id: 'web:operation-1' })
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_preview: false,
      p_operation_id: 'web:operation-1',
      p_preview_digest: 'b'.repeat(64),
    })
  })

  it('persists and sends the server-issued request hash before apply', async () => {
    const op = operation()
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockResolvedValueOnce({ data: { ok: true, result: 'committed', receipt: receipt() }, error: null })
    const persist = vi.fn().mockResolvedValue(undefined)

    const result = await executeQueuedCanonicalTaskPatch({ rpc }, op, persist)

    expect(result.success).toBe(true)
    expect(persist).toHaveBeenNthCalledWith(1, expect.objectContaining({
      phase: 'previewed',
      requestHash: REQUEST_HASH,
    }))
    expect(rpc).toHaveBeenNthCalledWith(1, 'flowstate_patch_task_v1', expect.objectContaining({
      p_preview: true,
      p_request_hash: null,
    }))
    expect(rpc).toHaveBeenNthCalledWith(2, 'flowstate_patch_task_v1', expect.objectContaining({
      p_preview: false,
      p_request_hash: REQUEST_HASH,
    }))
  })

  it('re-previews a legacy queued update that was persisted before request hashes', async () => {
    const op = operation()
    op.canonicalTaskPatch = {
      ...op.canonicalTaskPatch!,
      phase: 'previewed',
      previewDigest: 'b'.repeat(64),
      previewExpiresAt: '2026-07-13T10:15:00Z',
      normalizedPatch: { title: 'New title' },
    }
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockResolvedValueOnce({ data: { ok: true, result: 'committed', receipt: receipt() }, error: null })

    const result = await executeQueuedCanonicalTaskPatch({ rpc }, op, vi.fn())

    expect(result.success).toBe(true)
    expect(rpc).toHaveBeenNthCalledWith(1, 'flowstate_patch_task_v1', expect.objectContaining({
      p_preview: true,
      p_request_hash: null,
    }))
    expect(rpc).toHaveBeenNthCalledWith(2, 'flowstate_patch_task_v1', expect.objectContaining({
      p_preview: false,
      p_request_hash: REQUEST_HASH,
    }))
  })

  it('re-issues expired legacy preview intent under a new persisted operation identity', async () => {
    const op = operation()
    op.canonicalTaskPatch = {
      ...op.canonicalTaskPatch!,
      phase: 'previewed',
      previewDigest: 'b'.repeat(64),
      previewExpiresAt: '2026-07-13T10:15:00Z',
      normalizedPatch: { title: 'New title' },
    }
    const persist = vi.fn().mockResolvedValue(undefined)
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          ok: false,
          result: 'conflict',
          error: { code: 'preview_expired', message: 'Use a new operationId for a fresh preview' },
        },
        error: null,
      })
      .mockImplementationOnce((_name, args) => Promise.resolve({
        data: { ...preview(), operationId: args.p_operation_id },
        error: null,
      }))
      .mockImplementationOnce((_name, args) => Promise.resolve({
        data: {
          ok: true,
          result: 'committed',
          receipt: receipt({ operationId: args.p_operation_id as string }),
        },
        error: null,
      }))

    const result = await executeQueuedCanonicalTaskPatch({ rpc }, op, persist)

    expect(result.success).toBe(true)
    const replacementOperationId = rpc.mock.calls[1][1].p_operation_id
    expect(replacementOperationId).toMatch(/^web:/)
    expect(replacementOperationId).not.toBe('web:operation-1')
    expect(persist).toHaveBeenNthCalledWith(1, expect.objectContaining({
      operationId: replacementOperationId,
      parentOperationId: 'web:operation-1',
      phase: 'queued',
      previewDigest: undefined,
      previewExpiresAt: undefined,
      requestHash: undefined,
    }))
    expect(rpc).toHaveBeenNthCalledWith(3, 'flowstate_patch_task_v1', expect.objectContaining({
      p_operation_id: replacementOperationId,
      p_preview: false,
      p_request_hash: REQUEST_HASH,
    }))
    expect(rpc.mock.calls.some(([, args]) => (
      args.p_operation_id === 'web:operation-1' && args.p_preview === false
    ))).toBe(false)
  })

  it('reuses a persisted preview after ambiguous apply transport failure', async () => {
    const op = operation()
    op.canonicalTaskPatch = {
      ...op.canonicalTaskPatch!,
      phase: 'previewed',
      previewDigest: 'b'.repeat(64),
      previewExpiresAt: '2026-07-13T10:15:00Z',
      requestHash: REQUEST_HASH,
      normalizedPatch: { title: 'New title' },
    }
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('lost response') })

    const result = await executeQueuedCanonicalTaskPatch({ rpc }, op, vi.fn())

    expect(result).toMatchObject({ success: false, shouldRetry: true, classification: 'transient' })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_preview: false, p_operation_id: 'web:operation-1' })
  })

  it('quarantines a persisted preview that lacks its validated normalized patch', async () => {
    const op = operation()
    op.canonicalTaskPatch = {
      ...op.canonicalTaskPatch!, phase: 'previewed', previewDigest: 'b'.repeat(64),
      previewExpiresAt: '2026-07-13T10:15:00Z',
      requestHash: REQUEST_HASH,
    }
    const rpc = vi.fn()

    const result = await executeQueuedCanonicalTaskPatch({ rpc }, op, vi.fn())

    expect(result).toMatchObject({
      success: false, error: 'invalid_persisted_canonical_preview', classification: 'permanent',
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('replays the persisted preview after a lost apply response without issuing another preview', async () => {
    const op = operation()
    const persisted: CanonicalTaskPatchState[] = []
    const firstRpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockRejectedValueOnce(new Error('response lost after commit'))

    const first = await executeQueuedCanonicalTaskPatch(
      { rpc: firstRpc }, op, async state => { persisted.push(structuredClone(state)) },
    )
    expect(first).toMatchObject({ success: false, shouldRetry: true })
    expect(persisted[0]).toMatchObject({
      phase: 'previewed', normalizedPatch: { title: 'New title' }, previewDigest: 'b'.repeat(64),
    })

    const replayed = receipt({ replayed: true })
    op.canonicalTaskPatch = persisted[0]
    const retryRpc = vi.fn().mockResolvedValue({
      data: { ok: true, result: 'committed', receipt: replayed }, error: null,
    })
    const second = await executeQueuedCanonicalTaskPatch({ rpc: retryRpc }, op, vi.fn())

    expect(second).toMatchObject({ success: true, canonicalReceipt: replayed })
    expect(retryRpc).toHaveBeenCalledTimes(1)
    expect(retryRpc.mock.calls[0][1]).toMatchObject({
      p_preview: false, p_operation_id: 'web:operation-1', p_base_revision: 4,
      p_preview_digest: 'b'.repeat(64),
    })
  })

  it('rejects committed receipts that are not bound to the persisted request hash', async () => {
    for (const requestHash of [undefined, 'invalid', 'd'.repeat(64)]) {
      const op = operation()
      op.canonicalTaskPatch = {
        ...op.canonicalTaskPatch!,
        phase: 'previewed',
        previewDigest: 'b'.repeat(64),
        previewExpiresAt: '2026-07-13T10:15:00Z',
        requestHash: REQUEST_HASH,
        normalizedPatch: { title: 'New title' },
      }
      const persist = vi.fn()
      const invalidReceipt = { ...receipt(), requestHash }

      const result = await executeQueuedCanonicalTaskPatch(
        { rpc: vi.fn().mockResolvedValue({
          data: { ok: true, result: 'committed', receipt: invalidReceipt }, error: null,
        }) },
        op,
        persist,
      )

      expect(result).toMatchObject({
        success: false,
        error: 'invalid_canonical_receipt',
        classification: 'permanent',
      })
      expect(persist).not.toHaveBeenCalled()
    }
  })

  it('rejects malformed or differently-shaped normalized previews', async () => {
    for (const normalizedPayload of [
      { status: 'done' },
      { title: '' },
      { title: 'New title', progress: 101 },
    ]) {
      const result = await executeQueuedCanonicalTaskPatch(
        { rpc: vi.fn().mockResolvedValue({ data: { ...preview(), normalizedPayload }, error: null }) },
        operation(), vi.fn(),
      )
      expect(result).toMatchObject({
        success: false, error: 'invalid_canonical_preview', classification: 'permanent',
      })
    }
  })

  it('turns a rejected RPC promise into a durable transient retry result', async () => {
    const result = await executeQueuedCanonicalTaskPatch(
      { rpc: vi.fn().mockRejectedValue(new Error('connection reset')) },
      operation(),
      vi.fn(),
    )

    expect(result).toMatchObject({
      success: false,
      shouldRetry: true,
      classification: 'transient',
      error: 'canonical_preview_transport_failed',
    })
  })

  it('passes and validates an exact shared-workspace scope', async () => {
    const op = operation()
    op.workspaceId = 'workspace-42'
    const scopedPreview = {
      ...preview(),
      readBack: { ...preview().readBack, workspaceId: 'workspace-42' },
    }
    const scopedReceipt = receipt({
      readBack: { ...receipt().readBack, workspaceId: 'workspace-42' },
    })
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: scopedPreview, error: null })
      .mockResolvedValueOnce({ data: { ok: true, result: 'committed', receipt: scopedReceipt }, error: null })

    const result = await executeQueuedCanonicalTaskPatch({ rpc }, op, vi.fn())

    expect(result).toMatchObject({ success: true })
    expect(rpc).toHaveBeenNthCalledWith(1, 'flowstate_patch_task_v1', expect.objectContaining({ p_workspace_id: 'workspace-42' }))
    expect(rpc).toHaveBeenNthCalledWith(2, 'flowstate_patch_task_v1', expect.objectContaining({ p_workspace_id: 'workspace-42' }))
  })

  it('treats not_found as a permanent rejection without persisting success evidence', async () => {
    const persist = vi.fn()
    const result = await executeQueuedCanonicalTaskPatch(
      { rpc: vi.fn().mockResolvedValue({
        data: { ok: false, result: 'rejected', error: { code: 'not_found', message: 'Task not found' } },
        error: null,
      }) },
      operation(), persist,
    )

    expect(result).toMatchObject({
      success: false, error: 'not_found: Task not found', shouldRetry: false, classification: 'permanent',
    })
    expect(persist).not.toHaveBeenCalled()
  })

  it('quarantines malformed success and surfaces stale revision as conflict', async () => {
    const malformed = await executeQueuedCanonicalTaskPatch(
      { rpc: vi.fn().mockResolvedValue({ data: { ok: true, result: 'committed', receipt: { ok: true } }, error: null }) },
      Object.assign(operation(), {
        canonicalTaskPatch: {
          ...operation().canonicalTaskPatch!,
          phase: 'previewed',
          previewDigest: 'b'.repeat(64),
          previewExpiresAt: '2026-07-13T10:15:00Z',
          requestHash: REQUEST_HASH,
          normalizedPatch: { title: 'New title' },
        },
      }),
      vi.fn(),
    )
    expect(malformed).toMatchObject({ success: false, shouldRetry: false, classification: 'permanent' })

    const staleOp = operation()
    staleOp.canonicalTaskPatch = {
      ...staleOp.canonicalTaskPatch!,
      phase: 'previewed',
      previewDigest: 'b'.repeat(64),
      previewExpiresAt: '2026-07-13T10:15:00Z',
      requestHash: REQUEST_HASH,
      normalizedPatch: { title: 'New title' },
    }
    const stale = await executeQueuedCanonicalTaskPatch(
      { rpc: vi.fn().mockResolvedValue({ data: { ok: false, error: { code: 'stale_revision', message: 'changed', currentRevision: 9 } }, error: null }) },
      staleOp,
      vi.fn(),
    )
    expect(stale).toMatchObject({ success: false, isConflict: true, classification: 'conflict', newVersion: 9 })
  })

  it('rejects a receipt whose authoritative task projection has invalid scalar types', async () => {
    const op = operation()
    op.canonicalTaskPatch = {
      ...op.canonicalTaskPatch!,
      phase: 'previewed',
      previewDigest: 'b'.repeat(64),
      previewExpiresAt: '2026-07-13T10:15:00Z',
      requestHash: REQUEST_HASH,
      normalizedPatch: { title: 'New title' },
    }
    const invalid = receipt({
      readBack: {
        id: 'task-1',
        title: 42,
        description: null,
        priority: 'high',
        dueDate: null,
        progress: 0,
        status: 'todo',
        isDeleted: false,
        workspaceId: null,
        canonicalRevision: 5,
        canonicalUpdatedAt: '2026-07-13T10:01:00Z',
      },
    } as Partial<CanonicalTaskPatchReceipt>)

    const result = await executeQueuedCanonicalTaskPatch(
      { rpc: vi.fn().mockResolvedValue({ data: { ok: true, result: 'committed', receipt: invalid }, error: null }) },
      op,
      vi.fn(),
    )

    expect(result).toMatchObject({ success: false, classification: 'permanent' })
  })

  it('rejects receipts with domain-invalid authoritative scalar values', async () => {
    const op = operation()
    op.canonicalTaskPatch = {
      ...op.canonicalTaskPatch!, phase: 'previewed', previewDigest: 'b'.repeat(64),
      previewExpiresAt: '2026-07-13T10:15:00Z', requestHash: REQUEST_HASH,
      normalizedPatch: { title: 'New title' },
    }
    for (const readBack of [
      { ...receipt().readBack, title: '' },
      { ...receipt().readBack, dueDate: 'tomorrow' },
      { ...receipt().readBack, progress: 50.5 },
      { ...receipt().readBack, progress: 101 },
      { ...receipt().readBack, status: 'arbitrary' },
    ]) {
      const result = await executeQueuedCanonicalTaskPatch(
        { rpc: vi.fn().mockResolvedValue({
          data: { ok: true, result: 'committed', receipt: receipt({ readBack }) }, error: null,
        }) },
        op, vi.fn(),
      )
      expect(result).toMatchObject({
        success: false, error: 'invalid_canonical_receipt', classification: 'permanent',
      })
    }
  })

  it('rejects a receipt whose read-back scope or timestamp disagrees with its envelope', async () => {
    const op = operation()
    op.canonicalTaskPatch = {
      ...op.canonicalTaskPatch!, phase: 'previewed', previewDigest: 'b'.repeat(64),
      previewExpiresAt: '2026-07-13T10:15:00Z', requestHash: REQUEST_HASH,
      normalizedPatch: { title: 'New title' },
    }
    const mismatched = receipt({
      readBack: {
        ...receipt().readBack,
        workspaceId: 'workspace-other',
        canonicalUpdatedAt: '2026-07-13T10:02:00Z',
      },
    })

    const result = await executeQueuedCanonicalTaskPatch(
      { rpc: vi.fn().mockResolvedValue({ data: { ok: true, result: 'committed', receipt: mismatched }, error: null }) },
      op,
      vi.fn(),
    )

    expect(result).toMatchObject({ success: false, classification: 'permanent' })
  })
})
