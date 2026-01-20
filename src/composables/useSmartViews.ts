// Centralized Smart View System
// Single source of truth for all smart view filtering logic
import type { Task } from '@/types/tasks'

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
    if (task.instances && task.instances.length > 0) {
      if (task.instances.some(inst => {
        if (!inst || !inst.scheduledDate) return false
        const normalizedInstDate = normalizeDateString(inst.scheduledDate)
        return normalizedInstDate === todayStr
      })) {
        return true
      }
    }

    // Check legacy scheduled date for today
    if (task.scheduledDate) {
      const normalizedScheduledDate = normalizeDateString(task.scheduledDate)
      if (normalizedScheduledDate === todayStr) {
        return true
      }
    }

    // Tasks currently in progress should be included in today filter
    if (task.status === 'in_progress') {
      return true
    }

    // Only include tasks created today if they have NO due date
    // (prevents tasks with future due dates from appearing in Today)
    if (!task.dueDate && task.createdAt) {
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
   * Check if a task is due this week (Sunday-Saturday)
   */
  const isWeekTask = (task: Task): boolean => {
    if (task.status === 'done') return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = getLocalDateString(today)

    // Calculate end of current week (Sunday)
    const weekEnd = new Date(today)
    const dayOfWeek = today.getDay()
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7 // If today is Sunday (0), daysUntilSunday = 7
    weekEnd.setDate(today.getDate() + daysUntilSunday)
    const weekEndStr = getLocalDateString(weekEnd)

    // Include tasks due within the current week (today through Sunday)
    if (task.dueDate) {
      try {
        const normalizedDueDate = normalizeDateString(task.dueDate)
        if (normalizedDueDate && normalizedDueDate >= todayStr && normalizedDueDate <= weekEndStr) {
          return true
        }
      } catch (error) {
        console.warn('Error processing dueDate in week filter:', error, task.dueDate)
      }
    }

    // Check if task has instances scheduled within the week
    if (task.instances && task.instances.length > 0) {
      try {
        if (task.instances.some(inst => {
          if (!inst || !inst.scheduledDate) return false
          const normalizedInstDate = normalizeDateString(inst.scheduledDate)
          return normalizedInstDate && normalizedInstDate >= todayStr && normalizedInstDate <= weekEndStr
        })) {
          return true
        }
      } catch (error) {
        console.warn('Error processing task instances in week filter:', error, task.instances)
      }
    }

    // Check legacy scheduled dates within the week
    if (task.scheduledDate) {
      try {
        const normalizedScheduledDate = normalizeDateString(task.scheduledDate)
        if (normalizedScheduledDate && normalizedScheduledDate >= todayStr && normalizedScheduledDate <= weekEndStr) {
          return true
        }
      } catch (error) {
        console.warn('Error processing scheduledDate in week filter:', error, task.scheduledDate)
      }
    }

    // Tasks currently in progress should be included in week filter
    if (task.status === 'in_progress') {
      return true
    }

    // Only include tasks created today if they have NO due date
    // (prevents tasks with future due dates from appearing in This Week)
    if (!task.dueDate && task.createdAt) {
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
   * Check if a task is due this month (from today to end of current month)
   */
  const isThisMonthTask = (task: Task): boolean => {
    if (task.status === 'done') return false

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = getLocalDateString(today)

    // End of current month
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    const monthEndStr = getLocalDateString(monthEnd)

    // Check dueDate within this month
    if (task.dueDate) {
      const normalizedDueDate = normalizeDateString(task.dueDate)
      if (normalizedDueDate && normalizedDueDate >= todayStr && normalizedDueDate <= monthEndStr) {
        return true
      }
    }

    // Check instances within this month
    if (task.instances && task.instances.length > 0) {
      if (task.instances.some(inst => {
        if (!inst || !inst.scheduledDate) return false
        const normalizedInstDate = normalizeDateString(inst.scheduledDate)
        return normalizedInstDate && normalizedInstDate >= todayStr && normalizedInstDate <= monthEndStr
      })) {
        return true
      }
    }

    // Check legacy scheduled dates within this month
    if (task.scheduledDate) {
      const normalizedScheduledDate = normalizeDateString(task.scheduledDate)
      if (normalizedScheduledDate && normalizedScheduledDate >= todayStr && normalizedScheduledDate <= monthEndStr) {
        return true
      }
    }

    // Tasks currently in progress should be included
    if (task.status === 'in_progress') {
      return true
    }

    // Only include tasks created today if they have NO due date
    if (!task.dueDate && task.createdAt) {
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
    if (task.projectId === 'uncategorized') {
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