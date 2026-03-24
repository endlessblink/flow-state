import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { registerShellHandlers } from './ipc/shell'
import { registerDialogHandlers } from './ipc/dialog'
import { registerFsHandlers } from './ipc/fs'
import { registerStoreHandlers } from './ipc/store'
import { registerHttpHandlers } from './ipc/http'
import { registerWindowHandlers } from './ipc/window'

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null

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
ipcMain.handle('app:getVersion', () => app.getVersion())

// App lifecycle
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
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
