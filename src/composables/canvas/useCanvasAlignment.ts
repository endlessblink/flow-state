/**
 * useCanvasAlignment - TASK-258
 *
 * Multi-select task alignment for canvas context menu.
 * Provides Figma/Sketch-like alignment operations.
 *
 * CRITICAL INVARIANTS (TASK-255):
 * - Uses ABSOLUTE positions (computedPosition) for correct alignment of nested tasks
 * - Updates via taskStore.updateTask() with 'DRAG' source to respect geometry invariants
 * - Batches all updates into a single undo action via saveState()
 */

import { type Ref, nextTick } from 'vue'
import { type Node } from '@vue-flow/core'
import { useMessage } from 'naive-ui'
import { useTaskStore } from '../../stores/tasks'
import { useCanvasStore } from '../../stores/canvas'
import { getUndoSystem } from '../../composables/undoSingleton'

interface NodeWithComputed extends Node {
    computedPosition?: { x: number; y: number }
    width?: number
    height?: number
}

// TASK-258: Standard dimensions for fallback
const DEFAULT_WIDTH = 200
const DEFAULT_HEIGHT = 80

// TASK-335: Minimum spacing for distribution when tasks are stacked
// Same values as "Arrange in Row/Column" for consistency
const DEFAULT_SPACING_X = 240  // Task width (200) + gap (40)
const DEFAULT_SPACING_Y = 120  // Task height (80) + gap (40)
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
        const vueFlowSelected = nodes.value.filter(n => 'selected' in n && n.selected && n.type === 'taskNode')

        if (vueFlowSelected.length < minNodes) {
            return {
                canProceed: false,
                reason: `Need at least ${minNodes} selected tasks, have ${vueFlowSelected.length}`
            }
        }

        const syncInfo = {
            storeSelection: canvasStore.selectedNodeIds.length,
            vueFlowSelection: vueFlowSelected.length,
            matched: vueFlowSelected.filter(n => canvasStore.selectedNodeIds.includes(n.id)).length
        }

        if (syncInfo.matched !== syncInfo.storeSelection) {
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
        operation: (selectedNodes: NodeWithComputed[]) => void,
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

        const selectedNodes = nodes.value.filter(n =>
            canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
        ) as NodeWithComputed[]

        if (selectedNodes.length < minNodes) {
            const errorMsg = `Need at least ${minNodes} selected tasks for ${operationName.toLowerCase()}, have ${selectedNodes.length}`
            message.error(errorMsg)
            return false
        }

        try {
            // Show temporary loading state
            message.loading(`Performing ${operationName.toLowerCase()}...`, { duration: 300 })

            // BATCH UNDO: Save state BEFORE all operations
            await getUndoSystem().saveState(`Before ${operationName}`)

            // Execute the alignment operation
            operation(selectedNodes)

            // BATCH UNDO: Save state AFTER all operations
            await nextTick()
            await getUndoSystem().saveState(`After ${operationName}`)

            // Show success feedback
            message.success(`Successfully aligned ${selectedNodes.length} tasks ${operationName.toLowerCase().replace('align ', '')}`)

            // TASK-258 FIX: Force visual sync since orchestrator doesn't watch property changes
            if (actions.requestSync) {
                actions.requestSync()
            }

            return true
        } catch (error) {
            message.error(`Alignment operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            return false
        }
    }

    // =========================================================================
    // ALIGNMENT OPERATIONS
    // All use ABSOLUTE positions via getAbsolutePosition() and 'DRAG' source
    // =========================================================================

    const alignLeft = () => {
        executeAlignmentOperation('Align Left', (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const minX = Math.min(...boundsMapping.map(b => b.bounds.left))

            boundsMapping.forEach(({ node, bounds }) => {
                taskStore.updateTask(node.id, {
                    canvasPosition: { x: minX, y: bounds.top },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignRight = () => {
        executeAlignmentOperation('Align Right', (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const maxX = Math.max(...boundsMapping.map(b => b.bounds.right))

            boundsMapping.forEach(({ node, bounds }) => {
                // To align right edge, substract width from maxRight
                taskStore.updateTask(node.id, {
                    canvasPosition: { x: maxX - bounds.width, y: bounds.top },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignTop = () => {
        executeAlignmentOperation('Align Top', (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const minY = Math.min(...boundsMapping.map(b => b.bounds.top))

            boundsMapping.forEach(({ node, bounds }) => {
                taskStore.updateTask(node.id, {
                    canvasPosition: { x: bounds.left, y: minY },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignBottom = () => {
        executeAlignmentOperation('Align Bottom', (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const maxY = Math.max(...boundsMapping.map(b => b.bounds.bottom))

            boundsMapping.forEach(({ node, bounds }) => {
                // To align bottom edge, substract height from maxBottom
                taskStore.updateTask(node.id, {
                    canvasPosition: { x: bounds.left, y: maxY - bounds.height },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignCenterHorizontal = () => {
        executeAlignmentOperation('Center Horizontal', (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const avgCenterX = boundsMapping.reduce((sum, b) => sum + b.bounds.centerX, 0) / boundsMapping.length

            boundsMapping.forEach(({ node, bounds }) => {
                // To center, subtract half width from avg center X
                taskStore.updateTask(node.id, {
                    canvasPosition: { x: avgCenterX - bounds.width / 2, y: bounds.top },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignCenterVertical = () => {
        executeAlignmentOperation('Center Vertical', (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            const avgCenterY = boundsMapping.reduce((sum, b) => sum + b.bounds.centerY, 0) / boundsMapping.length

            boundsMapping.forEach(({ node, bounds }) => {
                // To middle-align, subtract half height from avg center Y
                taskStore.updateTask(node.id, {
                    canvasPosition: { x: bounds.left, y: avgCenterY - bounds.height / 2 },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        })
    }

    const distributeHorizontal = () => {
        console.log('🎯 distributeHorizontal called in useCanvasAlignment')
        executeAlignmentOperation('Distribute Horizontal', (selectedNodes) => {
            console.log('🎯 distributeHorizontal operation executing with', selectedNodes.length, 'nodes')
            if (selectedNodes.length < 3) return

            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            // Sort by current absolute centerX
            const sorted = [...boundsMapping].sort((a, b) => a.bounds.centerX - b.bounds.centerX)

            const startX = sorted[0].bounds.centerX
            const endX = sorted[sorted.length - 1].bounds.centerX
            const naturalSpacing = (endX - startX) / (sorted.length - 1)
            // TASK-335: If tasks are stacked (no natural spread), use fixed spacing
            const spacing = naturalSpacing > MIN_SPACING_THRESHOLD ? naturalSpacing : DEFAULT_SPACING_X

            sorted.forEach(({ node, bounds }, index) => {
                const targetCenterX = startX + (spacing * index)
                taskStore.updateTask(node.id, {
                    canvasPosition: { x: targetCenterX - bounds.width / 2, y: bounds.top },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        }, 3) // Min 3 nodes
    }

    const distributeVertical = () => {
        executeAlignmentOperation('Distribute Vertical', (selectedNodes) => {
            if (selectedNodes.length < 3) return

            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            // Sort by current absolute centerY
            const sorted = [...boundsMapping].sort((a, b) => a.bounds.centerY - b.bounds.centerY)

            const startY = sorted[0].bounds.centerY
            const endY = sorted[sorted.length - 1].bounds.centerY
            const naturalSpacing = (endY - startY) / (sorted.length - 1)
            // TASK-335: If tasks are stacked (no natural spread), use fixed spacing
            const spacing = naturalSpacing > MIN_SPACING_THRESHOLD ? naturalSpacing : DEFAULT_SPACING_Y

            sorted.forEach(({ node, bounds }, index) => {
                const targetCenterY = startY + (spacing * index)
                taskStore.updateTask(node.id, {
                    canvasPosition: { x: bounds.left, y: targetCenterY - bounds.height / 2 },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        }, 3)
    }

    const arrangeInRow = () => {
        executeAlignmentOperation('Arrange in Row', (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            // Sort by current absolute X
            const sorted = [...boundsMapping].sort((a, b) => a.bounds.left - b.bounds.left)

            // Calculate average Center Y position (absolute)
            const avgCenterY = sorted.reduce((sum, b) => sum + b.bounds.centerY, 0) / sorted.length

            // Find the leftmost X position (absolute)
            const startX = sorted[0].bounds.left

            // Standard task node width is 200px, add 40px gap = 240px spacing
            const SPACING = 240

            sorted.forEach(({ node, bounds }, index) => {
                taskStore.updateTask(node.id, {
                    canvasPosition: {
                        x: startX + (SPACING * index),
                        y: avgCenterY - bounds.height / 2
                    },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        })
    }

    const arrangeInColumn = () => {
        executeAlignmentOperation('Arrange in Column', (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))
            // Sort by current absolute Y
            const sorted = [...boundsMapping].sort((a, b) => a.bounds.top - b.bounds.top)

            // Calculate average Center X position (absolute)
            const avgCenterX = sorted.reduce((sum, b) => sum + b.bounds.centerX, 0) / sorted.length

            // Find the topmost Y position (absolute)
            const startY = sorted[0].bounds.top

            // Standard task node height is 80px, add 40px gap = 120px spacing
            const SPACING = 120

            sorted.forEach(({ node, bounds }, index) => {
                taskStore.updateTask(node.id, {
                    canvasPosition: {
                        x: avgCenterX - bounds.width / 2,
                        y: startY + (SPACING * index)
                    },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

            actions.closeCanvasContextMenu()
        })
    }

    const arrangeInGrid = () => {
        executeAlignmentOperation('Arrange in Grid', (selectedNodes) => {
            const boundsMapping = selectedNodes.map(n => ({ node: n, bounds: getNodeBounds(n) }))

            // Calculate grid dimensions - prefer wider grids
            const count = boundsMapping.length
            const cols = Math.ceil(Math.sqrt(count))

            // Calculate average position as grid center (absolute)
            const avgCenterX = boundsMapping.reduce((sum, b) => sum + b.bounds.centerX, 0) / boundsMapping.length
            const avgCenterY = boundsMapping.reduce((sum, b) => sum + b.bounds.centerY, 0) / boundsMapping.length

            // Spacing constants
            const SPACING_X = 240 // Task width (200) + gap (40)
            const SPACING_Y = 120 // Task height (80) + gap (40)

            // Calculate grid starting position (centered around average position)
            const rows = Math.ceil(count / cols)
            const gridWidth = (cols - 1) * SPACING_X
            const gridHeight = (rows - 1) * SPACING_Y
            const startX = avgCenterX - (gridWidth / 2)
            const startY = avgCenterY - (gridHeight / 2)

            // Arrange nodes in grid
            boundsMapping.forEach(({ node, bounds }, index) => {
                const row = Math.floor(index / cols)
                const col = index % cols

                taskStore.updateTask(node.id, {
                    canvasPosition: {
                        x: startX + (col * SPACING_X) - bounds.width / 2, // Centering node in cell
                        y: startY + (row * SPACING_Y) - bounds.height / 2
                    },
                    positionFormat: 'absolute'
                }, 'DRAG')
            })

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
