'use strict'

const {
  canonicalHash,
} = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'task-lifecycle-v1'
const SOURCE = 'local-api'
const ACTIONS = new Set(['create', 'soft_delete', 'restore', 'set_status'])
const CREATE_STATUSES = new Set(['planned', 'in_progress', 'backlog', 'on_hold'])
const TASK_STATUSES = new Set([...CREATE_STATUSES, 'done'])
const PRIORITIES = new Set(['low', 'medium', 'high'])
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_ONLY_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const ERROR_STATUS = {
  invalid_request: 400,
  invalid_task_id: 400,
  invalid_create: 400,
  invalid_status: 400,
  not_authenticated: 401,
  not_found: 404,
  project_not_found: 404,
  stale_revision: 409,
  idempotency_conflict: 409,
  preview_mismatch: 409,
  preview_expired: 409,
  task_id_unavailable: 409,
  already_deleted: 409,
  restore_not_available: 409,
  task_deleted: 409,
  no_change: 409,
  recurrence_requires_done_for_now: 409,
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

function sameKeys(value, expected) {
  const keys = Object.keys(value).sort()
  return keys.length === expected.length && keys.every((key, index) => key === expected[index])
}

function dateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function normalizePayload(action, payload, baseRevision) {
  if (!object(payload)) return null
  if (action === 'create') {
    const allowed = new Set([
      'title', 'status', 'description', 'priority', 'dueDate', 'dueTime',
      'estimatedDuration', 'projectId',
    ])
    if (baseRevision !== 0 || Object.keys(payload).some(key => !allowed.has(key))) return null
    const title = typeof payload.title === 'string' ? payload.title.trim() : ''
    const status = payload.status === undefined ? 'planned' : payload.status
    const description = payload.description === undefined ? '' : payload.description
    const priority = payload.priority === undefined ? null : payload.priority
    const dueDate = payload.dueDate === undefined ? null : payload.dueDate
    const dueTime = payload.dueTime === undefined ? null : payload.dueTime
    const estimatedDuration = payload.estimatedDuration === undefined ? null : payload.estimatedDuration
    const projectId = payload.projectId === undefined ? null : payload.projectId
    if (!title
      || [...title].length > 500
      || !CREATE_STATUSES.has(status)
      || typeof description !== 'string'
      || [...description].length > 10000
      || !(priority === null || PRIORITIES.has(priority))
      || !(dueDate === null || dateOnly(dueDate))
      || !(dueTime === null || (typeof dueTime === 'string' && TIME_ONLY_RE.test(dueTime)))
      || !(estimatedDuration === null || (Number.isSafeInteger(estimatedDuration) && estimatedDuration >= 0))
      || !(projectId === null || nonEmptyString(projectId))) return null
    return { title, status, description, priority, dueDate, dueTime, estimatedDuration, projectId }
  }
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 1) return null
  if (action === 'set_status') {
    if (!sameKeys(payload, ['status']) || !TASK_STATUSES.has(payload.status)) return null
    return { status: payload.status }
  }
  if ((action === 'soft_delete' || action === 'restore') && sameKeys(payload, [])) return {}
  return null
}

function validatedRequest(body) {
  const allowed = new Set([
    'operationId', 'taskId', 'baseRevision', 'action', 'payload', 'preview',
    'previewDigest', 'previewExpiresAt', 'requestHash', 'workspaceId',
  ])
  if (!object(body)
    || Object.keys(body).some(key => !allowed.has(key))
    || !nonEmptyString(body.operationId)
    || body.operationId.length > 160
    || !nonEmptyString(body.taskId)
    || !Number.isSafeInteger(body.baseRevision)
    || !ACTIONS.has(body.action)
    || (body.preview !== undefined && typeof body.preview !== 'boolean')
    || (body.requestHash !== undefined && !digest(body.requestHash))) {
    return { error: errorResult(400, 'invalid_request', 'The canonical lifecycle request is invalid') }
  }
  const payload = normalizePayload(body.action, body.payload, body.baseRevision)
  if (!payload) {
    const code = body.action === 'create'
      ? 'invalid_create'
      : body.action === 'set_status' ? 'invalid_status' : 'invalid_request'
    return { error: errorResult(400, code, 'The lifecycle action payload is invalid') }
  }
  const preview = body.preview !== false
  if (!preview && (!digest(body.previewDigest) || !timestamp(body.previewExpiresAt))) {
    return {
      error: errorResult(
        400,
        'approval_receipt_required',
        'previewDigest and previewExpiresAt are required for apply',
      ),
    }
  }
  return { preview, payload }
}

