/**
 * Render Optimization Composable
 * Optimizes Vue component rendering, reduces unnecessary re-renders
 */

import { ref, computed, onMounted, onUnmounted, nextTick, shallowRef, triggerRef } from 'vue'
import { useThrottleFn, useDebounceFn } from '@vueuse/core'

export interface RenderOptimizationOptions {
  enableShallowReactive?: boolean
  enableVirtualScrolling?: boolean
  enableLazyLoading?: boolean
  throttleRenderEvents?: boolean
  enableRenderBatching?: boolean
  batchSize?: number
  batchDelay?: number
  enableComponentCaching?: boolean
  maxComponentCache?: number
}

export interface RenderMetrics {
  totalRenders: number
  componentRenders: Map<string, number>
  averageRenderTime: number
  slowRenders: number
  skippedRenders: number
  cachedComponents: number
  memoryUsage: number
  lastRenderTime: number
}

export function useRenderOptimization(options: RenderOptimizationOptions = {}) {
  const {
    enableShallowReactive = true,
    enableVirtualScrolling: _enableVirtualScrolling = true,
    enableLazyLoading = true,
    throttleRenderEvents = true,
    enableRenderBatching = true,
    batchSize = 20,
    batchDelay = 16, // ~60fps
    enableComponentCaching = true,
    maxComponentCache = 50
  } = options

  // Reactive state
  const renderMetrics = ref<RenderMetrics>({
    totalRenders: 0,
    componentRenders: new Map(),
    averageRenderTime: 0,
    slowRenders: 0,
    skippedRenders: 0,
    cachedComponents: 0,
    memoryUsage: 0,
    lastRenderTime: 0
  })

  const componentCache = ref<Map<string, any>>(new Map())
  const pendingRenders = ref<Set<() => void>>(new Set())
  const isProcessingBatch = ref(false)
  const renderQueue = ref<(() => void)[]>([])

  // Performance monitoring
  const performanceObserver = ref<PerformanceObserver | null>(null)
  const renderTimes = ref<number[]>([])

  // Throttled render function
  const throttledRender = throttleRenderEvents
    ? useThrottleFn((fn: () => void) => fn(), batchDelay)
    : (fn: () => void) => fn()

  // Debounced batch processor
  const processRenderBatch = useDebounceFn(async () => {
    if (renderQueue.value.length === 0 || isProcessingBatch.value) return

    isProcessingBatch.value = true
    const batch = renderQueue.value.splice(0, batchSize)

    try {
      // Process all renders in a single frame
      await nextTick()

      const startTime = performance.now()
      batch.forEach(renderFn => {
        try {
          renderFn()
        } catch (error) {
          console.error('Render batch item failed:', error)
        }
      })

      const renderTime = performance.now() - startTime
      renderTimes.value.push(renderTime)

      // Keep only recent render times
      if (renderTimes.value.length > 100) {
        renderTimes.value = renderTimes.value.slice(-50)
      }

      // Update metrics
      renderMetrics.value.totalRenders += batch.length
      renderMetrics.value.averageRenderTime = renderTimes.value.reduce((a, b) => a + b, 0) / renderTimes.value.length
      renderMetrics.value.lastRenderTime = renderTime

      // Mark slow renders
      if (renderTime > 16) { // More than 60fps threshold
        renderMetrics.value.slowRenders++
      }

    } finally {
      isProcessingBatch.value = false
    }
  }, batchDelay)

  // Optimized render function
  const optimizedRender = (renderFn: () => void, componentId?: string) => {
    const startTime = performance.now()

    const wrappedRender = () => {
      try {
        renderFn()

        // Track component renders
        if (componentId) {
          const currentCount = renderMetrics.value.componentRenders.get(componentId) || 0
          renderMetrics.value.componentRenders.set(componentId, currentCount + 1)
        }

      } catch (error) {
        console.error(`Render failed for component ${componentId}:`, error)
      }
    }

    if (enableRenderBatching) {
      renderQueue.value.push(wrappedRender)
      processRenderBatch()
    } else {
      throttledRender(wrappedRender)
    }

    const renderTime = performance.now() - startTime
    renderMetrics.value.lastRenderTime = renderTime
  }

  // Shallow reactive wrapper for large arrays/objects
  const createShallowReactive = <T>(value: T): { value: T; trigger: () => void } => {
    if (!enableShallowReactive) {
      return { value, trigger: () => { } }
    }

    const shallowRefValue = shallowRef(value)

    return {
      get value() {
        return shallowRefValue.value
      },
      set value(newValue) {
        shallowRefValue.value = newValue
      },
      trigger: () => triggerRef(shallowRefValue)
    }
  }

  // Component caching
  const cacheComponent = (key: string, component: unknown, ttl: number = 300000) => {
    if (!enableComponentCaching) return

    // Clear old entries if cache is full
    if (componentCache.value.size >= maxComponentCache) {
      const entries = Array.from(componentCache.value.entries())
      // Remove oldest 25% of entries
      const toRemove = Math.floor(entries.length * 0.25)
      for (let i = 0; i < toRemove; i++) {
        componentCache.value.delete(entries[i][0])
      }
    }

    componentCache.value.set(key, {
      component,
      timestamp: Date.now(),
      ttl
    })

    renderMetrics.value.cachedComponents = componentCache.value.size
  }

  const getCachedComponent = (key: string): unknown => {
    if (!enableComponentCaching) return null

    const cached = componentCache.value.get(key)
    if (!cached) return null

    // Check TTL
    if (Date.now() - cached.timestamp > cached.ttl) {
      componentCache.value.delete(key)
      renderMetrics.value.cachedComponents = componentCache.value.size
      return null
    }

    renderMetrics.value.skippedRenders++
    return cached.component
  }

  // Conditional render helper
  const shouldRender = (condition: () => boolean, lastValue?: boolean): boolean => {
    const current = condition()
    const shouldUpdate = lastValue !== current
    return shouldUpdate
  }

  // Memoized component factory
  const createMemoizedComponent = (
    componentFactory: () => unknown,
    dependencyKeys: string[],
    componentId: string
  ) => {
    let cachedComponent: unknown = null
    let lastDependencyValues: unknown[] = []

    return () => {
      const currentDependencyValues = dependencyKeys.map(key => {
        try {
          return (window as unknown)[key] || (globalThis as unknown)[key]
        } catch {
          return undefined
        }
      })

      const dependenciesChanged = !lastDependencyValues.every(
        (value, index) => value === currentDependencyValues[index]
      )

      if (!cachedComponent || dependenciesChanged) {
        cachedComponent = componentFactory()
        lastDependencyValues = currentDependencyValues

        renderMetrics.value.componentRenders.set(
          componentId,
          (renderMetrics.value.componentRenders.get(componentId) || 0) + 1
        )
      } else {
        renderMetrics.value.skippedRenders++
      }

      return cachedComponent
    }
  }

  // Lazy loading helper
  const createLazyLoader = <T>(
    loader: () => Promise<T>,
    fallback?: T,
    componentId?: string
  ) => {
    if (!enableLazyLoading) {
      return { load: () => loader(), isLoaded: ref(true), data: ref(null) }
    }

    const isLoaded = ref(false)
    const isLoading = ref(false)
    const data = ref<T | null>(null)
    const error = ref<Error | null>(null)

    const load = async () => {
      if (isLoaded.value || isLoading.value) return

      isLoading.value = true
      error.value = null

      try {
        const startTime = performance.now()
        const result = await loader()
        const loadTime = performance.now() - startTime

        data.value = result
        isLoaded.value = true

        if (componentId) {
          console.log(`🚀 Lazy loaded ${componentId} in ${loadTime.toFixed(2)}ms`)
        }

      } catch (err) {
        error.value = err as Error
        console.error(`❌ Failed to lazy load component ${componentId}:`, err)

        // Use fallback if provided
        if (fallback !== undefined) {
          data.value = fallback
          isLoaded.value = true
        }
      } finally {
        isLoading.value = false
      }
    }

    return { load, isLoaded, isLoading, data, error }
  }

  // Performance monitoring setup
  const setupPerformanceMonitoring = () => {
    if ('PerformanceObserver' in window) {
      performanceObserver.value = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.name.includes('render')) {
            renderTimes.value.push(entry.duration)
          }
        }
      })

      performanceObserver.value.observe({ entryTypes: ['measure'] })
    }
  }

  // Memory monitoring
  const updateMemoryUsage = () => {
    const perf = performance as unknown as { memory?: { usedJSHeapSize: number } }
    if (perf.memory) {
      renderMetrics.value.memoryUsage = perf.memory.usedJSHeapSize
    }
  }

  // Cleanup function
  const cleanup = () => {
    if (performanceObserver.value) {
      performanceObserver.value.disconnect()
    }

    componentCache.value.clear()
    renderQueue.value = []
    pendingRenders.value.clear()
    renderTimes.value = []

    console.log('🧹 Render optimization cleanup completed')
  }

  // Performance metrics computed property
  const performanceStats = computed(() => ({
    ...renderMetrics.value,
    renderEfficiency: renderMetrics.value.skippedRenders / (renderMetrics.value.totalRenders + renderMetrics.value.skippedRenders) || 0,
    cacheHitRate: renderMetrics.value.cachedComponents / maxComponentCache,
    averageRenderTime: renderMetrics.value.averageRenderTime,
    isPerformant: renderMetrics.value.averageRenderTime < 16, // 60fps threshold
    memoryEfficiency: renderMetrics.value.memoryUsage < 50 * 1024 * 1024 // 50MB threshold
  }))

  // Setup on mount
  onMounted(() => {
    setupPerformanceMonitoring()

    // Monitor memory usage periodically
    const memoryInterval = setInterval(updateMemoryUsage, 5000)

    onUnmounted(() => {
      clearInterval(memoryInterval)
    })
  })

  // Cleanup on unmount
  onUnmounted(cleanup)

  return {
    // Core optimization functions
    optimizedRender,
    createShallowReactive,
    createMemoizedComponent,
    createLazyLoader,

    // Caching
    cacheComponent,
    getCachedComponent,

    // Utilities
    shouldRender,

    // Performance monitoring
    performanceStats,
    renderMetrics,

    // State
    isProcessingBatch,
    queueLength: computed(() => renderQueue.value.length),

    // Cleanup
    cleanup
  }
}

// Global render optimization instance
export const globalRenderOptimizer = useRenderOptimization()

export default useRenderOptimization