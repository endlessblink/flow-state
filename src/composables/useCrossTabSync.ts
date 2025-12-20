import { ref, onMounted, onUnmounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import { useCanvasStore } from '@/stores/canvas'
import { ConflictResolver } from '@/utils/conflictResolver'
import type { ConflictInfo } from '@/types/conflicts'
import type { ConflictResolutionStrategy as _ConflictResolutionStrategy } from '@/types/sync'
import type { Task } from '@/types/tasks'
// CrossTabSaveCoordinator removed - Phase 2 simplification
import CrossTabPerformance from '@/utils/CrossTabPerformance'
import CrossTabBrowserCompatibility from '@/utils/CrossTabBrowserCompatibility'
import { taskDisappearanceLogger } from '@/utils/taskDisappearanceLogger'

// Store type interfaces for cross-tab sync
interface TaskStoreType {
  tasks: Task[]
  loadTasks: () => Promise<void>
}

interface UIStoreType {
  mainSidebarVisible: boolean
  theme: string
  activeView: string
  [key: string]: unknown
}

interface CanvasStoreType {
  viewport: { x: number; y: number; zoom: number }
  nodes: Array<{ id: string; position: { x: number; y: number }; [key: string]: unknown }>
  sections: Array<{ id: string; collapsed?: boolean; collapsedHeight?: number; [key: string]: unknown }>
  [key: string]: unknown
}

// Change data interfaces
interface SidebarChangeData {
  isOpen?: boolean
}

interface ThemeChangeData {
  theme?: string
}

interface ViewChangeData {
  view?: string
}

interface ViewportChangeData {
  viewport?: { x: number; y: number; zoom: number }
}

interface NodeMoveData {
  nodeId?: string
  position?: { x: number; y: number }
}

interface SectionCollapseData {
  sectionId?: string
  collapsed?: boolean
  collapsedHeight?: number
}

// Types for cross-tab messages
export interface CrossTabMessage {
  id: string
  type: 'task_operation' | 'ui_state_change' | 'canvas_change' | 'heartbeat' | 'timer_session'
  timestamp: number
  tabId: string
  data: unknown
}

// ========== PHASE 2: TIMER LEADER ELECTION ==========
export interface TimerLeaderState {
  leaderId: string          // Tab ID of the leader
  lastHeartbeat: number     // Timestamp of last heartbeat
  sessionState: unknown         // Current timer session (null if no session)
}

export interface TimerSessionSync {
  action: 'claim_leadership' | 'heartbeat' | 'session_update' | 'session_stop'
  leaderId: string
  sessionState?: unknown
  timestamp: number
}

export interface TaskOperation {
  operation: 'create' | 'update' | 'delete' | 'bulk_update' | 'bulk_delete'
  taskId?: string
  taskIds?: string[]
  taskData?: unknown
  oldData?: unknown
  timestamp: number
}

export interface UIStateChange {
  store: 'ui' | 'canvas'
  action: string
  data: unknown
  timestamp: number
}

export interface CanvasChange {
  action: 'node_move' | 'section_collapse' | 'viewport_change'
  data: unknown
  timestamp: number
}

// Global state for synchronization
const isListening = ref(false)
const currentTabId = ref('')
const messageQueue = ref<CrossTabMessage[]>([])
const lastProcessedTimestamp = ref(0)
const isProcessing = ref(false)
const pendingLocalOperations = ref<Map<string, TaskOperation>>(new Map())
const conflictResolver = new ConflictResolver('cross-tab-sync')
// saveCoordinator removed - Phase 2 simplification
const performanceMonitor = new CrossTabPerformance()
const browserCompatibility = new CrossTabBrowserCompatibility()
let isCompatibilityChecked = false

// ========== PHASE 2: TIMER LEADER ELECTION STATE ==========
const timerLeaderState = ref<TimerLeaderState | null>(null)
const isTimerLeader = ref(false)
const TIMER_HEARTBEAT_INTERVAL_MS = 2000 // 2 seconds
const TIMER_LEADER_TIMEOUT_MS = 5000 // 5 seconds - if no heartbeat, leader is dead
let timerHeartbeatTimer: NodeJS.Timeout | null = null

// Callbacks for timer state updates (set by timer store)
let onTimerSessionUpdate: ((session: unknown) => void) | null = null
let onBecomeLeader: (() => void) | null = null
let onLoseLeadership: (() => void) | null = null

// Check if current leader is still alive (heartbeat within timeout)
const isLeaderAlive = (): boolean => {
  if (!timerLeaderState.value) return false
  const elapsed = Date.now() - timerLeaderState.value.lastHeartbeat
  return elapsed < TIMER_LEADER_TIMEOUT_MS
}

// Claim timer leadership
const claimTimerLeadership = (): boolean => {
  // Only claim if no leader or leader is dead
  if (timerLeaderState.value && isLeaderAlive() && timerLeaderState.value.leaderId !== currentTabId.value) {
    console.log('🎯 [TIMER] Cannot claim leadership - another leader is alive:', timerLeaderState.value.leaderId)
    return false
  }

  console.log('👑 [TIMER] Claiming timer leadership:', currentTabId.value)

  timerLeaderState.value = {
    leaderId: currentTabId.value,
    lastHeartbeat: Date.now(),
    sessionState: timerLeaderState.value?.sessionState || null
  }
  isTimerLeader.value = true

  // Broadcast leadership claim
  broadcastMessage({
    type: 'timer_session',
    data: {
      action: 'claim_leadership',
      leaderId: currentTabId.value,
      sessionState: timerLeaderState.value.sessionState,
      timestamp: Date.now()
    } as TimerSessionSync
  })

  // Start heartbeat
  startTimerHeartbeat()

  // Notify callback
  if (onBecomeLeader) {
    onBecomeLeader()
  }

  return true
}

// Start timer heartbeat (only for leader)
const startTimerHeartbeat = () => {
  if (timerHeartbeatTimer) {
    clearInterval(timerHeartbeatTimer)
  }

  timerHeartbeatTimer = setInterval(() => {
    if (isTimerLeader.value && timerLeaderState.value) {
      timerLeaderState.value.lastHeartbeat = Date.now()

      // Broadcast heartbeat
      broadcastMessage({
        type: 'timer_session',
        data: {
          action: 'heartbeat',
          leaderId: currentTabId.value,
          sessionState: timerLeaderState.value.sessionState,
          timestamp: Date.now()
        } as TimerSessionSync
      })
    }
  }, TIMER_HEARTBEAT_INTERVAL_MS)
}

// Stop timer heartbeat
const stopTimerHeartbeat = () => {
  if (timerHeartbeatTimer) {
    clearInterval(timerHeartbeatTimer)
    timerHeartbeatTimer = null
  }
}

// Handle timer session message
const handleTimerSessionMessage = (sync: TimerSessionSync) => {
  switch (sync.action) {
    case 'claim_leadership':
      // Another tab claimed leadership
      if (sync.leaderId !== currentTabId.value) {
        console.log('👑 [TIMER] Another tab claimed leadership:', sync.leaderId)

        // If we were leader, we lose it
        if (isTimerLeader.value) {
          console.log('😔 [TIMER] Lost leadership to:', sync.leaderId)
          isTimerLeader.value = false
          stopTimerHeartbeat()
          if (onLoseLeadership) {
            onLoseLeadership()
          }
        }

        timerLeaderState.value = {
          leaderId: sync.leaderId,
          lastHeartbeat: sync.timestamp,
          sessionState: sync.sessionState
        }

        // Update local timer state
        if (sync.sessionState && onTimerSessionUpdate) {
          onTimerSessionUpdate(sync.sessionState)
        }
      }
      break

    case 'heartbeat':
      // Update leader heartbeat
      if (timerLeaderState.value && sync.leaderId === timerLeaderState.value.leaderId) {
        timerLeaderState.value.lastHeartbeat = sync.timestamp
        timerLeaderState.value.sessionState = sync.sessionState

        // Update local timer state for non-leaders
        if (!isTimerLeader.value && sync.sessionState && onTimerSessionUpdate) {
          onTimerSessionUpdate(sync.sessionState)
        }
      }
      break

    case 'session_update':
      // Leader updated session state
      if (timerLeaderState.value) {
        timerLeaderState.value.sessionState = sync.sessionState
        timerLeaderState.value.lastHeartbeat = sync.timestamp
      }

      // Update local timer for non-leaders
      if (!isTimerLeader.value && onTimerSessionUpdate) {
        onTimerSessionUpdate(sync.sessionState)
      }
      break

    case 'session_stop':
      // Leader stopped session
      if (timerLeaderState.value) {
        timerLeaderState.value.sessionState = null
      }

      // Update local timer for non-leaders
      if (!isTimerLeader.value && onTimerSessionUpdate) {
        onTimerSessionUpdate(null)
      }
      break
  }
}

// Broadcast timer session update (only for leader)
const broadcastTimerSession = (sessionState: unknown) => {
  if (!isTimerLeader.value) {
    console.warn('⚠️ [TIMER] Only leader can broadcast timer session')
    return
  }

  if (timerLeaderState.value) {
    timerLeaderState.value.sessionState = sessionState
  }

  broadcastMessage({
    type: 'timer_session',
    data: {
      action: sessionState ? 'session_update' : 'session_stop',
      leaderId: currentTabId.value,
      sessionState,
      timestamp: Date.now()
    } as TimerSessionSync
  })
}

// ========== PHASE 1: OUTGOING MESSAGE BATCHING (100ms) ==========
// Queue outgoing messages for 100ms before sending (like waiting for an elevator)
const pendingOutgoingMessages = new Map<string, Omit<CrossTabMessage, 'id' | 'timestamp' | 'tabId'>>()
let outgoingFlushTimer: NodeJS.Timeout | null = null
const OUTGOING_BATCH_DELAY_MS = 100

// ========== PHASE 1: DEDUPLICATION WITH TTL (5 seconds) ==========
// Don't send the same message twice within 5 seconds
const recentlySentMessages = new Map<string, number>() // key -> timestamp
const DEDUP_TTL_MS = 5000

// Generate a deduplication key for a message
const getMessageDedupeKey = (message: Omit<CrossTabMessage, 'id' | 'timestamp' | 'tabId'>): string => {
  // Create key based on message type and relevant data
  if (message.type === 'task_operation') {
    const op = message.data as TaskOperation
    return `task:${op.operation}:${op.taskId || op.taskIds?.join(',') || 'bulk'}`
  }
  if (message.type === 'canvas_change') {
    const change = message.data as CanvasChange
    return `canvas:${change.action}:${JSON.stringify(change.data).slice(0, 50)}`
  }
  if (message.type === 'ui_state_change') {
    const change = message.data as UIStateChange
    return `ui:${change.store}:${change.action}`
  }
  return `${message.type}:${Date.now()}`
}

// Check if message was recently sent (within TTL)
const wasRecentlySent = (dedupeKey: string): boolean => {
  const lastSent = recentlySentMessages.get(dedupeKey)
  if (!lastSent) return false

  const elapsed = Date.now() - lastSent
  if (elapsed >= DEDUP_TTL_MS) {
    // Expired, remove from cache
    recentlySentMessages.delete(dedupeKey)
    return false
  }
  return true
}

// Mark message as sent for deduplication
const markAsSent = (dedupeKey: string): void => {
  recentlySentMessages.set(dedupeKey, Date.now())

  // Cleanup old entries periodically (every 10 messages)
  if (recentlySentMessages.size > 50) {
    const now = Date.now()
    for (const [key, timestamp] of recentlySentMessages.entries()) {
      if (now - timestamp >= DEDUP_TTL_MS) {
        recentlySentMessages.delete(key)
      }
    }
  }
}

// Queue a message for batched sending
const queueOutgoingMessage = (message: Omit<CrossTabMessage, 'id' | 'timestamp' | 'tabId'>): void => {
  const dedupeKey = getMessageDedupeKey(message)

  // Check if recently sent (skip if duplicate within 5s)
  if (wasRecentlySent(dedupeKey)) {
    console.log(`🔄 [BATCH] Skipping duplicate message (sent within ${DEDUP_TTL_MS}ms):`, dedupeKey)
    return
  }

  // Add to pending queue (latest wins for same key)
  pendingOutgoingMessages.set(dedupeKey, message)

  // Schedule flush if not already scheduled
  if (!outgoingFlushTimer) {
    outgoingFlushTimer = setTimeout(flushOutgoingMessages, OUTGOING_BATCH_DELAY_MS)
  }
}

// Flush all pending outgoing messages
const flushOutgoingMessages = (): void => {
  outgoingFlushTimer = null

  if (pendingOutgoingMessages.size === 0) return

  const messagesToSend = Array.from(pendingOutgoingMessages.entries())
  pendingOutgoingMessages.clear()

  console.log(`📤 [BATCH] Flushing ${messagesToSend.length} messages after ${OUTGOING_BATCH_DELAY_MS}ms batch window`)

  for (const [dedupeKey, message] of messagesToSend) {
    // Send immediately (bypass batching)
    sendMessageImmediately(message)
    // Mark as sent for deduplication
    markAsSent(dedupeKey)
  }
}

// Generate unique tab ID
const generateTabId = (): string => {
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ========== PHASE 1: BATCHED BROADCAST (public API) ==========
// This is the PUBLIC function - it queues messages for batching
const broadcastMessage = (message: Omit<CrossTabMessage, 'id' | 'timestamp' | 'tabId'>) => {
  if (typeof window === 'undefined') return

  // Queue for batched sending (100ms window)
  queueOutgoingMessage(message)
}

// ========== INTERNAL: Send message immediately (no batching) ==========
// This is the INTERNAL function - used by flush to actually send
const sendMessageImmediately = (message: Omit<CrossTabMessage, 'id' | 'timestamp' | 'tabId'>) => {
  if (typeof window === 'undefined') return

  // Check performance before broadcasting
  const performanceData = performanceMonitor.exportPerformanceData()
  if (performanceData.recommendations && performanceData.recommendations.length > 0) {
    console.log('⚠️ Performance recommendations detected:', performanceData.recommendations)
  }

  const fullMessage: CrossTabMessage = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    tabId: currentTabId.value,
    ...message
  }

  // Check for duplicate messages
  if (!performanceMonitor.shouldProcessMessage(fullMessage.id, fullMessage)) {
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
        } catch (_error) {
          // Ignore cleanup errors
        }
      }, 100)
    }

    // Record performance
    performanceMonitor.recordMessage(fullMessage.id, startTime, Date.now())

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
  const config = performanceMonitor.getConfig()
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
      if (!performanceMonitor.shouldProcessMessage(message.id, message)) {
        continue
      }

      const messageStartTime = Date.now()

      try {
        switch (message.type) {
          case 'task_operation':
            await handleTaskOperation(message.data as TaskOperation, taskStore as unknown as TaskStoreType)
            break
          case 'ui_state_change':
            await handleUIStateChange(message.data as UIStateChange, uiStore as unknown as UIStoreType, canvasStore as unknown as CanvasStoreType)
            break
          case 'canvas_change':
            await handleCanvasChange(message.data as CanvasChange, canvasStore as unknown as CanvasStoreType)
            break
          case 'heartbeat':
            // Handle heartbeat if needed
            break
          case 'timer_session':
            // PHASE 2: Handle timer session sync
            handleTimerSessionMessage(message.data as TimerSessionSync)
            break
        }

        // Update last processed timestamp
        lastProcessedTimestamp.value = Math.max(lastProcessedTimestamp.value, message.timestamp)

        // Record message processing performance
        performanceMonitor.recordMessage(message.id, messageStartTime, Date.now())

      } catch (error) {
        console.error('Failed to process cross-tab message:', error, message)
      }
    }

    // Clear processed messages
    messageQueue.value = []

    const processingTime = Date.now() - processingStartTime
    console.log(`✅ Message queue processed in ${processingTime}ms`)

    // Auto-optimize performance based on metrics
    const currentMetrics = performanceMonitor.getMetrics()
    if (currentMetrics.messageCount > 0 && currentMetrics.messageCount % 50 === 0) {
      performanceMonitor.optimizeConfiguration()
    }

  } finally {
    isProcessing.value = false
  }
}

