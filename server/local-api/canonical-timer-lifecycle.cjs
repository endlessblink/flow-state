'use strict'

const { canonicalHash } = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'timer-lifecycle-v1'
const SOURCE = 'local-api'
const ACTIONS = new Set(['start', 'pause', 'resume', 'stop'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const ERROR_STATUS = {
  invalid_request: 400,
  invalid_action: 400,
  not_authenticated: 401,
  task_not_found: 404,
  session_not_found: 404,
  active_session_conflict: 409,
  stale_revision: 409,
  invalid_state: 409,
  idempotency_conflict: 409,
  preview_mismatch: 409,
  preview_expired: 409,
}

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function timestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function digest(value) {
  return typeof value === 'string' && SHA256_HEX_RE.test(value)
}

function errorResult(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } }
}

// Returns { payload } or { problem } naming the offending field, so callers can fix the request.
function normalizePayload(action, payload) {
  if (!object(payload)) return { problem: 'payload must be an object' }
  if (action !== 'start') {
    return Object.keys(payload).length === 0 ? { payload: {} } : { problem: `payload must be {} for action "${action}"` }
  }
  const allowed = new Set(['taskId', 'duration', 'isBreak'])
  const unknown = Object.keys(payload).filter(key => !allowed.has(key))
  if (unknown.length) return { problem: `payload has unsupported field(s): ${unknown.join(', ')} (allowed: taskId, duration, isBreak)` }
  const taskId = typeof payload.taskId === 'string' ? payload.taskId.trim() : ''
  const duration = Number(payload.duration)
  const isBreak = payload.isBreak === true
  if (!taskId || taskId.length > 160) return { problem: 'payload.taskId is required (task id, or "break" for a break)' }
  if (!Number.isSafeInteger(duration) || duration <= 0 || duration > 24 * 60 * 60) {
    return { problem: 'payload.duration is required as whole seconds between 1 and 86400' }
  }
  if (typeof payload.isBreak !== 'boolean') return { problem: 'payload.isBreak is required as a boolean' }
  if (isBreak && taskId !== 'break') return { problem: 'payload.taskId must be "break" when payload.isBreak is true' }
  if (!isBreak && taskId === 'break') return { problem: 'payload.isBreak must be true when payload.taskId is "break"' }
  return { payload: { taskId, duration, isBreak } }
}

function requestProblem(body) {
  const allowed = new Set([
    'operationId', 'sessionId', 'baseRevision', 'action', 'payload', 'preview',
    'previewDigest', 'previewExpiresAt', 'requestHash',
  ])
  if (!object(body)) return 'request body must be a JSON object'
  const unknown = Object.keys(body).filter(key => !allowed.has(key))
  if (unknown.length) return `unsupported field(s): ${unknown.join(', ')}`
  if (!nonEmptyString(body.operationId) || body.operationId.length > 160) {
    return 'operationId is required (non-empty string, max 160 chars, no surrounding spaces)'
  }
  if (!UUID_RE.test(body.sessionId || '')) {
    return 'sessionId is required as a UUID (generate a new one for start; use the active session id otherwise)'
  }
  if (!Number.isSafeInteger(body.baseRevision) || body.baseRevision < 0) {
    return 'baseRevision is required as a non-negative integer (0 for start)'
  }
  if (!ACTIONS.has(body.action)) return 'action must be one of: start, pause, resume, stop'
  if (body.preview !== undefined && typeof body.preview !== 'boolean') return 'preview must be a boolean'
  return null
}

function validateRequest(body) {
  const problem = requestProblem(body)
  if (problem) {
    return { error: errorResult(400, 'invalid_request', `The canonical timer request is invalid: ${problem}`) }
  }
  if (body.action !== 'start' && body.baseRevision < 1) {
    return { error: errorResult(400, 'invalid_request', 'An active timer revision is required') }
  }
  const normalized = normalizePayload(body.action, body.payload)
  if (normalized.problem) {
    return { error: errorResult(400, 'invalid_request', `The timer action payload is invalid: ${normalized.problem}`) }
  }
  const payload = normalized.payload
  const preview = body.preview !== false
  if (!preview && (!digest(body.previewDigest) || !timestamp(body.previewExpiresAt) || !digest(body.requestHash))) {
    return { error: errorResult(400, 'approval_receipt_required', 'An issued timer preview is required for apply') }
  }
  return { preview, payload }
}

function normalizedRequest(body, payload) {
  return {
    contractVersion: CONTRACT_VERSION,
    source: SOURCE,
    action: body.action,
    sessionId: body.sessionId,
    baseRevision: body.baseRevision,
    payload,
  }
}

