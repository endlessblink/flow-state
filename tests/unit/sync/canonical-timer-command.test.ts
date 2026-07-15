import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  executeCanonicalTimerCommand,
  executeQueuedCanonicalTimerCommand,
  type CanonicalTimerCommandRequest,
} from '@/services/sync/canonicalTimerCommand'
import type { WriteOperation } from '@/types/sync'

const SESSION_ID = '11111111-1111-4111-8111-111111111111'
const TASK_ID = '22222222-2222-4222-8222-222222222222'
const WORKSPACE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OPERATION_ID = 'web:timer:start:stable-1'
const REQUEST_HASH = 'c'.repeat(64)
const PREVIEW_DIGEST = 'a'.repeat(64)
const EXPIRES_AT = '2026-07-16T10:15:00.000Z'

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

function request(overrides: Partial<CanonicalTimerCommandRequest> = {}): CanonicalTimerCommandRequest {
  return {
    operationId: OPERATION_ID,
    action: 'start',
    sessionId: SESSION_ID,
    baseRevision: 0,
    deviceId: 'desktop-device-1',
    workspaceId: WORKSPACE_ID,
    taskId: TASK_ID,
    startedAt: '2026-07-16T10:00:00.000+03:00',
    durationSeconds: 1500,
    isBreak: false,
    ...overrides,
  }
}

function readBack(overrides: Record<string, unknown> = {}) {
  return {
    id: SESSION_ID,
    workspaceId: WORKSPACE_ID,
    taskId: TASK_ID,
    startTime: '2026-07-16T07:00:00.000Z',
    duration: 1500,
    remainingTime: 1500,
    isActive: true,
    isPaused: false,
    isBreak: false,
    completedAt: null,
    deviceLeaderId: 'desktop-device-1',
    canonicalRevision: 1,
    canonicalUpdatedAt: '2026-07-16T07:00:00.010Z',
    ...overrides,
  }
}

function normalizedPayload(overrides: Record<string, unknown> = {}) {
  return {
    action: 'start',
    sessionId: SESSION_ID,
    baseRevision: 0,
    deviceId: 'desktop-device-1',
    workspaceId: WORKSPACE_ID,
    taskId: TASK_ID,
    startedAt: '2026-07-16T07:00:00.000Z',
    durationSeconds: 1500,
    isBreak: false,
    remainingSeconds: null,
    extensionSeconds: null,
    ...overrides,
  }
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'timer-v1',
    action: 'start',
    operationId: OPERATION_ID,
    requestHash: REQUEST_HASH,
    previewDigest: PREVIEW_DIGEST,
    previewExpiresAt: EXPIRES_AT,
    normalizedPayload: normalizedPayload(),
    readBack: readBack(),
    replacedSessions: [],
    ...overrides,
  }
}

function receipt(overrides: Record<string, unknown> = {}) {
  const target = readBack()
  const affected = [{
    entityId: SESSION_ID,
    entityType: 'timer_session',
    action: 'inserted',
    canonicalRevision: 1,
    changeSequence: 81,
    readBack: target,
    readBackHash: hash(target),
  }]
  return {
    ok: true,
    status: 'committed',
    contractVersion: 'timer-v1',
    operationId: OPERATION_ID,
    requestHash: REQUEST_HASH,
    source: 'web-pwa',
    entityType: 'timer_session',
    entityId: SESSION_ID,
    action: 'start',
    canonicalRevision: 1,
    canonicalUpdatedAt: target.canonicalUpdatedAt,
    changeSequence: 81,
    replayed: false,
    committedAt: '2026-07-16T07:00:00.020Z',
    affected,
    readBack: target,
    readBackHash: hash(target),
    operationContext: { replacedSessionIds: [] },
    ...overrides,
  }
}

function applied(committed = receipt()) {
  return {
    ok: true,
    result: 'committed',
    action: committed.action,
    operationId: committed.operationId,
    requestHash: committed.requestHash,
    receipt: committed,
  }
}

