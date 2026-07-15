'use strict'

const { canonicalHash, canonicalJson } = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'timer-v1'
const SOURCE = 'local-api'
const ACTIONS = new Set(['start', 'pause', 'resume', 'stop', 'switch_task', 'extend'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const OFFSET_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/
const ALLOWED_FIELDS = new Set([
  'operationId', 'action', 'sessionId', 'baseRevision', 'deviceId', 'taskId',
  'startedAt', 'durationSeconds', 'remainingSeconds', 'extensionSeconds', 'isBreak', 'preview', 'previewDigest',
  'previewExpiresAt', 'requestHash',
])
const ERROR_STATUS = {
  invalid_request: 400,
  invalid_action: 400,
  approval_receipt_required: 400,
  not_authenticated: 401,
  signed_user_required: 401,
  scope_denied: 403,
  not_found: 404,
  task_not_found: 404,
  timer_not_found: 404,
  leader_conflict: 409,
  stale_revision: 409,
  illegal_transition: 409,
  idempotency_conflict: 409,
  request_hash_required: 409,
  request_hash_mismatch: 409,
  preview_mismatch: 409,
  preview_expired: 409,
}

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function uuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function digest(value) {
  return typeof value === 'string' && SHA256_HEX_RE.test(value)
}

function timestamp(value) {
  return nonEmptyString(value) && value.includes('T') && Number.isFinite(Date.parse(value))
}

function offsetTimestamp(value) {
  return typeof value === 'string' && OFFSET_TIMESTAMP_RE.test(value) && Number.isFinite(Date.parse(value))
}

function sameInstant(left, right) {
  return offsetTimestamp(left) && offsetTimestamp(right) && Date.parse(left) === Date.parse(right)
}

function sameJson(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right)
  } catch {
    return false
  }
}

function hashMatches(value, expected) {
  try {
    return digest(expected) && canonicalHash(value) === expected
  } catch {
    return false
  }
}

function errorResult(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } }
}

function normalizeRequest(body) {
  if (!object(body) || Object.keys(body).some(key => !ALLOWED_FIELDS.has(key))) {
    return { error: errorResult(400, 'invalid_request', 'The canonical timer request is invalid') }
  }
  const preview = body.preview !== false
  if (
    !nonEmptyString(body.operationId) || body.operationId.length > 160
    || !ACTIONS.has(body.action)
    || !uuid(body.sessionId)
    || !nonEmptyString(body.deviceId) || body.deviceId.length > 160
    || (body.preview !== undefined && typeof body.preview !== 'boolean')
  ) {
    return { error: errorResult(400, 'invalid_request', 'The canonical timer request is invalid') }
  }
  if (body.action === 'start') {
    if (
      body.baseRevision !== 0
      || !nonEmptyString(body.taskId) || body.taskId.length > 256
      || !offsetTimestamp(body.startedAt)
      || !positiveInteger(body.durationSeconds) || body.durationSeconds > 86400
      || typeof body.isBreak !== 'boolean'
    ) {
      return { error: errorResult(400, 'invalid_request', 'Start requires exact timer creation fields') }
    }
  } else if (!positiveInteger(body.baseRevision)) {
    return { error: errorResult(400, 'invalid_request', 'Timer transitions require a positive revision') }
  } else if (body.action === 'switch_task') {
    if (!nonEmptyString(body.taskId) || body.taskId.length > 256
      || !Number.isSafeInteger(body.remainingSeconds) || body.remainingSeconds < 0
      || body.startedAt !== undefined || body.durationSeconds !== undefined
      || body.extensionSeconds !== undefined || body.isBreak !== undefined) {
      return { error: errorResult(400, 'invalid_request', 'Task switch fields are invalid') }
    }
  } else if (body.action === 'extend') {
    if (!positiveInteger(body.extensionSeconds) || body.extensionSeconds > 86400
      || body.taskId !== undefined || body.startedAt !== undefined
      || body.durationSeconds !== undefined || body.remainingSeconds !== undefined || body.isBreak !== undefined) {
      return { error: errorResult(400, 'invalid_request', 'Extension fields are invalid') }
    }
  } else if (!Number.isSafeInteger(body.remainingSeconds) || body.remainingSeconds < 0
    || body.taskId !== undefined || body.startedAt !== undefined
    || body.durationSeconds !== undefined || body.extensionSeconds !== undefined || body.isBreak !== undefined) {
    return { error: errorResult(400, 'invalid_request', 'Transition fields are invalid') }
  }
  if (!preview && (!digest(body.previewDigest) || !offsetTimestamp(body.previewExpiresAt) || !digest(body.requestHash))) {
    return { error: errorResult(400, 'approval_receipt_required', 'Exact preview approval fields are required for apply') }
  }
  return { preview }
}

