/**
 * useDatabase STUB
 *
 * ARCHIVED: Jan 2026 - Original PouchDB compatibility layer moved to src/_archived/legacy-pouchdb/
 *
 * This stub maintains API compatibility for legacy imports.
 * Actual data operations use useSupabaseDatabase().
 *
 * TODO (TASK-117): Remove all useDatabase imports and delete this stub.
 */

import { ref } from 'vue'

export interface DetectedConflict {
  docId: string
  type: string
  localRev: string
  remoteRev: string
}

export const DB_KEYS = {
  TASKS: 'tasks',
  PROJECTS: 'projects',
  CANVAS: 'canvas'
} as const

export function useDatabase() {
  const conflicts = ref<DetectedConflict[]>([])
  const isSyncing = ref(false)
  const syncStatus = ref('idle')

  return {
    conflicts,
    isSyncing,
    syncStatus,
    clear: async () => console.warn('[useDatabase] STUB: Use Supabase directly'),
    save: async () => console.warn('[useDatabase] STUB: Use useSupabaseDatabase'),
    load: async () => console.warn('[useDatabase] STUB: Use useSupabaseDatabase'),
    startSync: async () => console.warn('[useDatabase] STUB: Supabase syncs automatically'),
    stopSync: async () => {},
    resolveConflict: async () => console.warn('[useDatabase] STUB: Conflicts handled by Supabase'),
    getConflicts: () => [],
    clearConflicts: () => {}
  }
}

export default useDatabase
