/**
 * Canvas Virtualization System
 *
 * Provides node virtualization and viewport-based rendering optimization
 * for handling large canvases with 1000+ nodes efficiently.
 */

import { ref, computed, watch, onMounted as _onMounted, onUnmounted, nextTick, readonly, type Ref } from 'vue'
import { useThrottleFn, useDebounceFn } from '@vueuse/core'
import type { Node, Edge, ViewportTransform } from '@vue-flow/core'

export interface VirtualizationConfig {
  /** Maximum nodes to render in viewport */
  maxViewportNodes?: number
  /** Buffer zone around viewport in pixels */
  viewportBuffer?: number
  /** Maximum nodes to render outside viewport */
  maxOffscreenNodes?: number
  /** Enable node pooling */
  enableNodePooling?: boolean
  /** Enable progressive loading */
  enableProgressiveLoading?: boolean
  /** Batch size for progressive loading */
  progressiveBatchSize?: number
  /** Delay between batches in ms */
  progressiveBatchDelay?: number
  /** Enable distance-based culling */
  enableDistanceCulling?: boolean
  /** Maximum distance for offscreen nodes in pixels */
  maxOffscreenDistance?: number
  /** Enable level-of-detail rendering */
  enableLOD?: boolean
  /** Distance threshold for LOD reduction */
  lodDistanceThreshold?: number
}

export interface VirtualizationMetrics {
  totalNodes: number
  visibleNodes: number
  renderedNodes: number
  culledNodes: number
  viewportNodes: number
  offscreenNodes: number
  poolSize: number
  renderTime: number
  cullingTime: number
  memoryUsage: number
  fps: number
}

export interface NodePoolItem {
  node: Node
  inUse: boolean
  lastUsed: number
  renderCount: number
}

export interface ViewportBounds {
  x: number
  y: number
  width: number
  height: number
  zoom: number
}

