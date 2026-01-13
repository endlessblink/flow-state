/**
 * Vue Flow State Management System
 * Provides robust state synchronization for Vue Flow nodes and edges
 */

import { ref, computed, watch, type Ref, type ComputedRef as _ComputedRef } from 'vue'
import type { Node, Edge, NodeChange as _NodeChange, EdgeChange as _EdgeChange, Connection as _Connection } from '@vue-flow/core'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'

export interface VueFlowStateConfig {
  enableOptimisticUpdates?: boolean
  enableBatchUpdates?: boolean
  batchDelay?: number
  enableStateValidation?: boolean
  enableConflictResolution?: boolean
}

export interface StateOperation {
  type: 'add' | 'update' | 'remove' | 'move' | 'select'
  target: 'node' | 'edge'
  id: string
  data?: unknown
  timestamp: number
}

export interface StateSnapshot {
  nodes: Node[]
  edges: Edge[]
  operations: StateOperation[]
  timestamp: number
}

/**
 * Vue Flow State Manager
 */
export function useVueFlowStateManager(
  nodes: Ref<Node[]>,
  edges: Ref<Edge[]>,
  config: VueFlowStateConfig = {},
  isInteracting?: Ref<boolean>
) {
  const {
    enableOptimisticUpdates: _enableOptimisticUpdates = true,
    enableBatchUpdates = true,
    batchDelay = 50,
    enableStateValidation = true,
    enableConflictResolution: _enableConflictResolution = true
  } = config

  // Store references
  const taskStore = useTaskStore()
  const _canvasStore = useCanvasStore()

  // State management
  const isInitialized = ref(false)
  const pendingOperations = ref<StateOperation[]>([])
  const operationQueue = ref<Set<() => void>>(new Set())
  const isProcessingQueue = ref(false)
  const lastSyncTime = ref(0)

  // State snapshots for undo/redo
  const stateHistory = ref<StateSnapshot[]>([])
  const maxHistorySize = 50
  const currentIndex = ref(-1)

  // Conflict resolution
  const conflicts = ref<Array<{ type: string; ids: string[]; resolution?: string }>>([])

  // Computed properties
  const hasPendingOperations = computed(() => pendingOperations.value.length > 0)
  const canUndo = computed(() => currentIndex.value > 0)
  const canRedo = computed(() => currentIndex.value < stateHistory.value.length - 1)
  const stateIntegrity = computed(() => {
    const nodeIds = new Set(nodes.value.map(n => n.id))
    const _edgeSources = new Set(edges.value.map(e => e.source))
    const _edgeTargets = new Set(edges.value.map(e => e.target))

    return {
      orphanedEdges: edges.value.filter(e => !nodeIds.has(e.source) || !nodeIds.has(e.target)),
      duplicateNodes: nodes.value.filter((node, index, arr) =>
        arr.findIndex(n => n.id === node.id) !== index
      ),
      duplicateEdges: edges.value.filter((edge, index, arr) =>
        arr.findIndex(e => e.id === edge.id) !== index
      )
    }
  })

  /**
   * Initialize state manager
   */
  const initialize = async () => {
    console.log('🔧 [VUE_FLOW_STATE] Initializing state manager...')

    try {
      // Set up watchers
      setupWatchers()

      // Set up batch processing
      if (enableBatchUpdates) {
        setupBatchProcessing()
      }

      // Create initial state snapshot
      await createStateSnapshot()

      // Validate initial state
      if (enableStateValidation) {
        validateState()
      }

      isInitialized.value = true
      console.log('✅ [VUE_FLOW_STATE] State manager initialized')
    } catch (error) {
      console.error('❌ [VUE_FLOW_STATE] Initialization failed:', error)
    }
  }

  /**
   * Set up reactive watchers
   */
  const setupWatchers = () => {
    // Watch for node changes - guarded by isInteracting to prevent traversal during movement
    watch(
      () => (isInteracting?.value ? null : nodes.value),
      (val, _oldVal) => {
        if (isInitialized.value && val) {
          handleNodeChanges(val, oldNodes || [])
        }
      },
      { deep: true }
    )

    // Store oldNodes for diffing
    let oldNodes: Node[] = [...nodes.value]
    watch(nodes, (newNodes) => {
      if (!isInteracting?.value) {
        oldNodes = [...newNodes]
      }
    }, { deep: false })

    // Watch for edge changes - guarded by isInteracting
    watch(
      () => (isInteracting?.value ? null : edges.value),
      (val, _oldVal) => {
        if (isInitialized.value && val) {
          handleEdgeChanges(val, oldEdges || [])
        }
      },
      { deep: true }
    )

    // Store oldEdges for diffing 
    let oldEdges: Edge[] = [...edges.value]
    watch(edges, (newEdges) => {
      if (!isInteracting?.value) {
        oldEdges = [...newEdges]
      }
    }, { deep: false })

    // Watch for conflicts
    watch(
      stateIntegrity,
      (integrity) => {
        if (isInteracting && isInteracting.value) return

        if (integrity.orphanedEdges.length > 0) {
          console.warn(`⚠️ [VUE_FLOW_STATE] Found ${integrity.orphanedEdges.length} orphaned edges`)
          resolveOrphanedEdges(integrity.orphanedEdges)
        }

        if (integrity.duplicateNodes.length > 0) {
          console.warn(`⚠️ [VUE_FLOW_STATE] Found ${integrity.duplicateNodes.length} duplicate nodes`)
          resolveDuplicateNodes(integrity.duplicateNodes)
        }

        if (integrity.duplicateEdges.length > 0) {
          console.warn(`⚠️ [VUE_FLOW_STATE] Found ${integrity.duplicateEdges.length} duplicate edges`)
          resolveDuplicateEdges(integrity.duplicateEdges)
        }
      },
      { deep: true }
    )
  }

  /**
   * Set up batch processing
   */
  const setupBatchProcessing = () => {
    let timeoutId: NodeJS.Timeout | null = null

    const processQueue = () => {
      if (isProcessingQueue.value || operationQueue.value.size === 0) {
        return
      }

      isProcessingQueue.value = true

      try {
        const operations = Array.from(operationQueue.value)
        operationQueue.value.clear()

        operations.forEach(operation => {
          try {
            operation()
          } catch (error) {
            console.error('❌ [VUE_FLOW_STATE] Batch operation failed:', error)
          }
        })

        // Create state snapshot after batch
        createStateSnapshot()
      } finally {
        isProcessingQueue.value = false
        lastSyncTime.value = Date.now()
      }
    }

    // Override the scheduleOperation function for batch processing
    const _originalScheduleOperation = scheduleOperation
    scheduleOperation = (operation: () => void) => {
      operationQueue.value.add(operation)

      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      timeoutId = setTimeout(processQueue, batchDelay)
    }
  }

  /**
   * Handle node changes with O(N) complexity
   */
  const handleNodeChanges = (newNodes: Node[], oldNodes: Node[]) => {
    const oldNodeMap = new Map(oldNodes.map(n => [n.id, n]))
    const newNodeMap = new Map(newNodes.map(n => [n.id, n]))

    // Find added nodes
    newNodes.forEach(node => {
      if (!oldNodeMap.has(node.id)) {
        addOperation({
          type: 'add',
          target: 'node',
          id: node.id,
          data: node,
          timestamp: Date.now()
        })
      }
    })

    // Find removed nodes
    oldNodes.forEach(node => {
      if (!newNodeMap.has(node.id)) {
        addOperation({
          type: 'remove',
          target: 'node',
          id: node.id,
          data: node,
          timestamp: Date.now()
        })
      }
    })

    // Find updated nodes
    newNodes.forEach(newNode => {
      const oldNode = oldNodeMap.get(newNode.id)
      if (oldNode) {
        // PERF: Only stringify if internal references changed or skip if just position changed (handled elsewhere usually)
        // But for state manager we want to track everything.
        // Use a more targeted check if performance is still issue.
        if (oldNode !== newNode) {
          // Check if it's actually different content
          // Using a faster check first: label/data length/keys
          const dataChanged = JSON.stringify(oldNode.data) !== JSON.stringify(newNode.data)
          const posChanged = oldNode.position.x !== newNode.position.x || oldNode.position.y !== newNode.position.y

          if (dataChanged || posChanged) {
            addOperation({
              type: 'update',
              target: 'node',
              id: newNode.id,
              data: { old: oldNode, new: newNode },
              timestamp: Date.now()
            })
          }
        }
      }
    })
  }

  /**
   * Handle edge changes with O(N) complexity
   */
  const handleEdgeChanges = (newEdges: Edge[], oldEdges: Edge[]) => {
    const oldEdgeMap = new Map(oldEdges.map(e => [e.id, e]))
    const newEdgeMap = new Map(newEdges.map(e => [e.id, e]))

    // Find added edges
    newEdges.forEach(edge => {
      if (!oldEdgeMap.has(edge.id)) {
        addOperation({
          type: 'add',
          target: 'edge',
          id: edge.id,
          data: edge,
          timestamp: Date.now()
        })
      }
    })

    // Find removed edges
    oldEdges.forEach(edge => {
      if (!newEdgeMap.has(edge.id)) {
        addOperation({
          type: 'remove',
          target: 'edge',
          id: edge.id,
          data: edge,
          timestamp: Date.now()
        })
      }
    })

    // Find updated edges
    newEdges.forEach(newEdge => {
      const oldEdge = oldEdgeMap.get(newEdge.id)
      if (oldEdge && oldEdge !== newEdge) {
        if (JSON.stringify(oldEdge) !== JSON.stringify(newEdge)) {
          addOperation({
            type: 'update',
            target: 'edge',
            id: newEdge.id,
            data: { old: oldEdge, new: newEdge },
            timestamp: Date.now()
          })
        }
      }
    })
  }

  /**
   * Add operation to pending list
   */
  const addOperation = (operation: StateOperation) => {
    pendingOperations.value.push(operation)

    // Limit operations size
    if (pendingOperations.value.length > 1000) {
      pendingOperations.value = pendingOperations.value.slice(-500)
    }
  }

  /**
   * Schedule operation for batch processing
   */
  let scheduleOperation = (operation: () => void) => {
    if (!enableBatchUpdates) {
      operation()
      return
    }

    operationQueue.value.add(operation)
  }

  /**
   * Validate state integrity
   */
  const validateState = () => {
    const integrity = stateIntegrity.value

    const issues = [
      ...integrity.orphanedEdges.map(e => `Orphaned edge: ${e.id}`),
      ...integrity.duplicateNodes.map(n => `Duplicate node: ${n.id}`),
      ...integrity.duplicateEdges.map(e => `Duplicate edge: ${e.id}`)
    ]

    if (issues.length > 0) {
      console.warn('⚠️ [VUE_FLOW_STATE] State validation issues:', issues)
      return false
    }

    return true
  }

  /**
   * Resolve orphaned edges
   */
  const resolveOrphanedEdges = (orphanedEdges: Edge[]) => {
    orphanedEdges.forEach(edge => {
      const nodeIds = new Set(nodes.value.map(n => n.id))

      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        console.log(`🗑️ [VUE_FLOW_STATE] Removing orphaned edge: ${edge.id}`)

        scheduleOperation(() => {
          const index = edges.value.findIndex(e => e.id === edge.id)
          if (index > -1) {
            edges.value.splice(index, 1)
          }
        })
      }
    })
  }

  /**
   * Resolve duplicate nodes
   */
  const resolveDuplicateNodes = (duplicateNodes: Node[]) => {
    const seenIds = new Set<string>()

    duplicateNodes.forEach(node => {
      if (seenIds.has(node.id)) {
        console.log(`🔧 [VUE_FLOW_STATE] Resolving duplicate node: ${node.id}`)

        scheduleOperation(() => {
          const index = nodes.value.findIndex(n => n.id === node.id)
          if (index > -1) {
            nodes.value.splice(index, 1)
          }
        })
      } else {
        seenIds.add(node.id)
      }
    })
  }

  /**
   * Resolve duplicate edges
   */
  const resolveDuplicateEdges = (duplicateEdges: Edge[]) => {
    const seenIds = new Set<string>()

    duplicateEdges.forEach(edge => {
      if (seenIds.has(edge.id)) {
        console.log(`🔧 [VUE_FLOW_STATE] Resolving duplicate edge: ${edge.id}`)

        scheduleOperation(() => {
          const index = edges.value.findIndex(e => e.id === edge.id)
          if (index > -1) {
            edges.value.splice(index, 1)
          }
        })
      } else {
        seenIds.add(edge.id)
      }
    })
  }

  /**
   * Create state snapshot
   */
  const createStateSnapshot = async (): Promise<StateSnapshot> => {
    const snapshot: StateSnapshot = {
      nodes: [...nodes.value],
      edges: [...edges.value],
      operations: [...pendingOperations.value],
      timestamp: Date.now()
    }

    // Add to history
    stateHistory.value.push(snapshot)

    // Limit history size
    if (stateHistory.value.length > maxHistorySize) {
      stateHistory.value = stateHistory.value.slice(-maxHistorySize)
    }

    // Update current index
    currentIndex.value = stateHistory.value.length - 1

    return snapshot
  }

  /**
   * Restore from snapshot
   */
  const restoreFromSnapshot = (snapshot: StateSnapshot) => {
    nodes.value = [...snapshot.nodes]
    edges.value = [...snapshot.edges]
    pendingOperations.value = [...snapshot.operations]

    // Find snapshot index
    const index = stateHistory.value.findIndex(s => s.timestamp === snapshot.timestamp)
    if (index > -1) {
      currentIndex.value = index
    }
  }

  /**
   * Undo last operation
   */
  const undo = () => {
    if (!canUndo.value) {
      console.warn('⚠️ [VUE_FLOW_STATE] Cannot undo - no history available')
      return false
    }

    const targetIndex = currentIndex.value - 1
    if (targetIndex >= 0 && targetIndex < stateHistory.value.length) {
      const snapshot = stateHistory.value[targetIndex]
      restoreFromSnapshot(snapshot)
      currentIndex.value = targetIndex
      console.log('↩️ [VUE_FLOW_STATE] Undo completed')
      return true
    }

    return false
  }

  /**
   * Redo next operation
   */
  const redo = () => {
    if (!canRedo.value) {
      console.warn('⚠️ [VUE_FLOW_STATE] Cannot redo - no future state available')
      return false
    }

    const targetIndex = currentIndex.value + 1
    if (targetIndex >= 0 && targetIndex < stateHistory.value.length) {
      const snapshot = stateHistory.value[targetIndex]
      restoreFromSnapshot(snapshot)
      currentIndex.value = targetIndex
      console.log('↪️ [VUE_FLOW_STATE] Redo completed')
      return true
    }

    return false
  }

  /**
   * Clear history
   */
  const clearHistory = () => {
    stateHistory.value = []
    currentIndex.value = -1
    pendingOperations.value = []
    console.log('🗑️ [VUE_FLOW_STATE] History cleared')
  }

  /**
   * Sync with stores
   */
  const syncWithStores = async () => {
    try {
      // Sync nodes with task store
      const taskNodes = nodes.value.filter(n => n.id.startsWith('task-'))
      taskNodes.forEach(node => {
        const taskId = node.id.replace('task-', '')
        const task = taskStore.tasks.find(t => t.id === taskId)

        if (task && node.position) {
          // Update task position if different
          if (task.canvasPosition?.x !== node.position.x || task.canvasPosition?.y !== node.position.y) {
            taskStore.updateTask(taskId, {
              canvasPosition: { x: node.position.x, y: node.position.y }
            })
          }
        }
      })

      // Sync edges with task dependencies
      edges.value.forEach(edge => {
        if (edge.source.startsWith('task-') && edge.target.startsWith('task-')) {
          const sourceTaskId = edge.source.replace('task-', '')
          const targetTaskId = edge.target.replace('task-', '')

          const sourceTask = taskStore.tasks.find(t => t.id === sourceTaskId)
          const targetTask = taskStore.tasks.find(t => t.id === targetTaskId)

          if (sourceTask && targetTask) {
            // Ensure dependency exists
            if (!(targetTask.dependsOn?.includes(sourceTaskId))) {
              taskStore.updateTask(targetTaskId, {
                dependsOn: [...(targetTask.dependsOn || []), sourceTaskId]
              })
            }
          }
        }
      })

      console.log('✅ [VUE_FLOW_STATE] Synced with stores')
    } catch (error) {
      console.error('❌ [VUE_FLOW_STATE] Store sync failed:', error)
    }
  }

  /**
   * Force state validation and cleanup
   */
  const forceValidation = () => {
    console.log('🔍 [VUE_FLOW_STATE] Forcing state validation...')

    // Validate and fix node integrity
    const validNodes = nodes.value.filter(node => {
      if (!node.id || typeof node.id !== 'string') {
        console.warn(`⚠️ [VUE_FLOW_STATE] Invalid node removed:`, node)
        return false
      }
      if (!node.position || typeof node.position.x !== 'number' || typeof node.position.y !== 'number') {
        console.warn(`⚠️ [VUE_FLOW_STATE] Node with invalid position removed:`, node.id)
        return false
      }
      return true
    })

    // Validate and fix edge integrity
    const validEdges = edges.value.filter(edge => {
      if (!edge.id || !edge.source || !edge.target) {
        console.warn(`⚠️ [VUE_FLOW_STATE] Invalid edge removed:`, edge)
        return false
      }
      if (edge.source === edge.target) {
        console.warn(`⚠️ [VUE_FLOW_STATE] Self-loop edge removed:`, edge.id)
        return false
      }
      return true
    })

    // Update with validated data
    scheduleOperation(() => {
      nodes.value = validNodes
      edges.value = validEdges
    })

    // Sync with stores
    syncWithStores()

    console.log(`✅ [VUE_FLOW_STATE] Validation complete: ${validNodes.length} nodes, ${validEdges.length} edges`)
  }

  /**
   * Get performance metrics
   */
  const getMetrics = () => ({
    nodeCount: nodes.value.length,
    edgeCount: edges.value.length,
    pendingOperations: pendingOperations.value.length,
    queueSize: operationQueue.value.size,
    lastSyncTime: lastSyncTime.value,
    historySize: stateHistory.value.length,
    conflicts: conflicts.value.length,
    integrity: stateIntegrity.value,
    canUndo: canUndo.value,
    canRedo: canRedo.value
  })

  /**
   * Cleanup function
   */
  const cleanup = () => {
    pendingOperations.value = []
    operationQueue.value.clear()
    stateHistory.value = []
    conflicts.value = []
    isInitialized.value = false
    console.log('🧹 [VUE_FLOW_STATE] State manager cleanup completed')
  }

  return {
    // State
    isInitialized: computed(() => isInitialized.value),
    hasPendingOperations,
    canUndo,
    canRedo,
    stateIntegrity,

    // Actions
    initialize,
    undo,
    redo,
    clearHistory,
    syncWithStores,
    forceValidation,
    createStateSnapshot,
    restoreFromSnapshot,

    // Utilities
    validateState,
    getMetrics,
    cleanup
  }
}