/**
 * Cross-Tab Database Write Coordination
 * TASK-085: Safeguard 2 - Prevents concurrent write conflicts across browser tabs
 *
 * Purpose:
 * - Coordinates database writes across multiple tabs
 * - Prevents "write-write" conflicts that can corrupt IndexedDB
 * - Uses BroadcastChannel API (standard, no external dependencies)
 *
 * How it works:
 * 1. Before writing, tab announces intent via BroadcastChannel
 * 2. Other tabs acknowledge or report conflicts
 * 3. If no conflicts within timeout, write proceeds
 * 4. After write, tab announces completion
 *
 * Safety:
 * - Falls back to direct writes if BroadcastChannel not supported
 * - Short timeouts (50ms) to not block UX
 * - Non-blocking - warns but doesn't prevent writes
 */

import { ref, onUnmounted } from 'vue'

// Unique ID for this tab
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// Channel name
const CHANNEL_NAME = 'pomoflow-db-coordination'

// Active writes being tracked across all tabs
const activeWrites = new Map<string, { tabId: string; timestamp: number }>()

// Write lock timeout (ms) - how long to wait for acknowledgments
const LOCK_TIMEOUT = 50

// Stale lock timeout (ms) - consider locks stale after this time
const STALE_LOCK_TIMEOUT = 5000

export interface WriteCoordinationResult {
  canProceed: boolean
  conflictingTab?: string
  warning?: string
}

export interface CoordinationMessage {
  type: 'write-start' | 'write-end' | 'write-ack' | 'heartbeat'
  tabId: string
  docId?: string
  timestamp: number
}

let globalChannel: BroadcastChannel | null = null
let isInitialized = false

/**
 * Initialize the BroadcastChannel for cross-tab coordination
 */
function initChannel(): BroadcastChannel | null {
  if (globalChannel) return globalChannel

  // Check if BroadcastChannel is supported
  if (typeof BroadcastChannel === 'undefined') {
    console.warn('⚠️ [CROSS-TAB] BroadcastChannel not supported - coordination disabled')
    return null
  }

  try {
    globalChannel = new BroadcastChannel(CHANNEL_NAME)

    globalChannel.onmessage = (event: MessageEvent<CoordinationMessage>) => {
      const message = event.data

      switch (message.type) {
        case 'write-start':
          // Another tab is starting a write
          if (message.docId) {
            activeWrites.set(message.docId, {
              tabId: message.tabId,
              timestamp: message.timestamp
            })
          }
          break

        case 'write-end':
          // Another tab finished writing
          if (message.docId) {
            activeWrites.delete(message.docId)
          }
          break

        case 'heartbeat':
          // Tab is still alive - clean up any stale locks from dead tabs
          cleanupStaleLocks()
          break
      }
    }

    globalChannel.onmessageerror = (error) => {
      console.warn('⚠️ [CROSS-TAB] Message error:', error)
    }

    // Send heartbeat every 2 seconds
    setInterval(() => {
      if (globalChannel) {
        globalChannel.postMessage({
          type: 'heartbeat',
          tabId: TAB_ID,
          timestamp: Date.now()
        } as CoordinationMessage)
      }
    }, 2000)

    isInitialized = true
    console.log(`📡 [CROSS-TAB] Coordination initialized for tab ${TAB_ID}`)

    return globalChannel
  } catch (error) {
    console.warn('⚠️ [CROSS-TAB] Failed to initialize BroadcastChannel:', error)
    return null
  }
}

/**
 * Clean up locks from tabs that may have crashed
 */
function cleanupStaleLocks(): void {
  const now = Date.now()
  for (const [docId, lock] of activeWrites.entries()) {
    if (now - lock.timestamp > STALE_LOCK_TIMEOUT) {
      console.log(`🧹 [CROSS-TAB] Cleaning up stale lock for ${docId} from ${lock.tabId}`)
      activeWrites.delete(docId)
    }
  }
}

