/**
 * Unified Task Filtering System
 *
 * SINGLE SOURCE OF TRUTH for ALL filtering logic across Board, Calendar, Canvas, and All Tasks views.
 * This eliminates sync drift by ensuring ALL views use identical filtering logic.
 *
 * Key Principle: Same input = Same output across ALL views
 */

import type { Task, TaskInstance, Project } from '@/stores/tasks'
import { getTaskInstances, formatDateKey, parseDateKey } from '@/stores/tasks'

export interface FilterOptions {
  // Project filtering
  projectId?: string | null
  activeProjectId?: string | null

  // Status filtering
  statusFilter?: Task['status'] | null
  activeStatusFilter?: Task['status'] | null

  // Priority filtering
  priorityFilter?: Task['priority'] | null

  // Date filtering
  dateFilter?: string // YYYY-MM-DD format
  dateRange?: {
    start: string // YYYY-MM-DD
    end: string   // YYYY-MM-DD
  }

  // Smart views
  smartView?: 'today' | 'weekend' | 'overdue' | 'completed' | 'inbox' | null
  activeSmartView?: string | null

  // UI preferences
  hideDoneTasks?: boolean
  includeCompleted?: boolean

  // Text search
  searchText?: string

  // Canvas-specific filtering
  canvasSectionId?: string | null
  showInInbox?: boolean
  showPositioned?: boolean

  // Calendar-specific filtering
  hasInstances?: boolean
  instanceDate?: string // YYYY-MM-DD format
}

export type ViewType = 'board' | 'calendar' | 'canvas' | 'list' | 'all'

/**
 * Main unified filtering function with comprehensive error handling
 *
 * This is the SINGLE source of truth for ALL task filtering across the entire application.
 * Any change to filtering logic MUST be made here to maintain consistency.
 */
export const filterTasksByView = (
  tasks: Task[],
  viewType: ViewType,
  filters: FilterOptions,
  projects?: Project[]
): Task[] => {
  try {
    // Input validation
    if (!Array.isArray(tasks)) {
      console.error('🔍 filterTasksByView: Invalid tasks input:', typeof tasks, tasks)
      return []
    }

    if (!tasks.length) {
      console.log('🔍 filterTasksByView: No tasks to filter')
      return []
    }

    if (!viewType || !['board', 'calendar', 'canvas', 'list', 'all'].includes(viewType)) {
      console.error('🔍 filterTasksByView: Invalid viewType:', viewType)
      return [...tasks] // Return original tasks if viewType is invalid
    }

    console.log('🔍 filterTasksByView: Starting filtering for', tasks.length, 'tasks with view:', viewType)
    console.log('🔍 filterTasksByView: Filters applied:', filters)

    // Start with all tasks
    let filteredTasks = [...tasks]

    try {
      // Apply filters in order (most selective first for performance)

      // 1. Smart view filtering (highest level filter)
      filteredTasks = applySmartViewFilter(filteredTasks, filters)
      console.log('🔍 After smart view filter:', filteredTasks.length, 'tasks')

      // 2. Project filtering
      filteredTasks = applyProjectFilter(filteredTasks, filters, projects)
      console.log('🔍 After project filter:', filteredTasks.length, 'tasks')

      // 3. Status filtering
      filteredTasks = applyStatusFilter(filteredTasks, filters)
      console.log('🔍 After status filter:', filteredTasks.length, 'tasks')

      // 4. Priority filtering
      filteredTasks = applyPriorityFilter(filteredTasks, filters)
      console.log('🔍 After priority filter:', filteredTasks.length, 'tasks')

      // 5. Date filtering
      filteredTasks = applyDateFilter(filteredTasks, filters)
      console.log('🔍 After date filter:', filteredTasks.length, 'tasks')

      // 6. Calendar/instance filtering
      filteredTasks = applyInstanceFilter(filteredTasks, filters)
      console.log('🔍 After instance filter:', filteredTasks.length, 'tasks')

      // 7. Canvas-specific filtering
      filteredTasks = applyCanvasFilter(filteredTasks, filters, viewType)
      console.log('🔍 After canvas filter:', filteredTasks.length, 'tasks')

      // 8. Text search
      filteredTasks = applyTextSearchFilter(filteredTasks, filters)
      console.log('🔍 After text search filter:', filteredTasks.length, 'tasks')

      // 9. UI preference filtering
      filteredTasks = applyUIPreferenceFilter(filteredTasks, filters)
      console.log('🔍 After UI preference filter:', filteredTasks.length, 'tasks')

      console.log('✅ filterTasksByView: Successfully filtered to', filteredTasks.length, 'tasks')
      return filteredTasks

    } catch (filterError) {
      console.error('❌ filterTasksByView: Error during filter application:', filterError)
      console.error('❌ filterTasksByView: Filter that failed:', { viewType, filters, projectCount: projects?.length || 0 })
      return [...tasks] // Return original tasks on filtering error
    }

  } catch (error) {
    console.error('❌ filterTasksByView: Critical error:', error)
    console.error('❌ filterTasksByView: Input data:', {
      taskCount: tasks?.length || 0,
      viewType,
      filters,
      projectCount: projects?.length || 0
    })
    return Array.isArray(tasks) ? [...tasks] : []
  }
}

