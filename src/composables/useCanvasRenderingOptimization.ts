/**
 * Canvas Rendering Optimization System
 *
 * Provides advanced rendering optimizations for complex node types,
 * including level-of-detail rendering, lazy loading, and memory management.
 */

import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useThrottleFn, useDebounceFn } from '@vueuse/core'
import type { Node } from '@braks/vueflow'

export interface RenderingConfig {
  /** Enable level-of-detail rendering */
  enableLOD?: boolean
  /** LOD thresholds for different detail levels */
  lodThresholds?: {
    level1: number  // High detail
    level2: number  // Medium detail
    level3: number  // Low detail
    level4: number  // Minimal detail
  }
  /** Enable node caching */
  enableCaching?: boolean
  /** Maximum cache size */
  maxCacheSize?: number
  /** Cache TTL in milliseconds */
  cacheTTL?: number
  /** Enable lazy loading of node content */
  enableLazyLoading?: boolean
  /** Lazy load delay in milliseconds */
  lazyLoadDelay?: number
  /** Enable offscreen canvas rendering */
  enableOffscreenCanvas?: boolean
  /** Enable Web Workers for heavy computations */
  enableWebWorkers?: boolean
  /** Enable GPU acceleration hints */
  enableGPUAcceleration?: boolean
  /** Enable skeleton loading states */
  enableSkeletonLoading?: boolean
  /** Enable image optimization */
  enableImageOptimization?: boolean
  /** Maximum image size in pixels */
  maxImageSize?: number
  /** Enable compression for large data */
  enableCompression?: boolean
}

