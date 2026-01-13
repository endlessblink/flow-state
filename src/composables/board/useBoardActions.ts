import { useTaskStore } from '@/stores/tasks'
import type { useTimerStore } from '@/stores/timer'

interface BoardActionsDependencies {
    taskStore: ReturnType<typeof useTaskStore>
    timerStore: ReturnType<typeof useTimerStore>
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
        deleteTask,
        moveTask,
        addSubtask
    }
}
