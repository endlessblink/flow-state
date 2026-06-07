"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUpdater = registerUpdater;
const electron_1 = require("electron");
function hasValidAppVersion(version) {
    return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);
}
/**
 * Lazily load electron-updater. CRITICAL (TASK-1823): a static top-level
 * `import { autoUpdater } from 'electron-updater'` runs at module-load time, so
 * if electron-updater (or any of its transitive deps — e.g. fs-extra's
 * `universalify`) is missing from the packaged asar, the require throws BEFORE
 * the app body runs and the ENTIRE main process dies → blank window, no app.
 * That exact crash shipped and blanked the desktop app. Loading it lazily inside
 * a try/catch means a broken/missing updater dependency degrades the updater to
 * a no-op instead of taking down the whole app. The auto-updater is never
 * essential to the app *loading*.
 */
function loadAutoUpdater() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require('electron-updater').autoUpdater;
    }
    catch (err) {
        console.error('[Updater] electron-updater unavailable — auto-update disabled, app continues:', err.message);
        return null;
    }
}
/**
 * Electron auto-updater setup.
 * Uses generic provider pointing to VPS at /updates/electron/
 * Replaces Tauri's auto-updater (SOP-037).
 */
function registerUpdater() {
    const isDev = !!process.env.VITE_DEV_SERVER_URL;
    const appVersion = electron_1.app.getVersion();
    const autoUpdater = loadAutoUpdater();
    const canUseUpdater = !isDev && hasValidAppVersion(appVersion) && autoUpdater !== null;
    // Register IPC handlers in all environments so renderer invocations don't
    // fail during local dev. In dev or unpackaged preview mode, updater actions
    // become safe no-ops.
    electron_1.ipcMain.handle('updater:check', async () => {
        if (!canUseUpdater || !autoUpdater)
            return null;
        try {
            return await autoUpdater.checkForUpdates();
        }
        catch (err) {
            console.error('[Updater] Check failed:', err.message);
            return null;
        }
    });
    electron_1.ipcMain.handle('updater:download', async () => {
        if (!canUseUpdater || !autoUpdater)
            return;
        await autoUpdater.downloadUpdate();
    });
    electron_1.ipcMain.handle('updater:install', () => {
        if (!canUseUpdater || !autoUpdater)
            return true;
        // Release single-instance lock before restart, otherwise the new process
        // can't acquire the lock and immediately exits (appears as a crash).
        electron_1.app.releaseSingleInstanceLock();
        // Return from IPC first, then hand off to the updater on the next tick.
        // Calling quitAndInstall() inline from an invoke handler can leave the
        // renderer stuck in a half-dead state while the app is trying to exit.
        setImmediate(() => {
            // Force quit: isSilent=false (show installer), isForceRunAfter=true (relaunch after)
            autoUpdater.quitAndInstall(false, true);
        });
        return true;
    });
    if (!canUseUpdater || !autoUpdater) {
        if (!isDev) {
            console.warn(`[Updater] Skipping updater initialization for invalid app version: ${appVersion}`);
        }
        return;
    }
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    // Forward events to renderer via IPC
    autoUpdater.on('update-available', (info) => {
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:available', info);
    });
    autoUpdater.on('download-progress', (progress) => {
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:progress', progress);
    });
    autoUpdater.on('update-downloaded', () => {
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:downloaded');
    });
    autoUpdater.on('update-not-available', () => {
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:not-available');
    });
    autoUpdater.on('error', (err) => {
        console.error('[Updater] Error:', err.message);
        const win = electron_1.BrowserWindow.getAllWindows()[0];
        if (win)
            win.webContents.send('updater:error', err.message);
    });
    // Check shortly after launch...
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => { });
    }, 5000);
    // ...and re-check periodically. Without this the app only ever checked once
    // at startup, so an update published while the app stayed open was never
    // noticed until a manual relaunch (root cause of the 1.4.45 "didn't update"
    // report). Re-check every 4 hours.
    const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
    setInterval(() => {
        autoUpdater.checkForUpdates().catch(() => { });
    }, RECHECK_INTERVAL_MS);
}
//# sourceMappingURL=updater.js.map