export interface NodeRenderingState {
  nodeId: string
  isVisible: boolean
  lodLevel: number
  isLoaded: boolean
  isLoading: boolean
  cacheKey: string
  lastRenderTime: number
  renderCount: number
  memoryUsage: number
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface RenderCache {
  nodeData: string
  timestamp: number
  lodLevel: number
  size: number
  renderTime: number
}

export interface RenderingMetrics {
  totalNodes: number
  visibleNodes: number
  cachedNodes: number
  lazyLoadedNodes: number
  averageRenderTime: number
  memoryUsage: number
  cacheHitRate: number
  lodDistribution: {
    level1: number
    level2: number
    level3: number
    level4: number
  }
  frameRate: number
}

export function useCanvasRenderingOptimization(
  nodes: Ref<Node[]>,
  viewportBounds: Ref<{ x: number; y: number; width: number; height: number; zoom: number }>,
  config: RenderingConfig = {}
) {
  // Configuration
  const finalConfig = {
    enableLOD: true,
    lodThresholds: {
      level1: 200,  // High detail within 200px
      level2: 400,  // Medium detail within 400px
      level3: 800,  // Low detail within 800px
      level4: 1600  // Minimal detail within 1600px
    },
    enableCaching: true,
    maxCacheSize: 1000,
    cacheTTL: 60000, // 1 minute
    enableLazyLoading: true,
    lazyLoadDelay: 200,
    enableOffscreenCanvas: false, // Disabled by default due to compatibility
    enableWebWorkers: false, // Disabled by default due to complexity
    enableGPUAcceleration: true,
    enableSkeletonLoading: true,
    enableImageOptimization: true,
    maxImageSize: 512,
    enableCompression: false,
    ...config
  } as const

  // State
  const isInitialized = ref(false)
  const nodeStates = ref<Map<string, NodeRenderingState>>(new Map())
  const renderCache = ref<Map<string, RenderCache>>(new Map())
  const isLoading = ref(false)
  const renderingMetrics = ref<RenderingMetrics>({
    totalNodes: 0,
    visibleNodes: 0,
    cachedNodes: 0,
    lazyLoadedNodes: 0,
    averageRenderTime: 0,
    memoryUsage: 0,
    cacheHitRate: 0,
    lodDistribution: {
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0
    },
    frameRate: 60
  })

  // Performance monitoring
  const frameCount = ref(0)
  const lastFrameTime = ref(performance.now())
  const renderTimes = ref<number[]>([])
  const cacheHits = ref(0)
  const cacheMisses = ref(0)

  // Lazy loading queue
  const lazyLoadQueue = ref<Set<string>>(new Set())
  const lazyLoadTimer = ref<number | null>(null)

  // Utility functions
  const calculateLODLevel = (node: Node, bounds: typeof viewportBounds.value): number => {
    if (!finalConfig.enableLOD) return 1

    const nodeCenterX = node.position.x + (node.width || 200) / 2
    const nodeCenterY = node.position.y + (node.height || 100) / 2
    const viewportCenterX = bounds.x + bounds.width / 2
    const viewportCenterY = bounds.y + bounds.height / 2

    const distance = Math.sqrt(
      Math.pow(nodeCenterX - viewportCenterX, 2) +
      Math.pow(nodeCenterY - viewportCenterY, 2)
    ) / bounds.zoom

    if (distance <= finalConfig.lodThresholds.level1) return 1
    if (distance <= finalConfig.lodThresholds.level2) return 2
    if (distance <= finalConfig.lodThresholds.level3) return 3
    if (distance <= finalConfig.lodThresholds.level4) return 4
    return 4
  }

  const isNodeInViewport = (node: Node, bounds: typeof viewportBounds.value): boolean => {
    const buffer = 100 / bounds.zoom // 100px buffer adjusted for zoom
    const nodeRight = node.position.x + (node.width || 200)
    const nodeBottom = node.position.y + (node.height || 100)
    const viewportRight = bounds.x + bounds.width
    const viewportBottom = bounds.y + bounds.height

    return (
      nodeRight + buffer >= bounds.x &&
      node.position.x - buffer <= viewportRight &&
      nodeBottom + buffer >= bounds.y &&
      node.position.y - buffer <= viewportBottom
    )
  }

  const generateCacheKey = (node: Node, lodLevel: number): string => {
    const nodeData = {
      id: node.id,
      type: node.type,
      data: node.data,
      lodLevel,
      zoom: viewportBounds.value?.zoom || 1
    }
    return btoa(JSON.stringify(nodeData))
  }

  const getFromCache = (cacheKey: string): RenderCache | null => {
    const cached = renderCache.value.get(cacheKey)
    if (!cached) {
      cacheMisses.value++
      return null
    }

    const now = Date.now()
    if (now - cached.timestamp > finalConfig.cacheTTL) {
      renderCache.value.delete(cacheKey)
      cacheMisses.value++
      return null
    }

    cacheHits.value++
    return cached
  }

  const setInCache = (cacheKey: string, nodeData: string, lodLevel: number, renderTime: number) => {
    const size = new Blob([nodeData]).size

    const cacheEntry: RenderCache = {
      nodeData,
      timestamp: Date.now(),
      lodLevel,
      size,
      renderTime
    }

    renderCache.value.set(cacheKey, cacheEntry)

    // Cleanup old cache entries if over limit
    if (renderCache.value.size > finalConfig.maxCacheSize) {
      cleanupCache()
    }
  }

  const cleanupCache = () => {
    const entries = Array.from(renderCache.value.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)

    const toRemove = entries.slice(0, renderCache.value.size - finalConfig.maxCacheSize)
    toRemove.forEach(([key]) => renderCache.value.delete(key))
  }

  const optimizeNodeData = (node: Node, lodLevel: number): any => {
    const optimized = { ...node.data }

    switch (lodLevel) {
      case 1: // Full detail
        break

      case 2: // Medium detail
        // Reduce text length
        if (optimized.title && optimized.title.length > 50) {
          optimized.title = optimized.title.substring(0, 47) + '...'
        }
        if (optimized.description && optimized.description.length > 100) {
          optimized.description = optimized.description.substring(0, 97) + '...'
        }
        // Limit subtasks
        if (optimized.subtasks && optimized.subtasks.length > 5) {
          optimized.subtasks = optimized.subtasks.slice(0, 5)
          optimized.moreSubtasks = true
        }
        break

      case 3: // Low detail
        // Minimal information
        if (optimized.title && optimized.title.length > 25) {
          optimized.title = optimized.title.substring(0, 22) + '...'
        }
        delete optimized.description
        delete optimized.subtasks
        delete optimized.tags
        break

      case 4: // Minimal detail
        // Only essential information
        optimized.title = optimized.title?.substring(0, 15) || ''
        delete optimized.description
        delete optimized.subtasks
        delete optimized.tags
        delete optimized.dueDate
        break
    }

    return optimized
  }

  const processImage = async (imageUrl: string, maxSize: number): Promise<string> => {
    if (!finalConfig.enableImageOptimization) return imageUrl

    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve(imageUrl)
          return
        }

        // Calculate new dimensions
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width *= ratio
          height *= ratio
        }

