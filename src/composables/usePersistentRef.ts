import { useStorage, type RemovableRef } from '@vueuse/core'

export async function preloadTauriUiState(): Promise<void> {
  // Compatibility no-op retained for existing startup imports.
}

async function getTauriStore(): Promise<null> {
  return null
}

function isTauriEnv(): boolean {
  return false
}

function scheduleTauriSave(_key: string) {
  // Compatibility no-op retained for existing persistence callers.
}

export { getTauriStore, isTauriEnv, scheduleTauriSave }

export function usePersistentRef<T>(key: string, defaultValue: T, legacyKey?: string): RemovableRef<T> {
  if (legacyKey) {
    const legacyValue = localStorage.getItem(legacyKey)
    if (legacyValue && !localStorage.getItem(key)) {
      localStorage.setItem(key, legacyValue)
      console.log(`[PERSISTENT-REF] Migrated ${legacyKey} -> ${key}`)
    }
  }

  return useStorage<T>(key, defaultValue)
}
