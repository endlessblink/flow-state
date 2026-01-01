import { watch, type Ref } from 'vue'
import { DB_KEYS, useDatabase } from '@/composables/useDatabase'
import { usePersistentStorage } from '@/composables/usePersistentStorage'
import { STORAGE_FLAGS } from '@/config/database'
import {
    saveTasks as saveIndividualTasks,
    loadAllTasks as loadIndividualTasks,
    syncDeletedTasks,
    migrateFromLegacyFormat
} from '@/utils/individualTaskStorage'
import { formatDateKey } from '@/utils/dateUtils'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'
import type { Task, TaskInstance } from '@/types/tasks'
import { useProjectStore } from '../projects'

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
    runAllTaskMigrations: () => void
) {
    const db = useDatabase()
    const persistentStorage = usePersistentStorage()
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
        if (typeof window !== 'undefined' && (window as any).__STORYBOOK__) {
            return
        }

        const dbInstance = (window as any).pomoFlowDb
        if (!dbInstance) {
            console.error(`[SAVE - TASKS] PouchDB not available(${context})`)
            return
        }

        if (STORAGE_FLAGS.INDIVIDUAL_ONLY) {
            await saveIndividualTasks(dbInstance, tasksToSave)
            await syncDeletedTasks(dbInstance, new Set(tasksToSave.map(t => t.id)))
        } else if (STORAGE_FLAGS.DUAL_WRITE_TASKS) {
            await db.save(DB_KEYS.TASKS, tasksToSave)
            await saveIndividualTasks(dbInstance, tasksToSave)
            await syncDeletedTasks(dbInstance, new Set(tasksToSave.map(t => t.id)))
        } else {
            await db.save(DB_KEYS.TASKS, tasksToSave)
        }
    }

    const deleteLegacyTasksDocument = async (): Promise<void> => {
        if (!STORAGE_FLAGS.INDIVIDUAL_ONLY) return
        const dbInstance = (window as any).pomoFlowDb
        if (!dbInstance) return

        try {
            const legacyDoc = await dbInstance.get('tasks:data').catch(() => null)
            if (legacyDoc) {
                await dbInstance.remove(legacyDoc)
            }
        } catch { }
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
                    // New format - use separate values
                    hideCanvasDoneTasks.value = state.hideCanvasDoneTasks ?? false
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
        isLoadingFilters.value = true
        try {
            if (!db.isReady?.value) throw new Error('Database not ready')
            const saved = await db.load<PersistedFilterState>(DB_KEYS.FILTER_STATE)
            if (saved) {
                if (saved.activeProjectId && !projectStore.projects.find(p => p.id === saved.activeProjectId)) {
                    saved.activeProjectId = null
                }
                projectStore.setActiveProject(saved.activeProjectId)
                activeSmartView.value = saved.activeSmartView
                activeStatusFilter.value = saved.activeStatusFilter

                // TASK-076: Migration from old single hideDoneTasks to separate filters
                if (saved.hideCanvasDoneTasks !== undefined || saved.hideCalendarDoneTasks !== undefined) {
                    // New format - use separate values
                    hideCanvasDoneTasks.value = saved.hideCanvasDoneTasks ?? false
                    hideCalendarDoneTasks.value = saved.hideCalendarDoneTasks ?? false
                } else if (saved.hideDoneTasks !== undefined) {
                    // Old format - migrate to both filters
                    hideCanvasDoneTasks.value = saved.hideDoneTasks
                    hideCalendarDoneTasks.value = saved.hideDoneTasks
                }
            } else {
                loadFiltersFromLocalStorage()
            }
        } catch {
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
            const state: PersistedFilterState = {
                activeProjectId: projectStore.activeProjectId,
                activeSmartView: activeSmartView.value,
                activeStatusFilter: activeStatusFilter.value,
                hideCanvasDoneTasks: hideCanvasDoneTasks.value,
                hideCalendarDoneTasks: hideCalendarDoneTasks.value
            }
            localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state))
            if (db.isReady?.value) {
                try {
                    await db.save(DB_KEYS.FILTER_STATE, state)
                } catch { }
            }
        }, 500)
    }

    const importTasksFromJSON = async () => {
        try {
            const response = await fetch('/tasks.json')
            if (!response.ok) return
            const tasksData = await response.json()
            const tasksArray = Array.isArray(tasksData) ? tasksData : (tasksData.data || [])
            if (!tasksArray.length) return

            const importedTasks: Task[] = tasksArray.map((jt: any) => ({
                id: jt.id || '',
                title: jt.title || '',
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
                    tasks.value.push(...userTasks.map(t => ({
                        ...t,
                        createdAt: new Date(t.createdAt),
                        updatedAt: new Date(t.updatedAt)
                    })))
                    localStorage.removeItem('pomo-flow-user-backup')
                    return
                }
            }

            const importedTasksStr = localStorage.getItem('pomo-flow-imported-tasks')
            if (!importedTasksStr) return
            const tasksData = JSON.parse(importedTasksStr)
            if (!Array.isArray(tasksData) || !tasksData.length) return

            const recoveredTasks: Task[] = tasksData.map((rt: any, index: number) => ({
                id: rt.id || `recovery-${Date.now()}-${index}`,
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
            }
        } catch { }
    }

    const loadFromDatabase = async () => {
        try {
            isLoadingFromDatabase.value = true
            let attempts = 0
            while (!(window as any).pomoFlowDb && attempts < 300) {
                await new Promise(r => setTimeout(r, 100))
                attempts++
            }

            const dbInstance = (window as any).pomoFlowDb
            if (!dbInstance) return

            if (STORAGE_FLAGS.READ_INDIVIDUAL_TASKS) {
                try {
                    const loadedTasks = await loadIndividualTasks(dbInstance)
                    if (loadedTasks?.length) {
                        const deletionDoc = await dbInstance.get('_local/deleted-tasks').catch(() => ({ taskIds: [] }))
                        const deletedIds = new Set(deletionDoc.taskIds || [])
                        tasks.value = loadedTasks.filter(t => !deletedIds.has(t.id))
                    }
                } catch { }
            }

            if ((!tasks.value.length || !STORAGE_FLAGS.READ_INDIVIDUAL_TASKS) && !STORAGE_FLAGS.INDIVIDUAL_ONLY) {
                try {
                    const tasksDoc = await dbInstance.get('tasks:data').catch(() => null)
                    if (tasksDoc?.tasks) {
                        tasks.value = tasksDoc.tasks.map((t: any) => ({
                            ...t,
                            createdAt: new Date(t.createdAt || Date.now()),
                            updatedAt: new Date(t.updatedAt || Date.now())
                        }))
                    }
                } catch { }
            }

            runAllTaskMigrations()

            if (STORAGE_FLAGS.DUAL_WRITE_TASKS && tasks.value.length) {
                const existing = await dbInstance.allDocs({ startkey: 'task-', endkey: 'task-\ufff0', limit: 1 })
                if (existing.total_rows === 0) {
                    await migrateFromLegacyFormat(dbInstance)
                }
            }

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

            try {
                const savedHideDone = await db.load<boolean>(DB_KEYS.HIDE_DONE_TASKS)
                if (savedHideDone !== null) hideDoneTasks.value = savedHideDone
            } catch { }

        } catch (error) {
            console.error('❌ loadFromDatabase failed:', error)
        } finally {
            isLoadingFromDatabase.value = false
        }
    }

    // Auto-save setup
    let tasksSaveTimer: any = null
    watch(tasks, () => {
        if (manualOperationInProgress.value || isLoadingFromDatabase.value) return
        if (tasksSaveTimer) clearTimeout(tasksSaveTimer)
        tasksSaveTimer = setTimeout(async () => {
            try {
                const currentTasks = [...tasks.value]
                while (!db.isReady?.value) await new Promise(r => setTimeout(r, 100))
                await saveTasksToStorage(currentTasks, 'auto-save')
            } catch (error) {
                errorHandler.report({
                    severity: ErrorSeverity.ERROR,
                    category: ErrorCategory.DATABASE,
                    message: 'Tasks auto-save failed',
                    error: error as Error,
                    showNotification: true
                })
            }
        }, 1000)
    }, { deep: true })

    // TASK-076: Watch both new done filter refs for legacy DB_KEYS.HIDE_DONE_TASKS compat
    // This keeps the legacy key updated for any code still reading it
    watch([hideCanvasDoneTasks, hideCalendarDoneTasks], () => {
        // Save combined value to legacy key for backward compatibility
        db.save(DB_KEYS.HIDE_DONE_TASKS, hideCanvasDoneTasks.value || hideCalendarDoneTasks.value)
    }, { flush: 'post' })

    return {
        saveTasksToStorage,
        loadFromDatabase,
        loadPersistedFilters,
        persistFilters,
        importTasksFromJSON,
        importFromRecoveryTool
    }
}
