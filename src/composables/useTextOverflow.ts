import { ref, watch, nextTick, onUnmounted, type Ref } from 'vue'

/**
 * Composable for detecting text overflow and showing tooltips only when needed
 * Uses the Range API for precise overflow detection
 */
export function useTextOverflow(elementRef: Ref<HTMLElement | null>, text: Ref<string> | string) {
  const isOverflowing = ref(false)
  const showTooltip = ref(false)

  const checkOverflow = () => {
    const element = elementRef.value
    if (!element) return

    try {
      // Create a Range to measure the actual text width
      const range = document.createRange()
      range.selectNodeContents(element)

      const textRect = range.getBoundingClientRect()
      const elementRect = element.getBoundingClientRect()

      // Check if text width exceeds element width with sub-pixel precision
      const isTextOverflowing = textRect.width > elementRect.width + 1 // Add 1px tolerance
      isOverflowing.value = isTextOverflowing
    } catch (error) {
      // Fallback to scrollWidth comparison if Range API fails
      isOverflowing.value = element.scrollWidth > element.clientWidth
    }
  }

  // Watch for text changes and element ref changes
  watch(
    [elementRef, typeof text === 'object' ? text : () => text],
    () => {
      // Use nextTick to ensure DOM is updated
      nextTick(() => {
        checkOverflow()
      })
    },
    { immediate: true, flush: 'post' }
  )

  // Check on window resize (with debouncing)
  let resizeTimeout: NodeJS.Timeout
  const handleResize = () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(checkOverflow, 100)
  }

  // Set up resize observer for more reliable detection
  let resizeObserver: ResizeObserver | null = null

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(handleResize)

    watch(elementRef, (element) => {
      if (resizeObserver) {
        if (element) {
          resizeObserver.observe(element)
        } else {
          resizeObserver.disconnect()
        }
      }
    }, { immediate: true })
  } else {
    // Fallback to window resize listener
    window.addEventListener('resize', handleResize)

    // Cleanup on unmount
    onUnmounted(() => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    })
  }

  // Cleanup
  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect()
    }
    clearTimeout(resizeTimeout)
  })

  // Tooltip interaction handlers
  const handleMouseEnter = () => {
    if (isOverflowing.value) {
      showTooltip.value = true
    }
  }

  const handleMouseLeave = () => {
    showTooltip.value = false
  }

  return {
    isOverflowing,
    showTooltip,
    checkOverflow,
    handleMouseEnter,
    handleMouseLeave
  }
}