/**
 * DEPRECATED: Legacy PouchDB compatibility layer
 *
 * This file provides backward compatibility for code that still imports useDatabase.
 * The app has migrated to Supabase - use useSupabaseDatabase instead.
 */

import { ref } from 'vue'
import { useSupabaseDatabase } from './useSupabaseDatabase'

// Legacy DB_KEYS constant for compatibility
export const DB_KEYS = {
  TASKS: 'tasks',
  PROJECTS: 'projects',
  CANVAS: 'canvas',
  TIMER: 'timer',
  SETTINGS: 'settings',
  NOTIFICATIONS: 'notifications'
} as const

export interface DetectedConflict {
  docId: string
  docType: string
  localRev: string
  remoteRev: string
  detectedAt: Date
}

export function useDatabase() {
  const supabase = useSupabaseDatabase()

  // Legacy compatibility refs
  const isConnected = ref(true)
  const isSyncing = ref(false)
  const syncError = ref<string | null>(null)
  const detectedConflicts = ref<DetectedConflict[]>([])

  // Stub methods for legacy code
  const clear = async () => {
    console.warn('[useDatabase] clear() is deprecated - data is in Supabase')
  }

  const save = async <T>(_key: string, _data: T): Promise<void> => {
    console.warn('[useDatabase] save() is deprecated - use useSupabaseDatabase')
  }

  const load = async <T>(_key: string): Promise<T | null> => {
    console.warn('[useDatabase] load() is deprecated - use useSupabaseDatabase')
    return null
  }

  const startSync = async () => {
    console.warn('[useDatabase] startSync() is deprecated - Supabase syncs automatically')
  }

  const stopSync = async () => {
    console.warn('[useDatabase] stopSync() is deprecated')
  }

  const getConflicts = async () => {
    return []
  }

  const resolveConflict = async (_docId: string, _winningRev: string) => {
    console.warn('[useDatabase] resolveConflict() is deprecated')
  }

  return {
    // State
    isConnected,
    isSyncing,
    syncError,
    detectedConflicts,

    // Methods
    clear,
    save,
    load,
    startSync,
    stopSync,
    getConflicts,
    resolveConflict,

    // Pass through to Supabase
    ...supabase
  }
}

export default useDatabase
