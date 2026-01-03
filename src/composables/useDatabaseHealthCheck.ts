/**
 * Database Health Check Composable
 * TASK-085: Safeguard 1 - Validates IndexedDB integrity on app startup
 * BUG-057: Enhanced Firefox/Zen browser compatibility
 *
 * Purpose:
 * - Detects corrupted IndexedDB before it causes data loss
 * - Auto-clears corrupted local DB if CouchDB has data to restore from
 * - Prevents "Failed to read large IndexedDB value" errors
 * - PRE-INITIALIZATION: Tests IndexedDB BEFORE PouchDB loads (Firefox fix)
 *
 * Safety:
 * - NEVER clears local DB if remote CouchDB is empty
 * - Only clears if we can definitively restore from remote
 * - Logs all actions for debugging
 *
 * Firefox/Zen Known Issues (from PouchDB GitHub issues):
 * - NotFoundError when IndexedDB is corrupted
 * - InvalidStateError in Firefox
 * - Corrupted DB prevents ALL databases from loading
 * - Solution: Detect early and delete/recreate
 */

import { ref } from 'vue'
import { isSyncEnabled, getDatabaseConfig } from '@/config/database'

export interface HealthCheckResult {
  healthy: boolean
  action: 'none' | 'cleared-will-sync' | 'corruption-detected-no-remote' | 'pre-check-cleared'
  error?: string
  details?: {
    localDocCount?: number
    remoteDocCount?: number
    errorType?: string
  }
}

// Track if pre-check has run this session
let preCheckCompleted = false

/**
 * BUG-057: Pre-initialization IndexedDB health check
 * Runs BEFORE PouchDB to detect Firefox/Zen corruption early
 *
 * This is critical because Firefox can get into a state where
 * IndexedDB is completely broken until all storage is cleared.
 */
