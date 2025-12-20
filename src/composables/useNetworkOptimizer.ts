/**
 * Network Performance Optimizer
 * Handles request batching, caching, compression, and deduplication
 */

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { usePerformanceManager } from './usePerformanceManager'

export interface NetworkRequest {
  id: string
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: unknown
  priority: 'high' | 'normal' | 'low'
  timestamp: number
  retryCount?: number
  timeout?: number
  headers?: Record<string, string>
}

export interface NetworkResponse {
  id: string
  status: number
  data: unknown
  headers: Record<string, string>
  timestamp: number
  duration: number
  fromCache: boolean
  compressed: boolean
}

export interface NetworkConfig {
  enableBatching?: boolean
  batchSize?: number
  batchDelay?: number
  enableCache?: boolean
  cacheTTL?: number
  enableCompression?: boolean
  compressionThreshold?: number
  enableDeduplication?: boolean
  maxRetries?: number
  retryDelay?: number
  timeout?: number
}

export interface NetworkMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  cacheHits: number
  cacheMisses: number
  batchedRequests: number
  compressedRequests: number
  deduplicatedRequests: number
  averageResponseTime: number
  totalDataTransferred: number
  compressionRatio: number
  errorRate: number
}

export function useNetworkOptimizer(config: NetworkConfig = {}) {
  const {
    enableBatching = true,
    batchSize = 10,
    batchDelay = 100,
    enableCache = true,
    cacheTTL = 300000, // 5 minutes
    enableCompression = true,
    compressionThreshold = 1024, // 1KB
    enableDeduplication = true,
    maxRetries = 3,
    retryDelay = 1000,
    timeout = 10000
  } = config

  // Performance manager
  const performance = usePerformanceManager({
    debounceDelay: batchDelay,
    enableMemoization: true,
    maxCacheSize: 100
  })

  // Reactive state
  const requestQueue = ref<Map<string, NetworkRequest>>(new Map())
  const pendingRequests = ref<Map<string, Promise<any>>>(new Map())
  const responseCache = ref<Map<string, NetworkResponse>>(new Map())
  const isProcessingBatch = ref(false)

  // Metrics
  const metrics = ref<NetworkMetrics>({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    batchedRequests: 0,
    compressedRequests: 0,
    deduplicatedRequests: 0,
    averageResponseTime: 0,
    totalDataTransferred: 0,
    compressionRatio: 0,
    errorRate: 0
  })

  // Performance monitoring
  const connectionSpeed = ref<number | null>(null)
  const onlineStatus = ref(navigator.onLine)
  const effectiveType = ref<string>('unknown')

  // Generate unique request ID
  const generateRequestId = (request: Partial<NetworkRequest>): string => {
    const key = `${request.method || 'GET'}_${request.url}_${JSON.stringify(request.data || {})}`
    return btoa(key).replace(/[+/=]/g, '').substring(0, 16)
  }

  // Check cache for existing response
  const getCachedResponse = (request: NetworkRequest): NetworkResponse | null => {
    if (!enableCache) return null

    const cacheKey = generateRequestId(request)
    const cached = responseCache.value.get(cacheKey)

    if (!cached) return null

    // Check TTL
    if (Date.now() - cached.timestamp > cacheTTL) {
      responseCache.value.delete(cacheKey)
      return null
    }

    metrics.value.cacheHits++
    return cached
  }

  // Cache response
  const setCachedResponse = (request: NetworkRequest, response: NetworkResponse) => {
    if (!enableCache) return

    const cacheKey = generateRequestId(request)
    responseCache.value.set(cacheKey, response)
  }

  // Compress data if needed
  const compressData = async (data: unknown): Promise<{ compressed: boolean; data: unknown }> => {
    if (!enableCompression || !data) return { compressed: false, data }

    const serialized = typeof data === 'string' ? data : JSON.stringify(data)

    if (serialized.length < compressionThreshold) {
      return { compressed: false, data }
    }

    try {
      // Use CompressionStream API if available
      if ('CompressionStream' in window) {
        const stream = new CompressionStream('gzip')
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()

        writer.write(new TextEncoder().encode(serialized))
        writer.close()

        const chunks: Uint8Array[] = []
        let done = false

        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) chunks.push(value)
        }

        const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        for (const chunk of chunks) {
          compressed.set(chunk, offset)
          offset += chunk.length
        }

        const compressionRatio = compressed.length / serialized.length
        metrics.value.compressionRatio = (metrics.value.compressionRatio + compressionRatio) / 2

        return {
          compressed: true,
          data: {
            _compressed: true,
            data: Array.from(compressed)
          }
        }
      }
    } catch (error) {
      console.warn('Compression failed:', error)
    }

    return { compressed: false, data }
  }

  // Decompress data
  const _decompressData = async (compressedData: unknown): Promise<unknown> => {
    const compressed = compressedData as { _compressed?: boolean; data?: ArrayLike<number> } | null
    if (!compressed?._compressed) return compressedData

    try {
      if ('DecompressionStream' in window) {
        const stream = new DecompressionStream('gzip')
        const writer = stream.writable.getWriter()
        const reader = stream.readable.getReader()

        const uint8Array = new Uint8Array(compressed.data || [])
        writer.write(uint8Array)
        writer.close()

        const chunks: Uint8Array[] = []
        let done = false

        while (!done) {
          const { value, done: readerDone } = await reader.read()
          done = readerDone
          if (value) chunks.push(value)
        }

        const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        for (const chunk of chunks) {
          decompressed.set(chunk, offset)
          offset += chunk.length
        }

        return JSON.parse(new TextDecoder().decode(decompressed))
      }
    } catch (error) {
      console.warn('Decompression failed:', error)
    }

    return compressedData
  }

  // Make HTTP request with optimization
  const makeRequest = async (requestConfig: Partial<NetworkRequest>): Promise<any> => {
    const request: NetworkRequest = {
      id: generateRequestId(requestConfig),
      url: requestConfig.url!,
      method: requestConfig.method || 'GET',
      data: requestConfig.data,
      priority: requestConfig.priority || 'normal',
      timestamp: Date.now(),
      retryCount: 0,
      timeout: requestConfig.timeout || timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': enableCache ? `max-age=${Math.floor(cacheTTL / 1000)}` : 'no-cache',
        ...requestConfig.headers
      }
    }

    metrics.value.totalRequests++

    // Check cache first
    const cachedResponse = getCachedResponse(request)
    if (cachedResponse) {
      return cachedResponse.data
    }

    // Check for deduplication
    if (enableDeduplication && pendingRequests.value.has(request.id)) {
      metrics.value.deduplicatedRequests++
      return pendingRequests.value.get(request.id)
    }

    // Add compression headers
    if (enableCompression && request.data && request.headers) {
      request.headers['Accept-Encoding'] = 'gzip, deflate'
    }

    // Create request promise
    const requestPromise = executeRequest(request)
    pendingRequests.value.set(request.id, requestPromise)

    try {
      const response = await requestPromise
      return response.data
    } finally {
      pendingRequests.value.delete(request.id)
    }
  }

  // Execute individual request
  const executeRequest = async (request: NetworkRequest): Promise<NetworkResponse> => {
    const startTime = Date.now()

    try {
      // Compress data if needed
      let requestData = request.data
      if (requestData && enableCompression) {
        const compressionResult = await compressData(requestData)
        if (compressionResult.compressed) {
          requestData = compressionResult.data
          metrics.value.compressedRequests++
        }
      }

      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: request.method,
        headers: {
          ...request.headers,
          ...(enableCompression ? { 'Accept-Encoding': 'gzip, deflate' } : {})
        }
      }

      if (request.data && request.method !== 'GET') {
        fetchOptions.body = typeof requestData === 'string' ? requestData : JSON.stringify(requestData)
      }

      // Add timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), request.timeout)
      fetchOptions.signal = controller.signal

      const response = await fetch(request.url, fetchOptions)
      clearTimeout(timeoutId)

      const duration = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      let responseData = await response.text()

      // Try to decompress if needed
      try {
        const contentType = response.headers.get('content-type')
        if (contentType?.includes('application/json')) {
          responseData = JSON.parse(responseData)
        }
      } catch {
        // Keep as text if not JSON
      }

      const networkResponse: NetworkResponse = {
        id: request.id,
        status: response.status,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries()),
        timestamp: Date.now(),
        duration,
        fromCache: false,
        compressed: metrics.value.compressedRequests > 0
      }

      // Cache the response
      setCachedResponse(request, networkResponse)

      // Update metrics
      metrics.value.successfulRequests++
      metrics.value.averageResponseTime = (metrics.value.averageResponseTime + duration) / 2
      metrics.value.totalDataTransferred += JSON.stringify(responseData).length

      return networkResponse

    } catch (error) {
      metrics.value.failedRequests++
      metrics.value.errorRate = metrics.value.failedRequests / metrics.value.totalRequests

      // Retry logic
      if (request.retryCount! < maxRetries) {
        request.retryCount = (request.retryCount || 0) + 1
        await new Promise(resolve => setTimeout(resolve, retryDelay * request.retryCount!))
        return executeRequest(request)
      }

      throw error
    }
  }

  // Batch processing
  const processBatch = performance.createDebounced(async () => {
    if (requestQueue.value.size === 0 || isProcessingBatch.value) return

    isProcessingBatch.value = true
    const requests = Array.from(requestQueue.value.values())
    requestQueue.value.clear()

    // Sort by priority
    requests.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    // Process in batches
    const batches = []
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize))
    }

    try {
      for (const batch of batches) {
        await Promise.allSettled(
          batch.map(request => executeRequest(request))
        )
        metrics.value.batchedRequests += batch.length
      }
    } finally {
      isProcessingBatch.value = false
    }
  }, batchDelay)

  // Queue request for batching
  const queueRequest = (requestConfig: Partial<NetworkRequest>): Promise<any> => {
    if (!enableBatching) {
      return makeRequest(requestConfig)
    }

    const request: NetworkRequest = {
      id: generateRequestId(requestConfig),
      url: requestConfig.url!,
      method: requestConfig.method || 'GET',
      data: requestConfig.data,
      priority: requestConfig.priority || 'normal',
      timestamp: Date.now()
    }

    requestQueue.value.set(request.id, request)
    processBatch()

    // Return a promise that resolves when the request is processed
    return new Promise((resolve, reject) => {
      const checkStatus = () => {
        if (!requestQueue.value.has(request.id)) {
          // Request has been processed
          makeRequest(requestConfig).then(resolve).catch(reject)
        } else {
          setTimeout(checkStatus, 50)
        }
      }
      checkStatus()
    })
  }

  // Performance monitoring
  const measureConnectionSpeed = async (): Promise<number> => {
    try {
      const startTime = Date.now()
      const _response = await fetch('https://httpbin.org/bytes/1024', {
        method: 'GET',
        cache: 'no-cache'
      })
      const duration = Date.now() - startTime
      const speedKbps = (1024 * 8) / (duration / 1000) // Convert to kbps
      connectionSpeed.value = speedKbps
      return speedKbps
    } catch {
      connectionSpeed.value = 0
      return 0
    }
  }

  // Get network information
  const getNetworkInfo = () => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      effectiveType.value = connection.effectiveType || 'unknown'
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      }
    }
    return null
  }

  // Reactive computed properties
  const networkPerformance = computed(() => ({
    ...metrics.value,
    connectionSpeed: connectionSpeed.value,
    onlineStatus: onlineStatus.value,
    effectiveType: effectiveType.value,
    cacheEfficiency: metrics.value.cacheHits / (metrics.value.cacheHits + metrics.value.cacheMisses) || 0,
    batchingEfficiency: enableBatching ? (metrics.value.batchedRequests / metrics.value.totalRequests) * 100 : 0,
    compressionEfficiency: enableCompression ? (1 - metrics.value.compressionRatio) * 100 : 0
  }))

  // Event listeners
  const setupEventListeners = () => {
    const handleOnline = () => {
      onlineStatus.value = true
      console.log('🌐 Network connection restored')
    }

    const handleOffline = () => {
      onlineStatus.value = false
      console.log('📡 Network connection lost')
    }

    const handleConnectionChange = () => {
      getNetworkInfo()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    if ('connection' in navigator) {
      (navigator as any).connection.addEventListener('change', handleConnectionChange)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)

      if ('connection' in navigator) {
        (navigator as any).connection.removeEventListener('change', handleConnectionChange)
      }
    }
  }

  // Clear cache
  const clearCache = () => {
    responseCache.value.clear()
    performance.clearCache()
    console.log('🧹 Network cache cleared')
  }

  // Cleanup
  const cleanup = () => {
    requestQueue.value.clear()
    pendingRequests.value.clear()
    clearCache()
  }

  // Setup
  onMounted(() => {
    const cleanupListeners = setupEventListeners()
    getNetworkInfo()
    measureConnectionSpeed()

    onUnmounted(cleanupListeners)
  })

  onUnmounted(cleanup)

  return {
    // Core operations
    makeRequest,
    queueRequest,

    // Performance
    networkPerformance,
    connectionSpeed,
    onlineStatus,
    effectiveType,

    // Utilities
    clearCache,
    cleanup,
    measureConnectionSpeed,
    getNetworkInfo,

    // State
    isProcessingBatch,
    queueLength: computed(() => requestQueue.value.size),
    cacheSize: computed(() => responseCache.value.size)
  }
}

// Global network optimizer instance
export const globalNetworkOptimizer = useNetworkOptimizer()

export default useNetworkOptimizer