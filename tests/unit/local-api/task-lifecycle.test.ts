import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/task-lifecycle.cjs')
const serverPath = resolve(process.cwd(), 'server/local-api/server.cjs')
const moduleExists = existsSync(modulePath)
const serverSource = readFileSync(serverPath, 'utf8')
const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')) as {
  canonicalHash: (value: unknown) => string
}

type LifecycleAction = 'create' | 'delete' | 'restore' | 'reopen'
type RpcResult = { data: unknown; error: unknown }
type HandlerResult = { status: number; body: Record<string, unknown> }
type ExecuteTaskLifecycle = (
  context: {
    supabase: { rpc: ReturnType<typeof vi.fn> }
    activeWorkspaceId: string | null
    signedUser?: boolean
  },
  action: LifecycleAction,
  taskId: string | null,
  body: Record<string, unknown>,
  notifyTaskMutation: ReturnType<typeof vi.fn>,
) => Promise<HandlerResult>

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const taskId = '11111111-1111-4111-8111-111111111111'
const operationId = 'lifecycle-operation-1'
const requestHash = 'c'.repeat(64)
const previewDigest = 'a'.repeat(64)
const previewExpiresAt = '2026-07-15T18:15:00.000Z'

function context(rpc: ReturnType<typeof vi.fn>, activeWorkspaceId: string | null = workspaceId) {
  return { supabase: { rpc }, activeWorkspaceId, signedUser: true }
}

function harness(result: RpcResult) {
  const rpc = vi.fn().mockResolvedValue(result)
  const notifyTaskMutation = vi.fn()
  const { executeTaskLifecycle } = require(modulePath) as {
    executeTaskLifecycle: ExecuteTaskLifecycle
  }
  return { executeTaskLifecycle, notifyTaskMutation, rpc }
}

function previewFor(action: LifecycleAction, overrides: Record<string, unknown> = {}) {
  const isCreate = action === 'create'
  const isDelete = action === 'delete'
  const proposed = {
    id: taskId,
    title: isCreate ? 'Prepare launch brief' : 'Existing task',
    status: action === 'reopen' ? 'todo' : 'todo',
    completedAt: action === 'reopen' ? null : null,
    isDeleted: isDelete,
    deletedAt: isDelete ? '2026-07-15T18:01:00.000Z' : null,
    tombstonePresent: isDelete,
    workspaceId,
    canonicalRevision: isCreate ? 0 : 7,
  }
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'task-v1',
    action,
    operationId,
    baseRevision: isCreate ? 0 : 7,
    requestHash,
    previewDigest,
    previewExpiresAt,
    normalizedPayload: {
      taskId,
      ...(isCreate ? { title: 'Prepare launch brief', priority: 'high' } : {}),
    },
    readBack: proposed,
    ...overrides,
  }
}

function committedReceipt(action: LifecycleAction, overrides: Record<string, unknown> = {}) {
  const isDelete = action === 'delete'
  const readBack = {
    id: taskId,
    title: action === 'create' ? 'Prepare launch brief' : 'Existing task',
    status: action === 'reopen' ? 'todo' : 'todo',
    completedAt: null,
    isDeleted: isDelete,
    deletedAt: isDelete ? '2026-07-15T18:01:00.000Z' : null,
    tombstonePresent: isDelete,
    workspaceId,
    canonicalRevision: action === 'create' ? 1 : 8,
    canonicalUpdatedAt: '2026-07-15T18:01:00.000Z',
  }
  const affectedAction = action === 'reopen' ? 'update' : action
  return {
    ok: true,
    status: 'committed',
    contractVersion: 'task-v1',
    operationId,
    requestHash,
    source: 'local-api',
    entityType: 'task',
    action,
    entityId: taskId,
    canonicalRevision: readBack.canonicalRevision,
    canonicalUpdatedAt: readBack.canonicalUpdatedAt,
    changeSequence: 51,
    replayed: false,
    committedAt: '2026-07-15T18:01:00.010Z',
    affected: [{
      entityId: taskId,
      entityType: 'task',
      action: affectedAction,
      canonicalRevision: readBack.canonicalRevision,
      changeSequence: 51,
      readBack,
      readBackHash: canonicalHash(readBack),
    }],
    readBack,
    readBackHash: canonicalHash(readBack),
    ...overrides,
  }
}

const applyBody = {
  preview: false,
  operationId,
  baseRevision: 7,
  previewDigest,
  previewExpiresAt,
  requestHash,
}

