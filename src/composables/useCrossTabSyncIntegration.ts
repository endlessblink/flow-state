import { watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useTaskStore } from '@/stores/tasks'
import { useUIStore } from '@/stores/ui'
import { useCanvasStore } from '@/stores/canvas'
import { getCrossTabSync, type TaskOperation, type UIStateChange, type CanvasChange } from './useCrossTabSync'
import { getUndoSystem } from './undoSingleton'

/**
 * Integration composable that connects cross-tab sync with existing Pinia stores
 * This intercepts store operations and broadcasts them to other tabs
 */

export function useCrossTabSyncIntegration() {
  const taskStore = useTaskStore()
  const uiStore = useUIStore()
  const canvasStore = useCanvasStore()
  const crossTabSync = getCrossTabSync()
  const undoSystem = getUndoSystem()

  let isIntegrationEnabled = false
  let lastKnownTaskState: any[] = []
  let isProcessingRemoteChange = false

  // Initialize integration
  const initialize = () => {
    if (isIntegrationEnabled) return

    console.log('🔄 Initializing cross-tab sync integration...')

    // Store initial state
    lastKnownTaskState = JSON.parse(JSON.stringify(taskStore.tasks))

    // Setup task store watchers
    setupTaskStoreWatchers()

    // Setup UI store watchers
    setupUIStoreWatchers()

    // Setup canvas store watchers
    setupCanvasStoreWatchers()

    isIntegrationEnabled = true
    console.log('✅ Cross-tab sync integration enabled')
  }

  // Setup watchers for task store operations
  const setupTaskStoreWatchers = () => {
    // Watch for task creation
    watch(
      () => taskStore.tasks.length,
      (newLength, oldLength) => {
        if (isProcessingRemoteChange || newLength <= oldLength) return

        // Find the new task
        const newTask = taskStore.tasks[newLength - 1]
        if (newTask) {
          broadcastTaskOperation({
            operation: 'create',
            taskId: newTask.id,
            taskData: newTask,
            timestamp: Date.now()
          })
        }
      }
    )

    // PHASE 3: Watch for individual task updates (OPTIMIZED - removed deep: true)
    // Using hash-based comparison via getter function is more efficient than deep: true
    watch(
      // Getter already extracts specific properties - Vue compares by reference
      () => taskStore.tasks.map(task =>
        `${task.id}:${task.title}:${task.status}:${task.priority}:${task.progress}:${task.updatedAt}`
      ).join('|'),
      (newHash, oldHash) => {
        if (isProcessingRemoteChange || newHash === oldHash) return

        // Hash changed - find and broadcast changed tasks
        const currentTasks = taskStore.tasks
        currentTasks.forEach(task => {
          broadcastTaskOperation({
            operation: 'update',
            taskId: task.id,
            taskData: task,
            timestamp: Date.now()
          })
        })
      }
      // NO deep: true needed - hash string comparison is O(1)
    )

    // Watch for task deletions by comparing arrays
    watch(
      () => [...taskStore.tasks.map(t => t.id)],
      (newTaskIds, oldTaskIds) => {
        if (isProcessingRemoteChange) return

        // Find deleted task IDs
        const deletedTaskIds = oldTaskIds?.filter(id => !newTaskIds.includes(id)) || []

        deletedTaskIds.forEach(taskId => {
          broadcastTaskOperation({
            operation: 'delete',
            taskId,
            timestamp: Date.now()
          })
        })
      }
    )
  }

  // Setup watchers for UI store changes
  const setupUIStoreWatchers = () => {
    // Watch sidebar state changes
    watch(
      () => [uiStore.mainSidebarVisible, uiStore.secondarySidebarVisible],
      ([newMainSidebar, newSecondarySidebar], [oldMainSidebar, oldSecondarySidebar]) => {
        if (isProcessingRemoteChange) return

        if (newMainSidebar !== oldMainSidebar) {
          broadcastUIStateChange({
            store: 'ui',
            action: 'sidebar_toggle',
            data: { isOpen: newMainSidebar },
            timestamp: Date.now()
          })
        }
      }
    )

    // Watch theme changes
    watch(
      () => uiStore.theme,
      (newTheme, oldTheme) => {
        if (isProcessingRemoteChange || newTheme === oldTheme) return

        broadcastUIStateChange({
          store: 'ui',
          action: 'theme_change',
          data: { theme: newTheme },
          timestamp: Date.now()
        })
      }
    )

    // Watch active view changes
    watch(
      () => uiStore.activeView,
      (newView, oldView) => {
        if (isProcessingRemoteChange || newView === oldView) return

        broadcastUIStateChange({
          store: 'ui',
          action: 'view_change',
          data: { view: newView },
          timestamp: Date.now()
        })
      }
    )
  }

  // Setup watchers for canvas store changes
  const setupCanvasStoreWatchers = () => {
    // PHASE 3: Watch viewport changes (OPTIMIZED - removed deep: true)
    watch(
      // Hash viewport properties instead of deep comparison
      () => {
        const v = canvasStore.viewport
        return `${v?.x || 0}:${v?.y || 0}:${v?.zoom || 1}`
      },
      (newHash, oldHash) => {
        if (isProcessingRemoteChange || newHash === oldHash) return

        broadcastCanvasChange({
          action: 'viewport_change',
          data: { viewport: canvasStore.viewport },
          timestamp: Date.now()
        })
      }
      // NO deep: true needed - hash string comparison is O(1)
    )

    // PHASE 3: Watch section collapse states (OPTIMIZED - removed deep: true)
    watch(
      // Hash section collapse states instead of deep comparison
      () => canvasStore.sections.map(s =>
        `${s.id}:${s.isCollapsed}:${s.collapsedHeight || 0}`
      ).join('|'),
      (newHash, oldHash) => {
        if (isProcessingRemoteChange || newHash === oldHash) return

        // Hash changed - broadcast all section states
        canvasStore.sections.forEach(section => {
          broadcastCanvasChange({
            action: 'section_collapse',
            data: {
              sectionId: section.id,
              collapsed: section.isCollapsed,
              collapsedHeight: section.collapsedHeight
            },
            timestamp: Date.now()
          })
        })
      }
      // NO deep: true needed - hash string comparison is O(1)
    )

    // Watch node position changes - FIXED: canvasStore.nodes doesn't exist
    // Nodes are managed by Vue Flow locally in CanvasView.vue, not in the Pinia store
    // We skip this watcher since nodes aren't available in the canvas store
    console.log('🔄 [CrossTab Sync] Skipping node position watcher - canvasStore.nodes not available (nodes managed by Vue Flow)')
  }

  // SYNC FIX: Throttle constants to prevent broadcast storms
  const TASK_BROADCAST_DELAY = 500    // 500ms debounce for task operations
  const UI_BROADCAST_DELAY = 300      // 300ms debounce for UI changes
  const CANVAS_BROADCAST_DELAY = 500  // 500ms debounce for canvas changes

  // Broadcast task operations (internal, unthrottled)
  const _broadcastTaskOperation = (operation: TaskOperation) => {
    if (!isIntegrationEnabled) return

    try {
      // Track local operation for conflict detection
      crossTabSync.trackLocalOperation(operation)

      // Broadcast to other tabs
      crossTabSync.broadcastTaskOperation(operation)
      console.log('📤 Broadcasted task operation:', operation.operation, operation.taskId)
    } catch (error) {
      console.error('Failed to broadcast task operation:', error)
    }
  }

  // Broadcast UI state changes (internal, unthrottled)
  const _broadcastUIStateChange = (change: UIStateChange) => {
    if (!isIntegrationEnabled) return

    try {
      crossTabSync.broadcastUIStateChange(change)
      console.log('📤 Broadcasted UI state change:', change.action)
    } catch (error) {
      console.error('Failed to broadcast UI state change:', error)
    }
  }

  // Broadcast canvas changes (internal, unthrottled)
  const _broadcastCanvasChange = (change: CanvasChange) => {
    if (!isIntegrationEnabled) return

    try {
      crossTabSync.broadcastCanvasChange(change)
      console.log('📤 Broadcasted canvas change:', change.action)
    } catch (error) {
      console.error('Failed to broadcast canvas change:', error)
    }
  }

  // SYNC FIX: Throttled broadcast functions to prevent infinite loops
  // These are used by watchers to prevent rapid successive broadcasts
  const broadcastTaskOperation = useDebounceFn(_broadcastTaskOperation, TASK_BROADCAST_DELAY)
  const broadcastUIStateChange = useDebounceFn(_broadcastUIStateChange, UI_BROADCAST_DELAY)
  const broadcastCanvasChange = useDebounceFn(_broadcastCanvasChange, CANVAS_BROADCAST_DELAY)

  // Handle incoming remote changes by temporarily disabling broadcasting
  const handleRemoteChangeStart = () => {
    isProcessingRemoteChange = true
  }

  const handleRemoteChangeEnd = () => {
    // Small delay to ensure all related changes are processed
    setTimeout(() => {
      isProcessingRemoteChange = false
    }, 10)
  }

  // Override task store methods to integrate with cross-tab sync
  const integrateTaskStoreMethods = () => {
    if (!taskStore || !isIntegrationEnabled) return

    // Store original methods
    const originalCreateTask = taskStore.createTask.bind(taskStore)
    const originalUpdateTask = taskStore.updateTask.bind(taskStore)
    const originalDeleteTask = taskStore.deleteTask.bind(taskStore)

    // Override createTask
    taskStore.createTask = function(taskData: any) {
      const result = originalCreateTask(taskData)

      // Broadcast after creation
      setTimeout(() => {
        const newTask = taskStore.tasks[taskStore.tasks.length - 1]
        if (newTask) {
          broadcastTaskOperation({
            operation: 'create',
            taskId: newTask.id,
            taskData: newTask,
            timestamp: Date.now()
          })
        }
      }, 0)

      return result
    }

    // Override updateTask
    taskStore.updateTask = function(taskId: string, updates: any) {
      const oldTask = taskStore.tasks.find(t => t.id === taskId)
      const result = originalUpdateTask(taskId, updates)

      // Broadcast after update
      setTimeout(() => {
        const updatedTask = taskStore.tasks.find(t => t.id === taskId)
        if (updatedTask) {
          broadcastTaskOperation({
            operation: 'update',
            taskId,
            taskData: updatedTask,
            oldData: oldTask,
            timestamp: Date.now()
          })
        }
      }, 0)

      return result
    }

    // Override deleteTask
    taskStore.deleteTask = async function(taskId: string) {
      const oldTask = taskStore.tasks.find(t => t.id === taskId)
      const result = await originalDeleteTask(taskId)

      // Broadcast after deletion
      setTimeout(() => {
        broadcastTaskOperation({
          operation: 'delete',
          taskId,
          timestamp: Date.now()
        })
      }, 0)

      return result
    }

    console.log('✅ Task store methods integrated with cross-tab sync')
  }

  // Cleanup integration
  const cleanup = () => {
    isIntegrationEnabled = false
    isProcessingRemoteChange = false
    console.log('🔄 Cross-tab sync integration disabled')
  }

  // Auto-initialize when cross-tab sync is ready
  if (crossTabSync.isListening) {
    initialize()
  } else {
    // Wait for cross-tab sync to initialize
    const unwatch = watch(
      () => crossTabSync.isListening,
      (isListening) => {
        if (isListening) {
          initialize()
          unwatch()
        }
      },
      { immediate: true }
    )
  }

  return {
    initialize,
    cleanup,
    integrateTaskStoreMethods,
    isIntegrationEnabled: () => isIntegrationEnabled,
    isProcessingRemoteChange: () => isProcessingRemoteChange
  }
}

// Export singleton instance
let integrationInstance: ReturnType<typeof useCrossTabSyncIntegration> | null = null

export const getCrossTabSyncIntegration = () => {
  if (!integrationInstance) {
    integrationInstance = useCrossTabSyncIntegration()
  }
  return integrationInstance
}