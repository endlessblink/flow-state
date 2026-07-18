import { autoUpdater } from 'electron-updater'
import { app, ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import { pendingUpdateInfoPath, clearStalePendingUpdate, pendingAppImagePath } from './updater-pending'
import { flushStore } from './ipc/store'

// BUG-1874: bound the store flush, but never install/restart unless it actually succeeds. A timeout
// used to resolve the race as if persistence had completed, allowing a just-rotated single-use
// refresh token to be lost when app.exit(0) terminated the old process.
const STORE_FLUSH_TIMEOUT_MS = 5000

async function flushStoreBeforeExit(): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | null = null
  try {
    await Promise.race([
      flushStore(),
      new Promise<void>((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Store flush before exit timed out')),
          STORE_FLUSH_TIMEOUT_MS,
        )
      }),
    ])
  } catch (err) {
    console.error('[Updater] Store flush before exit failed:', (err as Error).message)
    throw err
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function hasValidAppVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
}

function emitUpdaterError(message: string) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) win.webContents.send('updater:error', message)
}

function launchDetachedAppImageInstaller(): boolean {
  if (process.platform !== 'linux') return false

  const targetAppImage = process.env.APPIMAGE
  const pendingAppImage = pendingAppImagePath()
  if (!targetAppImage || !pendingAppImage) return false

  const updateInfoPath = pendingUpdateInfoPath()
  // BUG-1917: the previous script ran blind (stdio ignored, no log) and clicking
  // Restart could end with the app exited, the AppImage NOT swapped, and no
  // relaunch — with zero forensic trail (pending/ kept a graveyard of 1.4.223/
  // 224/226/229 that never installed). Every step now logs to LOG, each step
  // aborts loudly on failure, and the relaunch uses the same flags as
  // FlowState-launch.sh (TASK-1871) — a bare relaunch can die on chrome-sandbox
  // SUID / GPU init and look exactly like "nothing happened".
  const script = `
LOG="\${TMPDIR:-/tmp}/flowstate-appimage-install.log"
exec >> "$LOG" 2>&1
echo "=== $(date -u +%FT%TZ) installer start target=$1 pending=$2 parent=$4 ==="
target="$1"
pending="$2"
info="$3"
parent="$4"
tmp="$target.flowstate-update-tmp"
i=0
while kill -0 "$parent" 2>/dev/null && [ "$i" -lt 100 ]; do
  i=$((i + 1))
  sleep 0.1
done
echo "parent gone after $i ticks"
chmod 755 "$pending" || { echo "FAIL chmod pending"; exit 1; }
cp -f "$pending" "$tmp" || { echo "FAIL cp to tmp"; exit 1; }
chmod 755 "$tmp" || { echo "FAIL chmod tmp"; exit 1; }
mv -f "$tmp" "$target" || { echo "FAIL mv into place"; exit 1; }
rm -f "$info"
echo "swap complete, relaunching"
exec "$target" --no-sandbox --ozone-platform=x11 --disable-gpu --class=flow-state
`

  const child = spawn(
    '/bin/sh',
    ['-c', script, 'flowstate-appimage-install', targetAppImage, pendingAppImage, updateInfoPath, String(process.pid)],
    {
      detached: true,
      stdio: 'ignore',
      // BUG-1917: never inherit a cwd inside the soon-to-unmount AppImage FUSE dir
      cwd: '/',
      env: {
        ...process.env,
        APPIMAGE_SILENT_INSTALL: 'true',
      },
    },
  )
  child.once('error', (err) => {
    console.error('[Updater] Detached installer failed to spawn:', err.message)
  })
  child.unref()
  // BUG-1917: spawn failures are async, but a missing pid means the process
  // never started — fall back to electron-updater's own quitAndInstall path.
  if (!child.pid) {
    console.error('[Updater] Detached installer has no pid — falling back to quitAndInstall')
    return false
  }
  return true
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
    try {
      const stalePendingUpdate = clearStalePendingUpdate(appVersion)
      if (stalePendingUpdate.cleared) {
        console.warn('[Updater] Cleared stale pending update marker', {
          pendingVersion: stalePendingUpdate.pendingVersion ?? 'unknown',
          appVersion,
          updateInfoPath: stalePendingUpdate.updateInfoPath,
        })
      }
    } catch (err) {
      console.warn('[Updater] Failed to inspect pending update marker:', (err as Error).message)
    }
  }

  app.on('before-quit', () => {
    console.log('[Updater] before-quit received')
  })

  app.on('will-quit', () => {
    console.log('[Updater] will-quit received')
  })

  // BUG-1874: Electron's `app` emits this (instead of before-quit) when quitAndInstall tears the
  // app down. The authoritative flush is awaited in the updater:install handler before we reach
  // here; this is a synchronous best-effort backstop for any other quit-for-update path.
  ;(app as unknown as { on(event: 'before-quit-for-update', listener: () => void): void })
    .on('before-quit-for-update', () => {
      console.log('[Updater] before-quit-for-update received')
      void flushStoreBeforeExit().catch((err) => {
        console.error('[Updater] Update-triggered quit could not flush durable store:', (err as Error).message)
      })
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
      throw err
    }
  })

  ipcMain.handle('updater:download', async () => {
    if (!canUseUpdater) return

    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle('updater:install', async () => {
    if (!canUseUpdater) return true

    // BUG-1874: flush any in-flight auth/store writes (a just-rotated refresh token) to disk
    // BEFORE we tear the process down. The AppImage path exits via app.exit(0), which bypasses
    // before-quit/will-quit, so this is the only place the flush can happen for that path.
    try {
      await flushStoreBeforeExit()
    } catch (err) {
      const message = 'Update restart aborted because FlowState could not save the current session.'
      emitUpdaterError(message)
      throw new Error(message, { cause: err })
    }

    // Release single-instance lock before restart, otherwise the new process
    // can't acquire the lock and immediately exits (appears as a crash).
    app.releaseSingleInstanceLock()
    // Return from IPC first, then hand off to the updater on the next tick.
    // Calling quitAndInstall() inline from an invoke handler can leave the
    // renderer stuck in a half-dead state while the app is trying to exit.
    setImmediate(() => {
      console.log('[Updater] Starting quitAndInstall handoff')
      if (launchDetachedAppImageInstaller()) {
        console.log('[Updater] Started detached AppImage installer handoff')
        app.exit(0)
        return
      }

      const fallbackTimer = setTimeout(() => {
        console.error('[Updater] quitAndInstall did not terminate the app within 8s; forcing quit fallback')
        emitUpdaterError('The updater could not restart automatically. FlowState will close; reopen it manually to complete the update.')
        app.quit()
        setTimeout(() => {
          console.error('[Updater] Graceful quit fallback did not terminate the app; forcing process exit')
          app.exit(0)
        }, 2000)
      }, 8000)

      const clearFallback = () => clearTimeout(fallbackTimer)
      app.once('will-quit', clearFallback)
      app.once('quit', clearFallback)

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
  autoUpdater.logger = null

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
