/**
 * Page Close Protection Composable
 *
 * Prevents accidental data loss by warning users before closing the tab
 * when there are unsaved changes pending sync.
 *
 * @see TASK-1177 in MASTER_PLAN.md
 */

import { onMounted, onUnmounted } from 'vue'
import { useSyncStatusStore } from '@/stores/syncStatus'
import { isElectron } from '@/utils/platform'

/**
 * Hook into browser's beforeunload event to warn about unsaved changes
 *
 * Usage:
 * ```ts
 * // In MainLayout.vue or App.vue
 * useBeforeUnload()
 * ```
 */
export function useBeforeUnload() {
  const syncStore = useSyncStatusStore()

  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    // Check if there are pending changes or sync errors
    if (syncStore.hasPendingChanges || syncStore.hasErrors) {
      // Standard way to show browser's "are you sure" dialog
      event.preventDefault()
      // Chrome requires returnValue to be set
      event.returnValue = ''
      return ''
    }
  }

  onMounted(() => {
    // TASK-1871: NEVER block window close in Electron. This is a web-tab
    // "unsaved changes" guard, but in the desktop app a blocked close means the
    // app cannot quit at all (no native browser confirm dialog + no Quit menu
    // fallback) — a recurring "can't quit FlowState" regression. It's safe to
    // skip because the offline-first sync queue (TASK-1177) persists pending
    // writes to IndexedDB across restarts, so quitting never loses data.
    if (isElectron()) return
    window.addEventListener('beforeunload', handleBeforeUnload)
  })

  onUnmounted(() => {
    window.removeEventListener('beforeunload', handleBeforeUnload)
  })

  // Also watch for navigation within the app (optional - for router guards)
  // This is handled separately in the router if needed

  return {
    /**
     * Check if it's safe to leave (no pending changes)
     */
    canLeave: () => !syncStore.hasPendingChanges && !syncStore.hasErrors,

    /**
     * Get warning message for custom confirmation dialogs
     */
    getWarningMessage: () => {
      if (syncStore.hasErrors) {
        return `You have ${syncStore.failedCount} sync errors. Your changes may be lost if you leave.`
      }
      if (syncStore.hasPendingChanges) {
        return `You have ${syncStore.pendingCount} unsaved changes. Your changes may be lost if you leave.`
      }
      return ''
    }
  }
}

/**
 * Vue Router navigation guard for SPA navigation
 *
 * Usage in router/index.ts:
 * ```ts
 * router.beforeEach((to, from, next) => {
 *   if (shouldBlockNavigation()) {
 *     if (confirm('You have unsaved changes. Leave anyway?')) {
 *       next()
 *     } else {
 *       next(false)
 *     }
 *   } else {
 *     next()
 *   }
 * })
 * ```
 */
export function shouldBlockNavigation(): boolean {
  const syncStore = useSyncStatusStore()
  return syncStore.hasPendingChanges || syncStore.hasErrors
}

/**
 * Get navigation warning for router guard
 */
export function getNavigationWarning(): string | null {
  const syncStore = useSyncStatusStore()

  if (syncStore.hasErrors) {
    return `You have ${syncStore.failedCount} sync errors. Your changes may be lost if you navigate away.`
  }
  if (syncStore.hasPendingChanges) {
    return `You have ${syncStore.pendingCount} unsaved changes. They will continue syncing in the background.`
  }
  return null
}
