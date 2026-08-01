import type { useTaskStore, Task } from '@/stores/tasks'
import type { TaskAttachment } from '@/types/tasks'
import type { useTimerStore } from '@/stores/timer'
import type { BoardViewType } from './useBoardModals'
import { useFilterDefaults } from '@/composables/tasks/useFilterDefaults'
import { useToast } from '@/composables/useToast'

interface BoardActionsDependencies {
    taskStore: ReturnType<typeof useTaskStore>
    timerStore: ReturnType<typeof useTimerStore>
}

/**
 * Convert date column keys to actual date strings
 */
export function getDateFromColumnKey(key: string): string | undefined {
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
    const { filterDefaults } = useFilterDefaults()
    const { showToast } = useToast()

    const handleWithError = async <T>(
        operation: () => Promise<T>,
        errorMessage: string
    ): Promise<T | null> => {
        try {
            return await operation()
        } catch (error) {
            console.error(errorMessage, error)
            showToast(errorMessage, 'error')
            return null
        }
    }

    const selectTask = (taskId: string) => {
        taskStore.selectTask(taskId)
    }

    const startTimer = async (taskId: string) => {
        // BUG-1051: AWAIT for timer sync
        await timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
    }

    const quickTaskCreate = async (title: string, description: string, status: string, projectId?: string) => {
        return handleWithError(
            () => taskStore.createTaskWithUndo({
                ...filterDefaults.value,
                title,
                description,
                status: status as 'todo' | 'done',
                projectId: projectId
            }),
            'Task could not be created. No changes were saved.'
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
        projectId?: string,
        attachments?: TaskAttachment[],  // FEATURE-1414
        dueDate?: string
    ) => {
        const taskData: Partial<Task> = {
            ...filterDefaults.value,
            title,
            description,
            projectId,
            status: 'todo', // default status
            attachments
        }

        // An explicit date from the modal wins over the active filter and column default.
        if (dueDate !== undefined || viewType === 'date') {
            taskData.dueDate = dueDate ?? getDateFromColumnKey(columnKey)
        }

        // Set correct field based on view type
        if (viewType === 'category') {
            // FEATURE-1336: Category view - columnKey is the projectId
            taskData.projectId = columnKey === 'uncategorized' ? undefined : columnKey
        } else if (viewType === 'status') {
            taskData.status = columnKey as Task['status']
        } else if (viewType === 'priority') {
            taskData.priority = columnKey === 'no_priority' ? undefined : columnKey as Task['priority']
        }

        return handleWithError(
            () => taskStore.createTaskWithUndo(taskData),
            'Task could not be created. No changes were saved.'
        )
    }

    const deleteTask = async (taskId: string) => {
        return handleWithError(
            () => taskStore.deleteTaskWithUndo(taskId),
            'Task could not be deleted. No changes were saved.'
        )
    }

    const moveTask = async (taskId: string, newStatus: string) => {
        return handleWithError(
            () => taskStore.moveTaskWithUndo(taskId, newStatus as 'todo' | 'done'),
            'Task could not be moved. No changes were saved.'
        )
    }

    const addSubtask = async (taskId: string, title: string = 'New Subtask') => {
        return handleWithError(
            () => taskStore.createSubtaskWithUndo(taskId, { title }),
            'Subtask could not be created. No changes were saved.'
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
