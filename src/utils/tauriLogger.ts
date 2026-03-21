/**
 * Tauri Log Plugin Integration
 * Pipes all console.* calls through tauri-plugin-log so they appear
 * in stdout and log files when running the Tauri desktop app.
 *
 * Log files: ~/.local/share/flow-state/logs/
 */
import { isTauri } from './platform'

let initialized = false

export async function initTauriLogger(): Promise<void> {
  if (initialized || !isTauri()) return
  initialized = true

  try {
    const { warn, debug, info, error, attachConsole } = await import('@tauri-apps/plugin-log')

    // Attach console — forwards Rust-side logs into the browser console too
    await attachConsole()

    // Override console methods to pipe through the log plugin
    const originalLog = console.log.bind(console)
    const originalDebug = console.debug.bind(console)
    const originalInfo = console.info.bind(console)
    const originalWarn = console.warn.bind(console)
    const originalError = console.error.bind(console)

    console.log = (...args: unknown[]) => {
      originalLog(...args)
      info(args.map(String).join(' ')).catch(() => {})
    }

    console.debug = (...args: unknown[]) => {
      originalDebug(...args)
      debug(args.map(String).join(' ')).catch(() => {})
    }

    console.info = (...args: unknown[]) => {
      originalInfo(...args)
      info(args.map(String).join(' ')).catch(() => {})
    }

    console.warn = (...args: unknown[]) => {
      originalWarn(...args)
      warn(args.map(String).join(' ')).catch(() => {})
    }

    console.error = (...args: unknown[]) => {
      originalError(...args)
      error(args.map(String).join(' ')).catch(() => {})
    }

    console.log('[TAURI-LOG] Logger initialized — piping to stdout and log file')
  } catch (e) {
    // Silently fail if plugin not available (e.g., running in browser)
    console.warn('[TAURI-LOG] Failed to initialize:', e)
  }
}
