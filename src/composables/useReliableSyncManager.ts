/**
 * DEPRECATED: This file is a stub for backward compatibility.
 * The app has migrated from PouchDB/CouchDB to Supabase.
 * Sync is now handled via Supabase real-time subscriptions.
 */

import { ref, computed } from 'vue'

// Type stubs for backward compatibility
export type SyncStatus = 'idle' | 'syncing' | 'complete' | 'error' | 'offline' | 'paused'

export interface SyncMetrics {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  conflictsResolved: number
  averageSyncTime: number
  lastSyncTime: Date | null
  successRate: number
  conflictsRate: number
}

export interface SyncHealth {
  syncStatus: SyncStatus
  isOnline: boolean
  conflictCount: number
  uptime: number
}

// Global instance stub
let globalInstance: ReturnType<typeof useReliableSyncManager> | null = null

export function getGlobalReliableSyncManager() {
  if (!globalInstance) {
    globalInstance = useReliableSyncManager()
  }
  return globalInstance
}

/**
 * STUB: Returns empty/default values for backward compatibility.
 * Real sync is handled by Supabase.
 */
export function useReliableSyncManager() {
  const status = ref<SyncStatus>('complete')
  const isSyncing = ref(false)
  const lastError = ref<string | null>(null)
  const isOnline = ref(true)

  const syncHealth = computed<SyncHealth>(() => ({
    syncStatus: status.value,
    isOnline: isOnline.value,
    conflictCount: 0,
    uptime: Date.now()
  }))

  const syncMetrics = computed<SyncMetrics>(() => ({
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    conflictsResolved: 0,
    averageSyncTime: 0,
    lastSyncTime: null,
    successRate: 1,
    conflictsRate: 0
  }))

  return {
    // State
    status,
    isSyncing,
    lastError,
    isOnline,
    syncHealth,
    syncMetrics,

    // Stub methods (no-op for Supabase mode)
    startSync: async () => {},
    stopSync: async () => {},
    pauseSync: () => {},
    resumeSync: () => {},
    forceSync: async () => {},
    clearErrors: () => { lastError.value = null },
    getConflicts: () => [],
    resolveConflict: async () => true,
    getQueueStats: () => ({ length: 0, processing: false, oldestOperation: null }),
    validateData: async () => ({ isValid: true, totalValidated: 0, validDocuments: 0, issues: [], duration: 0 }),

    // Health monitoring stubs
    getHealthStatus: () => syncHealth.value,
    getMetrics: () => syncMetrics.value,

    // Event handlers (no-op)
    onSyncComplete: () => {},
    onSyncError: () => {},
    onConflictDetected: () => {},

    // Cleanup
    dispose: () => {}
  }
}

export default useReliableSyncManager
