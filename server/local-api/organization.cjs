'use strict'

const { validateAffectedTaskEntry, validateCanonicalReceipt } = require('./canonical-receipt.cjs')

const CONTRACT_VERSION = 'task-v1'
const INVENTORY_CONTRACT_VERSION = 'organization-inventory-v1'
const SOURCE = 'local-api'
const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const ACTIONS = new Set(['assign_project', 'set_canvas_group'])
const ERROR_STATUS = {
  invalid_request: 400,
  approval_receipt_required: 400,
  not_authenticated: 401,
  signed_user_required: 401,
  scope_denied: 403,
  task_not_found: 404,
  project_not_found: 404,
  group_not_found: 404,
  stale_revision: 409,
  idempotency_conflict: 409,
  request_hash_required: 409,
  request_hash_mismatch: 409,
  preview_mismatch: 409,
  preview_expired: 409,
  unsupported_smart_group: 409,
  invalid_task_position: 409,
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

function timestamp(value) {
  return nonEmptyString(value) && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))
}

function digest(value) {
  return typeof value === 'string' && SHA256_HEX_RE.test(value)
}

function errorResult(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } }
}

async function verifyWorkspaceAccess(supabase, workspaceId) {
  return await supabase.rpc('flowstate_can_read_workspace_v1', {
    p_workspace_id: workspaceId,
  })
}

function scopeQuery(context, query) {
  return context.activeWorkspaceId === null
    ? query.eq('user_id', context.userId).is('workspace_id', null)
    : query.eq('workspace_id', context.activeWorkspaceId)
}

async function fetchProjects(context) {
  let query = context.supabase
    .from('projects')
    .select('id,name,color,color_type,parent_id,workspace_id,updated_at')
    .eq('is_deleted', false)
  query = scopeQuery(context, query)
  return await query.order('name', { ascending: true }).order('id', { ascending: true })
}

async function fetchGroups(context) {
  let query = context.supabase
    .from('groups')
    .select(
      'id,name,type,parent_group_id,workspace_id,is_power_mode,auto_collect,filters_json,power_keyword_json,assign_on_drop_json,collect_filter_json,updated_at',
    )
    .eq('is_deleted', false)
  query = scopeQuery(context, query)
  return await query.order('name', { ascending: true }).order('id', { ascending: true })
}

function smartGroup(row) {
  return (
    row.type !== 'custom' ||
    row.is_power_mode !== false ||
    row.auto_collect !== false ||
    row.filters_json != null ||
    row.power_keyword_json != null ||
    row.assign_on_drop_json != null ||
    row.collect_filter_json != null
  )
}

function mapProject(row, workspaceId) {
  if (
    !object(row) ||
    !nonEmptyString(row.id) ||
    !nonEmptyString(row.name) ||
    row.workspace_id !== workspaceId ||
    !timestamp(row.updated_at)
  )
    return null
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id ?? null,
    color: row.color ?? null,
    colorType: row.color_type ?? null,
    workspaceId,
    updatedAt: row.updated_at,
  }
}

function mapGroup(row, workspaceId) {
  if (
    !object(row) ||
    !nonEmptyString(row.id) ||
    !nonEmptyString(row.name) ||
    row.workspace_id !== workspaceId ||
    !timestamp(row.updated_at)
  )
    return null
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    parentGroupId: row.parent_group_id ?? null,
    workspaceId,
    assignmentMode: smartGroup(row) ? 'unsupported_smart' : 'plain',
    updatedAt: row.updated_at,
  }
}

