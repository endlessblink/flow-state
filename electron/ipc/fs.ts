import { ipcMain } from 'electron'
import { readFile, writeFile, mkdir, access } from 'fs/promises'

export function registerFsHandlers() {
  ipcMain.handle('fs:readFile', async (_event, path: string) => {
    return readFile(path, 'utf-8')
  })

  ipcMain.handle('fs:writeFile', async (_event, path: string, data: string) => {
    await writeFile(path, data, 'utf-8')
  })

  ipcMain.handle('fs:exists', async (_event, path: string) => {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle('fs:mkdir', async (_event, path: string) => {
    await mkdir(path, { recursive: true })
  })
}
