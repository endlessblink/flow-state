/**
 * TASK-1418: Recurrence Scheduler — Deferred Clone Creation
 *
 * Runs on app initialization to create clones for recurring tasks
 * whose next due date has arrived. This handles the deferred creation
 * model where clones are NOT created immediately on task completion
 * if the next date is in the future.
 */
import { useTaskStore } from '@/stores/tasks'
import { computeNextDueDate } from '@/utils/recurrenceUtils'
import { formatDateKey } from '@/utils/dateUtils'
import type { SimpleRecurrenceRule } from '@/types/tasks'

export function useRecurrenceScheduler() {
    const taskStore = useTaskStore()

    /**
     * Process all deferred recurring task clones.
     * Scans done tasks with recurrenceRule and creates clones
     * for any whose next due date is today or earlier.
     */
    async function processDeferred(): Promise<number> {
        const today = formatDateKey(new Date())
        let cloneCount = 0

        // Find done tasks with recurrenceRule that might need deferred clones
        const doneTasks = taskStore._rawTasks.filter(t =>
            t.status === 'done' &&
            t.recurrenceRule &&
            !t._soft_deleted
        )

        for (const task of doneTasks) {
            try {
                // Check if a non-done successor already exists in this chain
                const chainId = task.recurrenceParentId || task.id
                const hasActiveSuccessor = taskStore._rawTasks.some(t =>
                    !t._soft_deleted &&
                    t.status !== 'done' &&
                    (t.recurrenceParentId === chainId || t.id === chainId) &&
                    t.recurrenceCount !== undefined &&
                    task.recurrenceCount !== undefined &&
                    t.recurrenceCount > task.recurrenceCount
                )

                if (hasActiveSuccessor) continue

                // Compute next due date with skip-to-present
                const rule = task.recurrenceRule as SimpleRecurrenceRule
                const currentDueDate = task.dueDate || today
                let count = (task.recurrenceCount || 0) + 1
                let nextDate = computeNextDueDate(currentDueDate, rule, count)

                // Skip past missed occurrences
                while (nextDate && nextDate < today) {
                    const advanced = computeNextDueDate(nextDate, rule, count + 1)
                    if (!advanced || advanced <= nextDate) break
                    count++
                    nextDate = advanced
                }

                // Only create if due today or earlier
                if (nextDate && nextDate <= today) {
                    await taskStore.createTask({
                        title: task.title,
                        description: task.description,
                        priority: task.priority,
                        projectId: task.projectId,
                        estimatedDuration: task.estimatedDuration,
                        estimatedPomodoros: task.estimatedPomodoros,
                        tags: task.tags ? [...task.tags] : undefined,
                        recurrenceRule: { ...rule },
                        recurrenceParentId: task.recurrenceParentId || task.id,
                        recurrenceCount: count,
                        dueDate: nextDate,
                        status: 'todo',
                        isInInbox: true,
                    })
                    cloneCount++
                    console.log(`[RECURRENCE-SCHEDULER] Created deferred clone: "${task.title?.slice(0, 30)}" -> due: ${nextDate} (occurrence #${count})`)
                }
            } catch (e) {
                console.warn(`[RECURRENCE-SCHEDULER] Failed to process task "${task.title?.slice(0, 30)}":`, e)
            }
        }

        return cloneCount
    }

    return { processDeferred }
}