describe('canonical timer command authority', () => {
  it('previews and applies an explicit stable start without an ambiguous toggle', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockResolvedValueOnce({ data: applied(), error: null })

    const result = await executeCanonicalTimerCommand({ rpc }, request())

    expect(result).toEqual({ receipt: receipt(), readBack: readBack(), replacedSessions: [] })
    expect(rpc).toHaveBeenNthCalledWith(1, 'flowstate_timer_command_v1', {
      p_action: 'start',
      p_base_revision: 0,
      p_contract_version: 'timer-v1',
      p_device_id: 'desktop-device-1',
      p_duration_seconds: 1500,
      p_remaining_seconds: null,
      p_extension_seconds: null,
      p_is_break: false,
      p_operation_id: OPERATION_ID,
      p_preview: true,
      p_preview_digest: null,
      p_preview_expires_at: null,
      p_request_hash: null,
      p_session_id: SESSION_ID,
      p_source: 'web-pwa',
      p_started_at: '2026-07-16T10:00:00.000+03:00',
      p_task_id: TASK_ID,
      p_workspace_id: WORKSPACE_ID,
    })
    expect(rpc.mock.calls[1][1]).toMatchObject({
      p_preview: false,
      p_preview_digest: PREVIEW_DIGEST,
      p_preview_expires_at: EXPIRES_AT,
      p_request_hash: REQUEST_HASH,
    })
  })

  it.each([
    ['pause', true, 7, 8],
    ['resume', false, 8, 9],
    ['stop', false, 9, 10],
  ] as const)('validates the explicit %s transition against canonical read-back', async (
    action, afterPaused, baseRevision, canonicalRevision,
  ) => {
    const command = request({
      operationId: `web:timer:${action}:stable`, action, baseRevision,
      taskId: undefined, startedAt: undefined, durationSeconds: undefined, isBreak: undefined,
      remainingSeconds: 900,
    })
    const projected = readBack({
      canonicalRevision,
      isPaused: afterPaused,
      isActive: action !== 'stop',
      completedAt: action === 'stop' ? '2026-07-16T07:20:00.000Z' : null,
      remainingTime: 900,
    })
    const normalized = normalizedPayload({
      action, baseRevision, taskId: null, startedAt: null, durationSeconds: null, isBreak: null,
      remainingSeconds: 900, extensionSeconds: null,
    })
    const committed = receipt({
      action,
      operationId: command.operationId,
      canonicalRevision,
      readBack: projected,
      readBackHash: hash(projected),
      affected: [{
        entityId: SESSION_ID, entityType: 'timer_session', action: 'updated',
        canonicalRevision, changeSequence: 81, readBack: projected, readBackHash: hash(projected),
      }],
    })
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview({
        action, operationId: command.operationId, normalizedPayload: normalized,
        readBack: projected,
      }), error: null })
      .mockResolvedValueOnce({ data: applied(committed), error: null })

    await expect(executeCanonicalTimerCommand({ rpc }, command)).resolves.toMatchObject({
      readBack: projected,
    })
  })

  it.each([
    ['switch_task', { taskId: 'general', remainingSeconds: 900 }, { taskId: 'general', remainingTime: 900 }],
    ['extend', { extensionSeconds: 300 }, { duration: 1800, remainingTime: 300 }],
  ] as const)('validates the explicit %s canonical action', async (action, fields, readBackFields) => {
    const operationId = `web:timer:${action}:stable`
    const command = request({
      operationId, action, baseRevision: 2,
      taskId: undefined, startedAt: undefined, durationSeconds: undefined, isBreak: undefined,
      ...fields,
    })
    const projected = readBack({ ...readBackFields, canonicalRevision: 3 })
    const normalized = normalizedPayload({
      action, baseRevision: 2, taskId: action === 'switch_task' ? 'general' : null,
      startedAt: null, durationSeconds: null, isBreak: null,
      remainingSeconds: action === 'switch_task' ? 900 : null,
      extensionSeconds: action === 'extend' ? 300 : null,
    })
    const committed = receipt({
      action, operationId, canonicalRevision: 3, readBack: projected,
      readBackHash: hash(projected), affected: [{
        entityId: SESSION_ID, entityType: 'timer_session', action: 'updated',
        canonicalRevision: 3, changeSequence: 81, readBack: projected, readBackHash: hash(projected),
      }],
    })
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview({ action, operationId, normalizedPayload: normalized, readBack: projected }), error: null })
      .mockResolvedValueOnce({ data: applied(committed), error: null })

    await expect(executeCanonicalTimerCommand({ rpc }, command)).resolves.toMatchObject({ readBack: projected })
  })

  it('accepts a durable replay returned to the retry preview after apply response loss', async () => {
    const replay = receipt({ status: 'replayed', replayed: true })
    const rpc = vi.fn().mockResolvedValueOnce({ data: applied(replay), error: null })

    await expect(executeCanonicalTimerCommand({ rpc }, request())).resolves.toEqual({
      receipt: replay, readBack: readBack(), replacedSessions: [],
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('accepts an atomic replacement from another owned timer scope', async () => {
    const replacedId = '33333333-3333-4333-8333-333333333333'
    const replaced = readBack({
      id: replacedId,
      workspaceId: null,
      taskId: 'general',
      isActive: false,
      completedAt: '2026-07-16T06:59:59.000Z',
      canonicalRevision: 4,
    })
    const target = readBack()
    const committed = receipt({
      affected: [
        {
          entityId: SESSION_ID, entityType: 'timer_session', action: 'inserted',
          canonicalRevision: 1, changeSequence: 81, readBack: target, readBackHash: hash(target),
        },
        {
          entityId: replacedId, entityType: 'timer_session', action: 'updated',
          canonicalRevision: 4, changeSequence: 80, readBack: replaced, readBackHash: hash(replaced),
        },
      ],
      operationContext: { replacedSessionIds: [replacedId] },
    })
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview({ replacedSessions: [replaced] }), error: null })
      .mockResolvedValueOnce({ data: applied(committed), error: null })

    await expect(executeCanonicalTimerCommand({ rpc }, request())).resolves.toEqual({
      receipt: committed,
      readBack: target,
      replacedSessions: [replaced],
    })
  })

  it.each([
    ['pause from paused', request({ action: 'pause', baseRevision: 2, taskId: undefined,
      startedAt: undefined, durationSeconds: undefined, isBreak: undefined, remainingSeconds: 1500 }),
    preview({ action: 'pause', normalizedPayload: normalizedPayload({ action: 'pause', baseRevision: 2,
      taskId: null, startedAt: null, durationSeconds: null, isBreak: null,
      remainingSeconds: 1500, extensionSeconds: null }),
    readBack: readBack({ canonicalRevision: 2, isPaused: true }) })],
    ['start without duration', request({ durationSeconds: undefined }), preview()],
    ['receipt replay mismatch', request(), applied(receipt({ status: 'replayed', replayed: false }))],
    ['receipt without sequence', request(), applied(receipt({ changeSequence: 0 }))],
  ])('fails closed for %s', async (_label, command, response) => {
    const rpc = vi.fn().mockResolvedValue({ data: response, error: null })
    await expect(executeCanonicalTimerCommand({ rpc }, command as CanonicalTimerCommandRequest)).rejects.toBeDefined()
  })

  it('returns typed leader and revision conflicts without attempting apply', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      ok: false, result: 'conflict', error: {
        code: 'leader_conflict', message: 'Another device holds the active lease', currentRevision: 7,
      },
    }, error: null })
    await expect(executeCanonicalTimerCommand({ rpc }, request({
      action: 'pause', baseRevision: 7, taskId: undefined,
      startedAt: undefined, durationSeconds: undefined, isBreak: undefined, remainingSeconds: 900,
    }))).rejects.toMatchObject({ code: 'leader_conflict', currentRevision: 7 })
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('replays a durable queued timer command through canonical authority only', async () => {
    const command = request()
    const operation: WriteOperation = {
      id: 1, entityType: 'timer_session', operation: 'create', entityId: command.sessionId,
      payload: {}, baseVersion: 0, status: 'pending', retryCount: 0, createdAt: Date.now(),
      userId: 'user-1', workspaceId: WORKSPACE_ID, canonicalTimerCommand: command,
    }
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: preview(), error: null })
      .mockResolvedValueOnce({ data: applied(), error: null })

    await expect(executeQueuedCanonicalTimerCommand({ rpc }, operation)).resolves.toMatchObject({
      success: true,
      serverData: readBack(),
    })
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('keeps queued timer transport loss retryable without direct-write fallback', async () => {
    const command = request()
    const operation: WriteOperation = {
      id: 1, entityType: 'timer_session', operation: 'create', entityId: command.sessionId,
      payload: {}, baseVersion: 0, status: 'pending', retryCount: 0, createdAt: Date.now(),
      userId: 'user-1', workspaceId: WORKSPACE_ID, canonicalTimerCommand: command,
    }
    const rpc = vi.fn().mockRejectedValue(new Error('offline'))

    await expect(executeQueuedCanonicalTimerCommand({ rpc }, operation)).resolves.toMatchObject({
      success: false,
      shouldRetry: true,
      classification: 'transient',
    })
  })
})
