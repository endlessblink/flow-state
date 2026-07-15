'use strict'

const {
  canonicalHash,
  canonicalJson,
  validateAffectedTaskEntry,
} = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'task-v1'
const SOURCE = 'local-api'
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_ONLY_RE = /^\d{2}:\d{2}$/
const OFFSET_TIMESTAMP_RE = /(?:Z|[+-]\d{2}:\d{2})$/
const ERROR_STATUS = {
  invalid_request: 400,
  invalid_operation: 400,
  approval_receipt_required: 400,
  not_authenticated: 401,
  signed_user_required: 401,
  scope_denied: 403,
  not_found: 404,
  task_not_found: 404,
  work_block_not_found: 404,
  stale_revision: 409,
  stale_work_block: 409,
  idempotency_conflict: 409,
  request_hash_required: 409,
  request_hash_mismatch: 409,
  preview_mismatch: 409,
  preview_expired: 409,
  finish_by_exceeded: 409,
  overlap_conflict: 409,
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

function buildWorkBlockInventory(task) {
  if (!object(task) || !nonEmptyString(task.id) || !positiveInteger(task.canonical_revision)) {
    throw new TypeError('canonical work-block inventory requires task identity and revision')
  }
  const instances = Array.isArray(task.instances)
    ? task.instances.filter(object).map(instance => ({
      ...instance,
      baseWorkBlockHash: canonicalHash(instance),
    }))
    : []
  return {
    ok: true,
    fresh: true,
    task: {
      id: task.id,
      title: typeof task.title === 'string' ? task.title : '',
      workspaceId: task.workspace_id ?? null,
      canonicalRevision: task.canonical_revision,
    },
    instances,
  }
}

async function readWorkBlockInventory(context, taskId) {
  if (!context?.signedUser) {
    return errorResult(401, 'signed_user_required', 'Canonical work-block inventory requires a signed-in user session')
  }
  if (!nonEmptyString(taskId) || !nonEmptyString(context.userId)) {
    return errorResult(400, 'invalid_request', 'Canonical work-block inventory requires task identity')
  }

  const { supabase, userId, activeWorkspaceId } = context
  if (activeWorkspaceId !== null) {
    let authority
    try {
      authority = await supabase.rpc('flowstate_can_write_workspace_v1', {
        p_workspace_id: activeWorkspaceId,
      })
    } catch {
      return errorResult(500, 'inventory_read_failed', 'Work-block inventory could not verify workspace access')
    }
    if (authority?.error) {
      return errorResult(500, 'inventory_read_failed', 'Work-block inventory could not verify workspace access')
    }
    if (authority?.data !== true) {
      return errorResult(403, 'scope_denied', 'Task write access is required')
    }
  }

  let query = supabase
    .from('tasks')
    .select('id,title,workspace_id,canonical_revision,instances')
    .eq('id', taskId)
    .eq('is_deleted', false)
  query = activeWorkspaceId === null
    ? query.eq('user_id', userId).is('workspace_id', null)
    : query.eq('workspace_id', activeWorkspaceId)

  let result
  try {
    result = await query.maybeSingle()
  } catch {
    return errorResult(500, 'inventory_read_failed', 'Work-block inventory could not be read')
  }
  if (result?.error) {
    return errorResult(500, 'inventory_read_failed', 'Work-block inventory could not be read')
  }
  if (!result?.data) {
    return errorResult(404, 'not_found', 'Task was not found')
  }
  try {
    return { status: 200, body: buildWorkBlockInventory(result.data) }
  } catch {
    return errorResult(502, 'invalid_canonical_response', 'Canonical work-block inventory is unavailable')
  }
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

function validDateOnly(value) {
  if (typeof value !== 'string' || !DATE_ONLY_RE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function validTimeOnly(value) {
  if (typeof value !== 'string' || !TIME_ONLY_RE.test(value)) return false
  const [hour, minute] = value.split(':').map(Number)
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function validTimeZone(value) {
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

function normalizeOperation(value) {
  if (!object(value)) return null
  const kind = value.kind || value.action
  if (!['create', 'move', 'resize', 'remove'].includes(kind)) return null

  const common = ['kind', 'action', 'taskId', 'baseRevision']
  const allowed = new Set(kind === 'create'
      ? [...common, 'clientId', 'scheduledDate', 'scheduledTime', 'duration']
      : kind === 'move'
      ? [...common, 'workBlockId', 'baseWorkBlockHash', 'scheduledDate', 'scheduledTime', 'duration']
      : kind === 'resize'
        ? [...common, 'workBlockId', 'baseWorkBlockHash', 'duration']
        : [...common, 'workBlockId', 'baseWorkBlockHash'])
  if (Object.keys(value).some(key => !allowed.has(key))) return null
  if (!nonEmptyString(value.taskId) || !positiveInteger(value.baseRevision)) return null

  const normalized = { kind, taskId: value.taskId, baseRevision: value.baseRevision }
  if (kind === 'create') {
    if (
      !nonEmptyString(value.clientId)
      || !validDateOnly(value.scheduledDate)
      || !validTimeOnly(value.scheduledTime)
      || !positiveInteger(value.duration)
      || value.duration > 1440
    ) return null
    return {
      ...normalized,
      clientId: value.clientId,
      scheduledDate: value.scheduledDate,
      scheduledTime: value.scheduledTime,
      duration: value.duration,
    }
  }

  if (!nonEmptyString(value.workBlockId) || !digest(value.baseWorkBlockHash)) return null
  normalized.workBlockId = value.workBlockId
  normalized.baseWorkBlockHash = value.baseWorkBlockHash
  if (kind === 'move') {
    if (!validDateOnly(value.scheduledDate) || !validTimeOnly(value.scheduledTime)) return null
    normalized.scheduledDate = value.scheduledDate
    normalized.scheduledTime = value.scheduledTime
    if (value.duration !== undefined) {
      if (!positiveInteger(value.duration) || value.duration > 1440) return null
      normalized.duration = value.duration
    }
  } else if (kind === 'resize') {
    if (!positiveInteger(value.duration) || value.duration > 1440) return null
    normalized.duration = value.duration
  }
  return normalized
}

function normalizeOperations(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null
  const normalized = value.map(normalizeOperation)
  if (!normalized.every(Boolean)) return null
  const taskRevisions = new Map()
  const targets = new Set()
  for (const operation of normalized) {
    const knownRevision = taskRevisions.get(operation.taskId)
    if (knownRevision !== undefined && knownRevision !== operation.baseRevision) return null
    taskRevisions.set(operation.taskId, operation.baseRevision)
    const target = operation.kind === 'create'
      ? `client:${operation.taskId}:${operation.clientId}`
      : `block:${operation.taskId}:${operation.workBlockId}`
    if (targets.has(target)) return null
    targets.add(target)
  }
  return normalized
}

function validateRequest(body) {
  if (!object(body)) {
    return { error: errorResult(400, 'invalid_request', 'The canonical work-block request is invalid') }
  }
  const preview = body.preview !== false
  if (!preview && (
    !nonEmptyString(body.operationId)
    || !digest(body.previewDigest)
    || !timestamp(body.previewExpiresAt)
    || !digest(body.requestHash)
  )) {
    return {
      error: errorResult(
        400,
        'approval_receipt_required',
        'operationId, previewDigest, previewExpiresAt, and requestHash are required for apply',
      ),
    }
  }
  const operations = normalizeOperations(body.operations)
  if (
    !operations
    || !nonEmptyString(body.operationId)
    || body.operationId.length > 160
    || !validTimeZone(body.timeZone)
    || (body.finishBy !== undefined && body.finishBy !== null && !timestamp(body.finishBy))
    || (body.preview !== undefined && typeof body.preview !== 'boolean')
  ) {
    return { error: errorResult(400, 'invalid_request', 'The canonical work-block request is invalid') }
  }
  return { preview, operations, finishBy: body.finishBy || null }
}

function sameJson(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right)
  } catch {
    return false
  }
}

function hashMatches(value, expected) {
  try {
    return digest(expected) && canonicalHash(value) === expected
  } catch {
    return false
  }
}

function sameInstantOrNull(left, right) {
  if (left == null || right == null) return left == null && right == null
  return timestamp(left) && timestamp(right) && Date.parse(left) === Date.parse(right)
}

function requestedOperationMatches(requested, returned) {
  if (!object(returned) || returned.kind !== requested.kind) return false
  if (requested.kind === 'create' && !nonEmptyString(returned.workBlockId)) return false
  return Object.entries(requested).every(([key, value]) => sameJson(returned[key], value))
}

function validNormalizedPayload(data, request, body) {
  const payload = data.normalizedPayload
  return object(payload)
    && payload.timeZone === body.timeZone
    && sameInstantOrNull(payload.finishBy ?? null, request.finishBy)
    && Array.isArray(payload.operations)
    && payload.operations.length === request.operations.length
    && request.operations.every((operation, index) => (
      requestedOperationMatches(operation, payload.operations[index])
    ))
}

function validTaskReadBack(readBack, taskId, workspaceId, revision) {
  return object(readBack)
    && readBack.id === taskId
    && readBack.workspaceId === workspaceId
    && readBack.canonicalRevision === revision
    && Array.isArray(readBack.instances)
}

function expectedTaskIds(operations) {
  return [...new Set(operations.map(operation => operation.taskId))]
}

function normalizedOperation(data, index) {
  return data.normalizedPayload.operations[index]
}

function operationReflected(operation, returnedOperation, instances) {
  const instance = operation.kind === 'create'
    ? instances.find(item => object(item) && item.clientId === operation.clientId)
    : instances.find(item => object(item) && item.id === operation.workBlockId)
  if (operation.kind === 'remove') return !instance
  if (!instance) return false
  if (operation.kind === 'create') {
    return instance.scheduledDate === operation.scheduledDate
      && instance.scheduledTime === operation.scheduledTime
      && instance.duration === operation.duration
  }
  if (operation.kind === 'move') {
    return instance.scheduledDate === operation.scheduledDate
      && instance.scheduledTime === operation.scheduledTime
      && (operation.duration === undefined || instance.duration === operation.duration)
  }
  return instance.duration === operation.duration
}

function validPreviewReadBack(data, request, workspaceId) {
  const taskIds = expectedTaskIds(request.operations)
  if (!Array.isArray(data.readBack) || data.readBack.length !== taskIds.length) return false
  return taskIds.every(taskId => {
    const operations = request.operations.filter(operation => operation.taskId === taskId)
    const baseRevision = operations[0].baseRevision
    if (operations.some(operation => operation.baseRevision !== baseRevision)) return false
    const readBack = data.readBack.find(candidate => object(candidate) && candidate.id === taskId)
    return Boolean(
      readBack
      && validTaskReadBack(readBack, taskId, workspaceId, baseRevision)
      && operations.every(operation => {
        const index = request.operations.indexOf(operation)
        return operationReflected(operation, normalizedOperation(data, index), readBack.instances)
      })
    )
  })
}

function validCommittedAffected(receipt, data, request, workspaceId) {
  const taskIds = expectedTaskIds(request.operations)
  if (
    !Array.isArray(receipt.affected)
    || receipt.affected.length !== taskIds.length
    || !Array.isArray(receipt.readBack)
    || receipt.readBack.length !== taskIds.length
  ) return false
  return taskIds.every(taskId => {
    const entry = receipt.affected.find(candidate => object(candidate) && candidate.entityId === taskId)
    if (!entry || !validateAffectedTaskEntry(entry, { entityId: taskId, action: 'update' }).ok) return false
    if (!validTaskReadBack(entry.readBack, taskId, workspaceId, entry.canonicalRevision)) return false
    const aggregateReadBack = receipt.readBack.find(candidate => object(candidate) && candidate.id === taskId)
    if (!aggregateReadBack || !sameJson(aggregateReadBack, entry.readBack)) return false
    return request.operations.every((operation, index) => (
      operation.taskId !== taskId
      || operationReflected(operation, normalizedOperation(data, index), entry.readBack.instances)
    ))
  })
}

async function executeWorkBlockBatch(context, body, notifyTaskMutation) {
  if (context.signedUser === false) {
    return errorResult(401, 'signed_user_required', 'Canonical work-block changes require a signed-in user session')
  }
  const request = validateRequest(body)
  if (request.error) return request.error

  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_work_block_batch_v1', {
      p_contract_version: CONTRACT_VERSION,
      p_finish_by: request.finishBy,
      p_operation_id: body.operationId,
      p_operations: request.operations,
      p_preview: request.preview,
      p_preview_digest: request.preview ? null : body.previewDigest,
      p_preview_expires_at: request.preview ? null : body.previewExpiresAt,
      p_request_hash: request.preview ? null : body.requestHash,
      p_source: SOURCE,
      p_time_zone: body.timeZone,
      p_workspace_id: context.activeWorkspaceId,
    })
  } catch {
    return errorResult(500, 'canonical_work_block_batch_failed', 'Work-block changes could not be committed')
  }
  const { data, error } = rpcResult || {}
  if (error || !object(data)) {
    return errorResult(500, 'canonical_work_block_batch_failed', 'Work-block changes could not be committed')
  }
  if (data.ok !== true) {
    const code = object(data.error) && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }

  if (request.preview) {
    if (
      data.result !== 'preview'
      || data.contractVersion !== CONTRACT_VERSION
      || data.action !== 'work_block_batch'
      || data.operationId !== body.operationId
      || data.timeZone !== body.timeZone
      || !sameInstantOrNull(data.finishBy ?? null, request.finishBy)
      || !digest(data.requestHash)
      || !digest(data.previewDigest)
      || !timestamp(data.previewExpiresAt)
      || !validNormalizedPayload(data, request, body)
      || !Array.isArray(data.overlapWarnings)
      || !data.overlapWarnings.every(object)
      || !validPreviewReadBack(data, request, context.activeWorkspaceId)
    ) {
      return errorResult(502, 'invalid_canonical_response', 'Canonical work-block preview could not be verified')
    }
    return { status: 200, body: data }
  }

  const receipt = data.receipt
  const committedProjection = { normalizedPayload: { operations: request.operations } }
  const validReceipt = object(receipt)
    && receipt.ok === true
    && ['committed', 'replayed'].includes(receipt.status)
    && typeof receipt.replayed === 'boolean'
    && receipt.replayed === (receipt.status === 'replayed')
    && receipt.contractVersion === CONTRACT_VERSION
    && receipt.operationId === body.operationId
    && receipt.requestHash === body.requestHash
    && receipt.source === SOURCE
    && receipt.entityType === 'batch'
    && receipt.action === 'work_block_batch'
    && receipt.entityId === body.operationId
    && positiveInteger(receipt.canonicalRevision)
    && positiveInteger(receipt.changeSequence)
    && timestamp(receipt.committedAt)
    && hashMatches(receipt.readBack, receipt.readBackHash)
    && validCommittedAffected(receipt, committedProjection, request, context.activeWorkspaceId)
  if (
    data.result !== 'committed'
    || data.action !== 'work_block_batch'
    || data.operationId !== body.operationId
    || data.requestHash !== body.requestHash
    || !validReceipt
  ) {
    return errorResult(502, 'invalid_canonical_response', 'Canonical work-block receipt could not be verified')
  }

  if (!receipt.replayed) {
    for (const taskId of expectedTaskIds(request.operations)) {
      try {
        notifyTaskMutation('update', taskId)
      } catch {
        // The canonical commit is durable; renderer reconciliation remains best effort.
      }
    }
  }
  return { status: 200, body: data }
}

module.exports = {
  buildWorkBlockInventory,
  executeWorkBlockBatch,
  normalizeOperation,
  readWorkBlockInventory,
}
