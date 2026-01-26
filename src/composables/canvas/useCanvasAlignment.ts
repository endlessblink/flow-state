/**
 * useCanvasAlignment - TASK-258, TASK-1081
 *
 * Multi-select alignment for canvas context menu.
 * Supports BOTH tasks AND groups (sections).
 * Provides Figma/Sketch-like alignment operations.
 *
 * CRITICAL INVARIANTS (TASK-255):
 * - Uses ABSOLUTE positions (computedPosition) for correct alignment of nested tasks
 * - Updates via taskStore.updateTask() with 'DRAG' source to respect geometry invariants
 * - Updates groups via canvasStore.updateGroup() preserving width/height
 * - Batches all updates into a single undo action via saveState()
 */

import { type Ref, nextTick } from 'vue'
import { type Node } from '@vue-flow/core'
import { useMessage } from 'naive-ui'
import { useTaskStore } from '../../stores/tasks'
import { useCanvasStore } from '../../stores/canvas'
import { getUndoSystem } from '../../composables/undoSingleton'
import { CanvasIds } from '../../utils/canvas/canvasIds'

interface NodeWithComputed extends Node {
    computedPosition?: { x: number; y: number }
    width?: number
    height?: number
}

// TASK-258: Standard dimensions for fallback
const DEFAULT_WIDTH = 280  // Actual task cards are wider with content
const DEFAULT_HEIGHT = 100 // Actual task cards are taller with metadata

// TASK-335/TASK-340: Spacing for layout operations
// Use generous spacing to prevent overlap with varying task sizes
const DEFAULT_SPACING_X = 300  // Comfortable horizontal gap
const DEFAULT_SPACING_Y = 130  // Comfortable vertical gap
const MIN_SPACING_THRESHOLD = 10  // Below this, use default spacing

/**
 * Get absolute position for a node.
 * Uses computedPosition if available (nested nodes), falls back to position (root nodes).
 */
function getAbsolutePosition(node: NodeWithComputed): { x: number; y: number } {
    // computedPosition is always absolute (world coordinates)
    if (node.computedPosition &&
        typeof node.computedPosition.x === 'number' &&
        typeof node.computedPosition.y === 'number') {
        return { x: node.computedPosition.x, y: node.computedPosition.y }
    }
    // For root nodes without parent, position IS absolute
    return { x: node.position.x, y: node.position.y }
}

/**
 * Get full bounding box for a node in absolute coordinates.
 */
function getNodeBounds(node: NodeWithComputed) {
    const abs = getAbsolutePosition(node)
    const width = node.width ?? (node as any).dimensions?.width ?? DEFAULT_WIDTH
    const height = node.height ?? (node as any).dimensions?.height ?? DEFAULT_HEIGHT

    return {
        left: abs.x,
        top: abs.y,
        right: abs.x + width,
        bottom: abs.y + height,
        width,
        height,
        centerX: abs.x + width / 2,
        centerY: abs.y + height / 2
    }
}

