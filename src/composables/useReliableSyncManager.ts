
import { ref, computed, type Ref } from 'vue'
import { syncOrchestrator, SyncOrchestrator } from '@/services/sync/SyncOrchestrator'
import { getDatabaseConfig } from '@/config/database'
import { useBackupSystem } from '@/composables/useBackupSystem'
import { getNetworkOptimizer } from '@/utils/networkOptimizer'
import { getBatchManager } from '@/utils/syncBatchManager'
import { getLogger } from '@/utils/productionLogger'
import type { ConflictInfo, ResolutionResult } from '@/types/conflicts'
import type { SyncValidationResult } from '@/utils/syncValidator'
import type { SyncStatus, SyncMetrics, SyncHealth } from '@/services/sync/SyncStateService'

// Re-export types for compatibility
export type { ConflictInfo, ResolutionResult, SyncValidationResult, SyncStatus, SyncMetrics, SyncHealth }

export interface ReliableSyncManagerInstance {
  syncStatus: Ref<SyncStatus>
  error: Ref<string | null>
  lastSyncTime: Ref<Date | null>
  pendingChanges: Ref<number>
  isOnline: Ref<boolean>
  remoteConnected: Ref<boolean>
  hasConnectedEver: Ref<boolean>
  conflicts: Ref<ConflictInfo[]>
  resolutions: Ref<ResolutionResult[]>
  lastValidation: Ref<SyncValidationResult | null>
  metrics: Ref<SyncMetrics>
  isSyncing: Ref<boolean>
  hasErrors: Ref<boolean>
  triggerSync: () => Promise<void>
  waitForInitialSync: (timeoutMs?: number) => Promise<boolean>
  resolveConflict: (conflictId: string, resolution: any) => Promise<void>
  retryResolveConflict: (conflictId: string) => Promise<void>
  ignoreConflict: (conflictId: string) => Promise<void>
  getHealth: () => SyncHealth
  registerDataPulledCallback: (callback: () => Promise<void> | void) => void
  getSyncMetrics: () => SyncMetrics
  clearSyncErrors: () => void
  getRetryStats: () => any
  getSyncHealth: () => SyncHealth
  cleanup: () => void
  pauseSync: () => Promise<void>
  resumeSync: () => Promise<void>
  toggleSync: () => Promise<void>
  throttledSync: (priority?: string) => Promise<void>
  manualConflictResolution: (id: string, resolution: any) => Promise<void>
  getOfflineQueueStats: () => import('@/utils/offlineQueue').QueueStats
  isLiveSyncActive: () => boolean
  startLiveSync: () => Promise<boolean>
  stopLiveSync: () => Promise<boolean>
  configureProvider?: (config: any) => Promise<void>
  enableProvider?: () => Promise<void>
  disableProvider?: () => Promise<void>
  networkOptimizer: any
}

/**
 * Reliable Sync Manager (Refactored Phase 3)
 * Now a lightweight wrapper around SyncOrchestrator
 */
export const useReliableSyncManager = () => {
  // Access Singleton State
  const state = syncOrchestrator.getSyncState()

  // Setup Dependencies for Orchestrator (if not already init)
  // In a real app this might happen in App.vue or main.ts
  // doing it here to ensure it runs when the composable is used.
  // The orchestrator has an internal check to prevent double-init.
  // Using dynamic import to avoid circular dependencies and ensure browser compatibility
  import('@/utils/syncValidator').then(({ SyncValidator }) => {
    syncOrchestrator.initialize({
      backupSystem: useBackupSystem(),
      logger: getLogger(),
      syncValidator: new SyncValidator()
    }).catch(err => console.error('SyncOrchestrator init failed', err))
  })

  // Expose Reactive State (direct refs from state service)
  const {
    syncStatus,
    error,
    lastSyncTime,
    pendingChanges,
    isOnline,
    remoteConnected,
    hasConnectedEver,
    conflicts,
    resolutions,
    lastValidation,
    metrics,
    isSyncing,
    hasErrors
  } = state

  // --- Legacy / Compat Methods Proxy ---

  const triggerSync = async () => {
    await syncOrchestrator.triggerSync()
  }

  const resolveConflict = async (conflictId: string, resolution: any) => {
    await syncOrchestrator.resolveConflict(conflictId, resolution)
  }

  const retryResolveConflict = async (conflictId: string) => {
    await syncOrchestrator.retryResolveConflict(conflictId)
  }

  const ignoreConflict = async (conflictId: string) => {
    await syncOrchestrator.ignoreConflict(conflictId)
  }

  const waitForInitialSync = async (timeoutMs?: number) => {
    return syncOrchestrator.waitForInitialSync(timeoutMs)
  }

  const registerDataPulledCallback = (callback: () => Promise<void> | void) => {
    return syncOrchestrator.registerDataPulledCallback(callback)
  }

  const getHealth = (): SyncHealth => {
    return state.getHealth()
  }

  // Return the exact same API surface as before
  return {
    // State
    syncStatus,
    error,
    lastSyncTime,
    pendingChanges,
    isOnline,
    remoteConnected,
    hasConnectedEver,
    conflicts,
    resolutions,
    lastValidation,
    metrics,

    // Computed
    isSyncing,
    hasErrors,

    // Methods
    triggerSync,
    waitForInitialSync,
    resolveConflict,
    retryResolveConflict,
    ignoreConflict,
    getHealth,
    registerDataPulledCallback,
    getSyncMetrics: () => syncOrchestrator.getSyncMetrics(),
    clearSyncErrors: () => syncOrchestrator.clearSyncErrors(),
    getRetryStats: () => syncOrchestrator.getRetryStats(),
    getSyncHealth: () => syncOrchestrator.getSyncHealth(),
    cleanup: () => syncOrchestrator.cleanup(),
    pauseSync: () => syncOrchestrator.pauseSync(),
    resumeSync: () => syncOrchestrator.resumeSync(),
    toggleSync: () => syncOrchestrator.toggleSync(),
    throttledSync: (priority?: string) => syncOrchestrator.throttledSync(priority),
    manualConflictResolution: (id: string, resolution: any) => resolveConflict(id, resolution),
    getOfflineQueueStats: () => syncOrchestrator.getOfflineQueueStats(),
    isLiveSyncActive: () => syncOrchestrator.isLiveSyncActive(),
    startLiveSync: () => syncOrchestrator.startLiveSync(),
    stopLiveSync: () => syncOrchestrator.stopLiveSync(),
    configureProvider: (config: any) => syncOrchestrator.configureProvider(config),
    enableProvider: () => syncOrchestrator.enableProvider(),
    disableProvider: () => syncOrchestrator.disableProvider(),
    networkOptimizer: syncOrchestrator.getNetworkOptimizer()
  }

  // Expose internal instances if needed (compatibility)
  // localDB: ... (Try to avoid exposing if not strictly needed by consumers)
}

/**
 * Global singleton accessor for database integration
 */
export const getGlobalReliableSyncManager = () => {
  const manager = useReliableSyncManager()

  // Compatibility layer for useDatabase.ts
  return {
    ...manager,
    init: async () => {
      // Ensure orchestrator is initialized
      // The manager already triggers init on creation, but we can wait for it here if needed
      // or just return a dummy cleanup provided the orchestrator handles its own cleanup or lifecycle.
      // Original returned a cleanup function.
      return () => {
        // Cleanup logic if needed
      }
    }
  }
}
