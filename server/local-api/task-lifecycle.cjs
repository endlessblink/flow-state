'use strict'

const { validateAffectedTaskEntry, validateCanonicalReceipt } = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'task-v1'
const SOURCE = 'local-api'
const ACTIONS = new Set(['create', 'delete', 'restore', 'reopen'])
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ERROR_STATUS = {
  invalid_request: 400,
  invalid_action: 400,
  invalid_due_date: 400,
  not_authenticated: 401,
  scope_denied: 403,
  not_found: 404,
  project_not_found: 404,
  stale_revision: 409,
  idempotency_conflict: 409,
  request_hash_required: 409,
  request_hash_mismatch: 409,
  preview_mismatch: 409,
  preview_expired: 409,
  restore_conflict: 409,
  task_id_conflict: 409,
  already_deleted: 409,
  already_open: 409,
  already_completed: 409,
  recurring_task: 409,
}

function errorResult(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } }
}

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function timestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function digest(value) {
  return typeof value === 'string' && SHA256_HEX_RE.test(value)
}

function validateCreatePayload(payload) {
  if (!object(payload)) return false
  const allowed = new Set([
    'title', 'description', 'priority', 'dueDate', 'projectId', 'status', 'isInInbox',
  ])
  if (Object.keys(payload).some(key => !allowed.has(key))) return false
  if (!nonEmptyString(payload.title)) return false
  if (payload.description !== undefined && typeof payload.description !== 'string') return false
  if (
    payload.priority !== undefined
    && payload.priority !== null
    && !['low', 'medium', 'high'].includes(payload.priority)
  ) return false
  if (
    payload.dueDate !== undefined
    && payload.dueDate !== null
    && (!nonEmptyString(payload.dueDate) || !Number.isFinite(Date.parse(payload.dueDate)))
  ) return false
  if (payload.status !== undefined && payload.status !== 'planned') return false
  if (payload.isInInbox !== undefined && typeof payload.isInInbox !== 'boolean') return false
  return !(
    payload.projectId !== undefined
    && payload.projectId !== null
    && (!nonEmptyString(payload.projectId) || !UUID_RE.test(payload.projectId))
  )
}

function validateRequest(action, taskId, body) {
  if (!ACTIONS.has(action)) {
    return errorResult(400, 'invalid_action', 'Unsupported task lifecycle action')
  }
  if (!object(body)) {
    return errorResult(400, 'invalid_request', 'The canonical lifecycle request is invalid')
  }
  const preview = body.preview !== false
  if (!preview && (
    !nonEmptyString(body.operationId)
    || (action === 'create' ? body.baseRevision !== 0 : !positiveInteger(body.baseRevision))
  )) {
    return errorResult(
      400,
      'approval_receipt_required',
      'operationId, baseRevision, previewDigest, previewExpiresAt, and requestHash are required for apply',
    )
  }
  if (!nonEmptyString(body.operationId)) {
    return errorResult(400, 'invalid_request', 'The canonical lifecycle request is invalid')
  }
  if (body.operationId.length > 160 || (body.preview !== undefined && typeof body.preview !== 'boolean')) {
    return errorResult(400, 'invalid_request', 'The canonical lifecycle request is invalid')
  }

  if (action === 'create') {
    if (body.baseRevision !== 0 || !validateCreatePayload(body.payload)) {
      return errorResult(400, 'invalid_request', 'Canonical create requires baseRevision 0 and a valid task payload')
    }
    if (!preview && !nonEmptyString(body.taskId)) {
      return errorResult(400, 'approval_receipt_required', 'The approved create taskId is required for apply')
    }
  } else if (!nonEmptyString(taskId) || !positiveInteger(body.baseRevision)) {
    return errorResult(400, 'invalid_request', 'Task id and positive baseRevision are required')
  }

  if (!preview && (
    !digest(body.previewDigest)
    || !timestamp(body.previewExpiresAt)
    || !digest(body.requestHash)
  )) {
    return errorResult(
      400,
      'approval_receipt_required',
      'operationId, baseRevision, previewDigest, previewExpiresAt, and requestHash are required for apply',
    )
  }
  return null
}

function validLifecycleState(action, readBack) {
  if (!object(readBack) || typeof readBack.tombstonePresent !== 'boolean') return false
  if (action === 'delete') {
    return readBack.isDeleted === true
      && readBack.tombstonePresent === true
      && timestamp(readBack.deletedAt)
  }
  if (
    readBack.isDeleted !== false
    || readBack.tombstonePresent !== false
    || readBack.deletedAt !== null
  ) return false
  if (action === 'reopen') {
    return readBack.status === 'todo' && readBack.completedAt === null
  }
  return true
}

