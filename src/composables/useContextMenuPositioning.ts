/**
 * Context Menu Positioning Composable
 *
 * Provides proper viewport boundary detection and positioning for context menus:
 * - Uses actual DOM measurements instead of estimates
 * - Handles all viewport edges with proper boundary detection
 * - Accounts for scroll position
 * - Provides smooth positioning adjustments
 *
 * FIXED (2025-11-29): Now accepts reactive x/y values via refs or getters
 */

import { computed, nextTick, ref, watch, type Ref, isRef, toValue } from 'vue'

export interface useContextMenuPositioningOptions {
  x: number | Ref<number> | (() => number)
  y: number | Ref<number> | (() => number)
  menuRef: { value: HTMLElement | null }
  isVisible: boolean | Ref<boolean> | (() => boolean)
  offset?: { x?: number; y?: number }
  viewportPadding?: number
}

export function useContextMenuPositioning(options: useContextMenuPositioningOptions) {
  const {
    menuRef,
    offset = { x: 2, y: 2 },
    viewportPadding = 8
  } = options

  // Store reactive versions of x, y, isVisible
  const currentX = ref(toValue(options.x))
  const currentY = ref(toValue(options.y))
  const currentIsVisible = ref(toValue(options.isVisible))

  // Watch for changes if refs or getters were provided
  if (isRef(options.x) || typeof options.x === 'function') {
    watch(() => toValue(options.x), (newX) => { currentX.value = newX })
  }
  if (isRef(options.y) || typeof options.y === 'function') {
    watch(() => toValue(options.y), (newY) => { currentY.value = newY })
  }
  if (isRef(options.isVisible) || typeof options.isVisible === 'function') {
    watch(() => toValue(options.isVisible), (newVisible) => { currentIsVisible.value = newVisible })
  }

  const isPositioning = ref(false)

  // Trigger for forcing recalculation
  const recalcTrigger = ref(0)

  const menuPosition = computed(() => {
    // Access trigger to make this computed reactive to manual updates
    recalcTrigger.value

    if (!currentIsVisible.value) {
      return {
        left: '-9999px',
        top: '-9999px'
      }
    }

    // Start with the click position plus offset (default position)
    let left = currentX.value + (offset.x || 0)
    let top = currentY.value + (offset.y || 0)

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
        const leftPosition = currentX.value - rect.width - (offset.x || 0)
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
        const topPosition = currentY.value - rect.height - (offset.y || 0)
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

  // Update x and y values (for when new coordinates are available)
  const setPosition = (newX: number, newY: number) => {
    currentX.value = newX
    currentY.value = newY
  }

  const updatePosition = async () => {
    if (!currentIsVisible.value || !menuRef.value) return

    isPositioning.value = true

    // Wait for DOM to be rendered before measuring
    await nextTick()

    // Force re-calculation by incrementing the trigger
    recalcTrigger.value++

    // Access the computed to trigger recalculation
    menuPosition.value

    isPositioning.value = false
  }

  return {
    menuPosition,
    updatePosition,
    setPosition,
    isPositioning
  }
}