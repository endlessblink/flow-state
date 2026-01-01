/**
 * Reliable Sync Manager - Phase 2 Implementation
 * Enhanced sync manager with conflict detection, resolution, retry logic, and validation
 */

import { ref, computed, triggerRef, type Ref, type ComputedRef } from 'vue'
import PouchDB from 'pouchdb-browser'
import { ConflictDetector } from '@/utils/conflictDetector'
import { ConflictResolver } from '@/utils/conflictResolver'
import { RetryManager } from '@/utils/retryManager'
import { OfflineQueue } from '@/utils/offlineQueue'
import { SyncValidator } from '@/utils/syncValidator'
import { isSyncableDocument } from '@/composables/documentFilters'
import { getDatabaseConfig } from '@/config/database'
import { useBackupSystem } from '@/composables/useBackupSystem'
import { getTimezoneManager } from '@/utils/timezoneCompatibility'
import { getNetworkOptimizer } from '@/utils/networkOptimizer'
import { getBatchManager } from '@/utils/syncBatchManager'
import { getLogger } from '@/utils/productionLogger'
import type { ConflictInfo, ResolutionResult } from '@/types/conflicts'
import type { SyncValidationResult } from '@/utils/syncValidator'

export type { ConflictInfo, ResolutionResult }
export type { SyncValidationResult }
import type { SyncMetadata as _SyncMetadata } from '@/utils/timezoneCompatibility'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'complete' | 'resolving_conflicts' | 'validating' | 'offline' | 'paused'

export interface SyncHealth {
  syncStatus: SyncStatus
  conflictCount: number
  hasErrors: boolean
  queueStatus: { length: number; processing: boolean; isOnline: boolean }
  lastValidation?: SyncValidationResult
  isOnline: boolean
  deviceId: string
  uptime: number
}

export interface SyncMetrics {
  totalSyncs: number
  successfulSyncs: number
  failedSyncs: number
  conflictsDetected: number
  conflictsResolved: number
  averageSyncTime: number
  lastSyncTime?: Date
  uptime: number
  successRate?: number
  conflictsRate?: number
}

