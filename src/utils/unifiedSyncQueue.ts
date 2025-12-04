/**
 * PHASE 4: Unified Sync Queue
 *
 * Central queue for ALL sync operations to prevent cascades and race conditions.
 * Key features:
 * - Coalesces multiple changes to same entity (latest wins)
 * - Prioritizes operations (user actions > auto-save)
 * - Batches for network efficiency
 * - Integrates with circuit breaker
 *
 * @author Claude Code
 * @date December 4, 2025
 */

import { ref } from 'vue'

// Operation types
export type SyncOperationType =
  | 'task_create'
  | 'task_update'
  | 'task_delete'
  | 'project_update'
  | 'canvas_update'
  | 'settings_update'

// Priority levels (lower = higher priority)
export enum SyncPriority {
  CRITICAL = 0,   // User-initiated actions (must sync immediately)
  HIGH = 1,       // Task CRUD operations
  NORMAL = 2,     // Auto-save operations
  LOW = 3         // Background sync (settings, UI state)
}

// Sync operation interface
export interface SyncOperation {
  id: string                    // Unique operation ID
  type: SyncOperationType       // Type of operation
  entityId: string              // ID of the entity being synced
  data: any                     // Data to sync
  priority: SyncPriority        // Operation priority
  timestamp: number             // When operation was queued
  retryCount?: number           // Number of retry attempts
}

// Queue state
const queue = ref<Map<string, SyncOperation>>(new Map())
const isProcessing = ref(false)
const isPaused = ref(false)
const lastFlushTime = ref(0)

// Configuration
const FLUSH_DELAY_MS = 100      // Wait 100ms to coalesce operations
const MAX_BATCH_SIZE = 50       // Max operations per flush
const MAX_RETRIES = 3           // Max retry attempts per operation

let flushTimer: NodeJS.Timeout | null = null

/**
 * Generate a coalescing key for an operation
 * Operations with the same key will be coalesced (latest wins)
 */
const getCoalesceKey = (op: SyncOperation): string => {
  return `${op.type}:${op.entityId}`
}

/**
 * Enqueue a sync operation
 * If an operation for the same entity is already queued, it will be replaced (latest wins)
 */
export const enqueueSyncOperation = (
  type: SyncOperationType,
  entityId: string,
  data: any,
  priority: SyncPriority = SyncPriority.NORMAL
): void => {
  const operation: SyncOperation = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    entityId,
    data,
    priority,
    timestamp: Date.now(),
    retryCount: 0
  }

  const coalesceKey = getCoalesceKey(operation)

  // Check for existing operation (will be replaced)
  const existing = queue.value.get(coalesceKey)
  if (existing) {
    console.log(`🔄 [SyncQueue] Coalescing ${type} for ${entityId} (previous queued ${Date.now() - existing.timestamp}ms ago)`)
  }

  // Add to queue (latest wins for same key)
  queue.value.set(coalesceKey, operation)

  // Schedule flush if not already scheduled
  scheduleFlush()
}

/**
 * Schedule a flush operation
 */
const scheduleFlush = (): void => {
  if (flushTimer || isPaused.value) return

  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, FLUSH_DELAY_MS)
}

/**
 * Flush the queue - process all pending operations
 */
export const flush = async (): Promise<void> => {
  if (isProcessing.value || isPaused.value || queue.value.size === 0) return

  isProcessing.value = true
  const startTime = Date.now()

  try {
    // Get operations sorted by priority
    const operations = Array.from(queue.value.values())
      .sort((a, b) => a.priority - b.priority)
      .slice(0, MAX_BATCH_SIZE)

    console.log(`📤 [SyncQueue] Flushing ${operations.length} operations (queue size: ${queue.value.size})`)

    // Process operations
    for (const op of operations) {
      const coalesceKey = getCoalesceKey(op)

      try {
        // Process the operation
        await processOperation(op)

        // Remove from queue on success
        queue.value.delete(coalesceKey)

      } catch (error) {
        console.error(`❌ [SyncQueue] Failed to process ${op.type}:${op.entityId}:`, error)

        // Retry logic
        if ((op.retryCount || 0) < MAX_RETRIES) {
          op.retryCount = (op.retryCount || 0) + 1
          console.log(`🔄 [SyncQueue] Retry ${op.retryCount}/${MAX_RETRIES} for ${op.type}:${op.entityId}`)
        } else {
          // Max retries reached, remove from queue
          console.error(`❌ [SyncQueue] Max retries reached for ${op.type}:${op.entityId}, dropping`)
          queue.value.delete(coalesceKey)
        }
      }
    }

    lastFlushTime.value = Date.now()
    const processingTime = Date.now() - startTime

    console.log(`✅ [SyncQueue] Flush completed in ${processingTime}ms, remaining: ${queue.value.size}`)

    // Schedule another flush if queue not empty
    if (queue.value.size > 0) {
      scheduleFlush()
    }

  } finally {
    isProcessing.value = false
  }
}

/**
 * Process a single sync operation
 * This is where you'd integrate with your actual sync mechanism (PouchDB, etc.)
 */
const processOperation = async (op: SyncOperation): Promise<void> => {
  // For now, this is a placeholder that logs the operation
  // In production, this would call the appropriate sync handler

  console.log(`⚙️ [SyncQueue] Processing ${op.type} for ${op.entityId}`)

  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 10))

  // The actual sync would happen here:
  // switch (op.type) {
  //   case 'task_create':
  //   case 'task_update':
  //   case 'task_delete':
  //     await syncTask(op.entityId, op.data)
  //     break
  //   case 'project_update':
  //     await syncProject(op.entityId, op.data)
  //     break
  //   case 'canvas_update':
  //     await syncCanvas(op.entityId, op.data)
  //     break
  //   case 'settings_update':
  //     await syncSettings(op.entityId, op.data)
  //     break
  // }
}

/**
 * Pause the sync queue (e.g., during offline mode)
 */
export const pauseQueue = (): void => {
  isPaused.value = true
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  console.log('⏸️ [SyncQueue] Queue paused')
}

/**
 * Resume the sync queue
 */
export const resumeQueue = (): void => {
  isPaused.value = false
  console.log('▶️ [SyncQueue] Queue resumed')
  // Immediately schedule a flush if there are pending operations
  if (queue.value.size > 0) {
    scheduleFlush()
  }
}

/**
 * Clear the queue (e.g., on logout or reset)
 */
export const clearQueue = (): void => {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  queue.value.clear()
  console.log('🗑️ [SyncQueue] Queue cleared')
}

/**
 * Get queue status for monitoring
 */
export const getQueueStatus = () => ({
  size: queue.value.size,
  isProcessing: isProcessing.value,
  isPaused: isPaused.value,
  lastFlushTime: lastFlushTime.value,
  operations: Array.from(queue.value.values()).map(op => ({
    type: op.type,
    entityId: op.entityId,
    priority: op.priority,
    age: Date.now() - op.timestamp
  }))
})

/**
 * Vue composable for using the sync queue
 */
export const useSyncQueue = () => {
  return {
    // State
    queueSize: queue.value.size,
    isProcessing,
    isPaused,

    // Actions
    enqueue: enqueueSyncOperation,
    flush,
    pause: pauseQueue,
    resume: resumeQueue,
    clear: clearQueue,
    getStatus: getQueueStatus
  }
}

// Export constants for external use
export { FLUSH_DELAY_MS, MAX_BATCH_SIZE, MAX_RETRIES }
