import { createRequire } from 'node:module'
import { describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
const { canonicalHash } = require('../../../server/local-api/canonical-receipt.cjs') as {
  canonicalHash: (value: unknown) => string
}

const operationId = 'timer-operation-1'
const sessionId = '11111111-1111-4111-8111-111111111111'
const taskId = '22222222-2222-4222-8222-222222222222'

function normalizedRequest(action = 'start', payload: Record<string, unknown> = {
  taskId,
  duration: 1500,
  isBreak: false,
}) {
  return {
    contractVersion: 'timer-lifecycle-v1',
    source: 'local-api',
    action,
    sessionId,
    baseRevision: action === 'start' ? 0 : 4,
    payload,
  }
}

function preview() {
  const normalizedPayload = normalizedRequest()
  return {
    ok: true,
    result: 'preview',
    contractVersion: 'timer-lifecycle-v1',
    operationId,
    action: 'start',
    sessionId,
    baseRevision: 0,
    requestHash: canonicalHash(normalizedPayload),
    previewDigest: 'a'.repeat(64),
    previewExpiresAt: '2099-01-01T00:00:00.000Z',
    normalizedPayload,
    readBack: null,
    proposed: {
      id: sessionId,
      taskId,
      duration: 1500,
      remainingTime: 1500,
      isActive: true,
      isPaused: false,
      isBreak: false,
      canonicalRevision: 1,
    },
  }
}

function committed() {
  const requestHash = canonicalHash(normalizedRequest())
  const readBack = {
    id: sessionId,
    taskId,
    duration: 1500,
    remainingTime: 1500,
    isActive: true,
    isPaused: false,
    isBreak: false,
    completedAt: null,
    deviceLeaderId: 'flowstate-companion',
    canonicalRevision: 1,
    canonicalUpdatedAt: '2026-07-21T12:00:00.000Z',
  }
  const receipt = {
    contractVersion: 'timer-lifecycle-v1',
    operationId,
    source: 'local-api',
    status: 'committed',
    requestHash,
    entityType: 'timer_session',
    action: 'start',
    entityId: sessionId,
    canonicalRevision: 1,
    canonicalUpdatedAt: readBack.canonicalUpdatedAt,
    changeSequence: 81,
    replayed: false,
    committedAt: '2026-07-21T12:00:00.010Z',
    readBack,
    readBackHash: canonicalHash(readBack),
  }
  return { ok: true, result: 'committed', status: 'committed', requestHash, receipt }
}

function harness(data: unknown) {
  const rpc = vi.fn().mockResolvedValue({ data, error: null })
  const notify = vi.fn()
  const { executeCanonicalTimerLifecycle } = require('../../../server/local-api/canonical-timer-lifecycle.cjs') as {
    executeCanonicalTimerLifecycle: (
      context: { supabase: { rpc: typeof rpc }; signedUser: boolean },
      body: Record<string, unknown>,
      notifyTimerMutation: typeof notify,
    ) => Promise<{ status: number; body: unknown }>
  }
  return { executeCanonicalTimerLifecycle, rpc, notify }
}

describe('canonical Local API timer lifecycle handler', () => {
  it('previews a timer start through the signed companion without a renderer dependency', async () => {
    const data = preview()
    const { executeCanonicalTimerLifecycle, rpc, notify } = harness(data)
    const context = { supabase: { rpc }, signedUser: true }

    await expect(executeCanonicalTimerLifecycle(context, {
      operationId,
      sessionId,
      baseRevision: 0,
      action: 'start',
      payload: { taskId, duration: 1500, isBreak: false },
    }, notify)).resolves.toEqual({ status: 200, body: data })

    expect(rpc).toHaveBeenCalledWith('flowstate_timer_lifecycle_v1', {
      p_action: 'start',
      p_base_revision: 0,
      p_contract_version: 'timer-lifecycle-v1',
      p_operation_id: operationId,
      p_payload: { taskId, duration: 1500, isBreak: false },
      p_preview: true,
      p_preview_digest: null,
      p_preview_expires_at: null,
      p_request_hash: null,
      p_session_id: sessionId,
      p_source: 'local-api',
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it.each([
    ['pause', 4],
    ['resume', 4],
    ['stop', 4],
  ])('supports explicit %s with a stale-state revision guard', async (action, baseRevision) => {
    const normalizedPayload = normalizedRequest(action, {})
    const data = {
      ...preview(), action, baseRevision, normalizedPayload,
      requestHash: canonicalHash(normalizedPayload),
    }
    const { executeCanonicalTimerLifecycle, rpc, notify } = harness(data)

    await executeCanonicalTimerLifecycle({ supabase: { rpc }, signedUser: true }, {
      operationId, sessionId, baseRevision, action, payload: {},
    }, notify)

    expect(rpc).toHaveBeenCalledWith('flowstate_timer_lifecycle_v1', expect.objectContaining({
      p_action: action,
      p_base_revision: baseRevision,
      p_session_id: sessionId,
    }))
  })

  it('requires an issued preview binding before apply and verifies the committed receipt', async () => {
    const data = committed()
    const { executeCanonicalTimerLifecycle, rpc, notify } = harness(data)
    const requestHash = canonicalHash(normalizedRequest())

    await expect(executeCanonicalTimerLifecycle({ supabase: { rpc }, signedUser: true }, {
      preview: false,
      operationId,
      sessionId,
      baseRevision: 0,
      action: 'start',
      payload: { taskId, duration: 1500, isBreak: false },
      previewDigest: 'a'.repeat(64),
      previewExpiresAt: '2099-01-01T00:00:00.000Z',
      requestHash,
    }, notify)).resolves.toEqual({ status: 200, body: data })

    expect(notify).toHaveBeenCalledWith(data.receipt.readBack)
    expect(rpc).toHaveBeenCalledWith('flowstate_timer_lifecycle_v1', expect.objectContaining({
      p_preview: false,
      p_preview_digest: 'a'.repeat(64),
      p_preview_expires_at: '2099-01-01T00:00:00.000Z',
      p_request_hash: requestHash,
    }))
  })

  it('rejects unsafe or ambiguous requests before any database call', async () => {
    const { executeCanonicalTimerLifecycle, rpc, notify } = harness(null)
    const context = { supabase: { rpc }, signedUser: true }
    for (const body of [
      { operationId, sessionId: 'not-a-uuid', baseRevision: 0, action: 'start', payload: { taskId, duration: 1500, isBreak: false } },
      { operationId, sessionId, baseRevision: 0, action: 'start', payload: { taskId, duration: 0, isBreak: false } },
      { operationId, sessionId, baseRevision: 1, action: 'pause', payload: { taskId } },
      { operationId, sessionId, baseRevision: 1, action: 'toggle', payload: {} },
      { operationId, sessionId, baseRevision: 1, action: 'stop', payload: {}, preview: false },
    ]) {
      await expect(executeCanonicalTimerLifecycle(context, body, notify)).resolves.toMatchObject({
        status: 400,
        body: { ok: false },
      })
    }
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects service-role writes and tampered receipts', async () => {
    const first = harness(preview())
    await expect(first.executeCanonicalTimerLifecycle(
      { supabase: { rpc: first.rpc }, signedUser: false },
      { operationId, sessionId, baseRevision: 0, action: 'start', payload: { taskId, duration: 1500, isBreak: false } },
      first.notify,
    )).resolves.toMatchObject({ status: 401 })
    expect(first.rpc).not.toHaveBeenCalled()

    const tampered = committed()
    tampered.receipt.readBack.isActive = false
    const second = harness(tampered)
    const result = await second.executeCanonicalTimerLifecycle(
      { supabase: { rpc: second.rpc }, signedUser: true },
      {
        preview: false, operationId, sessionId, baseRevision: 0, action: 'start',
        payload: { taskId, duration: 1500, isBreak: false },
        previewDigest: 'a'.repeat(64), previewExpiresAt: '2099-01-01T00:00:00.000Z',
        requestHash: canonicalHash(normalizedRequest()),
      },
      second.notify,
    )
    expect(result).toMatchObject({ status: 502, body: { error: { code: 'invalid_canonical_receipt' } } })
    expect(second.notify).not.toHaveBeenCalled()
  })
})
