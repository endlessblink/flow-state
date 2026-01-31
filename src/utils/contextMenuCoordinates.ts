/**
 * Context Menu Coordinate Utilities
 *
 * Simple utility to extract viewport coordinates from mouse/touch events.
 * clientX/clientY are the correct viewport coordinates for positioning
 * context menus in all environments (browser, PWA, Tauri).
 *
 * BUG-1096 FIX: Removed Tauri-specific "correction" that was double-counting
 * the canvas container position by adding targetRect.left + offsetX.
 * clientX/clientY are already correct viewport coordinates.
 */

/**
 * Check if running inside Tauri desktop app
 */
export function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * Get platform string (uses userAgentData if available, falls back to userAgent)
 * Avoids deprecated navigator.platform
 */
function getPlatformString(): string {
    // Modern browsers support userAgentData
    if ('userAgentData' in navigator && navigator.userAgentData) {
        const uaData = navigator.userAgentData as { platform?: string }
        return uaData.platform?.toLowerCase() || ''
    }
    // Fallback to userAgent parsing
    const ua = navigator.userAgent.toLowerCase()
    if (ua.includes('linux')) return 'linux'
    if (ua.includes('win')) return 'windows'
    if (ua.includes('mac')) return 'macos'
    return 'unknown'
}

/**
 * Check if running on Linux (for Tauri WebKitGTK-specific handling)
 * BUG-1116: Linux Tauri uses WebKitGTK which may have coordinate issues
 */
export function isLinuxTauri(): boolean {
    if (!isTauri()) return false
    return getPlatformString().includes('linux')
}

/**
 * Get platform diagnostic info for debugging drag/coordinate issues
 * BUG-1116: Helps diagnose WebKitGTK coordinate mismatches
 */
export function getPlatformDiagnostics(): {
    isTauri: boolean
    isLinux: boolean
    devicePixelRatio: number
    innerWidth: number
    innerHeight: number
    screenWidth: number
    screenHeight: number
    screenRatio: number
    platform: string
} {
    const dpr = window.devicePixelRatio || 1
    const screenRatio = screen.width / window.innerWidth
    const platform = getPlatformString()

    return {
        isTauri: isTauri(),
        isLinux: platform.includes('linux'),
        devicePixelRatio: dpr,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screenWidth: screen.width,
        screenHeight: screen.height,
        screenRatio,
        platform
    }
}

/**
 * Get scale factor correction for Linux Tauri (WebKitGTK)
 *
 * BUG-1116: On Linux, WebKitGTK may not report correct devicePixelRatio
 * when display scaling is used. This function detects the mismatch and
 * returns a correction factor.
 *
 * Returns 1.0 if no correction needed (non-Tauri, non-Linux, or no mismatch)
 */
export function getLinuxTauriScaleFactor(): number {
    if (!isLinuxTauri()) return 1

    const dpr = window.devicePixelRatio || 1
    const screenRatio = screen.width / window.innerWidth

    // If there's a significant mismatch between reported DPR and actual screen ratio,
    // WebKitGTK is likely misreporting. Use the screen ratio instead.
    // Threshold of 0.1 allows for minor floating point differences.
    if (Math.abs(dpr - screenRatio) > 0.1) {
        if (import.meta.env.DEV) {
            console.log('[BUG-1116] Linux Tauri scale factor mismatch detected:', {
                reportedDPR: dpr,
                actualScreenRatio: screenRatio,
                correction: screenRatio / dpr
            })
        }
        return screenRatio / dpr
    }

    return 1
}

/**
 * Get viewport coordinates from a mouse or touch event.
 *
 * Returns clientX/clientY which are viewport-relative coordinates,
 * suitable for positioning absolutely-positioned elements like context menus.
 *
 * @param event - MouseEvent or TouchEvent
 * @returns Viewport coordinates { x, y }
 */
export function getViewportCoordinates(event: MouseEvent | TouchEvent): { x: number; y: number } {
    const clientX = 'clientX' in event ? event.clientX : (event as TouchEvent).touches[0].clientX
    const clientY = 'clientY' in event ? event.clientY : (event as TouchEvent).touches[0].clientY
    return { x: clientX, y: clientY }
}