describe('TASK-1962 canonical Local API task lifecycle', () => {
  it('ships one lifecycle handler for create, delete, restore, and reopen', () => {
    expect(moduleExists).toBe(true)
  })

  describe.skipIf(!moduleExists)('executeTaskLifecycle contract', () => {
    it.each<LifecycleAction>(['create', 'delete', 'restore', 'reopen'])(
      'rejects service-role execution of %s without a signed user',
      async (action) => {
        const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: null, error: null })

        const result = await executeTaskLifecycle(
          { ...context(rpc), signedUser: false },
          action,
          action === 'create' ? null : taskId,
          { operationId, baseRevision: action === 'create' ? 0 : 7 },
          notifyTaskMutation,
        )

        expect(result.status).toBe(401)
        expect((result.body.error as { code: string }).code).toBe('signed_user_required')
        expect(rpc).not.toHaveBeenCalled()
      },
    )

    it('rejects unsupported lifecycle actions before calling the database', async () => {
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: null, error: null })

      const result = await executeTaskLifecycle(
        context(rpc), 'purge' as LifecycleAction, taskId,
        { operationId, baseRevision: 7 }, notifyTaskMutation,
      )

      expect(result.status).toBe(400)
      expect((result.body.error as { code: string }).code).toBe('invalid_action')
      expect(rpc).not.toHaveBeenCalled()
    })

    it('defaults create to preview and returns the stable task id bound into the preview', async () => {
      const preview = previewFor('create')
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: preview, error: null })

      const result = await executeTaskLifecycle(
        context(rpc), 'create', null,
        {
          operationId,
          baseRevision: 0,
          payload: { title: 'Prepare launch brief', priority: 'high' },
        },
        notifyTaskMutation,
      )

      expect(result).toEqual({ status: 200, body: preview })
      expect((result.body.normalizedPayload as { taskId: string }).taskId).toBe(taskId)
      expect((result.body.readBack as { id: string }).id).toBe(taskId)
      expect(rpc).toHaveBeenCalledWith('flowstate_task_lifecycle_v1', {
        p_action: 'create',
        p_base_revision: 0,
        p_contract_version: 'task-v1',
        p_operation_id: operationId,
        p_payload: { title: 'Prepare launch brief', priority: 'high' },
        p_preview: true,
        p_preview_digest: null,
        p_preview_expires_at: null,
        p_request_hash: null,
        p_source: 'local-api',
        p_task_id: null,
        p_workspace_id: workspaceId,
      })
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('accepts the canonical planned and inbox create fields without dropping them', async () => {
      const preview = previewFor('create')
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: preview, error: null })
      const payload = {
        title: 'Prepare launch brief',
        status: 'planned',
        isInInbox: false,
      }

      const result = await executeTaskLifecycle(
        context(rpc), 'create', null,
        { operationId, baseRevision: 0, payload }, notifyTaskMutation,
      )

      expect(result.status).toBe(200)
      expect(rpc).toHaveBeenCalledWith(
        'flowstate_task_lifecycle_v1',
        expect.objectContaining({ p_payload: payload }),
      )
    })

    it('rejects a create preview whose issued id is not bound to its read-back', async () => {
      const preview = previewFor('create', {
        readBack: { ...previewFor('create').readBack as object, id: 'another-task' },
      })
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: preview, error: null })

      const result = await executeTaskLifecycle(
        context(rpc), 'create', null,
        { operationId, baseRevision: 0, payload: { title: 'Prepare launch brief' } },
        notifyTaskMutation,
      )

      expect(result.status).toBe(502)
      expect((result.body.error as { code: string }).code).toBe('invalid_canonical_response')
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it.each(['operationId', 'baseRevision', 'previewDigest', 'previewExpiresAt', 'requestHash'])(
      'requires %s from the exact approved preview before apply',
      async (required) => {
        const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: null, error: null })
        const body: Record<string, unknown> = { ...applyBody }
        delete body[required]

        const result = await executeTaskLifecycle(
          context(rpc), 'delete', taskId, body, notifyTaskMutation,
        )

        expect(result.status).toBe(400)
        expect((result.body.error as { code: string }).code).toBe('approval_receipt_required')
        expect(rpc).not.toHaveBeenCalled()
      },
    )

    it.each<LifecycleAction>(['delete', 'restore', 'reopen'])(
      'passes the exact active workspace and approval binding for %s',
      async (action) => {
        const receipt = committedReceipt(action)
        const response = { ok: true, result: 'committed', requestHash, receipt }
        const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: response, error: null })

        const result = await executeTaskLifecycle(
          context(rpc), action, taskId, applyBody, notifyTaskMutation,
        )

        expect(result.status).toBe(200)
        expect(rpc).toHaveBeenCalledWith('flowstate_task_lifecycle_v1', {
          p_action: action,
          p_base_revision: 7,
          p_contract_version: 'task-v1',
          p_operation_id: operationId,
          p_payload: {},
          p_preview: false,
          p_preview_digest: previewDigest,
          p_preview_expires_at: previewExpiresAt,
          p_request_hash: requestHash,
          p_source: 'local-api',
          p_task_id: taskId,
          p_workspace_id: workspaceId,
        })
        expect(notifyTaskMutation).toHaveBeenCalledTimes(1)
        expect(notifyTaskMutation).toHaveBeenCalledWith(
          action === 'delete' ? 'delete' : 'update', taskId,
        )
      },
    )

    it('binds personal scope as null instead of silently changing workspace', async () => {
      const preview = previewFor('restore', {
        readBack: { ...previewFor('restore').readBack as object, workspaceId: null },
      })
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: preview, error: null })

      const result = await executeTaskLifecycle(
        context(rpc, null), 'restore', taskId,
        { operationId, baseRevision: 7 }, notifyTaskMutation,
      )

      expect(result.status).toBe(200)
      expect(rpc).toHaveBeenCalledWith(
        'flowstate_task_lifecycle_v1',
        expect.objectContaining({ p_task_id: taskId, p_workspace_id: null }),
      )
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it.each([
      'stale_revision',
      'idempotency_conflict',
      'preview_mismatch',
      'preview_expired',
      'restore_conflict',
      'already_deleted',
      'already_open',
    ])('maps %s to a typed 409 without renderer notification', async (code) => {
      const rejection = { ok: false, result: 'conflict', error: { code, message: 'conflict' } }
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: rejection, error: null })

      const result = await executeTaskLifecycle(
        context(rpc), 'restore', taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(409)
      expect(result.body).toEqual(rejection)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('maps workspace scope denial to 403 instead of hiding it as a server failure', async () => {
      const rejection = {
        ok: false, result: 'rejected', error: { code: 'scope_denied', message: 'denied' },
      }
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: rejection, error: null })

      const result = await executeTaskLifecycle(
        context(rpc), 'delete', taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(403)
      expect(result.body).toEqual(rejection)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it.each<[LifecycleAction, boolean]>([
      ['create', false],
      ['delete', true],
      ['restore', false],
      ['reopen', false],
    ])('verifies %s tombstone/read-back state before notifying', async (action, tombstonePresent) => {
      const receipt = committedReceipt(action)
      const response = { ok: true, result: 'committed', requestHash, receipt }
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({ data: response, error: null })
      const body = action === 'create'
        ? { ...applyBody, baseRevision: 0, payload: { title: 'Prepare launch brief' }, taskId }
        : applyBody

      const result = await executeTaskLifecycle(
        context(rpc), action, action === 'create' ? null : taskId, body, notifyTaskMutation,
      )

      expect(result.status).toBe(200)
      expect((receipt.readBack as { tombstonePresent: boolean }).tombstonePresent).toBe(tombstonePresent)
      expect(notifyTaskMutation).toHaveBeenCalledTimes(1)
    })

    it('rejects a forged canonical receipt before renderer notification', async () => {
      const receipt = committedReceipt('delete', { readBackHash: 'f'.repeat(64) })
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({
        data: { ok: true, result: 'committed', requestHash, receipt }, error: null,
      })

      const result = await executeTaskLifecycle(
        context(rpc), 'delete', taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(502)
      expect((result.body.error as { code: string }).code).toBe('invalid_canonical_receipt')
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })

    it('rejects a delete receipt that claims no tombstone or active task state', async () => {
      const receipt = committedReceipt('delete')
      const readBack = {
        ...(receipt.readBack as Record<string, unknown>),
        isDeleted: false,
        deletedAt: null,
        tombstonePresent: false,
      }
      const forged = {
        ...receipt,
        readBack,
        readBackHash: canonicalHash(readBack),
        affected: [{
          ...(receipt.affected as Array<Record<string, unknown>>)[0],
          readBack,
          readBackHash: canonicalHash(readBack),
        }],
      }
      const { executeTaskLifecycle, notifyTaskMutation, rpc } = harness({
        data: { ok: true, result: 'committed', requestHash, receipt: forged }, error: null,
      })

      const result = await executeTaskLifecycle(
        context(rpc), 'delete', taskId, applyBody, notifyTaskMutation,
      )

      expect(result.status).toBe(502)
      expect(notifyTaskMutation).not.toHaveBeenCalled()
    })
  })
})

