/**
 * IndexedDB Write Queue using Dexie.js
 *
 * CRITICAL: This is the persistence layer for the offline-first sync system.
 * All writes go here FIRST, then sync to Supabase.
 *
 * Key behaviors:
 * - Operations persist across browser sessions
 * - Automatic retry with exponential backoff
 * - Never discards operations until confirmed synced
 * - Supports offline editing with eventual consistency
 */

import Dexie, { type Table } from 'dexie'
import type { WriteOperation, WriteConflict, SyncEntityType } from '@/types/sync'

/**
 * FlowState Sync Database
 *
 * Uses Dexie.js for type-safe IndexedDB access.
 * Database name includes a version suffix for schema migrations.
 */
class WriteQueueDatabase extends Dexie {
  /** Pending write operations */
  operations!: Table<WriteOperation, number>

  /** Detected conflicts for manual resolution */
  conflicts!: Table<WriteConflict, number>

  /** Metadata for sync state */
  metadata!: Table<{ key: string; value: unknown }, string>

  constructor() {
    super('FlowStateSyncQueue')

    // Define schema
    // Version 1: Initial schema
    this.version(1).stores({
      // Primary key is auto-incremented 'id'
      // Indexes: status (for filtering), entityType+entityId (for coalescing),
      // createdAt (for ordering), nextRetryAt (for scheduling)
      operations: '++id, status, [entityType+entityId], createdAt, nextRetryAt, userId',

      // Conflicts: indexed by operation ID and detection time
      conflicts: '++id, [operation.entityType+operation.entityId], detectedAt',

      // Metadata: key-value store for sync state
      metadata: 'key'
    })
  }
}

// Singleton instance
let db: WriteQueueDatabase | null = null

/**
 * Get the database instance (lazy initialization)
 */
export function getWriteQueueDB(): WriteQueueDatabase {
  if (!db) {
    db = new WriteQueueDatabase()
  }
  return db
}

/**
 * Enqueue a new write operation
 *
 * @param operation The operation to queue (without id, status, retryCount, createdAt)
 * @returns The queued operation with generated fields
 */
export async function enqueueOperation(
  operation: Omit<WriteOperation, 'id' | 'status' | 'retryCount' | 'createdAt'>
): Promise<WriteOperation> {
  const db = getWriteQueueDB()

  const now = Date.now()
  const fullOperation: WriteOperation = {
    ...operation,
    status: 'pending',
    retryCount: 0,
    createdAt: now
  }

  const id = await db.operations.add(fullOperation)
  return { ...fullOperation, id }
}

/**
 * Get all pending operations ready for sync
 *
 * Returns operations that are:
 * - Status is 'pending' or 'failed' (not 'syncing' or 'completed')
 * - nextRetryAt is undefined or in the past
 *
 * @param limit Maximum number of operations to return
 */
export async function getPendingOperations(limit = 50): Promise<WriteOperation[]> {
  const db = getWriteQueueDB()
  const now = Date.now()

  // Get operations that are ready to sync
  const operations = await db.operations
    .where('status')
    .anyOf(['pending', 'failed'])
    .filter(op => !op.nextRetryAt || op.nextRetryAt <= now)
    .limit(limit)
    .toArray()

  // Sort by createdAt to maintain order
  return operations.sort((a, b) => a.createdAt - b.createdAt)
}

/**
 * Get all operations for a specific entity
 *
 * Useful for coalescing multiple updates to the same entity.
 */
export async function getOperationsForEntity(
  entityType: SyncEntityType,
  entityId: string
): Promise<WriteOperation[]> {
  const db = getWriteQueueDB()

  return db.operations
    .where('[entityType+entityId]')
    .equals([entityType, entityId])
    .toArray()
}

/**
 * Update an operation's status and metadata
 */
export async function updateOperation(
  id: number,
  updates: Partial<WriteOperation>
): Promise<void> {
  const db = getWriteQueueDB()
  await db.operations.update(id, updates)
}

/**
 * Mark an operation as syncing (in progress)
 */
export async function markSyncing(id: number): Promise<void> {
  await updateOperation(id, {
    status: 'syncing',
    lastAttemptAt: Date.now()
  })
}

/**
 * Mark an operation as completed (successfully synced)
 */
export async function markCompleted(id: number): Promise<void> {
  await updateOperation(id, {
    status: 'completed'
  })
}

/**
 * Mark an operation as failed with retry scheduling
 */
export async function markFailed(
  id: number,
  error: string,
  nextRetryAt: number
): Promise<void> {
  const db = getWriteQueueDB()
  const operation = await db.operations.get(id)

  if (operation) {
    await updateOperation(id, {
      status: 'failed',
      lastError: error,
      retryCount: operation.retryCount + 1,
      nextRetryAt
    })
  }
}

/**
 * Mark an operation as having a conflict
 */
export async function markConflict(
  id: number,
  serverVersion: number,
  serverData?: Record<string, unknown>
): Promise<WriteConflict> {
  const db = getWriteQueueDB()
  const operation = await db.operations.get(id)

  if (!operation) {
    throw new Error(`Operation ${id} not found`)
  }

  // Update operation status
  await updateOperation(id, {
    status: 'conflict'
  })

  // Record the conflict
  const conflict: WriteConflict = {
    operation,
    serverVersion,
    localVersion: operation.baseVersion || 0,
    serverData,
    detectedAt: Date.now()
  }

  await db.conflicts.add(conflict)
  return conflict
}

/**
 * Delete completed operations (cleanup)
 */
export async function cleanupCompleted(): Promise<number> {
  const db = getWriteQueueDB()

  // Delete operations that have been completed
  const completed = await db.operations
    .where('status')
    .equals('completed')
    .toArray()

  if (completed.length > 0) {
    await db.operations.bulkDelete(completed.map(op => op.id!))
  }

  return completed.length
}

