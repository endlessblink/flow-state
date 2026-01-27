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
