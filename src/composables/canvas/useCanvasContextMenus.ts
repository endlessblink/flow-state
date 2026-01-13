import { storeToRefs } from 'pinia'
import { useCanvasContextMenuStore } from '@/stores/canvas/contextMenus'


export function useCanvasContextMenus() {
    const store = useCanvasContextMenuStore()
    const {
        showCanvasContextMenu,
        canvasContextMenuX,
        canvasContextMenuY,
        canvasContextSection,
        showNodeContextMenu,
        nodeContextMenuX,
        nodeContextMenuY,
        selectedNodeId,
        showEdgeContextMenu,
        edgeContextMenuX,
        edgeContextMenuY,
        selectedEdgeId
    } = storeToRefs(store)

    const {
        openCanvasContextMenu,
        closeCanvasContextMenu,
        openNodeContextMenu,
        closeNodeContextMenu,
        openEdgeContextMenu,
        closeEdgeContextMenu
    } = store

    const closeAllContextMenus = () => {
        store.closeCanvasContextMenu()
        store.closeNodeContextMenu()
        store.closeEdgeContextMenu()
    }

    return {
        // State (mapped to legacy names where needed)
        showCanvasContextMenu,
        canvasContextMenuX,
        canvasContextMenuY,
        canvasContextSection,

        showNodeContextMenu,
        nodeContextMenuX,
        nodeContextMenuY,
        nodeContextMenuNodeId: selectedNodeId, // Alias for legacy compatibility

        showEdgeContextMenu,
        edgeContextMenuX,
        edgeContextMenuY,
        edgeContextMenuEdgeId: selectedEdgeId, // Alias for legacy compatibility

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
