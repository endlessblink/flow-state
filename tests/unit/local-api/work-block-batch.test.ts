import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/work-block-batch.cjs')
const serverPath = resolve(process.cwd(), 'server/local-api/server.cjs')
const moduleExists = existsSync(modulePath)
const serverSource = readFileSync(serverPath, 'utf8')
const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')) as {
  canonicalHash: (value: unknown) => string
}

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const taskId = '11111111-1111-4111-8111-111111111111'
const secondTaskId = '22222222-2222-4222-8222-222222222222'
const operationId = 'evening-plan-work-blocks'
const requestHash = 'c'.repeat(64)
const previewDigest = 'a'.repeat(64)
const previewExpiresAt = '2026-07-15T21:15:00.000Z'
const workBlockId = '33333333-3333-4333-8333-333333333333'

const operations = [
  {
    kind: 'create', taskId, baseRevision: 7, clientId: 'morning-focus',
    scheduledDate: '2026-07-16', scheduledTime: '09:30', duration: 25,
  },
  {
    kind: 'resize', taskId: secondTaskId, baseRevision: 3,
    workBlockId: '44444444-4444-4444-8444-444444444444',
    baseWorkBlockHash: 'b'.repeat(64), duration: 40,
  },
]
const canonicalOperations = operations
const normalizedOperations = canonicalOperations.map((entry, index) => index === 0
  ? { ...entry, workBlockId }
  : entry)

const taskReadBack = (id: string, revision: number, instances: object[]) => ({
  id,
  workspaceId,
  canonicalRevision: revision,
  canonicalUpdatedAt: '2026-07-15T20:05:00.000Z',
  status: 'planned',
  isInInbox: false,
  instances,
})

const firstInstances = [{
  id: workBlockId,
  scheduledDate: '2026-07-16',
  scheduledTime: '09:30',
  duration: 25,
    timeZone: 'Asia/Jerusalem', clientId: 'morning-focus',
}]
const secondInstances = [
  { id: 'keep-sibling', scheduledDate: '2026-07-16', scheduledTime: '12:00', duration: 15 },
  { id: '44444444-4444-4444-8444-444444444444', scheduledDate: '2026-07-16', scheduledTime: '13:00', duration: 40 },
]

function affected(id: string, revision: number, instances: object[], sequence: number) {
  const readBack = taskReadBack(id, revision, instances)
  return {
    entityId: id,
    entityType: 'task',
    action: 'update',
    canonicalRevision: revision,
    changeSequence: sequence,
    readBack,
    readBackHash: canonicalHash(readBack),
  }
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'task-v1',
    action: 'work_block_batch',
    operationId,
    requestHash,
    previewDigest,
    previewExpiresAt,
    timeZone: 'Asia/Jerusalem',
    finishBy: null,
    normalizedPayload: {
      timeZone: 'Asia/Jerusalem', finishBy: null, operations: normalizedOperations,
    },
    overlapWarnings: [],
    readBack: [
      taskReadBack(taskId, 7, firstInstances),
      taskReadBack(secondTaskId, 3, secondInstances),
    ],
    ...overrides,
  }
}

function committed(overrides: Record<string, unknown> = {}) {
  const primary = affected(taskId, 8, firstInstances, 71)
  const secondary = affected(secondTaskId, 4, secondInstances, 72)
  const readBack = [primary.readBack, secondary.readBack]
  return {
    ok: true,
    result: 'committed',
    action: 'work_block_batch',
    operationId,
    requestHash,
    receipt: {
      ok: true,
      status: 'committed',
      contractVersion: 'task-v1',
      operationId,
      requestHash,
      source: 'local-api',
      entityType: 'batch',
      action: 'work_block_batch',
      entityId: operationId,
      canonicalRevision: 8,
      changeSequence: 71,
      replayed: false,
      committedAt: '2026-07-15T20:05:00.010Z',
      affected: [primary, secondary],
      readBack,
      readBackHash: canonicalHash(readBack),
      ...overrides,
    },
  }
}

type Result = { status: number; body: Record<string, any> }
type Execute = (
  context: {
    supabase: { rpc: ReturnType<typeof vi.fn> }
    activeWorkspaceId: string | null
    signedUser?: boolean
  },
  body: Record<string, unknown>,
  notify: ReturnType<typeof vi.fn>,
) => Promise<Result>

function harness(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error })
  const notify = vi.fn()
  const { executeWorkBlockBatch } = require(modulePath) as { executeWorkBlockBatch: Execute }
  return { executeWorkBlockBatch, rpc, notify }
}

const context = (rpc: ReturnType<typeof vi.fn>) => ({
  supabase: { rpc }, activeWorkspaceId: workspaceId, signedUser: true,
})

