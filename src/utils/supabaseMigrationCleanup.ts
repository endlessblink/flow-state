/**
 * Supabase Migration Cleanup
 *
 * This utility clears all old PouchDB/CouchDB/localStorage data
 * that might interfere with the new Supabase-only system.
 *
 * Run once during migration, then this becomes a no-op.
 */

const MIGRATION_FLAG = 'supabase-migration-complete-v1'

// Keys to clear from localStorage
const LEGACY_KEYS_TO_CLEAR = [
  // Offline queue (causes old operations to replay)
  'pomoflow-offline-queue',

  // Old backup system
  'pomo-flow-backup-history',
  'pomo-flow-latest-backup',
  'pomo-flow-backup-stats',
  'pomo-flow-golden-backup',
  'pomo-flow-max-task-count',
  'pomo-flow-simple-latest-backup',

  // Old sync state
  'pomoflow_lastSyncTime',
  'pomoflow_hasConnectedEver',

  // Old PouchDB/CouchDB config
  'pomo-couchdb-url',
  'pomo-couchdb-username',
  'pomo-couchdb-password',

  // Old polling data
  'pomo-flow-polling',
]

// IndexedDB databases to delete
const INDEXEDDB_TO_DELETE = [
  'pomoflow-app-dev',
  'pomoflow-app',
  'pomoflow-tasks',
  '_pouch_pomoflow-app-dev',
  '_pouch_pomoflow-app',
  '_pouch_pomoflow-tasks',
]

export function isMigrationComplete(): boolean {
  return localStorage.getItem(MIGRATION_FLAG) === 'true'
}

export function markMigrationComplete(): void {
  localStorage.setItem(MIGRATION_FLAG, 'true')
  console.log('✅ [MIGRATION] Supabase migration cleanup complete')
}

export async function runMigrationCleanup(): Promise<void> {
  if (isMigrationComplete()) {
    console.log('ℹ️ [MIGRATION] Already cleaned up, skipping')
    return
  }

  console.log('🧹 [MIGRATION] Starting Supabase migration cleanup...')

  // 1. Clear legacy localStorage keys
  let clearedKeys = 0
  for (const key of LEGACY_KEYS_TO_CLEAR) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key)
      clearedKeys++
      console.log(`  🗑️ Cleared localStorage: ${key}`)
    }
  }

  // 2. Clear old IndexedDB databases (PouchDB data)
  if (typeof indexedDB !== 'undefined') {
    for (const dbName of INDEXEDDB_TO_DELETE) {
      try {
        const deleteRequest = indexedDB.deleteDatabase(dbName)
        deleteRequest.onsuccess = () => {
          console.log(`  🗑️ Deleted IndexedDB: ${dbName}`)
        }
        deleteRequest.onerror = () => {
          console.log(`  ⚠️ Could not delete IndexedDB: ${dbName}`)
        }
      } catch (e) {
        console.log(`  ⚠️ Error deleting IndexedDB ${dbName}:`, e)
      }
    }
  }

  // 3. Mark migration complete
  markMigrationComplete()

  console.log(`🧹 [MIGRATION] Cleanup complete: ${clearedKeys} localStorage keys cleared`)
}

// Export for manual use in console
if (typeof window !== 'undefined') {
  (window as any).runSupabaseMigrationCleanup = runMigrationCleanup
  ;(window as any).resetMigrationFlag = () => {
    localStorage.removeItem(MIGRATION_FLAG)
    console.log('Migration flag reset - cleanup will run on next load')
  }

  // Helper to clear all local data and force fresh start
  ;(window as any).clearAllLocalData = async () => {
    console.log('🧹 Clearing all local data...')

    // Clear localStorage
    const keysToRemove = Object.keys(localStorage).filter(key =>
      key.includes('pomo') || key.includes('Pomo') || key.includes('supabase')
    )
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      console.log(`  Removed localStorage: ${key}`)
    })

    // Clear IndexedDB
    const databases = [
      'pomoflow-app-dev', 'pomoflow-app', 'pomoflow-tasks',
      '_pouch_pomoflow-app-dev', '_pouch_pomoflow-app', '_pouch_pomoflow-tasks'
    ]
    for (const dbName of databases) {
      try {
        indexedDB.deleteDatabase(dbName)
        console.log(`  Deleted IndexedDB: ${dbName}`)
      } catch (e) {
        // Ignore
      }
    }

    console.log('✅ All local data cleared. Please refresh the page.')
    return 'Refresh the page to complete cleanup'
  }
}
