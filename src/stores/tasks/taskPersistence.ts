import { ref, watch, type Ref } from 'vue'
import PowerSyncService from '@/services/database/PowerSyncDatabase'
import { toSqlTask, fromSqlTask } from '@/utils/taskMapper'
import type { Task } from '@/types/tasks'
import { useProjectStore } from '../projects'
import { validateBeforeSave, logTaskIdStats } from '@/utils/taskValidation'

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
    syncInProgress: Ref<boolean>,
    runAllTaskMigrations: () => void
) {
    const projectStore = useProjectStore()
    const FILTER_STORAGE_KEY = 'pomo-flow-filters'

    interface PersistedFilterState {
        activeProjectId: string | null
        activeSmartView: any
        activeStatusFilter: string | null
        hideCanvasDoneTasks?: boolean
        hideCalendarDoneTasks?: boolean
    }

    // --- SQL PERSISTENCE ---

    const saveTasksToStorage = async (tasksToSave: Task[], context: string = 'unknown'): Promise<void> => {
        if (typeof window !== 'undefined' && (window as any).__STORYBOOK__) return

        try {
            const db = await PowerSyncService.getInstance()

            // Validation
            const validation = validateBeforeSave(tasksToSave)
            if (validation.blockedTasks.length > 0) {
                console.error(`🛡️ [PRE-SAVE] Blocked ${validation.blockedTasks.length} tasks with invalid IDs (${context})`)
            }

            const validTasksToSave = validation.validTasks
            if (validTasksToSave.length === 0) return

            logTaskIdStats(validTasksToSave, `save-${context}`)

            // Convert to SQL format
            const sqlTasks = validTasksToSave.map(toSqlTask)

            // Execute Transaction - ALL FIELDS
            await db.writeTransaction(async (tx) => {
                for (const t of sqlTasks) {
                    await tx.execute(`
                        INSERT OR REPLACE INTO tasks (
                            id, title, description, status, priority,
                            project_id, parent_task_id,
                            total_pomodoros, estimated_pomodoros, progress,
                            due_date, scheduled_date, scheduled_time, estimated_duration,
                            instances_json, subtasks_json, depends_on_json, tags_json,
                            connection_types_json, recurrence_json, recurring_instances_json, notification_prefs_json,
                            canvas_position_x, canvas_position_y, is_in_inbox,
                            "order", column_id,
                            created_at, updated_at, completed_at,
                            is_deleted, deleted_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        t.id, t.title, t.description, t.status, t.priority,
                        t.project_id, t.parent_task_id,
                        t.total_pomodoros, t.estimated_pomodoros, t.progress,
                        t.due_date, t.scheduled_date, t.scheduled_time, t.estimated_duration,
                        t.instances_json, t.subtasks_json, t.depends_on_json, t.tags_json,
                        t.connection_types_json, t.recurrence_json, t.recurring_instances_json, t.notification_prefs_json,
                        t.canvas_position_x, t.canvas_position_y, t.is_in_inbox,
                        t.order, t.column_id,
                        t.created_at, t.updated_at, t.completed_at,
                        t.is_deleted, t.deleted_at
                    ])
                }
            })
            // console.debug(`✅ [SQL] Saved ${sqlTasks.length} tasks (${context})`)

            // --- POUCHDB SYNC (DUAL SAVE) ---
            // While we are still using PouchDB for cross-device sync, we MUST update it too.
            // This also prevents the "Self-Healing Migration" from overwriting fresh data.
            const pouchDbInstance = (window as any).pomoFlowDb
            if (pouchDbInstance) {
                const { saveTasks: saveToPouch } = await import('@/utils/individualTaskStorage')
                await (saveToPouch as any)(pouchDbInstance, validTasksToSave, 3, true) // bypassSql=true (internal flag needed or handled in utility)
            }

        } catch (e) {
            console.error(`❌ [SQL] Save failed (${context}):`, e)
        }
    }

    const saveSpecificTasks = saveTasksToStorage

    // --- LOAD LOGIC ---

    const loadFromDatabase = async () => {
        try {
            isLoadingFromDatabase.value = true
            const db = await PowerSyncService.getInstance()

            // Query all non-deleted tasks
            const countResult = await db.getAll('SELECT count(*) as count FROM tasks') as any[]
            console.log('🔍 [SQL-DEBUG] Total tasks in DB:', countResult[0]?.count)

            const result = await db.getAll('SELECT * FROM tasks WHERE is_deleted = 0')

            // Map back to Frontend Task objects
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const loadedTasks = result.map(row => fromSqlTask(row as any))

            tasks.value = loadedTasks
            console.log(`✅ [SQL] Loaded ${loadedTasks.length} tasks from SQLite`)

            // If empty, we might need a backup import (legacy logic simplified)
            if (loadedTasks.length === 0) {
                // Check if we need to run imports? For now, assume migration handled it.
            }

        } catch (error) {
            console.error('❌ [SQL] Load failed:', error)
        } finally {
            isLoadingFromDatabase.value = false
        }
    }

    // --- FILTERS ---
    // (Kept as localStorage only, same as before)

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
                hideCanvasDoneTasks.value = state.hideCanvasDoneTasks ?? true
                hideCalendarDoneTasks.value = state.hideCalendarDoneTasks ?? false
            }
        } catch (e) {
            console.warn('Failed to load filters from localStorage:', e)
        }
    }

    const loadPersistedFilters = async () => {
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
            const state: PersistedFilterState = {
                activeProjectId: projectStore.activeProjectId,
                activeSmartView: activeSmartView.value,
                activeStatusFilter: activeStatusFilter.value,
                hideCanvasDoneTasks: hideCanvasDoneTasks.value,
                hideCalendarDoneTasks: hideCalendarDoneTasks.value
            }
            localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state))
        }, 500)
    }

    // --- EXPORTS ---

    return {
        saveTasksToStorage,
        saveSpecificTasks,
        loadFromDatabase,
        loadPersistedFilters,
        persistFilters,
        importTasksFromJSON: async () => { }, // Disabled / TBD
        importFromRecoveryTool: async () => { }, // Disabled
        recoverSoftDeletedTasks: async () => 0, // TBD: SQL Implementation needed later
        importTasks: async (tasksToImport: Task[]) => {
            // Basic import logic reused
            if (!tasksToImport.length) return
            const existingIds = new Set(tasks.value.map(t => t.id))
            const newTasks = tasksToImport.filter(t => !existingIds.has(t.id))
            if (newTasks.length > 0) {
                tasks.value.push(...newTasks)
                await saveTasksToStorage(tasks.value, 'import-tool')
            }
        }
    }
}

