import { ipcMain, net } from 'electron'

/**
 * CORS-free HTTP fetch via Electron's net module.
 * Replaces @tauri-apps/plugin-http.
 */

interface FetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string
}

export function registerHttpHandlers() {
  ipcMain.handle('http:fetch', async (_event, url: string, options?: FetchOptions) => {
    const resp = await net.fetch(url, {
      method: options?.method || 'GET',
      headers: options?.headers,
      body: options?.body,
    })

    const text = await resp.text()

    return {
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      text,
      headers: Object.fromEntries(resp.headers.entries()),
    }
  })
}
