import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { canonicalHash } = require('../../../server/local-api/canonical-receipt.cjs') as {
  canonicalHash: (value: unknown) => string
}

const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const operationId = 'work-block-operation-1'
const taskId = '11111111-1111-4111-8111-111111111111'
const workBlockId = '22222222-2222-4222-8222-222222222222'
const command = {
  action: 'create',
  workBlock: {
    id: workBlockId,
    scheduledDate: '2026-07-16',
    scheduledTime: '10:00',
    duration: 60,
    timezone: 'Asia/Jerusalem',
  },
  finishBy: '2026-07-16T12:00',
}
const workBlock = {
  ...command.workBlock,
  taskId,
  canonicalRevision: 1,
}

function normalizedRequest(overrides: Record<string, unknown> = {}) {
  return {
    contractVersion: 'work-block-v1',
    source: 'local-api',
    action: 'create',
    taskId,
    baseRevision: 7,
    workBlockRevision: 0,
    workspaceId,
    command,
    ...overrides,
  }
}

function preview(overrides: Record<string, unknown> = {}) {
  const normalizedPayload = normalizedRequest()
  return {
    ok: true,
    status: 'preview',
    result: 'preview',
    requestHash: canonicalHash(normalizedPayload),
    previewDigest: 'a'.repeat(64),
    previewExpiresAt: '2026-07-15T16:10:00.000Z',
    normalizedPayload,
    preview: {
      action: 'create',
      workBlockId,
      interval: { before: null, after: { localStart: '2026-07-16T10:00', localEnd: '2026-07-16T11:00' } },
      timezone: 'Asia/Jerusalem',
      duration: { beforeMinutes: null, afterMinutes: 60 },
      overlapWarnings: [{
        taskId: '33333333-3333-4333-8333-333333333333',
        workBlockId: '44444444-4444-4444-8444-444444444444',
        localStart: '2026-07-16T10:30',
        timezone: 'Asia/Jerusalem',
      }],
      taskEffect: { taskId, dueDate: { before: '2026-07-20', after: '2026-07-20' } },
      finishByBoundary: { finishBy: '2026-07-16T12:00', satisfied: true },
    },
    readBack: { id: taskId, instances: [workBlock], canonicalRevision: 7 },
    ...overrides,
  }
}

function committedResponse(overrides: Record<string, unknown> = {}) {
  const requestHash = canonicalHash(normalizedRequest())
  const readBack = {
    id: taskId,
    workBlock,
    removedWorkBlockId: null,
    instances: [workBlock],
    workspaceId,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T16:01:00.000Z',
  }
  const receipt = {
    ok: true,
    contractVersion: 'work-block-v1',
    operationId,
    source: 'local-api',
    entityType: 'task',
    action: 'work_block_create',
    entityId: taskId,
    workBlockId,
    requestHash,
    canonicalRevision: 8,
    canonicalUpdatedAt: '2026-07-15T16:01:00.000Z',
    changeSequence: 61,
    status: 'committed',
    replayed: false,
    committedAt: '2026-07-15T16:01:00.010Z',
    readBack,
    readBackHash: canonicalHash(readBack),
  }
  return { ok: true, status: 'committed', result: 'committed', requestHash, receipt, ...overrides }
}

function harness(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result)
  const notify = vi.fn()
  const { executeCanonicalWorkBlock } = require('../../../server/local-api/canonical-work-block.cjs') as {
    executeCanonicalWorkBlock: (
      context: { supabase: { rpc: typeof rpc }; activeWorkspaceId: string | null; signedUser: boolean },
      taskId: string,
      body: Record<string, unknown>,
      notifyTaskMutation: typeof notify,
    ) => Promise<{ status: number; body: unknown }>
  }
  return { executeCanonicalWorkBlock, notify, rpc }
}

const context = (rpc: ReturnType<typeof vi.fn>, signedUser = true) => ({
  supabase: { rpc }, activeWorkspaceId: workspaceId, signedUser,
})