function normalizedRequest(body, payload, workspaceId) {
  return {
    contractVersion: CONTRACT_VERSION,
    source: SOURCE,
    action: body.action,
    taskId: body.taskId,
    baseRevision: body.baseRevision,
    workspaceId,
    payload,
  }
}

function validPreview(data, body, expectedRequest, expectedHash) {
  if (!object(data)
    || data.ok !== true
    || data.result !== 'preview'
    || data.contractVersion !== CONTRACT_VERSION
    || data.operationId !== body.operationId
    || data.action !== body.action
    || data.taskId !== body.taskId
    || data.baseRevision !== body.baseRevision
    || data.requestHash !== expectedHash
    || !digest(data.previewDigest)
    || !timestamp(data.previewExpiresAt)
    || !object(data.normalizedPayload)) return false
  try {
    return canonicalHash(data.normalizedPayload) === canonicalHash(expectedRequest)
  } catch {
    return false
  }
}

function validLifecycleReadBack(readBack, body, payload, workspaceId) {
  if (!object(readBack)
    || readBack.id !== body.taskId
    || !nonEmptyString(readBack.title)
    || !(typeof readBack.description === 'string' || readBack.description === null)
    || !(readBack.priority === null || PRIORITIES.has(readBack.priority))
    || !(readBack.dueDate === null || dateOnly(readBack.dueDate))
    || !(readBack.dueTime === null || (typeof readBack.dueTime === 'string' && TIME_ONLY_RE.test(readBack.dueTime)))
    || !(readBack.estimatedDuration === null || (Number.isSafeInteger(readBack.estimatedDuration) && readBack.estimatedDuration >= 0))
    || !(readBack.projectId === null || nonEmptyString(readBack.projectId))
    || !TASK_STATUSES.has(readBack.status)
    || !Number.isSafeInteger(readBack.canonicalRevision)
    || readBack.canonicalRevision !== body.baseRevision + 1
    || !timestamp(readBack.canonicalUpdatedAt)
    || typeof readBack.isDeleted !== 'boolean'
    || typeof readBack.tombstone !== 'boolean'
    || readBack.workspaceId !== workspaceId
    || !(readBack.deletedAt === null || timestamp(readBack.deletedAt))) return false

  if (body.action === 'create') {
    return readBack.title === payload.title
      && readBack.status === payload.status
      && readBack.description === payload.description
      && readBack.priority === payload.priority
      && readBack.dueDate === payload.dueDate
      && readBack.dueTime === payload.dueTime
      && readBack.estimatedDuration === payload.estimatedDuration
      && readBack.projectId === payload.projectId
      && readBack.isDeleted === false
      && readBack.deletedAt === null
      && readBack.tombstone === false
  }
  if (body.action === 'soft_delete') {
    return readBack.isDeleted === true && timestamp(readBack.deletedAt) && readBack.tombstone === true
  }
  if (body.action === 'restore') {
    return readBack.isDeleted === false && readBack.deletedAt === null && readBack.tombstone === false
  }
  return readBack.status === payload.status
    && readBack.isDeleted === false
    && readBack.deletedAt === null
    && readBack.tombstone === false
}

