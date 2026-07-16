'use strict'

const {
  canonicalJson,
  validateAffectedTaskEntry,
  validateCanonicalReceipt,
} = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'task-v1'
const SOURCE = 'local-api'
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const ERROR_STATUS = {
  invalid_request: 400,
  invalid_operation: 400,
  invalid_operations: 400,
  approval_receipt_required: 400,
  not_authenticated: 401,
  scope_denied: 403,
  not_found: 404,
  subtask_not_found: 404,
  stale_revision: 409,
  invalid_existing_subtasks: 409,
  idempotency_conflict: 409,
  request_hash_required: 409,
  request_hash_mismatch: 409,
  preview_mismatch: 409,
  preview_expired: 409,
  client_id_conflict: 409,
  subtask_id_conflict: 409,
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

function digest(value) {
  return typeof value === 'string' && SHA256_HEX_RE.test(value)
}

function timestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function errorResult(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } }
}

function normalizeOperation(value) {
  if (!object(value)) return null
  const kind = value.kind || value.action
  if (!['create', 'update', 'delete'].includes(kind)) return null
  const allowed = kind === 'create'
    ? new Set(['kind', 'action', 'clientId', 'title', 'description', 'doneEnough', 'estimateMinutes', 'completedPomodoros', 'canvasPosition', 'isCompleted', 'order'])
    : new Set(['kind', 'action', 'subtaskId', 'title', 'description', 'doneEnough', 'estimateMinutes', 'completedPomodoros', 'canvasPosition', 'isCompleted', 'order'])
  if (Object.keys(value).some(key => !allowed.has(key))) return null

  const normalized = { kind }
  if (kind === 'create') {
    if (!nonEmptyString(value.clientId) || !nonEmptyString(value.title)
      || value.title.length > 500) return null
    normalized.clientId = value.clientId
    normalized.title = value.title
  } else {
    if (!nonEmptyString(value.subtaskId)) return null
    normalized.subtaskId = value.subtaskId
  }
  if (kind === 'delete') return normalized

  if (value.title !== undefined) {
    if (!nonEmptyString(value.title) || value.title.length > 500) return null
    normalized.title = value.title
  }
  if (value.description !== undefined) {
    if (typeof value.description !== 'string' || value.description.length > 10000) return null
    normalized.description = value.description
  }
  if (value.doneEnough !== undefined) {
    if (value.doneEnough !== null
      && (typeof value.doneEnough !== 'string' || value.doneEnough.length > 2000)) return null
    normalized.doneEnough = value.doneEnough
  }
  if (value.estimateMinutes !== undefined) {
    if (value.estimateMinutes !== null
      && (!positiveInteger(value.estimateMinutes) || value.estimateMinutes > 1440)) return null
    normalized.estimateMinutes = value.estimateMinutes
  }
  if (value.completedPomodoros !== undefined) {
    if (!Number.isSafeInteger(value.completedPomodoros) || value.completedPomodoros < 0) return null
    normalized.completedPomodoros = value.completedPomodoros
  }
  if (value.canvasPosition !== undefined) {
    if (value.canvasPosition !== null && (
      !object(value.canvasPosition)
      || !Number.isFinite(value.canvasPosition.x)
      || !Number.isFinite(value.canvasPosition.y)
      || Object.keys(value.canvasPosition).some(key => !['x', 'y'].includes(key))
    )) return null
    normalized.canvasPosition = value.canvasPosition
  }
  if (value.isCompleted !== undefined) {
    if (typeof value.isCompleted !== 'boolean') return null
    normalized.isCompleted = value.isCompleted
  }
  if (value.order !== undefined) {
    if (!Number.isSafeInteger(value.order) || value.order < 0) return null
    normalized.order = value.order
  }
  if (kind === 'update' && Object.keys(normalized).length === 2) return null
  return normalized
}

function normalizedOperations(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null
  const operations = value.map(normalizeOperation)
  return operations.every(Boolean) ? operations : null
}

function validateRequest(taskId, body) {
  if (!nonEmptyString(taskId) || !object(body)) {
    return { error: errorResult(400, 'invalid_request', 'The canonical subtask request is invalid') }
  }
  const preview = body.preview !== false
  if (!preview && (!nonEmptyString(body.operationId) || !positiveInteger(body.baseRevision))) {
    return {
      error: errorResult(
        400,
        'approval_receipt_required',
        'operationId, baseRevision, previewDigest, previewExpiresAt, and requestHash are required for apply',
      ),
    }
  }
  const operations = normalizedOperations(body.operations)
  if (!operations) {
    return { error: errorResult(400, 'invalid_operations', 'Subtask operations are invalid') }
  }
  if (!nonEmptyString(body.operationId) || body.operationId.length > 160) {
    return { error: errorResult(400, 'invalid_request', 'The canonical subtask request is invalid') }
  }
  if (!positiveInteger(body.baseRevision)) {
    return { error: errorResult(400, 'invalid_request', 'A positive parent baseRevision is required') }
  }
  if (body.preview !== undefined && typeof body.preview !== 'boolean') {
    return { error: errorResult(400, 'invalid_request', 'preview must be a boolean') }
  }
  if (!preview && (
    !digest(body.previewDigest)
    || !timestamp(body.previewExpiresAt)
    || !digest(body.requestHash)
  )) {
    return {
      error: errorResult(
        400,
        'approval_receipt_required',
        'operationId, baseRevision, previewDigest, previewExpiresAt, and requestHash are required for apply',
      ),
    }
  }
  return { preview, operations }
}

