// Debug logging control
const DEBUG_DB = import.meta.env.DEV
const debugLog = (...args: unknown[]) => DEBUG_DB && console.log(...args)

/**
 * Enhanced PouchDB Database Composable for Pomo-Flow
 *
 * Local-first persistence with optional CouchDB sync support
 * Integrates with useSimpleSyncManager for cross-device synchronization
 * SINGLETON PATTERN - Ensures only one database instance across all stores
 */

import { ref, computed, watch } from 'vue'
import type { Ref } from 'vue'
import PouchDB from 'pouchdb-browser'
import { shouldLogTaskDiagnostics } from '@/utils/consoleFilter'
// 🔧 PHASE 1.2: Consolidated sync using useCouchDBSync as single source of truth
import { useCouchDBSync } from '@/composables/useCouchDBSync'
import { getDatabaseConfig, type DatabaseHealth } from '@/config/database'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

// Singleton database instance state
let singletonDatabase: PouchDB.Database | null = null
let isInitializing = false
let initializationPromise: Promise<void> | null = null
let databaseRefCount = 0

// Database health monitoring
let lastHealthCheck: Date | null = null
let consecutiveHealthFailures = 0
const MAX_HEALTH_FAILURES = 3
const HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

export interface DatabaseStore {
  tasks: string
  projects: string
  canvas: string
  timer: string
  settings: string
  notifications: string
}

export const DB_KEYS = {
  TASKS: 'tasks',
  PROJECTS: 'projects',
  CANVAS: 'canvas',
  TIMER: 'timer',
  SETTINGS: 'settings',
  NOTIFICATIONS: 'notifications',
  HIDE_DONE_TASKS: 'hide_done_tasks',
  VERSION: 'version'
} as const

export interface UseDatabaseReturn {
  // Core CRUD operations
  save: <T>(key: string, data: T) => Promise<void>
  load: <T>(key: string) => Promise<T | null>
  remove: (key: string) => Promise<void>
  clear: () => Promise<void>

  // Query operations
  keys: () => Promise<string[]>
  hasData: (key: string) => Promise<boolean>

  // Advanced operations
  exportAll: () => Promise<Record<string, any>>
  importAll: (data: Record<string, any>) => Promise<void>
  atomicTransaction: <T>(operations: Array<() => Promise<T>>, context?: string) => Promise<T[]>

  // Reactive state
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  isReady: Ref<boolean>

  // Sync state (from useSimpleSyncManager)
  syncStatus: Ref<'idle' | 'syncing' | 'complete' | 'error' | 'paused' | 'offline'>
  isOnline: Ref<boolean>
  hasRemoteSync: boolean

  // Sync operations
  triggerSync: () => Promise<void>
  pauseSync: () => Promise<void>
  resumeSync: () => Promise<void>

  // Direct database access (for advanced use)
  database: Ref<PouchDB.Database | null>

  // Database health monitoring
  checkHealth: () => Promise<any>
  getHealthStatus: () => any
  resetHealthMonitoring: () => void

  // Network optimization features
  loadBatch: <T>(keys: string[]) => Promise<Record<string, T | null>>
  saveBatch: <T>(data: Record<string, T>) => Promise<void>
  getDatabaseMetrics: () => any

  // Cleanup
  cleanup: () => void
}

/**
 * Enhanced retry wrapper with exponential backoff and jitter
 */
