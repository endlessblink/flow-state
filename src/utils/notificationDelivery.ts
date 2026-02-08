/**
 * TASK-1219: Shared notification delivery utility
 * 2-tier delivery: Tauri native → Browser Notification API
 * Extracted from timer.ts:611-690 pattern
 */

import { isTauri } from '@/composables/useTauriStartup'

interface DeliveryOptions {
  title: string
  body: string
  tag?: string
  sound?: boolean
}

/**
 * Deliver a notification via the best available channel.
 * Tier 1: Tauri native notification (desktop app)
 * Tier 2: Browser Notification API (fallback)
 */
export async function deliverNotification(options: DeliveryOptions): Promise<void> {
  const { title, body, tag, sound = true } = options

  // Tier 1: Tauri native notification
  if (isTauri()) {
    try {
      const { sendNotification, isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification')

      let hasPermission = await isPermissionGranted()
      if (!hasPermission) {
        const permission = await requestPermission()
        hasPermission = permission === 'granted'
      }

      if (hasPermission) {
        sendNotification({
          title,
          body,
          sound: sound ? 'default' : undefined
        })
        return
      }
    } catch (err) {
      console.warn('[TIME-BLOCK] Tauri notification failed, falling back:', err)
    }
  }

  // Tier 2: Browser Notification API
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
