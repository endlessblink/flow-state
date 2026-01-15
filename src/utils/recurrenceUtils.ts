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
      return getNextCustomOccurrence(next, rule.customRule)

    default:
      return next
  }
}

/**
 * Partial custom recurrence engine
 * Supports: 
 * - EVERY N DAYS
 * - EVERY N WEEKS ON [MON,TUE,WED,THU,FRI,SAT,SUN]
 * - EVERY N MONTHS ON LAST DAY
 * - EVERY N MONTHS ON [1ST,2ND,3RD,4TH] [WEEKDAY]
 */
function getNextCustomOccurrence(currentDate: Date, customRule: string): Date {
  const rule = customRule.toUpperCase().trim()
  const next = new Date(currentDate)

  // 1. EVERY N DAYS
  const dailyMatch = rule.match(/^EVERY (\d+) DAYS$/)
  if (dailyMatch) {
    const interval = parseInt(dailyMatch[1], 10)
    next.setDate(next.getDate() + Math.max(1, interval))
    return next
  }

  // 2. EVERY N WEEKS ON [DAYS]
  const weeklyMatch = rule.match(/^EVERY (\d+) WEEKS ON ([\w,]+)$/)
  if (weeklyMatch) {
    const interval = parseInt(weeklyMatch[1], 10)
    const daysStr = weeklyMatch[2]
    const dayMap: Record<string, number> = {
      'SUN': 0, 'SUNDAY': 0,
      'MON': 1, 'MONDAY': 1,
      'TUE': 2, 'TUESDAY': 2,
      'WED': 3, 'WEDNESDAY': 3,
      'THU': 4, 'THURSDAY': 4,
      'FRI': 5, 'FRIDAY': 5,
      'SAT': 6, 'SATURDAY': 6
    }
    const targetDays = daysStr.split(',').map(d => dayMap[d.trim()]).filter(d => d !== undefined).sort((a, b) => a - b)

    if (targetDays.length === 0) return addDay(next)

    const currentDay = next.getDay()
    let nextDay = targetDays.find(d => d > currentDay)

    if (nextDay !== undefined) {
      next.setDate(next.getDate() + (nextDay - currentDay))
    } else {
      // Wrap to next interval week
      nextDay = targetDays[0]
      next.setDate(next.getDate() + (7 * interval - currentDay + nextDay))
    }
    return next
  }

  // 3. EVERY N MONTHS ON LAST DAY
  const lastDayMatch = rule.match(/^EVERY (\d+) MONTHS ON LAST DAY$/)
  if (lastDayMatch) {
    const interval = parseInt(lastDayMatch[1], 10)
    next.setDate(1) // Set to 1st to avoid month overflow (e.g., Jan 31 -> Feb 31 = Mar 3)
    next.setMonth(next.getMonth() + Math.max(1, interval))
    next.setDate(getDaysInMonth(next.getFullYear(), next.getMonth())) // Jump to last day
    return next
  }

  // 4. EVERY N MONTHS ON [1ST,2ND,3RD,4TH] [WEEKDAY]
  const nthWeekdayMatch = rule.match(/^EVERY (\d+) MONTHS ON (1ST|2ND|3RD|4TH|LAST) (\w+)$/)
  if (nthWeekdayMatch) {
    const interval = parseInt(nthWeekdayMatch[1], 10)
    const posStr = nthWeekdayMatch[2]
    const dayStr = nthWeekdayMatch[3]

    const dayMap: Record<string, number> = {
      'SUN': 0, 'SUNDAY': 0,
      'MON': 1, 'MONDAY': 1,
      'TUE': 2, 'TUESDAY': 2,
      'WED': 3, 'WEDNESDAY': 3,
      'THU': 4, 'THURSDAY': 4,
      'FRI': 5, 'FRIDAY': 5,
      'SAT': 6, 'SATURDAY': 6
    }
    const posMap: Record<string, number> = { '1ST': 1, '2ND': 2, '3RD': 3, '4TH': 4, 'LAST': -1 }

    if (dayMap[dayStr] === undefined) return addDay(next)
    return getNextNthWeekdayOfMonth(next, interval, dayMap[dayStr], posMap[posStr])
  }

  // Fallback if rule doesn't match grammar - safety guard to prevent infinite loops
  console.warn(`[RECURRENCE] Unrecognized custom rule: ${customRule}. Falling back to +1 day.`)
  return addDay(next)
}

function addDay(date: Date): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + 1)
  return next
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
      const customRule = (rule as { pattern: RecurrencePattern.CUSTOM; customRule: string }).customRule
      if (!customRule || customRule.trim() === '') {
        errors.push('Custom recurrence rule must not be empty')
      } else {
        const normalized = customRule.toUpperCase().trim()
        const isValid = /^EVERY \d+ DAYS$/.test(normalized) ||
          /^EVERY \d+ WEEKS ON [\w,]+$/.test(normalized) ||
          /^EVERY \d+ MONTHS ON LAST DAY$/.test(normalized) ||
          /^EVERY \d+ MONTHS ON (1ST|2ND|3RD|4TH|LAST) \w+$/.test(normalized)

        if (!isValid) {
          errors.push(`Invalid custom recurrence rule syntax: "${customRule}"`)
        }
      }
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

/**
 * Add an exception to the recurrence exceptions list
 */
export function addException(
  exceptions: RecurrenceException[],
  date: string,
  action: 'skip' | 'modify' | 'delete' = 'skip',
  newDetails?: Partial<RecurringTaskInstance>
): RecurrenceException[] {
  const existingIndex = exceptions.findIndex(ex => ex.date === date)

  const newException: RecurrenceException = {
    id: `ex-${date}-${action}-${Date.now()}`,
    date,
    action
  }

  // If modification, add details
  if (action === 'modify' && newDetails) {
    // implementation details for modification would go here
    // For now we just track that it's modified in the exception object if strictly needed types match
  }

  const result = [...exceptions]
  if (existingIndex >= 0) {
    result[existingIndex] = newException
  } else {
    result.push(newException)
  }

  return result
}