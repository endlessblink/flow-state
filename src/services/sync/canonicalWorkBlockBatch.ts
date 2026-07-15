const CONTRACT_VERSION = 'task-v1' as const
const SOURCE = 'web-pwa' as const
const SHA256_HEX = /^[0-9a-f]{64}$/
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const OFFSET_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/

type WorkBlockIdentity = { taskId: string; baseRevision: number }

export type CanonicalWorkBlockOperation = WorkBlockIdentity & (
  | {
      kind: 'create'
      clientId: string
      scheduledDate: string
      scheduledTime: string
      duration: number
    }
  | {
      kind: 'move'
      workBlockId: string
      baseWorkBlockHash: string
      scheduledDate: string
      scheduledTime: string
      duration?: number
    }
  | {
      kind: 'resize'
      workBlockId: string
      baseWorkBlockHash: string
      duration: number
    }
  | {
      kind: 'remove'
      workBlockId: string
      baseWorkBlockHash: string
    }
)

export type CanonicalWorkBlockBatchRequest = {
  workspaceId: string | null
  operationId: string
  timeZone: string
  finishBy?: string | null
  operations: CanonicalWorkBlockOperation[]
}

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

export type CanonicalWorkBlockReadBack = {
  id: string
  workspaceId: string | null
  canonicalRevision: number
  canonicalUpdatedAt: string
  status: string
  isInInbox: boolean
  instances: Array<Record<string, unknown>>
  [key: string]: unknown
}

export type CanonicalWorkBlockBatchResult = {
  receipt: Record<string, unknown>
  readBack: CanonicalWorkBlockReadBack[]
  overlapWarnings: Array<Record<string, unknown>>
}

export class CanonicalWorkBlockError extends Error {
  code: string
  currentRevision?: number
  taskId?: string

  constructor(code: string, message: string, currentRevision?: number, taskId?: string) {
    super(message)
    this.name = 'CanonicalWorkBlockError'
    this.code = code
    this.currentRevision = currentRevision
    this.taskId = taskId
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

function offsetTimestamp(value: unknown): value is string {
  return typeof value === 'string' && OFFSET_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
}

function sameInstant(left: unknown, right: unknown): boolean {
  if (left == null || right == null) return left == null && right == null
  return offsetTimestamp(left) && offsetTimestamp(right) && Date.parse(left) === Date.parse(right)
}

function realDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = DATE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 100) return false
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone.length > 0
  } catch {
    return false
  }
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

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return canonicalJson(left) === canonicalJson(right)
  } catch {
    return false
  }
}

