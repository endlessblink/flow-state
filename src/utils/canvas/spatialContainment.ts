/**
 * Spatial Containment Detection
 *
 * IMPORTANT: All positions passed to these functions must be ABSOLUTE world coordinates.
 * Do NOT pass Vue Flow's relative positions for nested nodes.
 *
 * Fixes the bug where tasks outside group bounds are treated as children.
 * Only tasks PHYSICALLY INSIDE a group should be grouped together.
 *
 * Key Insight: parentId is a SUGGESTION, not a rule.
 * Vue Flow's parentNode should only be set if task is actually inside the group spatially.
 *
 * CONTAINMENT RULE: A task is "inside" a group if its CENTER lies within the group's bounds.
 */

import type { CanvasSection } from '@/stores/canvas'
import { CANVAS } from '@/constants/canvas'

export interface NodePosition {
    x: number
    y: number
}

export interface SpatialNode {
    position: NodePosition  // Must be ABSOLUTE world coordinates
    width?: number
    height?: number
}

export interface ContainerBounds {
    position: NodePosition  // Must be ABSOLUTE world coordinates
    width: number
    height: number
}

// Re-export from centralized constants for backward compatibility
export const DEFAULT_TASK_WIDTH = CANVAS.DEFAULT_TASK_WIDTH
export const DEFAULT_TASK_HEIGHT = CANVAS.DEFAULT_TASK_HEIGHT

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
 * CRITICAL: Both node.position and all group positions must be ABSOLUTE world coordinates.
 * The containment check uses the node's CENTER point against group bounds.
 *
 * @param node - The node to check (with ABSOLUTE position)
 * @param allGroups - All available groups (with ABSOLUTE positions from store)
 * @param excludeId - Optional group ID to exclude (e.g., the node's own ID if it's a group)
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
    // The smallest containing group is the "deepest" one in the hierarchy
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
    claimedParentId: string | undefined,
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
): string | undefined {
    const taskNode: SpatialNode = { position: taskPosition }
    const containingGroup = getDeepestContainingGroup(taskNode, allGroups)
    return containingGroup?.id
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

/**
 * Task interface for reconciliation (minimal required fields)
 */
export interface ReconcilableTask {
    id: string
    parentId?: string
    canvasPosition?: NodePosition | null
}

/**
 * Reconcile task parentIds based on spatial containment
 *
 * This function runs on load to fix legacy tasks whose parentId doesn't
 * match their actual spatial position. Uses center-based containment logic.
 *
 * =========================================================================
 * GEOMETRY WRITER: ONE-TIME on load only (TASK-255 Geometry Invariants)
 * =========================================================================
 * - CONTROLLED: Only runs ONCE per browser session (guarded in orchestrator)
 * - SAFE: Only updates parentId, does not touch positions or other properties
 * - PURPOSE: Fix legacy data where parentId doesn't match spatial containment
 *
 * This is an ALLOWED geometry write because it's a controlled one-time
 * initialization operation, not a runtime sync or automated process.
 * =========================================================================
 *
 * @param tasks - Tasks to reconcile
 * @param groups - All canvas groups (with absolute positions)
 * @param updateTask - Callback to update a task (store.updateTask)
 * @param options - Options for reconciliation behavior
 * @returns Promise with count of reconciled tasks
 */
export async function reconcileTaskParentsByContainment(
    tasks: ReconcilableTask[],
    groups: CanvasSection[],
    updateTask: (id: string, updates: { parentId?: string }) => Promise<void>,
    options?: {
        writeToDb?: boolean  // If false, only logs but doesn't update (dry run)
        silent?: boolean     // If true, suppresses console output
    }
): Promise<{ reconciled: number; total: number }> {
    const writeToDb = options?.writeToDb !== false // Default true
    const silent = options?.silent === true

    let reconciledCount = 0
    const tasksToReconcile: Array<{ task: ReconcilableTask; correctParentId: string | undefined }> = []

    // Phase 1: Identify tasks needing reconciliation
    for (const task of tasks) {
        // Skip tasks not on canvas (no position = inbox task)
        if (!task.canvasPosition) continue

        // Build spatial node using task's absolute position
        const spatialNode: SpatialNode = {
            position: task.canvasPosition,
            width: DEFAULT_TASK_WIDTH,
            height: DEFAULT_TASK_HEIGHT
        }

        // Find the correct parent based on spatial containment
        const correctParentId = getDeepestContainingGroup(spatialNode, groups)?.id

        // Normalize parentId for comparison (treat undefined/'NONE' as undefined)
        const currentParentId = (task.parentId && task.parentId !== 'NONE') ? task.parentId : undefined

        // Check if parentId needs correction
        if (currentParentId !== correctParentId) {
            tasksToReconcile.push({ task, correctParentId })
        }
    }

    // Phase 2: Apply corrections
    if (tasksToReconcile.length > 0) {
        if (!silent) {
            console.log(`🔧 [RECONCILE] Found ${tasksToReconcile.length} tasks with incorrect parentId`)
        }

        for (const { task, correctParentId } of tasksToReconcile) {
            const oldParent = task.parentId || 'none'
            const newParent = correctParentId || 'none'

            if (!silent) {
                console.log(`   📍 Task ${task.id.substring(0, 8)}... : "${oldParent}" → "${newParent}"`)
            }

            if (writeToDb) {
                try {
                    await updateTask(task.id, { parentId: correctParentId })
                    reconciledCount++
                } catch (error) {
                    console.error(`   ❌ Failed to update task ${task.id}:`, error)
                }
            } else {
                reconciledCount++ // Count as reconciled in dry run
            }
        }

        if (!silent) {
            console.log(`✅ [RECONCILE] ${writeToDb ? 'Updated' : 'Would update'} ${reconciledCount} tasks`)
        }
    } else if (!silent) {
        console.log(`✓ [RECONCILE] All ${tasks.filter(t => t.canvasPosition).length} canvas tasks have correct parentId`)
    }

    return {
        reconciled: reconciledCount,
        total: tasks.filter(t => t.canvasPosition).length
    }
}