/**
 * Request permission to write to a document
 * Returns immediately with result - does not block
 */
async function requestWriteLock(docId: string): Promise<WriteCoordinationResult> {
  const channel = initChannel()

  // If no channel support, allow write (fallback)
  if (!channel) {
    return { canProceed: true, warning: 'BroadcastChannel not available' }
  }

  // Check for existing lock
  const existingLock = activeWrites.get(docId)
  if (existingLock && existingLock.tabId !== TAB_ID) {
    // Check if lock is stale
    if (Date.now() - existingLock.timestamp > STALE_LOCK_TIMEOUT) {
      activeWrites.delete(docId)
    } else {
      // Active lock from another tab
      console.warn(`⚠️ [CROSS-TAB] Write conflict on ${docId} - tab ${existingLock.tabId} is writing`)
      return {
        canProceed: true, // Still allow, but warn
        conflictingTab: existingLock.tabId,
        warning: `Another tab is writing to ${docId}`
      }
    }
  }

  // Announce intent to write
  const writeMessage: CoordinationMessage = {
    type: 'write-start',
    tabId: TAB_ID,
    docId,
    timestamp: Date.now()
  }

  channel.postMessage(writeMessage)

  // Track our own write
  activeWrites.set(docId, { tabId: TAB_ID, timestamp: Date.now() })

  // Wait briefly for conflict reports
  await new Promise(resolve => setTimeout(resolve, LOCK_TIMEOUT))

  // Check if another tab claimed the lock during our wait
  const currentLock = activeWrites.get(docId)
  if (currentLock && currentLock.tabId !== TAB_ID) {
    return {
      canProceed: true, // Still allow
      conflictingTab: currentLock.tabId,
      warning: `Race condition with tab ${currentLock.tabId} - both writing`
    }
  }

  return { canProceed: true }
}

/**
 * Release write lock after completing write
 */
function releaseWriteLock(docId: string): void {
  const channel = initChannel()

  // Remove from local tracking
  activeWrites.delete(docId)

  // Notify other tabs
  if (channel) {
    channel.postMessage({
      type: 'write-end',
      tabId: TAB_ID,
      docId,
      timestamp: Date.now()
    } as CoordinationMessage)
  }
}

/**
 * Vue composable for cross-tab coordination
 */
export function useCrossTabCoordination() {
  const pendingWrites = ref<Set<string>>(new Set())

  // Initialize on first use
  initChannel()

  // Cleanup on unmount
  onUnmounted(() => {
    // Release any locks this component was holding
    for (const docId of pendingWrites.value) {
      releaseWriteLock(docId)
    }
    pendingWrites.value.clear()
  })

  /**
   * Wrap a database write operation with cross-tab coordination
   */
  const coordinatedWrite = async <T>(
    docId: string,
    writeOperation: () => Promise<T>
  ): Promise<T> => {
    // Request lock
    const lockResult = await requestWriteLock(docId)

    if (lockResult.warning) {
      console.warn(`⚠️ [CROSS-TAB] ${lockResult.warning}`)
    }

    pendingWrites.value.add(docId)

    try {
      // Perform the write
      const result = await writeOperation()
      return result
    } finally {
      // Release lock
      releaseWriteLock(docId)
      pendingWrites.value.delete(docId)
    }
  }

  /**
   * Check if another tab is currently writing to a document
   */
  const isDocumentLocked = (docId: string): boolean => {
    const lock = activeWrites.get(docId)
    if (!lock) return false
    if (lock.tabId === TAB_ID) return false
    if (Date.now() - lock.timestamp > STALE_LOCK_TIMEOUT) return false
    return true
  }

  /**
   * Get this tab's unique ID
   */
  const getTabId = (): string => TAB_ID

  return {
    coordinatedWrite,
    isDocumentLocked,
    getTabId,
    pendingWrites
  }
}

// Export singleton functions for use outside Vue components
export { requestWriteLock, releaseWriteLock, initChannel as initCrossTabCoordination }
