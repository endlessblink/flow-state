import type { Ref } from 'vue'
import type { Task } from '@/types/tasks'

export const useTaskMigrations = (tasks: Ref<Task[]>) => {
    /**
     * Migrate legacy tasks to use instances array
     */
    const migrateLegacyTasks = () => {
        tasks.value.forEach(task => {
            // If task has scheduledDate but no instances, create instance from legacy fields
            // BUG-1325: Skip tasks where scheduledDate was auto-copied from dueDate
            // (the old syncDateFields CASE 1 set scheduledDate = dueDate + scheduledTime = '09:00')
            // These were never explicitly scheduled by the user.
            const wasAutoPopulated = task.scheduledDate === task.dueDate
            if (task.scheduledDate && task.scheduledTime && (!task.instances || task.instances.length === 0) && !wasAutoPopulated) {
                task.instances = [{
                    id: `migrated-${task.id}-${Date.now()}`,
                    scheduledDate: task.scheduledDate,
                    scheduledTime: task.scheduledTime,
                    duration: task.estimatedDuration || 25
                }]
            }
        })
    }

    /**
     * Migrate task status values to fix "todo" -> "planned" mapping
     */
    const migrateTaskStatuses = () => {
        tasks.value.forEach(task => {
            if ((task.status as string) === 'todo') {
                task.status = 'planned'
            }
        })
    }

    /**
     * Migrate tasks to set isInInbox based on canvas position
     */
    const migrateInboxFlag = () => {
        let migratedCount = 0
        let orphanedCount = 0

        tasks.value.forEach(task => {
            // If task has canvasPosition, it should NOT be in inbox
            if (task.canvasPosition && task.isInInbox !== false) {
                task.isInInbox = false
                migratedCount++
            }
            // If isInInbox is undefined and no position, default to inbox
            else if (task.isInInbox === undefined) {
                task.isInInbox = true
            }

            // Detect and repair ORPHANED tasks
            const hasCanvasPosition = task.canvasPosition &&
                typeof task.canvasPosition.x === 'number' &&
                typeof task.canvasPosition.y === 'number'
            const hasCalendarInstances = task.instances && task.instances.length > 0

            if (task.isInInbox === false && !hasCanvasPosition && !hasCalendarInstances) {
                task.isInInbox = true
                orphanedCount++
            }
        })

        if (migratedCount > 0 || orphanedCount > 0) {
            console.log(`✅ [INBOX_MIGRATION] Fixed ${migratedCount} flags and repaired ${orphanedCount} orphaned tasks`)
        }
    }

    /**
     * Migrate tasks to add isUncategorized flag
     */
    const migrateTaskUncategorizedFlag = () => {
        let migratedCount = 0
        tasks.value.forEach(task => {
            if (task.isUncategorized === undefined) {
                const shouldBeUncategorized = !task.projectId ||
                    task.projectId === '' ||
                    task.projectId === null ||
                    task.projectId === '1'

                task.isUncategorized = shouldBeUncategorized
                migratedCount++
            }
        })

        if (migratedCount > 0) {
            console.log(`🔄 [UNCATEGORIZED_MIGRATION] Set isUncategorized flag for ${migratedCount} tasks`)
        }
    }

    /**
     * Migrate nested tasks to inherit parent's projectId
     */
    const migrateNestedTaskProjectIds = () => {
        tasks.value.forEach(task => {
            if (task.parentTaskId) {
                const parentTask = tasks.value.find(t => t.id === task.parentTaskId)
                if (parentTask && task.projectId !== parentTask.projectId) {
                    task.projectId = parentTask.projectId
                }
            }
        })
    }

    /**
     * Clean up placeholder description text that was incorrectly stored as content
     * BUG: "Task description..." was set as actual content instead of relying on placeholder
     */
    const migratePlaceholderDescriptions = () => {
        let cleanedCount = 0
        tasks.value.forEach(task => {
            if (task.description === 'Task description...' || task.description === 'Task description...') {
                task.description = ''
                cleanedCount++
            }
        })

        if (cleanedCount > 0) {
            console.log(`🧹 [DESCRIPTION_MIGRATION] Cleaned placeholder text from ${cleanedCount} task descriptions`)
        }
    }

    /**
     * DONE-ZONE: Backfill completedAt for existing done tasks
     * Uses updatedAt as a reasonable approximation for when the task was completed
     */
    const migrateCompletedAtTimestamp = () => {
        let backfilledCount = 0
        tasks.value.forEach(task => {
            // If task is done but has no completedAt, backfill with updatedAt
            if (task.status === 'done' && !task.completedAt) {
                task.completedAt = task.updatedAt || new Date()
                backfilledCount++
            }
        })

        if (backfilledCount > 0) {
            console.log(`✅ [DONE-ZONE] Backfilled completedAt for ${backfilledCount} existing done tasks`)
        }
    }

    /**
     * BUG-1325: Clean up auto-generated calendar instances and legacy scheduling fields.
     * Old syncDateFields CASE 1 auto-populated scheduledDate/scheduledTime from dueDate,
     * and CASE 3 auto-created instances from those. This migration removes that pollution.
     */
    const cleanupAutoCalendarInstances = () => {
        let cleanedInstancesCount = 0
        let cleanedFieldsCount = 0

        tasks.value.forEach(task => {
            // Clean up auto-generated instances where all instances match dueDate at 09:00
            if (task.instances && task.instances.length > 0 && task.dueDate) {
                const allAutoGenerated = task.instances.every(inst =>
                    (inst.id?.startsWith('auto-') || inst.id?.startsWith('migrated-') || inst.id?.startsWith('legacy-')) &&
                    inst.scheduledDate === task.dueDate &&
                    inst.scheduledTime === '09:00'
                )
                if (allAutoGenerated) {
                    task.instances = []
                    cleanedInstancesCount++
                }
            }

            // Clean up legacy fields that were auto-copied from dueDate
            if (task.scheduledDate && task.scheduledDate === task.dueDate) {
                task.scheduledDate = undefined as unknown as string
                task.scheduledTime = undefined as unknown as string
                cleanedFieldsCount++
            }
        })

        if (cleanedInstancesCount > 0 || cleanedFieldsCount > 0) {
            console.log(`🧹 [BUG-1325] Cleaned ${cleanedInstancesCount} auto-generated calendar instances and ${cleanedFieldsCount} legacy scheduling fields`)
        }
    }

    /**
     * Run all task migrations
     */
    const runAllTaskMigrations = () => {
        console.log('🧙‍♂️ Running task migrations...')
        cleanupAutoCalendarInstances()
        migrateLegacyTasks()
        migrateTaskStatuses()
        migrateInboxFlag()
        migrateTaskUncategorizedFlag()
        migrateNestedTaskProjectIds()
        migrateCompletedAtTimestamp()
        migratePlaceholderDescriptions()
        console.log('✅ Task migrations complete')
    }

    return {
        migrateLegacyTasks,
        migrateTaskStatuses,
        migrateInboxFlag,
        migrateTaskUncategorizedFlag,
        migrateNestedTaskProjectIds,
        migrateCompletedAtTimestamp,
        migratePlaceholderDescriptions,
        cleanupAutoCalendarInstances,
        runAllTaskMigrations
    }
}
