import { computed } from 'vue'
import type { Task, Project } from '@/stores/tasks'

// Constants for consistent project handling
export const DEFAULT_PROJECT_ID = '1'
export const UNCATEGORIZED_PROJECT_NAME = 'Unknown Project'

/**
 * Type definitions for project-related operations
 */
export interface ProjectAssociation {
  projectId: string | null
  projectName: string
  isUncategorized: boolean
  isValid: boolean
}

export interface ProjectStats {
  totalTasks: number
  uncategorizedTasks: number
  categorizedTasks: number
  percentageUncategorized: number
}

/**
 * Composable for consistent uncategorized task detection and filtering
 * across all views and components.
 */
export function useUncategorizedTasks() {

  /**
   * Normalizes project ID to standard format
   * @param projectId Raw project ID from task
   * @returns Normalized project ID or null
   */
  function normalizeProjectId(projectId: string | null | undefined): string | null {
    if (!projectId || projectId === '' || projectId === null || projectId === DEFAULT_PROJECT_ID) {
      return null
    }
    return projectId
  }

  /**
   * Determines if a task is uncategorized based on multiple criteria
   * @param task The task to check
   * @returns true if the task should be considered uncategorized
   */
  function isTaskUncategorized(task: Task): boolean {
    // Primary check: explicit uncategorized flag
    if (task.isUncategorized === true) {
      return true
    }

    // Backward compatibility: tasks without proper project assignment
    const normalizedProjectId = normalizeProjectId(task.projectId)
    return normalizedProjectId === null
  }

  /**
   * Gets comprehensive project association information for a task
   * @param task The task to analyze
   * @param projects Array of available projects
   * @returns Project association details
   */
  function getProjectAssociation(task: Task, projects: Project[]): ProjectAssociation {
    const normalizedProjectId = normalizeProjectId(task.projectId)
    const isUncategorized = isTaskUncategorized(task)

    // Find project if it exists
    const project = normalizedProjectId ? projects.find(p => p.id === normalizedProjectId) : null

    return {
      projectId: normalizedProjectId,
      projectName: project?.name || UNCATEGORIZED_PROJECT_NAME,
      isUncategorized,
      isValid: !!project
    }
  }

  /**
   * Calculates project statistics for a given set of tasks
   * @param tasks Array of tasks to analyze
   * @returns Project statistics
   */
  function calculateProjectStats(tasks: Task[]): ProjectStats {
    const totalTasks = tasks.length
    const uncategorizedTasks = tasks.filter(isTaskUncategorized).length
    const categorizedTasks = totalTasks - uncategorizedTasks

    return {
      totalTasks,
      uncategorizedTasks,
      categorizedTasks,
      percentageUncategorized: totalTasks > 0 ? (uncategorizedTasks / totalTasks) * 100 : 0
    }
  }

  /**
   * Validates project ID format
   * @param projectId Project ID to validate
   * @returns true if ID format is valid
   */
  function isValidProjectId(projectId: string): boolean {
    // Check for empty or null values
    if (!projectId || projectId === '' || projectId === null) {
      return false
    }

    // Check for default project ID
    if (projectId === DEFAULT_PROJECT_ID) {
      return false
    }

    // Check for UUID format (basic validation)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(projectId)
  }

  /**
   * Filters an array of tasks to return only uncategorized tasks
   * @param tasks Array of tasks to filter
   * @returns Array of uncategorized tasks
   */
  function getUncategorizedTasks(tasks: Task[]): Task[] {
    return tasks.filter(task => isTaskUncategorized(task))
  }

  /**
   * Filters tasks based on smart filter state
   * @param tasks Array of tasks to filter
   * @param activeSmartView Current smart filter state
   * @returns Filtered tasks array
   */
  function filterTasksBySmartView(tasks: Task[], activeSmartView: 'today' | 'week' | 'uncategorized' | null): Task[] {
    if (activeSmartView === 'uncategorized') {
      return getUncategorizedTasks(tasks)
    }

    // For other smart views or no filter, return tasks as-is (let other filters handle them)
    return tasks
  }

  /**
   * Determines if uncategorized tasks should be visible in regular views
   * @param activeSmartView Current smart filter state
   * @returns true if uncategorized tasks should be included in regular views
   */
  function shouldShowUncategorizedInViews(activeSmartView: 'today' | 'week' | 'uncategorized' | null): boolean {
    // When My Tasks is selected, show only uncategorized tasks
    // For other views, include uncategorized tasks with all other tasks
    return activeSmartView === 'uncategorized' || activeSmartView === null
  }

  /**
   * Filters tasks for regular views (Board, Calendar, Canvas, AllTasks)
   * Respects smart view filtering while including unknown project tasks
   * @param tasks Array of tasks to filter
   * @param activeSmartView Current smart filter state
   * @returns Filtered tasks array
   */
  function filterTasksForRegularViews(tasks: Task[], activeSmartView: 'today' | 'week' | 'uncategorized' | null): Task[] {
    // When My Tasks smart view is active, show only uncategorized/unknown tasks
    if (activeSmartView === 'uncategorized') {
      return getUncategorizedTasks(tasks)
    }

    // For regular views (no smart filter or other smart filters), include all tasks
    // This ensures unknown project tasks are always visible in regular views
    return tasks
  }

  return {
    // Constants
    DEFAULT_PROJECT_ID,
    UNCATEGORIZED_PROJECT_NAME,

    // Core functions
    isTaskUncategorized,
    getUncategorizedTasks,
    filterTasksBySmartView,
    shouldShowUncategorizedInViews,
    filterTasksForRegularViews,

    // Enhanced Phase 2 functions
    normalizeProjectId,
    getProjectAssociation,
    calculateProjectStats,
    isValidProjectId
  }
}