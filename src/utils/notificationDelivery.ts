/**
 * TASK-1219: Shared notification delivery utility
 * Uses Browser Notification API (works in both Tauri webview and browsers).
 *
 * BUG-1289: tauri-plugin-notification v2.3.3 on Linux calls block_on() inside
 * the tokio runtime, causing a fatal panic: "Cannot start a runtime from within
 * a runtime". The Browser Notification API avoids this by not going through Rust.
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
export async function deliverNotification(options: DeliveryOptions): Promise<void> {
  const { title, body, tag, sound = true } = options

  if (!('Notification' in window)) return

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: tag || undefined,
      silent: !sound
    })
  } else if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    if (permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: tag || undefined,
        silent: !sound
      })
    }
  }
}
