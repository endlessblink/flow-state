import { ref, nextTick, computed } from 'vue'
import { useVueFlow, type Node, type Edge } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
import { errorHandler, ErrorCategory } from '@/utils/errorHandler'
import { useCanvasContextMenus } from './useCanvasContextMenus'
import { CanvasIds } from '@/utils/canvas/canvasIds'
import { getViewportCoordinates } from '@/utils/contextMenuCoordinates'

export function useCanvasEvents(syncNodes?: () => void) {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const { screenToFlowCoordinate, setNodes, getNodes, findNode } = useVueFlow()

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
        // BUG-1216: DEV-gated — styled console.log fires on every pane click
        if (import.meta.env.DEV) {
            console.log('%c[DEBUG] handlePaneClick FIRED', 'background: red; color: white; font-size: 16px;', {
                clientX: event.clientX,
                clientY: event.clientY,
                target: (event.target as HTMLElement)?.className
            })
        }

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
        // TASK-262 FIX: Vue Flow handles deselection automatically via its internal pane click handling
        // We just need to sync our store and close menus
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

        // BUG-1096: Use normalized coordinates for Tauri compatibility
        const { x, y } = getViewportCoordinates(event)
        canvasContextMenuX.value = x
        canvasContextMenuY.value = y
        showCanvasContextMenu.value = true
    }

    const handlePaneContextMenu = (event: MouseEvent) => {
        if (isConnecting.value) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        event.preventDefault()

        // BUG-228 FIX: Explicitly clear any stale section context
        // so we don't accidentally open a group menu
        canvasContextSection.value = null

        // BUG-1096: Use normalized coordinates for Tauri compatibility
        const { x, y } = getViewportCoordinates(event)
        canvasContextMenuX.value = x
        canvasContextMenuY.value = y
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

    const handleNodeContextMenu = (event: { event: MouseEvent | TouchEvent; node: Node } | MouseEvent | TouchEvent) => {
        let mouseEvent: MouseEvent | TouchEvent
        let node: Node | undefined

        if (event && 'event' in event && 'node' in event) {
            mouseEvent = event.event
            node = event.node
        } else {
            mouseEvent = event as MouseEvent | TouchEvent
        }

        if (!node) return

        // BUG-1096: Use normalized coordinates for Tauri compatibility
        const { x, y } = getViewportCoordinates(mouseEvent)

        mouseEvent.preventDefault()

        // --- ROUTE TO CORRECT MENU ---
        if (node.type === 'taskNode') {
            // Bridge to TaskContextMenu (managed by ModalManager)
            window.dispatchEvent(new CustomEvent('task-context-menu', {
                detail: {
                    event: mouseEvent,
                    task: node.data?.task || { id: node.id }
                }
            }))
            closeAllContextMenus()
        } else if (node.type === 'sectionNode') {
            // Bridge to CanvasContextMenu with Section context
            const { id: sectionId } = CanvasIds.parseNodeId(node.id)
            const section = canvasStore.groups.find(s => s.id === sectionId)

            console.log('[TASK-288-DEBUG] handleNodeContextMenu - storing position for sectionNode', {
                x,
                y,
                sectionId,
                sectionName: section?.name
            })

            canvasContextMenuX.value = x
            canvasContextMenuY.value = y
            canvasContextSection.value = section || null
            showCanvasContextMenu.value = true

            // Close other internal menus
            showNodeContextMenu.value = false
            showEdgeContextMenu.value = false
        } else {
            // Default generic node menu (for any other custom types)
            openNodeContextMenu(x, y, node.id)
        }
    }

    const handleEdgeContextMenu = (event: { event: MouseEvent | TouchEvent; edge: Edge } | MouseEvent | TouchEvent) => {
        let mouseEvent: MouseEvent | TouchEvent
        let edgeId: string | undefined

        if ('event' in event && 'edge' in event) {
            mouseEvent = event.event
            edgeId = event.edge.id
        } else {
            mouseEvent = event as MouseEvent | TouchEvent
        }

        // BUG-1096: Use normalized coordinates for Tauri compatibility
        const { x, y } = getViewportCoordinates(mouseEvent)

        mouseEvent.preventDefault()
        if (edgeId) {
            openEdgeContextMenu(x, y, edgeId)
        }
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
