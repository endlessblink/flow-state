// TASK-129: Removed transactionManager (PouchDB WAL stub no longer needed)
import { type Ref } from 'vue'
import type { Task, Subtask, TaskInstance } from '@/types/tasks'
// TASK-127: Removed taskDisappearanceLogger (PouchDB-era debugging tool)
import { guardTaskCreation } from '@/utils/demoContentGuard'
import { formatDateKey } from '@/utils/dateUtils'
// TASK-089 FIX: Unlock position when removing from canvas
// TASK-131 FIX: Protect locked positions from being overwritten by stale sync data

// =============================================================================
// GEOMETRY WRITE SOURCE (TASK-255 Geometry Invariants)
// =============================================================================
// Tracks the origin of geometry mutations for drift detection.
// - 'DRAG': User drag/drop operations (ALLOWED)
// - 'RECONCILE': One-time parent reconciliation on load (CONTROLLED)
// - 'USER': Explicit user actions like move-to-inbox (ALLOWED)
// - 'SYNC': Remote sync updates (SHOULD NOT change geometry)
// - 'SMART-GROUP': Smart group property application (METADATA ONLY - no geometry!)
// =============================================================================
export type GeometryWriteSource = 'DRAG' | 'RECONCILE' | 'USER' | 'SYNC' | 'SMART-GROUP'

import { useSmartViews } from '@/composables/useSmartViews'
import { useProjectStore } from '../projects'

