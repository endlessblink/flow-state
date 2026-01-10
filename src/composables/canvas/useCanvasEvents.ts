import { ref, nextTick, computed } from 'vue'
import { useVueFlow, type Node } from '@vue-flow/core'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { isAnyCanvasStateLocked } from '@/utils/canvasStateLock'
import { errorHandler, ErrorCategory } from '@/utils/errorHandler'
import { useCanvasContextMenus } from './useCanvasContextMenus'

export function useCanvasEvents(syncNodes?: () => void) {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const { viewport, screenToFlowCoordinate, setNodes, getNodes, updateNode, findNode } = useVueFlow()

    // --- Interaction State ---
    const isConnecting = ref(false)

    // --- Context Menu State (Singleton) ---
    const {
        showCanvasContextMenu,
        canvasContextMenuX,
        canvasContextMenuY,
        canvasContextSection,
        showNodeContextMenu,
        nodeContextMenuX,
        nodeContextMenuY,
        nodeContextMenuNodeId, // Singleton ID
        showEdgeContextMenu,
        edgeContextMenuX,
        edgeContextMenuY,
        edgeContextMenuEdgeId, // Singleton ID
        openNodeContextMenu,
        openEdgeContextMenu,
        closeCanvasContextMenu,
        closeNodeContextMenu,
        closeEdgeContextMenu,
        closeAllContextMenus
    } = useCanvasContextMenus()

    // Compatibility: Map IDs to Objects for legacy consumers
    const selectedNode = computed(() => {
        if (!nodeContextMenuNodeId.value) return null
        return findNode(nodeContextMenuNodeId.value) || null
    })

    const selectedEdgeId = computed(() => edgeContextMenuEdgeId.value)

    /* Actions are now provided by singleton */

    // --- Event Handlers ---

    const handlePaneClick = (event: MouseEvent) => {
        // Only Ctrl/Cmd+click toggles group selection
        // Shift is reserved for rubber-band drag selection (handled in useCanvasSelection)
        const isMultiSelectClick = event.ctrlKey || event.metaKey

        if (isMultiSelectClick) {
            const { x, y } = screenToFlowCoordinate({
                x: event.clientX,
                y: event.clientY
            })

            // Find all groups that contain this point
            const hitGroups = canvasStore.groups.filter(group => {
                const gx = group.position.x
                const gy = group.position.y
                const gw = group.position.width
                const gh = group.position.height
                return x >= gx && x <= gx + gw && y >= gy && y <= gy + gh
            })

            if (hitGroups.length > 0) {
                // If multiple groups (nested), pick the smallest one (likely the child)
                hitGroups.sort((a, b) => (a.position.width * a.position.height) - (b.position.width * b.position.height))

                const targetGroup = hitGroups[0]
                canvasStore.toggleNodeSelection(targetGroup.id)

                // Don't clear selection or close menus if we hit a group
                return
            }

            // If we clicked empty space with modifier, preserve selection
            closeAllContextMenus()
            return
        }

        // Regular click on empty pane - clear selection
        canvasStore.setSelectedNodes([])
        closeAllContextMenus()
    }

    const handleCanvasRightClick = (event: MouseEvent) => {
        if (isConnecting.value) {
            event.preventDefault()
            event.stopPropagation()
            return
        }

        const target = event.target as HTMLElement
        // Don't show menu if clicking on a task or section node
        if (target.closest('.task-node') || target.closest('[data-id^="section-"]')) {
            return
        }

        canvasContextMenuX.value = event.clientX
        canvasContextMenuY.value = event.clientY
        showCanvasContextMenu.value = true
    }

    const handlePaneContextMenu = (event: MouseEvent) => {
        if (isConnecting.value) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        event.preventDefault()
        canvasContextMenuX.value = event.clientX
        canvasContextMenuY.value = event.clientY
        showCanvasContextMenu.value = true
    }

    // Drag and Drop (Task -> Canvas)
    const handleDrop = async (event: DragEvent) => {
        event.preventDefault()
        const data = event.dataTransfer?.getData('application/json')
        if (!data) return

        try {
            const { taskId } = JSON.parse(data)
            if (!taskId) return

            const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
            if (!vueFlowElement) return

            const flowCoords = screenToFlowCoordinate({
                x: event.clientX,
                y: event.clientY
            })
            const { x, y } = flowCoords


            // AWAIT the task update before calling syncNodes
            // Otherwise syncNodes runs with stale task data
            await taskStore.updateTask(taskId, {
                canvasPosition: { x, y },
                isInInbox: false
            })

            if (syncNodes) syncNodes()

            // Wait for Vue reactivity to propagate before syncing
            // filteredTasks is a computed that needs time to recalculate
            await nextTick()

            // Call syncNodes to build the node array with parent-child relationships
            if (syncNodes) {
                syncNodes()
            }

            // Wait for v-model to sync nodes.value to Vue Flow's internal state
            // BEFORE reading getNodes.value. Without this tick, getNodes returns STALE state.
            await nextTick()

            // CRITICAL - Use setNodes() to force Vue Flow to reinitialize
            // Direct array mutation doesn't trigger Vue Flow's complete initialization sequence
            // setNodes() ensures parent-child relationships are properly discovered
            const currentNodes = getNodes.value
            setNodes(currentNodes)

            // Double nextTick() for Vue Flow parent-child discovery
            await nextTick()
            await nextTick()

        } catch (error) {
            errorHandler.report({
                error: error as Error,
                category: ErrorCategory.CANVAS,
                message: 'Error in handleDrop',
                userMessage: 'Failed to drop task on canvas'
            })
        }
    }

    const handleNodeContextMenu = (event: { event: MouseEvent; node: Node } | MouseEvent) => {
        const mouseEvent = ((event as any).event || event) as MouseEvent
        mouseEvent.preventDefault()
        const node = (event as any).node || event
        if (!node?.id) return
        openNodeContextMenu(mouseEvent.clientX, mouseEvent.clientY, node.id)
    }

    const handleEdgeContextMenu = (event: { event: MouseEvent; edge: any } | MouseEvent) => {
        const mouseEvent = ((event as any).event || event) as MouseEvent
        mouseEvent.preventDefault()
        const edge = (event as any).edge || event
        if (!edge?.id) return
        openEdgeContextMenu(mouseEvent.clientX, mouseEvent.clientY, edge.id)
    }

    return {
        // State
        isConnecting,
        showCanvasContextMenu,
        canvasContextMenuX,
        canvasContextMenuY,
        canvasContextSection,
        showNodeContextMenu,
        nodeContextMenuX,
        nodeContextMenuY,
        selectedNode,
        showEdgeContextMenu,
        edgeContextMenuX,
        edgeContextMenuY,
        selectedEdgeId,

        // Actions
        closeCanvasContextMenu,
        closeNodeContextMenu,
        closeEdgeContextMenu,
        closeAllContextMenus,

        // Handlers
        handlePaneClick,
        handleCanvasRightClick,
        handlePaneContextMenu,
        handleNodeContextMenu,
        handleEdgeContextMenu,
        handleDrop
    }
}
