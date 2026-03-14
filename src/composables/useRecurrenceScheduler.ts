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

        // CRITICAL: Use a localStorage lock to prevent duplicate clones across rapid page refreshes.
        // The in-memory guards (hasActiveSuccessor, hasTodayClone) fail when:
        // 1. User refreshes before the previous clone's DB write completes
        // 2. loadFromDatabase doesn't see the clone yet (race with direct save)
        // The lock persists across page loads, unlike in-memory state.
        const LOCK_KEY = `flowstate-recurrence-lock-${today}`
        const existingLock = localStorage.getItem(LOCK_KEY)
        if (existingLock) {
            const lockTime = parseInt(existingLock, 10)
            // Lock is valid for 60 seconds (covers the DB write + sync time)
            if (Date.now() - lockTime < 60_000) {
                console.log('[RECURRENCE-SCHEDULER] Skipping — lock active from recent run')
                return 0
            }
        }
        // Set lock BEFORE processing
        localStorage.setItem(LOCK_KEY, String(Date.now()))

        // Find done tasks with recurrenceRule that might need deferred clones
        const doneTasks = taskStore._rawTasks.filter(t =>
            t.status === 'done' &&
            t.recurrenceRule &&
            !t._soft_deleted
        )

        // Track chains we've already created a clone for in THIS run
        // (prevents multiple done tasks in the same chain each spawning a clone)
        const processedChains = new Set<string>()

        for (const task of doneTasks) {
            try {
                const chainId = task.recurrenceParentId || task.id

                // Skip if we already created a clone for this chain in this run
                if (processedChains.has(chainId)) continue

                // Check if ANY non-done task already exists in this chain
                // (regardless of recurrenceCount — just look for an active sibling)
                const hasActiveSuccessor = taskStore._rawTasks.some(t =>
                    !t._soft_deleted &&
                    t.status !== 'done' &&
                    t.id !== task.id &&
                    (t.recurrenceParentId === chainId || t.id === chainId)
                )

                if (hasActiveSuccessor) {
                    processedChains.add(chainId)
                    continue
                }

                // Guard: check if a clone for today's date already exists in this chain
                // (prevents creating duplicates on every page load)
                const hasTodayClone = taskStore._rawTasks.some(t =>
                    !t._soft_deleted &&
                    (t.recurrenceParentId === chainId || t.id === chainId) &&
                    t.id !== task.id &&
                    t.dueDate?.substring(0, 10) === today
                )
                if (hasTodayClone) {
                    processedChains.add(chainId)
                    continue
                }

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
                        subtasks: task.subtasks?.map(st => ({
                            ...st,
                            isCompleted: false,
                        })) || [],
                        recurrenceRule: { ...rule },
                        recurrenceParentId: task.recurrenceParentId || task.id,
                        recurrenceCount: count,
                        dueDate: nextDate,
                        status: 'todo',
                        isInInbox: true,
                    })
                    cloneCount++
                    processedChains.add(chainId)
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
