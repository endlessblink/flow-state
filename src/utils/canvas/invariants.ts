/**
 * Canvas Hierarchy Invariant Validation
 *
 * This module defines and validates the three core invariants that must hold
 * for the nested group system to work correctly.
 *
 * ============================================================================
 * INVARIANT A: HIERARCHY CONSISTENCY
 * ============================================================================
 * - If group.parentGroupId === null → Vue Flow node has parentNode: undefined, extent: undefined
 * - If group.parentGroupId !== null → Vue Flow node has parentNode = CanvasIds.groupNodeId(parentGroupId)
 *   (NOTE: Groups do NOT have extent: 'parent' set - this allows child→root drag transitions)
 * - The parent group MUST exist in the store
 *
 * ============================================================================
 * INVARIANT B: POSITION ARCHITECTURE
 * ============================================================================
 * - Store/DB always holds ABSOLUTE world coordinates for ALL nodes
 * - Vue Flow uses:
 *   - Root nodes: position = absolute (no conversion)
 *   - Nested nodes: position = absolute - parentAbsolute (relative to parent)
 *
 * ============================================================================
 * INVARIANT C: RECURSION SAFETY
 * ============================================================================
 * - All recursive functions MUST use a visited set to prevent infinite loops
 * - collectDescendantGroups, getTaskCountInGroupRecursive, getAllDescendantGroupIds
 *   must all accept and use a visited set parameter
 */

import type { Node } from '@vue-flow/core'
import type { CanvasGroup } from '@/stores/canvas/types'
import type { Task } from '@/types/tasks'
import { CanvasIds } from './canvasIds'
import {
    getGroupAbsolutePosition,
    toRelativePosition,
    sanitizePosition
} from './coordinates'

// Epsilon for position comparison - must match tolerance used in sync code
const POSITION_EPSILON = 0.5

// Only log in development mode
const isDev = import.meta.env.DEV

/**
 * Invariant violation severity levels
 */
export enum InvariantSeverity {
    ERROR = 'ERROR',     // Must fix immediately - will cause bugs
    WARNING = 'WARNING', // Should fix - may cause subtle issues
    INFO = 'INFO'        // Informational - potential optimization
}

/**
 * Invariant violation report
 */
export interface InvariantViolation {
    invariant: 'A' | 'B' | 'C'
    severity: InvariantSeverity
    nodeId: string
    nodeType: 'group' | 'task'
    message: string
    details: Record<string, any>
}

/**
 * Validate Invariant A: Hierarchy Consistency
 *
 * Checks that Vue Flow node's parentNode and extent match the store's parentGroupId
 */
