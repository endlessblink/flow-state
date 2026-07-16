'use strict'

const {
  canonicalHash,
  validCanonicalReceipt,
} = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'subtask-batch-v1'
const SOURCE = 'local-api'
const ACTION = 'subtask_batch'
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PATCH_FIELDS = new Set([
  'title', 'description', 'isCompleted', 'completedPomodoros', 'doneEnough', 'estimateMinutes',
])
const ERROR_STATUS = {
  invalid_request: 400,
  invalid_operations: 400,
  invalid_operation: 400,
  invalid_subtask: 400,
  invalid_order: 400,
  not_authenticated: 401,
  not_found: 404,
  stale_revision: 409,
  idempotency_conflict: 409,
  preview_mismatch: 409,
  preview_expired: 409,
  approval_mismatch: 409,
  subtask_not_found: 409,
  subtask_id_conflict: 409,
  invalid_existing_subtasks: 409,
  unsupported_legacy_subtask_shape: 409,
  no_change: 409,
}

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function timestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function digest(value) {
  return typeof value === 'string' && SHA256_HEX_RE.test(value)
}

function orderedSubtaskIds(value) {
  return Array.isArray(value)
    && value.every(nonEmptyString)
    && new Set(value).size === value.length
}

function errorResult(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } }
}

function exactKeys(value, allowed, required = []) {
  const keys = Object.keys(value)
  return keys.every(key => allowed.has(key)) && required.every(key => Object.hasOwn(value, key))
}

function normalizeTitle(value) {
  if (typeof value !== 'string') return null
  const title = value.trim()
  return title && [...title].length <= 500 ? title : null
}

function normalizeDescription(value) {
  return typeof value === 'string' && [...value].length <= 10000 ? value : null
}

function normalizeDoneEnough(value) {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized && [...normalized].length <= 1000 ? normalized : undefined
}

function normalizeEstimate(value) {
  return value === null || (Number.isSafeInteger(value) && value > 0 && value <= 10080)
    ? value
    : undefined
}

function normalizePatch(patch, allowEmpty) {
  if (!object(patch) || !exactKeys(patch, PATCH_FIELDS)) return null
  const normalized = {}
  if (Object.hasOwn(patch, 'title')) {
    const title = normalizeTitle(patch.title)
    if (title === null) return null
    normalized.title = title
  }
  if (Object.hasOwn(patch, 'description')) {
    const description = normalizeDescription(patch.description)
    if (description === null) return null
    normalized.description = description
  }
  if (Object.hasOwn(patch, 'isCompleted')) {
    if (typeof patch.isCompleted !== 'boolean') return null
    normalized.isCompleted = patch.isCompleted
  }
  if (Object.hasOwn(patch, 'completedPomodoros')) {
    if (!Number.isSafeInteger(patch.completedPomodoros)
      || patch.completedPomodoros < 0
      || patch.completedPomodoros > 100000) return null
    normalized.completedPomodoros = patch.completedPomodoros
  }
  if (Object.hasOwn(patch, 'doneEnough')) {
    const doneEnough = normalizeDoneEnough(patch.doneEnough)
    if (doneEnough === undefined) return null
    normalized.doneEnough = doneEnough
  }
  if (Object.hasOwn(patch, 'estimateMinutes')) {
    const estimateMinutes = normalizeEstimate(patch.estimateMinutes)
    if (estimateMinutes === undefined) return null
    normalized.estimateMinutes = estimateMinutes
  }
  return Object.keys(normalized).length > 0 || allowEmpty ? normalized : null
}

function normalizeOrder(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 100000 ? value : null
}

function normalizeOperation(operation) {
  if (!object(operation) || !nonEmptyString(operation.action)) return null
  if (operation.action === 'create') {
    if (!exactKeys(operation, new Set(['action', 'subtask', 'order']), ['action', 'subtask'])
      || !object(operation.subtask)
      || !exactKeys(operation.subtask, new Set(['id', ...PATCH_FIELDS]), ['id', 'title', 'doneEnough'])
      || !nonEmptyString(operation.subtask.id)
      || !UUID_RE.test(operation.subtask.id)) return null
    const { id, ...requestedPatch } = operation.subtask
    const patch = normalizePatch(requestedPatch, false)
    if (!patch
      || !Object.hasOwn(patch, 'title')
      || !Object.hasOwn(patch, 'doneEnough')
      || patch.doneEnough === null) return null
    const normalized = {
      action: 'create',
      subtask: {
        id: id.toLowerCase(),
        title: patch.title,
        description: Object.hasOwn(patch, 'description') ? patch.description : '',
        isCompleted: Object.hasOwn(patch, 'isCompleted') ? patch.isCompleted : false,
        completedPomodoros: Object.hasOwn(patch, 'completedPomodoros') ? patch.completedPomodoros : 0,
        doneEnough: Object.hasOwn(patch, 'doneEnough') ? patch.doneEnough : null,
        estimateMinutes: Object.hasOwn(patch, 'estimateMinutes') ? patch.estimateMinutes : null,
      },
    }
    if (Object.hasOwn(operation, 'order')) {
      const order = normalizeOrder(operation.order)
      if (order === null) return null
      normalized.order = order
    }
    return normalized
  }
  if (operation.action === 'update') {
    if (!exactKeys(operation, new Set(['action', 'subtaskId', 'patch', 'order']), ['action', 'subtaskId', 'patch'])
      || !nonEmptyString(operation.subtaskId)) return null
    const hasOrder = Object.hasOwn(operation, 'order')
    const patch = normalizePatch(operation.patch, hasOrder)
    if (!patch) return null
    const normalized = { action: 'update', subtaskId: operation.subtaskId, patch }
    if (hasOrder) {
      const order = normalizeOrder(operation.order)
      if (order === null) return null
      normalized.order = order
    }
    return normalized
  }
  if (operation.action === 'delete') {
    return exactKeys(operation, new Set(['action', 'subtaskId']), ['action', 'subtaskId'])
      && nonEmptyString(operation.subtaskId)
      ? { action: 'delete', subtaskId: operation.subtaskId }
      : null
  }
  return null
}

