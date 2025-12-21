/**
 * Recurrence Engine Utilities
 * Core logic for generating and managing recurring task instances
 */

import {
  RecurrencePattern,
} from '@/types/recurrence'
import type {
  RecurrenceRule,
  RecurrenceEndCondition,
  RecurrenceException,
  RecurringTaskInstance,
  RecurrencePreviewOptions,
  RecurrenceValidationResult,
  DailyRecurrenceRule,
  WeeklyRecurrenceRule,
  MonthlyRecurrenceRule,
  YearlyRecurrenceRule,
  Weekday
} from '@/types/recurrence'

/**
 * Generate recurring task instances based on a recurrence rule
 */
export function generateRecurringInstances(
  taskId: string,
  rule: RecurrenceRule,
  endCondition: RecurrenceEndCondition,
  exceptions: RecurrenceException[],
  startDate: Date,
  dueTime?: string,
  duration?: number,
  maxInstances: number = 100
): RecurringTaskInstance[] {
  const instances: RecurringTaskInstance[] = []
  let currentDate = new Date(startDate)
  let instanceCount = 0

  while (instanceCount < maxInstances) {
    // Check end conditions
    if (!shouldContinueGeneration(currentDate, endCondition, instanceCount)) {
      break
    }

    // Format date as YYYY-MM-DD
    const dateStr = formatDateKey(currentDate)

    // Check if this date is in exceptions
    const exception = exceptions.find(ex => ex.date === dateStr)

    const instance: RecurringTaskInstance = {
      id: `${taskId}-rec-${instanceCount}`,
      parentTaskId: taskId,
      scheduledDate: dateStr,
      scheduledTime: dueTime,
      duration,
      isGenerated: true,
      isModified: false,
      isSkipped: exception?.action === 'skip',
      recurrenceExceptionId: exception?.id
    }

    // Apply exception modifications if any
    if (exception?.action === 'modify' && exception.modifiedInstance) {
      instance.scheduledDate = exception.modifiedInstance.newDate || dateStr
      instance.scheduledTime = exception.modifiedInstance.newTime || dueTime
      instance.duration = exception.modifiedInstance.newDuration || duration
      instance.isModified = true
    }

    // Skip if exception says delete
    if (exception?.action !== 'delete') {
      instances.push(instance)
    }

    // Move to next occurrence
    currentDate = getNextOccurrence(currentDate, rule)
    instanceCount++
  }

  return instances
}

/**
 * Get the next occurrence date based on a recurrence rule
 */
export function getNextOccurrence(currentDate: Date, rule: RecurrenceRule): Date {
  const next = new Date(currentDate)

  switch (rule.pattern) {
    case RecurrencePattern.NONE:
      // No recurrence, return same date
      return next

    case RecurrencePattern.DAILY:
      next.setDate(next.getDate() + (rule as DailyRecurrenceRule).interval)
      return next

    case RecurrencePattern.WEEKLY:
      const weeklyRule = rule as WeeklyRecurrenceRule
      const currentDayOfWeek = next.getDay() as Weekday
      const targetDays = [...weeklyRule.weekdays].sort((a, b) => a - b)

      // Find the next target day
      let nextDay = targetDays.find((day: Weekday) => day > currentDayOfWeek)
      if (nextDay === undefined) {
        // Wrap to next week
        nextDay = targetDays[0]
        next.setDate(next.getDate() + (7 * weeklyRule.interval - currentDayOfWeek + nextDay))
      } else {
        next.setDate(next.getDate() + (nextDay - currentDayOfWeek))
      }
      return next

    case RecurrencePattern.MONTHLY:
      const monthlyRule = rule as MonthlyRecurrenceRule
      if (monthlyRule.weekday !== undefined && monthlyRule.weekOfMonth !== undefined) {
        // Nth weekday of month (e.g., "2nd Tuesday")
        return getNextNthWeekdayOfMonth(next, monthlyRule.interval, monthlyRule.weekday, monthlyRule.weekOfMonth)
      } else {
        // Day of month
        return setDayOfMonth(next, monthlyRule.interval, monthlyRule.dayOfMonth)
      }

    case RecurrencePattern.YEARLY:
      const yearlyRule = rule as YearlyRecurrenceRule
      next.setFullYear(next.getFullYear() + yearlyRule.interval)
      next.setMonth(yearlyRule.month - 1) // Convert 1-12 to 0-11
      next.setDate(Math.min(yearlyRule.dayOfMonth, getDaysInMonth(next.getFullYear(), next.getMonth())))
      return next

    case RecurrencePattern.CUSTOM:
      // TODO: Implement custom recurrence patterns
      console.warn('Custom recurrence patterns not yet implemented')
      return next

    default:
      return next
  }
}

