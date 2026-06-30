import { contextBridge, ipcRenderer } from 'electron'

/**
 * Expose a safe API to the renderer process via contextBridge.
 * This replaces Tauri's window.__TAURI_INTERNALS__.invoke() pattern.
 *
 * In the renderer, access via: window.electronAPI.invoke('channel', args)
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Generic IPC invoke (replaces Tauri's invoke())
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),

  // Platform detection
  platform: process.platform,
  isElectron: true,

  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Shell operations (replaces @tauri-apps/plugin-shell)
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // Dialog operations (replaces @tauri-apps/plugin-dialog)
  showSaveDialog: (options: unknown) => ipcRenderer.invoke('dialog:showSave', options),
  showOpenDialog: (options: unknown) => ipcRenderer.invoke('dialog:showOpen', options),

  // File system (replaces @tauri-apps/plugin-fs)
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, data: string) => ipcRenderer.invoke('fs:writeFile', path, data),
  exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
  mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),

  // Store (replaces @tauri-apps/plugin-store)
  storeGet: (key: string) => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),

  // HTTP (replaces @tauri-apps/plugin-http for CORS bypass)
  fetch: (url: string, options?: unknown) => ipcRenderer.invoke('http:fetch', url, options),

  // OAuth localhost server (for desktop Google sign-in)
  oauthStart: () => ipcRenderer.invoke('oauth:start'),
  oauthWaitForCallback: () => ipcRenderer.invoke('oauth:waitForCallback'),
  oauthCancel: () => ipcRenderer.invoke('oauth:cancel'),

  // Auto-updater events
  onUpdateAvailable: (callback: (info: unknown) => void) => {
    ipcRenderer.on('updater:available', (_event, info) => callback(info))
  },
  onUpdateDownloadProgress: (callback: (progress: unknown) => void) => {
    ipcRenderer.on('updater:progress', (_event, progress) => callback(progress))
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('updater:downloaded', () => callback())
  },
  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on('updater:not-available', () => callback())
  },
  onUpdateError: (callback: (message: string) => void) => {
    ipcRenderer.on('updater:error', (_event, message) => callback(String(message)))
  },
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  downloadUpdate: () => ipcRenderer.invoke('updater:download'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  // Local Task API (Life OS) — TASK-1797
  setLocalApiSession: (session: unknown) => ipcRenderer.invoke('localApi:setSession', session),
  clearLocalApiSession: () => ipcRenderer.invoke('localApi:clearSession'),
  setLocalApiTimerSnapshot: (snapshot: unknown) => ipcRenderer.invoke('localApi:setTimerSnapshot', snapshot),
  setLocalApiEnabled: (enabled: boolean) => ipcRenderer.invoke('localApi:setEnabled', enabled),
  getLocalApiToken: () => ipcRenderer.invoke('localApi:getToken'),
  getLocalApiStatus: () => ipcRenderer.invoke('localApi:status'),
})

// Type declaration for the renderer
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      platform: string
      isElectron: boolean
      getVersion: () => Promise<string>
      openExternal: (url: string) => Promise<void>
      showSaveDialog: (options: unknown) => Promise<unknown>
      showOpenDialog: (options: unknown) => Promise<unknown>
      readFile: (path: string) => Promise<string>
      writeFile: (path: string, data: string) => Promise<void>
      exists: (path: string) => Promise<boolean>
      mkdir: (path: string) => Promise<void>
      storeGet: (key: string) => Promise<unknown>
      storeSet: (key: string, value: unknown) => Promise<void>
      fetch: (url: string, options?: unknown) => Promise<unknown>
      oauthStart: () => Promise<number>
      oauthWaitForCallback: () => Promise<string>
      oauthCancel: () => Promise<void>
      onUpdateAvailable: (callback: (info: unknown) => void) => void
      onUpdateDownloadProgress: (callback: (progress: unknown) => void) => void
      onUpdateDownloaded: (callback: () => void) => void
      onUpdateNotAvailable: (callback: () => void) => void
      onUpdateError: (callback: (message: string) => void) => void
      checkForUpdates: () => Promise<unknown>
      downloadUpdate: () => Promise<void>
      installUpdate: () => Promise<void>
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>
      setLocalApiSession: (session: unknown) => Promise<{ ok: boolean }>
      clearLocalApiSession: () => Promise<{ ok: boolean }>
      setLocalApiTimerSnapshot: (snapshot: unknown) => Promise<{ ok: boolean }>
      setLocalApiEnabled: (enabled: boolean) => Promise<{ ok: boolean; enabled: boolean }>
      getLocalApiToken: () => Promise<string>
      getLocalApiStatus: () => Promise<{
        enabled: boolean
        running: boolean
        listening: boolean
        childRunning: boolean
        childPid: number | null
        appVersion: string
        hasLatestSession: boolean
        hasLatestTimerSnapshot: boolean
        latestTimerSnapshotActive: boolean
        latestTimerSnapshotAgeMs: number | null
        port: number
      }>
    }
  }
}
