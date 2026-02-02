/**
 * Offline-First Sync System Types
 *
 * CRITICAL: This system prevents data loss by:
 * 1. Persisting all writes to IndexedDB FIRST
 * 2. Syncing to Supabase with retry logic
 * 3. Never discarding operations until confirmed synced
 *
 * @see docs/sop/OFFLINE-SYNC-ARCHITECTURE.md
 */

/**
 * Entity types that can be synced
 */
export type SyncEntityType = 'task' | 'group' | 'project' | 'timer_session'

/**
 * Operation types for sync queue
 */
export type SyncOperationType = 'create' | 'update' | 'delete'

/**
 * Current status of a write operation
 */
export type WriteOperationStatus =
  | 'pending'      // Waiting to be synced
  | 'syncing'      // Currently being sent to server
  | 'failed'       // Sync failed, will retry
  | 'conflict'     // Version conflict detected
  | 'completed'    // Successfully synced (will be cleaned up)

/**
 * A single write operation in the queue
 */
export interface WriteOperation {
  /** Unique ID for this operation (auto-generated) */
  id?: number

  /** Type of entity being modified */
  entityType: SyncEntityType

  /** The specific operation */
  operation: SyncOperationType

  /** ID of the entity being modified */
  entityId: string

  /** The payload to send (for create/update) */
  payload: Record<string, unknown>

  /** Base version for optimistic locking (if applicable) */
  baseVersion?: number

  /** Current status of this operation */
  status: WriteOperationStatus

  /** Number of retry attempts */
  retryCount: number

  /** Timestamp when operation was created */
  createdAt: number

  /** Timestamp of last sync attempt */
  lastAttemptAt?: number

  /** Next scheduled retry time (for exponential backoff) */
  nextRetryAt?: number

  /** Error message from last failed attempt */
  lastError?: string

  /** User ID (for multi-user support) */
  userId?: string
}

/**
 * Conflict detected during sync
 */
export interface WriteConflict {
  /** The operation that caused the conflict */
  operation: WriteOperation

  /** Server version of the entity */
  serverVersion: number

  /** Local version we tried to write */
  localVersion: number

  /** Server data (for manual resolution if needed) */
  serverData?: Record<string, unknown>

  /** Timestamp when conflict was detected */
  detectedAt: number
}

/**
 * Overall sync status for the UI indicator
 */
export type SyncStatus =
  | 'synced'    // All changes saved to server
  | 'syncing'   // Currently syncing changes
  | 'pending'   // Changes waiting to sync
  | 'error'     // Sync failed (requires attention)
  | 'offline'   // Network unavailable

/**
 * Detailed sync state for the store
 */
export interface SyncState {
  /** Current overall status */
  status: SyncStatus

  /** Number of pending operations */
  pendingCount: number

  /** Number of failed operations (require manual retry) */
  failedCount: number

  /** Last successful sync timestamp */
  lastSyncAt?: number

  /** Last error message (if status is 'error') */
  lastError?: string

  /** Whether we're currently online */
  isOnline: boolean

  /** Operations currently in failed state */
  failedOperations: WriteOperation[]
}

/**
 * Configuration for retry strategy
 */
export interface RetryConfig {
  /** Initial delay in milliseconds */
  initialDelayMs: number

  /** Maximum delay in milliseconds */
  maxDelayMs: number

  /** Multiplier for exponential backoff */
  backoffMultiplier: number

  /** Maximum number of retries before marking as failed */
  maxRetries: number

  /** Jitter factor (0-1) to add randomness */
  jitterFactor: number
}

/**
 * Default retry configuration
 *
 * Delays: 1s, 2s, 4s, 8s, 16s, 32s, 60s, 60s, 60s, 60s (10 attempts)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  maxRetries: 10,
  jitterFactor: 0.1
}

/**
 * Result of a sync attempt
 */
export interface SyncResult {
  /** Whether the sync was successful */
  success: boolean

  /** The operation that was synced */
  operation: WriteOperation

  /** New version after successful sync */
  newVersion?: number

  /** Error message if failed */
  error?: string

  /** Whether this was a conflict */
  isConflict?: boolean

  /** Whether we should retry */
  shouldRetry?: boolean

  /** Server data (returned when LWW resolves in server's favor) */
  serverData?: Record<string, unknown>
}

/**
 * Batch sync result for multiple operations
 */
export interface BatchSyncResult {
  /** Operations that succeeded */
  succeeded: WriteOperation[]

  /** Operations that failed */
  failed: WriteOperation[]

  /** Operations that had conflicts */
  conflicts: WriteConflict[]

  /** Total time taken in milliseconds */
  durationMs: number
}

/**
 * Events emitted by the sync system
 */
export interface SyncEvents {
  /** Emitted when sync status changes */
  'status-change': (status: SyncStatus) => void

  /** Emitted when an operation is queued */
  'operation-queued': (operation: WriteOperation) => void

  /** Emitted when an operation completes */
  'operation-completed': (operation: WriteOperation) => void

  /** Emitted when an operation fails */
  'operation-failed': (operation: WriteOperation, error: string) => void

  /** Emitted when a conflict is detected */
  'conflict-detected': (conflict: WriteConflict) => void

  /** Emitted when online status changes */
  'online-change': (isOnline: boolean) => void
}

/**
 * Rollback state for optimistic UI updates
 */
export interface RollbackState<T = unknown> {
  /** Entity ID */
  entityId: string

  /** Entity type */
  entityType: SyncEntityType

  /** Previous state before the update */
  previousState: T

  /** Timestamp when rollback state was created */
  createdAt: number
}
