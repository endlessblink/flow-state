"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * Expose a safe API to the renderer process via contextBridge.
 * This replaces Tauri's window.__TAURI_INTERNALS__.invoke() pattern.
 *
 * In the renderer, access via: window.electronAPI.invoke('channel', args)
 */
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Generic IPC invoke (replaces Tauri's invoke())
    invoke: (channel, ...args) => electron_1.ipcRenderer.invoke(channel, ...args),
    // Platform detection
    platform: process.platform,
    isElectron: true,
    // App info
    getVersion: () => electron_1.ipcRenderer.invoke('app:getVersion'),
    // Shell operations
    openExternal: (url) => electron_1.ipcRenderer.invoke('shell:openExternal', url),
    // Dialog operations
    showSaveDialog: (options) => electron_1.ipcRenderer.invoke('dialog:showSave', options),
    showOpenDialog: (options) => electron_1.ipcRenderer.invoke('dialog:showOpen', options),
    // File system
    readFile: (path) => electron_1.ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, data) => electron_1.ipcRenderer.invoke('fs:writeFile', path, data),
    exists: (path) => electron_1.ipcRenderer.invoke('fs:exists', path),
    mkdir: (path) => electron_1.ipcRenderer.invoke('fs:mkdir', path),
    // Store
    storeGet: (key) => electron_1.ipcRenderer.invoke('store:get', key),
    storeSet: (key, value) => electron_1.ipcRenderer.invoke('store:set', key, value),
    // HTTP with CORS bypass
    fetch: (url, options) => electron_1.ipcRenderer.invoke('http:fetch', url, options),
    // OAuth localhost server (for desktop Google sign-in)
    oauthStart: () => electron_1.ipcRenderer.invoke('oauth:start'),
    oauthWaitForCallback: () => electron_1.ipcRenderer.invoke('oauth:waitForCallback'),
    oauthCancel: () => electron_1.ipcRenderer.invoke('oauth:cancel'),
    // Auto-updater events
    onUpdateAvailable: (callback) => {
        electron_1.ipcRenderer.on('updater:available', (_event, info) => callback(info));
    },
    onUpdateDownloadProgress: (callback) => {
        electron_1.ipcRenderer.on('updater:progress', (_event, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback) => {
        electron_1.ipcRenderer.on('updater:downloaded', () => callback());
    },
    checkForUpdates: () => electron_1.ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => electron_1.ipcRenderer.invoke('updater:download'),
    installUpdate: () => electron_1.ipcRenderer.invoke('updater:install'),
    // Window controls
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
});
//# sourceMappingURL=preload.js.map