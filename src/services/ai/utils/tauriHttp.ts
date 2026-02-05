/**
 * Tauri HTTP Utility
 * TASK-1186: Provides CORS-free HTTP requests in Tauri desktop environment
 *
 * In Tauri, the WebView has the same CORS restrictions as a browser.
 * For local services like Ollama (localhost:11434), we need to use
 * Tauri's plugin-http which bypasses CORS from the Rust backend.
 *
 * Usage:
 * ```typescript
 * import { tauriFetch, isTauriEnvironment } from './utils/tauriHttp'
 *
 * // Automatically uses Tauri HTTP in desktop, browser fetch in web
 * const response = await tauriFetch('http://localhost:11434/api/tags')
 * ```
 */

// Type for Tauri HTTP fetch function
type TauriFetchFn = (
  url: string | URL | Request,
  options?: RequestInit & { connectTimeout?: number }
) => Promise<Response>

// Cache the Tauri fetch function to avoid repeated dynamic imports
let cachedTauriFetch: TauriFetchFn | null = null
let tauriCheckDone = false
let isTauri = false

/**
 * Check if running in Tauri environment.
 * Cached after first check for performance.
 */
export function isTauriEnvironment(): boolean {
  if (tauriCheckDone) {
    return isTauri
  }

  isTauri = typeof window !== 'undefined' &&
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)

  tauriCheckDone = true
  return isTauri
}

/**
 * Get the Tauri fetch function, with lazy loading.
 * Returns null if not in Tauri environment.
 */
async function getTauriFetch(): Promise<TauriFetchFn | null> {
  if (!isTauriEnvironment()) {
    return null
  }

  if (cachedTauriFetch) {
    return cachedTauriFetch
  }

  try {
    // Dynamic import to avoid bundling Tauri in web builds
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    cachedTauriFetch = tauriFetch as TauriFetchFn
    return cachedTauriFetch
  } catch (error) {
    console.warn('[tauriHttp] Failed to load Tauri HTTP plugin:', error)
    return null
  }
}

/**
 * Extended fetch options for Tauri HTTP
 */
export interface TauriFetchOptions extends RequestInit {
  /** Connection timeout in seconds (Tauri only) */
  connectTimeout?: number
  /** Force browser fetch even in Tauri (for testing) */
  forceBrowserFetch?: boolean
}

/**
 * Fetch with automatic Tauri/browser selection.
 *
 * In Tauri environment:
 * - Uses @tauri-apps/plugin-http for CORS-free requests
 * - Supports additional options like connectTimeout
 *
 * In browser environment:
 * - Uses standard fetch API
 * - Tauri-specific options are ignored
 *
 * @param url - URL to fetch
 * @param options - Fetch options (extends RequestInit)
 * @returns Promise<Response>
 */
export async function tauriFetch(
  url: string | URL | Request,
  options: TauriFetchOptions = {}
): Promise<Response> {
  const { forceBrowserFetch, connectTimeout, ...fetchOptions } = options

  // Use browser fetch if forced or not in Tauri
  if (forceBrowserFetch || !isTauriEnvironment()) {
    return fetch(url, fetchOptions)
  }

  // Try Tauri fetch
  const tauriFetchFn = await getTauriFetch()

  if (tauriFetchFn) {
    try {
      // Tauri fetch with optional connect timeout
      const tauriOptions = {
        ...fetchOptions,
        ...(connectTimeout !== undefined ? { connectTimeout } : {})
      }
      return await tauriFetchFn(url, tauriOptions)
    } catch (error) {
      // Log and fall back to browser fetch
      console.warn('[tauriHttp] Tauri fetch failed, falling back to browser:', error)
      return fetch(url, fetchOptions)
    }
  }

  // Fallback to browser fetch if Tauri HTTP not available
  return fetch(url, fetchOptions)
}

/**
 * Fetch with timeout support (works in both Tauri and browser).
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @returns Promise<Response>
 */
export async function tauriFetchWithTimeout(
  url: string | URL | Request,
  options: TauriFetchOptions = {},
  timeoutMs: number = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await tauriFetch(url, {
      ...options,
      signal: options.signal || controller.signal,
      // Set Tauri connect timeout to match (in seconds)
      connectTimeout: Math.ceil(timeoutMs / 1000)
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Check if a local service is reachable.
 * Uses Tauri HTTP in desktop for CORS-free check.
 *
 * @param url - URL to check (e.g., 'http://localhost:11434/api/tags')
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise<boolean>
 */
export async function isServiceReachable(
  url: string,
  timeoutMs: number = 5000
): Promise<boolean> {
  try {
    const response = await tauriFetchWithTimeout(
      url,
      { method: 'GET' },
      timeoutMs
    )
    return response.ok
  } catch {
    return false
  }
}