export async function runPreInitializationCheck(): Promise<{ healthy: boolean; cleared: boolean; error?: string }> {
  if (preCheckCompleted) {
    return { healthy: true, cleared: false }
  }

  console.log('🔬 [PRE-CHECK] Running IndexedDB pre-initialization health check...')

  const dbName = '_pouch_pomoflow-app-dev'

  try {
    // Test 1: Can we even access IndexedDB?
    if (typeof indexedDB === 'undefined') {
      console.warn('⚠️ [PRE-CHECK] IndexedDB not available')
      preCheckCompleted = true
      return { healthy: false, cleared: false, error: 'IndexedDB not available' }
    }

    // Test 2: Check if database exists BEFORE opening it
    // This prevents us from accidentally creating an empty database that breaks PouchDB
    let databaseExists = false

    if (indexedDB.databases) {
      try {
        const allDbs = await indexedDB.databases()
        databaseExists = allDbs.some(db => db.name === dbName)
        console.log(`📊 [PRE-CHECK] Database exists check: ${databaseExists ? 'YES' : 'NO'}`)
      } catch (e) {
        console.warn('⚠️ [PRE-CHECK] indexedDB.databases() not supported, assuming database might exist')
        databaseExists = true // Assume it might exist if we can't check
      }
    } else {
      // Firefox doesn't support indexedDB.databases() - assume database might exist
      console.log('ℹ️ [PRE-CHECK] indexedDB.databases() not available (Firefox), assuming database might exist')
      databaseExists = true
    }

    // If database doesn't exist, skip the check - let PouchDB create it fresh
    if (!databaseExists) {
      console.log('✅ [PRE-CHECK] No existing database - PouchDB will create it fresh')
      preCheckCompleted = true
      return { healthy: true, cleared: false }
    }

    // Test 3: Open existing database and check its structure
    const testResult = await new Promise<{ success: boolean; error?: string; needsReset?: boolean }>((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({ success: false, error: 'IndexedDB open timeout (5s)' })
      }, 5000)

      try {
        // Open WITHOUT specifying version to avoid triggering onupgradeneeded
        const request = indexedDB.open(dbName)

        request.onerror = (event) => {
          clearTimeout(timeoutId)
          const error = (event.target as IDBOpenDBRequest).error
          const errorName = error?.name || 'UnknownError'
          const errorMessage = error?.message || 'Unknown IndexedDB error'
          console.warn(`⚠️ [PRE-CHECK] IndexedDB open error: ${errorName}: ${errorMessage}`)
          resolve({ success: false, error: `${errorName}: ${errorMessage}` })
        }

        request.onsuccess = (event) => {
          clearTimeout(timeoutId)
          const db = (event.target as IDBOpenDBRequest).result

          try {
            const storeNames = Array.from(db.objectStoreNames)
            const dbVersion = db.version
            console.log(`📊 [PRE-CHECK] Database version: ${dbVersion}, stores: ${storeNames.join(', ') || 'none'}`)

            // PouchDB expects these core object stores
            const expectedStores = ['document-store', 'by-sequence', 'attach-store', 'local-store']
            const hasAllStores = expectedStores.every(store => storeNames.includes(store))
            const hasAnyStores = storeNames.length > 0

            if (hasAnyStores && !hasAllStores) {
              // Partial/corrupted PouchDB structure - needs reset
              console.warn(`⚠️ [PRE-CHECK] Corrupted PouchDB structure detected!`)
              console.warn(`   Expected: ${expectedStores.join(', ')}`)
              console.warn(`   Found: ${storeNames.join(', ')}`)
              db.close()
              resolve({ success: false, needsReset: true, error: 'Corrupted PouchDB structure - missing object stores' })
              return
            }

            if (!hasAnyStores) {
              // Database exists but has no stores - this is the corrupted state we created
              console.warn(`⚠️ [PRE-CHECK] Empty database (no stores) - needs reset`)
              db.close()
              resolve({ success: false, needsReset: true, error: 'Empty database - needs reset for PouchDB' })
              return
            }

            db.close()
            console.log(`✅ [PRE-CHECK] PouchDB structure looks healthy (${storeNames.length} stores)`)
            resolve({ success: true })
          } catch (storeError) {
            db.close()
            const error = storeError as Error
            console.warn(`⚠️ [PRE-CHECK] Object store access error: ${error.name}: ${error.message}`)
            resolve({ success: false, error: `${error.name}: ${error.message}` })
          }
        }

        request.onupgradeneeded = (event) => {
          // This shouldn't happen if database already exists, but handle it
          clearTimeout(timeoutId)
          const transaction = (event.target as IDBOpenDBRequest).transaction
          console.warn('⚠️ [PRE-CHECK] Unexpected upgrade needed - aborting to let PouchDB handle it')
          // Abort the transaction to prevent creating empty database
          if (transaction) {
            transaction.abort()
          }
          resolve({ success: true }) // Let PouchDB handle fresh creation
        }

        request.onblocked = () => {
          clearTimeout(timeoutId)
          console.warn('⚠️ [PRE-CHECK] IndexedDB open blocked - close other tabs')
          resolve({ success: false, error: 'IndexedDB blocked by other tabs' })
        }
      } catch (syncError) {
        clearTimeout(timeoutId)
        const error = syncError as Error
        console.warn(`⚠️ [PRE-CHECK] Sync error opening IndexedDB: ${error.name}: ${error.message}`)
        resolve({ success: false, error: `${error.name}: ${error.message}` })
      }
    })

    if (testResult.success) {
      console.log('✅ [PRE-CHECK] IndexedDB is healthy')
      preCheckCompleted = true
      return { healthy: true, cleared: false }
    }

    // Database appears corrupted - check if we should auto-clear
    console.warn('⚠️ [PRE-CHECK] IndexedDB corruption detected:', testResult.error)

    // Check known corruption patterns OR explicit needsReset flag
    const errorStr = testResult.error || ''
    const isKnownCorruption =
      testResult.needsReset ||  // Explicit flag from structure check
      errorStr.includes('NotFoundError') ||
      errorStr.includes('InvalidStateError') ||
      errorStr.includes('AbortError') ||
      errorStr.includes('UnknownError') ||
      errorStr.includes('object store') ||
      errorStr.includes('database object could not be found') ||
      errorStr.includes('Corrupted PouchDB structure') ||
      errorStr.includes('Empty database with version')

    if (isKnownCorruption) {
      // Check if remote has data before clearing
      const remoteCheck = await checkRemoteHasData()

      if (remoteCheck.hasData) {
        console.log('🔄 [PRE-CHECK] Remote has data - safe to clear corrupted local DB')

        // Delete all PouchDB-related databases
        await clearAllPouchDatabases()

        preCheckCompleted = true
        return { healthy: false, cleared: true, error: testResult.error }
      } else {
        console.warn('⚠️ [PRE-CHECK] Remote is empty - cannot auto-clear (would lose data)')
        preCheckCompleted = true
        return { healthy: false, cleared: false, error: testResult.error }
      }
    }

    preCheckCompleted = true
    return { healthy: false, cleared: false, error: testResult.error }
  } catch (error) {
    const err = error as Error
    console.error('❌ [PRE-CHECK] Pre-initialization check failed:', err.message)
    preCheckCompleted = true
    return { healthy: false, cleared: false, error: err.message }
  }
}

