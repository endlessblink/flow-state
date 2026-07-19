/**
 * Sync Orchestrator Composable
 *
 * CRITICAL: This is the main controller for the offline-first sync system.
 *
 * Key behaviors:
 * - All writes go to IndexedDB FIRST, then sync to Supabase
 * - Automatic retry with exponential backoff
 * - Never discards operations until confirmed synced
 * - Detects online/offline status and pauses/resumes accordingly
 *
 * @see TASK-1177 in MASTER_PLAN.md
 */

import { ref, computed } from 'vue'
import type {
  WriteOperation,
  SyncState,
  SyncEntityType,
  SyncOperationType,
  SyncResult
} from '@/types/sync'
import { DB_TABLES } from '@/constants/dbTables'
import { getInitialOnlineState } from '@/utils/platform'
import { executeQueuedCanonicalTaskPatch } from '@/services/sync/canonicalTaskPatch'

// TASK-1177: Check for IndexedDB availability (not available in Node.js/tests)
const hasIndexedDB = typeof indexedDB !== 'undefined'

// Workspace collaboration: lazily get active workspace ID at enqueue time.
// Use an ESM import so packaged Vite/Electron builds capture the real store.
async function getActiveWorkspaceId(): Promise<string | null> {
  try {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    return useWorkspaceStore().activeWorkspaceId ?? null
  } catch {
    return null
  }
}

// Lazy import to prevent IndexedDB errors in test environment
let writeQueueModule: typeof import('@/services/offline/writeQueueDB') | null = null
async function getWriteQueueModule() {
  if (!hasIndexedDB) {
    return null
  }
  if (!writeQueueModule) {
    writeQueueModule = await import('@/services/offline/writeQueueDB')
  }
  return writeQueueModule
}

async function invalidateSyncedEntityCache(entityType: SyncEntityType): Promise<void> {
  try {
    const { invalidateCache } = await import('@/composables/useSupabaseDatabase')
    switch (entityType) {
      case 'task':
        invalidateCache.tasks()
        break
      case 'project':
        invalidateCache.projects()
        break
      case 'group':
        invalidateCache.groups()
        break
      case 'lane':
        invalidateCache.lanes()
        break
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('[SYNC] Failed to invalidate read cache after sync:', error)
    }
  }
}

async function getCurrentAuthUserId(): Promise<string | undefined> {
  try {
    const { supabase } = await import('@/services/auth/supabase')
    const { data } = await supabase.auth.getSession()
    const session = data?.session
    if (session?.access_token && session.user?.id) return session.user.id

    // BUG-1922: The sync queue is the last line of defense for local edits. If
    // Supabase storage briefly has no session but the refresh token is still
    // valid, recover here before surfacing the auth-gate write error.
    const { data: refreshed, error } = await supabase.auth.refreshSession()
    if (error) return undefined
    const refreshedSession = refreshed?.session
    return refreshedSession?.access_token && refreshedSession.user?.id
      ? refreshedSession.user.id
      : undefined
  } catch {
    return undefined
  }
}

// Re-export types and stub functions for when IndexedDB is unavailable
import type {
  enqueueOperation as _enqueueOperation,
  getPendingOperations as _getPendingOperations,
  markSyncing as _markSyncing,
  markCompleted as _markCompleted,
  markFailed as _markFailed,
  markConflict as _markConflict,
  updateOperation as _updateOperation,
  completeCanonicalOperation as _completeCanonicalOperation,
  completeLegacyTaskOperation as _completeLegacyTaskOperation,
  getLatestCanonicalCheckpointForEntity as _getLatestCanonicalCheckpointForEntity,
  cleanupCompleted as _cleanupCompleted,
  getStats as _getStats,
  getFailedOperations as _getFailedOperations
} from '@/services/offline/writeQueueDB'

// Wrapped functions that handle missing IndexedDB gracefully
const enqueueOperation: typeof _enqueueOperation = async (...args) => {
  const mod = await getWriteQueueModule()
  if (!mod) {
    if (args[0].canonicalTaskPatch) {
      throw new Error('IndexedDB is required for durable canonical task patches')
    }
    console.warn('[SYNC] IndexedDB not available - operation not queued')
    return { ...args[0], id: Date.now(), status: 'pending' as const, retryCount: 0, createdAt: Date.now() }
  }
  return mod.enqueueOperation(...args)
}

const getPendingOperations: typeof _getPendingOperations = async (...args) => {
  const mod = await getWriteQueueModule()
  return mod ? mod.getPendingOperations(...args) : []
}

const markSyncing: typeof _markSyncing = async (...args) => {
  const mod = await getWriteQueueModule()
  if (mod) await mod.markSyncing(...args)
}

const markCompleted: typeof _markCompleted = async (...args) => {
  const mod = await getWriteQueueModule()
  if (mod) await mod.markCompleted(...args)
}

const markFailed: typeof _markFailed = async (...args) => {
  const mod = await getWriteQueueModule()
  if (mod) await mod.markFailed(...args)
}

const markConflict: typeof _markConflict = async (...args) => {
  const mod = await getWriteQueueModule()
  if (!mod) throw new Error('IndexedDB not available')
  return mod.markConflict(...args)
}

const updateOperation: typeof _updateOperation = async (...args) => {
  const mod = await getWriteQueueModule()
  if (mod) await mod.updateOperation(...args)
}

const completeCanonicalOperation: typeof _completeCanonicalOperation = async (...args) => {
  const mod = await getWriteQueueModule()
  if (!mod) throw new Error('IndexedDB not available')
  await mod.completeCanonicalOperation(...args)
}

const completeLegacyTaskOperation: typeof _completeLegacyTaskOperation = async (...args) => {
  const mod = await getWriteQueueModule()
  if (!mod) throw new Error('IndexedDB not available')
  await mod.completeLegacyTaskOperation(...args)
}

const getLatestCanonicalCheckpointForEntity: typeof _getLatestCanonicalCheckpointForEntity = async (...args) => {
  const mod = await getWriteQueueModule()
  return mod ? mod.getLatestCanonicalCheckpointForEntity(...args) : undefined
}

const cleanupCompleted: typeof _cleanupCompleted = async () => {
  const mod = await getWriteQueueModule()
  return mod ? mod.cleanupCompleted() : 0
}