function validPreview(data, action, taskId, body, workspaceId) {
  if (
    !object(data)
    || data.ok !== true
    || data.result !== 'preview'
    || data.contractVersion !== CONTRACT_VERSION
    || data.action !== action
    || data.operationId !== body.operationId
    || data.baseRevision !== body.baseRevision
    || !digest(data.requestHash)
    || !digest(data.previewDigest)
    || !timestamp(data.previewExpiresAt)
    || !object(data.normalizedPayload)
    || !object(data.readBack)
  ) return false
  const resolvedTaskId = action === 'create' ? data.normalizedPayload.taskId : taskId
  return nonEmptyString(resolvedTaskId)
    && data.readBack.id === resolvedTaskId
    && data.readBack.workspaceId === workspaceId
    && data.readBack.canonicalRevision === body.baseRevision
    && validLifecycleState(action, data.readBack)
}

async function executeTaskLifecycle(context, action, taskId, body, notifyTaskMutation) {
  if (context.signedUser === false) {
    return errorResult(401, 'signed_user_required', 'Canonical task lifecycle requires a signed-in user session')
  }
  const invalid = validateRequest(action, taskId, body)
  if (invalid) return invalid

  const preview = body.preview !== false
  const resolvedTaskId = action === 'create' ? (body.taskId || null) : taskId
  const payload = action === 'create' ? body.payload : {}
  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_task_lifecycle_v1', {
      p_action: action,
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: body.operationId,
      p_payload: payload,
      p_preview: preview,
      p_preview_digest: preview ? null : body.previewDigest,
      p_preview_expires_at: preview ? null : body.previewExpiresAt,
      p_request_hash: preview ? null : body.requestHash,
      p_source: SOURCE,
      p_task_id: resolvedTaskId,
      p_workspace_id: context.activeWorkspaceId,
    })
  } catch {
    return errorResult(500, 'canonical_task_lifecycle_failed', 'Task lifecycle change could not be committed')
  }
  const { data, error } = rpcResult || {}
  if (error || !object(data)) {
    return errorResult(500, 'canonical_task_lifecycle_failed', 'Task lifecycle change could not be committed')
  }
  if (data.ok !== true) {
    const code = object(data.error) && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }
  if (preview) {
    if (!validPreview(data, action, taskId, body, context.activeWorkspaceId)) {
      return errorResult(502, 'invalid_canonical_response', 'Canonical task lifecycle preview could not be verified')
    }
    return { status: 200, body: data }
  }

  const receipt = data.receipt
  const entityId = action === 'create' ? body.taskId : taskId
  const affectedAction = action === 'reopen' ? 'update' : action
  const primary = object(receipt) && Array.isArray(receipt.affected) && receipt.affected.length === 1
    ? receipt.affected[0]
    : null
  const validAffected = Boolean(
    primary
    && validateAffectedTaskEntry(primary, { entityId, action: affectedAction }).ok
    && primary.entityId === receipt.entityId
    && primary.canonicalRevision === receipt.canonicalRevision
    && primary.changeSequence === receipt.changeSequence
  )
  const validation = validateCanonicalReceipt(receipt, {
    bindPrimaryAffectedReadBack: true,
    expectedOperationId: body.operationId,
    expectedRequestHash: body.requestHash,
    expectedFields: {
      contractVersion: CONTRACT_VERSION,
      source: SOURCE,
      entityType: 'task',
      action,
      entityId,
    },
    validateReadBack: readBack => (
      validAffected
      && readBack.id === entityId
      && readBack.workspaceId === context.activeWorkspaceId
      && validLifecycleState(action, readBack)
    ),
  })
  if (
    data.result !== 'committed'
    || data.requestHash !== body.requestHash
    || !validation.ok
  ) {
    return errorResult(502, 'invalid_canonical_receipt', 'Canonical task lifecycle receipt could not be verified')
  }

  try {
    notifyTaskMutation(action === 'create' ? 'create' : action === 'delete' ? 'delete' : 'update', entityId)
  } catch {
    // Commit proof is durable; renderer reconciliation is best effort.
  }
  return { status: 200, body: data }
}

module.exports = { executeTaskLifecycle }
