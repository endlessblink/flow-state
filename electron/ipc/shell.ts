import { ipcMain, shell } from 'electron'
import { assertSafeExternalUrl } from './security'

export function registerShellHandlers() {
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(assertSafeExternalUrl(url))
  })
}
