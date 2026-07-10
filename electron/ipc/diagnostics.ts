import { ipcMain, app } from 'electron'
import { appendFile, readFile } from 'fs/promises'
import { join } from 'path'

/**
 * BUG-1936: on-disk drag diagnostics. The board's laggy-drag / cards-still-moving symptoms only
 * reproduce in the packaged Electron app (GPU compositing + real data), not in headless Chromium.
 * The renderer buffers drag events + frame timings in memory and flushes one JSON line here per
 * drag, so the behaviour can be read back from disk without a screen recording.
 *
 * File: <userData>/drag-diagnostics.log — i.e. ~/.config/flow-state/drag-diagnostics.log on Linux.
 * userData is pinned to the passwd home (BUG-1932), so the path is stable across launchers.
 */
const logPath = () => join(app.getPath('userData'), 'drag-diagnostics.log')

export function registerDiagnosticsHandlers() {
  ipcMain.handle('diag:appendDrag', async (_event, line: string) => {
    const path = logPath()
    await appendFile(path, `${line}\n`, 'utf-8')
    return path
  })

  ipcMain.handle('diag:dragLogPath', () => logPath())

  ipcMain.handle('diag:readDrag', async () => {
    try {
      return await readFile(logPath(), 'utf-8')
    } catch {
      return ''
    }
  })
}
