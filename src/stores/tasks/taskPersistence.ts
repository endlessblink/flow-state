import { ref, type Ref } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import type { Task } from '@/types/tasks'
import { useProjectStore } from '../projects'
import { validateBeforeSave, logTaskIdStats } from '@/utils/taskValidation'
import { logSupabaseTaskIdHistogram } from '@/utils/canvas/invariants'
// TASK-1215: Tauri dual-write for filter persistence
import { getTauriStore, isTauriEnv, scheduleTauriSave } from '@/composables/usePersistentRef'

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
    // TASK-1215: Added duration filter persistence
    activeDurationFilter: Ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>,
    isLoadingFromDatabase: Ref<boolean>,
    _manualOperationInProgress: Ref<boolean>,
    isLoadingFilters: Ref<boolean>,
    _syncInProgress: Ref<boolean>,
    _runAllTaskMigrations: () => void
) {
    const projectStore = useProjectStore()

    // BUG-1084 v5: Flag to indicate that loadFromDatabase has completed at least once
    // Used by useCanvasOrchestrator to wait for store initialization before syncing
    const _hasInitializedOnce = ref(false)
    const FILTER_STORAGE_KEY = 'flowstate-filters'

    interface PersistedFilterState {
        activeProjectId: string | null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        activeSmartView: any
        activeStatusFilter: string | null
        // TASK-1215: Added missing duration filter persistence
        activeDurationFilter?: 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null
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

    // BUG-1207 FIX (Fix 1.2b): Reentrancy guard for loadFromDatabase.
    // If called while already loading (e.g., auth recovery + realtime both trigger reload),
    // return the existing promise instead of starting a second concurrent fetch.
    // This prevents race conditions where two loads merge/overwrite each other's results.
    let _loadPromise: Promise<void> | null = null

    const loadFromDatabase = async () => {
        if (_loadPromise) {
            console.log('[TASK-LOAD] Reentrancy guard: returning existing load promise')
            return _loadPromise
        }
        _loadPromise = _loadFromDatabaseImpl()
        try {
            await _loadPromise
        } finally {
            _loadPromise = null
        }
    }

    const _loadFromDatabaseImpl = async () => {
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
            // TASK-1177: Extended from 10 seconds to 60 seconds for better protection
            if (loadedTasks.length === 0 && _rawTasks.value.length > 0) {
                const sessionStart = typeof window !== 'undefined' ? (window as any).FlowStateSessionStart || 0 : 0
                const timeSinceSessionStart = Date.now() - sessionStart

                // In the first 60 seconds, don't overwrite existing tasks with empty
                // This gives plenty of time for network issues to resolve
                if (timeSinceSessionStart < 60000) {
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

            // ================================================================
            // SMART MERGE STRATEGY (BUG-FIX)
            // ================================================================
            // Instead of blindly overwriting local state with DB state, we merge carefully.
            // This handles "Auth Recovery -> Reload" scenarios where local state involves
            // recent optimistic updates that haven't persisted to DB yet due to connection drop.

            // 1. Index remote tasks
            const remoteMap = new Map(loadedTasks.map(t => [t.id, t]))
            const mergedTasks: Task[] = []

            // 2. Process existing local tasks (Preserve optimistic, Handle Remote Deletes)
            const localTasksMap = new Map(_rawTasks.value.map(t => [t.id, t]))

            for (const localTask of _rawTasks.value) {
                const remoteTask = remoteMap.get(localTask.id)

                if (remoteTask) {
                    // CONFLICT: Task exists in both. Check who wins.
                    // Win Condition 1: Local is explicitly newer (updatedAt > remote)
                    const localTime = localTask.updatedAt instanceof Date ? localTask.updatedAt.getTime() : new Date(localTask.updatedAt).getTime()
                    const remoteTime = remoteTask.updatedAt instanceof Date ? remoteTask.updatedAt.getTime() : new Date(remoteTask.updatedAt).getTime()

                    // Win Condition 2: Local position version is higher (specific for drag operations)
                    const localVer = localTask.positionVersion ?? 0
                    const remoteVer = remoteTask.positionVersion ?? 0

                    // Win Condition 3: Local updated very recently - likely active editing
                    // BUG-1207 FIX: Extended from 5s to 30s to match pendingWrites timeout.
                    // 5s was too narrow — tasks edited 6s ago could be clobbered by recovery reload
                    // if the sync queue hadn't processed them yet (VPS latency can be 20s+).
                    const now = Date.now()
                    const isVeryRecent = (now - localTime) < 30000

                    if (localVer > remoteVer || localTime > remoteTime || isVeryRecent) {
                        console.log(`🛡️ [SMART-MERGE] Preserving local task "${localTask.title?.slice(0, 15)}" (Local v${localVer} > Remote v${remoteVer} || Local newer)`)
                        mergedTasks.push(localTask)
                    } else {
                        // Remote is newer or equal -> Accept remote
                        // BUG-1206 DEBUG: Log when remote description overwrites local
                        if (localTask.description !== remoteTask.description) {
                            console.warn('🐛 [BUG-1206] SMART-MERGE OVERWRITE - description changed!', {
                                taskId: localTask.id?.slice(0, 8),
                                localDescLength: localTask.description?.length,
                                localDescPreview: localTask.description?.slice(0, 50),
                                remoteDescLength: remoteTask.description?.length,
                                remoteDescPreview: remoteTask.description?.slice(0, 50),
                                localTime: new Date(localTime).toISOString(),
                                remoteTime: new Date(remoteTime).toISOString(),
                                isVeryRecent
                            })
                        }
                        mergedTasks.push(remoteTask)
                    }

                    // Mark as processed so we don't add it again in step 3
                    remoteMap.delete(localTask.id)
                } else {
                    // TASK-1177 FIX: NEVER drop local-only tasks automatically
                    // Previous behavior dropped tasks older than 5 minutes, causing DATA LOSS
                    // when sync failed and user refreshed.
                    //
                    // New behavior: ALWAYS preserve local tasks and queue for sync retry.
                    // The offline-first sync system (useSyncOrchestrator) handles retries.

                    console.log(`🛡️ [SMART-MERGE] Preserving local-only task "${localTask.title?.slice(0, 15)}" - will sync when online`)
                    mergedTasks.push(localTask)

                    // Queue the task for sync retry via the offline sync system
                    // This is async and non-blocking - the task stays in memory regardless
                    import('@/composables/sync/useSyncOrchestrator').then(({ useSyncOrchestrator }) => {
                        const sync = useSyncOrchestrator()
                        sync.enqueue({
                            entityType: 'task',
                            operation: 'create',
                            entityId: localTask.id,
                            payload: localTask as unknown as Record<string, unknown>
                        }).catch(e => {
                            console.warn(`[SMART-MERGE] Failed to queue sync for "${localTask.title?.slice(0, 15)}":`, e)
                        })
                    }).catch(() => {
                        // Sync orchestrator not available - task is still preserved in memory
                    })
                }
            }

            // 3. Add remaining remote tasks (New from Remote)
            for (const [_, remoteTask] of remoteMap) {
                mergedTasks.push(remoteTask)
            }

            // BUG-1207 FIX (Fix 2.2): Granular updates instead of full array replacement.
            // `_rawTasks.value = mergedTasks` replaces the entire ref, causing ALL watchers
            // and computeds to re-fire (even for unchanged tasks). Instead, surgically
            // update/add/remove individual entries to minimize reactivity churn.
            const mergedMap = new Map(mergedTasks.map(t => [t.id, t]))

            // Update existing or remove stale entries (iterate backwards for safe splice)
            for (let i = _rawTasks.value.length - 1; i >= 0; i--) {
                const existing = _rawTasks.value[i]
                const merged = mergedMap.get(existing.id)
                if (merged) {
                    // Task exists in merged result - update in place if different
                    if (existing !== merged) {
                        _rawTasks.value[i] = merged
                    }
                    mergedMap.delete(existing.id)
                } else {
                    // Task not in merged result - remove it
                    _rawTasks.value.splice(i, 1)
                }
            }

            // Add any new tasks from merged result that weren't already in the array
            for (const [, newTask] of mergedMap) {
                _rawTasks.value.push(newTask)
            }

            console.log(`✅ [SMART-MERGE] Complete. Local: ${localTasksMap.size} -> Merged: ${mergedTasks.length} (Fetched: ${loadedTasks.length})`)

        } catch (error) {
            console.error('❌ [SUPABASE] Load failed:', error)
        } finally {
            isLoadingFromDatabase.value = false
            // BUG-1084 v5: Mark initialization complete (even on error)
            _hasInitializedOnce.value = true
        }
    }

    // --- FILTERS ---
    // (Kept as localStorage only, same as before)

    const applyFilterState = (state: PersistedFilterState) => {
        if (state.activeProjectId && !projectStore.projects.find(p => p.id === state.activeProjectId)) {
            state.activeProjectId = null
        }
        projectStore.setActiveProject(state.activeProjectId)
        activeSmartView.value = state.activeSmartView
        activeStatusFilter.value = state.activeStatusFilter
        // TASK-1215: Restore duration filter
        activeDurationFilter.value = state.activeDurationFilter ?? null
        hideCanvasDoneTasks.value = state.hideCanvasDoneTasks ?? true
        hideCalendarDoneTasks.value = state.hideCalendarDoneTasks ?? false
        hideCanvasOverdueTasks.value = state.hideCanvasOverdueTasks ?? false
    }

    const loadFiltersFromLocalStorage = () => {
        try {
            // TASK-1267: Migrate from old key prefix
            if (!localStorage.getItem(FILTER_STORAGE_KEY)) {
                const oldData = localStorage.getItem('flow-state-filters')
                if (oldData) {
                    localStorage.setItem(FILTER_STORAGE_KEY, oldData)
                    localStorage.removeItem('flow-state-filters')
                }
            }
            const localSaved = localStorage.getItem(FILTER_STORAGE_KEY)
            if (localSaved) {
                const state: PersistedFilterState = JSON.parse(localSaved)
                applyFilterState(state)
                return true
            }
        } catch (_e) {
            console.warn('Failed to load filters from localStorage:', _e)
        }
        return false
    }

    const loadPersistedFilters = async () => {
        isLoadingFilters.value = true
        try {
            const loadedFromLocal = loadFiltersFromLocalStorage()

            // BUG-1219: In Tauri, localStorage can be empty after restart.
            // Fall back to reading directly from Tauri native store.
            if (!loadedFromLocal && isTauriEnv()) {
                try {
                    const store = await getTauriStore()
                    if (store) {
                        const state = await store.get(FILTER_STORAGE_KEY) as PersistedFilterState | null
                        if (state) {
                            console.log('[TaskPersistence] Restored filters from Tauri store (localStorage was empty)')
                            applyFilterState(state)
                            // Re-populate localStorage so subsequent reads work
                            localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state))
                        }
                    }
                } catch (e) {
                    console.warn('[TaskPersistence] Failed to read filters from Tauri store:', e)
                }
            }
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
                // TASK-1215: Persist duration filter
                activeDurationFilter: activeDurationFilter.value,
                hideCanvasDoneTasks: hideCanvasDoneTasks.value,
                hideCalendarDoneTasks: hideCalendarDoneTasks.value,
                hideCanvasOverdueTasks: hideCanvasOverdueTasks.value
            }
            localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state))

            // TASK-1215: Also write to Tauri store for reliable persistence
            // BUG-1219: Flush immediately (no scheduleTauriSave debounce) to prevent
            // data loss if the app is closed shortly after a filter change
            if (isTauriEnv()) {
                const store = await getTauriStore()
                if (store) {
                    try {
                        await store.set(FILTER_STORAGE_KEY, state)
                        await store.save()
                    } catch (e) {
                        console.warn('[TaskPersistence] Failed to write filters to Tauri store:', e)
                    }
                }
            }
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
        // BUG-1084 v5: Expose initialization flag for orchestrator
        _hasInitializedOnce,
        importTasksFromJSON: async () => {
            throw new Error('importTasksFromJSON is not implemented')
        },
        importFromRecoveryTool: async () => {
            throw new Error('importFromRecoveryTool is not implemented')
        },
        recoverSoftDeletedTasks: async () => {
            console.warn('[taskPersistence] recoverSoftDeletedTasks is not yet implemented')
            return 0
        }, // TBD: SQL Implementation needed later

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
