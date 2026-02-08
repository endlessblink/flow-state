/**
 * Guest Mode Storage Utility
 *
 * Ensures guest mode is fully ephemeral - no data persists across page refreshes.
 * All localStorage keys in GUEST_EPHEMERAL_KEYS are cleared on app startup for guests.
 */

// Keys that should NOT persist in guest mode (user data)
// Guest mode is fully ephemeral - tasks are cleared on app restart.
// Same-session sign-in can still migrate tasks before any restart.
//
// BUG-339: Historical keys that may still exist from older versions
// TASK-1267: Old key names that may exist from previous versions
const LEGACY_GUEST_KEYS = [
  'pomoflow-guest-tasks',
  'pomoflow-guest-groups',
  // Pre-TASK-1267 flow-state-* keys
  'flow-state-local-user',
  'flow-state-filters',
  'flow-state-kanban-settings',
  'flow-state-backup-history',
  'flow-state-latest-backup',
  'flow-state-golden-backup',
  'flow-state-max-task-count',
  'flow-state-simple-latest-backup',
  'flow-state-local-banner-dismissed',
  'flow-state-offline-queue',
  'flow-state-ui-state',
  'flow-state-theme',
  'canvas-viewport',
  'recent-emojis',
  'quickSort_sessionHistory',
  'quickSort_lastCompletedDate',
]

const GUEST_EPHEMERAL_KEYS = [
  // Tasks (ephemeral in guest mode - sign in to persist)
  'flowstate-guest-tasks',

  // Canvas
  'flowstate-guest-groups',
  'flowstate-canvas-viewport',
  'flowstate-canvas-has-initial-fit',
  'flowstate-canvas-locks',

  // Local auth
  'flowstate-local-user',

  // Filters and view state
  'flowstate-filters',

  // Backups (no data to backup in guest mode)
  'flowstate-backup-history',
  'flowstate-backup-latest',
  'flowstate-backup-golden',
  'flowstate-max-task-count',

  // Quick Sort
  'flowstate-quicksort-history',
  'flowstate-quicksort-last-date',

  // Other user-specific data
  'flowstate-recent-emojis',
  'flowstate-local-banner-dismissed',
  'flowstate-offline-queue',

  // UI state
  'flowstate-ui-state',
]

/**
 * Clear all guest-ephemeral localStorage keys.
 * Called on app startup when user is not authenticated.
 */
export function clearGuestData(): void {
  let clearedCount = 0

  // Clear current ephemeral keys
  for (const key of GUEST_EPHEMERAL_KEYS) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key)
      clearedCount++
    }
  }

  // BUG-339: Also clear legacy keys from older versions
  for (const key of LEGACY_GUEST_KEYS) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key)
      clearedCount++
      console.log(`🧹 [BUG-339] Cleared legacy key: ${key}`)
    }
  }

  if (clearedCount > 0) {
    console.log(`🧹 [GUEST-MODE] Cleared ${clearedCount} localStorage keys for fresh guest session`)
  }
}

/**
 * BUG-339: Clear stale guest task data when user is authenticated.
 * This prevents localStorage contamination from causing duplicates.
 */
export function clearStaleGuestTasks(): void {
  const keysToCheck = [
    'flowstate-guest-tasks',
    'pomoflow-guest-tasks',  // Legacy key
  ]

  for (const key of keysToCheck) {
    const data = localStorage.getItem(key)
    if (data) {
      try {
        const tasks = JSON.parse(data)
        console.log(`🧹 [BUG-339] Clearing stale ${key} (had ${tasks.length} tasks)`)
      } catch {
        console.log(`🧹 [BUG-339] Clearing corrupted ${key}`)
      }
      localStorage.removeItem(key)
    }
  }
}

/**
 * Get list of ephemeral keys (for debugging/testing)
 */
export function getGuestEphemeralKeys(): readonly string[] {
  return GUEST_EPHEMERAL_KEYS
}
