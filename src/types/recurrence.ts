/**
 * Recurrence Pattern Types for Pomo-Flow
 * Supports flexible recurring task scheduling with various patterns and end conditions
 */

export enum RecurrencePattern {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  CUSTOM = 'custom'
}

export enum Weekday {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6
}

export enum EndCondition {
  NEVER = 'never',
  AFTER_COUNT = 'after_count',
  ON_DATE = 'on_date'
}

export interface WeeklyRecurrenceRule {
  pattern: RecurrencePattern.WEEKLY
  interval: number // Every N weeks
  weekdays: Weekday[] // Days of the week
}

export interface MonthlyRecurrenceRule {
  pattern: RecurrencePattern.MONTHLY
  interval: number // Every N months
  dayOfMonth: number // Day of month (1-31)
  // OR
  weekday?: Weekday
  weekOfMonth?: number // 1-4, or -1 for last
}

export interface DailyRecurrenceRule {
  pattern: RecurrencePattern.DAILY
  interval: number // Every N days
}

export interface YearlyRecurrenceRule {
  pattern: RecurrencePattern.YEARLY
  interval: number // Every N years
  month: number // 1-12
  dayOfMonth: number // 1-31
}

export type RecurrenceRule =
  | DailyRecurrenceRule
  | WeeklyRecurrenceRule
  | MonthlyRecurrenceRule
  | YearlyRecurrenceRule
  | { pattern: RecurrencePattern.NONE }
  | { pattern: RecurrencePattern.CUSTOM; customRule: string } // For future custom patterns

export interface RecurrenceEndCondition {
  type: EndCondition
  date?: string // YYYY-MM-DD format for ON_DATE
  count?: number // Number of occurrences for AFTER_COUNT
}

export interface RecurrenceException {
  id: string
  date: string // YYYY-MM-DD format for the exception date
  action: 'skip' | 'modify' | 'delete'
  modifiedInstance?: {
    newDate?: string
    newTime?: string
    newDuration?: number
  }
}

export interface TaskRecurrence {
  isEnabled: boolean
  rule: RecurrenceRule
  endCondition: RecurrenceEndCondition
  exceptions: RecurrenceException[]
  generatedInstances: RecurringTaskInstance[]
  lastGenerated?: string // Date string when instances were last generated
}

export interface RecurringTaskInstance {
  id: string
  parentTaskId: string
  scheduledDate: string // YYYY-MM-DD
  scheduledTime?: string // HH:MM format
  duration?: number // Duration in minutes
  isGenerated: boolean // True for generated instances, false for manually created
  isModified?: boolean // True if this instance was modified from the pattern
  isSkipped?: boolean // True if this instance is skipped due to exception
  recurrenceExceptionId?: string // Link to the exception if this is an exception
}

export interface NotificationPreferences {
  taskId: string
  isEnabled: boolean
  reminderTimes: number[] // Minutes before task to notify (e.g., [15, 60, 1440] for 15min, 1hr, 1day before)
  soundEnabled: boolean
  vibrationEnabled: boolean // For mobile
  notificationChannels: {
    browser: boolean
    mobile: boolean
    email?: boolean // Future feature
  }
  doNotDisturb?: {
    startHour: number // 0-23
    endHour: number // 0-23
    enabled: boolean
  }
  snoozeDuration: number // Minutes to snooze when user hits snooze
}

export interface ScheduledNotification {
  id: string
  taskId: string
  instanceId?: string // For recurring task instances
  title: string
  body: string
  scheduledTime: Date // When to show the notification
  isShown: boolean
  isDismissed: boolean
  snoozedUntil?: Date
  createdAt: Date
}

// Utility types for working with recurrence
export type RecurrenceValidationResult = {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export type RecurrencePreviewOptions = {
  startDate: Date
  maxInstances?: number
  endDate?: Date
}

// Extended Task interface augmentation (this will be merged with the main Task interface)
export interface TaskRecurrenceExtension {
  recurrence: TaskRecurrence
  notificationPreferences?: NotificationPreferences
}