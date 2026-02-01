/**
 * Operation Coalescer
 *
 * Merges multiple pending operations for the same entity to reduce sync overhead.
 *
 * Examples:
 * - Multiple updates to same task → merge payloads into single update
 * - Create + Update → merge into single create with combined payload
 * - Create + Delete → cancel both (net effect is nothing)
 * - Update + Delete → just delete (update is irrelevant)
 */

import type { WriteOperation, SyncEntityType } from '@/types/sync'
import {
  getOperationsForEntity,
  deleteOperation,
  updateOperation
} from './writeQueueDB'

/**
 * Result of coalescing operations
 */
export interface CoalesceResult {
  /** The final coalesced operation (or null if cancelled out) */
  operation: WriteOperation | null

  /** IDs of operations that were merged/deleted */
  mergedOperationIds: number[]

  /** Description of what was coalesced */
  description: string
}

/**
 * Coalesce all pending operations for an entity
 *
 * This should be called before syncing to minimize network requests.
 *
 * @param entityType Type of entity
 * @param entityId Entity ID
 * @returns Result of coalescing
 */
export async function coalesceOperationsForEntity(
  entityType: SyncEntityType,
  entityId: string
): Promise<CoalesceResult> {
  const operations = await getOperationsForEntity(entityType, entityId)

  // Filter to only pending/failed operations (not syncing or completed)
  const pendingOps = operations.filter(
    op => op.status === 'pending' || op.status === 'failed'
  )

  if (pendingOps.length <= 1) {
    return {
      operation: pendingOps[0] || null,
      mergedOperationIds: [],
      description: 'No coalescing needed'
    }
  }

  // Sort by creation time
  pendingOps.sort((a, b) => a.createdAt - b.createdAt)

  // Determine the final operation type and payload
  let finalOp: WriteOperation | null = null
  const mergedIds: number[] = []
  let description = ''

  // Check for create → delete cancellation
  const hasCreate = pendingOps.some(op => op.operation === 'create')
  const hasDelete = pendingOps.some(op => op.operation === 'delete')

  if (hasCreate && hasDelete) {
    // Create followed by delete = net nothing
    // Delete all operations
    for (const op of pendingOps) {
      if (op.id) {
        mergedIds.push(op.id)
        await deleteOperation(op.id)
      }
    }
    return {
      operation: null,
      mergedOperationIds: mergedIds,
      description: 'Create + Delete cancelled out'
    }
  }

  if (hasDelete) {
    // If there's a delete, that's the final operation
    // Delete any preceding updates (they're irrelevant)
    const deleteOp = pendingOps.find(op => op.operation === 'delete')!

    for (const op of pendingOps) {
      if (op.id && op.id !== deleteOp.id) {
        mergedIds.push(op.id)
        await deleteOperation(op.id)
      }
    }

    return {
      operation: deleteOp,
      mergedOperationIds: mergedIds,
      description: `Merged ${mergedIds.length} operations into delete`
    }
  }

  if (hasCreate) {
    // Merge all updates into the create
    const createOp = pendingOps.find(op => op.operation === 'create')!
    let mergedPayload = { ...createOp.payload }

    for (const op of pendingOps) {
      if (op.operation === 'update' && op.id) {
        mergedPayload = mergePayloads(mergedPayload, op.payload)
        mergedIds.push(op.id)
        await deleteOperation(op.id)
      }
    }

    // Update the create operation with merged payload
    if (createOp.id) {
      await updateOperation(createOp.id, { payload: mergedPayload })
    }

    finalOp = { ...createOp, payload: mergedPayload }
    description = `Merged ${mergedIds.length} updates into create`
  } else {
    // All updates - merge them
    const firstOp = pendingOps[0]
    let mergedPayload = { ...firstOp.payload }
    let latestVersion = firstOp.baseVersion || 0

    for (let i = 1; i < pendingOps.length; i++) {
      const op = pendingOps[i]
      mergedPayload = mergePayloads(mergedPayload, op.payload)

      // Keep the highest version
      if (op.baseVersion && op.baseVersion > latestVersion) {
        latestVersion = op.baseVersion
      }

      if (op.id) {
        mergedIds.push(op.id)
        await deleteOperation(op.id)
      }
    }

    // Update the first operation with merged payload
    if (firstOp.id) {
      await updateOperation(firstOp.id, {
        payload: mergedPayload,
        baseVersion: latestVersion
      })
    }

    finalOp = { ...firstOp, payload: mergedPayload, baseVersion: latestVersion }
    description = `Merged ${pendingOps.length} updates into 1`
  }

  return {
    operation: finalOp,
    mergedOperationIds: mergedIds,
    description
  }
}

/**
 * Merge two payloads with later values taking precedence
 *
 * Handles nested objects by shallow merging one level deep.
 */
export function mergePayloads(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base }

  for (const [key, value] of Object.entries(override)) {
    // Skip undefined values (don't overwrite with undefined)
    if (value === undefined) {
      continue
    }

    // For objects (but not arrays or null), do shallow merge
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof base[key] === 'object' &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = {
        ...(base[key] as Record<string, unknown>),
        ...(value as Record<string, unknown>)
      }
    } else {
      // For primitives, arrays, null - just replace
      result[key] = value
    }
  }

  return result
}

/**
 * Coalesce all pending operations in the queue
 *
 * Groups operations by entity and coalesces each group.
 * Call this before processing the sync queue.
 *
 * @param operations List of pending operations
 * @returns Map of entityKey → coalesced operation
 */
export async function coalesceAllOperations(
  operations: WriteOperation[]
): Promise<Map<string, WriteOperation>> {
  // Group by entity
  const groups = new Map<string, WriteOperation[]>()

  for (const op of operations) {
    const key = `${op.entityType}:${op.entityId}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(op)
  }

  // Coalesce each group
  const result = new Map<string, WriteOperation>()

  for (const [key, ops] of groups) {
    if (ops.length === 1) {
      result.set(key, ops[0])
    } else {
      // Use the first operation's entity info for coalescing
      const [entityType, entityId] = key.split(':') as [SyncEntityType, string]
      const coalesced = await coalesceOperationsForEntity(entityType, entityId)

      if (coalesced.operation) {
        result.set(key, coalesced.operation)
      }
    }
  }

  return result
}
