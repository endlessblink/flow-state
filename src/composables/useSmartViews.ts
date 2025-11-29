// Centralized Smart View System
// Single source of truth for all smart view filtering logic
import type { Task } from '@/types/tasks'

export type SmartView = 'today' | 'week' | 'uncategorized' | 'unscheduled' | 'in_progress' | null

/**
 * Centralized smart view filtering composable
 * Provides consistent filtering logic across all application views
 */
export const useSmartViews = () => {

  /**
   * Check if a task is due today
   */
  const isTodayTask = (task: Task): boolean => {
    if (task.status === 'done') return false

    const todayStr = new Date().toISOString().split('T')[0]

    // Check if task is due today
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate)
      if (!isNaN(dueDate.getTime()) && dueDate.toISOString().split('T')[0] === todayStr) {
        return true
      }
    }

    // Check if task has instances scheduled for today
    if (task.instances && task.instances.length > 0) {
      return task.instances.some(inst => {
        if (!inst || !inst.scheduledDate) return false
        const instanceDate = new Date(inst.scheduledDate)
        return !isNaN(instanceDate.getTime()) && instanceDate.toISOString().split('T')[0] === todayStr
      })
    }

    // Check legacy scheduled date for today
    if (task.scheduledDate) {
      const scheduledDate = new Date(task.scheduledDate)
      if (!isNaN(scheduledDate.getTime()) && scheduledDate.toISOString().split('T')[0] === todayStr) {
        return true
      }
    }

    // Tasks currently in progress should be included in today filter
    if (task.status === 'in_progress') {
      return true
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
    const todayStr = today.toISOString().split('T')[0]

    // Calculate end of current week (Sunday)
    const weekEnd = new Date(today)
    const dayOfWeek = today.getDay()
    const daysUntilSunday = (7 - dayOfWeek) % 7 || 7 // If today is Sunday (0), daysUntilSunday = 7
    weekEnd.setDate(today.getDate() + daysUntilSunday)
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    // Include tasks due within the current week (today through Sunday)
    if (task.dueDate) {
      try {
        if (task.dueDate >= todayStr && task.dueDate <= weekEndStr) {
          return true
        }
      } catch (error) {
        console.warn('Error processing dueDate in week filter:', error, task.dueDate)
      }
    }

    // Check if task has instances scheduled within the week
    if (task.instances && task.instances.length > 0) {
      try {
        return task.instances.some(inst => {
          if (!inst || !inst.scheduledDate) return false
          return inst.scheduledDate >= todayStr && inst.scheduledDate <= weekEndStr
        })
      } catch (error) {
        console.warn('Error processing task instances in week filter:', error, task.instances)
      }
    }

    // Check legacy scheduled dates within the week
    if (task.scheduledDate) {
      try {
        if (task.scheduledDate >= todayStr && task.scheduledDate <= weekEndStr) {
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
        default:
          return true
      }
    }).length
  }

  return {
    // Individual task checkers
    isTodayTask,
    isWeekTask,
    isUncategorizedTask,
    isUnscheduledTask,
    isInProgressTask,

    // Unified filter and count functions
    applySmartViewFilter,
    getSmartViewCount
  }
}