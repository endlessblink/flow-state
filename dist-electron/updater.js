"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUpdater = registerUpdater;
const electron_updater_1 = require("electron-updater");
const electron_1 = require("electron");
/**
 * Electron auto-updater setup.
 * Uses generic provider pointing to VPS at /updates/electron/
 * Replaces Tauri's auto-updater (SOP-037).
 */
function registerUpdater() {
    // Don't check for updates in dev
    if (process.env.VITE_DEV_SERVER_URL)
        return;
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
    // IPC handlers for renderer control
    electron_1.ipcMain.handle('updater:check', async () => {
        try {
            return await electron_updater_1.autoUpdater.checkForUpdates();
        }
        catch (err) {
            console.error('[Updater] Check failed:', err.message);
            return null;
        }
    });
    electron_1.ipcMain.handle('updater:download', async () => {
        await electron_updater_1.autoUpdater.downloadUpdate();
    });
    electron_1.ipcMain.handle('updater:install', () => {
        // Release single-instance lock before restart, otherwise the new process
        // can't acquire the lock and immediately exits (appears as a crash).
        electron_1.app.releaseSingleInstanceLock();
        // Return from IPC first, then hand off to the updater on the next tick.
        // Calling quitAndInstall() inline from an invoke handler can leave the
        // renderer stuck in a half-dead state while the app is trying to exit.
        setImmediate(() => {
            // Force quit: isSilent=false (show installer), isForceRunAfter=true (relaunch after)
            electron_updater_1.autoUpdater.quitAndInstall(false, true);
        });
        return true;
    });
    // Check for updates after 5s delay
    setTimeout(() => {
        electron_updater_1.autoUpdater.checkForUpdates().catch(() => { });
    }, 5000);
}
//# sourceMappingURL=updater.js.map