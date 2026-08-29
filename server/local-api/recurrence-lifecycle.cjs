'use strict'

const CONTRACT_VERSION = 'recurrence-lifecycle-v1'
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const PATTERNS = new Set(['daily', 'weekly', 'monthly', 'yearly'])
const SHA256_HEX_RE = /^[0-9a-f]{64}$/

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function validateDate(value) {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) {
    throw new TypeError('dates must use YYYY-MM-DD format')
  }
}

function validateRule(rule) {
  if (!object(rule) || !PATTERNS.has(rule.pattern)) {
    throw new TypeError('recurrenceRule must use a supported pattern')
  }
  if (!Number.isSafeInteger(rule.interval) || rule.interval < 1) {
    throw new TypeError('recurrenceRule interval must be a positive integer')
  }
  if (rule.pattern === 'weekly' && (!Array.isArray(rule.weekdays) || rule.weekdays.length === 0
    || rule.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6))) {
    throw new TypeError('weekly recurrenceRule must contain valid weekdays')
  }
  if (!['never', 'after_count', 'on_date'].includes(rule.endType)) {
    throw new TypeError('recurrenceRule endType is invalid')
  }
  if (rule.endType === 'after_count' && (!Number.isSafeInteger(rule.endCount) || rule.endCount < 1)) {
    throw new TypeError('recurrenceRule endCount must be a positive integer')
  }
  if (rule.endType === 'on_date') validateDate(rule.endDate)
}

function planRecurrenceLifecycle({ definition, occurrences, action, recurrenceRule, nextDueDate }) {
  if (!object(definition) || typeof definition.id !== 'string') throw new TypeError('recurrence definition is required')
  if (!['set_cadence', 'pause', 'resume', 'end'].includes(action)) {
    throw new TypeError('unsupported lifecycle action')
  }
  const sourceRule = object(definition.recurrence_rule) ? clone(definition.recurrence_rule) : null
  validateRule(sourceRule)
  validateDate(definition.due_date)

  const current = (Array.isArray(occurrences) ? occurrences : []).filter(value => object(value) && value.dueDate === definition.due_date)
  if (current.length !== 1) throw new Error('ambiguous current occurrence')

  let proposedRule = clone(sourceRule)
  if (action === 'set_cadence') {
    proposedRule = clone(recurrenceRule)
    validateRule(proposedRule)
  } else if (action === 'pause') {
    proposedRule.paused = true
  } else if (action === 'resume') {
    proposedRule.paused = false
  } else {
    proposedRule.endType = 'on_date'
    proposedRule.endDate = definition.due_date
  }

  const proposedDate = nextDueDate == null ? definition.due_date : nextDueDate
  validateDate(proposedDate)
  if (action === 'set_cadence' && proposedDate <= definition.due_date) {
    throw new RangeError('nextDueDate must be later than the current occurrence')
  }

  return {
    ok: true,
    result: 'preview',
    contractVersion: CONTRACT_VERSION,
    action,
    taskId: definition.id,
    baseRevision: definition.canonical_revision,
    currentOccurrence: {
      id: current[0].id,
      dueDate: current[0].dueDate,
      status: current[0].status || 'todo',
    },
    proposedDefinition: {
      recurrenceRule: proposedRule,
      dueDate: proposedDate,
    },
    historyDisposition: 'preserve',
    occurrenceDisposition: action === 'end'
      ? 'close-future-only'
      : action === 'pause'
        ? 'retain-future-paused'
        : action === 'resume'
          ? 'restore-future'
          : 'replace-future-only',
  }
}

async function executeRecurrenceLifecycle(context, taskId, body, notifyTaskMutation) {
  if (!object(body) || typeof body.action !== 'string') {
    return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: 'action is required' } } }
  }
  const preview = body.preview !== false
  const requestId = typeof body.requestId === 'string' ? body.requestId : ''
  const previewVersion = typeof body.previewVersion === 'string' ? body.previewVersion : ''
  const requestHash = typeof body.requestHash === 'string' ? body.requestHash : ''
  if (!requestId || requestId !== requestId.trim()) {
    return { status: 400, body: { ok: false, error: { code: 'invalid_request', message: 'requestId is required' } } }
  }
  if (!preview && (!previewVersion || !SHA256_HEX_RE.test(requestHash))) {
    return { status: 400, body: { ok: false, error: { code: 'approval_receipt_required', message: 'requestId, previewVersion, and requestHash are required for apply' } } }
  }

  const { data, error } = await context.supabase.rpc('flowstate_edit_recurrence', {
    p_action: body.action,
    p_next_due_date: body.nextDueDate == null ? null : body.nextDueDate,
    p_preview: preview,
    p_preview_version: previewVersion || null,
    p_request_hash: preview ? null : requestHash,
    p_request_id: requestId,
    p_recurrence_rule: body.recurrenceRule || null,
    p_task_id: taskId,
    p_workspace_id: context.activeWorkspaceId || null,
  })
  if (error || !object(data)) return { status: 500, body: { ok: false, error: { code: 'recurrence_transaction_failed', message: 'Recurrence lifecycle operation failed' } } }
  if (data.ok !== true) {
    const status = { approval_receipt_required: 400, invalid_request: 400, not_authenticated: 401, not_found: 404, not_recurring: 409, state_conflict: 409, idempotency_conflict: 409 }[data.error?.code] || 500
    return { status, body: data }
  }
  if (preview && (data.result !== 'preview' || data.contractVersion !== CONTRACT_VERSION || data.operationId !== requestId)) {
    return { status: 502, body: { ok: false, error: { code: 'invalid_canonical_response', message: 'Recurrence preview could not be verified' } } }
  }
  if (!preview && (data.result !== 'committed' || data.contractVersion !== CONTRACT_VERSION || data.taskId !== taskId || data.requestHash !== requestHash || !object(data.receipt))) {
    return { status: 502, body: { ok: false, error: { code: 'invalid_canonical_receipt', message: 'Recurrence receipt could not be verified' } } }
  }
  if (!preview) {
    try { notifyTaskMutation('update', taskId) } catch { /* durable operation already succeeded */ }
  }
  return { status: 200, body: data }
}

module.exports = { executeRecurrenceLifecycle, planRecurrenceLifecycle }
