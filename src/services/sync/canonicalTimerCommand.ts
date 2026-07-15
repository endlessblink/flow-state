import type { SyncResult, WriteOperation } from '@/types/sync'

const CONTRACT_VERSION = 'timer-v1' as const
const SOURCE = 'web-pwa' as const
const SHA256_HEX = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const OFFSET_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/

export type CanonicalTimerAction = 'start' | 'pause' | 'resume' | 'stop' | 'switch_task' | 'extend'

export type CanonicalTimerCommandRequest = {
  operationId: string
  action: CanonicalTimerAction
  sessionId: string
  baseRevision: number
  deviceId: string
  workspaceId: string | null
  taskId?: string
  startedAt?: string
  durationSeconds?: number
  remainingSeconds?: number
  extensionSeconds?: number
  isBreak?: boolean
}

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>
}

export type CanonicalTimerReadBack = {
  id: string
  workspaceId: string | null
  taskId: string
  startTime: string
  duration: number
  remainingTime: number
  isActive: boolean
  isPaused: boolean
  isBreak: boolean
  completedAt: string | null
  deviceLeaderId: string
  canonicalRevision: number
  canonicalUpdatedAt: string
}

export type CanonicalTimerCommandResult = {
  receipt: Record<string, unknown>
  readBack: CanonicalTimerReadBack
  replacedSessions: CanonicalTimerReadBack[]
}

export class CanonicalTimerCommandError extends Error {
  code: string
  currentRevision?: number

