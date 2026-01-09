import { type Ref } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabaseV2'
import type { Task } from '@/types/tasks'
import { useProjectStore } from '../projects'
import { validateBeforeSave, logTaskIdStats } from '@/utils/taskValidation'

export function useTaskPersistence(
    // SAFETY: Named _rawTasks to indicate this is the raw array for load/save operations
    _rawTasks: Ref<Task[]>,
    hideDoneTasks: Ref<boolean>,
    hideCanvasDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks: Ref<boolean>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    activeSmartView: Ref<any>,
    activeStatusFilter: Ref<string | null>,
    isLoadingFromDatabase: Ref<boolean>,
    _manualOperationInProgress: Ref<boolean>,
    isLoadingFilters: Ref<boolean>,
    _syncInProgress: Ref<boolean>,
    _runAllTaskMigrations: () => void
) {
    const projectStore = useProjectStore()
    const FILTER_STORAGE_KEY = 'pomo-flow-filters'

    interface PersistedFilterState {
        activeProjectId: string | null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeSmartView: any
        activeStatusFilter: string | null
        hideCanvasDoneTasks?: boolean
        hideCalendarDoneTasks?: boolean
    }

    // --- SQL PERSISTENCE ---

    // -- Supabase Integration --
    const { fetchTasks, saveTasks, deleteTask: deleteFromDB, bulkDeleteTasks: bulkDeleteFromDB } = useSupabaseDatabase()

    // TASK-142 FIX: Guest Mode localStorage persistence for tasks
    const GUEST_TASKS_KEY = 'pomoflow-guest-tasks'

    const saveTasksToLocalStorage = () => {
        try {
            localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(_rawTasks.value))
            console.log(`💾 [GUEST-MODE] Saved ${_rawTasks.value.length} tasks to localStorage`)
        } catch (e) {
            console.error('❌ [GUEST-MODE] Failed to save tasks to localStorage:', e)
        }
    }

    const loadTasksFromLocalStorage = (): Task[] => {
        try {
            const stored = localStorage.getItem(GUEST_TASKS_KEY)
            if (stored) {
                const tasks = JSON.parse(stored) as Task[]
                console.log(`📦 [GUEST-MODE] Loaded ${tasks.length} tasks from localStorage`)
                return tasks
            }
        } catch (e) {
            console.error('❌ [GUEST-MODE] Failed to load tasks from localStorage:', e)
        }
        return []
    }

    const deleteTaskFromStorage = async (taskId: string): Promise<void> => {
        console.log(`🗑️ [PERSISTENCE] deleteTaskFromStorage called for: ${taskId}`)

        // NOTE: localStorage save happens in taskOperations.deleteTask AFTER splice
        // Don't save here - the task is still in _rawTasks at this point!

        // In Guest Mode, skip Supabase deletion
        const { useAuthStore } = await import('@/stores/auth')
        const authStore = useAuthStore()
        if (!authStore.isAuthenticated) {
            console.log(`✅ [PERSISTENCE] Task ${taskId} will be removed from localStorage after splice`)
            return
        }

        try {
            await deleteFromDB(taskId)
            console.log(`✅ [PERSISTENCE] Task ${taskId} soft-deleted successfully`)
        } catch (e) {
            console.error(`❌ [PERSISTENCE] Task deletion failed for ${taskId}:`, e)
            throw e  // Re-throw so deleteTask in taskOperations knows it failed
        }
    }

    // BUG-025 FIX: Atomic bulk delete for multiple tasks
    const bulkDeleteTasksFromStorage = async (taskIds: string[]): Promise<void> => {
        if (taskIds.length === 0) return
        console.log(`🗑️ [PERSISTENCE] bulkDeleteTasksFromStorage called for ${taskIds.length} tasks`)

        // NOTE: localStorage save happens in caller AFTER array modification
        // Don't save here - tasks are still in _rawTasks at this point!

        // In Guest Mode, skip Supabase deletion
        const { useAuthStore } = await import('@/stores/auth')
        const authStore = useAuthStore()
        if (!authStore.isAuthenticated) {
            console.log(`✅ [PERSISTENCE] ${taskIds.length} tasks will be removed from localStorage after splice`)
            return
        }

        try {
            await bulkDeleteFromDB(taskIds)
            console.log(`✅ [PERSISTENCE] ${taskIds.length} tasks soft-deleted atomically`)
        } catch (e) {
            console.error(`❌ [PERSISTENCE] Bulk task deletion failed:`, e)
            throw e // Re-throw so bulkDeleteTasks in taskOperations knows it failed
        }
    }

    const saveTasksToStorage = async (tasksToSave: Task[], context: string = 'unknown'): Promise<void> => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof window !== 'undefined' && (window as any).__STORYBOOK__) return

        // Always save to localStorage for persistence across refreshes (guest mode)
        saveTasksToLocalStorage()

        try {
            // Validation
            const validation = validateBeforeSave(tasksToSave)
            if (validation.blockedTasks.length > 0) {
                console.error(`🛡️ [PRE-SAVE] Blocked ${validation.blockedTasks.length} tasks with invalid IDs (${context})`)
            }

            const validTasksToSave = validation.validTasks
            if (validTasksToSave.length === 0) return

            logTaskIdStats(validTasksToSave, `save-${context}`)

            await saveTasks(validTasksToSave)
            // console.debug(`✅ [SUPABASE] Saved ${validTasksToSave.length} tasks (${context})`)

        } catch (e) {
            // Supabase failed or skipped (guest mode) - localStorage backup is still saved
            console.debug(`⏭️ [PERSISTENCE] Supabase skipped/failed - localStorage backup saved (${context})`)
        }
    }

    const saveSpecificTasks = saveTasksToStorage

    // --- LOAD LOGIC ---

    const loadFromDatabase = async () => {
        try {
            isLoadingFromDatabase.value = true

            // Guest mode: load from localStorage (persists across refreshes)
            const { useAuthStore } = await import('@/stores/auth')
            const authStore = useAuthStore()
            if (!authStore.isAuthenticated) {
                const localTasks = loadTasksFromLocalStorage()
                console.log(`👤 [GUEST-MODE] Loaded ${localTasks.length} tasks from localStorage`)
                _rawTasks.value = localTasks
                return
            }

            const loadedTasks = await fetchTasks()

            // TASK-142: Position integrity validation - detect invalid canvas positions early
            const tasksWithPositions = loadedTasks.filter(t => t.canvasPosition)
            const invalidTasks = tasksWithPositions.filter(t =>
                !Number.isFinite(t.canvasPosition?.x) ||
                !Number.isFinite(t.canvasPosition?.y)
            )
            if (invalidTasks.length > 0) {
                console.error(`❌ [INTEGRITY] ${invalidTasks.length} tasks have invalid canvas positions:`,
                    invalidTasks.map(t => `${t.title}: ${JSON.stringify(t.canvasPosition)}`))
            }

            // BUG-169 FIX: Safety guard - don't overwrite existing tasks with empty array
            // This prevents data loss from race conditions during auth propagation
            if (loadedTasks.length === 0 && _rawTasks.value.length > 0) {
                const sessionStart = typeof window !== 'undefined' ? (window as any).PomoFlowSessionStart || 0 : 0
                const timeSinceSessionStart = Date.now() - sessionStart

                // In the first 10 seconds, don't overwrite existing tasks with empty
                if (timeSinceSessionStart < 10000) {
                    console.warn(`🛡️ [TASK-LOAD] BLOCKED empty overwrite - ${_rawTasks.value.length} existing tasks would be lost (session ${timeSinceSessionStart}ms old)`)
                    return
                }

                console.warn(`⚠️ [TASK-LOAD] Supabase returned 0 tasks but ${_rawTasks.value.length} exist locally - proceeding with empty (session ${timeSinceSessionStart}ms old)`)
            }

            _rawTasks.value = loadedTasks
            console.log(`✅ [SUPABASE] Loaded ${loadedTasks.length} tasks (${tasksWithPositions.length} with canvas positions)`)

        } catch (error) {
            console.error('❌ [SUPABASE] Load failed:', error)
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        deleteTaskFromStorage,
        bulkDeleteTasksFromStorage,  // BUG-025: Atomic bulk delete
        loadFromDatabase,
        loadPersistedFilters,
        persistFilters,
        importTasksFromJSON: async () => {
            // Disabled / TBD
        },
        importFromRecoveryTool: async () => {
            // Disabled
        },
        recoverSoftDeletedTasks: async () => 0, // TBD: SQL Implementation needed later
        importTasks: async (tasksToImport: Task[]) => {
            // Basic import logic reused
            if (!tasksToImport.length) return
            const existingIds = new Set(_rawTasks.value.map(t => t.id))
            const newTasks = tasksToImport.filter(t => !existingIds.has(t.id))
            if (newTasks.length > 0) {
                _rawTasks.value.push(...newTasks)
                await saveTasksToStorage(_rawTasks.value, 'import-tool')
            }
        }
    }
}
