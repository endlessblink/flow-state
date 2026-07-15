'use strict'

const {
  canonicalHash,
  canonicalJson,
  validateAffectedTaskEntry,
  validateCanonicalReceipt,
} = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'task-v1'
const SOURCE = 'local-api'
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const OFFSET_TIMESTAMP_RE = /(?:Z|[+-]\d{2}:\d{2})$/
const ACTIONS = new Set(['edit_future', 'pause', 'resume', 'end_series'])
const ERROR_STATUS = {
  approval_receipt_required: 400,
  invalid_request: 400,
  invalid_recurrence_rule: 400,
  invalid_next_date: 400,
  not_authenticated: 401,
  signed_user_required: 401,
  scope_denied: 403,
  not_found: 404,
  recurrence_not_found: 404,
  ambiguous_current_occurrence: 409,
  ambiguous_history: 409,
  stale_revision: 409,
  idempotency_conflict: 409,
  request_hash_required: 409,
  request_hash_mismatch: 409,
  preview_mismatch: 409,
  preview_expired: 409,
  already_paused: 409,
  not_paused: 409,
  series_ended: 409,
  recurrence_exhausted: 409,
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
  return nonEmptyString(value)
    && value.includes('T')
    && OFFSET_TIMESTAMP_RE.test(value)
    && Number.isFinite(Date.parse(value))
}

function dateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function timeZone(value) {
  if (!nonEmptyString(value) || value.length > 120) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function errorResult(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } }
}

function sameJson(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right)
  } catch {
    return false
  }
}

function normalizeRule(value) {
  if (!object(value)) return null
  const allowed = new Set(['pattern', 'interval', 'weekdays', 'monthDay', 'monthWeekday', 'endType', 'endDate', 'endCount'])
  if (Object.keys(value).some(key => !allowed.has(key))) return null
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(value.pattern)) return null
  if (!positiveInteger(value.interval) || value.interval > 999) return null
  if (!['never', 'after_count', 'on_date'].includes(value.endType)) return null

  const normalized = { pattern: value.pattern, interval: value.interval }
  if (value.pattern === 'weekly') {
    if (value.weekdays !== undefined) {
      if (!Array.isArray(value.weekdays) || value.weekdays.length < 1) return null
      const weekdays = [...new Set(value.weekdays)]
      if (weekdays.length !== value.weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) return null
      normalized.weekdays = weekdays.sort((left, right) => left - right)
    }
  } else if (value.weekdays !== undefined) return null

  if (value.pattern === 'monthly') {
    const hasMonthDay = Number.isInteger(value.monthDay) && value.monthDay >= 1 && value.monthDay <= 31
    const hasWeekday = object(value.monthWeekday)
      && Number.isInteger(value.monthWeekday.nth) && (value.monthWeekday.nth === -1 || (value.monthWeekday.nth >= 1 && value.monthWeekday.nth <= 5))
      && Number.isInteger(value.monthWeekday.day) && value.monthWeekday.day >= 0 && value.monthWeekday.day <= 6
    if ((value.monthDay !== undefined && !hasMonthDay)
      || (value.monthWeekday !== undefined && !hasWeekday)
      || (hasMonthDay && hasWeekday)) return null
    if (hasMonthDay) normalized.monthDay = value.monthDay
    else if (hasWeekday) normalized.monthWeekday = { nth: value.monthWeekday.nth, day: value.monthWeekday.day }
  } else if (value.monthDay !== undefined || value.monthWeekday !== undefined) return null

  normalized.endType = value.endType
  if (value.endType === 'on_date') {
    if (!dateOnly(value.endDate)) return null
    normalized.endDate = value.endDate
    if (value.endCount !== undefined) return null
  } else if (value.endType === 'after_count') {
    if (!positiveInteger(value.endCount)) return null
    normalized.endCount = value.endCount
    if (value.endDate !== undefined) return null
  } else if (value.endDate !== undefined || value.endCount !== undefined) return null
  return normalized
}

function validOccurrence(value, { history = false } = {}) {
  return object(value)
    && nonEmptyString(value.id)
    && Number.isSafeInteger(value.recurrenceCount)
    && value.recurrenceCount >= 0
    && dateOnly(value.dueDate)
    && positiveInteger(value.canonicalRevision)
    && timestamp(value.canonicalUpdatedAt)
    && (!history || (value.status === 'done' && timestamp(value.completedAt)))
}

