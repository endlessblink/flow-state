import { ref, computed, nextTick } from 'vue'
import { useVueFlow, type Node } from '@vue-flow/core'

/**
 * COMPOSABLE: Node Attachment & Coordinate Handover
 * 
 * Solves the "Zombie Task" issue by providing atomic coordinate transformations
 * when changing parent-child relationships in Vue Flow.
 * 
 * PROBLEM:
 * Vue Flow interprets `node.position` differently based on `node.parentNode`:
 * - No Parent: `position` is Absolute (World space)
 * - Has Parent: `position` is Relative (Parent space)
 * 
 * Simply setting `parentNode` without updating `position` causes the node to
 * jump to incorrect coordinates (interpreting old World coords as Relative coords).
 * 
 * SOLUTION:
 * This composable calculates the correct Relative position from the current Absolute position
 * before assigning the parent, ensuring the node stays visually in place.
 */

export interface Coordinates {
    x: number
    y: number
}

export interface ParentMetrics {
    borderLeft: number
    borderTop: number
    paddingLeft: number
    paddingTop: number
}

export interface AttachmentResult {
    success: boolean
    error?: string
    newPosition?: Coordinates
}

export function useNodeAttachment() {
    const { nodes, getNode } = useVueFlow()

    /**
     * Extracts parent DOM element metrics (borders and padding)
     * These offsets affect where the child is rendered relative to parent's top-left.
     */
    function getParentMetrics(parentNodeId: string): ParentMetrics | null {
        try {
            // Vue Flow nodes usually have a wrapper or data-id we can select
            // Ideally we select the .vue-flow__node[data-id="..."]
            const el = document.querySelector(`[data-id="${parentNodeId}"]`) as HTMLElement
            if (!el) {
                console.warn(`[useNodeAttachment] Parent element not found: ${parentNodeId}`)
                return null
            }

            const computedStyle = window.getComputedStyle(el)

            return {
                borderLeft: Math.max(0, parseFloat(computedStyle.borderLeftWidth) || 0),
                borderTop: Math.max(0, parseFloat(computedStyle.borderTopWidth) || 0),
                paddingLeft: Math.max(0, parseFloat(computedStyle.paddingLeft) || 0),
                paddingTop: Math.max(0, parseFloat(computedStyle.paddingTop) || 0)
            }
        } catch (error) {
            console.error(`[useNodeAttachment] Failed to extract metrics for ${parentNodeId}:`, error)
            return null
        }
    }

    /**
     * Core Formula: Transform Absolute (World) -> Relative (Parent Space)
     * relX = childAbsX - parentAbsX - borderLeft
     * Note: We do NOT subtract padding because Vue Flow/CSS absolute positioning
     * places (0,0) at the top-left of the padding box (inside border), ignoring padding.
     */
    function calculateRelativePosition(
        childAbsPos: Coordinates,
        parentAbsPos: Coordinates,
        metrics: ParentMetrics
    ): Coordinates {
        return {
            x: childAbsPos.x - parentAbsPos.x - metrics.borderLeft,
            y: childAbsPos.y - parentAbsPos.y - metrics.borderTop
        }
    }

    /**
     * Reverse Formula: Transform Relative (Parent Space) -> Absolute (World)
     * absX = childRelX + parentAbsX + borderLeft
     */
    function calculateAbsolutePosition(
        childRelPos: Coordinates,
        parentAbsPos: Coordinates,
        metrics: ParentMetrics
    ): Coordinates {
        return {
            x: childRelPos.x + parentAbsPos.x + metrics.borderLeft,
            y: childRelPos.y + parentAbsPos.y + metrics.borderTop
        }
    }

    /**
     * Forces Vue Flow to re-evaluate the nodes array.
     * Essential after complex coordinate updates.
     */
    function forceReactivity() {
        nodes.value = [...nodes.value]
    }

    /**
     * Attaches a node to a new parent, preserving its visual location.
     * Updates `position` (to Relative) and `parentNode` atomically.
     */
    async function attachNodeToParent(
        nodeId: string,
        parentId: string
    ): Promise<AttachmentResult> {
        const childNode = getNode.value(nodeId)
        const parentNode = getNode.value(parentId)

        if (!childNode) return { success: false, error: `Child node not found: ${nodeId}` }
        if (!parentNode) return { success: false, error: `Parent node not found: ${parentId}` }
        if (nodeId === parentId) return { success: false, error: 'Cannot attach node to itself' }

        try {
            // 1. Snapshot valid Absolute positions
            // Use positionAbsolute if available (computed by Vue Flow), fallback to position if root
            const childAbsPos = childNode.positionAbsolute || childNode.position
            const parentAbsPos = parentNode.positionAbsolute || parentNode.position

            // 2. Get Parent Metrics (Offsets)
            // If we can't get metrics, assume 0 but warn
            const metrics = getParentMetrics(parentId) || {
                borderLeft: 0, borderTop: 0, paddingLeft: 0, paddingTop: 0
            }

            // 3. Calculate Target Relative Position
            const relativePos = calculateRelativePosition(childAbsPos, parentAbsPos, metrics)

            // 4. Apply Atomic Update
            console.log(`[useNodeAttachment] Attaching ${nodeId} to ${parentId}`, {
                childAbs: childAbsPos,
                parentAbs: parentAbsPos,
                relativeResult: relativePos
            })

            childNode.position = relativePos
            childNode.parentNode = parentId
            // TASK-UPDATE: Enforce parent boundaries as per user recommendation
            childNode.extent = 'parent'

            // BUG-153 FIX: Also set data.parentId for persistence/sync
            // useCanvasSync.ts uses this to determine existing parent relationships
            if (childNode.data) {
                // Extract group ID from Vue Flow node ID (section-group-xxx -> group-xxx)
                const groupId = parentId.replace('section-', '')
                childNode.data.parentId = groupId
                console.log(`[useNodeAttachment] Set data.parentId = ${groupId}`)
            }

            // 5. Force Reactivity
            forceReactivity()

            return { success: true, newPosition: relativePos }

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during attachment'
            }
        }
    }

    /**
     * Detaches a node from its parent, preserving its visual location.
     * Updates `position` (to Absolute) and clears `parentNode`.
     */
    async function detachNodeFromParent(nodeId: string): Promise<AttachmentResult> {
        const node = getNode.value(nodeId)

        if (!node) return { success: false, error: `Node not found: ${nodeId}` }
        if (!node.parentNode) return { success: false, error: `Node ${nodeId} has no parent` }

        try {
            // 1. Get current Absolute Position (World Space)
            // Vue Flow maintains this in positionAbsolute usually
            const absPos = node.positionAbsolute || node.position

            // 2. Apply Update
            console.log(`[useNodeAttachment] Detaching ${nodeId} from ${node.parentNode}`, {
                absPos
            })

            node.position = absPos
            node.parentNode = undefined
            // Clear any extent constraints
            node.extent = undefined

            if (node.data) {
                node.data.parentId = undefined
            }

            // 3. Force Reactivity
            forceReactivity()

            return { success: true, newPosition: absPos }

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error during detachment'
            }
        }
    }

    return {
        attachNodeToParent,
        detachNodeFromParent,
        getParentMetrics,
        calculateRelativePosition,
        calculateAbsolutePosition,
        forceReactivity
    }
}