export async function canonicalWorkBlockJsonHash(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function invalidRequest(message: string): never {
  throw new CanonicalWorkBlockError('invalid_work_block_request', message)
}

function assertRequest(request: CanonicalWorkBlockBatchRequest) {
  if (!request.operationId.trim() || request.operationId.length > 200) invalidRequest('operationId is required')
  if (!validTimeZone(request.timeZone)) invalidRequest('A valid IANA timezone is required')
  if (request.finishBy != null && !offsetTimestamp(request.finishBy)) {
    invalidRequest('finishBy must be an ISO timestamp with an explicit offset')
  }
  if (!Array.isArray(request.operations) || request.operations.length < 1 || request.operations.length > 50) {
    invalidRequest('One to fifty work-block operations are required')
  }
  const targets = new Set<string>()
  for (const operation of request.operations) {
    if (!operation.taskId?.trim() || !positiveInteger(operation.baseRevision)) invalidRequest('Each operation requires a task and revision')
    if (!['create', 'move', 'resize', 'remove'].includes(operation.kind)) invalidRequest('Unsupported work-block operation')
    if (operation.kind === 'create') {
      if (!operation.clientId?.trim() || operation.clientId.length > 160) invalidRequest('Create requires clientId')
      if (!realDate(operation.scheduledDate) || !TIME.test(operation.scheduledTime)) invalidRequest('Create requires a valid local interval')
      if (!positiveInteger(operation.duration) || operation.duration > 1440) invalidRequest('Duration must be between 1 and 1440 minutes')
      if (targets.has(`client:${operation.taskId}:${operation.clientId}`)) invalidRequest('Duplicate create identity')
      targets.add(`client:${operation.taskId}:${operation.clientId}`)
      continue
    }
    if (!operation.workBlockId?.trim() || !SHA256_HEX.test(operation.baseWorkBlockHash)) invalidRequest('Mutation requires exact work-block identity')
    if (targets.has(`block:${operation.taskId}:${operation.workBlockId}`)) invalidRequest('Only one operation per work block is allowed')
    targets.add(`block:${operation.taskId}:${operation.workBlockId}`)
    if (operation.kind === 'move' && (!realDate(operation.scheduledDate) || !TIME.test(operation.scheduledTime))) {
      invalidRequest('Move requires a valid local interval')
    }
    if (operation.kind === 'move' && operation.duration !== undefined
      && (!positiveInteger(operation.duration) || operation.duration > 1440)) {
      invalidRequest('Duration must be between 1 and 1440 minutes')
    }
    if (operation.kind === 'resize' && (!positiveInteger(operation.duration) || operation.duration > 1440)) {
      invalidRequest('Duration must be between 1 and 1440 minutes')
    }
  }
}

function normalizedOperationsMatch(returned: unknown, requested: CanonicalWorkBlockOperation[]): boolean {
  return Array.isArray(returned)
    && returned.length === requested.length
    && requested.every((operation, index) => {
      const normalized = returned[index]
      return object(normalized)
        && Object.entries(operation).every(([key, value]) => sameJson(normalized[key], value))
        && (operation.kind !== 'create'
          || (typeof normalized.workBlockId === 'string' && normalized.workBlockId.length > 0))
    })
}

function rejected(data: Record<string, unknown>): never {
  const error = object(data.error) ? data.error : {}
  throw new CanonicalWorkBlockError(
    typeof error.code === 'string' ? error.code : 'canonical_work_block_rejected',
    typeof error.message === 'string' ? error.message : 'Canonical work-block batch was rejected',
    positiveInteger(error.currentRevision) ? error.currentRevision : undefined,
    typeof error.taskId === 'string' ? error.taskId : undefined,
  )
}

function requestTasks(request: CanonicalWorkBlockBatchRequest) {
  const revisions = new Map<string, number>()
  for (const operation of request.operations) {
    const current = revisions.get(operation.taskId)
    if (current !== undefined && current !== operation.baseRevision) invalidRequest('One parent cannot carry conflicting revisions')
    revisions.set(operation.taskId, operation.baseRevision)
  }
  return revisions
}

function validReadBacks(
  value: unknown,
  request: CanonicalWorkBlockBatchRequest,
  applied: boolean,
): value is CanonicalWorkBlockReadBack[] {
  if (!Array.isArray(value)) return false
  const revisions = requestTasks(request)
  if (value.length !== revisions.size) return false
  return [...revisions.entries()].every(([taskId, baseRevision]) => {
    const task = value.find(candidate => object(candidate) && candidate.id === taskId)
    return object(task)
      && task.workspaceId === request.workspaceId
      && positiveInteger(task.canonicalRevision)
      && (applied ? task.canonicalRevision > baseRevision : task.canonicalRevision === baseRevision)
      && typeof task.status === 'string'
      && typeof task.isInInbox === 'boolean'
      && timestamp(task.canonicalUpdatedAt)
      && Array.isArray(task.instances)
  })
}

function operationsReflected(
  operations: CanonicalWorkBlockOperation[],
  readBack: CanonicalWorkBlockReadBack[],
): boolean {
  return operations.every(operation => {
    const task = readBack.find(candidate => candidate.id === operation.taskId)
    if (!task) return false
    if (operation.kind === 'create') {
      return task.instances.some(block => block.clientId === operation.clientId
        && block.scheduledDate === operation.scheduledDate
        && block.scheduledTime === operation.scheduledTime
        && block.duration === operation.duration)
    }
    const block = task.instances.find(candidate => candidate.id === operation.workBlockId)
    if (operation.kind === 'remove') return block === undefined
    if (!block) return false
    if (operation.kind === 'move') {
      return block.scheduledDate === operation.scheduledDate
        && block.scheduledTime === operation.scheduledTime
        && (operation.duration === undefined || block.duration === operation.duration)
    }
    return block.duration === operation.duration
  })
}

function validPreview(value: unknown, request: CanonicalWorkBlockBatchRequest): value is Record<string, unknown> & {
  requestHash: string
  previewDigest: string
  previewExpiresAt: string
  overlapWarnings: Array<Record<string, unknown>>
} {
  if (!object(value)) return false
  const normalized = value.normalizedPayload
  return value.ok === true
    && value.result === 'preview'
    && value.contractVersion === CONTRACT_VERSION
    && value.action === 'work_block_batch'
    && value.operationId === request.operationId
    && value.workspaceId === request.workspaceId
    && value.timeZone === request.timeZone
    && sameInstant(value.finishBy ?? null, request.finishBy ?? null)
    && typeof value.requestHash === 'string' && SHA256_HEX.test(value.requestHash)
    && typeof value.previewDigest === 'string' && SHA256_HEX.test(value.previewDigest)
    && timestamp(value.previewExpiresAt)
    && object(normalized)
    && normalized.timeZone === request.timeZone
    && Object.prototype.hasOwnProperty.call(normalized, 'finishBy')
    && sameInstant(normalized.finishBy ?? null, request.finishBy ?? null)
    && normalizedOperationsMatch(normalized.operations, request.operations)
    && Array.isArray(value.overlapWarnings)
    && value.overlapWarnings.every(object)
    && validReadBacks(value.readBack, request, false)
}

async function validReceipt(
  value: unknown,
  request: CanonicalWorkBlockBatchRequest,
  requestHash: string,
): Promise<boolean> {
  if (!object(value) || !validReadBacks(value.readBack, request, true)) return false
  const readBack = value.readBack
  const taskIds = [...requestTasks(request).keys()]
  const receiptStatus = String(value.status)
  if (
    value.ok !== true
    || !['committed', 'replayed'].includes(receiptStatus)
    || value.contractVersion !== CONTRACT_VERSION
    || value.operationId !== request.operationId
    || value.requestHash !== requestHash
    || value.source !== SOURCE
    || value.entityType !== 'batch'
    || value.entityId !== request.operationId
    || value.action !== 'work_block_batch'
    || !positiveInteger(value.canonicalRevision)
    || !positiveInteger(value.changeSequence)
    || typeof value.replayed !== 'boolean'
    || (receiptStatus === 'replayed') !== value.replayed
    || !timestamp(value.committedAt)
    || !Array.isArray(value.affected)
    || value.affected.length !== taskIds.length
    || !operationsReflected(request.operations, readBack)
    || typeof value.readBackHash !== 'string'
  ) return false
  try {
    if (value.readBackHash !== await canonicalWorkBlockJsonHash(readBack)) return false
    for (const taskId of taskIds) {
      const task = readBack.find(candidate => candidate.id === taskId)
      const affected = value.affected.find(candidate => object(candidate) && candidate.entityId === taskId)
      if (!task || !object(affected)
        || affected.entityType !== 'task'
        || affected.action !== 'update'
        || affected.canonicalRevision !== task.canonicalRevision
        || !positiveInteger(affected.changeSequence)
        || !sameJson(affected.readBack, task)
        || affected.readBackHash !== await canonicalWorkBlockJsonHash(task)) return false
    }
    return true
  } catch {
    return false
  }
}

function rpcArgs(
  request: CanonicalWorkBlockBatchRequest,
  preview: boolean,
  approval?: { previewDigest: string; previewExpiresAt: string; requestHash: string },
) {
  return {
    p_contract_version: CONTRACT_VERSION,
    p_finish_by: request.finishBy ?? null,
    p_operation_id: request.operationId,
    p_operations: request.operations,
    p_preview: preview,
    p_preview_digest: approval?.previewDigest ?? null,
    p_preview_expires_at: approval?.previewExpiresAt ?? null,
    p_request_hash: approval?.requestHash ?? null,
    p_source: SOURCE,
    p_time_zone: request.timeZone,
    p_workspace_id: request.workspaceId,
  }
}

async function call(client: RpcClient, args: Record<string, unknown>) {
  try {
    const response = await client.rpc('flowstate_work_block_batch_v1', args)
    if (response.error || !object(response.data)) {
      throw new CanonicalWorkBlockError('canonical_work_block_transport_failed', 'Canonical work-block authority is unavailable')
    }
    if (response.data.ok !== true) rejected(response.data)
    return response.data
  } catch (error) {
    if (error instanceof CanonicalWorkBlockError) throw error
    throw new CanonicalWorkBlockError('canonical_work_block_transport_failed', 'Canonical work-block authority is unavailable')
  }
}

export async function executeCanonicalWorkBlockBatch(
  client: RpcClient,
  request: CanonicalWorkBlockBatchRequest,
): Promise<CanonicalWorkBlockBatchResult> {
  assertRequest(request)
  const preview = await call(client, rpcArgs(request, true))
  if (preview.result === 'committed') {
    const requestHash = typeof preview.requestHash === 'string' ? preview.requestHash : ''
    if (
      preview.action !== 'work_block_batch'
      || preview.operationId !== request.operationId
      || !SHA256_HEX.test(requestHash)
      || !(await validReceipt(preview.receipt, request, requestHash))
    ) {
      throw new CanonicalWorkBlockError('invalid_canonical_work_block_receipt', 'Canonical work-block receipt is invalid')
    }
    const receipt = preview.receipt as Record<string, unknown> & { readBack: CanonicalWorkBlockReadBack[] }
    return { receipt, readBack: receipt.readBack, overlapWarnings: [] }
  }
  if (!validPreview(preview, request)) {
    throw new CanonicalWorkBlockError('invalid_canonical_work_block_preview', 'Canonical work-block preview is invalid')
  }
  const approval = {
    previewDigest: preview.previewDigest,
    previewExpiresAt: preview.previewExpiresAt,
    requestHash: preview.requestHash,
  }
  const applied = await call(client, rpcArgs(request, false, approval))
  if (
    applied.result !== 'committed'
    || applied.action !== 'work_block_batch'
    || applied.operationId !== request.operationId
    || applied.requestHash !== approval.requestHash
    || !(await validReceipt(applied.receipt, request, approval.requestHash))
  ) {
    throw new CanonicalWorkBlockError('invalid_canonical_work_block_receipt', 'Canonical work-block receipt is invalid')
  }
  const receipt = applied.receipt as Record<string, unknown> & { readBack: CanonicalWorkBlockReadBack[] }
  return { receipt, readBack: receipt.readBack, overlapWarnings: preview.overlapWarnings }
}
