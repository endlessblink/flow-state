import { ref } from 'vue'
import { useVueFlow, type Node } from '@vue-flow/core'
import { useCanvasStore, type CanvasSection } from '@/stores/canvas'
import { useTaskStore } from '@/stores/tasks'

export function useCanvasEvents(syncNodes?: () => void) {
    const canvasStore = useCanvasStore()
    const taskStore = useTaskStore()
    const { viewport, project } = useVueFlow() // project() is better than manual calc if available, but staying safe with viewport for now logic

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

    const handlePaneClick = () => {
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
            // Manual projection since we need absolute page coords
            const x = (event.clientX - rect.left - (viewport.value?.x || 0)) / (viewport.value?.zoom || 1)
            const y = (event.clientY - rect.top - (viewport.value?.y || 0)) / (viewport.value?.zoom || 1)

            taskStore.updateTask(taskId, {
                canvasPosition: { x, y },
                isInInbox: false
            })

            if (syncNodes) {
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
