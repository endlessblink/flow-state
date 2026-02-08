// Centralized Smart View System
// Single source of truth for all smart view filtering logic
import type { Task } from '@/types/tasks'
import { UNCATEGORIZED_PROJECT_ID } from '@/stores/tasks/taskOperations'

export type SmartView = 'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | 'all_active' |
  'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null

/**
 * Centralized smart view filtering composable
 * Provides consistent filtering logic across all application views
 */
export const useSmartViews = () => {

  /**
   * Get local date string (YYYY-MM-DD) - avoids timezone issues with toISOString()
   */
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Normalize any date string to YYYY-MM-DD format for consistent comparison
   * Handles various formats:
   * - YYYY-MM-DD (already correct)
   * - DD-MM-YYYY
   * - ISO 8601 strings (2026-01-07T00:00:00+00:00)
   * - Malformed formats like "07T00:00:00+00:00-01-2026"
   */
  const normalizeDateString = (dateStr: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return ''

    const trimmed = dateStr.trim()

    // Already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }

    // ISO 8601 format: 2026-01-07T00:00:00... - extract the date part
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      return trimmed.substring(0, 10)
    }

    // DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
      const [day, month, year] = trimmed.split('-')
      return `${year}-${month}-${day}`
    }

    // Malformed format like "07T00:00:00+00:00-01-2026"
    // Pattern: DD followed by T, then time info, ending with -MM-YYYY
    const malformedMatch = trimmed.match(/^(\d{2})T[\d:+]+(\d{2})-(\d{4})$/)
    if (malformedMatch) {
      const [, day, month, year] = malformedMatch
      return `${year}-${month}-${day}`
    }

    // Try parsing as a Date object as last resort
    try {
      const parsed = new Date(trimmed)
      if (!isNaN(parsed.getTime())) {
        return getLocalDateString(parsed)
      }
    } catch {
      // Fall through to return empty
    }

    return ''
  }

  /**
   * Check if a task is due today
   */
  const isTodayTask = (task: Task): boolean => {
    if (task.status === 'done') return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = getLocalDateString(today)

    // Check if task is due today (normalize date format before comparison)
    if (task.dueDate) {
      const normalizedDueDate = normalizeDateString(task.dueDate)
      if (normalizedDueDate === todayStr) {
        return true
      }
    }

    // Check if task has instances scheduled for today
    // BUG-1188: If instances exist, ONLY check instance dates (instances are authoritative)
    if (task.instances && task.instances.length > 0) {
      // Instances exist - check if any are scheduled for today
      // Skip legacy scheduledDate check since instances override it
      return task.instances.some(inst => {
        if (!inst || !inst.scheduledDate) return false
        const normalizedInstDate = normalizeDateString(inst.scheduledDate)
        return normalizedInstDate === todayStr
      })
    }

    // Check legacy scheduled date for today (only when NO instances exist)
    if (task.scheduledDate) {
      const normalizedScheduledDate = normalizeDateString(task.scheduledDate)
      if (normalizedScheduledDate === todayStr) {
        return true
      }
    }

    // Only include tasks created today if they have NO date information at all
    // (prevents tasks with future dates from appearing in Today)
    // BUG-1185: Must also check scheduledDate and instances, not just dueDate
    const hasScheduledDate = task.scheduledDate && task.scheduledDate.trim() !== ''
    const hasScheduledInstances = task.instances && task.instances.some(inst => inst?.scheduledDate)

    if (!task.dueDate && !hasScheduledDate && !hasScheduledInstances && task.createdAt) {
      const createdDate = new Date(task.createdAt)
      if (!isNaN(createdDate.getTime())) {
        createdDate.setHours(0, 0, 0, 0)
        if (createdDate.getTime() === today.getTime()) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if a task is due within the next 3 calendar days (today through day+2, inclusive)
   * Includes: overdue tasks + tasks due from today until day+3 boundary (exclusive)
   */
  const isNext3DaysTask = (task: Task): boolean => {
    if (task.status === 'done') return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const boundary = new Date(today)
    boundary.setDate(boundary.getDate() + 3) // 3 calendar days from today (exclusive)
    const boundaryStr = getLocalDateString(boundary)

    // Check dueDate (include overdue - no lower bound check)
    if (task.dueDate) {
      const normalizedDueDate = normalizeDateString(task.dueDate)
      if (normalizedDueDate && normalizedDueDate < boundaryStr) {
        return true
      }
    }

    // Check instances (authoritative if present)
    // BUG-1188: If instances exist, ONLY check instance dates (instances are authoritative)
    if (task.instances && task.instances.length > 0) {
      return task.instances.some(inst => {
        if (!inst || !inst.scheduledDate) return false
        const normalizedInstDate = normalizeDateString(inst.scheduledDate)
        return normalizedInstDate && normalizedInstDate < boundaryStr
      })
    }

    // Legacy scheduledDate (only when NO instances exist)
    if (task.scheduledDate) {
      const normalizedScheduledDate = normalizeDateString(task.scheduledDate)
      if (normalizedScheduledDate && normalizedScheduledDate < boundaryStr) {
        return true
      }
    }

    // Only include tasks created today if they have NO date information at all
    // BUG-1185: Must also check scheduledDate and instances, not just dueDate
    const hasScheduledDate = task.scheduledDate && task.scheduledDate.trim() !== ''
    const hasScheduledInstances = task.instances && task.instances.some(inst => inst?.scheduledDate)

    if (!task.dueDate && !hasScheduledDate && !hasScheduledInstances && task.createdAt) {
      const createdDate = new Date(task.createdAt)
      if (!isNaN(createdDate.getTime())) {
        createdDate.setHours(0, 0, 0, 0)
        if (createdDate.getTime() === today.getTime()) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if a task is due this week (including overdue tasks)
   * TASK-1089: Uses calendar week ending at 00:00 Sunday (exclusive of Sunday)
   * - On Monday: shows Mon-Sat (5 days)
   * - On Sunday: shows Sun-Sat of the upcoming week (7 days until next Sunday)
   * Includes: overdue tasks + tasks due from today until Sunday 00:00
   */
  const isWeekTask = (task: Task): boolean => {
    if (task.status === 'done') return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // TASK-1089: Calculate end of calendar week (Sunday at 00:00, exclusive)
    // Week boundary is Sunday 00:00, so we calculate the next Sunday
    // and use < comparison to exclude tasks due ON Sunday
    const weekEnd = new Date(today)
    const dayOfWeek = today.getDay()
    // When today is Sunday (0), we want NEXT Sunday (7 days away)
    // When today is Monday (1), we want this Sunday (6 days away)
    // When today is Saturday (6), we want this Sunday (1 day away)
    const daysUntilSunday = dayOfWeek === 0 ? 7 : (7 - dayOfWeek)
    weekEnd.setDate(today.getDate() + daysUntilSunday)
    const weekEndStr = getLocalDateString(weekEnd)

    // Include tasks due before Sunday (< not <=) OR overdue (before today)
    if (task.dueDate) {
      try {
        const normalizedDueDate = normalizeDateString(task.dueDate)
        // BUG-367 FIX: Include overdue tasks
        // TASK-1089: Use < to exclude Sunday itself (week ends at 00:00 Sunday)
        if (normalizedDueDate && normalizedDueDate < weekEndStr) {
          return true
        }
      } catch (error) {
        console.warn('Error processing dueDate in week filter:', error, task.dueDate)
      }
    }

    // Check if task has instances scheduled within the week or overdue
    // BUG-1188: If instances exist, ONLY check instance dates (instances are authoritative)
    if (task.instances && task.instances.length > 0) {
      try {
        // Instances exist - check if any are in this week
        // Skip legacy scheduledDate check since instances override it
        return task.instances.some(inst => {
          if (!inst || !inst.scheduledDate) return false
          const normalizedInstDate = normalizeDateString(inst.scheduledDate)
          // BUG-367 FIX: Include overdue instances
          // TASK-1089: Use < to exclude Sunday
          return normalizedInstDate && normalizedInstDate < weekEndStr
        })
      } catch (error) {
        console.warn('Error processing task instances in week filter:', error, task.instances)
        return false
      }
    }

    // Check legacy scheduled dates within the week or overdue (only when NO instances exist)
    if (task.scheduledDate) {
      try {
        const normalizedScheduledDate = normalizeDateString(task.scheduledDate)
        // BUG-367 FIX: Include overdue
        // TASK-1089: Use < to exclude Sunday
        if (normalizedScheduledDate && normalizedScheduledDate < weekEndStr) {
          return true
        }
      } catch (error) {
        console.warn('Error processing scheduledDate in week filter:', error, task.scheduledDate)
      }
    }

    // Only include tasks created today if they have NO date information at all
    // (prevents tasks with future dates from appearing in This Week)
    // BUG-1185: Must also check scheduledDate and instances, not just dueDate
    const hasScheduledDate = task.scheduledDate && task.scheduledDate.trim() !== ''
    const hasScheduledInstances = task.instances && task.instances.some(inst => inst?.scheduledDate)

    if (!task.dueDate && !hasScheduledDate && !hasScheduledInstances && task.createdAt) {
      const createdDate = new Date(task.createdAt)
      if (!isNaN(createdDate.getTime())) {
        createdDate.setHours(0, 0, 0, 0)
        if (createdDate.getTime() === today.getTime()) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if a task is due this month (including overdue tasks)
   * Includes: overdue tasks + tasks due from today to end of current month
   */
  const isThisMonthTask = (task: Task): boolean => {
    if (task.status === 'done') return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // End of current month
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const monthEndStr = getLocalDateString(monthEnd)

    // Check dueDate within this month OR overdue
    if (task.dueDate) {
      const normalizedDueDate = normalizeDateString(task.dueDate)
      // BUG-367 FIX: Include overdue tasks (removed >= todayStr check)
      if (normalizedDueDate && normalizedDueDate <= monthEndStr) {
        return true
      }
    }

    // Check instances within this month or overdue
    // BUG-1188: If instances exist, ONLY check instance dates (instances are authoritative)
    if (task.instances && task.instances.length > 0) {
      // Instances exist - check if any are in this month
      // Skip legacy scheduledDate check since instances override it
      return task.instances.some(inst => {
        if (!inst || !inst.scheduledDate) return false
        const normalizedInstDate = normalizeDateString(inst.scheduledDate)
        // BUG-367 FIX: Include overdue instances
        return normalizedInstDate && normalizedInstDate <= monthEndStr
      })
    }

    // Check legacy scheduled dates within this month or overdue (only when NO instances exist)
    if (task.scheduledDate) {
      const normalizedScheduledDate = normalizeDateString(task.scheduledDate)
      // BUG-367 FIX: Include overdue
      if (normalizedScheduledDate && normalizedScheduledDate <= monthEndStr) {
        return true
      }
    }

    // Only include tasks created today if they have NO date information at all
    // BUG-1185: Must also check scheduledDate and instances, not just dueDate
    const hasScheduledDate = task.scheduledDate && task.scheduledDate.trim() !== ''
    const hasScheduledInstances = task.instances && task.instances.some(inst => inst?.scheduledDate)

    if (!task.dueDate && !hasScheduledDate && !hasScheduledInstances && task.createdAt) {
      const createdDate = new Date(task.createdAt)
      if (!isNaN(createdDate.getTime())) {
        createdDate.setHours(0, 0, 0, 0)
        if (createdDate.getTime() === today.getTime()) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if a task is uncategorized
   */
  const isUncategorizedTask = (task: Task): boolean => {
    if (task.status === 'done') return false

    // New logic: check isUncategorized flag first
    if (task.isUncategorized === true) {
      return true
    }

    // Check for explicit "uncategorized" projectId value
    if (task.projectId === UNCATEGORIZED_PROJECT_ID) {
      return true
    }

    // Backward compatibility: also treat tasks without proper project assignment as uncategorized
    if (!task.projectId || task.projectId === '' || task.projectId === null) {
      return true
    }

    return false
  }

  /**
   * Check if a task is unscheduled (no instances or legacy schedule)
   */
  const isUnscheduledTask = (task: Task): boolean => {
    if (task.status === 'done') return false

    // Check if task has instances scheduled (new instance system)
    const hasInstances = task.instances && task.instances.length > 0

    // Check legacy scheduled dates
    const hasScheduledDate = task.scheduledDate && task.scheduledDate.trim() !== ''
    const hasScheduledTime = task.scheduledTime && task.scheduledTime.trim() !== ''

    // Task is unscheduled if it has no instances and no legacy schedule
    return !hasInstances && !hasScheduledDate && !hasScheduledTime
  }

  /**
   * Check if a task is in progress
   */
  const isInProgressTask = (task: Task): boolean => {
    return task.status === 'in_progress'
  }

  /**
   * Duration-based check helpers
   */
  const isQuickTask = (task: Task): boolean => {
    return !!task.estimatedDuration && task.estimatedDuration <= 15 && task.status !== 'done'
  }

  const isShortTask = (task: Task): boolean => {
    return !!task.estimatedDuration && task.estimatedDuration > 15 && task.estimatedDuration <= 30 && task.status !== 'done'
  }

  const isMediumTask = (task: Task): boolean => {
    return !!task.estimatedDuration && task.estimatedDuration > 30 && task.estimatedDuration <= 60 && task.status !== 'done'
  }

  const isLongTask = (task: Task): boolean => {
    return !!task.estimatedDuration && task.estimatedDuration > 60 && task.status !== 'done'
  }

  const isUnestimatedTask = (task: Task): boolean => {
    return !task.estimatedDuration && task.status !== 'done'
  }

  /**
   * Apply smart view filter to an array of tasks
   */
  const applySmartViewFilter = (tasks: Task[], smartView: SmartView): Task[] => {
    if (!smartView) return tasks

    return tasks.filter(task => {
      switch (smartView) {
        case 'today':
          return isTodayTask(task)
        case 'week':
          return isWeekTask(task)
        case 'uncategorized':
          return isUncategorizedTask(task)
        case 'unscheduled':
          return isUnscheduledTask(task)
        case 'in_progress':
          return isInProgressTask(task)
        case 'quick':
          return isQuickTask(task)
        case 'short':
          return isShortTask(task)
        case 'medium':
          return isMediumTask(task)
        case 'long':
          return isLongTask(task)
        case 'unestimated':
          return isUnestimatedTask(task)
        default:
          return true
      }
    })
  }

  /**
   * Get count of tasks matching a smart view
   */
  const getSmartViewCount = (smartView: SmartView, baseTasks: Task[] = []): number => {
    if (!smartView) return baseTasks.length

    return baseTasks.filter(task => {
      switch (smartView) {
        case 'today':
          return isTodayTask(task)
        case 'week':
          return isWeekTask(task)
        case 'uncategorized':
          return isUncategorizedTask(task)
        case 'unscheduled':
          return isUnscheduledTask(task)
        case 'in_progress':
          return isInProgressTask(task)
        case 'quick':
          return isQuickTask(task)
        case 'short':
          return isShortTask(task)
        case 'medium':
          return isMediumTask(task)
        case 'long':
          return isLongTask(task)
        case 'unestimated':
          return isUnestimatedTask(task)
        default:
          return true
      }
    }).length
  }

  return {
    // Individual task checkers
    isTodayTask,
    isNext3DaysTask,
    isWeekTask,
    isThisMonthTask,
    isUncategorizedTask,
    isUnscheduledTask,
    isInProgressTask,
    isQuickTask,
    isShortTask,
    isMediumTask,
    isLongTask,
    isUnestimatedTask,

    // Unified filter and count functions
    applySmartViewFilter,
    getSmartViewCount
  }
}