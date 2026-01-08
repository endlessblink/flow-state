/**
 * Guest Mode Storage Utility
 *
 * Ensures guest mode is fully ephemeral - no data persists across page refreshes.
 * All localStorage keys in GUEST_EPHEMERAL_KEYS are cleared on app startup for guests.
 */

// Keys that should NOT persist in guest mode (user data)
const GUEST_EPHEMERAL_KEYS = [
  // Canvas
  'pomoflow-guest-groups',
  'canvas-viewport',
  'pomoflow-canvas-has-initial-fit',
  'pomoflow-canvas-locks',

  // Local auth
  'pomo-flow-local-user',

  // Filters and view state
  'pomo-flow-filters',
  'pomo-flow-kanban-settings',

  // Backups (no data to backup in guest mode)
  'pomo-flow-backup-history',
  'pomo-flow-latest-backup',
  'pomo-flow-golden-backup',
  'pomo-flow-max-task-count',
  'pomo-flow-simple-latest-backup',

  // Quick Sort
  'quickSort_sessionHistory',
  'quickSort_lastCompletedDate',

  // Other user-specific data
  'recent-emojis',
  'pomo-flow-local-banner-dismissed',
  'pomo-flow-offline-queue',

  // UI state
  'pomo-flow-ui-state',
  'pomo-flow-theme'
]

/**
 * Clear all guest-ephemeral localStorage keys.
 * Called on app startup when user is not authenticated.
 */
export function clearGuestData(): void {
  let clearedCount = 0

  for (const key of GUEST_EPHEMERAL_KEYS) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key)
      clearedCount++
    }
  }

  if (clearedCount > 0) {
    console.log(`🧹 [GUEST-MODE] Cleared ${clearedCount} localStorage keys for fresh guest session`)
  }
}

/**
 * Get list of ephemeral keys (for debugging/testing)
 */
export function getGuestEphemeralKeys(): readonly string[] {
  return GUEST_EPHEMERAL_KEYS
}
