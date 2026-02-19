
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskStore } from '@/stores/tasks'
import { useTimerStore } from '@/stores/timer'
import { useCanvasStore } from '@/stores/canvas'
import type { Task } from '@/stores/tasks'

// Dispatch event to trigger brief flash animation on task card
function flashTaskCard(taskId: string): void {
    console.log('[FLASH] Dispatching task-action-flash for:', taskId)
    window.dispatchEvent(new CustomEvent('task-action-flash', { detail: { taskId } }))
}

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
        // BUG-1184: Capture task data BEFORE closing menu (same pattern as BUG-1090)
        // When emit('close') is called, parent sets props to null, making currentTask.value null
        const taskId = currentTask.value?.id
        const isBatch = isBatchOperation.value
        // TASK-1362: Capture calendar instance info before menu closes
        const calendarInstanceId = (currentTask.value as any)?.instanceId as string | undefined
        const isCalendarEvent = (currentTask.value as any)?.isCalendarEvent as boolean | undefined

        // BUG-1095: Close menu FIRST to prevent "stuck" menu
        emit('close')

        if (!taskId) return

        if (isBatch) {
            emit('setDueDate', dateType as any)
            return
        }

        // Handle custom date from date picker
        if (dateType === 'custom' && customDate) {
            try {
                await taskStore.updateTaskWithUndo(taskId, { dueDate: customDate })
                // TASK-1362: Also move calendar instance to new date
                if (isCalendarEvent && calendarInstanceId) {
                    await taskStore.updateTaskInstance(taskId, calendarInstanceId, { scheduledDate: customDate })
                }
                canvasStore.requestSync('user:context-menu')
                flashTaskCard(taskId)
            } catch (error) {
                console.error('Error updating task due date:', error)
            }
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
                // BUG-1065 FIX: "+1wk" should add exactly 7 days, not find "next Monday"
                dueDate = new Date(today)
                dueDate.setDate(today.getDate() + 7)
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
            case 'halfyear': {
                dueDate = new Date(today)
                dueDate.setMonth(today.getMonth() + 6)
                break
            }
            case 'custom': {
                // Custom date provided from date picker (second parameter)
                // This is handled by the component passing the formatted date
                return
            }
            default:
                return
        }

        if (dueDate) {
            try {
                // Use ISO date format (YYYY-MM-DD) for Supabase compatibility
                const formattedDate = dueDate.toISOString().split('T')[0]
                await taskStore.updateTaskWithUndo(taskId, { dueDate: formattedDate })
                // TASK-1362: Also move calendar instance to the new date
                if (isCalendarEvent && calendarInstanceId) {
                    await taskStore.updateTaskInstance(taskId, calendarInstanceId, { scheduledDate: formattedDate })
                }
                canvasStore.requestSync('user:context-menu')
                flashTaskCard(taskId)
            } catch (error) {
                console.error('Error setting due date:', error)
            }
        }
    }

    const setPriority = async (priority: 'high' | 'medium' | 'low') => {
        // BUG-1184: Capture task data BEFORE closing menu (same pattern as BUG-1090)
        const taskId = currentTask.value?.id
        const isBatch = isBatchOperation.value

        // BUG-1095: Close menu FIRST to prevent "stuck" menu
        emit('close')

        if (isBatch) {
            emit('setPriority', priority)
        } else if (taskId) {
            try {
                await taskStore.updateTaskWithUndo(taskId, { priority })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error setting priority:', error)
            }
        }
    }

    const setStatus = async (status: 'planned' | 'in_progress' | 'done' | 'backlog' | 'on_hold') => {
        // BUG-1184: Capture task data BEFORE closing menu (same pattern as BUG-1090)
        const taskId = currentTask.value?.id
        const isBatch = isBatchOperation.value

        // BUG-1095: Close menu FIRST to prevent "stuck" menu
        emit('close')

        if (isBatch) {
            emit('setStatus', status as any)
        } else if (taskId) {
            try {
                await taskStore.updateTaskWithUndo(taskId, { status })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error setting status:', error)
            }
        }
    }

    const setDuration = async (duration: number | null) => {
        // BUG-1184: Capture task data BEFORE closing menu (same pattern as BUG-1090)
        const taskId = currentTask.value?.id
        const isBatch = isBatchOperation.value

        // BUG-1095: Close menu FIRST to prevent "stuck" submenu
        emit('close')

        if (isBatch) {
            emit('setDuration', duration)
        } else if (taskId) {
            try {
                await taskStore.updateTaskWithUndo(taskId, { estimatedDuration: duration ?? undefined })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error setting estimated duration:', error)
            }
        }
    }

    const toggleDone = async () => {
        // BUG-1184: Capture task data BEFORE closing menu (same pattern as BUG-1090)
        const taskId = currentTask.value?.id
        const currentStatus = currentTask.value?.status
        const isBatch = isBatchOperation.value

        // BUG-1095: Close menu FIRST to prevent "stuck" menu
        emit('close')

        if (isBatch) {
            emit('setStatus', 'done')
        } else if (taskId) {
            const newStatus = currentStatus === 'done' ? 'planned' : 'done'
            try {
                await taskStore.updateTaskWithUndo(taskId, { status: newStatus })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error toggling done status:', error)
            }
        }
    }

    const startTaskNow = async () => {
        // BUG-1090: Capture task data BEFORE closing menu
        // When emit('close') is called, parent sets props to null, making currentTask.value null
        const taskId = currentTask.value?.id
        const taskTitle = currentTask.value?.title
        const isBatch = isBatchOperation.value

        // BUG-1095: Close menu FIRST to prevent "stuck" menu
        emit('close')

        console.log('🎯 [CONTEXT-MENU] startTaskNow called', {
            taskId,
            taskTitle,
            isBatch
        })

        if (taskId && !isBatch) {
            // Step 1: Create calendar instance at current time
            // BUG-1291: startTaskNow APPENDS (never replaces), so existing instances are preserved.
            // No guard needed — append logic is the protection against the "start time moves" bug.
            try {
                console.log('🎯 [CONTEXT-MENU] Creating calendar instance at current time...')
                await taskStore.startTaskNowWithUndo(taskId)
                console.log('🎯 [CONTEXT-MENU] Task instance created successfully')
            } catch (error) {
                console.error('🎯 [CONTEXT-MENU] Failed to create calendar instance:', error)
            }

            // Step 2: Always start timer (independent of instance creation)
            try {
                console.log('🎯 [CONTEXT-MENU] Starting timer...')
                await timerStore.startTimer(taskId, timerStore.settings.workDuration, false)
                console.log('🎯 [CONTEXT-MENU] Timer started successfully')
            } catch (error) {
                console.error('🎯 [CONTEXT-MENU] Failed to start timer:', error)
            }

            // Step 3: Navigate to calendar
            try {
                if (router.currentRoute.value.name !== 'calendar') {
                    console.log('🎯 [CONTEXT-MENU] Navigating to calendar with startNow param')
                    await router.push({ path: '/calendar', query: { startNow: 'true' } })
                } else {
                    console.log('🎯 [CONTEXT-MENU] Already on calendar, dispatching event')
                    window.dispatchEvent(new CustomEvent('start-task-now', {
                        detail: { taskId }
                    }))
                }
            } catch (error) {
                console.error('🎯 [CONTEXT-MENU] Navigation failed:', error)
            }
        } else {
            console.warn('🎯 [CONTEXT-MENU] startTaskNow skipped:', {
                hasTaskId: !!taskId,
                isBatch
            })
        }
    }

    const startTimer = async () => {
        // BUG-1090: Capture task data BEFORE closing menu
        // When emit('close') is called, parent sets props to null, making currentTask.value null
        const taskId = currentTask.value?.id
        const taskTitle = currentTask.value?.title
        const isBatch = isBatchOperation.value
        const workDuration = timerStore.settings.workDuration

        // BUG-1095: Close menu FIRST to prevent "stuck" menu
        emit('close')

        console.log('🎯 [CONTEXT-MENU] startTimer called', {
            taskId,
            taskTitle,
            isBatch,
            workDuration
        })

        if (taskId && !isBatch) {
            // BUG-1051: AWAIT for timer sync
            await timerStore.startTimer(taskId, workDuration, false)
        } else {
            console.warn('🎯 [CONTEXT-MENU] Timer not started:', {
                hasTaskId: !!taskId,
                isBatch
            })
        }
    }

    const setProject = async (projectId: string | null) => {
        // TASK-1336: Capture task data BEFORE closing menu (same pattern as BUG-1090)
        const taskId = currentTask.value?.id
        const isBatch = isBatchOperation.value

        emit('close')

        if (isBatch) {
            // Batch project change not supported yet
            return
        }

        if (taskId) {
            try {
                await taskStore.updateTaskWithUndo(taskId, {
                    projectId: projectId ?? undefined,
                    isUncategorized: !projectId
                })
                canvasStore.requestSync('user:context-menu')
            } catch (error) {
                console.error('Error setting project:', error)
            }
        }
    }

    const duplicateTask = async () => {
        // BUG-1184: Capture task data BEFORE closing menu (same pattern as BUG-1090)
        const taskData = currentTask.value ? {
            title: currentTask.value.title,
            description: currentTask.value.description,
            status: currentTask.value.status,
            priority: currentTask.value.priority,
            estimatedDuration: currentTask.value.estimatedDuration,
            instanceId: (currentTask.value as Task & { instanceId?: string }).instanceId,
            isCalendarEvent: Boolean((currentTask.value as Task & { isCalendarEvent?: boolean }).isCalendarEvent),
            instances: currentTask.value.instances ? [...currentTask.value.instances] : []
        } : null
        const isBatch = isBatchOperation.value

        // BUG-1095: Close menu FIRST to prevent "stuck" menu
        emit('close')

        if (taskData && !isBatch) {
            try {
                let duplicatedInstances: Task['instances']

                // BUG-1369: In calendar context, duplicate the active calendar instance
                // so the new copy appears immediately in the same day/week view.
                if (taskData.isCalendarEvent && taskData.instanceId) {
                    const sourceInstance = taskData.instances.find(inst => inst.id === taskData.instanceId)
                    if (sourceInstance?.scheduledDate) {
                        duplicatedInstances = [{
                            id: `instance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                            scheduledDate: sourceInstance.scheduledDate,
                            scheduledTime: sourceInstance.scheduledTime,
                            duration: sourceInstance.duration ?? taskData.estimatedDuration,
                            status: 'scheduled',
                            isRecurring: false
                        }]
                    }
                }

                await taskStore.createTaskWithUndo({
                    title: taskData.title + ' (Copy)',
                    description: taskData.description,
                    status: taskData.status,
                    priority: taskData.priority,
                    estimatedDuration: taskData.estimatedDuration,
                    instances: duplicatedInstances
                })
            } catch (error) {
                console.error('Error duplicating task:', error)
            }
        }
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
        setProject,
        toggleDone,
        startTaskNow,
        startTimer,
        duplicateTask,
        deleteTask,
        clearSelection
    }
}