// Handle task operations with conflict detection
const handleTaskOperation = async (operation: TaskOperation, taskStore: TaskStoreType) => {
  try {
    // Check for conflicts with pending local operations
    const conflicts = await detectTaskConflicts(operation, taskStore)

    if (conflicts.length > 0) {
      console.log(`⚠️ Detected ${conflicts.length} task conflicts, resolving...`)
      const resolutions = await conflictResolver.resolveConflict(conflicts[0])
      await applyConflictResolutions([resolutions] as unknown as ConflictInfo[], operation, taskStore)
      return
    }

    // No conflicts, apply operation normally
    switch (operation.operation) {
      case 'create':
        if (operation.taskData && operation.taskId) {
          // Refresh tasks from database to get new task
          await (taskStore as TaskStoreType).loadTasks()
        }
        break

      case 'update':
        if (operation.taskId && operation.taskData) {
          // Update local store with new data
          const existingTask = (taskStore as TaskStoreType).tasks.find(t => t.id === operation.taskId)
          if (existingTask) {
            Object.assign(existingTask, operation.taskData)
          }
        }
        break

      case 'delete':
        if (operation.taskId) {
          // Remove task from local store
          const store = taskStore as TaskStoreType
          const index = store.tasks.findIndex(t => t.id === operation.taskId)
          if (index > -1) {
            // Log before splice - mark as cross-tab sync deletion (not user-initiated)
            const oldTasks = [...store.tasks]
            store.tasks.splice(index, 1)
            taskDisappearanceLogger.logArrayReplacement(oldTasks, store.tasks, 'crossTabSync-delete')
          }
        }
        break

      case 'bulk_delete':
        if (operation.taskIds && Array.isArray(operation.taskIds)) {
          // Remove multiple tasks from local store
          const store = taskStore as TaskStoreType
          const oldTasks = [...store.tasks]
          operation.taskIds.forEach(taskId => {
            const index = store.tasks.findIndex(t => t.id === taskId)
            if (index > -1) {
              store.tasks.splice(index, 1)
            }
          })
          taskDisappearanceLogger.logArrayReplacement(oldTasks, store.tasks, 'crossTabSync-bulkDelete')
        }
        break

      case 'bulk_update':
        if (operation.taskData && Array.isArray(operation.taskData)) {
          // Update multiple tasks
          const store = taskStore as TaskStoreType
          ;(operation.taskData as Array<{ id: string; [key: string]: unknown }>).forEach((taskUpdate) => {
            const existingTask = store.tasks.find(t => t.id === taskUpdate.id)
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
const detectTaskConflicts = async (remoteOperation: TaskOperation, _taskStore: TaskStoreType): Promise<ConflictInfo[]> => {
  const conflicts: ConflictInfo[] = []

  if (!remoteOperation.taskId) return conflicts

  // Check if there's a pending local operation for the same task
  const pendingLocalOp = pendingLocalOperations.value.get(remoteOperation.taskId)

  if (pendingLocalOp) {
    const conflict: ConflictInfo = {
      documentId: remoteOperation.taskId,
      localVersion: pendingLocalOp as unknown as Record<string, unknown>,
      remoteVersion: remoteOperation as unknown as Record<string, unknown>,
      timestamp: Date.now(),
      conflictType: 'both_modified',
      autoResolvable: false
    }

    conflicts.push(conflict)
  }

  return conflicts
}

// Apply conflict resolutions
interface ResolutionWithStrategy extends ConflictInfo {
  resolution?: 'local_wins' | 'remote_wins' | 'merge'
  entityId?: string
  localOperation?: { taskData?: unknown }
}

const applyConflictResolutions = async (resolutions: ConflictInfo[], remoteOperation: TaskOperation, taskStore: TaskStoreType) => {
  for (const res of resolutions) {
    const resolution = res as ResolutionWithStrategy
    const entityId = resolution.entityId || resolution.documentId

    switch (resolution.resolution) {
      case 'local_wins':
        console.log('🏆 Local operation wins conflict for task:', entityId)
        // Keep local changes, ignore remote operation
        break

      case 'remote_wins':
        console.log('🏆 Remote operation wins conflict for task:', entityId)
        // Apply remote operation, discard local changes
        await applyTaskOperation(remoteOperation, taskStore)
        // Remove pending local operation
        if (entityId) pendingLocalOperations.value.delete(entityId)
        break

      case 'merge':
        console.log('🔀 Merging conflicting operations for task:', entityId)
        // Apply merged operation
        if (resolution.localOperation?.taskData) {
          await applyTaskOperation({
            ...remoteOperation,
            taskData: resolution.localOperation.taskData
          }, taskStore)
        }
        // Remove pending local operation
        if (entityId) pendingLocalOperations.value.delete(entityId)
        break

      default:
        console.warn('Unknown conflict resolution:', resolution.resolution)
        // Default to remote wins
        await applyTaskOperation(remoteOperation, taskStore)
        if (entityId) pendingLocalOperations.value.delete(entityId)
        break
    }
  }
}

// Apply a single task operation with save coordination
const applyTaskOperation = async (operation: TaskOperation, taskStore: TaskStoreType) => {
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
        const existingTask = taskStore.tasks.find(t => t.id === operation.taskId)
        if (existingTask) {
          Object.assign(existingTask, operation.taskData)
          // Save through direct PouchDB (saveCoordinator removed)
          // PouchDB sync handles this automatically
        }
      }
      break

    case 'delete':
      if (operation.taskId) {
        const index = taskStore.tasks.findIndex(t => t.id === operation.taskId)
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
const handleUIStateChange = async (change: UIStateChange, uiStore: UIStoreType, canvasStore: CanvasStoreType) => {
  try {
    if (change.store === 'ui') {
      // Update UI store state
      const data = change.data as SidebarChangeData & ThemeChangeData & ViewChangeData
      switch (change.action) {
        case 'sidebar_toggle':
          if (typeof data.isOpen === 'boolean') {
            uiStore.sidebarOpen = data.isOpen
          }
          break
        case 'theme_change':
          if (data.theme) {
            uiStore.theme = data.theme
          }
          break
        case 'view_change':
          if (data.view) {
            uiStore.activeView = data.view
          }
          break
      }
    } else if (change.store === 'canvas') {
      // Handle canvas state changes
      const data = change.data as ViewportChangeData
      switch (change.action) {
        case 'viewport_change':
          if (data.viewport) {
            Object.assign(canvasStore.viewport, data.viewport)
          }
          break
      }
    }
  } catch (error) {
    console.error('Failed to handle UI state change:', error, change)
  }
}

// Handle canvas changes
const handleCanvasChange = async (change: CanvasChange, canvasStore: CanvasStoreType) => {
  try {
    switch (change.action) {
      case 'node_move': {
        const data = change.data as NodeMoveData
        if (data.nodeId && data.position) {
          const node = canvasStore.nodes.find(n => n.id === data.nodeId)
          if (node) {
            node.position = data.position
          }
        }
        break
      }

      case 'section_collapse': {
        const data = change.data as SectionCollapseData
        if (data.sectionId && typeof data.collapsed === 'boolean') {
          const section = canvasStore.sections.find(s => s.id === data.sectionId)
          if (section) {
            section.collapsed = data.collapsed
            if (data.collapsedHeight) {
              section.collapsedHeight = data.collapsedHeight
            }
          }
        }
        break
      }
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

    // Use correct method names from CrossTabBrowserCompatibility class
    const compatibilityInfo = browserCompatibility.getCompatibilityInfo()
    const isSupported = browserCompatibility.isCompatible()

    console.log('🌐 Browser Info:', compatibilityInfo)
    console.log('✅ Compatibility supported:', isSupported)

    if (!isSupported) {
      console.error('❌ Cross-tab sync not supported in this browser')
      throw new Error('Browser does not support required features for cross-tab synchronization')
    }

    if (compatibilityInfo.warnings && compatibilityInfo.warnings.length > 0) {
      console.warn('⚠️ Compatibility warnings:', compatibilityInfo.warnings)
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
    const compatibilityInfo = browserCompatibility.getCompatibilityInfo()

    // Apply performance configuration from recommended config
    performanceMonitor.updateConfig({
      maxQueueSize: 100,
      batchSize: 10,
      batchTimeout: 1000,
      debounceDelay: 100,
      cacheTimeout: 5000,
      enableCompression: false,
      enableDeduplication: true
    })

    // Log optimization details
    console.log('🚀 Browser compatibility info:', compatibilityInfo)
    console.log('💡 Using recommended config:', config)

  } catch (error) {
    console.warn('Failed to apply browser optimizations:', error)
    // Continue with default settings
  }
}

// Main composable function
export function useCrossTabSync() {
  const _taskStore = useTaskStore()
  const _uiStore = useUIStore()
  const _canvasStore = useCanvasStore()

  // Track if this instance has been initialized (prevents double init)
  let instanceInitialized = false

  // Initialize cross-tab sync with compatibility checking
  const initialize = async () => {
    if (typeof window === 'undefined') return

    // BUG-016 FIX: Prevent double initialization
    // This can be called both immediately (for store contexts) and in onMounted (for component contexts)
    if (instanceInitialized) {
      console.log('🔄 Cross-tab sync already initialized, skipping')
      return
    }

    try {
      // BUG-016 FIX: Browser compatibility check should not block initialization
      // Even if it fails, we should still add the event listener for basic functionality
      if (!isCompatibilityChecked) {
        try {
          await checkBrowserCompatibility()
        } catch (compatError) {
          console.warn('⚠️ Browser compatibility check failed, proceeding with basic functionality:', compatError)
          isCompatibilityChecked = true // Mark as checked to prevent retries
        }
      }

      currentTabId.value = generateTabId()
      isListening.value = true
      instanceInitialized = true

      // saveCoordinator removed - Phase 2 simplification

      // Apply browser-specific optimizations (also made resilient)
      try {
        applyBrowserOptimizations()
      } catch (optError) {
        console.warn('⚠️ Failed to apply browser optimizations, using defaults:', optError)
      }

      // Start listening for storage changes - THIS IS THE CRITICAL PART
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
    instanceInitialized = false // BUG-016 FIX: Allow re-initialization after cleanup
    window.removeEventListener('storage', handleStorageChange)

    if (messageTimeout) {
      clearTimeout(messageTimeout)
      messageTimeout = null
    }

    // PHASE 1: Cleanup outgoing batch timer
    if (outgoingFlushTimer) {
      clearTimeout(outgoingFlushTimer)
      outgoingFlushTimer = null
    }
    pendingOutgoingMessages.clear()
    recentlySentMessages.clear()

    // PHASE 2: Cleanup timer leader state
    stopTimerHeartbeat()
    isTimerLeader.value = false
    timerLeaderState.value = null

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

  // BUG-016 FIX: Initialize IMMEDIATELY for non-component contexts (e.g., Pinia stores)
  // This ensures cross-tab sync works even when called outside Vue components
  // The onMounted hook below will also call initialize() but the double-init guard prevents issues
  initialize()

  // Setup lifecycle hooks (for component contexts - provides proper cleanup)
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

    // PHASE 2: Timer leadership
    isTimerLeader,
    timerLeaderState,
    claimTimerLeadership,
    broadcastTimerSession,
    setTimerCallbacks: (callbacks: {
      onSessionUpdate?: (session: unknown) => void
      onBecomeLeader?: () => void
      onLoseLeadership?: () => void
    }) => {
      onTimerSessionUpdate = callbacks.onSessionUpdate || null
      onBecomeLeader = callbacks.onBecomeLeader || null
      onLoseLeadership = callbacks.onLoseLeadership || null
    },

    // Performance monitoring
    getPerformanceMetrics: () => performanceMonitor.getMetrics(),
    getPerformanceData: () => performanceMonitor.exportPerformanceData(),
    optimizePerformance: () => performanceMonitor.optimizeConfiguration(),
    resetPerformanceMetrics: () => performanceMonitor.resetMetrics(),

    // Browser compatibility - use correct method names from CrossTabBrowserCompatibility class
    getBrowserInfo: () => browserCompatibility.getCompatibilityInfo(),
    getCompatibilityResult: () => browserCompatibility.getCompatibilityInfo(),
    isCompatible: () => browserCompatibility.isCompatible(),
    getRecommendedConfig: () => browserCompatibility.getRecommendedConfig()
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