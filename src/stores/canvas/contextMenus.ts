import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CanvasSection } from '@/stores/canvas/types'

export const useCanvasContextMenuStore = defineStore('canvasContextMenu', () => {
    // Canvas Context Menu
    const showCanvasContextMenu = ref(false)
    const canvasContextMenuX = ref(0)
    const canvasContextMenuY = ref(0)
    const canvasContextSection = ref<CanvasSection | null>(null)

    // Node Context Menu
    const showNodeContextMenu = ref(false)
    const nodeContextMenuX = ref(0)
    const nodeContextMenuY = ref(0)
    const selectedNodeId = ref<string | null>(null)

    // Edge Context Menu
    const showEdgeContextMenu = ref(false)
    const edgeContextMenuX = ref(0)
    const edgeContextMenuY = ref(0)
    const selectedEdgeId = ref<string | null>(null)

    // Actions
    const openCanvasContextMenu = (x: number, y: number, section: CanvasSection | null = null) => {
        canvasContextMenuX.value = x
        canvasContextMenuY.value = y
        canvasContextSection.value = section
        showCanvasContextMenu.value = true
    }
    const closeCanvasContextMenu = () => {
        showCanvasContextMenu.value = false
    }

    const openNodeContextMenu = (x: number, y: number, nodeId: string) => {
        nodeContextMenuX.value = x
        nodeContextMenuY.value = y
        selectedNodeId.value = nodeId
        showNodeContextMenu.value = true
    }
    const closeNodeContextMenu = () => {
        showNodeContextMenu.value = false
        selectedNodeId.value = null
    }

    const openEdgeContextMenu = (x: number, y: number, edgeId: string) => {
        edgeContextMenuX.value = x
        edgeContextMenuY.value = y
        selectedEdgeId.value = edgeId
        showEdgeContextMenu.value = true
    }
    const closeEdgeContextMenu = () => {
        showEdgeContextMenu.value = false
        selectedEdgeId.value = null
    }

    return {
        showCanvasContextMenu, canvasContextMenuX, canvasContextMenuY, canvasContextSection,
        showNodeContextMenu, nodeContextMenuX, nodeContextMenuY, selectedNodeId,
        showEdgeContextMenu, edgeContextMenuX, edgeContextMenuY, selectedEdgeId,

        openCanvasContextMenu, closeCanvasContextMenu,
        openNodeContextMenu, closeNodeContextMenu,
        openEdgeContextMenu, closeEdgeContextMenu
    }
})
