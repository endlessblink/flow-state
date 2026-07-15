import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/timer-command.cjs')
const { canonicalHash } = require(resolve(process.cwd(), 'server/local-api/canonical-receipt.cjs')) as {
  canonicalHash: (value: unknown) => string
}

const sessionId = '11111111-1111-4111-8111-111111111111'
const taskId = '22222222-2222-4222-8222-222222222222'
const operationId = 'hermes:timer:start:stable'
const requestHash = 'c'.repeat(64)
const previewDigest = 'a'.repeat(64)
const previewExpiresAt = '2026-07-16T10:15:00.000Z'

const startBody = {
  operationId,
  action: 'start',
  sessionId,
  baseRevision: 0,
  deviceId: 'hermes-office',
  taskId,
  startedAt: '2026-07-16T10:00:00.000+03:00',
  durationSeconds: 1500,
  isBreak: false,
}

function readBack(overrides: Record<string, unknown> = {}) {
  return {
    id: sessionId, workspaceId: null, taskId,
    startTime: '2026-07-16T07:00:00.000Z', duration: 1500, remainingTime: 1500,
    isActive: true, isPaused: false, isBreak: false, completedAt: null,
    deviceLeaderId: 'hermes-office', canonicalRevision: 1,
    canonicalUpdatedAt: '2026-07-16T07:00:00.010Z', ...overrides,
  }
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    ok: true, result: 'preview', contractVersion: 'timer-v1', action: 'start',
    operationId, requestHash, previewDigest, previewExpiresAt,
    normalizedPayload: {
      action: 'start', sessionId, baseRevision: 0, deviceId: 'hermes-office',
      workspaceId: null, taskId, startedAt: '2026-07-16T07:00:00.000Z',
      durationSeconds: 1500, isBreak: false,
    },
    readBack: readBack(), replacedSessions: [], ...overrides,
  }
}

function committed(overrides: Record<string, unknown> = {}) {
  const target = readBack()
  const affected = [{
    entityId: sessionId, entityType: 'timer_session', action: 'inserted',
    canonicalRevision: 1, changeSequence: 81, readBack: target, readBackHash: canonicalHash(target),
  }]
  return {
    ok: true, result: 'committed', action: 'start', operationId, requestHash,
    receipt: {
      ok: true, status: 'committed', contractVersion: 'timer-v1', operationId,
      requestHash, source: 'local-api', entityType: 'timer_session', entityId: sessionId,
      action: 'start', canonicalRevision: 1, canonicalUpdatedAt: target.canonicalUpdatedAt,
      changeSequence: 81, replayed: false, committedAt: '2026-07-16T07:00:00.020Z',
      affected, readBack: target, readBackHash: canonicalHash(target),
      operationContext: { replacedSessionIds: [] }, ...overrides,
    },
  }
}

function context(rpc: ReturnType<typeof vi.fn>) {
  return { supabase: { rpc }, signedUser: true, userId: 'user-1', activeWorkspaceId: null }
}