export function validateInvariantA(
    vueFlowNodes: Node[],
    storeGroups: CanvasGroup[]
): InvariantViolation[] {
    const violations: InvariantViolation[] = []
    const groupById = new Map(storeGroups.map(g => [g.id, g]))

    for (const node of vueFlowNodes) {
        if (!CanvasIds.isGroupNode(node.id)) continue

        const { id: groupId } = CanvasIds.parseNodeId(node.id)
        const storeGroup = groupById.get(groupId)

        if (!storeGroup) {
            violations.push({
                invariant: 'A',
                severity: InvariantSeverity.ERROR,
                nodeId: groupId,
                nodeType: 'group',
                message: `Vue Flow node exists but group not found in store`,
                details: { nodeId: node.id }
            })
            continue
        }

        const hasStoreParent = storeGroup.parentGroupId && storeGroup.parentGroupId !== 'NONE'
        const hasVueFlowParent = !!node.parentNode
        const hasExtent = node.extent === 'parent'

        // Case 1: Store says no parent
        if (!hasStoreParent) {
            if (hasVueFlowParent) {
                violations.push({
                    invariant: 'A',
                    severity: InvariantSeverity.ERROR,
                    nodeId: groupId,
                    nodeType: 'group',
                    message: `Store has no parentGroupId but Vue Flow node has parentNode set`,
                    details: {
                        storeParentGroupId: storeGroup.parentGroupId,
                        vueFlowParentNode: node.parentNode
                    }
                })
            }
            if (hasExtent) {
                violations.push({
                    invariant: 'A',
                    severity: InvariantSeverity.WARNING,
                    nodeId: groupId,
                    nodeType: 'group',
                    message: `Store has no parentGroupId but Vue Flow node has extent: 'parent'`,
                    details: { extent: node.extent }
                })
            }
        }

        // Case 2: Store says has parent
        if (hasStoreParent) {
            const expectedVueFlowParent = CanvasIds.groupNodeId(storeGroup.parentGroupId!)

            if (!hasVueFlowParent) {
                violations.push({
                    invariant: 'A',
                    severity: InvariantSeverity.ERROR,
                    nodeId: groupId,
                    nodeType: 'group',
                    message: `Store has parentGroupId but Vue Flow node has no parentNode`,
                    details: {
                        storeParentGroupId: storeGroup.parentGroupId,
                        expected: expectedVueFlowParent
                    }
                })
            } else if (node.parentNode !== expectedVueFlowParent) {
                violations.push({
                    invariant: 'A',
                    severity: InvariantSeverity.ERROR,
                    nodeId: groupId,
                    nodeType: 'group',
                    message: `Vue Flow parentNode doesn't match store parentGroupId`,
                    details: {
                        storeParentGroupId: storeGroup.parentGroupId,
                        vueFlowParentNode: node.parentNode,
                        expected: expectedVueFlowParent
                    }
                })
            }

            // NOTE: We intentionally do NOT check for extent: 'parent' here.
            // Groups are allowed to NOT have extent set so they can be dragged outside
            // their parent for child→root transitions. The containment check in
            // onNodeDragStop handles re-parenting via spatial detection.

            // Check parent exists
            if (!groupById.has(storeGroup.parentGroupId!)) {
                violations.push({
                    invariant: 'A',
                    severity: InvariantSeverity.ERROR,
                    nodeId: groupId,
                    nodeType: 'group',
                    message: `Parent group doesn't exist in store`,
                    details: {
                        parentGroupId: storeGroup.parentGroupId,
                        availableGroups: Array.from(groupById.keys())
                    }
                })
            }
        }
    }

    return violations
}

/**
 * Helper: Compare positions with epsilon tolerance
 */
function positionsMatch(
    actual: { x: number; y: number },
    expected: { x: number; y: number }
): boolean {
    const dx = Math.abs(actual.x - expected.x)
    const dy = Math.abs(actual.y - expected.y)
    return dx <= POSITION_EPSILON && dy <= POSITION_EPSILON
}

/**
 * Validate Invariant B: Position Architecture
 *
 * Checks that Vue Flow positions are correctly computed from store absolute positions.
 * Uses the exact same conversion logic as useCanvasSync.ts to ensure consistency.
 */
