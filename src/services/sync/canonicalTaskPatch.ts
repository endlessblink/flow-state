import type {
  CanonicalTaskPatchReceipt,
  CanonicalTaskPatchState,
  SyncResult,
  WriteOperation,
} from '@/types/sync'

const CONTRACT_VERSION = 'task-v1' as const
const SOURCE = 'web-pwa' as const
const SHA256_HEX = /^[0-9a-f]{64}$/
const DB_TO_PATCH_FIELD = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  due_date: 'dueDate',
  progress: 'progress',
} as const
const IGNORED_PAYLOAD_FIELDS = new Set(['updated_at'])
const PATCH_FIELDS = new Set(['title', 'description', 'priority', 'dueDate', 'progress'])
const DUE_DATE = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/

type CanonicalRpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function validDueDate(value: unknown): value is string | null {
  if (value === null) return true
  if (typeof value !== 'string' || !DUE_DATE.test(value) || !Number.isFinite(Date.parse(value))) return false
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function validPatch(value: unknown): value is CanonicalTaskPatchState['patch'] {
  if (!object(value)) return false
  const keys = Object.keys(value)
  if (keys.length === 0 || keys.some(key => !PATCH_FIELDS.has(key))) return false
  if ('title' in value && (typeof value.title !== 'string' || value.title.trim().length === 0)) return false
  if ('description' in value && typeof value.description !== 'string' && value.description !== null) return false
  if ('priority' in value && !['low', 'medium', 'high', null].includes(value.priority as never)) return false
  if ('dueDate' in value && !validDueDate(value.dueDate)) return false
  if ('progress' in value && (!Number.isSafeInteger(value.progress) || Number(value.progress) < 0 || Number(value.progress) > 100)) return false
  return true
}

function samePatchShape(left: CanonicalTaskPatchState['patch'], right: CanonicalTaskPatchState['patch']): boolean {
  return Object.keys(left).sort().join(',') === Object.keys(right).sort().join(',')
}

function validReadBack(
  value: unknown,
  taskId: string,
  revision: number,
  workspaceId: string | null,
): value is CanonicalTaskPatchReceipt['readBack'] {
  return object(value)
    && value.id === taskId
    && typeof value.title === 'string'
    && value.title.trim().length > 0
    && (typeof value.description === 'string' || value.description === null)
    && (value.priority === 'low' || value.priority === 'medium' || value.priority === 'high' || value.priority === null)
    && validDueDate(value.dueDate)
    && Number.isSafeInteger(value.progress)
    && Number(value.progress) >= 0
    && Number(value.progress) <= 100
    && (value.status === 'todo' || value.status === 'done')
    && typeof value.isDeleted === 'boolean'
    && value.workspaceId === workspaceId
    && value.canonicalRevision === revision
    && timestamp(value.canonicalUpdatedAt)
}

export function validCanonicalTaskReceipt(
  value: unknown,
  taskId: string,
  operationId: string,
  workspaceId: string | null,
): value is CanonicalTaskPatchReceipt {
  if (!object(value)) return false
  return value.contractVersion === CONTRACT_VERSION
    && value.operationId === operationId
    && value.source === SOURCE
    && value.entityType === 'task'
    && value.action === 'patch'
    && value.entityId === taskId
    && positiveInteger(value.canonicalRevision)
    && timestamp(value.canonicalUpdatedAt)
    && positiveInteger(value.changeSequence)
    && typeof value.replayed === 'boolean'
    && timestamp(value.committedAt)
    && validReadBack(value.readBack, taskId, value.canonicalRevision, workspaceId)
    && value.readBack.canonicalUpdatedAt === value.canonicalUpdatedAt
    && typeof value.readBackHash === 'string'
    && SHA256_HEX.test(value.readBackHash)
}

function validPreview(value: unknown, operation: WriteOperation): value is Record<string, unknown> & {
  previewDigest: string
  previewExpiresAt: string
  requestHash: string
  normalizedPayload: CanonicalTaskPatchState['patch']
} {
  const canonical = operation.canonicalTaskPatch
  if (!canonical || !object(value)) return false
  return value.ok === true
    && value.result === 'preview'
    && value.contractVersion === CONTRACT_VERSION
    && value.operationId === canonical.operationId
    && value.baseRevision === canonical.baseRevision
    && typeof value.previewDigest === 'string'
    && SHA256_HEX.test(value.previewDigest)
    && timestamp(value.previewExpiresAt)
    && typeof value.requestHash === 'string'
    && SHA256_HEX.test(value.requestHash)
    && validPatch(value.normalizedPayload)
    && samePatchShape(value.normalizedPayload, canonical.patch)
    && validReadBack(value.readBack, operation.entityId, canonical.baseRevision, operation.workspaceId ?? null)
}

function operationId(): string {
  return `web:${crypto.randomUUID()}`
}

export function createCanonicalTaskPatchState(
  payload: Record<string, unknown>,
  baseRevision: number | undefined,
  requestedOperationId = operationId(),
): CanonicalTaskPatchState | undefined {
  if (!positiveInteger(baseRevision)) return undefined
  const patch: CanonicalTaskPatchState['patch'] = {}
  for (const [key, value] of Object.entries(payload)) {
    if (IGNORED_PAYLOAD_FIELDS.has(key)) continue
    const patchKey = DB_TO_PATCH_FIELD[key as keyof typeof DB_TO_PATCH_FIELD]
    if (!patchKey) return undefined
    Object.assign(patch, { [patchKey]: value })
  }
  if (Object.keys(patch).length === 0) return undefined
  if (!validPatch(patch)) return undefined
  return {
    contractVersion: CONTRACT_VERSION,
    operationId: requestedOperationId,
    baseRevision,
    patch,
    phase: 'queued',
  }
}

function rejected(operation: WriteOperation, data: Record<string, unknown>): SyncResult {
  const error = object(data.error) ? data.error : {}
  const code = typeof error.code === 'string' ? error.code : 'invalid_canonical_response'
  const message = typeof error.message === 'string' ? error.message : 'Canonical task patch was rejected'
  const conflictCodes = new Set(['stale_revision', 'idempotency_conflict', 'preview_mismatch', 'preview_expired'])
  return {
    success: false,
    operation,
    error: `${code}: ${message}`,
    isConflict: conflictCodes.has(code),
    newVersion: positiveInteger(error.currentRevision) ? error.currentRevision : undefined,
    isAuthError: code === 'not_authenticated',
    shouldRetry: false,
    classification: code === 'not_authenticated' ? 'auth' : conflictCodes.has(code) ? 'conflict' : 'permanent',
  }
}

export async function executeQueuedCanonicalTaskPatch(
  client: CanonicalRpcClient,
  operation: WriteOperation,
  persist: (state: CanonicalTaskPatchState) => Promise<void>,
): Promise<SyncResult> {
  const initialCanonical = operation.canonicalTaskPatch
  if (!initialCanonical || operation.entityType !== 'task' || operation.operation !== 'update') {
    return { success: false, operation, error: 'invalid_canonical_queue_state', shouldRetry: false, classification: 'permanent' }
  }
  let canonical: CanonicalTaskPatchState = initialCanonical
  if (canonical.receipt) {
    if (!validCanonicalTaskReceipt(canonical.receipt, operation.entityId, canonical.operationId, operation.workspaceId ?? null)) {
      return { success: false, operation, error: 'invalid_persisted_canonical_receipt', shouldRetry: false, classification: 'permanent' }
    }
    return { success: true, operation, canonicalReceipt: canonical.receipt, serverData: canonical.receipt.readBack }
  }
  if ((canonical.previewDigest || canonical.previewExpiresAt || canonical.phase === 'previewed')
    && (!validPatch(canonical.normalizedPatch) || !samePatchShape(canonical.normalizedPatch, canonical.patch))) {
    return { success: false, operation, error: 'invalid_persisted_canonical_preview', shouldRetry: false, classification: 'permanent' }
  }

  if (!canonical.previewDigest || !canonical.previewExpiresAt || !canonical.requestHash) {
    let preview: Awaited<ReturnType<CanonicalRpcClient['rpc']>>
    try {
      preview = await client.rpc('flowstate_patch_task_v1', {
        p_base_revision: canonical.baseRevision,
        p_contract_version: CONTRACT_VERSION,
        p_operation_id: canonical.operationId,
        p_patch: canonical.patch,
        p_preview: true,
        p_preview_digest: null,
        p_preview_expires_at: null,
        p_request_hash: null,
        p_source: SOURCE,
        p_task_id: operation.entityId,
        p_workspace_id: operation.workspaceId ?? null,
      })
    } catch {
      return { success: false, operation, error: 'canonical_preview_transport_failed', shouldRetry: true, classification: 'transient' }
    }
    if (preview.error) {
      return { success: false, operation, error: 'canonical_preview_transport_failed', shouldRetry: true, classification: 'transient' }
    }
    if (!object(preview.data)) {
      return { success: false, operation, error: 'invalid_canonical_preview', shouldRetry: false, classification: 'permanent' }
    }
    if (preview.data.ok !== true) return rejected(operation, preview.data)
    if (!validPreview(preview.data, operation)) {
      return { success: false, operation, error: 'invalid_canonical_preview', shouldRetry: false, classification: 'permanent' }
    }
    canonical = {
      ...canonical,
      phase: 'previewed',
      previewDigest: preview.data.previewDigest,
      previewExpiresAt: preview.data.previewExpiresAt,
      requestHash: preview.data.requestHash,
      normalizedPatch: preview.data.normalizedPayload,
    }
    operation.canonicalTaskPatch = canonical
    await persist(canonical)
  }

  let applied: Awaited<ReturnType<CanonicalRpcClient['rpc']>>
  try {
    applied = await client.rpc('flowstate_patch_task_v1', {
      p_base_revision: canonical.baseRevision,
      p_contract_version: CONTRACT_VERSION,
      p_operation_id: canonical.operationId,
      p_patch: canonical.patch,
      p_preview: false,
      p_preview_digest: canonical.previewDigest,
      p_preview_expires_at: canonical.previewExpiresAt,
      p_request_hash: canonical.requestHash,
      p_source: SOURCE,
      p_task_id: operation.entityId,
      p_workspace_id: operation.workspaceId ?? null,
    })
  } catch {
    return { success: false, operation, error: 'canonical_apply_transport_failed', shouldRetry: true, classification: 'transient' }
  }
  if (applied.error) {
    return { success: false, operation, error: 'canonical_apply_transport_failed', shouldRetry: true, classification: 'transient' }
  }
  if (!object(applied.data)) {
    return { success: false, operation, error: 'invalid_canonical_apply_response', shouldRetry: false, classification: 'permanent' }
  }
  if (applied.data.ok !== true) return rejected(operation, applied.data)
  if (applied.data.result !== 'committed' || !validCanonicalTaskReceipt(
    applied.data.receipt,
    operation.entityId,
    canonical.operationId,
    operation.workspaceId ?? null,
  )) {
    return { success: false, operation, error: 'invalid_canonical_receipt', shouldRetry: false, classification: 'permanent' }
  }

  canonical = { ...canonical, phase: 'committed', receipt: applied.data.receipt }
  operation.canonicalTaskPatch = canonical
  await persist(canonical)
  return {
    success: true,
    operation,
    canonicalReceipt: applied.data.receipt,
    serverData: applied.data.receipt.readBack,
  }
}
