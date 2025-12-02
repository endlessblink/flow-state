// Debug logging control
const DEBUG_SYNC = import.meta.env.DEV
const debugLog = (...args: unknown[]) => DEBUG_SYNC && console.log(...args)

import { ref, computed, readonly } from 'vue'
import PouchDB from 'pouchdb-browser'
import type { DatabaseConfig, SyncStatus, SyncEvent, DatabaseHealth } from '@/config/database'
import { getDatabaseConfig, DOCUMENT_IDS } from '@/config/database'
import { SyncCircuitBreaker, executeSyncWithCircuitBreaker, createChangeDetectionGuard, globalSyncCircuitBreaker } from '@/utils/syncCircuitBreaker'
import { globalConflictResolver } from '@/utils/conflictResolver'

// Global PouchDB instance
let globalPouchDB: PouchDB.Database | null = null

// ============================================================================
// SINGLETON REACTIVE STATE
// These refs are shared across ALL useCouchDBSync() calls to ensure consistent
// state management. Previously, each call created new refs causing sync failures.
// ============================================================================
const globalSyncStatus = ref<SyncStatus>('idle')
const globalLastSyncTime = ref<Date | null>(null)
const globalPendingChanges = ref(0)
const globalSyncErrors = ref<any[]>([])
const globalIsOnline = ref(navigator.onLine)
const globalRemoteConnected = ref(false)

// Phase 1.3: Progressive sync state (singleton)
const globalSyncMode = ref<'disabled' | 'read-only' | 'write-enabled'>('disabled')
const globalConflictCount = ref(0)
const globalSyncHealthScore = ref(100)
const globalIsProgressiveSyncReady = ref(false)

// Singleton circuit breaker
const globalCircuitBreakerInstance = new SyncCircuitBreaker({
  cooldownMs: 300,
  maxConsecutiveErrors: 3,
  maxSyncDuration: 30000,
  enableMetrics: true
})

const globalChangeGuard = createChangeDetectionGuard()

// Track if init has been called to prevent multiple initializations
let globalInitialized = false
let globalInitPromise: Promise<() => void> | null = null

// Singleton sync replication handlers
let globalPushHandler: PouchDB.Replication.Sync<{}> | null = null
let globalPullHandler: PouchDB.Replication.Sync<{}> | null = null
let globalIsDestroyed = false

/**
 * CouchDB Sync Composable
 * Handles two-way synchronization between local PouchDB and remote CouchDB
 *
 * IMPORTANT: All state is SINGLETON - shared across all useCouchDBSync() calls
 */
