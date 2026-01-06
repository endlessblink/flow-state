/**
 * useCanvasGroupMembership
 *
 * TASK-106: Provides helpers for determining which canvas group a task belongs to.
 * Used by CalendarInboxPanel to filter tasks by canvas group.
 *
 * Note: Tasks are associated with groups through visual containment (position-based),
 * not through explicit groupId fields.
 */

import { computed } from 'vue'
import { useCanvasStore, type CanvasGroup } from '@/stores/canvas'
import { useTaskStore, type Task } from '@/stores/tasks'

export function useCanvasGroupMembership() {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()

  /**
   * Check if a point is inside a rectangle
   */
  const isPointInRect = (
    x: number,
    y: number,
    rect: { x: number; y: number; width: number; height: number }
  ): boolean => {
    return x >= rect.x && x <= rect.x + rect.width &&
           y >= rect.y && y <= rect.y + rect.height
  }

  /**
   * Get the canvas group ID that contains a task.
   * Returns the smallest (most specific) containing group if nested.
   * Returns null if task has no canvas position or isn't in any group.
   */
  const getTaskGroupId = (task: Task): string | null => {
    if (!task.canvasPosition) return null

    const { x, y } = task.canvasPosition

    // Find the smallest containing group (most specific)
    let bestMatch: CanvasGroup | null = null
    let bestArea = Infinity

    for (const group of canvasStore.groups) {
      const { x: gx, y: gy, width, height } = group.position
      if (isPointInRect(x, y, { x: gx, y: gy, width, height })) {
        const area = width * height
        if (area < bestArea) {
          bestArea = area
          bestMatch = group
        }
      }
    }

    return bestMatch?.id || null
  }

  /**
   * Get all tasks that belong to a specific canvas group
   */
  const getTasksInGroup = (groupId: string): Task[] => {
    return taskStore.filteredTasks.filter(task => getTaskGroupId(task) === groupId)
  }

  /**
   * Get count of tasks in a specific group
   */
  const getGroupTaskCount = (groupId: string): number => {
    return getTasksInGroup(groupId).length
  }

  /**
   * Computed list of groups with their task counts, sorted by name
   * Used for dropdown options in CalendarInboxPanel
   */
  const groupsWithCounts = computed(() => {
    return canvasStore.groups
      .map(group => ({
        id: group.id,
        name: group.name,
        color: group.color,
        type: group.type,
        taskCount: getGroupTaskCount(group.id)
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  /**
   * Filter tasks to only those in a specific group (or all if groupId is null)
   */
  const filterTasksByGroup = (tasks: Task[], groupId: string | null): Task[] => {
    if (!groupId) return tasks
    return tasks.filter(task => getTaskGroupId(task) === groupId)
  }

  return {
    getTaskGroupId,
    getTasksInGroup,
    getGroupTaskCount,
    groupsWithCounts,
    filterTasksByGroup
  }
}