const getStats: typeof _getStats = async () => {
  const mod = await getWriteQueueModule()
  return mod ? mod.getStats() : {
    totalOperations: 0,
    pendingCount: 0,
    syncingCount: 0,
    failedCount: 0,
    completedCount: 0,
    conflictCount: 0
  }
}

const getFailedOperations: typeof _getFailedOperations = async () => {
  const mod = await getWriteQueueModule()
  return mod ? mod.getFailedOperations() : []
}

// BUG-1301: Recover stale syncing operations on startup/process cycle
const recoverStaleSyncing = async (): Promise<number> => {
  const mod = await getWriteQueueModule()
  return mod ? mod.recoverStaleSyncing() : 0
}

const recoverRlsPolicyFailures = async (): Promise<number> => {
  const mod = await getWriteQueueModule()
  if (!mod) return 0

  const currentUserId = await getCurrentAuthUserId()
  const failedOps = await mod.getFailedOperations()
  const userOwnedEntities: SyncEntityType[] = ['task', 'group', 'project', 'lane', 'timer_session', 'quick_sort_session']
  const rlsFailures = failedOps.filter(op =>
    op.id &&
    userOwnedEntities.includes(op.entityType) &&
    op.lastError?.toLowerCase().includes('row-level security policy')
  )

  if (!currentUserId) return 0

  for (const op of rlsFailures) {
    if (!op.id) continue
    await mod.updateOperation(op.id, {
      status: 'pending',
      retryCount: 0,
      nextRetryAt: undefined,
      lastError: undefined,
      userId: currentUserId,
      payload: {
        ...op.payload,
        user_id: currentUserId
      }
    })
  }

  if (rlsFailures.length > 0) {
    console.warn(`[SYNC] Recovered ${rlsFailures.length} RLS-failed queued operation(s)`)
  }

  return rlsFailures.length
}

const clearFailedOperations = async (): Promise<number> => {
  const mod = await getWriteQueueModule()
  if (!mod) return 0
  const count = await mod.clearFailedOperations()

  // BUG-1179: Force clear all error state immediately
  state.value.lastError = undefined
  state.value.failedCount = 0
  state.value.failedOperations = []

  // Then verify with fresh stats
  const stats = await getStats()

  // Only set to synced if truly clean
  if (stats.failedCount === 0 && stats.conflictCount === 0 && stats.pendingCount === 0 && stats.syncingCount === 0) {
    state.value.status = 'synced'
  } else {
    await updateStatus()
  }

  return count
}
import {
  calculateNextRetryTime,
  shouldRetry,
  classifyError,
  getRetryConfigForError,
  type ErrorClassification
} from '@/services/offline/retryStrategy'
import { coalesceOperationsForEntity } from '@/services/offline/operationCoalescer'
import { sortOperations } from '@/services/offline/operationSorter'
import { hasEarlierUnresolvedOperation, hasLaterUnresolvedOperation } from '@/services/offline/writeQueueDB'
import { supabase } from '@/services/auth/supabase'
import { reportWriteFailure } from '@/composables/sync/writeHealth'

// Singleton state (shared across all components using this composable)
const state = ref<SyncState>({
  status: 'synced',
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: undefined,
  lastError: undefined,
  isOnline: getInitialOnlineState(),
  failedOperations: [],
  remoteWriteCooldownUntil: undefined,
  remoteWriteCooldownReason: undefined
})

// Processing state
const isProcessing = ref(false)
const processIntervalId = ref<ReturnType<typeof setInterval> | null>(null)
const PROCESS_INTERVAL_MS = 5000 // Check queue every 5 seconds

// BUG-P1: Server-unreachable detection — prevent burning retry budget during outages
let consecutiveTransientFailures = 0
// BUG-1913: consecutive processQueue skips caused by a missing auth session.
// Surfaced (error state + writeHealth) once this passes AUTH_GATE_SURFACE_AFTER
// while pending operations exist — a dead session under a signed-in shell must
// not silently strand the queue.
let consecutiveAuthGateSkips = 0
const AUTH_GATE_SURFACE_AFTER = 2
const TRANSIENT_PAUSE_THRESHOLD = 5
const MIN_RATE_LIMIT_COOLDOWN_MS = 30_000

// TASK-1177: Permanent failure pub/sub (module-level to match singleton state)
const permanentFailureCallbacks = new Set<(op: WriteOperation) => void>()

// Online/offline listeners (set up once)
let listenersSetUp = false

function getRetryAfterCooldown(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined
  const headers = (error as { headers?: { get?: (name: string) => string | null } }).headers
  const retryAfter = headers?.get?.('retry-after')
  if (!retryAfter) return undefined

  const seconds = Number(retryAfter)
  if (Number.isFinite(seconds)) return Math.max(MIN_RATE_LIMIT_COOLDOWN_MS, seconds * 1000)

  const retryAt = new Date(retryAfter).getTime()
  if (Number.isFinite(retryAt)) return Math.max(MIN_RATE_LIMIT_COOLDOWN_MS, retryAt - Date.now())
  return undefined
}

function openRemoteWriteCooldown(until: number, reason: string): void {
  if (!state.value.remoteWriteCooldownUntil || until > state.value.remoteWriteCooldownUntil) {
    state.value.remoteWriteCooldownUntil = until
    state.value.remoteWriteCooldownReason = reason
  }
}

function isRemoteWriteCoolingDown(): boolean {
  const until = state.value.remoteWriteCooldownUntil
  if (!until) return false
  if (Date.now() >= until) {
    state.value.remoteWriteCooldownUntil = undefined
    state.value.remoteWriteCooldownReason = undefined
    return false
  }
  return true
}

/**
 * Set up online/offline event listeners
 */