export function validateInvariantB(
    vueFlowNodes: Node[],
    storeGroups: CanvasGroup[],
    storeTasks: Task[]
): InvariantViolation[] {
    const violations: InvariantViolation[] = []

    // Check groups
    for (const node of vueFlowNodes) {
        if (!CanvasIds.isGroupNode(node.id)) continue

        const { id: groupId } = CanvasIds.parseNodeId(node.id)
        const storeGroup = storeGroups.find(g => g.id === groupId)
        if (!storeGroup) continue

        // Use sanitizePosition to match what useCanvasSync does
        const storeAbsolute = sanitizePosition(storeGroup.position)
        const hasParent = storeGroup.parentGroupId && storeGroup.parentGroupId !== 'NONE'

        // Compute expected Vue Flow position using same logic as groupPositionToVueFlow
        let expectedVueFlowPos: { x: number; y: number }
        if (hasParent) {
            const parentAbsolute = getGroupAbsolutePosition(storeGroup.parentGroupId!, storeGroups)
            expectedVueFlowPos = toRelativePosition(storeAbsolute, parentAbsolute)
        } else {
            expectedVueFlowPos = storeAbsolute
        }

        const actualVueFlowPos = sanitizePosition(node.position)

        if (!positionsMatch(actualVueFlowPos, expectedVueFlowPos)) {
            violations.push({
                invariant: 'B',
                severity: InvariantSeverity.WARNING,
                nodeId: groupId,
                nodeType: 'group',
                message: `Vue Flow position doesn't match expected (${hasParent ? 'relative' : 'absolute'})`,
                details: {
                    storeAbsolute,
                    parentGroupId: storeGroup.parentGroupId,
                    expectedVueFlowPos,
                    actualVueFlowPos,
                    delta: {
                        x: actualVueFlowPos.x - expectedVueFlowPos.x,
                        y: actualVueFlowPos.y - expectedVueFlowPos.y
                    }
                }
            })
        }
    }

    // Check tasks
    for (const node of vueFlowNodes) {
        if (node.type !== 'taskNode') continue

        const task = storeTasks.find(t => t.id === node.id)
        if (!task || !task.canvasPosition) continue

        // Use sanitizePosition to match what useCanvasSync does
        const storeAbsolute = sanitizePosition(task.canvasPosition)
        const hasParent = task.parentId && task.parentId !== 'NONE'

        // Compute expected Vue Flow position using same logic as taskPositionToVueFlow
        let expectedVueFlowPos: { x: number; y: number }
        if (hasParent) {
            const parentAbsolute = getGroupAbsolutePosition(task.parentId!, storeGroups)
            expectedVueFlowPos = toRelativePosition(storeAbsolute, parentAbsolute)
        } else {
            expectedVueFlowPos = storeAbsolute
        }

        const actualVueFlowPos = sanitizePosition(node.position)

        if (!positionsMatch(actualVueFlowPos, expectedVueFlowPos)) {
            violations.push({
                invariant: 'B',
                severity: InvariantSeverity.WARNING,
                nodeId: task.id,
                nodeType: 'task',
                message: `Vue Flow position doesn't match expected (${hasParent ? 'relative' : 'absolute'})`,
                details: {
                    storeAbsolute,
                    parentId: task.parentId,
                    expectedVueFlowPos,
                    actualVueFlowPos: { x: node.position.x, y: node.position.y }
                }
            })
        }
    }

    return violations
}

/**
 * Validate Invariant C: No Cycles in Hierarchy
 *
 * Checks that there are no cycles in the parent-child relationships
 */
export function validateInvariantC(storeGroups: CanvasGroup[]): InvariantViolation[] {
    const violations: InvariantViolation[] = []

    for (const group of storeGroups) {
        if (!group.parentGroupId || group.parentGroupId === 'NONE') continue

        const visited = new Set<string>()
        let current: CanvasGroup | undefined = group
        let hasCycle = false

        while (current && current.parentGroupId && current.parentGroupId !== 'NONE') {
            if (visited.has(current.id)) {
                hasCycle = true
                break
            }
            visited.add(current.id)
            current = storeGroups.find(g => g.id === current!.parentGroupId)
        }

        if (hasCycle) {
            violations.push({
                invariant: 'C',
                severity: InvariantSeverity.ERROR,
                nodeId: group.id,
                nodeType: 'group',
                message: `Cycle detected in parent chain`,
                details: {
                    groupId: group.id,
                    groupName: group.name,
                    visitedChain: Array.from(visited)
                }
            })
        }
    }

    return violations
}

/**
 * Run all invariant validations and log violations
 *
 * Call this after sync operations to verify consistency
 */
