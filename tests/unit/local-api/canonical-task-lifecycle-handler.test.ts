import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { canonicalHash } = require('../../../server/local-api/canonical-receipt.cjs') as {
  canonicalHash: (value: unknown) => string
}

type RpcResult = { data: unknown; error: unknown }

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const operationId = 'lifecycle-operation-1'
const taskId = '11111111-1111-4111-8111-111111111111'

function normalizedRequest(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 'task-lifecycle-v1',
    source: 'local-api',
    action: 'set_status',
    taskId,
    baseRevision: 7,
    workspaceId,
    payload: { status: 'in_progress' },
    ...overrides,
  }
}

function preview(overrides: Record<string, unknown> = {}) {
  const normalizedPayload = normalizedRequest()
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'task-lifecycle-v1',
    operationId,
    action: 'set_status',
    taskId,
    baseRevision: 7,
    requestHash: canonicalHash(normalizedPayload),
    previewDigest: 'a'.repeat(64),
    previewExpiresAt: '2026-07-15T13:15:00.000Z',
    normalizedPayload,
    ...overrides,
  }
}

function committedResponse(overrides: Record<string, unknown> = {}) {
  const requestHash = canonicalHash(normalizedRequest())
  const readBack = {
    id: taskId,
    title: 'A task',
    description: '',
    priority: null,
    dueDate: null,
    projectId: null,
    status: 'in_progress',
    isDeleted: false,
    deletedAt: null,
    tombstone: false,
    workspaceId,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T13:01:00.000Z',
  }
  const receipt = {
    contractVersion: 'task-lifecycle-v1',
    operationId,
    source: 'local-api',
    status: 'committed',
    requestHash,
    entityType: 'task',
    action: 'set_status',
    entityId: taskId,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T13:01:00.000Z',
    changeSequence: 52,
    replayed: false,
    committedAt: '2026-07-15T13:01:00.010Z',
    readBack,
    readBackHash: canonicalHash(readBack),
  }
  return {
    ok: true,
    status: 'committed',
    result: 'committed',
    requestHash,
    receipt,
    ...overrides,
  }
}

function harness(result: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(result)
  const notify = vi.fn()
  const { executeCanonicalTaskLifecycle } = require('../../../server/local-api/canonical-task-lifecycle.cjs') as {
    executeCanonicalTaskLifecycle: (
      context: { supabase: { rpc: typeof rpc }; activeWorkspaceId: string | null; signedUser: boolean },
      body: Record<string, unknown>,
      notifyTaskMutation: typeof notify,
    ) => Promise<{ status: number; body: unknown }>
  }
  return { executeCanonicalTaskLifecycle, notify, rpc }
}

const context = (rpc: ReturnType<typeof vi.fn>, signedUser = true) => ({
  supabase: { rpc },
  activeWorkspaceId: workspaceId,
  signedUser,
})

