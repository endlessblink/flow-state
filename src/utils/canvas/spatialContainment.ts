/**
 * Spatial Containment Detection
 *
 * Fixes the bug where tasks outside group bounds are treated as children.
 * Only tasks PHYSICALLY INSIDE a group should be grouped together.
 *
 * Key Insight: parentId is a SUGGESTION, not a rule.
 * Vue Flow's parentNode should only be set if task is actually inside the group spatially.
 */

import type { CanvasSection } from '@/stores/canvas'

export interface NodePosition {
    x: number
    y: number
}

export interface SpatialNode {
    position: NodePosition
    width?: number
    height?: number
}

export interface ContainerBounds {
    position: NodePosition
    width: number
    height: number
}

// Default task dimensions
const DEFAULT_TASK_WIDTH = 220
const DEFAULT_TASK_HEIGHT = 100

/**
 * Check if a node's center is inside a container's bounds
 *
 * @param node - The node to check (task or group)
 * @param container - The container bounds to check against
 * @param padding - Inner padding to require (default 10px)
 * @returns true if node center is inside container
 */
export function isNodeCompletelyInside(
    node: SpatialNode,
    container: ContainerBounds,
    padding: number = 10
): boolean {
    // Get node center point
    const nodeCenterX = node.position.x + (node.width || DEFAULT_TASK_WIDTH) / 2
    const nodeCenterY = node.position.y + (node.height || DEFAULT_TASK_HEIGHT) / 2

    // Check if center is inside container bounds (with padding)
    return (
        nodeCenterX >= container.position.x + padding &&
        nodeCenterX <= container.position.x + container.width - padding &&
        nodeCenterY >= container.position.y + padding &&
        nodeCenterY <= container.position.y + container.height - padding
    )
}

/**
 * Check if a point is inside a rectangle
 */
export function isPointInBounds(
    point: NodePosition,
    bounds: ContainerBounds,
    padding: number = 0
): boolean {
    return (
        point.x >= bounds.position.x + padding &&
        point.x <= bounds.position.x + bounds.width - padding &&
        point.y >= bounds.position.y + padding &&
        point.y <= bounds.position.y + bounds.height - padding
    )
}

/**
 * Find all groups that physically contain a node
 *
 * @param node - The node to check
 * @param allGroups - All available groups
 * @param excludeId - Optional group ID to exclude (e.g., the node's own ID if it's a group)
 * @returns Array of containing groups
 */
export function findContainingGroups(
    node: SpatialNode,
    allGroups: CanvasSection[],
    excludeId?: string
): CanvasSection[] {
    return allGroups.filter(group => {
        // Don't check self
        if (excludeId && group.id === excludeId) return false
        // Skip hidden groups
        if (group.isVisible === false) return false

        const containerBounds: ContainerBounds = {
            position: group.position,
            width: group.position.width,
            height: group.position.height
        }

        return isNodeCompletelyInside(node, containerBounds)
    })
}

/**
 * Find the deepest (smallest) containing group for a node
 * If node is in multiple nested groups, returns the innermost (smallest) one
 *
 * @param node - The node to check
 * @param allGroups - All available groups
 * @param excludeId - Optional group ID to exclude
 * @returns The deepest containing group, or null if not in any group
 */
export function getDeepestContainingGroup(
    node: SpatialNode,
    allGroups: CanvasSection[],
    excludeId?: string
): CanvasSection | null {
    const containingGroups = findContainingGroups(node, allGroups, excludeId)

    if (containingGroups.length === 0) return null

    // Return the smallest group by area (this handles nested groups correctly)
    return containingGroups.reduce((smallest, current) => {
        const currentArea = current.position.width * current.position.height
        const smallestArea = smallest.position.width * smallest.position.height
        return currentArea < smallestArea ? current : smallest
    })
}

/**
 * Validate that a claimed parentId actually matches spatial containment
 *
 * @param taskPosition - The task's absolute position
 * @param claimedParentId - The parentId from the database
 * @param allGroups - All available groups
 * @returns true if parent claim is spatially valid
 */
export function validateParentClaim(
    taskPosition: NodePosition,
    claimedParentId: string | null | undefined,
    allGroups: CanvasSection[]
): boolean {
    if (!claimedParentId) return true // No parent claim is always valid

    const parentGroup = allGroups.find(g => g.id === claimedParentId)
    if (!parentGroup) return false // Parent doesn't exist

    const taskNode: SpatialNode = { position: taskPosition }
    const containerBounds: ContainerBounds = {
        position: parentGroup.position,
        width: parentGroup.position.width,
        height: parentGroup.position.height
    }

    return isNodeCompletelyInside(taskNode, containerBounds)
}

/**
 * Get the correct parent for a task based on spatial position
 * Use this instead of trusting the parentId field
 *
 * @param taskPosition - The task's absolute position
 * @param allGroups - All available groups
 * @returns The correct parent group ID, or null if not in any group
 */
export function getSpatiallyCorrectParent(
    taskPosition: NodePosition,
    allGroups: CanvasSection[]
): string | null {
    const taskNode: SpatialNode = { position: taskPosition }
    const containingGroup = getDeepestContainingGroup(taskNode, allGroups)
    return containingGroup?.id || null
}

/**
 * Debug: Log containment status for all tasks
 */
export function logContainmentDebug(
    tasks: Array<{ id: string; title: string; parentId?: string | null; canvasPosition?: NodePosition }>,
    groups: CanvasSection[]
): void {
    console.group('Spatial Containment Debug')

    for (const task of tasks) {
        if (!task.canvasPosition) continue

        const claimedParent = task.parentId
        const actualParent = getSpatiallyCorrectParent(task.canvasPosition, groups)
        const isValid = claimedParent === actualParent

        const status = isValid ? '✓' : '✗'
        console.log(`${status} ${task.title || task.id}`)
        console.log(`   Position: (${task.canvasPosition.x}, ${task.canvasPosition.y})`)
        console.log(`   Claimed Parent: ${claimedParent || 'none'}`)
        console.log(`   Spatial Parent: ${actualParent || 'none'}`)

        if (!isValid) {
            console.warn(`   MISMATCH: Should be "${actualParent || 'none'}" not "${claimedParent || 'none'}"`)
        }
    }

    console.groupEnd()
}
