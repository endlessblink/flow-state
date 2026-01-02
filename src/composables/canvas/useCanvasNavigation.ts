import { computed } from 'vue'
import { useVueFlow, type Node } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { storeToRefs } from 'pinia'

export function useCanvasNavigation() {
    const { fitView: vueFlowFitView, getNodes } = useVueFlow()
    const canvasStore = useCanvasStore()
    const { viewport } = storeToRefs(canvasStore)

    // BUG-052: Initial viewport from saved state
    const initialViewport = computed(() => ({
        x: viewport.value.x,
        y: viewport.value.y,
        zoom: viewport.value.zoom
    }))

    const zoomToSelection = () => {
        // Get selected nodes from store/VueFlow
        const selectedIds = canvasStore.selectedNodeIds
        if (!selectedIds || selectedIds.length === 0) return

        const nodes = getNodes.value
        const selectedNodes = nodes.filter(n => selectedIds.includes(n.id))

        if (selectedNodes.length === 0) return

        // Calculate bounding box
        const xs = selectedNodes.map(n => n.position.x)
        const ys = selectedNodes.map(n => n.position.y)
        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        // Approximate dimensions since actual dimensions might vary
        // Ideally we'd use node.dimensions if measured, but position is improved
        const maxX = Math.max(...xs) + 220
        const maxY = Math.max(...ys) + 100

        vueFlowFitView({
            nodes: selectedIds,
            padding: 0.3,
            duration: 300
        })
    }

    const fitCanvas = () => {
        vueFlowFitView({ padding: 0.2, duration: 300 })
    }

    return {
        initialViewport,
        zoomToSelection,
        fitCanvas
    }
}
