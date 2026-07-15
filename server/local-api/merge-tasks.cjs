'use strict'

const {
  canonicalHash,
  validateAffectedTaskEntry,
  validateCanonicalReceipt,
} = require('./canonical-receipt.cjs')

const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const CONTRACT_VERSION = 'task-v1'
const SOURCE = 'local-api'

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
  invalid_recurrence_resolution: 400,
  invalid_request: 400,
  not_authenticated: 401,
  not_found: 404,
  recurrence_history_unsupported: 409,
  state_conflict: 409,
}

const failure = (code, message) => ({
  status: 400,
  body: { ok: false, error: { code, message } },
})

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function validPreview(data, survivorTaskId, duplicateTaskId, requestId, recurrenceResolution) {
  if (!(
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
    && object(data.survivor)
    && data.survivor.id === survivorTaskId
    && object(data.duplicate)
    && data.duplicate.id === duplicateTaskId
  )) return false
  if (recurrenceResolution === undefined) return data.recurrenceResolution === undefined
  try {
    return canonicalHash(data.recurrenceResolution) === canonicalHash(recurrenceResolution)
  } catch {
    return false
  }
}

function validCommittedResponse(data, survivorTaskId, duplicateTaskId, body) {
  if (
    !object(data)
    || data.ok !== true
    || data.result !== 'committed'
    || data.requestHash !== body.requestHash
    || !object(data.receipt)
  ) return false
  const receipt = data.receipt
  const survivor = Array.isArray(receipt.affected) ? receipt.affected[0] : null
  const duplicate = Array.isArray(receipt.affected) ? receipt.affected[1] : null
  const exactAffected = Boolean(
    Array.isArray(receipt.affected)
    && receipt.affected.length === 2
    && survivorTaskId !== duplicateTaskId
    && validateAffectedTaskEntry(survivor, { entityId: survivorTaskId, action: 'update' }).ok
    && validateAffectedTaskEntry(duplicate, { entityId: duplicateTaskId, action: 'archive' }).ok
  )
  const validation = validateCanonicalReceipt(receipt, {
    expectedOperationId: body.requestId,
    expectedRequestHash: body.requestHash,
    expectedFields: {
      contractVersion: CONTRACT_VERSION,
      source: SOURCE,
      entityType: 'task',
      action: 'merge',
      entityId: survivorTaskId,
    },
    validateReadBack: value => Boolean(
      exactAffected
      && value.id === survivorTaskId
      && value.canonicalRevision === receipt.canonicalRevision
      && value.canonicalRevision === survivor.canonicalRevision
      && value.canonicalUpdatedAt === receipt.canonicalUpdatedAt
      && receipt.changeSequence === survivor.changeSequence
      && value.survivorTaskId === survivorTaskId
      && value.duplicateTaskId === duplicateTaskId
      && value.duplicateArchived === true
      && duplicate.readBack.id === duplicateTaskId
      && duplicate.readBack.isDeleted === true
      && typeof duplicate.readBack.deletedAt === 'string'
    ),
  })
  if (!validation.ok) return false
  if (body.recurrenceResolution === undefined) return true
  try {
    return object(receipt.operationContext)
      && canonicalHash(receipt.operationContext.recurrenceResolution) === canonicalHash(body.recurrenceResolution)
      && canonicalHash(receipt.readBack.recurrenceRule) === canonicalHash(body.recurrenceResolution)
  } catch {
    return false
  }
}

async function executeMergeTasks(context, survivorTaskId, body, notifyTaskMutation) {
  if (!object(body)) return failure('invalid_request', 'request body is required')
  const duplicateTaskId = typeof body.duplicateTaskId === 'string'
    ? body.duplicateTaskId.trim()
    : ''
  const preview = body.preview !== false
  const requestId = typeof body.requestId === 'string' ? body.requestId : ''
  const previewVersion = typeof body.previewVersion === 'string' ? body.previewVersion.trim() : ''
  const requestHash = typeof body.requestHash === 'string' ? body.requestHash : ''
  const recurrenceResolution = body.recurrenceResolution

  if (!survivorTaskId || typeof survivorTaskId !== 'string' || !duplicateTaskId) {
    return failure('invalid_request', 'exact survivor and duplicate task ids are required')
  }
  if (survivorTaskId === duplicateTaskId) {
    return failure('invalid_request', 'survivor and duplicate task ids must differ')
  }
  if (!requestId || requestId !== requestId.trim()) {
    if (!preview) return failure('approval_receipt_required', 'requestId, previewVersion, and requestHash are required for apply')
    return failure('invalid_request', 'requestId is required')
  }
  if (!preview && (!previewVersion || !SHA256_HEX_RE.test(requestHash))) {
    return failure('approval_receipt_required', 'requestId, previewVersion, and requestHash are required for apply')
  }
  if (recurrenceResolution !== undefined && (
    !recurrenceResolution
    || typeof recurrenceResolution !== 'object'
    || Array.isArray(recurrenceResolution)
  )) {
    return failure('invalid_request', 'recurrenceResolution must be a canonical recurrence rule object')
  }

  const rpcName = recurrenceResolution === undefined
    ? 'flowstate_merge_tasks'
    : 'flowstate_merge_tasks_with_recurrence'
  const params = {
    p_duplicate_task_id: duplicateTaskId,
    p_preview: preview,
    p_preview_version: previewVersion || null,
    p_request_hash: preview ? null : requestHash,
    p_request_id: requestId || null,
    p_survivor_task_id: survivorTaskId,
    p_workspace_id: context.activeWorkspaceId,
  }
  if (recurrenceResolution !== undefined) {
    params.p_recurrence_resolution = recurrenceResolution
  }

  const { data, error } = await context.supabase.rpc(rpcName, params)

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
    if (code === 'incompatible_recurrence' || code === 'recurring_merge_unsupported') {
      return {
        status: ERROR_STATUS[code] || 409,
        body: {
          ...data,
          action: 'stop_mutations_and_request_recurrence_resolution',
        },
      }
    }
    if (code === 'recurrence_history_unsupported') {
      return {
        status: 409,
        body: {
          ...data,
          action: 'stop_mutations_and_report_recurrence_history',
        },
      }
    }
    return { status: ERROR_STATUS[code] || 500, body: data }
  }

  if (preview) {
    if (!validPreview(data, survivorTaskId, duplicateTaskId, requestId, recurrenceResolution)) {
      return {
        status: 502,
        body: { ok: false, error: { code: 'invalid_canonical_response', message: 'Merge preview could not be verified' } },
      }
    }
    return { status: 200, body: data }
  }

  if (!validCommittedResponse(data, survivorTaskId, duplicateTaskId, body)) {
    return {
      status: 502,
      body: { ok: false, error: { code: 'invalid_canonical_receipt', message: 'Merge receipt could not be verified' } },
    }
  }
  try {
    notifyTaskMutation('update', survivorTaskId)
    notifyTaskMutation('delete', duplicateTaskId)
  } catch {
    // Canonical success is durable; renderer reconciliation is best-effort.
  }

  return { status: 200, body: data }
}

module.exports = { executeMergeTasks }
