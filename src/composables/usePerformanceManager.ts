/**
 * Performance Manager Composable
 * Centralized performance optimization with debouncing, memoization, and cleanup
 */

import { ref, computed as _computed, watch as _watch, onMounted, onUnmounted, nextTick as _nextTick } from 'vue'
import { useDebounceFn, useThrottleFn, useStorage as _useStorage, useRafFn } from '@vueuse/core'

export interface PerformanceConfig {
  debounceDelay?: number
  throttleDelay?: number
  maxCacheSize?: number
  enableMemoization?: boolean
  enableCleanup?: boolean
  cleanupInterval?: number
  memoryThreshold?: number
}

export interface PerformanceMetrics {
  memoryUsage: number
  cacheSize: number
  cacheHitRate: number
  debouncedOperations: number
  throttledOperations: number
  memoizedComputations: number
  cleanupRuns: number
  lastCleanupTime: number
}

export interface CacheEntry<T = any> {
  key: string
  value: T
  timestamp: number
  hits: number
  size: number
}

export function usePerformanceManager(config: PerformanceConfig = {}) {
  const {
    debounceDelay = 300,
    throttleDelay = 16, // ~60fps
    maxCacheSize = 100,
    enableMemoization = true,
    enableCleanup = true,
    cleanupInterval = 30000, // 30 seconds
    memoryThreshold = 100 * 1024 * 1024 // 100MB
  } = config

  // Reactive state
  const cache = ref<Map<string, CacheEntry>>(new Map())
  const metrics = ref<PerformanceMetrics>({
    memoryUsage: 0,
    cacheSize: 0,
    cacheHitRate: 0,
    debouncedOperations: 0,
    throttledOperations: 0,
    memoizedComputations: 0,
    cleanupRuns: 0,
    lastCleanupTime: 0
  })

  // Memoization helpers
  const memoizedComputations = ref<Map<string, { result: unknown, deps: unknown[], timestamp: number }>>(new Map())
  const memoizationStats = ref({ hits: 0, misses: 0 })

  // Memory monitoring
  const memoryUsage = ref(0)
  const memoryMonitorInterval = ref<NodeJS.Timeout>()

  // Debounce function factory
  const createDebounced = <T extends (...args: unknown[]) => any>(
    fn: T,
    delay: number = debounceDelay
  ) => {
    const debouncedFn = useDebounceFn(fn, delay)

    return (...args: Parameters<T>) => {
      metrics.value.debouncedOperations++
      return debouncedFn(...args)
    }
  }

  // Throttle function factory
  const createThrottled = <T extends (...args: unknown[]) => any>(
    fn: T,
    delay: number = throttleDelay
  ) => {
    const throttledFn = useThrottleFn(fn, delay)

    return (...args: Parameters<T>) => {
      metrics.value.throttledOperations++
      return throttledFn(...args)
    }
  }

  // Memoized computation factory
  const createMemoized = <T extends (...args: unknown[]) => any>(
    fn: T,
    key: string,
    dependencies: unknown[] = []
  ) => {
    if (!enableMemoization) {
      return fn
    }

    return (...args: Parameters<T>): ReturnType<T> => {
      const cached = memoizedComputations.value.get(key)

      if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes TTL
        const depsMatch = dependencies.length === cached.deps.length &&
          dependencies.every((dep, i) => dep === cached.deps[i])

        if (depsMatch) {
          memoizationStats.value.hits++
          metrics.value.memoizedComputations++
          return cached.result as ReturnType<T>
        }
      }

      const result = fn(...args)
      memoizedComputations.value.set(key, {
        result,
        deps: dependencies,
        timestamp: Date.now()
      })

      memoizationStats.value.misses++
      metrics.value.memoizedComputations++
      return result
    }
  }

  // Cache management
  const setCache = <T>(key: string, value: T, _ttl: number = 300000) => {
    if (!enableMemoization) return

    const size = calculateSize(value)
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      hits: 0,
      size
    }

    cache.value.set(key, entry)

    // Check cache size limit
    if (cache.value.size > maxCacheSize) {
      cleanupCache()
    }

    updateMetrics()
  }

  const getCache = <T>(key: string): T | null => {
    if (!enableMemoization) return null

    const entry = cache.value.get(key) as CacheEntry<T>

    if (entry) {
      const now = Date.now()
      if (now - entry.timestamp < 300000) { // 5 minutes TTL
        entry.hits++
        return entry.value
      } else {
        cache.value.delete(key)
      }
    }

    return null
  }

  const hasCache = (key: string): boolean => {
    if (!enableMemoization) return false

    const entry = cache.value.get(key)
    if (!entry) return false

    const now = Date.now()
    if (now - entry.timestamp >= 300000) {
      cache.value.delete(key)
      return false
    }

    return true
  }

  const deleteCache = (key: string): boolean => {
    return cache.value.delete(key)
  }

  const clearCache = () => {
    cache.value.clear()
    memoizedComputations.value.clear()
    updateMetrics()
  }

  // Cache cleanup
  const cleanupCache = () => {
    if (!enableCleanup) return

    const now = Date.now()
    const entries = Array.from(cache.value.entries())

    // Sort by hits (keep most used) and recency
    entries.sort(([, a], [, b]) => {
      const aScore = a.hits + (now - a.timestamp) / 1000
      const bScore = b.hits + (now - b.timestamp) / 1000
      return bScore - aScore
    })

    // Keep only top entries
    const keepCount = Math.floor(maxCacheSize * 0.8)
    const toKeep = entries.slice(0, keepCount)

    cache.value.clear()
    toKeep.forEach(([key, entry]) => cache.value.set(key, entry))

    // Clean expired memoized computations
    for (const [key, comp] of memoizedComputations.value.entries()) {
      if (now - comp.timestamp > 300000) {
        memoizedComputations.value.delete(key)
      }
    }

    metrics.value.cleanupRuns++
    metrics.value.lastCleanupTime = now
    updateMetrics()
  }

  // Calculate size of object (rough estimation)
  const calculateSize = (obj: unknown): number => {
    try {
      return JSON.stringify(obj).length * 2 // 2 bytes per character
    } catch {
      return 1000 // Default size for non-serializable objects
    }
  }

  // Update performance metrics
  const updateMetrics = () => {
    metrics.value.cacheSize = cache.value.size
    metrics.value.memoryUsage = memoryUsage.value

    const totalHits = Array.from(cache.value.values()).reduce((sum, entry) => sum + entry.hits, 0)
    metrics.value.cacheHitRate = cache.value.size > 0 ? totalHits / cache.value.size : 0
  }

  // Memory monitoring
  const startMemoryMonitoring = () => {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      memoryMonitorInterval.value = setInterval(() => {
        const memory = (performance as any).memory
        if (memory) {
          memoryUsage.value = memory.usedJSHeapSize

          // Auto-cleanup if memory threshold exceeded
          if (memoryUsage.value > memoryThreshold) {
            cleanupCache()
          }
        }
        updateMetrics()
      }, 5000) // Check every 5 seconds
    }
  }

  const stopMemoryMonitoring = () => {
    if (memoryMonitorInterval.value) {
      clearInterval(memoryMonitorInterval.value)
    }
  }

  // Performance optimization helpers
  const optimizeForLargeLists = <T>(items: T[]) => {
    if (items.length > 1000) {
      // For very large lists, use more aggressive debouncing
      return createDebounced(<R>(fn: () => R) => fn(), 500)
    }
    return createDebounced(<R>(fn: () => R) => fn(), debounceDelay)
  }

  const optimizeForAnimations = <T>(fn: T) => {
    // Use RAF for animations
    const raf = useRafFn(fn as () => void)
    return raf.pause
  }

  const batchOperations = <T>(operations: (() => T)[]) => {
    const results: T[] = []

    // Batch operations in a single frame
    requestAnimationFrame(() => {
      operations.forEach(op => {
        try {
          results.push(op())
        } catch (error) {
          console.error('Batch operation failed:', error)
        }
      })
    })

    return results
  }

  // RAF-based rendering optimization
  const scheduleRender = (fn: () => void) => {
    return requestAnimationFrame(fn)
  }

  const cancelRender = (id: number) => {
    cancelAnimationFrame(id)
  }

  // Cleanup on unmount
  onMounted(() => {
    startMemoryMonitoring()

    if (enableCleanup) {
      setInterval(cleanupCache, cleanupInterval)
    }
  })

  onUnmounted(() => {
    stopMemoryMonitoring()
    clearCache()
  })

  return {
    // Core utilities
    createDebounced,
    createThrottled,
    createMemoized,

    // Cache management
    setCache,
    getCache,
    hasCache,
    deleteCache,
    clearCache,
    cleanupCache,

    // Performance helpers
    optimizeForLargeLists,
    optimizeForAnimations,
    batchOperations,
    scheduleRender,
    cancelRender,

    // Metrics and monitoring
    metrics,
    memoizationStats,
    memoryUsage,

    // Utilities
    updateMetrics,
    calculateSize
  }
}

// Global performance manager instance
export const globalPerformanceManager = usePerformanceManager()

// Performance presets for common scenarios
export const performancePresets = {
  // For heavy computations
  heavyComputation: {
    debounceDelay: 500,
    throttleDelay: 100,
    maxCacheSize: 50,
    enableMemoization: true,
    cleanupInterval: 60000
  },

  // For real-time updates
  realtime: {
    debounceDelay: 50,
    throttleDelay: 16,
    maxCacheSize: 200,
    enableMemoization: true,
    cleanupInterval: 15000
  },

  // For infrequent operations
  batched: {
    debounceDelay: 1000,
    throttleDelay: 200,
    maxCacheSize: 100,
    enableMemoization: true,
    cleanupInterval: 120000
  },

  // For minimal overhead
  minimal: {
    debounceDelay: 100,
    throttleDelay: 50,
    maxCacheSize: 20,
    enableMemoization: false,
    cleanupInterval: 300000
  }
}

export default usePerformanceManager