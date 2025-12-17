/**
 * Text Overflow Composable
 *
 * Provides reactive text overflow detection and truncation functionality
 * for UI components that need to handle overflowing text with tooltips.
 */

import { ref, computed, watch, nextTick, type Ref } from 'vue'

export function useTextOverflow(elementRef?: Ref<HTMLElement | null>, _textRef?: Ref<string>) {
  const isOverflowing = ref(false)
  const showTooltip = ref(false)
  let tooltipTimeout: number | null = null

  /**
   * Check if the element is overflowing
   */
  const checkOverflow = async () => {
    const element = elementRef?.value || null
    if (!element) return

    await nextTick()

    // Compare scrollWidth/Height with clientWidth/Height
    const isHorizontallyOverflowing = element.scrollWidth > element.clientWidth
    const isVerticallyOverflowing = element.scrollHeight > element.clientHeight

    isOverflowing.value = isHorizontallyOverflowing || isVerticallyOverflowing
  }

  /**
   * Handle mouse enter - show tooltip after delay if overflowing
   */
  const handleMouseEnter = () => {
    checkOverflow()

    if (isOverflowing.value) {
      // Clear any existing timeout
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout)
      }

      // Show tooltip after a short delay
      tooltipTimeout = setTimeout(() => {
        showTooltip.value = true
      }, 300) as any
    }
  }

  /**
   * Handle mouse leave - hide tooltip
   */
  const handleMouseLeave = () => {
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout)
      tooltipTimeout = null
    }
    showTooltip.value = false
  }

  // Watch for element changes
  if (elementRef) {
    watch(elementRef, () => {
      checkOverflow()
    })
  }

  return {
    isOverflowing: computed(() => isOverflowing.value),
    showTooltip: computed(() => showTooltip.value),
    checkOverflow,
    handleMouseEnter,
    handleMouseLeave
  }
}