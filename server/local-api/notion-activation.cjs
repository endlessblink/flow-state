'use strict'

const { createHash } = require('node:crypto')

const CONTRACT_VERSION = 'notion-activation-v1'
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const ALLOWED_NOTION_FIELDS = new Set([
  'pageId',
  'dataSourceId',
  'url',
  'lastEditedAt',
])
const ALLOWED_TASK_FIELDS = new Set([
  'title',
  'description',
  'priority',
  'dueDate',
  'projectId',
])
const ALLOWED_WORK_BLOCK_FIELDS = new Set([
  'scheduledDate',
  'scheduledTime',
  'duration',
])
const ALLOWED_REQUEST_FIELDS = new Set([
  'operationId',
  'notion',
  'task',
  'workBlock',
  'preview',
  'previewDigest',
  'previewExpiresAt',
])
const VALID_PRIORITIES = new Set(['low', 'medium', 'high'])
const ERROR_STATUS = {
  invalid_request: 400,
  invalid_work_block: 400,
  not_authenticated: 401,
  project_not_found: 404,
  idempotency_conflict: 409,
  preview_mismatch: 409,
  preview_expired: 409,
}

function errorResult(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } }
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() === value && value.length > 0
}

function validTimestamp(value) {
  return nonEmptyString(value) && Number.isFinite(Date.parse(value))
}

function sameTimestamp(left, right) {
  return (
    validTimestamp(left) &&
    validTimestamp(right) &&
    Date.parse(left) === Date.parse(right)
  )
}

function onlyFields(value, allowed) {
  return (
    object(value) && Object.keys(value).every((field) => allowed.has(field))
  )
}

function canonicalJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (object(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function canonicalHash(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

function validWorkBlock(value) {
  if (value === undefined || value === null) return true
  return (
    onlyFields(value, ALLOWED_WORK_BLOCK_FIELDS) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.scheduledDate || '') &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value.scheduledTime || '') &&
    Number.isSafeInteger(value.duration) &&
    value.duration >= 1 &&
    value.duration <= 1440
  )
}

function validateRequest(body) {
  if (
    !object(body) ||
    !onlyFields(body, ALLOWED_REQUEST_FIELDS) ||
    !nonEmptyString(body.operationId) ||
    body.operationId.length > 160 ||
    !onlyFields(body.notion, ALLOWED_NOTION_FIELDS) ||
    !nonEmptyString(body.notion.pageId) ||
    !nonEmptyString(body.notion.dataSourceId) ||
    !nonEmptyString(body.notion.url) ||
    !body.notion.url.startsWith('https://') ||
    !validTimestamp(body.notion.lastEditedAt) ||
    !onlyFields(body.task, ALLOWED_TASK_FIELDS) ||
    !nonEmptyString(body.task.title) ||
    (body.task.description !== undefined &&
      body.task.description !== null &&
      typeof body.task.description !== 'string') ||
    (body.task.priority !== undefined &&
      body.task.priority !== null &&
      !VALID_PRIORITIES.has(body.task.priority)) ||
    (body.task.dueDate !== undefined &&
      body.task.dueDate !== null &&
      !validTimestamp(body.task.dueDate)) ||
    (body.task.projectId !== undefined &&
      body.task.projectId !== null &&
      !nonEmptyString(body.task.projectId)) ||
    !validWorkBlock(body.workBlock) ||
    (body.preview !== undefined && typeof body.preview !== 'boolean')
  ) {
    return errorResult(
      400,
      'invalid_request',
      'The Notion activation request is invalid',
    )
  }
  if (
    body.preview === false &&
    (!nonEmptyString(body.previewDigest) ||
      !validTimestamp(body.previewExpiresAt))
  ) {
    return errorResult(
      400,
      'approval_receipt_required',
      'operationId, previewDigest, and previewExpiresAt are required for apply',
    )
  }
  return null
}

function validProvenance(provenance, notion) {
  return (
    object(provenance) &&
    provenance.source === 'notion' &&
    provenance.externalId === notion.pageId &&
    provenance.dataSourceId === notion.dataSourceId &&
    provenance.url === notion.url &&
    sameTimestamp(provenance.lastEditedAt, notion.lastEditedAt)
  )
}

function sameWorkBlock(actual, requested) {
  if (requested === undefined || requested === null) return actual === null
  return (
    object(actual) &&
    actual.scheduledDate === requested.scheduledDate &&
    actual.scheduledTime === requested.scheduledTime &&
    actual.duration === requested.duration
  )
}

function validNormalizedTask(actual, requested) {
  return (
    object(actual) &&
    actual.title === requested.title &&
    actual.description === (requested.description ?? '') &&
    actual.priority === (requested.priority ?? null) &&
    (requested.dueDate == null
      ? actual.dueDate === null
      : sameTimestamp(actual.dueDate, requested.dueDate)) &&
    actual.projectId === (requested.projectId ?? null)
  )
}

function validPreview(data, body) {
  return (
    object(data) &&
    data.ok === true &&
    data.result === 'preview' &&
    data.contractVersion === CONTRACT_VERSION &&
    data.operationId === body.operationId &&
    typeof data.previewDigest === 'string' &&
    SHA256_HEX_RE.test(data.previewDigest) &&
    validTimestamp(data.previewExpiresAt) &&
    typeof data.alreadyActivated === 'boolean' &&
    object(data.normalizedPayload) &&
    data.normalizedPayload.operationId === body.operationId &&
    data.normalizedPayload.notionPageId === body.notion.pageId &&
    data.normalizedPayload.notionDataSourceId === body.notion.dataSourceId &&
    data.normalizedPayload.notionUrl === body.notion.url &&
    sameTimestamp(
      data.normalizedPayload.notionLastEditedAt,
      body.notion.lastEditedAt,
    ) &&
    validNormalizedTask(data.normalizedPayload.task, body.task) &&
    sameWorkBlock(data.normalizedPayload.workBlock, body.workBlock) &&
    (data.readBack === null || object(data.readBack))
  )
}

function containsWorkBlock(instances, workBlock) {
  if (workBlock === undefined || workBlock === null) return true
  return (
    Array.isArray(instances) &&
    instances.some(
      (instance) =>
        object(instance) &&
        instance.scheduledDate === workBlock.scheduledDate &&
        instance.scheduledTime === workBlock.scheduledTime &&
        instance.duration === workBlock.duration,
    )
  )
}

function validReceipt(receipt, body) {
  if (
    !object(receipt) ||
    receipt.contractVersion !== CONTRACT_VERSION ||
    receipt.operationId !== body.operationId ||
    receipt.source !== 'notion' ||
    receipt.entityType !== 'task' ||
    receipt.action !== 'activate' ||
    !nonEmptyString(receipt.entityId) ||
    receipt.externalId !== body.notion.pageId ||
    !Number.isSafeInteger(receipt.canonicalRevision) ||
    receipt.canonicalRevision < 1 ||
    !validTimestamp(receipt.canonicalUpdatedAt) ||
    !Number.isSafeInteger(receipt.changeSequence) ||
    receipt.changeSequence < 1 ||
    !validTimestamp(receipt.committedAt) ||
    typeof receipt.replayed !== 'boolean' ||
    !validProvenance(receipt.provenance, body.notion) ||
    !object(receipt.readBack) ||
    receipt.readBack.id !== receipt.entityId ||
    receipt.readBack.canonicalRevision !== receipt.canonicalRevision ||
    receipt.readBack.canonicalUpdatedAt !== receipt.canonicalUpdatedAt ||
    receipt.readBack.externalSource !== 'notion' ||
    receipt.readBack.externalId !== body.notion.pageId ||
    receipt.readBack.externalDataSourceId !== body.notion.dataSourceId ||
    receipt.readBack.externalUrl !== body.notion.url ||
    !sameTimestamp(
      receipt.readBack.externalLastEditedAt,
      body.notion.lastEditedAt,
    ) ||
    !validProvenance(receipt.readBack.provenance, body.notion) ||
    !validNormalizedTask(receipt.readBack, body.task) ||
    !containsWorkBlock(receipt.readBack.instances, body.workBlock) ||
    typeof receipt.readBackHash !== 'string' ||
    !SHA256_HEX_RE.test(receipt.readBackHash) ||
    receipt.readBackHash !== canonicalHash(receipt.readBack)
  ) {
    return false
  }
  return true
}

async function executeNotionActivation(context, body, notifyTaskMutation) {
  if (context.signedUser === false) {
    return errorResult(
      401,
      'signed_user_required',
      'Notion activation requires a signed-in user session',
    )
  }
  if (context.activeWorkspaceId !== null) {
    return errorResult(
      409,
      'personal_scope_required',
      'Notion activation requires personal FlowState scope',
    )
  }
  const invalid = validateRequest(body)
  if (invalid) return invalid

  const preview = body.preview !== false
  let rpcResult
  try {
    rpcResult = await context.supabase.rpc(
      'flowstate_activate_notion_task_v1',
      {
        p_operation_id: body.operationId,
        p_notion: body.notion,
        p_task: body.task,
        p_work_block: body.workBlock || null,
        p_preview: preview,
        p_preview_digest: preview ? null : body.previewDigest,
        p_preview_expires_at: preview ? null : body.previewExpiresAt,
      },
    )
  } catch {
    return errorResult(
      500,
      'notion_activation_failed',
      'Notion activation could not be completed',
    )
  }

  const { data, error } = rpcResult || {}
  if (error || !object(data)) {
    return errorResult(
      500,
      'notion_activation_failed',
      'Notion activation could not be completed',
    )
  }
  if (data.ok !== true) {
    const code =
      object(data.error) && typeof data.error.code === 'string'
        ? data.error.code
        : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }
  if (preview) {
    if (!validPreview(data, body)) {
      return errorResult(
        502,
        'invalid_canonical_response',
        'Canonical activation preview could not be verified',
      )
    }
    return { status: 200, body: data }
  }
  if (data.result !== 'committed' || !validReceipt(data.receipt, body)) {
    return errorResult(
      502,
      'invalid_canonical_receipt',
      'Canonical activation receipt could not be verified',
    )
  }

  try {
    notifyTaskMutation(
      data.receipt.alreadyActivated ? 'update' : 'create',
      data.receipt.entityId,
    )
  } catch {
    // The canonical commit is durable; renderer reconciliation is best-effort.
  }
  return { status: 200, body: data }
}

module.exports = { executeNotionActivation }
