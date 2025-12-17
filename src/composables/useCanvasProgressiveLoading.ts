/**
 * Canvas Progressive Loading System
 *
 * Provides intelligent progressive loading and streaming of canvas data
 * to handle large datasets (1000+ nodes) without blocking the UI.
 */

import { ref, computed, watch, onMounted as _onMounted, onUnmounted, nextTick as _nextTick, readonly, type Ref } from 'vue'
import { useThrottleFn, useDebounceFn as _useDebounceFn } from '@vueuse/core'
import type { Node, Edge } from '@vue-flow/core'

export interface ProgressiveLoadingConfig {
  /** Enable progressive loading */
  enabled?: boolean
  /** Initial batch size */
  initialBatchSize?: number
  /** Maximum batch size */
  maxBatchSize?: number
  /** Delay between batches in ms */
  batchDelay?: number
  /** Enable adaptive batch sizing */
  enableAdaptiveBatching?: boolean
  /** Performance target for adaptive batching (ms) */
  performanceTarget?: number
  /** Enable priority-based loading */
  enablePriorityLoading?: boolean
  /** Priority node types */
  priorityNodeTypes?: string[]
  /** Enable streaming from server */
  enableStreaming?: boolean
  /** Stream chunk size */
  streamChunkSize?: number
  /** Enable background loading */
  enableBackgroundLoading?: boolean
  /** Background loading priority */
  backgroundPriority?: 'low' | 'normal' | 'high'
  /** Preload radius in pixels */
  preloadRadius?: number
  /** Enable predictive loading */
  enablePredictiveLoading?: boolean
  /** Predictive load window in pixels */
  predictiveWindow?: number
  /** Enable compression for large datasets */
  enableCompression?: boolean
}

export interface LoadingProgress {
  phase: 'initializing' | 'loading' | 'processing' | 'rendering' | 'complete' | 'error'
  total: number
  loaded: number
  processed: number
  rendered: number
  percentage: number
  estimatedTimeRemaining?: number
  currentBatch?: number
  totalBatches?: number
  performance?: {
    averageLoadTime: number
    averageProcessTime: number
    averageRenderTime: number
    throughput: number // items per second
  }
}

export interface LoadingMetrics {
  totalNodes: number
  totalEdges: number
  loadedNodes: number
  loadedEdges: number
  processingTime: number
  renderingTime: number
  totalTime: number
  averageBatchSize: number
  batchesProcessed: number
  memoryUsage: number
  throughput: number
}

export interface LoadBatch {
  nodes: Node[]
  edges: Edge[]
  priority: 'high' | 'normal' | 'low'
  estimatedLoadTime: number
  timestamp: number
}

