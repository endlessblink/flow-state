'use strict'

const { validateAffectedTaskEntry, validateCanonicalReceipt } = require('./canonical-receipt.cjs')

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const CONTRACT_VERSION = 'task-v1'
const SOURCE = 'local-api'
const APPLY_REQUIRED_ERROR = {
  error: {
    code: 'approval_receipt_required',
    message: 'requestId, previewVersion, and requestHash are required for apply',
  },
  ok: false,
}
const TRANSACTION_ERROR = {
  error: {
    code: 'recurrence_transaction_failed',
    message: 'Done for now could not be completed',
  },
  ok: false,
}

const ERROR_STATUS = {
  already_completed: 409,
  approval_receipt_required: 400,
  idempotency_conflict: 409,
  invalid_next_date: 400,
  invalid_request: 400,
  not_authenticated: 401,
  not_found: 404,
  not_recurring: 409,
  recurrence_calculation_failed: 422,
  recurrence_exhausted: 409,
  state_conflict: 409,
}

function invalidRequest(message) {
  return { status: 400, body: { error: { code: 'invalid_request', message }, ok: false } }
}

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
}

function validPreview(data, taskId, requestId) {
  return Boolean(
    object(data)
    && data.ok === true
    && data.result === 'preview'
    && data.preview === true
    && data.contractVersion === CONTRACT_VERSION
    && data.operationId === requestId
    && typeof data.requestHash === 'string'
    && SHA256_HEX_RE.test(data.requestHash)
    && typeof data.previewVersion === 'string'
    && data.previewVersion.length > 0
    && object(data.task)
    && data.task.id === taskId
  )
}

function validCommittedResponse(data, taskId, body) {
  if (
    !object(data)
    || data.ok !== true
    || data.result !== 'committed'
    || data.requestHash !== body.requestHash
    || !object(data.receipt)
  ) return false

  const receipt = data.receipt
  const readBack = receipt.readBack
  const completedId = object(readBack) && object(readBack.completedOccurrence)
    ? readBack.completedOccurrence.id
    : null
  const living = Array.isArray(receipt.affected) ? receipt.affected[0] : null
  const completed = Array.isArray(receipt.affected) ? receipt.affected[1] : null
  const exactAffected = Boolean(
    Array.isArray(receipt.affected)
    && receipt.affected.length === 2
    && typeof completedId === 'string'
    && completedId !== taskId
    && validateAffectedTaskEntry(living, { entityId: taskId, action: 'update' }).ok
    && validateAffectedTaskEntry(completed, { entityId: completedId, action: 'create' }).ok
  )
  const validation = validateCanonicalReceipt(receipt, {
    bindPrimaryAffectedReadBack: true,
    expectedOperationId: body.requestId,
    expectedRequestHash: body.requestHash,
    expectedFields: {
      contractVersion: CONTRACT_VERSION,
      source: SOURCE,
      entityType: 'task',
      action: 'done_for_now',
      entityId: taskId,
    },
    validateReadBack: value => Boolean(
      exactAffected
      && value.id === taskId
      && value.canonicalRevision === receipt.canonicalRevision
      && value.canonicalRevision === living.canonicalRevision
      && value.canonicalUpdatedAt === receipt.canonicalUpdatedAt
      && receipt.changeSequence === living.changeSequence
      && object(value.completedOccurrence)
      && value.completedOccurrence.id === completed.entityId
      && value.completedOccurrence.status === 'done'
      && validTimestamp(value.completedOccurrence.completedAt)
      && completed.readBack.status === value.completedOccurrence.status
      && completed.readBack.completedAt === value.completedOccurrence.completedAt
      && object(value.nextOccurrence)
      && value.nextOccurrence.taskId === taskId
      && value.nextOccurrence.status === 'todo'
      && DATE_ONLY_RE.test(value.nextOccurrence.dueDate || '')
    ),
  })
  return validation.ok
}

async function executeDoneForNow(context, taskId, body, notifyTaskMutation) {
  if (!object(body)) return invalidRequest('request body is required')
  const preview = body.preview !== false
  const requestId = typeof body.requestId === 'string' ? body.requestId : ''
  const previewVersion = typeof body.previewVersion === 'string' ? body.previewVersion.trim() : ''
  const requestHash = typeof body.requestHash === 'string' ? body.requestHash : ''
  const nextDueDate = body.nextDueDate == null ? null : body.nextDueDate

  if (!taskId || typeof taskId !== 'string') return invalidRequest('exact task id required')
  if (nextDueDate !== null && (typeof nextDueDate !== 'string' || !DATE_ONLY_RE.test(nextDueDate))) {
    return invalidRequest('nextDueDate must use YYYY-MM-DD format')
  }
  if (!requestId || requestId !== requestId.trim()) {
    if (!preview) return { status: 400, body: APPLY_REQUIRED_ERROR }
    return invalidRequest('requestId is required')
  }
  if (!preview && (!previewVersion || !SHA256_HEX_RE.test(requestHash))) {
    return { status: 400, body: APPLY_REQUIRED_ERROR }
  }

  const { data, error } = await context.supabase.rpc('flowstate_done_for_now', {
    p_next_due_date: nextDueDate,
    p_preview: preview,
    p_preview_version: previewVersion || null,
    p_request_hash: preview ? null : requestHash,
    p_request_id: requestId || null,
    p_task_id: taskId,
    p_workspace_id: context.activeWorkspaceId,
  })

  if (error || !data || typeof data !== 'object') {
    return { status: 500, body: TRANSACTION_ERROR }
  }

  if (data.ok !== true) {
    const code = data.error && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }

  if (preview) {
    if (!validPreview(data, taskId, requestId)) {
      return {
        status: 502,
        body: { ok: false, error: { code: 'invalid_canonical_response', message: 'Done for now preview could not be verified' } },
      }
    }
    return { status: 200, body: data }
  }

  if (!validCommittedResponse(data, taskId, body)) {
    return {
      status: 502,
      body: { ok: false, error: { code: 'invalid_canonical_receipt', message: 'Done for now receipt could not be verified' } },
    }
  }
  try {
    notifyTaskMutation('create', data.receipt.readBack.completedOccurrence.id)
    notifyTaskMutation('update', taskId)
  } catch {
    // Canonical success is durable; renderer reconciliation is best-effort.
  }

  return { status: 200, body: data }
}

module.exports = { executeDoneForNow }
