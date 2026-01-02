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
import { getGlobalReliableSyncManager } from '@/composables/useReliableSyncManager'

import { getDatabaseConfig, type DatabaseHealth as _DatabaseHealth } from '@/config/database'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import { isQuotaExceededError, checkStorageQuota } from '@/utils/storageQuotaMonitor'
import { detectGlobalDatabaseFailure, resetGlobalFailureCount } from '@/composables/useDatabaseHealthCheck'

// Singleton database instance state
let singletonDatabase: PouchDB.Database | null = null
let isInitializing = false
let initializationPromise: Promise<void> | null = null
let databaseRefCount = 0
let hasRunAutoPrune = false // Singleton guard for auto-prune

/**
 * BUG-057 FIX: Reset database singleton when connection is closed
 * Firefox/Zen browser can close IndexedDB when memory runs out
 * This allows automatic recovery by creating a fresh database instance
 */
export function resetDatabaseSingleton(): void {
  console.log('🔄 [DATABASE] Resetting database singleton due to closed connection')
  if (singletonDatabase) {
    try {
      // Don't await - just try to close if possible
      singletonDatabase.close()
    } catch {
      // Ignore errors during close
    }
  }
  singletonDatabase = null
  isInitializing = false
  initializationPromise = null
}

/**
 * BUG-057 FIX: Check if error is a closed database error
 */
function isDatabaseClosedError(err: unknown): boolean {
  if (err instanceof Error) {
    const message = err.message.toLowerCase()
    return message.includes('closed database') ||
      message.includes('transaction on a closed') ||
      message.includes('not, or is no longer, usable')
  }
  return false
}

// Database health monitoring
let lastHealthCheck: Date | null = null
let consecutiveHealthFailures = 0
const MAX_HEALTH_FAILURES = 3
const _HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

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
  CANVAS_VIEWPORT: 'canvas_viewport', // TASK-072: Persist viewport position across refreshes
  TIMER: 'timer',
  SETTINGS: 'settings',
  NOTIFICATIONS: 'notifications',
  HIDE_DONE_TASKS: 'hide_done_tasks',
  VERSION: 'version',
  // BUG-025: Timer session key for consistency
  TIMER_SESSION: 'pomo-flow-timer-session',
  // BUG-025 P4: New keys for cross-device sync (migrated from localStorage)
  QUICK_SORT_SESSIONS: 'quick_sort_sessions',
  FILTER_STATE: 'filter_state',
  KANBAN_SETTINGS: 'kanban_settings'
} as const