async function readOrganizationInventory(context, deps = {}) {
  if (!context?.signedUser || !nonEmptyString(context.userId)) {
    return errorResult(401, 'signed_user_required', 'Organization inventory requires a signed-in user session')
  }
  if (context.activeWorkspaceId !== null && !nonEmptyString(context.activeWorkspaceId)) {
    return errorResult(400, 'invalid_request', 'The active organization scope is invalid')
  }

  const checkWorkspace = deps.verifyWorkspaceAccess || verifyWorkspaceAccess
  const readProjects = deps.fetchProjects || fetchProjects
  const readGroups = deps.fetchGroups || fetchGroups
  if (context.activeWorkspaceId !== null) {
    let authority
    try {
      authority = await checkWorkspace(context.supabase, context.activeWorkspaceId)
    } catch {
      return errorResult(500, 'inventory_read_failed', 'Organization inventory could not verify workspace access')
    }
    if (authority?.error) {
      return errorResult(500, 'inventory_read_failed', 'Organization inventory could not verify workspace access')
    }
    if (authority?.data !== true) {
      return errorResult(403, 'scope_denied', 'Workspace read access is required')
    }
  }

  let projectsResult
  let groupsResult
  try {
    ;[projectsResult, groupsResult] = await Promise.all([readProjects(context), readGroups(context)])
  } catch {
    return errorResult(500, 'inventory_read_failed', 'Organization inventory could not be read')
  }
  if (projectsResult?.error || groupsResult?.error) {
    return errorResult(500, 'inventory_read_failed', 'Organization inventory could not be read')
  }

  const projects = (projectsResult?.data || []).map((row) => mapProject(row, context.activeWorkspaceId))
  const groups = (groupsResult?.data || []).map((row) => mapGroup(row, context.activeWorkspaceId))
  if (projects.includes(null) || groups.includes(null)) {
    return errorResult(502, 'invalid_canonical_response', 'Organization inventory contained invalid scoped data')
  }
  return {
    status: 200,
    body: {
      ok: true,
      fresh: true,
      contractVersion: INVENTORY_CONTRACT_VERSION,
      scopeKind: context.activeWorkspaceId === null ? 'personal' : 'workspace',
      workspaceId: context.activeWorkspaceId,
      projects,
      groups,
    },
  }
}

function validateRequest(action, taskId, body) {
  const allowedFields = new Set([
    'baseRevision',
    'operationId',
    'preview',
    action === 'assign_project' ? 'projectId' : 'groupId',
    ...(body?.preview === false ? ['previewDigest', 'previewExpiresAt', 'requestHash'] : []),
  ])
  if (
    !ACTIONS.has(action) ||
    !nonEmptyString(taskId) ||
    !object(body) ||
    (body.preview !== undefined && typeof body.preview !== 'boolean') ||
    !nonEmptyString(body.operationId) ||
    !positiveInteger(body.baseRevision) ||
    Object.keys(body).some((key) => !allowedFields.has(key))
  ) {
    return errorResult(400, 'invalid_request', 'The canonical organization request is invalid')
  }
  const targetId = action === 'assign_project' ? body.projectId : body.groupId
  if (!nonEmptyString(targetId)) {
    return errorResult(400, 'invalid_request', 'An exact organization target ID is required')
  }
  if (
    body.preview === false &&
    (!digest(body.previewDigest) || !timestamp(body.previewExpiresAt) || !digest(body.requestHash))
  ) {
    return errorResult(
      400,
      'approval_receipt_required',
      'previewDigest, previewExpiresAt, and requestHash are required for apply',
    )
  }
  return null
}

function expectedTarget(action, body) {
  return action === 'assign_project'
    ? { field: 'projectId', value: body.projectId }
    : { field: 'groupId', value: body.groupId }
}

function readBackMatches(action, readBack, taskId, baseRevision, workspaceId, targetId) {
  if (
    !object(readBack) ||
    readBack.id !== taskId ||
    readBack.workspaceId !== workspaceId ||
    readBack.canonicalRevision !== baseRevision
  )
    return false
  if (action === 'assign_project') return readBack.projectId === targetId
  return object(readBack.position)
    && Number.isFinite(readBack.position.x)
    && Number.isFinite(readBack.position.y)
    && readBack.position.parentId === targetId
    && readBack.isInInbox === false
}

function validPreview(data, action, taskId, body, workspaceId) {
  const target = expectedTarget(action, body)
  return Boolean(
    object(data) &&
    data.ok === true &&
    data.result === 'preview' &&
    data.preview === true &&
    data.contractVersion === CONTRACT_VERSION &&
    data.operationId === body.operationId &&
    data.action === action &&
    data.taskId === taskId &&
    data.baseRevision === body.baseRevision &&
    digest(data.requestHash) &&
    digest(data.previewDigest) &&
    timestamp(data.previewExpiresAt) &&
    object(data.normalizedPayload) &&
    data.normalizedPayload.taskId === taskId &&
    data.normalizedPayload[target.field] === target.value &&
    readBackMatches(action, data.readBack, taskId, body.baseRevision, workspaceId, target.value),
  )
}