function expectedState(action) {
  return { isActive: action !== 'stop', isPaused: action === 'pause' ? true : action === 'switch_task' ? null : false }
}

function validWorkspaceId(value) {
  return value === null || uuid(value)
}

function validReadBack(value, body, revision, workspaceId) {
  if (!object(value)) return false
  const state = expectedState(body.action)
  return value.id === body.sessionId
    && value.workspaceId === workspaceId
    && nonEmptyString(value.taskId)
    && timestamp(value.startTime)
    && positiveInteger(value.duration)
    && Number.isSafeInteger(value.remainingTime) && value.remainingTime >= 0
    && value.remainingTime <= value.duration
    && value.isActive === state.isActive
    && (state.isPaused === null ? typeof value.isPaused === 'boolean' : value.isPaused === state.isPaused)
    && typeof value.isBreak === 'boolean'
    && (value.completedAt === null || timestamp(value.completedAt))
    && (body.action === 'stop' ? timestamp(value.completedAt) : value.completedAt === null)
    && value.deviceLeaderId === body.deviceId
    && value.canonicalRevision === revision
    && timestamp(value.canonicalUpdatedAt)
    && (body.action !== 'start' || (
      value.taskId === body.taskId
      && sameInstant(value.startTime, body.startedAt)
      && value.duration === body.durationSeconds
      && value.remainingTime === body.durationSeconds
      && value.isBreak === body.isBreak
    ))
    && (body.action !== 'switch_task' || (value.taskId === body.taskId && value.remainingTime === body.remainingSeconds))
    && (body.action !== 'extend' || value.remainingTime === body.extensionSeconds)
    && (!['pause', 'resume', 'stop'].includes(body.action) || value.remainingTime === body.remainingSeconds)
}

function validReplacement(value, body) {
  return object(value)
    && uuid(value.id) && value.id !== body.sessionId
    && validWorkspaceId(value.workspaceId)
    && nonEmptyString(value.taskId)
    && timestamp(value.startTime)
    && positiveInteger(value.duration)
    && Number.isSafeInteger(value.remainingTime) && value.remainingTime >= 0
    && value.remainingTime <= value.duration
    && value.isActive === false
    && typeof value.isPaused === 'boolean'
    && typeof value.isBreak === 'boolean'
    && timestamp(value.completedAt)
    && nonEmptyString(value.deviceLeaderId)
    && positiveInteger(value.canonicalRevision)
    && timestamp(value.canonicalUpdatedAt)
}

function normalizedMatches(value, body, workspaceId) {
  if (!object(value)) return false
  const common = value.action === body.action
    && value.sessionId === body.sessionId
    && value.baseRevision === body.baseRevision
    && value.deviceId === body.deviceId
    && value.workspaceId === workspaceId
  if (!common) return false
  if (body.action === 'start') {
    return value.taskId === body.taskId
      && sameInstant(value.startedAt, body.startedAt)
      && value.durationSeconds === body.durationSeconds
      && value.isBreak === body.isBreak
  }
  return value.taskId === (body.taskId ?? null) && value.startedAt === null
    && value.durationSeconds === null && value.isBreak === null
    && value.remainingSeconds === (body.remainingSeconds ?? null)
    && value.extensionSeconds === (body.extensionSeconds ?? null)
}

function validPreview(data, body, workspaceId) {
  const revision = body.action === 'start' ? 1 : body.baseRevision + 1
  return object(data) && data.ok === true && data.result === 'preview'
    && data.contractVersion === CONTRACT_VERSION
    && data.action === body.action
    && data.operationId === body.operationId
    && digest(data.requestHash) && digest(data.previewDigest) && offsetTimestamp(data.previewExpiresAt)
    && normalizedMatches(data.normalizedPayload, body, workspaceId)
    && validReadBack(data.readBack, body, revision, workspaceId)
    && Array.isArray(data.replacedSessions)
    && (body.action === 'start' || data.replacedSessions.length === 0)
    && data.replacedSessions.every(item => validReplacement(item, body))
}

