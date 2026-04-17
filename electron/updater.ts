import { autoUpdater } from 'electron-updater'
import { app, ipcMain, BrowserWindow } from 'electron'

/**
 * Electron auto-updater setup.
 * Uses generic provider pointing to VPS at /updates/electron/
 * Replaces Tauri's auto-updater (SOP-037).
 */

export function registerUpdater() {
  // Don't check for updates in dev
  if (process.env.VITE_DEV_SERVER_URL) return

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

  // IPC handlers for renderer control
  ipcMain.handle('updater:check', async () => {
    try {
      return await autoUpdater.checkForUpdates()
    } catch (err) {
      console.error('[Updater] Check failed:', (err as Error).message)
      return null
    }
  })

  ipcMain.handle('updater:download', async () => {
    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle('updater:install', () => {
    // Release single-instance lock before restart, otherwise the new process
    // can't acquire the lock and immediately exits (appears as a crash).
    app.releaseSingleInstanceLock()
    // Return from IPC first, then hand off to the updater on the next tick.
    // Calling quitAndInstall() inline from an invoke handler can leave the
    // renderer stuck in a half-dead state while the app is trying to exit.
    setImmediate(() => {
      // Force quit: isSilent=false (show installer), isForceRunAfter=true (relaunch after)
      autoUpdater.quitAndInstall(false, true)
    })

    return true
  })

  // Check for updates after 5s delay
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)
}
