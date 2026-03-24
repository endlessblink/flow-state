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
// Prevent multiple instances
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
    process.exit(0);
}
let mainWindow = null;
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
electron_1.ipcMain.handle('app:getVersion', () => electron_1.app.getVersion());
// App lifecycle
electron_1.app.whenReady().then(() => {
    createWindow();
    (0, updater_1.registerUpdater)();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
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