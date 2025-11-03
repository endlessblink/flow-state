/**
 * SERVICE-ORCHESTRATOR-BASED TASK FILTERING UTILITIES
 *
 * Enhanced filtering utilities that work with ServiceOrchestrator.
 * Provides consistent filtering logic across all components.
 */

import type { Task } from '@/types/task'

/**
 * Interface for task store operations needed by filtering functions
 * This allows dependency injection of either raw store or ServiceOrchestrator
 */
export interface TaskStoreAdapter {
  getDefaultProjectId(): string
  getChildProjectIds?(projectId: string): string[]
}

/**
 * Filter tasks that should appear in Quick Sort (uncategorized tasks)
 * This function provides consistent filtering logic across the application
 * Works with both raw task store and ServiceOrchestrator
 */
export function getUncategorizedTasks(
  tasks: Task[],
  storeAdapter: TaskStoreAdapter
): Task[] {
  // Filter out problematic test tasks to prevent them from appearing in Quick Sort
  const problematicTaskTitles = ['Test 123', 'Review test case doc']

  return tasks.filter(
    (task) =>
      // Only include active, non-completed tasks
      task.status !== 'done' &&
      // Exclude problematic test tasks that keep reappearing
      !problematicTaskTitles.includes(task.title.trim()) &&
      (
        !task.projectId ||
        task.projectId === '' ||
        task.projectId === null ||
        task.projectId === '1' || // Legacy tasks with hardcoded '1' (My Tasks)
        task.projectId === 'personal-uncategorized' || // Default uncategorized project
        task.projectId === storeAdapter.getDefaultProjectId() // Use proper default project detection
      )
  )
}

/**
 * Count uncategorized tasks using the same logic as getUncategorizedTasks
 * This ensures badge counts are consistent with Quick Sort display
 */
export function getUncategorizedTaskCount(
  tasks: Task[],
  storeAdapter: TaskStoreAdapter
): number {
  return getUncategorizedTasks(tasks, storeAdapter).length
}

/**
 * Check if a task should appear in Quick Sort
 */
export function isTaskUncategorized(
  task: Task,
  storeAdapter: TaskStoreAdapter
): boolean {
  const problematicTaskTitles = ['Test 123', 'Review test case doc']

  // Don't include completed tasks
  if (task.status === 'done') return false

  // Exclude problematic test tasks
  if (problematicTaskTitles.includes(task.title.trim())) return false

  // Check if task is uncategorized
  return (
    !task.projectId ||
    task.projectId === '' ||
    task.projectId === null ||
    task.projectId === '1' || // Legacy tasks with hardcoded '1' (My Tasks)
    task.projectId === 'personal-uncategorized' || // Default uncategorized project
    task.projectId === storeAdapter.getDefaultProjectId() // Use proper default project detection
  )
}

/**
 * ServiceOrchestrator-specific filtering functions
 * These functions accept a ServiceOrchestrator instance
 */

export async function getUncategorizedTasksFromService(serviceOrchestrator: any): Promise<Task[]> {
  const allTasks = serviceOrchestrator.getAllTasks()
  const storeAdapter = createServiceOrchestratorAdapter(serviceOrchestrator)

  return getUncategorizedTasks(allTasks, storeAdapter)
}

export async function getUncategorizedTaskCountFromService(serviceOrchestrator: any): Promise<number> {
  const allTasks = serviceOrchestrator.getAllTasks()
  const storeAdapter = createServiceOrchestratorAdapter(serviceOrchestrator)

  return getUncategorizedTaskCount(allTasks, storeAdapter)
}

/**
 * Create a TaskStoreAdapter from ServiceOrchestrator
 */
export function createServiceOrchestratorAdapter(serviceOrchestrator: any): TaskStoreAdapter {
  return {
    getDefaultProjectId() {
      const stores = serviceOrchestrator.getStores()
      return stores.taskStore.getDefaultProjectId()
    },
    getChildProjectIds(projectId: string) {
      const stores = serviceOrchestrator.getStores()
      return stores.taskStore.getChildProjectIds?.(projectId) || []
    }
  }
}

/**
 * Create a TaskStoreAdapter from raw task store (for backward compatibility)
 */
export function createTaskStoreAdapter(taskStore: any): TaskStoreAdapter {
  return {
    getDefaultProjectId() {
      return taskStore.getDefaultProjectId()
    },
    getChildProjectIds(projectId: string) {
      return taskStore.getChildProjectIds?.(projectId) || []
    }
  }
}

/**
 * Advanced filtering with project hierarchy support
 */
