import { ref } from 'vue'
import type { CanvasSection } from '@/stores/canvas'

// Global State (Singleton)
const showCanvasContextMenu = ref(false)
const canvasContextMenuX = ref(0)
const canvasContextMenuY = ref(0)
const canvasContextSection = ref<CanvasSection | undefined>(undefined)

const showNodeContextMenu = ref(false)
const nodeContextMenuX = ref(0)
const nodeContextMenuY = ref(0)
const nodeContextMenuNodeId = ref<string>('')

const showEdgeContextMenu = ref(false)
const edgeContextMenuX = ref(0)
const edgeContextMenuY = ref(0)
const edgeContextMenuEdgeId = ref<string>('')

export function useCanvasContextMenus() {

    const openCanvasContextMenu = (x: number, y: number, section?: CanvasSection) => {
        // Close others
        closeAllContextMenus()

        canvasContextMenuX.value = x
        canvasContextMenuY.value = y
        canvasContextSection.value = section
        showCanvasContextMenu.value = true
    }

    const closeCanvasContextMenu = () => {
        showCanvasContextMenu.value = false
        canvasContextSection.value = undefined
    }

    const openNodeContextMenu = (x: number, y: number, nodeId: string) => {
        // Close others
        closeAllContextMenus()

        nodeContextMenuX.value = x
        nodeContextMenuY.value = y
        nodeContextMenuNodeId.value = nodeId
        showNodeContextMenu.value = true
    }

    const closeNodeContextMenu = () => {
        showNodeContextMenu.value = false
        nodeContextMenuNodeId.value = ''
    }

    const openEdgeContextMenu = (x: number, y: number, edgeId: string) => {
        // Close others
        closeAllContextMenus()

        edgeContextMenuX.value = x
        edgeContextMenuY.value = y
        edgeContextMenuEdgeId.value = edgeId
        showEdgeContextMenu.value = true
    }

    const closeEdgeContextMenu = () => {
        showEdgeContextMenu.value = false
        edgeContextMenuEdgeId.value = ''
    }

    const closeAllContextMenus = () => {
        showCanvasContextMenu.value = false
        showNodeContextMenu.value = false
        showEdgeContextMenu.value = false
    }

    return {
        // State
        showCanvasContextMenu,
        canvasContextMenuX,
        canvasContextMenuY,
        canvasContextSection,
        showNodeContextMenu,
        nodeContextMenuX,
        nodeContextMenuY,
        nodeContextMenuNodeId,
        showEdgeContextMenu,
        edgeContextMenuX,
        edgeContextMenuY,
        edgeContextMenuEdgeId,

        // Actions
        openCanvasContextMenu,
        closeCanvasContextMenu,
        openNodeContextMenu,
        closeNodeContextMenu,
        openEdgeContextMenu,
        closeEdgeContextMenu,
        closeAllContextMenus
    }
}
