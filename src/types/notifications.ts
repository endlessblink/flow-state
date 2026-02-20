/**
 * FEATURE-1363: Consolidated notification types
 * Single source of truth for all notification-related types
 */

// Re-export existing types from recurrence for backwards compatibility
export type { ScheduledNotification } from './recurrence'

/**
 * Rich notification preferences (canonical version)
 * Used by notification store and task notification settings
 */
export interface NotificationPreferences {
  taskId: string
  isEnabled: boolean
  reminderTimes: number[] // Minutes before task to notify (e.g., [15, 60, 1440])
  soundEnabled: boolean
  vibrationEnabled: boolean
  notificationChannels: {
    browser: boolean
    mobile: boolean
    email?: boolean
  }
  doNotDisturb?: {
    startHour: number // 0-23
    endHour: number // 0-23
    enabled: boolean
  }
  snoozeDuration: number // Minutes to snooze
}

/**
 * FEATURE-1363: Custom task reminder
 * Allows users to set specific date/time reminders ("remind me at Tuesday 3pm")
 */
export interface TaskReminder {
  id: string           // UUID
  datetime: string     // ISO 8601 (e.g., "2026-02-20T15:00:00Z")
  label?: string       // Optional user note
  fired: boolean
  dismissed: boolean
  createdAt: string    // ISO 8601
}
