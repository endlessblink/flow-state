import type { Task } from '@/types/tasks'

export interface DueStatus {
  type:
    | 'overdue'
    | 'today'
    | 'tomorrow'
    | 'future'
    | 'scheduled-today'
    | 'scheduled-tomorrow'
    | 'scheduled-future'
  text: string
}

const localDateString = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// ADHD-friendly: Human-readable date formatting (e.g. "Jun 8")
const formatHumanDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' })

/**
 * BUG-1810: Pick the representative calendar-instance date for recurring/scheduled
 * tasks — the soonest upcoming instance (>= today), else the latest past instance.
 * Mirrors the inbox filter (BUG-1188: instances are authoritative when present), so
 * the badge shows the date that actually caused the task to surface under a time
 * filter, instead of a far-future master dueDate.
 */
export const representativeInstanceDate = (task: Task, today: string): string | null => {
  const dates = (task.instances ?? [])
    .map(inst => inst?.scheduledDate?.split('T')[0])
    .filter((d): d is string => !!d)
    .sort()
  if (dates.length === 0) return null
  return dates.find(d => d >= today) ?? dates[dates.length - 1]
}

/**
 * Compute the due-date badge for an inbox task card.
 * `now` is injected so the result is deterministic and testable.
 */
export const computeDueStatus = (task: Task, now: Date): DueStatus | null => {
  // BUG-1321: Use local date (not UTC) to avoid timezone-related overdue false positives
  const today = localDateString(now)
  const tomorrow = localDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))

  // BUG-1810: When calendar instances exist they are authoritative (matches the
  // filter), so derive the badge from the relevant instance instead of the master
  // dueDate — otherwise a recurring task with a far-future dueDate shows that future
  // date while it actually surfaced via a near-term (or overdue) instance.
  const instanceDate = representativeInstanceDate(task, today)

  if (!instanceDate && task.dueDate) {
    const dueDateOnly = task.dueDate.split('T')[0]
    if (dueDateOnly < today) {
      return { type: 'overdue', text: `Overdue ${formatHumanDate(dueDateOnly)}` }
    } else if (dueDateOnly === today) {
      return { type: 'today', text: 'Today' }
    } else if (dueDateOnly === tomorrow) {
      return { type: 'tomorrow', text: 'Tomorrow' }
    }
    return { type: 'future', text: formatHumanDate(dueDateOnly) }
  }

  const effectiveDate = instanceDate || task.scheduledDate
  if (effectiveDate) {
    const effectiveDateOnly = effectiveDate.split('T')[0]
    if (effectiveDateOnly < today) {
      // BUG-1810: a representative instance in the past is overdue, not "future"
      return { type: 'overdue', text: `Overdue ${formatHumanDate(effectiveDateOnly)}` }
    } else if (effectiveDateOnly === today) {
      return { type: 'scheduled-today', text: 'Today' }
    } else if (effectiveDateOnly === tomorrow) {
      return { type: 'scheduled-tomorrow', text: 'Tomorrow' }
    }
    return { type: 'scheduled-future', text: formatHumanDate(effectiveDateOnly) }
  }

  return null
}
