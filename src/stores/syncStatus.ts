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
import { writesFailing, writeFailureMessage } from '@/composables/sync/writeHealth'

export const useSyncStatusStore = defineStore('syncStatus', () => {
  // Mirror the orchestrator state for reactive UI binding
  // We use a watcher to sync from the orchestrator's ref
  const queueStatus = ref<SyncStatus>('synced')
  // TASK-1916/BUG-1913: the queue only covers queued writes — DIRECT db writes
  // failing (writeHealth) must also turn the indicator red, otherwise the app
  // says "All changes saved" while silently dropping edits.
  const status = computed<SyncStatus>(() =>
    writesFailing.value && queueStatus.value !== 'syncing' ? 'error' : queueStatus.value
  )
  const pendingCount = ref(0)
  const queueFailedCount = ref(0)
  const failedCount = computed(() => queueFailedCount.value + (writesFailing.value ? 1 : 0))
  const lastSyncAt = ref<number | undefined>(undefined)
  const queueLastError = ref<string | undefined>(undefined)
  const lastError = computed(() =>
    writesFailing.value ? (writeFailureMessage.value || queueLastError.value) : queueLastError.value
  )
  const isOnline = ref(true)
  const failedOperations = ref<WriteOperation[]>([])

  // BUG-1411: Track whether data was loaded from IndexedDB cache (offline mode)
  const loadedFromCache = ref(false)
  const cacheTimestamp = ref<number | undefined>(undefined)

  // Watch the orchestrator state and update local refs
  // This keeps the store in sync with the orchestrator
  watch(
    () => syncState.value,
    (newState) => {
      queueStatus.value = newState.status
      pendingCount.value = newState.pendingCount
      queueFailedCount.value = newState.failedCount
      lastSyncAt.value = newState.lastSyncAt
      queueLastError.value = newState.lastError
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
    // TASK-1916/BUG-1913: direct writes are failing — say so explicitly
    if (writesFailing.value) {
      return "Changes aren't saving — retrying"
    }

    // BUG-1411: Show cache mode info when loaded from IndexedDB
    if (loadedFromCache.value) {
      const age = cacheTimestamp.value ? Math.round((Date.now() - cacheTimestamp.value) / 60_000) : undefined
      const ageText = age !== undefined ? ` (${age}min old)` : ''
      return `Offline — showing cached data${ageText}`
    }

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

  /**
   * BUG-1411: Mark that data was loaded from IndexedDB cache (offline mode).
   * Called by useAppInitialization when Supabase fetch fails but cache has data.
   */
  const markLoadedFromCache = (timestamp?: number) => {
    loadedFromCache.value = true
    cacheTimestamp.value = timestamp
  }

  /**
   * BUG-1411: Clear the cache-loaded flag (e.g., after successful Supabase reconnection).
   */
  const clearCacheMode = () => {
    loadedFromCache.value = false
    cacheTimestamp.value = undefined
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
    loadedFromCache,
    cacheTimestamp,

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
    clearFailed,
    markLoadedFromCache,
    clearCacheMode,
  }
})