export function validateAllInvariants(
    vueFlowNodes: Node[],
    storeGroups: CanvasGroup[],
    storeTasks: Task[],
    context: string = 'unknown'
): InvariantViolation[] {
    const allViolations: InvariantViolation[] = []

    // Only run in dev mode
    if (!isDev) return allViolations

    const violationsA = validateInvariantA(vueFlowNodes, storeGroups)
    const violationsB = validateInvariantB(vueFlowNodes, storeGroups, storeTasks)
    const violationsC = validateInvariantC(storeGroups)

    allViolations.push(...violationsA, ...violationsB, ...violationsC)

    if (allViolations.length > 0) {
        console.group(`[INVARIANT] ${allViolations.length} violation(s) detected in ${context}`)

        const errors = allViolations.filter(v => v.severity === InvariantSeverity.ERROR)
        const warnings = allViolations.filter(v => v.severity === InvariantSeverity.WARNING)

        if (errors.length > 0) {
            console.error(`${errors.length} ERROR(s):`)
            errors.forEach(v => {
                console.error(`  [${v.invariant}] ${v.nodeType} ${v.nodeId}: ${v.message}`, v.details)
            })
        }

        if (warnings.length > 0) {
            console.warn(`${warnings.length} WARNING(s):`)
            warnings.forEach(v => {
                console.warn(`  [${v.invariant}] ${v.nodeType} ${v.nodeId}: ${v.message}`, v.details)
            })
        }

        console.groupEnd()
    } else if (isDev) {
        // Log success only in very verbose mode
        // console.log(`[INVARIANT] All invariants passed in ${context}`)
    }

    return allViolations
}

/**
 * Log a summary of the current hierarchy state
 *
 * Call this once on load to see the hierarchy at a glance
 */
export function logHierarchySummary(storeGroups: CanvasGroup[]): void {
    if (!isDev) return

    console.group('[HIERARCHY] Group Hierarchy Summary')

    // Find root groups
    const rootGroups = storeGroups.filter(g => !g.parentGroupId || g.parentGroupId === 'NONE')
    const nestedGroups = storeGroups.filter(g => g.parentGroupId && g.parentGroupId !== 'NONE')

    console.log(`Total: ${storeGroups.length} groups (${rootGroups.length} root, ${nestedGroups.length} nested)`)

    // Build tree structure
    const printTree = (groupId: string, indent: string = '') => {
        const group = storeGroups.find(g => g.id === groupId)
        if (!group) return

        console.log(`${indent}${group.name} [${group.id.substring(0, 8)}...] @ (${group.position.x}, ${group.position.y})`)

        const children = storeGroups.filter(g => g.parentGroupId === groupId)
        children.forEach((child, i) => {
            const isLast = i === children.length - 1
            printTree(child.id, indent + (isLast ? '  ' : '  '))
        })
    }

    rootGroups.forEach(g => printTree(g.id))

    console.groupEnd()
}

// ============================================================================
// GEOMETRY CHANGE GUARD
// ============================================================================

/**
 * Assert that no geometry fields are being changed by a non-authorized source.
 *
 * Smart Groups may only update METADATA (dueDate, priority, status, tags).
 * This guard catches any accidental geometry writes before they happen.
 *
 * @param oldTask - The current task state
 * @param newUpdates - The proposed updates
 * @param context - Description of where this check is being called from
 */
export function assertNoGeometryChange(
    oldTask: { id: string; title?: string; parentId?: string | null; canvasPosition?: { x: number; y: number } | null },
    newUpdates: { parentId?: string | null; canvasPosition?: { x: number; y: number } | null },
    context: string
): void {
    if (!import.meta.env.DEV) return

    const changedFields: string[] = []

    // Check parentId change
    if ('parentId' in newUpdates && newUpdates.parentId !== oldTask.parentId) {
        changedFields.push('parentId')
    }

    // Check canvasPosition change
    if ('canvasPosition' in newUpdates) {
        const oldPos = oldTask.canvasPosition
        const newPos = newUpdates.canvasPosition
        if (oldPos?.x !== newPos?.x || oldPos?.y !== newPos?.y) {
            changedFields.push('canvasPosition')
        }
    }

    if (changedFields.length > 0) {
        console.error('[ASSERT-FAILED] Smart group attempted geometry change', {
            context,
            taskId: oldTask.id?.slice(0, 8),
            taskTitle: oldTask.title?.slice(0, 30),
            changedFields,
            oldParentId: oldTask.parentId,
            newParentId: newUpdates.parentId,
            oldPosition: oldTask.canvasPosition,
            newPosition: newUpdates.canvasPosition
        })
    }
}

// ============================================================================
// DUPLICATE ID DETECTION
// ============================================================================

/**
 * Result of duplicate ID check
 */
