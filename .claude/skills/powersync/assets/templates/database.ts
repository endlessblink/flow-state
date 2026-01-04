/**
 * PowerSync Database Setup Template
 *
 * Copy this file to: src/database.ts (or src/services/database/PowerSyncDatabase.ts)
 *
 * Prerequisites:
 * 1. Create schema.ts with your table definitions
 * 2. Create connector.ts with your sync configuration
 * 3. Run: npx powersync-sdk-web copy-assets --public-dir public/powersync
 */
import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web'
import { Connector } from './connector'
import { AppSchema } from './schema'

// Singleton instance
let db: PowerSyncDatabase | null = null

/**
 * Get the PowerSync database instance (singleton pattern)
 */
export function getDatabase(): PowerSyncDatabase {
  if (!db) {
    db = new PowerSyncDatabase({
      schema: AppSchema,
      database: new WASQLiteOpenFactory({
        // Database filename (stored in OPFS)
        dbFilename: 'app.db',

        // Path to WASM worker (copied to public/powersync/)
        workerUri: '/powersync/wa-sqlite.worker.js',

        // ENABLE OPFS for native-speed SQLite
        // Requires COOP/COEP headers to work
        vfs: WASQLiteVFS.OPFSCoopSyncVFS,

        flags: {
          // Required for multi-tab support
          enableMultiTabs: true
        }
      })
    })
  }
  return db
}

/**
 * Initialize PowerSync with SSR safety guard
 * Call this in your app's initialization (e.g., onMounted in Vue, useEffect in React)
 */
export async function initPowerSync(): Promise<PowerSyncDatabase | null> {
  // SSR GUARD: Prevent execution in Node.js/Server environments
  if (typeof window === 'undefined') {
    console.log('[PowerSync] Skipping initialization in server environment')
    return null
  }

  const database = getDatabase()
  const connector = new Connector()

  try {
    await database.connect(connector)
    console.log('[PowerSync] Connected successfully')

    // Verify OPFS is active
    if (crossOriginIsolated) {
      console.log('[PowerSync] Using high-performance OPFS storage')
    } else {
      console.warn('[PowerSync] OPFS not available, using IndexedDB fallback')
      console.warn('[PowerSync] Add COOP/COEP headers to enable OPFS')
    }
  } catch (error) {
    console.error('[PowerSync] Connection failed:', error)
    throw error
  }

  return database
}

/**
 * Disconnect from PowerSync
 * Call this when your app unmounts or user logs out
 */
export async function disconnectPowerSync(): Promise<void> {
  if (db) {
    await db.disconnect()
    db = null
    console.log('[PowerSync] Disconnected')
  }
}
