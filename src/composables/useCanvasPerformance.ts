/**
 * useCanvasPerformance Composable
 * Extracted from CanvasView.vue lines 2356-2396 and related functions
 * Provides performance optimization utilities for canvas operations
 */
import { ref, onBeforeUnmount } from 'vue'
import type { Node } from '@vue-flow/core'

interface PerformanceManager {
  animationFrameId: number | null
  pendingOperations: Array<() => void>
  lastZoomTime: number
  zoomThrottleMs: number
  shouldThrottleZoom(): boolean
  scheduleOperation(operation: () => void): void
  flushOperations(): void
  cleanup(): void
}

interface ViewportBounds {
  x: number
  y: number
  width: number
  height: number
}

export function useCanvasPerformance() {
  // Performance optimization: Zoom throttling and batching
  const performanceManager: PerformanceManager = {
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

  // Performance optimized viewport culling for extreme zoom levels
  const shouldCullNode = (node: Node, currentZoom: number, viewport: { x: number; y: number }): boolean => {
    // Cull nodes when zoom is extremely low to improve performance
    if (currentZoom < 0.1) { // Below 10% zoom
      // Only show visible nodes in viewport or important nodes
      const viewportBounds: ViewportBounds = {
        x: -viewport.x / currentZoom,
        y: -viewport.y / currentZoom,
        width: window.innerWidth / currentZoom,
        height: window.innerHeight / currentZoom
      }

      const nodeBounds = {
        x: node.position.x,
        y: node.position.y,
        width: 220,
        height: 100
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

  // Throttled operation helper
  const createThrottledHandler = <T extends (...args: any[]) => void>(
    handler: T,
    delay: number = 16
  ): T => {
    let lastCall = 0
    return ((...args: any[]) => {
      const now = performance.now()
      if (now - lastCall >= delay) {
        lastCall = now
        handler(...args)
      }
    }) as T
  }

  // Debounced operation helper
  const createDebouncedHandler = <T extends (...args: any[]) => void>(
    handler: T,
    delay: number = 100
  ): T => {
    let timeoutId: number | null = null
    return ((...args: any[]) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        handler(...args)
        timeoutId = null
      }, delay) as unknown as number
    }) as T
  }

  // Cleanup on unmount
  onBeforeUnmount(() => {
    performanceManager.cleanup()
  })

  return {
    performanceManager,
    shouldCullNode,
    createThrottledHandler,
    createDebouncedHandler
  }
}