export interface DuplicateIdResult {
    duplicates: Array<{ id: string; count: number }>
    totalCount: number
    uniqueIdCount: number
    hasDuplicates: boolean
}

/**
 * Assert that no duplicate IDs exist in an array of items
 *
 * This is the authoritative helper for duplicate detection across all layers.
 * Use it in:
 * - tasksWithCanvasPosition (selector layer)
 * - visibleGroups (store layer)
 * - Node builders (final layer)
 *
 * @param items - Array of items with 'id' property
 * @param context - Descriptive context for error messages (e.g., 'tasksToSync', 'groups')
 * @returns DuplicateIdResult with stats and duplicate list
 */
export function assertNoDuplicateIds<T extends { id: string }>(
    items: T[],
    context: string
): DuplicateIdResult {
    const counts = new Map<string, number>()

    for (const item of items) {
        counts.set(item.id, (counts.get(item.id) ?? 0) + 1)
    }

    const duplicates = Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([id, count]) => ({ id, count }))

    const result: DuplicateIdResult = {
        duplicates,
        totalCount: items.length,
        uniqueIdCount: counts.size,
        hasDuplicates: duplicates.length > 0
    }

    if (result.hasDuplicates) {
        console.error(`[ASSERT-FAILED] Duplicate ids in ${context}`, {
            duplicates: duplicates.map(d => ({ id: d.id.slice(0, 8), count: d.count })),
            totalCount: result.totalCount,
            uniqueIdCount: result.uniqueIdCount
        })
    }

    return result
}

/**
 * Alias for assertNoDuplicateIds - preferred naming convention
 */
export const checkForDuplicateIds = assertNoDuplicateIds

// ============================================================================
// GEOMETRY DRIFT DETECTION
// ============================================================================

/**
 * Fields that constitute "geometry" - only drag handlers should modify these
 */
const GEOMETRY_FIELDS = ['canvasPosition', 'position', 'parentId', 'parentGroupId'] as const
type GeometryField = typeof GEOMETRY_FIELDS[number]

/**
 * Allowed sources that can modify geometry
 */
const ALLOWED_GEOMETRY_SOURCES = ['DRAG', 'CREATE', 'MOVE_TO_INBOX', 'INITIAL_RECONCILE'] as const
type GeometrySource = typeof ALLOWED_GEOMETRY_SOURCES[number]

/**
 * Check if an update object contains geometry fields
 */
export function containsGeometryFields(updates: Record<string, any>): GeometryField[] {
    return GEOMETRY_FIELDS.filter(field => field in updates)
}

/**
 * Assert that geometry changes come from an allowed source
 *
 * Call this from updateTask/updateGroup with a source parameter.
 * Logs [GEOMETRY-DRIFT] warning if non-allowed source tries to modify geometry.
 *
 * @param updates - The update object being applied
 * @param source - Who is making the change ('DRAG', 'SYNC', 'SMART-GROUP', etc.)
 * @param entityType - 'task' or 'group'
 * @param entityId - The ID of the entity being updated
 */
export function assertGeometrySource(
    updates: Record<string, any>,
    source: string | undefined,
    entityType: 'task' | 'group',
    entityId: string
): void {
    if (!isDev) return

    const geometryFields = containsGeometryFields(updates)
    if (geometryFields.length === 0) return // No geometry changes

    const isAllowed = source && ALLOWED_GEOMETRY_SOURCES.includes(source as GeometrySource)

    if (isAllowed) {
        console.debug(`📍 [GEOMETRY-${source}]`, {
            entityType,
            entityId: entityId.slice(0, 8),
            fields: geometryFields,
            values: geometryFields.reduce((acc, f) => ({ ...acc, [f]: updates[f] }), {})
        })
    } else {
        console.warn(`⚠️ [GEOMETRY-DRIFT] Non-drag source "${source || 'UNKNOWN'}" modifying geometry`, {
            entityType,
            entityId: entityId.slice(0, 8),
            fields: geometryFields,
            values: geometryFields.reduce((acc, f) => ({ ...acc, [f]: updates[f] }), {}),
            stack: new Error().stack?.split('\n').slice(2, 5).join('\n')
        })
    }
}

