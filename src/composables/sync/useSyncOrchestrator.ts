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

// TASK-1177: Check for IndexedDB availability (not available in Node.js/tests)
const hasIndexedDB = typeof indexedDB !== 'undefined'

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

// Re-export types and stub functions for when IndexedDB is unavailable
import {
  enqueueOperation as _enqueueOperation,
  getPendingOperations as _getPendingOperations,
  markSyncing as _markSyncing,
  markCompleted as _markCompleted,
  markFailed as _markFailed,
  markConflict as _markConflict,
  cleanupCompleted as _cleanupCompleted,
  getStats as _getStats,
  getFailedOperations as _getFailedOperations
} from '@/services/offline/writeQueueDB'

// Wrapped functions that handle missing IndexedDB gracefully
const enqueueOperation: typeof _enqueueOperation = async (...args) => {
  const mod = await getWriteQueueModule()
  if (!mod) {
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
  getRetryConfigForError
} from '@/services/offline/retryStrategy'
import { coalesceOperationsForEntity } from '@/services/offline/operationCoalescer'
import { sortOperations } from '@/services/offline/operationSorter'
import { supabase } from '@/services/auth/supabase'

// Singleton state (shared across all components using this composable)
const state = ref<SyncState>({
  status: 'synced',
  pendingCount: 0,
  failedCount: 0,
  lastSyncAt: undefined,
  lastError: undefined,
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  failedOperations: []
})

// Processing state
const isProcessing = ref(false)
const processIntervalId = ref<ReturnType<typeof setInterval> | null>(null)
const PROCESS_INTERVAL_MS = 5000 // Check queue every 5 seconds

// Online/offline listeners (set up once)
let listenersSetUp = false

/**
 * Set up online/offline event listeners
 */
function setupOnlineListeners() {
  if (listenersSetUp || typeof window === 'undefined') return

  const handleOnline = () => {
    console.log('[SYNC] Network online - resuming sync')
    state.value.isOnline = true
    updateStatus()
    // Trigger immediate sync attempt
    processQueue()
  }

  const handleOffline = () => {
    console.log('[SYNC] Network offline - pausing sync')
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
  const { entityType, entityId, payload } = operation

  // Map entity type to Supabase table name
  const tableMap: Record<SyncEntityType, string> = {
    task: 'tasks',
    group: 'groups',
    project: 'projects',
    timer_session: 'timer_sessions'
  }
  const tableName = tableMap[entityType]

  try {
    let result

    switch (operation.operation) {
      case 'create': {
        const insertData = { id: entityId, ...payload }
        // BUG-1212: Use upsert instead of insert to handle duplicate key gracefully.
        // When the direct save (createTask → saveSpecificTasks) succeeds before the
        // sync queue processes, the row already exists. Using upsert makes this
        // idempotent — matching the pattern in useSupabaseDatabase.ts saveTask/saveTasks.
        console.debug(`🔄 [SYNC] CREATE via upsert for ${entityType}:${entityId} (idempotent)`)
        result = await supabase.from(tableName).upsert(insertData, { onConflict: 'id' }).select()
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

        let query = supabase.from(tableName).update(payload).eq('id', entityId)

        if (operation.baseVersion !== undefined) {
          // Optimistic lock using position_version
          query = query.eq('position_version', operation.baseVersion)
        }

        result = await query.select()

        // Check for version conflict (no rows updated)
        if (!result.error && (!result.data || result.data.length === 0)) {
          console.debug(`[SYNC] Version conflict detected for ${entityType}:${entityId}, attempting LWW resolution`)

          // Fetch current server state
          const serverState = await supabase
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
            console.log(`✅ [SYNC] LWW: Local wins (local=${new Date(localUpdatedAt).toISOString()}, server=${new Date(serverUpdatedAt).toISOString()})`)

            const forceResult = await supabase
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
        // BUG-1211 FIX: Use correct DB column name `is_deleted` (not app-side `_soft_deleted`).
        // The sync orchestrator bypasses supabaseMappers, so we must use DB column names directly.
        // Previously used `_soft_deleted` which ALWAYS failed, causing fallback to hard DELETE
        // which created permanent tombstones and broadcast realtime DELETE to all devices.
        result = await supabase
          .from(tableName)
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq('id', entityId)
          .select()

        // BUG-1211 FIX: Removed hard-delete fallback. If soft-delete fails, let the retry
        // mechanism handle it. Hard deletes create permanent tombstones and are unrecoverable.
        break
      }
    }

    if (result.error) {
      throw result.error
    }

    // Extract new version if available
    const newVersion = result.data?.[0]?.position_version

    return {
      success: true,
      operation,
      newVersion
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

    return {
      success: false,
      operation,
      error: errorMessage,
      isConflict: classification === 'conflict',
      shouldRetry: retryConfig !== null && shouldRetry(operation.retryCount, retryConfig)
    }
  }
}

/**
 * Process a single operation from the queue
 */
async function processOperation(operation: WriteOperation): Promise<void> {
  if (!operation.id) return

  // Mark as syncing
  await markSyncing(operation.id)

  // Execute the operation
  const result = await executeOperation(operation)

  if (result.success) {
    // Success - mark completed
    await markCompleted(operation.id)
    state.value.lastSyncAt = Date.now()
    console.log(`✅ [SYNC] ${operation.entityType}:${operation.operation} ${operation.entityId.slice(0, 8)} synced`)
  } else if (result.isConflict) {
    // Conflict - need resolution
    await markConflict(operation.id, result.newVersion || 0)
    state.value.lastError = result.error
    console.warn(`⚠️ [SYNC] Conflict: ${operation.entityType}:${operation.entityId.slice(0, 8)}`)
  } else if (result.shouldRetry) {
    // Transient error - schedule retry
    const nextRetryAt = calculateNextRetryTime(operation.retryCount)
    await markFailed(operation.id, result.error || 'Unknown error', nextRetryAt)
    console.warn(`⚠️ [SYNC] Retry scheduled: ${operation.entityType}:${operation.entityId.slice(0, 8)} in ${Math.round((nextRetryAt - Date.now()) / 1000)}s`)
  } else {
    // Permanent error - mark as failed (won't auto-retry)
    await markFailed(operation.id, result.error || 'Permanent error', Date.now() + 365 * 24 * 60 * 60 * 1000) // Far future = won't auto-retry
    state.value.lastError = result.error
    console.error(`❌ [SYNC] Permanent failure: ${operation.entityType}:${operation.entityId.slice(0, 8)} - ${result.error}`)
  }
}

/**
 * Process the queue of pending operations
 */
async function processQueue(): Promise<void> {
  // Skip if already processing, offline, or no supabase
  if (isProcessing.value || !state.value.isOnline || !supabase) {
    return
  }

  isProcessing.value = true

  try {
    // BUG-1301: Recover operations stuck in 'syncing' from a previous session crash.
    // These ops were marked 'syncing' but never completed — reset them to 'pending'
    // so they can be retried. Without this, they're stuck forever because
    // getPendingOperations() only returns 'pending' and 'failed'.
    await recoverStaleSyncing()

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
    for (const operation of sorted) {
      // Coalesce before syncing (merge multiple updates to same entity)
      const coalesced = await coalesceOperationsForEntity(
        operation.entityType,
        operation.entityId
      )

      if (coalesced.operation) {
        await processOperation(coalesced.operation)
      }

      // Check if we're still online
      if (!state.value.isOnline) {
        console.log('[SYNC] Went offline during sync, pausing')
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
function stopProcessing(): void {
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

    // Enqueue the operation
    const queued = await enqueueOperation({
      ...operation,
      userId
    })

    console.log(`📝 [SYNC] Queued: ${operation.entityType}:${operation.operation} ${operation.entityId.slice(0, 8)}`)

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
    console.log('[SYNC] Manual retry of failed operations')

    // Get all failed operations and reset their retry time
    const operations = await getPendingOperations(100)
    const failed = operations.filter(op => op.status === 'failed')

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

  return {
    // State
    status: computed(() => state.value.status),
    pendingCount: computed(() => state.value.pendingCount),
    failedCount: computed(() => state.value.failedCount),
    lastSyncAt: computed(() => state.value.lastSyncAt),
    lastError: computed(() => state.value.lastError),
    isOnline: computed(() => state.value.isOnline),
    isProcessing: computed(() => isProcessing.value),

    // Derived
    hasPendingChanges: computed(() => state.value.pendingCount > 0 || state.value.status === 'syncing'),
    hasErrors: computed(() => state.value.failedCount > 0 || state.value.status === 'error'),

    // Actions
    enqueue,
    retryFailed,
    clearFailed: clearFailedOperations,
    getQueueStats,
    forceSync: processQueue
  }
}

/**
 * Export state for direct access (e.g., from stores)
 */
export const syncState = state