export const useReliableSyncManager = () => {
  // BUG-054 FIX: DON'T cache config at module load time!
  // getDatabaseConfig() now reads from localStorage dynamically,
  // so we must call it fresh each time we need the config.
  // Removed: const config = getDatabaseConfig()

  // Phase 1 reactive state (keep existing)
  const syncStatus = ref<SyncStatus>('idle')
  const error = ref<string | null>(null)
  // Initialize lastSyncTime from localStorage for persistence across page reloads
  const storedLastSync = localStorage.getItem('pomoflow_lastSyncTime')
  const lastSyncTime = ref<Date | null>(storedLastSync ? new Date(storedLastSync) : null)
  const pendingChanges = ref(0)
  const isOnline = ref(navigator.onLine)
  const remoteConnected = ref(false)
  // Flag that remains true after first successful connection - stored in localStorage for persistence
  const hasConnectedEver = ref(localStorage.getItem('pomoflow_hasConnectedEver') === 'true')

  // Phase 2 reactive state
  const conflicts = ref<ConflictInfo[]>([])
  const resolutions = ref<ResolutionResult[]>([])
  const lastValidation = ref<SyncValidationResult | null>(null)

  // BUG-025 FIX: Track initial sync completion to prevent race condition with UI loading
  const initialSyncComplete = ref(false)

  /**
   * BUG-025 FIX: Wait for initial sync to complete before loading UI data
   * This prevents the race condition where App.vue loads stale local data
   * before CouchDB sync has completed
   */
  const waitForInitialSync = async (timeoutMs = 10000): Promise<boolean> => {
    if (initialSyncComplete.value) return true

    console.log(`⏳ [SYNC] Waiting for initial sync (timeout: ${timeoutMs}ms)...`)
    const startTime = Date.now()

    while (!initialSyncComplete.value && Date.now() - startTime < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (initialSyncComplete.value) {
      console.log('✅ [SYNC] Initial sync complete - safe to load data')
    } else {
      console.warn(`⚠️ [SYNC] Initial sync timeout after ${timeoutMs}ms - loading local data`)
    }

    return initialSyncComplete.value
  }

  const metrics = ref<SyncMetrics>({
    totalSyncs: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    conflictsDetected: 0,
    conflictsResolved: 0,
    averageSyncTime: 0,
    uptime: Date.now()
  })

  // Computed properties for component usage
  const isSyncing = computed(() => syncStatus.value === 'syncing' || syncStatus.value === 'resolving_conflicts' || syncStatus.value === 'validating')
  const hasErrors = computed(() => error.value !== null)

  // PouchDB instances
  let localDB: PouchDB.Database | null = null
  let remoteDB: PouchDB.Database | null = null
  let syncHandler: PouchDBSyncHandler | null = null

  // Phase 2 systems
  const conflictDetector = new ConflictDetector()
  const conflictResolver = new ConflictResolver(conflictDetector.getDeviceId())
  const retryManager = new RetryManager({
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true
  })
  const offlineQueue = new OfflineQueue()
  const syncValidator = new SyncValidator({
    strictMode: false,
    includeChecksums: true,
    validateTimestamps: true,
    validateIds: true
  })
  const backupSystem = useBackupSystem()

  // Phase 3 optimization systems
  const timezoneManager = getTimezoneManager()
  const networkOptimizer = getNetworkOptimizer()
  const batchManager = getBatchManager()
  const logger = getLogger()

  // Set logger context
  logger.setDevice(timezoneManager.getDeviceInfo().deviceId)

  // Cleanup function for network listeners
  let networkCleanup: (() => void) | null = null
  const startTime = Date.now()

  // Enhanced network monitoring
  let healthCheckInterval: ReturnType<typeof setInterval> | null = null
  let consecutiveHealthChecks = 0
  const MAX_CONSECUTIVE_FAILURES = 3
  const HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

  // BUG-054 FIX: Callbacks for when data is pulled from remote
  // This allows stores to reload after sync completes
  const dataPulledCallbacks: Array<() => Promise<void> | void> = []

  /**
   * Register a callback to be called when data is pulled from remote
   * This is used to reload stores after sync completes
   */
  const registerDataPulledCallback = (callback: () => Promise<void> | void): (() => void) => {
    dataPulledCallbacks.push(callback)
    // Return unregister function
    return () => {
      const index = dataPulledCallbacks.indexOf(callback)
      if (index > -1) {
        dataPulledCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Call all registered callbacks when data is pulled
   */
  const notifyDataPulled = async () => {
    console.log(`🔄 [SYNC] Notifying ${dataPulledCallbacks.length} callbacks that data was pulled`)
    for (const callback of dataPulledCallbacks) {
      try {
        await callback()
      } catch (err) {
        console.warn('⚠️ Data pulled callback failed:', err)
      }
    }
  }

  /**
   * Initialize local PouchDB instance
   */
  const initializeLocalDatabase = (): PouchDB.Database => {
    try {
      if (localDB) {
        return localDB
      }

      // BUG-054 FIX: Get fresh config each time (reads from localStorage → env vars)
      const config = getDatabaseConfig()

      localDB = new PouchDB(config.local.name, {
        adapter: config.local.adapter
      })

      console.log(`🗄️ ReliableSyncManager: Local PouchDB initialized: ${config.local.name}`)
      return localDB
    } catch (error) {
      console.error('❌ Failed to initialize local database:', error)
      throw new Error(`Local database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Setup remote PouchDB connection with error handling
   */
  const setupRemoteConnection = async (): Promise<PouchDB.Database | null> => {
    try {
      console.log('🔌 [REMOTE] Starting remote connection setup...')

      // BUG-054 FIX: Get fresh config each time (reads from localStorage → env vars)
      const config = getDatabaseConfig()

      if (!config.remote?.url) {
        console.log('📱 ReliableSyncManager: No remote URL configured, using local-only mode')
        remoteConnected.value = false
        return null
      }

      console.log(`🔌 [REMOTE] URL: ${config.remote.url}`)

      const remoteOptions: PouchDB.Configuration.RemoteDatabaseConfiguration = {}

      if (config.remote.auth) {
        remoteOptions.auth = {
          username: config.remote.auth.username,
          password: config.remote.auth.password
        }
        console.log(`🔌 [REMOTE] Auth configured for user: ${config.remote.auth.username}`)
      }

      // Add timeout property - reduced to 10 seconds for faster feedback
      (remoteOptions as PouchDB.Configuration.RemoteDatabaseConfiguration & { timeout?: number }).timeout = 10000
      remoteOptions.skip_setup = false

      console.log('🔌 [REMOTE] Creating PouchDB instance...')
      remoteDB = new PouchDB(config.remote.url, remoteOptions)
      console.log('🔌 [REMOTE] PouchDB instance created, testing connection...')

      // Use a timeout wrapper for the info() call
      try {
        const infoPromise = remoteDB.info()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000)
        )

        const info = await Promise.race([infoPromise, timeoutPromise]) as PouchDB.Core.DatabaseInfo
        console.log(`🌐 ReliableSyncManager: Remote CouchDB connected: ${config.remote.url}`)
        console.log(`📊 Remote DB info:`, {
          name: info.db_name,
          doc_count: info.doc_count,
          update_seq: info.update_seq
        })
        remoteConnected.value = true
        hasConnectedEver.value = true
        localStorage.setItem('pomoflow_hasConnectedEver', 'true')  // Persist to localStorage
        triggerRef(remoteConnected)
        console.log('🔌 [REMOTE] Set remoteConnected=true, hasConnectedEver=true (saved to localStorage)')
        return remoteDB
      } catch (connectionError) {
        console.warn('⚠️ Remote connection test failed:', connectionError)
        // Still return the remoteDB - sync might work even if info() fails
        remoteConnected.value = false
        return remoteDB
      }
    } catch (err) {
      console.error('❌ Failed to setup remote connection:', err instanceof Error ? err.message : 'Unknown error')
      remoteConnected.value = false
      return null
    }
  }

  /**
   * Initialize Phase 2 systems
   */
  const initializePhase2Systems = async () => {
    console.log('🔧 Initializing Phase 2 sync systems...')

    try {
      // Initialize conflict detector with databases
      if (localDB) {
        await conflictDetector.initialize(localDB, remoteDB)
      }

      // Update references in offline queue
      offlineQueue.updateReferences(localDB, retryManager)

      console.log('✅ Phase 2 systems initialized successfully')
    } catch (err) {
      console.error('❌ Failed to initialize Phase 2 systems:', err instanceof Error ? err.message : 'Unknown error')
      throw err
    }
  }

  /**
   * Initialize sync with enhanced Phase 2 capabilities
   * SYNC RE-ENABLED: Safe after Phase 1 watcher fixes (Dec 2025)
   */
  const initializeSync = async (): Promise<void> => {
    // REDUCED LOGGING
    console.log('🚀 [SYNC] Initializing...')

    try {
      // Initialize the database connection using internal function
      localDB = initializeLocalDatabase()

      const w = window as any
      w.pomoFlowDb = localDB

      remoteDB = await setupRemoteConnection()

      if (!remoteDB) {
        console.log('📱 No remote database available, running in offline mode')
        syncStatus.value = 'offline'
        return
      }

      // Initialize Phase 2 systems
      await initializePhase2Systems()

      // BUG-025 FIX: One-time bidirectional sync on startup only
      // DO NOT reload task store here - let App.vue handle that
      if (remoteDB && isOnline.value) {
        syncStatus.value = 'syncing'
        try {
          // BUG-054 FIX: Add 30-second timeout to initial sync to prevent hanging
          const syncPromise = localDB.sync(remoteDB, {
            batch_size: 100,
            batches_limit: 10
          })
          const syncTimeout = new Promise<null>((_, reject) => {
            setTimeout(() => reject(new Error('Initial sync timeout after 30 seconds')), 30000)
          })

          const result = await Promise.race([syncPromise, syncTimeout])
          if (result) {
            const pulledDocs = result.pull?.docs_written || 0
            console.log(`✅ [SYNC] Initial: pushed ${result.push?.docs_written || 0}, pulled ${pulledDocs}`)

            // BUG-054 FIX: Notify callbacks when data is pulled so stores can reload
            if (pulledDocs > 0) {
              await notifyDataPulled()
            }
          }
        } catch (syncError) {
          console.warn('⚠️ [SYNC] Initial sync failed, using local data:', (syncError as Error).message)
        }
      }

      // BUG-025 FIX: Mark initial sync as complete so App.vue can proceed with loading data
      // This is set even if sync failed, since we want the UI to proceed with local data
      initialSyncComplete.value = true
      console.log('✅ [SYNC] Initial sync complete signal sent')

      syncStatus.value = 'idle'
      error.value = null
      conflicts.value = []

      console.log('✅ [SYNC] Sync system initialized successfully')
    } catch (initError) {
      console.error('❌ [SYNC] Failed to initialize sync:', initError)
      syncStatus.value = 'error'
      error.value = (initError as Error).message
    }
  }

  /**
   * Setup enhanced sync event handlers
   */
  const _setupSyncEventHandlers = (handler: PouchDBSyncHandler) => {
    try {
      handler.on('change', (info: unknown) => {
        console.log(`📤 Reliable sync change:`, info)
        handleSyncChange(info)
      })

      handler.on('paused', (err: unknown) => {
        console.log(`⏸️ Sync paused:`, err)
        if (err) {
          error.value = `Sync paused: ${err instanceof Error ? err.message : 'Unknown error'}`
        }
      })

      handler.on('active', () => {
        console.log(`▶️ Sync active`)
        syncStatus.value = 'syncing'
      })

      handler.on('complete', (info: unknown) => {
        console.log(`✅ Sync complete:`, info)
        if (syncStatus.value === 'syncing') {
          syncStatus.value = 'complete'
          lastSyncTime.value = new Date()
          localStorage.setItem('pomoflow_lastSyncTime', lastSyncTime.value.toISOString())  // Persist to localStorage
          metrics.value.lastSyncTime = new Date()
          metrics.value.successfulSyncs++
        }
      })

      handler.on('error', (err: unknown) => {
        console.error(`❌ Sync error:`, err)
        syncStatus.value = 'error'
        error.value = err instanceof Error ? err.message : 'Unknown error'
        metrics.value.failedSyncs++
      })
    } catch (setupErr) {
      console.error(`❌ Failed to setup sync event handlers:`, setupErr instanceof Error ? setupErr.message : 'Unknown error')
      throw setupErr
    }
  }

  /**
   * Handle sync change events with conflict detection
   */
  const handleSyncChange = async (info: unknown) => {
    try {
      const syncInfo = info as PouchDBSyncChange
      const docs = syncInfo.change?.docs || []
      const syncableDocs = docs.filter(isSyncableDocument)

      if (syncableDocs.length > 0) {
        console.log(`📊 Processing ${syncableDocs.length} syncable documents`)

        // Check for conflicts in changed documents
        for (const doc of syncableDocs) {
          const conflict = await conflictDetector.detectDocumentConflict(doc)
          if (conflict) {
            conflicts.value.push(conflict)
            console.log(`⚔️ Conflict detected during sync: ${conflict.documentId}`)
          }
        }

        // Auto-resolve conflicts if possible
        if (conflicts.value.length > 0) {
          await resolveAutoResolvableConflicts()
        }
      }

      // Update pending changes count
      pendingChanges.value = (info as PouchDBSyncInfo).pending || 0

      // Emit custom event for UI components
      window.dispatchEvent(new CustomEvent('reliable-sync-change', {
        detail: {
          documentCount: syncableDocs.length,
          documents: syncableDocs,
          conflictsDetected: conflicts.value.length,
          timestamp: new Date()
        }
      }))
    } catch (err) {
      console.error(`❌ Error handling sync change:`, err instanceof Error ? err.message : 'Unknown error')
    }
  }

  /**
   * Auto-resolve conflicts that can be automatically resolved
   */
  const resolveAutoResolvableConflicts = async () => {
    const autoResolvableConflicts = conflicts.value.filter(c => c.autoResolvable)

    if (autoResolvableConflicts.length === 0) {
      return
    }

    console.log(`🔧 Auto-resolving ${autoResolvableConflicts.length} conflicts`)
    syncStatus.value = 'resolving_conflicts'

    const resolved: ResolutionResult[] = []

    for (const conflict of autoResolvableConflicts) {
      try {
        const resolution = await conflictResolver.resolveConflict(conflict)
        resolved.push(resolution)

        // Apply resolution to local database with proper revision handling
        if (localDB) {
          try {
            // BUG-013 FIX: Deleting conflicts requires fetching the conflict revisions first
            // and include them as _deleted: true in a bulkDocs operation

            // 1. Fetch current document with conflicts to get latest state
            const currentDoc = await localDB.get(conflict.documentId, { conflicts: true })
            const conflictRevs = (currentDoc as any)._conflicts || []

            // 2. Prepare bulk update
            const bulkDocs = [
              // The Winner (Updated State)
              {
                ...(resolution.resolvedDocument as Record<string, unknown>),
                _id: conflict.documentId,
                _rev: currentDoc._rev, // Use latest revision from DB, not from conflict info which might be stale
                conflictResolvedAt: new Date().toISOString()
              },
              // The Losers (Mark as Deleted)
              ...conflictRevs.map((rev: string) => ({
                _id: conflict.documentId,
                _rev: rev,
                _deleted: true
              }))
            ]

            console.log(`🧹 Resolving conflict for ${conflict.documentId} with ${conflictRevs.length} deletions`)

            await localDB.bulkDocs(bulkDocs)

            console.log(`✅ Conflict resolved and cleaned for ${conflict.documentId}`)

          } catch (putError: unknown) {
            console.error(`❌ Failed to apply resolution for ${conflict.documentId}:`, putError)
            throw putError
          }
        }

        metrics.value.conflictsResolved++
      } catch (err) {
        console.error(`❌ Failed to auto-resolve conflict for ${conflict.documentId}:`, err instanceof Error ? err.message : 'Unknown error')
      }
    }

    resolutions.value.push(...resolved)

    // Remove resolved conflicts
    conflicts.value = conflicts.value.filter(c => !c.autoResolvable)

    console.log(`✅ Auto-resolved ${resolved.length} conflicts`)
  }

  // SYNC FIX: Throttle for manual sync to prevent rapid repeated calls
  let lastManualSyncTime = 0
  const MANUAL_SYNC_COOLDOWN = 5000 // 5 seconds minimum between manual syncs

  /**
   * Manual sync trigger with retry logic and validation
   * SYNC RE-ENABLED: Safe after Phase 1 watcher fixes (Dec 2025)
   */
  const triggerSync = async (): Promise<void> => {
    // SYNC FIX: Throttle manual sync to prevent rapid calls
    const now = Date.now()
    if (now - lastManualSyncTime < MANUAL_SYNC_COOLDOWN) {
      const remaining = Math.ceil((MANUAL_SYNC_COOLDOWN - (now - lastManualSyncTime)) / 1000)
      console.log(`⏳ [SYNC] Manual sync throttled - wait ${remaining}s`)
      return
    }
    lastManualSyncTime = now

    console.log('🔄 [SYNC] Manual sync triggered')

    if (syncStatus.value === 'syncing') {
      console.log('⏳ Sync already in progress')
      return
    }

    // CRITICAL FIX: Initialize sync if not already done
    // This ensures localDB is set up before we try to use it
    if (!localDB) {
      console.log('🔄 [SYNC] Initializing sync system first...')
      await initializeSync()

      // Check if initialization failed
      if (!localDB) {
        console.error('❌ [SYNC] Failed to initialize - cannot proceed with sync')
        syncStatus.value = 'error'
        error.value = 'Failed to initialize database connection'
        return
      }
    }

    // Check network conditions before proceeding
    if (!networkOptimizer.shouldSync()) {
      console.log('⏸️ Network conditions not suitable for sync')
      const delay = networkOptimizer.getSyncDelay()
      console.log(`🔄 Will retry sync in ${delay}ms`)
      return
    }

    metrics.value.totalSyncs++

    try {
      await retryManager.executeWithRetry(
        async () => {
          return performReliableSync()
        },
        'manual-sync-trigger',
        {
          timestamp: timezoneManager.normalizeTimestamp(new Date()).iso,
          networkCondition: networkOptimizer.getMetrics().currentCondition
        }
      )

      console.log('✅ Manual sync completed successfully')
      networkOptimizer.recordSyncResult(true)

    } catch (syncError) {
      console.error('❌ Manual sync failed:', syncError)
      syncStatus.value = 'error'
      error.value = syncError instanceof Error ? syncError.message : 'Unknown error'
      metrics.value.failedSyncs++
      networkOptimizer.recordSyncResult(false)

      // Queue operation for later if offline or poor network
      if (!navigator.onLine || !networkOptimizer.shouldSync()) {
        await offlineQueue.addToQueue({
          type: 'sync',
          entityId: 'manual-sync',
          priority: 'high',
          data: {},
          entityType: 'sync',
          maxRetries: 3
        } as unknown as Parameters<typeof offlineQueue.addToQueue>[0])
      }
    }
  }

  /**
   * Perform reliable sync with all Phase 2 features
   * SYNC RE-ENABLED: Safe after Phase 1 watcher fixes (Dec 2025)
   */
  const performReliableSync = async (): Promise<void> => {
    const syncOperation = logger.startSyncOperation('full_sync')
    const operationId = syncOperation.operationId

    try {
      if (!localDB) {
        throw new Error('Local database not initialized')
      }

      const remoteDB = await setupRemoteConnection()
      if (!remoteDB) {
        throw new Error('Remote database not available')
      }

      syncStatus.value = 'syncing'

      // Step 0: Backup before sync (safety first) - SILENT
      try {
        await backupSystem.createBackup('auto')
      } catch (_backupErr) {
        // Silent fail - backup is optional
      }

      // Step 1: Pre-sync validation - SILENT unless critical
      const validationResult = await syncValidator.validateDatabase(localDB)
      lastValidation.value = validationResult
      if (validationResult.critical) {
        throw new Error(`Critical database validation failure: ${validationResult.errors?.[0] || 'Unknown error'}`)
      }

      // Step 2: Conflict detection - only log if conflicts found
      const existingConflicts = await conflictDetector.detectAllConflicts()
      if (existingConflicts.length > 0) {
        console.log(`⚔️ ${existingConflicts.length} conflicts found`)
        conflicts.value = existingConflicts
        await resolveAutoResolvableConflicts()
      }

      // Step 3: Perform sync (CORE OPERATION) with timeout
      // IMPORTANT: PULL FIRST to get authoritative remote data before pushing local changes
      // This prevents stale local data from overwriting good remote data
      const local = localDB
      const remote = remoteDB

      try {
        // Pull remote → local FIRST (get authoritative data)
        const pullPromise = local.replicate.from(remote, {
          live: false,
          retry: false,
          batch_size: 50,
          batches_limit: 10
        })
        const pullTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Pull timeout after 60 seconds')), 60000)
        })
        const pullResult = await Promise.race([pullPromise, pullTimeout]) as PouchDB.Replication.ReplicationResultComplete<Record<string, unknown>>

        // Push local → remote
        const pushPromise = local.replicate.to(remote, {
          live: false,
          retry: false,
          batch_size: 50,
          batches_limit: 5
        })
        const pushTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Push timeout after 60 seconds')), 60000)
        })
        const pushResult = await Promise.race([pushPromise, pushTimeout]) as PouchDB.Replication.ReplicationResultComplete<Record<string, unknown>>

        // Only log if docs were actually transferred
        const pulled = pullResult.docs_read || 0
        const pushed = pushResult.docs_written || 0
        if (pulled > 0 || pushed > 0) {
          console.log(`✅ [SYNC] Pulled ${pulled}, pushed ${pushed} docs`)
        }

        // BUG-054 FIX: Notify callbacks when data is pulled so stores can reload
        if (pulled > 0) {
          await notifyDataPulled()
        }
      } catch (syncError) {
        throw new Error(`Sync failed: ${(syncError as Error).message}`)
      }

      // Success - update metrics and status (SILENT)
      syncStatus.value = 'complete'
      remoteConnected.value = true
      hasConnectedEver.value = true
      localStorage.setItem('pomoflow_hasConnectedEver', 'true')
      triggerRef(syncStatus)
      triggerRef(remoteConnected)
      lastSyncTime.value = new Date()
      localStorage.setItem('pomoflow_lastSyncTime', lastSyncTime.value.toISOString())
      metrics.value.lastSyncTime = new Date()
      metrics.value.successfulSyncs++

      // Complete sync operation logging (internal only)
      if ('completeSyncOperation' in logger) {
        (logger as { completeSyncOperation: (id: string, success: boolean) => void }).completeSyncOperation(operationId, true)
      }

    } catch (syncError) {
      const syncErrMessage = syncError instanceof Error ? syncError.message : 'Unknown error'
      const syncErrStack = syncError instanceof Error ? syncError.stack : undefined
      console.error('❌ Reliable sync failed:', syncErrMessage)

      // Log error
      logger.error('sync', 'Reliable sync failed', {
        operationId,
        error: syncErrMessage,
        stack: syncErrStack
      })

      // Complete sync operation with failure
      if ('completeSyncOperation' in logger) {
        (logger as { completeSyncOperation: (id: string, success: boolean, msg?: string) => void }).completeSyncOperation(operationId, false, syncErrMessage)
      }

      // Check if this is a critical error that requires data restoration
      const errorMessage = syncErrMessage.toLowerCase()
      const isCriticalError = errorMessage.includes('corruption') ||
        errorMessage.includes('data loss') ||
        errorMessage.includes('integrity') ||
        errorMessage.includes('validation failed')

      if (isCriticalError) {
        logger.critical('sync', 'Critical sync error detected - data restoration may be needed', {
          operationId,
          error: errorMessage
        })

        try {
          // List recent backups and check if restoration might be needed
          const backups = backupSystem.backupHistory.value
          const recentBackup = backups[0] // Most recent backup

          if (recentBackup) {
            // BUG-025: PouchDB serializes Date as string, convert before getTime()
            const backupAge = Date.now() - new Date(recentBackup.timestamp).getTime()
            const backupAgeMinutes = backupAge / (1000 * 60)

            if (backupAgeMinutes < 30) { // Only consider backups less than 30 minutes old
              logger.warn('sync', `Recent backup found for potential restoration`, {
                backupId: recentBackup.id,
                backupAgeMinutes: backupAgeMinutes.toFixed(1),
                operationId
              })

              // Store backup info for potential manual restoration
              const backupId = 'id' in recentBackup ? (recentBackup.id as string) : 'unknown'
              error.value = `${errorMessage || 'Unknown error'}. Recent backup available: ${backupId} (${backupAgeMinutes.toFixed(1)} minutes old)`
            }
          }
        } catch (backupCheckError) {
          logger.error('sync', 'Failed to check backups during error recovery', {
            operationId,
            backupCheckError: (backupCheckError as Error).message
          })
        }
      }

      // Update sync status to indicate error
      syncStatus.value = 'error'
      throw error
    }
  }

  /**
   * Manual conflict resolution
   */
  const manualConflictResolution = async (conflictId: string, _resolution: unknown): Promise<void> => {
    // TODO: Implement proper manual conflict resolution
    console.log(`👤 Manual conflict resolution requested for ${conflictId} - temporarily disabled`)
    return Promise.resolve()
  }

  /**
   * Perform connection health check
   */
  const performHealthCheck = async (): Promise<boolean> => {
    if (!remoteDB || !isOnline.value) {
      return false
    }

    try {
      // Quick ping to remote database
      const startTime = Date.now()
      await remoteDB.info()
      const responseTime = Date.now() - startTime

      if (responseTime > 10000) { // 10 second threshold
        console.warn(`⚠️ Slow connection detected: ${responseTime}ms`)
      }

      consecutiveHealthChecks = 0
      return true
    } catch (healthError) {
      consecutiveHealthChecks++
      console.warn(`❌ Health check failed (${consecutiveHealthChecks}/${MAX_CONSECUTIVE_FAILURES}):`, healthError instanceof Error ? healthError.message : 'Unknown error')

      if (consecutiveHealthChecks >= MAX_CONSECUTIVE_FAILURES) {
        console.error('💥 Multiple consecutive health check failures - treating as offline')
        isOnline.value = false
        syncStatus.value = 'error'
        error.value = 'Connection health check failed'
      }

      return false
    }
  }

  /**
   * Setup enhanced network monitoring with health checks
   */
  const setupNetworkListeners = () => {
    const handleOnline = () => {
      console.log('🌐 Back online, resuming sync...')
      isOnline.value = true
      consecutiveHealthChecks = 0 // Reset failure counter

      // Reset health check failures
      if (error.value?.includes('Connection health check failed')) {
        error.value = null
      }

      if (syncStatus.value === 'offline' || syncStatus.value === 'error') {
        initializeSync()
      }
      offlineQueue.processQueue()
    }

    const handleOffline = () => {
      console.log('📵 Gone offline, pausing sync...')
      isOnline.value = false
      syncStatus.value = 'offline'

      // Stop health checks when offline
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval)
        healthCheckInterval = null
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Start periodic health checks if we have a remote connection
    if (remoteDB) {
      healthCheckInterval = setInterval(async () => {
        if (isOnline.value && syncStatus.value !== 'offline') {
          await performHealthCheck()
        }
      }, HEALTH_CHECK_INTERVAL)
    }

    networkCleanup = () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)

      if (healthCheckInterval) {
        clearInterval(healthCheckInterval)
        healthCheckInterval = null
      }
    }

    return networkCleanup
  }

  /**
   * Get comprehensive sync health information
   */
  const getSyncHealth = (): SyncHealth => {
    return {
      syncStatus: syncStatus.value,
      conflictCount: conflicts.value.length,
      hasErrors: !!error.value,
      queueStatus: offlineQueue.getQueueStats(),
      lastValidation: lastValidation.value || undefined,
      isOnline: isOnline.value,
      deviceId: conflictDetector.getDeviceId(),
      uptime: Date.now() - startTime
    }
  }

  /**
   * Get sync metrics
   */
  const getSyncMetrics = () => {
    const uptime = Date.now() - startTime
    const successRate = metrics.value.totalSyncs > 0
      ? metrics.value.successfulSyncs / metrics.value.totalSyncs
      : 0

    return {
      ...metrics.value,
      uptime,
      successRate: Math.round(successRate * 100) / 100,
      conflictsRate: metrics.value.totalSyncs > 0
        ? metrics.value.conflictsDetected / metrics.value.totalSyncs
        : 0
    }
  }

  /**
   * Clear sync errors and history
   */
  const clearSyncErrors = () => {
    error.value = null
    conflicts.value = []
    resolutions.value = []
    lastValidation.value = null
    console.log('🧹 Sync errors and history cleared')
  }

  /**
   * Get retry manager statistics
   */
  const getRetryStats = () => {
    return retryManager.getStats()
  }

  /**
   * Get offline queue statistics
   */
  const getOfflineQueueStats = () => {
    return offlineQueue.getQueueStats()
  }

  /**
   * Pause sync operations (graceful)
   */
  const pauseSync = async (): Promise<void> => {
    console.log('⏸️ Pausing sync operations...')

    try {
      // Cancel active sync if running
      if (syncHandler) {
        await syncHandler.cancel()
        syncHandler = null
      }

      // Update status
      syncStatus.value = 'paused'
      error.value = null

      // Stop health checks during pause
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval)
        healthCheckInterval = null
      }

      console.log('✅ Sync operations paused successfully')
    } catch (pauseError) {
      console.error('❌ Failed to pause sync:', pauseError instanceof Error ? pauseError.message : 'Unknown error')
      throw pauseError
    }
  }

  /**
   * Resume sync operations
   */
  const resumeSync = async (): Promise<void> => {
    console.log('▶️ Resuming sync operations...')

    try {
      // Check if we're online
      if (!navigator.onLine) {
        console.warn('⚠️ Cannot resume sync - currently offline')
        syncStatus.value = 'offline'
        return
      }

      // Restart health checks
      if (!healthCheckInterval && remoteDB) {
        healthCheckInterval = setInterval(async () => {
          if (isOnline.value && syncStatus.value !== 'offline') {
            await performHealthCheck()
          }
        }, HEALTH_CHECK_INTERVAL)
      }

      // Initialize sync again
      await initializeSync()

      // Process any pending offline queue items
      await offlineQueue.processQueue()

      console.log('✅ Sync operations resumed successfully')
    } catch (resumeError) {
      console.error('❌ Failed to resume sync:', resumeError instanceof Error ? resumeError.message : 'Unknown error')
      syncStatus.value = 'error'
      error.value = resumeError instanceof Error ? resumeError.message : 'Unknown error'
      throw resumeError
    }
  }

  /**
   * Toggle pause/resume sync
   */
  const toggleSync = async (): Promise<void> => {
    if (syncStatus.value === 'paused') {
      await resumeSync()
    } else if (syncStatus.value !== 'offline' && syncStatus.value !== 'error') {
      await pauseSync()
    } else {
      console.warn('⚠️ Cannot toggle sync in current status:', syncStatus.value)
    }
  }

  /**
   * Throttled sync with adaptive timing
   */
  let lastThrottledSync = 0
  let throttledSyncTimer: ReturnType<typeof setTimeout> | null = null

  const throttledSync = async (priority: 'low' | 'normal' | 'high' = 'normal'): Promise<void> => {
    const now = Date.now()
    const networkConfig = networkOptimizer.getOptimizedConfig()
    const minInterval = networkConfig.syncIntervalMs

    // Clear any existing timer
    if (throttledSyncTimer) {
      clearTimeout(throttledSyncTimer)
      throttledSyncTimer = null
    }

    const timeSinceLastSync = now - lastThrottledSync

    if (timeSinceLastSync >= minInterval) {
      // Sync immediately if enough time has passed
      console.log(`🚀 ${priority} priority sync (time since last: ${timeSinceLastSync}ms)`)
      lastThrottledSync = now
      await triggerSync()
    } else {
      // Schedule sync for later
      const delay = minInterval - timeSinceLastSync
      console.log(`⏰ Throttling ${priority} sync, will trigger in ${delay}ms`)

      throttledSyncTimer = setTimeout(async () => {
        console.log(`⏰ Triggering delayed ${priority} sync`)
        lastThrottledSync = Date.now()
        throttledSyncTimer = null
        try {
          await triggerSync()
        } catch (delayedError) {
          console.error('❌ Delayed sync failed:', delayedError instanceof Error ? delayedError.message : 'Unknown error')
        }
      }, delay)
    }
  }

  /**
   * Cancel any pending throttled sync
   */
  const cancelThrottledSync = (): void => {
    if (throttledSyncTimer) {
      clearTimeout(throttledSyncTimer)
      throttledSyncTimer = null
      console.log('🚫 Pending throttled sync cancelled')
    }
  }

  /**
   * Initialize the reliable sync manager
   */
  const init = async (): Promise<(() => void) | null> => {
    try {
      console.log('🚀 Initializing Reliable Sync Manager (Phase 2)...')

      // Setup network listeners
      const cleanup = setupNetworkListeners()

      // Initialize sync with Phase 2 features
      await initializeSync()

      return cleanup
    } catch (initError) {
      console.error('❌ Failed to initialize Reliable Sync Manager:', initError instanceof Error ? initError.message : 'Unknown error')
      syncStatus.value = 'error'
      error.value = initError instanceof Error ? initError.message : 'Unknown error'
      return null
    }
  }

  /**
   * Start live (continuous) sync between local and remote
   * This enables real-time sync across tabs/browsers
   */
  const startLiveSync = async (): Promise<boolean> => {
    console.log('🔄 [LIVE SYNC] Starting live sync...')

    // Ensure databases are initialized
    if (!localDB || !remoteDB) {
      console.log('🔄 [LIVE SYNC] Initializing databases first...')
      await init()

      if (!localDB || !remoteDB) {
        console.error('❌ [LIVE SYNC] Failed to initialize databases')
        return false
      }
    }

    // Cancel any existing sync handler
    if (syncHandler) {
      console.log('🔄 [LIVE SYNC] Cancelling existing sync handler...')
      try {
        await syncHandler.cancel()
      } catch (e) {
        console.warn('⚠️ [LIVE SYNC] Error cancelling existing sync:', e)
      }
      syncHandler = null
    }

    try {
      // Setup bidirectional live sync
      syncHandler = localDB.sync(remoteDB, {
        live: true,
        retry: true,
        batch_size: 50,
        batches_limit: 10
      }) as unknown as PouchDBSyncHandler

      // Setup event handlers
      syncHandler.on('change', async (info) => {
        const syncChange = info as { direction: 'pull' | 'push'; change: { docs: unknown[] } }
        // REDUCED LOGGING: Only log significant changes
        const docCount = syncChange.change?.docs?.length || 0
        if (docCount > 0) {
          console.log('📤 [LIVE SYNC] Change:', syncChange.direction, docCount, 'docs')
        }

        // BUG-054 FIX: Notify callbacks when data is PULLED from remote
        // This allows stores to reload and show the new data
        // Only trigger on 'pull' direction to avoid infinite loop with 'push'
        // The stores use manualOperationInProgress flag to prevent re-save during load
        if (syncChange.direction === 'pull' && docCount > 0) {
          await notifyDataPulled()
        }

        lastSyncTime.value = new Date()
        localStorage.setItem('pomoflow_lastSyncTime', lastSyncTime.value.toISOString())
      })

      if (syncHandler) {
        syncHandler.on('paused', (err: unknown) => {
          if (err) {
            console.warn('⏸️ [LIVE SYNC] Paused with error:', err)
            syncStatus.value = 'paused'
          } else {
            console.log('⏸️ [LIVE SYNC] Paused (waiting for changes)')
            syncStatus.value = 'idle'
          }
        })

        syncHandler.on('active', () => {
          console.log('▶️ [LIVE SYNC] Active')
          syncStatus.value = 'syncing'
        })

        syncHandler.on('denied', (err: unknown) => {
          console.error('🚫 [LIVE SYNC] Denied:', err)
          error.value = 'Sync denied: ' + ((err as { message?: string })?.message || 'Unknown error')
        })

        syncHandler.on('error', (err: unknown) => {
          console.error('❌ [LIVE SYNC] Error:', err)
          syncStatus.value = 'error'
          error.value = (err as { message?: string })?.message || 'Sync error'
        })

        syncHandler.on('complete', (info: unknown) => {
          console.log('✅ [LIVE SYNC] Complete:', info)
          // Live sync shouldn't complete unless cancelled
        })
      }

      console.log('✅ [LIVE SYNC] Live sync started successfully')
      syncStatus.value = 'idle'
      remoteConnected.value = true  // Set remoteConnected so UI shows Online/Synced
      hasConnectedEver.value = true
      localStorage.setItem('pomoflow_hasConnectedEver', 'true')  // Persist to localStorage
      return true

    } catch (syncError) {
      console.error('❌ [LIVE SYNC] Failed to start live sync:', syncError)
      syncStatus.value = 'error'
      error.value = (syncError as Error).message
      return false
    }
  }

  /**
   * Stop live sync
   */
  const stopLiveSync = async (): Promise<void> => {
    console.log('🛑 [LIVE SYNC] Stopping live sync...')

    if (syncHandler) {
      try {
        await syncHandler.cancel()
        syncHandler = null
        console.log('✅ [LIVE SYNC] Live sync stopped')
      } catch (e) {
        console.error('❌ [LIVE SYNC] Error stopping sync:', e)
      }
    } else {
      console.log('ℹ️ [LIVE SYNC] No active sync to stop')
    }

    syncStatus.value = 'idle'
  }

  /**
   * Check if live sync is active
   */
  const isLiveSyncActive = (): boolean => {
    return syncHandler !== null
  }

  /**
   * Cleanup function
   */
  const cleanup = async (): Promise<void> => {
    try {
      console.log('🧹 Cleaning up Reliable Sync Manager...')

      // Cancel sync
      if (syncHandler) {
        await syncHandler.cancel()
        syncHandler = null
      }

      // Cleanup network listeners
      if (networkCleanup) {
        networkCleanup()
        networkCleanup = null
      }

      // Clear Phase 2 systems - use type guards for optional methods
      if ('clearHistory' in conflictDetector && typeof (conflictDetector as { clearHistory?: () => void }).clearHistory === 'function') {
        (conflictDetector as { clearHistory: () => void }).clearHistory()
      }
      if ('clearHistory' in conflictResolver && typeof (conflictResolver as { clearHistory?: () => void }).clearHistory === 'function') {
        (conflictResolver as { clearHistory: () => void }).clearHistory()
      }
      if ('clearHistory' in retryManager && typeof (retryManager as { clearHistory?: () => void }).clearHistory === 'function') {
        (retryManager as { clearHistory: () => void }).clearHistory()
      }
      if ('clearQueue' in offlineQueue && typeof (offlineQueue as { clearQueue?: () => void }).clearQueue === 'function') {
        (offlineQueue as { clearQueue: () => void }).clearQueue()
      }
      if ('clearHistory' in syncValidator && typeof (syncValidator as { clearHistory?: () => void }).clearHistory === 'function') {
        (syncValidator as { clearHistory: () => void }).clearHistory()
      }

      // Reset state
      syncStatus.value = 'idle'
      error.value = null
      conflicts.value = []
      resolutions.value = []

      console.log('✅ Reliable Sync Manager cleaned up')
    } catch (cleanupError) {
      console.error('❌ Error during cleanup:', cleanupError instanceof Error ? cleanupError.message : 'Unknown error')
    }
  }

  // Note: Cleanup should be called manually by components that need it
  // onUnmounted(() => {
  //   cleanup()
  // })

  return {
    // Phase 1 returns (keep existing)
    syncStatus,
    error,
    lastSyncTime,
    pendingChanges,
    isOnline,
    remoteConnected,
    hasConnectedEver,  // Persistent flag for UI - true after first successful connection

    // BUG-025 FIX: Sync completion signal for App.vue initialization
    initialSyncComplete,
    waitForInitialSync,

    // BUG-054 FIX: Callback for when data is pulled from remote
    registerDataPulledCallback,

    // Computed properties for component usage
    isSyncing,
    hasErrors,

    // Phase 2 returns
    conflicts,
    resolutions,
    lastValidation,
    metrics,

    // Methods (Phase 1)
    init,
    triggerSync,
    clearSyncErrors,

    // Methods (Phase 2)
    manualConflictResolution,
    getSyncHealth,
    getSyncMetrics,
    getRetryStats,
    getOfflineQueueStats,
    pauseSync,
    resumeSync,
    toggleSync,
    throttledSync,
    cancelThrottledSync,

    // Live Sync (continuous real-time sync)
    startLiveSync,
    stopLiveSync,
    isLiveSyncActive,

    // Access to underlying systems for advanced usage
    conflictDetector,
    conflictResolver,
    retryManager,
    offlineQueue,
    syncValidator,
    timezoneManager,
    networkOptimizer,
    batchManager,
    logger,

    // Cleanup
    cleanup
  }
}

// Type for the sync manager instance (avoids circular ReturnType reference)
export interface ReliableSyncManagerInstance {
  // State refs
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
  isLiveSyncActive: () => boolean

  // BUG-025 FIX: Sync completion signal
  initialSyncComplete: Ref<boolean>
  waitForInitialSync: (timeoutMs?: number) => Promise<boolean>

  // BUG-054 FIX: Callback for when data is pulled
  registerDataPulledCallback: (callback: () => Promise<void> | void) => () => void

  // Computed properties
  isSyncing: ComputedRef<boolean>
  hasErrors: ComputedRef<boolean>

  // Methods
  init: () => Promise<(() => void) | null>
  triggerSync: () => Promise<void>
  clearSyncErrors: () => void
  manualConflictResolution: (conflictId: string, strategy: 'local' | 'remote' | 'merge') => Promise<void>
  getSyncHealth: () => SyncHealth
  getSyncMetrics: () => SyncMetrics
  getRetryStats: () => unknown
  getOfflineQueueStats: () => unknown
  pauseSync: () => void
  resumeSync: () => void
  toggleSync: () => void
  throttledSync: (priority?: 'low' | 'normal' | 'high') => Promise<void>
  cancelThrottledSync: () => void
  startLiveSync: () => Promise<boolean>
  stopLiveSync: () => void
  cleanup: () => Promise<void>
  configureProvider?: (config: unknown) => Promise<void>
  enableProvider?: () => Promise<void>
  disableProvider?: () => Promise<void>

  // Underlying systems (for advanced usage)
  conflictDetector: unknown
  conflictResolver: unknown
  retryManager: unknown
  offlineQueue: unknown
  syncValidator: unknown
  timezoneManager: unknown
  networkOptimizer: unknown
  batchManager: unknown
  logger: unknown
}

/**
 * Global reliable sync manager instance
 * Using window object to prevent Vite module duplication from creating multiple "singletons"
 */
declare global {
  interface Window {
    __pomoFlowSyncManager?: ReliableSyncManagerInstance
  }
}

// Fallback for SSR or non-browser environments
let fallbackSyncManager: ReliableSyncManagerInstance | null = null

/**
 * Get or create the global reliable sync manager instance
 * Uses window object to ensure true singleton across Vite chunks
 */
export const getGlobalReliableSyncManager = (): ReliableSyncManagerInstance => {
  // Use window for browser, fallback for SSR
  if (typeof window !== 'undefined') {
    if (!window.__pomoFlowSyncManager) {
      console.log('🔧 [SYNC MANAGER] Creating TRUE global singleton on window')
      window.__pomoFlowSyncManager = useReliableSyncManager() as ReliableSyncManagerInstance
    }
    return window.__pomoFlowSyncManager
  }

  // Fallback for non-browser environments
  if (!fallbackSyncManager) {
    fallbackSyncManager = useReliableSyncManager() as ReliableSyncManagerInstance
  }
  return fallbackSyncManager
}
