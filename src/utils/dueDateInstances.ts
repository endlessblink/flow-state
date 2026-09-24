import type { Task } from '@/types/tasks'

/**
 * BUG-1909: When the user EXPLICITLY sets a due date, stale PAST calendar
 * instances must follow it. The write path used to move only the instance the
 * menu was opened on (calendar events); from a task card it wrote `dueDate`
 * alone, so a leftover past instance kept pinning the card badge to
 * "Overdue <old date>" — permanently for recurring tasks, where instances
 * stay authoritative in computeDueStatus (BUG-1810/BUG-1901).
 *
 * Reschedules active current or past instances onto the picked date as date-only.
 * Completed history and future placements keep their dates and times.
 *
 * Returns the new instances array, or undefined when nothing needs to change
 * (callers then omit `instances` from the update payload entirely — never
 * write the field back unchanged; see BUG-1799 double-write lessons).
 */
export function reconcileStaleInstancesForDueDate(
  task: Pick<Task, 'instances'> | null | undefined,
  newDueDate: string,
  now: Date = new Date()
): Task['instances'] | undefined {
  const instances = task?.instances
  if (!instances || instances.length === 0) return undefined

  const newDateOnly = newDueDate.split('T')[0]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDateOnly)) return undefined

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`

  let changed = false
  const reconciled = instances.map(inst => {
    const dateOnly = inst?.scheduledDate?.split('T')[0]
    if (dateOnly && dateOnly <= todayStr && dateOnly !== newDateOnly && inst.status !== 'completed' && inst.status !== 'skipped') {
      changed = true
      return { ...inst, scheduledDate: newDateOnly, scheduledTime: undefined }
    }
    return inst
  })

  return changed ? reconciled : undefined
}