function validChainProjection(value, expected = {}) {
  if (!object(value) || value.ok !== true || value.fresh !== true
    || value.contractVersion !== CONTRACT_VERSION || !nonEmptyString(value.seriesId)
    || !['active', 'paused', 'ended'].includes(value.lifecycleStatus)
    || !positiveInteger(value.seriesRevision) || value.id !== value.seriesId
    || value.canonicalRevision !== value.seriesRevision
    || !timestamp(value.canonicalUpdatedAt) || !Array.isArray(value.history)) return false
  if (expected.seriesId && value.seriesId !== expected.seriesId) return false
  if (Object.prototype.hasOwnProperty.call(expected, 'workspaceId') && value.workspaceId !== expected.workspaceId) return false
  if (!value.history.every(item => validOccurrence(item, { history: true }))) return false
  const historyIds = new Set(value.history.map(item => item.id))
  const historyCounts = new Set(value.history.map(item => item.recurrenceCount))
  const historyDates = new Set(value.history.map(item => item.dueDate))
  if (historyIds.size !== value.history.length || historyCounts.size !== value.history.length
    || historyDates.size !== value.history.length) return false
  if (value.currentOccurrence !== null && !validOccurrence(value.currentOccurrence)) return false
  if (value.lifecycleStatus !== 'ended' && !value.currentOccurrence) return false
  if (value.currentOccurrence
    && (value.currentOccurrence.canonicalRevision !== value.canonicalRevision
      || value.currentOccurrence.canonicalUpdatedAt !== value.canonicalUpdatedAt)) return false
  if (value.currentOccurrence && historyIds.has(value.currentOccurrence.id)) return false
  if (value.currentOccurrence && historyCounts.has(value.currentOccurrence.recurrenceCount)) return false
  if (expected.requestedTaskId) {
    const requestedIsMember = value.seriesId === expected.requestedTaskId
      || value.currentOccurrence?.id === expected.requestedTaskId
      || historyIds.has(expected.requestedTaskId)
    if (!requestedIsMember) return false
  }
  if (value.definition !== null && !normalizeRule(value.definition)) return false
  if (value.lifecycleStatus === 'active' && !object(value.definition)) return false
  if (value.nextOccurrence !== null && (!object(value.nextOccurrence)
    || !dateOnly(value.nextOccurrence.dueDate)
    || !Number.isSafeInteger(value.nextOccurrence.recurrenceCount)
    || (value.currentOccurrence && value.nextOccurrence.recurrenceCount <= value.currentOccurrence.recurrenceCount))) return false
  return true
}

function ambiguityResult(data) {
  const code = object(data?.ambiguity) && typeof data.ambiguity.code === 'string'
    ? data.ambiguity.code
    : object(data?.error) && typeof data.error.code === 'string' ? data.error.code : ''
  if (!['ambiguous_current_occurrence', 'ambiguous_history'].includes(code)) return null
  return errorResult(409, code, code === 'ambiguous_history'
    ? 'Recurrence history is ambiguous and cannot be used as authority'
    : 'The current recurrence occurrence is ambiguous')
}

async function readRecurrenceChain(context, taskId) {
  if (!context?.signedUser) {
    return errorResult(401, 'signed_user_required', 'Recurrence chain reads require a signed-in user session')
  }
  if (!nonEmptyString(taskId)) return errorResult(400, 'invalid_request', 'Exact task identity is required')
  let result
  try {
    result = await context.supabase.rpc('flowstate_recurrence_chain_v1', {
      p_contract_version: CONTRACT_VERSION,
      p_task_id: taskId,
      p_workspace_id: context.activeWorkspaceId,
    })
  } catch {
    return errorResult(500, 'recurrence_chain_read_failed', 'Recurrence chain could not be read')
  }
  if (result?.error || !object(result?.data)) {
    return errorResult(500, 'recurrence_chain_read_failed', 'Recurrence chain could not be read')
  }
  const ambiguity = ambiguityResult(result.data)
  if (ambiguity) return ambiguity
  if (result.data.ok !== true) {
    const code = object(result.data.error) ? result.data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: result.data }
  }
  if (!validChainProjection(result.data, { requestedTaskId: taskId, workspaceId: context.activeWorkspaceId })) {
    return errorResult(502, 'invalid_canonical_response', 'Canonical recurrence chain could not be verified')
  }
  return { status: 200, body: result.data }
}

function validateRequest(body) {
  if (!object(body) || !nonEmptyString(body.operationId) || body.operationId.length > 160
    || !nonEmptyString(body.taskId) || !ACTIONS.has(body.action)
    || !positiveInteger(body.baseRevision) || !timeZone(body.timeZone)
    || (body.preview !== undefined && typeof body.preview !== 'boolean')) {
    return { error: errorResult(400, 'invalid_request', 'The recurrence lifecycle request is invalid') }
  }
  const preview = body.preview !== false
  if (!preview && (!digest(body.previewDigest) || !timestamp(body.previewExpiresAt) || !digest(body.requestHash))) {
    return { error: errorResult(400, 'approval_receipt_required', 'previewDigest, previewExpiresAt, and requestHash are required for apply') }
  }
  let recurrenceRule = null
  if (body.action === 'edit_future') {
    recurrenceRule = normalizeRule(body.recurrenceRule)
    if (!recurrenceRule) return { error: errorResult(400, 'invalid_recurrence_rule', 'A valid future recurrence definition is required') }
  } else if (body.recurrenceRule !== undefined || body.nextDueDate !== undefined) {
    return { error: errorResult(400, 'invalid_request', 'Only edit_future accepts a recurrence definition or next date') }
  }
  const nextDueDate = body.nextDueDate ?? null
  if (nextDueDate !== null && !dateOnly(nextDueDate)) {
    return { error: errorResult(400, 'invalid_next_date', 'nextDueDate must be a real YYYY-MM-DD date') }
  }
  return { preview, recurrenceRule, nextDueDate }
}

