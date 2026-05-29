/**
 * TASK-1756: Shared date math for canvas day-of-week groups.
 *
 * Both the group header suffix (GroupNodeSimple.vue) and the midnight
 * rotation (useDayGroupRotation.ts) must resolve the same date for a given
 * weekday — otherwise the visible label and the task dueDate disagree.
 *
 * Rules:
 *   - If today IS the target weekday, resolve to TODAY (daysUntil = 0).
 *   - Otherwise, return the next upcoming occurrence within 1..6 days.
 */

/**
 * Compute the date a day-of-week canvas group should resolve to.
 *
 * @param dayIndex - JS day-of-week index (0=Sun … 6=Sat)
 * @param now - Reference "today" — typically `new Date()`
 * @param _hasTodayOrTomorrow - Legacy argument retained for call-site compatibility.
 *   Today/Tomorrow groups no longer shift weekday targets; placement priority
 *   decides which group receives tasks when dates overlap.
 */
export function getDayGroupDate(
  dayIndex: number,
  now: Date,
  _hasTodayOrTomorrow: boolean
): Date {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const daysUntil = (dayIndex - today.getDay() + 7) % 7

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
