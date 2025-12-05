/**
 * Smart Group Utilities
 *
 * Provides centralized logic for handling smart groups like "Today", "Tomorrow", etc.
 * Ensures consistent behavior across Canvas, Kanban, and Calendar views.
 *
 * POWER GROUPS:
 * Groups with special keywords in their name automatically become "power groups"
 * which can auto-assign properties to dropped tasks and collect matching tasks.
 */

import type { Task } from '@/stores/taskCore'

/**
 * Smart group definitions (date-based)
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
 * Power keyword categories
 */
export type PowerKeywordCategory = 'date' | 'priority' | 'status'

/**
 * Priority keywords
 */
export const PRIORITY_KEYWORDS = {
  HIGH: ['high priority', 'urgent', 'critical', 'important'],
  MEDIUM: ['medium priority', 'normal priority'],
  LOW: ['low priority']
} as const

/**
 * Status keywords
 */
export const STATUS_KEYWORDS = {
  DONE: ['done', 'completed', 'finished'],
  IN_PROGRESS: ['in progress', 'working', 'active'],
  BACKLOG: ['backlog', 'later'],
  PLANNED: ['planned', 'todo', 'to do']
} as const

/**
 * Result of power keyword detection
 */
export interface PowerKeywordResult {
  keyword: string
  category: PowerKeywordCategory
  value: string
  displayName: string
}

/**
 * Detect power keyword in a group name
 * Returns the detected keyword info or null if no power keyword found
 */
export function detectPowerKeyword(groupName: string): PowerKeywordResult | null {
  const normalizedName = groupName.toLowerCase().trim()

  // Check date keywords first (smart groups)
  for (const [key, value] of Object.entries(SMART_GROUPS)) {
    if (normalizedName.includes(value) || normalizedName === value) {
      return {
        keyword: value,
        category: 'date',
        value: value,
        displayName: key.replace(/_/g, ' ').toLowerCase()
          .split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      }
    }
  }

  // Check priority keywords
  for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword)) {
        return {
          keyword,
          category: 'priority',
          value: priority.toLowerCase() as 'high' | 'medium' | 'low',
          displayName: `${priority.charAt(0) + priority.slice(1).toLowerCase()} Priority`
        }
      }
    }
  }

  // Check status keywords
  for (const [status, keywords] of Object.entries(STATUS_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedName.includes(keyword)) {
        return {
          keyword,
          category: 'status',
          value: status.toLowerCase().replace(/_/g, '_') as Task['status'],
          displayName: status.replace(/_/g, ' ').toLowerCase()
            .split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
        }
      }
    }
  }

  return null
}

/**
 * Check if a group name contains any power keyword
 */
export function isPowerGroup(groupName: string): boolean {
  return detectPowerKeyword(groupName) !== null
}

/**
 * Get all power keywords for display/documentation
 */
export function getAllPowerKeywords(): { category: PowerKeywordCategory; keywords: string[] }[] {
  return [
    {
      category: 'date',
      keywords: Object.values(SMART_GROUPS)
    },
    {
      category: 'priority',
      keywords: Object.values(PRIORITY_KEYWORDS).flat()
    },
    {
      category: 'status',
      keywords: Object.values(STATUS_KEYWORDS).flat()
    }
  ]
}

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