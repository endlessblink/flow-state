/**
 * Brave Browser Protection / Compatibility Detection
 *
 * Brave's Shields feature blocks:
 * 1. Cross-site trackers (can affect Supabase auth redirects)
 * 2. WebSocket connections flagged as fingerprinting
 * 3. Third-party cookies (affects OAuth flows)
 * 4. Requests to domains on filter lists
 *
 * This utility detects Brave and monitors for blocked resource errors.
 *
 * @see https://github.com/anthropics/claude-code/issues/2802
 * @see https://community.brave.app/t/brave-browser-shields-blocking-my-websocket/395377
 */

import { ref, computed, readonly } from 'vue'

// State interface
export interface BraveState {
  isBrave: boolean
  hasBlockedResources: boolean
  blockedCount: number
  lastBlockedUrl: string | null
  shieldsWarningDismissed: boolean
}

// Singleton state
const braveState = ref<BraveState>({
  isBrave: false,
  hasBlockedResources: false,
  blockedCount: 0,
  lastBlockedUrl: null,
  shieldsWarningDismissed: false
})

// LocalStorage key for persisting dismissal
const DISMISSED_KEY = 'flowstate_brave_warning_dismissed'

/**
 * Detect if browser is Brave
 * Brave exposes navigator.brave.isBrave() method
 */
export async function isBraveBrowser(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false

  // Method 1: Official Brave detection API
  const nav = navigator as Navigator & { brave?: { isBrave: () => Promise<boolean> } }
  if (nav.brave?.isBrave) {
    try {
      return await nav.brave.isBrave()
    } catch {
      // Fallback to user agent
    }
  }

  // Method 2: User agent detection (less reliable but works)
  const ua = navigator.userAgent.toLowerCase()
  return ua.includes('brave')
}

/**
 * Check if a fetch error is due to Brave Shields blocking
 */
export function isBlockedByBrave(error: Error | unknown): boolean {
  if (!error) return false

  const message = error instanceof Error ? error.message : String(error)

  // ERR_BLOCKED_BY_CLIENT is the signature error when Brave blocks a request
  if (message.includes('ERR_BLOCKED_BY_CLIENT')) return true
  if (message.includes('net::ERR_BLOCKED')) return true

  // WebSocket blocking
  if (message.includes('WebSocket connection failed') && braveState.value.isBrave) return true

  return false
}

/**
 * Record a blocked resource (call when detecting blocked requests)
 */
export function recordBlockedResource(url?: string): void {
  braveState.value = {
    ...braveState.value,
    hasBlockedResources: true,
    blockedCount: braveState.value.blockedCount + 1,
    lastBlockedUrl: url || null
  }

  console.warn('[BraveProtection] Resource blocked by Brave Shields:', url || 'unknown')
}

/**
 * Dismiss the warning banner (persisted to localStorage)
 */
export function dismissWarning(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, 'true')
    braveState.value = {
      ...braveState.value,
      shieldsWarningDismissed: true
    }
  } catch {
    // localStorage might not be available
  }
}

/**
 * Check if warning was previously dismissed
 */
function wasWarningDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Setup global error listener to detect blocked resources
 */
function setupErrorListener(): void {
  if (typeof window === 'undefined') return

  // Listen for resource loading errors
  window.addEventListener('error', (event) => {
    if (event.message?.includes('ERR_BLOCKED_BY_CLIENT') ||
        event.message?.includes('net::ERR_BLOCKED')) {
      recordBlockedResource(event.filename)
    }
  }, true)

  // Intercept fetch to detect blocked requests
  const originalFetch = window.fetch
  window.fetch = async function(...args) {
    try {
      return await originalFetch.apply(this, args)
    } catch (error) {
      if (isBlockedByBrave(error)) {
        const input = args[0]
        let url: string | undefined
        if (typeof input === 'string') {
          url = input
        } else if (input instanceof Request) {
          url = input.url
        } else if (input instanceof URL) {
          url = input.href
        }
        recordBlockedResource(url)
      }
      throw error
    }
  }
}

/**
 * Initialize Brave protection on app start
 */
export async function initializeBraveProtection(): Promise<BraveState> {
  const isBrave = await isBraveBrowser()

  braveState.value = {
    isBrave,
    hasBlockedResources: false,
    blockedCount: 0,
    lastBlockedUrl: null,
    shieldsWarningDismissed: wasWarningDismissed()
  }

  if (isBrave) {
    console.log('[BraveProtection] Brave browser detected')
    setupErrorListener()
  }

  return braveState.value
}

/**
 * Get user-friendly instructions for fixing Brave issues
 */
export function getBraveInstructions(): string[] {
  return [
    'Click the Brave Shields icon (lion) in the address bar',
    'Toggle "Shields" to OFF for this site',
    'Alternatively, set "Block fingerprinting" to "Allow fingerprinting"',
    'Refresh the page after changing settings'
  ]
}

/**
 * Composable for using Brave protection in Vue components
 */
export function useBraveProtection() {
  // Computed helpers
  const isBrave = computed(() => braveState.value.isBrave)
  const hasBlockedResources = computed(() => braveState.value.hasBlockedResources)
  const blockedCount = computed(() => braveState.value.blockedCount)

  const shouldShowWarning = computed(() =>
    braveState.value.isBrave &&
    braveState.value.hasBlockedResources &&
    !braveState.value.shieldsWarningDismissed
  )

  const instructions = computed(() => getBraveInstructions())

  return {
    // State (readonly)
    state: readonly(braveState),

    // Computed helpers
    isBrave,
    hasBlockedResources,
    blockedCount,
    shouldShowWarning,
    instructions,

    // Actions
    initialize: initializeBraveProtection,
    recordBlocked: recordBlockedResource,
    dismissWarning,
    isBlockedByBrave
  }
}

// Export singleton state
export { braveState }
