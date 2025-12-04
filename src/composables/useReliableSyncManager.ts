/**
 * Reliable Sync Manager - Phase 2 Implementation
 * Enhanced sync manager with conflict detection, resolution, retry logic, and validation
 */

import { ref, computed } from 'vue'
import PouchDB from 'pouchdb-browser'
import { ConflictDetector } from '@/utils/conflictDetector'
import { ConflictResolver } from '@/utils/conflictResolver'
import { RetryManager } from '@/utils/retryManager'
import { OfflineQueue } from '@/utils/offlineQueue'
import { SyncValidator } from '@/utils/syncValidator'
import { isSyncableDocument } from '@/composables/documentFilters'
import { getDatabaseConfig } from '@/config/database'
import { getBackupManager } from '@/utils/localBackupManager'
import { getTimezoneManager } from '@/utils/timezoneCompatibility'
import { getNetworkOptimizer } from '@/utils/networkOptimizer'
import { getBatchManager } from '@/utils/syncBatchManager'
import { getLogger } from '@/utils/productionLogger'
import type { ConflictInfo, ResolutionResult } from '@/types/conflicts'
import type { SyncValidationResult } from '@/utils/syncValidator'
import type { SyncMetadata } from '@/utils/timezoneCompatibility'

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
}

export const useReliableSyncManager = () => {
  const config = getDatabaseConfig()

  // Phase 1 reactive state (keep existing)
  const syncStatus = ref<SyncStatus>('idle')
  const error = ref<string | null>(null)
  const lastSyncTime = ref<Date | null>(null)
  const pendingChanges = ref(0)
  const isOnline = ref(navigator.onLine)
  const remoteConnected = ref(false)

  // Phase 2 reactive state
  const conflicts = ref<ConflictInfo[]>([])
  const resolutions = ref<ResolutionResult[]>([])
  const lastValidation = ref<SyncValidationResult | null>(null)
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
  let syncHandler: any | null = null

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
  const backupManager = getBackupManager({
    maxBackups: 5,
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    autoCleanup: true
  })

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

  /**
   * Initialize local PouchDB instance
   */
  const initializeLocalDatabase = (): PouchDB.Database => {
    try {
      if (localDB) {
        return localDB
      }

      localDB = new PouchDB(config.local.name, {
        adapter: config.local.adapter
      })

      console.log(`🗄️ ReliableSyncManager: Local PouchDB initialized: ${config.local.name}`)
      return localDB
    } catch (error) {
      console.error('❌ Failed to initialize local database:', error)
      throw new Error(`Local database initialization failed: ${(error as any)?.toString() || 'Unknown error'}`)
    }
  }

  /**
   * Setup remote PouchDB connection with error handling
   */
  const setupRemoteConnection = async (): Promise<PouchDB.Database | null> => {
    try {
      if (!config.remote?.url) {
        console.log('📱 ReliableSyncManager: No remote URL configured, using local-only mode')
        remoteConnected.value = false
        return null
      }

      const remoteOptions: PouchDB.Configuration.RemoteDatabaseConfiguration = {}

      if (config.remote.auth) {
        remoteOptions.auth = {
          username: config.remote.auth.username,
          password: config.remote.auth.password
        }
      }

      // Add timeout property if it exists in config
      const remoteConfig = config.remote as any
      const timeoutValue = remoteConfig.timeout || 30000
      ;(remoteOptions as any).timeout = timeoutValue
      remoteOptions.skip_setup = false

      remoteDB = new PouchDB(config.remote.url, remoteOptions)

      try {
        const info = await remoteDB.info()
        console.log(`🌐 ReliableSyncManager: Remote CouchDB connected: ${config.remote.url}`)
        console.log(`📊 Remote DB info:`, {
          name: info.db_name,
          doc_count: info.doc_count,
          update_seq: info.update_seq
        })
        remoteConnected.value = true
        return remoteDB
      } catch (connectionError) {
        console.warn('⚠️ Remote connection test failed:', connectionError)
        remoteConnected.value = false
        return remoteDB
      }
    } catch (error) {
      console.error('❌ Failed to setup remote connection:', (error as any)?.toString() || 'Unknown error')
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
      await conflictDetector.initialize(localDB!, remoteDB)

      // Update references in offline queue
      offlineQueue.updateReferences(localDB, retryManager)

      console.log('✅ Phase 2 systems initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize Phase 2 systems:', (error as any)?.toString() || 'Unknown error')
      throw error
    }
  }

  /**
   * Initialize sync with enhanced Phase 2 capabilities
   * SYNC RE-ENABLED: Safe after Phase 1 watcher fixes (Dec 2025)
   */
  const initializeSync = async (): Promise<void> => {
    console.log('🚀 [SYNC] Initializing sync system...')

    try {
      // Initialize the database connection
      localDB = await couchDBSync.initializeDatabase()
      remoteDB = await setupRemoteConnection()

      if (!remoteDB) {
        console.log('📱 No remote database available, running in offline mode')
        syncStatus.value = 'offline'
        return
      }

      // Initialize Phase 2 systems
      await initializePhase2Systems()

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
  const setupSyncEventHandlers = (handler: any) => {
    try {
      handler.on('change', (info: any) => {
        console.log(`📤 Reliable sync change:`, info)
        handleSyncChange(info)
      })

      handler.on('paused', (err: any) => {
        console.log(`⏸️ Sync paused:`, err)
        if (err) {
          error.value = `Sync paused: ${(err as any).message}`
        }
      })

      handler.on('active', () => {
        console.log(`▶️ Sync active`)
        syncStatus.value = 'syncing'
      })

      handler.on('complete', (info: any) => {
        console.log(`✅ Sync complete:`, info)
        if (syncStatus.value === 'syncing') {
          syncStatus.value = 'complete'
          lastSyncTime.value = new Date()
          metrics.value.lastSyncTime = new Date()
          metrics.value.successfulSyncs++
        }
      })

      handler.on('error', (err: any) => {
        console.error(`❌ Sync error:`, err)
        syncStatus.value = 'error'
        error.value = (err as any).message
        metrics.value.failedSyncs++
      })
    } catch (error) {
      console.error(`❌ Failed to setup sync event handlers:`, (error as any)?.toString() || 'Unknown error')
      throw error
    }
  }

  /**
   * Handle sync change events with conflict detection
   */
  const handleSyncChange = async (info: any) => {
    try {
      const docs = info.change?.docs || []
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
      pendingChanges.value = info.pending || 0

      // Emit custom event for UI components
      window.dispatchEvent(new CustomEvent('reliable-sync-change', {
        detail: {
          documentCount: syncableDocs.length,
          documents: syncableDocs,
          conflictsDetected: conflicts.value.length,
          timestamp: new Date()
        }
      }))
    } catch (error) {
      console.error(`❌ Error handling sync change:`, (error as any)?.toString() || 'Unknown error')
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
            // Try to put the resolved document first
            await localDB.put({
              ...resolution.resolvedDocument,
              _id: conflict.documentId,
              conflictResolvedAt: new Date().toISOString()
            })
          } catch (putError: any) {
            if (putError.status === 409) {
              // Document conflict - fetch latest revision and retry
              console.log(`🔄 Fetching latest revision for ${conflict.documentId}`)
              try {
                const latestDoc = await localDB.get(conflict.documentId)
                await localDB.put({
                  ...resolution.resolvedDocument,
                  _id: conflict.documentId,
                  _rev: latestDoc._rev, // Use latest revision
                  conflictResolvedAt: new Date().toISOString()
                })
                console.log(`✅ Conflict resolved for ${conflict.documentId} with latest revision`)
              } catch (fetchError) {
                console.error(`❌ Failed to fetch latest document for ${conflict.documentId}:`, fetchError)
                throw fetchError
              }
            } else {
              throw putError
            }
          }
        }

        metrics.value.conflictsResolved++
      } catch (error) {
        console.error(`❌ Failed to auto-resolve conflict for ${conflict.documentId}:`, (error as any)?.toString() || 'Unknown error')
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
      error.value = (syncError as any).message
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
        } as any)
      }
    }
  }

  /**
   * Perform reliable sync with all Phase 2 features
   * SYNC RE-ENABLED: Safe after Phase 1 watcher fixes (Dec 2025)
   */
  const performReliableSync = async (): Promise<void> => {
    console.log('🔄 [SYNC] Performing reliable sync...')

    const operationId = logger.startSyncOperation('full_sync')

    try {
      if (!localDB) {
        throw new Error('Local database not initialized')
      }

      logger.info('sync', 'Starting reliable sync with all Phase 3 features', {
        operationId,
        deviceInfo: timezoneManager.getDeviceInfo(),
        networkCondition: networkOptimizer.getMetrics().currentCondition
      })

      const remoteDB = await setupRemoteConnection()
      if (!remoteDB) {
        throw new Error('Remote database not available')
      }

      syncStatus.value = 'syncing'

      // Update sync operation
      ;(logger as any).updateSyncOperation(operationId, {
        type: 'full_sync',
        networkCondition: (networkOptimizer as any).getMetrics().currentCondition
      } as any)

      // Step 0: Create local backup before sync (data loss prevention)
      try {
        console.log('🔒 Step 0: Creating local backup before sync...')
        const backupId = await backupManager.createBackup('sync', 'Pre-sync backup')
        console.log(`✅ Backup created: ${backupId}`)
      } catch (backupError) {
        console.warn('⚠️ Failed to create pre-sync backup, continuing anyway:', backupError)
        // Continue with sync even if backup fails
      }

      // Step 1: Pre-sync validation
      try {
        console.log('🔍 Step 1: Validating data integrity before sync...')
        const preSyncDocs = await localDB!.allDocs({ include_docs: true })
        const preSyncValidation = await syncValidator.validateSync(
          preSyncDocs.rows.map(r => r.doc),
          []
        )

        // Check for critical issues before proceeding
        const preSyncErrors = preSyncValidation.issues.filter(i => i.severity === 'error')
        if (preSyncErrors.length > 0) {
          throw new Error(`Pre-sync validation failed: ${preSyncErrors.length} critical issues found. Sync aborted to prevent data corruption.`)
        }

        console.log(`✅ Pre-sync validation passed: ${preSyncValidation.validDocuments}/${preSyncValidation.totalValidated} documents valid`)
      } catch (validationError) {
        throw new Error(`Pre-sync validation failed: ${(validationError as Error).message}`)
      }

      // Step 2: Detect conflicts
      try {
        console.log('🔍 Step 2: Detecting conflicts...')
        const detectedConflicts = await conflictDetector.detectAllConflicts()
        conflicts.value = detectedConflicts
        metrics.value.conflictsDetected += detectedConflicts.length

        if (detectedConflicts.length > 0) {
          console.log(`⚠️ Detected ${detectedConflicts.length} conflicts, resolving...`)
          syncStatus.value = 'resolving_conflicts'
          await resolveAutoResolvableConflicts()
        }
      } catch (conflictError) {
        throw new Error(`Conflict detection failed: ${(conflictError as Error).message}`)
      }

      // Step 3: Perform sync
      try {
        console.log('🔄 Step 3: Performing bidirectional sync...')
        const syncResult = await localDB!.sync(remoteDB!, {
          live: false,
          retry: false,
          filter: isSyncableDocument
        })
      } catch (syncError) {
        throw new Error(`Sync operation failed: ${(syncError as Error).message}`)
      }

      // Step 4: Validate sync results
      try {
        console.log('🔍 Step 4: Validating sync integrity...')
        syncStatus.value = 'validating'

        const localDocs = await localDB!.allDocs({ include_docs: true })
        const remoteDocs = await remoteDB!.allDocs({ include_docs: true })

        const validation = await syncValidator.validateSync(
          localDocs.rows.map(r => r.doc),
          remoteDocs.rows.map(r => r.doc)
        )

        lastValidation.value = validation

        // Check validation results
        const errors = validation.issues.filter(i => i.severity === 'error')
        if (errors.length > 0) {
          throw new Error(`Sync validation failed: ${errors.length} critical issues found`)
        }

        console.log(`✅ Sync validated: ${validation.validDocuments}/${validation.totalValidated} documents valid`)
      } catch (validationError) {
        throw new Error(`Post-sync validation failed: ${(validationError as Error).message}`)
      }

      // Success - update metrics and status
      syncStatus.value = 'complete'
      lastSyncTime.value = new Date()
      metrics.value.lastSyncTime = new Date()
      metrics.value.successfulSyncs++

      // Complete sync operation logging
      ;(logger as any).completeSyncOperation(operationId, true)

      ;(logger as any).info('sync', 'Reliable sync completed successfully', {
        operationId,
        duration: Date.now() - Date.now(), // Temporary fix
        conflictsResolved: conflicts.value.length
      } as any)

    } catch (syncError) {
      console.error('❌ Reliable sync failed:', (syncError as any)?.toString() || 'Unknown error')

      // Log error
      logger.error('sync', 'Reliable sync failed', {
        operationId,
        error: (syncError as any).message,
        stack: (syncError as any).stack
      })

      // Complete sync operation with failure
      ;(logger as any).completeSyncOperation(operationId, false, (syncError as any).message)

      // Check if this is a critical error that requires data restoration
      const errorMessage = (syncError as any).message.toLowerCase()
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
          const backups = await backupManager.listBackups()
          const recentBackup = backups[0] // Most recent backup

          if (recentBackup) {
            const backupAge = Date.now() - recentBackup.timestamp.getTime()
            const backupAgeMinutes = backupAge / (1000 * 60)

            if (backupAgeMinutes < 30) { // Only consider backups less than 30 minutes old
              logger.warn('sync', `Recent backup found for potential restoration`, {
                backupId: recentBackup.id,
                backupAgeMinutes: backupAgeMinutes.toFixed(1),
                operationId
              })

              // Store backup info for potential manual restoration
              error.value = `${errorMessage || 'Unknown error'}. Recent backup available: ${(recentBackup as any)?.id || 'unknown'} (${backupAgeMinutes.toFixed(1)} minutes old)`
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
  const manualConflictResolution = async (conflictId: string, resolution: any): Promise<void> => {
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
      console.warn(`❌ Health check failed (${consecutiveHealthChecks}/${MAX_CONSECUTIVE_FAILURES}):`, (healthError as any)?.toString() || 'Unknown error')

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
    } catch (error) {
      console.error('❌ Failed to pause sync:', (error as any)?.toString() || 'Unknown error')
      throw error
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
    } catch (syncError) {
      console.error('❌ Failed to resume sync:', (syncError as any)?.toString() || 'Unknown error')
      syncStatus.value = 'error'
      error.value = (syncError as any).message || 'Unknown error'
      throw error
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
        } catch (error) {
          console.error('❌ Delayed sync failed:', (error as any)?.toString() || 'Unknown error')
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
      console.error('❌ Failed to initialize Reliable Sync Manager:', (initError as any)?.toString() || 'Unknown error')
      syncStatus.value = 'error'
      error.value = (initError as any).message || 'Unknown error'
      return null
    }
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

      // Clear Phase 2 systems
      ;(conflictDetector as any).clearHistory?.()
      ;(conflictResolver as any).clearHistory?.()
      ;(retryManager as any).clearHistory?.()
      ;(offlineQueue as any).clearQueue?.()
      ;(syncValidator as any).clearHistory?.()

      // Reset state
      syncStatus.value = 'idle'
      error.value = null
      conflicts.value = []
      resolutions.value = []

      console.log('✅ Reliable Sync Manager cleaned up')
    } catch (error) {
      console.error('❌ Error during cleanup:', (error as any)?.toString() || 'Unknown error')
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

/**
 * Global reliable sync manager instance
 */
let globalReliableSyncManager: ReturnType<typeof useReliableSyncManager> | null = null

/**
 * Get or create the global reliable sync manager instance
 */
export const getGlobalReliableSyncManager = () => {
  if (!globalReliableSyncManager) {
    globalReliableSyncManager = useReliableSyncManager()
  }
  return globalReliableSyncManager
}
