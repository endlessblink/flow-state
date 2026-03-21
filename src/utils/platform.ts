/**
 * Platform Detection Utility — Single Source of Truth
 * FEATURE-1345: Capacitor Android App
 *
 * Replaces scattered isTauri() checks across 35+ files.
 * Cached after first detection for zero-cost subsequent calls.
 */

export type Platform = 'tauri' | 'capacitor' | 'pwa' | 'browser'

let _detectedPlatform: Platform | null = null

declare const __IS_CAPACITOR_BUILD__: boolean | undefined

export function detectPlatform(): Platform {
  if (_detectedPlatform) return _detectedPlatform

  if (typeof window === 'undefined') {
    _detectedPlatform = 'browser'
    return _detectedPlatform
  }

  interface ExtendedWindow extends Window {
    isTauri?: boolean
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
    Capacitor?: {
      isNativePlatform?: () => boolean
    }
  }

  const win = window as unknown as ExtendedWindow

  // Tauri detection (must be before Capacitor — both may set window objects)
  if (
    ('isTauri' in win && win.isTauri) ||
    '__TAURI__' in win ||
    '__TAURI_INTERNALS__' in win
  ) {
    _detectedPlatform = 'tauri'
    return _detectedPlatform
  }

  // Capacitor detection (runtime)
  if (win.Capacitor?.isNativePlatform?.()) {
    _detectedPlatform = 'capacitor'
    return _detectedPlatform
  }

  // Build-time flag fallback
  if (typeof __IS_CAPACITOR_BUILD__ !== 'undefined' && __IS_CAPACITOR_BUILD__) {
    _detectedPlatform = 'capacitor'
    return _detectedPlatform
  }

  // PWA detection (installed to home screen)
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone
  ) {
    _detectedPlatform = 'pwa'
    return _detectedPlatform
  }

  _detectedPlatform = 'browser'
  return _detectedPlatform
}

// Convenience checks
export const isTauri = (): boolean => detectPlatform() === 'tauri'
export const isCapacitor = (): boolean => detectPlatform() === 'capacitor'
export const isPWA = (): boolean => detectPlatform() === 'pwa'
export const isBrowser = (): boolean => detectPlatform() === 'browser'

/** True for Tauri or Capacitor (native wrapper, not browser) */
export const isNative = (): boolean => isTauri() || isCapacitor()

/** True only for Capacitor (mobile native) */
export const isMobileNative = (): boolean => isCapacitor()

/** True only for Tauri (desktop native) */
export const isDesktopNative = (): boolean => isTauri()

/**
 * navigator.onLine is unreliable in desktop webviews, especially Tauri/WebKitGTK.
 * For desktop native runtime, prefer attempting a real network request instead of
 * treating the app as offline solely from the browser hint.
 */
export function shouldTrustNavigatorOnline(): boolean {
  return !isTauri()
}

/**
 * Initial online state used by startup/sync code before any real request happens.
 * In Tauri we optimistically assume online so stale IndexedDB cache does not become
 * the long-lived source of truth when navigator.onLine is false.
 */
export function getInitialOnlineState(): boolean {
  if (!shouldTrustNavigatorOnline()) return true
  return typeof navigator !== 'undefined' ? navigator.onLine !== false : true
}

/** Reset cache — for testing only */
export function _resetPlatformCache(): void {
  _detectedPlatform = null
}
