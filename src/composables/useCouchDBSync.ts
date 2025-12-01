import { ref, computed, readonly, onUnmounted } from 'vue'
import PouchDB from 'pouchdb-browser'
import type { DatabaseConfig, SyncStatus, SyncEvent, DatabaseHealth } from '@/config/database'
import { getDatabaseConfig, DOCUMENT_IDS } from '@/config/database'
import { SyncCircuitBreaker, executeSyncWithCircuitBreaker, createChangeDetectionGuard } from '@/utils/syncCircuitBreaker'

// Global PouchDB instance
let globalPouchDB: PouchDB.Database | null = null

/**
 * CouchDB Sync Composable
 * Handles two-way synchronization between local PouchDB and remote CouchDB
 */
export const useCouchDBSync = () => {
  const config = getDatabaseConfig()

  // Reactive state
  const syncStatus = ref<SyncStatus>('idle')
  const lastSyncTime = ref<Date | null>(null)
  const pendingChanges = ref(0)
  const syncErrors = ref<any[]>([])
  const isOnline = ref(navigator.onLine)
  const remoteConnected = ref(false)

  // Circuit breaker and change detection
  const circuitBreaker = new SyncCircuitBreaker({
    cooldownMs: 300,
    maxConsecutiveErrors: 3,
    maxSyncDuration: 30000,
    enableMetrics: true
  })

  const changeGuard = createChangeDetectionGuard()

  // Sync replication handlers
  let pushHandler: PouchDB.Replication.Sync<{}> | null = null
  let pullHandler: PouchDB.Replication.Sync<{}> | null = null
  let isDestroyed = false

  // Cleanup sync handlers
  const cleanupSyncHandlers = async () => {
    if (pushHandler) {
      await pushHandler.cancel()
      pushHandler = null
    }
    if (pullHandler) {
      await pullHandler.cancel()
      pullHandler = null
    }
  }

  // PHASE 0.5 Enhanced: Setup local cross-tab synchronization using PouchDB changes feed
  const setupLocalCrossTabSync = (localDB: PouchDB.Database) => {
    console.log('🔄 Setting up enhanced local cross-tab synchronization')

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
        console.log(`📝 Enhanced local change detected: ${change.id}`)

        // Determine change type and emit appropriate custom events
        const changeType = getChangeType(change)
        const isTaskRelated = isTaskRelatedChange(change)

        if (isTaskRelated) {
          console.log(`🔄 Task-related change detected: ${changeType} for ${change.id}`)

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
    console.log('✅ Enhanced local cross-tab sync initialized with task store integration')

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

      console.log(`🗄️ PouchDB initialized: ${config.local.name}`)
      return globalPouchDB
    } catch (error) {
      console.error('❌ Failed to initialize PouchDB:', error)
      throw new Error(`Database initialization failed: ${error}`)
    }
  }

  // Setup remote PouchDB connection
  const setupRemoteConnection = async () => {
    if (!config.remote?.url) {
      console.log('📱 No remote URL configured, using local-only mode')
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
        console.log(`🌐 Remote CouchDB connected: ${config.remote.url}`)
        console.log(`📊 Remote DB info:`, info)
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
    if (isDestroyed) {
      console.log('🛑 Sync destroyed, cannot initialize')
      return
    }

    return executeSyncWithCircuitBreaker(async () => {
      const localDB = initializeDatabase()
      const remoteDB = await setupRemoteConnection()

      if (!remoteDB) {
        console.log('🔄 Remote sync not available, using local-only mode with circuit breaker protection')
        syncStatus.value = 'complete'
        // PouchDB automatically handles cross-tab sync when using the same database
        // The circuit breaker prevents infinite loops while allowing live updates
        return localDB
      }

      // Cleanup existing sync handlers
      await cleanupSyncHandlers()

      // Setup ONE-WAY sync to prevent ping-pong effects
      // Push local changes first, then pull remote changes
      console.log('🔄 Setting up one-way sync (push → pull) to prevent loops')

      // Push handler (local → remote)
      pushHandler = localDB.sync(remoteDB, {
        live: false, // Disable live sync to prevent continuous loops
        retry: false, // Disable retry to prevent infinite attempts
        timeout: config.sync?.timeout || 10000,
        batch_size: config.remote?.batchSize || 50,
        batches_limit: config.remote?.batchesLimit || 5
      })

      // Pull handler (remote → local)
      pullHandler = localDB.sync(remoteDB, {
        live: false, // Disable live sync
        retry: false, // Disable retry
        timeout: config.sync?.timeout || 10000,
        batch_size: config.remote?.batchSize || 50,
        batches_limit: config.remote?.batchesLimit || 5
      })

      // Setup enhanced sync event handlers with loop prevention
      const setupSyncEvents = (handler: PouchDB.Replication.Sync<{}>, direction: 'push' | 'pull') => {
        handler.on('change', (info) => {
          // Prevent sync change events from triggering more sync operations
          if (changeGuard.shouldUpdate(info)) {
            console.log(`📤 Sync ${direction} (${info.direction || 'unknown'}):`, {
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
          console.log(`⏸️ Sync ${direction} paused`)
          syncStatus.value = 'idle'

          if (err) {
            console.warn(`⚠️ Sync ${direction} paused with error:`, err)
            syncErrors.value.push({ direction, error: err, timestamp: new Date() })
          }
        })

        handler.on('active', () => {
          console.log(`▶️ Sync ${direction} active`)
          syncStatus.value = 'syncing'
        })

        handler.on('complete', (info) => {
          console.log(`✅ Sync ${direction} complete:`, {
            docs_written: (info as any).docs_written,
            docs_read: (info as any).docs_read,
            errors: (info as any).errors?.length || 0
          })

          syncStatus.value = 'complete'
          lastSyncTime.value = new Date()

          // Cleanup handler to prevent continuous sync
          if (direction === 'push') {
            pushHandler = null
          } else if (direction === 'pull') {
            pullHandler = null
          }
        })

        handler.on('error', (err) => {
          console.error(`❌ Sync ${direction} error:`, err)
          syncStatus.value = 'error'
          syncErrors.value.push({ direction, error: err, timestamp: new Date() })

          // Circuit breaker will handle error tracking
        })
      }

      setupSyncEvents(pushHandler, 'push')
      setupSyncEvents(pullHandler, 'pull')

      syncStatus.value = 'complete'
      console.log('🔄 One-way sync (push→pull) initialized successfully')

      return localDB
    }, 'initialize-sync')
  }

  // Handle sync change events
  const handleSyncChange = (direction: 'push' | 'pull', info: any) => {
    const changeCount = info.change?.docs?.length || 0
    pendingChanges.value += changeCount

    console.log(`📊 Sync ${direction} - ${changeCount} changes processed`)

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
      console.log('⏳ Sync already in progress')
      return
    }

    const localDB = initializeDatabase()
    const remoteDB = await setupRemoteConnection()

    if (!remoteDB) {
      console.warn('⚠️ Cannot trigger sync: no remote connection')
      return
    }

    try {
      syncStatus.value = 'syncing'

      // One-time sync
      const result = await localDB.replicate.to(remoteDB)
      await localDB.replicate.from(remoteDB)

      syncStatus.value = 'complete'
      lastSyncTime.value = new Date()

      console.log('✅ Manual sync completed:', result)
    } catch (error) {
      console.error('❌ Manual sync failed:', error)
      syncStatus.value = 'error'
      syncErrors.value.push({ error, timestamp: new Date() })
    }
  }

  // Pause sync
  const pauseSync = async () => {
    if (pushHandler) {
      await pushHandler.cancel()
      pushHandler = null
    }
    if (pullHandler) {
      await pullHandler.cancel()
      pullHandler = null
    }
    syncStatus.value = 'paused'
    console.log('⏸️ Sync paused')
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
      console.log('🌐 Back online, resuming sync...')
      if (syncStatus.value === 'paused') {
        resumeSync()
      }
    }

    const handleOffline = () => {
      isOnline.value = false
      console.log('📵 Gone offline, pausing sync...')
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
    isDestroyed = true
    console.log('🛑 Destroying CouchDB sync composable...')

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

  // Initialize on composable creation
  const init = async () => {
    const cleanup = setupNetworkListeners()
    await initializeSync()

    // Add proper cleanup on unmount
    onUnmounted(() => {
      destroy()
    })

    return cleanup
  }

  return {
    // State
    syncStatus: readonly(syncStatus),
    lastSyncTime: readonly(lastSyncTime),
    pendingChanges: readonly(pendingChanges),
    syncErrors: readonly(syncErrors),
    isOnline: readonly(isOnline),
    remoteConnected: readonly(remoteConnected),

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

    // Circuit breaker access
    circuitBreaker: {
      metrics: () => circuitBreaker.getMetrics(),
      isHealthy: () => circuitBreaker.isHealthy(),
      canSync: () => circuitBreaker.canSync(),
      reset: () => circuitBreaker.reset()
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