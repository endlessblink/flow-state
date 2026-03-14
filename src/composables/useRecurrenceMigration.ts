/**
 * TASK-1524: Recurrence Migration — old `recurrence` field to new `recurrenceRule`
 *
 * Tasks created before TASK-1403 use the old `recurrence: TaskRecurrence` field.
 * The recurring badge, delete dialog, and scheduler all depend on `recurrenceRule`.
 * This migration runs once on app init to convert old-format tasks to the new format.
 *
 * Migration is idempotent: tasks that already have `recurrenceRule` are skipped.
 * The old `recurrence` field is left intact for backward compatibility.
 * Runs at most once per device (guarded by localStorage flag).
 */
import { useTaskStore } from '@/stores/tasks'
import type { SimpleRecurrenceRule } from '@/types/tasks'

const MIGRATION_KEY = 'flowstate-recurrence-migration-v1'

export function useRecurrenceMigration() {
  const taskStore = useTaskStore()

  /**
   * Convert old TaskRecurrence to new SimpleRecurrenceRule.
   * Returns null if the recurrence is disabled, or pattern is 'none' or 'custom'.
   */
  function convertOldToNew(oldRecurrence: unknown): SimpleRecurrenceRule | null {
    if (!oldRecurrence || typeof oldRecurrence !== 'object') return null

    const rec = oldRecurrence as Record<string, unknown>

    if (!rec.isEnabled) return null

    const rule = rec.rule as Record<string, unknown> | undefined
    if (!rule || typeof rule !== 'object') return null

    const pattern = rule.pattern as string | undefined
    if (!pattern || pattern === 'none' || pattern === 'custom') return null

    // Only migrate known patterns
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(pattern)) return null

    // Map end condition
    const endCondition = (rec.endCondition as Record<string, unknown> | undefined) || { type: 'never' }
    let endType: 'never' | 'after_count' | 'on_date' = 'never'
    if (endCondition.type === 'after_count') endType = 'after_count'
    else if (endCondition.type === 'on_date') endType = 'on_date'

    const newRule: SimpleRecurrenceRule = {
      pattern: pattern as 'daily' | 'weekly' | 'monthly' | 'yearly',
      interval: typeof rule.interval === 'number' ? rule.interval : 1,
      endType,
    }

    if (endType === 'on_date' && endCondition.date) {
      newRule.endDate = endCondition.date as string
    }

    if (endType === 'after_count' && endCondition.count) {
      newRule.endCount = endCondition.count as number
    }

    // Weekly: copy weekdays array (already 0-6 numbers)
    if (pattern === 'weekly') {
      const weekdays = rule.weekdays
      if (Array.isArray(weekdays) && weekdays.length > 0) {
        newRule.weekdays = [...weekdays] as number[]
      }
    }

    // Monthly: prefer weekday+weekOfMonth over dayOfMonth
    if (pattern === 'monthly') {
      const weekday = rule.weekday
      const weekOfMonth = rule.weekOfMonth
      if (weekday !== undefined && weekOfMonth !== undefined) {
        newRule.monthWeekday = { nth: weekOfMonth as number, day: weekday as number }
      } else if (rule.dayOfMonth) {
        newRule.monthDay = rule.dayOfMonth as number
      }
    }

    return newRule
  }

  /**
   * Migrate all tasks with old `recurrence` field to new `recurrenceRule`.
   * Skips tasks that already have `recurrenceRule`.
   * Marks migration done in localStorage after completion.
   * Returns count of migrated tasks.
   */
  async function migrateIfNeeded(): Promise<number> {
    if (localStorage.getItem(MIGRATION_KEY)) return 0

    const tasks = taskStore._rawTasks
    let migrated = 0

    for (const task of tasks) {
      // Already migrated
      if (task.recurrenceRule) continue

      // No old recurrence data
      if (!task.recurrence) continue

      const newRule = convertOldToNew(task.recurrence)
      if (!newRule) continue

      try {
        await taskStore.updateTask(task.id, {
          recurrenceRule: newRule,
          recurrenceCount: task.recurrenceCount ?? 0,
        })
        migrated++
        console.log(
          `[RECURRENCE-MIGRATION] Converted "${(task.title ?? '').slice(0, 30)}": ${newRule.pattern} every ${newRule.interval}`
        )
      } catch (e) {
        console.warn(`[RECURRENCE-MIGRATION] Failed to migrate "${(task.title ?? '').slice(0, 30)}":`, e)
      }
    }

    localStorage.setItem(MIGRATION_KEY, new Date().toISOString())

    if (migrated > 0) {
      console.log(`[RECURRENCE-MIGRATION] Migrated ${migrated} task(s) from old recurrence format to new`)
    }

    return migrated
  }

  return { migrateIfNeeded, convertOldToNew }
}