export function useCanvasProgressiveLoading(
  initialNodes: Ref<Node[]>,
  initialEdges: Ref<Edge[]>,
  viewportBounds: Ref<{ x: number; y: number; width: number; height: number; zoom: number }>,
  config: ProgressiveLoadingConfig = {}
) {
  // Configuration
  const finalConfig = {
    enabled: true,
    initialBatchSize: 50,
    maxBatchSize: 200,
    batchDelay: 16, // ~60fps
    enableAdaptiveBatching: true,
    performanceTarget: 16, // 16ms per batch
    enablePriorityLoading: true,
    priorityNodeTypes: ['section', 'task', 'milestone'],
    enableStreaming: false,
    streamChunkSize: 100,
    enableBackgroundLoading: true,
    backgroundPriority: 'normal',
    preloadRadius: 500,
    enablePredictiveLoading: true,
    predictiveWindow: 200,
    enableCompression: false,
    ...config
  } as const

  // State
  const isInitialized = ref(false)
  const isLoading = ref(false)
  const isPaused = ref(false)
  const loadedNodes = ref<Node[]>([])
  const loadedEdges = ref<Edge[]>([])
  const pendingBatches = ref<LoadBatch[]>([])
  const currentBatch = ref<LoadBatch | null>(null)

  // Progress tracking
  const progress = ref<LoadingProgress>({
    phase: 'initializing',
    total: 0,
    loaded: 0,
    processed: 0,
    rendered: 0,
    percentage: 0
  })

  const metrics = ref<LoadingMetrics>({
    totalNodes: 0,
    totalEdges: 0,
    loadedNodes: 0,
    loadedEdges: 0,
    processingTime: 0,
    renderingTime: 0,
    totalTime: 0,
    averageBatchSize: 0,
    batchesProcessed: 0,
    memoryUsage: 0,
    throughput: 0
  })

  // Performance tracking
  const batchTimes = ref<number[]>([])
  const _throughputHistory = ref<number[]>([])
  const adaptiveBatchSize = ref(finalConfig.initialBatchSize)

  // Loading queue and priorities
  const _loadingQueue = ref<Array<{ data: Node[] | Edge[]; type: 'nodes' | 'edges'; priority: number }>>([])
  const processedData = ref<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] })

  // Background loading
  const backgroundLoader = ref<Worker | null>(null)
  const isLoadingInBackground = ref(false)

  // Predictive loading
  const lastViewportPosition = ref({ x: 0, y: 0 })
  const movementVector = ref({ x: 0, y: 0 })
  const movementHistory = ref<Array<{ x: number; y: number; timestamp: number }>>([])

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
  const calculateNodePriority = (node: Node, viewport: typeof viewportBounds.value): number => {
    if (!finalConfig.enablePriorityLoading) return 1

    let priority = 1

    // Priority based on node type
    const nodeType = node.type || ''
    if (finalConfig.priorityNodeTypes.includes(nodeType as 'task' | 'section' | 'milestone')) {
      priority += 2
    }

    // Priority based on distance to viewport center
    const nodeCenterX = node.position.x + getNodeWidth(node) / 2
    const nodeCenterY = node.position.y + getNodeHeight(node) / 2
    const viewportCenterX = viewport.x + viewport.width / 2
    const viewportCenterY = viewport.y + viewport.height / 2

    const distance = Math.sqrt(
      Math.pow(nodeCenterX - viewportCenterX, 2) +
      Math.pow(nodeCenterY - viewportCenterY, 2)
    )

    // Higher priority for closer nodes
    if (distance < 200) priority += 3
    else if (distance < 500) priority += 2
    else if (distance < 1000) priority += 1

    // Priority based on recent viewport movement (predictive)
    if (finalConfig.enablePredictiveLoading) {
      const futureX = viewportCenterX + movementVector.value.x * finalConfig.predictiveWindow
      const futureY = viewportCenterY + movementVector.value.y * finalConfig.predictiveWindow

      const futureDistance = Math.sqrt(
        Math.pow(nodeCenterX - futureX, 2) +
        Math.pow(nodeCenterY - futureY, 2)
      )

      if (futureDistance < distance) {
        priority += 1 // Node is in predicted movement path
      }
    }

    return priority
  }

  const createBatches = (nodes: Node[], edges: Edge[]): LoadBatch[] => {
    const batches: LoadBatch[] = []
    const nodeGroups = new Map<string, Node[]>()

    // Group nodes by priority
    for (const node of nodes) {
      const priority = calculateNodePriority(node, viewportBounds.value)
      const priorityKey = priority >= 4 ? 'high' : priority >= 2 ? 'normal' : 'low'

      if (!nodeGroups.has(priorityKey)) {
        nodeGroups.set(priorityKey, [])
      }
      nodeGroups.get(priorityKey)!.push(node)
    }

    // Create batches from each priority group
    for (const [priority, groupNodes] of nodeGroups) {
      let currentBatch: Node[] = []
      let currentBatchSize = 0

      for (const node of groupNodes) {
        if (currentBatchSize >= adaptiveBatchSize.value) {
          if (currentBatch.length > 0) {
            batches.push({
              nodes: currentBatch,
              edges: [], // Edges will be processed separately
              priority: priority as 'high' | 'normal' | 'low',
              estimatedLoadTime: currentBatchSize * 0.1, // Rough estimate
              timestamp: Date.now()
            })
            currentBatch = []
            currentBatchSize = 0
          }
        }

        currentBatch.push(node)
        currentBatchSize++
      }

      if (currentBatch.length > 0) {
        batches.push({
          nodes: currentBatch,
          edges: [],
          priority: priority as 'high' | 'normal' | 'low',
          estimatedLoadTime: currentBatchSize * 0.1,
          timestamp: Date.now()
        })
      }
    }

    // Create edge batches
    const edgeBatches: Edge[][] = []
    let currentEdgeBatch: Edge[] = []

    for (const edge of edges) {
      if (currentEdgeBatch.length >= adaptiveBatchSize.value * 2) {
        edgeBatches.push(currentEdgeBatch)
        currentEdgeBatch = []
      }
      currentEdgeBatch.push(edge)
    }

    if (currentEdgeBatch.length > 0) {
      edgeBatches.push(currentEdgeBatch)
    }

    // Add edge batches to the main batch list
    edgeBatches.forEach((edgeBatch, index) => {
      batches.push({
        nodes: [],
        edges: edgeBatch,
        priority: 'normal',
        estimatedLoadTime: edgeBatch.length * 0.05,
        timestamp: Date.now()
      })
    })

    // Sort by priority
    batches.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority]
    })

    return batches
  }

  const processBatch = async (batch: LoadBatch): Promise<void> => {
    const startTime = performance.now()

    currentBatch.value = batch

    // Process nodes
    if (batch.nodes.length > 0) {
      const processedNodes = batch.nodes.map(node => ({
        ...node,
        // Add any processing logic here
        processedAt: Date.now()
      }))

      processedData.value.nodes.push(...processedNodes)
      progress.value.processed += batch.nodes.length
    }

    // Process edges
    if (batch.edges.length > 0) {
      const processedEdges = batch.edges.map(edge => ({
        ...edge,
        // Add any processing logic here
        processedAt: Date.now()
      }))

      processedData.value.edges.push(...processedEdges)
      progress.value.processed += batch.edges.length
    }

    // Update loaded data
    loadedNodes.value = [...processedData.value.nodes]
    loadedEdges.value = [...processedData.value.edges]

    // Update progress
    progress.value.loaded = progress.value.processed
    progress.value.rendered = progress.value.processed
    progress.value.percentage = (progress.value.processed / progress.value.total) * 100

    // Track performance
    const batchTime = performance.now() - startTime
    batchTimes.value.push(batchTime)
    if (batchTimes.value.length > 10) {
      batchTimes.value.shift()
    }

    // Adaptive batch sizing
    if (finalConfig.enableAdaptiveBatching) {
      updateAdaptiveBatchSize(batchTime)
    }

    // Update metrics
    metrics.value.batchesProcessed++
    metrics.value.processingTime += batchTime

    currentBatch.value = null
  }

  const updateAdaptiveBatchSize = (batchTime: number) => {
    if (batchTime > finalConfig.performanceTarget * 1.5) {
      // Too slow, reduce batch size
      adaptiveBatchSize.value = Math.max(
        finalConfig.initialBatchSize,
        Math.floor(adaptiveBatchSize.value * 0.8)
      )
    } else if (batchTime < finalConfig.performanceTarget * 0.5) {
      // Fast enough, increase batch size
      adaptiveBatchSize.value = Math.min(
        finalConfig.maxBatchSize,
        Math.ceil(adaptiveBatchSize.value * 1.2)
      )
    }
  }

  const processBatches = async () => {
    if (isPaused.value || pendingBatches.value.length === 0) return

    isLoading.value = true
    progress.value.phase = 'loading'

    while (pendingBatches.value.length > 0 && !isPaused.value) {
      const batch = pendingBatches.value.shift()!
      await processBatch(batch)

      // Small delay between batches to maintain responsiveness
      if (pendingBatches.value.length > 0) {
        await new Promise(resolve => setTimeout(resolve, finalConfig.batchDelay))
      }
    }

    isLoading.value = false
    progress.value.phase = 'complete'
    metrics.value.totalTime = performance.now() - metrics.value.totalTime
  }

  const loadProgressively = async (nodes: Node[], edges: Edge[]) => {
    if (!finalConfig.enabled) {
      // Load everything at once if disabled
      loadedNodes.value = nodes
      loadedEdges.value = edges
      processedData.value = { nodes, edges }
      progress.value.phase = 'complete'
      progress.value.percentage = 100
      return
    }

    const startTime = performance.now()

    // Initialize progress
    progress.value.phase = 'initializing'
    progress.value.total = nodes.length + edges.length
    progress.value.loaded = 0
    progress.value.processed = 0
    progress.value.rendered = 0
    progress.value.percentage = 0

    // Initialize metrics
    metrics.value.totalNodes = nodes.length
    metrics.value.totalEdges = edges.length
    metrics.value.loadedNodes = 0
    metrics.value.loadedEdges = 0
    metrics.value.processingTime = 0
    metrics.value.renderingTime = 0
    metrics.value.totalTime = startTime
    metrics.value.batchesProcessed = 0

    // Clear previous data
    loadedNodes.value = []
    loadedEdges.value = []
    processedData.value = { nodes: [], edges: [] }
    pendingBatches.value = []

    // Create batches
    const batches = createBatches(nodes, edges)
    pendingBatches.value = batches

    progress.value.totalBatches = batches.length
    progress.value.currentBatch = 0

    // Start processing
    progress.value.phase = 'processing'
    await processBatches()
  }

  const updateMovementPrediction = () => {
    if (!finalConfig.enablePredictiveLoading) return

    const currentPos = {
      x: viewportBounds.value.x,
      y: viewportBounds.value.y,
      timestamp: Date.now()
    }

    // Add to movement history
    movementHistory.value.push(currentPos)

    // Keep only recent history (last 2 seconds)
    const twoSecondsAgo = Date.now() - 2000
    movementHistory.value = movementHistory.value.filter(h => h.timestamp > twoSecondsAgo)

    if (movementHistory.value.length >= 2) {
      const recent = movementHistory.value[movementHistory.value.length - 1]
      const previous = movementHistory.value[movementHistory.value.length - 2]

      const timeDelta = recent.timestamp - previous.timestamp
      if (timeDelta > 0) {
        movementVector.value = {
          x: (recent.x - previous.x) / timeDelta * 1000, // pixels per second
          y: (recent.y - previous.y) / timeDelta * 1000
        }
      }
    }

    lastViewportPosition.value = {
      x: viewportBounds.value.x,
      y: viewportBounds.value.y
    }
  }

  const throttledMovementUpdate = useThrottleFn(updateMovementPrediction, 100)

  const pauseLoading = () => {
    isPaused.value = true
  }

  const resumeLoading = () => {
    isPaused.value = false
    if (pendingBatches.value.length > 0) {
      processBatches()
    }
  }

  const cancelLoading = () => {
    isPaused.value = true
    pendingBatches.value = []
    currentBatch.value = null
    isLoading.value = false
    progress.value.phase = 'complete'
  }

  // Background loading (if Web Workers are available)
  const initializeBackgroundLoader = () => {
    if (!finalConfig.enableBackgroundLoading || typeof Worker === 'undefined') {
      return
    }

    try {
      // Create a simple worker for background processing
      const workerCode = `
        self.addEventListener('message', function(e) {
          const { nodes, edges, batchId } = e.data;

          // Process data in background
          const processedNodes = nodes.map(node => ({
            ...node,
            processedAt: Date.now()
          }));

          const processedEdges = edges.map(edge => ({
            ...edge,
            processedAt: Date.now()
          }));

          self.postMessage({
            batchId,
            processedNodes,
            processedEdges
          });
        });
      `

      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const workerUrl = URL.createObjectURL(blob)
      backgroundLoader.value = new Worker(workerUrl)

      backgroundLoader.value.addEventListener('message', (e) => {
        const { batchId, processedNodes, processedEdges } = e.data
        // Handle processed data from background worker
      })

      backgroundLoader.value.addEventListener('error', (error) => {
        console.warn('Background loader error:', error)
        backgroundLoader.value = null
      })
    } catch (error) {
      console.warn('Failed to initialize background loader:', error)
      backgroundLoader.value = null
    }
  }

  // Watch for viewport changes for predictive loading
  watch(
    viewportBounds,
    () => {
      throttledMovementUpdate()
    },
    { deep: true }
  )

  // Initialize
  const initialize = async () => {
    isInitialized.value = false

    // Initialize background loader if enabled
    if (finalConfig.enableBackgroundLoading) {
      initializeBackgroundLoader()
    }

    // Initialize movement tracking
    updateMovementPrediction()

    // Load initial data progressively
    if (initialNodes.value.length > 0 || initialEdges.value.length > 0) {
      await loadProgressively(initialNodes.value, initialEdges.value as any)
    }

    // Start periodic cleanup
    const cleanupInterval = setInterval(() => {
      // Clean up old movement history
      if (movementHistory.value.length > 20) {
        movementHistory.value = movementHistory.value.slice(-20)
      }

      // Clean up old batch times
      if (batchTimes.value.length > 50) {
        batchTimes.value = batchTimes.value.slice(-50)
      }
    }, 10000)

    onUnmounted(() => {
      clearInterval(cleanupInterval)
      if (backgroundLoader.value) {
        backgroundLoader.value.terminate()
      }
    })

    isInitialized.value = true
  }

  // Computed properties
  const isLoadingEfficiently = computed(() => {
    return !isLoading.value || (metrics.value.throughput > 100 && progress.value.percentage < 90)
  })

  const needsOptimization = computed(() => {
    return metrics.value.averageBatchSize < finalConfig.initialBatchSize ||
           metrics.value.processingTime > metrics.value.totalTime * 0.8 ||
           metrics.value.throughput < 50
  })

  return {
    // State
    isInitialized,
    isLoading,
    isPaused,
    loadedNodes,
    loadedEdges,
    progress,
    metrics,
    currentBatch,
    isLoadingEfficiently,
    needsOptimization,

    // Methods
    initialize,
    loadProgressively,
    pauseLoading,
    resumeLoading,
    cancelLoading,
    processBatches,

    // Internal state for debugging
    pendingBatches: readonly(pendingBatches),
    adaptiveBatchSize: readonly(adaptiveBatchSize),
    movementVector: readonly(movementVector)
  }
}