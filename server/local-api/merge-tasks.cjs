'use strict'

const ERROR_STATUS = {
  approval_receipt_required: 400,
  idempotency_conflict: 409,
  incompatible_attachments: 409,
  incompatible_canvas: 409,
  incompatible_completion_history: 409,
  incompatible_dependencies: 409,
  incompatible_assistant_memory: 409,
  incompatible_active_timer: 409,
  incompatible_notifications: 409,
  incompatible_instances: 409,
  incompatible_parent: 409,
  incompatible_project: 409,
  incompatible_recurrence: 409,
  incompatible_schedule: 409,
  incompatible_status: 409,
  incompatible_subtasks: 409,
  incompatible_task_context: 409,
  invalid_request: 400,
  not_authenticated: 401,
  not_found: 404,
  state_conflict: 409,
}

const failure = (code, message) => ({
  status: 400,
  body: { ok: false, error: { code, message } },
})

async function executeMergeTasks(context, survivorTaskId, body, notifyTaskMutation) {
  const duplicateTaskId = typeof body.duplicateTaskId === 'string'
    ? body.duplicateTaskId.trim()
    : ''
  const preview = body.preview !== false
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
  const previewVersion = typeof body.previewVersion === 'string' ? body.previewVersion.trim() : ''

  if (!survivorTaskId || typeof survivorTaskId !== 'string' || !duplicateTaskId) {
    return failure('invalid_request', 'exact survivor and duplicate task ids are required')
  }
  if (survivorTaskId === duplicateTaskId) {
    return failure('invalid_request', 'survivor and duplicate task ids must differ')
  }
  if (!preview && (!requestId || !previewVersion)) {
    return failure('approval_receipt_required', 'requestId and previewVersion are required for apply')
  }

  const { data, error } = await context.supabase.rpc('flowstate_merge_tasks', {
    p_duplicate_task_id: duplicateTaskId,
    p_preview: preview,
    p_preview_version: previewVersion || null,
    p_request_id: requestId || null,
    p_survivor_task_id: survivorTaskId,
    p_workspace_id: context.activeWorkspaceId,
  })

  if (error || !data || typeof data !== 'object') {
    return {
      status: 500,
      body: {
        ok: false,
        error: { code: 'merge_transaction_failed', message: 'Tasks could not be merged' },
      },
    }
  }

  if (data.ok !== true) {
    const code = data.error && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }

  if (!preview) {
    notifyTaskMutation('update', survivorTaskId)
    notifyTaskMutation('delete', duplicateTaskId)
  }

  return { status: 200, body: data }
}

module.exports = { executeMergeTasks }
