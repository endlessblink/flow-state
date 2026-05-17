import { app, BrowserWindow, ipcMain } from 'electron'
import { mkdirSync, existsSync, statSync, renameSync, appendFileSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * TASK-1786: Renderer log capture
 *
 * Mirrors renderer-side console.{log,warn,error,info,debug} into a rotating
 * file under app.getPath('logs') so post-mortem diagnostics are possible on
 * user machines without needing DevTools open.
 *
 * Log path (Linux): ~/.config/flow-state/logs/renderer.log
 * Rotation: when current file exceeds MAX_BYTES, rename to .1 (single rotation).
 * IPC: 'logs:getPath' returns the directory, 'logs:tail' returns last N bytes.
 */

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB per file
const LEVEL_MAP: Record<number, string> = { 0: 'LOG', 1: 'WARN', 2: 'ERROR', 3: 'INFO', 4: 'DEBUG' }

let logDir = ''
let logFile = ''

function ensureLogDir(): void {
  if (!logDir) {
    logDir = app.getPath('logs')
    logFile = join(logDir, 'renderer.log')
  }
  try {
    if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true })
  } catch (err) {
    // Best-effort — don't crash app over logging
    console.error('[Logger] Failed to create log dir:', (err as Error).message)
  }
}

function rotateIfNeeded(): void {
  try {
    if (!existsSync(logFile)) return
    const size = statSync(logFile).size
    if (size > MAX_BYTES) {
      const rotated = `${logFile}.1`
      // Single-rotation scheme: overwrite any prior .1
      renameSync(logFile, rotated)
    }
  } catch {
    /* swallow */
  }
}

function writeLine(level: string, source: string, message: string): void {
  ensureLogDir()
  rotateIfNeeded()
  const ts = new Date().toISOString()
  // One line per record. Newlines in user messages are escaped to keep grep-friendly.
  const safeMsg = message.replace(/\r?\n/g, '\\n')
  const line = `${ts} [${level}] [${source}] ${safeMsg}\n`
  try {
    appendFileSync(logFile, line, 'utf8')
  } catch (err) {
    console.error('[Logger] Failed to write log line:', (err as Error).message)
  }
}

export function setupRendererLogging(win: BrowserWindow): void {
  ensureLogDir()

  // Capture all renderer console.* calls
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const lvl = LEVEL_MAP[level] ?? `L${level}`
    // sourceId is often a chunk URL — keep just the filename for readability
    const src = (sourceId || '').split('/').pop() || 'renderer'
    writeLine(lvl, `${src}:${line}`, message)
  })

  // Capture renderer crashes
  win.webContents.on('render-process-gone', (_event, details) => {
    writeLine('FATAL', 'renderer', `process-gone reason=${details.reason} exitCode=${details.exitCode}`)
  })

  // Capture unresponsive renderer
  win.webContents.on('unresponsive', () => {
    writeLine('WARN', 'renderer', 'webContents reported unresponsive')
  })
  win.webContents.on('responsive', () => {
    writeLine('INFO', 'renderer', 'webContents responsive again')
  })

  writeLine('INFO', 'main', `Logger initialised, version=${app.getVersion()}`)
}

/**
 * Register IPC handlers so the renderer can show a "Open log folder" button
 * or fetch the tail for an in-app diagnostics view.
 */
export function registerLoggerIpc(): void {
  ipcMain.handle('logs:getPath', () => {
    ensureLogDir()
    return { dir: logDir, file: logFile }
  })

  ipcMain.handle('logs:tail', (_event, maxBytes: number = 64 * 1024) => {
    ensureLogDir()
    try {
      if (!existsSync(logFile)) return ''
      const size = statSync(logFile).size
      const start = Math.max(0, size - maxBytes)
      const buf = readFileSync(logFile)
      return buf.slice(start).toString('utf8')
    } catch (err) {
      return `[Logger] Failed to read log: ${(err as Error).message}`
    }
  })
}