/**
 * Clear all PouchDB-related IndexedDB databases
 */
async function clearAllPouchDatabases(): Promise<void> {
  const dbsToDelete = [
    '_pouch_pomoflow-app-dev',
    '_pouch_pomoflow-app-dev-mrview-*' // MapReduce views
  ]

  console.log('🗑️ [PRE-CHECK] Clearing all PouchDB databases...')

  // Get all databases and filter for PouchDB ones
  if (indexedDB.databases) {
    try {
      const allDbs = await indexedDB.databases()
      for (const dbInfo of allDbs) {
        if (dbInfo.name && dbInfo.name.startsWith('_pouch_')) {
          await deleteDatabase(dbInfo.name)
        }
      }
    } catch (e) {
      console.warn('⚠️ [PRE-CHECK] indexedDB.databases() not supported, using fallback')
    }
  }

  // Also try to delete known database names
  for (const dbName of dbsToDelete) {
    if (!dbName.includes('*')) {
      await deleteDatabase(dbName)
    }
  }
}

/**
 * Delete a single IndexedDB database
 */
async function deleteDatabase(dbName: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(dbName)

      request.onsuccess = () => {
        console.log(`✅ [PRE-CHECK] Deleted database: ${dbName}`)
        resolve()
      }

      request.onerror = () => {
        console.warn(`⚠️ [PRE-CHECK] Failed to delete database: ${dbName}`)
        resolve() // Continue anyway
      }

      request.onblocked = () => {
        console.warn(`⚠️ [PRE-CHECK] Database deletion blocked: ${dbName}`)
        resolve() // Continue anyway
      }

      // Timeout after 3 seconds
      setTimeout(resolve, 3000)
    } catch (e) {
      console.warn(`⚠️ [PRE-CHECK] Error deleting database ${dbName}:`, e)
      resolve()
    }
  })
}

/**
 * Check if the remote CouchDB has data we can restore from
 */
async function checkRemoteHasData(): Promise<{ hasData: boolean; docCount: number }> {
  const config = getDatabaseConfig()
  if (!config.remote?.url || !config.remote?.auth) {
    return { hasData: false, docCount: 0 }
  }

  try {
    const url = config.remote.url
    const auth = btoa(`${config.remote.auth.username}:${config.remote.auth.password}`)

    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    })

    if (!response.ok) {
      console.warn('⚠️ [HEALTH CHECK] Remote CouchDB not accessible:', response.status)
      return { hasData: false, docCount: 0 }
    }

    const dbInfo = await response.json()
    const docCount = dbInfo.doc_count || 0

    console.log(`📊 [HEALTH CHECK] Remote CouchDB has ${docCount} documents`)

    // Consider "has data" if there's at least 1 non-design document
    return { hasData: docCount > 0, docCount }
  } catch (error) {
    console.warn('⚠️ [HEALTH CHECK] Failed to check remote CouchDB:', error)
    return { hasData: false, docCount: 0 }
  }
}

/**
 * Clear the local IndexedDB database
 * This forces a fresh sync from CouchDB on next load
 */
async function clearLocalDatabase(): Promise<void> {
  const dbName = '_pouch_pomoflow-app-dev'

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(dbName)

    request.onsuccess = () => {
      console.log('🗑️ [HEALTH CHECK] Local IndexedDB cleared successfully')
      resolve()
    }

    request.onerror = () => {
      console.error('❌ [HEALTH CHECK] Failed to clear IndexedDB:', request.error)
      reject(request.error)
    }

    request.onblocked = () => {
      console.warn('⚠️ [HEALTH CHECK] IndexedDB deletion blocked - close other tabs')
      // Still resolve - the deletion will complete when tabs close
      resolve()
    }
  })
}

