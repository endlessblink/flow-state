import { ipcMain, shell } from 'electron'

export function registerShellHandlers() {
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url)
  })
}
