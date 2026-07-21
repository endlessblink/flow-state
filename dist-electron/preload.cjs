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
    // BUG-1932: `{ home, pinnedTo }` when a launcher rewrote HOME and userData was pinned back to the
    // real home; null otherwise.
    getHomeOverride: () => electron_1.ipcRenderer.invoke('app:getHomeOverride'),
    // Shell operations (replaces @tauri-apps/plugin-shell)
    openExternal: (url) => electron_1.ipcRenderer.invoke('shell:openExternal', url),
    // Dialog operations (replaces @tauri-apps/plugin-dialog)
    showSaveDialog: (options) => electron_1.ipcRenderer.invoke('dialog:showSave', options),
    showOpenDialog: (options) => electron_1.ipcRenderer.invoke('dialog:showOpen', options),
    // File system (replaces @tauri-apps/plugin-fs)
    readFile: (path) => electron_1.ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, data) => electron_1.ipcRenderer.invoke('fs:writeFile', path, data),
    exists: (path) => electron_1.ipcRenderer.invoke('fs:exists', path),
    mkdir: (path) => electron_1.ipcRenderer.invoke('fs:mkdir', path),
    // Store (replaces @tauri-apps/plugin-store)
    storeGet: (key) => electron_1.ipcRenderer.invoke('store:get', key),
    storeSet: (key, value) => electron_1.ipcRenderer.invoke('store:set', key, value),
    // HTTP (replaces @tauri-apps/plugin-http for CORS bypass)
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
    onUpdateNotAvailable: (callback) => {
        electron_1.ipcRenderer.on('updater:not-available', () => callback());
    },
    onUpdateError: (callback) => {
        electron_1.ipcRenderer.on('updater:error', (_event, message) => callback(String(message)));
    },
    checkForUpdates: () => electron_1.ipcRenderer.invoke('updater:check'),
    downloadUpdate: () => electron_1.ipcRenderer.invoke('updater:download'),
    installUpdate: () => electron_1.ipcRenderer.invoke('updater:install'),
    // Window controls
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
    // Local Task API (Life OS) — TASK-1797
    setLocalApiSession: (session) => electron_1.ipcRenderer.invoke('localApi:setSession', session),
    clearLocalApiSession: () => electron_1.ipcRenderer.invoke('localApi:clearSession'),
    setLocalApiTimerSnapshot: (snapshot) => electron_1.ipcRenderer.invoke('localApi:setTimerSnapshot', snapshot),
    setLocalApiRendererAuthState: (state) => electron_1.ipcRenderer.invoke('localApi:setRendererAuthState', state),
    setLocalApiWorkspaceContext: (state) => electron_1.ipcRenderer.invoke('localApi:setWorkspaceContext', state),
    setLocalApiEnabled: (enabled) => electron_1.ipcRenderer.invoke('localApi:setEnabled', enabled),
    getLocalApiToken: () => electron_1.ipcRenderer.invoke('localApi:getToken'),
    getLocalApiStatus: () => electron_1.ipcRenderer.invoke('localApi:status'),
    onLocalApiTaskMutation: (callback) => {
        electron_1.ipcRenderer.on('localApi:taskMutation', (_event, mutation) => callback(mutation));
    },
    offLocalApiTaskMutation: () => electron_1.ipcRenderer.removeAllListeners('localApi:taskMutation'),
    onLocalApiTimerMutation: (callback) => {
        electron_1.ipcRenderer.on('localApi:timerMutation', (_event, session) => callback(session));
    },
    offLocalApiTimerMutation: () => electron_1.ipcRenderer.removeAllListeners('localApi:timerMutation'),
    // BUG-1936: drag diagnostics — append a JSON line to <userData>/drag-diagnostics.log
    appendDragDiag: (line) => electron_1.ipcRenderer.invoke('diag:appendDrag', line),
    dragDiagPath: () => electron_1.ipcRenderer.invoke('diag:dragLogPath'),
});
//# sourceMappingURL=preload.js.map