import { ref } from 'vue'
import type { Task } from '../tasks'

export function useZoom() {
    // Viewport state
    const viewport = ref({
        x: 0,
        y: 0,
        zoom: 1
    })

    // Zoom configuration
    const zoomConfig = ref({
        minZoom: 0.05, // 5% minimum zoom (down from 10%)
        maxZoom: 4.0,  // 400% maximum zoom (up from 200%)
        fitToContentPadding: 0.15, // 15% padding around content
        zoomStep: 0.1, // 10% zoom steps
        wheelSensitivity: 1.0, // Mouse wheel sensitivity multiplier
        invertWheel: false, // Invert wheel direction for zoom
        wheelZoomMode: 'zoom' as 'zoom' | 'pan' // Mode for wheel behavior
    })

    // Zoom history for undo/redo functionality
    const zoomHistory = ref<Array<{ zoom: number, timestamp: number }>>([])
    const maxZoomHistory = 50 // Maximum history entries to keep

    // Actions
    const setViewport = (x: number, y: number, zoom: number) => {
        viewport.value = { x, y, zoom }
    }

    // Zoom management functions
    const saveZoomToHistory = (zoom: number) => {
        const entry = { zoom, timestamp: Date.now() }
        zoomHistory.value.push(entry)

        // Limit history size
        if (zoomHistory.value.length > maxZoomHistory) {
            zoomHistory.value.shift()
        }
    }

    const setViewportWithHistory = (x: number, y: number, zoom: number) => {
        saveZoomToHistory(zoom)
        setViewport(x, y, zoom)
    }

    const updateZoomConfig = (config: Partial<typeof zoomConfig.value>) => {
        zoomConfig.value = { ...zoomConfig.value, ...config }
    }

    // Content bounds calculation for dynamic zoom limits
    const calculateContentBounds = (tasks: Task[]) => {
        if (!tasks.length) {
            return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

        tasks.forEach(task => {
            if (task.canvasPosition) {
                const taskWidth = 220
                const taskHeight = 100
                minX = Math.min(minX, task.canvasPosition.x)
                minY = Math.min(minY, task.canvasPosition.y)
                maxX = Math.max(maxX, task.canvasPosition.x + taskWidth)
                maxY = Math.max(maxY, task.canvasPosition.y + taskHeight)
            }
        })

        // Add padding
        const padding = 100
        return {
            minX: minX - padding,
            minY: minY - padding,
            maxX: maxX + padding,
            maxY: maxY + padding
        }
    }

    // Calculate dynamic minimum zoom based on content bounds
    const calculateDynamicMinZoom = (contentBounds: ReturnType<typeof calculateContentBounds>, viewportWidth: number, viewportHeight: number) => {
        const contentWidth = contentBounds.maxX - contentBounds.minX
        const contentHeight = contentBounds.maxY - contentBounds.minY

        if (contentWidth === 0 || contentHeight === 0) return zoomConfig.value.minZoom

        const zoomX = viewportWidth / contentWidth
        const zoomY = viewportHeight / contentHeight

        // Return the smaller zoom to fit content, but respect configured minimum
        return Math.max(zoomConfig.value.minZoom, Math.min(zoomX, zoomY) * (1 - zoomConfig.value.fitToContentPadding))
    }

    return {
        viewport,
        zoomConfig,
        zoomHistory,
        setViewport,
        saveZoomToHistory,
        setViewportWithHistory,
        updateZoomConfig,
        calculateContentBounds,
        calculateDynamicMinZoom
    }
}
