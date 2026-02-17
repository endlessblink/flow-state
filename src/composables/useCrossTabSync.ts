import { ref, onUnmounted, getCurrentInstance, onMounted } from 'vue'
import { useTaskStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import { useCanvasStore } from '@/stores/canvas'
import { useAuthStore } from '@/stores/auth'
import { useBroadcastChannelSync } from './sync/useBroadcastChannelSync'
import { useTimerLeaderElection } from './sync/useTimerLeaderElection'
import { CROSS_TAB_DEDUP_TIMEOUT_MS } from '@/config/timing'

// Types for cross-tab messages
export interface CrossTabMessage {
  id: string
  type: 'task_operation' | 'ui_state_change' | 'canvas_change' | 'heartbeat' | 'timer_session'
  timestamp: number
  tabId: string
  data: unknown
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
const pendingLocalOperations = ref<Map<string, TaskOperation>>(new Map())

export function useCrossTabSync() {
  const _authStore = useAuthStore()
  const taskStore = useTaskStore()
  const uiStore = useUIStore()
  const _canvasStore = useCanvasStore()

  // Initialize sub-composables
  const { tabId: currentTabId, connect, disconnect, broadcast, onMessage } = useBroadcastChannelSync()

  // Define callbacks for timer state updates (set by timer store)
  let _onTimerSessionUpdate: ((session: unknown) => void) | null = null
  let _onBecomeLeader: (() => void) | null = null
  let _onLoseLeadership: (() => void) | null = null

  const {
    isLeader: isTimerLeader,
    leaderState: timerLeaderState,
    claimLeadership: claimTimerLeadership,
    handleLeaderMessage,
    cleanup: cleanupLeader
  } = useTimerLeaderElection({
    tabId: currentTabId.value,
    broadcastMessage: (msg: any) => broadcast('timer_session', msg),
    onBecomeLeader: () => _onBecomeLeader?.(),
    onLoseLeadership: () => _onLoseLeadership?.(),
    onSessionUpdate: (session) => _onTimerSessionUpdate?.(session)
  })

  // Message processing logic
  const handleTaskOperation = async (operation: TaskOperation) => {
    switch (operation.operation) {
      case 'create':
        if (operation.taskData && operation.taskId) {
          await taskStore.loadFromDatabase()
        }
        break
      case 'update':
        if (operation.taskId && operation.taskData) {
          const task = taskStore.tasks.find(t => t.id === operation.taskId)
          // BUG-1051: Fix sync race condition - check for manual operation and timestamp
          if (task) {
            // Don't overwrite if user is actively editing
            if (taskStore.manualOperationInProgress) return

            // Prevent stale data from overwriting newer data
            const incomingTimestamp = (operation.taskData as any).updatedAt
            if (incomingTimestamp && task.updatedAt &&
                new Date(task.updatedAt) > new Date(incomingTimestamp)) {
              return
            }

            // CRITICAL FIX: Version-aware update - never overwrite geometry from cross-tab
            const incomingVersion = (operation.taskData as any).positionVersion ?? 0
            const localVersion = task.positionVersion ?? 0

            // Only accept if incoming version is newer
            if (incomingVersion < localVersion) {
              console.log(`[CROSS-TAB] Skipping stale update for ${operation.taskId.slice(0, 8)} (local v${localVersion} > remote v${incomingVersion})`)
              return
            }

            // Strip geometry fields from cross-tab sync - geometry should only come from drag handlers
            const { canvasPosition: _canvasPosition, parentId: _parentId, positionFormat: _positionFormat, ...safeUpdates } = operation.taskData as any

            // Apply only non-geometry updates
            Object.assign(task, safeUpdates)
          }
        }
        break
      case 'delete':
        if (operation.taskId) {
          const index = taskStore.tasks.findIndex(t => t.id === operation.taskId)
          if (index > -1) taskStore.tasks.splice(index, 1)
        }
        break
    }
  }

  const handleUIStateChange = (change: UIStateChange) => {
    if (change.store === 'ui') {
      if (change.action === 'sidebar_toggle') {
        const data = change.data as { isOpen: boolean }
        uiStore.mainSidebarVisible = data.isOpen
      }
    }
  }

  // Set up message handlers
  onMessage('task_operation', handleTaskOperation)
  onMessage('ui_state_change', handleUIStateChange)
  onMessage('timer_session', handleLeaderMessage)

  const initialize = () => {
    if (isListening.value) return
    connect()
    isListening.value = true
  }

  const cleanup = () => {
    disconnect()
    cleanupLeader()
    isListening.value = false
  }

  const trackLocalOperation = (operation: TaskOperation) => {
    if (operation.taskId) {
      pendingLocalOperations.value.set(operation.taskId, operation)
      setTimeout(() => pendingLocalOperations.value.delete(operation.taskId!), CROSS_TAB_DEDUP_TIMEOUT_MS)
    }
  }

  // Lifecycle
  if (getCurrentInstance()) {
    onMounted(initialize)
    onUnmounted(cleanup)
  } else {
    initialize()
  }

  return {
    isListening,
    currentTabId,
    pendingLocalOperations,
    isTimerLeader,
    timerLeaderState,
    initialize,
    cleanup,
    broadcastTimerSession: (session: unknown) => {
      if (isTimerLeader.value) {
        broadcast('timer_session', {
          action: session ? 'session_update' : 'session_stop',
          leaderId: currentTabId.value,
          sessionState: session,
          timestamp: Date.now()
        })
      }
    },
    claimTimerLeadership,
    setTimerCallbacks: (callbacks: {
      onSessionUpdate?: (session: unknown) => void
      onBecomeLeader?: () => void
      onLoseLeadership?: () => void
    }) => {
      _onTimerSessionUpdate = callbacks.onSessionUpdate || null
      _onBecomeLeader = callbacks.onBecomeLeader || null
      _onLoseLeadership = callbacks.onLoseLeadership || null
    },
    trackLocalOperation,
    broadcastTaskOperation: (op: TaskOperation) => broadcast('task_operation', op),
    broadcastUIStateChange: (change: UIStateChange) => broadcast('ui_state_change', change),
    broadcastCanvasChange: (change: CanvasChange) => broadcast('canvas_change', change)
  }
}

// Singleton for easier store access
let _syncInstance: ReturnType<typeof useCrossTabSync> | null = null
export const getCrossTabSync = () => {
  if (!_syncInstance) _syncInstance = useCrossTabSync()
  return _syncInstance
}