/**
 * Vue Flow Stability Management System
 * Handles Vue Flow component lifecycle, state management, error recovery, and performance optimization
 */

import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick, type Ref } from 'vue'
import type { Node, Edge, NodeChange, EdgeChange, Connection, VueFlowStore } from '@vue-flow/core'

export interface VueFlowStabilityConfig {
  maxNodes?: number
  maxEdges?: number
  enablePerformanceMonitoring?: boolean
  enableAutoRecovery?: boolean
  recoveryAttempts?: number
  debounceDelay?: number
}

export interface VueFlowPerformanceMetrics {
  nodeCount: number
  edgeCount: number
  renderTime: number
  lastUpdate: number
  errorCount: number
  recoveryCount: number
  memoryUsage?: number
}

export interface VueFlowStateSnapshot {
  nodes: Node[]
  edges: Edge[]
  selectedNodes: string[]
  viewport: {
    x: number
    y: number
    zoom: number
  }
  timestamp: number
}

/**
 * Vue Flow Stability Manager
 */
export function useVueFlowStability(
  nodes: Ref<Node[]>,
  edges: Ref<Edge[]>,
  vueFlowStore: Ref<VueFlowStore | null>,
  config: VueFlowStabilityConfig = {}
) {
  const {
    maxNodes = 1000,
    maxEdges = 2000,
    enablePerformanceMonitoring = false,
    enableAutoRecovery = true,
    recoveryAttempts = 3,
    debounceDelay = 100
  } = config

  // State management
  const isInitialized = ref(false)
  const isRecovering = ref(false)
  const hasErrors = ref(false)
  const lastError = ref<Error | null>(null)
  const recoveryAttemptsRemaining = ref(recoveryAttempts)

  // Performance metrics
  const performanceMetrics = ref<VueFlowPerformanceMetrics>({
    nodeCount: 0,
    edgeCount: 0,
    renderTime: 0,
    lastUpdate: Date.now(),
    errorCount: 0,
    recoveryCount: 0
  })

  // State snapshots for recovery
  const stateSnapshots = ref<VueFlowStateSnapshot[]>([])
  const maxSnapshots = 5

  // Performance monitoring
  const renderStartTime = ref(0)
  const updateQueue = ref<Set<() => void>>(new Set())
  const isUpdateScheduled = ref(false)

  // Computed properties
  const isOverloaded = computed(() =>
    nodes.value.length > maxNodes || edges.value.length > maxEdges
  )

  const performanceStatus = computed(() => {
    if (hasErrors.value) return 'error'
    if (isRecovering.value) return 'recovering'
    if (isOverloaded.value) return 'overloaded'
    if (performanceMetrics.value.renderTime > 100) return 'slow'
    return 'healthy'
  })

  /**
   * Initialize Vue Flow stability system
   */
  const initialize = async () => {
    console.log('🔧 [VUE_FLOW_STABILITY] Initializing Vue Flow stability system...')

    try {
      // Set up watchers for nodes and edges
      setupWatchers()

      // Set up performance monitoring
      if (enablePerformanceMonitoring) {
        setupPerformanceMonitoring()
      }

      // Set up error recovery
      if (enableAutoRecovery) {
        setupErrorRecovery()
      }

      // Create initial state snapshot
      await createStateSnapshot()

      isInitialized.value = true
      console.log('✅ [VUE_FLOW_STABILITY] Initialization complete')
    } catch (error) {
      console.error('❌ [VUE_FLOW_STABILITY] Initialization failed:', error)
      hasErrors.value = true
      lastError.value = error as Error
    }
  }

  /**
   * Set up reactive watchers for nodes and edges
   */
  const setupWatchers = () => {
    // Watch nodes with debounced updates
    watch(
      nodes,
      debounce((newNodes, oldNodes) => {
        handleNodesChange(newNodes, oldNodes)
      }, debounceDelay),
      { deep: true }
    )

    // Watch edges with debounced updates
    watch(
      edges,
      debounce((newEdges, oldEdges) => {
        handleEdgesChange(newEdges, oldEdges)
      }, debounceDelay),
      { deep: true }
    )

    // Watch for overload conditions
    watch(isOverloaded, (overloaded) => {
      if (overloaded) {
        console.warn('⚠️ [VUE_FLOW_STABILITY] Canvas overloaded - performance may degrade')
        handleOverloadCondition()
      }
    })
  }

  /**
   * Set up performance monitoring
   */
  const setupPerformanceMonitoring = () => {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if (entry.name.includes('vue-flow') || entry.name.includes('render')) {
            performanceMetrics.value.renderTime = entry.duration
            performanceMetrics.value.lastUpdate = Date.now()
          }
        })
      })

      try {
        observer.observe({ entryTypes: ['measure', 'navigation'] })
      } catch (error) {
        console.warn('⚠️ [VUE_FLOW_STABILITY] Performance observer setup failed:', error)
      }
    }
  }

  /**
   * Set up error recovery mechanisms
   */
  const setupErrorRecovery = () => {
    // Monitor for Vue Flow errors
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        if (event.filename?.includes('vue-flow') || event.message?.includes('vue-flow')) {
          handleError(new Error(event.message), event)
        }
      })

      window.addEventListener('unhandledrejection', (event) => {
        if (event.reason?.message?.includes('vue-flow')) {
          handleError(new Error(event.reason.message), event)
        }
      })
    }
  }

  /**
   * Handle nodes change
   */
  const handleNodesChange = (newNodes: Node[], oldNodes: Node[]) => {
    try {
      renderStartTime.value = performance.now()

      // Validate nodes
      const validNodes = validateNodes(newNodes)
      if (validNodes.length !== newNodes.length) {
        console.warn(`⚠️ [VUE_FLOW_STABILITY] Filtered ${newNodes.length - validNodes.length} invalid nodes`)
        nodes.value = validNodes
        return
      }

      // Update metrics
      performanceMetrics.value.nodeCount = validNodes.length
      performanceMetrics.value.lastUpdate = Date.now()

      // Create state snapshot periodically
      if (Math.random() < 0.1) { // 10% chance
        scheduleStateSnapshot()
      }

    } catch (error) {
      handleError(error as Error, { context: 'handleNodesChange' })
    } finally {
      if (renderStartTime.value) {
        performanceMetrics.value.renderTime = performance.now() - renderStartTime.value
      }
    }
  }

  /**
   * Handle edges change
   */
  const handleEdgesChange = (newEdges: Edge[], oldEdges: Edge[]) => {
    try {
      // Validate edges
      const validEdges = validateEdges(newEdges)
      if (validEdges.length !== newEdges.length) {
        console.warn(`⚠️ [VUE_FLOW_STABILITY] Filtered ${newEdges.length - validEdges.length} invalid edges`)
        edges.value = validEdges
        return
      }

      // Update metrics
      performanceMetrics.value.edgeCount = validEdges.length
      performanceMetrics.value.lastUpdate = Date.now()

    } catch (error) {
      handleError(error as Error, { context: 'handleEdgesChange' })
    }
  }

  /**
   * Validate nodes array
   */
  const validateNodes = (nodes: Node[]): Node[] => {
    return nodes.filter(node => {
      // Check required properties
      if (!node.id || typeof node.id !== 'string') return false
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') return false
      if (!node.data || typeof node.data !== 'object') return false

      // Check position bounds
      if (Math.abs(node.position.x) > 100000 || Math.abs(node.position.y) > 100000) {
        console.warn(`⚠️ [VUE_FLOW_STABILITY] Node ${node.id} has extreme position:`, node.position)
        return false
      }

      return true
    })
  }

  /**
   * Validate edges array
   */
  const validateEdges = (edges: Edge[]): Edge[] => {
    return edges.filter(edge => {
      // Check required properties
      if (!edge.id || typeof edge.id !== 'string') return false
      if (!edge.source || !edge.target) return false

      // Check for self-loops if not allowed
      if (edge.source === edge.target) return false

      return true
    })
  }

  /**
   * Handle error conditions
   */
  const handleError = (error: Error, context?: any) => {
    console.error('❌ [VUE_FLOW_STABILITY] Error:', error, context)

    hasErrors.value = true
    lastError.value = error
    performanceMetrics.value.errorCount++

    // Attempt recovery if enabled and attempts remain
    if (enableAutoRecovery && recoveryAttemptsRemaining.value > 0) {
      attemptRecovery()
    }
  }

  /**
   * Attempt error recovery
   */
  const attemptRecovery = async () => {
    if (isRecovering.value) {
      console.log('🔄 [VUE_FLOW_STABILITY] Recovery already in progress')
      return
    }

    isRecovering.value = true
    recoveryAttemptsRemaining.value--
    performanceMetrics.value.recoveryCount++

    console.log(`🔄 [VUE_FLOW_STABILITY] Attempting recovery (${recoveryAttempts - recoveryAttemptsRemaining.value + 1}/${recoveryAttempts})`)

    try {
      // Try to restore from the last good snapshot
      const snapshot = getLastGoodSnapshot()
      if (snapshot) {
        await restoreFromSnapshot(snapshot)
        console.log('✅ [VUE_FLOW_STABILITY] Recovery successful from snapshot')
      } else {
        // Fallback: reset to basic state
        await performBasicRecovery()
        console.log('✅ [VUE_FLOW_STABILITY] Basic recovery completed')
      }

      hasErrors.value = false
      lastError.value = null

    } catch (error) {
      console.error('❌ [VUE_FLOW_STABILITY] Recovery failed:', error)

      if (recoveryAttemptsRemaining.value === 0) {
        console.error('💀 [VUE_FLOW_STABILITY] All recovery attempts exhausted')
      }
    } finally {
      isRecovering.value = false
    }
  }

  /**
   * Handle overload conditions
   */
  const handleOverloadCondition = async () => {
    console.log('⚠️ [VUE_FLOW_STABILITY] Handling overload condition...')

    try {
      // Implement virtualization or pagination for large datasets
      if (nodes.value.length > maxNodes) {
        // Keep only the most recent/important nodes
        const priorityNodes = nodes.value.slice(0, maxNodes)
        nodes.value = priorityNodes
        console.log(`📊 [VUE_FLOW_STABILITY] Reduced nodes from ${nodes.value.length} to ${priorityNodes.length}`)
      }

      if (edges.value.length > maxEdges) {
        // Keep edges for priority nodes only
        const priorityNodeIds = new Set(nodes.value.map(n => n.id))
        const priorityEdges = edges.value.filter(e =>
          priorityNodeIds.has(e.source) && priorityNodeIds.has(e.target)
        )
        edges.value = priorityEdges
        console.log(`📊 [VUE_FLOW_STABILITY] Reduced edges from ${edges.value.length} to ${priorityEdges.length}`)
      }

    } catch (error) {
      console.error('❌ [VUE_FLOW_STABILITY] Overload handling failed:', error)
    }
  }

  /**
   * Create state snapshot
   */
  const createStateSnapshot = async (): Promise<VueFlowStateSnapshot> => {
    const viewport = vueFlowStore.value ? {
      x: (vueFlowStore.value as any).getTransform?.()[0] || 0,
      y: (vueFlowStore.value as any).getTransform?.()[1] || 0,
      zoom: (vueFlowStore.value as any).getTransform?.()[2] || 1
    } : { x: 0, y: 0, zoom: 1 }

    const snapshot: VueFlowStateSnapshot = {
      nodes: [...nodes.value],
      edges: [...edges.value],
      selectedNodes: nodes.value.filter((n: any) => (n as any).selected).map((n: any) => n.id),
      viewport,
      timestamp: Date.now()
    }

    // Add to snapshots array
    stateSnapshots.value.push(snapshot)

    // Keep only recent snapshots
    if (stateSnapshots.value.length > maxSnapshots) {
      stateSnapshots.value = stateSnapshots.value.slice(-maxSnapshots)
    }

    return snapshot
  }

  /**
   * Schedule state snapshot creation
   */
  const scheduleStateSnapshot = () => {
    if (!isUpdateScheduled.value) {
      isUpdateScheduled.value = true
      nextTick(async () => {
        await createStateSnapshot()
        isUpdateScheduled.value = false
      })
    }
  }

  /**
   * Get last good snapshot
   */
  const getLastGoodSnapshot = (): VueFlowStateSnapshot | null => {
    // Return the most recent snapshot that doesn't have errors
    return stateSnapshots.value
      .filter(s => s.timestamp > performanceMetrics.value.lastUpdate - 60000) // Within last minute
      .pop() || null
  }

  /**
   * Restore from snapshot
   */
  const restoreFromSnapshot = async (snapshot: VueFlowStateSnapshot) => {
    nodes.value = [...snapshot.nodes]
    edges.value = [...snapshot.edges]

    // Restore viewport
    if (vueFlowStore.value) {
      nextTick(() => {
        if (vueFlowStore.value) {
          (vueFlowStore.value as any).setTransform?.(snapshot.viewport.x, snapshot.viewport.y, snapshot.viewport.zoom)
        }
      })
    }
  }

  /**
   * Perform basic recovery
   */
  const performBasicRecovery = async () => {
    // Clear invalid nodes and edges
    nodes.value = validateNodes(nodes.value)
    edges.value = validateEdges(edges.value)

    // Reset viewport
    if (vueFlowStore.value) {
      nextTick(() => {
        if (vueFlowStore.value) {
          vueFlowStore.value.fitView({ padding: 0.1 })
        }
      })
    }
  }

  /**
   * Schedule update with debouncing
   */
  const scheduleUpdate = (updateFn: () => void) => {
    updateQueue.value.add(updateFn)

    if (!isUpdateScheduled.value) {
      isUpdateScheduled.value = true

      nextTick(() => {
        try {
          updateQueue.value.forEach(fn => fn())
          updateQueue.value.clear()
        } catch (error) {
          handleError(error as Error, { context: 'scheduleUpdate' })
        } finally {
          isUpdateScheduled.value = false
        }
      })
    }
  }

  /**
   * Get memory usage (if available)
   */
  const getMemoryUsage = (): number | null => {
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      const memory = (performance as any).memory
      return memory ? memory.usedJSHeapSize : null
    }
    return null
  }

  /**
   * Update performance metrics
   */
  const updateMetrics = () => {
    performanceMetrics.value.nodeCount = nodes.value.length
    performanceMetrics.value.edgeCount = edges.value.length
    performanceMetrics.value.memoryUsage = getMemoryUsage() || undefined
    performanceMetrics.value.lastUpdate = Date.now()
  }

  /**
   * Cleanup function
   */
  const cleanup = () => {
    updateQueue.value.clear()
    stateSnapshots.value = []
    isInitialized.value = false
    isRecovering.value = false
    console.log('🧹 [VUE_FLOW_STABILITY] Cleanup completed')
  }

  // Auto-initialize on mount
  onMounted(() => {
    initialize()
  })

  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    // State
    isInitialized: computed(() => isInitialized.value),
    isRecovering: computed(() => isRecovering.value),
    hasErrors: computed(() => hasErrors.value),
    isOverloaded,
    performanceStatus,

    // Metrics
    performanceMetrics: computed(() => ({
      ...performanceMetrics.value,
      memoryUsage: getMemoryUsage()
    })),

    // Actions
    initialize,
    createStateSnapshot,
    restoreFromSnapshot,
    attemptRecovery,
    scheduleUpdate,
    updateMetrics,
    cleanup,

    // Utilities
    validateNodes,
    validateEdges,
    getLastGoodSnapshot
  }
}

/**
 * Debounce utility function
 */
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
  let timeout: NodeJS.Timeout | null = null

  return ((...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }) as T
}