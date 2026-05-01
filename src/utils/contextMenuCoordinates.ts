/**
 * Context Menu Coordinate Utilities
 *
 * Simple utility to extract viewport coordinates from mouse/touch events.
 * clientX/clientY are the correct viewport coordinates for positioning
 * context menus in all supported environments.
 * clientX/clientY are already correct viewport coordinates.
 */

/**
 * Legacy platform helper retained for diagnostics compatibility.
 */
export function isTauri(): boolean {
    return false
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
 * Legacy platform helper retained for diagnostics compatibility.
 */
export function isLinuxTauri(): boolean {
    if (!isTauri()) return false
    return getPlatformString().includes('linux')
}

/**
 * Get platform diagnostic info for debugging drag/coordinate issues
 * Helps diagnose coordinate mismatches.
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
 * Legacy scale correction hook. Chromium/Electron reports viewport coordinates
 * consistently, so no correction is needed.
 */
export function getLinuxTauriScaleFactor(): number {
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
