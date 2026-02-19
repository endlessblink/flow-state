import { type Ref, nextTick } from 'vue'
import type { Task, Subtask, TaskInstance } from '@/types/tasks'
import { getUndoSystem } from '@/composables/undoSingleton'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
// TASK-127: Removed taskDisappearanceLogger (PouchDB-era debugging tool)


export function useTaskHistory(
    // SAFETY: Named _rawTasks to indicate this is the raw array for undo/redo operations
    _rawTasks: Ref<Task[]>,
    manualOperationInProgress: Ref<boolean>,
    saveTasksToStorage: (tasks: Task[], context: string) => Promise<void>
) {


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

        const backupTasks = [..._rawTasks.value]
        manualOperationInProgress.value = true

        try {
            _rawTasks.value = [...newTasks]

            await saveTasksToStorage(_rawTasks.value, 'undo-restoreTaskState')
        } catch (error) {
            _rawTasks.value = backupTasks
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
                const { useTaskStore } = await import('../tasks')
                const store = useTaskStore()
                await store.bulkDeleteTasks(taskIds)
            },
            startTaskNowWithUndo: async (taskId: string) => {
                console.log('📋 startTaskNowWithUndo called for task:', taskId)
                const { useTaskStore } = await import('../tasks')
                const store = useTaskStore()
                const undoSystem = getUndoSystem()
                undoSystem.saveState('Before start task now')
                console.log('📋 Calling store.startTaskNow...')
                // BUG-1090: AWAIT to ensure instance is persisted before continuing
                await store.startTaskNow(taskId)
                console.log('📋 store.startTaskNow completed')
                await nextTick()
                undoSystem.saveState('After start task now')
            },

            // Instance methods wrapped with undo
            createTaskInstanceWithUndo: async (taskId: string, instanceData: Omit<TaskInstance, 'id'>) => {
                const { useTaskStore } = await import('../tasks')
                const store = useTaskStore()
                const undoSystem = getUndoSystem()
                undoSystem.saveState('Before create instance')
                await store.createTaskInstance(taskId, instanceData)
                await nextTick()
                undoSystem.saveState('After create instance')
            },

            updateTaskInstanceWithUndo: async (taskId: string, instanceId: string, updates: Partial<TaskInstance>) => {
                const { useTaskStore } = await import('../tasks')
                const store = useTaskStore()
                const undoSystem = getUndoSystem()
                undoSystem.saveState('Before update instance')
                await store.updateTaskInstance(taskId, instanceId, updates)
                await nextTick()
                undoSystem.saveState('After update instance')
            },

            deleteTaskInstanceWithUndo: async (taskId: string, instanceId: string) => {
                const { useTaskStore } = await import('../tasks')
                const store = useTaskStore()
                const undoSystem = getUndoSystem()
                undoSystem.saveState('Before delete instance')
                await store.deleteTaskInstance(taskId, instanceId)
                await nextTick()
                undoSystem.saveState('After delete instance')
            },

            createSubtaskWithUndo: async (taskId: string, subtask: Partial<Subtask>) => {
                const { useTaskStore } = await import('../tasks')
                const store = useTaskStore()
                const undoSystem = getUndoSystem()
                undoSystem.saveState('Before create subtask')
                await store.createSubtask(taskId, subtask)
                await nextTick()
                undoSystem.saveState('After create subtask')
            },
            updateSubtaskWithUndo: async (taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
                const { useTaskStore } = await import('../tasks')
                const store = useTaskStore()
                const undoSystem = getUndoSystem()
                undoSystem.saveState('Before update subtask')
                await store.updateSubtask(taskId, subtaskId, updates)
                await nextTick()
                undoSystem.saveState('After update subtask')
            },
            deleteSubtaskWithUndo: async (taskId: string, subtaskId: string) => {
                const { useTaskStore } = await import('../tasks')
                const store = useTaskStore()
                const undoSystem = getUndoSystem()
                undoSystem.saveState('Before delete subtask')
                await store.deleteSubtask(taskId, subtaskId)
                await nextTick()
                undoSystem.saveState('After delete subtask')
            },
            unscheduleTaskWithUndo: async (taskId: string) => {
                // Remove all scheduling properties + clear instances (calendar uses instances exclusively since BUG-1325)
                return undoHistory.updateTaskWithUndo(taskId, {
                    instances: [],
                    isInInbox: true,
                    dueDate: undefined,
                    scheduledDate: undefined,
                    scheduledTime: undefined
                })
            }
        }
    }

    return {
        restoreState,
        undoRedoEnabledActions
    }
}