/**
 * Apply smart view filtering with error handling
 */
function applySmartViewFilter(tasks: Task[], filters: FilterOptions): Task[] {
  try {
    const { smartView, activeSmartView } = filters
    const currentSmartView = smartView || activeSmartView

    if (!currentSmartView) {
      return tasks
    }

    const today = formatDateKey(new Date())
    const todayDate = parseDateKey(today)

    return tasks.filter(task => {
      try {
        switch (currentSmartView) {
          case 'today':
            // Tasks due today or with instances today
            if (task.dueDate === today) return true
            return getTaskInstances(task).some(instance => instance.scheduledDate === today)

          case 'weekend':
            // Tasks for upcoming weekend (Saturday-Sunday)
            if (!todayDate) return false
            const currentDay = todayDate.getDay()
            const daysUntilSaturday = (6 - currentDay + 7) % 7 || 7
            const saturday = new Date(todayDate)
            saturday.setDate(todayDate.getDate() + daysUntilSaturday)
            const sunday = new Date(saturday)
            sunday.setDate(saturday.getDate() + 1)

            const saturdayKey = formatDateKey(saturday)
            const sundayKey = formatDateKey(sunday)

            return task.dueDate === saturdayKey || task.dueDate === sundayKey ||
                   getTaskInstances(task).some(instance =>
                     instance.scheduledDate === saturdayKey || instance.scheduledDate === sundayKey
                   )

          case 'overdue':
            // Tasks past due date that are not done
            if (task.status === 'done') return false
            if (!task.dueDate) return false
            const dueDate = parseDateKey(task.dueDate)
            if (!dueDate) return false
            return dueDate < todayDate

          case 'completed':
            // Tasks that are done
            return task.status === 'done'

          case 'inbox':
            // Tasks in inbox (not positioned on canvas)
            return task.isInInbox === true

          default:
            console.warn('🔍 applySmartViewFilter: Unknown smart view:', currentSmartView)
            return true
        }
      } catch (taskError) {
        console.error('🔍 applySmartViewFilter: Error filtering task:', task.id, taskError)
        return true // Include task on error to be safe
      }
    })
  } catch (error) {
    console.error('❌ applySmartViewFilter: Critical error:', error)
    return tasks // Return original tasks on error
  }
}

/**
 * Get child project IDs recursively with comprehensive error handling
 * @param projectId The parent project ID
 * @param projects Available projects array
 * @returns Array containing parent ID and all descendant IDs
 */
