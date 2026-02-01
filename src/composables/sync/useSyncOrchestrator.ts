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
import {
  enqueueOperation,
  getPendingOperations,
  markSyncing,
  markCompleted,
  markFailed,
  markConflict,
  cleanupCompleted,
  getStats
} from '@/services/offline/writeQueueDB'
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
  state.value.failedCount = stats.failedCount

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
        // Insert with the entity ID
        const insertData = { id: entityId, ...payload }
        result = await supabase.from(tableName).insert(insertData).select()
        break
      }

      case 'update': {
        // Update with optimistic locking if version is available
        let query = supabase.from(tableName).update(payload).eq('id', entityId)

        if (operation.baseVersion !== undefined) {
          // Optimistic lock using position_version
          query = query.eq('position_version', operation.baseVersion)
        }

        result = await query.select()

        // Check for version conflict (no rows updated)
        if (!result.error && (!result.data || result.data.length === 0)) {
          // Conflict detected
          return {
            success: false,
            operation,
            isConflict: true,
            error: 'Version conflict - entity was modified by another device'
          }
        }
        break
      }

      case 'delete': {
        // Soft delete if the table supports it, otherwise hard delete
        // FlowState uses soft delete (_soft_deleted flag)
        result = await supabase
          .from(tableName)
          .update({ _soft_deleted: true })
          .eq('id', entityId)
          .select()

        // If soft delete fails, try hard delete
        if (result.error) {
          result = await supabase.from(tableName).delete().eq('id', entityId)
        }
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
    const errorMessage = error instanceof Error ? error.message : String(error)
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
  state.value.status = 'syncing'

  try {
    // Get pending operations
    const operations = await getPendingOperations()

    if (operations.length === 0) {
      // Clean up completed operations
      await cleanupCompleted()
      await updateStatus()
      return
    }

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
function _stopProcessing(): void {
  if (processIntervalId.value) {
    clearInterval(processIntervalId.value)
    processIntervalId.value = null
  }
}

/**
 * Main composable export
 */
export function useSyncOrchestrator() {
  // Start processing when composable is used
  startProcessing()

  // Clean up on unmount (optional - we want the sync to continue globally)
  // onUnmounted(() => {
  //   stopProcessing()
  // })

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
    getQueueStats,
    forceSync: processQueue
  }
}

/**
 * Export state for direct access (e.g., from stores)
 */
export const syncState = state
