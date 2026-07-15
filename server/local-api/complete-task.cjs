'use strict'

const CONTRACT_VERSION = 'task-v1'
const SOURCE = 'local-api'
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const ERROR_STATUS = {
  invalid_request: 400,
  not_authenticated: 401,
  not_found: 404,
  recurring_task: 409,
  already_completed: 409,
  stale_revision: 409,
  idempotency_conflict: 409,
  preview_mismatch: 409,
  preview_expired: 409,
}

const APPROVAL_REQUIRED = {
  ok: false,
  error: {
    code: 'approval_receipt_required',
    message: 'operationId, baseRevision, previewDigest, and previewExpiresAt are required for apply',
  },
}

function errorResult(status, code, message, extra = {}) {
  return { status, body: { ok: false, error: { code, message, ...extra } } }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function validPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0
}

function validTimestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function validDigest(value) {
  return typeof value === 'string' && SHA256_HEX_RE.test(value)
}

function validateRequest(taskId, body) {
  if (!nonEmptyString(taskId) || !body || typeof body !== 'object' || Array.isArray(body)) {
    return errorResult(400, 'invalid_request', 'The canonical task request is invalid')
  }
  if (body.preview !== undefined && typeof body.preview !== 'boolean') {
    return errorResult(400, 'invalid_request', 'preview must be a boolean')
  }

  const preview = body.preview !== false
  if (!preview && (
    !nonEmptyString(body.operationId)
    || !validPositiveInteger(body.baseRevision)
    || !nonEmptyString(body.previewDigest)
    || !validTimestamp(body.previewExpiresAt)
  )) {
    return { status: 400, body: APPROVAL_REQUIRED }
  }
  if (!nonEmptyString(body.operationId) || !validPositiveInteger(body.baseRevision)) {
    return errorResult(400, 'invalid_request', 'operationId and baseRevision are required')
  }
  return null
}

function validReadBack(readBack, taskId, canonicalRevision) {
  return Boolean(
    readBack
    && typeof readBack === 'object'
    && !Array.isArray(readBack)
    && readBack.id === taskId
    && readBack.canonicalRevision === canonicalRevision
  )
}

function validReceipt(receipt, taskId, operationId) {
  return Boolean(
    receipt
    && typeof receipt === 'object'
    && !Array.isArray(receipt)
    && receipt.contractVersion === CONTRACT_VERSION
    && receipt.operationId === operationId
    && receipt.source === SOURCE
    && receipt.entityType === 'task'
    && receipt.action === 'complete'
    && receipt.entityId === taskId
    && validPositiveInteger(receipt.canonicalRevision)
    && validTimestamp(receipt.canonicalUpdatedAt)
    && validPositiveInteger(receipt.changeSequence)
    && typeof receipt.replayed === 'boolean'
    && validTimestamp(receipt.committedAt)
    && validReadBack(receipt.readBack, taskId, receipt.canonicalRevision)
    && receipt.readBack.status === 'done'
    && validTimestamp(receipt.readBack.completedAt)
    && validDigest(receipt.readBackHash)
  )
}

function validPreview(data, taskId, operationId, baseRevision) {
  return Boolean(
    data
    && typeof data === 'object'
    && !Array.isArray(data)
    && data.ok === true
    && data.result === 'preview'
    && data.contractVersion === CONTRACT_VERSION
    && data.operationId === operationId
    && data.baseRevision === baseRevision
    && validDigest(data.previewDigest)
    && validTimestamp(data.previewExpiresAt)
    && data.normalizedPayload
    && typeof data.normalizedPayload === 'object'
    && data.willSetCompletedAt === true
    && validReadBack(data.readBack, taskId, baseRevision)
  )
}

async function executeCompleteTask(context, taskId, body, notifyTaskMutation) {
  if (context.signedUser === false) {
    return errorResult(401, 'signed_user_required', 'Canonical task completion requires a signed-in user session')
  }
  const invalid = validateRequest(taskId, body)
  if (invalid) return invalid

  const preview = body.preview !== false
  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_complete_task_v1', {
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: body.operationId,
      p_preview: preview,
      p_preview_digest: preview ? null : body.previewDigest,
      p_preview_expires_at: preview ? null : body.previewExpiresAt,
      p_source: SOURCE,
      p_task_id: taskId,
      p_workspace_id: context.activeWorkspaceId,
    })
  } catch {
    return errorResult(500, 'canonical_task_complete_failed', 'Task completion could not be committed')
  }
  const { data, error } = rpcResult || {}

  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return errorResult(500, 'canonical_task_complete_failed', 'Task completion could not be committed')
  }
  if (data.ok !== true) {
    const code = data.error && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }
  if (preview) {
    if (!validPreview(data, taskId, body.operationId, body.baseRevision)) {
      return errorResult(502, 'invalid_canonical_response', 'Canonical task response could not be verified')
    }
    return { status: 200, body: data }
  }
  if (data.result !== 'committed' || !validReceipt(data.receipt, taskId, body.operationId)) {
    return errorResult(502, 'invalid_canonical_receipt', 'Canonical task receipt could not be verified')
  }

  try {
    notifyTaskMutation('update', taskId)
  } catch {
    // The canonical commit is durable. Renderer reconciliation is best-effort
    // and must not turn a committed receipt into an apparent failed write.
  }
  return { status: 200, body: data }
}

module.exports = { executeCompleteTask }