function validAffectedEntry(entry, expected) {
  return object(entry)
    && entry.entityType === 'timer_session'
    && entry.entityId === expected.entityId
    && entry.action === expected.action
    && positiveInteger(entry.canonicalRevision)
    && positiveInteger(entry.changeSequence)
    && object(entry.readBack)
    && entry.readBack.id === entry.entityId
    && entry.readBack.canonicalRevision === entry.canonicalRevision
    && hashMatches(entry.readBack, entry.readBackHash)
}

function validCommit(data, body, workspaceId, expectedRequestHash) {
  if (!object(data) || data.ok !== true || data.result !== 'committed'
    || data.action !== body.action || data.operationId !== body.operationId
    || data.requestHash !== expectedRequestHash || !object(data.receipt)) return false
  const receipt = data.receipt
  const revision = body.action === 'start' ? 1 : body.baseRevision + 1
  if (
    receipt.ok !== true
    || !['committed', 'replayed'].includes(receipt.status)
    || receipt.replayed !== (receipt.status === 'replayed')
    || receipt.contractVersion !== CONTRACT_VERSION
    || receipt.operationId !== body.operationId
    || receipt.requestHash !== expectedRequestHash
    || receipt.source !== SOURCE
    || receipt.entityType !== 'timer_session'
    || receipt.entityId !== body.sessionId
    || receipt.action !== body.action
    || receipt.canonicalRevision !== revision
    || !timestamp(receipt.canonicalUpdatedAt)
    || !positiveInteger(receipt.changeSequence)
    || !timestamp(receipt.committedAt)
    || !validReadBack(receipt.readBack, body, revision, workspaceId)
    || !hashMatches(receipt.readBack, receipt.readBackHash)
    || !Array.isArray(receipt.affected)
    || !object(receipt.operationContext)
    || !Array.isArray(receipt.operationContext.replacedSessionIds)
  ) return false

  const ids = receipt.affected.map(entry => object(entry) ? entry.entityId : null)
  if (ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) return false
  const primaryAction = body.action === 'start' ? 'inserted' : 'updated'
  const primary = receipt.affected.find(entry => object(entry) && entry.entityId === body.sessionId)
  if (!validAffectedEntry(primary, { entityId: body.sessionId, action: primaryAction })
    || primary.canonicalRevision !== revision
    || primary.changeSequence !== receipt.changeSequence
    || !sameJson(primary.readBack, receipt.readBack)) return false

  const replacementIds = receipt.operationContext.replacedSessionIds
  if (body.action !== 'start' && replacementIds.length !== 0) return false
  if (replacementIds.some(id => !uuid(id) || id === body.sessionId)
    || new Set(replacementIds).size !== replacementIds.length
    || receipt.affected.length !== replacementIds.length + 1) return false
  return replacementIds.every(id => {
    const entry = receipt.affected.find(candidate => object(candidate) && candidate.entityId === id)
    return validAffectedEntry(entry, { entityId: id, action: 'updated' })
      && validReplacement(entry.readBack, body)
  })
}

function mapTimerSession(row) {
  const mapped = {
    id: row.id,
    workspaceId: row.workspace_id ?? null,
    taskId: row.task_id,
    startTime: row.start_time,
    duration: row.duration,
    remainingTime: row.remaining_time,
    isActive: row.is_active,
    isPaused: row.is_paused,
    isBreak: row.is_break,
    completedAt: row.completed_at ?? null,
    deviceLeaderId: row.device_leader_id,
    canonicalRevision: row.canonical_revision,
    canonicalUpdatedAt: row.updated_at,
  }
  return uuid(mapped.id) && validWorkspaceId(mapped.workspaceId)
    && nonEmptyString(mapped.taskId) && timestamp(mapped.startTime)
    && positiveInteger(mapped.duration) && Number.isSafeInteger(mapped.remainingTime)
    && mapped.remainingTime >= 0 && mapped.remainingTime <= mapped.duration
    && typeof mapped.isActive === 'boolean' && typeof mapped.isPaused === 'boolean'
    && typeof mapped.isBreak === 'boolean'
    && (mapped.completedAt === null || timestamp(mapped.completedAt))
    && nonEmptyString(mapped.deviceLeaderId)
    && positiveInteger(mapped.canonicalRevision) && timestamp(mapped.canonicalUpdatedAt)
    ? mapped : null
}