describe('TASK-1962 lifecycle route contract', () => {
  it('routes the four lifecycle actions through one handler behind bearer and signed-in checks', () => {
    const tokenBoundary = serverSource.indexOf('if (TOKEN)')

    expect(serverSource).toContain("const { executeTaskLifecycle } = require('./task-lifecycle.cjs')")
    expect(serverSource).toContain('executeTaskLifecycle(ctx, action, taskId, body, notifyTaskMutation)')
    expect(serverSource.indexOf("handleTaskLifecycle('create', null, req, res)")).toBeGreaterThan(tokenBoundary)
    for (const action of ['delete', 'restore', 'reopen']) {
      const route = `path.match(/^\\/api\\/tasks\\/([^/]+)\\/${action}$/)`
      expect(serverSource.indexOf(route), `${action} route not found`).toBeGreaterThan(tokenBoundary)
      expect(serverSource).toContain(
        `handleTaskLifecycle('${action}', decodeURIComponent(${action}TaskMatch[1]), req, res)`,
      )
    }
  })

  it('removes the weak bare DELETE mutation path', () => {
    expect(serverSource).not.toContain("if (req.method === 'DELETE' && taskMatch)")
    expect(serverSource).not.toContain('return await handleDeleteTask(decodeURIComponent(taskMatch[1]), res)')
  })
})
