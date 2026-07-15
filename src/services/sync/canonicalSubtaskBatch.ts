const CONTRACT_VERSION = 'task-v1' as const
const SOURCE = 'web-pwa' as const
const SHA256_HEX = /^[0-9a-f]{64}$/

export type CanonicalSubtaskOperation =
  | {
      kind: 'create'
      clientId: string
      title: string
      description?: string
      doneEnough?: string | null
      estimateMinutes?: number | null
      completedPomodoros?: number
      canvasPosition?: { x: number; y: number } | null
      isCompleted?: boolean
      order?: number
    }
  | {
      kind: 'update'
      subtaskId: string
      title?: string
      description?: string
      doneEnough?: string | null
      estimateMinutes?: number | null
      completedPomodoros?: number
      canvasPosition?: { x: number; y: number } | null
      isCompleted?: boolean
      order?: number
    }
  | { kind: 'delete'; subtaskId: string }

export type CanonicalSubtaskBatchRequest = {
  taskId: string
  workspaceId: string | null
  baseRevision: number
  operationId: string
  operations: CanonicalSubtaskOperation[]
}

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

type CanonicalReadBack = {
  id: string
  workspaceId: string | null
  canonicalRevision: number
  canonicalUpdatedAt: string
  status: string
  subtasks: Array<Record<string, unknown>>
  [key: string]: unknown
}

export type CanonicalSubtaskBatchResult = {
  receipt: Record<string, unknown>
  readBack: CanonicalReadBack
}

export class CanonicalSubtaskError extends Error {
  code: string
  currentRevision?: number