/**
 * Perform basic database operations to check integrity
 */
async function testDatabaseIntegrity(db: PouchDB.Database): Promise<{ healthy: boolean; error?: string; docCount?: number }> {
  try {
    // Test 1: Get database info
    const info = await db.info()
    console.log(`📊 [HEALTH CHECK] Local DB info: ${info.doc_count} docs, ${info.update_seq} seq`)

    // Test 2: Try to read a few documents
    const allDocs = await db.allDocs({ limit: 5, include_docs: true })
    console.log(`📄 [HEALTH CHECK] Successfully read ${allDocs.rows.length} documents`)

    // Test 3: Check for excessive conflicts (warning sign)
    const conflictDocs = await db.allDocs({ conflicts: true, limit: 10, include_docs: true })
    const conflictCount = conflictDocs.rows.filter(row => row.doc?._conflicts?.length).length
    if (conflictCount > 5) {
      console.warn(`⚠️ [HEALTH CHECK] ${conflictCount} documents have conflicts - may need pruning`)
    }

    return { healthy: true, docCount: info.doc_count }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Known corruption patterns
    const corruptionPatterns = [
      'Failed to read large IndexedDB value',
      'database connection is closing',
      'UnknownError',
      'InvalidStateError',
      'QuotaExceededError'
    ]

    const isCorruption = corruptionPatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    )

    return {
      healthy: false,
      error: errorMessage,
      docCount: isCorruption ? undefined : 0
    }
  }
}

export function useDatabaseHealthCheck() {
  const isChecking = ref(false)
  const lastResult = ref<HealthCheckResult | null>(null)

  /**
   * Main health check function - call on app startup
   */
  const checkHealth = async (): Promise<HealthCheckResult> => {
    isChecking.value = true
    console.log('🏥 [HEALTH CHECK] Starting database health check...')

    try {
      // Get the global PouchDB instance
      const db = (window as any).pomoFlowDb as PouchDB.Database | undefined

      if (!db) {
        console.log('ℹ️ [HEALTH CHECK] No database instance yet - will be created fresh')
        const result: HealthCheckResult = { healthy: true, action: 'none' }
        lastResult.value = result
        return result
      }

      // Test database integrity
      if (typeof db.info !== 'function') {
        console.warn('⚠️ [HEALTH CHECK] DB instance found but .info() is missing. Initialization race? Skipping check.')
        return { healthy: true, action: 'none' }
      }

      const integrityResult = await testDatabaseIntegrity(db)

      if (integrityResult.healthy) {
        console.log('✅ [HEALTH CHECK] Database is healthy')
        const result: HealthCheckResult = {
          healthy: true,
          action: 'none',
          details: { localDocCount: integrityResult.docCount }
        }
        lastResult.value = result
        return result
      }

      // Database appears corrupted - check if we can restore from remote
      console.warn('⚠️ [HEALTH CHECK] Database corruption detected:', integrityResult.error)

      if (!isSyncEnabled()) {
        console.warn('⚠️ [HEALTH CHECK] Sync not enabled - cannot auto-recover')
        const result: HealthCheckResult = {
          healthy: false,
          action: 'corruption-detected-no-remote',
          error: integrityResult.error,
          details: { errorType: 'corruption-no-sync' }
        }
        lastResult.value = result
        return result
      }

      // Check if remote has data
      const remoteCheck = await checkRemoteHasData()

      if (!remoteCheck.hasData) {
        console.warn('⚠️ [HEALTH CHECK] Remote CouchDB is empty - cannot auto-recover')
        const result: HealthCheckResult = {
          healthy: false,
          action: 'corruption-detected-no-remote',
          error: integrityResult.error,
          details: {
            errorType: 'corruption-remote-empty',
            remoteDocCount: remoteCheck.docCount
          }
        }
        lastResult.value = result
        return result
      }

      // Safe to clear and restore!
      console.log('🔄 [HEALTH CHECK] Remote has data - clearing corrupted local DB...')

      try {
        // Close the current connection
        await db.close()
      } catch (closeError) {
        console.warn('⚠️ [HEALTH CHECK] Error closing DB (continuing anyway):', closeError)
      }

      // Clear the corrupted database
      await clearLocalDatabase()

      // Clear the global reference so it gets recreated
      delete (window as any).pomoFlowDb

      console.log('✅ [HEALTH CHECK] Corrupted DB cleared - will sync fresh on reload')

      const result: HealthCheckResult = {
        healthy: false,
        action: 'cleared-will-sync',
        details: {
          remoteDocCount: remoteCheck.docCount,
          errorType: 'corruption-auto-recovered'
        }
      }
      lastResult.value = result

      // Trigger page reload to get fresh data
      setTimeout(() => {
        console.log('🔄 [HEALTH CHECK] Reloading page to sync fresh data...')
        window.location.reload()
      }, 500)

      return result
    } catch (error) {
      console.error('❌ [HEALTH CHECK] Health check failed:', error)
      const result: HealthCheckResult = {
        healthy: false,
        action: 'none',
        error: error instanceof Error ? error.message : String(error)
      }
      lastResult.value = result
      return result
    } finally {
      isChecking.value = false
    }
  }

  return {
    checkHealth,
    isChecking,
    lastResult
  }
}

