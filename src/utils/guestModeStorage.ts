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
  'flow-state-local-user',

  // Filters and view state
  'flow-state-filters',
  'flow-state-kanban-settings',

  // Backups (no data to backup in guest mode)
  'flow-state-backup-history',
  'flow-state-latest-backup',
  'flow-state-golden-backup',
  'flow-state-max-task-count',
  'flow-state-simple-latest-backup',

  // Quick Sort
  'quickSort_sessionHistory',
  'quickSort_lastCompletedDate',

  // Other user-specific data
  'recent-emojis',
  'flow-state-local-banner-dismissed',
  'flow-state-offline-queue',

  // UI state
  'flow-state-ui-state',
  'flow-state-theme'
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
