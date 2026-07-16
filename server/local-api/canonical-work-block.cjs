'use strict'

const { canonicalHash, validCanonicalReceipt } = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'work-block-v1'
const SOURCE = 'local-api'
const ACTIONS = new Set(['create', 'move', 'resize', 'remove'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DIGEST_RE = /^[0-9a-f]{64}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const LOCAL_MINUTE_RE = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/
const ERROR_STATUS = {
  invalid_request: 400,
  invalid_action: 400,
  invalid_command: 400,
  invalid_work_block: 400,
  invalid_interval: 400,
  invalid_duration: 400,
  invalid_timezone: 400,
  invalid_finish_by: 400,
  not_authenticated: 401,
  not_found: 404,
  work_block_not_found: 404,
  stale_revision: 409,
  stale_work_block_revision: 409,
  work_block_id_conflict: 409,
  invalid_existing_work_blocks: 409,
  invalid_existing_work_block: 409,
  finish_by_exceeded: 409,
  no_change: 409,
  idempotency_conflict: 409,
  preview_mismatch: 409,
  preview_expired: 409,
}

function object(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function exactKeys(value, allowed, required = []) {
  return object(value)
    && Object.keys(value).every(key => allowed.has(key))
    && required.every(key => Object.hasOwn(value, key))
}

function timestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function validDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function validLocalMinute(value) {
  return typeof value === 'string'
    && LOCAL_MINUTE_RE.test(value)
    && validDate(value.slice(0, 10))
}

function validTimezone(value) {
  if (!nonEmptyString(value) || value.length > 100) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

function validDuration(value) {
  return Number.isSafeInteger(value) && value >= 1 && value <= 1440
}

function errorResult(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } }
}

function normalizeFinishBy(command, normalized) {
  if (!Object.hasOwn(command, 'finishBy')) return true
  if (!validLocalMinute(command.finishBy)) return false
  normalized.finishBy = command.finishBy
  return true
}

function normalizeCommand(command, workBlockRevision) {
  if (!object(command) || !ACTIONS.has(command.action)) return null
  if (command.action === 'create') {
    if (!exactKeys(command, new Set(['action', 'workBlock', 'finishBy']), ['action', 'workBlock'])
      || !exactKeys(command.workBlock, new Set(['id', 'scheduledDate', 'scheduledTime', 'duration', 'timezone']), [
        'id', 'scheduledDate', 'scheduledTime', 'duration', 'timezone',
      ])
      || !nonEmptyString(command.workBlock.id)
      || !UUID_RE.test(command.workBlock.id)
      || workBlockRevision !== 0
      || !validDate(command.workBlock.scheduledDate)
      || !TIME_RE.test(command.workBlock.scheduledTime || '')
      || !validDuration(command.workBlock.duration)
      || !validTimezone(command.workBlock.timezone)) return null
    const normalized = {
      action: 'create',
      workBlock: {
        id: command.workBlock.id.toLowerCase(),
        scheduledDate: command.workBlock.scheduledDate,
        scheduledTime: command.workBlock.scheduledTime,
        duration: command.workBlock.duration,
        timezone: command.workBlock.timezone,
      },
    }
    return normalizeFinishBy(command, normalized) ? normalized : null
  }

  if (!nonEmptyString(command.workBlockId)
    || !UUID_RE.test(command.workBlockId)
    || !Number.isSafeInteger(workBlockRevision)
    || workBlockRevision < 1) return null
  const workBlockId = command.workBlockId.toLowerCase()
  if (command.action === 'move') {
    if (!exactKeys(command, new Set(['action', 'workBlockId', 'scheduledDate', 'scheduledTime', 'timezone', 'finishBy']), [
      'action', 'workBlockId', 'scheduledDate', 'scheduledTime', 'timezone',
    ])
      || !validDate(command.scheduledDate)
      || !TIME_RE.test(command.scheduledTime || '')
      || !validTimezone(command.timezone)) return null
    const normalized = {
      action: 'move', workBlockId,
      scheduledDate: command.scheduledDate,
      scheduledTime: command.scheduledTime,
      timezone: command.timezone,
    }
    return normalizeFinishBy(command, normalized) ? normalized : null
  }
  if (command.action === 'resize') {
    if (!exactKeys(command, new Set(['action', 'workBlockId', 'duration', 'finishBy']), [
      'action', 'workBlockId', 'duration',
    ]) || !validDuration(command.duration)) return null
    const normalized = { action: 'resize', workBlockId, duration: command.duration }
    return normalizeFinishBy(command, normalized) ? normalized : null
  }
  return exactKeys(command, new Set(['action', 'workBlockId']), ['action', 'workBlockId'])
    ? { action: 'remove', workBlockId }
    : null
}

function validateRequest(taskId, body) {
  const allowed = new Set([
    'operationId', 'baseRevision', 'workBlockRevision', 'command', 'preview',
    'previewDigest', 'previewExpiresAt', 'workspaceId',
  ])
  if (!nonEmptyString(taskId)
    || !exactKeys(body, allowed, ['operationId', 'baseRevision', 'workBlockRevision', 'command'])
    || !nonEmptyString(body.operationId)
    || [...body.operationId].length > 160
    || !Number.isSafeInteger(body.baseRevision)
    || body.baseRevision < 1
    || !Number.isSafeInteger(body.workBlockRevision)
    || body.workBlockRevision < 0
    || (body.preview !== undefined && typeof body.preview !== 'boolean')) {
    return { error: errorResult(400, 'invalid_request', 'The canonical work-block request is invalid') }
  }
  const command = normalizeCommand(body.command, body.workBlockRevision)
  if (!command) {
    return { error: errorResult(400, 'invalid_command', 'The work-block lifecycle command is invalid') }
  }
  const preview = body.preview !== false
  if (!preview && (!DIGEST_RE.test(body.previewDigest || '') || !timestamp(body.previewExpiresAt))) {
    return {
      error: errorResult(
        400,
        'approval_receipt_required',
        'previewDigest and previewExpiresAt are required for apply',
      ),
    }
  }
  return { preview, command }
}

function normalizedRequest(taskId, body, command, workspaceId) {
  return {
    contractVersion: CONTRACT_VERSION,
    source: SOURCE,
    action: command.action,
    taskId,
    baseRevision: body.baseRevision,
    workBlockRevision: body.workBlockRevision,
    workspaceId,
    command,
  }
}

function workBlockId(command) {
  return command.action === 'create' ? command.workBlock.id : command.workBlockId
}

function localEnd(localStart, duration) {
  if (!validLocalMinute(localStart) || !validDuration(duration)) return null
  const [date, time] = localStart.split('T')
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const end = new Date(Date.UTC(year, month - 1, day, hour, minute + duration))
  const pad = value => String(value).padStart(2, '0')
  return `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}T${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`
}

function validInterval(value) {
  return value === null || (object(value)
    && exactKeys(value, new Set(['localStart', 'localEnd']), ['localStart', 'localEnd'])
    && validLocalMinute(value.localStart)
    && validLocalMinute(value.localEnd))
}

function validWorkBlock(value, taskId) {
  return object(value)
    && nonEmptyString(value.id)
    && value.taskId === taskId
    && validDate(value.scheduledDate)
    && TIME_RE.test(value.scheduledTime || '')
    && validDuration(value.duration)
    && validTimezone(value.timezone)
    && Number.isSafeInteger(value.canonicalRevision)
    && value.canonicalRevision > 0
}

function validInstances(value) {
  if (!Array.isArray(value)
    || !value.every(instance => object(instance) && nonEmptyString(instance.id))) return false
  const ids = value.map(instance => instance.id)
  return new Set(ids).size === ids.length
}

function matchesCommand(value, command, taskId, workBlockRevision) {
  if (!validWorkBlock(value, taskId) || value.id !== workBlockId(command)) return false
  if (command.action === 'create') {
    return value.scheduledDate === command.workBlock.scheduledDate
      && value.scheduledTime === command.workBlock.scheduledTime
      && value.duration === command.workBlock.duration
      && value.timezone === command.workBlock.timezone
      && value.canonicalRevision === 1
  }
  if (value.canonicalRevision !== workBlockRevision + 1) return false
  if (command.action === 'move') {
    return value.scheduledDate === command.scheduledDate
      && value.scheduledTime === command.scheduledTime
      && value.timezone === command.timezone
  }
  return command.action === 'resize' && value.duration === command.duration
}

function validProjectedReadBack(readBack, taskId, baseRevision, command, workBlockRevision) {
  if (!object(readBack)
    || readBack.id !== taskId
    || readBack.canonicalRevision !== baseRevision
    || !validInstances(readBack.instances)) return false
  const target = readBack.instances.find(instance => instance.id === workBlockId(command))
  return command.action === 'remove'
    ? target === undefined
    : matchesCommand(target, command, taskId, workBlockRevision)
}

function validWarning(value) {
  return object(value)
    && nonEmptyString(value.taskId)
    && nonEmptyString(value.workBlockId)
    && validLocalMinute(value.localStart)
    && validTimezone(value.timezone)
}

function validPreviewDetails(value, taskId, command) {
  if (!object(value)
    || value.action !== command.action
    || value.workBlockId !== workBlockId(command)
    || !object(value.interval)
    || !validInterval(value.interval.before)
    || !validInterval(value.interval.after)
    || !validTimezone(value.timezone)
    || !object(value.duration)
    || !(value.duration.beforeMinutes === null || validDuration(value.duration.beforeMinutes))
    || !(value.duration.afterMinutes === null || validDuration(value.duration.afterMinutes))
    || !Array.isArray(value.overlapWarnings)
    || !value.overlapWarnings.every(validWarning)
    || !object(value.taskEffect)
    || value.taskEffect.taskId !== taskId
    || !object(value.taskEffect.dueDate)
    || value.taskEffect.dueDate.before !== value.taskEffect.dueDate.after) return false

  if ((value.interval.before === null) !== (value.duration.beforeMinutes === null)
    || (value.interval.after === null) !== (value.duration.afterMinutes === null)
    || (value.interval.before !== null
      && value.interval.before.localEnd !== localEnd(value.interval.before.localStart, value.duration.beforeMinutes))
    || (value.interval.after !== null
      && value.interval.after.localEnd !== localEnd(value.interval.after.localStart, value.duration.afterMinutes))) return false

  if (Object.hasOwn(command, 'finishBy')) {
    if (!object(value.finishByBoundary)
      || value.finishByBoundary.finishBy !== command.finishBy
      || value.finishByBoundary.satisfied !== true
      || value.interval.after === null
      || value.interval.after.localEnd > command.finishBy) return false
  } else if (value.finishByBoundary !== null) return false

  if (command.action === 'create') {
    const start = `${command.workBlock.scheduledDate}T${command.workBlock.scheduledTime}`
    return value.interval.before === null
      && value.interval.after.localStart === start
      && value.interval.after.localEnd === localEnd(start, command.workBlock.duration)
      && value.timezone === command.workBlock.timezone
      && value.duration.beforeMinutes === null
      && value.duration.afterMinutes === command.workBlock.duration
  }
  if (command.action === 'move') {
    return object(value.interval.before)
      && value.interval.after.localStart === `${command.scheduledDate}T${command.scheduledTime}`
      && value.timezone === command.timezone
      && value.duration.beforeMinutes === value.duration.afterMinutes
  }
  if (command.action === 'resize') {
    return object(value.interval.before)
      && object(value.interval.after)
      && value.interval.before.localStart === value.interval.after.localStart
      && value.duration.afterMinutes === command.duration
  }
  return object(value.interval.before)
    && value.interval.after === null
    && value.duration.afterMinutes === null
}

function validPreview(data, taskId, body, command, workspaceId, expectedRequest, expectedHash) {
  if (!object(data)
    || data.ok !== true
    || data.status !== 'preview'
    || data.result !== 'preview'
    || data.requestHash !== expectedHash
    || !DIGEST_RE.test(data.previewDigest || '')
    || !timestamp(data.previewExpiresAt)
    || !object(data.normalizedPayload)
    || !validPreviewDetails(data.preview, taskId, command)
    || !validProjectedReadBack(data.readBack, taskId, body.baseRevision, command, body.workBlockRevision)) return false
  try {
    return canonicalHash(data.normalizedPayload) === canonicalHash(expectedRequest)
      && data.normalizedPayload.workspaceId === workspaceId
  } catch {
    return false
  }
}

function validCommittedReadBack(readBack, taskId, body, command, workspaceId) {
  if (!object(readBack)
    || readBack.id !== taskId
    || readBack.workspaceId !== workspaceId
    || readBack.canonicalRevision !== body.baseRevision + 1
    || !timestamp(readBack.canonicalUpdatedAt)
    || !validInstances(readBack.instances)) return false
  const target = readBack.instances.find(instance => instance.id === workBlockId(command))
  if (command.action === 'remove') {
    return readBack.workBlock === null
      && readBack.removedWorkBlockId === workBlockId(command)
      && target === undefined
  }
  if (readBack.removedWorkBlockId !== null
    || !matchesCommand(readBack.workBlock, command, taskId, body.workBlockRevision)
    || !target) return false
  try {
    return canonicalHash(target) === canonicalHash(readBack.workBlock)
  } catch {
    return false
  }
}

function validCommitted(data, taskId, body, command, workspaceId, expectedHash) {
  const receiptAction = `work_block_${command.action}`
  if (!object(data)
    || data.ok !== true
    || data.status !== 'committed'
    || data.result !== 'committed'
    || data.requestHash !== expectedHash
    || !object(data.receipt)
    || data.receipt.status !== data.status
    || data.receipt.requestHash !== data.requestHash
    || data.receipt.workBlockId !== workBlockId(command)) return false
  return validCanonicalReceipt(
    data.receipt,
    {
      contractVersion: CONTRACT_VERSION,
      operationId: body.operationId,
      source: SOURCE,
      status: 'committed',
      requestHash: expectedHash,
      entityType: 'task',
      action: receiptAction,
      entityId: taskId,
    },
    readBack => validCommittedReadBack(readBack, taskId, body, command, workspaceId),
    [canonicalHash],
  )
}

async function executeCanonicalWorkBlock(context, taskId, body, notifyTaskMutation) {
  if (context.signedUser === false) {
    return errorResult(401, 'signed_user_required', 'Canonical work-block writes require a signed-in user session')
  }
  const validated = validateRequest(taskId, body)
  if (validated.error) return validated.error
  const workspaceId = context.activeWorkspaceId
  if (Object.hasOwn(body, 'workspaceId') && body.workspaceId !== workspaceId) {
    return errorResult(409, 'workspace_mismatch', 'The requested workspace is not the active signed-in scope')
  }
  const expectedRequest = normalizedRequest(taskId, body, validated.command, workspaceId)
  let expectedHash
  try {
    expectedHash = canonicalHash(expectedRequest)
  } catch {
    return errorResult(400, 'invalid_request', 'The canonical work-block request is invalid')
  }

  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_work_block_v1', {
      p_base_revision: body.baseRevision,
      p_command: validated.command,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: body.operationId,
      p_preview: validated.preview,
      p_preview_digest: validated.preview ? null : body.previewDigest,
      p_preview_expires_at: validated.preview ? null : body.previewExpiresAt,
      p_source: SOURCE,
      p_task_id: taskId,
      p_work_block_revision: body.workBlockRevision,
      p_workspace_id: workspaceId,
    })
  } catch {
    return errorResult(500, 'canonical_work_block_failed', 'Work-block lifecycle request could not be completed')
  }
  const { data, error } = rpcResult || {}
  if (error || !object(data)) {
    return errorResult(500, 'canonical_work_block_failed', 'Work-block lifecycle request could not be completed')
  }
  if (data.ok !== true) {
    const code = object(data.error) && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }
  if (validated.preview) {
    if (!validPreview(data, taskId, body, validated.command, workspaceId, expectedRequest, expectedHash)) {
      return errorResult(502, 'invalid_canonical_response', 'Canonical work-block preview could not be verified')
    }
    return { status: 200, body: data }
  }
  if (!validCommitted(data, taskId, body, validated.command, workspaceId, expectedHash)) {
    return errorResult(502, 'invalid_canonical_receipt', 'Canonical work-block receipt could not be verified')
  }
  try {
    notifyTaskMutation('update', taskId)
  } catch {
    // The verified database commit remains authoritative if IPC reconciliation fails.
  }
  return { status: 200, body: data }
}

module.exports = { executeCanonicalWorkBlock }
