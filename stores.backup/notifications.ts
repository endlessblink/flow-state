/**
 * Notification Store
 * Centralized management of task reminders and notifications
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useDatabase, DB_KEYS } from '@/composables/useDatabase'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import type {
  ScheduledNotification,
  NotificationPreferences,
  RecurringTaskInstance
} from '@/types/recurrence'
import { useTaskStore } from './tasks'

export const useNotificationStore = defineStore('notifications', () => {
  // Database composable
  const db = useDatabase()
  const taskStore = useTaskStore()

  // State
  const scheduledNotifications = ref<ScheduledNotification[]>([])
  const isPermissionGranted = ref(false)
  const isSchedulingActive = ref(false)
  const schedulingInterval = ref<NodeJS.Timeout | null>(null)
  const defaultPreferences = ref<NotificationPreferences>({
    taskId: 'default',
    isEnabled: true,
    reminderTimes: [15, 60, 1440], // 15min, 1hr, 1day before
    soundEnabled: true,
    vibrationEnabled: true,
    notificationChannels: {
      browser: true,
      mobile: true
    },
    doNotDisturb: {
      startHour: 22,
      endHour: 8,
      enabled: true
    },
    snoozeDuration: 10 // 10 minutes
  })

  // Computed
  const activeNotifications = computed(() =>
    Array.isArray(scheduledNotifications.value)
      ? scheduledNotifications.value.filter(n => !n.isShown && !n.isDismissed)
      : []
  )

  const pendingNotifications = computed(() =>
    Array.isArray(scheduledNotifications.value)
      ? scheduledNotifications.value.filter(n => !n.isShown && n.scheduledTime <= new Date())
      : []
  )

  const snoozedNotifications = computed(() =>
    Array.isArray(scheduledNotifications.value)
      ? scheduledNotifications.value.filter(n => n.snoozedUntil && n.snoozedUntil > new Date())
      : []
  )

  /**
   * Initialize notification system
   */
  const initializeNotifications = async () => {
    await loadScheduledNotifications()
    await checkNotificationPermission()
    startSchedulingService()
  }

  /**
   * Load scheduled notifications from database
   */
  const loadScheduledNotifications = async () => {
    try {
      // Check if database is ready before loading
      if (!db.isReady?.value) {
        errorHandler.report({
          severity: ErrorSeverity.INFO,
          category: ErrorCategory.DATABASE,
          message: 'Database not ready, skipping notification load',
          context: { operation: 'loadScheduledNotifications' },
          showNotification: false
        })
        return
      }

      const saved = await db.load<ScheduledNotification[]>(DB_KEYS.NOTIFICATIONS)
      if (saved) {
        scheduledNotifications.value = saved
      }
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.DATABASE,
        message: 'Error loading notifications',
        error: error as Error,
        context: { operation: 'loadScheduledNotifications' },
        showNotification: false // Don't fail the entire initialization
      })
    }
  }

  /**
   * Check current notification permission status
   * Note: Does NOT request permission - must be done in user event handler
   */
  const checkNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      errorHandler.report({
        severity: ErrorSeverity.INFO,
        category: ErrorCategory.COMPONENT,
        message: 'This browser does not support notifications',
        context: { operation: 'checkNotificationPermission' },
        showNotification: false
      })
      isPermissionGranted.value = false
      return false
    }

    if (Notification.permission === 'granted') {
      isPermissionGranted.value = true
      return true
    }

    isPermissionGranted.value = (Notification.permission as any) === 'granted'
    return isPermissionGranted.value
  }

  /**
   * Request notification permission (must be called from user event handler)
   */
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) {
      errorHandler.report({
        severity: ErrorSeverity.INFO,
        category: ErrorCategory.COMPONENT,
        message: 'This browser does not support notifications',
        context: { operation: 'requestNotificationPermission' },
        showNotification: false
      })
      return false
    }

    if (Notification.permission === 'granted') {
      isPermissionGranted.value = true
      return true
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission()
        isPermissionGranted.value = permission === 'granted'
        return isPermissionGranted.value
      } catch (error) {
        errorHandler.report({
          severity: ErrorSeverity.WARNING,
          category: ErrorCategory.COMPONENT,
          message: 'Notification permission request failed',
          error: error as Error,
          context: { operation: 'requestNotificationPermission' },
          showNotification: false
        })
        isPermissionGranted.value = false
        return false
      }
    }

    isPermissionGranted.value = false
    return false
  }

  /**
   * Start the background scheduling service
   */
  const startSchedulingService = () => {
    if (isSchedulingActive.value) return

    isSchedulingActive.value = true
    schedulingInterval.value = setInterval(() => {
      checkAndShowNotifications()
      checkAndScheduleTaskNotifications()
    }, 60000) // Check every minute
  }

  /**
   * Stop the scheduling service
   */
  const stopSchedulingService = () => {
    if (schedulingInterval.value) {
      clearInterval(schedulingInterval.value)
      schedulingInterval.value = null
    }
    isSchedulingActive.value = false
  }

  /**
   * Check for pending notifications and show them
   */
  const checkAndShowNotifications = async () => {
    const now = new Date()

    // CRITICAL FIX: Ensure scheduledNotifications.value is an array
    if (!Array.isArray(scheduledNotifications.value)) {
      errorHandler.report({
        severity: ErrorSeverity.WARNING,
        category: ErrorCategory.STATE,
        message: 'scheduledNotifications.value is not an array, resetting to empty array',
        context: { operation: 'checkAndShowNotifications', type: typeof scheduledNotifications.value },
        showNotification: false
      })
      scheduledNotifications.value = []
    }

    const readyNotifications = scheduledNotifications.value.filter(n =>
      !n.isShown &&
      !n.isDismissed &&
      !n.snoozedUntil &&
      n.scheduledTime <= now
    )

    for (const notification of readyNotifications) {
      if (isInDoNotDisturbHours(now)) {
        continue // Skip during DND hours
      }

      await showNotification(notification)
      notification.isShown = true
    }

    await saveScheduledNotifications()
  }

  /**
   * Check if current time is in Do Not Disturb hours
   */
  const isInDoNotDisturbHours = (date: Date): boolean => {
    const dnd = defaultPreferences.value.doNotDisturb
    if (!dnd?.enabled) return false

    const currentHour = date.getHours()

    if (dnd.startHour > dnd.endHour) {
      // Overnight DND (e.g., 22:00 to 08:00)
      return currentHour >= dnd.startHour || currentHour < dnd.endHour
    } else {
      // Same day DND (e.g., 01:00 to 06:00)
      return currentHour >= dnd.startHour && currentHour < dnd.endHour
    }
  }

  /**
   * Show a browser notification
   */
  const showNotification = async (notification: ScheduledNotification) => {
    if (!isPermissionGranted.value) {
      await checkNotificationPermission()
    }

    if (!isPermissionGranted.value) return

    try {
      const browserNotification = new Notification(notification.title, {
        body: notification.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: notification.id,
        requireInteraction: true
      } as any)

      browserNotification.onclick = () => {
        browserNotification.close()
        // Focus the window and navigate to the task
        window.focus()
        // NOTE: Task navigation requires integration with view routing system
      }

      browserNotification.onclose = () => {
        notification.isDismissed = true
      }

    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.COMPONENT,
        message: 'Error showing browser notification',
        error: error as Error,
        context: { operation: 'showNotification', notificationId: notification.id },
        showNotification: false // Don't show a notification about failed notification
      })
    }
  }

  /**
   * Schedule notifications for a task
   */
  const scheduleTaskNotifications = async (
    taskId: string,
    taskTitle: string,
    dueDate: string,
    dueTime?: string,
    preferences?: NotificationPreferences
  ) => {
    const prefs = preferences || defaultPreferences.value
    if (!prefs.isEnabled) return

    // Remove existing notifications for this task
    await removeTaskNotifications(taskId)

    const dueDateTime = new Date(`${dueDate} ${dueTime || '09:00'}`)
    const reminderTimes = prefs.reminderTimes || []

    for (const minutesBefore of reminderTimes) {
      const notificationTime = new Date(dueDateTime.getTime() - minutesBefore * 60000)

      // Only schedule if it's in the future
      if (notificationTime > new Date()) {
        const notification: ScheduledNotification = {
          id: `${taskId}-reminder-${minutesBefore}`,
          taskId,
          title: `Task Reminder: ${taskTitle}`,
          body: getReminderMessage(minutesBefore, dueDate, dueTime),
          scheduledTime: notificationTime,
          isShown: false,
          isDismissed: false,
          createdAt: new Date()
        }

        scheduledNotifications.value.push(notification)
      }
    }

    await saveScheduledNotifications()
  }

  /**
   * Schedule notifications for recurring task instances
   */
  const scheduleRecurringTaskNotifications = async (taskId: string) => {
    // CRITICAL FIX: Ensure taskStore.tasks is an array before calling .find()
    const task = Array.isArray(taskStore.tasks)
      ? taskStore.tasks.find(t => t.id === taskId)
      : undefined
    if (!task?.recurrence?.isEnabled || !task.notificationPreferences?.enabled) return

    const prefs = task.notificationPreferences
    const instances = task.recurrence.generatedInstances || []

    for (const instance of instances) {
      if (instance.isSkipped) continue

      await scheduleTaskNotifications(
        instance.id,
        task.title,
        instance.scheduledDate,
        instance.scheduledTime,
        prefs as any
      )
    }
  }

  /**
   * Get reminder message based on time before task
   */
  const getReminderMessage = (minutesBefore: number, dueDate: string, dueTime?: string): string => {
    if (minutesBefore < 60) {
      return `Task due in ${minutesBefore} minute${minutesBefore > 1 ? 's' : ''}`
    } else if (minutesBefore < 1440) {
      const hours = Math.floor(minutesBefore / 60)
      return `Task due in ${hours} hour${hours > 1 ? 's' : ''}`
    } else {
      const days = Math.floor(minutesBefore / 1440)
      return `Task due in ${days} day${days > 1 ? 's' : ''}`
    }
  }

  /**
   * Remove all notifications for a task
   */
  const removeTaskNotifications = async (taskId: string) => {
    if (Array.isArray(scheduledNotifications.value)) {
      scheduledNotifications.value = scheduledNotifications.value.filter(n => n.taskId !== taskId)
    } else {
      scheduledNotifications.value = []
    }
    await saveScheduledNotifications()
  }

  /**
   * Snooze a notification
   */
  const snoozeNotification = async (notificationId: string) => {
    const notification = scheduledNotifications.value.find(n => n.id === notificationId)
    if (!notification) return

    const snoozeDuration = defaultPreferences.value.snoozeDuration || 10
    notification.snoozedUntil = new Date(Date.now() + snoozeDuration * 60000)
    notification.isShown = false
    notification.isDismissed = false

    await saveScheduledNotifications()
  }

  /**
   * Dismiss a notification
   */
  const dismissNotification = async (notificationId: string) => {
    const notification = scheduledNotifications.value.find(n => n.id === notificationId)
    if (!notification) return

    notification.isDismissed = true

    await saveScheduledNotifications()
  }

  /**
   * Check and schedule notifications for all tasks
   */
  const checkAndScheduleTaskNotifications = async () => {
    // CRITICAL FIX: Ensure taskStore.tasks is an array before calling .filter()
    const tasks = Array.isArray(taskStore.tasks)
      ? taskStore.tasks.filter(t =>
          t.dueDate &&
          t.notificationPreferences?.enabled &&
          new Date(t.dueDate) > new Date()
        )
      : []

    for (const task of tasks) {
      // Check if notifications are already scheduled for this task
      const hasNotifications = scheduledNotifications.value.some(n => n.taskId === task.id)

      if (!hasNotifications) {
        await scheduleTaskNotifications(
          task.id,
          task.title,
          task.dueDate,
          undefined, // TODO: Add time field to tasks
          task.notificationPreferences as any
        )
      }

      // Schedule recurring notifications if applicable
      if (task.recurrence?.isEnabled) {
        await scheduleRecurringTaskNotifications(task.id)
      }
    }
  }

  /**
   * Save scheduled notifications to database
   */
  const saveScheduledNotifications = async () => {
    try {
      await db.save(DB_KEYS.NOTIFICATIONS, scheduledNotifications.value)
    } catch (error) {
      errorHandler.report({
        severity: ErrorSeverity.ERROR,
        category: ErrorCategory.DATABASE,
        message: 'Error saving notifications to database',
        error: error as Error,
        context: { operation: 'saveScheduledNotifications', count: scheduledNotifications.value?.length },
        showNotification: false
      })
    }
  }

  /**
   * Clean up old notifications (older than 7 days)
   */
  const cleanupOldNotifications = async () => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    if (Array.isArray(scheduledNotifications.value)) {
      scheduledNotifications.value = scheduledNotifications.value.filter(n =>
        n.createdAt > sevenDaysAgo || !n.isDismissed
      )
    } else {
      scheduledNotifications.value = []
    }

    await saveScheduledNotifications()
  }

  /**
   * Update default notification preferences
   */
  const updateDefaultPreferences = async (preferences: Partial<NotificationPreferences>) => {
    defaultPreferences.value = { ...defaultPreferences.value, ...preferences }
    // NOTE: Persistence to be implemented when notification preferences are finalized
  }

  /**
   * Get notification statistics
   */
  const getNotificationStats = () => {
    const total = Array.isArray(scheduledNotifications.value) ? scheduledNotifications.value.length : 0
    const shown = Array.isArray(scheduledNotifications.value) ? scheduledNotifications.value.filter(n => n.isShown).length : 0
    const dismissed = Array.isArray(scheduledNotifications.value) ? scheduledNotifications.value.filter(n => n.isDismissed).length : 0
    const pending = pendingNotifications.value.length

    return {
      total,
      shown,
      dismissed,
      pending,
      permissionGranted: isPermissionGranted.value,
      schedulingActive: isSchedulingActive.value
    }
  }

  return {
    // State
    scheduledNotifications,
    isPermissionGranted,
    isSchedulingActive,
    defaultPreferences,

    // Computed
    activeNotifications,
    pendingNotifications,
    snoozedNotifications,

    // Methods
    initializeNotifications,
    checkNotificationPermission,
    requestNotificationPermission,
    scheduleTaskNotifications,
    scheduleRecurringTaskNotifications,
    removeTaskNotifications,
    snoozeNotification,
    dismissNotification,
    updateDefaultPreferences,
    getNotificationStats,
    cleanupOldNotifications,
    startSchedulingService,
    stopSchedulingService
  }
})