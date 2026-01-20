/**
 * Tauri Storage Adapter for Supabase Auth
 *
 * BUG-339: Uses tauri-plugin-store instead of localStorage for persistent
 * auth sessions in Tauri WebView. localStorage is unreliable in WebView
 * contexts and can lose sessions between app restarts.
 *
 * This adapter implements the Supabase Storage interface and provides:
 * - Persistent session storage via Tauri's native key-value store
 * - Automatic migration from localStorage on first use
 * - Fallback to localStorage for web builds (non-Tauri)
 */

import { load, type Store } from '@tauri-apps/plugin-store'

// Store instance singleton - using promise to prevent race conditions
let store: Store | null = null
let storePromise: Promise<Store> | null = null

// Store file name (persisted in Tauri app data directory)
const STORE_FILENAME = 'auth-session.json'

/**
 * Get or create the store instance
 * Uses promise-based singleton to prevent race conditions during initialization
 */
async function getStore(): Promise<Store> {
  // Return existing store if already loaded
  if (store) {
    return store
  }

  // Return existing promise if load is in progress (prevents race condition)
  if (storePromise) {
    return storePromise
  }

  // Start loading and cache the promise
  storePromise = load(STORE_FILENAME, {
    defaults: {},
    autoSave: false
  }).then(s => {
    store = s
    return s
  }).catch(e => {
    // Reset promise on failure so retry is possible
    storePromise = null
    throw e
  })

  return storePromise
}

/**
 * Migrate existing localStorage auth data to Tauri store
 * Called once on first use to preserve existing sessions
 */
async function migrateFromLocalStorage(key: string): Promise<void> {
  const migrationKey = `${key}-migrated-to-tauri`

  // Check if we've already migrated this key
  if (localStorage.getItem(migrationKey)) {
    return
  }

  const existingValue = localStorage.getItem(key)
  if (existingValue) {
    const s = await getStore()
    await s.set(key, existingValue)
    await s.save()

    // Mark as migrated (keep localStorage value as fallback)
    localStorage.setItem(migrationKey, new Date().toISOString())
    console.log(`[TAURI-AUTH] Migrated ${key} from localStorage to Tauri store`)
  }
}

/**
 * Tauri Storage Adapter
 *
 * Implements the Supabase Storage interface for use with Tauri's
 * native key-value store plugin.
 */
export const TauriStorageAdapter = {
  /**
   * Get a value from the Tauri store
   */
  async getItem(key: string): Promise<string | null> {
    try {
      // First-time migration check
      await migrateFromLocalStorage(key)

      const s = await getStore()
      const value = await s.get<string>(key)
      return value ?? null
    } catch (error) {
      console.error('[TAURI-AUTH] Failed to get item from store:', error)
      // Fallback to localStorage if Tauri store fails
      return localStorage.getItem(key)
    }
  },

  /**
   * Set a value in the Tauri store
   */
  async setItem(key: string, value: string): Promise<void> {
    try {
      const s = await getStore()
      await s.set(key, value)
      await s.save() // Explicit save for auth data (critical to persist)

      // Also update localStorage as fallback
      localStorage.setItem(key, value)
    } catch (error) {
      console.error('[TAURI-AUTH] Failed to set item in store:', error)
      // Fallback to localStorage only
      localStorage.setItem(key, value)
    }
  },

  /**
   * Remove a value from the Tauri store
   */
  async removeItem(key: string): Promise<void> {
    try {
      const s = await getStore()
      await s.delete(key)
      await s.save()

      // Also remove from localStorage
      localStorage.removeItem(key)
    } catch (error) {
      console.error('[TAURI-AUTH] Failed to remove item from store:', error)
      // Fallback to localStorage only
      localStorage.removeItem(key)
    }
  }
}