export function getFilteredTasksWithHierarchy(
  tasks: Task[],
  options: {
    projectId?: string | null
    includeChildProjects?: boolean
    hideDoneTasks?: boolean
    statusFilter?: string[]
  },
  storeAdapter: TaskStoreAdapter
): Task[] {
  let filteredTasks = [...tasks]

  // Filter by project (including child projects if requested)
  if (options.projectId !== undefined) {
    if (options.includeChildProjects && storeAdapter.getChildProjectIds) {
      const childProjectIds = storeAdapter.getChildProjectIds(options.projectId || '')
      const relatedProjectIds = [options.projectId, ...childProjectIds].filter(Boolean)
      filteredTasks = filteredTasks.filter(task =>
        relatedProjectIds.includes(task.projectId || '')
      )
    } else {
      filteredTasks = filteredTasks.filter(task =>
        task.projectId === options.projectId
      )
    }
  }

  // Filter out done tasks if requested
  if (options.hideDoneTasks) {
    filteredTasks = filteredTasks.filter(task => task.status !== 'done')
  }

  // Filter by status if specified
  if (options.statusFilter && options.statusFilter.length > 0) {
    filteredTasks = filteredTasks.filter(task =>
      options.statusFilter!.includes(task.status)
    )
  }

  return filteredTasks
}

/**
 * Smart filtering for Today, Weekend, etc.
 */
export function getSmartViewTasks(
  tasks: Task[],
  smartView: 'today' | 'weekend' | 'uncategorized' | 'overdue',
  storeAdapter: TaskStoreAdapter
): Task[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayEnd = new Date(today)
  todayEnd.setHours(23, 59, 59, 999)

  const weekendStart = new Date(today)
  weekendStart.setDate(today.getDate() + (6 - today.getDay()) % 7) // Next Saturday
  weekendStart.setHours(0, 0, 0, 0)

  const weekendEnd = new Date(weekendStart)
  weekendEnd.setDate(weekendStart.getDate() + 1) // Sunday
  weekendEnd.setHours(23, 59, 59, 999)

  switch (smartView) {
    case 'today':
      return tasks.filter(task => {
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate)
          return dueDate >= today && dueDate <= todayEnd
        }
        return false
      })

    case 'weekend':
      return tasks.filter(task => {
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate)
          return dueDate >= weekendStart && dueDate <= weekendEnd
        }
        return false
      })

    case 'uncategorized':
      return getUncategorizedTasks(tasks, storeAdapter)

    case 'overdue':
      return tasks.filter(task => {
        if (task.dueDate && task.status !== 'done') {
          const dueDate = new Date(task.dueDate)
          dueDate.setHours(23, 59, 59, 999)
          return dueDate < today
        }
        return false
      })

    default:
      return tasks
  }
}

/**
 * Performance-optimized filtering for large task sets
 */
export function getFilteredTasksOptimized(
  tasks: Task[],
  filterOptions: {
    query?: string
    projectId?: string | null
    statusFilter?: string[]
    priorityFilter?: string[]
    hideDone?: boolean
    smartView?: string
  },
  storeAdapter: TaskStoreAdapter
): Task[] {
  // Early return if no filters
  if (!filterOptions.query &&
      !filterOptions.projectId &&
      !filterOptions.statusFilter?.length &&
      !filterOptions.priorityFilter?.length &&
      !filterOptions.hideDone &&
      !filterOptions.smartView) {
    return tasks
  }

  // Apply filters in order of selectivity (most restrictive first)
  let result = tasks

  // Smart view filtering (most restrictive)
  if (filterOptions.smartView) {
    result = getSmartViewTasks(result, filterOptions.smartView as any, storeAdapter)
  }

  // Project filtering
  if (filterOptions.projectId !== undefined) {
    result = result.filter(task => task.projectId === filterOptions.projectId)
  }

  // Status filtering
  if (filterOptions.statusFilter?.length) {
    result = result.filter(task => filterOptions.statusFilter!.includes(task.status))
  }

  // Priority filtering
  if (filterOptions.priorityFilter?.length) {
    result = result.filter(task =>
      task.priority && filterOptions.priorityFilter!.includes(task.priority)
    )
  }

  // Hide done tasks
  if (filterOptions.hideDone) {
    result = result.filter(task => task.status !== 'done')
  }

  // Text search (last, as it's the most expensive)
  if (filterOptions.query) {
    const query = filterOptions.query.toLowerCase()
    result = result.filter(task =>
      task.title.toLowerCase().includes(query) ||
      task.description.toLowerCase().includes(query)
    )
  }

  return result
}