/**
 * Delete an operation by ID
 */
export async function deleteOperation(id: number): Promise<void> {
  const db = getWriteQueueDB()
  await db.operations.delete(id)
}

/**
 * Delete operations for a specific entity
 *
 * Used when an entity is deleted locally - no need to sync old updates.
 */
export async function deleteOperationsForEntity(
  entityType: SyncEntityType,
  entityId: string
): Promise<number> {
  const db = getWriteQueueDB()

  const operations = await getOperationsForEntity(entityType, entityId)
  if (operations.length > 0) {
    await db.operations.bulkDelete(operations.map(op => op.id!))
  }

  return operations.length
}

/**
 * Get count of pending operations
 */
export async function getPendingCount(): Promise<number> {
  const db = getWriteQueueDB()
  return db.operations
    .where('status')
    .anyOf(['pending', 'failed', 'syncing'])
    .count()
}

/**
 * Get count of failed operations (require manual retry)
 */
export async function getFailedCount(): Promise<number> {
  const db = getWriteQueueDB()

  // Failed operations that have exceeded max retries are considered "failed"
  // We'll check this in the calling code with the retry config
  return db.operations
    .where('status')
    .equals('failed')
    .count()
}

/**
 * Get all failed operations for display in UI
 */
export async function getFailedOperations(): Promise<WriteOperation[]> {
  const db = getWriteQueueDB()

  return db.operations
    .where('status')
    .equals('failed')
    .toArray()
}

/**
 * Clear all failed operations (for corrupted entries that can't be fixed)
 * Also clears conflict and permanently stuck operations
 */
export async function clearFailedOperations(): Promise<number> {
  const db = getWriteQueueDB()

  // Get ALL non-completed operations to see what's in the queue
  const allOps = await db.operations.toArray()
  console.log('[SYNC-CLEAR] All operations in queue:', allOps.map(op => ({
    id: op.id,
    status: op.status,
    entityType: op.entityType,
    retryCount: op.retryCount
  })))

  // Clear failed, conflict, AND any stuck operations with high retry counts
  const toDelete = allOps.filter(op =>
    op.status === 'failed' ||
    op.status === 'conflict' ||
    op.retryCount >= 10 // Also clear anything stuck after 10+ retries
  )

  console.log('[SYNC-CLEAR] Operations to delete:', toDelete.length)

  if (toDelete.length > 0) {
    const ids = toDelete.map(op => op.id!).filter(id => id !== undefined)
    console.log('[SYNC-CLEAR] Deleting IDs:', ids)
    await db.operations.bulkDelete(ids)
    console.log('[SYNC-CLEAR] Deleted successfully')
  }

  // BUG-1179: Also clear the conflicts table to reset error state
  const conflictCount = await db.conflicts.count()
  if (conflictCount > 0) {
    console.log('[SYNC-CLEAR] Clearing', conflictCount, 'conflicts')
    await db.conflicts.clear()
  }

  return toDelete.length + conflictCount
}

/**
 * Get all conflicts for resolution
 */
export async function getConflicts(): Promise<WriteConflict[]> {
  const db = getWriteQueueDB()
  return db.conflicts.toArray()
}

/**
 * Resolve a conflict by accepting server version
 */
export async function resolveConflictAcceptServer(conflictId: number): Promise<void> {
  const db = getWriteQueueDB()
  const conflict = await db.conflicts.get(conflictId)

  if (conflict && conflict.operation.id) {
    // Delete the conflicting operation
    await deleteOperation(conflict.operation.id)
    // Delete the conflict record
    await db.conflicts.delete(conflictId)
  }
}

/**
 * Resolve a conflict by retrying with updated version
 */
export async function resolveConflictRetry(
  conflictId: number,
  newBaseVersion: number
): Promise<void> {
  const db = getWriteQueueDB()
  const conflict = await db.conflicts.get(conflictId)

  if (conflict && conflict.operation.id) {
    // Update the operation with new version and reset for retry
    await updateOperation(conflict.operation.id, {
      status: 'pending',
      baseVersion: newBaseVersion,
      retryCount: 0,
      nextRetryAt: undefined
    })
    // Delete the conflict record
    await db.conflicts.delete(conflictId)
  }
}

/**
 * Get metadata value
 */
export async function getMetadata<T>(key: string): Promise<T | undefined> {
  const db = getWriteQueueDB()
  const record = await db.metadata.get(key)
  return record?.value as T | undefined
}

/**
 * Set metadata value
 */
export async function setMetadata(key: string, value: unknown): Promise<void> {
  const db = getWriteQueueDB()
  await db.metadata.put({ key, value })
}

/**
 * Clear all data (for testing or full reset)
 */
export async function clearAll(): Promise<void> {
  const db = getWriteQueueDB()
  await Promise.all([
    db.operations.clear(),
    db.conflicts.clear(),
    db.metadata.clear()
  ])
}

/**
 * Get database statistics for debugging
 */
export async function getStats(): Promise<{
  totalOperations: number
  pendingCount: number
  syncingCount: number
  failedCount: number
  completedCount: number
  conflictCount: number
}> {
  const db = getWriteQueueDB()

  const [pending, syncing, failed, completed, conflicts, total] = await Promise.all([
    db.operations.where('status').equals('pending').count(),
    db.operations.where('status').equals('syncing').count(),
    db.operations.where('status').equals('failed').count(),
    db.operations.where('status').equals('completed').count(),
    db.conflicts.count(),
    db.operations.count()
  ])

  return {
    totalOperations: total,
    pendingCount: pending,
    syncingCount: syncing,
    failedCount: failed,
    completedCount: completed,
    conflictCount: conflicts
  }
}
