// TASK-1338: Push Notifications Feature - Type definitions and defaults

/**
 * Configuration for a single notification category
 */
export interface NotificationCategoryConfig {
  enabled: boolean
  inApp: boolean
  webPush: boolean
}

/**
 * All notification categories with individual configs
 */
export interface NotificationCategories {
  taskReminders: NotificationCategoryConfig
  dailyDigest: NotificationCategoryConfig
  overdueAlerts: NotificationCategoryConfig
  achievements: NotificationCategoryConfig
}

/**
 * Quiet hours configuration (no notifications during this time)
 */
export interface QuietHoursConfig {
  enabled: boolean
  startHour: number // 0-23
  endHour: number // 0-23
}

/**
 * Complete push notification preferences
 */
export interface PushNotificationPreferences {
  enabled: boolean // Master toggle (opt-in)
  categories: NotificationCategories
  quietHours: QuietHoursConfig
  cooldownMinutes: number // Minimum time between notifications
  dailyDigestHour: number // Hour to send daily digest (0-23)
  taskReminderLeadTimes: number[] // Minutes before due date
}

/**
 * Default push notification preferences (opt-in by default)
 */
export const DEFAULT_PUSH_NOTIFICATION_PREFERENCES: PushNotificationPreferences = {
  enabled: false, // Opt-in required
  categories: {
    taskReminders: {
      enabled: true,
      inApp: true,
      webPush: true
    },
    dailyDigest: {
      enabled: true,
      inApp: false,
      webPush: true
    },
    overdueAlerts: {
      enabled: true,
      inApp: true,
      webPush: true
    },
    achievements: {
      enabled: false,
      inApp: true,
      webPush: false
    }
  },
  quietHours: {
    enabled: true,
    startHour: 22, // 10 PM
    endHour: 8 // 8 AM
  },
  cooldownMinutes: 5,
  dailyDigestHour: 8,
  taskReminderLeadTimes: [15, 60, 1440] // 15min, 1hr, 1day
}

/**
 * Push notification payload (sent from server, received by Service Worker)
 */
export interface PushPayload {
  type: 'task_reminder' | 'daily_digest' | 'overdue_alert' | 'achievement'
  title: string
  body: string
  tag: string // Notification grouping/replacement key
  taskId?: string
  url?: string // Deep-link target
  timestamp: string
}

/**
 * Supabase push_subscriptions table row
 */
export interface SupabasePushSubscription {
  id: string
  user_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  is_active: boolean
  failure_count: number
  created_at: string
  updated_at: string
}
