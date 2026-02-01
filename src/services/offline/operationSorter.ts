/**
 * Operation Sorter
 *
 * Sorts sync operations into the correct execution order:
 * 1. CREATE - Must exist before updates/deletes
 * 2. UPDATE - Modifies existing entities
 * 3. DELETE - Removes entities (last to avoid FK issues)
 *
 * Also handles entity dependencies (e.g., task must exist before instances).
 */

import type { WriteOperation, SyncEntityType, SyncOperationType } from '@/types/sync'

/**
 * Priority order for operation types
 * Lower number = higher priority (runs first)
 */
const OPERATION_PRIORITY: Record<SyncOperationType, number> = {
  create: 1,
  update: 2,
  delete: 3
}

/**
 * Priority order for entity types
 * Lower number = higher priority (runs first)
 *
 * Order matters for foreign key constraints:
 * - Projects must exist before tasks
 * - Tasks must exist before timer_sessions
 * - Groups must exist before nested tasks
 */
const ENTITY_PRIORITY: Record<SyncEntityType, number> = {
  project: 1,
  group: 2,
  task: 3,
  timer_session: 4
}

/**
 * Compare function for sorting operations
 */
function compareOperations(a: WriteOperation, b: WriteOperation): number {
  // First, sort by operation type (create → update → delete)
  const opDiff = OPERATION_PRIORITY[a.operation] - OPERATION_PRIORITY[b.operation]
  if (opDiff !== 0) return opDiff

  // Within same operation type, sort by entity type (project → group → task → timer)
  const entityDiff = ENTITY_PRIORITY[a.entityType] - ENTITY_PRIORITY[b.entityType]
  if (entityDiff !== 0) return entityDiff

  // Finally, sort by creation time (FIFO)
  return a.createdAt - b.createdAt
}

/**
 * Sort operations for sync execution
 *
 * @param operations List of operations to sort
 * @returns Sorted operations ready for execution
 */
export function sortOperations(operations: WriteOperation[]): WriteOperation[] {
  return [...operations].sort(compareOperations)
}

/**
 * Sort delete operations in reverse dependency order
 *
 * For deletes, we need to reverse the entity priority:
 * - Delete timer_sessions first (depends on tasks)
 * - Delete tasks next (depends on groups/projects)
 * - Delete groups next (may contain tasks)
 * - Delete projects last (may contain tasks)
 *
 * @param operations Delete operations only
 * @returns Sorted delete operations
 */
export function sortDeleteOperations(operations: WriteOperation[]): WriteOperation[] {
  const deleteOps = operations.filter(op => op.operation === 'delete')

  return [...deleteOps].sort((a, b) => {
    // Reverse entity priority for deletes
    const entityDiff = ENTITY_PRIORITY[b.entityType] - ENTITY_PRIORITY[a.entityType]
    if (entityDiff !== 0) return entityDiff

    // FIFO for same entity type
    return a.createdAt - b.createdAt
  })
}

/**
 * Group operations into batches that can be executed in parallel
 *
 * Operations in the same batch have no dependencies on each other.
 * Different batches must be executed sequentially.
 *
 * @param operations Sorted operations
 * @returns Array of batches, each batch is an array of operations
 */
export function groupIntoBatches(operations: WriteOperation[]): WriteOperation[][] {
  if (operations.length === 0) return []

  // Sort first
  const sorted = sortOperations(operations)

  // Group by operation type (each operation type is a separate batch)
  const batches: WriteOperation[][] = []
  let currentBatch: WriteOperation[] = []
  let currentOpType: SyncOperationType | null = null

  for (const op of sorted) {
    if (currentOpType !== op.operation) {
      if (currentBatch.length > 0) {
        batches.push(currentBatch)
      }
      currentBatch = [op]
      currentOpType = op.operation
    } else {
      currentBatch.push(op)
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

/**
 * Split operations by entity type for parallel processing
 *
 * Within each operation type batch, we can sometimes parallelize
 * across different entity types (if no FK dependencies).
 *
 * @param batch Single batch of operations (same operation type)
 * @returns Map of entityType → operations
 */
export function splitByEntityType(
  batch: WriteOperation[]
): Map<SyncEntityType, WriteOperation[]> {
  const result = new Map<SyncEntityType, WriteOperation[]>()

  for (const op of batch) {
    const existing = result.get(op.entityType) || []
    existing.push(op)
    result.set(op.entityType, existing)
  }

  return result
}

/**
 * Check if an operation depends on another operation
 *
 * Used for fine-grained dependency analysis.
 *
 * @param op The operation to check
 * @param other The potential dependency
 * @returns True if op depends on other
 */
export function operationDependsOn(
  op: WriteOperation,
  other: WriteOperation
): boolean {
  // Delete never depends on create/update of same entity
  if (op.operation === 'delete' && op.entityId === other.entityId) {
    return false
  }

  // Update depends on create of same entity
  if (op.operation === 'update' && other.operation === 'create' && op.entityId === other.entityId) {
    return true
  }

  // Task create/update depends on parent group create
  if (
    op.entityType === 'task' &&
    other.entityType === 'group' &&
    other.operation === 'create'
  ) {
    // Check if task references this group as parent
    const parentId = op.payload?.parentId as string | undefined
    if (parentId === other.entityId) {
      return true
    }
  }

  // Task create/update depends on project create
  if (
    op.entityType === 'task' &&
    other.entityType === 'project' &&
    other.operation === 'create'
  ) {
    const projectId = op.payload?.projectId as string | undefined
    if (projectId === other.entityId) {
      return true
    }
  }

  // Timer session depends on task create
  if (
    op.entityType === 'timer_session' &&
    other.entityType === 'task' &&
    other.operation === 'create'
  ) {
    const taskId = op.payload?.taskId as string | undefined
    if (taskId === other.entityId) {
      return true
    }
  }

  return false
}

/**
 * Build a dependency graph for topological sorting
 *
 * More sophisticated than simple priority-based sorting,
 * this handles actual data dependencies between operations.
 *
 * @param operations List of operations
 * @returns Map of operation ID → dependent operation IDs
 */
export function buildDependencyGraph(
  operations: WriteOperation[]
): Map<number, Set<number>> {
  const graph = new Map<number, Set<number>>()

  // Initialize graph
  for (const op of operations) {
    if (op.id !== undefined) {
      graph.set(op.id, new Set())
    }
  }

  // Build edges
  for (const op of operations) {
    if (op.id === undefined) continue

    for (const other of operations) {
      if (other.id === undefined || op.id === other.id) continue

      if (operationDependsOn(op, other)) {
        // op depends on other, so other must run first
        graph.get(op.id)!.add(other.id)
      }
    }
  }

  return graph
}
