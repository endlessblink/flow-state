/**
 * Legacy HTTP utility retained for existing imports.
 *
 * Usage:
 * ```typescript
 * import { tauriFetch, isTauriEnvironment } from './utils/tauriHttp'
 *
 * // Uses browser fetch in all supported runtimes.
 * const response = await tauriFetch('http://localhost:11434/api/tags')
 * ```
 */

export function isTauriEnvironment(): boolean {
  return false
}

/**
 * Extended fetch options for Tauri HTTP
 */
export interface TauriFetchOptions extends RequestInit {
  /** Legacy option, ignored in supported runtimes. */
  connectTimeout?: number
  /** Legacy option, ignored in supported runtimes. */
  forceBrowserFetch?: boolean
}

/**
 * Fetch with automatic Tauri/browser selection.
 *
 * Uses standard fetch API; legacy options are ignored.
 *
 * @param url - URL to fetch
 * @param options - Fetch options (extends RequestInit)
 * @returns Promise<Response>
 */
export async function tauriFetch(
  url: string | URL | Request,
  options: TauriFetchOptions = {}
): Promise<Response> {
  const { forceBrowserFetch: _forceBrowserFetch, connectTimeout: _connectTimeout, ...fetchOptions } = options
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
