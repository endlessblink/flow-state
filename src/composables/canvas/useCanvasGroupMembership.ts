/**
 * useCanvasGroupMembership
 *
 * TASK-106: Provides helpers for determining which canvas group a task belongs to.
 * Used by CalendarInboxPanel to filter tasks by canvas group.
 *
 * Note: Tasks are associated with groups through visual containment (position-based),
 * not through explicit groupId fields.
 *
 * TASK-144: Now uses shared geometry utilities from @/utils/geometry.ts
 */

import { computed } from 'vue'
import { useCanvasStore, type CanvasGroup } from '@/stores/canvas'
import { useTaskStore, type Task } from '@/stores/tasks'
import { findSmallestContainingRect, type Rect } from '@/utils/canvas/positionCalculator'

export function useCanvasGroupMembership() {
  const canvasStore = useCanvasStore()
  const taskStore = useTaskStore()

  // Local helper to replace the removed utility
  const getGroupAbsolutePosition = (groupId: string, groups: CanvasGroup[]) => {
    let x = 0
    let y = 0
    let currentId: string | null = groupId

    // Safety break to prevent infinite loops
    let depth = 0
    while (currentId && depth < 50) {
      const group = groups.find(g => g.id === currentId)
      if (!group) break

      x += group.position.x
      y += group.position.y
      currentId = group.parentGroupId || null
      depth++
    }
    return { x, y }
  }

  /**
   * Get the canvas group ID that contains a task.
   * Returns the smallest (most specific) containing group if nested.
   * Returns null if task has no canvas position or isn't in any group.
   */
  const getTaskGroupId = (task: Task): string | null => {
    if (!task.canvasPosition) return null

    const { x, y } = task.canvasPosition

    // Convert groups to Rect format using ABSOLUTE positions (fixing nested group detection)
    const groupsRaw = canvasStore.groups
    const groupRects = groupsRaw.map(group => {
      const absPos = getGroupAbsolutePosition(group.id, groupsRaw)
      return {
        ...group,
        x: absPos.x,
        y: absPos.y,
        width: group.position.width,
        height: group.position.height
      }
    })

    const containingGroup = findSmallestContainingRect(x, y, groupRects)
    return containingGroup?.id || null
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
