/**
 * TASK-1219: Shared notification delivery utility
 *
 * BUG-1289: tauri-plugin-notification v2.3.3 on Linux calls block_on() inside
 * the tokio runtime, causing a fatal panic. Browser Notification API avoids Rust.
 *
 * BUG-1302: Added logging, error handling, and native Linux notify-send support.
 * In Tauri on Linux, Browser Notification API doesn't integrate with KDE Plasma.
 * We use `notify-send` (freedesktop DBus) which shows in KDE's notification area.
 */

interface DeliveryOptions {
  title: string
  body: string
  tag?: string
  sound?: boolean
}

/** Detect if running inside Tauri */
function isTauri(): boolean {
  return !!(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__
}

/**
 * Send native Linux desktop notification via notify-send (freedesktop DBus).
 * Works with KDE Plasma, GNOME, XFCE, and other freedesktop-compliant DEs.
 */
async function deliverViaNativeLinux(options: DeliveryOptions): Promise<boolean> {
  try {
    const { Command } = await import('@tauri-apps/plugin-shell')

    const args = [
      '--app-name=FlowState',
      '--icon=dialog-information',
      options.title,
      options.body
    ]

    const result = await Command.create('notify-send', args).execute()

    if (result.code === 0) {
      console.log('[NOTIFY] Native Linux notification delivered via notify-send')
      return true
    } else {
      console.warn('[NOTIFY] notify-send failed:', result.stderr)
      return false
    }
  } catch (error) {
    console.warn('[NOTIFY] Native Linux delivery failed:', error)
    return false
  }
}

/**
 * Deliver a notification via Browser Notification API (fallback for non-Tauri).
 */
async function deliverViaBrowserAPI(options: DeliveryOptions): Promise<boolean> {
  const { title, body, tag, sound = true } = options

  if (!('Notification' in window)) {
    console.warn('[NOTIFY] Browser Notification API not available')
    return false
  }

  try {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: tag || undefined,
        silent: !sound
      })
      return true
    } else if (Notification.permission === 'default') {
      // BUG-1303: Skip Notification.requestPermission() in Tauri — WebKitGTK hangs
      if (isTauri()) {
        console.warn('[NOTIFY] Skipping permission request in Tauri (WebKitGTK hangs)')
        return false
      }
      console.log('[NOTIFY] Permission not yet granted, requesting...')
      const permission = await Notification.requestPermission()
      console.log('[NOTIFY] Permission result:', permission)
      if (permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: tag || undefined,
          silent: !sound
        })
        return true
      }
      console.warn('[NOTIFY] Permission not granted:', permission)
      return false
    } else {
      console.warn('[NOTIFY] Permission denied — cannot deliver OS notification')
      return false
    }
  } catch (error) {
    console.error('[NOTIFY] Browser API failed:', error)
    return false
  }
}

/**
 * Deliver a notification using the best available method:
 * - Tauri + Linux → notify-send (KDE Plasma / freedesktop compatible)
 * - Browser / PWA → Browser Notification API
 */
export async function deliverNotification(options: DeliveryOptions): Promise<boolean> {
  // In Tauri on Linux, use notify-send for native KDE Plasma integration
  if (isTauri() && navigator.platform?.toLowerCase().includes('linux')) {
    const nativeSuccess = await deliverViaNativeLinux(options)
    if (nativeSuccess) return true
    // Fall through to Browser API if notify-send fails (e.g., not installed)
    console.log('[NOTIFY] Falling back to Browser Notification API')
  }

  return deliverViaBrowserAPI(options)
}
