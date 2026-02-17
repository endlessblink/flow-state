/**
 * Smart Group Matcher
 *
 * Provides utilities to match tasks with Smart Groups based on their due dates.
 * Used by "Send to Canvas" feature to auto-place inbox tasks into matching groups.
 *
 * GEOMETRY WRITER SAFETY (TASK-255):
 * - This module only calculates which group a task should go to
 * - Actual geometry writes happen in the calling code (sendToCanvas action)
 * - Safe because: explicit user action, one-time placement, atomic write
 *
 * @see docs/sop/canvas/CANVAS-POSITION-SYSTEM.md
 */

import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import {
  detectPowerKeyword,
  getSmartGroupDate,
  getSmartGroupType,
  SMART_GROUPS,
} from '@/composables/usePowerKeywords'
import { CANVAS } from '@/constants/canvas'

/**
 * Result of group matching with calculated position
 */
export interface GroupMatchResult {
  group: CanvasGroup
  position: { x: number; y: number }
}

/**
 * Format date as YYYY-MM-DD string
 */
function formatDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Get next occurrence of a day of week from today
 * @param dayIndex - 0=Sunday through 6=Saturday
 */
function getNextDayOfWeekDate(dayIndex: number): string {
  const today = new Date()
  const currentDay = today.getDay()
  let daysUntil = dayIndex - currentDay

  // If the day is today or in the past this week, get next week's occurrence
  if (daysUntil <= 0) {
    daysUntil += 7
  }

  const result = new Date(today)
  result.setDate(today.getDate() + daysUntil)
  return formatDateStr(result)
}

/**
 * Check if a task's due date matches a group's power keyword
 *
 * @param taskDueDate - Task's due date in YYYY-MM-DD format
 * @param group - Canvas group to check
 * @returns true if the task's due date matches the group's date criteria
 */
function doesTaskMatchGroup(taskDueDate: string, group: CanvasGroup): boolean {
  const powerKeyword = detectPowerKeyword(group.name)
  if (!powerKeyword) return false

  const taskDateOnly = taskDueDate.split('T')[0] // Handle ISO strings

  // Handle date-based smart groups (today, tomorrow, this week, etc.)
  if (powerKeyword.category === 'date') {
    const smartGroupType = getSmartGroupType(group.name)
    if (!smartGroupType) return false

    const groupDate = getSmartGroupDate(smartGroupType)

    // Special handling for "this week" - task should be within the week
    if (smartGroupType === SMART_GROUPS.THIS_WEEK) {
      const today = new Date()
      const taskDate = new Date(taskDateOnly)
      const endOfWeek = new Date(groupDate)
      return taskDate >= today && taskDate <= endOfWeek
    }

    // Special handling for "this weekend" - Saturday or Sunday
    if (smartGroupType === SMART_GROUPS.THIS_WEEKEND) {
      const taskDate = new Date(taskDateOnly)
      const dayOfWeek = taskDate.getDay()
      return dayOfWeek === 0 || dayOfWeek === 6 // Sunday or Saturday
    }

    // Exact match for today, tomorrow
    return taskDateOnly === groupDate
  }

  // Handle day-of-week groups (Monday, Tuesday, etc.)
  if (powerKeyword.category === 'day_of_week') {
    const dayIndex = parseInt(powerKeyword.value, 10)
    const _nextOccurrence = getNextDayOfWeekDate(dayIndex)

    // Match if task is due on that day of the week (this week or next)
    const taskDate = new Date(taskDateOnly)
    return taskDate.getDay() === dayIndex
  }

  return false
}

/**
 * Find the matching canvas group for a task based on its due date
 *
 * Logic:
 * - No due date → defaults to "Today" group
 * - Due date is today → "Today" group
 * - Due date is tomorrow → "Tomorrow" group
 * - Due date matches a day-of-week group → that group
 * - Due date within this week → "This Week" group
 * - No matching group found → returns null (placed at canvas root)
 *
 * For nested groups (e.g., "Today" inside "This Week"), the innermost match wins.
 *
 * @param dueDate - Task's due date in YYYY-MM-DD or ISO format (or undefined for Today default)
 * @param groups - All canvas groups to search
 * @returns The matching group or null if no match found
 */
