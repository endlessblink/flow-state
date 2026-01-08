/**
 * useReliableSyncManager STUB
 *
 * ARCHIVED: Jan 2026 - Original PouchDB sync manager moved to src/_archived/legacy-pouchdb/
 *
 * This stub maintains API compatibility for legacy imports.
 * Actual sync is handled by Supabase Realtime subscriptions.
 *
 * TODO (TASK-117): Remove all useReliableSyncManager imports and delete this stub.
 */

import { ref, computed } from 'vue'

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline'

export interface SyncMetrics {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  lastSyncTime: Date | null
  averageSyncDuration: number
}

let globalInstance: ReturnType<typeof useReliableSyncManager> | null = null

export function getGlobalReliableSyncManager() {
  if (!globalInstance) {
    globalInstance = useReliableSyncManager()
  }
  return globalInstance
}

export function useReliableSyncManager() {
  const syncStatus = ref<SyncStatus>('idle')
  const lastSyncTime = ref<Date | null>(null)
  const isSyncing = ref(false)
  const syncError = ref<string | null>(null)

  const metrics = ref<SyncMetrics>({
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    lastSyncTime: null,
    averageSyncDuration: 0
  })

  const isOnline = computed(() => navigator.onLine)
  const canSync = computed(() => isOnline.value && !isSyncing.value)

  return {
    // State
    syncStatus,
    lastSyncTime,
    isSyncing,
    syncError,
    metrics,

    // Computed
    isOnline,
    canSync,

    // Methods (all no-ops - Supabase handles sync)
    triggerSync: async () => console.log('[STUB] Sync handled by Supabase Realtime'),
    forceSync: async () => console.log('[STUB] Sync handled by Supabase Realtime'),
    cancelSync: () => {},
    resetMetrics: () => {},
    getMetrics: () => metrics.value,
    startLiveSync: () => false,
    stopLiveSync: () => {}
  }
}

export default useReliableSyncManager
