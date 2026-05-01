export interface TauriFetchOptions extends RequestInit {
  connectTimeout?: number
  forceBrowserFetch?: boolean
}

export function isTauriEnvironment(): boolean {
  return false
}

export async function tauriFetch(
  url: string | URL | Request,
  options: TauriFetchOptions = {}
): Promise<Response> {
  const { connectTimeout: _connectTimeout, forceBrowserFetch: _forceBrowserFetch, ...fetchOptions } = options
  return fetch(url, fetchOptions)
}

export async function tauriFetchWithTimeout(
  url: string | URL | Request,
  options: TauriFetchOptions = {},
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await tauriFetch(url, {
      ...options,
      signal: options.signal ?? controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export async function checkTauriConnectivity(url: string): Promise<boolean> {
  try {
    const response = await tauriFetchWithTimeout(url, { method: 'HEAD' }, 5000)
    return response.ok
  } catch {
    return false
  }
}
