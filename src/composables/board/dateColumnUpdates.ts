/**
 * BUG-1935: Builds the task patch for a drop onto a Board due-date column.
 *
 * Kept out of KanbanColumn.vue so the rebase rules are unit-testable without
 * mounting the component (and without SortableJS in the loop).
 */
import type { Task, TaskInstance } from '@/types/tasks'
import { formatDateKey, parseDateKey } from '@/stores/tasks'

export type DateColumn = 'inbox' | 'noDate' | 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek' | 'later'

/** Columns that reject drops. `overdue` is a symptom, not a destination. */
export const isDropTarget = (column: string): boolean => column !== 'overdue'

/** Resolve the concrete calendar date a date-column drop should land on. */
const targetDateFor = (column: DateColumn, today: Date): Date | null => {
    const target = new Date(today)
    switch (column) {
        case 'today': return target
        case 'tomorrow': target.setDate(today.getDate() + 1); return target
        case 'thisWeek': target.setDate(today.getDate() + (7 - today.getDay())); return target
        case 'nextWeek': target.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7)); return target
        case 'later': target.setDate(today.getDate() + 30); return target
        default: return null
    }
}

/**
 * Rebase instances that sit in the past onto `targetKey`, preserving time of day,
 * duration and identity. Future instances are deliberately left alone — the user
 * scheduled those on purpose and grouping keys on dueDate anyway.
 *
 * Returns `null` when nothing changed, so the caller can omit the key entirely and
 * avoid tripping syncDateFields' instances→dueDate back-sync (taskOperations.ts).
 */
const rebasePastInstances = <T extends Pick<TaskInstance, 'scheduledDate' | 'isLater'>>(
    instances: T[] | undefined,
    targetKey: string,
    today: Date
): T[] | null => {
    if (!instances?.length) return null

    let changed = false
    const rebased = instances.map(instance => {
        if (instance.isLater) return instance
        const scheduled = parseDateKey(instance.scheduledDate)
        if (!scheduled || scheduled >= today) return instance
        changed = true
        return { ...instance, scheduledDate: targetKey }
    })

    return changed ? rebased : null
}

/**
 * @returns the patch to apply, or `null` when the column refuses the drop.
 */
export function getDateColumnUpdates(task: Task, column: string): Partial<Task> | null {
    if (!isDropTarget(column)) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (column === 'inbox' || column === 'noDate') {
        return {
            dueDate: undefined,
            instances: [],
            // BUG-1935: getTaskInstances() falls back to recurringInstances, so clearing
            // only `instances` left recurring tasks stuck in their old column.
            recurringInstances: [],
            ...(column === 'inbox' ? { isInInbox: true } : {})
        }
    }

    const target = targetDateFor(column as DateColumn, today)
    if (!target) return {}

    const targetKey = formatDateKey(target)
    const updates: Partial<Task> = { dueDate: targetKey }

    const instances = rebasePastInstances(task.instances, targetKey, today)
    if (instances) updates.instances = instances

    const recurringInstances = rebasePastInstances(task.recurringInstances, targetKey, today)
    if (recurringInstances) updates.recurringInstances = recurringInstances

    return updates
}