function getChildProjectIds(projectId: string, projects?: Project[]): string[] {
  try {
    if (!projectId || typeof projectId !== 'string') {
      console.error('🔍 getChildProjectIds: Invalid projectId:', projectId)
      return []
    }

    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      console.log('🔍 getChildProjectIds: No projects provided, returning only parent:', projectId)
      return [projectId]
    }

    const ids = [projectId]
    const visited = new Set<string>() // Prevent infinite recursion
    const collectChildren = (parentId: string) => {
      if (visited.has(parentId)) {
        console.warn('🔍 getChildProjectIds: Circular reference detected for project:', parentId)
        return
      }
      visited.add(parentId)

      try {
        const childProjects = projects.filter(p => p.parentId === parentId)
        childProjects.forEach(child => {
          if (child.id && typeof child.id === 'string') {
            ids.push(child.id)
            collectChildren(child.id) // Recursively collect children of children
          } else {
            console.warn('🔍 getChildProjectIds: Invalid child project found:', child)
          }
        })
      } catch (childError) {
        console.error('🔍 getChildProjectIds: Error collecting children for parent:', parentId, childError)
      }
    }

    collectChildren(projectId)
    console.log('🔍 getChildProjectIds: Found', ids.length, 'projects for parent:', projectId)
    return ids

  } catch (error) {
    console.error('❌ getChildProjectIds: Critical error:', error)
    console.error('❌ getChildProjectIds: Input data:', { projectId, projectCount: projects?.length || 0 })
    return projectId ? [projectId] : [] // Return safe fallback
  }
}

/**
 * Apply project filtering with hierarchical support and error handling
 */
function applyProjectFilter(tasks: Task[], filters: FilterOptions, projects?: Project[]): Task[] {
  try {
    const { projectId, activeProjectId } = filters
    const targetProjectId = projectId || activeProjectId

    if (!targetProjectId) {
      return tasks
    }

    return tasks.filter(task => {
      try {
        if (targetProjectId === 'all') return true
        if (targetProjectId === 'inbox') return task.isInInbox === true

        // Hierarchical project filtering - include child projects
        const projectIds = getChildProjectIds(targetProjectId, projects)
        return projectIds.includes(task.projectId)
      } catch (taskError) {
        console.error('🔍 applyProjectFilter: Error filtering task:', task.id, taskError)
        return true // Include task on error to be safe
      }
    })
  } catch (error) {
    console.error('❌ applyProjectFilter: Critical error:', error)
    return tasks // Return original tasks on error
  }
}

/**
 * Apply status filtering
 */
function applyStatusFilter(tasks: Task[], filters: FilterOptions): Task[] {
  const { statusFilter, activeStatusFilter } = filters
  const targetStatus = statusFilter || activeStatusFilter

  if (!targetStatus) {
    return tasks
  }

  return tasks.filter(task => task.status === targetStatus)
}

/**
 * Apply priority filtering
 */
function applyPriorityFilter(tasks: Task[], filters: FilterOptions): Task[] {
  const { priorityFilter } = filters

  if (priorityFilter === null || priorityFilter === undefined) {
    return tasks
  }

  return tasks.filter(task => task.priority === priorityFilter)
}

/**
 * Apply date filtering
 */
function applyDateFilter(tasks: Task[], filters: FilterOptions): Task[] {
  const { dateFilter, dateRange } = filters

  if (dateFilter) {
    // Filter by specific date
    return tasks.filter(task => {
      // Check due date
      if (task.dueDate === dateFilter) return true

      // Check task instances
      return getTaskInstances(task).some(instance => instance.scheduledDate === dateFilter)
    })
  }

  if (dateRange) {
    // Filter by date range
    const startDate = parseDateKey(dateRange.start)
    const endDate = parseDateKey(dateRange.end)

    if (!startDate || !endDate) return tasks

    return tasks.filter(task => {
      // Check due date
      if (task.dueDate) {
        const taskDate = parseDateKey(task.dueDate)
        if (taskDate && taskDate >= startDate && taskDate <= endDate) return true
      }

      // Check task instances
      return getTaskInstances(task).some(instance => {
        const instanceDate = parseDateKey(instance.scheduledDate)
        return instanceDate && instanceDate >= startDate && instanceDate <= endDate
      })
    })
  }

  return tasks
}

/**
 * Apply calendar/instance filtering
 */
function applyInstanceFilter(tasks: Task[], filters: FilterOptions): Task[] {
  const { hasInstances, instanceDate } = filters

  if (hasInstances === true) {
    return tasks.filter(task => getTaskInstances(task).length > 0)
  }

  if (hasInstances === false) {
    return tasks.filter(task => getTaskInstances(task).length === 0)
  }

  if (instanceDate) {
    return tasks.filter(task =>
      getTaskInstances(task).some(instance => instance.scheduledDate === instanceDate)
    )
  }

  return tasks
}

