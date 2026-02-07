/**
 * TASK-1215: Tauri-Aware Persistent Ref
 *
 * Provides a reactive ref that reliably persists across app restarts in both
 * browser (localStorage) and Tauri (plugin-store + localStorage).
 *
 * Problem: Tauri's WebKitGTK WebView doesn't reliably flush localStorage
 * to disk on app close (BUG-339). This causes UI preferences to be lost
 * on restart.
 *
 * Solution: Dual-write architecture:
 * - localStorage: Used for sync reactive access (VueUse useStorage)
 * - Tauri plugin-store: Used for reliable disk persistence (async)
 *
 * Flow:
 * 1. On app startup (before mount): preloadTauriUiState() loads Tauri store
 *    values into localStorage so useStorage picks up correct initial values
 * 2. usePersistentRef() wraps useStorage + adds Tauri store watcher
 * 3. On value change: writes to both localStorage (sync) and Tauri store (async)
 */

import { useStorage, type RemovableRef } from '@vueuse/core'
import { watch } from 'vue'

// Tauri store singleton
let tauriStoreInstance: any = null
let tauriStorePromise: Promise<any> | null = null

const STORE_FILENAME = 'ui-preferences.json'

/**
 * Check if we're running in Tauri
 */
function isTauriEnv(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * Get or create the Tauri store singleton
 */
async function getTauriStore(): Promise<any | null> {
  if (!isTauriEnv()) return null
  if (tauriStoreInstance) return tauriStoreInstance

  if (tauriStorePromise) return tauriStorePromise

  tauriStorePromise = (async () => {
    try {
      const { load } = await import('@tauri-apps/plugin-store')
      const store = await load(STORE_FILENAME, { defaults: {}, autoSave: false })
      tauriStoreInstance = store
      console.log('[PERSISTENT-REF] Tauri store loaded:', STORE_FILENAME)
      return store
    } catch (e) {
      console.warn('[PERSISTENT-REF] Failed to load Tauri store:', e)
      tauriStorePromise = null
      return null
    }
  })()

  return tauriStorePromise
}

/**
 * Preload Tauri store values into localStorage before Vue mounts.
 * Call this in main.ts BEFORE app.mount('#app').
 *
 * This ensures useStorage picks up the correct persisted values
 * from the Tauri native store on app startup.
 */
export async function preloadTauriUiState(): Promise<void> {
  if (!isTauriEnv()) {
    console.log('[PERSISTENT-REF] Not in Tauri, skipping preload')
    return
  }

  try {
    console.log('[PERSISTENT-REF] Preloading UI state from Tauri store...')
    const store = await getTauriStore()
    if (!store) {
      console.warn('[PERSISTENT-REF] Tauri store not available for preload')
      return
    }

    const entries: [string, any][] = await store.entries()
    let restored = 0

    console.log(`[PERSISTENT-REF] Tauri store has ${entries.length} entries`)

    for (const [key, value] of entries) {
      // useStorage serializes to JSON, so we need to match that format
      localStorage.setItem(key, JSON.stringify(value))
      restored++
      console.log(`[PERSISTENT-REF] Restored: ${key} =`, value)
    }

    if (restored > 0) {
      console.log(`[PERSISTENT-REF] Restored ${restored} UI preferences from Tauri store`)
    } else {
      console.log('[PERSISTENT-REF] No saved preferences found in Tauri store (first run?)')
    }
  } catch (e) {
    console.warn('[PERSISTENT-REF] Failed to preload Tauri UI state:', e)
  }
}

// Debounce timer for batch saves
let saveTimeout: ReturnType<typeof setTimeout> | null = null
const pendingKeys = new Set<string>()

/**
 * Debounced save to Tauri store (batches rapid changes)
 */
function scheduleTauriSave(key: string) {
  pendingKeys.add(key)

  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    const store = await getTauriStore()
    if (!store) return

    try {
      await store.save()
      console.log(`[PERSISTENT-REF] Flushed ${pendingKeys.size} keys to disk:`, [...pendingKeys])
      pendingKeys.clear()
    } catch (e) {
      console.warn('[PERSISTENT-REF] Failed to save Tauri store:', e)
    }
  }, 500) // 500ms debounce for batch disk writes
}

/**
 * Create a persistent reactive ref that survives app restarts in both
 * browser and Tauri environments.
 *
 * Usage: const myPref = usePersistentRef<boolean>('flowstate:my-pref', false)
 *
 * @param key - Storage key (use flowstate: prefix for new keys)
 * @param defaultValue - Default value if nothing persisted
 * @param legacyKey - Optional old localStorage key to migrate from
 * @returns Reactive ref backed by localStorage + Tauri store
 */
export function usePersistentRef<T>(key: string, defaultValue: T, legacyKey?: string): RemovableRef<T> {
  // Migrate from legacy localStorage key if it exists and new key doesn't
  if (legacyKey) {
    const legacyValue = localStorage.getItem(legacyKey)
    if (legacyValue && !localStorage.getItem(key)) {
      localStorage.setItem(key, legacyValue)
      // Don't remove legacy key yet — other code might still read it
      console.log(`[PERSISTENT-REF] Migrated ${legacyKey} → ${key}`)
    }
  }

  // useStorage provides reactive localStorage binding
  const storageRef = useStorage<T>(key, defaultValue)

  // In Tauri, also persist to native store for reliability
  if (isTauriEnv()) {
    watch(storageRef, async (newValue) => {
      const store = await getTauriStore()
      if (!store) return

      try {
        await store.set(key, newValue)
        scheduleTauriSave(key)
      } catch (e) {
        console.warn(`[PERSISTENT-REF] Failed to write ${key} to Tauri store:`, e)
      }
    }, { deep: true })
  }

  return storageRef
}
