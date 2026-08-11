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
import { formatDateKey } from '@/utils/dateUtils'
import { getDayGroupDate, toDateString } from '@/utils/dayGroupDate'

/**
 * Result of group matching with calculated position
 */
export interface GroupMatchResult {
  group: CanvasGroup
  position: { x: number; y: number }
}

/**
 * Get next occurrence of a day of week from today
 * @param dayIndex - 0=Sunday through 6=Saturday
 */


/**
 * Check if a task's due date matches a group's power keyword
 *
 * @param taskDueDate - Task's due date in YYYY-MM-DD format
 * @param group - Canvas group to check
 * @returns true if the task's due date matches the group's date criteria
 */
function doesTaskMatchGroup(
  taskDueDate: string,
  group: CanvasGroup,
  allGroups: CanvasGroup[] = []
): boolean {
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
  //
  // TASK-1756 v7: match on EXACT target date (computed via the shared
  // `getDayGroupDate` helper), not just weekday. Otherwise a task due
  // 19.5.26 (Tuesday next month) would "match" the Tuesday group that
  // actually targets 21.4.26 (this week's Tuesday), so BUG-1757's
  // drop-to-inbox check skips and the task sits inside a group whose
  // header date is wrong for it.
  if (powerKeyword.category === 'day_of_week') {
    const dayIndex = parseInt(powerKeyword.value, 10)
    if (isNaN(dayIndex) || dayIndex < 0 || dayIndex > 6) return false

    const hasTodayOrTomorrow = allGroups.some((g) => {
      const kw = detectPowerKeyword(g.name)
      return kw?.category === 'date' && (kw.keyword === 'today' || kw.keyword === 'tomorrow')
    })
    const groupTargetDate = toDateString(getDayGroupDate(dayIndex, new Date(), hasTodayOrTomorrow))
    return taskDateOnly === groupTargetDate
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
  const effectiveDate = dueDate || formatDateKey(new Date())

  // Filter to only visible groups with power keywords
  const powerGroups = groups.filter(g => {
    const pk = detectPowerKeyword(g.name)
    return pk && (pk.category === 'date' || pk.category === 'day_of_week') && g.isVisible
  })

  if (powerGroups.length === 0) return null

  // Sort by specificity - prefer more specific matches
  // "Today"/"Tomorrow" keywords beat day-of-week which beats "This Week"
  const sortedGroups = [...powerGroups].sort((a, b) => {
    const pkA = detectPowerKeyword(a.name)!
    const pkB = detectPowerKeyword(b.name)!

    // Tier 1: "today"/"tomorrow" are the most specific
    const todayTomorrowKeywords = ['today', 'tomorrow']
    const aIsTodayTomorrow = todayTomorrowKeywords.includes(pkA.keyword)
    const bIsTodayTomorrow = todayTomorrowKeywords.includes(pkB.keyword)

    if (aIsTodayTomorrow && !bIsTodayTomorrow) return -1
    if (!aIsTodayTomorrow && bIsTodayTomorrow) return 1

    // Tier 2: day-of-week groups are next
    const aIsDayOfWeek = pkA.category === 'day_of_week'
    const bIsDayOfWeek = pkB.category === 'day_of_week'

    if (aIsDayOfWeek && !bIsDayOfWeek) return -1
    if (!aIsDayOfWeek && bIsDayOfWeek) return 1

    // Among similar specificity, prefer nested (child) groups
    // A child group has a parentGroupId pointing to another group
    if (a.parentGroupId && !b.parentGroupId) return -1
    if (!a.parentGroupId && b.parentGroupId) return 1

    return 0
  })

  // Find first matching group
  for (const group of sortedGroups) {
    if (doesTaskMatchGroup(effectiveDate, group, groups)) {
      return group
    }
  }

  return null
}

/**
 * Calculate position for a new task inside a group
 *
 * Positions the task inside the group bounds, left-aligned at the group's
 * padding edge and stacked vertically below any existing siblings. When the
 * group's visible area is full, continues stacking below (overflow) rather
 * than centering on top of existing tasks.
 *
 * BUG-1773: Removed the +20 visual nudge (not left-aligned) and the
 * geometric-center fallback (overlap source). Added optional
 * `alreadyPlacedPositions` so batch callers can track siblings being placed
 * in the same synchronous loop, immune to reactivity/sync-flush timing.
 *
 * @param group - Target group to place task in
 * @param existingTasks - Tasks currently in this group (for collision avoidance)
 * @param alreadyPlacedPositions - Absolute positions of tasks already placed
 *                                 in this batch but not yet visible via the
 *                                 store filter. Merged into stacking math.
 * @returns Absolute position { x, y } for the task's canvasPosition
 */
export function calculatePositionInGroup(
  group: CanvasGroup,
  existingTasks: Task[],
  alreadyPlacedPositions: Array<{ x: number; y: number }> = []
): { x: number; y: number } {
  const groupX = group.position?.x || 0
  const groupY = group.position?.y || 0
  const groupWidth = group.position?.width || CANVAS.DEFAULT_GROUP_WIDTH

  const taskWidth = CANVAS.DEFAULT_TASK_WIDTH
  const taskHeight = CANVAS.DEFAULT_TASK_HEIGHT
  const padding = 20
  const headerHeight = 50 // Group header space
  const gap = 10

  // Available space inside the group — true left-align at padding edge
  const availableX = groupX + padding
  const availableY = groupY + headerHeight + padding
  const maxX = groupX + groupWidth - taskWidth - padding
  const stackX = Math.max(availableX, Math.min(availableX, maxX))

  // Collect Y-tops from the store AND from in-flight batch placements
  const storePositions = existingTasks
    .filter(t => t.parentId === group.id && t.canvasPosition)
    .map(t => t.canvasPosition!)

  const allPositions = [...storePositions, ...alreadyPlacedPositions]

  if (allPositions.length === 0) {
    return { x: stackX, y: availableY }
  }

  // Stack directly below the lowest sibling (or in-flight placement) with a gap
  let lowestBottom = availableY
  for (const pos of allPositions) {
    const bottom = pos.y + taskHeight + gap
    if (bottom > lowestBottom) lowestBottom = bottom
  }

  return { x: stackX, y: lowestBottom }
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
