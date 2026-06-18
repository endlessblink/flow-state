"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUpdater = registerUpdater;
const electron_updater_1 = require("electron-updater");
const electron_1 = require("electron");
const node_child_process_1 = require("node:child_process");
const updater_pending_1 = require("./updater-pending");
const store_1 = require("./ipc/store");
// BUG-1874: never let the store flush hang the update handoff. The AppImage installer polls the
// old PID and the single-instance lock is already released — exit must proceed even if flush is slow.
const STORE_FLUSH_TIMEOUT_MS = 1500;
async function flushStoreBeforeExit() {
    try {
        await Promise.race([
            (0, store_1.flushStore)(),
            new Promise((resolve) => setTimeout(resolve, STORE_FLUSH_TIMEOUT_MS)),
        ]);
    }
    catch (err) {
        console.warn('[Updater] Store flush before exit failed:', err.message);
    }
}
function hasValidAppVersion(version) {
    return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
}
function emitUpdaterError(message) {
    const win = electron_1.BrowserWindow.getAllWindows()[0];
    if (win)
        win.webContents.send('updater:error', message);
}
function launchDetachedAppImageInstaller() {
    if (process.platform !== 'linux')
        return false;
    const targetAppImage = process.env.APPIMAGE;
    const pendingAppImage = (0, updater_pending_1.pendingAppImagePath)();
    if (!targetAppImage || !pendingAppImage)
        return false;
    const updateInfoPath = (0, updater_pending_1.pendingUpdateInfoPath)();
    const script = `
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
chmod 755 "$pending"
cp -f "$pending" "$tmp"
chmod 755 "$tmp"
mv -f "$tmp" "$target"
rm -f "$info"
exec "$target" --no-sandbox --class=flow-state
`;
    const child = (0, node_child_process_1.spawn)('/bin/sh', ['-c', script, 'flowstate-appimage-install', targetAppImage, pendingAppImage, updateInfoPath, String(process.pid)], {
        detached: true,
        stdio: 'ignore',
        env: {
            ...process.env,
            APPIMAGE_SILENT_INSTALL: 'true',
        },
    });
    child.unref();
    return true;
}
/**
 * Electron auto-updater setup.
 * Uses generic provider pointing to VPS at /updates/electron/
 * Replaces Tauri's auto-updater (SOP-037).
 */
function registerUpdater() {
    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    const appVersion = electron_1.app.getVersion();
    const canUseUpdater = !isDev && hasValidAppVersion(appVersion);
    if (!isDev && hasValidAppVersion(appVersion)) {
        try {
            const stalePendingUpdate = (0, updater_pending_1.clearStalePendingUpdate)(appVersion);
            if (stalePendingUpdate.cleared) {
                console.warn('[Updater] Cleared stale pending update marker', {
                    pendingVersion: stalePendingUpdate.pendingVersion ?? 'unknown',
                    appVersion,
                    updateInfoPath: stalePendingUpdate.updateInfoPath,
                });
            }
        }
        catch (err) {
            console.warn('[Updater] Failed to inspect pending update marker:', err.message);
        }
    }
    electron_1.app.on('before-quit', () => {
        console.log('[Updater] before-quit received');
    });
    electron_1.app.on('will-quit', () => {
        console.log('[Updater] will-quit received');
    });
    electron_1.app
        .on('before-quit-for-update', () => {
        console.log('[Updater] before-quit-for-update received');
        void flushStoreBeforeExit();
    });
    // Register IPC handlers in all environments so renderer invocations don't
    // fail during local dev. In dev or unpackaged preview mode, updater actions
    // become safe no-ops.
    electron_1.ipcMain.handle('updater:check', async () => {
        if (!canUseUpdater)
            return null;
        try {
            return await electron_updater_1.autoUpdater.checkForUpdates();
        }
        catch (err) {
            console.error('[Updater] Check failed:', err.message);
            return null;
        }
    });
    electron_1.ipcMain.handle('updater:download', async () => {
        if (!canUseUpdater)
            return;
        await electron_updater_1.autoUpdater.downloadUpdate();
    });
    electron_1.ipcMain.handle('updater:install', async () => {
        if (!canUseUpdater)
            return true;
        // BUG-1874: flush any in-flight auth/store writes (a just-rotated refresh token) to disk
        // BEFORE we tear the process down. The AppImage path exits via app.exit(0), which bypasses
        // before-quit/will-quit, so this is the only place the flush can happen for that path.
        await flushStoreBeforeExit();
        // Release single-instance lock before restart, otherwise the new process
        // can't acquire the lock and immediately exits (appears as a crash).
        electron_1.app.releaseSingleInstanceLock();
        // Return from IPC first, then hand off to the updater on the next tick.
        // Calling quitAndInstall() inline from an invoke handler can leave the
        // renderer stuck in a half-dead state while the app is trying to exit.
        setImmediate(() => {
            console.log('[Updater] Starting quitAndInstall handoff');
            if (launchDetachedAppImageInstaller()) {
                console.log('[Updater] Started detached AppImage installer handoff');
                electron_1.app.exit(0);
                return;
            }
            const fallbackTimer = setTimeout(() => {
                console.error('[Updater] quitAndInstall did not terminate the app within 8s; forcing quit fallback');
                emitUpdaterError('The updater could not restart automatically. FlowState will close; reopen it manually to complete the update.');
                electron_1.app.quit();
                setTimeout(() => {
                    console.error('[Updater] Graceful quit fallback did not terminate the app; forcing process exit');
                    electron_1.app.exit(0);
                }, 2000);
            }, 8000);
            const clearFallback = () => clearTimeout(fallbackTimer);
            electron_1.app.once('will-quit', clearFallback);
            electron_1.app.once('quit', clearFallback);
            try {
                // Force quit: isSilent=false (show installer), isForceRunAfter=true (relaunch after)
                electron_updater_1.autoUpdater.quitAndInstall(false, true);
            }
            catch (err) {
                clearTimeout(fallbackTimer);
                const message = err.message;
                console.error('[Updater] quitAndInstall failed:', message);
                emitUpdaterError(message);
            }
        });
        return true;
    });
    if (!canUseUpdater) {
        if (!isDev) {
            console.warn(`[Updater] Skipping updater initialization for invalid app version: ${appVersion}`);
        }
        return;
    }
    electron_updater_1.autoUpdater.autoDownload = false;
    electron_updater_1.autoUpdater.autoInstallOnAppQuit = false;
    // Forward events to renderer via IPC
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:available', info);
    });
    electron_updater_1.autoUpdater.on('download-progress', (progress) => {
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:progress', progress);
    });
    electron_updater_1.autoUpdater.on('update-downloaded', () => {
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:downloaded');
    });
    electron_updater_1.autoUpdater.on('update-not-available', () => {
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:not-available');
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        console.error('[Updater] Error:', err.message);
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:error', err.message);
    });
    // Check shortly after launch...
    setTimeout(() => {
        electron_updater_1.autoUpdater.checkForUpdates().catch(() => { });
    }, 5000);
    // ...and re-check periodically. Without this the app only ever checked once
    // at startup, so an update published while the app stayed open was never
    // noticed until a manual relaunch (root cause of the 1.4.45 "didn't update"
    // report). Re-check every 4 hours.
    const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
    setInterval(() => {
        electron_updater_1.autoUpdater.checkForUpdates().catch(() => { });
    }, RECHECK_INTERVAL_MS);
}
//# sourceMappingURL=updater.js.map