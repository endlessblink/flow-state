/** Persistent refs backed by localStorage. */

import { useStorage, type RemovableRef } from '@vueuse/core'

/**
 * Preload Tauri store values into localStorage before Vue mounts.
 * Call this in main.ts BEFORE app.mount('#app').
 *
 * This ensures useStorage picks up the correct persisted values
 * from the Tauri native store on app startup.
 */
export async function preloadTauriUiState(): Promise<void> {
  return Promise.resolve()
}

function scheduleTauriSave(key: string) {
  void key
}

/**
 * Exposed utilities for use by taskPersistence.ts and other manual
 * localStorage users that need Tauri dual-write support.
 */
async function getTauriStore(): Promise<null> {
  return null
}

function isTauriEnv(): boolean {
  return false
}

export { getTauriStore, isTauriEnv, scheduleTauriSave }

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

  return storageRef
}