describe('TASK-1965 Local API canonical timer command', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns a fresh session inventory with canonical revision', async () => {
    const query: Record<string, any> = {}
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.is = vi.fn(() => query)
    query.order = vi.fn(() => query)
    query.limit = vi.fn(() => query)
    query.maybeSingle = vi.fn(async () => ({ data: {
      id: sessionId, workspace_id: null, task_id: taskId,
      start_time: '2026-07-16T07:00:00.000Z', duration: 1500, remaining_time: 900,
      is_active: true, is_paused: false, is_break: false, completed_at: null,
      device_leader_id: 'desktop-1', canonical_revision: 4,
      updated_at: '2026-07-16T07:10:00.000Z',
    }, error: null }))
    const { readTimerSession } = require(modulePath) as { readTimerSession: Function }
    const result = await readTimerSession({
      supabase: { from: vi.fn(() => query) }, signedUser: true,
      userId: 'user-1', activeWorkspaceId: null,
    })
    expect(result).toEqual({ status: 200, body: {
      ok: true, fresh: true, session: readBack({
        remainingTime: 900, deviceLeaderId: 'desktop-1', canonicalRevision: 4,
        canonicalUpdatedAt: '2026-07-16T07:10:00.000Z',
      }),
    } })
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(query.eq).toHaveBeenCalledWith('is_active', true)
    expect(query.is).toHaveBeenCalledWith('workspace_id', null)
  })

  it('previews an explicit start and forwards exact approval fields', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: preview(), error: null })
    const notify = vi.fn()
    const { executeTimerCommand } = require(modulePath) as { executeTimerCommand: Function }
    const result = await executeTimerCommand(context(rpc), startBody, notify)
    expect(result).toEqual({ status: 200, body: preview() })
    expect(rpc).toHaveBeenCalledWith('flowstate_timer_command_v1', {
      p_action: 'start', p_base_revision: 0, p_contract_version: 'timer-v1',
      p_device_id: 'hermes-office', p_duration_seconds: 1500, p_is_break: false,
      p_remaining_seconds: null, p_extension_seconds: null,
      p_operation_id: operationId, p_preview: true, p_preview_digest: null,
      p_preview_expires_at: null, p_request_hash: null, p_session_id: sessionId,
      p_source: 'local-api', p_started_at: startBody.startedAt, p_task_id: taskId,
      p_workspace_id: null,
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('exposes task switching and extension fields through the same explicit command route', async () => {
    const switchOperation = 'hermes:timer:switch:stable'
    const response = preview({
      action: 'switch_task', operationId: switchOperation,
      normalizedPayload: {
        action: 'switch_task', sessionId, baseRevision: 2, deviceId: 'hermes-office',
        workspaceId: null, taskId: 'general', startedAt: null, durationSeconds: null,
        isBreak: null, remainingSeconds: 900, extensionSeconds: null,
      },
      readBack: readBack({ taskId: 'general', remainingTime: 900, canonicalRevision: 3 }),
    })
    const rpc = vi.fn().mockResolvedValue({ data: response, error: null })
    const { executeTimerCommand } = require(modulePath) as { executeTimerCommand: Function }
    const result = await executeTimerCommand(context(rpc), {
      operationId: switchOperation, action: 'switch_task', sessionId, baseRevision: 2,
      deviceId: 'hermes-office', taskId: 'general', remainingSeconds: 900,
    }, vi.fn())

    expect(result.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith('flowstate_timer_command_v1', expect.objectContaining({
      p_action: 'switch_task', p_task_id: 'general', p_remaining_seconds: 900,
      p_extension_seconds: null,
    }))
  })

  it('applies only with approval and notifies after strict canonical proof', async () => {
    const response = committed()
    const rpc = vi.fn().mockResolvedValue({ data: response, error: null })
    const notify = vi.fn()
    const { executeTimerCommand } = require(modulePath) as { executeTimerCommand: Function }
    const result = await executeTimerCommand(context(rpc), {
      ...startBody, preview: false, previewDigest, previewExpiresAt, requestHash,
    }, notify)
    expect(result).toEqual({ status: 200, body: response })
    expect(notify).toHaveBeenCalledWith('create', sessionId)
  })

  it('rejects malformed receipt evidence and never notifies', async () => {
    const response = committed({ changeSequence: 0 })
    const rpc = vi.fn().mockResolvedValue({ data: response, error: null })
    const notify = vi.fn()
    const { executeTimerCommand } = require(modulePath) as { executeTimerCommand: Function }
    const result = await executeTimerCommand(context(rpc), {
      ...startBody, preview: false, previewDigest, previewExpiresAt, requestHash,
    }, notify)
    expect(result.status).toBe(502)
    expect(result.body.error.code).toBe('invalid_canonical_response')
    expect(notify).not.toHaveBeenCalled()
  })

  it('does not notify twice for a verified durable replay', async () => {
    const response = committed({ status: 'replayed', replayed: true })
    const rpc = vi.fn().mockResolvedValue({ data: response, error: null })
    const notify = vi.fn()
    const { executeTimerCommand } = require(modulePath) as { executeTimerCommand: Function }
    const result = await executeTimerCommand(context(rpc), {
      ...startBody, preview: false, previewDigest, previewExpiresAt, requestHash,
    }, notify)
    expect(result.status).toBe(200)
    expect(notify).not.toHaveBeenCalled()
  })

  it('accepts a verified durable replay when a lost preview response is retried', async () => {
    const response = committed({ status: 'replayed', replayed: true })
    const rpc = vi.fn().mockResolvedValue({ data: response, error: null })
    const notify = vi.fn()
    const { executeTimerCommand } = require(modulePath) as { executeTimerCommand: Function }
    const result = await executeTimerCommand(context(rpc), startBody, notify)
    expect(result).toEqual({ status: 200, body: response })
    expect(notify).not.toHaveBeenCalled()
  })

  it.each(['toggle', 'start without id', 'pause with creation fields'])(
    'rejects ambiguous or malformed input: %s', async label => {
      const body = label === 'toggle' ? { ...startBody, action: 'toggle' }
        : label === 'start without id' ? { ...startBody, sessionId: '' }
          : { ...startBody, action: 'pause', baseRevision: 1 }
      const rpc = vi.fn()
      const { executeTimerCommand } = require(modulePath) as { executeTimerCommand: Function }
      const result = await executeTimerCommand(context(rpc), body, vi.fn())
      expect(result.status).toBe(400)
      expect(rpc).not.toHaveBeenCalled()
    },
  )

  it('preserves typed leader conflicts and requires signed auth', async () => {
    const { executeTimerCommand } = require(modulePath) as { executeTimerCommand: Function }
    const rpc = vi.fn().mockResolvedValue({ data: { ok: false, result: 'conflict',
      error: { code: 'leader_conflict', message: 'held' } }, error: null })
    const conflict = await executeTimerCommand(context(rpc), startBody, vi.fn())
    expect(conflict.status).toBe(409)
    const signedOut = await executeTimerCommand({ ...context(rpc), signedUser: false }, startBody, vi.fn())
    expect(signedOut.status).toBe(401)
  })
})
