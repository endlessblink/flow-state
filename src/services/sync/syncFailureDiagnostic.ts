export type SyncFailureState = {
  status: string
  isOnline: boolean
  pendingCount: number
  failedCount: number
}

const SAFE_SYNC_ERROR_CODES = new Set([
  'stale_revision',
  'idempotency_conflict',
  'preview_mismatch',
  'preview_expired',
  'invalid_canonical_response',
  'invalid_canonical_preview',
  'invalid_canonical_apply_response',
  'invalid_canonical_receipt',
  'not_authenticated',
  'not_found',
])

export function createSyncFailureDiagnostic(error: unknown, state: SyncFailureState) {
  const rawCode = error && typeof error === 'object' && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined
  const code = typeof rawCode === 'string' && SAFE_SYNC_ERROR_CODES.has(rawCode)
    ? rawCode
    : typeof rawCode === 'string' && (/^PGRST\d{3}$/.test(rawCode) || /^\d{5}$/.test(rawCode))
      ? 'database_error'
      : 'unclassified_error'

  return {
    code,
    status: state.status,
    online: state.isOnline,
    pendingCount: state.pendingCount,
    failedCount: state.failedCount,
  }
}
