/**
 * Unified Task Filtering System
 *
 * Provides consistent task filtering across all views (Board, Calendar, Canvas, Mobile)
 * Eliminates duplicate filtering logic and ensures consistent task counts
 */

import { computed, type ComputedRef } from 'vue'
import type { Task } from '@/stores/tasks'

export interface FilterConfig {
  projectId?: string | null
  smartView?: 'today' | 'week' | null
  statusFilter?: Task['status'] | null
  hideDone?: boolean
  includeInboxOnly?: boolean
  includeCanvasOnly?: boolean
  timeFilter?: 'all' | 'now' | 'today' | 'tomorrow' | 'thisWeek' | 'noDate'
}

export interface FilterDebugInfo {
  original: number
  afterProject: number
  afterSmartView: number
  afterStatus: number
  afterTime: number
  afterHideDone: number
  afterLocation: number
  final: number
  filters: string[]
}

/**
 * Unified today filter logic - Single source of truth for "today" criteria
 */
const filterTodayTasks = (tasks: Task[]): Task[] => {
  const todayStr = new Date().toISOString().split('T')[0]

  return tasks.filter(task => {
    // Check instances first (new format) - tasks scheduled for today
    if (task.instances?.some(inst => inst.scheduledDate === todayStr)) {
      return true
    }

    // Backward compatibility: Check legacy scheduledDate
    if (task.scheduledDate === todayStr) {
      return true
    }

    // Tasks created today
    if (task.createdAt && format(task.createdAt, 'yyyy-MM-dd') === todayStr) {
      return true
    }

    // Tasks due today
    if (task.dueDate === todayStr) {
      return true
    }

    // Tasks currently in progress
    if (task.status === 'in_progress') {
      return true
    }

    return false
  })
}

/**
 * Unified week filter logic
 */
const filterWeekTasks = (tasks: Task[]): Task[] => {
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  return tasks.filter(task => {
    // Check instances
    if (task.instances?.some(inst => {
      const instDate = new Date(inst.scheduledDate)
      return instDate >= weekStart && instDate <= weekEnd
    })) {
      return true
    }

    // Check legacy scheduledDate
    if (task.scheduledDate) {
      const taskDate = new Date(task.scheduledDate)
      return taskDate >= weekStart && taskDate <= weekEnd
    }

    // Tasks due this week
    if (task.dueDate) {
      const dueDate = new Date(task.dueDate)
      return dueDate >= weekStart && dueDate <= weekEnd
    }

    return false
  })
}

/**
 * Time-based filtering for inbox panels
 */
const filterByTime = (tasks: Task[], timeFilter: string): Task[] => {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay())
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  switch (timeFilter) {
    case 'now':
      return tasks.filter(task => task.status === 'in_progress')

    case 'today':
      return filterTodayTasks(tasks)

    case 'tomorrow':
      return tasks.filter(task => {
        // Check instances
        if (task.instances?.some(inst => inst.scheduledDate === tomorrowStr)) {
          return true
        }
        // Check legacy scheduledDate
        return task.scheduledDate === tomorrowStr
      })

    case 'thisWeek':
      return filterWeekTasks(tasks)

    case 'noDate':
      return tasks.filter(task => {
        // No instances and no legacy scheduled date
        return (!task.instances || task.instances.length === 0) && !task.scheduledDate
      })

    default: // 'all'
      return tasks
  }
}

/**
 * Standardized inbox logic
 */
const isInInbox = (task: Task): boolean => {
  return task.isInInbox !== false && !task.canvasPosition && task.status !== 'done'
}

/**
 * Standardized canvas logic
 */
const isOnCanvas = (task: Task): boolean => {
  return !!task.canvasPosition
}

/**
 * Helper function to format dates consistently
 */
const format = (date: Date, formatStr: string): string => {
  if (formatStr === 'yyyy-MM-dd') {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return date.toISOString()
}

/**
 * Main unified filtering function
 */
export const useUnifiedTaskFilter = (
  tasks: ComputedRef<Task[]> | Task[],
  config: ComputedRef<FilterConfig> | FilterConfig
) => {
  return computed(() => {
    const baseTasks = Array.isArray(tasks) ? tasks : tasks.value
    const filterConfig = Array.isArray(config) ? config : config.value

    // Initialize debug info
    const debug: FilterDebugInfo = {
      original: baseTasks.length,
      afterProject: baseTasks.length,
      afterSmartView: baseTasks.length,
      afterStatus: baseTasks.length,
      afterTime: baseTasks.length,
      afterHideDone: baseTasks.length,
      afterLocation: baseTasks.length,
      final: 0,
      filters: []
    }

    let filtered = [...baseTasks]

    // 1. Project Filter
    if (filterConfig.projectId) {
      const projectId = filterConfig.projectId
      filtered = filtered.filter(task => task.projectId === projectId)
      debug.afterProject = filtered.length
      debug.filters.push(`Project: ${projectId}`)
    }

    // 2. Smart View Filter (highest priority after project)
    if (filterConfig.smartView === 'today') {
      filtered = filterTodayTasks(filtered)
      debug.afterSmartView = filtered.length
      debug.filters.push('Smart View: Today')
    } else if (filterConfig.smartView === 'week') {
      filtered = filterWeekTasks(filtered)
      debug.afterSmartView = filtered.length
      debug.filters.push('Smart View: Week')
    }

    // 3. Time Filter (for inbox panels)
    if (filterConfig.timeFilter && filterConfig.timeFilter !== 'all') {
      filtered = filterByTime(filtered, filterConfig.timeFilter)
      debug.afterTime = filtered.length
      debug.filters.push(`Time: ${filterConfig.timeFilter}`)
    }

    // 4. Status Filter
    if (filterConfig.statusFilter) {
      filtered = filtered.filter(task => task.status === filterConfig.statusFilter)
      debug.afterStatus = filtered.length
      debug.filters.push(`Status: ${filterConfig.statusFilter}`)
    }

    // 5. Hide Done Filter
    if (filterConfig.hideDone) {
      filtered = filtered.filter(task => task.status !== 'done')
      debug.afterHideDone = filtered.length
      debug.filters.push('Hide Done: true')
    }

    // 6. Location Filter (inbox vs canvas)
    if (filterConfig.includeInboxOnly) {
      filtered = filtered.filter(isInInbox)
      debug.afterLocation = filtered.length
      debug.filters.push('Location: Inbox Only')
    } else if (filterConfig.includeCanvasOnly) {
      filtered = filtered.filter(isOnCanvas)
      debug.afterLocation = filtered.length
      debug.filters.push('Location: Canvas Only')
    }

    debug.final = filtered.length

    // Log debug info in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 [UNIFIED-FILTER] Filter Results:', {
        input: debug.original,
        output: debug.final,
        filters: debug.filters,
        efficiency: `${((debug.final / debug.original) * 100).toFixed(1)}%`
      })
    }

    return {
      tasks: filtered,
      debug
    }
  })
}

