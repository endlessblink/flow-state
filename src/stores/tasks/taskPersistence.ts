import { ref, watch, type Ref } from 'vue'
import { syncState } from '@/services/sync/SyncStateService'
import { DB_KEYS, useDatabase } from '@/composables/useDatabase'
import { STORAGE_FLAGS } from '@/config/database'
import {
    saveTasks as saveIndividualTasks,
    loadAllTasks as loadIndividualTasks,
    syncDeletedTasks,
    migrateFromLegacyFormat,
    recoverSoftDeletedTasks
} from '@/utils/individualTaskStorage'
import { formatDateKey } from '@/utils/dateUtils'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import type { Task } from '@/types/tasks'
import { useProjectStore } from '../projects'
// BUG-060: Import validation utilities for multi-layer defense
import {
    validateBeforeSave,
    sanitizeLoadedTasks,
    isValidTaskId,
    generateFallbackId,
    logTaskIdStats
} from '@/utils/taskValidation'

export function useTaskPersistence(
    tasks: Ref<Task[]>,
    hideDoneTasks: Ref<boolean>,
    hideCanvasDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks: Ref<boolean>,
    activeSmartView: Ref<any>,
    activeStatusFilter: Ref<string | null>,
    isLoadingFromDatabase: Ref<boolean>,
    manualOperationInProgress: Ref<boolean>,
    isLoadingFilters: Ref<boolean>,
    syncInProgress: Ref<boolean>,  // BUG-057: Added to prevent saves during sync
    runAllTaskMigrations: () => void
) {
    const db = useDatabase()
    const projectStore = useProjectStore()

    const FILTER_STORAGE_KEY = 'pomo-flow-filters'

    interface PersistedFilterState {
        activeProjectId: string | null
        activeSmartView: any
        activeStatusFilter: string | null
        // TASK-076: Separate done filters
        hideCanvasDoneTasks?: boolean
        hideCalendarDoneTasks?: boolean
        // Deprecated - kept for migration from old format
        hideDoneTasks?: boolean
    }

    const saveTasksToStorage = async (tasksToSave: Task[], context: string = 'unknown'): Promise<void> => {
        if (typeof window !== 'undefined' && (window as any).__STORYBOOK__) return

        const dbInstance = db.database.value
        if (!dbInstance) {
            console.error(`[SAVE-TASKS] PouchDB not available (${context})`)
            return
        }

        // BUG-060: Pre-save validation - block tasks with invalid IDs
        const validation = validateBeforeSave(tasksToSave)
        if (validation.blockedTasks.length > 0) {
            console.error(`🛡️ [PRE-SAVE] Blocked ${validation.blockedTasks.length} tasks with invalid IDs (${context})`)
        }

        const validTasksToSave = validation.validTasks
        if (validTasksToSave.length === 0) return

        logTaskIdStats(validTasksToSave, `save-${context}`)

        // ENFORCED: Individual Document Storage
        await saveIndividualTasks(dbInstance, validTasksToSave)

        // BUG-FIX: NEVER call syncDeletedTasks during auto-save or background operations!
        // This is extremely dangerous as it mass-deletes tasks that might be filtered out
        // or haven't arrived via sync yet.
        // const validIds = validTasksToSave.map(t => t.id).filter(isValidTaskId)
        // await syncDeletedTasks(dbInstance, new Set(validIds))
        // console.debug(`🛡️ [SAVE-TASKS] Saved ${validTasksToSave.length} tasks - syncDeletedTasks skipped for safety`)
    }

    const saveSpecificTasks = async (tasksToSave: Task[], context: string = 'unknown'): Promise<void> => {
        if (typeof window !== 'undefined' && (window as any).__STORYBOOK__) return

        const dbInstance = db.database.value
        if (!dbInstance) return

        const validation = validateBeforeSave(tasksToSave)
        const validTasksToSave = validation.validTasks
        if (validTasksToSave.length === 0) return

        // ENFORCED: Individual Document Storage
        await saveIndividualTasks(dbInstance, validTasksToSave)
    }


    const loadFiltersFromLocalStorage = () => {
        try {
            const localSaved = localStorage.getItem(FILTER_STORAGE_KEY)
            if (localSaved) {
                const state: PersistedFilterState = JSON.parse(localSaved)
                if (state.activeProjectId && !projectStore.projects.find(p => p.id === state.activeProjectId)) {
                    state.activeProjectId = null
                }
                projectStore.setActiveProject(state.activeProjectId)
                activeSmartView.value = state.activeSmartView
                activeStatusFilter.value = state.activeStatusFilter

                // TASK-076: Migration from old single hideDoneTasks to separate filters
                if (state.hideCanvasDoneTasks !== undefined || state.hideCalendarDoneTasks !== undefined) {
                    // New format - use separate values (default true for canvas)
                    hideCanvasDoneTasks.value = state.hideCanvasDoneTasks ?? true
                    hideCalendarDoneTasks.value = state.hideCalendarDoneTasks ?? false
                } else if (state.hideDoneTasks !== undefined) {
                    // Old format - migrate to both filters
                    hideCanvasDoneTasks.value = state.hideDoneTasks
                    hideCalendarDoneTasks.value = state.hideDoneTasks
                }
            }
        } catch (e) {
            console.warn('Failed to load filters from localStorage:', e)
        }
    }

    const loadPersistedFilters = async () => {
        // BUG-057 FIX: Only load filters from localStorage - NOT from PouchDB
        // Filters are local preferences that should NOT sync between browsers
        isLoadingFilters.value = true
        try {
            loadFiltersFromLocalStorage()
        } finally {
            isLoadingFilters.value = false
        }
    }

    let persistTimeout: any = null
    const persistFilters = async () => {
        if (isLoadingFilters.value) return
        if (persistTimeout) clearTimeout(persistTimeout)
        persistTimeout = setTimeout(async () => {
            // TASK-076: Save separate done filters (no longer save deprecated hideDoneTasks)
            // BUG-057 FIX: Only save to localStorage - NOT to PouchDB
            // Filters are local preferences that should NOT sync between browsers
            const state: PersistedFilterState = {
                activeProjectId: projectStore.activeProjectId,
                activeSmartView: activeSmartView.value,
                activeStatusFilter: activeStatusFilter.value,
                hideCanvasDoneTasks: hideCanvasDoneTasks.value,
                hideCalendarDoneTasks: hideCalendarDoneTasks.value
            }
            localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state))
            // BUG-057: REMOVED - Don't save filters to PouchDB (causes sync conflicts)
            // if (db.isReady?.value) {
            //     await db.save(DB_KEYS.FILTER_STATE, state)
            // }
        }, 500)
    }

    const importTasksFromJSON = async () => {
        try {
            const response = await fetch('/tasks.json')
            if (!response.ok) return
            const tasksData = await response.json()
            const tasksArray = Array.isArray(tasksData) ? tasksData : (tasksData.data || [])
            if (!tasksArray.length) return

            // BUG-060: Generate valid IDs for tasks that don't have them
            const importedTasks: Task[] = tasksArray.map((jt: any, index: number) => ({
                // BUG-060 FIX: Generate fallback ID if missing or invalid
                id: isValidTaskId(jt.id) ? jt.id : generateFallbackId(`json -import -${index} `),
                title: jt.title || 'Imported Task',
                description: jt.description || '',
                status: jt.status || 'planned',
                priority: jt.priority || 'medium',
                progress: jt.progress || 0,
                completedPomodoros: 0,
                subtasks: [],
                dueDate: jt.dueDate || formatDateKey(new Date()),
                projectId: jt.projectId || 'uncategorized',
                createdAt: new Date(jt.createdAt || Date.now()),
                updatedAt: new Date(jt.updatedAt || jt.createdAt || Date.now()),
                isInInbox: jt.isInInbox ?? true,
                instances: jt.instances || [],
            }))

            // BUG-060: Log any ID generation that occurred
            const generatedCount = importedTasks.filter((t, i) => !isValidTaskId(tasksArray[i]?.id)).length
            if (generatedCount > 0) {
                console.log(`🛡️[JSON - IMPORT] Generated ${generatedCount} fallback IDs for tasks without valid IDs`)
            }

            const existingIds = new Set(tasks.value.map(t => t.id))
            const newTasks = importedTasks.filter(t => !existingIds.has(t.id))
            if (newTasks.length) tasks.value.push(...newTasks)
        } catch { }
    }

    const importFromRecoveryTool = async () => {
        try {
            if (typeof window === 'undefined') return
            const userBackup = localStorage.getItem('pomo-flow-user-backup')
            if (userBackup) {
                const userTasks = JSON.parse(userBackup)
                if (Array.isArray(userTasks) && userTasks.length) {
                    // BUG-060: Sanitize user backup tasks
                    const sanitized = sanitizeLoadedTasks(userTasks.map(t => ({
                        ...t,
                        createdAt: new Date(t.createdAt),
                        updatedAt: new Date(t.updatedAt)
                    })))
                    if (sanitized.length > 0) {
                        tasks.value.push(...sanitized)
                        console.log(`🛡️[RECOVERY] Restored ${sanitized.length} tasks from user backup`)
                    }
                    localStorage.removeItem('pomo-flow-user-backup')
                    return
                }
            }

            const importedTasksStr = localStorage.getItem('pomo-flow-imported-tasks')
            if (!importedTasksStr) return
            const tasksData = JSON.parse(importedTasksStr)
            if (!Array.isArray(tasksData) || !tasksData.length) return

            // BUG-060: Use isValidTaskId for robust ID validation
            const recoveredTasks: Task[] = tasksData.map((rt: any, index: number) => ({
                id: isValidTaskId(rt.id) ? rt.id : generateFallbackId(`recovery - ${index} `),
                title: rt.title || 'Recovered Task',
                description: rt.description || '',
                status: rt.status || 'planned',
                priority: rt.priority || 'medium',
                progress: rt.progress || 0,
                completedPomodoros: 0,
                subtasks: [],
                dueDate: formatDateKey(new Date()),
                projectId: rt.projectId || null,
                createdAt: new Date(rt.createdAt || Date.now()),
                updatedAt: new Date(rt.updatedAt || Date.now()),
                isInInbox: true,
                instances: [],
            }))

            const existingIds = new Set(tasks.value.map(t => t.id))
            const newTasks = recoveredTasks.filter(t => !existingIds.has(t.id))
            if (newTasks.length) {
                tasks.value.push(...newTasks)
                runAllTaskMigrations()
                localStorage.removeItem('pomo-flow-imported-tasks')
                console.log(`🛡️[RECOVERY] Imported ${newTasks.length} tasks from recovery tool`)
            }
        } catch { }
    }

    const loadFromDatabase = async () => {
        try {
            isLoadingFromDatabase.value = true
            let attempts = 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dbInstance = db.database.value
            if (!dbInstance) return

            if (STORAGE_FLAGS.READ_INDIVIDUAL_TASKS) {
                const loadedTasks = await loadIndividualTasks(dbInstance)
                if (loadedTasks?.length) {
                    const deletionDoc = await dbInstance.get('_local/deleted-tasks').catch(() => ({ taskIds: [] })) as any
                    const deletedIds = new Set((deletionDoc.taskIds || []) as string[])

                    // BUG-060: Sanitize loaded tasks to filter out invalid IDs
                    const sanitized = sanitizeLoadedTasks(loadedTasks)
                    const filtered = sanitized.filter(t => !deletedIds.has(t.id))

                    // Replace current tasks with filtered individual tasks
                    tasks.value = [...filtered]
                    logTaskIdStats(tasks.value, 'loadFromDatabase-individual')
                }
            }

            // [RECOVERY REMOVED] Legacy tasks:data merge logic removed to ensure reliability.
            // Migration is handled by initializeFromPouchDB's runAllTaskMigrations if needed,
            // but for a clean start, we strictly follow READ_INDIVIDUAL_TASKS.

            runAllTaskMigrations()

            // [MIGRATION REMOVED] Legacy migration branch removed for reliability consolidation.

            let isInitialized = false
            try {
                await dbInstance.get('_local/app-init')
                isInitialized = true
            } catch { }

            if (!tasks.value.length && !isInitialized) {
                await importFromRecoveryTool()
                if (!tasks.value.length) await importTasksFromJSON()
            }

            if (!isInitialized) {
                await dbInstance.put({ _id: '_local/app-init', createdAt: new Date().toISOString() }).catch(() => { })
            }

            // BUG-057 FIX: REMOVED - No longer load filters from PouchDB
            // Filters are localStorage-only to prevent sync-triggered resets
            // try {
            //     const savedHideDone = await db.load<boolean>(DB_KEYS.HIDE_DONE_TASKS)
            //     if (savedHideDone !== null) hideDoneTasks.value = savedHideDone
            // } catch { }

        } catch (error) {
            console.error('❌ loadFromDatabase failed:', error)
        } finally {
            isLoadingFromDatabase.value = false
        }
    }

    // Auto-save setup
    let tasksSaveTimer: any = null
    // PERFORMANCE FIX: Removed deep watcher on tasks array
    // This was causing "36+ deep watchers" and massive lag on every keystroke.
    // Persistence is now handled explicitly by actions (createTask, updateTask, etc.) in taskOperations.ts
    // We only watch for list mutations (add/remove) that might escape normal flows (like drag-drop reordering)
    watch(tasks, () => {
        // Only trigger if list length changes or reference changes (shallow)
        if (manualOperationInProgress.value || isLoadingFromDatabase.value || syncInProgress.value) return

        // Use a longer debounce for safety saves
        if (tasksSaveTimer) clearTimeout(tasksSaveTimer)
        tasksSaveTimer = setTimeout(async () => {
            // Only save if dirty? For now, we rely on actions. 
            // This is just a fallback for drag-and-drop or direct list mutation.
            // We can probably keep it but ensure it's NOT deep.
            // Actually, drag-and-drop usually triggers an update event which calls save.
            // So we might not need this AT ALL, but keeping a shallow watcher is safer for now.
            console.debug('💾 [AUTO-SAVE] Shallow watcher triggered (list mutation)')
            // await saveTasksToStorage(tasks.value, 'shallow-watcher') 
            // DISABLED: Trust manual operations. Enabling this might double-save.
        }, 2000)
    }, { deep: false }) // Explicitly FALSE

    // BUG-057 FIX: REMOVED - No longer save filters to PouchDB
    // Filters are localStorage-only to prevent sync-triggered resets
    // Previously this was for legacy DB_KEYS.HIDE_DONE_TASKS compat but
    // it causes filter state to sync which triggers infinite reset loops
    // watch([hideCanvasDoneTasks, hideCalendarDoneTasks], () => {
    //     db.save(DB_KEYS.HIDE_DONE_TASKS, hideCanvasDoneTasks.value || hideCalendarDoneTasks.value)
    // }, { flush: 'post' })

    return {
        saveTasksToStorage,
        saveSpecificTasks,
        loadFromDatabase,
        loadPersistedFilters,
        persistFilters,
        importTasksFromJSON,
        importFromRecoveryTool,
        recoverSoftDeletedTasks: async () => {
            const dbInstance = db.database.value
            if (!dbInstance) return 0
            const count = await recoverSoftDeletedTasks(dbInstance)
            if (count > 0) {
                await loadFromDatabase() // Reload to show recovered tasks
            }
            return count
        },
        importTasks: async (tasksToImport: Task[]) => {
            if (!tasksToImport.length) return

            // Sanitize
            const sanitized = sanitizeLoadedTasks(tasksToImport.map((t, i) => ({
                ...t,
                // Ensure ID validity
                id: isValidTaskId(t.id) ? t.id : generateFallbackId(`imported-${i}`),
                createdAt: new Date(t.createdAt || Date.now()),
                updatedAt: new Date(t.updatedAt || Date.now())
            })))

            // Merge
            const existingIds = new Set(tasks.value.map(t => t.id))
            const newTasks = sanitized.filter(t => !existingIds.has(t.id))

            if (newTasks.length > 0) {
                tasks.value.push(...newTasks)
                // Persistence handles saving via watcher, but we force a save for safety
                await saveTasksToStorage(tasks.value, 'import-markdown')
                console.log(`✅ Imported ${newTasks.length} new tasks`)
            }
        }
    }
}