/**
 * Check if generation should continue based on end conditions
 */
function shouldContinueGeneration(
  currentDate: Date,
  endCondition: RecurrenceEndCondition,
  instanceCount: number
): boolean {
  switch (endCondition.type) {
    case 'never':
      return true

    case 'after_count':
      return instanceCount < (endCondition.count || 0)

    case 'on_date':
      if (!endCondition.date) return true
      const endDate = new Date(endCondition.date)
      return currentDate <= endDate

    default:
      return true
  }
}

/**
 * Get the Nth weekday of a month
 */
function getNextNthWeekdayOfMonth(
  currentDate: Date,
  interval: number,
  weekday: number,
  weekOfMonth: number
): Date {
  const result = new Date(currentDate)

  // Add months
  result.setMonth(result.getMonth() + interval)

  // Set to first day of target month
  result.setDate(1)

  // Find the first occurrence of the target weekday
  while (result.getDay() !== weekday) {
    result.setDate(result.getDate() + 1)
  }

  // Add weeks to get to the Nth occurrence
  if (weekOfMonth > 0) {
    result.setDate(result.getDate() + (weekOfMonth - 1) * 7)
  } else if (weekOfMonth === -1) {
    // Last occurrence of the month
    const daysInMonth = getDaysInMonth(result.getFullYear(), result.getMonth())
    result.setDate(result.getDate() + Math.floor((daysInMonth - result.getDate()) / 7) * 7)
  }

  return result
}

/**
 * Set a specific day of month with proper overflow handling
 */
function setDayOfMonth(currentDate: Date, interval: number, dayOfMonth: number): Date {
  const result = new Date(currentDate)

  // Add months
  result.setMonth(result.getMonth() + interval)

  // Set day, handling overflow (e.g., day 31 in a 30-day month)
  const daysInTargetMonth = getDaysInMonth(result.getFullYear(), result.getMonth())
  result.setDate(Math.min(dayOfMonth, daysInTargetMonth))

  return result
}

/**
 * Get the number of days in a month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * Validate a recurrence rule
 */
