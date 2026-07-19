"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const fs_1 = require("fs");
const os_1 = require("os");
const userDataPath_1 = require("./userDataPath");
const shell_1 = require("./ipc/shell");
const dialog_1 = require("./ipc/dialog");
const fs_2 = require("./ipc/fs");
const store_1 = require("./ipc/store");
const http_1 = require("./ipc/http");
const window_1 = require("./ipc/window");
const updater_1 = require("./updater");
const oauth_1 = require("./ipc/oauth");
const localApi_1 = require("./ipc/localApi");
const diagnostics_1 = require("./ipc/diagnostics");
const backgroundWindowLifecycle_1 = require("./backgroundWindowLifecycle");
function installBrokenPipeConsoleGuard() {
    const isBrokenPipe = (err) => typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        err.code === 'EPIPE';
    for (const stream of [process.stdout, process.stderr]) {
        stream.on('error', (err) => {
            if (isBrokenPipe(err))
                return;
            throw err;
        });
    }
    process.on('uncaughtException', (err) => {
        if (isBrokenPipe(err))
            return;
        throw err;
    });
    for (const method of ['log', 'info', 'warn', 'error']) {
        const original = console[method].bind(console);
        console[method] = (...args) => {
            try {
                original(...args);
            }
            catch (err) {
                if (!isBrokenPipe(err))
                    throw err;
            }
        };
    }
}
installBrokenPipeConsoleGuard();
// Set WM_CLASS to match .desktop file's StartupWMClass (must be before any window creation)
electron_1.app.setName('flow-state');
/**
 * BUG-1932: pin `userData` to the passwd home before anything reads a path. `store.json` (auth) and
 * `local-api.json` (sidecar token) both live under `userData`, so a launcher-supplied `HOME` yields
 * an empty profile — a phantom sign-out — plus a Local API port bound with an unreadable token.
 * Must run before `registerStoreHandlers()` / `registerLocalApiHandlers()`.
 */