export function useTaskOperations(
    // SAFETY: Named _rawTasks to indicate this is the raw array for mutations
    _rawTasks: Ref<Task[]>,
    selectedTaskIds: Ref<string[]>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeSmartView: Ref<any>,
    activeStatusFilter: Ref<string | null>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeDurationFilter: Ref<any>,
    hideDoneTasks: Ref<boolean>,
    hideCanvasDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks: Ref<boolean>,
    hideCanvasOverdueTasks: Ref<boolean>,
    manualOperationInProgress: Ref<boolean>,
    saveTasksToStorage: (tasks: Task[], context: string) => Promise<void>,
    saveSpecificTasks: (tasks: Task[], context: string) => Promise<void>,
    deleteTaskFromStorage: (taskId: string) => Promise<void>,
    bulkDeleteTasksFromStorage: (taskIds: string[]) => Promise<void>,  // BUG-025: Atomic bulk delete
    persistFilters: () => void,
    _runAllTaskMigrations: () => void
) {
    const projectStore = useProjectStore()

    // Helper to trigger canvas sync after task operations
    // This bypasses Vue's watch system which has timing issues in Tauri/WebKitGTK
    // DRIFT FIX: Now requires explicit source to prevent automated sync loops
    const triggerCanvasSync = (source: 'user:create' | 'user:delete' | 'user:context-menu' = 'user:create') => {
        // Dynamic import to avoid circular dependency and context issues
        import('../canvas/canvasUi').then(({ useCanvasUiStore }) => {
            const canvasUiStore = useCanvasUiStore()
            canvasUiStore.requestSync(source)
        }).catch(_e => {
            // Ignore if canvas store not available (e.g., in non-canvas views)
        })
    }

    const createTask = async (taskData: Partial<Task>) => {
        // TASK-061: Demo content guard - warn in dev mode
        if (taskData.title) {
            guardTaskCreation(taskData.title)
        }

        // BUG-336: Preserve task ID if provided (needed for undo restore)
        const taskId = taskData.id || crypto.randomUUID()
        manualOperationInProgress.value = true

        try {
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
                const parentTask = _rawTasks.value.find(t => t.id === taskData.parentTaskId)
                if (parentTask) projectId = parentTask.projectId
            }

            const { canvasPosition: explicitCanvasPosition, ...taskDataWithoutPosition } = taskData

            const newTask: Task = {
                id: taskId,
                title: taskData.title || 'New Task',
                description: taskData.description || '',
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
                positionVersion: 1, // Start at version 1
                positionFormat: taskData.positionFormat || 'absolute', // Default to absolute
                ...taskDataWithoutPosition
            }

            _rawTasks.value.push(newTask)
            await saveSpecificTasks([newTask], `createTask-${newTask.id}`)

            // Trigger canvas sync for Tauri reactivity
            triggerCanvasSync()

            return newTask
        } catch (error) {
            const index = _rawTasks.value.findIndex(t => t.id === taskId)
            if (index !== -1) _rawTasks.value.splice(index, 1)
            throw error
        } finally {
            manualOperationInProgress.value = false
        }
    }

    /**
     * Update a task with optional geometry write source tracking (TASK-255)
     *
     * @param taskId - The ID of the task to update
     * @param updates - Partial task updates to apply
     * @param source - Origin of the update for drift detection (default: 'USER')
     *
     * GEOMETRY INVARIANT: Only 'DRAG' and 'USER' sources should include
     * parentId or canvasPosition changes. If 'SYNC' or 'SMART-GROUP' sources
     * include geometry changes, a warning will be logged.
     */
    const updateTask = async (taskId: string, updates: Partial<Task>, source: GeometryWriteSource = 'USER') => {
        const index = _rawTasks.value.findIndex(t => t.id === taskId)
        if (index === -1) return

        // BUG-060 FIX: Suppress watcher during manual update to prevent concurrent bulk saves
        // This prevents the "8 conflicts in bulk save" issue
        const wasManualInProgress = manualOperationInProgress.value
        if (!wasManualInProgress) manualOperationInProgress.value = true

        try {
            const task = _rawTasks.value[index]

            // GEOMETRY DRIFT DETECTION (TASK-255): Track and warn about geometry changes
            const hasGeometryChange = ('parentId' in updates && updates.parentId !== task.parentId) ||
                ('canvasPosition' in updates && updates.canvasPosition !== undefined &&
                    (task.canvasPosition?.x !== updates.canvasPosition?.x ||
                        task.canvasPosition?.y !== updates.canvasPosition?.y))

            // Warn if non-allowed sources try to change geometry
            if (hasGeometryChange && (source === 'SYNC' || source === 'SMART-GROUP')) {
                console.warn(`⚠️ [GEOMETRY-DRIFT] Source '${source}' is changing geometry - this may cause position drift!`, {
                    taskId: taskId.slice(0, 8),
                    taskTitle: task.title?.slice(0, 30),
                    parentIdChange: 'parentId' in updates,
                    positionChange: 'canvasPosition' in updates
                })
            }

            // DRIFT LOGGING: Track when parentId or canvasPosition is changed
            // This helps identify non-drag flows that mutate hierarchy/positions
            if ('parentId' in updates && updates.parentId !== task.parentId) {
                console.log(`📍 [GEOMETRY-${source}] Task ${taskId.slice(0, 8)}... parentId: "${task.parentId ?? 'none'}" → "${updates.parentId ?? 'none'}"`, {
                    taskTitle: task.title?.slice(0, 30),
                    source,
                    stack: new Error().stack?.split('\n').slice(2, 5).join(' <- ')
                })
            }
            if ('canvasPosition' in updates && updates.canvasPosition !== undefined) {
                const oldPos = task.canvasPosition
                const newPos = updates.canvasPosition
                if (oldPos?.x !== newPos?.x || oldPos?.y !== newPos?.y) {
                    console.log(`📍 [GEOMETRY-${source}] Task ${taskId.slice(0, 8)}... pos: (${oldPos?.x?.toFixed(0) ?? '?'},${oldPos?.y?.toFixed(0) ?? '?'}) → (${newPos?.x?.toFixed(0) ?? 'null'},${newPos?.y?.toFixed(0) ?? 'null'})`, {
                        taskTitle: task.title?.slice(0, 30),
                        source,
                        stack: new Error().stack?.split('\n').slice(2, 5).join(' <- ')
                    })
                }
            }

            // BUG-045 FIX: Removed auto-archive behavior
            // Tasks now stay on canvas when marked as done (no position/inbox changes)

            // Canvas logic
            if (updates.canvasPosition && !task.canvasPosition) {
                updates.isInInbox = false
            }

            // BUG-FIX: Explicitly unlock position if removing from canvas
            // This prevents sync from restoring the position due to "Preserve local canvasPosition" logic
            if (updates.canvasPosition === null) {
                // Position will be cleared by the update
            }

            // TASK-131 FIX: Protect locked positions from being overwritten by stale sync data
            // If a position lock (pending change) exists, use that position instead of the update
            if (updates.canvasPosition && updates.canvasPosition !== null) {
                // Position lock protection handled by persistence logic
            }

            if (updates.canvasPosition === undefined && task.canvasPosition && !updates.instances && (!task.instances || !task.instances.length)) {
                // updates.isInInbox = true // Wait, why force inbox true if just position is undefined but task has position? 
                // This logic implies check if task HAS position.
                // Let's log if this triggers.
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
                // updates.isInInbox = true
            }

            // TASK-240: Handle position versioning
            const currentVersion = task.positionVersion || 0
            const newVersion = updates.canvasPosition ? currentVersion + 1 : currentVersion

            // DONE-ZONE: Track completedAt when task status changes to/from 'done'
            // This enables age-based filtering for Done Zone (1-7 days) vs Inbox (7+ days)
            if ('status' in updates) {
                const wasNotDone = task.status !== 'done'
                const isNowDone = updates.status === 'done'
                const wasDone = task.status === 'done'
                const isNowNotDone = updates.status !== 'done'

                // Set completedAt when status changes TO 'done'
                if (wasNotDone && isNowDone) {
                    updates.completedAt = new Date()
                    console.log(`✅ [DONE-ZONE] Task "${task.title?.slice(0, 30)}" marked done, completedAt set`)
                }
                // Clear completedAt when status changes FROM 'done' (task reopened)
                else if (wasDone && isNowNotDone) {
                    updates.completedAt = undefined
                    console.log(`🔄 [DONE-ZONE] Task "${task.title?.slice(0, 30)}" reopened, completedAt cleared`)
                }
            }

            _rawTasks.value[index] = {
                ...task,
                ...updates,
                positionVersion: newVersion,
                updatedAt: new Date()
            }

            // BUG-060 FIX: Save immediately to prevent data loss on quick refresh
            try {
                await saveSpecificTasks([_rawTasks.value[index]], `updateTask-${taskId}`)

                // DRIFT FIX: REMOVED triggerCanvasSync() - this was causing sync loops!
                // When Smart-Group applied properties → updateTask → triggerCanvasSync →
                // syncNodes → Smart-Group applied again → infinite loop
                // Canvas sync should ONLY happen on explicit user drag/drop actions,
                // not on every task property update. Vue reactivity handles UI updates.
            } catch (error) {
                console.error(`❌ [BUG-060] Failed to save task update for ${taskId}:`, error)
                // Note: We don't rollback memory state here to preserve UX, relying on "last write wins" locally
            }
        } finally {
            if (!wasManualInProgress) manualOperationInProgress.value = false
        }
    }

    const deleteTask = async (taskId: string) => {
        const index = _rawTasks.value.findIndex(t => t.id === taskId)
        if (index === -1) return

        const deletedTask = _rawTasks.value[index]
        manualOperationInProgress.value = true

        try {
            // BUGFIX: Persist deletion to Supabase FIRST (soft delete)
            // This ensures task won't reappear on refresh
            await deleteTaskFromStorage(taskId)

            _rawTasks.value.splice(index, 1)

            // Save to localStorage AFTER splice (for guest mode persistence)
            await saveTasksToStorage(_rawTasks.value, 'deleteTask')

            // TASK-131: Removed triggerCanvasSync() - surgical deletion watcher in CanvasView handles this
            // The watcher detects the deletion and removes only the affected node, preventing position resets
        } catch (error) {
            _rawTasks.value.splice(index, 0, deletedTask)
            console.error(`❌ [DELETE] Failed to delete task ${taskId}:`, error)
            throw error
        } finally {
            manualOperationInProgress.value = false
        }
    }

    // [DEEP-DIVE FIX] Added permanent delete operation
    const permanentlyDeleteTask = async (taskId: string) => {
        const index = _rawTasks.value.findIndex(t => t.id === taskId)
        if (index === -1) return

        manualOperationInProgress.value = true
        try {
            // 1. Remove from local state immediately (Optimistic UI)
            _rawTasks.value.splice(index, 1)

            // 2. Call TrashService for DB removal (Hard Delete)
            const { trashService } = await import('@/services/trash/TrashService')
            await trashService.permanentlyDeleteTask(taskId)

            // 3. Ensure no artifacts remain in individual storage if needed
        } catch (error) {
            console.error(`❌ Failed to permanently delete ${taskId}:`, error)
        } finally {
            manualOperationInProgress.value = false
        }
    }

    // BUG-025 FIX: Atomic bulk delete using Supabase .in() operator
    const bulkDeleteTasks = async (taskIds: string[]) => {
        if (!taskIds.length) return
        manualOperationInProgress.value = true

        try {
            // BUG-025 FIX: Use atomic bulk delete instead of looping
            await bulkDeleteTasksFromStorage(taskIds)

            const tasksToKeep = _rawTasks.value.filter(t => !taskIds.includes(t.id))
            _rawTasks.value = tasksToKeep

            // Save to localStorage AFTER filter (for guest mode persistence)
            await saveTasksToStorage(_rawTasks.value, 'bulkDeleteTasks')

            // TASK-131: Removed triggerCanvasSync() - surgical deletion watcher in CanvasView handles this
            // The watcher detects bulk deletions and removes only the affected nodes, preventing position resets
        } catch (error) {
            console.error(`❌ [BULK-DELETE] Failed to delete ${taskIds.length} tasks:`, error)
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
        const task = _rawTasks.value.find(t => t.id === taskId)
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
        saveSpecificTasks([task], `createSubtask-${newSubtask.id}`)
        return newSubtask
    }

    const updateSubtask = (taskId: string, subtaskId: string, updates: Partial<Subtask>) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return
        const idx = task.subtasks.findIndex(st => st.id === subtaskId)
        if (idx !== -1) {
            task.subtasks[idx] = { ...task.subtasks[idx], ...updates, updatedAt: new Date() }
            task.updatedAt = new Date()
            saveSpecificTasks([task], `updateSubtask-${subtaskId}`)
        }
    }

    const deleteSubtask = (taskId: string, subtaskId: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return
        const idx = task.subtasks.findIndex(st => st.id === subtaskId)
        if (idx !== -1) {
            task.subtasks.splice(idx, 1)
            task.updatedAt = new Date()
            saveSpecificTasks([task], `deleteSubtask-${subtaskId}`)
        }
    }

    const createTaskInstance = (taskId: string, instanceData: Omit<TaskInstance, 'id'>) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return null
        const newInstance: TaskInstance = {
            id: Date.now().toString(),
            ...instanceData
        }
        if (!task.instances) task.instances = []
        task.instances.push(newInstance)
        task.updatedAt = new Date()
        saveSpecificTasks([task], `createInstance-${newInstance.id}`)
        return newInstance
    }

    const updateTaskInstance = (taskId: string, instanceId: string, updates: Partial<TaskInstance>) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task || !task.instances) return
        const idx = task.instances.findIndex(inst => inst.id === instanceId)
        if (idx !== -1) {
            task.instances[idx] = { ...task.instances[idx], ...updates }
            task.updatedAt = new Date()
            saveSpecificTasks([task], `updateInstance-${instanceId}`)
        }
    }

    const deleteTaskInstance = (taskId: string, instanceId: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task || !task.instances) return
        const idx = task.instances.findIndex(inst => inst.id === instanceId)
        if (idx !== -1) {
            task.instances.splice(idx, 1)
            task.updatedAt = new Date()
            saveSpecificTasks([task], `deleteInstance-${instanceId}`)
        }
    }

    /**
     * ✅ TASK-192: Atomic update for task scheduling
     * Combines task updates and instance updates to prevent race conditions
     */
    const updateTaskWithSchedule = async (taskId: string, schedule: {
        scheduledDate: string
        scheduledTime: string
        instanceId?: string
    }) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) return

        const updates: Partial<Task> = {
            scheduledDate: schedule.scheduledDate,
            scheduledTime: schedule.scheduledTime,
            // When scheduling on calendar, it's no longer in inbox
            isInInbox: false
        }

        // If instance exists, update it too
        if (schedule.instanceId && task.instances) {
            const instances = [...task.instances]
            const idx = instances.findIndex(i => i.id === schedule.instanceId)
            if (idx !== -1) {
                instances[idx] = {
                    ...instances[idx],
                    scheduledDate: schedule.scheduledDate,
                    scheduledTime: schedule.scheduledTime,
                    updatedAt: new Date()
                }
                updates.instances = instances
            }
        }

        await updateTask(taskId, updates)
    }

    const startTaskNow = (taskId: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
        if (!task) {
            console.warn('🎯 startTaskNow: Task not found:', taskId)
            return
        }
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
            case 'today': {
                dueDate = formatDateKey(today)
                break
            }
            case 'tomorrow': {
                const tom = new Date(today)
                tom.setDate(today.getDate() + 1)
                dueDate = formatDateKey(tom)
                break
            }
            case 'this weekend': {
                const sat = new Date(today)
                sat.setDate(today.getDate() + ((6 - today.getDay() + 7) % 7 || 7))
                dueDate = formatDateKey(sat)
                break
            }
            case 'this week': {
                const sun = new Date(today)
                sun.setDate(today.getDate() + ((7 - today.getDay()) % 7 || 7))
                dueDate = formatDateKey(sun)
                break
            }
            case 'later': {
                // "Later" clears the due date - task is postponed indefinitely
                dueDate = ''
                break
            }
            default:
                // BUG-016 FIX: Return early for unknown types to prevent clearing dueDate
                console.warn(`⚠️ [TASK-114] Unknown smart group type: "${type}" - no update performed`)
                return
        }
        updateTask(taskId, { dueDate })
    }

    const moveTaskToDate = (taskId: string, dateColumn: string) => {
        const task = _rawTasks.value.find(t => t.id === taskId)
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                isLater: dateColumn === 'later'
            } as any]
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    const toggleCanvasOverdueTasks = () => {
        hideCanvasOverdueTasks.value = !hideCanvasOverdueTasks.value
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setActiveDurationFilter = (duration: any) => {
        activeDurationFilter.value = duration
        if (duration) activeStatusFilter.value = null
        persistFilters()
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toggleDurationFilter = (duration: any) => {
        setActiveDurationFilter(activeDurationFilter.value === duration ? null : duration)
    }

    const getTask = (taskId: string) => _rawTasks.value.find(t => t.id === taskId)

    const getUncategorizedTaskCount = () => {
        const { isUncategorizedTask } = useSmartViews()
        return _rawTasks.value.filter(t => t.status !== 'done' && isUncategorizedTask(t)).length
    }

    const getNestedTasks = (parent: string | null = null) => _rawTasks.value.filter(t => t.parentTaskId === parent)
    const getTaskChildren = (taskId: string) => _rawTasks.value.filter(t => t.parentTaskId === taskId)
    const getTaskHierarchy = (taskId: string) => {
        const list: Task[] = []
        const visited = new Set<string>()
        let curr: string | null = taskId

        while (curr && !visited.has(curr)) {
            visited.add(curr)
            const t = getTask(curr)
            if (!t) break
            list.unshift(t)
            curr = t.parentTaskId || null
        }
        return list
    }
    const isNestedTask = (id: string) => !!getTask(id)?.parentTaskId
    const hasNestedTasks = (id: string) => _rawTasks.value.some(t => t.parentTaskId === id)

    return {
        createTask,
        updateTask,
        deleteTask,
        permanentlyDeleteTask,
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
        updateTaskWithSchedule,
        startTaskNow,
        moveTaskToSmartGroup,
        moveTaskToDate,
        unscheduleTask,
        moveTaskToPriority,
        moveTaskToProject: async (taskId: string, targetProjectId: string) => {
            const task = _rawTasks.value.find(t => t.id === taskId)
            if (task) {
                manualOperationInProgress.value = true
                try {
                    task.projectId = targetProjectId
                    task.updatedAt = new Date()
                    console.log(`Task "${task.title}" moved to project "${projectStore.getProjectDisplayName(targetProjectId)}"`)
                    await saveTasksToStorage(_rawTasks.value, `moveTaskToProject-${taskId}`)
                } finally {
                    manualOperationInProgress.value = false
                }
            }
        },
        setActiveProject,
        setSmartView,
        toggleHideDoneTasks,
        toggleCanvasDoneTasks,
        toggleCalendarDoneTasks,
        toggleCanvasOverdueTasks,
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
