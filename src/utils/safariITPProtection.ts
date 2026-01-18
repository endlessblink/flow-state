/**
 * Safari ITP (Intelligent Tracking Prevention) Protection
 *
 * Safari's ITP deletes ALL IndexedDB data after 7 days without user interaction.
 * This utility monitors the time since last interaction and warns users before
 * data is at risk of being deleted.
 *
 * @safety This utility is READ-ONLY and does not perform any sync operations.
 *         It only monitors and warns - user must manually trigger sync.
 *
 * References:
 * - https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
 * - Safari 13.1+ deletes all data after 7 days of no "user interaction"
 */

import { ref, computed, readonly } from 'vue'

// LocalStorage key for tracking last interaction
const LAST_INTERACTION_KEY = 'flowstate_last_user_interaction'
const ITP_CHECK_KEY = 'flowstate_itp_warned'

// Safari ITP deletes after 7 days, warn at 5 days
export const ITP_THRESHOLDS = {
  WARNING_DAYS: 5,      // Show warning at 5 days
  CRITICAL_DAYS: 6,     // Show critical warning at 6 days
  DELETION_DAYS: 7      // Safari deletes at 7 days
} as const

// State interface
export interface ITPState {
  isSafari: boolean
  daysSinceInteraction: number
  lastInteraction: Date | null
  isWarning: boolean        // 5-6 days
  isCritical: boolean       // 6-7 days
  isAtRisk: boolean         // Any warning state
  hasBeenWarned: boolean    // User already saw warning this session
}

// Singleton state
const itpState = ref<ITPState>({
  isSafari: false,
  daysSinceInteraction: 0,
  lastInteraction: null,
  isWarning: false,
  isCritical: false,
  isAtRisk: false,
  hasBeenWarned: false
})

/**
 * Detect if browser is Safari (excluding Chrome/Edge/Firefox on iOS)
 */
export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent.toLowerCase()

  // Safari on macOS or iOS
  const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('firefox')

  // Also check for iOS (which uses Safari engine regardless of browser)
  const isIOS = /iphone|ipad|ipod/.test(ua)

  return isSafari || isIOS
}

/**
 * Get the last recorded user interaction timestamp
 */
export function getLastInteraction(): Date | null {
  try {
    const stored = localStorage.getItem(LAST_INTERACTION_KEY)
    if (stored) {
      const date = new Date(stored)
      // Validate it's a real date
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  } catch {
    // localStorage might not be available
  }
  return null
}

/**
 * Record a user interaction (call this on meaningful user actions)
 * This resets the ITP 7-day counter
 */
export function recordUserInteraction(): void {
  try {
    const now = new Date().toISOString()
    localStorage.setItem(LAST_INTERACTION_KEY, now)

    // Update state
    itpState.value = {
      ...itpState.value,
      lastInteraction: new Date(),
      daysSinceInteraction: 0,
      isWarning: false,
      isCritical: false,
      isAtRisk: false
    }

    console.log('[SafariITP] User interaction recorded - ITP counter reset')
  } catch {
    // localStorage might not be available
  }
}

/**
 * Calculate days since last interaction
 */
function getDaysSinceInteraction(lastInteraction: Date | null): number {
  if (!lastInteraction) return 0

  const now = new Date()
  const diffMs = now.getTime() - lastInteraction.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return Math.max(0, diffDays)
}

/**
 * Check current ITP status
 */
export function checkITPStatus(): ITPState {
  const isSafari = isSafariBrowser()
  const lastInteraction = getLastInteraction()
  const daysSinceInteraction = getDaysSinceInteraction(lastInteraction)

  const isWarning = isSafari && daysSinceInteraction >= ITP_THRESHOLDS.WARNING_DAYS
  const isCritical = isSafari && daysSinceInteraction >= ITP_THRESHOLDS.CRITICAL_DAYS
  const isAtRisk = isWarning || isCritical

  // Check if user was already warned this session
  let hasBeenWarned = false
  try {
    hasBeenWarned = sessionStorage.getItem(ITP_CHECK_KEY) === 'true'
  } catch {
    // sessionStorage might not be available
  }

  itpState.value = {
    isSafari,
    daysSinceInteraction,
    lastInteraction,
    isWarning,
    isCritical,
    isAtRisk,
    hasBeenWarned
  }

  // Log warnings
  if (isCritical) {
    console.warn(`[SafariITP] CRITICAL: ${daysSinceInteraction} days since last interaction. Data may be deleted tomorrow!`)
  } else if (isWarning) {
    console.warn(`[SafariITP] WARNING: ${daysSinceInteraction} days since last interaction. Sync or export your data soon.`)
  }

  return itpState.value
}

/**
 * Mark that user has been warned this session (to avoid spam)
 */
export function markAsWarned(): void {
  try {
    sessionStorage.setItem(ITP_CHECK_KEY, 'true')
    itpState.value = {
      ...itpState.value,
      hasBeenWarned: true
    }
  } catch {
    // sessionStorage might not be available
  }
}

/**
 * Get warning message for UI display
 */
export function getITPWarningMessage(): string | null {
  const state = itpState.value

  if (!state.isSafari) return null
  if (!state.isAtRisk) return null

  const daysLeft = ITP_THRESHOLDS.DELETION_DAYS - state.daysSinceInteraction

  if (state.isCritical) {
    return `Your data may be deleted by Safari in ${daysLeft} day${daysLeft === 1 ? '' : 's'}! Please sync or export your data immediately.`
  }

  if (state.isWarning) {
    return `Safari may delete your data in ${daysLeft} days. Consider syncing or exporting your data.`
  }

  return null
}

/**
 * Initialize ITP protection on app start
 * - Records initial interaction if none exists
 * - Checks current status
 */
export function initializeITPProtection(): ITPState {
  // If no last interaction recorded, start tracking now
  if (!getLastInteraction()) {
    recordUserInteraction()
  }

  return checkITPStatus()
}

/**
 * Composable for using ITP protection in Vue components
 */
export function useSafariITPProtection() {
  // Computed helpers
  const isSafari = computed(() => itpState.value.isSafari)
  const isAtRisk = computed(() => itpState.value.isAtRisk)
  const isWarning = computed(() => itpState.value.isWarning)
  const isCritical = computed(() => itpState.value.isCritical)
  const daysSinceInteraction = computed(() => itpState.value.daysSinceInteraction)
  const warningMessage = computed(() => getITPWarningMessage())
  const shouldShowWarning = computed(() =>
    itpState.value.isAtRisk && !itpState.value.hasBeenWarned
  )

  return {
    // State (readonly)
    state: readonly(itpState),

    // Computed helpers
    isSafari,
    isAtRisk,
    isWarning,
    isCritical,
    daysSinceInteraction,
    warningMessage,
    shouldShowWarning,

    // Actions
    checkStatus: checkITPStatus,
    recordInteraction: recordUserInteraction,
    markAsWarned,
    initialize: initializeITPProtection,

    // Constants
    THRESHOLDS: ITP_THRESHOLDS
  }
}

// Export singleton state
export { itpState }