function validCommitted(data, action, taskId, body, workspaceId) {
  if (
    !object(data) ||
    data.ok !== true ||
    data.result !== 'committed' ||
    data.requestHash !== body.requestHash ||
    !object(data.receipt)
  )
    return false
  const receipt = data.receipt
  const target = expectedTarget(action, body)
  const primary = Array.isArray(receipt.affected) && receipt.affected.length === 1 ? receipt.affected[0] : null
  const primaryValid = Boolean(
    primary &&
    validateAffectedTaskEntry(primary, { entityId: taskId, action: 'update' }).ok &&
    primary.canonicalRevision === receipt.canonicalRevision &&
    primary.changeSequence === receipt.changeSequence,
  )
  const contextValid = Boolean(
    object(receipt.operationContext) &&
    receipt.operationContext.action === action &&
    receipt.operationContext.taskId === taskId &&
    receipt.operationContext.baseRevision === body.baseRevision &&
    receipt.operationContext.workspaceId === workspaceId &&
    receipt.operationContext[target.field] === target.value,
  )
  const validation = validateCanonicalReceipt(receipt, {
    bindPrimaryAffectedReadBack: true,
    expectedOperationId: body.operationId,
    expectedRequestHash: body.requestHash,
    expectedFields: {
      contractVersion: CONTRACT_VERSION,
      source: SOURCE,
      entityType: 'task',
      action,
      entityId: taskId,
    },
    validateReadBack: (readBack) =>
      primaryValid &&
      contextValid &&
      readBackMatches(action, readBack, taskId, receipt.canonicalRevision, workspaceId, target.value) &&
      readBack.canonicalUpdatedAt === receipt.canonicalUpdatedAt,
  })
  return validation.ok
}

async function executeOrganizationCommand(context, action, taskId, body, notifyTaskMutation) {
  if (!context?.signedUser || !nonEmptyString(context.userId)) {
    return errorResult(401, 'signed_user_required', 'Organization changes require a signed-in user session')
  }
  if (context.activeWorkspaceId !== null && !nonEmptyString(context.activeWorkspaceId)) {
    return errorResult(400, 'invalid_request', 'The active organization scope is invalid')
  }
  const invalid = validateRequest(action, taskId, body)
  if (invalid) return invalid
  const preview = body.preview !== false
  const target = expectedTarget(action, body)
  let rpcResult
  try {
    rpcResult = await context.supabase.rpc('flowstate_organization_task_v1', {
      p_action: action,
      p_base_revision: body.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: body.operationId,
      p_preview: preview,
      p_preview_digest: preview ? null : body.previewDigest,
      p_preview_expires_at: preview ? null : body.previewExpiresAt,
      p_request_hash: preview ? null : body.requestHash,
      p_source: SOURCE,
      p_target_id: target.value,
      p_task_id: taskId,
      p_workspace_id: context.activeWorkspaceId,
    })
  } catch {
    return errorResult(500, 'organization_command_failed', 'Organization change could not be completed')
  }
  const { data, error } = rpcResult || {}
  if (error || !object(data)) {
    return errorResult(500, 'organization_command_failed', 'Organization change could not be completed')
  }
  if (data.ok !== true) {
    const code = object(data.error) && typeof data.error.code === 'string' ? data.error.code : ''
    return { status: ERROR_STATUS[code] || 500, body: data }
  }
  if (preview) {
    if (!validPreview(data, action, taskId, body, context.activeWorkspaceId)) {
      return errorResult(502, 'invalid_canonical_response', 'Canonical organization preview could not be verified')
    }
    return { status: 200, body: data }
  }
  if (!validCommitted(data, action, taskId, body, context.activeWorkspaceId)) {
    return errorResult(502, 'invalid_canonical_receipt', 'Canonical organization receipt could not be verified')
  }
  if (!data.receipt.replayed) {
    try {
      notifyTaskMutation('update', taskId)
    } catch {
      // Durable canonical success is authoritative; renderer refresh is best-effort.
    }
  }
  return { status: 200, body: data }
}

module.exports = {
  executeOrganizationCommand,
  readOrganizationInventory,
}
