/**
 * Smart Group Utilities
 *
 * Provides centralized logic for handling smart groups like "Today", "Tomorrow", etc.
 * Ensures consistent behavior across Canvas, Kanban, and Calendar views.
 */

import type { Task } from '@/types/tasks'

/**
 * Smart group definitions
 */
export const SMART_GROUPS = {
  TODAY: 'today',
  TOMORROW: 'tomorrow',
  THIS_WEEKEND: 'this weekend',
  THIS_WEEK: 'this week',
  LATER: 'later'
} as const

export type SmartGroupType = typeof SMART_GROUPS[keyof typeof SMART_GROUPS]

/**
 * Check if a column/group name is a smart group
 */
export function isSmartGroup(groupName: string): boolean {
  const normalizedName = groupName.toLowerCase().trim()
  return Object.values(SMART_GROUPS).some(smartGroup =>
    normalizedName.includes(smartGroup) || normalizedName === smartGroup
  )
}

/**
 * Get the smart group type from a group name
 */
export function getSmartGroupType(groupName: string): SmartGroupType | null {
  const normalizedName = groupName.toLowerCase().trim()

  if (normalizedName.includes('today') || normalizedName === SMART_GROUPS.TODAY) {
    return SMART_GROUPS.TODAY
  }
  if (normalizedName.includes('tomorrow') || normalizedName === SMART_GROUPS.TOMORROW) {
    return SMART_GROUPS.TOMORROW
  }
  if (normalizedName.includes('weekend') || normalizedName === SMART_GROUPS.THIS_WEEKEND) {
    return SMART_GROUPS.THIS_WEEKEND
  }
  if (normalizedName.includes('this week') || normalizedName === SMART_GROUPS.THIS_WEEK) {
    return SMART_GROUPS.THIS_WEEK
  }
  if (normalizedName.includes('later') || normalizedName === SMART_GROUPS.LATER) {
    return SMART_GROUPS.LATER
  }

  return null
}

/**
 * Get date for a smart group (returns YYYY-MM-DD format)
 */
export function getSmartGroupDate(smartGroupType: SmartGroupType): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  switch (smartGroupType) {
    case SMART_GROUPS.TODAY:
      return `${year}-${month}-${day}`

    case SMART_GROUPS.TOMORROW:
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

    case SMART_GROUPS.THIS_WEEKEND:
      // Get next Saturday
      const saturday = new Date(today)
      const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7
      saturday.setDate(today.getDate() + daysUntilSaturday)
      return `${saturday.getFullYear()}-${String(saturday.getMonth() + 1).padStart(2, '0')}-${String(saturday.getDate()).padStart(2, '0')}`

    case SMART_GROUPS.THIS_WEEK:
      // Get end of current week (Sunday)
      const sunday = new Date(today)
      const daysUntilSunday = (7 - today.getDay()) % 7 || 7
      sunday.setDate(today.getDate() + daysUntilSunday)
      return `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`

    case SMART_GROUPS.LATER:
      // For "later", return empty string (no specific date)
      return ''

    default:
      return `${year}-${month}-${day}`
  }
}

/**
 * Apply smart group properties to a task
 * This sets the dueDate but keeps the task in inbox for manual scheduling
 */
export function applySmartGroupProperties(task: Task, smartGroupType: SmartGroupType): Partial<Task> {
  const updates: Partial<Task> = {}

  // Set due date for the smart group
  const dueDate = getSmartGroupDate(smartGroupType)
  if (dueDate) {
    updates.dueDate = dueDate
  }

  // Keep task in inbox by ensuring isInInbox is not set to false
  // Don't modify instances - let user schedule manually

  console.log(`[Smart Groups] Applied ${smartGroupType} properties to task "${task.title}":`, {
    dueDate: updates.dueDate,
    staysInInbox: true
  })

  return updates
}

/**
 * Check if moving a task to a column should use smart group logic vs scheduling logic
 */
export function shouldUseSmartGroupLogic(columnKey: string, columnTitle?: string): boolean {
  const identifier = columnTitle || columnKey
  return isSmartGroup(identifier)
}