  constructor(code: string, message: string, currentRevision?: number) {
    super(message)
    this.name = 'CanonicalSubtaskError'
    this.code = code
    this.currentRevision = currentRevision
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON cannot contain a non-finite number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (object(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  throw new TypeError('canonical JSON contains an unsupported value')
}

export async function canonicalJsonHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return canonicalJson(left) === canonicalJson(right)
  } catch {
    return false
  }
}

function normalizedOperationsMatch(
  returned: unknown,
  requested: CanonicalSubtaskOperation[],
): boolean {
  return Array.isArray(returned)
    && returned.length === requested.length
    && requested.every((operation, index) => {
      const normalized = returned[index]
      return object(normalized)
        && normalized.kind === operation.kind
        && Object.entries(operation).every(([key, value]) => sameJson(normalized[key], value))
    })
}

function rejected(data: Record<string, unknown>): never {
  const error = object(data.error) ? data.error : {}
  const code = typeof error.code === 'string' ? error.code : 'canonical_subtask_rejected'
  const message = typeof error.message === 'string' ? error.message : 'Canonical subtask batch was rejected'
  throw new CanonicalSubtaskError(
    code,
    message,
    positiveInteger(error.currentRevision) ? error.currentRevision : undefined,
  )
}

function validReadBack(
  value: unknown,
  request: CanonicalSubtaskBatchRequest,
  revision: number,
): value is CanonicalReadBack {
  return object(value)
    && value.id === request.taskId
    && value.workspaceId === request.workspaceId
    && value.canonicalRevision === revision
    && typeof value.status === 'string'
    && value.status.length > 0
    && timestamp(value.canonicalUpdatedAt)
    && Array.isArray(value.subtasks)
}

function operationsReflected(
  operations: CanonicalSubtaskOperation[],
  subtasks: Array<Record<string, unknown>>,
): boolean {
  return operations.every(operation => {
    if (operation.kind === 'delete') {
      return !subtasks.some(subtask => subtask.id === operation.subtaskId)
    }
    const identityKey = operation.kind === 'create' ? 'clientId' : 'id'
    const identity = operation.kind === 'create' ? operation.clientId : operation.subtaskId
    const index = subtasks.findIndex(subtask => subtask[identityKey] === identity)
    if (index === -1) return false
    const subtask = subtasks[index]
    const fields = [
      'title', 'description', 'doneEnough', 'estimateMinutes',
      'completedPomodoros', 'canvasPosition', 'isCompleted',
    ] as const
    if (fields.some(field => {
      if (!(field in operation)) return false
      return operation[field] === null
        ? subtask[field] != null
        : !sameJson(subtask[field], operation[field])
    })) return false
    return operation.order === undefined || index === operation.order
  })
}

function validPreview(value: unknown, request: CanonicalSubtaskBatchRequest): value is Record<string, unknown> & {
  requestHash: string
  previewDigest: string
  previewExpiresAt: string
} {
  if (!object(value)) return false
  const normalized = value.normalizedPayload
  return value.ok === true
    && value.result === 'preview'
    && value.contractVersion === CONTRACT_VERSION
    && value.action === 'subtask_batch'
    && value.operationId === request.operationId
    && value.taskId === request.taskId
    && value.baseRevision === request.baseRevision
    && typeof value.requestHash === 'string'
    && SHA256_HEX.test(value.requestHash)
    && typeof value.previewDigest === 'string'
    && SHA256_HEX.test(value.previewDigest)
    && timestamp(value.previewExpiresAt)
    && object(normalized)
    && normalized.taskId === request.taskId
    && normalizedOperationsMatch(normalized.operations, request.operations)
    && validReadBack(value.readBack, request, request.baseRevision)
}

async function validReceipt(
  value: unknown,
  request: CanonicalSubtaskBatchRequest,
  requestHash: string,
): Promise<boolean> {
  if (!object(value)) return false
  const revision = value.canonicalRevision
  if (
    value.ok !== true
    || !['committed', 'replayed'].includes(String(value.status))
    || value.contractVersion !== CONTRACT_VERSION
    || value.operationId !== request.operationId
    || value.requestHash !== requestHash
    || value.source !== SOURCE
    || value.entityType !== 'task'
    || value.action !== 'subtask_batch'
    || value.entityId !== request.taskId
    || !positiveInteger(revision)
    || !timestamp(value.canonicalUpdatedAt)
    || !positiveInteger(value.changeSequence)
    || !timestamp(value.committedAt)
    || !validReadBack(value.readBack, request, revision)
    || !operationsReflected(request.operations, value.readBack.subtasks)
    || value.readBack.canonicalUpdatedAt !== value.canonicalUpdatedAt
    || !Array.isArray(value.affected)
    || value.affected.length !== 1
  ) return false

  const affected = value.affected[0]
  if (
    !object(affected)
    || affected.entityType !== 'task'
    || affected.entityId !== request.taskId
    || affected.action !== 'update'
    || affected.canonicalRevision !== revision
    || affected.changeSequence !== value.changeSequence
    || !sameJson(affected.readBack, value.readBack)
    || typeof affected.readBackHash !== 'string'
    || typeof value.readBackHash !== 'string'
  ) return false
  try {
    const hash = await canonicalJsonHash(value.readBack)
    return value.readBackHash === hash && affected.readBackHash === hash
  } catch {
    return false
  }
}

function rpcArgs(
  request: CanonicalSubtaskBatchRequest,
  preview: boolean,
  approval?: { previewDigest: string; previewExpiresAt: string; requestHash: string },
) {
  return {
    p_base_revision: request.baseRevision,
    p_contract_version: CONTRACT_VERSION,
    p_operation_id: request.operationId,
    p_operations: request.operations,
    p_preview: preview,
    p_preview_digest: approval?.previewDigest ?? null,
    p_preview_expires_at: approval?.previewExpiresAt ?? null,
    p_request_hash: approval?.requestHash ?? null,
    p_source: SOURCE,
    p_task_id: request.taskId,
    p_workspace_id: request.workspaceId,
  }
}

async function call(client: RpcClient, request: CanonicalSubtaskBatchRequest, args: Record<string, unknown>) {
  try {
    const response = await client.rpc('flowstate_subtask_batch_v1', args)
    if (response.error || !object(response.data)) {
      throw new CanonicalSubtaskError('canonical_subtask_transport_failed', 'Canonical subtask authority is unavailable')
    }
    if (response.data.ok !== true) rejected(response.data)
    return response.data
  } catch (error) {
    if (error instanceof CanonicalSubtaskError) throw error
    throw new CanonicalSubtaskError('canonical_subtask_transport_failed', 'Canonical subtask authority is unavailable')
  }
}

export async function executeCanonicalSubtaskBatch(
  client: RpcClient,
  request: CanonicalSubtaskBatchRequest,
): Promise<CanonicalSubtaskBatchResult> {
  const preview = await call(client, request, rpcArgs(request, true))
  if (!validPreview(preview, request)) {
    throw new CanonicalSubtaskError('invalid_canonical_subtask_preview', 'Canonical subtask preview is invalid')
  }
  const approval = {
    previewDigest: preview.previewDigest,
    previewExpiresAt: preview.previewExpiresAt,
    requestHash: preview.requestHash,
  }
  const applied = await call(client, request, rpcArgs(request, false, approval))
  if (
    applied.result !== 'committed'
    || applied.operationId !== request.operationId
    || applied.action !== 'subtask_batch'
    || applied.taskId !== request.taskId
    || applied.requestHash !== approval.requestHash
    || !(await validReceipt(applied.receipt, request, approval.requestHash))
  ) {
    throw new CanonicalSubtaskError('invalid_canonical_subtask_receipt', 'Canonical subtask receipt is invalid')
  }
  const receipt = applied.receipt as Record<string, unknown> & { readBack: CanonicalReadBack }
  return { receipt, readBack: receipt.readBack }
}
