/**
 * TASK-1756: Shared date math for canvas day-of-week groups.
 *
 * Both the group header suffix (GroupNodeSimple.vue) and the midnight
 * rotation (useDayGroupRotation.ts) must resolve the same date for a given
 * weekday — otherwise the visible label and the task dueDate disagree.
 *
 * Rules:
 *   - If today IS the target weekday and no Today/Tomorrow smart-group
 *     covers today, resolve to TODAY (daysUntil = 0).
 *   - If a Today/Tomorrow smart-group already covers today or tomorrow
 *     (daysUntil 0 or 1), skip to next week.
 *   - Otherwise, return the next upcoming occurrence within 0..6 days.
 */

/**
 * Compute the date a day-of-week canvas group should resolve to.
 *
 * @param dayIndex - JS day-of-week index (0=Sun … 6=Sat)
 * @param now - Reference "today" — typically `new Date()`
 * @param hasTodayOrTomorrow - Whether a Today/Tomorrow smart-group exists on canvas
 */
export function getDayGroupDate(
  dayIndex: number,
  now: Date,
  hasTodayOrTomorrow: boolean
): Date {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  let daysUntil = (dayIndex - today.getDay() + 7) % 7

  if (hasTodayOrTomorrow && daysUntil <= 1) {
    daysUntil += 7
  }

  const result = new Date(today)
  result.setDate(result.getDate() + daysUntil)
  return result
}

/** YYYY-MM-DD in local time — used for task dueDate writes. */
export function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Short "D.M.YY" suffix — used in canvas group headers. */
export function formatDayGroupSuffix(date: Date): string {
  const d = date.getDate()
  const m = date.getMonth() + 1
  const y = date.getFullYear().toString().slice(-2)
  return `${d}.${m}.${y}`
}