function sameRequestedOperation(requested, returned) {
  if (!object(returned) || returned.kind !== requested.kind) return false
  const identity = requested.kind === 'create' ? 'clientId' : 'subtaskId'
  if (returned[identity] !== requested[identity]) return false
  for (const [key, value] of Object.entries(requested)) {
    if (returned[key] !== value) return false
  }
  return true
}

function validNormalizedPayload(data, taskId, operations) {
  const payload = data.normalizedPayload
  return object(payload)
    && payload.taskId === taskId
    && Array.isArray(payload.operations)
    && payload.operations.length === operations.length
    && operations.every((operation, index) => sameRequestedOperation(operation, payload.operations[index]))
}

function validTaskReadBack(readBack, taskId, workspaceId, revision) {
  return object(readBack)
    && readBack.id === taskId
    && readBack.workspaceId === workspaceId
    && readBack.canonicalRevision === revision
    && Array.isArray(readBack.subtasks)
}

function sameJson(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right)
  } catch {
    return false
  }
}

function operationsReflected(operations, subtasks) {
  return operations.every(operation => {
    if (operation.kind === 'delete') {
      return !subtasks.some(subtask => subtask.id === operation.subtaskId)
    }
    const identityKey = operation.kind === 'create' ? 'clientId' : 'id'
    const identity = operation.kind === 'create' ? operation.clientId : operation.subtaskId
    const index = subtasks.findIndex(subtask => subtask[identityKey] === identity)
    if (index < 0) return false
    const subtask = subtasks[index]
    const fields = [
      'title', 'description', 'doneEnough', 'estimateMinutes',
      'completedPomodoros', 'canvasPosition', 'isCompleted',
    ]
    if (fields.some(field => (
      Object.prototype.hasOwnProperty.call(operation, field)
      && (operation[field] === null ? subtask[field] != null : !sameJson(subtask[field], operation[field]))
    ))) return false
    return operation.order === undefined || operation.order === index
  })
}

async function executeSubtaskBatch(context, taskId, body, notifyTaskMutation) {
  if (context.signedUser === false) {
    return errorResult(401, 'signed_user_required', 'Canonical subtask changes require a signed-in user session')
  }
  const request = validateRequest(taskId, body)
  if (request.error) return request.error

  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_subtask_batch_v1', {
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: body.operationId,
      p_operations: request.operations,
      p_preview: request.preview,
      p_preview_digest: request.preview ? null : body.previewDigest,
      p_preview_expires_at: request.preview ? null : body.previewExpiresAt,
      p_request_hash: request.preview ? null : body.requestHash,
      p_source: SOURCE,
      p_task_id: taskId,
      p_workspace_id: context.activeWorkspaceId,
    })
  } catch {
    return errorResult(500, 'canonical_subtask_batch_failed', 'Subtask changes could not be committed')
  }
  const { data, error } = rpcResult || {}
  if (error || !object(data)) {
    return errorResult(500, 'canonical_subtask_batch_failed', 'Subtask changes could not be committed')
  }
  if (data.ok !== true) {
    const code = object(data.error) && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }

  if (request.preview) {
    if (
      data.result !== 'preview'
      || data.contractVersion !== CONTRACT_VERSION
      || data.action !== 'subtask_batch'
      || data.operationId !== body.operationId
      || data.baseRevision !== body.baseRevision
      || !digest(data.requestHash)
      || !digest(data.previewDigest)
      || !timestamp(data.previewExpiresAt)
      || !validNormalizedPayload(data, taskId, request.operations)
      || !validTaskReadBack(data.readBack, taskId, context.activeWorkspaceId, body.baseRevision)
    ) {
      return errorResult(502, 'invalid_canonical_response', 'Canonical subtask preview could not be verified')
    }
    return { status: 200, body: data }
  }

  const receipt = data.receipt
  const primary = object(receipt) && Array.isArray(receipt.affected) && receipt.affected.length === 1
    ? receipt.affected[0]
    : null
  const validAffected = Boolean(
    primary
    && validateAffectedTaskEntry(primary, { entityId: taskId, action: 'update' }).ok
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
      action: 'subtask_batch',
      entityId: taskId,
    },
    validateReadBack: readBack => (
      validAffected
      && validTaskReadBack(readBack, taskId, context.activeWorkspaceId, receipt.canonicalRevision)
      && operationsReflected(request.operations, readBack.subtasks)
    ),
  })
  if (
    data.result !== 'committed'
    || data.operationId !== body.operationId
    || data.requestHash !== body.requestHash
    || !validation.ok
  ) {
    return errorResult(502, 'invalid_canonical_response', 'Canonical subtask receipt could not be verified')
  }

  if (receipt.status === 'committed') {
    try {
      notifyTaskMutation('update', taskId)
    } catch {
      // The canonical commit is durable; renderer reconciliation remains best effort.
    }
  }
  return { status: 200, body: data }
}

module.exports = { executeSubtaskBatch, normalizeOperation }
