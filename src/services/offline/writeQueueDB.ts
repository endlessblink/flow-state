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
import { toRaw } from 'vue'
import type { CanonicalTaskPatchReceipt, WriteOperation, WriteConflict, SyncEntityType } from '@/types/sync'

type StoredCanonicalTaskPatchReceipt = CanonicalTaskPatchReceipt & { scopeKey: string }

export interface CanonicalRevisionCheckpoint {
  scopeKey: string
  entityId: string
  canonicalRevision: number
  operationId: string
}

const canonicalScopeKey = (userId: string, workspaceId: string | null | undefined) =>
  `${userId}:${workspaceId ?? 'personal'}`

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
  /** Legacy v3/v4 ledger retained so existing proof can be migrated safely. */
  canonicalReceipts!: Table<StoredCanonicalTaskPatchReceipt, string>
  /** User/workspace-scoped canonical proof ledger. */
  canonicalReceiptsV2!: Table<StoredCanonicalTaskPatchReceipt, [string, string]>
  /** Latest durable server revision observed for one scoped task. */
  canonicalCheckpoints!: Table<CanonicalRevisionCheckpoint, [string, string]>

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

    // Version 2: Add workspace support
    this.version(2).stores({
      operations: '++id, status, [entityType+entityId], createdAt, nextRetryAt, userId, workspaceId',
      conflicts: '++id, [operation.entityType+operation.entityId], detectedAt',
      metadata: 'key'
    })

    this.version(3).stores({
      operations: '++id, status, [entityType+entityId], createdAt, nextRetryAt, userId, workspaceId',
      conflicts: '++id, [operation.entityType+operation.entityId], detectedAt',
      metadata: 'key',
      canonicalReceipts: 'operationId, entityId, committedAt'
    })

    this.version(4).stores({
      operations: '++id, status, [entityType+entityId], createdAt, nextRetryAt, userId, workspaceId',
      conflicts: '++id, [operation.entityType+operation.entityId], detectedAt',
      metadata: 'key',
      canonicalReceipts: 'operationId, [scopeKey+entityId], scopeKey, entityId, changeSequence'
    })

    this.version(5).stores({
      operations: '++id, status, [entityType+entityId], createdAt, nextRetryAt, userId, workspaceId',
      conflicts: '++id, [operation.entityType+operation.entityId], detectedAt',
      metadata: 'key',
      canonicalReceipts: 'operationId, [scopeKey+entityId], scopeKey, entityId, changeSequence',
      canonicalReceiptsV2: '[scopeKey+operationId], operationId, [scopeKey+entityId], scopeKey, entityId, changeSequence',
      canonicalCheckpoints: '[scopeKey+entityId], scopeKey, entityId, canonicalRevision'
    }).upgrade(async transaction => {
      const legacy = await transaction.table<StoredCanonicalTaskPatchReceipt>('canonicalReceipts').toArray()
      if (legacy.length > 0) {
        await transaction.table<StoredCanonicalTaskPatchReceipt>('canonicalReceiptsV2').bulkPut(legacy)
        const latestByEntity = new Map<string, CanonicalRevisionCheckpoint>()
        for (const receipt of legacy) {
          const key = `${receipt.scopeKey}:${receipt.entityId}`
          const current = latestByEntity.get(key)
          if (!current || receipt.canonicalRevision > current.canonicalRevision) {
            latestByEntity.set(key, {
              scopeKey: receipt.scopeKey,
              entityId: receipt.entityId,
              canonicalRevision: receipt.canonicalRevision,
              operationId: receipt.operationId,
            })
          }
        }
        await transaction.table<CanonicalRevisionCheckpoint>('canonicalCheckpoints')
          .bulkPut([...latestByEntity.values()])
      }
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

  // WebKitGTK (Tauri) cannot structured-clone Vue reactive proxies.
  // Deep-clone via toRaw + JSON round-trip before writing to IndexedDB.
  const cloned = JSON.parse(JSON.stringify(toRaw(fullOperation))) as WriteOperation
  const id = await db.operations.add(cloned)
  return { ...cloned, id }
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
    lastAttemptAt: Date.now(),
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

async function putLatestCanonicalCheckpoint(
  table: Table<CanonicalRevisionCheckpoint, [string, string]>,
  checkpoint: CanonicalRevisionCheckpoint,
): Promise<void> {
  const existing = await table.get([checkpoint.scopeKey, checkpoint.entityId])
  if (!existing || checkpoint.canonicalRevision >= existing.canonicalRevision) {
    await table.put(checkpoint)
  }
}

/** Persist canonical proof and complete its queue row in one IndexedDB transaction. */
export async function completeCanonicalOperation(
  id: number,
  receipt: CanonicalTaskPatchReceipt,
): Promise<void> {
  const db = getWriteQueueDB()
  await db.transaction('rw', db.operations, db.canonicalReceiptsV2, db.canonicalCheckpoints, async () => {
    const operation = await db.operations.get(id)
    if (!operation?.canonicalTaskPatch || operation.canonicalTaskPatch.operationId !== receipt.operationId) {
      throw new Error('Canonical receipt does not match the queued operation')
    }
    if (!operation.userId) throw new Error('Canonical receipt requires a signed-user scope')
    await db.canonicalReceiptsV2.put({
      ...receipt,
      scopeKey: canonicalScopeKey(operation.userId, operation.workspaceId),
    })
    await putLatestCanonicalCheckpoint(db.canonicalCheckpoints, {
      scopeKey: canonicalScopeKey(operation.userId, operation.workspaceId),
      entityId: operation.entityId,
      canonicalRevision: receipt.canonicalRevision,
      operationId: receipt.operationId,
    })
    await db.operations.update(id, {
      status: 'completed',
      canonicalTaskPatch: {
        ...operation.canonicalTaskPatch,
        phase: 'committed',
        receipt,
      },
    })
  })
}

/** Complete a compatibility task update and retain the server revision atomically. */
export async function completeLegacyTaskOperation(id: number, canonicalRevision: number): Promise<void> {
  if (!Number.isSafeInteger(canonicalRevision) || canonicalRevision < 1) {
    throw new Error('Canonical revision must be a positive integer')
  }
  const db = getWriteQueueDB()
  await db.transaction('rw', db.operations, db.canonicalCheckpoints, async () => {
    const operation = await db.operations.get(id)
    if (!operation || operation.entityType !== 'task' || operation.operation !== 'update' || operation.canonicalTaskPatch) {
      throw new Error('Legacy task completion requires a queued compatibility update')
    }
    if (!operation.userId) throw new Error('Legacy task completion requires a signed-user scope')
    await putLatestCanonicalCheckpoint(db.canonicalCheckpoints, {
      scopeKey: canonicalScopeKey(operation.userId, operation.workspaceId),
      entityId: operation.entityId,
      canonicalRevision,
      operationId: `legacy:${id}`,
    })
    await db.operations.update(id, { status: 'completed' })
  })
}

export async function getLatestCanonicalCheckpointForEntity(
  entityId: string,
  userId: string,
  workspaceId: string | null,
): Promise<CanonicalRevisionCheckpoint | undefined> {
  return getWriteQueueDB().canonicalCheckpoints.get([
    canonicalScopeKey(userId, workspaceId),
    entityId,
  ])
}

export async function getCanonicalReceipt(
  operationId: string,
  userId: string,
  workspaceId: string | null,
): Promise<CanonicalTaskPatchReceipt | undefined> {
  const stored = await getWriteQueueDB().canonicalReceiptsV2.get([canonicalScopeKey(userId, workspaceId), operationId])
  if (!stored) return undefined
  const { scopeKey: _scopeKey, ...receipt } = stored
  return receipt
}

export async function getLatestCanonicalReceiptForEntity(
  entityId: string,
  userId: string,
  workspaceId: string | null,
): Promise<CanonicalTaskPatchReceipt | undefined> {
  const receipts = await getWriteQueueDB().canonicalReceiptsV2
    .where('[scopeKey+entityId]')
    .equals([canonicalScopeKey(userId, workspaceId), entityId])
    .toArray()
  const stored = receipts.sort((left, right) =>
    right.changeSequence - left.changeSequence
    || right.canonicalRevision - left.canonicalRevision
    || Date.parse(right.committedAt) - Date.parse(left.committedAt)
  )[0]
  if (!stored) return undefined
  const { scopeKey: _scopeKey, ...receipt } = stored
  return receipt
}

/** Preserve entity ordering even when an earlier retry is not yet eligible for this pass. */
export async function hasEarlierUnresolvedOperation(operation: WriteOperation): Promise<boolean> {
  const operationId = operation.id
  if (!operationId) return false
  const operations = await getOperationsForEntity(operation.entityType, operation.entityId)
  return operations.some(candidate =>
    candidate.id !== operation.id
    && candidate.status !== 'completed'
    && candidate.userId === operation.userId
    && (candidate.workspaceId ?? null) === (operation.workspaceId ?? null)
    && (candidate.createdAt < operation.createdAt
      || (candidate.createdAt === operation.createdAt && Number(candidate.id) < operationId))
  )
}

/** Protect optimistic state while a later same-scope operation is still durable. */
export async function hasLaterUnresolvedOperation(operation: WriteOperation): Promise<boolean> {
  const operationId = operation.id
  if (!operationId) return false
  const operations = await getOperationsForEntity(operation.entityType, operation.entityId)
  return operations.some(candidate =>
    candidate.id !== operation.id
    && candidate.status !== 'completed'
    && candidate.userId === operation.userId
    && (candidate.workspaceId ?? null) === (operation.workspaceId ?? null)
    && (candidate.createdAt > operation.createdAt
      || (candidate.createdAt === operation.createdAt && Number(candidate.id) > operationId))
  )
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
 * Delete operations for a specific entity filtered by operation type.
 *
 * Used by undo to cancel only the conflicting operation (e.g., cancel pending
 * DELETEs when restoring a task, without cancelling the CREATE just enqueued).
 */
export async function deleteOperationsByType(
  entityType: SyncEntityType,
  entityId: string,
  operationType: 'create' | 'update' | 'delete'
): Promise<number> {
  const operations = await getOperationsForEntity(entityType, entityId)
  const matching = operations.filter(op => op.operation === operationType)
  // BUG-1737: Skip in-flight operations — removing from IndexedDB doesn't abort the HTTP request.
  // Orphaned 'syncing' ops are recovered by recoverStaleSyncing() on next app load.
  const deletable = matching.filter(op => op.status !== 'syncing')
  const skipped = matching.length - deletable.length
  if (skipped > 0) {
    console.warn(`⚠️ [SYNC] deleteOperationsByType: skipped ${skipped} in-flight '${operationType}' op(s) for ${entityId.slice(0, 8)}`)
  }
  if (deletable.length > 0) {
    const db = getWriteQueueDB()
    await db.operations.bulkDelete(deletable.map(op => op.id!))
  }
  return deletable.length
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
 * BUG-1301: Recover operations stuck in 'syncing' status.
 *
 * If the app crashes or reloads while an operation is being synced,
 * it gets stuck as 'syncing' forever because getPendingOperations()
 * only returns 'pending' and 'failed' — never 'syncing'.
 * This resets stale syncing operations back to 'pending' so they can retry.
 *
 * @param maxAgeMs Maximum age in ms before a syncing operation is considered stale (default: 60s)
 * @returns Number of operations recovered
 */
export async function recoverStaleSyncing(maxAgeMs = 60_000): Promise<number> {
  const db = getWriteQueueDB()
  const cutoff = Date.now() - Math.max(maxAgeMs, 60_000)

  const staleOps = await db.operations
    .where('status')
    .equals('syncing')
    .filter(op => !op.lastAttemptAt || op.lastAttemptAt < cutoff)
    .toArray()

  if (staleOps.length > 0) {
    for (const op of staleOps) {
      if (op.id) {
        await updateOperation(op.id, {
          status: 'pending',
          retryCount: op.retryCount + 1
        })
      }
    }
    console.warn(`⚠️ [SYNC] BUG-1301: Recovered ${staleOps.length} stale syncing operation(s) back to pending`)
  }

  return staleOps.length
}

/**
 * Historical compatibility hook retained for callers.
 *
 * Age is never proof that a pending write is disposable. A device may remain
 * offline or signed out for days; deleting its queue entry would silently lose
 * the user's only durable task intent. Resurrection prevention belongs to
 * ordered DELETE replacement and server tombstones, not time-based data loss.
 */
export async function purgeStaleOperations(_maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
  return 0
}

/**
 * Clear all failed operations (for corrupted entries that can't be fixed)
 * Also clears conflict and permanently stuck operations
 */
export async function clearFailedOperations(): Promise<number> {
  const db = getWriteQueueDB()

  // Get ALL non-completed operations to see what's in the queue
  const allOps = await db.operations.toArray()

  // BUG-1301: Also clear 'syncing' operations — these are stuck from a previous
  // session crash and will never complete. Previously only cleared 'failed' and
  // 'conflict', leaving orphaned 'syncing' ops stuck forever.
  const toDelete = allOps.filter(op => !op.canonicalTaskPatch && (
    op.status === 'failed' ||
    op.status === 'conflict' ||
    op.status === 'syncing' ||
    op.retryCount >= 10 // Also clear anything stuck after 10+ retries
  ))

  if (toDelete.length > 0) {
    const ids = toDelete.map(op => op.id!).filter(id => id !== undefined)
    await db.operations.bulkDelete(ids)
  }

  // BUG-1179: Also clear the conflicts table to reset error state
  const disposableConflicts = (await db.conflicts.toArray())
    .filter(conflict => !conflict.operation.canonicalTaskPatch)
  if (disposableConflicts.length > 0) {
    await db.conflicts.bulkDelete(disposableConflicts.map(conflict => conflict.id!))
  }

  return toDelete.length + disposableConflicts.length
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
    await db.transaction('rw', db.operations, db.conflicts, async () => {
      const operation = await db.operations.get(conflict.operation.id!)
      if (!operation) return
      if (operation.canonicalTaskPatch?.phase === 'previewed' || operation.canonicalTaskPatch?.phase === 'committed') {
        throw new Error('Cannot rebase a canonical operation after its preview binding was issued')
      }
      await db.operations.update(operation.id!, {
        status: 'pending',
        baseVersion: newBaseVersion,
        retryCount: 0,
        nextRetryAt: undefined,
        canonicalTaskPatch: operation.canonicalTaskPatch
          ? { ...operation.canonicalTaskPatch, baseRevision: newBaseVersion }
          : undefined,
      })
      await db.conflicts.delete(conflictId)
    })
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
    db.metadata.clear(),
    db.canonicalReceipts.clear(),
    db.canonicalReceiptsV2.clear(),
    db.canonicalCheckpoints.clear()
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
