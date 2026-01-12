/**
 * useTimerChangesSync - STUBBED
 *
 * BUG-024: This composable previously provided real-time timer synchronization
 * using PouchDB's changes feed. The app has migrated to Supabase, so this
 * functionality is currently disabled.
 *
 * TODO: Implement Supabase Realtime timer sync when needed
 */

import { ref, readonly } from 'vue'

export interface TimerChangesHandler {
  (doc: unknown): void | Promise<void>
}

export interface UseTimerChangesSyncReturn {
  /** Whether the changes feed is currently connected (always false - stubbed) */
  isConnected: ReturnType<typeof readonly<typeof isConnected>>
  /** Start listening for timer changes (no-op - stubbed) */
  startListening: (onTimerChange: TimerChangesHandler) => void
  /** Stop listening and cleanup (no-op - stubbed) */
  stopListening: () => void
  /** Manually reconnect if disconnected (no-op - stubbed) */
  reconnect: () => void
}

const isConnected = ref(false)

/**
 * STUBBED: Timer changes sync composable
 *
 * Previously used PouchDB changes feed for real-time timer sync.
 * Now returns no-op functions since PouchDB has been replaced with Supabase.
 */
export function useTimerChangesSync(): UseTimerChangesSyncReturn {
  if (import.meta.env.DEV) {
    console.warn('[useTimerChangesSync] STUB - timer sync disabled (PouchDB removed, Supabase pending)')
  }

  return {
    isConnected: readonly(isConnected),
    startListening: (_onTimerChange: TimerChangesHandler) => {
      // No-op: PouchDB removed, Supabase timer sync not yet implemented
    },
    stopListening: () => {
      // No-op
    },
    reconnect: () => {
      // No-op
    }
  }
}

export default useTimerChangesSync