export function findMatchingGroupForDueDate(
  dueDate: string | undefined,
  groups: CanvasGroup[]
): CanvasGroup | null {
  // Default to today's date if no due date specified
  const effectiveDate = dueDate || formatDateStr(new Date())

  // Filter to only visible groups with power keywords
  const powerGroups = groups.filter(g => {
    const pk = detectPowerKeyword(g.name)
    return pk && (pk.category === 'date' || pk.category === 'day_of_week') && g.isVisible
  })

  if (powerGroups.length === 0) return null

  // Sort by specificity - prefer more specific matches
  // Today/Tomorrow/day-of-week are more specific than "This Week"
  const sortedGroups = [...powerGroups].sort((a, b) => {
    const pkA = detectPowerKeyword(a.name)!
    const pkB = detectPowerKeyword(b.name)!

    // Day-of-week and today/tomorrow are most specific
    const specificKeywords = ['today', 'tomorrow']
    const aIsSpecific = specificKeywords.includes(pkA.keyword) || pkA.category === 'day_of_week'
    const bIsSpecific = specificKeywords.includes(pkB.keyword) || pkB.category === 'day_of_week'

    if (aIsSpecific && !bIsSpecific) return -1
    if (!aIsSpecific && bIsSpecific) return 1

    // Among similar specificity, prefer nested (child) groups
    // A child group has a parentGroupId pointing to another group
    if (a.parentGroupId && !b.parentGroupId) return -1
    if (!a.parentGroupId && b.parentGroupId) return 1

    return 0
  })

  // Find first matching group
  for (const group of sortedGroups) {
    if (doesTaskMatchGroup(effectiveDate, group)) {
      return group
    }
  }

  return null
}

/**
 * Calculate position for a new task inside a group
 *
 * Positions the task inside the group bounds, avoiding overlap with existing tasks
 * when possible. Falls back to center of group if overlap is unavoidable.
 *
 * @param group - Target group to place task in
 * @param existingTasks - Tasks currently in this group (for collision avoidance)
 * @returns Absolute position { x, y } for the task's canvasPosition
 */
export function calculatePositionInGroup(
  group: CanvasGroup,
  existingTasks: Task[]
): { x: number; y: number } {
  const groupX = group.position?.x || 0
  const groupY = group.position?.y || 0
  const groupWidth = group.position?.width || CANVAS.DEFAULT_GROUP_WIDTH
  const groupHeight = group.position?.height || CANVAS.DEFAULT_GROUP_HEIGHT

  const taskWidth = CANVAS.DEFAULT_TASK_WIDTH
  const taskHeight = CANVAS.DEFAULT_TASK_HEIGHT
  const padding = 20
  const headerHeight = 50 // Group header space

  // Available space inside the group
  const availableX = groupX + padding
  const availableY = groupY + headerHeight + padding
  const maxX = groupX + groupWidth - taskWidth - padding
  const maxY = groupY + groupHeight - taskHeight - padding

  // Filter to tasks actually in this group
  const tasksInGroup = existingTasks.filter(t => t.parentId === group.id && t.canvasPosition)

  // If no existing tasks, place near top-left
  if (tasksInGroup.length === 0) {
    return {
      x: Math.max(availableX, Math.min(availableX + 20, maxX)),
      y: Math.max(availableY, Math.min(availableY + 20, maxY))
    }
  }

  // Find lowest Y position of existing tasks to stack below them
  let lowestY = availableY
  for (const task of tasksInGroup) {
    if (task.canvasPosition) {
      const taskBottom = task.canvasPosition.y + taskHeight + 10 // 10px gap
      if (taskBottom > lowestY) {
        lowestY = taskBottom
      }
    }
  }

  // If there's room below existing tasks, place there
  if (lowestY + taskHeight <= maxY + padding) {
    return {
      x: Math.max(availableX, Math.min(availableX + 20, maxX)),
      y: lowestY
    }
  }

  // Fallback: center of group (may overlap, but user can adjust)
  return {
    x: groupX + (groupWidth / 2) - (taskWidth / 2),
    y: groupY + (groupHeight / 2) - (taskHeight / 2)
  }
}

/**
 * Get a user-friendly label for where the task will be placed
 * Used for toast notifications and UI feedback
 */
export function getPlacementLabel(
  dueDate: string | undefined,
  groups: CanvasGroup[]
): string {
  const matchingGroup = findMatchingGroupForDueDate(dueDate, groups)

  if (matchingGroup) {
    return matchingGroup.name
  }

  return 'Canvas (root)'
}
