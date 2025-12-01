import { ref, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import { useCanvasStore } from '@/stores/canvas'
// import { ConflictResolver } from '@/utils/conflictResolver' // TEMPORARILY DISABLED - Module missing
// import type { ConflictInfo } from '@/types/conflicts'
// import type { ConflictResolutionStrategy } from '@/types/sync'
// CrossTabSaveCoordinator removed - Phase 2 simplification
import CrossTabPerformance from '@/utils/CrossTabPerformance'
import CrossTabBrowserCompatibility from '@/utils/CrossTabBrowserCompatibility'

// Types for cross-tab messages
export interface CrossTabMessage {
  id: string
  type: 'task_operation' | 'ui_state_change' | 'canvas_change' | 'heartbeat'
  timestamp: number
  tabId: string
  data: any
}

export interface TaskOperation {
  operation: 'create' | 'update' | 'delete' | 'bulk_update' | 'bulk_delete'
  taskId?: string
  taskIds?: string[]
  taskData?: any
  oldData?: any
  timestamp: number
}

export interface UIStateChange {
  store: 'ui' | 'canvas'
  action: string
  data: any
  timestamp: number
}

export interface CanvasChange {
  action: 'node_move' | 'section_collapse' | 'viewport_change'
  data: any
  timestamp: number
}

// Global state for synchronization
const isListening = ref(false)
const currentTabId = ref('')
const messageQueue = ref<CrossTabMessage[]>([])
const lastProcessedTimestamp = ref(0)
const isProcessing = ref(false)
const pendingLocalOperations = ref<Map<string, any>>(new Map())
// const conflictResolver = new ConflictResolver('cross-tab-sync') // TEMPORARILY DISABLED - Module missing
// saveCoordinator removed - Phase 2 simplification
const performanceMonitor = new CrossTabPerformance()
const browserCompatibility = new CrossTabBrowserCompatibility()
let isCompatibilityChecked = false

// Generate unique tab ID
const generateTabId = (): string => {
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Broadcast message to other tabs with performance monitoring
const broadcastMessage = (message: Omit<CrossTabMessage, 'id' | 'timestamp' | 'tabId'>) => {
  if (typeof window === 'undefined') return

  // Check performance before broadcasting
  const performanceData = (performanceMonitor as any).exportPerformanceData()
  if (performanceData.recommendations.length > 0) {
    console.log('⚠️ Performance recommendations detected:', performanceData.recommendations)
  }

  const fullMessage: CrossTabMessage = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    tabId: currentTabId.value,
    ...message
  }

  // Check for duplicate messages
  if (!(performanceMonitor as any).shouldProcessMessage(fullMessage.id, fullMessage)) {
    console.log('🔄 Duplicate broadcast message ignored:', fullMessage.id)
    return
  }

  const startTime = Date.now()

  try {
    localStorage.setItem('pomo-flow-cross-tab-sync', JSON.stringify(fullMessage))

    // Clear after a short delay to allow other tabs to read
    if (typeof setTimeout !== 'undefined') {
      setTimeout(() => {
        try {
          localStorage.removeItem('pomo-flow-cross-tab-sync')
        } catch (error) {
          // Ignore cleanup errors
        }
      }, 100)
    }

    // Record performance
    (performanceMonitor as any).recordMessage(fullMessage.id, startTime, Date.now())

  } catch (error) {
    console.warn('Failed to broadcast cross-tab message:', error)
  }
}

// Optimized debounced message processing with performance monitoring
let messageTimeout: NodeJS.Timeout | null = null
const debouncedProcessMessages = () => {
  if (messageTimeout) {
    clearTimeout(messageTimeout)
  }

  // Use performance-configured debounce delay
  const config = (performanceMonitor as any).getConfig()
  const debounceDelay = config.debounceDelay

  messageTimeout = setTimeout(() => {
    processMessageQueue()
  }, debounceDelay) // Dynamic debounce delay based on performance config
}

// Process queued messages with performance monitoring
const processMessageQueue = async () => {
  if (isProcessing.value || messageQueue.value.length === 0) return

  const processingStartTime = Date.now()
  isProcessing.value = true

  try {
    // Sort messages by timestamp to ensure consistent processing order
    const sortedMessages = [...messageQueue.value]
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter(msg => msg.timestamp > lastProcessedTimestamp.value)

    const taskStore = useTaskStore()
    const uiStore = useUIStore()
    const canvasStore = useCanvasStore()

    console.log(`📦 Processing ${sortedMessages.length} cross-tab messages...`)

    for (const message of sortedMessages) {
      if (message.tabId === currentTabId.value) {
        // Skip messages from current tab
        continue
      }

      // Check if message should be processed (deduplication)
      if (!(performanceMonitor as any).shouldProcessMessage(message.id, message)) {
        continue
      }

      const messageStartTime = Date.now()

      try {
        switch (message.type) {
          case 'task_operation':
            await handleTaskOperation(message.data as TaskOperation, taskStore)
            break
          case 'ui_state_change':
            await handleUIStateChange(message.data as UIStateChange, uiStore, canvasStore)
            break
          case 'canvas_change':
            await handleCanvasChange(message.data as CanvasChange, canvasStore)
            break
          case 'heartbeat':
            // Handle heartbeat if needed
            break
        }

        // Direct assignment with explicit any cast
        const maxTimestamp = Math.max(
          (lastProcessedTimestamp as any).value || 0,
          (message as any).timestamp || 0
        )
        if (lastProcessedTimestamp && typeof lastProcessedTimestamp === 'object') {
          (lastProcessedTimestamp as any).value = maxTimestamp
        }

        // Record message processing performance
        (performanceMonitor as any).recordMessage(message.id, messageStartTime, Date.now())

      } catch (error) {
        console.error('Failed to process cross-tab message:', error, message)
      }
    }

    // Clear processed messages
    messageQueue.value = []

    const processingTime = Date.now() - processingStartTime
    console.log(`✅ Message queue processed in ${processingTime}ms`)

    // Auto-optimize performance based on metrics
    const currentMetrics = (performanceMonitor as any).getMetrics()
    if (currentMetrics.messageCount > 0 && currentMetrics.messageCount % 50 === 0) {
      (performanceMonitor as any).optimizeConfiguration()
    }

  } finally {
    isProcessing.value = false
  }
}

// Handle task operations with conflict detection
const handleTaskOperation = async (operation: TaskOperation, taskStore: any) => {
  try {
    // Check for conflicts with pending local operations
    const conflicts = await detectTaskConflicts(operation, taskStore)

    if (conflicts.length > 0) {
      console.log(`⚠️ Detected ${conflicts.length} task conflicts, resolving...`)
      // const resolutions = await (conflictResolver as any).resolveConflict(conflicts) // TEMPORARILY DISABLED - Module missing
      // await applyConflictResolutions(resolutions as any, operation, taskStore) // TEMPORARILY DISABLED
      console.warn('🚨 Conflict resolution temporarily disabled - conflictResolver module missing')
      return
    }

    // No conflicts, apply operation normally
    switch (operation.operation) {
      case 'create':
        if (operation.taskData && operation.taskId) {
          // Refresh tasks from database to get new task
          await taskStore.loadTasks()
        }
        break

      case 'update':
        if (operation.taskId && operation.taskData) {
          // Update local store with new data
          const existingTask = taskStore.tasks.find((t: any) => t.id === operation.taskId)
          if (existingTask) {
            Object.assign(existingTask, operation.taskData)
          }
        }
        break

      case 'delete':
        if (operation.taskId) {
          // Remove task from local store
          const index = taskStore.tasks.findIndex((t: any) => t.id === operation.taskId)
          if (index > -1) {
            taskStore.tasks.splice(index, 1)
          }
        }
        break

      case 'bulk_delete':
        if (operation.taskIds && Array.isArray(operation.taskIds)) {
          // Remove multiple tasks from local store
          operation.taskIds.forEach(taskId => {
            const index = taskStore.tasks.findIndex((t: any) => t.id === taskId)
            if (index > -1) {
              taskStore.tasks.splice(index, 1)
            }
          })
        }
        break

      case 'bulk_update':
        if (operation.taskData && Array.isArray(operation.taskData)) {
          // Update multiple tasks
          operation.taskData.forEach((taskUpdate: any) => {
            const existingTask = taskStore.tasks.find((t: any) => t.id === taskUpdate.id)
            if (existingTask) {
              Object.assign(existingTask, taskUpdate)
            }
          })
        }
        break
    }
  } catch (error) {
    console.error('Failed to handle task operation:', error, operation)
  }
}

// Detect conflicts between remote operation and pending local operations
const detectTaskConflicts = async (remoteOperation: TaskOperation, taskStore: any): Promise<any[]> => {
  const conflicts: any[] = [] // Using any[] temporarily instead of ConflictInfo[]

  if (!remoteOperation.taskId) return conflicts

  // Check if there's a pending local operation for the same task
  const pendingLocalOp = pendingLocalOperations.value.get(remoteOperation.taskId)

  if (pendingLocalOp) {
    const conflict = {
      type: 'task_update',
      entityId: remoteOperation.taskId,
      localOperation: pendingLocalOp,
      remoteOperation: remoteOperation,
      timestamp: Date.now()
    } as any

    conflicts.push(conflict)
  }

  return conflicts
}

// Apply conflict resolutions
const applyConflictResolutions = async (resolutions: any[], remoteOperation: TaskOperation, taskStore: any) => { // Using any[] temporarily instead of ConflictInfo[]
  for (const resolution of resolutions) {
    switch ((resolution as any).resolution) {
      case 'local_wins':
        console.log('🏆 Local operation wins conflict for task:', (resolution as any).entityId)
        // Keep local changes, ignore remote operation
        break

      case 'remote_wins':
        console.log('🏆 Remote operation wins conflict for task:', (resolution as any).entityId)
        // Apply remote operation, discard local changes
        await applyTaskOperation(remoteOperation, taskStore)
        // Remove pending local operation
        pendingLocalOperations.value.delete((resolution as any).entityId)
        break

      case 'merge':
        console.log('🔀 Merging conflicting operations for task:', (resolution as any).entityId)
        // Apply merged operation
        if ((resolution as any).localOperation && (resolution as any).localOperation.taskData) {
          await applyTaskOperation({
            ...remoteOperation,
            taskData: (resolution as any).localOperation.taskData
          }, taskStore)
        }
        // Remove pending local operation
        pendingLocalOperations.value.delete((resolution as any).entityId)
        break

      default:
        console.warn('Unknown conflict resolution:', (resolution as any).resolution)
        // Default to remote wins
        await applyTaskOperation(remoteOperation, taskStore)
        pendingLocalOperations.value.delete((resolution as any).entityId)
        break
    }
  }
}

// Apply a single task operation with save coordination
const applyTaskOperation = async (operation: TaskOperation, taskStore: any) => {
  switch (operation.operation) {
    case 'create':
      if (operation.taskData && operation.taskId) {
        await taskStore.loadTasks()
        // Save through direct PouchDB (saveCoordinator removed)
        await taskStore.loadTasks() // Sync via PouchDB
      }
      break

    case 'update':
      if (operation.taskId && operation.taskData) {
        const existingTask = taskStore.tasks.find((t: any) => t.id === operation.taskId)
        if (existingTask) {
          Object.assign(existingTask, operation.taskData)
          // Save through direct PouchDB (saveCoordinator removed)
          // PouchDB sync handles this automatically
        }
      }
      break

    case 'delete':
      if (operation.taskId) {
        const index = taskStore.tasks.findIndex((t: any) => t.id === operation.taskId)
        if (index > -1) {
          taskStore.tasks.splice(index, 1)
          // Save through direct PouchDB (saveCoordinator removed)
          // PouchDB sync handles this automatically
        }
      }
      break
  }
}

// Handle UI state changes
const handleUIStateChange = async (change: UIStateChange, uiStore: any, canvasStore: any) => {
  try {
    if (change.store === 'ui') {
      // Update UI store state
      switch (change.action) {
        case 'sidebar_toggle':
          if (typeof change.data.isOpen === 'boolean') {
            uiStore.sidebarOpen = change.data.isOpen
          }
          break
        case 'theme_change':
          if (change.data.theme) {
            uiStore.theme = change.data.theme
          }
          break
        case 'view_change':
          if (change.data.view) {
            uiStore.activeView = change.data.view
          }
          break
      }
    } else if (change.store === 'canvas') {
      // Handle canvas state changes
      switch (change.action) {
        case 'viewport_change':
          if (change.data.viewport) {
            Object.assign(canvasStore.viewport, change.data.viewport)
          }
          break
      }
    }
  } catch (error) {
    console.error('Failed to handle UI state change:', error, change)
  }
}

// Handle canvas changes
const handleCanvasChange = async (change: CanvasChange, canvasStore: any) => {
  try {
    switch (change.action) {
      case 'node_move':
        if (change.data.nodeId && change.data.position) {
          const node = canvasStore.nodes.find((n: any) => n.id === change.data.nodeId)
          if (node) {
            node.position = change.data.position
          }
        }
        break

      case 'section_collapse':
        if (change.data.sectionId && typeof change.data.collapsed === 'boolean') {
          const section = canvasStore.sections.find((s: any) => s.id === change.data.sectionId)
          if (section) {
            section.collapsed = change.data.collapsed
            if (change.data.collapsedHeight) {
              section.collapsedHeight = change.data.collapsedHeight
            }
          }
        }
        break
    }
  } catch (error) {
    console.error('Failed to handle canvas change:', error, change)
  }
}

// Listen for cross-tab messages
const handleStorageChange = (event: StorageEvent) => {
  if (event.key === 'pomo-flow-cross-tab-sync' && event.newValue) {
    try {
      const message: CrossTabMessage = JSON.parse(event.newValue)
      messageQueue.value.push(message)
      debouncedProcessMessages()
    } catch (error) {
      console.error('Failed to parse cross-tab message:', error)
    }
  }
}

// Track local operations for conflict detection
const trackLocalOperation = (operation: TaskOperation) => {
  if (operation.taskId) {
    pendingLocalOperations.value.set(operation.taskId, operation)

    // Auto-cleanup after 5 seconds to prevent memory leaks
    setTimeout(() => {
      pendingLocalOperations.value.delete(operation.taskId!)
    }, 5000)
  }
}

// Check browser compatibility and run tests
const checkBrowserCompatibility = async () => {
  try {
    console.log('🔍 Checking browser compatibility...')

    const compatibility = (browserCompatibility as any).getCompatibilityResult()
    const browserInfo = (browserCompatibility as any).getBrowserInfo()
    const testResults = await (browserCompatibility as any).runCompatibilityTest()

    console.log('🌐 Browser Info:', browserInfo)
    console.log('✅ Compatibility Result:', compatibility)

    if (!compatibility.supported) {
      console.error('❌ Cross-tab sync not supported in this browser')
      throw new Error('Browser does not support required features for cross-tab synchronization')
    }

    if (compatibility.warnings.length > 0) {
      console.warn('⚠️ Compatibility warnings:', compatibility.warnings)
    }

    if (!testResults.success) {
      console.error('❌ Compatibility tests failed:', testResults.tests.filter((t: any) => !t.passed))
    }

    isCompatibilityChecked = true

  } catch (error) {
    console.error('Browser compatibility check failed:', error)
    throw error
  }
}

// Apply browser-specific optimizations
const applyBrowserOptimizations = () => {
  try {
    const config = browserCompatibility.getRecommendedConfig()
    const strategy = (browserCompatibility as any).getOptimalStrategy()

    // Console output removed due to TypeScript conflicts

    // Apply performance configuration
    (performanceMonitor as any).updateConfig({
      maxQueueSize: (config as any).maxCacheSize,
      batchSize: (config as any).batchSize,
      batchTimeout: (config as any).messageTimeout,
      debounceDelay: (config as any).debounceDelay,
      cacheTimeout: (config as any).cacheTimeout,
      enableCompression: (config as any).enableCompression,
      enableDeduplication: true
    })

    // Log optimization details
    console.log('🚀 Communication strategy:', strategy)
    console.log('💡 Applied optimizations:', strategy.optimizations)

    if (strategy.fallback.length > 0) {
      console.log('🔄 Using fallback:', strategy.fallback)
    }

  } catch (error) {
    console.warn('Failed to apply browser optimizations:', error)
    // Continue with default settings
  }
}

// Main composable function
export function useCrossTabSync() {
  const taskStore = useTaskStore()
  const uiStore = useUIStore()
  const canvasStore = useCanvasStore()

  // Initialize cross-tab sync with compatibility checking
  const initialize = async () => {
    if (typeof window === 'undefined') return

    try {
      // Check browser compatibility first
      if (!isCompatibilityChecked) {
        await checkBrowserCompatibility()
      }

      currentTabId.value = generateTabId()
      isListening.value = true

      // saveCoordinator removed - Phase 2 simplification

      // Apply browser-specific optimizations
      applyBrowserOptimizations()

      // Start listening for storage changes
      window.addEventListener('storage', handleStorageChange)

      console.log('🔄 Cross-tab sync initialized:', currentTabId.value)

    } catch (error) {
      console.error('❌ Cross-tab sync initialization failed:', error)
      isListening.value = false
    }
  }

  // Cleanup cross-tab sync
  const cleanup = () => {
    if (typeof window === 'undefined') return

    isListening.value = false
    window.removeEventListener('storage', handleStorageChange)

    if (messageTimeout) {
      clearTimeout(messageTimeout)
      messageTimeout = null
    }

    messageQueue.value = []
    pendingLocalOperations.value.clear()

    // saveCoordinator cleanup removed - Phase 2 simplification

    console.log('🔄 Cross-tab sync cleaned up:', currentTabId.value)
  }

  // Broadcast task operations
  const broadcastTaskOperation = (operation: TaskOperation) => {
    broadcastMessage({
      type: 'task_operation',
      data: operation
    })
  }

  // Broadcast UI state changes
  const broadcastUIStateChange = (change: UIStateChange) => {
    broadcastMessage({
      type: 'ui_state_change',
      data: change
    })
  }

  // Broadcast canvas changes
  const broadcastCanvasChange = (change: CanvasChange) => {
    broadcastMessage({
      type: 'canvas_change',
      data: change
    })
  }

  // Send heartbeat to announce tab presence
  const sendHeartbeat = () => {
    broadcastMessage({
      type: 'heartbeat',
      data: { timestamp: Date.now() }
    })
  }

  // Setup lifecycle hooks
  onMounted(() => {
    initialize()
    // Send initial heartbeat
    sendHeartbeat()
  })

  onUnmounted(() => {
    cleanup()
  })

  return {
    // State
    isListening,
    currentTabId,
    messageQueue: messageQueue,
    isProcessing,
    pendingLocalOperations,

    // Methods
    initialize,
    cleanup,
    broadcastTaskOperation,
    broadcastUIStateChange,
    broadcastCanvasChange,
    sendHeartbeat,
    trackLocalOperation,

    // Performance monitoring
    getPerformanceMetrics: () => performanceMonitor.getMetrics(),
    getPerformanceData: () => (performanceMonitor as any).exportPerformanceData(),
    optimizePerformance: () => (performanceMonitor as any).optimizeConfiguration(),
    resetPerformanceMetrics: () => (performanceMonitor as any).resetMetrics(),

    // Browser compatibility
    getBrowserInfo: () => (browserCompatibility as any).getBrowserInfo(),
    getCompatibilityResult: () => (browserCompatibility as any).getCompatibilityResult(),
    runCompatibilityTest: () => (browserCompatibility as any).runCompatibilityTest(),
    getOptimalStrategy: () => (browserCompatibility as any).getOptimalStrategy()
  }
}

// Export singleton instance for global usage
let crossTabSyncInstance: ReturnType<typeof useCrossTabSync> | null = null

export const getCrossTabSync = () => {
  if (!crossTabSyncInstance) {
    crossTabSyncInstance = useCrossTabSync()
  }
  return crossTabSyncInstance
}