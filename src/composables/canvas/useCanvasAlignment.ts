
import { type Ref } from 'vue'
import { type Node } from '@vue-flow/core'
import { useMessage } from 'naive-ui'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

export function useCanvasAlignment(
    nodes: Ref<Node[]>,
    status: {
        isVueFlowMounted: Ref<boolean>
        isVueFlowReady: Ref<boolean>
        isCanvasReady: Ref<boolean>
    },
    actions: {
        closeCanvasContextMenu: () => void
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

    const executeAlignmentOperation = (
        operationName: string,
        operation: (selectedNodes: Node[]) => void,
        minNodes: number = 2
    ) => {
        // Pre-alignment state validation
        const validation = validateAlignmentState(minNodes)
        if (!validation.canProceed) {
            message.warning(validation.reason || 'Validation failed')
            return false
        }

        const selectedNodes = nodes.value.filter(n =>
            canvasStore.selectedNodeIds.includes(n.id) && n.type === 'taskNode'
        )

        if (selectedNodes.length < minNodes) {
            const errorMsg = `Need at least ${minNodes} selected tasks for ${operationName.toLowerCase()}, have ${selectedNodes.length}`
            message.error(errorMsg)
            return false
        }

        try {
            // Show temporary loading state
            message.loading(`Performing ${operationName.toLowerCase()}...`, { duration: 300 })

            // Execute the alignment operation
            operation(selectedNodes)

            // Show success feedback
            message.success(`Successfully aligned ${selectedNodes.length} tasks ${operationName.toLowerCase().replace('align ', '')}`)
            return true
        } catch (error) {
            message.error(`Alignment operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
            return false
        }
    }

    const alignLeft = () => {
        executeAlignmentOperation('Align Left', (selectedNodes) => {
            const minX = Math.min(...selectedNodes.map(n => n.position.x))

            selectedNodes.forEach((node) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: minX, y: node.position.y }
                })
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignRight = () => {
        executeAlignmentOperation('Align Right', (selectedNodes) => {
            const maxX = Math.max(...selectedNodes.map(n => n.position.x))

            selectedNodes.forEach((node) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: maxX, y: node.position.y }
                })
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignTop = () => {
        executeAlignmentOperation('Align Top', (selectedNodes) => {
            const minY = Math.min(...selectedNodes.map(n => n.position.y))

            selectedNodes.forEach((node) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: node.position.x, y: minY }
                })
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignBottom = () => {
        executeAlignmentOperation('Align Bottom', (selectedNodes) => {
            const maxY = Math.max(...selectedNodes.map(n => n.position.y))

            selectedNodes.forEach((node) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: node.position.x, y: maxY }
                })
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignCenterHorizontal = () => {
        executeAlignmentOperation('Center Horizontal', (selectedNodes) => {
            const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length

            selectedNodes.forEach((node) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: avgX, y: node.position.y }
                })
            })

            actions.closeCanvasContextMenu()
        })
    }

    const alignCenterVertical = () => {
        executeAlignmentOperation('Center Vertical', (selectedNodes) => {
            const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length

            selectedNodes.forEach((node) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: node.position.x, y: avgY }
                })
            })

            actions.closeCanvasContextMenu()
        })
    }

    const distributeHorizontal = () => {
        executeAlignmentOperation('Distribute Horizontal', (selectedNodes) => {
            if (selectedNodes.length < 3) return

            // Sort by x position
            const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x)
            const minX = sorted[0].position.x
            const maxX = sorted[sorted.length - 1].position.x
            const spacing = (maxX - minX) / (sorted.length - 1)

            sorted.forEach((node, index) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: minX + (spacing * index), y: node.position.y }
                })
            })

            actions.closeCanvasContextMenu()
        }, 3) // Min 3 nodes
    }

    const distributeVertical = () => {
        executeAlignmentOperation('Distribute Vertical', (selectedNodes) => {
            if (selectedNodes.length < 3) return

            // Sort by y position
            const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y)
            const minY = sorted[0].position.y
            const maxY = sorted[sorted.length - 1].position.y
            const spacing = (maxY - minY) / (sorted.length - 1)

            sorted.forEach((node, index) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: node.position.x, y: minY + (spacing * index) }
                })
            })

            actions.closeCanvasContextMenu()
        }, 3)
    }

    const arrangeInRow = () => {
        executeAlignmentOperation('Arrange in Row', (selectedNodes) => {
            // Sort by current x position
            const sorted = [...selectedNodes].sort((a, b) => a.position.x - b.position.x)

            // Calculate average Y position
            const avgY = sorted.reduce((sum, n) => sum + n.position.y, 0) / sorted.length

            // Find the leftmost X position
            const startX = sorted[0].position.x

            // Standard task node width is 200px, add 40px gap = 240px spacing
            const SPACING = 240

            sorted.forEach((node, index) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: startX + (SPACING * index), y: avgY }
                })
            })

            actions.closeCanvasContextMenu()
        })
    }

    const arrangeInColumn = () => {
        executeAlignmentOperation('Arrange in Column', (selectedNodes) => {
            // Sort by current y position
            const sorted = [...selectedNodes].sort((a, b) => a.position.y - b.position.y)

            // Calculate average X position
            const avgX = sorted.reduce((sum, n) => sum + n.position.x, 0) / sorted.length

            // Find the topmost Y position
            const startY = sorted[0].position.y

            // Standard task node height is 80px, add 40px gap = 120px spacing
            const SPACING = 120

            sorted.forEach((node, index) => {
                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: { x: avgX, y: startY + (SPACING * index) }
                })
            })

            actions.closeCanvasContextMenu()
        })
    }

    const arrangeInGrid = () => {
        executeAlignmentOperation('Arrange in Grid', (selectedNodes) => {
            // Calculate grid dimensions - prefer wider grids
            const count = selectedNodes.length
            const cols = Math.ceil(Math.sqrt(count))

            // Calculate average position as grid center
            const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length
            const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length

            // Spacing constants
            const SPACING_X = 240 // Task width (200) + gap (40)
            const SPACING_Y = 120 // Task height (80) + gap (40)

            // Calculate grid starting position (centered around average position)
            // rows = Math.ceil(count / cols)
            const rows = Math.ceil(count / cols)
            const gridWidth = (cols - 1) * SPACING_X
            const gridHeight = (rows - 1) * SPACING_Y
            const startX = avgX - (gridWidth / 2)
            const startY = avgY - (gridHeight / 2)

            // Arrange nodes in grid
            selectedNodes.forEach((node, index) => {
                const row = Math.floor(index / cols)
                const col = index % cols

                taskStore.updateTaskWithUndo(node.id, {
                    canvasPosition: {
                        x: startX + (col * SPACING_X),
                        y: startY + (row * SPACING_Y)
                    }
                })
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