let homeOverride = null;
function pinUserDataToRealHome() {
    let passwdHome = '';
    try {
        passwdHome = (0, os_1.userInfo)().homedir;
    }
    catch {
        return; // No passwd entry (unusual container). Leave Electron's default alone.
    }
    const pinned = (0, userDataPath_1.resolveUserDataDir)({
        env: process.env,
        passwdHome,
        appName: electron_1.app.getName(),
        platform: process.platform,
    });
    if (pinned) {
        electron_1.app.setPath('userData', pinned);
        homeOverride = { home: process.env.HOME ?? '(unset)', pinnedTo: pinned };
        console.warn(`[flowstate] HOME override detected (HOME=${homeOverride.home}). ` +
            `userData pinned to ${pinned}. Set FLOWSTATE_ALLOW_HOME_OVERRIDE=1 to opt out.`);
    }
    console.log(`[flowstate] userData: ${electron_1.app.getPath('userData')}`);
}
pinUserDataToRealHome();
// Prevent multiple instances
const gotLock = electron_1.app.requestSingleInstanceLock();
if (!gotLock) {
    electron_1.app.quit();
    process.exit(0);
}
let mainWindow = null;
const backgroundEnabled = (0, backgroundWindowLifecycle_1.isBackgroundLaunch)(process.argv) || process.env.FLOWSTATE_SUPERVISED === '1';
const backgroundLifecycle = (0, backgroundWindowLifecycle_1.createBackgroundWindowLifecycle)({
    getWindow: () => mainWindow,
    createWindow,
    isBackgroundEnabled: () => backgroundEnabled,
});
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
let storeFlushedForQuit = false;
let storeFlushForQuitPromise = null;
let destroyWindowAfterStoreFlush = false;
let signalQuitRequested = false;
// TASK-1871: Reliable quit. The durable main-process store must flush before the renderer is
// destroyed; once it has, force-destroy the window so a renderer beforeunload guard cannot wedge
// Ctrl/Cmd+Q or the File menu.
function forceQuit() {
    backgroundLifecycle.beginQuit();
    destroyWindowAfterStoreFlush = true;
    electron_1.app.quit();
}
function requestGracefulSignalQuit() {
    if (signalQuitRequested)
        return;
    signalQuitRequested = true;
    forceQuit();
}
process.on('SIGTERM', requestGracefulSignalQuit);
process.on('SIGINT', requestGracefulSignalQuit);
function registerAppMenu() {
    const menu = electron_1.Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'Quit FlowState',
                    accelerator: 'CommandOrControl+Q',
                    click: forceQuit,
                },
            ],
        },
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
    const window = new electron_1.BrowserWindow({
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
            // The hidden renderer remains the auth-refresh and Local API heartbeat owner.
            backgroundThrottling: false,
        },
        // Glass-like frame
        titleBarStyle: 'hiddenInset',
        backgroundColor: '#0f0d1a',
        autoHideMenuBar: true,
        show: false,
    });
    mainWindow = window;
    // Show when ready to prevent white flash
    window.once('ready-to-show', () => {
        backgroundLifecycle.handleReadyToShow(window, process.argv);
    });
    window.on('close', (event) => {
        backgroundLifecycle.handleClose(event, window);
    });
    // Open external links in default browser
    window.webContents.setWindowOpenHandler(({ url }) => {
        electron_1.shell.openExternal(url);
        return { action: 'deny' };
    });
    // Electron can consume renderer keydown events in some focused states. Keep
    // search shortcuts available while preserving the renderer's input/modal guard.
    window.webContents.on('before-input-event', (_event, input) => {
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
    window.webContents.on('will-navigate', (event, url) => {
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
        window.loadURL(process.env.VITE_DEV_SERVER_URL);
        window.webContents.openDevTools();
    }
    else {
        // Production — load built files
        const indexPath = (0, path_1.join)(__dirname, '../dist/index.html');
        if ((0, fs_1.existsSync)(indexPath)) {
            window.loadFile(indexPath);
        }
        else {
            console.error('dist/index.html not found — run npm run build first');
            electron_1.app.quit();
        }
    }
    window.on('closed', () => {
        if (mainWindow === window)
            mainWindow = null;
    });
    return window;
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
(0, diagnostics_1.registerDiagnosticsHandlers)();
electron_1.ipcMain.handle('app:getVersion', () => electron_1.app.getVersion());
// BUG-1932: null unless a launcher's HOME was overridden. Renderer surfaces it so a deliberate
// sandbox run is never silently redirected to the real profile.
electron_1.ipcMain.handle('app:getHomeOverride', () => homeOverride);
// App lifecycle
electron_1.app.whenReady().then(() => {
    registerAppMenu();
    createWindow();
    electron_1.globalShortcut.register('CommandOrControl+Shift+I', toggleMainWindowDevTools);
    (0, updater_1.registerUpdater)();
    electron_1.app.on('activate', () => {
        backgroundLifecycle.showOrCreate();
    });
});
electron_1.app.on('before-quit', (event) => {
    if (storeFlushedForQuit) {
        electron_1.globalShortcut.unregister('CommandOrControl+Shift+I');
        return;
    }
    // Electron does not await async lifecycle listeners. Cancel this quit attempt, finish every
    // queued auth/store write, then issue a second quit that is allowed through by the flag above.
    event.preventDefault();
    if (storeFlushForQuitPromise)
        return;
    storeFlushForQuitPromise = (async () => {
        try {
            let timeout = null;
            try {
                await Promise.race([
                    (0, store_1.flushStore)(),
                    new Promise((_resolve, reject) => {
                        timeout = setTimeout(() => reject(new Error('Store flush before quit timed out')), 5000);
                    }),
                ]);
            }
            finally {
                if (timeout)
                    clearTimeout(timeout);
            }
            await (0, localApi_1.shutdownLocalApi)();
            storeFlushedForQuit = true;
            if (destroyWindowAfterStoreFlush && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.destroy();
            }
            electron_1.app.quit();
            // If another lifecycle listener canceled the second quit, require a new
            // checkpoint instead of letting this one-shot success stay valid forever.
            setTimeout(() => {
                storeFlushedForQuit = false;
                storeFlushForQuitPromise = null;
                destroyWindowAfterStoreFlush = false;
            }, 0);
        }
        catch (err) {
            // Losing a newly rotated refresh token is worse than aborting a quit. Leave the process alive
            // so the user can retry instead of silently reopening into a signed-out account.
            console.error('[flowstate] Quit aborted because durable store flush failed:', err.message);
            storeFlushForQuitPromise = null;
        }
    })();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// Handle second instance — focus existing window
electron_1.app.on('second-instance', () => {
    backgroundLifecycle.showOrCreate();
});
//# sourceMappingURL=main.js.map