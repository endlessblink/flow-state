import type { Ref } from 'vue'
import type { Task } from '@/types/tasks'

export const useTaskMigrations = (tasks: Ref<Task[]>) => {
    /**
     * Migrate legacy tasks to use instances array
     */
    const migrateLegacyTasks = () => {
        tasks.value.forEach(task => {
            // If task has scheduledDate but no instances, create instance from legacy fields
            if (task.scheduledDate && task.scheduledTime && (!task.instances || task.instances.length === 0)) {
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
     * Run all task migrations
     */
    const runAllTaskMigrations = () => {
        console.log('🧙‍♂️ Running task migrations...')
        migrateLegacyTasks()
        migrateTaskStatuses()
        migrateInboxFlag()
        migrateTaskUncategorizedFlag()
        migrateNestedTaskProjectIds()
        console.log('✅ Task migrations complete')
    }

    return {
        migrateLegacyTasks,
        migrateTaskStatuses,
        migrateInboxFlag,
        migrateTaskUncategorizedFlag,
        migrateNestedTaskProjectIds,
        runAllTaskMigrations
    }
}