function setupOnlineListeners() {
  if (listenersSetUp || typeof window === 'undefined') return

  const handleOnline = () => {
    if (import.meta.env.DEV) {
      console.log('[SYNC] Network online - resuming sync')
    }
    state.value.isOnline = true
    updateStatus()
    // Trigger immediate sync attempt
    processQueue()
  }

  const handleOffline = () => {
    if (import.meta.env.DEV) {
      console.log('[SYNC] Network offline - pausing sync')
    }
    state.value.isOnline = false
    updateStatus()
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  listenersSetUp = true
}

/**
 * Update the overall sync status based on current state
 */
async function updateStatus() {
  const stats = await getStats()

  state.value.pendingCount = stats.pendingCount + stats.syncingCount
  // BUG-1179: Include conflicts in error count so UI shows correct number
  state.value.failedCount = stats.failedCount + stats.conflictCount

  // TASK-1177: Populate failedOperations array for UI display
  if (stats.failedCount > 0) {
    state.value.failedOperations = await getFailedOperations()
  } else {
    state.value.failedOperations = []
  }

  if (!state.value.isOnline) {
    state.value.status = 'offline'
  } else if (stats.failedCount > 0 || stats.conflictCount > 0) {
    state.value.status = 'error'
  } else if (stats.syncingCount > 0) {
    state.value.status = 'syncing'
  } else if (stats.pendingCount > 0) {
    state.value.status = 'pending'
  } else {
    state.value.status = 'synced'
  }
}

/**
 * Execute a single sync operation against Supabase
 */
async function executeOperation(operation: WriteOperation): Promise<SyncResult> {
  const { entityType, entityId, payload: rawPayload } = operation

  // TASK-1418: Sanitize task status in sync queue payloads.
  // Stale IndexedDB entries from before the status migration may contain 'todo'
  // which the DB constraint rejects. Map to 'planned' for all task writes.
  let payload = (entityType === 'task' && rawPayload.status === 'todo')
    ? { ...rawPayload, status: 'planned' }
    : rawPayload

  // BUG-1533b: Sanitize stale task payloads that have camelCase field names.
  // taskPersistence smart-merge used to enqueue raw app-side objects (camelCase)
  // instead of running through toSupabaseTask(). Detect and convert on the fly.
  if (entityType === 'task' && ('projectId' in payload || '_soft_deleted' in payload || 'isInInbox' in payload)) {
    try {
      const { toSupabaseTask } = await import('@/utils/supabaseMappers')
      const { useAuthStore } = await import('@/stores/auth')
      const userId = useAuthStore().user?.id
      if (userId) {
        const mapped = toSupabaseTask(payload as any, userId)
        payload = { ...mapped, is_deleted: false, deleted_at: null }
        delete (payload as Record<string, unknown>).position_version
      }
    } catch {
      // Mapper not available — strip known bad fields as fallback
      const { _soft_deleted, ...rest } = payload as Record<string, unknown>
      payload = { ...rest, is_deleted: _soft_deleted || false }
    }
  }

  // Workspace collaboration: inject workspace_id into payload if missing from legacy operations
  if (!payload.workspace_id && operation.workspaceId) {
    payload = { ...payload, workspace_id: operation.workspaceId as string }
  }

  // User-owned tables must never replay stale guest/old-user payloads against RLS.
  // If a current user exists, adopt that user_id for legacy queued writes. If not,
  // this is local-only/guest state and there is no valid remote write to perform.
  const userOwnedEntities: SyncEntityType[] = ['task', 'group', 'project', 'lane', 'timer_session', 'quick_sort_session']
  if (userOwnedEntities.includes(entityType)) {
    const currentUserId = await getCurrentAuthUserId()
    if (!currentUserId) {
      if (operation.canonicalTaskPatch) {
        return {
          success: false,
          operation,
          error: 'not_authenticated: canonical task patch requires an authenticated user',
          isAuthError: true,
          shouldRetry: false,
          classification: 'auth',
        }
      }
      console.warn(`[SYNC] Dropping remote ${entityType}:${operation.operation} ${entityId.slice(0, 8)} — no authenticated user for RLS`)
      return { success: true, operation, serverData: undefined }
    }
    if (operation.canonicalTaskPatch && operation.userId !== currentUserId) {
      return {
        success: false,
        operation,
        error: 'canonical_scope_mismatch: queued intent belongs to another signed user',
        shouldRetry: false,
        classification: 'permanent',
      }
    }
    const preserveSharedTaskOwner = entityType === 'task'
      && operation.operation === 'update'
      && Boolean(operation.workspaceId)
    if (preserveSharedTaskOwner) {
      const { user_id: _ownerId, ...ownerPreservingPayload } = payload as Record<string, unknown>
      payload = ownerPreservingPayload
    } else {
      payload = { ...payload, user_id: currentUserId }
    }
  }

  if (operation.canonicalTaskPatch) {
    return executeQueuedCanonicalTaskPatch(
      supabase as unknown as Parameters<typeof executeQueuedCanonicalTaskPatch>[0],
      operation,
      canonicalTaskPatch => updateOperation(operation.id!, { canonicalTaskPatch }),
    )
  }

  // Map entity type to Supabase table name
  const tableMap: Record<SyncEntityType, string> = {
    task: 'tasks',
    group: 'groups',
    project: 'projects',
    lane: 'lanes',
    timer_session: 'timer_sessions',
    quick_sort_session: 'quick_sort_sessions'
  }
  const tableName = tableMap[entityType]

  try {
    let result

    switch (operation.operation) {
      case 'create': {
        // BUG-1534: Check tombstones before CREATE — prevents resurrecting deleted tasks.
        // A stale CREATE in the queue (from page reload, retry, or smart merge) could
        // un-delete a task that was legitimately deleted on another device.
        if (entityType === 'task') {
          const { data: tombstone } = await supabase!
            .from(DB_TABLES.TOMBSTONES)
            .select('id')
            .eq('entity_type', 'task')
            .eq('entity_id', entityId)
            .limit(1)
            .maybeSingle()
          if (tombstone) {
            console.warn(`[SYNC] Skipping CREATE for tombstoned task ${entityId.slice(0, 8)}`)
            return { success: true, operation, serverData: undefined }
          }
        }

        // BUG-1509: Explicitly clear soft-delete flags on CREATE upsert.
        // When undo re-creates a previously soft-deleted task, the DB row may still have
        // is_deleted=true. Merging these defaults ensures the upsert always resets the
        // deletion state, so fetchTasks (.eq('is_deleted', false)) sees the task on refresh.
        // Only apply to tables that have is_deleted/deleted_at columns (tasks, groups, projects).
        const softDeleteTables: SyncEntityType[] = ['task', 'group', 'project', 'lane']
        const softDeleteDefaults = softDeleteTables.includes(entityType)
          ? { is_deleted: false, deleted_at: null }
          : {}
        const insertData = { ...softDeleteDefaults, id: entityId, ...payload }
        // BUG-1212: Use upsert instead of insert to handle duplicate key gracefully.
        // When the direct save (createTask → saveSpecificTasks) succeeds before the
        // sync queue processes, the row already exists. Using upsert makes this
        // idempotent — matching the pattern in useSupabaseDatabase.ts saveTask/saveTasks.
        if (import.meta.env.DEV) {
          console.debug(`🔄 [SYNC] CREATE via upsert for ${entityType}:${entityId} (idempotent)`)
        }
        result = await supabase!.from(tableName).upsert(insertData, { onConflict: 'id' }).select()

        // Handle recurrence dedup constraint — cross-device race creates duplicate clones.
        // Soft-delete the local clone so the DB's existing version wins.
        if (result.error?.code === '23505' && result.error?.message?.includes('idx_unique_recurrence_occurrence')) {
          console.warn(`⚠️ [SYNC] Recurrence dedup for ${entityType}:${entityId}, soft-deleting local clone`)
          const deleteResult = await supabase!.from(tableName)
            .upsert({ ...insertData, is_deleted: true, deleted_at: new Date().toISOString() }, { onConflict: 'id' })
            .select()
          result = { ...deleteResult, data: deleteResult.data, error: null }
        }
        // BUG-1967: PostgREST can return no error with an empty representation when
        // no row was accepted. That is not durable success and must remain retryable.
        if (!result.error && (!Array.isArray(result.data) || result.data.length === 0)) {
          throw new Error(`CREATE was not acknowledged for ${entityType}:${entityId}`)
        }
        break
      }

      case 'update': {
        // TASK-1183: Auto-resolve version conflicts with Last-Write-Wins (LWW)
        // For personal productivity apps, LWW is sufficient - no multi-user collaboration
        //
        // Strategy:
        // 1. Try update with optimistic lock first
        // 2. If 0 rows returned (version conflict), fetch server state
        // 3. If server timestamp < our timestamp, force update (our change wins)
        // 4. If server timestamp > our timestamp, server wins - discard our change

        let query = supabase!.from(tableName).update(payload).eq('id', entityId)

        // Only tasks and groups have position_version column for optimistic locking
        const hasPositionVersion = entityType === 'task' || entityType === 'group'
        if (hasPositionVersion && operation.baseVersion !== undefined) {
          // Optimistic lock using position_version
          query = query.eq('position_version', operation.baseVersion)
        }

        result = await query.select()

        // Check for version conflict (no rows updated)
        if (!result.error && (!result.data || result.data.length === 0)) {
          if (import.meta.env.DEV) {
            console.debug(`[SYNC] Version conflict detected for ${entityType}:${entityId}, attempting LWW resolution`)
          }

          // Fetch current server state
          const serverState = await supabase!
            .from(tableName)
            .select('*')
            .eq('id', entityId)
            .single()

          if (serverState.error) {
            // BUG-1211 FIX: Entity not found — likely deleted on another device.
            // Mark as success to remove from queue (can't update a deleted entity),
            // but log prominently so this is visible in debugging.
            if (serverState.error.code === 'PGRST116') {
              console.warn(`⚠️ [SYNC] Entity ${entityType}:${entityId} not found on server (deleted on another device?). Queued update discarded — data in this update is lost.`)
              return {
                success: true,
                operation
              }
            }
            throw serverState.error
          }

          // Last-Write-Wins: Compare timestamps
          const serverUpdatedAt = new Date(serverState.data.updated_at).getTime()
          const localUpdatedAt = payload.updated_at
            ? new Date(payload.updated_at as string).getTime()
            : Date.now()

          if (localUpdatedAt >= serverUpdatedAt) {
            // Our change is newer - force update without version check
            if (import.meta.env.DEV) {
              console.log(`[SYNC] LWW: Local wins (local=${new Date(localUpdatedAt).toISOString()}, server=${new Date(serverUpdatedAt).toISOString()})`)
            }

            const forceResult = await supabase!
              .from(tableName)
              .update(payload)
              .eq('id', entityId)
              .select()

            if (forceResult.error) {
              throw forceResult.error
            }

            result = forceResult
          } else {
            // BUG-1211 FIX: Server change is newer — our local change is discarded.
            // BUG-1320: Downgrade log for echo pattern (direct save + sync queue race).
            // When delta < 2s, this is almost always the sync queue echoing a direct save
            // that already succeeded — not a real conflict. Only warn for real conflicts.
            const deltaMs = serverUpdatedAt - localUpdatedAt
            const logFn = deltaMs < 2000 ? console.debug : console.warn
            logFn(`⚠️ [SYNC] LWW: Server wins for ${entityType}:${entityId} (delta=${deltaMs}ms). Local change DISCARDED (local=${new Date(localUpdatedAt).toISOString()}, server=${new Date(serverUpdatedAt).toISOString()}).${deltaMs < 2000 ? ' [echo — direct save already applied]' : ' Local state will update on next sync.'}`)

            return {
              success: true,
              operation,
              serverData: serverState.data
            }
          }
        }
        break
      }

      case 'delete': {
        const isQueuedPermanentTaskDelete = entityType === 'task' && payload.permanentDelete === true

        if (isQueuedPermanentTaskDelete) {
          result = await supabase!
            .from(tableName)
            .delete()
            .eq('id', entityId)
            .select()

          if (!result.error) {
            const userId = operation.userId || (payload.user_id as string | undefined)
            if (userId) {
              const tombstoneResult = await supabase!
                .from(DB_TABLES.TOMBSTONES)
                .upsert({
                  user_id: userId,
                  entity_type: 'task',
                  entity_id: entityId,
                  deleted_at: new Date().toISOString(),
                  expires_at: null
                }, { onConflict: 'entity_type,entity_id,user_id' })

              if (tombstoneResult.error) {
                throw tombstoneResult.error
              }
            }
          }
          break
        }

        // BUG-1211 FIX: Use correct DB column name `is_deleted` (not app-side `_soft_deleted`).
        // The sync orchestrator bypasses supabaseMappers, so we must use DB column names directly.
        // Previously used `_soft_deleted` which ALWAYS failed, causing fallback to hard DELETE
        // which created permanent tombstones and broadcast realtime DELETE to all devices.
        //
        // Tables with soft-delete support (have is_deleted + deleted_at columns).
        // timer_sessions and quick_sort_sessions do NOT have these columns — hard DELETE instead.
        const softDeleteTables: SyncEntityType[] = ['task', 'group', 'project', 'lane']

        if (softDeleteTables.includes(entityType)) {
          result = await supabase!
            .from(tableName)
            .update({ is_deleted: true, deleted_at: new Date().toISOString() })
            .eq('id', entityId)
            .select()
        } else {
          // timer_session, quick_sort_session: no is_deleted/deleted_at columns
          result = await supabase!
            .from(tableName)
            .delete()
            .eq('id', entityId)
            .select()
        }

        // BUG-1211 FIX: Removed hard-delete fallback. If soft-delete fails, let the retry
        // mechanism handle it. Hard deletes create permanent tombstones and are unrecoverable.
        break
      }
    }

    if (result.error) {
      throw result.error
    }

    // Extract new version if available
    const newVersion = (entityType === 'task' || entityType === 'group')
      ? result.data?.[0]?.position_version
      : undefined

    return {
      success: true,
      operation,
      newVersion,
      serverData: result.data?.[0],
    }
  } catch (error) {
    // Handle different error types - Supabase errors have a message property
    let errorMessage: string
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (error && typeof error === 'object' && 'message' in error) {
      // Supabase/Postgrest errors have message property
      errorMessage = String((error as { message: unknown }).message)
    } else if (error && typeof error === 'object') {
      // Try to stringify the object
      try {
        errorMessage = JSON.stringify(error)
      } catch {
        errorMessage = 'Unknown error (object)'
      }
    } else {
      errorMessage = String(error)
    }
    const classification = classifyError(error)
    const retryConfig = getRetryConfigForError(classification)
    const retryAfterCooldown = classification === 'rate_limit' ? getRetryAfterCooldown(error) : undefined
    const cooldownUntil = retryAfterCooldown ? Date.now() + retryAfterCooldown : undefined

    return {
      success: false,
      operation,
      error: errorMessage,
      isConflict: classification === 'conflict',
      isAuthError: classification === 'auth',
      shouldRetry: retryConfig !== null && shouldRetry(operation.retryCount, retryConfig),
      classification,
      cooldownUntil
    }
  }
}

/**
 * Process a single operation from the queue
 */
async function processOperation(operation: WriteOperation): Promise<SyncResult | undefined> {
  if (!operation.id) return undefined

  // Mark as syncing
  await markSyncing(operation.id)

  // Execute the operation
  const result = await executeOperation(operation)

  if (result.success) {
    const returnedCanonicalRevision = Number(result.serverData?.canonical_revision)
    // Success - mark completed
    if (result.canonicalReceipt) {
      await completeCanonicalOperation(operation.id, result.canonicalReceipt)
    } else if (
      operation.entityType === 'task'
      && operation.operation === 'update'
      && Number.isInteger(returnedCanonicalRevision)
      && returnedCanonicalRevision > 0
    ) {
      await completeLegacyTaskOperation(operation.id, returnedCanonicalRevision)
    } else {
      await markCompleted(operation.id)
    }
    let hasLaterUnresolvedTaskOperation = false
    if (operation.entityType === 'task') {
      try {
        hasLaterUnresolvedTaskOperation = await hasLaterUnresolvedOperation(operation)
      } catch (error) {
        // Preserve optimistic state when queue ordering cannot be proven safely.
        hasLaterUnresolvedTaskOperation = true
        console.warn('[SYNC] Could not verify later task operations; preserving optimistic state:', error)
      }
    }
    await invalidateSyncedEntityCache(operation.entityType)
    state.value.lastSyncAt = Date.now()
    consecutiveTransientFailures = 0  // BUG-P1: reset on any success

    if (operation.entityType === 'task' && !hasLaterUnresolvedTaskOperation) {
      try {
        const { useTaskStore } = await import('@/stores/tasks')
        useTaskStore().removePendingWrite(operation.entityId)
      } catch (e) {
        console.warn(`[SYNC] Failed to clear pending-write guard for ${operation.entityId.slice(0, 8)}:`, e)
      }
    }

    // BUG-1321: When LWW "server wins", apply serverData back to Pinia store.
    // Without this, the local store silently diverges from VPS truth.
    if (result.canonicalReceipt && operation.entityType === 'task' && !hasLaterUnresolvedTaskOperation) {
      try {
        const { useTaskStore } = await import('@/stores/tasks')
        await useTaskStore().applyCanonicalTaskReceipt(result.canonicalReceipt)
      } catch (error) {
        console.warn('[SYNC] Failed to project canonical receipt into task state:', error)
      }
    } else if (result.serverData && operation.entityType === 'task' && !hasLaterUnresolvedTaskOperation) {
      try {
        const { useTaskStore } = await import('@/stores/tasks')
        const taskStore = useTaskStore()

        // FIX: Skip LWW writeback when the task has a pending write.
        // A pending write means we just saved this task — the server data is an echo
        // of our own save that could overwrite fresher local edits.
        if (taskStore.isPendingWrite(operation.entityId)) {
          if (import.meta.env.DEV) {
            console.log(`[SYNC] Skipping LWW writeback for ${operation.entityId.slice(0, 8)} — pending write (local data is fresher)`)
          }
        } else {
          // BUG-1799: Never let an LWW writeback resurrect a locally-deleted task.
          // updateTaskFromSync ADDS a task when it's absent from the store (idx === -1), so for a
          // task the user already deleted, a stale queued update's writeback would re-add it —
          // and a blank server title gets sanitized to "Untitled Task". Honor the server tombstone,
          // and skip re-adding tasks that are no longer present locally. rawTasks is the unfiltered
          // list (view filters must not make a present task look deleted).
          const serverIsDeleted = (result.serverData as { is_deleted?: boolean }).is_deleted === true
          const existsLocally = taskStore.rawTasks.some(t => t.id === operation.entityId)
          if (serverIsDeleted) {
            taskStore.updateTaskFromSync(operation.entityId, null, true)
            if (import.meta.env.DEV) {
              console.log(`[SYNC] LWW: server tombstone applied (removed) for ${operation.entityId.slice(0, 8)}`)
            }
          } else if (!existsLocally) {
            if (import.meta.env.DEV) {
              console.log(`[SYNC] Skipping LWW writeback for ${operation.entityId.slice(0, 8)} — not present locally (deleted); not resurrecting`)
            }
          } else {
            const { fromSupabaseTask } = await import('@/utils/supabaseMappers')
            const mappedTask = fromSupabaseTask(result.serverData as unknown as Parameters<typeof fromSupabaseTask>[0])
            taskStore.updateTaskFromSync(operation.entityId, mappedTask, false)
            if (import.meta.env.DEV) {
              console.log(`[SYNC] LWW server data applied to store for ${operation.entityId.slice(0, 8)}`)
            }
          }
        }
      } catch (e) {
        console.warn(`[SYNC] Failed to apply LWW server data to store:`, e)
      }
    }

    if (import.meta.env.DEV) {
      console.log(`✅ [SYNC] ${operation.entityType}:${operation.operation} ${operation.entityId.slice(0, 8)} synced`)
    }
  } else if (result.isConflict) {
    // Conflict - need resolution
    await markConflict(operation.id!, result.newVersion || 0)
    state.value.lastError = result.error
    console.warn(`⚠️ [SYNC] Conflict: ${operation.entityType}:${operation.entityId.slice(0, 8)}`)
  } else if (result.isAuthError) {
    // BUG-1517: JWT expired mid-sync — attempt token refresh and retry immediately.
    // Supabase's auto-refresh usually handles this, but doesn't fire during active sync.
    // We cap refresh attempts at 3 to avoid infinite loops; failure promotes to permanent.
    const AUTH_MAX_REFRESH_ATTEMPTS = 3
    if (operation.retryCount < AUTH_MAX_REFRESH_ATTEMPTS) {
      console.warn(`🔑 [SYNC] Auth error for ${operation.entityType}:${operation.entityId.slice(0, 8)} (attempt ${operation.retryCount + 1}/${AUTH_MAX_REFRESH_ATTEMPTS}) — refreshing token`)
      try {
        const { error: refreshError } = await supabase!.auth.refreshSession()
        if (refreshError) {
          // Refresh itself failed — user is truly logged out, give up
          await markFailed(operation.id, `Auth refresh failed: ${refreshError.message}`, Date.now() + 365 * 24 * 60 * 60 * 1000)
          state.value.lastError = `Auth refresh failed: ${refreshError.message}`
          console.error(`❌ [SYNC] Auth refresh failed for ${operation.entityType}:${operation.entityId.slice(0, 8)} — marking permanent`)
          permanentFailureCallbacks.forEach(cb => cb(operation))
        } else {
          // Token refreshed — reset to pending with a short delay (1s) so the
          // next queue cycle picks it up immediately rather than waiting 5s.
          const nextRetryAt = Date.now() + 1000
          await markFailed(operation.id, result.error || 'Auth error', nextRetryAt)
          console.log(`✅ [SYNC] Token refreshed — ${operation.entityType}:${operation.entityId.slice(0, 8)} rescheduled in 1s`)
        }
      } catch (refreshException) {
        // Unexpected error during refresh — treat as permanent
        const msg = refreshException instanceof Error ? refreshException.message : String(refreshException)
        await markFailed(operation.id, `Auth refresh exception: ${msg}`, Date.now() + 365 * 24 * 60 * 60 * 1000)
        state.value.lastError = `Auth refresh exception: ${msg}`
        console.error(`❌ [SYNC] Auth refresh threw for ${operation.entityType}:${operation.entityId.slice(0, 8)} — marking permanent`)
        permanentFailureCallbacks.forEach(cb => cb(operation))
      }
    } else {
      // Exhausted refresh attempts — user is logged out, mark permanent
      await markFailed(operation.id, result.error || 'Auth error (max retries)', Date.now() + 365 * 24 * 60 * 60 * 1000)
      state.value.lastError = result.error
      console.error(`❌ [SYNC] Auth retries exhausted for ${operation.entityType}:${operation.entityId.slice(0, 8)} — marking permanent`)
      permanentFailureCallbacks.forEach(cb => cb(operation))
    }
  } else if (result.classification === 'rate_limit' && result.shouldRetry) {
    const retryConfig = getRetryConfigForError(result.classification as ErrorClassification)
    const nextRetryAt = result.cooldownUntil ?? calculateNextRetryTime(operation.retryCount, retryConfig ?? undefined)
    openRemoteWriteCooldown(nextRetryAt, result.error || 'Supabase rate limited writes')
    await markFailed(operation.id, result.error || 'Rate limited', nextRetryAt)
    state.value.lastError = result.error || 'Rate limited'
    console.warn(`⏳ [SYNC] Rate limited. Pausing remote writes for ${Math.round((nextRetryAt - Date.now()) / 1000)}s`)
  } else if (result.shouldRetry) {
    // Transient error - schedule retry
    const retryConfig = result.classification
      ? getRetryConfigForError(result.classification as ErrorClassification)
      : undefined
    const nextRetryAt = calculateNextRetryTime(operation.retryCount, retryConfig ?? undefined)
    await markFailed(operation.id, result.error || 'Unknown error', nextRetryAt)
    if (import.meta.env.DEV) {
      console.warn(`⚠️ [SYNC] Retry scheduled: ${operation.entityType}:${operation.entityId.slice(0, 8)} in ${Math.round((nextRetryAt - Date.now()) / 1000)}s`)
    }

    // BUG-P1: Server-unreachable detection — if consecutive transient failures exceed threshold,
    // pause the queue for 60s instead of burning the retry budget. Reset when connectivity returns.
    consecutiveTransientFailures++
    if (consecutiveTransientFailures >= TRANSIENT_PAUSE_THRESHOLD) {
      if (import.meta.env.DEV) {
        console.warn(`[SYNC] Server appears unreachable (${consecutiveTransientFailures} consecutive transient failures), pausing queue for 60s`)
      }
      state.value.isOnline = false
      setTimeout(() => {
        state.value.isOnline = getInitialOnlineState()
        consecutiveTransientFailures = 0
        if (state.value.isOnline) {
          console.log('[SYNC] Queue pause lifted — resuming sync')
          processQueue()
        }
      }, 60000)
    }
  } else {
    // Permanent error - mark as failed (won't auto-retry)
    await markFailed(operation.id, result.error || 'Permanent error', Date.now() + 365 * 24 * 60 * 60 * 1000) // Far future = won't auto-retry
    state.value.lastError = result.error
    console.error(`❌ [SYNC] Permanent failure: ${operation.entityType}:${operation.entityId.slice(0, 8)} - ${result.error}`)
    permanentFailureCallbacks.forEach(cb => cb(operation))
  }
  return result
}

/**
 * Process the queue of pending operations
 */
async function runProcessQueue(): Promise<void> {
  // Skip if already processing, offline, or no supabase
  if (isProcessing.value || !state.value.isOnline || !supabase) {
    return
  }
  // Claim the queue before any async preflight so two callers cannot both pass
  // the guard and submit the same durable operation concurrently.
  isProcessing.value = true

  if (isRemoteWriteCoolingDown()) {
    if (import.meta.env.DEV) {
      const remaining = Math.round(((state.value.remoteWriteCooldownUntil ?? Date.now()) - Date.now()) / 1000)
      console.debug(`[SYNC] Remote write cooldown active (${remaining}s): ${state.value.remoteWriteCooldownReason ?? 'backpressure'}`)
    }
    isProcessing.value = false
    return
  }

  // Skip if workspace switch is in progress (avoid 400s from stale RLS context)
  try {
    const { useWorkspaceStore } = await import('@/stores/workspace')
    const workspaceStore = useWorkspaceStore()
    if (workspaceStore.isSwitchingWorkspace) {
      if (import.meta.env.DEV) {
        console.debug('[SYNC] Skipping queue — workspace switch in progress')
      }
      isProcessing.value = false
      return
    }
  } catch { /* workspace store not available */ }

  // BUG-1926: After an Electron update/restart the auth store can intentionally
  // keep a signed-in shell while refresh recovery is still in progress
  // (`canSyncRemotely === false`). Do not convert that bounded reconnect grace
  // into the scarier "Sign-in expired" write-health error; leave queued writes
  // pending until auth is actually allowed to hit RLS again.
  try {
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    if (authStore.user?.id && authStore.canSyncRemotely === false) {
      consecutiveAuthGateSkips = 0
      const stats = await getStats().catch(() => null)
      if (stats) {
        state.value.pendingCount = stats.pendingCount + stats.syncingCount
        state.value.failedCount = stats.failedCount + stats.conflictCount
      }
      state.value.status = state.value.pendingCount > 0 ? 'pending' : 'synced'
      state.value.lastError = undefined
      if (import.meta.env.DEV) {
        console.debug('[SYNC] Holding queue — auth reconnect grace is active')
      }
      isProcessing.value = false
      return
    }
  } catch { /* auth store not available */ }

  if (!(await getCurrentAuthUserId())) {
    if (import.meta.env.DEV) {
      console.debug('[SYNC] Skipping queue — no fresh auth session for RLS writes')
    }
    // BUG-1913: this gate used to skip SILENTLY forever. With a dead supabase
    // session under a signed-in UI shell (BUG-1874 recovery path), the queue
    // never flushed and edits/deletions dropped for hours behind a green
    // indicator. Still wait (never hit RLS without a session) — but with
    // pending work stuck behind a repeatedly-absent session, surface it.
    consecutiveAuthGateSkips++
    if (consecutiveAuthGateSkips >= AUTH_GATE_SURFACE_AFTER) {
      const pendingOps = await getPendingOperations().catch(() => [])
      if (pendingOps.length > 0) {
        const message = 'Sign-in expired — changes are kept on this device and will sync after you sign in again'
        state.value.status = 'error'
        state.value.lastError = message
        reportWriteFailure('queueFlushAuthGate', message)
      }
    }
    isProcessing.value = false
    return
  }
  consecutiveAuthGateSkips = 0

  try {
    // BUG-1301: Recover operations stuck in 'syncing' from a previous session crash.
    // These ops were marked 'syncing' but never completed — reset them to 'pending'
    // so they can be retried. Without this, they're stuck forever because
    // getPendingOperations() only returns 'pending' and 'failed'.
    await recoverStaleSyncing()
    await recoverRlsPolicyFailures()

    // BUG-6: Purge pending operations older than 24h to prevent stale queue replay
    // from resurrecting tasks that were deleted days ago on another device.
    try {
      const { purgeStaleOperations } = await import('@/services/offline/writeQueueDB')
      await purgeStaleOperations()
    } catch { /* writeQueueDB not available */ }

    // Get pending operations FIRST before setting status
    const operations = await getPendingOperations()

    if (operations.length === 0) {
      // Clean up completed operations (silent, don't change status)
      await cleanupCompleted()
      // Only update status if currently in error or syncing state
      if (state.value.status === 'syncing' || state.value.status === 'error') {
        await updateStatus()
      }
      return
    }

    // Only set syncing if we actually have operations to process
    state.value.status = 'syncing'

    // Sort operations for correct execution order
    const sorted = sortOperations(operations)

    // Process operations sequentially for now
    // TODO: Optimize with batching for independent operations
    const blockedEntities = new Set<string>()
    for (const operation of sorted) {
      const entityKey = `${operation.userId ?? 'anonymous'}:${operation.workspaceId ?? 'personal'}:${operation.entityType}:${operation.entityId}`
      if (blockedEntities.has(entityKey) || await hasEarlierUnresolvedOperation(operation)) continue
      if (operation.canonicalTaskPatch) {
        let canonicalOperation = operation
        const canonical = operation.canonicalTaskPatch
        if (canonical.phase === 'queued') {
          const predecessor = operation.userId
            ? await getLatestCanonicalCheckpointForEntity(operation.entityId, operation.userId, operation.workspaceId ?? null)
            : undefined
          if (predecessor && predecessor.canonicalRevision > canonical.baseRevision) {
            const rebased = {
              ...canonical,
              baseRevision: predecessor.canonicalRevision,
              parentOperationId: predecessor.operationId,
            }
            await updateOperation(operation.id!, { canonicalTaskPatch: rebased })
            canonicalOperation = { ...operation, canonicalTaskPatch: rebased }
          }
        }
        const result = await processOperation(canonicalOperation)
        if (result && !result.success) blockedEntities.add(entityKey)
        continue
      }
      // Coalesce before syncing (merge multiple updates to same entity)
      const coalesced = await coalesceOperationsForEntity(
        operation.entityType,
        operation.entityId
      )

      if (coalesced.operation) {
        const result = await processOperation(coalesced.operation)
        if (result && !result.success) blockedEntities.add(entityKey)
      }

      // Check if we're still online
      if (!state.value.isOnline) {
        if (import.meta.env.DEV) {
          console.debug('[SYNC] Went offline during sync, pausing')
        }
        break
      }
    }

    // Clean up completed operations
    await cleanupCompleted()
  } catch (error) {
    console.error('[SYNC] Queue processing error:', error)
    state.value.lastError = error instanceof Error ? error.message : String(error)
  } finally {
    isProcessing.value = false
    await updateStatus()
  }
}

let activeProcessQueuePromise: Promise<void> | null = null

async function processQueue(): Promise<void> {
  if (activeProcessQueuePromise) return activeProcessQueuePromise
  const run = runProcessQueue()
  activeProcessQueuePromise = run
  try {
    await run
  } finally {
    if (activeProcessQueuePromise === run) activeProcessQueuePromise = null
  }
}

/**
 * Start the sync processing loop
 */
function startProcessing(): void {
  if (processIntervalId.value) return

  setupOnlineListeners()

  // Initial status update
  updateStatus()

  // Process immediately
  processQueue()

  // Then process periodically
  processIntervalId.value = setInterval(processQueue, PROCESS_INTERVAL_MS)
}

/**
 * Stop the sync processing loop
 */
function _stopProcessing(): void {
  if (processIntervalId.value) {
    clearInterval(processIntervalId.value)
    processIntervalId.value = null
  }
}

// Track whether the global sync loop has been started (prevents interval stacking on HMR/re-init)
let globalSyncStarted = false

/**
 * Main composable export
 */
export function useSyncOrchestrator() {
  // Guard against interval stacking: only start once globally
  if (!globalSyncStarted) {
    globalSyncStarted = true
    startProcessing()
  }

  /**
   * Enqueue a write operation for sync
   *
   * This is the main entry point for the offline-first system.
   * Call this instead of directly calling Supabase.
   */
  const enqueue = async (
    operation: {
      entityType: SyncEntityType
      operation: SyncOperationType
      entityId: string
      payload: Record<string, unknown>
      baseVersion?: number
      canonicalTaskPatch?: WriteOperation['canonicalTaskPatch']
    }
  ): Promise<WriteOperation> => {
    // Get current user ID
    let userId: string | undefined
    try {
      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()
      userId = authStore.user?.id
    } catch {
      // Auth store not available
    }

    // Capture workspace context at enqueue time (null = personal workspace)
    const workspaceId = await getActiveWorkspaceId()

    // BUG-1534: When enqueuing a DELETE, cancel any pending CREATEs for the same entity.
    // This prevents stale CREATEs from resurrecting deleted tasks after page reload.
    if (operation.operation === 'delete') {
      try {
        const { getOperationsForEntity, deleteOperation: deleteOp } = await import('@/services/offline/writeQueueDB')
        const pendingOps = await getOperationsForEntity(operation.entityType, operation.entityId)
        for (const op of pendingOps) {
          if (op.operation === 'create' && (op.status === 'pending' || op.status === 'failed')) {
            await deleteOp(op.id!)
            if (import.meta.env.DEV) {
              console.debug(`🗑️ [SYNC] Cancelled stale CREATE for ${operation.entityType}:${operation.entityId.slice(0, 8)} (DELETE takes precedence)`)
            }
          }
        }
      } catch (e) {
        console.warn('[SYNC] Failed to cancel pending CREATEs on DELETE:', e)
      }
    }

    // Enqueue the operation
    const queued = await enqueueOperation({
      ...operation,
      userId,
      workspaceId
    })

    if (import.meta.env.DEV) {
      console.debug(`📝 [SYNC] Queued: ${operation.entityType}:${operation.operation} ${operation.entityId.slice(0, 8)}`)
    }

    // Update status
    await updateStatus()

    // Trigger immediate processing if online
    if (state.value.isOnline && !isProcessing.value) {
      processQueue()
    }

    return queued
  }

  /**
   * Force retry all failed operations
   */
  const retryFailed = async (): Promise<void> => {
    if (import.meta.env.DEV) {
      console.debug('[SYNC] Manual retry of failed operations')
    }

    // Get all failed operations and reset their retry time
    const failed = await getFailedOperations()

    for (const op of failed) {
      if (op.id) {
        await import('@/services/offline/writeQueueDB').then(({ updateOperation }) =>
          updateOperation(op.id!, {
            status: 'pending',
            nextRetryAt: undefined
          })
        )
      }
    }

    // Trigger immediate processing
    await processQueue()
  }

  /**
   * Get current sync stats
   */
  const getQueueStats = async () => {
    return getStats()
  }

  /**
   * Subscribe to permanent sync failures (exhausted retries).
   * Use this to show user-facing toasts or notifications.
   * Returns an unsubscribe function.
   */
  const onPermanentFailure = (cb: (op: WriteOperation) => void): (() => void) => {
    permanentFailureCallbacks.add(cb)
    return () => permanentFailureCallbacks.delete(cb)
  }

  return {
    // State
    status: computed(() => state.value.status),
    pendingCount: computed(() => state.value.pendingCount),
    failedCount: computed(() => state.value.failedCount),
    lastSyncAt: computed(() => state.value.lastSyncAt),
    lastError: computed(() => state.value.lastError),
    isOnline: computed(() => state.value.isOnline),
    isProcessing: computed(() => isProcessing.value),
    remoteWriteCooldownUntil: computed(() => state.value.remoteWriteCooldownUntil),
    remoteWriteCooldownReason: computed(() => state.value.remoteWriteCooldownReason),

    // Derived
    hasPendingChanges: computed(() => state.value.pendingCount > 0 || state.value.status === 'syncing'),
    hasErrors: computed(() => state.value.failedCount > 0 || state.value.status === 'error'),
    canAttemptRemoteWrite: computed(() => state.value.isOnline && !isRemoteWriteCoolingDown()),

    // Actions
    enqueue,
    retryFailed,
    clearFailed: clearFailedOperations,
    getQueueStats,
    forceSync: processQueue,
    onPermanentFailure
  }
}

/**
 * Export state for direct access (e.g., from stores)
 */
export const syncState = state
