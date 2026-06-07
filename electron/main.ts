import { app, BrowserWindow, shell, ipcMain, Menu, globalShortcut } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerShellHandlers } from './ipc/shell'
import { registerDialogHandlers } from './ipc/dialog'
import { registerFsHandlers } from './ipc/fs'
import { registerStoreHandlers } from './ipc/store'
import { registerHttpHandlers } from './ipc/http'
import { registerWindowHandlers } from './ipc/window'
import { registerUpdater } from './updater'
import { registerOAuthHandlers } from './ipc/oauth'
import { registerLocalApiHandlers, shutdownLocalApi } from './ipc/localApi'

// Set WM_CLASS to match .desktop file's StartupWMClass (must be before any window creation)
app.setName('flow-state')

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

function registerAppMenu() {
  const menu = Menu.buildFromTemplate([
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

// App lifecycle
app.whenReady().then(() => {
  registerAppMenu()
  createWindow()
  globalShortcut.register('CommandOrControl+Shift+I', toggleMainWindowDevTools)
  // TASK-1823: defense-in-depth. The auto-updater is non-essential to loading the
  // app; never let its init (or a missing transitive dep) crash the main process
  // and blank the window. updater.ts already lazy-loads electron-updater safely,
  // but keep this guard so any future updater error degrades to "no auto-update".
  try {
    registerUpdater()
  } catch (err) {
    console.error('[main] Updater init failed — continuing without auto-update:', err)
  }

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
