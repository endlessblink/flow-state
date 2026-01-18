import type { useTaskStore, Task } from '@/stores/tasks'
import type { useTimerStore } from '@/stores/timer'
import type { BoardViewType } from './useBoardModals'

interface BoardActionsDependencies {
    taskStore: ReturnType<typeof useTaskStore>
    timerStore: ReturnType<typeof useTimerStore>
}

/**
 * Convert date column keys to actual date strings
 */
function getDateFromColumnKey(key: string): string | undefined {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    switch (key) {
        case 'today':
            return today.toISOString().split('T')[0]
        case 'tomorrow': {
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)
            return tomorrow.toISOString().split('T')[0]
        }
        case 'overdue':
            // For overdue column, set to today (the task is being created as "due today")
            return today.toISOString().split('T')[0]
        case 'thisWeek': {
            // End of current week (Sunday)
            const endOfWeek = new Date(today)
            const daysUntilSunday = 7 - today.getDay()
            endOfWeek.setDate(today.getDate() + daysUntilSunday)
            return endOfWeek.toISOString().split('T')[0]
        }
        case 'later': {
            // Two weeks from today
            const later = new Date(today)
            later.setDate(today.getDate() + 14)
            return later.toISOString().split('T')[0]
        }
        case 'inbox':
        case 'noDate':
        default:
            return undefined
    }
}

export function useBoardActions(deps: BoardActionsDependencies) {
    const { taskStore, timerStore } = deps

    const handleWithError = async <T>(
        operation: () => Promise<T>,
        errorMessage: string
    ): Promise<T | null> => {
        try {
            return await operation()
        } catch (_error) {
            return null
        }
    }

    const selectTask = (taskId: string) => {
        taskStore.selectTask(taskId)
    }

    const startTimer = (taskId: string) => {
        timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
    }

    const quickTaskCreate = async (title: string, description: string, status: string, projectId?: string) => {
        return handleWithError(
            () => taskStore.createTaskWithUndo({
                title,
                description,
                status: status as 'planned' | 'in_progress' | 'done',
                projectId: projectId
            }),
            '❌ Error creating task:'
        )
    }

    /**
     * Create a task with correct field based on view type
     * - Status view: sets status field
     * - Priority view: sets priority field
     * - Date view: sets dueDate field
     */
    const createTaskForColumn = async (
        title: string,
        description: string,
        columnKey: string,
        viewType: BoardViewType,
        projectId?: string
    ) => {
        const taskData: Partial<Task> = {
            title,
            description,
            projectId,
            status: 'planned' // default status
        }

        // Set correct field based on view type
        if (viewType === 'status') {
            taskData.status = columnKey as Task['status']
        } else if (viewType === 'priority') {
            taskData.priority = columnKey === 'no_priority' ? undefined : columnKey as Task['priority']
        } else if (viewType === 'date') {
            taskData.dueDate = getDateFromColumnKey(columnKey)
        }

        return handleWithError(
            () => taskStore.createTaskWithUndo(taskData),
            '❌ Error creating task:'
        )
    }

    const deleteTask = async (taskId: string) => {
        return handleWithError(
            () => taskStore.deleteTaskWithUndo(taskId),
            '❌ Error deleting task:'
        )
    }

    const moveTask = async (taskId: string, newStatus: string) => {
        return handleWithError(
            () => taskStore.moveTaskWithUndo(taskId, newStatus as 'planned' | 'in_progress' | 'done'),
            '❌ Error moving task:'
        )
    }

    const addSubtask = async (taskId: string, title: string = 'New Subtask') => {
        return handleWithError(
            () => taskStore.createSubtaskWithUndo(taskId, { title }),
            '❌ Error creating subtask:'
        )
    }

    return {
        selectTask,
        startTimer,
        quickTaskCreate,
        createTaskForColumn,
        deleteTask,
        moveTask,
        addSubtask
    }
}
