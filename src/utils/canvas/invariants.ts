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
 * - If group.parentGroupId !== null → Vue Flow node has parentNode = CanvasIds.groupNodeId(parentGroupId), extent: 'parent'
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