describe('canonical Local API task lifecycle handler', () => {
  it('defaults to preview and forwards the exact normalized request scope', async () => {
    const data = preview()
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalTaskLifecycle(context(rpc), {
      operationId,
      taskId,
      baseRevision: 7,
      action: 'set_status',
      payload: { status: 'in_progress' },
    }, notify)).resolves.toEqual({ status: 200, body: data })

    expect(rpc).toHaveBeenCalledWith('flowstate_task_lifecycle_v1', {
      p_action: 'set_status',
      p_base_revision: 7,
      p_contract_version: 'task-lifecycle-v1',
      p_operation_id: operationId,
      p_payload: { status: 'in_progress' },
      p_preview: true,
      p_preview_digest: null,
      p_preview_expires_at: null,
      p_source: 'local-api',
      p_task_id: taskId,
      p_workspace_id: workspaceId,
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('normalizes create payload and preserves every supported Hermes field in the preview binding', async () => {
    const payload = {
      title: 'New task',
      status: 'planned',
      description: 'Keep this context',
      priority: 'high',
      dueDate: '2026-07-20',
      projectId: '22222222-2222-4222-8222-222222222222',
    }
    const normalizedPayload = normalizedRequest({
      action: 'create',
      baseRevision: 0,
      payload,
    })
    const data = preview({
      action: 'create',
      baseRevision: 0,
      requestHash: canonicalHash(normalizedPayload),
      normalizedPayload,
    })
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalTaskLifecycle(context(rpc), {
      operationId,
      taskId,
      baseRevision: 0,
      action: 'create',
      payload: { ...payload, title: '  New task  ' },
    }, notify)).resolves.toEqual({ status: 200, body: data })
    expect(rpc).toHaveBeenCalledWith('flowstate_task_lifecycle_v1', expect.objectContaining({
      p_payload: payload,
    }))
  })

  it('uses deterministic create defaults without dropping explicit null fields', async () => {
    const payload = {
      title: 'New task',
      status: 'planned',
      description: '',
      priority: null,
      dueDate: null,
      projectId: null,
    }
    const normalizedPayload = normalizedRequest({ action: 'create', baseRevision: 0, payload })
    const data = preview({
      action: 'create',
      baseRevision: 0,
      requestHash: canonicalHash(normalizedPayload),
      normalizedPayload,
    })
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data, error: null })

    await executeCanonicalTaskLifecycle(context(rpc), {
      operationId,
      taskId,
      baseRevision: 0,
      action: 'create',
      payload: { title: 'New task' },
    }, notify)

    expect(rpc).toHaveBeenCalledWith('flowstate_task_lifecycle_v1', expect.objectContaining({
      p_payload: payload,
    }))
  })

  it('verifies the complete Hermes create projection before announcing creation', async () => {
    const payload = {
      title: 'New task',
      status: 'planned',
      description: 'Keep this context',
      priority: 'high',
      dueDate: '2026-07-20',
      projectId: '22222222-2222-4222-8222-222222222222',
    }
    const normalized = normalizedRequest({ action: 'create', baseRevision: 0, payload })
    const response = committedResponse()
    const readBack = {
      ...response.receipt.readBack,
      ...payload,
      canonicalRevision: 1,
    }
    const receipt = {
      ...response.receipt,
      action: 'create',
      canonicalRevision: 1,
      requestHash: canonicalHash(normalized),
      readBack,
      readBackHash: canonicalHash(readBack),
    }
    const data = { ...response, requestHash: canonicalHash(normalized), receipt }
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalTaskLifecycle(context(rpc), {
      preview: false,
      operationId,
      taskId,
      baseRevision: 0,
      action: 'create',
      payload,
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T13:15:00.000Z',
      requestHash: canonicalHash(normalized),
    }, notify)).resolves.toEqual({ status: 200, body: data })
    expect(notify).toHaveBeenCalledWith('create', taskId)
  })

  it('requires the complete issued approval binding before apply', async () => {
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data: null, error: null })
    const complete = {
      preview: false,
      operationId,
      taskId,
      baseRevision: 7,
      action: 'set_status',
      payload: { status: 'in_progress' },
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T13:15:00.000Z',
    }

    for (const field of ['previewDigest', 'previewExpiresAt']) {
      const body = { ...complete }
      delete body[field as keyof typeof body]
      await expect(executeCanonicalTaskLifecycle(context(rpc), body, notify)).resolves.toMatchObject({
        status: 400,
        body: { ok: false, error: { code: 'approval_receipt_required' } },
      })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a changed server-issued request hash before apply', async () => {
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data: null, error: null })

    await expect(executeCanonicalTaskLifecycle(context(rpc), {
      preview: false,
      operationId,
      taskId,
      baseRevision: 7,
      action: 'set_status',
      payload: { status: 'in_progress' },
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T13:15:00.000Z',
      requestHash: 'b'.repeat(64),
    }, notify)).resolves.toMatchObject({
      status: 409,
      body: { ok: false, error: { code: 'request_hash_mismatch' } },
    })
    expect(rpc).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects action payloads that do not match the lifecycle contract', async () => {
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data: null, error: null })
    for (const body of [
      { operationId, taskId, baseRevision: 1, action: 'soft_delete', payload: { status: 'done' } },
      { operationId, taskId, baseRevision: 1, action: 'set_status', payload: { status: 'invalid' } },
      { operationId, taskId, baseRevision: 0, action: 'create', payload: { title: '' } },
      { operationId, taskId, baseRevision: 0, action: 'create', payload: { title: 'Task', priority: 'urgent' } },
      { operationId, taskId, baseRevision: 0, action: 'create', payload: { title: 'Task', dueDate: '2026-02-30' } },
      { operationId, taskId, baseRevision: 0, action: 'create', payload: { title: 'x'.repeat(501) } },
      { operationId, taskId, baseRevision: 0, action: 'create', payload: { title: 'Task', description: 'x'.repeat(10001) } },
      { operationId, taskId, baseRevision: 7, action: 'unknown', payload: {} },
    ]) {
      await expect(executeCanonicalTaskLifecycle(context(rpc), body, notify)).resolves.toMatchObject({
        status: 400,
        body: { ok: false },
      })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('accepts an exact committed receipt and only then reconciles the renderer', async () => {
    const data = committedResponse()
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalTaskLifecycle(context(rpc), {
      preview: false,
      operationId,
      taskId,
      baseRevision: 7,
      action: 'set_status',
      payload: { status: 'in_progress' },
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T13:15:00.000Z',
    }, notify)).resolves.toEqual({ status: 200, body: data })

    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('update', taskId)
    expect(rpc).toHaveBeenCalledWith('flowstate_task_lifecycle_v1', {
      p_action: 'set_status',
      p_base_revision: 7,
      p_contract_version: 'task-lifecycle-v1',
      p_operation_id: operationId,
      p_payload: { status: 'in_progress' },
      p_preview: false,
      p_preview_digest: 'a'.repeat(64),
      p_preview_expires_at: '2026-07-15T13:15:00.000Z',
      p_source: 'local-api',
      p_task_id: taskId,
      p_workspace_id: workspaceId,
    })
  })

  it('rejects an explicit workspace that does not match the signed-in active scope', async () => {
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data: preview(), error: null })
    const result = await executeCanonicalTaskLifecycle(context(rpc), {
      operationId,
      taskId,
      baseRevision: 7,
      action: 'set_status',
      payload: { status: 'in_progress' },
      workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }, notify)

    expect(result).toMatchObject({ status: 409, body: { error: { code: 'workspace_mismatch' } } })
    expect(rpc).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  })

  it.each([
    ['envelope request hash', (data: ReturnType<typeof committedResponse>) => ({ ...data, requestHash: 'b'.repeat(64) })],
    ['receipt request hash', (data: ReturnType<typeof committedResponse>) => ({ ...data, receipt: { ...data.receipt, requestHash: 'b'.repeat(64) } })],
    ['receipt status', (data: ReturnType<typeof committedResponse>) => ({ ...data, receipt: { ...data.receipt, status: 'replayed' } })],
    ['read-back hash', (data: ReturnType<typeof committedResponse>) => ({ ...data, receipt: { ...data.receipt, readBackHash: 'b'.repeat(64) } })],
    ['read-back workspace', (data: ReturnType<typeof committedResponse>) => ({
      ...data,
      receipt: {
        ...data.receipt,
        readBack: { ...data.receipt.readBack, workspaceId: null },
      },
    })],
  ])('rejects a mismatched %s without reconciliation', async (_label, mutate) => {
    const data = mutate(committedResponse())
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data, error: null })
    const result = await executeCanonicalTaskLifecycle(context(rpc), {
      preview: false,
      operationId,
      taskId,
      baseRevision: 7,
      action: 'set_status',
      payload: { status: 'in_progress' },
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T13:15:00.000Z',
    }, notify)

    expect(result).toMatchObject({ status: 502, body: { error: { code: 'invalid_canonical_receipt' } } })
    expect(notify).not.toHaveBeenCalled()
  })

  it('accepts replay only when the committed envelope and receipt remain coherent', async () => {
    const original = committedResponse()
    const data = { ...original, receipt: { ...original.receipt, replayed: true } }
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalTaskLifecycle(context(rpc), {
      preview: false,
      operationId,
      taskId,
      baseRevision: 7,
      action: 'set_status',
      payload: { status: 'in_progress' },
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2026-07-15T13:15:00.000Z',
    }, notify)).resolves.toEqual({ status: 200, body: data })
    expect(notify).toHaveBeenCalledWith('update', taskId)
  })

  it('maps lifecycle mutation actions to exact renderer reconciliation operations', async () => {
    for (const [action, operation] of [
      ['create', 'create'],
      ['soft_delete', 'delete'],
      ['restore', 'update'],
    ] as const) {
      const baseRevision = action === 'create' ? 0 : 7
      const payload = action === 'create'
        ? { title: 'A task', status: 'planned', description: '', priority: null, dueDate: null, projectId: null }
        : {}
      const normalized = normalizedRequest({ action, baseRevision, payload })
      const response = committedResponse()
      const readBack = {
        ...response.receipt.readBack,
        canonicalRevision: baseRevision + 1,
        status: action === 'create' ? 'planned' : response.receipt.readBack.status,
        isDeleted: action === 'soft_delete',
        deletedAt: action === 'soft_delete' ? '2026-07-15T13:01:00.000Z' : null,
        tombstone: action === 'soft_delete',
      }
      const data = {
        ...response,
        requestHash: canonicalHash(normalized),
        receipt: {
          ...response.receipt,
          action,
          canonicalRevision: baseRevision + 1,
          requestHash: canonicalHash(normalized),
          readBack,
          readBackHash: canonicalHash(readBack),
        },
      }
      const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data, error: null })
      await executeCanonicalTaskLifecycle(context(rpc), {
        preview: false,
        operationId,
        taskId,
        baseRevision,
        action,
        payload,
        previewDigest: 'a'.repeat(64),
        previewExpiresAt: '2026-07-15T13:15:00.000Z',
      }, notify)
      expect(notify).toHaveBeenCalledWith(operation, taskId)
    }
  })

  it.each([
    ['invalid_request', 400],
    ['invalid_task_id', 400],
    ['invalid_create', 400],
    ['invalid_status', 400],
    ['not_authenticated', 401],
    ['not_found', 404],
    ['project_not_found', 404],
    ['stale_revision', 409],
    ['idempotency_conflict', 409],
    ['preview_mismatch', 409],
    ['preview_expired', 409],
    ['task_id_unavailable', 409],
    ['already_deleted', 409],
    ['restore_not_available', 409],
    ['task_deleted', 409],
    ['no_change', 409],
    ['recurrence_requires_done_for_now', 409],
  ])('maps typed lifecycle error %s to HTTP %s', async (code, status) => {
    const body = { ok: false, result: 'rejected', error: { code, message: 'safe message' } }
    const { executeCanonicalTaskLifecycle, notify, rpc } = harness({ data: body, error: null })
    const result = await executeCanonicalTaskLifecycle(context(rpc), {
      operationId,
      taskId,
      baseRevision: 7,
      action: 'set_status',
      payload: { status: 'in_progress' },
    }, notify)
    expect(result).toEqual({
      status,
      body: code === 'recurrence_requires_done_for_now'
        ? { ...body, action: 'use_flowstate_done_for_now' }
        : body,
    })
  })

  it('refuses service-role writes and redacts connector failures', async () => {
    const first = harness({ data: preview(), error: null })
    await expect(first.executeCanonicalTaskLifecycle(context(first.rpc, false), {
      operationId, taskId, baseRevision: 7, action: 'set_status', payload: { status: 'in_progress' },
    }, first.notify)).resolves.toMatchObject({ status: 401, body: { error: { code: 'signed_user_required' } } })
    expect(first.rpc).not.toHaveBeenCalled()

    const second = harness({ data: null, error: { message: 'private database details' } })
    const result = await second.executeCanonicalTaskLifecycle(context(second.rpc), {
      operationId, taskId, baseRevision: 7, action: 'set_status', payload: { status: 'in_progress' },
    }, second.notify)
    expect(result).toMatchObject({ status: 500, body: { error: { code: 'canonical_task_lifecycle_failed' } } })
    expect(JSON.stringify(result)).not.toContain('private database')
  })
})