async function readTimerSession(context, sessionId = null) {
  if (!context?.signedUser) {
    return errorResult(401, 'signed_user_required', 'Canonical timer reads require a signed-in user session')
  }
  if (!nonEmptyString(context.userId) || (sessionId !== null && !uuid(sessionId))) {
    return errorResult(400, 'invalid_request', 'Canonical timer reads require valid identity')
  }
  let query = context.supabase.from('timer_sessions')
    .select('id,workspace_id,task_id,start_time,duration,remaining_time,is_active,is_paused,is_break,completed_at,device_leader_id,canonical_revision,updated_at')
    .eq('user_id', context.userId)
  query = context.activeWorkspaceId === null
    ? query.is('workspace_id', null)
    : query.eq('workspace_id', context.activeWorkspaceId)
  query = sessionId
    ? query.eq('id', sessionId)
    : query.eq('is_active', true).order('updated_at', { ascending: false }).limit(1)
  let result
  try {
    result = await query.maybeSingle()
  } catch {
    return errorResult(500, 'timer_read_failed', 'Canonical timer state could not be read')
  }
  if (result?.error) return errorResult(500, 'timer_read_failed', 'Canonical timer state could not be read')
  if (!result?.data) {
    return sessionId
      ? errorResult(404, 'not_found', 'Timer session was not found')
      : { status: 200, body: { ok: true, fresh: true, session: null } }
  }
  const session = mapTimerSession(result.data)
  return session
    ? { status: 200, body: { ok: true, fresh: true, session } }
    : errorResult(502, 'invalid_canonical_response', 'Canonical timer state could not be verified')
}

async function executeTimerCommand(context, body, notifyTimerMutation) {
  if (!context?.signedUser) {
    return errorResult(401, 'signed_user_required', 'Canonical timer changes require a signed-in user session')
  }
  const request = normalizeRequest(body)
  if (request.error) return request.error
  let result
  try {
    result = await context.supabase.rpc('flowstate_timer_command_v1', {
      p_action: body.action,
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_device_id: body.deviceId,
      p_duration_seconds: body.durationSeconds ?? null,
      p_remaining_seconds: body.remainingSeconds ?? null,
      p_extension_seconds: body.extensionSeconds ?? null,
      p_is_break: body.isBreak ?? null,
      p_operation_id: body.operationId,
      p_preview: request.preview,
      p_preview_digest: request.preview ? null : body.previewDigest,
      p_preview_expires_at: request.preview ? null : body.previewExpiresAt,
      p_request_hash: request.preview ? null : body.requestHash,
      p_session_id: body.sessionId,
      p_source: SOURCE,
      p_started_at: body.startedAt ?? null,
      p_task_id: body.taskId ?? null,
      p_workspace_id: context.activeWorkspaceId,
    })
  } catch {
    return errorResult(500, 'canonical_timer_failed', 'Canonical timer change could not be committed')
  }
  if (result?.error || !object(result?.data)) {
    return errorResult(500, 'canonical_timer_failed', 'Canonical timer change could not be committed')
  }
  const data = result.data
  if (data.ok !== true) {
    const code = object(data.error) && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }

  if (request.preview && data.result === 'preview') {
    return validPreview(data, body, context.activeWorkspaceId)
      ? { status: 200, body: data }
      : errorResult(502, 'invalid_canonical_response', 'Canonical timer preview could not be verified')
  }

  const expectedRequestHash = request.preview ? data.requestHash : body.requestHash
  if (!digest(expectedRequestHash) || !validCommit(data, body, context.activeWorkspaceId, expectedRequestHash)) {
    return errorResult(502, 'invalid_canonical_response', 'Canonical timer receipt could not be verified')
  }
  const receipt = data.receipt
  if (!receipt.replayed) {
    for (const replacementId of receipt.operationContext.replacedSessionIds) {
      try {
        notifyTimerMutation('update', replacementId)
      } catch {
        // The canonical commit is durable; renderer reconciliation is best effort.
      }
    }
    try {
      notifyTimerMutation(body.action === 'start' ? 'create' : 'update', body.sessionId)
    } catch {
      // The canonical commit is durable; renderer reconciliation is best effort.
    }
  }
  return { status: 200, body: data }
}

module.exports = {
  executeTimerCommand,
  mapTimerSession,
  readTimerSession,
}
