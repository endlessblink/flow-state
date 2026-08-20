import { app, BrowserWindow, ipcMain } from 'electron'
import { appendFile, mkdir, rename, stat } from 'fs/promises'
import { dirname } from 'path'
import {
  formatRuntimeDiagnostic,
  HEARTBEAT_STALE_AFTER_MS,
  isRendererHeartbeatStale,
  RUNTIME_LOG_MAX_BYTES,
  runtimeLogPaths,
} from './runtimeDiagnosticsPolicy'

type RendererHeartbeat = {
  route?: string
  visibility?: string
  readyState?: string
  performanceNow?: number
  memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number }
}

let logWrite: Promise<void> = Promise.resolve()
let healthTimer: ReturnType<typeof setInterval> | null = null
let lastHeartbeatAt: number | null = null
let lastHeartbeat: RendererHeartbeat | null = null
let lastStaleReportAt: number | null = null

function logPath(): string {
  return runtimeLogPaths(app.getPath('userData'))[0]
}

function enqueueLog(line: string): Promise<void> {
  logWrite = logWrite.then(async () => {
    const path = logPath()
    await mkdir(dirname(path), { recursive: true })
    try {
      const info = await stat(path)
      if (info.size + Buffer.byteLength(line, 'utf8') > RUNTIME_LOG_MAX_BYTES) {
        const paths = runtimeLogPaths(app.getPath('userData'))
        for (let index = paths.length - 1; index > 0; index -= 1) {
          try {
            await rename(paths[index - 1], paths[index])
          } catch {
            // A missing older backup is expected during first launch.
          }
        }
      }
    } catch {
      // The active log does not exist yet.
    }
    await appendFile(path, line, 'utf8')
  }).catch(() => {
    // Diagnostics must never take down the app or create an unhandled rejection.
  })
  return logWrite
}

export function recordRuntimeDiagnostic(event: string, data: Record<string, unknown> = {}): void {
  void enqueueLog(formatRuntimeDiagnostic(event, data))
}

function rendererSnapshot(): Record<string, unknown> {
  return {
    lastHeartbeatAt,
    heartbeatAgeMs: lastHeartbeatAt === null ? null : Date.now() - lastHeartbeatAt,
    ...lastHeartbeat,
  }
}

function installConsoleCapture(): void {
  for (const method of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[method].bind(console)
    console[method] = (...args: unknown[]) => {
      recordRuntimeDiagnostic(`console-${method}`, {
        args: args.map((value) => {
          try { return typeof value === 'string' ? value : JSON.stringify(value) } catch { return String(value) }
        }),
      })
      original(...args)
    }
  }
}

export function registerRuntimeDiagnostics(getWindow: () => BrowserWindow | null): void {
  installConsoleCapture()
  recordRuntimeDiagnostic('main-start', {
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    userData: app.getPath('userData'),
    argv: process.argv,
  })

  process.on('uncaughtException', (error) => {
    recordRuntimeDiagnostic('main-uncaught-exception', { message: error.message, stack: error.stack })
  })
  process.on('unhandledRejection', (reason) => {
    recordRuntimeDiagnostic('main-unhandled-rejection', { reason: String(reason) })
  })

  app.on('child-process-gone', (_event, details) => {
    recordRuntimeDiagnostic('child-process-gone', {
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode,
    })
  })

ipcMain.handle('diag:rendererHeartbeat', (_event, heartbeat: RendererHeartbeat) => {
    const diagnosticHeartbeat = heartbeat as RendererHeartbeat & {
      lastError?: unknown
      lastUnhandledRejection?: unknown
    }
    if (diagnosticHeartbeat.lastError) {
      recordRuntimeDiagnostic('renderer-error', { error: diagnosticHeartbeat.lastError })
    }
    if (diagnosticHeartbeat.lastUnhandledRejection) {
      recordRuntimeDiagnostic('renderer-unhandled-rejection', {
        reason: diagnosticHeartbeat.lastUnhandledRejection,
      })
    }
    lastHeartbeatAt = Date.now()
    lastHeartbeat = heartbeat ?? null
  })

  ipcMain.handle('diag:runtimeLogPath', () => logPath())

  const window = getWindow()
  if (window) {
    attachWindowRuntimeDiagnostics(window)
  }

  healthTimer = setInterval(() => {
    const stale = isRendererHeartbeatStale(lastHeartbeatAt)
    if (stale && (lastStaleReportAt === null || Date.now() - lastStaleReportAt >= HEARTBEAT_STALE_AFTER_MS)) {
      lastStaleReportAt = Date.now()
      recordRuntimeDiagnostic('renderer-heartbeat-stale', rendererSnapshot())
    }
    recordRuntimeDiagnostic('main-health', {
      renderer: rendererSnapshot(),
      windowVisible: Boolean(window && !window.isDestroyed() && window.isVisible()),
    })
  }, HEARTBEAT_STALE_AFTER_MS)
}

export function attachWindowRuntimeDiagnostics(window: BrowserWindow): void {
  window.webContents.on('unresponsive', () => {
    recordRuntimeDiagnostic('renderer-unresponsive', rendererSnapshot())
  })
  window.webContents.on('responsive', () => {
    recordRuntimeDiagnostic('renderer-responsive', rendererSnapshot())
  })
  window.webContents.on('render-process-gone', (_event, details) => {
    recordRuntimeDiagnostic('window-render-process-gone', {
      reason: details.reason,
      exitCode: details.exitCode,
      renderer: rendererSnapshot(),
    })
  })
  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      recordRuntimeDiagnostic('renderer-console', {
          level,
          message,
          line,
          sourceId,
      })
    }
  })
}

export function stopRuntimeDiagnostics(): void {
  if (healthTimer) clearInterval(healthTimer)
  healthTimer = null
}