/**
 * BUG-057 FIX: Nuclear option - delete database directly using native IndexedDB API
 * This bypasses PouchDB's db.destroy() which requires an open database handle
 * Used when Firefox/Zen browser corrupts the database beyond recovery
 *
 * @see https://github.com/pouchdb/pouchdb/issues/6050
 * @see https://github.com/pouchdb/pouchdb/issues/8329
 */
export async function nukeDatabaseAndReload(dbName: string = '_pouch_pomoflow-app-dev'): Promise<void> {
  console.log(`🔥 [NUKE] Deleting corrupted database: ${dbName}`)

  return new Promise((resolve) => {
    try {
      const deleteRequest = indexedDB.deleteDatabase(dbName)

      deleteRequest.onsuccess = () => {
        console.log('✅ [NUKE] Database deleted successfully')
        // Also clear any cached localStorage flags
        localStorage.removeItem('pomoflow_lastSyncTime')
        localStorage.removeItem('pomoflow_hasConnectedEver')

        console.log('🔄 [NUKE] Reloading page to re-sync from CouchDB...')
        setTimeout(() => {
          window.location.reload()
        }, 500)
        resolve()
      }

      deleteRequest.onerror = (event) => {
        console.error('❌ [NUKE] Failed to delete database:', event)
        // Still try to reload
        window.location.reload()
        resolve()
      }

      deleteRequest.onblocked = () => {
        console.warn('⚠️ [NUKE] Database deletion blocked - forcing reload anyway...')
        // Force reload anyway
        setTimeout(() => {
          window.location.reload()
        }, 1000)
        resolve()
      }
    } catch (err) {
      console.error('❌ [NUKE] Error during database deletion:', err)
      window.location.reload()
      resolve()
    }
  })
}

/**
 * BUG-057 FIX: Detect if we should nuke the database
 * Called when multiple operations fail with global database errors
 * After MAX_GLOBAL_FAILURES, automatically nukes and reloads
 */
let globalFailureCount = 0
const MAX_GLOBAL_FAILURES = 3

export function detectGlobalDatabaseFailure(err: unknown): boolean {
  if (err instanceof Error) {
    const message = err.message.toLowerCase()
    const isGlobalFailure =
      message.includes('global failure') ||
      message.includes('closed database') ||
      message.includes('out of memory') ||
      message.includes('invalidstateerror') ||
      message.includes('not, or is no longer, usable') ||
      message.includes('connection to indexed database server lost') ||
      message.includes('internal error was encountered') ||
      message.includes('unable to resolve latest revision') // Orphaned revision corruption

    if (isGlobalFailure) {
      globalFailureCount++
      console.warn(`⚠️ [DB-HEALTH] Global failure detected (${globalFailureCount}/${MAX_GLOBAL_FAILURES}): ${err.message}`)

      if (globalFailureCount >= MAX_GLOBAL_FAILURES) {
        console.error('🔥 [DB-HEALTH] Max failures reached - nuking database and reloading...')
        nukeDatabaseAndReload()
        return true
      }
    }
  }
  return false
}

/**
 * Reset the global failure counter (call after successful operations)
 */
export function resetGlobalFailureCount(): void {
  if (globalFailureCount > 0) {
    console.log('✅ [DB-HEALTH] Resetting global failure count (operation succeeded)')
    globalFailureCount = 0
  }
}
