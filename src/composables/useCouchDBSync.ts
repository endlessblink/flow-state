import { ref, computed, readonly } from 'vue'
import PouchDB from 'pouchdb-browser'
import type { DatabaseConfig as _DatabaseConfig, SyncStatus, SyncEvent, DatabaseHealth } from '@/config/database'
import { getDatabaseConfig, DOCUMENT_IDS as _DOCUMENT_IDS } from '@/config/database'

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

  // Sync replication handlers
  let pushHandler: PouchDB.Replication.Sync<{}> | null = null
  let pullHandler: PouchDB.Replication.Sync<{}> | null = null

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

  // Initialize sync between local and remote
  const initializeSync = async () => {
    const localDB = initializeDatabase()
    const remoteDB = await setupRemoteConnection()

    if (!remoteDB) {
      console.log('🔄 Remote sync not available, using local-only mode')
      syncStatus.value = 'idle'
      return localDB
    }

    try {
      // Cleanup existing sync handlers
      if (pushHandler) {
        await pushHandler.cancel()
        pushHandler = null
      }
      if (pullHandler) {
        await pullHandler.cancel()
        pullHandler = null
      }

      // Setup two-way sync
      pushHandler = localDB.sync(remoteDB, {
        live: config.sync?.live ?? true,
        retry: config.sync?.retry ?? true,
        timeout: config.sync?.timeout,
        batch_size: config.remote?.batchSize,
        batches_limit: config.remote?.batchesLimit
      })

      pullHandler = localDB.sync(remoteDB, {
        live: config.sync?.live ?? true,
        retry: config.sync?.retry ?? true,
        timeout: config.sync?.timeout,
        batch_size: config.remote?.batchSize,
        batches_limit: config.remote?.batchesLimit
      })

      // Setup sync event handlers
      const setupSyncEvents = (handler: PouchDB.Replication.Sync<{}>, direction: 'push' | 'pull') => {
        handler.on('change', (info) => {
          console.log(`📤 Sync ${direction}:`, info)
          handleSyncChange(direction, info)
        })

        handler.on('paused', (err) => {
          console.log(`⏸️ Sync ${direction} paused:`, err)
          if (err) {
            syncErrors.value.push({ direction, error: err, timestamp: new Date() })
          }
        })

        handler.on('active', () => {
          console.log(`▶️ Sync ${direction} active`)
          syncStatus.value = 'syncing'
        })

        handler.on('complete', (info) => {
          console.log(`✅ Sync ${direction} complete:`, info)
          if (syncStatus.value === 'syncing') {
            syncStatus.value = 'complete'
            lastSyncTime.value = new Date()
          }
        })

        handler.on('error', (err) => {
          console.error(`❌ Sync ${direction} error:`, err)
          syncStatus.value = 'error'
          syncErrors.value.push({ direction, error: err, timestamp: new Date() })
        })
      }

      setupSyncEvents(pushHandler, 'push')
      setupSyncEvents(pullHandler, 'pull')

      syncStatus.value = 'complete'
      console.log('🔄 Two-way sync initialized successfully')

    } catch (error) {
      console.error('❌ Failed to initialize sync:', error)
      syncStatus.value = 'error'
      syncErrors.value.push({ error, timestamp: new Date() })
    }

    return localDB
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
      const _localInfo = await localDB.info()
      let _remoteInfo = null

      if (remoteConnected.value && config.remote?.url) {
        try {
          const remoteDB = new PouchDB(config.remote.url)
          _remoteInfo = await remoteDB.info()
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

  // Initialize on composable creation
  const init = async () => {
    const cleanup = setupNetworkListeners()
    await initializeSync()
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
    init
  }
}

// Export the PouchDB instance for use in other composables
export const getPouchDB = () => {
  if (!globalPouchDB) {
    throw new Error('PouchDB not initialized. Call useCouchDBSync().init() first.')
  }
  return globalPouchDB
}