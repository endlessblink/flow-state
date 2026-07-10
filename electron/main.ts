import { app, BrowserWindow, shell, ipcMain, Menu, globalShortcut } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { userInfo } from 'os'
import { resolveUserDataDir } from './userDataPath'
import { registerShellHandlers } from './ipc/shell'
import { registerDialogHandlers } from './ipc/dialog'
import { registerFsHandlers } from './ipc/fs'
import { registerStoreHandlers } from './ipc/store'
import { registerHttpHandlers } from './ipc/http'
import { registerWindowHandlers } from './ipc/window'
import { registerUpdater } from './updater'
import { registerOAuthHandlers } from './ipc/oauth'
import { registerLocalApiHandlers, shutdownLocalApi } from './ipc/localApi'

function installBrokenPipeConsoleGuard() {
  const isBrokenPipe = (err: unknown) =>
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'EPIPE'

  for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (err) => {
      if (isBrokenPipe(err)) return
      throw err
    })
  }

  process.on('uncaughtException', (err) => {
    if (isBrokenPipe(err)) return
    throw err
  })

  for (const method of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[method].bind(console)
    console[method] = (...args: unknown[]) => {
      try {
        original(...args)
      } catch (err) {
        if (!isBrokenPipe(err)) throw err
      }
    }
  }
}

installBrokenPipeConsoleGuard()

// Set WM_CLASS to match .desktop file's StartupWMClass (must be before any window creation)
app.setName('flow-state')

/**
 * BUG-1932: pin `userData` to the passwd home before anything reads a path. `store.json` (auth) and
 * `local-api.json` (sidecar token) both live under `userData`, so a launcher-supplied `HOME` yields
 * an empty profile — a phantom sign-out — plus a Local API port bound with an unreadable token.
 * Must run before `registerStoreHandlers()` / `registerLocalApiHandlers()`.
 */
let homeOverride: { home: string; pinnedTo: string } | null = null

function pinUserDataToRealHome() {
  let passwdHome = ''
  try {
    passwdHome = userInfo().homedir
  } catch {
    return // No passwd entry (unusual container). Leave Electron's default alone.
  }

  const pinned = resolveUserDataDir({
    env: process.env,
    passwdHome,
    appName: app.getName(),
    platform: process.platform,
  })

  if (pinned) {
    app.setPath('userData', pinned)
    homeOverride = { home: process.env.HOME ?? '(unset)', pinnedTo: pinned }
    console.warn(
      `[flowstate] HOME override detected (HOME=${homeOverride.home}). ` +
        `userData pinned to ${pinned}. Set FLOWSTATE_ALLOW_HOME_OVERRIDE=1 to opt out.`
    )
  }

  console.log(`[flowstate] userData: ${app.getPath('userData')}`)
}

pinUserDataToRealHome()

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null

function openSearchInRenderer() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  mainWindow.webContents.executeJavaScript(`(() => {
    const target = document.activeElement;
    if (target?.closest?.('.quick-task-section')) return;
    const tagName = target?.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || target?.isContentEditable) return;
    if (target?.closest?.('[role="dialog"], .modal, .n-modal')) return;
    window.dispatchEvent(new CustomEvent('open-search'));
  })()`)
}

function toggleMainWindowDevTools() {
  const webContents = mainWindow?.webContents
  if (!webContents || webContents.isDestroyed()) return
  if (webContents.isDevToolsOpened()) {
    webContents.closeDevTools()
  } else {
    webContents.openDevTools({ mode: 'detach' })
  }
}

// TASK-1871: Reliable quit. Force-destroys the window so nothing in the
// renderer (e.g. a beforeunload guard) can wedge the close — the recurring
// "can't quit FlowState" regression. Bound to Ctrl/Cmd+Q and the File menu.
function forceQuit() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
  }
  app.quit()
}

function registerAppMenu() {
  const menu = Menu.buildFromTemplate([
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
  ])

  Menu.setApplicationMenu(menu)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'FlowState',
    icon: join(__dirname, '../src-tauri/icons/icon.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    // Glass-like frame
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0d1a',
    autoHideMenuBar: true,
    show: false,
  })

  // Show when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Electron can consume renderer keydown events in some focused states. Keep
  // search shortcuts available while preserving the renderer's input/modal guard.
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    const key = input.key.toLowerCase()
    if (input.control && input.shift && (key === 'i' || input.code === 'KeyI')) {
      toggleMainWindowDevTools()
      return
    }

    const isSearchKey = key === 'f' || input.code === 'KeyF'
    const isSearchShortcut =
      (input.control || input.meta) &&
      input.shift &&
      !input.alt &&
      isSearchKey

    if (!isSearchShortcut) return

    _event.preventDefault()
    openSearchInRenderer()
  })

  // Catch plain <a href> clicks and any programmatic navigation that would
  // replace the app window. setWindowOpenHandler only fires for target="_blank"
  // and window.open(); will-navigate covers everything else.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const currentUrl = mainWindow?.webContents.getURL() ?? ''
    try {
      const target = new URL(url)
      const here = new URL(currentUrl)
      const isHttp = target.protocol === 'http:' || target.protocol === 'https:'
      if (isHttp && target.origin !== here.origin) {
        event.preventDefault()
        shell.openExternal(url)
      }
    } catch {
      // Unparseable URL — let Electron decide.
    }
  })

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    // Dev mode — connect to Vite dev server
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    // Production — load built files
    const indexPath = join(__dirname, '../dist/index.html')
    if (existsSync(indexPath)) {
      mainWindow.loadFile(indexPath)
    } else {
      console.error('dist/index.html not found — run npm run build first')
      app.quit()
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Register IPC handlers (must be before window creation)
registerShellHandlers()
registerDialogHandlers()
registerFsHandlers()
registerStoreHandlers()
registerHttpHandlers()
registerWindowHandlers()
registerOAuthHandlers()
registerLocalApiHandlers()
ipcMain.handle('app:getVersion', () => app.getVersion())
// BUG-1932: null unless a launcher's HOME was overridden. Renderer surfaces it so a deliberate
// sandbox run is never silently redirected to the real profile.
ipcMain.handle('app:getHomeOverride', () => homeOverride)

// App lifecycle
app.whenReady().then(() => {
  registerAppMenu()
  createWindow()
  globalShortcut.register('CommandOrControl+Shift+I', toggleMainWindowDevTools)
  registerUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  globalShortcut.unregister('CommandOrControl+Shift+I')
  shutdownLocalApi()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle second instance — focus existing window
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})