  constructor(code: string, message: string, currentRevision?: number) {
    super(message)
    this.name = 'CanonicalTimerCommandError'
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

function offsetTimestamp(value: unknown): value is string {
  return typeof value === 'string' && OFFSET_TIMESTAMP.test(value) && Number.isFinite(Date.parse(value))
}

function sameInstant(left: unknown, right: unknown): boolean {
  return offsetTimestamp(left) && offsetTimestamp(right) && Date.parse(left) === Date.parse(right)
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

async function canonicalHash(value: unknown): Promise<string> {
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

function invalid(message: string): never {
  throw new CanonicalTimerCommandError('invalid_timer_command', message)
}

function assertRequest(request: CanonicalTimerCommandRequest) {
  if (!request.operationId?.trim() || request.operationId.length > 160) invalid('operationId is required')
  if (!['start', 'pause', 'resume', 'stop', 'switch_task', 'extend'].includes(request.action)) invalid('An explicit timer action is required')
  if (!UUID.test(request.sessionId)) invalid('A stable sessionId is required')
  if (!request.deviceId?.trim() || request.deviceId.length > 160) invalid('deviceId is required')
  if (request.workspaceId !== null && !UUID.test(request.workspaceId)) invalid('workspaceId is invalid')
  if (request.action === 'start') {
    if (request.baseRevision !== 0) invalid('Start requires baseRevision zero')
    if (!request.taskId?.trim() || request.taskId.length > 256) invalid('Start requires taskId')
    if (!offsetTimestamp(request.startedAt)) invalid('Start requires an offset timestamp')
    if (!positiveInteger(request.durationSeconds) || request.durationSeconds > 86400) {
      invalid('Start duration must be between 1 and 86400 seconds')
    }
    if (typeof request.isBreak !== 'boolean') invalid('Start requires isBreak')
    if (request.remainingSeconds !== undefined || request.extensionSeconds !== undefined) invalid('Start fields are invalid')
    return
  }
  if (!positiveInteger(request.baseRevision)) invalid('Timer transition requires a positive revision')
  if (request.action === 'switch_task') {
    if (!request.taskId?.trim() || request.taskId.length > 256) invalid('Task switch requires taskId')
    if (!Number.isSafeInteger(request.remainingSeconds) || Number(request.remainingSeconds) < 0) invalid('Task switch requires remainingSeconds')
    if (request.startedAt !== undefined || request.durationSeconds !== undefined
      || request.extensionSeconds !== undefined || request.isBreak !== undefined) invalid('Task switch fields are invalid')
    return
  }
  if (request.action === 'extend') {
    if (!positiveInteger(request.extensionSeconds) || request.extensionSeconds > 86400) invalid('Extension must be between 1 and 86400 seconds')
    if (request.taskId !== undefined || request.startedAt !== undefined || request.durationSeconds !== undefined
      || request.remainingSeconds !== undefined || request.isBreak !== undefined) invalid('Extension fields are invalid')
    return
  }
  if (!Number.isSafeInteger(request.remainingSeconds) || Number(request.remainingSeconds) < 0
    || request.taskId !== undefined || request.startedAt !== undefined
    || request.durationSeconds !== undefined || request.extensionSeconds !== undefined || request.isBreak !== undefined) {
    invalid('Transition requires exact remainingSeconds and no creation fields')
  }
}

function expectedState(action: CanonicalTimerAction) {
  return {
    isActive: action !== 'stop',
    isPaused: action === 'pause' ? true : action === 'switch_task' ? null : false,
  }
}

function validReadBack(
  value: unknown,
  request: CanonicalTimerCommandRequest,
  revision: number,
): value is CanonicalTimerReadBack {
  if (!object(value)) return false
  const state = expectedState(request.action)
  return value.id === request.sessionId
    && value.workspaceId === request.workspaceId
    && typeof value.taskId === 'string' && value.taskId.length > 0
    && timestamp(value.startTime)
    && positiveInteger(value.duration)
    && Number.isSafeInteger(value.remainingTime) && Number(value.remainingTime) >= 0
    && Number(value.remainingTime) <= Number(value.duration)
    && value.isActive === state.isActive
    && (state.isPaused === null ? typeof value.isPaused === 'boolean' : value.isPaused === state.isPaused)
    && typeof value.isBreak === 'boolean'
    && (value.completedAt === null || timestamp(value.completedAt))
    && (request.action !== 'stop' ? value.completedAt === null : timestamp(value.completedAt))
    && value.deviceLeaderId === request.deviceId
    && value.canonicalRevision === revision
    && timestamp(value.canonicalUpdatedAt)
    && (request.action !== 'start' || (
      value.taskId === request.taskId
      && sameInstant(value.startTime, request.startedAt)
      && value.duration === request.durationSeconds
      && value.remainingTime === request.durationSeconds
      && value.isBreak === request.isBreak
    ))
    && (request.action !== 'switch_task' || (
      value.taskId === request.taskId && value.remainingTime === request.remainingSeconds
    ))
    && (request.action !== 'extend' || value.remainingTime === request.extensionSeconds)
    && (!['pause', 'resume', 'stop'].includes(request.action) || value.remainingTime === request.remainingSeconds)
}

function normalizedMatches(value: unknown, request: CanonicalTimerCommandRequest): boolean {
  if (!object(value)) return false
  const common = value.action === request.action
    && value.sessionId === request.sessionId
    && value.baseRevision === request.baseRevision
    && value.deviceId === request.deviceId
    && value.workspaceId === request.workspaceId
  if (!common) return false
  if (request.action === 'start') {
    return value.taskId === request.taskId
      && sameInstant(value.startedAt, request.startedAt)
      && value.durationSeconds === request.durationSeconds
      && value.isBreak === request.isBreak
  }
  return value.taskId === (request.taskId ?? null) && value.startedAt === null
    && value.durationSeconds === null && value.isBreak === null
    && value.remainingSeconds === (request.remainingSeconds ?? null)
    && value.extensionSeconds === (request.extensionSeconds ?? null)
}

function validReplacement(value: unknown, request: CanonicalTimerCommandRequest): value is CanonicalTimerReadBack {
  return object(value)
    && typeof value.id === 'string' && UUID.test(value.id)
    && value.id !== request.sessionId
    && (value.workspaceId === null || (typeof value.workspaceId === 'string' && UUID.test(value.workspaceId)))
    && typeof value.taskId === 'string'
    && timestamp(value.startTime)
    && positiveInteger(value.duration)
    && Number.isSafeInteger(value.remainingTime)
    && value.isActive === false
    && typeof value.isPaused === 'boolean'
    && typeof value.isBreak === 'boolean'
    && timestamp(value.completedAt)
    && typeof value.deviceLeaderId === 'string'
    && positiveInteger(value.canonicalRevision)
    && timestamp(value.canonicalUpdatedAt)
}

function validPreview(value: unknown, request: CanonicalTimerCommandRequest): value is Record<string, unknown> & {
  requestHash: string
  previewDigest: string
  previewExpiresAt: string
  readBack: CanonicalTimerReadBack
  replacedSessions: CanonicalTimerReadBack[]
} {
  if (!object(value)) return false
  const revision = request.action === 'start' ? 1 : request.baseRevision + 1
  return value.ok === true
    && value.result === 'preview'
    && value.contractVersion === CONTRACT_VERSION
    && value.action === request.action
    && value.operationId === request.operationId
    && typeof value.requestHash === 'string' && SHA256_HEX.test(value.requestHash)
    && typeof value.previewDigest === 'string' && SHA256_HEX.test(value.previewDigest)
    && timestamp(value.previewExpiresAt)
    && normalizedMatches(value.normalizedPayload, request)
    && validReadBack(value.readBack, request, revision)
    && Array.isArray(value.replacedSessions)
    && (request.action === 'start' || value.replacedSessions.length === 0)
    && value.replacedSessions.every(candidate => validReplacement(candidate, request))
}

async function validReceipt(
  value: unknown,
  request: CanonicalTimerCommandRequest,
  requestHash: string,
): Promise<boolean> {
  if (!object(value)) return false
  const status = String(value.status)
  const revision = request.action === 'start' ? 1 : request.baseRevision + 1
  if (
    value.ok !== true
    || !['committed', 'replayed'].includes(status)
    || value.contractVersion !== CONTRACT_VERSION
    || value.operationId !== request.operationId
    || value.requestHash !== requestHash
    || value.source !== SOURCE
    || value.entityType !== 'timer_session'
    || value.entityId !== request.sessionId
    || value.action !== request.action
    || value.canonicalRevision !== revision
    || !timestamp(value.canonicalUpdatedAt)
    || !positiveInteger(value.changeSequence)
    || typeof value.replayed !== 'boolean'
    || (status === 'replayed') !== value.replayed
    || !timestamp(value.committedAt)
    || !validReadBack(value.readBack, request, revision)
    || typeof value.readBackHash !== 'string'
    || !Array.isArray(value.affected)
    || value.affected.length < 1
    || !object(value.operationContext)
    || !Array.isArray(value.operationContext.replacedSessionIds)
  ) return false
  const affected = value.affected
  const ids = affected.map(candidate => object(candidate) ? candidate.entityId : null)
  if (new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string')) return false
  const primary = affected.find(candidate => object(candidate) && candidate.entityId === request.sessionId)
  if (!object(primary)
    || primary.entityType !== 'timer_session'
    || primary.action !== (request.action === 'start' ? 'inserted' : 'updated')
    || primary.canonicalRevision !== revision
    || primary.changeSequence !== value.changeSequence
    || !sameJson(primary.readBack, value.readBack)
    || typeof primary.readBackHash !== 'string') return false
  try {
    const targetHash = await canonicalHash(value.readBack)
    if (value.readBackHash !== targetHash || primary.readBackHash !== targetHash) return false
    const replacementIds = value.operationContext.replacedSessionIds
    if (request.action !== 'start' && replacementIds.length !== 0) return false
    for (const replacementId of replacementIds) {
      const entry = affected.find(candidate => object(candidate) && candidate.entityId === replacementId)
      if (!object(entry) || entry.entityType !== 'timer_session' || entry.action !== 'updated'
        || !positiveInteger(entry.canonicalRevision) || !positiveInteger(entry.changeSequence)
        || !validReplacement(entry.readBack, request)
        || entry.readBackHash !== await canonicalHash(entry.readBack)) return false
    }
    return affected.length === replacementIds.length + 1
  } catch {
    return false
  }
}

function rejected(data: Record<string, unknown>): never {
  const error = object(data.error) ? data.error : {}
  throw new CanonicalTimerCommandError(
    typeof error.code === 'string' ? error.code : 'canonical_timer_rejected',
    typeof error.message === 'string' ? error.message : 'Canonical timer command was rejected',
    positiveInteger(error.currentRevision) ? error.currentRevision : undefined,
  )
}

function rpcArgs(
  request: CanonicalTimerCommandRequest,
  preview: boolean,
  approval?: { previewDigest: string; previewExpiresAt: string; requestHash: string },
) {
  return {
    p_action: request.action,
    p_base_revision: request.baseRevision,
    p_contract_version: CONTRACT_VERSION,
    p_device_id: request.deviceId,
    p_duration_seconds: request.durationSeconds ?? null,
    p_remaining_seconds: request.remainingSeconds ?? null,
    p_extension_seconds: request.extensionSeconds ?? null,
    p_is_break: request.isBreak ?? null,
    p_operation_id: request.operationId,
    p_preview: preview,
    p_preview_digest: approval?.previewDigest ?? null,
    p_preview_expires_at: approval?.previewExpiresAt ?? null,
    p_request_hash: approval?.requestHash ?? null,
    p_session_id: request.sessionId,
    p_source: SOURCE,
    p_started_at: request.startedAt ?? null,
    p_task_id: request.taskId ?? null,
    p_workspace_id: request.workspaceId,
  }
}

async function call(client: RpcClient, args: Record<string, unknown>) {
  try {
    const response = await client.rpc('flowstate_timer_command_v1', args)
    if (response.error || !object(response.data)) {
      throw new CanonicalTimerCommandError('canonical_timer_transport_failed', 'Canonical timer authority is unavailable')
    }
    if (response.data.ok !== true) rejected(response.data)
    return response.data
  } catch (error) {
    if (error instanceof CanonicalTimerCommandError) throw error
    throw new CanonicalTimerCommandError('canonical_timer_transport_failed', 'Canonical timer authority is unavailable')
  }
}

export async function executeCanonicalTimerCommand(
  client: RpcClient,
  request: CanonicalTimerCommandRequest,
): Promise<CanonicalTimerCommandResult> {
  assertRequest(request)
  const preview = await call(client, rpcArgs(request, true))
  if (preview.result === 'committed') {
    const requestHash = typeof preview.requestHash === 'string' ? preview.requestHash : ''
    if (preview.action !== request.action || preview.operationId !== request.operationId
      || !SHA256_HEX.test(requestHash) || !(await validReceipt(preview.receipt, request, requestHash))) {
      throw new CanonicalTimerCommandError('invalid_canonical_timer_receipt', 'Canonical timer receipt is invalid')
    }
    const receipt = preview.receipt as Record<string, unknown> & { readBack: CanonicalTimerReadBack; operationContext: { replacedSessionIds: string[] } }
    const replaced = (receipt.affected as Array<Record<string, unknown>>)
      .filter(entry => receipt.operationContext.replacedSessionIds.includes(String(entry.entityId)))
      .map(entry => entry.readBack as CanonicalTimerReadBack)
    return { receipt, readBack: receipt.readBack, replacedSessions: replaced }
  }
  if (!validPreview(preview, request)) {
    throw new CanonicalTimerCommandError('invalid_canonical_timer_preview', 'Canonical timer preview is invalid')
  }
  const approval = {
    previewDigest: preview.previewDigest,
    previewExpiresAt: preview.previewExpiresAt,
    requestHash: preview.requestHash,
  }
  const applied = await call(client, rpcArgs(request, false, approval))
  if (applied.result !== 'committed' || applied.action !== request.action
    || applied.operationId !== request.operationId || applied.requestHash !== approval.requestHash
    || !(await validReceipt(applied.receipt, request, approval.requestHash))) {
    throw new CanonicalTimerCommandError('invalid_canonical_timer_receipt', 'Canonical timer receipt is invalid')
  }
  const receipt = applied.receipt as Record<string, unknown> & { readBack: CanonicalTimerReadBack; operationContext: { replacedSessionIds: string[] } }
  return { receipt, readBack: receipt.readBack, replacedSessions: preview.replacedSessions }
}

export async function executeQueuedCanonicalTimerCommand(
  client: RpcClient,
  operation: WriteOperation,
): Promise<SyncResult> {
  const request = operation.canonicalTimerCommand
  const expectedOperation = request?.action === 'start' ? 'create' : 'update'
  if (!request
    || operation.entityType !== 'timer_session'
    || operation.entityId !== request.sessionId
    || operation.operation !== expectedOperation
    || (operation.workspaceId ?? null) !== request.workspaceId) {
    return {
      success: false, operation, error: 'invalid_canonical_timer_queue_state',
      shouldRetry: false, classification: 'permanent',
    }
  }
  try {
    const result = await executeCanonicalTimerCommand(client, request)
    return { success: true, operation, serverData: result.readBack }
  } catch (error) {
    const canonical = error instanceof CanonicalTimerCommandError ? error : null
    const code = canonical?.code ?? 'canonical_timer_transport_failed'
    const conflicts = new Set([
      'leader_conflict', 'stale_revision', 'illegal_transition', 'idempotency_conflict',
      'request_hash_mismatch', 'preview_mismatch', 'preview_expired', 'session_id_conflict',
    ])
    const auth = code === 'not_authenticated' || code === 'signed_user_required'
    const transient = code === 'canonical_timer_transport_failed'
    return {
      success: false,
      operation,
      error: `${code}: ${canonical?.message ?? 'Canonical timer authority is unavailable'}`,
      isConflict: conflicts.has(code),
      isAuthError: auth,
      newVersion: canonical?.currentRevision,
      shouldRetry: transient,
      classification: auth ? 'auth' : conflicts.has(code) ? 'conflict' : transient ? 'transient' : 'permanent',
    }
  }
}