function validateRequest(taskId, body) {
  const allowed = new Set([
    'operationId', 'baseRevision', 'operations', 'preview', 'previewDigest',
    'previewExpiresAt', 'approvedSubtaskIds', 'workspaceId',
  ])
  if (!nonEmptyString(taskId)
    || !object(body)
    || !exactKeys(body, allowed, ['operationId', 'baseRevision', 'operations'])
    || !nonEmptyString(body.operationId)
    || body.operationId.length > 160
    || !Number.isSafeInteger(body.baseRevision)
    || body.baseRevision < 1
    || !Array.isArray(body.operations)
    || body.operations.length < 1
    || body.operations.length > 50
    || (body.preview !== undefined && typeof body.preview !== 'boolean')) {
    return { error: errorResult(400, 'invalid_request', 'The canonical subtask batch request is invalid') }
  }
  const operations = body.operations.map(normalizeOperation)
  if (operations.some(operation => operation === null)) {
    return { error: errorResult(400, 'invalid_operations', 'The subtask batch operations are invalid') }
  }
  const preview = body.preview !== false
  if (preview && Object.hasOwn(body, 'approvedSubtaskIds')) {
    return { error: errorResult(400, 'invalid_request', 'approvedSubtaskIds is apply-only') }
  }
  if (!preview && (
    !digest(body.previewDigest)
    || !timestamp(body.previewExpiresAt)
    || !orderedSubtaskIds(body.approvedSubtaskIds)
  )) {
    return {
      error: errorResult(
        400,
        'approval_receipt_required',
        'previewDigest, previewExpiresAt, and approvedSubtaskIds are required for apply',
      ),
    }
  }
  return { preview, operations }
}

function normalizedRequest(taskId, body, operations, workspaceId) {
  return {
    contractVersion: CONTRACT_VERSION,
    source: SOURCE,
    action: ACTION,
    taskId,
    baseRevision: body.baseRevision,
    workspaceId,
    operations,
  }
}

function validSubtask(value) {
  return object(value)
    && nonEmptyString(value.id)
    && nonEmptyString(value.title)
    && typeof value.description === 'string'
    && typeof value.isCompleted === 'boolean'
    && Number.isSafeInteger(value.completedPomodoros)
    && value.completedPomodoros >= 0
    && (value.doneEnough === undefined || value.doneEnough === null || nonEmptyString(value.doneEnough))
    && (value.estimateMinutes === undefined || value.estimateMinutes === null || (Number.isSafeInteger(value.estimateMinutes) && value.estimateMinutes > 0))
}

function expectedFinalEffects(operations) {
  const effects = new Map()
  for (const operation of operations) {
    const id = operation.action === 'create' ? operation.subtask.id : operation.subtaskId
    if (operation.action === 'delete') {
      effects.set(id, null)
    } else if (operation.action === 'create') {
      effects.set(id, { ...operation.subtask })
    } else {
      effects.set(id, { ...(effects.get(id) || {}), ...operation.patch })
    }
  }
  return effects
}