function validCommitted(data, body, payload, workspaceId, expectedHash) {
  if (!object(data)
    || data.ok !== true
    || data.status !== 'committed'
    || data.result !== 'committed'
    || data.requestHash !== expectedHash
    || !object(data.receipt)
    || data.receipt.status !== data.status
    || data.receipt.requestHash !== data.requestHash) return false

  const receipt = data.receipt
  if (receipt.contractVersion !== CONTRACT_VERSION
    || receipt.operationId !== body.operationId
    || receipt.source !== SOURCE
    || receipt.status !== 'committed'
    || receipt.requestHash !== expectedHash
    || receipt.entityType !== 'task'
    || receipt.action !== body.action
    || receipt.entityId !== body.taskId
    || !Number.isSafeInteger(receipt.canonicalRevision)
    || receipt.canonicalRevision < 1
    || !Number.isSafeInteger(receipt.changeSequence)
    || receipt.changeSequence < 1
    || !timestamp(receipt.canonicalUpdatedAt)
    || !timestamp(receipt.committedAt)
    || typeof receipt.replayed !== 'boolean'
    || !object(receipt.readBack)
    || !digest(receipt.readBackHash)) return false
  try {
    return canonicalHash(receipt.readBack) === receipt.readBackHash
      && validLifecycleReadBack(receipt.readBack, body, payload, workspaceId)
      && receipt.readBack.canonicalRevision === receipt.canonicalRevision
      && receipt.readBack.canonicalUpdatedAt === receipt.canonicalUpdatedAt
  } catch {
    return false
  }
}

function reconciliationOperation(action) {
  if (action === 'create') return 'create'
  if (action === 'soft_delete') return 'delete'
  return 'update'
}

async function executeCanonicalTaskLifecycle(context, body, notifyTaskMutation) {
  if (context.signedUser === false) {
    return errorResult(401, 'signed_user_required', 'Canonical task lifecycle writes require a signed-in user session')
  }
  const validated = validatedRequest(body)
  if (validated.error) return validated.error

  const workspaceId = context.activeWorkspaceId
  if (Object.hasOwn(body, 'workspaceId') && body.workspaceId !== workspaceId) {
    return errorResult(409, 'workspace_mismatch', 'The requested workspace is not the active signed-in scope')
  }
  const expectedRequest = normalizedRequest(body, validated.payload, workspaceId)
  let expectedHash
  try {
    expectedHash = canonicalHash(expectedRequest)
  } catch {
    return errorResult(400, 'invalid_request', 'The canonical lifecycle request is invalid')
  }
  if (!validated.preview && body.requestHash !== undefined && body.requestHash !== expectedHash) {
    return errorResult(409, 'request_hash_mismatch', 'The approved lifecycle request no longer matches')
  }

  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_task_lifecycle_v1', {
      p_action: body.action,
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: body.operationId,
      p_payload: validated.payload,
      p_preview: validated.preview,
      p_preview_digest: validated.preview ? null : body.previewDigest,
      p_preview_expires_at: validated.preview ? null : body.previewExpiresAt,
      p_source: SOURCE,
      p_task_id: body.taskId,
      p_workspace_id: workspaceId,
    })
  } catch {
    return errorResult(500, 'canonical_task_lifecycle_failed', 'Task lifecycle request could not be completed')
  }
  const { data, error } = rpcResult || {}
  if (error || !object(data)) {
    return errorResult(500, 'canonical_task_lifecycle_failed', 'Task lifecycle request could not be completed')
  }
  if (data.ok !== true) {
    const code = object(data.error) && typeof data.error.code === 'string' ? data.error.code : ''
    const body = code === 'recurrence_requires_done_for_now'
      ? { ...data, action: 'use_flowstate_done_for_now' }
      : data
    return { status: ERROR_STATUS[code] || 500, body }
  }
  if (validated.preview) {
    if (!validPreview(data, body, expectedRequest, expectedHash)) {
      return errorResult(502, 'invalid_canonical_response', 'Canonical lifecycle preview could not be verified')
    }
    return { status: 200, body: data }
  }
  if (!validCommitted(data, body, validated.payload, workspaceId, expectedHash)) {
    return errorResult(502, 'invalid_canonical_receipt', 'Canonical lifecycle receipt could not be verified')
  }

  try {
    notifyTaskMutation(reconciliationOperation(body.action), body.taskId)
  } catch {
    // The verified database commit remains authoritative if IPC reconciliation fails.
  }
  return { status: 200, body: data }
}

module.exports = { executeCanonicalTaskLifecycle }
