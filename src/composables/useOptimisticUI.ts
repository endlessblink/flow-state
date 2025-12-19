/**
 * Optimistic UI Updates Composable
 * Provides immediate UI feedback while operations are queued offline
 */

import { ref, computed, reactive } from 'vue'
import { useTaskStore } from '@/stores/tasks'
// import { useToast } from '@/composables/useToast' // Not implemented
import type { QueuedOperation, OnlineStatus } from '@/utils/offlineQueue'

interface OptimisticUpdate {
  id: string
  operation: QueuedOperation
  originalData: unknown
  optimisticData: unknown
  timestamp: number
  status: 'pending' | 'success' | 'failed' | 'reverted'
  uiElements: string[] // CSS selectors or component IDs affected
  rollback?: () => void
}

interface OfflineIndicator {
  show: boolean
  message: string
  type: 'info' | 'warning' | 'error'
  count: number
  estimatedTime?: number
}

export function useOptimisticUI() {
  const tasksStore = useTaskStore()
  // const toast = useToast() // Not implemented

  // Reactive state
  const optimisticUpdates = ref<Map<string, OptimisticUpdate>>(new Map())
  const offlineIndicator = reactive<OfflineIndicator>({
    show: false,
    message: '',
    type: 'info',
    count: 0,
    estimatedTime: undefined
  })

  const onlineStatus = ref<OnlineStatus>({
    isOnline: navigator.onLine,
    connectionType: 'online',
    lastConnected: Date.now(),
    connectionQuality: 1,
    syncStrategy: 'immediate'
  })

  // Computed properties
  const hasPendingUpdates = computed(() =>
    Array.from(optimisticUpdates.value.values()).some(update =>
      update.status === 'pending'
    )
  )

  const pendingUpdatesCount = computed(() =>
    Array.from(optimisticUpdates.value.values()).filter(update =>
      update.status === 'pending'
    ).length
  )

  const failedUpdatesCount = computed(() =>
    Array.from(optimisticUpdates.value.values()).filter(update =>
      update.status === 'failed'
    ).length
  )

  /**
   * Apply optimistic update for task creation
   */
  const createTaskOptimistic = async (taskData: unknown): Promise<string> => {
    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const optimisticTask = {
      id: optimisticId,
      ...taskData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      optimistic: true,
      pendingSync: true
    }

    // Store original data (empty for creation)
    const originalData = null

    // Apply optimistic update to local store
    tasksStore.createTask(optimisticTask)

    // Create optimistic update record
    const optimisticUpdate: OptimisticUpdate = {
      id: optimisticId,
      operation: {
        id: optimisticId,
        type: 'create',
        entityType: 'task',
        entityId: optimisticId,
        data: taskData,
        timestamp: Date.now(),
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        dependencies: []
      },
      originalData: originalData,
      optimisticData: optimisticTask,
      timestamp: Date.now(),
      status: 'pending',
      uiElements: [`[data-task-id="${optimisticId}"]`],
      rollback: () => {
        tasksStore.deleteTask(optimisticId)
      }
    }

    optimisticUpdates.value.set(optimisticId, optimisticUpdate)

    // Show success toast for immediate feedback
    // toast.success('Task created (syncing...)', {
    //   duration: 3000,
    //   action: {
    //     label: 'View',
    //     handler: () => {
    //       // Focus on the created task
    //       const element = document.querySelector(`[data-task-id="${optimisticId}"]`)
    //       element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    //     }
    //   }
    // })

    updateOfflineIndicator()

    return optimisticId
  }

  /**
   * Apply optimistic update for task update
   */
  const updateTaskOptimistic = async (taskId: string, updates: unknown): Promise<void> => {
    const originalTask = tasksStore.getTask(taskId)
    if (!originalTask) {
      throw new Error('Task not found for optimistic update')
    }

    // Create optimistic version
    const optimisticTask = {
      ...originalTask,
      ...updates,
      updatedAt: Date.now(),
      optimistic: true,
      pendingSync: true
    }

    // Store original data for rollback
    const originalData = { ...originalTask }

    // Apply optimistic update to local store
    tasksStore.updateTask(taskId, optimisticTask)

    // Create optimistic update record
    const updateId = `update-${taskId}-${Date.now()}`
    const optimisticUpdate: OptimisticUpdate = {
      id: updateId,
      operation: {
        id: updateId,
        type: 'update',
        entityType: 'task',
        entityId: taskId,
        data: updates,
        originalData: originalTask,
        timestamp: Date.now(),
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        dependencies: []
      },
      originalData: originalTask,
      optimisticData: optimisticTask,
      timestamp: Date.now(),
      status: 'pending',
      uiElements: [`[data-task-id="${taskId}"]`],
      rollback: () => {
        tasksStore.updateTask(taskId, originalData)
      }
    }

    optimisticUpdates.value.set(updateId, optimisticUpdate)

    // Show subtle success indicator
    // toast.info('Task updated (syncing...)', { duration: 2000 })

    updateOfflineIndicator()
  }

  /**
   * Apply optimistic update for task deletion
   */
  const deleteTaskOptimistic = async (taskId: string): Promise<void> => {
    const originalTask = tasksStore.getTask(taskId)
    if (!originalTask) {
      throw new Error('Task not found for optimistic deletion')
    }

    // Remove from UI immediately
    tasksStore.deleteTask(taskId)

    // Create optimistic update record
    const updateId = `delete-${taskId}-${Date.now()}`
    const optimisticUpdate: OptimisticUpdate = {
      id: updateId,
      operation: {
        id: updateId,
        type: 'delete',
        entityType: 'task',
        entityId: taskId,
        data: {},
        originalData: originalTask,
        timestamp: Date.now(),
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        status: 'pending',
        dependencies: []
      },
      originalData: originalTask,
      optimisticData: null,
      timestamp: Date.now(),
      status: 'pending',
      uiElements: [`[data-task-id="${taskId}"]`],
      rollback: () => {
        tasksStore.createTask(originalTask)
      }
    }

    optimisticUpdates.value.set(updateId, optimisticUpdate)

    // Show deletion toast with undo option
    // toast.warning('Task deleted (syncing...)', {
    //   duration: 5000,
    //   action: {
    //     label: 'Undo',
    //     handler: () => {
    //       rollbackOptimisticUpdate(updateId)
    //     }
    //   }
    // })

    updateOfflineIndicator()
  }

  /**
   * Handle successful operation completion
   */
  const handleOperationSuccess = (operationId: string, serverId?: string): void => {
    // Find optimistic update
    const update = Array.from(optimisticUpdates.value.values()).find(
      u => u.operation.id === operationId
    )

    if (!update) return

    // Update status
    update.status = 'success'

    // Remove optimistic flags from the actual data
    if (update.optimisticData) {
      const { optimistic: _optimistic, pendingSync: _pendingSync, ...cleanData } = update.optimisticData
      if (serverId && cleanData.id?.toString().startsWith('optimistic-')) {
        cleanData.id = serverId
      }

      // Update the real data in store
      if (update.operation.type === 'create') {
        tasksStore.updateTask(update.operation.optimisticId || update.id, cleanData)
      } else if (update.operation.type === 'update') {
        tasksStore.updateTask(update.operation.entityId, cleanData)
      }
    }

    // Remove from pending updates after a delay
    setTimeout(() => {
      optimisticUpdates.value.delete(update.id)
      updateOfflineIndicator()
    }, 2000)

    // Show success notification
    // toast.success('Changes synced successfully', { duration: 3000 })
  }

  /**
   * Handle operation failure
   */
  const handleOperationFailure = (operationId: string, _error: string): void => {
    // Find optimistic update
    const update = Array.from(optimisticUpdates.value.values()).find(
      u => u.operation.id === operationId
    )

    if (!update) return

    update.status = 'failed'

    // Show error notification with retry option
    // toast.error(`Failed to sync: ${error}`, {
    //   duration: 0, // Persistent until dismissed
    //   action: {
    //     label: 'Retry',
    //     handler: () => {
    //       // Retry the operation
    //       update.status = 'pending'
    //       optimisticUpdates.value.set(update.id, update)
    //       updateOfflineIndicator()
    //     }
    //   }
    // })

    // Add visual error state to affected UI elements
    update.uiElements.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i] as HTMLElement
        element.classList.add('optimistic-error')
        // Pulsing error animation
        element.style.animation = 'pulse 1s infinite'
      }
    })

    updateOfflineIndicator()
  }

  /**
   * Rollback optimistic update
   */
  const rollbackOptimisticUpdate = (updateId: string): void => {
    const update = optimisticUpdates.value.get(updateId)
    if (!update || !update.rollback) return

    try {
      update.rollback()
      optimisticUpdates.value.delete(updateId)

      // toast.info('Changes reverted', { duration: 2000 })
      updateOfflineIndicator()
    } catch (error) {
      console.error('Failed to rollback optimistic update:', error)
      // toast.error('Failed to revert changes')
    }
  }

  /**
   * Update offline indicator
   */
  const updateOfflineIndicator = (): void => {
    const pendingCount = pendingUpdatesCount.value
    const failedCount = failedUpdatesCount.value

    if (pendingCount > 0) {
      offlineIndicator.show = true
      offlineIndicator.count = pendingCount
      offlineIndicator.type = failedCount > 0 ? 'warning' : 'info'

      if (pendingCount === 1) {
        offlineIndicator.message = '1 change syncing...'
      } else {
        offlineIndicator.message = `${pendingCount} changes syncing...`
      }

      // Add estimated time (rough calculation)
      offlineIndicator.estimatedTime = pendingCount * 2000 // 2 seconds per operation
    } else if (failedCount > 0) {
      offlineIndicator.show = true
      offlineIndicator.count = failedCount
      offlineIndicator.type = 'error'
      offlineIndicator.message = `${failedCount} sync ${failedCount === 1 ? 'failure' : 'failures'}`
    } else {
      offlineIndicator.show = false
      offlineIndicator.message = ''
      offlineIndicator.count = 0
      offlineIndicator.estimatedTime = undefined
    }
  }

  /**
   * Update online status
   */
  const updateOnlineStatus = (status: OnlineStatus): void => {
    onlineStatus.value = status

    // Show connection status notifications
    if (status.isOnline && !onlineStatus.value.isOnline) {
      // Just came online
      // toast.success('Connection restored', { duration: 3000 })

      // If there are pending updates, show syncing notification
      if (pendingUpdatesCount.value > 0) {
        // toast.info(`Syncing ${pendingUpdatesCount.value} pending changes...`, { duration: 5000 })
      }
    } else if (!status.isOnline && onlineStatus.value.isOnline) {
      // Just went offline
      // toast.warning('Connection lost - working offline', { duration: 5000 })
    }
  }

  /**
   * Clear all optimistic updates
   */
  const clearAllUpdates = (): void => {
    optimisticUpdates.value.clear()
    updateOfflineIndicator()
  }

  /**
   * Get all pending operations
   */
  const getPendingOperations = (): QueuedOperation[] => {
    return Array.from(optimisticUpdates.value.values())
      .filter(update => update.status === 'pending')
      .map(update => update.operation)
  }

  /**
   * Retry failed operations
   */
  const retryFailedOperations = (): void => {
    Array.from(optimisticUpdates.value.values())
      .filter(update => update.status === 'failed')
      .forEach(update => {
        update.status = 'pending'
        optimisticUpdates.value.set(update.id, update)
      })

    updateOfflineIndicator()
    // toast.info('Retrying failed operations...', { duration: 3000 })
  }

  return {
    // State
    optimisticUpdates: computed(() => Array.from(optimisticUpdates.value.values())),
    offlineIndicator: computed(() => offlineIndicator),
    onlineStatus: computed(() => onlineStatus.value),
    hasPendingUpdates,
    pendingUpdatesCount,
    failedUpdatesCount,

    // Actions
    createTaskOptimistic,
    updateTaskOptimistic,
    deleteTaskOptimistic,
    handleOperationSuccess,
    handleOperationFailure,
    rollbackOptimisticUpdate,
    updateOnlineStatus,
    clearAllUpdates,
    retryFailedOperations,

    // Utilities
    getPendingOperations
  }
}

export default useOptimisticUI