function validPreview(data, request, body, workspaceId) {
  const expectedAction = `recurrence_${body.action}`
  return object(data) && data.ok === true && data.result === 'preview' && data.preview === true
    && data.contractVersion === CONTRACT_VERSION && data.action === expectedAction
    && data.operationId === body.operationId && data.seriesId === data.readBack?.seriesId
    && data.workspaceId === workspaceId && data.baseRevision === body.baseRevision
    && digest(data.requestHash) && digest(data.previewDigest) && timestamp(data.previewExpiresAt)
    && object(data.normalizedPayload) && data.normalizedPayload.action === body.action
    && sameJson(data.normalizedPayload.recurrenceRule ?? null, request.recurrenceRule)
    && (data.normalizedPayload.nextDueDate ?? null) === request.nextDueDate
    && validChainProjection(data.readBack, { requestedTaskId: body.taskId, workspaceId })
}

function validCommit(data, body, workspaceId) {
  if (!object(data) || data.ok !== true || data.result !== 'committed'
    || data.action !== `recurrence_${body.action}` || data.operationId !== body.operationId
    || data.requestHash !== body.requestHash || !object(data.receipt)) return false
  const receipt = data.receipt
  const affected = Array.isArray(receipt.affected) ? receipt.affected[0] : null
  const mutatedTaskId = object(receipt.readBack) && object(receipt.readBack.currentOccurrence)
    ? receipt.readBack.currentOccurrence.id
    : null
  if (!nonEmptyString(mutatedTaskId)) return false
  const validation = validateCanonicalReceipt(receipt, {
    expectedOperationId: body.operationId,
    expectedRequestHash: body.requestHash,
    expectedFields: {
      contractVersion: CONTRACT_VERSION, source: SOURCE, entityType: 'task',
      action: `recurrence_${body.action}`, entityId: mutatedTaskId,
    },
    validateReadBack: value => Boolean(
      Array.isArray(receipt.affected) && receipt.affected.length === 1
      && validateAffectedTaskEntry(affected, { entityId: mutatedTaskId, action: 'update' }).ok
      && object(receipt.operationContext)
      && receipt.operationContext.seriesId === value.seriesId
      && receipt.operationContext.requestedTaskId === body.taskId
      && receipt.operationContext.currentTaskId === mutatedTaskId
      && validChainProjection(value, { requestedTaskId: body.taskId, workspaceId })
      && value.seriesRevision === receipt.canonicalRevision
    ),
  })
  return validation.ok
    && typeof receipt.replayed === 'boolean'
    && receipt.replayed === (receipt.status === 'replayed')
    && canonicalHash(receipt.readBack) === receipt.readBackHash
}

async function executeRecurrenceLifecycle(context, body, notifyTaskMutation) {
  if (!context?.signedUser) {
    return errorResult(401, 'signed_user_required', 'Recurrence lifecycle changes require a signed-in user session')
  }
  const request = validateRequest(body)
  if (request.error) return request.error
  let result
  try {
    result = await context.supabase.rpc('flowstate_recurrence_lifecycle_v1', {
      p_action: body.action,
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_next_due_date: request.nextDueDate,
      p_operation_id: body.operationId,
      p_preview: request.preview,
      p_preview_digest: request.preview ? null : body.previewDigest,
      p_preview_expires_at: request.preview ? null : body.previewExpiresAt,
      p_recurrence_rule: request.recurrenceRule,
      p_request_hash: request.preview ? null : body.requestHash,
      p_source: SOURCE,
      p_task_id: body.taskId,
      p_time_zone: body.timeZone,
      p_workspace_id: context.activeWorkspaceId,
    })
  } catch {
    return errorResult(500, 'recurrence_lifecycle_failed', 'Recurrence lifecycle change could not be committed')
  }
  if (result?.error || !object(result?.data)) {
    return errorResult(500, 'recurrence_lifecycle_failed', 'Recurrence lifecycle change could not be committed')
  }
  const data = result.data
  const ambiguity = ambiguityResult(data)
  if (ambiguity) return ambiguity
  if (data.ok !== true) {
    const code = object(data.error) && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }
  if (request.preview) {
    if (!validPreview(data, request, body, context.activeWorkspaceId)) {
      return errorResult(502, 'invalid_canonical_response', 'Canonical recurrence preview could not be verified')
    }
    return { status: 200, body: data }
  }
  if (!validCommit(data, body, context.activeWorkspaceId)) {
    return errorResult(502, 'invalid_canonical_response', 'Canonical recurrence receipt could not be verified')
  }
  if (!data.receipt.replayed) {
    try {
      notifyTaskMutation('update', data.receipt.entityId)
    } catch {
      // The canonical commit is durable; renderer reconciliation is best effort.
    }
  }
  return { status: 200, body: data }
}

module.exports = {
  executeRecurrenceLifecycle,
  normalizeRule,
  readRecurrenceChain,
  validChainProjection,
}
