import { ipcMain, dialog, BrowserWindow } from 'electron'

export function registerDialogHandlers() {
  ipcMain.handle('dialog:showSave', async (_event, options: Electron.SaveDialogOptions) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { canceled: true, filePath: undefined }
    return dialog.showSaveDialog(win, options)
  })

  ipcMain.handle('dialog:showOpen', async (_event, options: Electron.OpenDialogOptions) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return { canceled: true, filePaths: [] }
    return dialog.showOpenDialog(win, options)
  })
}
