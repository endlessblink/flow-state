import { useVueFlow, type Node } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'
import { storeToRefs } from 'pinia'
import { CANVAS } from '@/constants/canvas'

interface ResourceManager {
    addTimer(id: number): number
}

export function useCanvasZoom(resourceManager: ResourceManager) {
    const {
        fitView: vueFlowFitView,
        zoomIn: vueFlowZoomIn,
        zoomTo: vueFlowZoomTo,
        viewport,
        setMinZoom
    } = useVueFlow()

    const canvasStore = useCanvasStore()
    const { zoomConfig } = storeToRefs(canvasStore)

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
            // Process all pending operations in batch
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

    // Performance optimized viewport culling for extreme zoom levels
    const shouldCullNode = (node: Node, currentZoom: number): boolean => {
        // Cull nodes when zoom is extremely low to improve performance
        if (currentZoom < 0.1) { // Below 10% zoom
            // Only show visible nodes in viewport or important nodes
            const viewportBounds = {
                x: -viewport.value.x / currentZoom,
                y: -viewport.value.y / currentZoom,
                width: window.innerWidth / currentZoom,
                height: window.innerHeight / currentZoom
            }

            const nodeBounds = {
                x: node.position.x,
                y: node.position.y,
                width: CANVAS.DEFAULT_TASK_WIDTH,
                height: CANVAS.DEFAULT_TASK_HEIGHT
            }

            // Check if node is in viewport
            const inViewport = !(
                nodeBounds.x > viewportBounds.x + viewportBounds.width ||
                nodeBounds.x + nodeBounds.width < viewportBounds.x ||
                nodeBounds.y > viewportBounds.y + viewportBounds.height ||
                nodeBounds.y + nodeBounds.height < viewportBounds.y
            )

            return !inViewport
        }
        return false
    }

    const fitView = () => {
        vueFlowFitView({ padding: 0.2, duration: 300 })
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
            const currentZoom = viewport.value.zoom
            const newZoom = Math.max(zoomConfig.value.minZoom, currentZoom - 0.1)


            // Force Vue Flow to respect our zoom limits by explicitly setting min zoom first
            if (setMinZoom) {
                setMinZoom(zoomConfig.value.minZoom)
            }

            // Use vueFlowZoomTo instead of vueFlowZoomOut to ensure we respect minZoom
            vueFlowZoomTo(newZoom, { duration: 200 })

            // Double-check that zoom was actually applied and enforce if needed - using resourceManager
            const timerId = setTimeout(() => {
                const actualZoom = viewport.value.zoom
                if (actualZoom > newZoom && Math.abs(actualZoom - newZoom) > 0.01) {
                    vueFlowZoomTo(newZoom, { duration: 0 })
                }
            }, 250)
            resourceManager.addTimer(timerId as unknown as number)
        })
    }

    const cleanupZoom = () => {
        zoomPerformanceManager.cleanup()
    }

    return {
        fitView,
        zoomIn,
        zoomOut,
        shouldCullNode,
        cleanupZoom
    }
}
