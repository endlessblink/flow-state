/**
 * Static Resource Caching System
 *
 * This composable provides intelligent caching for static resources including:
 * - CSS files and design tokens
 * - Images and icons
 * - Fonts and web fonts
 * - JSON configuration files
 */

import { ref, computed } from 'vue'

// Types for resource caching
interface CachedResource {
  data: string | ArrayBuffer
  timestamp: number
  expiresAt: number
  etag?: string
  lastModified?: string
  size: number
  mimeType: string
}

interface ResourceRequest {
  url: string
  method?: 'GET' | 'HEAD'
  headers?: Record<string, string>
  cacheKey?: string
  ttl?: number
  priority?: 'high' | 'normal' | 'low'
}

interface CacheConfig {
  maxSize: number // Maximum cache size in bytes
  maxEntries: number // Maximum number of cached entries
  defaultTTL: number // Default time to live in milliseconds
  enableCompression: boolean
  enableServiceWorker: boolean
}

// Cache configuration for different resource types
const RESOURCE_CONFIGS: Record<string, Partial<CacheConfig>> = {
  css: {
    defaultTTL: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 2 * 1024 * 1024, // 2MB
  },
  js: {
    defaultTTL: 60 * 60 * 1000, // 1 hour
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  image: {
    defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  font: {
    defaultTTL: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxSize: 5 * 1024 * 1024, // 5MB
  },
  json: {
    defaultTTL: 15 * 60 * 1000, // 15 minutes
    maxSize: 1 * 1024 * 1024, // 1MB
  }
}

// Default configuration
const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 50 * 1024 * 1024, // 50MB total
  maxEntries: 1000,
  defaultTTL: 60 * 60 * 1000, // 1 hour
  enableCompression: true,
  enableServiceWorker: true
}

/**
 * Static Resource Cache composable
 */
export function useStaticResourceCache(config: Partial<CacheConfig> = {}) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  // Cache storage
  const cache = ref<Map<string, CachedResource>>(new Map())
  const loading = ref<Set<string>>(new Set())
  const error = ref<Map<string, Error>>(new Map())

  // Metrics
  const metrics = ref({
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalBytesLoaded: 0,
    currentCacheSize: 0,
    compressionSavings: 0,
    errorRate: 0
  })

  // Computed properties
  const cacheHitRate = computed(() => {
    const total = metrics.value.totalRequests
    return total > 0 ? (metrics.value.cacheHits / total * 100).toFixed(1) : '0'
  })

  const cacheUtilization = computed(() => {
    const maxBytes = finalConfig.maxSize
    return maxBytes > 0 ? (metrics.value.currentCacheSize / maxBytes * 100).toFixed(1) : '0'
  })

  /**
   * Get resource type from URL
   */
  const getResourceType = (url: string): string => {
    const extension = url.split('.').pop()?.toLowerCase()

    if (['css', 'scss', 'sass', 'less'].includes(extension || '')) return 'css'
    if (['js', 'mjs', 'ts', 'jsx', 'tsx'].includes(extension || '')) return 'js'
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(extension || '')) return 'image'
    if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(extension || '')) return 'font'
    if (['json'].includes(extension || '')) return 'json'

    return 'other'
  }

  /**
   * Get configuration for resource type
   */
  const getResourceConfig = (url: string): CacheConfig => {
    const type = getResourceType(url)
    const typeConfig = RESOURCE_CONFIGS[type] || {}

    return {
      ...finalConfig,
      ...typeConfig
    }
  }

  /**
   * Generate cache key for resource
   */
  const generateCacheKey = (request: ResourceRequest): string => {
    const method = request.method || 'GET'
    const url = request.url
    const headers = new Map(Object.entries(request.headers || {}))

    // Include relevant headers in cache key
    const relevantHeaders = ['accept', 'accept-encoding']
    const headerString = Array.from(headers.entries())
      .filter(([key]) => relevantHeaders.includes(key.toLowerCase()))
      .map(([key, value]) => `${key}:${value}`)
      .sort()
      .join(';')

    return `${method}:${url}:${headerString}`
  }

  /**
   * Check if cached resource is valid
   */
  const isCacheValid = (cached: CachedResource, ttl?: number): boolean => {
    const now = Date.now()
    const resourceTTL = ttl || cached.expiresAt - cached.timestamp

    return (cached.timestamp + resourceTTL) > now
  }

  /**
   * Estimate resource size
   */
  const estimateResourceSize = (data: string | ArrayBuffer): number => {
    if (data instanceof ArrayBuffer) {
      return data.byteLength
    }
    return new Blob([data]).size
  }

  /**
   * Compress data if beneficial
   */
  const compressData = async (data: string, mimeType: string): Promise<{ compressed: boolean; data: string | ArrayBuffer }> => {
    if (!finalConfig.enableCompression) {
      return { compressed: false, data }
    }

    // Don't compress already compressed content
    if (mimeType.includes('gzip') || mimeType.includes('br') || mimeType.includes('deflate')) {
      return { compressed: false, data }
    }

    try {
      // Use CompressionStream API if available
      if ('CompressionStream' in window) {
        const responseBody = new Response(data).body
        if (!responseBody) {
          return { data, compressed: false }
        }
        const compressedStream = responseBody.pipeThrough(new CompressionStream('gzip'))
        const compressedArrayBuffer = await new Response(compressedStream).arrayBuffer()

        const originalSize = estimateResourceSize(data)
        const compressedSize = compressedArrayBuffer.byteLength

        // Only use compression if it actually reduces size
        if (compressedSize < originalSize * 0.9) {
          metrics.value.compressionSavings += originalSize - compressedSize
          return { compressed: true, data: compressedArrayBuffer }
        }
      }
    } catch (error) {
      console.warn('⚠️ [STATIC_CACHE] Compression failed:', error)
    }

    return { compressed: false, data }
  }

  /**
   * Evict least recently used cache entries
   */
  const evictLRU = (requiredSpace: number): void => {
    if (cache.value.size === 0) return

    const entries = Array.from(cache.value.entries())

    // Sort by last access time (oldest first)
    entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)

    let freedSpace = 0
    const toRemove: string[] = []

    for (const [key, cached] of entries) {
      if (freedSpace >= requiredSpace) break

      toRemove.push(key)
      freedSpace += cached.size
      metrics.value.currentCacheSize -= cached.size
    }

    toRemove.forEach(key => cache.value.delete(key))

    if (toRemove.length > 0) {
      console.log(`🗑️ [STATIC_CACHE] Evicted ${toRemove.length} entries (${(freedSpace / 1024).toFixed(1)}KB)`)
    }
  }

  /**
   * Load static resource with caching
   */
  const loadResource = async (request: ResourceRequest): Promise<string | ArrayBuffer> => {
    const url = request.url
    const cacheKey = request.cacheKey || generateCacheKey(request)
    const resourceConfig = getResourceConfig(url)

    metrics.value.totalRequests++

    // Check if already loading
    if (loading.value.has(cacheKey)) {
      console.log(`⏳ [STATIC_CACHE] Already loading: ${url}`)
      // Wait for loading to complete (simplified - in production you'd use promises)
      while (loading.value.has(cacheKey)) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      return cache.value.get(cacheKey)?.data || Promise.reject(new Error('Loading failed'))
    }

    // Check cache first
    if (cache.value.has(cacheKey)) {
      const cached = cache.value.get(cacheKey)
      if (cached && isCacheValid(cached, request.ttl)) {
        metrics.value.cacheHits++
        console.log(`🎯 [STATIC_CACHE] Cache hit: ${url}`)
        return cached.data
      } else if (cached) {
        // Remove expired entry
        cache.value.delete(cacheKey)
        metrics.value.currentCacheSize -= cached.size
      }
    }

    // Mark as loading
    loading.value.add(cacheKey)
    metrics.value.cacheMisses++

    try {
      console.log(`📥 [STATIC_CACHE] Loading: ${url}`)

      // Fetch resource
      const response = await fetch(url, {
        method: request.method || 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          ...request.headers
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      let data: string | ArrayBuffer
      const mimeType = response.headers.get('content-type') || 'text/plain'

      if (mimeType.startsWith('image/') || mimeType.startsWith('font/') || mimeType.includes('octet-stream')) {
        data = await response.arrayBuffer()
      } else {
        data = await response.text()
      }

      // Compress if beneficial
      const { compressed, data: processedData } = await compressData(data as string, mimeType)

      // Create cache entry
      const cachedResource: CachedResource = {
        data: processedData,
        timestamp: Date.now(),
        expiresAt: Date.now() + (request.ttl || resourceConfig.defaultTTL),
        etag: response.headers.get('etag') || undefined,
        lastModified: response.headers.get('last-modified') || undefined,
        size: estimateResourceSize(processedData),
        mimeType
      }

      // Check if we have space in cache
      if (cachedResource.size + metrics.value.currentCacheSize > resourceConfig.maxSize) {
        evictLRU(cachedResource.size)
      }

      // Add to cache
      cache.value.set(cacheKey, cachedResource)
      metrics.value.currentCacheSize += cachedResource.size
      metrics.value.totalBytesLoaded += cachedResource.size

      console.log(`✅ [STATIC_CACHE] Cached: ${url} (${(cachedResource.size / 1024).toFixed(1)}KB, ${compressed ? 'compressed' : 'uncompressed'})`)

      return processedData

    } catch (err) {
      const cacheError = err as Error
      error.value.set(cacheKey, cacheError)
      metrics.value.errorRate = (error.value.size / metrics.value.totalRequests) * 100
      console.error(`❌ [STATIC_CACHE] Failed to load ${url}:`, cacheError)
      throw cacheError
    } finally {
      loading.value.delete(cacheKey)
    }
  }

  /**
   * Preload multiple resources
   */
  const preloadResources = async (requests: ResourceRequest[]): Promise<void> => {
    console.log(`📦 [STATIC_CACHE] Preloading ${requests.length} resources`)

    // Process in priority order
    const sortedRequests = requests.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 }
      const aPriority = priorityOrder[a.priority || 'normal'] || 2
      const bPriority = priorityOrder[b.priority || 'normal'] || 2
      return bPriority - aPriority
    })

    // Batch process with concurrency limit
    const concurrencyLimit = 4
    for (let i = 0; i < sortedRequests.length; i += concurrencyLimit) {
      const batch = sortedRequests.slice(i, i + concurrencyLimit)
      await Promise.allSettled(
        batch.map(request => loadResource(request))
      )
    }
  }

  /**
   * Clear cache entries
   */
  const clearCache = (pattern?: string | RegExp): number => {
    let cleared = 0

    if (pattern) {
      cache.value.forEach((_, key) => {
        if (typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key)) {
          const cached = cache.value.get(key)!
          cache.value.delete(key)
          metrics.value.currentCacheSize -= cached.size
          cleared++
        }
      })
    } else {
      metrics.value.currentCacheSize = 0
      cleared = cache.value.size
      cache.value.clear()
    }

    if (cleared > 0) {
      console.log(`🗑️ [STATIC_CACHE] Cleared ${cleared} cache entries`)
    }

    return cleared
  }

  /**
   * Get cache statistics
   */
  const getCacheStats = () => ({
    size: cache.value.size,
    maxEntries: finalConfig.maxEntries,
    maxSize: finalConfig.maxSize,
    currentCacheSize: metrics.value.currentCacheSize,
    totalRequests: metrics.value.totalRequests,
    cacheHits: metrics.value.cacheHits,
    cacheMisses: metrics.value.cacheMisses,
    cacheHitRate: cacheHitRate.value,
    cacheUtilization: cacheUtilization.value,
    totalBytesLoaded: metrics.value.totalBytesLoaded,
    compressionSavings: metrics.value.compressionSavings,
    errorRate: metrics.value.errorRate,
    compressionRatio: metrics.value.totalBytesLoaded > 0
      ? (metrics.value.compressionSavings / metrics.value.totalBytesLoaded * 100).toFixed(1)
      : '0'
  })

  /**
   * Check if resource is cached
   */
  const isCached = (url: string): boolean => {
    const cacheKey = generateCacheKey({ url })
    return cache.value.has(cacheKey)
  }

  /**
   * Force cleanup of expired entries
   */
  const forceCleanup = (): void => {
    const now = Date.now()
    const expiredKeys: string[] = []

    cache.value.forEach((cached, key) => {
      if (cached.expiresAt <= now) {
        expiredKeys.push(key)
        metrics.value.currentCacheSize -= cached.size
      }
    })

    expiredKeys.forEach(key => cache.value.delete(key))

    if (expiredKeys.length > 0) {
      console.log(`🧹 [STATIC_CACHE] Cleaned up ${expiredKeys.length} expired entries`)
    }
  }

  // Auto-cleanup every 10 minutes
  setInterval(forceCleanup, 10 * 60 * 1000)

  return {
    // Core methods
    loadResource,
    preloadResources,

    // Cache management
    clearCache,
    forceCleanup,

    // Status
    isCached,
    getCacheStats,

    // Reactive state
    loading: computed(() => loading.value.size),
    error: computed(() => Array.from(error.value.values())),
    metrics: computed(() => metrics.value),
    cacheHitRate,
    cacheUtilization
  }
}

// Export singleton instance for global use
export const staticResourceCache = useStaticResourceCache()