describe('canonical Local API work-block handler', () => {
  it('ships the canonical work-block implementation before advertising it', () => {
    expect(existsSync(resolve(process.cwd(), 'server/local-api/canonical-work-block.cjs'))).toBe(true)
  })

  it('defaults to preview and forwards an exact stable create command', async () => {
    const data = preview()
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
      operationId, baseRevision: 7, workBlockRevision: 0, command,
    }, notify)).resolves.toEqual({ status: 200, body: data })

    expect(rpc).toHaveBeenCalledWith('flowstate_work_block_v1', {
      p_base_revision: 7,
      p_command: command,
      p_contract_version: 'work-block-v1',
      p_operation_id: operationId,
      p_preview: true,
      p_preview_digest: null,
      p_preview_expires_at: null,
      p_source: 'local-api',
      p_task_id: taskId,
      p_work_block_revision: 0,
      p_workspace_id: workspaceId,
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it.each([
    ['move', 3, { action: 'move', workBlockId, scheduledDate: '2026-07-17', scheduledTime: '09:15', timezone: 'UTC', finishBy: '2026-07-17T11:00' }],
    ['resize', 3, { action: 'resize', workBlockId, duration: 90, timezone: 'Asia/Jerusalem', finishBy: '2026-07-17T11:00' }],
    ['remove', 3, { action: 'remove', workBlockId, timezone: 'Asia/Jerusalem' }],
  ])('normalizes the %s lifecycle command without generating identity', async (action, revision, requestedCommand) => {
    const normalizedPayload = normalizedRequest({ action, workBlockRevision: revision, command: requestedCommand })
    const data = preview({
      requestHash: canonicalHash(normalizedPayload),
      normalizedPayload,
      preview: { ...preview().preview, action, workBlockId },
    })
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data, error: null })
    await executeCanonicalWorkBlock(context(rpc), taskId, {
      operationId, baseRevision: 7, workBlockRevision: revision, command: requestedCommand,
    }, notify)
    expect(rpc).toHaveBeenCalledWith('flowstate_work_block_v1', expect.objectContaining({
      p_command: requestedCommand,
      p_work_block_revision: revision,
    }))
  })

  it('upgrades a shipped legacy work-block identity on its first move', async () => {
    const legacyId = `instance-${taskId}-1720000000000`
    const requestedCommand = {
      action: 'move', workBlockId: legacyId,
      scheduledDate: '2026-07-17', scheduledTime: '09:15', timezone: 'Asia/Jerusalem',
    }
    const normalizedPayload = normalizedRequest({
      action: 'move', workBlockRevision: 0, command: requestedCommand,
    })
    const upgraded = {
      id: legacyId, taskId, scheduledDate: '2026-07-17', scheduledTime: '09:15',
      duration: 60, timezone: 'Asia/Jerusalem', canonicalRevision: 1,
    }
    const data = preview({
      requestHash: canonicalHash(normalizedPayload),
      normalizedPayload,
      preview: {
        ...preview().preview,
        action: 'move',
        workBlockId: legacyId,
        interval: {
          before: { localStart: '2026-07-16T10:00', localEnd: '2026-07-16T11:00' },
          after: { localStart: '2026-07-17T09:15', localEnd: '2026-07-17T10:15' },
        },
        duration: { beforeMinutes: 60, afterMinutes: 60 },
        finishByBoundary: null,
      },
      readBack: { id: taskId, instances: [upgraded], canonicalRevision: 7 },
    })
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data, error: null })

    await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
      operationId, baseRevision: 7, workBlockRevision: 0, command: requestedCommand,
    }, notify)).resolves.toEqual({ status: 200, body: data })
  })

  it('requires the exact preview approval before apply', async () => {
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data: null, error: null })
    const complete = {
      operationId, baseRevision: 7, workBlockRevision: 0, command,
      preview: false, previewDigest: 'a'.repeat(64), previewExpiresAt: '2026-07-15T16:10:00.000Z',
      requestHash: canonicalHash(normalizedRequest()),
    }
    for (const field of ['previewDigest', 'previewExpiresAt', 'requestHash']) {
      const body = { ...complete }
      delete body[field as keyof typeof body]
      await expect(executeCanonicalWorkBlock(context(rpc), taskId, body, notify)).resolves.toMatchObject({
        status: 400, body: { error: { code: 'approval_receipt_required' } },
      })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects malformed action-specific commands before the RPC', async () => {
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data: null, error: null })
    const invalid = [
      { revision: 1, command },
      { revision: 0, command: { ...command, workBlock: { ...command.workBlock, id: 'random' } } },
      { revision: 0, command: { ...command, workBlock: { ...command.workBlock, scheduledDate: '2026-02-30' } } },
      { revision: 0, command: { ...command, workBlock: { ...command.workBlock, scheduledTime: '24:00' } } },
      { revision: 0, command: { ...command, workBlock: { ...command.workBlock, duration: 0 } } },
      { revision: 0, command: { ...command, workBlock: { ...command.workBlock, timezone: 'Mars/Olympus' } } },
      { revision: 1, command: { action: 'move', workBlockId, scheduledDate: '2026-07-17', scheduledTime: '09:15', timezone: 'UTC', duration: 30 } },
      { revision: 1, command: { action: 'resize', workBlockId, duration: 90, timezone: 'UTC', scheduledTime: '09:00' } },
      { revision: 1, command: { action: 'remove', workBlockId, finishBy: '2026-07-17T11:00' } },
    ]
    for (const candidate of invalid) {
      await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
        operationId, baseRevision: 7, workBlockRevision: candidate.revision, command: candidate.command,
      }, notify)).resolves.toMatchObject({ status: 400, body: { ok: false } })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('verifies interval, finish-by, overlap, and task effects in preview', async () => {
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data: preview(), error: null })
    await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
      operationId, baseRevision: 7, workBlockRevision: 0, command,
    }, notify)).resolves.toMatchObject({ status: 200 })

    for (const mutate of [
      (data: ReturnType<typeof preview>) => ({ ...data, preview: { ...data.preview, timezone: 'UTC' } }),
      (data: ReturnType<typeof preview>) => ({
        ...data,
        preview: {
          ...data.preview,
          interval: { ...data.preview.interval, after: { ...data.preview.interval.after, localEnd: '2026-07-16T10:59' } },
        },
      }),
      (data: ReturnType<typeof preview>) => ({ ...data, preview: { ...data.preview, finishByBoundary: { finishBy: command.finishBy, satisfied: false } } }),
      (data: ReturnType<typeof preview>) => ({ ...data, preview: { ...data.preview, overlapWarnings: [{ taskId: '', workBlockId, localStart: 'bad', timezone: 'UTC' }] } }),
      (data: ReturnType<typeof preview>) => ({ ...data, preview: { ...data.preview, taskEffect: { ...data.preview.taskEffect, taskId: 'wrong' } } }),
    ]) {
      const next = harness({ data: mutate(preview()), error: null })
      await expect(next.executeCanonicalWorkBlock(context(next.rpc), taskId, {
        operationId, baseRevision: 7, workBlockRevision: 0, command,
      }, next.notify)).resolves.toMatchObject({ status: 502, body: { error: { code: 'invalid_canonical_response' } } })
    }
  })

  it('accepts an exact committed receipt and only then reconciles the renderer', async () => {
    const data = committedResponse()
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data, error: null })
    await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
      operationId, baseRevision: 7, workBlockRevision: 0, command,
      preview: false, previewDigest: 'a'.repeat(64), previewExpiresAt: '2026-07-15T16:10:00.000Z',
      requestHash: canonicalHash(normalizedRequest()),
    }, notify)).resolves.toEqual({ status: 200, body: data })
    expect(notify).toHaveBeenCalledWith('update', taskId)
  })

  it('accepts an exact replayed receipt without reconciling the renderer twice', async () => {
    const committed = committedResponse()
    const data = {
      ...committed,
      status: 'replayed',
      result: 'committed',
      receipt: { ...committed.receipt, status: 'replayed', replayed: true },
    }
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data, error: null })
    await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
      operationId, baseRevision: 7, workBlockRevision: 0, command,
      preview: false, previewDigest: 'a'.repeat(64), previewExpiresAt: '2026-07-15T16:10:00.000Z',
      requestHash: canonicalHash(normalizedRequest()),
    }, notify)).resolves.toEqual({ status: 200, body: data })
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects a receipt revision or timestamp detached from its read-back', async () => {
    for (const receipt of [
      { ...committedResponse().receipt, canonicalRevision: 999 },
      { ...committedResponse().receipt, canonicalUpdatedAt: '2026-07-15T16:02:00.000Z' },
    ]) {
      const data = { ...committedResponse(), receipt }
      const { executeCanonicalWorkBlock, notify, rpc } = harness({ data, error: null })
      await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
        operationId, baseRevision: 7, workBlockRevision: 0, command,
        preview: false, previewDigest: 'a'.repeat(64), previewExpiresAt: '2026-07-15T16:10:00.000Z',
        requestHash: canonicalHash(normalizedRequest()),
      }, notify)).resolves.toMatchObject({ status: 502 })
      expect(notify).not.toHaveBeenCalled()
    }
  })

  it('preserves legacy sibling blocks while verifying the canonical target exactly', async () => {
    const base = committedResponse()
    const legacy = {
      id: 'legacy-block-1',
      scheduledDate: '2026-07-15',
      scheduledTime: '08:00',
      duration: 25,
    }
    const readBack = { ...base.receipt.readBack, instances: [legacy, workBlock] }
    const data = {
      ...base,
      receipt: { ...base.receipt, readBack, readBackHash: canonicalHash(readBack) },
    }
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data, error: null })
    await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
      operationId, baseRevision: 7, workBlockRevision: 0, command,
      preview: false, previewDigest: 'a'.repeat(64), previewExpiresAt: '2026-07-15T16:10:00.000Z',
      requestHash: canonicalHash(normalizedRequest()),
    }, notify)).resolves.toMatchObject({ status: 200 })
    expect(notify).toHaveBeenCalledWith('update', taskId)
  })

  it.each([
    ['request hash', (data: ReturnType<typeof committedResponse>) => ({ ...data, requestHash: 'b'.repeat(64) })],
    ['receipt action', (data: ReturnType<typeof committedResponse>) => ({ ...data, receipt: { ...data.receipt, action: 'work_block_move' } })],
    ['work-block id', (data: ReturnType<typeof committedResponse>) => ({ ...data, receipt: { ...data.receipt, workBlockId: 'wrong' } })],
    ['read-back hash', (data: ReturnType<typeof committedResponse>) => ({ ...data, receipt: { ...data.receipt, readBackHash: 'b'.repeat(64) } })],
    ['task revision', (data: ReturnType<typeof committedResponse>) => {
      const readBack = { ...data.receipt.readBack, canonicalRevision: 9 }
      return { ...data, receipt: { ...data.receipt, canonicalRevision: 9, readBack, readBackHash: canonicalHash(readBack) } }
    }],
    ['created interval', (data: ReturnType<typeof committedResponse>) => {
      const changed = { ...data.receipt.readBack.workBlock, scheduledTime: '11:00' }
      const readBack = { ...data.receipt.readBack, workBlock: changed, instances: [changed] }
      return { ...data, receipt: { ...data.receipt, readBack, readBackHash: canonicalHash(readBack) } }
    }],
  ])('rejects a mismatched %s without renderer notification', async (_label, mutate) => {
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data: mutate(committedResponse()), error: null })
    await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
      operationId, baseRevision: 7, workBlockRevision: 0, command,
      preview: false, previewDigest: 'a'.repeat(64), previewExpiresAt: '2026-07-15T16:10:00.000Z',
      requestHash: canonicalHash(normalizedRequest()),
    }, notify)).resolves.toMatchObject({ status: 502, body: { error: { code: 'invalid_canonical_receipt' } } })
    expect(notify).not.toHaveBeenCalled()
  })

  it('fails closed for unsigned sessions and mismatched workspaces', async () => {
    const { executeCanonicalWorkBlock, notify, rpc } = harness({ data: preview(), error: null })
    await expect(executeCanonicalWorkBlock(context(rpc, false), taskId, {
      operationId, baseRevision: 7, workBlockRevision: 0, command,
    }, notify)).resolves.toMatchObject({ status: 401 })
    await expect(executeCanonicalWorkBlock(context(rpc), taskId, {
      operationId, baseRevision: 7, workBlockRevision: 0, command,
      workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }, notify)).resolves.toMatchObject({ status: 409, body: { error: { code: 'workspace_mismatch' } } })
    expect(rpc).not.toHaveBeenCalled()
  })
})