// ============================================================================
// SUPABASE DEBUG HELPERS
// ============================================================================
//
// SQL QUERIES FOR FINDING DUPLICATES:
// ====================================
//
// Find duplicate task IDs in database:
// ```sql
// SELECT id, COUNT(*) AS cnt
// FROM tasks
// GROUP BY id
// HAVING COUNT(*) > 1;
// ```
//
// Find duplicate group IDs in database:
// ```sql
// SELECT id, COUNT(*) AS cnt
// FROM groups
// GROUP BY id
// HAVING COUNT(*) > 1;
// ```
//
// ONE-TIME CLEANUP (DANGEROUS - run manually in Supabase SQL editor):
// ===================================================================
// For tasks - keep the row with latest updated_at, delete others:
// ```sql
// WITH duplicates AS (
//   SELECT id, ctid, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) as rn
//   FROM tasks
//   WHERE id IN (
//     SELECT id FROM tasks GROUP BY id HAVING COUNT(*) > 1
//   )
// )
// DELETE FROM tasks WHERE ctid IN (
//   SELECT ctid FROM duplicates WHERE rn > 1
// );
// ```
//
// For groups - keep the row with latest updated_at, delete others:
// ```sql
// WITH duplicates AS (
//   SELECT id, ctid, ROW_NUMBER() OVER (PARTITION BY id ORDER BY updated_at DESC) as rn
//   FROM groups
//   WHERE id IN (
//     SELECT id FROM groups GROUP BY id HAVING COUNT(*) > 1
//   )
// )
// DELETE FROM groups WHERE ctid IN (
//   SELECT ctid FROM duplicates WHERE rn > 1
// );
// ```
//
// ============================================================================

/**
 * Log task ID histogram from Supabase fetch results
 *
 * Call after fetchTasks() to detect if Supabase returns duplicates.
 * This would indicate a database-level issue (multiple rows with same ID).
 *
 * @param tasks - Array of tasks from Supabase
 * @param context - Description of the fetch (e.g., 'loadFromDatabase')
 */
export function logSupabaseTaskIdHistogram(
    tasks: Array<{ id: string; title?: string }>,
    context: string
): void {
    if (!isDev) return

    const counts = new Map<string, number>()
    for (const task of tasks) {
        counts.set(task.id, (counts.get(task.id) ?? 0) + 1)
    }

    const duplicates = Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([id, count]) => ({ id: id.slice(0, 8), count }))

    if (duplicates.length > 0) {
        console.error(`[SUPABASE-DUPLICATES] ${context}`, {
            duplicates,
            totalCount: tasks.length,
            uniqueCount: counts.size
        })
    } else {
        console.debug(`[SUPABASE-HISTOGRAM] ${context}`, {
            totalCount: tasks.length,
            uniqueCount: counts.size
        })
    }
}

/**
 * Log group ID histogram from Supabase fetch results
 *
 * Call after fetchGroups() to detect if Supabase returns duplicates.
 * This would indicate a database-level issue (multiple rows with same ID).
 *
 * @param groups - Array of groups from Supabase
 * @param context - Description of the fetch (e.g., 'loadFromDatabase')
 */
export function logSupabaseGroupIdHistogram(
    groups: Array<{ id: string; name?: string }>,
    context: string
): void {
    if (!isDev) return

    const counts = new Map<string, number>()
    for (const group of groups) {
        counts.set(group.id, (counts.get(group.id) ?? 0) + 1)
    }

    const duplicates = Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([id, count]) => ({ id: id.slice(0, 8), count }))

    if (duplicates.length > 0) {
        console.error(`[SUPABASE-GROUP-DUPLICATES] ${context}`, {
            duplicates,
            totalCount: groups.length,
            uniqueCount: counts.size
        })
    } else {
        console.debug(`[SUPABASE-GROUP-HISTOGRAM] ${context}`, {
            totalCount: groups.length,
            uniqueCount: counts.size
        })
    }
}
