// TASK-1785: Pure math for Shift+drag ripple-push reschedule.
// Kept as a standalone module so the date/time/midnight-spill logic can be
// unit-tested without spinning up the calendar composable + Pinia stores.

export interface RippleLaterEvent {
  taskId: string
  instanceId: string
  originDate: string      // YYYY-MM-DD
  originMinutes: number   // minutes from midnight of originDate
}

export interface RippleUpdate {
  id: string
  scheduledDate: string
  scheduledTime: string   // HH:MM, 24-hour
  instanceId?: string
}

export interface RippleOrigin {
  taskId: string
  instanceId?: string
  originDate: string
  originMinutes: number
}

export interface RippleTarget {
  date: string
  totalMinutes: number    // snapped minutes from midnight of `date`
}

/**
 * Add `daysToAdd` calendar days to a YYYY-MM-DD string in local time,
 * avoiding ISO/UTC drift across DST boundaries.
 */
export function addDaysToDateString(dateStr: string, daysToAdd: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + daysToAdd)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

export function formatMinutesAsTime(minutes: number): string {
  const safe = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(safe / 60)
  const m = safe % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * Given the dragged task's origin, the drop target, and every later same-day
 * event captured at dragstart, produce the ordered list of `updateTaskWithSchedule`
 * payloads that will ripple-shift each task forward by the same delta.
 *
 * Returns an empty array when:
 *   - the drop is on a different day (ripple only makes sense within one day)
 *   - the delta is zero or negative (v1 is forward-only)
 *
 * Midnight spill: if a later task's new time exceeds 24h, its scheduledDate
 * rolls forward by Math.floor(newTotalMinutes / 1440) days.
 */
export function computeRippleUpdates(
  origin: RippleOrigin,
  target: RippleTarget,
  laterEvents: RippleLaterEvent[]
): RippleUpdate[] {
  if (target.date !== origin.originDate) return []
  const delta = target.totalMinutes - origin.originMinutes
  if (delta <= 0) return []

  const updates: RippleUpdate[] = []

  updates.push({
    id: origin.taskId,
    scheduledDate: target.date,
    scheduledTime: formatMinutesAsTime(target.totalMinutes),
    instanceId: origin.instanceId
  })

  for (const later of laterEvents) {
    const newTotal = later.originMinutes + delta
    const dayOffset = Math.floor(newTotal / 1440)
    const newDate = dayOffset > 0
      ? addDaysToDateString(later.originDate, dayOffset)
      : later.originDate
    updates.push({
      id: later.taskId,
      scheduledDate: newDate,
      scheduledTime: formatMinutesAsTime(newTotal),
      instanceId: later.instanceId
    })
  }

  return updates
}
