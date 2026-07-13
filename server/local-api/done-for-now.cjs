'use strict'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const APPLY_REQUIRED_ERROR = {
  error: {
    code: 'approval_receipt_required',
    message: 'requestId and previewVersion are required for apply',
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

async function executeDoneForNow(context, taskId, body, notifyTaskMutation) {
  const preview = body.preview !== false
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
  const previewVersion = typeof body.previewVersion === 'string' ? body.previewVersion.trim() : ''
  const nextDueDate = body.nextDueDate == null ? null : body.nextDueDate

  if (!taskId || typeof taskId !== 'string') return invalidRequest('exact task id required')
  if (nextDueDate !== null && (typeof nextDueDate !== 'string' || !DATE_ONLY_RE.test(nextDueDate))) {
    return invalidRequest('nextDueDate must use YYYY-MM-DD format')
  }
  if (!preview && (!requestId || !previewVersion)) {
    return { status: 400, body: APPLY_REQUIRED_ERROR }
  }

  const { data, error } = await context.supabase.rpc('flowstate_done_for_now', {
    p_next_due_date: nextDueDate,
    p_preview: preview,
    p_preview_version: previewVersion || null,
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

  if (!preview) {
    const completedId = data.completedOccurrence && data.completedOccurrence.id
    const livingTaskId = typeof data.taskId === 'string' ? data.taskId : taskId
    if (typeof completedId === 'string') notifyTaskMutation('create', completedId)
    notifyTaskMutation('update', livingTaskId)
  }

  return { status: 200, body: data }
}

module.exports = { executeDoneForNow }
