/**
 * Virtual Scrolling Composable for Large Lists
 * Provides high-performance virtual scrolling with dynamic item heights
 */

import { ref, computed, onMounted as _onMounted, onUnmounted, nextTick as _nextTick } from 'vue'
import { useVirtualList, useThrottleFn, useResizeObserver } from '@vueuse/core'

export interface VirtualItem {
  id: string | number
  height?: number
  data: any
}

export interface VirtualScrollOptions {
  itemHeight?: number
  containerHeight?: number
  overscan?: number
  enabled?: boolean
  dynamicHeight?: boolean
  threshold?: number
}

export interface VirtualScrollResult {
  virtualList: any
  containerProps: any
  wrapperProps: any
  visibleItems: any[]
  scrollToItem: (index: number) => void
  scrollToTop: () => void
  scrollToBottom: () => void
  totalSize: number
  containerHeight: number
  isVisible: (index: number) => boolean
  updateItemHeight: (index: number, height: number) => void
  performance: {
    totalItems: number
    visibleItems: number
    renderedItems: number
    scrollPercentage: number
  }
}

export function useVirtualScrolling<T extends VirtualItem>(
  items: T[],
  options: VirtualScrollOptions = {}
): VirtualScrollResult {
  const {
    itemHeight: defaultItemHeight = 60,
    containerHeight: defaultContainerHeight = 400,
    overscan = 5,
    enabled = true,
    dynamicHeight = false,
    threshold = 100
  } = options

  // Reactive state
  const containerRef = ref<HTMLElement>()
  const itemHeights = ref<Map<number, number>>(new Map())
  const containerHeight = ref(defaultContainerHeight)
  const isScrolling = ref(false)
  const scrollDirection = ref<'up' | 'down' | null>(null)
  let lastScrollTop = 0

  // Performance monitoring
  const performanceMetrics = ref({
    totalItems: 0,
    visibleItems: 0,
    renderedItems: 0,
    scrollPercentage: 0,
    renderTime: 0,
    scrollEvents: 0,
    lastRenderTime: 0
  })

  // Check if virtual scrolling should be enabled
  const shouldUseVirtual = computed(() => {
    return enabled && items.length > threshold
  })

  // Dynamic height calculation
  const getItemHeight = (index: number): number => {
    if (dynamicHeight) {
      return itemHeights.value.get(index) || defaultItemHeight
    }
    return defaultItemHeight
  }

  // Update individual item height
  const updateItemHeight = (index: number, height: number) => {
    if (dynamicHeight) {
      itemHeights.value.set(index, height)
    }
  }

  // Calculate total list size
  const totalSize = computed(() => {
    if (!shouldUseVirtual.value) {
      return items.length * defaultItemHeight
    }

    if (dynamicHeight) {
      let total = 0
      for (let i = 0; i < items.length; i++) {
        total += getItemHeight(i)
      }
      return total
    }

    return items.length * defaultItemHeight
  })

  // Setup VueUse virtual list
  const virtualList = useVirtualList(
    computed(() => shouldUseVirtual.value ? items : []),
    {
      itemHeight: (index: number) => getItemHeight(index),
      overscan,
      getScrollElement: () => containerRef.value
    } as any
  )

  // Throttled scroll handler
  const handleScroll = useThrottleFn((event: Event) => {
    const target = event.target as HTMLElement
    const currentScrollTop = target.scrollTop

    // Determine scroll direction
    if (currentScrollTop > lastScrollTop) {
      scrollDirection.value = 'down'
    } else if (currentScrollTop < lastScrollTop) {
      scrollDirection.value = 'up'
    }

    lastScrollTop = currentScrollTop
    isScrolling.value = true

    // Update performance metrics
    performanceMetrics.value.scrollEvents++
    performanceMetrics.value.scrollPercentage = Math.round(
      (currentScrollTop / (totalSize.value - containerHeight.value)) * 100
    )

    // Reset scrolling state after delay
    setTimeout(() => {
      isScrolling.value = false
      scrollDirection.value = null
    }, 150)
  }, 16) // ~60fps

  // Resize observer for container
  useResizeObserver(containerRef, (entries) => {
    const entry = entries[0]
    if (entry) {
      containerHeight.value = entry.contentRect.height
    }
  })

  // Container props
  const containerProps = computed(() => ({
    ref: containerRef,
    style: {
      height: `${containerHeight.value}px`,
      overflow: 'auto'
    },
    onScroll: handleScroll,
    'data-virtual-scroll': shouldUseVirtual.value
  }))

  // Wrapper props for virtual scrolling
  const wrapperProps = computed(() => {
    if (!shouldUseVirtual.value) {
      return {
        style: {
          position: 'relative' as const,
          minHeight: `${items.length * defaultItemHeight}px`
        }
      }
    }

    return virtualList.wrapperProps
  })

  // Visible items
  const visibleItems = computed(() => {
    const startTime = (performance as any).now()

    let result
    if (!shouldUseVirtual.value) {
      // Render all items for small lists
      result = items.map((item, index) => ({
        data: item,
        index,
        style: {
          position: 'absolute' as const,
          top: `${index * defaultItemHeight}px`,
          left: '0',
          right: '0',
          height: `${defaultItemHeight}px`
        }
      }))
    } else {
      // Use virtual list for large lists
      result = (virtualList as any).value
    }

    // Update performance metrics
    const renderTime = (performance as any).now() - startTime
    performanceMetrics.value.lastRenderTime = renderTime
    performanceMetrics.value.totalItems = items.length
    performanceMetrics.value.visibleItems = result.length
    performanceMetrics.value.renderedItems = shouldUseVirtual.value ? result.length : items.length

    return result
  })

  // Scroll methods
  const scrollToItem = async (index: number) => {
    if (!containerRef.value) return

    const targetHeight = dynamicHeight
      ? Array.from(itemHeights.value.entries())
          .filter(([i]) => i < index)
          .reduce((sum, [, height]) => sum + height, 0)
      : index * defaultItemHeight

    containerRef.value.scrollTo({
      top: targetHeight,
      behavior: 'smooth'
    })
  }

  const scrollToTop = () => {
    if (!containerRef.value) return
    containerRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToBottom = () => {
    if (!containerRef.value) return
    containerRef.value.scrollTo({
      top: totalSize.value - containerHeight.value,
      behavior: 'smooth'
    })
  }

  // Visibility check
  const isVisible = (index: number) => {
    if (!shouldUseVirtual.value || !containerRef.value) return true

    const scrollTop = containerRef.value.scrollTop
    const itemTop = dynamicHeight
      ? Array.from(itemHeights.value.entries())
          .filter(([i]) => i < index)
          .reduce((sum, [, height]) => sum + height, 0)
      : index * defaultItemHeight
    const itemHeight = getItemHeight(index)
    const itemBottom = itemTop + itemHeight

    return itemBottom >= scrollTop && itemTop <= scrollTop + containerHeight.value
  }

  // Performance monitoring
  const performance = computed(() => ({
    totalItems: performanceMetrics.value.totalItems,
    visibleItems: performanceMetrics.value.visibleItems,
    renderedItems: performanceMetrics.value.renderedItems,
    scrollPercentage: performanceMetrics.value.scrollPercentage,
    isScrolling: isScrolling.value,
    scrollDirection: scrollDirection.value,
    lastRenderTime: performanceMetrics.value.lastRenderTime,
    memoryEfficiency: Math.round(
      (performanceMetrics.value.visibleItems / performanceMetrics.value.totalItems) * 100
    )
  }))

  // Cleanup
  onUnmounted(() => {
    itemHeights.value.clear()
  })

  return {
    virtualList: virtualList as any,
    containerProps,
    wrapperProps,
    visibleItems: visibleItems as any,
    scrollToItem,
    scrollToTop,
    scrollToBottom,
    totalSize: totalSize as any,
    containerHeight: containerHeight as any,
    isVisible,
    updateItemHeight,
    performance: performance as any
  } as any
}

// Preset configurations for common use cases
export const virtualScrollPresets = {
  // For task lists
  taskList: {
    itemHeight: 80,
    containerHeight: 600,
    overscan: 3,
    dynamicHeight: true,
    threshold: 50
  },

  // For calendar events
  calendarEvents: {
    itemHeight: 120,
    containerHeight: 500,
    overscan: 2,
    dynamicHeight: true,
    threshold: 20
  },

  // For canvas nodes
  canvasNodes: {
    itemHeight: 100,
    containerHeight: 400,
    overscan: 5,
    dynamicHeight: false,
    threshold: 100
  },

  // For small lists (no virtual scrolling)
  smallList: {
    itemHeight: 60,
    containerHeight: 400,
    overscan: 0,
    dynamicHeight: false,
    threshold: 1000, // Very high to disable
    enabled: false
  }
}

export default useVirtualScrolling