function validTimerReadBack(readBack, body) {
  if (!object(readBack)
    || readBack.id !== body.sessionId
    || !nonEmptyString(readBack.taskId)
    || !Number.isSafeInteger(readBack.duration)
    || readBack.duration <= 0
    || !Number.isSafeInteger(readBack.remainingTime)
    || readBack.remainingTime < 0
    || typeof readBack.isActive !== 'boolean'
    || typeof readBack.isPaused !== 'boolean'
    || typeof readBack.isBreak !== 'boolean'
    || !(readBack.completedAt === null || timestamp(readBack.completedAt))
    || !nonEmptyString(readBack.deviceLeaderId)
    || !Number.isSafeInteger(readBack.canonicalRevision)
    || readBack.canonicalRevision < 1
    || !timestamp(readBack.canonicalUpdatedAt)) return false

  if (body.action === 'start') return readBack.isActive && !readBack.isPaused && readBack.completedAt === null
  if (body.action === 'pause') return readBack.isActive && readBack.isPaused
  if (body.action === 'resume') return readBack.isActive && !readBack.isPaused
  return !readBack.isActive && timestamp(readBack.completedAt)
}

function validPreview(data, body, expectedRequest, expectedHash) {
  if (!object(data)
    || data.ok !== true
    || data.result !== 'preview'
    || data.contractVersion !== CONTRACT_VERSION
    || data.operationId !== body.operationId
    || data.action !== body.action
    || data.sessionId !== body.sessionId
    || data.baseRevision !== body.baseRevision
    || data.requestHash !== expectedHash
    || !digest(data.previewDigest)
    || !timestamp(data.previewExpiresAt)
    || !object(data.normalizedPayload)
    || !object(data.proposed)) return false
  try {
    return canonicalHash(data.normalizedPayload) === canonicalHash(expectedRequest)
  } catch {
    return false
  }
}

function validCommitted(data, body, expectedHash) {
  const receipt = data && data.receipt
  if (!object(data)
    || data.ok !== true
    || data.result !== 'committed'
    || data.status !== 'committed'
    || data.requestHash !== expectedHash
    || !object(receipt)
    || receipt.contractVersion !== CONTRACT_VERSION
    || receipt.operationId !== body.operationId
    || receipt.source !== SOURCE
    || receipt.status !== 'committed'
    || receipt.requestHash !== expectedHash
    || receipt.entityType !== 'timer_session'
    || receipt.action !== body.action
    || receipt.entityId !== body.sessionId
    || !Number.isSafeInteger(receipt.canonicalRevision)
    || receipt.canonicalRevision < 1
    || !Number.isSafeInteger(receipt.changeSequence)
    || receipt.changeSequence < 1
    || !timestamp(receipt.canonicalUpdatedAt)
    || !timestamp(receipt.committedAt)
    || typeof receipt.replayed !== 'boolean'
    || !object(receipt.readBack)
    || !digest(receipt.readBackHash)
    || !validTimerReadBack(receipt.readBack, body)
    || receipt.readBack.canonicalRevision !== receipt.canonicalRevision
    || receipt.readBack.canonicalUpdatedAt !== receipt.canonicalUpdatedAt) return false
  try {
    return canonicalHash(receipt.readBack) === receipt.readBackHash
  } catch {
    return false
  }
}

async function executeCanonicalTimerLifecycle(context, body, notifyTimerMutation) {
  if (context.signedUser === false) {
    return errorResult(401, 'signed_user_required', 'Canonical timer control requires a signed-in user session')
  }
  const validated = validateRequest(body)
  if (validated.error) return validated.error
  const expectedRequest = normalizedRequest(body, validated.payload)
  const expectedHash = canonicalHash(expectedRequest)
  if (!validated.preview && body.requestHash !== expectedHash) {
    return errorResult(409, 'request_hash_mismatch', 'The approved timer request no longer matches')
  }

  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_timer_lifecycle_v1', {
      p_action: body.action,
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: body.operationId,
      p_payload: validated.payload,
      p_preview: validated.preview,
      p_preview_digest: validated.preview ? null : body.previewDigest,
      p_preview_expires_at: validated.preview ? null : body.previewExpiresAt,
      p_request_hash: validated.preview ? null : body.requestHash,
      p_session_id: body.sessionId,
      p_source: SOURCE,
    })
  } catch {
    return errorResult(500, 'canonical_timer_lifecycle_failed', 'Timer control could not be committed')
  }
  const { data, error } = rpcResult || {}
  if (error || !object(data)) {
    return errorResult(500, 'canonical_timer_lifecycle_failed', 'Timer control could not be committed')
  }
  if (data.ok !== true) {
    const code = data.error && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }
  if (validated.preview) {
    return validPreview(data, body, expectedRequest, expectedHash)
      ? { status: 200, body: data }
      : errorResult(502, 'invalid_canonical_response', 'Canonical timer preview could not be verified')
  }
  if (!validCommitted(data, body, expectedHash)) {
    return errorResult(502, 'invalid_canonical_receipt', 'Canonical timer receipt could not be verified')
  }
  try {
    notifyTimerMutation(data.receipt.readBack)
  } catch {
    // The durable commit remains successful even if renderer reconciliation fails.
  }
  return { status: 200, body: data }
}

module.exports = { executeCanonicalTimerLifecycle }
