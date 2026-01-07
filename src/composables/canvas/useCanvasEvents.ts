import { ref } from 'vue'
import { useVueFlow, type Node } from '@vue-flow/core'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'
// TASK-089: Import position lock check to prevent sync from overwriting user changes
import { isAnyCanvasStateLocked } from '@/utils/canvasStateLock'

export function useCanvasEvents(syncNodes?: () => void) {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    // ✅ DRIFT FIX: Use generic screenToFlowCoordinate
    const { viewport, screenToFlowCoordinate } = useVueFlow()

    // --- Interaction State ---
    const isConnecting = ref(false)

    // --- Context Menu State ---
    const showCanvasContextMenu = ref(false)
    const canvasContextMenuX = ref(0)
    const canvasContextMenuY = ref(0)
    const canvasContextSection = ref<CanvasSection | null>(null)

    const showNodeContextMenu = ref(false)
    const nodeContextMenuX = ref(0)
    const nodeContextMenuY = ref(0)
    const selectedNode = ref<Node | null>(null)

    const showEdgeContextMenu = ref(false)
    const edgeContextMenuX = ref(0)
    const edgeContextMenuY = ref(0)
    const selectedEdgeId = ref<string | null>(null)

    // --- Actions ---

    const closeCanvasContextMenu = () => {
        showCanvasContextMenu.value = false
        canvasContextSection.value = null
    }

    const closeNodeContextMenu = () => {
        showNodeContextMenu.value = false
        selectedNode.value = null
    }

    const closeEdgeContextMenu = () => {
        showEdgeContextMenu.value = false
        selectedEdgeId.value = null
    }

    const closeAllContextMenus = () => {
        closeCanvasContextMenu()
        closeNodeContextMenu()
        closeEdgeContextMenu()
    }

    // --- Event Handlers ---

    const handlePaneClick = (event: MouseEvent) => {
        // BUG-007: Only Ctrl/Cmd+click toggles group selection
        // Shift is reserved for rubber-band drag selection (handled in useCanvasSelection)
        const isMultiSelectClick = event.ctrlKey || event.metaKey

        if (isMultiSelectClick) {
            // ✅ DRIFT FIX: Use Vue Flow native projection
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
        console.log('🖱️ [DEBUG] handleCanvasRightClick fired:', {
            clientX: event.clientX,
            clientY: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            target: (event.target as HTMLElement)?.className,
            eventType: event.type
        })

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
        console.log('🖱️ [DEBUG] handleCanvasRightClick SET coords:', { x: canvasContextMenuX.value, y: canvasContextMenuY.value })
        showCanvasContextMenu.value = true
    }

    const handlePaneContextMenu = (event: MouseEvent) => {
        console.log('🎯 [DEBUG] handlePaneContextMenu fired:', {
            clientX: event.clientX,
            clientY: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            target: (event.target as HTMLElement)?.className,
            eventType: event.type
        })

        if (isConnecting.value) {
            event.preventDefault()
            event.stopPropagation()
            return
        }
        event.preventDefault()
        canvasContextMenuX.value = event.clientX
        canvasContextMenuY.value = event.clientY
        console.log('🎯 [DEBUG] handlePaneContextMenu SET coords:', { x: canvasContextMenuX.value, y: canvasContextMenuY.value })
        showCanvasContextMenu.value = true
    }

    // Drag and Drop (Task -> Canvas)
    const handleDrop = (event: DragEvent) => {
        event.preventDefault()
        const data = event.dataTransfer?.getData('application/json')
        if (!data) return

        try {
            const { taskId } = JSON.parse(data)
            if (!taskId) return

            const vueFlowElement = document.querySelector('.vue-flow') as HTMLElement
            if (!vueFlowElement) return

            const rect = vueFlowElement.getBoundingClientRect()
            // ✅ DRIFT FIX: Use Vue Flow native projection
            const flowCoords = screenToFlowCoordinate({
                x: event.clientX,
                y: event.clientY
            })
            const { x, y } = flowCoords

            taskStore.updateTask(taskId, {
                canvasPosition: { x, y },
                isInInbox: false
            })

            // TASK-089: Guard syncNodes to prevent overwriting locked positions
            if (syncNodes && !isAnyCanvasStateLocked()) {
                syncNodes()
            }

        } catch (e) {
            console.error('Error handling drop:', e)
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
        handleDrop
    }
}