/**
 * Create a filter configuration composable for common use cases
 */
export const createFilterConfig = (overrides: Partial<FilterConfig> = {}): ComputedRef<FilterConfig> => {
  return computed(() => ({
    projectId: null,
    smartView: null,
    statusFilter: null,
    hideDone: false,
    includeInboxOnly: false,
    includeCanvasOnly: false,
    timeFilter: 'all',
    ...overrides
  }))
}

/**
 * Preset filter configurations for common views
 */
export const FILTER_PRESETS = {
  // Board View preset
  BOARD: {
    projectId: null,
    smartView: null,
    statusFilter: null,
    hideDone: false,
    includeInboxOnly: false,
    includeCanvasOnly: false,
    timeFilter: 'all'
  } as FilterConfig,

  // Today View preset
  TODAY: {
    projectId: null,
    smartView: 'today',
    statusFilter: null,
    hideDone: false,
    includeInboxOnly: false,
    includeCanvasOnly: false,
    timeFilter: 'all'
  } as FilterConfig,

  // Inbox preset
  INBOX: {
    projectId: null,
    smartView: null,
    statusFilter: null,
    hideDone: false,
    includeInboxOnly: true,
    includeCanvasOnly: false,
    timeFilter: 'all'
  } as FilterConfig,

  // Canvas preset
  CANVAS: {
    projectId: null,
    smartView: null,
    statusFilter: null,
    hideDone: false,
    includeInboxOnly: false,
    includeCanvasOnly: true,
    timeFilter: 'all'
  } as FilterConfig,

  // Mobile Today preset
  MOBILE_TODAY: {
    projectId: null,
    smartView: 'today',
    statusFilter: null,
    hideDone: false,
    includeInboxOnly: false,
    includeCanvasOnly: false,
    timeFilter: 'all'
  } as FilterConfig
} as const

/**
 * Hook for getting today's tasks with consistent logic
 */
export const useTodayTasks = (tasks: ComputedRef<Task[]> | Task[]) => {
  return useUnifiedTaskFilter(tasks, createFilterConfig({ smartView: 'today' }))
}

/**
 * Hook for getting inbox tasks with consistent logic
 */
export const useInboxTasks = (tasks: ComputedRef<Task[]> | Task[], timeFilter: string = 'all') => {
  return useUnifiedTaskFilter(tasks, createFilterConfig({
    includeInboxOnly: true,
    timeFilter: timeFilter as any
  }))
}

/**
 * Hook for getting canvas tasks with consistent logic
 */
export const useCanvasTasks = (tasks: ComputedRef<Task[]> | Task[]) => {
  return useUnifiedTaskFilter(tasks, createFilterConfig({ includeCanvasOnly: true }))
}

/**
 * Validation function to check if task counts are consistent across filters
 */
export const validateTaskCounts = (
  baseTasks: Task[],
  configs: { name: string; config: FilterConfig }[]
): { valid: boolean; discrepancies: string[] } => {
  const results: { [key: string]: number } = {}
  const discrepancies: string[] = []

  configs.forEach(({ name, config }) => {
    const { tasks } = useUnifiedTaskFilter(computed(() => baseTasks), computed(() => config))
    results[name] = tasks.value.length
  })

  // Check for obvious discrepancies
  const todayCount = results['today'] || 0
  const inboxCount = results['inbox'] || 0
  const boardCount = results['board'] || 0

  if (todayCount > boardCount) {
    discrepancies.push(`Today tasks (${todayCount}) > Board tasks (${boardCount})`)
  }

  if (inboxCount > boardCount) {
    discrepancies.push(`Inbox tasks (${inboxCount}) > Board tasks (${boardCount})`)
  }

  return {
    valid: discrepancies.length === 0,
    discrepancies
  }
}