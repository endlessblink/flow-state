import { computed } from 'vue'
import type { Task } from '@/stores/tasks'

/**
 * Composable for consistent uncategorized task detection and filtering
 * across all views and components.
 */
export function useUncategorizedTasks() {

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
    if (!task.projectId || task.projectId === '' || task.projectId === null || task.projectId === '1') {
      return true
    }

    return false
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
    return activeSmartView === 'uncategorized'
  }

  /**
   * Filters tasks for regular views (Board, Calendar, Canvas, AllTasks)
   * Excludes uncategorized tasks unless My Tasks smart filter is active
   * @param tasks Array of tasks to filter
   * @param activeSmartView Current smart filter state
   * @returns Filtered tasks array
   */
  function filterTasksForRegularViews(tasks: Task[], activeSmartView: 'today' | 'week' | 'uncategorized' | null): Task[] {
    if (shouldShowUncategorizedInViews(activeSmartView)) {
      return tasks // Include all tasks when My Tasks filter is active
    }

    // Exclude uncategorized tasks from regular views
    return tasks.filter(task => !isTaskUncategorized(task))
  }

  return {
    isTaskUncategorized,
    getUncategorizedTasks,
    filterTasksBySmartView,
    shouldShowUncategorizedInViews,
    filterTasksForRegularViews
  }
}