export function useCanvasVirtualization(
  allNodes: Ref<Node[]>,
  allEdges: Ref<Edge[]>,
  viewportTransform: Ref<ViewportTransform | null>,
  containerSize: Ref<{ width: number; height: number }>,
  config: VirtualizationConfig = {}
) {
  // Configuration
  const finalConfig = {
    maxViewportNodes: 500,
    viewportBuffer: 200,
    maxOffscreenNodes: 100,
    enableNodePooling: true,
    enableProgressiveLoading: true,
    progressiveBatchSize: 50,
    progressiveBatchDelay: 16, // ~60fps
    enableDistanceCulling: true,
    maxOffscreenDistance: 1000,
    enableLOD: true,
    lodDistanceThreshold: 500,
    ...config
  } as const

  // State
  const isInitialized = ref(false)
  const isVisible = ref(true)
  const viewportBounds = ref<ViewportBounds>({ x: 0, y: 0, width: 0, height: 0, zoom: 1 })
  const virtualizedNodes = ref<Node[]>([])
  const virtualizedEdges = ref<Edge[]>([])
  const nodePool = ref<Map<string, NodePoolItem>>(new Map())
  const lodLevels = ref<Map<string, number>>(new Map())
  const isLoading = ref(false)
  const loadProgress = ref(0)

  // Metrics
  const metrics = ref<VirtualizationMetrics>({
    totalNodes: 0,
    visibleNodes: 0,
    renderedNodes: 0,
    culledNodes: 0,
    viewportNodes: 0,
    offscreenNodes: 0,
    poolSize: 0,
    renderTime: 0,
    cullingTime: 0,
    memoryUsage: 0,
    fps: 60
  })

  // Performance monitoring
  const frameCount = ref(0)
  const lastFrameTime = ref(performance.now())
  const fpsHistory = ref<number[]>([])

  // Utility function to get numeric node dimensions
  const getNodeWidth = (node: Node): number => {
    if (typeof node.width === 'number') return node.width
    return 200 // default width
  }

  const getNodeHeight = (node: Node): number => {
    if (typeof node.height === 'number') return node.height
    return 100 // default height
  }

  // Utility functions
  const getNodeBounds = (node: Node) => {
    const width = getNodeWidth(node)
    const height = getNodeHeight(node)
    return {
      x: node.position.x,
      y: node.position.y,
      width,
      height,
      centerX: node.position.x + width / 2,
      centerY: node.position.y + height / 2
    }
  }

  const isInViewport = (nodeBounds: unknown, bounds: ViewportBounds, buffer: number) => {
    return (
      nodeBounds.x + nodeBounds.width + buffer >= bounds.x &&
      nodeBounds.x - buffer <= bounds.x + bounds.width &&
      nodeBounds.y + nodeBounds.height + buffer >= bounds.y &&
      nodeBounds.y - buffer <= bounds.y + bounds.height
    )
  }

  const getDistanceToViewport = (nodeBounds: unknown, bounds: ViewportBounds) => {
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2

    const dx = Math.max(
      Math.min(nodeBounds.x, centerX) - Math.min(nodeBounds.x + nodeBounds.width, centerX),
      Math.max(nodeBounds.x, centerX) - Math.min(nodeBounds.x + nodeBounds.width, centerX)
    )

    const dy = Math.max(
      Math.min(nodeBounds.y, centerY) - Math.min(nodeBounds.y + nodeBounds.height, centerY),
      Math.max(nodeBounds.y, centerY) - Math.min(nodeBounds.y + nodeBounds.height, centerY)
    )

    return Math.sqrt(dx * dx + dy * dy)
  }

  const calculateLODLevel = (distance: number, zoom: number): number => {
    if (!finalConfig.enableLOD) return 1

    const adjustedDistance = distance / zoom
    if (adjustedDistance < finalConfig.lodDistanceThreshold) return 1
    if (adjustedDistance < finalConfig.lodDistanceThreshold * 2) return 2
    if (adjustedDistance < finalConfig.lodDistanceThreshold * 4) return 3
    return 4
  }

  // Node pooling
  const getFromPool = (nodeId: string): Node | null => {
    const pooled = nodePool.value.get(nodeId)
    if (pooled && !pooled.inUse) {
      pooled.inUse = true
      pooled.lastUsed = Date.now()
      pooled.renderCount++
      return pooled.node
    }
    return null
  }

  const returnToPool = (nodeId: string) => {
    const pooled = nodePool.value.get(nodeId)
    if (pooled) {
      pooled.inUse = false
    }
  }

  const addToPool = (node: Node) => {
    const existing = nodePool.value.get(node.id)
    if (existing) {
      existing.node = node
      existing.lastUsed = Date.now()
    } else {
      nodePool.value.set(node.id, {
        node,
        inUse: false,
        lastUsed: Date.now(),
        renderCount: 0
      })
    }
  }

  // Core virtualization logic
  const updateViewportBounds = () => {
    if (!viewportTransform.value || !containerSize.value) return

    const { x, y, zoom } = viewportTransform.value
    const { width, height } = containerSize.value

    viewportBounds.value = {
      x: -x / zoom,
      y: -y / zoom,
      width: width / zoom,
      height: height / zoom,
      zoom
    }
  }

  const performVirtualization = () => {
    const startTime = performance.now()

    updateViewportBounds()
    const bounds = viewportBounds.value
    const buffer = finalConfig.viewportBuffer / bounds.zoom

    const viewportNodes: Node[] = []
    const offscreenNodes: Node[] = []
    const newLODLevels = new Map<string, number>()

    let culledCount = 0
    let viewportCount = 0
    let offscreenCount = 0

    // Process all nodes
    for (const node of allNodes.value) {
      const nodeBounds = getNodeBounds(node)
      const inViewport = isInViewport(nodeBounds, bounds, buffer)

      if (inViewport) {
        if (viewportNodes.length < finalConfig.maxViewportNodes) {
          // Try to get from pool first
          let renderNode = getFromPool(node.id)
          if (!renderNode) {
            renderNode = node
          }

          viewportNodes.push(renderNode)
          viewportCount++

          // Calculate LOD level
          const distance = getDistanceToViewport(nodeBounds, bounds)
          const lodLevel = calculateLODLevel(distance, bounds.zoom)
          newLODLevels.set(node.id, lodLevel)
        } else {
          culledCount++
        }
      } else {
        if (finalConfig.enableDistanceCulling) {
          const distance = getDistanceToViewport(nodeBounds, bounds)
          if (distance <= finalConfig.maxOffscreenDistance &&
              offscreenNodes.length < finalConfig.maxOffscreenNodes) {
            let renderNode = getFromPool(node.id)
            if (!renderNode) {
              renderNode = node
            }

            offscreenNodes.push(renderNode)
            offscreenCount++

            const lodLevel = calculateLODLevel(distance, bounds.zoom)
            newLODLevels.set(node.id, lodLevel)
          } else {
            culledCount++
            returnToPool(node.id)
          }
        } else {
          if (offscreenNodes.length < finalConfig.maxOffscreenNodes) {
            offscreenNodes.push(node)
            const _offscreenCount = offscreenCount++
          } else {
            culledCount++
          }
        }
      }
    }

    // Update virtualized nodes and edges
    virtualizedNodes.value = [...viewportNodes, ...offscreenNodes]

    // Filter edges to only include connections between visible nodes
    const visibleNodeIds = new Set(virtualizedNodes.value.map(n => n.id))
    virtualizedEdges.value = allEdges.value.filter(edge =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    )

    // Update LOD levels
    lodLevels.value = newLODLevels

    // Update metrics
    const endTime = performance.now()
    const renderTime = endTime - startTime

    metrics.value = {
      totalNodes: allNodes.value.length,
      visibleNodes: viewportCount,
      renderedNodes: virtualizedNodes.value.length,
      culledNodes: culledCount,
      viewportNodes: viewportNodes.length,
      offscreenNodes: offscreenNodes.length,
      poolSize: nodePool.value.size,
      renderTime,
      cullingTime: endTime - startTime,
      memoryUsage: estimateMemoryUsage(),
      fps: calculateFPS()
    }

    // Return unused nodes to pool
    const usedNodeIds = new Set(virtualizedNodes.value.map(n => n.id))
    for (const [nodeId, pooled] of nodePool.value) {
      if (pooled.inUse && !usedNodeIds.has(nodeId)) {
        returnToPool(nodeId)
      }
    }
  }

  const throttledVirtualization = useThrottleFn(performVirtualization, 16) // ~60fps
  const debouncedVirtualization = useDebounceFn(performVirtualization, 100)

  // Progressive loading
  const progressiveLoadNodes = async (nodes: Node[]) => {
    if (!finalConfig.enableProgressiveLoading) {
      virtualizedNodes.value = nodes
      return
    }

    isLoading.value = true
    loadProgress.value = 0

    const batches = []
    for (let i = 0; i < nodes.length; i += finalConfig.progressiveBatchSize) {
      batches.push(nodes.slice(i, i + finalConfig.progressiveBatchSize))
    }

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]

      // Add batch to pool
      batch.forEach(node => addToPool(node))

      // Update virtualized nodes with current batch
      const currentNodes = virtualizedNodes.value
      virtualizedNodes.value = [...currentNodes, ...batch]

      loadProgress.value = ((i + 1) / batches.length) * 100

      // Small delay between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, finalConfig.progressiveBatchDelay))
      }
    }

    isLoading.value = false
    loadProgress.value = 100
  }

  // Utility functions
  const estimateMemoryUsage = (): number => {
    let memory = 0

    // Node memory
    memory += virtualizedNodes.value.length * 1024 // ~1KB per node

    // Edge memory
    memory += virtualizedEdges.value.length * 512 // ~512B per edge

    // Pool memory
    memory += nodePool.value.size * 1024 // ~1KB per pooled node

    // LOD memory
    memory += lodLevels.value.size * 8 // 8B per LOD entry

    return memory
  }

  const calculateFPS = (): number => {
    const now = performance.now()
    frameCount.value++

    if (now - lastFrameTime.value >= 1000) {
      const fps = frameCount.value
      fpsHistory.value.push(fps)

      if (fpsHistory.value.length > 10) {
        fpsHistory.value.shift()
      }

      frameCount.value = 0
      lastFrameTime.value = now

      return fps
    }

    return metrics.value.fps
  }

  // Cleanup
  const cleanupPool = () => {
    const now = Date.now()
    const maxAge = 5 * 60 * 1000 // 5 minutes
    const maxSize = finalConfig.maxViewportNodes * 2

    const poolEntries = Array.from(nodePool.value.entries())
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed)

    if (poolEntries.length > maxSize) {
      const toRemove = poolEntries.slice(0, poolEntries.length - maxSize)
      toRemove.forEach(([nodeId]) => {
        nodePool.value.delete(nodeId)
      })
    }

    // Remove old unused nodes
    for (const [nodeId, pooled] of nodePool.value) {
      if (!pooled.inUse && (now - pooled.lastUsed) > maxAge) {
        nodePool.value.delete(nodeId)
      }
    }
  }

  // Watch for changes
  watch(
    [allNodes, allEdges, viewportTransform, containerSize],
    () => {
      if (isInitialized.value && isVisible.value) {
        throttledVirtualization()
      }
    },
    { deep: true }
  )

  // Initialize
  const initialize = async () => {
    isInitialized.value = false

    // Initialize pool with existing nodes
    if (finalConfig.enableNodePooling) {
      allNodes.value.forEach(node => addToPool(node))
    }

    // Perform initial virtualization
    await nextTick()
    performVirtualization()

    // Start cleanup interval
    const cleanupInterval = setInterval(cleanupPool, 30000) // Clean every 30s

    onUnmounted(() => {
      clearInterval(cleanupInterval)
    })

    isInitialized.value = true
  }

  // Public methods
  const forceUpdate = () => {
    performVirtualization()
  }

  const setVisibility = (visible: boolean) => {
    isVisible.value = visible
    if (visible) {
      debouncedVirtualization()
    }
  }

  const clearPool = () => {
    nodePool.value.clear()
    lodLevels.value.clear()
  }

  const getNodeLOD = (nodeId: string): number => {
    return lodLevels.value.get(nodeId) || 1
  }

  const getPoolStats = () => {
    const poolArray = Array.from(nodePool.value.values())
    const inUse = poolArray.filter(p => p.inUse).length
    const unused = poolArray.filter(p => !p.inUse).length

    return {
      total: poolArray.length,
      inUse,
      unused,
      avgRenderCount: poolArray.reduce((sum, p) => sum + p.renderCount, 0) / poolArray.length || 0
    }
  }

  // Computed properties
  const performanceGrade = computed(() => {
    const { renderTime, fps, memoryUsage } = metrics.value

    if (renderTime > 16 || fps < 30 || memoryUsage > 50 * 1024 * 1024) return 'F'
    if (renderTime > 12 || fps < 45 || memoryUsage > 30 * 1024 * 1024) return 'D'
    if (renderTime > 8 || fps < 55 || memoryUsage > 20 * 1024 * 1024) return 'C'
    if (renderTime > 4 || fps < 58 || memoryUsage > 10 * 1024 * 1024) return 'B'
    return 'A'
  })

  const isPerformant = computed(() => {
    return performanceGrade.value === 'A' || performanceGrade.value === 'B'
  })

  return {
    // State
    isInitialized,
    isLoading,
    loadProgress,
    virtualizedNodes,
    virtualizedEdges,
    metrics,
    performanceGrade,
    isPerformant,

    // Methods
    initialize,
    forceUpdate,
    setVisibility,
    clearPool,
    getNodeLOD,
    getPoolStats,
    progressiveLoadNodes,

    // Internal state for debugging
    viewportBounds: readonly(viewportBounds),
    nodePool: readonly(nodePool),
    lodLevels: readonly(lodLevels)
  }
}