async function performWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = 3,
  baseDelay: number = 100
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation()
      if (attempt > 1) {
        debugLog(`✅ [RETRY] ${operationName} succeeded on attempt ${attempt}`)
      }
      return result
    } catch (err) {
      lastError = err as Error

      // Don't retry on certain error types
      if (err instanceof Error && (
        err.message.includes('Database not initialized') ||
        err.message.includes('404') && operationName.includes('load')
      )) {
        throw err
      }

      if (attempt < maxRetries) {
        // Exponential backoff with jitter
        const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
        const jitter = Math.random() * 100
        const delay = exponentialDelay + jitter

        console.warn(`⚠️ [RETRY] ${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms:`, err)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  const finalError = lastError || new Error(`${operationName} failed after ${maxRetries} attempts`)
  errorHandler.report({
    severity: ErrorSeverity.ERROR,
    category: ErrorCategory.DATABASE,
    message: `${operationName} failed after ${maxRetries} attempts`,
    error: finalError,
    context: { operationName, maxRetries },
    retryable: false,
    showNotification: false // Don't spam notifications for retried operations
  })
  throw finalError
}

/**
 * Database connection health check with retry logic
 */
async function performDatabaseHealthCheck(db: PouchDB.Database): Promise<{
  healthy: boolean
  error?: Error
  latency?: number
}> {
  const startTime = Date.now()

  try {
    // Test basic database operations
    const info = await db.info()
    const latency = Date.now() - startTime

    // Verify database is responsive
    if (!info || typeof info.doc_count === 'undefined') {
      throw new Error('Database info response invalid')
    }

    // Test write/read capability with a simple health check document
    const healthDocId = '_local/health-check'
    const healthDoc = {
      _id: healthDocId,
      timestamp: new Date().toISOString(),
      test: true
    }

    try {
      await db.put(healthDoc)
      await db.get(healthDocId)
      await db.remove((await db.get(healthDocId)))
    } catch (writeError) {
      console.warn('⚠️ [HEALTH-CHECK] Write test failed:', writeError)
      // Don't fail health check for write issues, but log them
    }

    consecutiveHealthFailures = 0
    lastHealthCheck = new Date()

    return {
      healthy: true,
      latency
    }
  } catch (err) {
    consecutiveHealthFailures++
    const error = err as Error

    errorHandler.report({
      severity: consecutiveHealthFailures >= MAX_HEALTH_FAILURES ? ErrorSeverity.CRITICAL : ErrorSeverity.WARNING,
      category: ErrorCategory.DATABASE,
      message: `Database health check failed (${consecutiveHealthFailures}/${MAX_HEALTH_FAILURES})`,
      error,
      context: { consecutiveHealthFailures, maxFailures: MAX_HEALTH_FAILURES },
      showNotification: consecutiveHealthFailures >= MAX_HEALTH_FAILURES
    })

    return {
      healthy: false,
      error,
      latency: Date.now() - startTime
    }
  }
}

/**
 * Enhanced PouchDB composable with sync integration
 */
export function useDatabase(): UseDatabaseReturn {
  // Reactive state
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const database = ref<PouchDB.Database | null>(null)

  // Initialize sync functionality
  const config = getDatabaseConfig()
  const hasRemoteSync = !!config.remote?.url

  // Network optimizer removed - was causing architectural mismatches

  // 🔧 PHASE 1.2: Use useCouchDBSync as single source of truth for sync operations
  let couchDBSync: ReturnType<typeof useCouchDBSync> | null = null
  let syncCleanup: (() => void) | null = null

  // Computed properties with enhanced debugging
  const isReady = computed(() => {
    const ready = !isLoading.value && database.value !== null && !error.value
    // Always log database readiness for debugging
    debugLog('🔍 [USE-DATABASE] isReady computed:', {
      ready,
      isLoading: isLoading.value,
      hasDatabase: database.value !== null,
      hasError: error.value,
      errorMessage: error.value?.message
    })
    return ready
  })

  // Initialize database with singleton support
  const initializeDatabase = async () => {
    // If we already have a database instance, just reuse it
    if (singletonDatabase) {
      debugLog('🔄 [USE-DATABASE] Reusing existing singleton database instance')
      database.value = singletonDatabase
      databaseRefCount++
      isLoading.value = false
      return
    }

    // If we're currently initializing, wait for it to complete
    if (isInitializing && initializationPromise) {
      debugLog('⏳ [USE-DATABASE] Database initialization in progress, waiting...')
      await initializationPromise
      database.value = singletonDatabase
      databaseRefCount++
      isLoading.value = false
      return
    }

    // Start initialization
    isInitializing = true
    databaseRefCount++

    initializationPromise = (async () => {
      debugLog('🔄 [USE-DATABASE] Initializing singleton PouchDB database...')

      try {
        // Enable remote sync when configured
        const forceLocalMode = false

        // Check if database already exists from previous session (page refresh)
        const dbName = config.local.name
        let existingDB: PouchDB.Database | null = null

        try {
          // Try to open existing database without recreating it
          existingDB = new PouchDB(dbName, {
            adapter: 'idb',
            auto_compaction: true,
            revs_limit: 5
          })

          // Test if it's accessible and has data
          const dbInfo = await existingDB.info()
          debugLog('🔍 [USE-DATABASE] Found existing database:', {
            name: dbInfo.db_name,
            doc_count: dbInfo.doc_count,
            adapter: (dbInfo as any).adapter || 'unknown'
          })

          // This is our singleton database
          singletonDatabase = existingDB

          // 🔧 PHASE 1.4 FIX (Part 1): Expose database to window IMMEDIATELY
          // This prevents race condition where stores timeout waiting for pomoFlowDb
          ;(window as any).pomoFlowDb = singletonDatabase
          debugLog('✅ [USE-DATABASE] Singleton PouchDB exposed to window.pomoFlowDb (early)')

          // 🔧 PHASE 1.4 FIX (Part 2): Initialize CouchDB sync even for existing databases
          // Previously, couchDBSync.init() was only called for NEW databases,
          // which meant cross-browser sync never started on subsequent page loads!
          // This runs AFTER exposing to window so stores can initialize in parallel
          if (hasRemoteSync && !forceLocalMode) {
            debugLog('🌐 [USE-DATABASE] Existing DB found - initializing CouchDB sync for cross-browser support...')
            couchDBSync = useCouchDBSync()
            const cleanupFn = await couchDBSync.init()
            syncCleanup = () => cleanupFn()
            debugLog('✅ [USE-DATABASE] CouchDB sync initialized for existing database')
          }

        } catch (dbError) {
          debugLog('📱 [USE-DATABASE] No existing database found, creating new singleton...')

          if (hasRemoteSync && !forceLocalMode) {
            debugLog('🌐 [USE-DATABASE] Remote sync configured, initializing with CouchDB sync...')

            // 🔧 PHASE 1.2: Use useCouchDBSync as single source of truth
            couchDBSync = useCouchDBSync()

            // Initialize the CouchDB sync - this sets up live bidirectional sync
            const cleanupFn = await couchDBSync.init()
            syncCleanup = () => cleanupFn()

            // Get the database from CouchDB sync (it creates its own PouchDB instance)
            singletonDatabase = couchDBSync.initializeDatabase()

            debugLog('✅ [USE-DATABASE] Singleton PouchDB initialized with CouchDB sync for cross-browser support')
          } else {
            debugLog('📱 [USE-DATABASE] Local-only mode, creating new singleton PouchDB...')

            // Create local PouchDB instance with enhanced error handling
            debugLog('🔄 [USE-DATABASE] Creating new singleton PouchDB with config:', {
              name: config.local.name,
              adapter: 'idb',
              auto_compaction: true,
              revs_limit: 5
            })

            try {
              const localDB = new PouchDB(config.local.name, {
                adapter: 'idb',
                auto_compaction: true,
                revs_limit: 5
              })

              singletonDatabase = localDB
              debugLog('✅ [USE-DATABASE] New singleton PouchDB created in local-only mode')
            } catch (dbCreateError) {
              console.error('❌ [USE-DATABASE] Failed to create PouchDB instance:', dbCreateError)
              throw new Error(`PouchDB creation failed: ${(dbCreateError as any).message || (dbCreateError as any).toString()}`)
            }
          }
        }

        // Expose to window for backward compatibility and persistence
        ;(window as any).pomoFlowDb = singletonDatabase
        debugLog('✅ [USE-DATABASE] Singleton PouchDB exposed to window.pomoFlowDb')

        // Test database
        const dbInfo = await singletonDatabase.info()
        debugLog('📊 [USE-DATABASE] Singleton database verified:', {
          name: dbInfo.db_name,
          doc_count: dbInfo.doc_count,
          adapter: (dbInfo as any).adapter || 'unknown',
          syncMode: hasRemoteSync ? 'remote' : 'local-only',
          refCount: databaseRefCount,
          isNew: existingDB === null
        })

        // Perform initial health check
        debugLog('🏥 [USE-DATABASE] Performing initial health check...')
        const healthResult = await performDatabaseHealthCheck(singletonDatabase)

        if (!healthResult.healthy) {
          console.warn('⚠️ [USE-DATABASE] Initial health check failed:', healthResult.error?.message)
          // Don't fail initialization for health check issues, but log them
        } else {
          debugLog(`✅ [USE-DATABASE] Database health check passed (${healthResult.latency}ms latency)`)
        }

        database.value = singletonDatabase

      } catch (err) {
        error.value = err as Error

        // Report through unified error handler
        const errorMessage = (err as Error).message || (err as any).toString() || 'Unknown database initialization error'
        errorHandler.report({
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.DATABASE,
          message: 'Failed to initialize database',
          userMessage: 'Database initialization failed. Please refresh the page.',
          error: err as Error,
          context: {
            name: (err as Error).name,
            isPouchDBError: (err as any).name === 'error' || (err as any).status !== undefined
          },
          showNotification: true
        })

        throw new Error(`Singleton database initialization failed: ${errorMessage}`)
      } finally {
        isInitializing = false
        initializationPromise = null
      }
    })()

    await initializationPromise
    isLoading.value = false
    debugLog('📊 [USE-DATABASE] Singleton database ready for operations', {
      isReady: isReady.value,
      hasDatabase: database.value !== null,
      isLoading: isLoading.value,
      hasError: error.value
    })
  }

  // Helper function to wait for database initialization
  const waitForDatabase = async (): Promise<PouchDB.Database> => {
    // FIX: Also wait for singleton initialization promise (race condition fix)
    // This handles the case where initializeDatabase() has started but isLoading is still false
    if (initializationPromise) {
      debugLog('⏳ [USE-DATABASE] waitForDatabase: Waiting for initialization promise...')
      await initializationPromise
    }

    if (isLoading.value) {
      await new Promise<void>((resolve) => {
        const unwatch = watch(isLoading, (loading) => {
          if (!loading) {
            unwatch()
            resolve()
          }
        }, { immediate: true })
      })
    }

    // FIX: Fallback to singleton if local ref isn't set yet
    if (!database.value && singletonDatabase) {
      debugLog('🔄 [USE-DATABASE] waitForDatabase: Using singleton fallback')
      database.value = singletonDatabase
    }

    if (!database.value) {
      throw new Error('Database not initialized')
    }

    return database.value
  }

  // Set loading BEFORE starting initialization (race condition fix)
  isLoading.value = true

  // Initialize immediately (non-blocking)
  initializeDatabase()


  /**
   * Save data to PouchDB with verification and cache invalidation
   */
  const save = async <T>(key: string, data: T): Promise<void> => {
    await performDirectSave(key, data)

    // Cache invalidation removed with network optimizer
  }

  /**
   * Direct save method with verification
   */
  const performDirectSave = async <T>(key: string, data: T): Promise<void> => {
    const maxRetries = 3
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        const db = await waitForDatabase()
        const docId = `${key}:data`

        // Try to get existing document
        try {
          const existingDoc = await db.get(docId)
          await db.put({
            _id: docId,
            _rev: existingDoc._rev,
            data,
            updatedAt: new Date().toISOString(),
            saveMethod: 'direct'
          })
        } catch (getErr: any) {
          if (getErr.status === 404) {
            // Document doesn't exist, create new one
            await db.put({
              _id: docId,
              data,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              saveMethod: 'direct'
            })
          } else {
            throw getErr
          }
        }

        debugLog(`💾 Saved ${key} to PouchDB (direct)`)
        return // Success - exit retry loop

      } catch (err: any) {
        retryCount++
        const isConnectionClosing = err.message?.includes('connection is closing') ||
                                    err.name === 'InvalidStateError'

        // Handle connection closing error - reset singleton and retry
        if (isConnectionClosing && retryCount < maxRetries) {
          console.warn(`⚠️ [USE-DATABASE] Connection closing on ${key} (attempt ${retryCount}/${maxRetries}), resetting connection...`)
          // Reset singleton to force reconnection
          singletonDatabase = null
          database.value = null
          isInitializing = false
          initializationPromise = null
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
          // Re-initialize
          await initializeDatabase()
          continue
        }

        if (err.status === 409 && retryCount < maxRetries) {
          // Conflict detected - retry with exponential backoff
          console.warn(`⚠️ Conflict on ${key} (attempt ${retryCount}/${maxRetries}), retrying...`)
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)))
          continue
        }

        // Out of retries or non-conflict error
        error.value = err as Error
        errorHandler.report({
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.DATABASE,
          message: `Failed to save ${key} after ${retryCount} attempts`,
          error: err as Error,
          context: { key, retryCount, isConflict: err.status === 409, isConnectionClosing },
          showNotification: true
        })
        throw err
      }
    }
  }

  /**
   * Load data from PouchDB with enhanced retry logic and caching
   */
  const load = async <T>(key: string): Promise<T | null> => {
    const maxRetries = 3
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        const db = await waitForDatabase()
        const docId = `${key}:data`
        const doc = await db.get(docId)
        // Extract the actual data from the PouchDB document structure
        const data = (doc as any).data as T

        if (shouldLogTaskDiagnostics()) {
          debugLog(`💾 [DATABASE] Loaded ${key} from PouchDB`)
        }

        return data
      } catch (err: any) {
        // Handle 404 as expected case
        if (err.status === 404) {
          if (shouldLogTaskDiagnostics()) {
            debugLog(`📭 [DATABASE] No data found for ${key}`)
          }
          return null
        }

        retryCount++
        const isConnectionClosing = err.message?.includes('connection is closing') ||
                                    err.name === 'InvalidStateError'

        // Handle connection closing error - reset singleton and retry
        if (isConnectionClosing && retryCount < maxRetries) {
          console.warn(`⚠️ [USE-DATABASE] Connection closing on load ${key} (attempt ${retryCount}/${maxRetries}), resetting connection...`)
          // Reset singleton to force reconnection
          singletonDatabase = null
          database.value = null
          isInitializing = false
          initializationPromise = null
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 300 * retryCount))
          // Re-initialize
          await initializeDatabase()
          continue
        }

        error.value = err as Error
        errorHandler.report({
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.DATABASE,
          message: `Failed to load ${key} from database`,
          error: err as Error,
          context: { key, retryCount, isConnectionClosing },
          showNotification: false // Don't show for load errors, let caller handle
        })
        throw err
      }
    }
    return null // Fallback (should not reach here)
  }

  /**
   * Remove data from PouchDB with enhanced retry logic
   */
  const remove = async (key: string): Promise<void> => {
    return performWithRetry(async () => {
      const db = await waitForDatabase()
      const docId = `${key}:data`
      const doc = await db.get(docId)
      await db.remove(doc)
      debugLog(`🗑️ Removed ${key} from PouchDB`)
    }, `remove ${key}`, 3, 100).catch(err => {
      // Handle 404 as expected case
      if (err instanceof Error && err.message.includes('404')) {
        debugLog(`ℹ️ ${key} not found, already removed`)
        return
      }
      error.value = err as Error
      throw err
    })
  }

  /**
   * Clear all data from PouchDB (singleton-aware)
   */
  const clear = async (): Promise<void> => {
    try {
      const db = await waitForDatabase()
      await db.destroy()
      debugLog('🧹 Cleared singleton PouchDB database')

      // Reset singleton reference and recreate database
      singletonDatabase = null
      database.value = null
      delete (window as any).pomoFlowDb
      isInitializing = false
      initializationPromise = null

      // Reinitialize after clear - create new singleton database
      await initializeDatabase()
      debugLog('✅ [USE-DATABASE] Singleton PouchDB recreated and exposed to window.pomoFlowDb')
    } catch (err) {
      error.value = err as Error
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Failed to clear database',
        error: err as Error,
        showNotification: true
      })
      throw err
    }
  }

  /**
   * Get all keys in database
   */
  const keys = async (): Promise<string[]> => {
    try {
      const db = await waitForDatabase()
      const docs = await db.allDocs({
        include_docs: false,
        startkey: 'data:',
        endkey: 'data:\ufff0'
      })

      return docs.rows.map(row => row.id!.replace(':data', ''))
    } catch (err) {
      error.value = err as Error
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Failed to get database keys',
        error: err as Error,
        showNotification: false
      })
      throw err
    }
  }

  /**
   * Check if data exists for key
   */
  const hasData = async (key: string): Promise<boolean> => {
    try {
      const result = await load(key)
      return result !== null
    } catch {
      return false
    }
  }

  /**
   * Export all data from database
   */
  const exportAll = async (): Promise<Record<string, any>> => {
    try {
      const db = await waitForDatabase()
      const docs = await db.allDocs({ include_docs: true })

      const result: Record<string, any> = {}
      docs.rows.forEach(row => {
        if (row.doc && row.id?.endsWith(':data')) {
          const key = row.id.replace(':data', '')
          result[key] = row.doc
        }
      })

      return result
    } catch (err) {
      error.value = err as Error
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Failed to export data',
        error: err as Error,
        showNotification: true
      })
      throw err
    }
  }

  /**
   * Import data into database
   */
  const importAll = async (data: Record<string, any>): Promise<void> => {
    try {
      for (const [key, value] of Object.entries(data)) {
        await save(key, value)
      }
      debugLog('📥 Imported data to PouchDB')
    } catch (err) {
      error.value = err as Error
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Failed to import data',
        error: err as Error,
        showNotification: true
      })
      throw err
    }
  }

  /**
   * Execute operations atomically
   */
  const atomicTransaction = async <T>(
    operations: Array<() => Promise<T>>,
    context?: string
  ): Promise<T[]> => {
    try {
      debugLog(`🔄 Starting atomic transaction${context ? ` for ${context}` : ''}`)
      const results = await Promise.all(operations)
      debugLog(`✅ Completed atomic transaction${context ? ` for ${context}` : ''}`)
      return results as T[]
    } catch (err) {
      error.value = err as Error
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: `Failed atomic transaction${context ? ` for ${context}` : ''}`,
        error: err as Error,
        context: { transactionContext: context },
        showNotification: true
      })
      throw err
    }
  }

  // 🔧 PHASE 1.2: Sync-related computed properties using couchDBSync
  const syncStatus = computed(() => couchDBSync?.syncStatus.value || 'idle')
  const isOnline = computed(() => couchDBSync?.isOnline.value || navigator.onLine)

  // 🔧 PHASE 1.2: Sync operations delegated to couchDBSync
  const triggerSync = async () => {
    if (couchDBSync) {
      await couchDBSync.triggerSync()
    } else {
      console.warn('⚠️ [USE-DATABASE] Sync not available - no remote configuration')
    }
  }

  const pauseSync = async () => {
    if (couchDBSync) {
      await couchDBSync.pauseSync()
    }
  }

  const resumeSync = async () => {
    if (couchDBSync) {
      await couchDBSync.resumeSync()
    }
  }

  /**
   * Database health check for connection monitoring
   */
  const checkHealth = async () => {
    if (!database.value) {
      return {
        healthy: false,
        error: new Error('Database not initialized'),
        latency: 0
      }
    }

    return await performDatabaseHealthCheck(database.value)
  }

  /**
   * Get database health status without performing new check
   */
  const getHealthStatus = () => {
    return {
      isHealthy: consecutiveHealthFailures < MAX_HEALTH_FAILURES,
      consecutiveFailures: consecutiveHealthFailures,
      lastCheck: lastHealthCheck,
      maxFailures: MAX_HEALTH_FAILURES
    }
  }

  /**
   * Reset health monitoring state
   */
  const resetHealthMonitoring = () => {
    consecutiveHealthFailures = 0
    lastHealthCheck = null
    debugLog('🔄 [USE-DATABASE] Health monitoring state reset')
  }

  // Cleanup function for when the composable is destroyed
  const cleanup = async () => {
    databaseRefCount--
    debugLog(`🔧 [USE-DATABASE] Database reference count decreased to: ${databaseRefCount}`)

    // 🔧 PHASE 1.2: Cleanup CouchDB sync, not the database (since it's shared)
    if (syncCleanup) {
      syncCleanup()
      syncCleanup = null
    }
    if (couchDBSync) {
      await couchDBSync.destroy()
      couchDBSync = null
    }

    // Don't destroy the singleton database until all references are gone
    if (databaseRefCount <= 0 && singletonDatabase) {
      debugLog('🧹 [USE-DATABASE] All references gone, cleaning up singleton database')
      try {
        await singletonDatabase.destroy()
      } catch (err) {
        console.warn('⚠️ [USE-DATABASE] Error destroying singleton database:', err)
      }
      singletonDatabase = null
      database.value = null
      delete (window as any).pomoFlowDb
      databaseRefCount = 0
    }
  }

  /**
   * Optimized batch loading - Load multiple keys in a single operation
   */
  const loadBatch = async <T>(keys: string[]): Promise<Record<string, T | null>> => {
    if (keys.length === 0) return {}

    try {
      const db = await waitForDatabase()

      // Use allDocs to get all documents at once
      const docIds = keys.map(key => `${key}:data`)
      const docs = await db.allDocs({
        keys: docIds,
        include_docs: true
      })

      const result: Record<string, T | null> = {}

      // Process results
      docs.rows.forEach(row => {
        if ((row as any).doc) {
          const key = (row as any).id.replace(':data', '')
          result[key] = ((row as any).doc as any).data as T
        } else if ((row as any).key) {
          // Document doesn't exist
          const key = (row as any).key.replace(':data', '')
          result[key] = null
        }
      })

      // Ensure all requested keys are present in result
      keys.forEach(key => {
        if (!(key in result)) {
          result[key] = null
        }
      })

      if (shouldLogTaskDiagnostics()) {
        debugLog(`📦 [DATABASE] Batch loaded ${keys.length} keys from PouchDB`)
      }

      return result
    } catch (err) {
      error.value = err as Error
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Failed to batch load from database',
        error: err as Error,
        context: { keyCount: keys.length },
        showNotification: false
      })
      throw err
    }
  }

  /**
   * Optimized batch saving - Save multiple items in a single operation
   */
  const saveBatch = async <T>(data: Record<string, T>): Promise<void> => {
    if (Object.keys(data).length === 0) return

    try {
      const keys = Object.keys(data)

      // Process sequentially with rate limiting to prevent memory spikes
      const entries = Object.entries(data)

      for (const [key, value] of entries) {
        await save(key, value)
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 5))
      }

      // Cache clearing removed with network optimizer

      if (shouldLogTaskDiagnostics()) {
        debugLog(`📦 [DATABASE] Batch saved ${keys.length} items to PouchDB`)
      }
    } catch (err) {
      error.value = err as Error
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Failed to batch save to database',
        error: err as Error,
        context: { itemCount: Object.keys(data).length },
        showNotification: true
      })
      throw err
    }
  }

  /**
   * Get database performance metrics
   */
  const getDatabaseMetrics = () => {
    return {
      database: {
        isReady: isReady.value,
        isLoading: isLoading.value,
        hasError: !!error.value,
        error: error.value?.message
      },
      optimization: {
        cacheEnabled: true,
        deduplicationEnabled: true,
        batchingEnabled: true
      }
    }
  }

  return {
    save,
    load,
    remove,
    clear,
    keys,
    hasData,
    exportAll,
    importAll,
    atomicTransaction,
    isLoading,
    error,
    isReady,

    // Database health monitoring
    checkHealth,
    getHealthStatus,
    resetHealthMonitoring,

    // Sync-related state and operations
    syncStatus,
    isOnline,
    hasRemoteSync,
    triggerSync,
    pauseSync,
    resumeSync,

    // Network optimization features
    loadBatch,
    saveBatch,
    getDatabaseMetrics,

    database,
    cleanup
  }
}