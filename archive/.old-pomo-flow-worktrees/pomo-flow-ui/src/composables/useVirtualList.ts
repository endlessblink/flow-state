// Virtual List Composable
// Optimizes rendering of large lists by only rendering visible items

import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useThrottleFn, useDebounceFn } from '@vueuse/core'

interface VirtualListOptions {
  itemHeight: number | ((index: number) => number)
  containerHeight: number
  overscan?: number
  threshold?: number
  scrollElement?: HTMLElement | Window
}

interface VirtualItem {
  index: number
  top: number
  bottom: number
  height: number
  data: any
}

export const useVirtualList = <T = any>(
  items: T[],
  options: VirtualListOptions
) => {
  const {
    itemHeight,
    containerHeight,
    overscan = 5,
    threshold = 100,
    scrollElement = window
  } = options

  // State
  const containerRef = ref<HTMLElement>()
  const scrollTop = ref(0)
  const containerHeightInternal = ref(containerHeight)
  const isScrolling = ref(false)
  const scrollDirection = ref<'up' | 'down' | null>(null)

  // Internal state
  let lastScrollTop = 0
  let scrollTimeout: NodeJS.Timeout

  // Computed properties
  const getItemHeight = (index: number): number => {
    return typeof itemHeight === 'function' ? itemHeight(index) : itemHeight
  }

  const totalHeight = computed(() => {
    let height = 0
    for (let i = 0; i < items.length; i++) {
      height += getItemHeight(i)
    }
    return height
  })

  const visibleRange = computed(() => {
    if (items.length === 0) {
      return { start: 0, end: 0 }
    }

    let start = 0
    let end = 0
    let accumulatedHeight = 0

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const itemHeight = getItemHeight(i)
      if (accumulatedHeight + itemHeight > scrollTop.value) {
        start = Math.max(0, i - overscan)
        break
      }
      accumulatedHeight += itemHeight
    }

    // Find end index
    accumulatedHeight = 0
    for (let i = start; i < items.length; i++) {
      accumulatedHeight += getItemHeight(i)
      if (accumulatedHeight > containerHeightInternal.value) {
        end = Math.min(items.length - 1, i + overscan)
        break
      }
    }

    // Ensure we have enough items
    if (end === 0) {
      end = Math.min(items.length - 1, start + Math.ceil(containerHeightInternal.value / getItemHeight(start)) + overscan)
    }

    return { start, end }
  })

  const visibleItems = computed((): VirtualItem[] => {
    const { start, end } = visibleRange.value
    const result: VirtualItem[] = []

    let top = 0
    for (let i = 0; i < start; i++) {
      top += getItemHeight(i)
    }

    for (let i = start; i <= end; i++) {
      const height = getItemHeight(i)
      result.push({
        index: i,
        top,
        bottom: top + height,
        height,
        data: items[i]
      })
      top += height
    }

    return result
  })

  const offsetY = computed(() => {
    const { start } = visibleRange.value
    let offset = 0
    for (let i = 0; i < start; i++) {
      offset += getItemHeight(i)
    }
    return offset
  })

  // Scroll handling
  const handleScroll = useThrottleFn((event: Event) => {
    const target = event.target as HTMLElement
    const newScrollTop = target === window ? window.scrollY : target.scrollTop

    // Determine scroll direction
    scrollDirection.value = newScrollTop > lastScrollTop ? 'down' : 'up'
    lastScrollTop = newScrollTop

    scrollTop.value = newScrollTop
    isScrolling.value = true

    // Clear existing timeout
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }

    // Set scrolling to false after scroll ends
    scrollTimeout = setTimeout(() => {
      isScrolling.value = false
      scrollDirection.value = null
    }, 150)
  }, 16) // ~60fps

  // Update container height
  const updateContainerHeight = () => {
    if (containerRef.value) {
      const rect = containerRef.value.getBoundingClientRect()
      containerHeightInternal.value = rect.height
    }
  }

  // Scroll to specific item
  const scrollToItem = async (index: number, alignment: 'start' | 'center' | 'end' = 'start') => {
    if (index < 0 || index >= items.length) return

    let offset = 0
    for (let i = 0; i < index; i++) {
      offset += getItemHeight(i)
    }

    const itemHeight = getItemHeight(index)
    const containerScrollElement = containerRef.value || window

    switch (alignment) {
      case 'start':
        break // Already at start
      case 'center':
        offset -= (containerHeightInternal.value - itemHeight) / 2
        break
      case 'end':
        offset -= containerHeightInternal.value - itemHeight
        break
    }

    if (containerRef.value) {
      containerRef.value.scrollTop = Math.max(0, offset)
    } else {
      window.scrollTo({
        top: Math.max(0, offset),
        behavior: 'smooth'
      })
    }

    // Wait for scroll to complete
    await nextTick()
  }

  // Scroll by offset
  const scrollBy = (offset: number) => {
    if (containerRef.value) {
      containerRef.value.scrollTop += offset
    } else {
      window.scrollBy({ top: offset, behavior: 'smooth' })
    }
  }

  // Get item at position
  const getItemAtPosition = (y: number): number => {
    let accumulatedHeight = 0
    for (let i = 0; i < items.length; i++) {
      const itemHeight = getItemHeight(i)
      if (accumulatedHeight + itemHeight > y) {
        return i
      }
      accumulatedHeight += itemHeight
    }
    return items.length - 1
  }

  // Check if item is visible
  const isItemVisible = (index: number): boolean => {
    const { start, end } = visibleRange.value
    return index >= start && index <= end
  }

  // Get visible percentage of item
  const getItemVisiblePercentage = (index: number): number => {
    if (!isItemVisible(index)) return 0

    const itemTop = offsetY.value + visibleItems.value.find(item => item.index === index)?.top!
    const itemBottom = itemTop + getItemHeight(index)
    const viewportTop = scrollTop.value
    const viewportBottom = scrollTop.value + containerHeightInternal.value

    const visibleTop = Math.max(itemTop, viewportTop)
    const visibleBottom = Math.min(itemBottom, viewportBottom)

    if (visibleTop >= visibleBottom) return 0
    return ((visibleBottom - visibleTop) / getItemHeight(index)) * 100
  }

  // Performance monitoring
  const performanceMetrics = ref({
    renderCount: 0,
    averageRenderTime: 0,
    lastRenderTime: 0,
    visibleItemsCount: 0
  })

  // Watch for changes and track performance
  watch(
    () => items.length,
    () => {
      const start = performance.now()
      // Force recompute visible items
      visibleRange.value
      const end = performance.now()

      performanceMetrics.value.renderCount++
      performanceMetrics.value.lastRenderTime = end - start
      performanceMetrics.value.averageRenderTime =
        (performanceMetrics.value.averageRenderTime * (performanceMetrics.value.renderCount - 1) + (end - start)) /
        performanceMetrics.value.renderCount
    }
  )

  watch(
    visibleItems,
    (newItems) => {
      performanceMetrics.value.visibleItemsCount = newItems.length
    },
    { immediate: true }
  )

  // Resize handling
  const handleResize = useDebounceFn(() => {
    updateContainerHeight()
  }, 100)

  // Initialize
  onMounted(() => {
    updateContainerHeight()

    // Add scroll listener
    if (typeof scrollElement === 'string') {
      const element = document.querySelector(scrollElement) as HTMLElement
      if (element) {
        element.addEventListener('scroll', handleScroll, { passive: true })
      }
    } else if (scrollElement instanceof HTMLElement) {
      scrollElement.addEventListener('scroll', handleScroll, { passive: true })
    } else {
      window.addEventListener('scroll', handleScroll, { passive: true })
    }

    // Add resize listener
    window.addEventListener('resize', handleResize, { passive: true })
  })

  // Cleanup
  onUnmounted(() => {
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }

    // Remove scroll listener
    if (typeof scrollElement === 'string') {
      const element = document.querySelector(scrollElement) as HTMLElement
      if (element) {
        element.removeEventListener('scroll', handleScroll)
      }
    } else if (scrollElement instanceof HTMLElement) {
      scrollElement.removeEventListener('scroll', handleScroll)
    } else {
      window.removeEventListener('scroll', handleScroll)
    }

    // Remove resize listener
    window.removeEventListener('resize', handleResize)
  })

  return {
    // Refs
    containerRef,

    // State
    scrollTop,
    isScrolling,
    scrollDirection,
    totalHeight,
    offsetY,

    // Computed
    visibleRange,
    visibleItems,
    performanceMetrics,

    // Methods
    scrollToItem,
    scrollBy,
    getItemAtPosition,
    isItemVisible,
    getItemVisiblePercentage,
    updateContainerHeight,

    // Utilities
    getItemHeight
  }
}