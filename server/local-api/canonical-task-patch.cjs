'use strict'

const { validateAffectedTaskEntry, validateCanonicalReceipt } = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'task-v1'
const SOURCE = 'local-api'
const ALLOWED_PATCH_FIELDS = new Set([
  'title',
  'description',
  'priority',
  'dueDate',
  'dueTime',
  'estimatedDuration',
  'projectId',
  'progress',
])
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const TIME_ONLY_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const ERROR_STATUS = {
  invalid_request: 400,
  unsupported_patch: 400,
  invalid_title: 400,
  invalid_description: 400,
  invalid_priority: 400,
  invalid_due_date: 400,
  invalid_due_time: 400,
  invalid_estimated_duration: 400,
  invalid_project_id: 400,
  invalid_progress: 400,
  not_authenticated: 401,
  not_found: 404,
  stale_revision: 409,
  idempotency_conflict: 409,
  preview_mismatch: 409,
  preview_expired: 409,
}

const APPROVAL_REQUIRED = {
  ok: false,
  error: {
    code: 'approval_receipt_required',
    message: 'operationId, baseRevision, previewDigest, previewExpiresAt, and requestHash are required for apply',
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

  const patch = body.patch
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0) {
    return errorResult(400, 'invalid_request', 'patch must be a non-empty object')
  }
  const unsupported = Object.keys(patch).filter((key) => !ALLOWED_PATCH_FIELDS.has(key)).sort()
  if (unsupported.length > 0) {
    return errorResult(400, 'unsupported_patch', 'The patch contains unsupported task fields', {
      fields: unsupported,
    })
  }

  if (patch.dueTime !== undefined
    && !(patch.dueTime === null || (typeof patch.dueTime === 'string' && TIME_ONLY_RE.test(patch.dueTime)))) {
    return errorResult(400, 'invalid_due_time', 'dueTime must be HH:MM or null')
  }
  if (patch.estimatedDuration !== undefined
    && !(patch.estimatedDuration === null
      || (Number.isSafeInteger(patch.estimatedDuration) && patch.estimatedDuration >= 0))) {
    return errorResult(400, 'invalid_estimated_duration', 'estimatedDuration must be a non-negative integer or null')
  }
  if (patch.projectId !== undefined
    && !(patch.projectId === null || nonEmptyString(patch.projectId))) {
    return errorResult(400, 'invalid_project_id', 'projectId must be a non-empty string or null')
  }

  const preview = body.preview !== false
  if (!preview && (
    !nonEmptyString(body.operationId)
    || !validPositiveInteger(body.baseRevision)
    || !nonEmptyString(body.previewDigest)
    || !validTimestamp(body.previewExpiresAt)
    || !validDigest(body.requestHash)
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
    && validDigest(data.requestHash)
    && validDigest(data.previewDigest)
    && validTimestamp(data.previewExpiresAt)
    && data.normalizedPayload
    && typeof data.normalizedPayload === 'object'
    && validReadBack(data.readBack, taskId, baseRevision)
  )
}

async function executeCanonicalTaskPatch(context, taskId, body, notifyTaskMutation) {
  if (context.signedUser === false) {
    return errorResult(401, 'signed_user_required', 'Canonical task patches require a signed-in user session')
  }
  const invalid = validateRequest(taskId, body)
  if (invalid) return invalid

  const preview = body.preview !== false
  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_patch_task_v1', {
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: body.operationId,
      p_patch: body.patch,
      p_preview: preview,
      p_preview_digest: preview ? null : body.previewDigest,
      p_preview_expires_at: preview ? null : body.previewExpiresAt,
      p_request_hash: preview ? null : body.requestHash,
      p_source: SOURCE,
      p_task_id: taskId,
      p_workspace_id: context.activeWorkspaceId,
    })
  } catch {
    return errorResult(500, 'canonical_task_patch_failed', 'Task patch could not be completed')
  }
  const { data, error } = rpcResult || {}

  if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
    return errorResult(500, 'canonical_task_patch_failed', 'Task patch could not be completed')
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
  const receipt = data.receipt
  const primaryAffected = receipt && Array.isArray(receipt.affected) && receipt.affected.length === 1
    ? receipt.affected[0]
    : null
  const validPrimaryAffected = Boolean(
    primaryAffected
    && validateAffectedTaskEntry(primaryAffected, { entityId: taskId, action: 'update' }).ok
    && primaryAffected.entityId === receipt.entityId
    && primaryAffected.canonicalRevision === receipt.canonicalRevision
    && primaryAffected.changeSequence === receipt.changeSequence
    && receipt.readBack
    && typeof receipt.readBack === 'object'
    && !Array.isArray(receipt.readBack)
    && primaryAffected.readBack.id === receipt.readBack.id
    && primaryAffected.readBack.canonicalRevision === receipt.readBack.canonicalRevision
  )
  const validation = validateCanonicalReceipt(receipt, {
    bindPrimaryAffectedReadBack: true,
    expectedOperationId: body.operationId,
    expectedRequestHash: body.requestHash,
    expectedFields: {
      contractVersion: CONTRACT_VERSION,
      source: SOURCE,
      entityType: 'task',
      action: 'patch',
      entityId: taskId,
    },
    validateReadBack: readBack => (
      validPrimaryAffected
      && validReadBack(readBack, taskId, receipt && receipt.canonicalRevision)
      && validTimestamp(receipt && receipt.canonicalUpdatedAt)
      && readBack.canonicalUpdatedAt === receipt.canonicalUpdatedAt
    ),
  })
  if (data.result !== 'committed' || data.requestHash !== body.requestHash || !validation.ok) {
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

module.exports = { executeCanonicalTaskPatch }
