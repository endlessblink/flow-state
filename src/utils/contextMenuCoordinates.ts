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
    // Get base coordinates from event
    const clientX = 'clientX' in event ? event.clientX : (event as TouchEvent).touches[0].clientX
    const clientY = 'clientY' in event ? event.clientY : (event as TouchEvent).touches[0].clientY

    if (isTauri()) {
        // BUG-1096 FIX: In Tauri, use multiple strategies to get correct coordinates

        // Strategy 1: Use pageX/pageY converted to viewport coords
        // These are more reliable in embedded WebViews
        const pageX = 'pageX' in event ? event.pageX : (event as TouchEvent).touches[0].pageX
        const pageY = 'pageY' in event ? event.pageY : (event as TouchEvent).touches[0].pageY

        // Convert page coordinates to viewport coordinates
        const viewportX = pageX - window.scrollX
        const viewportY = pageY - window.scrollY

        // Strategy 2: Validate against known container
        // If we have a Vue Flow container, check if coords are within bounds
        const vueFlowContainer = document.querySelector('.vue-flow')

        if (vueFlowContainer) {
            const rect = vueFlowContainer.getBoundingClientRect()

            // If the calculated coords are within the container, use them
            if (viewportX >= rect.left && viewportX <= rect.right &&
                viewportY >= rect.top && viewportY <= rect.bottom) {
                console.debug('[BUG-1096] Tauri coords normalized via pageX/pageY:', {
                    original: { clientX, clientY },
                    normalized: { x: viewportX, y: viewportY }
                })
                return { x: viewportX, y: viewportY }
            }

            // Strategy 3: Use target element's position + offsetX/offsetY
            // This works when the click target is reliable
            const target = event.target as HTMLElement
            if (target && 'offsetX' in event) {
                const targetRect = target.getBoundingClientRect()
                const correctedX = targetRect.left + (event as MouseEvent).offsetX
                const correctedY = targetRect.top + (event as MouseEvent).offsetY

                // Only use if the corrected coords are reasonable
                if (correctedX >= 0 && correctedY >= 0 &&
                    correctedX <= window.innerWidth && correctedY <= window.innerHeight) {
                    console.debug('[BUG-1096] Tauri coords corrected via target offset:', {
                        original: { clientX, clientY },
                        corrected: { x: correctedX, y: correctedY },
                        target: target.className
                    })
                    return { x: correctedX, y: correctedY }
                }
            }
        }

        // If validation passed or no container to check, use the pageX/pageY approach
        // Only if it differs significantly from clientX/clientY (indicating a bug)
        const delta = Math.abs(viewportX - clientX) + Math.abs(viewportY - clientY)
        if (delta > 10) {
            console.debug('[BUG-1096] Tauri coords using pageX/pageY (significant delta):', {
                original: { clientX, clientY },
                normalized: { x: viewportX, y: viewportY },
                delta
            })
            return { x: viewportX, y: viewportY }
        }
    }

    // Default: return clientX/clientY (works correctly in browsers and PWA)
    return { x: clientX, y: clientY }
}
