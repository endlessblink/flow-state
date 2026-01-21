import { type Ref } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { Task } from '@/types/tasks'
import { useProjectStore } from '../projects'
import { validateBeforeSave, logTaskIdStats } from '@/utils/taskValidation'
import { logSupabaseTaskIdHistogram } from '@/utils/canvas/invariants'

export function useTaskPersistence(
    // SAFETY: Named _rawTasks to indicate this is the raw array for load/save operations
    _rawTasks: Ref<Task[]>,
    hideDoneTasks: Ref<boolean>,
    hideCanvasDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks: Ref<boolean>,
    hideCanvasOverdueTasks: Ref<boolean>,
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
    const FILTER_STORAGE_KEY = 'flow-state-filters'

    interface PersistedFilterState {
        activeProjectId: string | null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeSmartView: any
        activeStatusFilter: string | null
        hideCanvasDoneTasks?: boolean
        hideCalendarDoneTasks?: boolean
        hideCanvasOverdueTasks?: boolean
    }

    // --- SQL PERSISTENCE ---

    // -- Supabase Integration --
    const { fetchTasks, saveTasks, deleteTask: deleteFromDB, bulkDeleteTasks: bulkDeleteFromDB } = useSupabaseDatabase()

    // TASK-142 FIX: Guest Mode localStorage persistence for tasks
    const GUEST_TASKS_KEY = 'flowstate-guest-tasks'

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

                // BUG-339: Deduplicate by ID to prevent guest mode congestion
                const seenIds = new Set<string>()
                const uniqueTasks = tasks.filter(task => {
                    if (seenIds.has(task.id)) {
                        console.warn(`🔄 [GUEST-MODE] Removing duplicate task: ${task.id}`)
                        return false
                    }
                    seenIds.add(task.id)
                    return true
                })

                if (uniqueTasks.length < tasks.length) {
                    console.log(`🧹 [GUEST-MODE] Removed ${tasks.length - uniqueTasks.length} duplicate tasks`)
                    // Save cleaned data back
                    localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(uniqueTasks))
                }

                console.log(`📦 [GUEST-MODE] Loaded ${uniqueTasks.length} tasks from localStorage`)
                return uniqueTasks
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

        // BUG-339 FIX: Only save to guest localStorage when NOT authenticated
        // Previously this saved unconditionally, leaking Supabase tasks to guest storage
        // which caused duplicates when migrating on next sign-in
        const { useAuthStore } = await import('@/stores/auth')
        const authStore = useAuthStore()
        if (!authStore.isAuthenticated) {
            saveTasksToLocalStorage()
        } else {
            // BUG-339: Clear guest tasks if signed in (prevents stale data buildup)
            localStorage.removeItem(GUEST_TASKS_KEY)
        }

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

        } catch (_e) {
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

            // BUG-339: Guest localStorage is now cleared in useAppInitialization
            // via clearStaleGuestTasks() BEFORE this function is called

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
                const sessionStart = typeof window !== 'undefined' ? (window as any).FlowStateSessionStart || 0 : 0
                const timeSinceSessionStart = Date.now() - sessionStart

                // In the first 10 seconds, don't overwrite existing tasks with empty
                if (timeSinceSessionStart < 10000) {
                    console.warn(`🛡️ [TASK-LOAD] BLOCKED empty overwrite - ${_rawTasks.value.length} existing tasks would be lost (session ${timeSinceSessionStart}ms old)`)
                    return
                }

                console.warn(`⚠️ [TASK-LOAD] Supabase returned 0 tasks but ${_rawTasks.value.length} exist locally - proceeding with empty (session ${timeSinceSessionStart}ms old)`)
            }

            // ================================================================
            // DUPLICATE DETECTION - Supabase Load Layer (AUTHORITATIVE)
            // ================================================================
            // Uses centralized helper for consistent detection across all layers
            // A duplicate here means the bug is at the database level
            logSupabaseTaskIdHistogram(loadedTasks, 'loadFromDatabase')

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
                hideCanvasOverdueTasks.value = state.hideCanvasOverdueTasks ?? false
            }
        } catch (_e) {
            console.warn('Failed to load filters from localStorage:', _e)
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
                hideCalendarDoneTasks: hideCalendarDoneTasks.value,
                hideCanvasOverdueTasks: hideCanvasOverdueTasks.value
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

        /**
         * TASK-344: Import tasks with immutable ID enforcement
         * Checks both local store AND Supabase for existing/tombstoned IDs
         */
        importTasks: async (tasksToImport: Task[]) => {
            if (!tasksToImport.length) return { imported: 0, skipped: 0, skippedIds: [] as string[] }

            // First, filter out tasks that exist locally
            const localIds = new Set(_rawTasks.value.map(t => t.id))
            const notInLocal = tasksToImport.filter(t => !localIds.has(t.id))

            if (notInLocal.length === 0) {
                console.log('[TASK-344] All tasks already exist locally - nothing to import')
                return { imported: 0, skipped: tasksToImport.length, skippedIds: tasksToImport.map(t => t.id) }
            }

            // TASK-344: Check Supabase for existing/tombstoned IDs
            const { useAuthStore } = await import('@/stores/auth')
            const authStore = useAuthStore()

            let tasksToAdd = notInLocal
            const skippedIds: string[] = tasksToImport.filter(t => localIds.has(t.id)).map(t => t.id)

            if (authStore.isAuthenticated) {
                const { checkTaskIdsAvailability, logDedupDecision } = useSupabaseDatabase()
                const taskIds = notInLocal.map(t => t.id)
                const availability = await checkTaskIdsAvailability(taskIds)

                const availableIds = new Set(
                    availability
                        .filter(a => a.status === 'available')
                        .map(a => a.taskId)
                )

                tasksToAdd = notInLocal.filter(t => availableIds.has(t.id))

                // Log skipped tasks
                for (const result of availability) {
                    if (result.status !== 'available') {
                        skippedIds.push(result.taskId)
                        await logDedupDecision(
                            'sync',
                            result.taskId,
                            result.status === 'tombstoned' ? 'skipped_tombstoned' : 'skipped_exists',
                            result.reason
                        )
                    }
                }

                console.log(`[TASK-344] Import filter: ${tasksToAdd.length}/${notInLocal.length} tasks available (${notInLocal.length - tasksToAdd.length} exist/tombstoned)`)
            }

            if (tasksToAdd.length > 0) {
                _rawTasks.value.push(...tasksToAdd)
                await saveTasksToStorage(_rawTasks.value, 'import-tool')
            }

            return {
                imported: tasksToAdd.length,
                skipped: tasksToImport.length - tasksToAdd.length,
                skippedIds
            }
        }
    }
}
