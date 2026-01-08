/**
 * DEPRECATED: This file is a stub for backward compatibility.
 * The app has migrated from PouchDB/CouchDB to Supabase.
 * Sync is now handled via Supabase real-time subscriptions.
 */

import { ref, computed } from 'vue'

// Type stubs for backward compatibility
export type SyncStatus = 'idle' | 'syncing' | 'complete' | 'error' | 'offline' | 'paused' | 'validating' | 'resolving_conflicts'

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
  const remoteConnected = ref(true) // Add missing ref
  const hasErrors = ref(false) // Add missing ref
  const conflicts = ref([]) // Add missing ref
  const lastSyncTime = ref<Date | null>(new Date()) // Add missing ref
  const error = lastError // Alias

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

  const getSyncMetrics = () => syncMetrics.value

  const resolutions = ref<any[]>([])
  const metrics = ref({
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    successRate: 1,
    conflictsRate: 0,
    averageSyncTime: 0
  })
  const networkOptimizer = {
    getMetrics: () => ({ currentCondition: 'good' })
  }
  const throttledSync = async (_priority: string) => { /* stub */ }
  const getSyncHealth = () => ({
    syncStatus: 'complete',
    hasErrors: false,
    conflictCount: 0,
    isOnline: true
  })
  const queueSize = ref(0) // Added based on the return block

  return {
    // State
    status,
    syncStatus: status, // Alias
    isSyncing,
    lastError,
    error, // Alias
    isOnline,
    remoteConnected, // Add missing
    hasErrors, // Add missing
    conflicts, // Add missing
    lastSyncTime, // Add missing
    syncHealth,
    syncMetrics,
    resolutions,
    metrics,
    networkOptimizer,
    queueSize,

    // Stub methods (no-op for Supabase mode)
    startSync: async () => { },
    init: async () => { }, // Alias
    stopSync: async () => { },
    pauseSync: () => { },
    cleanup: async () => { }, // Alias
    resumeSync: () => { },
    forceSync: async () => { },
    triggerSync: async () => { }, // Alias
    clearErrors: () => { lastError.value = null },
    clearSyncErrors: () => { lastError.value = null }, // Alias
    getConflicts: () => [],
    resolveConflict: async () => true,
    getQueueStats: () => ({ length: 0, processing: false, oldestOperation: null }),
    validateData: async () => ({ isValid: true, totalValidated: 0, validDocuments: 0, issues: [], duration: 0 }),

    // Health monitoring stubs
    getHealthStatus: () => syncHealth.value,
    getMetrics: () => syncMetrics.value,
    getSyncMetrics,
    throttledSync,
    getSyncHealth,

    // Event handlers (no-op)
    onSyncComplete: () => { },
    onSyncError: () => { },
    onConflictDetected: () => { },

    // Cleanup
    dispose: () => { }
  }
}

export default useReliableSyncManager
