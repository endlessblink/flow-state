/**
 * FEATURE-1345: Capacitor notification service
 *
 * Handles Local + Push notifications for Android/iOS via Capacitor plugins.
 * Replaces Browser Notification API and Web Push/VAPID in native apps.
 *
 * - LocalNotifications: timer completion, task reminders (no server needed)
 * - PushNotifications: FCM-based server push (deferred — requires Firebase setup)
 */
import { isCapacitor } from '@/utils/platform'

let notificationIdCounter = 1

interface CapacitorNotificationOptions {
  title: string
  body: string
  id?: number
  sound?: boolean
  actionTypeId?: string
  extra?: Record<string, string>
}

/**
 * Initialize Capacitor notification system.
 * Call once during app startup (after platform detection).
 */
export async function initCapacitorNotifications(): Promise<boolean> {
  if (!isCapacitor()) return false

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    // Request permission (Android 13+ requires runtime permission)
    const permResult = await LocalNotifications.requestPermissions()
    if (permResult.display !== 'granted') {
      console.warn('[CAP-NOTIFY] Local notification permission not granted:', permResult.display)
      return false
    }

    // Register action types for timer notifications
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'TIMER_ACTIONS',
          actions: [
            { id: 'start-break', title: 'Start Break' },
            { id: 'dismiss', title: 'Dismiss', destructive: true },
          ],
        },
        {
          id: 'TASK_ACTIONS',
          actions: [
            { id: 'open-task', title: 'Open' },
            { id: 'dismiss', title: 'Dismiss', destructive: true },
          ],
        },
      ],
    })

    // Listen for notification action taps
    LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
      const actionId = notification.actionId
      const extra = notification.notification.extra

      console.log('[CAP-NOTIFY] Action performed:', actionId, extra)

      // Handle timer actions
      if (actionId === 'start-break' && extra?.taskId) {
        // Dispatch event for timer store to handle
        window.dispatchEvent(
          new CustomEvent('capacitor-notification-action', {
            detail: { action: 'start-break', taskId: extra.taskId },
          }),
        )
      } else if (actionId === 'open-task' && extra?.taskId) {
        window.dispatchEvent(
          new CustomEvent('capacitor-notification-action', {
            detail: { action: 'open-task', taskId: extra.taskId },
          }),
        )
      }
    })

    console.log('[CAP-NOTIFY] Capacitor notifications initialized')
    return true
  } catch (error) {
    console.error('[CAP-NOTIFY] Failed to initialize:', error)
    return false
  }
}

/**
 * Show a local notification (timer completion, task reminder, etc.)
 */
export async function showCapacitorNotification(
  options: CapacitorNotificationOptions,
): Promise<boolean> {
  if (!isCapacitor()) return false

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    const id = options.id ?? notificationIdCounter++

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: options.title,
          body: options.body,
          sound: options.sound !== false ? 'default' : undefined,
          actionTypeId: options.actionTypeId,
          extra: options.extra,
        },
      ],
    })

    console.log('[CAP-NOTIFY] Notification scheduled:', options.title)
    return true
  } catch (error) {
    console.error('[CAP-NOTIFY] Failed to schedule notification:', error)
    return false
  }
}

/**
 * Check if Capacitor notification permissions are granted.
 */
export async function checkCapacitorNotificationPermission(): Promise<boolean> {
  if (!isCapacitor()) return false

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const result = await LocalNotifications.checkPermissions()
    return result.display === 'granted'
  } catch {
    return false
  }
}
