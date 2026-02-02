/**
 * Sync Status Store
 *
 * Pinia store for centralized sync state management.
 * Provides reactive state for the UI sync indicator.
 *
 * @see TASK-1177 in MASTER_PLAN.md
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { SyncStatus, WriteOperation } from '@/types/sync'
import { syncState } from '@/composables/sync/useSyncOrchestrator'

export const useSyncStatusStore = defineStore('syncStatus', () => {
  // Mirror the orchestrator state for reactive UI binding
  // We use a watcher to sync from the orchestrator's ref
  const status = ref<SyncStatus>('synced')
  const pendingCount = ref(0)
  const failedCount = ref(0)
  const lastSyncAt = ref<number | undefined>(undefined)
  const lastError = ref<string | undefined>(undefined)
  const isOnline = ref(true)
  const failedOperations = ref<WriteOperation[]>([])

  // Watch the orchestrator state and update local refs
  // This keeps the store in sync with the orchestrator
  watch(
    () => syncState.value,
    (newState) => {
      status.value = newState.status
      pendingCount.value = newState.pendingCount
      failedCount.value = newState.failedCount
      lastSyncAt.value = newState.lastSyncAt
      lastError.value = newState.lastError
      isOnline.value = newState.isOnline
      failedOperations.value = newState.failedOperations
    },
    { immediate: true, deep: true }
  )

  // Computed properties for UI
  const hasPendingChanges = computed(() => pendingCount.value > 0 || status.value === 'syncing')
  const hasErrors = computed(() => failedCount.value > 0 || status.value === 'error')
  const isSynced = computed(() => status.value === 'synced' && pendingCount.value === 0)
  const isSyncing = computed(() => status.value === 'syncing')
  const isOffline = computed(() => !isOnline.value)

  /**
   * Get status icon name for Lucide icons
   */
  const statusIcon = computed(() => {
    switch (status.value) {
      case 'synced':
        return 'CloudCheck'
      case 'syncing':
        return 'CloudUpload'
      case 'pending':
        return 'CloudClock'
      case 'error':
        return 'CloudOff'
      case 'offline':
        return 'WifiOff'
      default:
        return 'Cloud'
    }
  })

  /**
   * Get status color class
   */
  const statusColor = computed(() => {
    switch (status.value) {
      case 'synced':
        return 'text-green-500'
      case 'syncing':
        return 'text-blue-500'
      case 'pending':
        return 'text-amber-500'
      case 'error':
        return 'text-red-500'
      case 'offline':
        return 'text-gray-500'
      default:
        return 'text-gray-400'
    }
  })

  /**
   * Get human-readable status text
   */
  const statusText = computed(() => {
    switch (status.value) {
      case 'synced':
        return 'All changes saved'
      case 'syncing':
        return `Syncing ${pendingCount.value} changes...`
      case 'pending':
        return `${pendingCount.value} changes pending`
      case 'error':
        return `${failedCount.value} sync errors`
      case 'offline':
        return 'Offline - changes will sync when online'
      default:
        return 'Unknown status'
    }
  })

  /**
   * Format last sync time
   */
  const lastSyncText = computed(() => {
    if (!lastSyncAt.value) return 'Never synced'

    const now = Date.now()
    const diff = now - lastSyncAt.value

    if (diff < 60000) {
      return 'Just now'
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return `${minutes} min ago`
    } else if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours} hour${hours > 1 ? 's' : ''} ago`
    } else {
      const date = new Date(lastSyncAt.value)
      return date.toLocaleDateString()
    }
  })

  /**
   * Retry failed operations
   */
  const retryFailed = async () => {
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const orchestrator = useSyncOrchestrator()
    await orchestrator.retryFailed()
  }

  /**
   * Force an immediate sync
   */
  const forceSync = async () => {
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const orchestrator = useSyncOrchestrator()
    await orchestrator.forceSync()
  }

  /**
   * Clear all failed operations (for corrupted entries)
   */
  const clearFailed = async () => {
    const { useSyncOrchestrator } = await import('@/composables/sync/useSyncOrchestrator')
    const orchestrator = useSyncOrchestrator()
    const count = await orchestrator.clearFailed()
    console.log(`[SYNC] Cleared ${count} failed operations`)
    return count
  }

  return {
    // State
    status,
    pendingCount,
    failedCount,
    lastSyncAt,
    lastError,
    isOnline,
    failedOperations,

    // Computed
    hasPendingChanges,
    hasErrors,
    isSynced,
    isSyncing,
    isOffline,
    statusIcon,
    statusColor,
    statusText,
    lastSyncText,

    // Actions
    retryFailed,
    forceSync,
    clearFailed
  }
})