// Conflict detection state for data safety monitoring
export interface DetectedConflict {
  docId: string
  count: number
  revisions: string[]
  detectedAt: Date
}

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
  exportAll: () => Promise<Record<string, unknown>>
  importAll: (data: Record<string, unknown>) => Promise<void>
  atomicTransaction: <T>(operations: Array<() => Promise<T>>, context?: string) => Promise<T[]>

  // Reactive state
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  isReady: Ref<boolean>

  // Conflict detection and pruning (data safety)
  detectedConflicts: Ref<DetectedConflict[]>
  conflictCount: Ref<number>
  clearConflicts: () => void
  pruneConflicts: (key: string) => Promise<{ resolved: number; failed: number }>
  autoPruneBacklog: () => Promise<Record<string, { resolved: number; failed: number }>>

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
  checkHealth: () => Promise<unknown>
  getHealthStatus: () => unknown
  resetHealthMonitoring: () => void

  // Network optimization features
  loadBatch: <T>(keys: string[]) => Promise<Record<string, T | null>>
  saveBatch: <T>(data: Record<string, T>) => Promise<void>
  getDatabaseMetrics: () => unknown

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
        console.log(`✅ [RETRY] ${operationName} succeeded on attempt ${attempt}`)
      }
      return result
    } catch (err) {
      lastError = err as Error

      // BUG-057 FIX: Detect global database failures (Firefox OOM, closed database, etc.)
      // After MAX_GLOBAL_FAILURES, this will auto-nuke and reload
      if (detectGlobalDatabaseFailure(err)) {
        // Will trigger page reload - don't continue retrying
        throw err
      }

      // BUG-057 FIX: If database is closed (Firefox OOM), reset singleton and retry
      if (isDatabaseClosedError(err)) {
        console.warn(`⚠️ [RETRY] Database closed detected in ${operationName}, resetting singleton...`)
        resetDatabaseSingleton()
        // Don't throw - let it retry with fresh database
      }

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
      const healthCheckDoc = await db.get(healthDocId)
      await db.remove(healthCheckDoc)
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

  // Conflict detection state (data safety)
  const detectedConflicts = ref<DetectedConflict[]>([])
  const conflictCount = computed(() => detectedConflicts.value.length)
  const clearConflicts = () => {
    detectedConflicts.value = []
  }

  // Initialize sync functionality
  const config = getDatabaseConfig()
  const hasRemoteSync = !!config.remote?.url

  // Network optimizer removed - was causing architectural mismatches

  let syncManager: ReturnType<typeof getGlobalReliableSyncManager> | null = null
  let syncCleanup: (() => void) | null = null

  // Computed properties
  const isReady = computed(() => {
    return !isLoading.value && database.value !== null && !error.value
  })

  // Initialize database with singleton support
  const initializeDatabase = async () => {
    // STARTING INITIALIZATION: Set loading immediately to block concurrent calls
    if (isLoading.value) return
    isLoading.value = true

    // If we already have a database instance, just reuse it
    if (singletonDatabase) {
      database.value = singletonDatabase
      isLoading.value = false
      return
    }

    // If we're currently initializing, wait for it to complete
    if (isInitializing && initializationPromise) {
      try {
        await initializationPromise
        database.value = singletonDatabase
      } finally {
        isLoading.value = false
      }
      return
    }

    // Start initialization
    isInitializing = true

    initializationPromise = (async () => {
      try {
        const config = getDatabaseConfig()
        const hasRemoteSync = !!config.remote?.url
        const forceLocalMode = false

        const dbName = config.local.name

        // BUG-056: Auto-recovery for corrupted IndexedDB
        const createDatabase = async (retryAfterDelete = false): Promise<PouchDB.Database> => {
          try {
            const db = new PouchDB(dbName, {
              adapter: 'idb',
              auto_compaction: true,
              revs_limit: 5
            })
            await db.info() // Test the connection
            return db
          } catch (dbError) {
            const errorMessage = (dbError as Error).message || String(dbError)
            const errorName = (dbError as Error).name || ''

            // Detect corrupted IndexedDB errors
            const isCorruptedDB =
              errorName === 'NotFoundError' ||
              errorMessage.includes('NotFoundError') ||
              errorMessage.includes('object store did not exist') ||
              errorMessage.includes('database object could not be found')

            if (isCorruptedDB && !retryAfterDelete) {
              console.warn('⚠️ [DATABASE] Corrupted IndexedDB detected - attempting auto-recovery...')

              // Try to delete the corrupted database
              try {
                await new Promise<void>((resolve, reject) => {
                  const deleteRequest = indexedDB.deleteDatabase(`_pouch_${dbName}`)
                  deleteRequest.onsuccess = () => {
                    console.log('✅ [DATABASE] Corrupted database deleted successfully')
                    resolve()
                  }
                  deleteRequest.onerror = () => reject(deleteRequest.error)
                  deleteRequest.onblocked = () => {
                    console.warn('⚠️ [DATABASE] Database deletion blocked - close other tabs')
                    // Still resolve - user may need to close tabs
                    setTimeout(resolve, 1000)
                  }
                })

                // Small delay to ensure IndexedDB is fully cleared
                await new Promise(resolve => setTimeout(resolve, 500))

                // Retry creating the database
                return createDatabase(true)
              } catch (deleteError) {
                console.error('❌ [DATABASE] Failed to delete corrupted database:', deleteError)
                throw dbError // Re-throw original error
              }
            }

            throw dbError
          }
        }

        try {
          singletonDatabase = await createDatabase()
        } catch (finalError) {
          console.error('❌ [DATABASE] Failed to initialize database:', finalError)
          // Set error state so UI can show recovery options
          error.value = finalError as Error
          throw finalError
        }

        const w = window as Window & typeof globalThis
        w.pomoFlowDb = singletonDatabase as unknown as PomoFlowDB

        await singletonDatabase.info()
        await performDatabaseHealthCheck(singletonDatabase)

        database.value = singletonDatabase

        // BUG-028 FIX: Set isLoading=false IMMEDIATELY so isReady becomes true
        // This allows UI to load local data while sync happens in background
        isLoading.value = false
        console.log('✅ [DATABASE] Local database ready - UI can load data now')

        // BUG-028 FIX: Start sync in BACKGROUND (don't await)
        // This way UI loads immediately with local data, sync merges in background
        if (hasRemoteSync && !forceLocalMode && !syncManager) {
          syncManager = getGlobalReliableSyncManager()
          console.log('🔄 [DATABASE] Starting background sync...')
          // Don't await - let sync happen in background
          syncManager.init().then(cleanup => {
            syncCleanup = cleanup
            console.log('✅ [DATABASE] Background sync initialized')
          }).catch(syncError => {
            console.warn('⚠️ [DATABASE] Background sync init failed:', syncError)
          })
        }
      } catch (err) {
        error.value = err as Error
        errorHandler.report({
          severity: ErrorSeverity.CRITICAL,
          category: ErrorCategory.DATABASE,
          message: 'Failed to initialize database',
          error: err as Error,
          showNotification: true
        })
        throw err
      } finally {
        isInitializing = false
        // Don't null the promise yet so concurrent calls can still wait for it if they just missed the flag
      }
    })()

    try {
      await initializationPromise
    } finally {
      isLoading.value = false
      initializationPromise = null // Clear it after the await is done
    }
  }

  // Helper function to wait for database initialization
  const waitForDatabase = async (): Promise<PouchDB.Database> => {
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

    if (!database.value) {
      throw new Error('Database not initialized')
    }

    return database.value
  }

  // Initialize immediately (non-blocking)
  initializeDatabase().then(() => {
    // BUG-RECOVERY: Automatically prune conflicts on initialization if backlog is expected
    // This addresses the "Document X has 200+ conflicts" issue
    // SINGLETON GUARD: Only run once across all useDatabase() consumers
    if (!hasRunAutoPrune) {
      hasRunAutoPrune = true
      setTimeout(() => {
        autoPruneBacklog().catch(err => console.warn('⚠️ Auto-pruning failed:', err))
      }, 2000) // Delay to ensure stability first
    }
  })


  /**
   * Save data to PouchDB with verification and cache invalidation
   */
  const save = async <T>(key: string, data: T): Promise<void> => {
    await performDirectSave(key, data)

    // Cache invalidation removed with network optimizer
  }

  /**
   * Direct save method with verification and last-write-wins conflict resolution
   */
  const performDirectSave = async <T>(key: string, data: T): Promise<void> => {
    const maxRetries = 5 // Increased retries for conflict resolution
    let retryCount = 0

    while (retryCount < maxRetries) {
      try {
        const db = await waitForDatabase()
        const docId = `${key}:data`

        // Try to get existing document to get current _rev
        let existingDoc: PouchDB.Core.IdMeta & PouchDB.Core.GetMeta | null = null
        try {
          existingDoc = await db.get(docId)
        } catch (getErr: unknown) {
          const pouchErr = getErr as PouchDB.Core.Error
          if (pouchErr.status !== 404) throw getErr
        }

        const docToSave = {
          _id: docId,
          _rev: existingDoc?._rev,
          data,
          updatedAt: new Date().toISOString(),
          saveMethod: 'direct'
        }

        await db.put(docToSave)
        return // Success - exit retry loop

      } catch (err: unknown) {
        retryCount++
        const status = (err as { status?: number }).status

        // Handle QuotaExceededError
        if (isQuotaExceededError(err)) {
          console.error(`🛑 [DATABASE] Storage quota exceeded while saving ${key}`)
          error.value = new Error('Storage quota exceeded')
          errorHandler.report({
            severity: ErrorSeverity.CRITICAL,
            category: ErrorCategory.DATABASE,
            message: 'Storage quota exceeded - cannot save data',
            userMessage: 'Storage is full. Please export your data.',
            error: err as Error,
            showNotification: true
          })
          return
        }

        // Handle Conflicts (409) - Fetch latest and retry (Last-Write-Wins)
        if (status === 409 && retryCount < maxRetries) {
          console.warn(`⚠️ Conflict on ${key} (attempt ${retryCount}/${maxRetries}), retrying with latest _rev...`)
          // Small delay to allow sync/other process to finish
          await new Promise(resolve => setTimeout(resolve, 50 * retryCount))
          continue
        }

        // Other errors or out of retries
        error.value = err as Error
        errorHandler.report({
          severity: ErrorSeverity.ERROR,
          category: ErrorCategory.DATABASE,
          message: `Failed to save ${key} after ${retryCount} attempts`,
          error: err as Error,
          context: { key, retryCount, status },
          showNotification: true
        })
        throw err
      }
    }
  }

  /**
   * Load data from PouchDB with enhanced retry logic, caching, and conflict detection
   */
  const load = async <T>(key: string): Promise<T | null> => {
    const _cacheKey = `db-load-${key}`

    // Direct database operation (network optimizer removed)
    try {
      const db = await waitForDatabase()
      const docId = `${key}:data`
      // Request conflict info for data safety monitoring
      const doc = await db.get(docId, { conflicts: true })

      // Check for conflicts and log them (data safety feature)
      interface DocWithConflicts extends PouchDB.Core.IdMeta, PouchDB.Core.GetMeta {
        _conflicts?: string[]
        data?: unknown
      }
      const docWithConflicts = doc as DocWithConflicts
      if (docWithConflicts._conflicts && docWithConflicts._conflicts.length > 0) {
        console.debug(`⚔️ [DATABASE] Document ${docId} has ${docWithConflicts._conflicts.length} conflicts`)
        // Add to detected conflicts (don't auto-resolve - user must decide)
        const existingConflict = detectedConflicts.value.find(c => c.docId === docId)
        if (!existingConflict) {
          detectedConflicts.value.push({
            docId,
            count: docWithConflicts._conflicts.length,
            revisions: docWithConflicts._conflicts,
            detectedAt: new Date()
          })
        }
      }

      // Extract the actual data from the PouchDB document structure
      const data = docWithConflicts.data as T

      if (shouldLogTaskDiagnostics()) {
        console.log(`💾 [DATABASE] Loaded ${key} from PouchDB`)
      }

      return data
    } catch (err: unknown) {
      // Handle 404 as expected case
      if ((err as { status?: number }).status === 404) {
        if (shouldLogTaskDiagnostics()) {
          console.log(`📭 [DATABASE] No data found for ${key}`)
        }
        return null
      }
      error.value = err as Error
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: `Failed to load ${key} from database`,
        error: err as Error,
        context: { key },
        showNotification: false // Don't show for load errors, let caller handle
      })
      throw err
    }
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
    }, `remove ${key}`, 3, 100).catch(err => {
      // Handle 404 as expected case (already removed)
      if (err instanceof Error && err.message.includes('404')) {
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

      // Reset singleton reference and recreate database
      singletonDatabase = null
      database.value = null
      delete (window as Window & typeof globalThis).pomoFlowDb
      isInitializing = false
      initializationPromise = null

      // Reinitialize after clear - create new singleton database
      await initializeDatabase()
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

      return docs.rows.map(row => (row.id || '').replace(':data', ''))
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
  const exportAll = async (): Promise<Record<string, unknown>> => {
    try {
      const db = await waitForDatabase()
      const docs = await db.allDocs({ include_docs: true })

      const result: Record<string, unknown> = {}
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
  const importAll = async (data: Record<string, unknown>): Promise<void> => {
    try {
      for (const [key, value] of Object.entries(data)) {
        await save(key, value)
      }
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
   * Prune legacy conflicts for a specific document key
   * This clears redundant revision branches to improve performance and stability
   */
  const pruneConflicts = async (key: string): Promise<{ resolved: number; failed: number }> => {
    const docId = `${key}:data`
    let resolved = 0
    let failed = 0

    try {
      const db = await waitForDatabase()
      const doc = await db.get(docId, { conflicts: true }) as any

      if (doc._conflicts && doc._conflicts.length > 0) {
        console.log(`🧹 [DATABASE] Pruning ${doc._conflicts.length} conflicts for doc: ${docId}`)

        for (const rev of doc._conflicts) {
          try {
            await db.remove(docId, rev)
            resolved++
          } catch (err) {
            console.warn(`⚠️ [DATABASE] Failed to remove revision ${rev} for doc ${docId}:`, err)
            failed++
          }
        }

        console.log(`✅ [DATABASE] Pruned ${resolved} revisions for ${docId}. (Failed: ${failed})`)
      }

      return { resolved, failed }
    } catch (err) {
      if ((err as any).status !== 404) {
        console.error(`❌ [DATABASE] Error during conflict pruning for ${docId}:`, err)
      }
      return { resolved: 0, failed: 0 }
    }
  }

  /**
   * Scan all database keys and resolve any accumulated conflicts
   * Resolves the "Document has X conflicts" issue reported in logs
   */
  const autoPruneBacklog = async (): Promise<Record<string, { resolved: number; failed: number }>> => {
    console.log('🧹 [DATABASE] Starting automatic conflict pruning backlog scan...')
    const dbKeys = await keys()
    const results: Record<string, { resolved: number; failed: number }> = {}

    for (const key of dbKeys) {
      const result = await pruneConflicts(key)
      if (result.resolved > 0) {
        results[key] = result
      }
    }

    const totalPruned = Object.values(results).reduce((sum, r) => sum + r.resolved, 0)
    if (totalPruned > 0) {
      console.log(`✨ [DATABASE] Completed auto-pruning. Resolved ${totalPruned} conflicts across ${Object.keys(results).length} documents.`)
    } else {
      console.log('✅ [DATABASE] No conflicts found to prune during backlog scan.')
    }

    return results
  }

  /**
   * Execute operations atomically
   */
  const atomicTransaction = async <T>(
    operations: Array<() => Promise<T>>,
    context?: string
  ): Promise<T[]> => {
    try {
      const results = await Promise.all(operations)
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

  // Sync-related computed properties
  const syncStatus = ref<'error' | 'offline' | 'idle' | 'syncing' | 'complete' | 'paused'>('idle')
  const isOnline = computed(() => syncManager?.isOnline.value || navigator.onLine)

  // Sync operations
  const triggerSync = async () => {
    if (syncManager) {
      await syncManager.triggerSync()
    } else {
      // Log only on explicit trigger if needed, or silence completely
      // console.debug('💡 [USE-DATABASE] Sync not available - no remote configuration')
    }
  }

  const pauseSync = async () => {
    if (syncManager) {
      await syncManager.pauseSync()
    }
  }

  const resumeSync = async () => {
    if (syncManager) {
      await syncManager.resumeSync()
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
  }

  // Cleanup function for when the composable is destroyed
  const cleanup = async () => {
    databaseRefCount--

    // Only cleanup sync manager, not the database (since it's shared)
    if (syncCleanup) {
      syncCleanup()
      syncCleanup = null
    }
    if (syncManager) {
      await syncManager.cleanup()
      syncManager = null
    }

    // Don't destroy the singleton database until all references are gone
    if (databaseRefCount <= 0 && singletonDatabase) {
      try {
        await singletonDatabase.destroy()
      } catch {
        // Silent fail on cleanup
      }
      singletonDatabase = null
      database.value = null
      delete (window as Window & typeof globalThis).pomoFlowDb
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
      interface BatchRow {
        id?: string
        key?: string
        doc?: { data?: unknown }
      }
      docs.rows.forEach(row => {
        const batchRow = row as BatchRow
        if (batchRow.doc) {
          const key = (batchRow.id || '').replace(':data', '')
          result[key] = batchRow.doc.data as T
        } else if (batchRow.key) {
          // Document doesn't exist
          const key = batchRow.key.replace(':data', '')
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
        console.log(`📦 [DATABASE] Batch loaded ${keys.length} keys from PouchDB`)
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
        console.log(`📦 [DATABASE] Batch saved ${keys.length} items to PouchDB`)
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

  // connectBackupManagerDataSource removed for consolidation


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

    // Conflict detection and pruning (data safety)
    detectedConflicts,
    conflictCount,
    clearConflicts,
    pruneConflicts,
    autoPruneBacklog,

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