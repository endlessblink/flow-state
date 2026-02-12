/**
 * TASK-1219: Shared notification delivery utility
 * Uses Browser Notification API (works in both Tauri webview and browsers).
 *
 * BUG-1289: tauri-plugin-notification v2.3.3 on Linux calls block_on() inside
 * the tokio runtime, causing a fatal panic: "Cannot start a runtime from within
 * a runtime". The Browser Notification API avoids this by not going through Rust.
 *
 * BUG-1302: Added logging and error handling — previously failed silently.
 */

interface DeliveryOptions {
  title: string
  body: string
  tag?: string
  sound?: boolean
}

/**
 * Deliver a notification via the Browser Notification API.
 * Works in Tauri webview (all platforms) and browsers.
 */
export async function deliverNotification(options: DeliveryOptions): Promise<boolean> {
  const { title, body, tag, sound = true } = options

  if (!('Notification' in window)) {
    console.warn('[NOTIFY] Browser Notification API not available in this environment')
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
    console.error('[NOTIFY] Failed to deliver notification:', error)
    return false
  }
}
