/**
 * Platform Detection Utility — Single Source of Truth
 * TASK-1718: Electron migration (replaces Tauri detection)
 *
 * Replaces scattered platform checks across 35+ files.
 * Cached after first detection for zero-cost subsequent calls.
 */

export type Platform = 'electron' | 'capacitor' | 'pwa' | 'browser'

let _detectedPlatform: Platform | null = null

declare const __IS_CAPACITOR_BUILD__: boolean | undefined

export function detectPlatform(): Platform {
  if (_detectedPlatform) return _detectedPlatform

  if (typeof window === 'undefined') {
    _detectedPlatform = 'browser'
    return _detectedPlatform
  }

  // Electron detection — preload.ts exposes window.electronAPI
  if (
    typeof (window as unknown as Record<string, unknown>).electronAPI !== 'undefined'
  ) {
    _detectedPlatform = 'electron'
    return _detectedPlatform
  }

  // Capacitor detection (runtime)
  const win = window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean }
  }
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
export const isElectron = (): boolean => detectPlatform() === 'electron'
export const isCapacitor = (): boolean => detectPlatform() === 'capacitor'
export const isPWA = (): boolean => detectPlatform() === 'pwa'
export const isBrowser = (): boolean => detectPlatform() === 'browser'

/** @deprecated Tauri has been replaced by Electron — always returns false */
export const isTauri = (): boolean => false

/** True for Electron or Capacitor (native wrapper, not browser) */
export const isNative = (): boolean => isElectron() || isCapacitor()

/** True only for Capacitor (mobile native) */
export const isMobileNative = (): boolean => isCapacitor()

/** True only for Electron (desktop native) */
export const isDesktopNative = (): boolean => isElectron()

/**
 * navigator.onLine is reliable in Electron (Chromium).
 * Unlike Tauri/WebKitGTK, Chromium's navigator.onLine is trustworthy.
 */
export function shouldTrustNavigatorOnline(): boolean {
  return true
}

/**
 * Initial online state used by startup/sync code before any real request happens.
 */
export function getInitialOnlineState(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine !== false : true
}

/** Reset cache — for testing only */
export function _resetPlatformCache(): void {
  _detectedPlatform = null
}