/**
 * Apply canvas-specific filtering
 */
function applyCanvasFilter(tasks: Task[], filters: FilterOptions, viewType: ViewType): Task[] {
  const { canvasSectionId, showInInbox, showPositioned } = filters

  // Only apply canvas filters in canvas view
  if (viewType !== 'canvas') {
    return tasks
  }

  return tasks.filter(task => {
    // Filter by canvas section (if specified)
    if (canvasSectionId && task.projectId !== canvasSectionId) {
      return false
    }

    // Filter by inbox status
    if (showInInbox === true && task.isInInbox !== true) {
      return false
    }

    if (showInInbox === false && task.isInInbox === true) {
      return false
    }

    // Filter by positioned status
    if (showPositioned === true && !task.canvasPosition) {
      return false
    }

    if (showPositioned === false && task.canvasPosition) {
      return false
    }

    return true
  })
}

/**
 * Apply text search filtering
 */
function applyTextSearchFilter(tasks: Task[], filters: FilterOptions): Task[] {
  const { searchText } = filters

  if (!searchText || searchText.trim().length === 0) {
    return tasks
  }

  const searchTerms = searchText.toLowerCase().trim().split(/\s+/)

  return tasks.filter(task => {
    const searchableText = [
      task.title,
      task.description,
      task.status,
      task.priority,
      task.projectId
    ].join(' ').toLowerCase()

    return searchTerms.every(term => searchableText.includes(term))
  })
}

/**
 * Apply UI preference filtering
 */
function applyUIPreferenceFilter(tasks: Task[], filters: FilterOptions): Task[] {
  const { hideDoneTasks, includeCompleted } = filters

  if (hideDoneTasks === true) {
    return tasks.filter(task => task.status !== 'done')
  }

  if (includeCompleted === false) {
    return tasks.filter(task => task.status !== 'done')
  }

  return tasks
}

/**
 * Get tasks for specific date (calendar view)
 */
export const getTasksForDate = (tasks: Task[], date: string): Task[] => {
  return filterTasksByView(tasks, 'calendar', { dateFilter: date })
}

/**
 * Get today's tasks
 */
export const getTodayTasks = (tasks: Task[]): Task[] => {
  return filterTasksByView(tasks, 'list', { smartView: 'today' })
}

/**
 * Get inbox tasks
 */
export const getInboxTasks = (tasks: Task[]): Task[] => {
  return filterTasksByView(tasks, 'canvas', { smartView: 'inbox' })
}

/**
 * Filter tasks by project with enhanced options
 */
export const getTasksByProject = (
  tasks: Task[],
  projectId: string | null,
  additionalFilters?: Partial<FilterOptions>
): Task[] => {
  const filters: FilterOptions = {
    projectId,
    ...additionalFilters
  }

  return filterTasksByView(tasks, 'list', filters)
}

/**
 * Performance optimization: Memoized filter for large datasets
 */
const filterCache = new Map<string, Task[]>()

export const filterTasksByViewMemoized = (
  tasks: Task[],
  viewType: ViewType,
  filters: FilterOptions,
  projects?: Project[]
): Task[] => {
  // Create cache key
  const cacheKey = JSON.stringify({
    taskCount: tasks.length,
    viewType,
    filters,
    projectCount: projects?.length || 0
  })

  // Check cache
  if (filterCache.has(cacheKey)) {
    return filterCache.get(cacheKey)!
  }

  // Perform filtering
  const result = filterTasksByView(tasks, viewType, filters, projects)

  // Cache result (limit cache size)
  if (filterCache.size > 100) {
    // Clear oldest entries
    const firstKey = filterCache.keys().next().value
    filterCache.delete(firstKey)
  }

  filterCache.set(cacheKey, result)
  return result
}

/**
 * Clear filter cache (useful when tasks are updated)
 */
export const clearFilterCache = (): void => {
  filterCache.clear()
}