const applyBody = {
  operationId,
  timeZone: 'Asia/Jerusalem',
  operations,
  preview: false,
  previewDigest,
  previewExpiresAt,
  requestHash,
}

describe('TASK-1964 canonical Local API work-block batch', () => {
  it('ships one canonical batch route plus singular compatibility adapters', () => {
    expect(moduleExists).toBe(true)
    expect(serverSource).toContain("require('./work-block-batch.cjs')")
    expect(serverSource).toContain("path === '/api/work-blocks/batch'")
    expect(serverSource).toContain("req.method === 'PATCH' && taskInstanceMatch")
    expect(serverSource).toContain("req.method === 'DELETE' && taskInstanceMatch")
  })

  describe.skipIf(!moduleExists)('executeWorkBlockBatch contract', () => {
    it('reads inventory for an active-workspace editor even when another user owns the task', async () => {
      const { readWorkBlockInventory } = require(modulePath) as {
        readWorkBlockInventory: (context: Record<string, unknown>, taskId: string) => Promise<Record<string, any>>
      }
      const row = {
        id: taskId,
        title: 'Shared plan',
        user_id: 'workspace-task-owner',
        workspace_id: workspaceId,
        canonical_revision: 7,
        instances: [],
      }
      const query: Record<string, any> = {}
      query.select = vi.fn(() => query)
      query.eq = vi.fn(() => query)
      query.is = vi.fn(() => query)
      query.maybeSingle = vi.fn(async () => ({ data: row, error: null }))
      const supabase = {
        rpc: vi.fn(async () => ({ data: true, error: null })),
        from: vi.fn(() => query),
      }

      const result = await readWorkBlockInventory({
        supabase,
        userId: 'workspace-editor',
        activeWorkspaceId: workspaceId,
        signedUser: true,
      }, taskId)

      expect(result.status).toBe(200)
      expect(result.body.task.workspaceId).toBe(workspaceId)
      expect(supabase.rpc).toHaveBeenCalledWith('flowstate_can_write_workspace_v1', {
        p_workspace_id: workspaceId,
      })
      expect(query.eq).toHaveBeenCalledWith('workspace_id', workspaceId)
      expect(query.eq).not.toHaveBeenCalledWith('user_id', 'workspace-editor')
    })

    it('rejects viewer inventory before reading the active workspace task', async () => {
      const { readWorkBlockInventory } = require(modulePath) as {
        readWorkBlockInventory: (context: Record<string, unknown>, taskId: string) => Promise<Record<string, any>>
      }
      const supabase = {
        rpc: vi.fn(async () => ({ data: false, error: null })),
        from: vi.fn(),
      }

      const result = await readWorkBlockInventory({
        supabase,
        userId: 'workspace-viewer',
        activeWorkspaceId: workspaceId,
        signedUser: true,
      }, taskId)

      expect(result).toEqual({
        status: 403,
        body: {
          ok: false,
          error: { code: 'scope_denied', message: 'Task write access is required' },
        },
      })
      expect(supabase.from).not.toHaveBeenCalled()
    })

    it('keeps personal inventory scoped to the signed user and outside all workspaces', async () => {
      const { readWorkBlockInventory } = require(modulePath) as {
        readWorkBlockInventory: (context: Record<string, unknown>, taskId: string) => Promise<Record<string, any>>
      }
      const query: Record<string, any> = {}
      query.select = vi.fn(() => query)
      query.eq = vi.fn(() => query)
      query.is = vi.fn(() => query)
      query.maybeSingle = vi.fn(async () => ({ data: null, error: null }))
      const supabase = { rpc: vi.fn(), from: vi.fn(() => query) }

      const result = await readWorkBlockInventory({
        supabase,
        userId: 'personal-owner',
        activeWorkspaceId: null,
        signedUser: true,
      }, taskId)

      expect(result.status).toBe(404)
      expect(query.eq).toHaveBeenCalledWith('user_id', 'personal-owner')
      expect(query.is).toHaveBeenCalledWith('workspace_id', null)
      expect(supabase.rpc).not.toHaveBeenCalled()
    })

    it('builds a fresh mutation-ready inventory with parent revision and exact block hashes', () => {
      const { buildWorkBlockInventory } = require(modulePath) as {
        buildWorkBlockInventory: (task: Record<string, unknown>) => Record<string, any>
      }
      const instances = [
        { id: 'block-a', scheduledDate: '2026-07-16', scheduledTime: '09:00', duration: 30 },
        { id: 'block-b', scheduledDate: '2026-07-16', scheduledTime: '10:00', duration: 25 },
      ]

      const inventory = buildWorkBlockInventory({
        id: taskId, title: 'Plan launch', canonical_revision: 7, workspace_id: workspaceId,
        instances,
      })

      expect(inventory).toEqual({
        ok: true,
        fresh: true,
        task: { id: taskId, title: 'Plan launch', workspaceId, canonicalRevision: 7 },
        instances: instances.map(instance => ({
          ...instance,
          baseWorkBlockHash: canonicalHash(instance),
        })),
      })
    })

    it('previews the exact normalized multi-parent operation set without notifying', async () => {
      const response = preview()
      const { executeWorkBlockBatch, rpc, notify } = harness(response)

      const result = await executeWorkBlockBatch(
        context(rpc), { operationId, timeZone: 'Asia/Jerusalem', operations }, notify,
      )

      expect(result).toEqual({ status: 200, body: response })
      expect(rpc).toHaveBeenCalledWith('flowstate_work_block_batch_v1', {
        p_contract_version: 'task-v1',
        p_operation_id: operationId,
        p_operations: canonicalOperations,
        p_preview: true,
        p_preview_digest: null,
        p_preview_expires_at: null,
        p_request_hash: null,
        p_source: 'local-api',
        p_finish_by: null,
        p_time_zone: 'Asia/Jerusalem',
        p_workspace_id: workspaceId,
      })
      expect(notify).not.toHaveBeenCalled()
    })

    it.each(['operationId', 'previewDigest', 'previewExpiresAt', 'requestHash'])(
      'requires %s from the approved preview before apply',
      async (field) => {
        const body: Record<string, unknown> = { ...applyBody }
        delete body[field]
        const { executeWorkBlockBatch, rpc, notify } = harness(null)

        const result = await executeWorkBlockBatch(context(rpc), body, notify)

        expect(result.status).toBe(400)
        expect(result.body.error.code).toBe('approval_receipt_required')
        expect(rpc).not.toHaveBeenCalled()
        expect(notify).not.toHaveBeenCalled()
      },
    )

    it('rejects a preview that changes stable identity or approved interval', async () => {
      const forgedOperations = operations.map((entry, index) => index === 0
        ? { ...entry, workBlockId: 'forged', duration: 90 }
        : entry)
      const { executeWorkBlockBatch, rpc, notify } = harness(preview({
        normalizedPayload: {
          timeZone: 'Asia/Jerusalem', finishBy: null, operations: forgedOperations,
        },
      }))

      const result = await executeWorkBlockBatch(
        context(rpc), { operationId, timeZone: 'Asia/Jerusalem', operations }, notify,
      )

      expect(result.status).toBe(502)
      expect(result.body.error.code).toBe('invalid_canonical_response')
      expect(notify).not.toHaveBeenCalled()
    })

    it('accepts the same finish-by instant after database timezone normalization', async () => {
      const finishBy = '2026-07-16T20:00:00+03:00'
      const response = preview({
        finishBy: '2026-07-16T17:00:00+00:00',
        normalizedPayload: {
          timeZone: 'Asia/Jerusalem',
          finishBy: '2026-07-16T17:00:00+00:00',
          operations: normalizedOperations,
        },
      })
      const { executeWorkBlockBatch, rpc, notify } = harness(response)

      const result = await executeWorkBlockBatch(
        context(rpc), { operationId, timeZone: 'Asia/Jerusalem', finishBy, operations }, notify,
      )

      expect(result.status).toBe(200)
      expect(rpc).toHaveBeenCalledWith(
        'flowstate_work_block_batch_v1', expect.objectContaining({ p_finish_by: finishBy }),
      )
    })

    it.each(['stale_revision', 'work_block_not_found', 'idempotency_conflict', 'preview_mismatch'])(
      'preserves typed canonical conflict %s without notifying',
      async (code) => {
        const { executeWorkBlockBatch, rpc, notify } = harness({
          ok: false, error: { code, message: code },
        })

        const result = await executeWorkBlockBatch(context(rpc), applyBody, notify)

        expect(result.status).toBe(code === 'work_block_not_found' ? 404 : 409)
        expect(result.body.error.code).toBe(code)
        expect(notify).not.toHaveBeenCalled()
      },
    )

    it('accepts only exact verified per-parent outcomes before notifying each parent', async () => {
      const response = committed()
      const { executeWorkBlockBatch, rpc, notify } = harness(response)

      const result = await executeWorkBlockBatch(context(rpc), applyBody, notify)

      expect(result).toEqual({ status: 200, body: response })
      expect(notify).toHaveBeenNthCalledWith(1, 'update', taskId)
      expect(notify).toHaveBeenNthCalledWith(2, 'update', secondTaskId)
    })

    it('rejects a self-consistent receipt with the wrong approved interval', async () => {
      const response = committed()
      const receipt = response.receipt as Record<string, any>
      const alteredTask = {
        ...receipt.readBack[0],
        instances: [{ ...receipt.readBack[0].instances[0], duration: 90 }],
      }
      receipt.readBack[0] = alteredTask
      receipt.readBackHash = canonicalHash(receipt.readBack)
      receipt.affected[0].readBack = alteredTask
      receipt.affected[0].readBackHash = canonicalHash(alteredTask)
      const { executeWorkBlockBatch, rpc, notify } = harness(response)

      const result = await executeWorkBlockBatch(context(rpc), applyBody, notify)

      expect(result.status).toBe(502)
      expect(result.body.error.code).toBe('invalid_canonical_response')
      expect(notify).not.toHaveBeenCalled()
    })

    it('returns a stable verification failure for an unsafe receipt payload', async () => {
      const response = committed()
      const receipt = response.receipt as Record<string, any>
      receipt.readBack = undefined
      const { executeWorkBlockBatch, rpc, notify } = harness(response)

      const result = await executeWorkBlockBatch(context(rpc), applyBody, notify)

      expect(result.status).toBe(502)
      expect(result.body.error.code).toBe('invalid_canonical_response')
      expect(notify).not.toHaveBeenCalled()
    })

    it('does not notify again for a verified durable replay', async () => {
      const response = committed({ status: 'replayed', replayed: true })
      const { executeWorkBlockBatch, rpc, notify } = harness(response)

      const result = await executeWorkBlockBatch(context(rpc), applyBody, notify)

      expect(result.status).toBe(200)
      expect(notify).not.toHaveBeenCalled()
    })

    it.each([
      ['missing replay flag', { replayed: undefined }],
      ['replayed status without replay flag', { status: 'replayed', replayed: undefined }],
    ])('rejects %s instead of accepting divergent receipt proof', async (_label, overrides) => {
      const response = committed(overrides)
      const { executeWorkBlockBatch, rpc, notify } = harness(response)

      const result = await executeWorkBlockBatch(context(rpc), applyBody, notify)

      expect(result.status).toBe(502)
      expect(result.body.error.code).toBe('invalid_canonical_response')
      expect(notify).not.toHaveBeenCalled()
    })

    it('rejects malformed operations before calling the canonical boundary', async () => {
      const invalidOperations = [
        [{ ...operations[0], baseRevision: 0 }],
        [{ ...operations[0], scheduledTime: '25:00' }],
        [{ ...operations[1], duration: 0 }],
        [{ kind: 'remove', taskId, baseRevision: 7 }],
      ]

      for (const candidate of invalidOperations) {
        const { executeWorkBlockBatch, rpc, notify } = harness(null)
        const result = await executeWorkBlockBatch(
          context(rpc), { operationId, timeZone: 'Asia/Jerusalem', operations: candidate }, notify,
        )
        expect(result.status).toBe(400)
        expect(rpc).not.toHaveBeenCalled()
      }
    })

    it('rejects contradictory parent revisions within one atomic batch', async () => {
      const contradictory = [
        operations[0],
        {
          kind: 'create', taskId, baseRevision: 8, clientId: 'second-block',
          scheduledDate: '2026-07-16', scheduledTime: '10:30', duration: 20,
        },
      ]
      const { executeWorkBlockBatch, rpc, notify } = harness(null)

      const result = await executeWorkBlockBatch(
        context(rpc), {
          operationId, timeZone: 'Asia/Jerusalem', operations: contradictory,
        },
        notify,
      )

      expect(result.status).toBe(400)
      expect(result.body.error.code).toBe('invalid_request')
      expect(rpc).not.toHaveBeenCalled()
    })

    it('rejects duplicate commands for the same work block identity', async () => {
      const duplicateTarget = [
        operations[1],
        { ...operations[1], kind: 'remove' as const, duration: undefined },
      ].map(operation => Object.fromEntries(
        Object.entries(operation).filter(([, value]) => value !== undefined),
      ))
      const { executeWorkBlockBatch, rpc, notify } = harness(null)

      const result = await executeWorkBlockBatch(
        context(rpc), {
          operationId, timeZone: 'Asia/Jerusalem', operations: duplicateTarget,
        },
        notify,
      )

      expect(result.status).toBe(400)
      expect(rpc).not.toHaveBeenCalled()
    })

    it('requires an IANA zone and an offset-aware finish-by boundary', async () => {
      for (const body of [
        { operationId, timeZone: 'Mars/Olympus', operations },
        {
          operationId, timeZone: 'Asia/Jerusalem',
          finishBy: '2026-07-16T20:00:00', operations,
        },
      ]) {
        const { executeWorkBlockBatch, rpc, notify } = harness(null)
        const result = await executeWorkBlockBatch(context(rpc), body, notify)
        expect(result.status).toBe(400)
        expect(result.body.error.code).toBe('invalid_request')
        expect(rpc).not.toHaveBeenCalled()
      }
    })
  })
})