function validReadBack(readBack, taskId, workspaceId, operations, expectedRevision) {
  if (!object(readBack)
    || readBack.id !== taskId
    || readBack.workspaceId !== workspaceId
    || readBack.canonicalRevision !== expectedRevision
    || !timestamp(readBack.canonicalUpdatedAt)
    || !Array.isArray(readBack.subtasks)
    || !readBack.subtasks.every(validSubtask)) return false

  const byId = new Map(readBack.subtasks.map(subtask => [subtask.id, subtask]))
  for (const [id, effect] of expectedFinalEffects(operations)) {
    const actual = byId.get(id)
    if (effect === null) {
      if (actual) return false
      continue
    }
    if (!actual || !Object.entries(effect).every(([key, value]) => actual[key] === value)) return false
  }
  const lastOperation = operations[operations.length - 1]
  if (Object.hasOwn(lastOperation, 'order')) {
    const orderedId = lastOperation.action === 'create' ? lastOperation.subtask.id : lastOperation.subtaskId
    const expectedIndex = Math.min(lastOperation.order, Math.max(0, readBack.subtasks.length - 1))
    if (readBack.subtasks.findIndex(subtask => subtask.id === orderedId) !== expectedIndex) return false
  }
  return true
}

function validPreview(data, taskId, body, operations, workspaceId, expectedRequest, expectedHash) {
  if (!object(data)
    || data.ok !== true
    || data.result !== 'preview'
    || data.contractVersion !== CONTRACT_VERSION
    || data.operationId !== body.operationId
    || data.action !== ACTION
    || data.taskId !== taskId
    || data.baseRevision !== body.baseRevision
    || data.requestHash !== expectedHash
    || !digest(data.previewDigest)
    || !timestamp(data.previewExpiresAt)
    || !object(data.normalizedPayload)
    || !validReadBack(data.readBack, taskId, workspaceId, operations, body.baseRevision)) return false
  try {
    return canonicalHash(data.normalizedPayload) === canonicalHash(expectedRequest)
  } catch {
    return false
  }
}

function validCommitted(data, taskId, body, operations, workspaceId, expectedHash) {
  if (!object(data)
    || data.ok !== true
    || data.status !== 'committed'
    || data.result !== 'committed'
    || data.requestHash !== expectedHash
    || !object(data.receipt)
    || data.receipt.status !== data.status
    || data.receipt.requestHash !== data.requestHash) return false

  return validCanonicalReceipt(
    data.receipt,
    {
      contractVersion: CONTRACT_VERSION,
      operationId: body.operationId,
      source: SOURCE,
      status: 'committed',
      requestHash: expectedHash,
      entityType: 'task',
      action: ACTION,
      entityId: taskId,
    },
    readBack => validReadBack(readBack, taskId, workspaceId, operations, body.baseRevision + 1)
      && readBack.subtasks.length === body.approvedSubtaskIds.length
      && readBack.subtasks.every((subtask, index) => subtask.id === body.approvedSubtaskIds[index]),
    [canonicalHash],
  )
}

async function executeCanonicalSubtaskBatch(context, taskId, body, notifyTaskMutation) {
  if (context.signedUser === false) {
    return errorResult(401, 'signed_user_required', 'Canonical subtask batches require a signed-in user session')
  }
  const validated = validateRequest(taskId, body)
  if (validated.error) return validated.error

  const workspaceId = context.activeWorkspaceId
  if (Object.hasOwn(body, 'workspaceId') && body.workspaceId !== workspaceId) {
    return errorResult(409, 'workspace_mismatch', 'The requested workspace is not the active signed-in scope')
  }
  const expectedRequest = normalizedRequest(taskId, body, validated.operations, workspaceId)
  let expectedHash
  try {
    expectedHash = canonicalHash(expectedRequest)
  } catch {
    return errorResult(400, 'invalid_request', 'The canonical subtask batch request is invalid')
  }

  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_subtask_batch_v1', {
      p_approved_subtask_ids: validated.preview ? null : body.approvedSubtaskIds,
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: body.operationId,
      p_operations: validated.operations,
      p_preview: validated.preview,
      p_preview_digest: validated.preview ? null : body.previewDigest,
      p_preview_expires_at: validated.preview ? null : body.previewExpiresAt,
      p_source: SOURCE,
      p_task_id: taskId,
      p_workspace_id: workspaceId,
    })
  } catch {
    return errorResult(500, 'canonical_subtask_batch_failed', 'Subtask batch could not be completed')
  }
  const { data, error } = rpcResult || {}
  if (error || !object(data)) {
    return errorResult(500, 'canonical_subtask_batch_failed', 'Subtask batch could not be completed')
  }
  if (data.ok !== true) {
    const code = object(data.error) && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }
  if (validated.preview) {
    if (!validPreview(data, taskId, body, validated.operations, workspaceId, expectedRequest, expectedHash)) {
      return errorResult(502, 'invalid_canonical_response', 'Canonical subtask preview could not be verified')
    }
    return { status: 200, body: data }
  }
  if (!validCommitted(data, taskId, body, validated.operations, workspaceId, expectedHash)) {
    return errorResult(502, 'invalid_canonical_receipt', 'Canonical subtask receipt could not be verified')
  }

  try {
    notifyTaskMutation('update', taskId)
  } catch {
    // The verified database commit remains authoritative if IPC reconciliation fails.
  }
  return { status: 200, body: data }
}

module.exports = { executeCanonicalSubtaskBatch }