export function validateRecurrenceRule(rule: RecurrenceRule): RecurrenceValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (rule.pattern === RecurrencePattern.NONE) {
    return { isValid: true, errors: [], warnings: [] }
  }

  switch (rule.pattern) {
    case RecurrencePattern.DAILY:
      const dailyRule = rule as DailyRecurrenceRule
      if (dailyRule.interval < 1) {
        errors.push('Daily interval must be at least 1 day')
      }
      if (dailyRule.interval > 365) {
        warnings.push('Daily interval over 365 days may cause performance issues')
      }
      break

    case RecurrencePattern.WEEKLY:
      const weeklyRule = rule as WeeklyRecurrenceRule
      if (weeklyRule.interval < 1) {
        errors.push('Weekly interval must be at least 1 week')
      }
      if (!weeklyRule.weekdays || weeklyRule.weekdays.length === 0) {
        errors.push('Weekly recurrence must specify at least one weekday')
      }
      if (weeklyRule.weekdays.some((day: number) => day < 0 || day > 6)) {
        errors.push('Weekday values must be between 0 (Sunday) and 6 (Saturday)')
      }
      break

    case RecurrencePattern.MONTHLY:
      const monthlyRule = rule as MonthlyRecurrenceRule
      if (monthlyRule.interval < 1) {
        errors.push('Monthly interval must be at least 1 month')
      }
      if (monthlyRule.dayOfMonth && (monthlyRule.dayOfMonth < 1 || monthlyRule.dayOfMonth > 31)) {
        errors.push('Day of month must be between 1 and 31')
      }
      if (monthlyRule.dayOfMonth && monthlyRule.dayOfMonth > 28) {
        warnings.push('Day of month > 28 may not occur in all months')
      }
      break

    case RecurrencePattern.YEARLY:
      const yearlyRule = rule as YearlyRecurrenceRule
      if (yearlyRule.interval < 1) {
        errors.push('Yearly interval must be at least 1 year')
      }
      if (yearlyRule.month < 1 || yearlyRule.month > 12) {
        errors.push('Month must be between 1 and 12')
      }
      if (yearlyRule.dayOfMonth && (yearlyRule.dayOfMonth < 1 || yearlyRule.dayOfMonth > 31)) {
        errors.push('Day of month must be between 1 and 31')
      }
      break

    case RecurrencePattern.CUSTOM:
      warnings.push('Custom recurrence patterns are not yet implemented')
      break
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Generate a preview of recurring instances
 */
export function generateRecurrencePreview(
  rule: RecurrenceRule,
  endCondition: RecurrenceEndCondition,
  options: RecurrencePreviewOptions
): Date[] {
  const instances: Date[] = []
  let currentDate = new Date(options.startDate)
  let instanceCount = 0
  const maxInstances = options.maxInstances || 50

  while (instanceCount < maxInstances) {
    if (!shouldContinueGeneration(currentDate, endCondition, instanceCount)) {
      break
    }

    if (options.endDate && currentDate > options.endDate) {
      break
    }

    instances.push(new Date(currentDate))
    currentDate = getNextOccurrence(currentDate, rule)
    instanceCount++
  }

  return instances
}

/**
 * Check if a date matches a recurrence pattern
 */
export function isDateInRecurrence(date: Date, rule: RecurrenceRule, startDate: Date): boolean {
  // Simple check - in a real implementation, you'd want to work backwards from the date
  // to see if it could be generated from the start date with the given rule
  const instances = generateRecurringInstances('temp', rule, { type: 'on_date', date: new Date().toISOString().split('T')[0] } as RecurrenceEndCondition, [], startDate)
  const dateStr = formatDateKey(date)
  return instances.some((instance: RecurringTaskInstance) => instance.scheduledDate === dateStr)
}

/**
 * Update recurring instances when a task changes
 */
export function updateRecurringInstances(
  taskId: string,
  rule: RecurrenceRule,
  endCondition: RecurrenceEndCondition,
  exceptions: RecurrenceException[],
  startDate: Date,
  dueTime?: string,
  duration?: number,
  existingInstances: RecurringTaskInstance[] = []
): {
  newInstances: RecurringTaskInstance[]
  updatedInstances: RecurringTaskInstance[]
  removedInstances: RecurringTaskInstance[]
} {
  // Generate what the instances should be
  const targetInstances = generateRecurringInstances(
    taskId,
    rule,
    endCondition,
    exceptions,
    startDate,
    dueTime,
    duration
  )

  // Compare with existing instances to find changes
  const updatedInstances: RecurringTaskInstance[] = []
  const removedInstances: RecurringTaskInstance[] = []

  // Mark existing instances that are no longer in target
  existingInstances.forEach(existing => {
    const found = targetInstances.find(target =>
      target.scheduledDate === existing.scheduledDate
    )
    if (!found) {
      removedInstances.push(existing)
    }
  })

  return {
    newInstances: targetInstances,
    updatedInstances,
    removedInstances
  }
}