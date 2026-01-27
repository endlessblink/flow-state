/**
 * BUG-1096: Context Menu Coordinate Utilities
 *
 * In Tauri's WebKitGTK on Linux, clientX/clientY can be offset due to
 * window decorations, HiDPI scaling, or WebView embedding issues.
 *
 * These utilities normalize coordinates for consistent context menu positioning
 * across browsers, PWAs, and Tauri desktop apps.
 */

/**
 * Check if running inside Tauri desktop app
 */
export function isTauri(): boolean {
    return typeof window !== 'undefined' && '__TAURI__' in window
}

/**
 * Get normalized viewport coordinates from a mouse or touch event.
 *
 * This function handles coordinate normalization for Tauri's WebKitGTK
 * where clientX/clientY may be offset from the actual click position.
 *
 * @param event - MouseEvent or TouchEvent
 * @returns Normalized viewport coordinates { x, y }
 */
export function getViewportCoordinates(event: MouseEvent | TouchEvent): { x: number; y: number } {
    // Get all available coordinate types from event
    const clientX = 'clientX' in event ? event.clientX : (event as TouchEvent).touches[0].clientX
    const clientY = 'clientY' in event ? event.clientY : (event as TouchEvent).touches[0].clientY
    const pageX = 'pageX' in event ? event.pageX : (event as TouchEvent).touches[0].pageX
    const pageY = 'pageY' in event ? event.pageY : (event as TouchEvent).touches[0].pageY
    const screenX = 'screenX' in event ? event.screenX : 0
    const screenY = 'screenY' in event ? event.screenY : 0
    const offsetX = 'offsetX' in event ? (event as MouseEvent).offsetX : 0
    const offsetY = 'offsetY' in event ? (event as MouseEvent).offsetY : 0

    const target = event.target as HTMLElement
    const targetRect = target?.getBoundingClientRect()

    // Always log in Tauri for debugging
    if (isTauri()) {
        console.log('[BUG-1096] 🎯 TAURI COORDINATE DEBUG:', {
            clientX, clientY,
            pageX, pageY,
            screenX, screenY,
            offsetX, offsetY,
            windowScroll: { x: window.scrollX, y: window.scrollY },
            windowInner: { w: window.innerWidth, h: window.innerHeight },
            windowOuter: { w: window.outerWidth, h: window.outerHeight },
            devicePixelRatio: window.devicePixelRatio,
            targetClass: target?.className,
            targetRect: targetRect ? {
                left: targetRect.left,
                top: targetRect.top,
                width: targetRect.width,
                height: targetRect.height
            } : null
        })

        // Try multiple strategies and log them all
        const strategies = {
            clientXY: { x: clientX, y: clientY },
            pageMinusScroll: { x: pageX - window.scrollX, y: pageY - window.scrollY },
            targetPlusOffset: targetRect ? {
                x: targetRect.left + offsetX,
                y: targetRect.top + offsetY
            } : null,
            // Try adjusting for devicePixelRatio
            clientDPR: {
                x: clientX / window.devicePixelRatio,
                y: clientY / window.devicePixelRatio
            },
            // Try screenX minus window position (if available)
            screenMinusWindow: {
                x: screenX - window.screenX,
                y: screenY - window.screenY
            }
        }

        console.log('[BUG-1096] 📊 STRATEGY COMPARISON:', strategies)

        // Strategy: Use target element position + offsetX/offsetY
        // This should be the most reliable as it's relative to the actual clicked element
        if (targetRect && offsetX !== undefined && offsetY !== undefined) {
            const correctedX = targetRect.left + offsetX
            const correctedY = targetRect.top + offsetY

            console.log('[BUG-1096] ✅ Using targetRect + offset:', { x: correctedX, y: correctedY })
            return { x: correctedX, y: correctedY }
        }
    }

    // Default: return clientX/clientY (works correctly in browsers and PWA)
    return { x: clientX, y: clientY }
}