export function useCanvasAlignment(
    nodes: Ref<Node[]>,
    status: {
        isVueFlowMounted: Ref<boolean>
        isVueFlowReady: Ref<boolean>
        isCanvasReady: Ref<boolean>
    },
    actions: {
        closeCanvasContextMenu: () => void
        requestSync?: () => void
    }
) {
    const message = useMessage()
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()

    /**
     * TASK-1081: Update position for either a task or a group
     * - Tasks: use canvasPosition { x, y } via taskStore.updateTask
     * - Groups: use position { x, y, width, height } via canvasStore.updateGroup
     */
    const updateNodePosition = async (node: NodeWithComputed, newX: number, newY: number) => {
        if (node.type === 'sectionNode') {
            // Group node - update via canvasStore, preserve width/height
            const groupId = CanvasIds.parseNodeId(node.id).id
            const currentGroup = canvasStore.groups.find(g => g.id === groupId)
            if (currentGroup) {
                await canvasStore.updateGroup(groupId, {
                    position: {
                        x: newX,
                        y: newY,
                        width: currentGroup.position.width,
                        height: currentGroup.position.height
                    }
                })
            }
        } else {
            // Task node - update via taskStore with 'DRAG' source
            await taskStore.updateTask(node.id, {
                canvasPosition: { x: newX, y: newY },
                positionFormat: 'absolute'
            }, 'DRAG')
        }
    }

    // Pre-alignment state validation function
    const validateAlignmentState = (minNodes: number = 2): { canProceed: boolean; reason?: string } => {
        // Check if Vue Flow component is mounted
        if (!status.isVueFlowMounted.value) {
            return {
                canProceed: false,
                reason: 'Vue Flow component not yet mounted - please wait'
            }
        }

        // Check if Vue Flow instance is available (DOM check)
        const vueFlowInstance = document.querySelector('.vue-flow')
        if (!vueFlowInstance) {
            return {
                canProceed: false,
                reason: 'Vue Flow component not yet mounted'
            }
        }

        if (nodes.value.length === 0) {
            return {
                canProceed: false,
                reason: 'No nodes available in canvas'
            }
        }

        // Check selection synchronization
        // TASK-1081: Include both tasks AND groups (sections) for alignment
        // Tasks have type 'taskNode', groups have type 'sectionNode'
        const storeSelectedIds = canvasStore.selectedNodeIds
        const vueFlowSelected = nodes.value.filter(n =>
            'selected' in n && n.selected && (n.type === 'taskNode' || n.type === 'sectionNode')
        )

        if (vueFlowSelected.length < minNodes) {
            // BUG-1062: Also check if store has enough items but Vue Flow is desynced
            // This can happen when syncStoreToCanvas() rebuilds nodes without preserving selection
            if (storeSelectedIds.length >= minNodes) {
                console.warn('[ALIGNMENT] Selection desync: store has items but Vue Flow lost selection', {
                    storeSelectedIds,
                    vueFlowSelectedIds: vueFlowSelected.map(n => n.id)
                })
                return {
                    canProceed: false,
                    reason: `Selection lost during sync - please re-select your items (store: ${storeSelectedIds.length}, Vue Flow: ${vueFlowSelected.length})`
                }
            }
            return {
                canProceed: false,
                reason: `Need at least ${minNodes} selected items, have ${vueFlowSelected.length}`
            }
        }

        const syncInfo = {
            storeSelection: storeSelectedIds.length,
            vueFlowSelection: vueFlowSelected.length,
            matched: vueFlowSelected.filter(n => storeSelectedIds.includes(n.id)).length
        }

        // BUG-1062 FIX: Compare selections on both sides
        if (syncInfo.matched !== syncInfo.storeSelection) {
            console.warn('[ALIGNMENT] Selection state mismatch detected', {
                storeSelectedIds,
                vueFlowSelectedIds: vueFlowSelected.map(n => n.id),
                syncInfo
            })
            return {
                canProceed: false,
                reason: 'Selection state not synchronized between store and Vue Flow'
            }
        }

        return { canProceed: true }
    }

    /**
     * Execute an alignment operation with batch undo support.
     *
     * GEOMETRY INVARIANT: Uses 'DRAG' source for all position updates.
     * UNDO SUPPORT: Wraps all updates in saveState() for single undo action.
     */
    const executeAlignmentOperation = async (
        operationName: string,
        operation: (selectedNodes: NodeWithComputed[]) => void | Promise<void>,
        minNodes: number = 2
    ) => {
        // Pre-alignment state validation
        console.log('🔍 executeAlignmentOperation:', operationName, 'minNodes:', minNodes)
        const validation = validateAlignmentState(minNodes)
        console.log('🔍 validation result:', validation)
        if (!validation.canProceed) {
            message.warning(validation.reason || 'Validation failed')
            return false
        }

        // TASK-1081: Include both tasks (taskNode) and groups (sectionNode)
        const selectedNodes = nodes.value.filter(n =>
            canvasStore.selectedNodeIds.includes(n.id) &&
            (n.type === 'taskNode' || n.type === 'sectionNode')
        ) as NodeWithComputed[]

        if (selectedNodes.length < minNodes) {
            const errorMsg = `Need at least ${minNodes} selected items for ${operationName.toLowerCase()}, have ${selectedNodes.length}`
            message.error(errorMsg)
            return false
        }

        try {
            // Show temporary loading state
            message.loading(`Performing ${operationName.toLowerCase()}...`, { duration: 300 })

            // BUG-1068 FIX: Set manualOperationInProgress to prevent sync from interfering
            // This flag tells the sync system to skip updates while we're batch-updating positions
            taskStore.manualOperationInProgress = true

            // BATCH UNDO: Save state BEFORE all operations
            await getUndoSystem().saveState(`Before ${operationName}`)

            // BUG-1068 FIX: Await the operation - it's async since BUG-1051
            // Without await, updateTask() calls yield and sync overwrites positions
            await operation(selectedNodes)

            // BATCH UNDO: Save state AFTER all operations
            await nextTick()
            await getUndoSystem().saveState(`After ${operationName}`)

            // BUG-1068 FIX: Release the lock before triggering sync
            taskStore.manualOperationInProgress = false

            // Show success feedback
            message.success(`Successfully aligned ${selectedNodes.length} items ${operationName.toLowerCase().replace('align ', '')}`)

            // TASK-258 FIX: Force visual sync since orchestrator doesn't watch property changes
            if (actions.requestSync) {
                actions.requestSync()
            }

            return true
        } catch (error) {
            // BUG-1068: Always release the lock on error
            taskStore.manualOperationInProgress = false
            message.error(`Alignment operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            return false
        }
    }

    // =========================================================================
    // ALIGNMENT OPERATIONS - TASK-1081: Now supports both tasks AND groups
    // All use ABSOLUTE positions via getAbsolutePosition()
    // Tasks use 'DRAG' source, groups update via canvasStore
    // =========================================================================

    const alignLeft = () => {
        executeAlignmentOperation('Align Left', async (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const minX = Math.min(...boundsMapping.map(b => b.bounds.left))

            for (const { node, bounds } of boundsMapping) {
                await updateNodePosition(node, minX, bounds.top)
            }

            actions.closeCanvasContextMenu()
        })
    }

    const alignRight = () => {
        executeAlignmentOperation('Align Right', async (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const maxX = Math.max(...boundsMapping.map(b => b.bounds.right))

            for (const { node, bounds } of boundsMapping) {
                // To align right edge, substract width from maxRight
                await updateNodePosition(node, maxX - bounds.width, bounds.top)
            }

            actions.closeCanvasContextMenu()
        })
    }

    const alignTop = () => {
        executeAlignmentOperation('Align Top', async (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const minY = Math.min(...boundsMapping.map(b => b.bounds.top))

            for (const { node, bounds } of boundsMapping) {
                await updateNodePosition(node, bounds.left, minY)
            }

            actions.closeCanvasContextMenu()
        })
    }

    const alignBottom = () => {
        executeAlignmentOperation('Align Bottom', async (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const maxY = Math.max(...boundsMapping.map(b => b.bounds.bottom))

            for (const { node, bounds } of boundsMapping) {
                // To align bottom edge, substract height from maxBottom
                await updateNodePosition(node, bounds.left, maxY - bounds.height)
            }

            actions.closeCanvasContextMenu()
        })
    }

    const alignCenterHorizontal = () => {
        executeAlignmentOperation('Center Horizontal', async (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const avgCenterX = boundsMapping.reduce((sum, b) => sum + b.bounds.centerX, 0) / boundsMapping.length

            for (const { node, bounds } of boundsMapping) {
                // To center, subtract half width from avg center X
                await updateNodePosition(node, avgCenterX - bounds.width / 2, bounds.top)
            }

            actions.closeCanvasContextMenu()
        })
    }

    const alignCenterVertical = () => {
        executeAlignmentOperation('Center Vertical', async (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const avgCenterY = boundsMapping.reduce((sum, b) => sum + b.bounds.centerY, 0) / boundsMapping.length

            for (const { node, bounds } of boundsMapping) {
                // To middle-align, subtract half height from avg center Y
                await updateNodePosition(node, bounds.left, avgCenterY - bounds.height / 2)
            }

            actions.closeCanvasContextMenu()
        })
    }

    const distributeHorizontal = () => {
        executeAlignmentOperation('Distribute Horizontal', async (selectedNodes) => {
            if (selectedNodes.length < 3) return

            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            // Sort by current absolute left edge
            const sorted = [...boundsMapping].sort((a, b) => a.bounds.left - b.bounds.left)

            // BUG-1068: Calculate edge-to-edge distribution for consistent visual gaps
            // Total width of all items combined
            const totalItemWidth = sorted.reduce((sum, { bounds }) => sum + bounds.width, 0)
            // Available space between first left and last right
            const firstLeft = sorted[0].bounds.left
            const lastRight = sorted[sorted.length - 1].bounds.right
            const totalSpace = lastRight - firstLeft
            // Calculate gap: (total space - item widths) / number of gaps
            const gapCount = sorted.length - 1
            let gap = gapCount > 0 ? (totalSpace - totalItemWidth) / gapCount : 16
            // TASK-335: If items are stacked (negative or tiny gap), use fixed spacing
            if (gap < MIN_SPACING_THRESHOLD) gap = 16

            let currentX = firstLeft
            for (const { node, bounds } of sorted) {
                await updateNodePosition(node, currentX, bounds.top)
                currentX += bounds.width + gap
            }

            actions.closeCanvasContextMenu()
        }, 3) // Min 3 nodes
    }

    const distributeVertical = () => {
        executeAlignmentOperation('Distribute Vertical', async (selectedNodes) => {
            if (selectedNodes.length < 3) return

            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            // Sort by current absolute top edge
            const sorted = [...boundsMapping].sort((a, b) => a.bounds.top - b.bounds.top)

            // BUG-1068: Calculate edge-to-edge distribution for consistent visual gaps
            // Total height of all items combined
            const totalItemHeight = sorted.reduce((sum, { bounds }) => sum + bounds.height, 0)
            // Available space between first top and last bottom
            const firstTop = sorted[0].bounds.top
            const lastBottom = sorted[sorted.length - 1].bounds.bottom
            const totalSpace = lastBottom - firstTop
            // Calculate gap: (total space - item heights) / number of gaps
            const gapCount = sorted.length - 1
            let gap = gapCount > 0 ? (totalSpace - totalItemHeight) / gapCount : 16
            // TASK-335: If items are stacked (negative or tiny gap), use fixed spacing
            if (gap < MIN_SPACING_THRESHOLD) gap = 16

            let currentY = firstTop
            for (const { node, bounds } of sorted) {
                await updateNodePosition(node, bounds.left, currentY)
                currentY += bounds.height + gap
            }

            actions.closeCanvasContextMenu()
        }, 3)
    }

    const arrangeInRow = () => {
        executeAlignmentOperation('Arrange in Row', async (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            // Sort by current absolute X
            const sorted = [...boundsMapping].sort((a, b) => a.bounds.left - b.bounds.left)

            // Calculate average Center Y position (absolute)
            const avgCenterY = sorted.reduce((sum, b) => sum + b.bounds.centerY, 0) / sorted.length

            // Find the leftmost X position (absolute)
            const startX = sorted[0].bounds.left

            // BUG-1068: Use edge-to-edge gap spacing for consistent visual gaps
            const GAP = 16  // Consistent visual gap between item edges

            let currentX = startX
            for (const { node, bounds } of sorted) {
                await updateNodePosition(node, currentX, avgCenterY - bounds.height / 2)
                // Move X right by this item's width + gap for next item
                currentX += bounds.width + GAP
            }

            actions.closeCanvasContextMenu()
        })
    }

    const arrangeInColumn = () => {
        executeAlignmentOperation('Arrange in Column', async (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            // Sort by current absolute Y
            const sorted = [...boundsMapping].sort((a, b) => a.bounds.top - b.bounds.top)

            // Calculate average Center X position (absolute)
            const avgCenterX = sorted.reduce((sum, b) => sum + b.bounds.centerX, 0) / sorted.length

            // Find the topmost Y position (absolute)
            const startY = sorted[0].bounds.top

            // BUG-1068: Use edge-to-edge gap spacing for consistent visual gaps
            // Instead of fixed spacing from top, position each item based on previous item's bottom
            const GAP = 16  // Consistent visual gap between item edges

            let currentY = startY
            for (const { node, bounds } of sorted) {
                await updateNodePosition(node, avgCenterX - bounds.width / 2, currentY)
                // Move Y down by this item's height + gap for next item
                currentY += bounds.height + GAP
            }

            actions.closeCanvasContextMenu()
        })
    }

    const arrangeInGrid = () => {
        executeAlignmentOperation('Arrange in Grid', async (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))

            // Calculate grid dimensions - prefer wider grids
            const count = boundsMapping.length
            const cols = Math.ceil(Math.sqrt(count))

            // Calculate average position as grid center (absolute)
            const avgCenterX = boundsMapping.reduce((sum, b) => sum + b.bounds.centerX, 0) / boundsMapping.length
            const avgCenterY = boundsMapping.reduce((sum, b) => sum + b.bounds.centerY, 0) / boundsMapping.length

            // Use generous spacing to prevent overlap
            const SPACING_X = DEFAULT_SPACING_X
            const SPACING_Y = DEFAULT_SPACING_Y

            // Calculate grid starting position (centered around average position)
            const rows = Math.ceil(count / cols)
            const gridWidth = (cols - 1) * SPACING_X
            const gridHeight = (rows - 1) * SPACING_Y
            const startX = avgCenterX - (gridWidth / 2)
            const startY = avgCenterY - (gridHeight / 2)

            // Arrange nodes in grid
            for (const { node, bounds } of boundsMapping) {
                const index = boundsMapping.indexOf(boundsMapping.find(b => b.node === node)!)
                const row = Math.floor(index / cols)
                const col = index % cols

                const newX = startX + (col * SPACING_X) - bounds.width / 2  // Centering node in cell
                const newY = startY + (row * SPACING_Y) - bounds.height / 2
                await updateNodePosition(node, newX, newY)
            }

            actions.closeCanvasContextMenu()
        })
    }

    return {
        alignLeft,
        alignRight,
        alignTop,
        alignBottom,
        alignCenterHorizontal,
        alignCenterVertical,
        distributeHorizontal,
        distributeVertical,
        arrangeInRow,
        arrangeInColumn,
        arrangeInGrid
    }
}
