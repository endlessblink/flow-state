import { transactionManager } from '@/services/sync/TransactionManager'
import { type Ref } from 'vue'
import type { Task, Subtask, TaskInstance } from '@/types/tasks'
import { taskDisappearanceLogger } from '@/utils/taskDisappearanceLogger'
import { guardTaskCreation } from '@/utils/demoContentGuard'
import { STORAGE_FLAGS } from '@/config/database'
import {
    deleteTask as _deleteIndividualTask,
    deleteTasks as _deleteIndividualTasksBulk
} from '@/utils/individualTaskStorage'
import { formatDateKey } from '@/utils/dateUtils'

import { useSmartViews } from '@/composables/useSmartViews'
import { useProjectStore } from '../projects'

export function useTaskOperations(
    tasks: Ref<Task[]>,
    selectedTaskIds: Ref<string[]>,
    activeSmartView: Ref<any>,
    activeStatusFilter: Ref<string | null>,
    activeDurationFilter: Ref<any>,
    hideDoneTasks: Ref<boolean>,
    hideCanvasDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks: Ref<boolean>,
    manualOperationInProgress: Ref<boolean>,
    saveTasksToStorage: (tasks: Task[], context: string) => Promise<void>,
    persistFilters: () => void,
    _runAllTaskMigrations: () => void
) {
    const projectStore = useProjectStore()

    const createTask = async (taskData: Partial<Task>) => {
        // TASK-061: Demo content guard - warn in dev mode
        if (taskData.title) {
            guardTaskCreation(taskData.title)
        }

        const taskId = Date.now().toString()
        manualOperationInProgress.value = true

        let txId: string | null = null
        try {
            // WAL Logic
            txId = await transactionManager.beginTransaction('create', 'tasks', { ...taskData, id: taskId })

            const instances: TaskInstance[] = []
            if (taskData.scheduledDate && taskData.scheduledTime) {
                const now = new Date()
                instances.push({
                    id: `instance-${taskId}-${Date.now()}`,
                    taskId: taskId,
                    scheduledDate: taskData.scheduledDate,
                    scheduledTime: taskData.scheduledTime,
                    duration: taskData.estimatedDuration || 25,
                    status: 'scheduled',
                    isRecurring: false,
                    createdAt: now,
                    updatedAt: now
                })
            }

            let projectId = taskData.projectId || 'uncategorized'
            if (taskData.parentTaskId) {
                const parentTask = tasks.value.find(t => t.id === taskData.parentTaskId)
                if (parentTask) projectId = parentTask.projectId
            }

            const { canvasPosition: explicitCanvasPosition, ...taskDataWithoutPosition } = taskData

            const newTask: Task = {
                id: taskId,
                title: taskData.title || 'New Task',
                description: taskData.description || 'Task description...',
                status: taskData.status || 'planned',
                priority: taskData.priority || 'medium',
                progress: 0,
                completedPomodoros: 0,
                subtasks: [],
                dueDate: taskData.dueDate || new Date().toISOString().split('T')[0],
                projectId,
                createdAt: new Date(),
                updatedAt: new Date(),
                instances,
                isInInbox: taskData.isInInbox !== false,
                canvasPosition: explicitCanvasPosition || undefined,
                ...taskDataWithoutPosition
            }

            tasks.value.push(newTask)
            await saveTasksToStorage(tasks.value, `createTask-${newTask.id}`)

            // Commit WAL
            if (txId) await transactionManager.commit(txId)

            return newTask
        } catch (error) {
            if (txId) await transactionManager.rollback(txId, error)
            const index = tasks.value.findIndex(t => t.id === taskId)
            if (index !== -1) tasks.value.splice(index, 1)
            throw error
        } finally {
            manualOperationInProgress.value = false
        }
    }

    const updateTask = async (taskId: string, updates: Partial<Task>) => {
        const index = tasks.value.findIndex(t => t.id === taskId)
        if (index === -1) return

        const task = tasks.value[index]

        // WAL Logic
        let txId: string | null = null
        try {
            txId = await transactionManager.beginTransaction('update', 'tasks', { taskId, updates })
        } catch (e) {
            console.warn('WAL Write failed during update, proceeding anyway', e)
        }

        // BUG-045 FIX: Removed auto-archive behavior
        // Tasks now stay on canvas when marked as done (no position/inbox changes)

        // Canvas logic
        if (updates.canvasPosition && !task.canvasPosition) {
            updates.isInInbox = false
        }

        if (updates.canvasPosition === undefined && task.canvasPosition && !updates.instances && (!task.instances || !task.instances.length)) {
            updates.isInInbox = true
        }

        // Project logic
        if ('projectId' in updates) {
            const isUncategorized = !updates.projectId || updates.projectId === '1' || updates.projectId === 'uncategorized'
            updates.isUncategorized = isUncategorized
        }

        // Orphan prevention
        const finalInInbox = updates.isInInbox ?? task.isInInbox
        const finalPos = updates.canvasPosition ?? task.canvasPosition
        const finalInst = updates.instances ?? task.instances
        if (!finalInInbox && !finalPos && (!finalInst || !finalInst.length)) {
            updates.isInInbox = true
        }

        tasks.value[index] = { ...task, ...updates, updatedAt: new Date() }

        // BUG-060 FIX: Save immediately to prevent data loss on quick refresh
        // Previously relied on 1-second debounced watcher which could miss quick refreshes
        try {
            await saveTasksToStorage(tasks.value, `updateTask-${taskId}`)
            if (txId) await transactionManager.commit(txId)
        } catch (error) {
            if (txId) await transactionManager.rollback(txId, error)
            console.error(`❌ [BUG-060] Failed to save task update for ${taskId}:`, error)
        }
    }

    const deleteTask = async (taskId: string) => {
        const index = tasks.value.findIndex(t => t.id === taskId)
        if (index === -1) return

        const deletedTask = tasks.value[index]
        taskDisappearanceLogger.markUserDeletion(taskId)
        manualOperationInProgress.value = true

        let txId: string | null = null
        try {
            txId = await transactionManager.beginTransaction('delete', 'tasks', { taskId })

            tasks.value.splice(index, 1)
            const taskTitle = deletedTask?.title || 'unknown'
            taskDisappearanceLogger.takeSnapshot(tasks.value, `deleteTask-${taskTitle.substring(0, 30)}`)

            const dbInstance = (window as any).pomoFlowDb
            if (dbInstance && (STORAGE_FLAGS.DUAL_WRITE_TASKS || STORAGE_FLAGS.INDIVIDUAL_ONLY)) {
                await _deleteIndividualTask(dbInstance, taskId)

                // Track deletion intent
                try {
                    const doc = await dbInstance.get('_local/deleted-tasks').catch(() => ({ _id: '_local/deleted-tasks', taskIds: [], deletedAt: {} }))
                    if (!doc.taskIds.includes(taskId)) {
                        doc.taskIds.push(taskId)
                        doc.deletedAt[taskId] = new Date().toISOString()
                        await dbInstance.put(doc)
                    }
                } catch { }
            }

            await saveTasksToStorage(tasks.value, `deleteTask-${taskId}`)
            if (txId) await transactionManager.commit(txId)
        } catch (error) {
            if (txId) await transactionManager.rollback(txId, error)
            tasks.value.splice(index, 0, deletedTask)
            throw error
        } finally {
            manualOperationInProgress.value = false
        }
    }

    const bulkDeleteTasks = async (taskIds: string[]) => {
        if (!taskIds.length) return
        manualOperationInProgress.value = true

        let txId: string | null = null
        try {
            txId = await transactionManager.beginTransaction('bulk_update', 'tasks', { type: 'bulk_delete', taskIds })

            const tasksToKeep = tasks.value.filter(t => !taskIds.includes(t.id))
            taskDisappearanceLogger.takeSnapshot(tasksToKeep, `bulkDelete-${taskIds.length} tasks`)
            tasks.value = tasksToKeep

            const dbInstance = (window as any).pomoFlowDb
            if (dbInstance && (STORAGE_FLAGS.DUAL_WRITE_TASKS || STORAGE_FLAGS.INDIVIDUAL_ONLY)) {
                await _deleteIndividualTasksBulk(dbInstance, taskIds)

                try {
                    const doc = await dbInstance.get('_local/deleted-tasks').catch(() => ({ _id: '_local/deleted-tasks', taskIds: [], deletedAt: {} }))
                    let dirty = false
                    const now = new Date().toISOString()
                    taskIds.forEach(id => {
                        if (!doc.taskIds.includes(id)) {
                            doc.taskIds.push(id)
                            doc.deletedAt[id] = now
                            dirty = true
                        }
                    })
                    if (dirty) await dbInstance.put(doc)
                } catch { }
            }

            await saveTasksToStorage(tasks.value, `bulkDelete-${taskIds.length} tasks`)
            if (txId) await transactionManager.commit(txId)
        } catch (error) {
            if (txId) await transactionManager.rollback(txId, error)
            // Note: In bulk delete, we don't easily restore state here if internal array mutation happened but save failed.
            // Ideally we should mutate state AFTER external saves, but that breaks optimistic UI.
            // For now, we accept UI might be out of sync if save fails, but we don't crash.
            throw error
        } finally {
            manualOperationInProgress.value = false
        }
    }

    const moveTask = (taskId: string, newStatus: Task['status']) => {
        updateTask(taskId, { status: newStatus })
    }

    const selectTask = (taskId: string) => {
        if (!selectedTaskIds.value.includes(taskId)) selectedTaskIds.value.push(taskId)
    }

    const deselectTask = (taskId: string) => {
        const idx = selectedTaskIds.value.indexOf(taskId)
        if (idx !== -1) selectedTaskIds.value.splice(idx, 1)
    }

    const clearSelection = () => {
        selectedTaskIds.value = []
    }

    const createSubtask = (taskId: string, subtaskData: Partial<Subtask>) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (!task) return null
        const newSubtask: Subtask = {
            id: Date.now().toString(),
            parentTaskId: taskId,
            title: subtaskData.title || 'New Subtask',
            description: subtaskData.description || '',
            completedPomodoros: 0,
            isCompleted: false,
            createdAt: new Date(),
            updatedAt: new Date()
        }
        task.subtasks.push(newSubtask)
        task.updatedAt = new Date()
        return newSubtask
    }

    const updateSubtask = (taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (!task) return
        const idx = task.subtasks.findIndex(st => st.id === subtaskId)
        if (idx !== -1) {
            task.subtasks[idx] = { ...task.subtasks[idx], ...updates, updatedAt: new Date() }
            task.updatedAt = new Date()
        }
    }

    const deleteSubtask = (taskId: string, subtaskId: string) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (!task) return
        const idx = task.subtasks.findIndex(st => st.id === subtaskId)
        if (idx !== -1) {
            task.subtasks.splice(idx, 1)
            task.updatedAt = new Date()
        }
    }

    const createTaskInstance = (taskId: string, instanceData: Omit<TaskInstance, 'id'>) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (!task) return null
        const newInstance: TaskInstance = {
            id: Date.now().toString(),
            ...instanceData
        }
        if (!task.instances) task.instances = []
        task.instances.push(newInstance)
        task.updatedAt = new Date()
        return newInstance
    }

    const updateTaskInstance = (taskId: string, instanceId: string, updates: Partial<TaskInstance>) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (!task || !task.instances) return
        const idx = task.instances.findIndex(inst => inst.id === instanceId)
        if (idx !== -1) {
            task.instances[idx] = { ...task.instances[idx], ...updates }
            task.updatedAt = new Date()
        }
    }

    const deleteTaskInstance = (taskId: string, instanceId: string) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (!task || !task.instances) return
        const idx = task.instances.findIndex(inst => inst.id === instanceId)
        if (idx !== -1) {
            task.instances.splice(idx, 1)
            task.updatedAt = new Date()
        }
    }

    const startTaskNow = (taskId: string) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (!task) return
        const now = new Date()
        const currentMinutes = now.getMinutes()
        const roundedMinutes = currentMinutes < 30 ? 0 : 30
        const roundedTime = new Date(now)
        roundedTime.setMinutes(roundedMinutes, 0, 0)

        const newInstance = {
            id: `instance-${taskId}-${Date.now()}`,
            scheduledDate: formatDateKey(now),
            scheduledTime: `${roundedTime.getHours().toString().padStart(2, '0')}:${roundedTime.getMinutes().toString().padStart(2, '0')}`,
            duration: task.estimatedDuration || 60
        }
        updateTask(taskId, { instances: [newInstance], status: 'in_progress' })
    }

    const moveTaskToSmartGroup = (taskId: string, type: string) => {
        const today = new Date()
        let dueDate = ''
        switch (type.toLowerCase()) {
            case 'today': dueDate = formatDateKey(today); break
            case 'tomorrow':
                const tom = new Date(today); tom.setDate(today.getDate() + 1); dueDate = formatDateKey(tom); break
            case 'this weekend':
                const sat = new Date(today); sat.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7)); dueDate = formatDateKey(sat); break
            case 'this week':
                const sun = new Date(today); sun.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7)); dueDate = formatDateKey(sun); break
        }
        updateTask(taskId, { dueDate })
    }

    const moveTaskToDate = (taskId: string, dateColumn: string) => {
        const task = tasks.value.find(t => t.id === taskId)
        if (!task) return
        const today = new Date(); today.setHours(0, 0, 0, 0)
        let target: Date | null = null
        switch (dateColumn) {
            case 'overdue': target = new Date(today); target.setDate(today.getDate() - 1); break
            case 'today': target = today; break
            case 'tomorrow': target = new Date(today); target.setDate(today.getDate() + 1); break
            case 'thisWeek': target = new Date(today); target.setDate(today.getDate() + (7 - today.getDay())); break
            case 'nextWeek': target = new Date(today); target.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7)); break
            case 'later': target = new Date(today); target.setDate(today.getDate() + 30); break
        }

        const updates: Partial<Task> = { instances: [], isInInbox: false }
        if (target) {
            updates.instances = [{
                id: `instance-${taskId}-${Date.now()}`,
                scheduledDate: formatDateKey(target),
                scheduledTime: '09:00',
                duration: task.estimatedDuration || 60,
                isLater: dateColumn === 'later'
            }]
        }
        updateTask(taskId, updates)
    }

    const unscheduleTask = (taskId: string) => {
        updateTask(taskId, { instances: [], isInInbox: true })
    }

    const moveTaskToPriority = (taskId: string, priority: Task['priority'] | 'no_priority') => {
        updateTask(taskId, { priority: priority === 'no_priority' ? null : priority })
    }

    const setActiveProject = (projectId: string | null) => {
        projectStore.setActiveProject(projectId)
        persistFilters()
    }

    const setSmartView = (view: any) => {
        activeSmartView.value = view
        persistFilters()
    }

    const toggleHideDoneTasks = () => {
        hideDoneTasks.value = !hideDoneTasks.value
        persistFilters()
    }

    // TASK-076: View-specific done task toggles
    const toggleCanvasDoneTasks = () => {
        hideCanvasDoneTasks.value = !hideCanvasDoneTasks.value
        persistFilters()
    }

    const toggleCalendarDoneTasks = () => {
        hideCalendarDoneTasks.value = !hideCalendarDoneTasks.value
        persistFilters()
    }

    const setActiveStatusFilter = (status: string | null) => {
        activeStatusFilter.value = status
        if (status) activeDurationFilter.value = null
        persistFilters()
    }

    const toggleStatusFilter = (status: string) => {
        setActiveStatusFilter(activeStatusFilter.value === status ? null : status)
    }

    const setActiveDurationFilter = (duration: any) => {
        activeDurationFilter.value = duration
        if (duration) activeStatusFilter.value = null
        persistFilters()
    }

    const toggleDurationFilter = (duration: any) => {
        setActiveDurationFilter(activeDurationFilter.value === duration ? null : duration)
    }

    const getTask = (taskId: string) => tasks.value.find(t => t.id === taskId)

    const getUncategorizedTaskCount = () => {
        const { isUncategorizedTask } = useSmartViews()
        return tasks.value.filter(t => t.status !== 'done' && isUncategorizedTask(t)).length
    }

    const getNestedTasks = (parent: string | null = null) => tasks.value.filter(t => t.parentTaskId === parent)
    const getTaskChildren = (taskId: string) => tasks.value.filter(t => t.parentTaskId === taskId)
    const getTaskHierarchy = (taskId: string) => {
        const list: Task[] = []
        let curr: string | null = taskId
        while (curr) {
            const t = getTask(curr)
            if (!t) break
            list.unshift(t)
            curr = t.parentTaskId || null
        }
        return list
    }
    const isNestedTask = (id: string) => !!getTask(id)?.parentTaskId
    const hasNestedTasks = (id: string) => tasks.value.some(t => t.parentTaskId === id)

    return {
        createTask,
        updateTask,
        deleteTask,
        bulkDeleteTasks,
        moveTask,
        selectTask,
        deselectTask,
        clearSelection,
        createSubtask,
        updateSubtask,
        deleteSubtask,
        createTaskInstance,
        updateTaskInstance,
        deleteTaskInstance,
        startTaskNow,
        moveTaskToSmartGroup,
        moveTaskToDate,
        unscheduleTask,
        moveTaskToPriority,
        setActiveProject,
        setSmartView,
        toggleHideDoneTasks,
        toggleCanvasDoneTasks,
        toggleCalendarDoneTasks,
        setActiveStatusFilter,
        toggleStatusFilter,
        setActiveDurationFilter,
        toggleDurationFilter,
        getTask,
        getUncategorizedTaskCount,
        getNestedTasks,
        getTaskChildren,
        getTaskHierarchy,
        isNestedTask,
        hasNestedTasks
    }
}
