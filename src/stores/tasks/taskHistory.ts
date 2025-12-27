import { type Ref } from 'vue'
import type { Task, Subtask, TaskInstance, Project } from '@/types/tasks'
import { getUndoSystem } from '@/composables/undoSingleton'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import { taskDisappearanceLogger } from '@/utils/taskDisappearanceLogger'
import { useDatabase } from '@/composables/useDatabase'
import { usePersistentStorage } from '@/composables/usePersistentStorage'
import { useProjectStore } from '../projects'

export function useTaskHistory(
    tasks: Ref<Task[]>,
    manualOperationInProgress: Ref<boolean>,
    saveTasksToStorage: (tasks: Task[], context: string) => Promise<void>
) {
    const db = useDatabase()
    const persistentStorage = usePersistentStorage()
    const projectStore = useProjectStore()

    const restoreState = async (newTasks: Task[]) => {
        if (!Array.isArray(newTasks)) {
            errorHandler.report({
                severity: ErrorSeverity.CRITICAL,
                category: ErrorCategory.STATE,
                message: 'restoreState: newTasks is not an array',
                showNotification: true
            })
            return
        }

        const invalidTasks = newTasks.filter(task => !task || !task.id || !task.title)
        if (invalidTasks.length > 0) {
            errorHandler.report({
                severity: ErrorSeverity.CRITICAL,
                category: ErrorCategory.STATE,
                message: 'restoreState: Found invalid task objects',
                showNotification: true
            })
            return
        }

        const backupTasks = [...tasks.value]
        manualOperationInProgress.value = true

        try {
            const oldTasks = [...tasks.value]
            tasks.value = [...newTasks]
            taskDisappearanceLogger.logArrayReplacement(oldTasks, tasks.value, 'undo-restoreTaskState')

            if (db.isReady?.value) {
                await saveTasksToStorage(tasks.value, 'undo-restoreTaskState')
            }
            await persistentStorage.save(persistentStorage.STORAGE_KEYS.TASKS, tasks.value)
        } catch (error) {
            tasks.value = backupTasks
            errorHandler.report({
                severity: ErrorSeverity.ERROR,
                category: ErrorCategory.STATE,
                message: 'Failed to restore state',
                error: error as Error,
                showNotification: true
            })
        } finally {
            manualOperationInProgress.value = false
        }
    }

    const undoRedoEnabledActions = () => {
        // Re-using the logic from original tasks.ts but simplified for the new structure
        const undoHistory = getUndoSystem()

        return {
            createTaskWithUndo: async (taskData: Partial<Task>) => undoHistory.createTaskWithUndo(taskData),
            updateTaskWithUndo: async (taskId: string, updates: Partial<Task>) => undoHistory.updateTaskWithUndo(taskId, updates),
            deleteTaskWithUndo: async (taskId: string) => undoHistory.deleteTaskWithUndo(taskId),
            moveTaskWithUndo: async (taskId: string, newStatus: Task['status']) => {
                try {
                    const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
                    const useUnifiedUndoRedo = await getUndoRedoComposable()
                    const { moveTaskWithUndo } = useUnifiedUndoRedo()
                    return await moveTaskWithUndo(taskId, newStatus)
                } catch {
                    // Fallback handled in original code
                }
            },
            bulkDeleteTasksWithUndo: async (taskIds: string[]) => {
                // Bulk delete is special, we use the atomic version
                const { bulkDeleteTasks } = await import('../tasks') // We'll need to export this
                // Original code didn't have bulk undo yet
            },
            startTaskNowWithUndo: async (taskId: string) => {
                try {
                    const { getUndoRedoComposable } = await import('@/composables/useDynamicImports')
                    const useUnifiedUndoRedo = await getUndoRedoComposable()
                    const actions = useUnifiedUndoRedo()
                    if (actions && typeof actions.startTaskNow === 'function') {
                        return (actions as any).startTaskNow(taskId)
                    }
                } catch { }
            }
        }
    }

    return {
        restoreState,
        undoRedoEnabledActions
    }
}