export const useCouchDBSync = () => {
  const config = getDatabaseConfig()

  // Use singleton state (aliased for backward compatibility)
  const syncStatus = globalSyncStatus
  const lastSyncTime = globalLastSyncTime
  const pendingChanges = globalPendingChanges
  const syncErrors = globalSyncErrors
  const isOnline = globalIsOnline
  const remoteConnected = globalRemoteConnected

  // Phase 1.3: Progressive sync state (singleton aliases)
  const syncMode = globalSyncMode
  const conflictCount = globalConflictCount
  const syncHealthScore = globalSyncHealthScore
  const isProgressiveSyncReady = globalIsProgressiveSyncReady

  // Use singleton circuit breaker and change guard
  const circuitBreaker = globalCircuitBreakerInstance
  const changeGuard = globalChangeGuard

  // Use singleton replication handlers (aliased for backward compatibility)
  // NOTE: These are module-level singletons, not function-scoped

  // Cleanup sync handlers (uses global handlers)
  const cleanupSyncHandlers = async () => {
    if (globalPushHandler) {
      await globalPushHandler.cancel()
      globalPushHandler = null
    }
    if (globalPullHandler) {
      await globalPullHandler.cancel()
      globalPullHandler = null
    }
  }

  // PHASE 0.5 Enhanced: Setup local cross-tab synchronization using PouchDB changes feed
  const setupLocalCrossTabSync = (localDB: PouchDB.Database) => {
    debugLog('🔄 Setting up enhanced local cross-tab synchronization')

    // Track local operations to prevent infinite loops
    const localOperationTracker = new Set<string>()

    // Listen to local database changes for cross-tab sync
    const changesHandler = localDB.changes({
      since: 'now',
      live: true,
      include_docs: true
    })

    changesHandler.on('change', (change) => {
      if (!change.id.startsWith('_design') && change.doc) {
        debugLog(`📝 Enhanced local change detected: ${change.id}`)

        // Determine change type and emit appropriate custom events
        const changeType = getChangeType(change)
        const isTaskRelated = isTaskRelatedChange(change)

        if (isTaskRelated) {
          debugLog(`🔄 Task-related change detected: ${changeType} for ${change.id}`)

          // Emit custom event for task store to listen to
          window.dispatchEvent(new CustomEvent('pouchdb-task-change', {
            detail: {
              changeId: change.id,
              changeType,
              document: change.doc,
              timestamp: new Date(),
              source: 'cross-tab-sync'
            }
          }))

          // Also emit legacy event for backward compatibility
          window.dispatchEvent(new CustomEvent('pouchdb-sync', {
            detail: {
              direction: 'cross-tab',
              changeCount: 1,
              docs: [change.doc],
              timestamp: new Date(),
              changeType,
              source: 'pouchdb-local-changes'
            } as SyncEvent
          }))
        }

        // Store the change for other tabs to detect
        pendingChanges.value++

        // Auto-clear pending changes after a short delay
        setTimeout(() => {
          if (pendingChanges.value > 0) {
            pendingChanges.value--
          }
        }, 1000)
      }
    })

    changesHandler.on('error', (error) => {
      console.error('❌ Enhanced local changes feed error:', error)
      syncStatus.value = 'error'

      // Emit error event for task store to handle
      window.dispatchEvent(new CustomEvent('pouchdb-sync-error', {
        detail: {
          error,
          timestamp: new Date(),
          source: 'cross-tab-sync'
        }
      }))
    })

    syncStatus.value = 'complete'
    debugLog('✅ Enhanced local cross-tab sync initialized with task store integration')

    return changesHandler
  }

  // PHASE 0.5 Helper: Determine the type of change
  const getChangeType = (change: any): 'create' | 'update' | 'delete' => {
    if (change.deleted) {
      return 'delete'
    }

    // Check if this is a new document (no previous revision)
    const changes = change.changes || []
    const isRevised = changes.length > 1

    return isRevised ? 'update' : 'create'
  }

  // PHASE 0.5 Helper: Check if change is task-related
  const isTaskRelatedChange = (change: any): boolean => {
    // Check document ID patterns
    if (change.id && (
      change.id.startsWith('task-') ||
      change.id.includes('tasks') ||
      change.id.includes('task')
    )) {
      return true
    }

    // Check document content for task-related data
    if (change.doc && (
      change.doc.type === 'task' ||
      change.doc.title ||
      change.doc.status ||
      change.doc.priority ||
      Array.isArray(change.doc.subtasks) ||
      change.doc.projectId
    )) {
      return true
    }

    return false
  }

  // Phase 1.3: Handle PouchDB conflicts during sync
  const handleSyncConflict = async (localDoc: any, remoteDoc: any, context: string) => {
    debugLog(`⚔️ [PHASE 1.3] Handling sync conflict: ${context}`)

    try {
      // Use global conflict resolver with last-write-wins strategy
      const result = await globalConflictResolver.resolveConflict(
        localDoc,
        remoteDoc,
        context,
        'last-write-wins'
      )

      conflictCount.value++
      globalSyncCircuitBreaker.recordConflict(context, {
        localRev: localDoc?._rev,
        remoteRev: remoteDoc?._rev,
        resolution: result.record.resolution
      })

      // Emit conflict event for monitoring dashboard
      window.dispatchEvent(new CustomEvent('sync-conflict-resolved', {
        detail: {
          context,
          resolution: result.record.resolution,
          confidence: result.confidence,
          timestamp: Date.now()
        }
      }))

      return result.resolved
    } catch (error) {
      console.error(`❌ [PHASE 1.3] Conflict resolution failed: ${context}`, error)
      throw error
    }
  }

  // Phase 1.3: Monitor sync health and update reactive state
  const monitorSyncHealth = () => {
    const healthReport = globalSyncCircuitBreaker.getHealthReport()
    syncHealthScore.value = healthReport.score
    isProgressiveSyncReady.value = healthReport.isReadyForProgressiveSync

    debugLog(`🏥 [PHASE 1.3] Sync health: ${healthReport.score.toFixed(1)}% (${healthReport.overall})`)

    return healthReport
  }

  // Phase 1.3: Enable progressive sync (read-only first)
  const enableProgressiveSync = async () => {
    debugLog('🚀 [PHASE 1.3] Starting progressive sync enablement...')

    // Step 1: Check health before enabling
    const healthReport = monitorSyncHealth()

    if (healthReport.score < 50) {
      console.warn(`⚠️ [PHASE 1.3] Health too low for progressive sync: ${healthReport.score}%`)
      syncMode.value = 'disabled'
      return false
    }

    // Step 2: Start with read-only sync
    debugLog('📖 [PHASE 1.3] Enabling read-only sync...')
    syncMode.value = 'read-only'

    try {
      const localDB = initializeDatabase()
      const remoteDB = await setupRemoteConnection()

      if (!remoteDB) {
        console.warn('⚠️ [PHASE 1.3] No remote connection, staying in read-only mode')
        return false
      }

      // Pull changes from remote first (read-only)
      debugLog('📥 [PHASE 1.3] Pulling changes from remote (read-only sync)...')
      await localDB.replicate.from(remoteDB, {
        timeout: 15000,
        batch_size: 50
      })

      debugLog('✅ [PHASE 1.3] Read-only sync complete, monitoring for conflicts...')

      // Step 3: Monitor conflict rate for 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000))

      const conflictRate = globalSyncCircuitBreaker.getConflictRate()
      debugLog(`📊 [PHASE 1.3] Conflict rate: ${conflictRate.toFixed(2)}%`)

      if (conflictRate > 5) {
        console.warn(`⚠️ [PHASE 1.3] High conflict rate (${conflictRate.toFixed(2)}%), staying read-only`)
        return false
      }

      // Step 4: Enable write-enabled sync
      debugLog('✍️ [PHASE 1.3] Enabling write-enabled sync...')
      syncMode.value = 'write-enabled'

      // NOTE: initializeSync() is already called in init() before enableProgressiveSync()
      // No need to call it again - just update the mode flag

      debugLog('✅ [PHASE 1.3] Progressive sync fully enabled!')
      isProgressiveSyncReady.value = true
      return true

    } catch (error) {
      console.error('❌ [PHASE 1.3] Progressive sync enablement failed:', error)
      syncMode.value = 'disabled'
      return false
    }
  }

  // Phase 1.3: Get progressive sync status
  const getProgressiveSyncStatus = () => ({
    mode: syncMode.value,
    healthScore: syncHealthScore.value,
    conflictCount: conflictCount.value,
    isReady: isProgressiveSyncReady.value,
    conflictRate: globalSyncCircuitBreaker.getConflictRate(),
    recommendations: globalSyncCircuitBreaker.getHealthReport().recommendations
  })

  // Initialize PouchDB database
  const initializeDatabase = (): PouchDB.Database => {
    if (globalPouchDB) {
      return globalPouchDB
    }

    try {
      // Create local PouchDB instance
      globalPouchDB = new PouchDB(config.local.name, {
        adapter: config.local.adapter
      })

      debugLog(`🗄️ PouchDB initialized: ${config.local.name}`)
      return globalPouchDB
    } catch (error) {
      console.error('❌ Failed to initialize PouchDB:', error)
      throw new Error(`Database initialization failed: ${error}`)
    }
  }

  // Setup remote PouchDB connection
  const setupRemoteConnection = async () => {
    if (!config.remote?.url) {
      debugLog('📱 No remote URL configured, using local-only mode')
      return null
    }

    try {
      const remoteOptions: PouchDB.Configuration.RemoteDatabaseConfiguration = {}

      // Add authentication if provided
      if (config.remote.auth) {
        remoteOptions.auth = {
          username: config.remote.auth.username,
          password: config.remote.auth.password
        }
      }

      const remoteDB = new PouchDB(config.remote.url, remoteOptions)

      // Test remote connection
      try {
        const info = await remoteDB.info()
        debugLog(`🌐 Remote CouchDB connected: ${config.remote.url}`)
        debugLog(`📊 Remote DB info:`, info)
        remoteConnected.value = true
        return remoteDB
      } catch (error) {
        console.warn('⚠️ Remote connection test failed:', error)
        remoteConnected.value = false
        return remoteDB // Return anyway, sync might work later
      }
    } catch (error) {
      console.error('❌ Failed to setup remote connection:', error)
      remoteConnected.value = false
      return null
    }
  }

  // Initialize sync between local and remote with circuit breaker protection
  const initializeSync = async () => {
    if (globalIsDestroyed) {
      debugLog('🛑 Sync destroyed, cannot initialize')
      return
    }

    return executeSyncWithCircuitBreaker(async () => {
      const localDB = initializeDatabase()
      const remoteDB = await setupRemoteConnection()

      if (!remoteDB) {
        debugLog('🔄 Remote sync not available, using local-only mode with circuit breaker protection')
        syncStatus.value = 'complete'
        // PouchDB automatically handles cross-tab sync when using the same database
        // The circuit breaker prevents infinite loops while allowing live updates
        return localDB
      }

      // Cleanup existing sync handlers
      await cleanupSyncHandlers()

      // 🔧 PHASE 1.2 FIX: Enable live bidirectional sync for cross-browser synchronization
      // Use circuit breaker protection to prevent infinite loops
      const liveSync = config.sync?.live ?? true // Enable live sync by default for cross-browser
      const retrySync = config.sync?.retry ?? false // Keep retry disabled for safety

      debugLog(`🔄 Setting up ${liveSync ? 'LIVE' : 'one-time'} bidirectional sync for cross-browser support`)
      debugLog(`📊 Sync config: live=${liveSync}, retry=${retrySync}, timeout=${config.sync?.timeout || 10000}ms`)

      // Bidirectional sync handler (local ↔ remote) for cross-browser sync
      globalPushHandler = localDB.sync(remoteDB, {
        live: liveSync, // 🔧 PHASE 1.2: Enable live sync from config
        retry: retrySync, // Keep retry disabled to prevent infinite attempts
        timeout: config.sync?.timeout || 10000,
        batch_size: config.remote?.batchSize || 50,
        batches_limit: config.remote?.batchesLimit || 5
      })

      // For live sync, we only need one bidirectional handler (not separate push/pull)
      // The .sync() method handles both directions automatically
      globalPullHandler = null // Not needed for bidirectional sync

      // Setup enhanced sync event handlers with loop prevention
      const setupSyncEvents = (handler: PouchDB.Replication.Sync<{}>, direction: 'push' | 'pull') => {
        handler.on('change', (info) => {
          // Prevent sync change events from triggering more sync operations
          if (changeGuard.shouldUpdate(info)) {
            debugLog(`📤 Sync ${direction} (${info.direction || 'unknown'}):`, {
              changes: info.change?.docs?.length || 0,
              pending: (info as any).pending,
              sequence: (info as any).seq
            })

            // Freeze the info to prevent Vue reactivity issues
            const frozenInfo = changeGuard.freezeData(info)
            handleSyncChange(direction, frozenInfo)
          }
        })

        handler.on('paused', (err) => {
          debugLog(`⏸️ Sync ${direction} paused`)
          syncStatus.value = 'idle'

          if (err) {
            console.warn(`⚠️ Sync ${direction} paused with error:`, err)
            syncErrors.value.push({ direction, error: err, timestamp: new Date() })
          }
        })

        handler.on('active', () => {
          debugLog(`▶️ Sync ${direction} active`)
          syncStatus.value = 'syncing'
        })

        handler.on('complete', (info) => {
          debugLog(`✅ Sync ${direction} complete:`, {
            docs_written: (info as any).docs_written,
            docs_read: (info as any).docs_read,
            errors: (info as any).errors?.length || 0
          })

          syncStatus.value = 'complete'
          lastSyncTime.value = new Date()

          // Cleanup handler to prevent continuous sync
          if (direction === 'push') {
            globalPushHandler = null
          } else if (direction === 'pull') {
            globalPullHandler = null
          }
        })

        handler.on('error', (err) => {
          console.error(`❌ Sync ${direction} error:`, err)
          syncStatus.value = 'error'
          syncErrors.value.push({ direction, error: err, timestamp: new Date() })

          // Circuit breaker will handle error tracking
        })
      }

      // Setup sync events for the bidirectional handler
      setupSyncEvents(globalPushHandler, 'push') // 'push' is a misnomer now - it's bidirectional
      // pullHandler is null - no separate pull needed for bidirectional sync

      syncStatus.value = 'complete'
      debugLog('✅ LIVE bidirectional sync initialized for cross-browser support')

      return localDB
    }, 'initialize-sync')
  }

  // Handle sync change events
  const handleSyncChange = (direction: 'push' | 'pull', info: any) => {
    const changeCount = info.change?.docs?.length || 0
    pendingChanges.value += changeCount

    debugLog(`📊 Sync ${direction} - ${changeCount} changes processed`)

    // Emit custom event for UI components to react
    window.dispatchEvent(new CustomEvent('pouchdb-sync', {
      detail: {
        direction,
        changeCount,
        docs: info.change?.docs || [],
        timestamp: new Date()
      } as SyncEvent
    }))
  }

  // Manual sync trigger
  const triggerSync = async () => {
    if (syncStatus.value === 'syncing') {
      debugLog('⏳ Sync already in progress')
      return
    }

    // Track if remote was previously disconnected
    const wasDisconnected = !remoteConnected.value

    const localDB = initializeDatabase()
    const remoteDB = await setupRemoteConnection()

    if (!remoteDB) {
      console.warn('⚠️ Cannot trigger sync: no remote connection')
      return
    }

    // 🔧 PHASE 1.4 FIX: Auto-enable progressive sync when connection succeeds for the first time
    // This fixes the race condition where init() fails but later connection succeeds
    if (wasDisconnected && remoteConnected.value && syncMode.value === 'disabled') {
      debugLog('🚀 [TRIGGER-SYNC] Remote connection established! Auto-enabling progressive sync for cross-browser support...')
      try {
        const success = await enableProgressiveSync()
        if (success) {
          debugLog('✅ [TRIGGER-SYNC] Progressive sync enabled - cross-browser sync active!')
          syncMode.value = 'write-enabled'
        } else {
          console.warn('⚠️ [TRIGGER-SYNC] Progressive sync not fully enabled - proceeding with one-time sync')
        }
      } catch (error) {
        console.error('❌ [TRIGGER-SYNC] Failed to auto-enable progressive sync:', error)
        // Continue with one-time sync as fallback
      }
    }

    try {
      syncStatus.value = 'syncing'

      // One-time sync
      const result = await localDB.replicate.to(remoteDB)
      await localDB.replicate.from(remoteDB)

      syncStatus.value = 'complete'
      lastSyncTime.value = new Date()

      debugLog('✅ Manual sync completed:', result)
    } catch (error) {
      console.error('❌ Manual sync failed:', error)
      syncStatus.value = 'error'
      syncErrors.value.push({ error, timestamp: new Date() })
    }
  }

  // Pause sync
  const pauseSync = async () => {
    if (globalPushHandler) {
      await globalPushHandler.cancel()
      globalPushHandler = null
    }
    if (globalPullHandler) {
      await globalPullHandler.cancel()
      globalPullHandler = null
    }
    syncStatus.value = 'paused'
    debugLog('⏸️ Sync paused')
  }

  // Resume sync
  const resumeSync = async () => {
    await initializeSync()
  }

  // Get database health information
  const getDatabaseHealth = async (): Promise<DatabaseHealth> => {
    const localDB = initializeDatabase()

    try {
      const localInfo = await localDB.info()
      let remoteInfo = null

      if (remoteConnected.value && config.remote?.url) {
        try {
          const remoteDB = new PouchDB(config.remote.url)
          remoteInfo = await remoteDB.info()
        } catch (error) {
          console.warn('Could not get remote DB info:', error)
        }
      }

      return {
        isOnline: isOnline.value,
        lastSyncTime: lastSyncTime.value || undefined,
        pendingChanges: pendingChanges.value,
        syncStatus: syncStatus.value,
        remoteConnected: remoteConnected.value
      }
    } catch (error) {
      console.error('Failed to get database health:', error)
      return {
        isOnline: false,
        pendingChanges: 0,
        syncStatus: 'error',
        remoteConnected: false
      }
    }
  }

  // Clear sync errors
  const clearSyncErrors = () => {
    syncErrors.value = []
  }

  // Setup online/offline listeners
  const setupNetworkListeners = () => {
    const handleOnline = () => {
      isOnline.value = true
      debugLog('🌐 Back online, resuming sync...')
      if (syncStatus.value === 'paused') {
        resumeSync()
      }
    }

    const handleOffline = () => {
      isOnline.value = false
      debugLog('📵 Gone offline, pausing sync...')
      pauseSync()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Cleanup function
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }

  // Computed properties
  const isSyncing = computed(() => syncStatus.value === 'syncing')
  const hasSyncErrors = computed(() => syncErrors.value.length > 0)
  const canSync = computed(() => isOnline.value && remoteConnected.value)

  // Destroy function for cleanup
  const destroy = async () => {
    globalIsDestroyed = true
    debugLog('🛑 Destroying CouchDB sync composable...')

    // Cleanup sync handlers
    await cleanupSyncHandlers()

    // Destroy circuit breaker
    circuitBreaker.destroy()

    // Reset state
    syncStatus.value = 'idle'
    lastSyncTime.value = null
    pendingChanges.value = 0
    syncErrors.value = []
  }

  // Initialize on composable creation (SINGLETON - only runs once globally)
  const init = async () => {
    // SINGLETON CHECK: If already initialized, return cached promise
    if (globalInitialized && globalInitPromise) {
      debugLog('🔄 [SYNC-INIT] Already initialized, reusing existing sync connection')
      return globalInitPromise
    }

    // Mark as initializing and create the init promise
    globalInitialized = true

    globalInitPromise = (async () => {
      debugLog('🚀 [SYNC-INIT] First initialization - setting up CouchDB sync...')
      const cleanup = setupNetworkListeners()
      await initializeSync()

      // AUTO-ENABLE: If remote CouchDB is connected, enable progressive sync for cross-browser support
      debugLog(`🔍 [SYNC-INIT] Remote connected status: ${remoteConnected.value}`)
      if (remoteConnected.value) {
        debugLog('🚀 [AUTO-SYNC] CouchDB server connected, auto-enabling progressive sync for cross-browser support...')
        try {
          const success = await enableProgressiveSync()
          if (success) {
            debugLog('✅ [AUTO-SYNC] Progressive sync enabled - cross-browser sync active!')
            syncMode.value = 'write-enabled'
          } else {
            console.warn('⚠️ [AUTO-SYNC] Progressive sync not fully enabled - check health status')
          }
        } catch (error) {
          console.error('❌ [AUTO-SYNC] Failed to auto-enable progressive sync:', error)
        }
      } else {
        debugLog('📱 [AUTO-SYNC] No remote CouchDB connection detected yet - will retry on network events')
      }

      return cleanup
    })()

    // NOTE: onUnmounted was removed from here because it must be called during
    // synchronous component setup, not inside an async function.
    // Cleanup is handled via the returned cleanup function from init().
    // Components should store and call this cleanup function on unmount.

    return globalInitPromise
  }

  return {
    // State
    syncStatus: readonly(syncStatus),
    lastSyncTime: readonly(lastSyncTime),
    pendingChanges: readonly(pendingChanges),
    syncErrors: readonly(syncErrors),
    isOnline: readonly(isOnline),
    remoteConnected: readonly(remoteConnected),

    // Phase 1.3: Progressive sync state
    syncMode: readonly(syncMode),
    conflictCount: readonly(conflictCount),
    syncHealthScore: readonly(syncHealthScore),
    isProgressiveSyncReady: readonly(isProgressiveSyncReady),

    // Computed
    isSyncing: readonly(isSyncing),
    hasSyncErrors: readonly(hasSyncErrors),
    canSync: readonly(canSync),

    // Methods
    initializeDatabase,
    initializeSync,
    triggerSync,
    pauseSync,
    resumeSync,
    getDatabaseHealth,
    clearSyncErrors,
    destroy,
    init,

    // Phase 1.3: Progressive sync methods
    enableProgressiveSync,
    getProgressiveSyncStatus,
    handleSyncConflict,
    monitorSyncHealth,

    // Circuit breaker access
    circuitBreaker: {
      metrics: () => circuitBreaker.getMetrics(),
      isHealthy: () => circuitBreaker.isHealthy(),
      canSync: () => circuitBreaker.canSync(),
      reset: () => circuitBreaker.reset()
    },

    // Phase 1.3: Conflict resolver access
    conflictResolver: {
      statistics: () => globalConflictResolver.getStatistics(),
      auditLog: (limit?: number) => globalConflictResolver.getAuditLog(limit),
      isReady: () => globalConflictResolver.isReadyForCrossBrowserSync(),
      clear: () => globalConflictResolver.clearAuditLog()
    }
  }
}

// Export the PouchDB instance for use in other composables
export const getPouchDB = () => {
  if (!globalPouchDB) {
    throw new Error('PouchDB not initialized. Call useCouchDBSync().init() first.')
  }
  return globalPouchDB
}

// Compatibility function for components that expect the old API
export const getGlobalReliableSyncManager = () => {
  return useCouchDBSync()
}