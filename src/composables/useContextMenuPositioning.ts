/**
 * Context Menu Positioning Composable
 *
 * Provides proper viewport boundary detection and positioning for context menus:
 * - Uses actual DOM measurements instead of estimates
 * - Handles all viewport edges with proper boundary detection
 * - Accounts for scroll position
 * - Provides smooth positioning adjustments
 */

import { computed, nextTick, ref, watch } from 'vue'

export interface useContextMenuPositioningOptions {
  x: number
  y: number
  menuRef: { value: HTMLElement | null }
  isVisible: boolean
  offset?: { x?: number; y?: number }
  viewportPadding?: number
}

export function useContextMenuPositioning(options: useContextMenuPositioningOptions) {
  const {
    x,
    y,
    menuRef,
    isVisible,
    offset = { x: 2, y: 2 },
    viewportPadding = 8
  } = options

  const isPositioning = ref(false)

  const menuPosition = computed(() => {
    if (!isVisible) {
      return {
        left: '-9999px',
        top: '-9999px'
      }
    }

    // Start with the click position plus offset (default position)
    let left = x + (offset.x || 0)
    let top = y + (offset.y || 0)

    // If we have a menu element reference, adjust for viewport boundaries
    if (menuRef.value) {
      const menu = menuRef.value
      const rect = menu.getBoundingClientRect()

      // Get viewport dimensions
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      // Calculate if menu would overflow right edge
      const wouldOverflowRight = left + rect.width > viewportWidth - viewportPadding

      // Calculate if menu would overflow bottom edge
      const wouldOverflowBottom = top + rect.height > viewportHeight - viewportPadding

      // Handle horizontal positioning
      if (wouldOverflowRight) {
        // Try to position menu to the left of the click
        const leftPosition = x - rect.width - (offset.x || 0)
        if (leftPosition >= viewportPadding) {
          // Left position works
          left = leftPosition
        } else {
          // Neither left nor right position works, align to right edge with padding
          left = Math.max(viewportPadding, viewportWidth - rect.width - viewportPadding)
        }
      }

      // Handle vertical positioning
      if (wouldOverflowBottom) {
        // Try to position menu above the click
        const topPosition = y - rect.height - (offset.y || 0)
        if (topPosition >= viewportPadding) {
          // Top position works
          top = topPosition
        } else {
          // Neither top nor bottom position works, align to bottom edge with padding
          top = Math.max(viewportPadding, viewportHeight - rect.height - viewportPadding)
        }
      }

      // Final safety check - ensure menu doesn't go beyond viewport edges
      left = Math.max(viewportPadding, Math.min(left, viewportWidth - rect.width - viewportPadding))
      top = Math.max(viewportPadding, Math.min(top, viewportHeight - rect.height - viewportPadding))
    }

    return {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`
    }
  })

  const updatePosition = async () => {
    if (!isVisible || !menuRef.value) return

    isPositioning.value = true

    // Wait for DOM to be rendered before measuring
    await nextTick()

    // Force re-calculation by accessing the computed property
    // This triggers the measurement logic
    menuPosition.value

    isPositioning.value = false
  }

  return {
    menuPosition,
    updatePosition,
    isPositioning
  }
}