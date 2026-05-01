/**
 * TASK-1219: Shared notification delivery utility
 *
 * Shared browser/Capacitor notification delivery with logging and fallback handling.
 */

interface DeliveryOptions {
  title: string
  body: string
  tag?: string
  sound?: boolean
}

/** Detect if running inside Capacitor native app */
function isCapacitorNative(): boolean {
  return !!window.Capacitor?.isNativePlatform?.()
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
 * FEATURE-1345: Deliver notification via Capacitor Local Notifications.
 * Uses the already-configured capacitorNotifications service.
 */
async function deliverViaCapacitor(options: DeliveryOptions): Promise<boolean> {
  try {
    const { showCapacitorNotification } = await import('@/services/notifications/capacitorNotifications')
    return await showCapacitorNotification({
      title: options.title,
      body: options.body,
      sound: options.sound,
    })
  } catch (error) {
    console.warn('[NOTIFY] Capacitor delivery failed:', error)
    return false
  }
}

/**
 * Deliver a notification using the best available method:
 * - Capacitor native → Local Notifications plugin
 * - Browser / PWA → Browser Notification API
 */
export async function deliverNotification(options: DeliveryOptions): Promise<boolean> {
  // FEATURE-1345: Capacitor native — use Local Notifications plugin
  if (isCapacitorNative()) {
    const capSuccess = await deliverViaCapacitor(options)
    if (capSuccess) return true
    // Fall through to Browser API if Capacitor fails
    console.log('[NOTIFY] Falling back to Browser Notification API')
  }

  return deliverViaBrowserAPI(options)
}
