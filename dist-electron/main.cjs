"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const fs_1 = require("fs");
const shell_1 = require("./ipc/shell");
const dialog_1 = require("./ipc/dialog");
const fs_2 = require("./ipc/fs");
const store_1 = require("./ipc/store");
const http_1 = require("./ipc/http");
const window_1 = require("./ipc/window");
const updater_1 = require("./updater");
const oauth_1 = require("./ipc/oauth");
const localApi_1 = require("./ipc/localApi");
// Set WM_CLASS to match .desktop file's StartupWMClass (must be before any window creation)
electron_1.app.setName('flow-state');
// Prevent multiple instances
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
    process.exit(0);
}
let mainWindow = null;
function openSearchInRenderer() {
    if (!mainWindow || mainWindow.isDestroyed())
        return;
    mainWindow.webContents.executeJavaScript(`(() => {
    const target = document.activeElement;
    if (target?.closest?.('.quick-task-section')) return;
    const tagName = target?.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) return;
    if (target?.closest?.('[role="dialog"], .modal, .n-modal')) return;
    window.dispatchEvent(new CustomEvent('open-search'));
  })()`);
}
function toggleMainWindowDevTools() {
    const webContents = mainWindow?.webContents;
    if (!webContents || webContents.isDestroyed())
        return;
    if (webContents.isDevToolsOpened()) {
        webContents.closeDevTools();
    }
    else {
        webContents.openDevTools({ mode: 'detach' });
    }
}
function registerAppMenu() {
    const menu = electron_1.Menu.buildFromTemplate([
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { type: 'separator' },
                {
                    label: 'Search Tasks',
                    accelerator: 'CommandOrControl+Shift+F',
                    click: openSearchInRenderer,
                },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: 'CommandOrControl+Shift+I',
                    click: toggleMainWindowDevTools,
                },
            ],
        },
    ]);
    electron_1.Menu.setApplicationMenu(menu);
}
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 800,
        minHeight: 600,
        title: 'FlowState',
        icon: (0, path_1.join)(__dirname, '../src-tauri/icons/icon.png'),
        webPreferences: {
            preload: (0, path_1.join)(__dirname, 'preload.cjs'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        // Glass-like frame
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0f0d1a',
        autoHideMenuBar: true,
        show: false,
    });
    // Show when ready to prevent white flash
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    // Electron can consume renderer keydown events in some focused states. Keep
    // search shortcuts available while preserving the renderer's input/modal guard.
    mainWindow.webContents.on('before-input-event', (_event, input) => {
        const key = input.key.toLowerCase();
        if (input.control && input.shift && (key === 'i' || input.code === 'KeyI')) {
            toggleMainWindowDevTools();
            return;
        }
        const isSearchKey = key === 'f' || input.code === 'KeyF';
        const isSearchShortcut = (input.control || input.meta) &&
            input.shift &&
            !input.alt &&
            isSearchKey;
        if (!isSearchShortcut)
            return;
        _event.preventDefault();
        openSearchInRenderer();
    });
    // Catch plain <a href> clicks and any programmatic navigation that would
    // replace the app window. setWindowOpenHandler only fires for target="_blank"
    // and window.open(); will-navigate covers everything else.
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const currentUrl = mainWindow?.webContents.getURL() ?? '';
        try {
            const target = new URL(url);
            const here = new URL(currentUrl);
            const isHttp = target.protocol === 'http:' || target.protocol === 'https:';
            if (isHttp && target.origin !== here.origin) {
                event.preventDefault();
                electron_1.shell.openExternal(url);
            }
        }
        catch {
            // Unparseable URL — let Electron decide.
        }
    });
    // Load the app
    if (process.env.VITE_DEV_SERVER_URL) {
        // Dev mode — connect to Vite dev server
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools();
    }
    else {
        // Production — load built files
        const indexPath = (0, path_1.join)(__dirname, '../dist/index.html');
        if ((0, fs_1.existsSync)(indexPath)) {
            mainWindow.loadFile(indexPath);
        }
        else {
            console.error('dist/index.html not found — run npm run build first');
            electron_1.app.quit();
        }
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// Register IPC handlers (must be before window creation)
(0, shell_1.registerShellHandlers)();
(0, dialog_1.registerDialogHandlers)();
(0, fs_2.registerFsHandlers)();
(0, store_1.registerStoreHandlers)();
(0, http_1.registerHttpHandlers)();
(0, window_1.registerWindowHandlers)();
(0, oauth_1.registerOAuthHandlers)();
(0, localApi_1.registerLocalApiHandlers)();
electron_1.ipcMain.handle('app:getVersion', () => electron_1.app.getVersion());
// App lifecycle
electron_1.app.whenReady().then(() => {
    registerAppMenu();
    createWindow();
    electron_1.globalShortcut.register('CommandOrControl+Shift+I', toggleMainWindowDevTools);
    // TASK-1823: defense-in-depth. The auto-updater is non-essential to loading the
    // app; never let its init (or a missing transitive dep) crash the main process
    // and blank the window. updater.ts already lazy-loads electron-updater safely,
    // but keep this guard so any future updater error degrades to "no auto-update".
    try {
        (0, updater_1.registerUpdater)();
    }
    catch (err) {
        console.error('[main] Updater init failed — continuing without auto-update:', err);
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('before-quit', () => {
    electron_1.globalShortcut.unregister('CommandOrControl+Shift+I');
    (0, localApi_1.shutdownLocalApi)();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// Handle second instance — focus existing window
electron_1.app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized())
            mainWindow.restore();
        mainWindow.focus();
    }
});
//# sourceMappingURL=main.js.map