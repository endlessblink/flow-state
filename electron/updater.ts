import { autoUpdater } from 'electron-updater'
import { app, ipcMain, BrowserWindow } from 'electron'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function hasValidAppVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
}

function compareVersions(a: string, b: string): number {
  const aParts = a.split(/[.+-]/)[0].split('.').map(Number)
  const bParts = b.split(/[.+-]/)[0].split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    const diff = (aParts[i] || 0) - (bParts[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

function versionFromUpdateFileName(fileName: unknown): string | null {
  if (typeof fileName !== 'string') return null
  const match = fileName.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/)
  return match?.[1] ?? null
}

function pendingUpdateInfoPath(): string {
  const cacheHome = process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
  return join(cacheHome, 'flow-state-updater', 'pending', 'update-info.json')
}

function clearStalePendingUpdate(appVersion: string) {
  const updateInfoPath = pendingUpdateInfoPath()
  if (!existsSync(updateInfoPath)) return

  try {
    const info = JSON.parse(readFileSync(updateInfoPath, 'utf8')) as { fileName?: string }
    const pendingVersion = versionFromUpdateFileName(info.fileName)
    if (!pendingVersion || compareVersions(pendingVersion, appVersion) <= 0) {
      rmSync(updateInfoPath, { force: true })
      console.warn('[Updater] Cleared stale pending update marker', {
        pendingVersion: pendingVersion ?? 'unknown',
        appVersion,
        updateInfoPath,
      })
    }
  } catch (err) {
    console.warn('[Updater] Failed to inspect pending update marker:', (err as Error).message)
  }
}

function emitUpdaterError(message: string) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) win.webContents.send('updater:error', message)
}

/**
 * Electron auto-updater setup.
 * Uses generic provider pointing to VPS at /updates/electron/
 * Replaces Tauri's auto-updater (SOP-037).
 */

export function registerUpdater() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const appVersion = app.getVersion()
  const canUseUpdater = !isDev && hasValidAppVersion(appVersion)
  if (!isDev && hasValidAppVersion(appVersion)) {
    clearStalePendingUpdate(appVersion)
  }

  app.on('before-quit', () => {
    console.log('[Updater] before-quit received')
  })

  app.on('will-quit', () => {
    console.log('[Updater] will-quit received')
  })

  // Register IPC handlers in all environments so renderer invocations don't
  // fail during local dev. In dev or unpackaged preview mode, updater actions
  // become safe no-ops.
  ipcMain.handle('updater:check', async () => {
    if (!canUseUpdater) return null

    try {
      return await autoUpdater.checkForUpdates()
    } catch (err) {
      console.error('[Updater] Check failed:', (err as Error).message)
      return null
    }
  })

  ipcMain.handle('updater:download', async () => {
    if (!canUseUpdater) return

    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    if (!canUseUpdater) return true

    // Release single-instance lock before restart, otherwise the new process
    // can't acquire the lock and immediately exits (appears as a crash).
    app.releaseSingleInstanceLock()
    // Return from IPC first, then hand off to the updater on the next tick.
    // Calling quitAndInstall() inline from an invoke handler can leave the
    // renderer stuck in a half-dead state while the app is trying to exit.
    setImmediate(() => {
      console.log('[Updater] Starting quitAndInstall handoff')
      const fallbackTimer = setTimeout(() => {
        console.error('[Updater] quitAndInstall did not terminate the app within 8s; forcing quit fallback')
        emitUpdaterError('The updater could not restart automatically. FlowState will close; reopen it manually to complete the update.')
        app.quit()
      }, 8000)

      app.once('before-quit', () => clearTimeout(fallbackTimer))

      try {
        // Force quit: isSilent=false (show installer), isForceRunAfter=true (relaunch after)
        autoUpdater.quitAndInstall(false, true)
      } catch (err) {
        clearTimeout(fallbackTimer)
        const message = (err as Error).message
        console.error('[Updater] quitAndInstall failed:', message)
        emitUpdaterError(message)
      }
    })

    return true
  })

  if (!canUseUpdater) {
    if (!isDev) {
      console.warn(`[Updater] Skipping updater initialization for invalid app version: ${appVersion}`)
    }
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  // Forward events to renderer via IPC
  autoUpdater.on('update-available', (info) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:available', info)
  })

  autoUpdater.on('download-progress', (progress) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:progress', progress)
  })

  autoUpdater.on('update-downloaded', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:downloaded')
  })

  autoUpdater.on('update-not-available', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:not-available')
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:error', err.message)
  })

  // Check shortly after launch...
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)

  // ...and re-check periodically. Without this the app only ever checked once
  // at startup, so an update published while the app stayed open was never
  // noticed until a manual relaunch (root cause of the 1.4.45 "didn't update"
  // report). Re-check every 4 hours.
  const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, RECHECK_INTERVAL_MS)
}
