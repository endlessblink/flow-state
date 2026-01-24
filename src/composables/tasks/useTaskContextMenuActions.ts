
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCanvasStore } from '@/stores/canvas'
import type { Task } from '@/stores/tasks'

export function useTaskContextMenuActions(
    props: { task: Task | null; contextTask?: Task | null; selectedCount?: number },
    emit: any
) {
    const taskStore = useTaskStore()
    const timerStore = useTimerStore()
    const canvasStore = useCanvasStore()
    const router = useRouter()

    const currentTask = computed(() => props.contextTask || props.task)
    const isBatchOperation = computed(() => (props.selectedCount || 0) > 1)

    const handleEdit = () => {
        if (currentTask.value && !isBatchOperation.value) {
            emit('edit', currentTask.value.id)
        }
        emit('close')
    }

    const setDueDate = async (dateType: string, customDate?: string) => {
        if (!currentTask.value) return

        if (isBatchOperation.value) {
            emit('setDueDate', dateType as any)
            emit('close')
            return
        }

        // Handle custom date from date picker
        if (dateType === 'custom' && customDate) {
            try {
                await taskStore.updateTaskWithUndo(currentTask.value.id, { dueDate: customDate })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error updating task due date:', error)
            }
            emit('close')
            return
        }

        const today = new Date()
        let dueDate: Date | null = null

        switch (dateType) {
            case 'today':
                dueDate = today
                break
            case 'tomorrow':
                dueDate = new Date(today)
                dueDate.setDate(today.getDate() + 1)
                break
            case 'weekend': {
                dueDate = new Date(today)
                const daysUntilSaturday = (6 - today.getDay()) % 7 || 7
                dueDate.setDate(today.getDate() + daysUntilSaturday)
                break
            }
            case 'nextweek': {
                dueDate = new Date(today)
                const daysUntilNextMonday = (8 - today.getDay()) % 7 || 7
                dueDate.setDate(today.getDate() + daysUntilNextMonday)
                break
            }
            case 'nextmonth': {
                dueDate = new Date(today)
                dueDate.setMonth(today.getMonth() + 1)
                break
            }
            case 'twomonths': {
                dueDate = new Date(today)
                dueDate.setMonth(today.getMonth() + 2)
                break
            }
            case 'nextquarter': {
                dueDate = new Date(today)
                dueDate.setMonth(today.getMonth() + 3)
                break
            }
            case 'custom': {
                // Custom date provided from date picker (second parameter)
                // This is handled by the component passing the formatted date
                emit('close')
                return
            }
            default:
                return
        }

        if (dueDate) {
            try {
                // Use ISO date format (YYYY-MM-DD) for Supabase compatibility
                const formattedDate = dueDate.toISOString().split('T')[0]
                await taskStore.updateTaskWithUndo(currentTask.value.id, { dueDate: formattedDate })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error setting due date:', error)
            }
        }
        emit('close')
    }

    const setPriority = async (priority: 'high' | 'medium' | 'low') => {
        if (isBatchOperation.value) {
            emit('setPriority', priority)
        } else if (currentTask.value) {
            try {
                await taskStore.updateTaskWithUndo(currentTask.value.id, { priority })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error setting priority:', error)
            }
        }
        emit('close')
    }

    const setStatus = async (status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold') => {
        if (isBatchOperation.value) {
            emit('setStatus', status as any)
        } else if (currentTask.value) {
            try {
                await taskStore.updateTaskWithUndo(currentTask.value.id, { status })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error setting status:', error)
            }
        }
        emit('close')
    }

    const setDuration = async (duration: number | null) => {
        if (isBatchOperation.value) {
            emit('setDuration', duration)
        } else if (currentTask.value) {
            try {
                await taskStore.updateTaskWithUndo(currentTask.value.id, { estimatedDuration: duration ?? undefined })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error setting estimated duration:', error)
            }
        }
        emit('close')
    }

    const toggleDone = async () => {
        if (isBatchOperation.value) {
            emit('setStatus', 'done')
        } else if (currentTask.value) {
            const newStatus = currentTask.value.status === 'done' ? 'planned' : 'done'
            try {
                await taskStore.updateTaskWithUndo(currentTask.value.id, { status: newStatus })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error toggling done status:', error)
            }
        }
        emit('close')
    }

    const startTaskNow = async () => {
        if (currentTask.value && !isBatchOperation.value) {
            taskStore.startTaskNowWithUndo(currentTask.value.id)
            // BUG-1051: AWAIT for timer sync
            await timerStore.startTimer(currentTask.value.id, timerStore.settings.workDuration, false)

            if (router.currentRoute.value.name !== 'calendar') {
                router.push('/calendar')
            }

            window.dispatchEvent(new CustomEvent('start-task-now', {
                detail: { taskId: currentTask.value.id }
            }))
        }
        emit('close')
    }

    const startTimer = async () => {
        console.log('🎯 [CONTEXT-MENU] startTimer called', {
            currentTask: currentTask.value?.id,
            currentTaskTitle: currentTask.value?.title,
            isBatchOperation: isBatchOperation.value,
            workDuration: timerStore.settings.workDuration
        })
        if (currentTask.value && !isBatchOperation.value) {
            // BUG-1051: AWAIT for timer sync
            await timerStore.startTimer(currentTask.value.id, timerStore.settings.workDuration, false)
        } else {
            console.warn('🎯 [CONTEXT-MENU] Timer not started:', {
                hasCurrentTask: !!currentTask.value,
                isBatchOperation: isBatchOperation.value
            })
        }
        emit('close')
    }

    const duplicateTask = async () => {
        if (currentTask.value && !isBatchOperation.value) {
            try {
                await taskStore.createTaskWithUndo({
                    title: currentTask.value.title + ' (Copy)',
                    description: currentTask.value.description,
                    status: currentTask.value.status,
                    priority: currentTask.value.priority
                })
            } catch (error) {
                console.error('Error duplicating task:', error)
            }
        }
        emit('close')
    }

    const deleteTask = () => {
        if (isBatchOperation.value) {
            emit('deleteSelected')
        } else if (currentTask.value) {
            const taskData = currentTask.value as unknown as { instanceId?: string; isCalendarEvent?: boolean }
            emit('confirmDelete', currentTask.value.id, taskData.instanceId, taskData.isCalendarEvent)
        }
        emit('close')
    }

    const clearSelection = () => {
        emit('clearSelection')
        emit('close')
    }

    return {
        currentTask,
        isBatchOperation,
        handleEdit,
        setDueDate,
        setPriority,
        setStatus,
        setDuration,
        toggleDone,
        startTaskNow,
        startTimer,
        duplicateTask,
        deleteTask,
        clearSelection
    }
}
