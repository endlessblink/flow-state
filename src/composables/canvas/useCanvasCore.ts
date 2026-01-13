import { onBeforeUnmount } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { storeToRefs } from 'pinia'

/**
 * useCanvasCore
 *
 * The foundational composable for the Canvas system.
 * consolidates:
 * - Vue Flow instance access
 * - Viewport management (zoom, pan, fit view)
 * - Basic Node/Edge state access
 * - Core lifecycle hooks
 */
export function useCanvasCore() {
    const {
        nodes,
        edges,
        addNodes,
        removeNodes,
        addEdges,
        removeEdges,
        setNodes,
        setEdges,
        findNode,
        getNodes,
        toObject,
        setViewport,
        getViewport,
        fitView: vueFlowFitView,
        zoomIn: vueFlowZoomIn,
        zoomTo: vueFlowZoomTo,
        onInit,
        onPaneReady,
        onNodeDragStart,
        onNodeDrag,
        onNodeDragStop,
        updateNode,
        screenToFlowCoordinate,
        project,
        getIntersectingNodes,
        isNodeIntersecting,
        onMoveEnd,
        onConnect,
        onEdgesChange,
        onNodesChange,
        applyNodeChanges,
        applyEdgeChanges,
        panOnDrag
    } = useVueFlow()

    const canvasStore = useCanvasStore()
    const { zoomConfig, viewport: storeViewport } = storeToRefs(canvasStore)

    // --- Viewport & Zoom Logic (Consolidated from useCanvasZoom/Navigation) ---

    // Performance throttling for zoom operations
    const zoomPerformanceManager = {
        animationFrameId: null as number | null,
        pendingOperations: [] as Array<() => void>,
        lastZoomTime: 0,
        zoomThrottleMs: 16, // ~60fps

        shouldThrottleZoom(): boolean {
            const now = performance.now()
            if (now - this.lastZoomTime < this.zoomThrottleMs) {
                return true
            }
            this.lastZoomTime = now
            return false
        },

        scheduleOperation(operation: () => void) {
            this.pendingOperations.push(operation)

            if (!this.animationFrameId) {
                this.animationFrameId = requestAnimationFrame(() => {
                    this.flushOperations()
                })
            }
        },

        flushOperations() {
            this.pendingOperations.forEach(operation => operation())
            this.pendingOperations.length = 0
            this.animationFrameId = null
        },

        cleanup() {
            if (this.animationFrameId) {
                cancelAnimationFrame(this.animationFrameId)
                this.animationFrameId = null
            }
            this.pendingOperations.length = 0
        }
    }

    const fitView = (options: { padding?: number, duration?: number, nodes?: string[] } = {}) => {
        vueFlowFitView({ padding: options.padding ?? 0.2, duration: options.duration ?? 300, nodes: options.nodes })
    }

    const zoomIn = () => {
        if (zoomPerformanceManager.shouldThrottleZoom()) return
        zoomPerformanceManager.scheduleOperation(() => {
            vueFlowZoomIn({ duration: 200 })
        })
    }

    const zoomOut = () => {
        if (zoomPerformanceManager.shouldThrottleZoom()) return
        zoomPerformanceManager.scheduleOperation(() => {
            // Respect min zoom
            const currentZoom = getViewport().zoom
            const newZoom = Math.max(zoomConfig.value.minZoom, currentZoom - 0.1)
            vueFlowZoomTo(newZoom, { duration: 200 })
        })
    }

    const zoomToSelection = () => {
        const selectedIds = canvasStore.selectedNodeIds
        if (!selectedIds || selectedIds.length === 0) return

        const currentNodes = getNodes.value
        // Filter nodes that are actually on canvas
        const selectedNodes = currentNodes.filter(n => selectedIds.includes(n.id))

        if (selectedNodes.length === 0) return

        fitView({ nodes: selectedIds, padding: 0.3 })
    }

    // Cleanup on unmount
    onBeforeUnmount(() => {
        zoomPerformanceManager.cleanup()
    })

    return {
        // Vue Flow State
        nodes,
        edges,

        // Basic Operations
        addNodes,
        removeNodes,
        setNodes,
        addEdges,
        removeEdges,
        setEdges,
        findNode,
        getNodes,
        updateNode,
        toObject,

        // Coordinate Helpers
        screenToFlowCoordinate,
        project,
        getIntersectingNodes,
        isNodeIntersecting,

        // Viewport & Zoom
        viewport: storeViewport,
        setViewport,
        getViewport,
        fitView,
        zoomIn,
        zoomOut,
        zoomTo: vueFlowZoomTo,
        zoomToSelection,
        panOnDrag,

        // Lifecycle
        onInit,
        onPaneReady,

        // Events
        onMoveEnd,
        onConnect,
        onEdgesChange,
        onNodesChange,
        applyNodeChanges,
        applyEdgeChanges,

        // Drag Events (Exposed for useCanvasDrag)
        onNodeDragStart,
        onNodeDrag,
        onNodeDragStop
    }
}
