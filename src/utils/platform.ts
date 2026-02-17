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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (navigator as any).standalone
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

/** Reset cache — for testing only */
export function _resetPlatformCache(): void {
  _detectedPlatform = null
}