        canvas.width = width
        canvas.height = height

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }

      img.onerror = () => resolve(imageUrl)
      img.src = imageUrl
    })
  }

  const createSkeletonNode = (node: Node): any => {
    return {
      ...node,
      data: {
        ...node.data,
        title: 'Loading...',
        isSkeleton: true,
        isLoading: true
      },
      style: {
        ...node.style,
        opacity: 0.7,
        pointerEvents: 'none'
      }
    }
  }

  // Lazy loading
  const scheduleLazyLoad = (nodeId: string) => {
    if (!finalConfig.enableLazyLoading) return

    lazyLoadQueue.value.add(nodeId)

    if (lazyLoadTimer.value) {
      clearTimeout(lazyLoadTimer.value)
    }

    lazyLoadTimer.value = window.setTimeout(() => {
      processLazyLoadQueue()
    }, finalConfig.lazyLoadDelay)
  }

  const processLazyLoadQueue = async () => {
    if (lazyLoadQueue.value.size === 0) return

    isLoading.value = true
    const nodeIdsToLoad = Array.from(lazyLoadQueue.value)
    lazyLoadQueue.value.clear()

    // Process in batches to avoid blocking UI
    const batchSize = 5
    for (let i = 0; i < nodeIdsToLoad.length; i += batchSize) {
      const batch = nodeIdsToLoad.slice(i, i + batchSize)

      await Promise.all(batch.map(async (nodeId) => {
        const nodeState = nodeStates.value.get(nodeId)
        if (nodeState && !nodeState.isLoaded) {
          await loadNodeContent(nodeId)
        }
      }))

      // Small delay between batches
      if (i + batchSize < nodeIdsToLoad.length) {
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    isLoading.value = false
  }

  const loadNodeContent = async (nodeId: string) => {
    const nodeState = nodeStates.value.get(nodeId)
    if (!nodeState || nodeState.isLoaded) return

    nodeState.isLoading = true

    // Simulate loading delay for demo purposes
    // In real app, this would load actual content
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100))

    nodeState.isLoading = false
    nodeState.isLoaded = true
    nodeState.lastRenderTime = performance.now()

    const state = nodeStates.value.get(nodeId)
    if (state) {
      state.lazyLoadedNodes++
    }
  }

  // Core rendering optimization
  const optimizeNodeRendering = async (node: Node) => {
    const startTime = performance.now()

    // Calculate LOD level
    const lodLevel = calculateLODLevel(node, viewportBounds.value)

    // Check cache first
    if (finalConfig.enableCaching) {
      const cacheKey = generateCacheKey(node, lodLevel)
      const cached = getFromCache(cacheKey)
      if (cached) {
        return {
          ...node,
          data: JSON.parse(cached.nodeData),
          fromCache: true
        }
      }
    }

    // Optimize node data based on LOD
    const optimizedData = optimizeNodeData(node.data, lodLevel)

    // Process images if present
    if (finalConfig.enableImageOptimization && optimizedData.image) {
      optimizedData.image = await processImage(optimizedData.image, finalConfig.maxImageSize)
    }

    const optimizedNode = {
      ...node,
      data: optimizedData,
      lodLevel
    }

    // Add to cache
    if (finalConfig.enableCaching) {
      const cacheKey = generateCacheKey(node, lodLevel)
      const renderTime = performance.now() - startTime
      setInCache(cacheKey, JSON.stringify(optimizedData), lodLevel, renderTime)
    }

    return optimizedNode
  }

  const updateNodeStates = async () => {
    const startTime = performance.now()
    const bounds = viewportBounds.value

    let visibleCount = 0
    let cachedCount = 0
    let lodDistribution = { level1: 0, level2: 0, level3: 0, level4: 0 }

    const newStates = new Map<string, NodeRenderingState>()

    for (const node of nodes.value) {
      const isVisible = isNodeInViewport(node, bounds)
      const lodLevel = calculateLODLevel(node, bounds)
      const cacheKey = generateCacheKey(node, lodLevel)

      let existingState = nodeStates.value.get(node.id)

      // Create new state if doesn't exist
      if (!existingState) {
        existingState = {
          nodeId: node.id,
          isVisible,
          lodLevel,
          isLoaded: !finalConfig.enableLazyLoading,
          isLoading: false,
          cacheKey,
          lastRenderTime: 0,
          renderCount: 0,
          memoryUsage: 0,
          boundingBox: {
            x: node.position.x,
            y: node.position.y,
            width: node.width || 200,
            height: node.height || 100
          }
        }
      }

      // Update existing state
      existingState.isVisible = isVisible
      existingState.lodLevel = lodLevel
      existingState.cacheKey = cacheKey

      if (isVisible) {
        visibleCount++
        lodDistribution[`level${lodLevel}`]++

        // Schedule lazy loading if needed
        if (finalConfig.enableLazyLoading && !existingState.isLoaded) {
          scheduleLazyLoad(node.id)
        }

        // Check if cached
        if (finalConfig.enableCaching && getFromCache(cacheKey)) {
          cachedCount++
        }
      }

      existingState.renderCount++
      newStates.set(node.id, existingState)
    }

    nodeStates.value = newStates

    // Update metrics
    const renderTime = performance.now() - startTime
    renderTimes.value.push(renderTime)
    if (renderTimes.value.length > 100) {
      renderTimes.value.shift()
    }

    renderingMetrics.value = {
      totalNodes: nodes.value.length,
      visibleNodes: visibleCount,
      cachedNodes: cachedCount,
      lazyLoadedNodes: Array.from(nodeStates.value.values()).filter(s => s.isLoaded && finalConfig.enableLazyLoading).length,
      averageRenderTime: renderTimes.value.reduce((sum, time) => sum + time, 0) / renderTimes.value.length,
      memoryUsage: estimateMemoryUsage(),
      cacheHitRate: cacheHits.value + cacheMisses.value > 0 ? cacheHits.value / (cacheHits.value + cacheMisses.value) : 0,
      lodDistribution,
      frameRate: calculateFrameRate()
    }
  }

  const throttledUpdate = useThrottleFn(updateNodeStates, 16) // ~60fps
  const debouncedUpdate = useDebounceFn(updateNodeStates, 100)

  // Utility functions
  const estimateMemoryUsage = (): number => {
    let memory = 0

    // Node states memory
    memory += nodeStates.value.size * 512 // ~512B per state

    // Cache memory
    for (const [, cache] of renderCache.value) {
      memory += cache.size + 256 // Add overhead
    }

    // Render times memory
    memory += renderTimes.value.length * 8 // 8B per time entry

    return memory
  }

  const calculateFrameRate = (): number => {
    const now = performance.now()
    frameCount.value++

    if (now - lastFrameTime.value >= 1000) {
      const fps = frameCount.value
      frameCount.value = 0
      lastFrameTime.value = now
      return fps
    }

    return renderingMetrics.value.frameRate
  }

  // Watch for changes
  watch(
    [nodes, viewportBounds],
    () => {
      if (isInitialized.value) {
        throttledUpdate()
      }
    },
    { deep: true }
  )

  // Initialize
  const initialize = async () => {
    isInitialized.value = false

    // Initialize states for existing nodes
    await updateNodeStates()

    // Start cleanup interval
    const cleanupInterval = setInterval(() => {
      cleanupCache()
    }, 30000) // Clean every 30s

    onUnmounted(() => {
      clearInterval(cleanupInterval)
      if (lazyLoadTimer.value) {
        clearTimeout(lazyLoadTimer.value)
      }
    })

    isInitialized.value = true
  }

  // Public methods
  const forceUpdate = () => {
    updateNodeStates()
  }

  const clearCache = () => {
    renderCache.value.clear()
    cacheHits.value = 0
    cacheMisses.value = 0
  }

  const getNodeState = (nodeId: string): NodeRenderingState | undefined => {
    return nodeStates.value.get(nodeId)
  }

  const isNodeLoaded = (nodeId: string): boolean => {
    const state = nodeStates.value.get(nodeId)
    return state?.isLoaded || !finalConfig.enableLazyLoading
  }

  const preloadNode = async (nodeId: string) => {
    const state = nodeStates.value.get(nodeId)
    if (state && !state.isLoaded) {
      await loadNodeContent(nodeId)
    }
  }

  const getOptimizedNode = async (node: Node) => {
    return await optimizeNodeRendering(node)
  }

  // Computed properties
  const performanceGrade = computed(() => {
    const { averageRenderTime, frameRate, cacheHitRate, memoryUsage } = renderingMetrics.value

    if (averageRenderTime > 16 || frameRate < 30 || cacheHitRate < 0.3 || memoryUsage > 50 * 1024 * 1024) return 'F'
    if (averageRenderTime > 12 || frameRate < 45 || cacheHitRate < 0.5 || memoryUsage > 30 * 1024 * 1024) return 'D'
    if (averageRenderTime > 8 || frameRate < 55 || cacheHitRate < 0.7 || memoryUsage > 20 * 1024 * 1024) return 'C'
    if (averageRenderTime > 4 || frameRate < 58 || cacheHitRate < 0.85 || memoryUsage > 10 * 1024 * 1024) return 'B'
    return 'A'
  })

  const isOptimal = computed(() => {
    return performanceGrade.value === 'A' || performanceGrade.value === 'B'
  })

  return {
    // State
    isInitialized,
    isLoading,
    renderingMetrics,
    performanceGrade,
    isOptimal,

    // Methods
    initialize,
    forceUpdate,
    clearCache,
    getNodeState,
    isNodeLoaded,
    preloadNode,
    getOptimizedNode,
    scheduleLazyLoad,

    // Internal state for debugging
    nodeStates: readonly(nodeStates),
    renderCache: readonly(renderCache)
  }
}