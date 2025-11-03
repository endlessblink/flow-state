import { LocalNotifications } from '@capacitor/local-notifications'
import { PushNotifications } from '@capacitor/push-notifications'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import type { PomodoroState } from '@/types'

export class NotificationService {
  private static instance: NotificationService
  private hasPermission = false
  private isInitialized = false

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService()
    }
    return NotificationService.instance
  }

  // Initialize notification services
  async initialize() {
    if (this.isInitialized) return

    try {
      // Request permissions
      await this.requestPermissions()

      // Set up push notification listeners
      this.setupPushNotifications()

      // Set up local notification listeners
      this.setupLocalNotifications()

      this.isInitialized = true
      console.log('✅ Notification service initialized')
    } catch (error) {
      console.error('❌ Failed to initialize notifications:', error)
    }
  }

  // Request notification permissions
  async requestPermissions(): Promise<boolean> {
    try {
      // Local notifications permission
      const localResult = await LocalNotifications.requestPermissions()

      if (localResult.display === 'granted') {
        this.hasPermission = true
        console.log('✅ Local notifications permission granted')
      }

      // Push notifications permission (optional, for remote sync alerts)
      const pushResult = await PushNotifications.requestPermissions()

      if (pushResult.receive === 'granted') {
        console.log('✅ Push notifications permission granted')
        await PushNotifications.register()
      }

      return this.hasPermission
    } catch (error) {
      console.error('❌ Permission request failed:', error)
      return false
    }
  }

  // Check if permissions are granted
  async checkPermissions(): Promise<boolean> {
    try {
      const result = await LocalNotifications.checkPermissions()
      this.hasPermission = result.display === 'granted'
      return this.hasPermission
    } catch (error) {
      console.error('❌ Permission check failed:', error)
      return false
    }
  }

  // Setup push notification listeners
  private setupPushNotifications() {
    // Registration success
    PushNotifications.addListener('registration', (token) => {
      console.log('✅ Push registration success, token:', token.value)
      // TODO: Send token to backend for remote notifications
    })

    // Registration error
    PushNotifications.addListener('registrationError', (error) => {
      console.error('❌ Push registration error:', error)
    })

    // Notification received while app in foreground
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📬 Push notification received:', notification)
      // Show local notification when push arrives in foreground
      this.showCustomNotification(
        notification.title || 'Notification',
        notification.body || '',
        notification.data
      )
    })

    // Notification tapped
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 Push notification action:', action)
      this.handleNotificationAction(action.notification.data)
    })
  }

  // Setup local notification listeners
  private setupLocalNotifications() {
    // Notification action performed
    LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      console.log('👆 Local notification action:', action)

      const notificationData = action.notification.extra
      const actionId = action.actionId

      this.handleNotificationAction(notificationData, actionId)
    })

    // Notification received (displayed)
    LocalNotifications.addListener('localNotificationReceived', (notification) => {
      console.log('📬 Local notification received:', notification)
    })
  }

  // Handle notification actions
  private handleNotificationAction(data: any, actionId?: string) {
    console.log('🔔 Notification action:', actionId, data)

    // Trigger haptic feedback
    Haptics.impact({ style: ImpactStyle.Medium })

    // Handle different action types
    switch (actionId) {
      case 'complete':
        // TODO: Complete pomodoro
        window.dispatchEvent(new CustomEvent('pomodoro:complete', { detail: data }))
        break

      case 'extend':
        // TODO: Extend pomodoro by 5 minutes
        window.dispatchEvent(new CustomEvent('pomodoro:extend', { detail: data }))
        break

      case 'skip':
        // TODO: Skip break
        window.dispatchEvent(new CustomEvent('pomodoro:skip', { detail: data }))
        break

      case 'start-break':
        // TODO: Start break
        window.dispatchEvent(new CustomEvent('pomodoro:start-break', { detail: data }))
        break

      default:
        // Open app to relevant view
        if (data.route) {
          window.location.hash = data.route
        }
    }
  }

  // Show custom notification
  async showCustomNotification(title: string, body: string, data?: any) {
    if (!this.hasPermission) {
      console.warn('⚠️ No notification permission')
      return
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title,
            body,
            extra: data,
            sound: 'default',
            largeIcon: 'ic_launcher',
            smallIcon: 'ic_launcher'
          }
        ]
      })
    } catch (error) {
      console.error('❌ Failed to show notification:', error)
    }
  }

  // Schedule pomodoro completion notification
  async schedulePomodoroNotification(pomodoroState: PomodoroState, taskTitle?: string) {
    if (!this.hasPermission) {
      await this.requestPermissions()
    }

    const isWorkSession = pomodoroState.type === 'work'
    const notificationTime = new Date(pomodoroState.startTime + pomodoroState.duration * 1000)

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1, // Use fixed ID for pomodoro to replace existing
            title: isWorkSession ? 'Pomodoro Complete! 🍅' : "Break's over! ⏰",
            body: isWorkSession
              ? `${pomodoroState.duration / 60} minutes completed. Time for a break!`
              : 'Ready to start your next pomodoro?',
            schedule: { at: notificationTime },
            sound: 'default',
            extra: {
              type: 'pomodoro',
              sessionType: pomodoroState.type,
              taskId: pomodoroState.taskId,
              taskTitle
            },
            actionTypeId: 'pomodoro-actions',
            attachments: isWorkSession ? [{ id: 'pomodoro-complete', url: 'file://assets/pomodoro.png' }] : undefined
          }
        ]
      })

      console.log('✅ Pomodoro notification scheduled for', notificationTime)
    } catch (error) {
      console.error('❌ Failed to schedule pomodoro notification:', error)
    }
  }

  // Cancel pomodoro notification
  async cancelPomodoroNotification() {
    try {
      const pending = await LocalNotifications.getPending()

      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: [{ id: 1 }] })
        console.log('✅ Pomodoro notification cancelled')
      }
    } catch (error) {
      console.error('❌ Failed to cancel pomodoro notification:', error)
    }
  }

  // Register notification action types (iOS only)
  async registerNotificationActions() {
    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'pomodoro-actions',
            actions: [
              {
                id: 'complete',
                title: 'Complete',
                foreground: false
              },
              {
                id: 'extend',
                title: 'Add 5 min',
                foreground: false
              },
              {
                id: 'skip',
                title: 'Skip',
                foreground: false,
                destructive: true
              }
            ]
          },
          {
            id: 'break-actions',
            actions: [
              {
                id: 'start-break',
                title: 'Start Break',
                foreground: false
              },
              {
                id: 'skip',
                title: 'Skip Break',
                foreground: false,
                destructive: true
              }
            ]
          }
        ]
      })

      console.log('✅ Notification actions registered')
    } catch (error) {
      console.error('❌ Failed to register notification actions:', error)
    }
  }

  // Show task reminder notification
  async showTaskReminder(taskTitle: string, taskId: string, dueDate?: number) {
    if (!this.hasPermission) return

    const body = dueDate
      ? `Due: ${new Date(dueDate).toLocaleDateString()}`
      : 'Don\'t forget to complete this task'

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: `📋 ${taskTitle}`,
            body,
            sound: 'default',
            extra: {
              type: 'task-reminder',
              taskId,
              route: '#/tasks'
            }
          }
        ]
      })
    } catch (error) {
      console.error('❌ Failed to show task reminder:', error)
    }
  }

  // Show daily summary notification
  async showDailySummary(completedCount: number, pomodoroCount: number) {
    if (!this.hasPermission) return

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: "Today's Progress 📊",
            body: `You completed ${completedCount} tasks and ${pomodoroCount} pomodoros. Great work!`,
            sound: 'default',
            extra: {
              type: 'daily-summary',
              route: '#/today'
            }
          }
        ]
      })
    } catch (error) {
      console.error('❌ Failed to show daily summary:', error)
    }
  }

  // Trigger haptic feedback
  async hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'medium') {
    try {
      const impactStyle = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy
      }[style]

      await Haptics.impact({ style: impactStyle })
    } catch (error) {
      console.error('❌ Haptic feedback failed:', error)
    }
  }

  // Trigger success haptic
  async hapticSuccess() {
    try {
      await Haptics.notification({ type: 'SUCCESS' })
    } catch (error) {
      console.error('❌ Haptic feedback failed:', error)
    }
  }

  // Trigger error haptic
  async hapticError() {
    try {
      await Haptics.notification({ type: 'ERROR' })
    } catch (error) {
      console.error('❌ Haptic feedback failed:', error)
    }
  }

  // Cleanup
  async destroy() {
    await LocalNotifications.removeAllListeners()
    await PushNotifications.removeAllListeners()
    this.isInitialized = false
  }
}

// Singleton export
export const notificationService = NotificationService.getInstance()
