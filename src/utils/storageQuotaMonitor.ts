/**
 * Storage Quota Monitor
 *
 * READ-ONLY monitoring utility for IndexedDB storage quota.
 * Provides reactive state for quota usage and warnings.
 * Does NOT perform any cleanup - just monitoring and notifications.
 *
 * @safety This utility is READ-ONLY and does not modify any data.
 */

import { ref, computed, readonly } from 'vue'

// Thresholds for warnings (percentage of quota used)
export const QUOTA_THRESHOLDS = {
  WARNING: 80,   // Yellow warning at 80%
  CRITICAL: 95   // Red critical at 95%
} as const

// Quota state interface
export interface QuotaState {
  usage: number        // Bytes used
  quota: number        // Total quota in bytes
  percentUsed: number  // Percentage 0-100
  isWarning: boolean   // > 80%
  isCritical: boolean  // > 95%
  lastChecked: Date | null
  error: string | null
}

// Singleton state
const quotaState = ref<QuotaState>({
  usage: 0,
  quota: 0,
  percentUsed: 0,
  isWarning: false,
  isCritical: false,
  lastChecked: null,
  error: null
})

// Is navigator.storage.estimate() available?
const isStorageAPIAvailable = typeof navigator !== 'undefined' &&
  'storage' in navigator &&
  'estimate' in navigator.storage

/**
 * Check current storage quota usage
 * @returns Updated quota state
 */
export async function checkStorageQuota(): Promise<QuotaState> {
  if (!isStorageAPIAvailable) {
    quotaState.value = {
      ...quotaState.value,
      error: 'Storage API not available in this browser',
      lastChecked: new Date()
    }
    return quotaState.value
  }

  try {
    const estimate = await navigator.storage.estimate()

    const usage = estimate.usage || 0
    const quota = estimate.quota || 0
    const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0

    quotaState.value = {
      usage,
      quota,
      percentUsed,
      isWarning: percentUsed >= QUOTA_THRESHOLDS.WARNING,
      isCritical: percentUsed >= QUOTA_THRESHOLDS.CRITICAL,
      lastChecked: new Date(),
      error: null
    }

    // Log warnings to console for debugging
    if (quotaState.value.isCritical) {
      console.warn(`[StorageQuotaMonitor] CRITICAL: Storage at ${percentUsed}% (${formatBytes(usage)} / ${formatBytes(quota)})`)
    } else if (quotaState.value.isWarning) {
      console.warn(`[StorageQuotaMonitor] WARNING: Storage at ${percentUsed}% (${formatBytes(usage)} / ${formatBytes(quota)})`)
    }

    return quotaState.value
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error checking storage quota'

    quotaState.value = {
      ...quotaState.value,
      error: errorMessage,
      lastChecked: new Date()
    }

    console.error('[StorageQuotaMonitor] Error checking quota:', errorMessage)
    return quotaState.value
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Get quota status message for UI display
 */
export function getQuotaStatusMessage(): string {
  const state = quotaState.value

  if (state.error) {
    return `Storage status unknown: ${state.error}`
  }

  if (state.quota === 0) {
    return 'Storage quota not available'
  }

  const used = formatBytes(state.usage)
  const total = formatBytes(state.quota)

  if (state.isCritical) {
    return `Storage CRITICAL: ${state.percentUsed}% used (${used} / ${total}). Please export data and delete old tasks.`
  }

  if (state.isWarning) {
    return `Storage warning: ${state.percentUsed}% used (${used} / ${total}). Consider cleaning up old data.`
  }

  return `Storage: ${state.percentUsed}% used (${used} / ${total})`
}

/**
 * Composable for using storage quota monitoring in Vue components
 */
export function useStorageQuota() {
  // Computed properties for easy access
  const percentUsed = computed(() => quotaState.value.percentUsed)
  const isWarning = computed(() => quotaState.value.isWarning)
  const isCritical = computed(() => quotaState.value.isCritical)
  const statusMessage = computed(() => getQuotaStatusMessage())
  const hasError = computed(() => quotaState.value.error !== null)

  return {
    // State (readonly to prevent accidental mutation)
    state: readonly(quotaState),

    // Computed helpers
    percentUsed,
    isWarning,
    isCritical,
    statusMessage,
    hasError,

    // Actions
    checkQuota: checkStorageQuota,
    formatBytes,

    // Constants
    THRESHOLDS: QUOTA_THRESHOLDS
  }
}

/**
 * Check if an error is a QuotaExceededError
 * Works across different browsers (Chrome, Safari, Firefox)
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false

  // Check error name
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError') return true
    if (error.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true // Firefox

    // Check error message
    const message = error.message.toLowerCase()
    if (message.includes('quota')) return true
    if (message.includes('storage')) return true
  }

  // Check error code (Safari uses code 22)
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as { code?: number; name?: string }
    if (errorObj.code === 22) return true
  }

  return false
}

// Export singleton state for direct access if needed
export { quotaState }
