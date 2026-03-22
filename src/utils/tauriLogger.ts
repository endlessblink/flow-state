/**
 * Tauri Log Plugin Integration
 * Mirrors Rust-side logs into the webview console when running the
 * Tauri desktop app.
 *
 * !! CRITICAL SAFETY RULE — READ BEFORE EDITING !!
 *
 * This file must ONLY call attachConsole() (Rust -> JS direction).
 *
 * NEVER import { warn, debug, info, error } from '@tauri-apps/plugin-log'
 * NEVER override console.* to call Rust log functions
 *
 * In March 2026 the original version forwarded every console.* call into
 * the Rust log file (JS -> Rust direction). Combined with no rotation or
 * size limit, this produced a 146 GB log file that filled the disk and
 * made the system unusable. The fix was to remove the forwarding and add
 * KeepOne rotation + 2 MB cap on the Rust side (lib.rs).
 *
 * Log files: ~/.local/share/com.flowstate.app/logs/
 */
import { isTauri } from './platform'

let initialized = false

export async function initTauriLogger(): Promise<void> {
  if (initialized || !isTauri()) return
  initialized = true

  try {
    const { attachConsole } = await import('@tauri-apps/plugin-log')

    // Keep Rust/Tauri logs visible in DevTools without persisting every
    // frontend console.warn/error call into the desktop log file.
    await attachConsole()
    console.log('[TAURI-LOG] Logger initialized — Rust logs mirrored to console only')
  } catch (e) {
    // Silently fail if plugin not available (e.g., running in browser)
    console.warn('[TAURI-LOG] Failed to initialize:', e)
  }
}
