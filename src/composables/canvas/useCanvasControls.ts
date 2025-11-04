import { ref, computed } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { useCanvasStore } from '@/stores/canvas'

/**
 * Canvas Controls State Management Composable
 *
 * Extracted from CanvasView.vue to centralize all canvas control state
 * and provide a clean interface for canvas control operations.
 *
 * This composable manages:
 * - Zoom controls (zoom in, zoom out, reset, fit to content)
 * - Viewport controls (fit view, center canvas)
 * - Zoom presets and dropdown state
 * - Performance-optimized zoom operations
 * - Zoom limit enforcement
 */

export interface ZoomPreset {
  label: string
  value: number
  description?: string
}

export interface ZoomPerformanceManager {
  animationFrameId: number | null
  pendingOperations: Array<() => void>
  lastZoomTime: number
  zoomThrottleMs: number
}

export function useCanvasControls() {
  const canvasStore = useCanvasStore()
  const {
    fitView: vueFlowFitView,
    zoomIn: vueFlowZoomIn,
    zoomOut: vueFlowZoomOut,
    zoomTo: vueFlowZoomTo,
    viewport
  } = useVueFlow()

  // Zoom dropdown state
  const showZoomDropdown = ref(false)

  // Zoom presets configuration
  const zoomPresets: ZoomPreset[] = [
    { label: '5%', value: 0.05, description: 'Extreme overview' },
    { label: '10%', value: 0.1, description: 'Very far out' },
    { label: '25%', value: 0.25, description: 'Far out' },
    { label: '50%', value: 0.5, description: 'Zoomed out' },
    { label: '75%', value: 0.75, description: 'Slightly out' },
    { label: '100%', value: 1.0, description: 'Actual size' },
    { label: '125%', value: 1.25, description: 'Slightly in' },
    { label: '150%', value: 1.5, description: 'Zoomed in' },
    { label: '200%', value: 2.0, description: 'Close up' },
    { label: '300%', value: 3.0, description: 'Very close' },
    { label: '400%', value: 4.0, description: 'Maximum zoom' }
  ]

  // Performance optimization: Zoom throttling and batching
  const zoomPerformanceManager: ZoomPerformanceManager = {
    animationFrameId: null,
    pendingOperations: [],
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

  // Main zoom controls
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
      let newZoom = Math.max(canvasStore.zoomConfig.minZoom, currentZoom - 0.1)

      console.log(`[Zoom Debug] Zoom out: ${currentZoom} -> ${newZoom}`)
      console.log(`[Zoom Debug] Min zoom allowed: ${canvasStore.zoomConfig.minZoom}`)

      // Force Vue Flow to respect our zoom limits by explicitly setting min zoom first
      const { setMinZoom } = useVueFlow()
      if (setMinZoom) {
        setMinZoom(canvasStore.zoomConfig.minZoom)
        console.log(`[Zoom Debug] Forcefully set minZoom to ${canvasStore.zoomConfig.minZoom}`)
      }

      // Use vueFlowZoomTo instead of vueFlowZoomOut to ensure we respect minZoom
      vueFlowZoomTo(newZoom, { duration: 200 })

      // Double-check that zoom was actually applied and enforce if needed
      setTimeout(() => {
        const actualZoom = viewport.value.zoom
        if (actualZoom > newZoom && Math.abs(actualZoom - newZoom) > 0.01) {
          console.log(`[Zoom Debug] Vue Flow ignored zoom request, forcing again: ${actualZoom} -> ${newZoom}`)
          vueFlowZoomTo(newZoom, { duration: 0 })
        }
      }, 250)
    })
  }

  // Zoom control functions
  const toggleZoomDropdown = () => {
    showZoomDropdown.value = !showZoomDropdown.value
  }

  const closeZoomDropdown = () => {
    showZoomDropdown.value = false
  }

  const applyZoomPreset = (zoomLevel: number) => {
    // Validate zoom level is within bounds
    const validatedZoom = Math.max(
      canvasStore.zoomConfig.minZoom,
      Math.min(canvasStore.zoomConfig.maxZoom, zoomLevel)
    )

    console.log(`[Zoom Debug] Applying preset: ${zoomLevel} (validated: ${validatedZoom})`)
    console.log(`[Zoom Debug] Min zoom allowed: ${canvasStore.zoomConfig.minZoom}`)

    zoomPerformanceManager.scheduleOperation(() => {
      // Force Vue Flow to respect our zoom limits for presets too
      const { setMinZoom, setMaxZoom } = useVueFlow()
      if (setMinZoom && setMaxZoom) {
        setMinZoom(canvasStore.zoomConfig.minZoom)
        setMaxZoom(canvasStore.zoomConfig.maxZoom)
        console.log(`[Zoom Debug] Forcefully set zoom limits: ${canvasStore.zoomConfig.minZoom} - ${canvasStore.zoomConfig.maxZoom}`)
      }

      vueFlowZoomTo(validatedZoom, { duration: 300 })
      canvasStore.setViewportWithHistory(viewport.value.x, viewport.value.y, validatedZoom)

      // Double-check that zoom was actually applied for critical presets
      if (validatedZoom <= 0.1) { // For 5% and 10% presets
        setTimeout(() => {
          const actualZoom = viewport.value.zoom
          if (actualZoom > validatedZoom && Math.abs(actualZoom - validatedZoom) > 0.01) {
            console.log(`[Zoom Debug] Vue Flow ignored preset zoom, forcing again: ${actualZoom} -> ${validatedZoom}`)
            vueFlowZoomTo(validatedZoom, { duration: 0 })
          }
        }, 350)
      }
    })
    showZoomDropdown.value = false
  }

  const resetZoom = () => {
    vueFlowZoomTo(1.0, { duration: 300 })
    canvasStore.setViewportWithHistory(viewport.value.x, viewport.value.y, 1.0)
    showZoomDropdown.value = false
  }

  const fitToContent = () => {
    // This function would need access to taskStore, so we'll keep it in CanvasView for now
    // or modify it to work differently when extracted
    console.log('🔧 CanvasControls: fitToContent needs access to task store')
  }

  // Advanced zoom controls
  const zoomTo = (level: number, options?: { duration?: number }) => {
    const validatedZoom = Math.max(
      canvasStore.zoomConfig.minZoom,
      Math.min(canvasStore.zoomConfig.maxZoom, level)
    )

    vueFlowZoomTo(validatedZoom, { duration: options?.duration || 300 })
    canvasStore.setViewportWithHistory(viewport.value.x, viewport.value.y, validatedZoom)
  }

  const centerCanvas = () => {
    vueFlowFitView({ padding: 0.2, duration: 300 })
  }

  // Utility functions
  const enforceZoomLimits = () => {
    const { setMinZoom, setMaxZoom } = useVueFlow()
    if (setMinZoom && setMaxZoom) {
      setMinZoom(canvasStore.zoomConfig.minZoom)
      setMaxZoom(canvasStore.zoomConfig.maxZoom)
      console.log(`[Zoom Debug] Enforced zoom limits: ${canvasStore.zoomConfig.minZoom} - ${canvasStore.zoomConfig.maxZoom}`)
    }

    // Verify current zoom is within bounds
    const currentZoom = viewport.value.zoom
    if (currentZoom < canvasStore.zoomConfig.minZoom || currentZoom > canvasStore.zoomConfig.maxZoom) {
      console.log(`[Zoom Debug] Current zoom ${currentZoom} out of bounds, resetting to 100%`)
      resetZoom()
    }
  }

  // Computed properties
  const currentZoomLevel = computed(() => viewport.value.zoom)
  const isZoomAtMin = computed(() => viewport.value.zoom <= canvasStore.zoomConfig.minZoom)
  const isZoomAtMax = computed(() => viewport.value.zoom >= canvasStore.zoomConfig.maxZoom)
  const zoomPercentage = computed(() => Math.round(viewport.value.zoom * 100))

  // Keyboard shortcuts handler
  const handleKeyboardShortcuts = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (target) {
      const tagName = target.tagName
      const isEditableTarget = tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable
      if (isEditableTarget) {
        return // Let the input handle the key normally
      }
    }

    // Handle zoom shortcuts with Ctrl/Cmd modifier
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case '0':
          event.preventDefault()
          resetZoom()
          return
        case '1':
          event.preventDefault()
          applyZoomPreset(1.0)
          return
        case '2':
          event.preventDefault()
          applyZoomPreset(2.0)
          return
        case '=':
        case '+':
          event.preventDefault()
          zoomIn()
          return
        case '-':
        case '_':
          event.preventDefault()
          zoomOut()
          return
        case 'f':
        case 'F':
          event.preventDefault()
          // fitToContent() needs task store access, so we can't include it here
          console.log('🔧 CanvasControls: fitToContent shortcut needs task store access')
          return
      }
    }

    // Handle fit view shortcut (F without Ctrl)
    if (event.key === 'f' || event.key === 'F') {
      event.preventDefault()
      fitView()
      return
    }
  }

  // Cleanup function
  const cleanup = () => {
    zoomPerformanceManager.cleanup()
  }

  return {
    // State
    showZoomDropdown,
    zoomPresets,
    currentZoomLevel,
    isZoomAtMin,
    isZoomAtMax,
    zoomPercentage,

    // Basic zoom controls
    fitView,
    zoomIn,
    zoomOut,
    resetZoom,
    fitToContent,
    centerCanvas,

    // Advanced zoom controls
    zoomTo,
    applyZoomPreset,
    toggleZoomDropdown,
    closeZoomDropdown,

    // Keyboard shortcuts
    handleKeyboardShortcuts,

    // Utility functions
    enforceZoomLimits,

    // Performance management
    cleanup,

    // Performance manager access (for advanced usage)
    zoomPerformanceManager
  }
}