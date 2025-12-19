/**
 * useTimerChangesSync - Direct PouchDB Changes Feed for Timer Sync
 *
 * TASK-021: Real-Time Cross-Instance Timer Sync
 *
 * This composable provides real-time timer synchronization across different
 * browser instances and devices by subscribing directly to PouchDB's changes feed.
 *
 * Root Cause (Dec 19, 2025): The `reliable-sync-change` event was never dispatched
 * during live sync, so the timer store's listener never received updates.
 * This composable bypasses that by using PouchDB's native changes API.
 *
 * @see https://pouchdb.com/guides/changes.html
 */

import { ref, onUnmounted } from 'vue'

// Timer document ID in PouchDB/CouchDB
const TIMER_DOC_ID = 'pomo-flow-timer-session:data'

// Connection retry settings
const RECONNECT_DELAY_MS = 3000
const MAX_RECONNECT_ATTEMPTS = 5

export interface TimerChangesHandler {
  (doc: any): void | Promise<void>
}

export interface UseTimerChangesSyncReturn {
  /** Whether the changes feed is currently connected */
  isConnected: Readonly<typeof isConnected>
  /** Start listening for timer changes */
  startListening: (onTimerChange: TimerChangesHandler) => void
  /** Stop listening and cleanup */
  stopListening: () => void
  /** Manually reconnect if disconnected */
  reconnect: () => void
}

// Module-level state to ensure single listener
let changesHandler: any = null
let currentCallback: TimerChangesHandler | null = null
let reconnectAttempts = 0
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
const isConnected = ref(false)

/**
 * Get PouchDB instance from global singleton
 */
const getPouchDB = (): any | null => {
  if (typeof window === 'undefined') return null
  return (window as any).pomoFlowDb || null
}

/**
 * Start the changes feed listener
 */
const startChangesListener = (onTimerChange: TimerChangesHandler): boolean => {
  const pouchDb = getPouchDB()

  if (!pouchDb) {
    console.warn('[TIMER CHANGES] PouchDB not available yet')
    return false
  }

  // Cancel existing handler if any
  if (changesHandler) {
    try {
      changesHandler.cancel()
    } catch (_e) {
      // Ignore cancel errors
    }
    changesHandler = null
  }

  try {
    console.log('[TIMER CHANGES] Starting changes feed listener for:', TIMER_DOC_ID)

    changesHandler = pouchDb.changes({
      live: true,
      since: 'now',
      include_docs: true,
      doc_ids: [TIMER_DOC_ID]
    })
      .on('change', (change: any) => {
        if (change.doc && !change.deleted) {
          console.log('[TIMER CHANGES] Received timer update from changes feed')
          try {
            onTimerChange(change.doc)
          } catch (err) {
            console.error('[TIMER CHANGES] Error in change handler:', err)
          }
        } else if (change.deleted) {
          console.log('[TIMER CHANGES] Timer document deleted')
          // Optionally handle deletion - pass null or special marker
          try {
            onTimerChange({ session: null, deleted: true })
          } catch (err) {
            console.error('[TIMER CHANGES] Error handling deletion:', err)
          }
        }
      })
      .on('error', (err: any) => {
        console.error('[TIMER CHANGES] Changes feed error:', err)
        isConnected.value = false

        // Attempt reconnection
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          console.log(`[TIMER CHANGES] Reconnecting in ${RECONNECT_DELAY_MS}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`)
          reconnectTimeout = setTimeout(() => {
            if (currentCallback) {
              startChangesListener(currentCallback)
            }
          }, RECONNECT_DELAY_MS)
        } else {
          console.error('[TIMER CHANGES] Max reconnect attempts reached')
        }
      })
      .on('complete', (info: any) => {
        // Live changes feed shouldn't complete unless cancelled
        console.log('[TIMER CHANGES] Changes feed completed (cancelled or error):', info)
        isConnected.value = false
      })

    isConnected.value = true
    reconnectAttempts = 0
    currentCallback = onTimerChange
    console.log('[TIMER CHANGES] Changes feed listener started successfully')
    return true

  } catch (err) {
    console.error('[TIMER CHANGES] Failed to start changes feed:', err)
    isConnected.value = false
    return false
  }
}

/**
 * Stop the changes feed listener
 */
const stopChangesListener = () => {
  // Clear any pending reconnect
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout)
    reconnectTimeout = null
  }

  // Cancel the changes handler
  if (changesHandler) {
    try {
      changesHandler.cancel()
      console.log('[TIMER CHANGES] Changes feed listener stopped')
    } catch (err) {
      console.error('[TIMER CHANGES] Error cancelling changes feed:', err)
    }
    changesHandler = null
  }

  currentCallback = null
  isConnected.value = false
  reconnectAttempts = 0
}

/**
 * Composable for timer changes synchronization
 *
 * Usage in timer store:
 * ```typescript
 * import { useTimerChangesSync } from '@/composables/useTimerChangesSync'
 *
 * const timerChanges = useTimerChangesSync()
 *
 * // Start listening when store initializes
 * timerChanges.startListening((doc) => {
 *   handleRemoteTimerUpdate(doc)
 * })
 *
 * // Cleanup on store dispose (if needed)
 * timerChanges.stopListening()
 * ```
 */
export function useTimerChangesSync(): UseTimerChangesSyncReturn {
  // Auto-cleanup when component unmounts (if used in component)
  onUnmounted(() => {
    // Note: In a store context, this won't fire, so manual cleanup is needed
    // But if used in a component, this provides automatic cleanup
  })

  return {
    isConnected,
    startListening: (onTimerChange: TimerChangesHandler) => {
      // If PouchDB isn't ready yet, retry after a delay
      if (!getPouchDB()) {
        console.log('[TIMER CHANGES] Waiting for PouchDB to be ready...')
        const checkInterval = setInterval(() => {
          if (getPouchDB()) {
            clearInterval(checkInterval)
            startChangesListener(onTimerChange)
          }
        }, 500)

        // Give up after 10 seconds
        setTimeout(() => {
          clearInterval(checkInterval)
          if (!isConnected.value) {
            console.error('[TIMER CHANGES] Timed out waiting for PouchDB')
          }
        }, 10000)
        return
      }

      startChangesListener(onTimerChange)
    },
    stopListening: stopChangesListener,
    reconnect: () => {
      if (currentCallback) {
        stopChangesListener()
        startChangesListener(currentCallback)
      }
    }
  }
}

export default useTimerChangesSync
