import { ref, type Ref } from 'vue'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { PENDING_WRITE_TIMEOUT_MS } from '@/config/timing'
import type { Task } from '@/types/tasks'
import { cacheTasks, captureReadCacheScope, configureReadCacheScope, getCachedTasks, getCachedTasksWithPendingWrites, isReadCacheScopeTokenCurrent, overlayPendingTaskWrites } from '@/services/offline/readCacheDB'
import { useProjectStore } from '../projects'
import { validateBeforeSave, logTaskIdStats, repairTaskTitles, sanitizeLoadedTasks } from '@/utils/taskValidation'
import { logSupabaseTaskIdHistogram } from '@/utils/canvas/invariants'
import { logPermanentDeleteTraceIfActive } from '@/utils/permanentDeleteTrace'
// TASK-1215: Tauri dual-write for filter persistence
import { getTauriStore, isTauriEnv } from '@/composables/usePersistentRef'
import type { SmartView } from '@/composables/tasks/useTaskFiltering'

const FALLBACK_TASK_TITLE = 'Untitled Task'

const isRealTaskTitle = (title: unknown): title is string =>
    typeof title === 'string' && title.trim().length > 0 && title.trim() !== FALLBACK_TASK_TITLE

const shouldPreserveRemoteTitle = (localTask: Task, remoteTask: Task): boolean =>
    !isRealTaskTitle(localTask.title) && isRealTaskTitle(remoteTask.title)

type TaskStorageAuthState = {
    user: { id?: string } | null
    isAuthenticated: boolean
    isRestoringSession?: boolean
}

export function taskStorageOwner(auth: TaskStorageAuthState): 'restoring' | 'guest' | 'account' {
    if (auth.isRestoringSession && auth.user?.id) return 'restoring'
    if (auth.isAuthenticated && auth.user?.id) return 'account'
    return 'guest'
}

export function useTaskPersistence(
    // SAFETY: Named _rawTasks to indicate this is the raw array for load/save operations
    _rawTasks: Ref<Task[]>,
    hideDoneTasks: Ref<boolean>,
    hideBoardDoneTasks: Ref<boolean>,
    hideCanvasDoneTasks: Ref<boolean>,
    hideCalendarDoneTasks: Ref<boolean>,
    hideCanvasOverdueTasks: Ref<boolean>,
    showFutureRecurring: Ref<boolean>,
    activeSmartView: Ref<SmartView>,
    activeStatusFilter: Ref<string | null>,
    // TASK-1215: Added duration filter persistence
    activeDurationFilter: Ref<'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null>,
    isLoadingFromDatabase: Ref<boolean>,
    _manualOperationInProgress: Ref<boolean>,
    isLoadingFilters: Ref<boolean>,
    _syncInProgress: Ref<boolean>,
    _runAllTaskMigrations: () => void,
    isPendingWrite: (taskId: string) => boolean
) {
    const projectStore = useProjectStore()

    // BUG-1084 v5: Flag to indicate that loadFromDatabase has completed at least once
    // Used by useCanvasOrchestrator to wait for store initialization before syncing
    const _hasInitializedOnce = ref(false)
    const FILTER_STORAGE_KEY = 'flowstate-filters'

    interface PersistedFilterState {
        activeProjectId: string | null
        activeSmartView: SmartView
        activeStatusFilter: string | null
        // TASK-1215: Added missing duration filter persistence
        activeDurationFilter?: 'quick' | 'short' | 'medium' | 'long' | 'unestimated' | null
        hideBoardDoneTasks?: boolean
        hideCanvasDoneTasks?: boolean
        hideCalendarDoneTasks?: boolean
        hideCanvasOverdueTasks?: boolean
        showFutureRecurring?: boolean
    }

    // --- SQL PERSISTENCE ---

    // -- Supabase Integration --
    const {
        fetchTasks,
        saveTasks,
        deleteTask: deleteFromDB,
        bulkDeleteTasks: bulkDeleteFromDB,
        fetchDeletedTaskIds = async () => [],
        fetchTombstones = async () => []
    } = useSupabaseDatabase()

    // TASK-142 FIX: Guest Mode localStorage persistence for tasks
    const GUEST_TASKS_KEY = 'flowstate-guest-tasks'

    const saveTasksToLocalStorage = () => {
        try {
            localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(_rawTasks.value))
            if (import.meta.env.DEV) {
                console.log(`💾 [GUEST-MODE] Saved ${_rawTasks.value.length} tasks to localStorage`)
            }
        } catch (e) {
            console.error('❌ [GUEST-MODE] Failed to save tasks to localStorage:', e)
            throw e
        }
    }

    const loadTasksFromLocalStorage = (): Task[] => {
        try {
            const stored = localStorage.getItem(GUEST_TASKS_KEY)
            if (stored) {
                const tasks = sanitizeLoadedTasks(JSON.parse(stored)) as Task[]

                // BUG-339: Deduplicate by ID to prevent guest mode congestion
                const seenIds = new Set<string>()
                const uniqueTasks = tasks.filter(task => {
                    if (seenIds.has(task.id)) {
                        if (import.meta.env.DEV) {
                            console.warn(`🔄 [GUEST-MODE] Removing duplicate task: ${task.id}`)
                        }
                        return false
                    }
                    seenIds.add(task.id)
                    return true
                })

                if (uniqueTasks.length < tasks.length) {
                    if (import.meta.env.DEV) {
                        console.log(`🧹 [GUEST-MODE] Removed ${tasks.length - uniqueTasks.length} duplicate tasks`)
                    }
                    // Save cleaned data back
                    localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(uniqueTasks))
                }

                if (import.meta.env.DEV) {
                    console.log(`📦 [GUEST-MODE] Loaded ${uniqueTasks.length} tasks from localStorage`)
                }
                return uniqueTasks
            }
        } catch (e) {
            console.error('❌ [GUEST-MODE] Failed to load tasks from localStorage:', e)
        }
        return []
    }

    const deleteTaskFromStorage = async (taskId: string): Promise<void> => {
        if (import.meta.env.DEV) {
            console.log(`🗑️ [PERSISTENCE] deleteTaskFromStorage called for: ${taskId}`)
        }

        // NOTE: localStorage save happens in taskOperations.deleteTask AFTER splice
        // Don't save here - the task is still in _rawTasks at this point!

        // In Guest Mode, skip Supabase deletion
        const { useAuthStore } = await import('@/stores/auth')
        const authStore = useAuthStore()
        if (!authStore.isAuthenticated) {
            if (import.meta.env.DEV) {
                console.log(`✅ [PERSISTENCE] Task ${taskId} will be removed from localStorage after splice`)
            }
            return
        }

        try {
            await deleteFromDB(taskId)
            if (import.meta.env.DEV) {
                console.log(`✅ [PERSISTENCE] Task ${taskId} soft-deleted successfully`)
            }
        } catch (e) {
            console.error(`❌ [PERSISTENCE] Task deletion failed for ${taskId}:`, e)
            throw e  // Re-throw so deleteTask in taskOperations knows it failed
        }
    }

    // BUG-025 FIX: Atomic bulk delete for multiple tasks
    const bulkDeleteTasksFromStorage = async (taskIds: string[]): Promise<void> => {
        if (taskIds.length === 0) return
        if (import.meta.env.DEV) {
            console.log(`🗑️ [PERSISTENCE] bulkDeleteTasksFromStorage called for ${taskIds.length} tasks`)
        }

        // NOTE: localStorage save happens in caller AFTER array modification
        // Don't save here - tasks are still in _rawTasks at this point!

        // In Guest Mode, skip Supabase deletion
        const { useAuthStore } = await import('@/stores/auth')
        const authStore = useAuthStore()
        if (!authStore.isAuthenticated) {
            if (import.meta.env.DEV) {
                console.log(`✅ [PERSISTENCE] ${taskIds.length} tasks will be removed from localStorage after splice`)
            }
            return
        }

        try {
            await bulkDeleteFromDB(taskIds)
            if (import.meta.env.DEV) {
                console.log(`✅ [PERSISTENCE] ${taskIds.length} tasks soft-deleted atomically`)
            }
        } catch (e) {
            console.error(`❌ [PERSISTENCE] Bulk task deletion failed:`, e)
            throw e // Re-throw so bulkDeleteTasks in taskOperations knows it failed
        }
    }

    const saveTasksToStorage = async (tasksToSave: Task[], context: string = 'unknown'): Promise<void> => {
        if (typeof window !== 'undefined' && (window as unknown as { __STORYBOOK__?: boolean }).__STORYBOOK__) return

        // BUG-339 FIX: Only save to guest localStorage when NOT authenticated
        // Previously this saved unconditionally, leaking Supabase tasks to guest storage
        // which caused duplicates when migrating on next sign-in
        const { useAuthStore } = await import('@/stores/auth')
        const authStore = useAuthStore()
        const storageOwner = taskStorageOwner(authStore)
        if (storageOwner === 'guest') {
            saveTasksToLocalStorage()
        } else if (storageOwner === 'account') {
            // BUG-339: Clear guest tasks if signed in (prevents stale data buildup)
            localStorage.removeItem(GUEST_TASKS_KEY)
        }

        try {
            const { repairedTasks, repairedCount } = repairTaskTitles(tasksToSave)
            if (repairedCount > 0) {
                for (const repaired of repairedTasks) {
                    const idx = _rawTasks.value.findIndex(task => task.id === repaired.id)
                    if (idx !== -1) _rawTasks.value[idx] = repaired
                }
                tasksToSave = repairedTasks
                console.warn(`🛠️ [TASK-TITLE-REPAIR] Repaired ${repairedCount} blank task title(s) before save (${context})`)
            }

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
            // BUG-1182 FIX: Distinguish between guest-mode skip (expected) and authenticated save failure (data loss risk)
            if (authStore.isAuthenticated) {
                console.error(`❌ [PERSISTENCE] Save failed while authenticated (${context}):`, _e)
                // Re-throw so callers can handle (e.g., enqueue for sync retry)
                throw _e
            } else {
                // Guest mode: Supabase skipped - localStorage backup is the primary store
                console.debug(`⏭️ [PERSISTENCE] Supabase skipped (guest mode) - localStorage backup saved (${context})`)
            }
        }
    }

    const saveSpecificTasks = saveTasksToStorage

    // --- LOAD LOGIC ---

    // BUG-1207 FIX (Fix 1.2b): Reentrancy guard for loadFromDatabase.
    // If called while already loading (e.g., auth recovery + realtime both trigger reload),
    // return the existing promise instead of starting a second concurrent fetch.
    // This prevents race conditions where two loads merge/overwrite each other's results.
    let _loadPromise: Promise<void> | null = null
    let _loadRequiresRemoteAuthority = false
    let _loadScopeKey: string | null = null

    const loadFromDatabase = async (options: {
        authoritativeTaskIds?: Iterable<string>
        requireRemoteAuthority?: boolean
        authorityScope?: { userId: string; workspaceId: string | null }
    } = {}) => {
        const [{ useAuthStore }, { useWorkspaceStore }] = await Promise.all([
            import('../auth'),
            import('../workspace'),
        ])
        const currentAuth = useAuthStore()
        const currentWorkspace = useWorkspaceStore()
        const requestedScopeKey = currentAuth.isAuthenticated && currentAuth.user?.id
            ? `${currentAuth.user.id}:${currentWorkspace.activeWorkspaceId ?? 'personal'}`
            : 'guest'
        if (_loadPromise) {
            const activeLoadRequiresRemoteAuthority = _loadRequiresRemoteAuthority
            const activeLoadScopeKey = _loadScopeKey
            let staleScopeFailure = false
            if (import.meta.env.DEV) {
                console.log('[TASK-LOAD] Reentrancy guard: returning existing load promise')
            }
            try {
                await _loadPromise
            } catch (error) {
                staleScopeFailure = error instanceof Error && error.message.includes('scope changed')
                if (
                    !staleScopeFailure
                    && !activeLoadRequiresRemoteAuthority
                    && !options.requireRemoteAuthority
                ) throw error
            }
            if (staleScopeFailure || activeLoadScopeKey !== requestedScopeKey) {
                _loadPromise = null
                _loadRequiresRemoteAuthority = false
                _loadScopeKey = null
                return loadFromDatabase(options)
            }
            if (activeLoadRequiresRemoteAuthority && !options.requireRemoteAuthority) {
                const [{ useWorkspaceStore }, { useAuthStore }] = await Promise.all([
                    import('../workspace'),
                    import('../auth'),
                ])
                const userId = useAuthStore().user?.id
                if (userId) {
                    return loadFromDatabase({
                        ...options,
                        requireRemoteAuthority: true,
                        authorityScope: {
                            userId,
                            workspaceId: useWorkspaceStore().activeWorkspaceId ?? null,
                        },
                    })
                }
            }
            if (activeLoadRequiresRemoteAuthority || options.authoritativeTaskIds || options.requireRemoteAuthority) {
                return loadFromDatabase(options)
            }
            return
        }
        _loadRequiresRemoteAuthority = options.requireRemoteAuthority === true
        _loadScopeKey = requestedScopeKey
        const startedLoad = _loadFromDatabaseImpl(
            new Set(options.authoritativeTaskIds || []),
            options.requireRemoteAuthority === true,
            options.authorityScope,
        )
        _loadPromise = startedLoad
        try {
            await startedLoad
        } finally {
            if (_loadPromise === startedLoad) {
                _loadPromise = null
                _loadRequiresRemoteAuthority = false
                _loadScopeKey = null
            }
        }
    }

    const _loadFromDatabaseImpl = async (
        authoritativeTaskIds: ReadonlySet<string>,
        requireRemoteAuthority: boolean,
        authorityScope?: { userId: string; workspaceId: string | null },
    ) => {
        try {
            isLoadingFromDatabase.value = true

            // Guest mode: load from localStorage (persists across refreshes)
            const { useAuthStore } = await import('@/stores/auth')
            const authStore = useAuthStore()
            if (!authStore.isAuthenticated) {
                const localTasks = loadTasksFromLocalStorage()
                const repairedGuest = repairTaskTitles(localTasks)
                if (repairedGuest.repairedCount > 0) {
                    localStorage.setItem(GUEST_TASKS_KEY, JSON.stringify(repairedGuest.repairedTasks))
                }
                console.log(`👤 [GUEST-MODE] Loaded ${localTasks.length} tasks from localStorage`)
                _rawTasks.value = repairedGuest.repairedTasks
                return
            }

            // BUG-339: Guest localStorage is now cleared in useAppInitialization
            // via clearStaleGuestTasks() BEFORE this function is called

            // Workspace collaboration: filter tasks by active workspace
            // Pass undefined (not null) for personal workspace — skips workspace_id filter
            // so it works before the migration adds the column to VPS
            const { useWorkspaceStore } = await import('../workspace')
            const wsStore = useWorkspaceStore()
            configureReadCacheScope({
                userId: authStore.user!.id,
                workspaceId: wsStore.activeWorkspaceId ?? null,
            })
            const readCacheScopeToken = captureReadCacheScope()
            const assertReadCacheScope = () => {
                if (
                    !readCacheScopeToken
                    || authStore.user?.id !== readCacheScopeToken.scope.userId
                    || wsStore.activeWorkspaceId !== readCacheScopeToken.scope.workspaceId
                    || !isReadCacheScopeTokenCurrent(readCacheScopeToken)
                ) {
                    throw new Error('Task load scope changed')
                }
            }
            const assertAuthorityScope = () => {
                if (!requireRemoteAuthority) return
                if (!authorityScope) throw new Error('Remote-authority load requires an exact scope')
                if (authStore.user?.id !== authorityScope.userId) {
                    throw new Error('Remote-authority user scope changed during task load')
                }
                if (wsStore.activeWorkspaceId !== authorityScope.workspaceId) {
                    throw new Error('Remote-authority workspace scope changed during task load')
                }
            }
            assertAuthorityScope()
            // Pass activeWorkspaceId directly: null = personal (filter IS NULL), string = workspace (filter eq), undefined = legacy (no filter)
            const workspaceId = authorityScope?.workspaceId ?? wsStore.activeWorkspaceId
            // BUG-1891: Track whether deletion markers loaded reliably. If either the soft-deleted-id
            // or tombstone fetch errors (network blip), both silently return [] — which previously made
            // the smart merge believe NOTHING was deleted and re-CREATE every in-memory deleted task
            // (resurrection vector #1). When unreliable we fail CLOSED: do not re-enqueue ambiguous
            // local-only tasks as CREATE.
            let deletionInfoReliable = true
            const markDeletionInfoUnreliable = () => { deletionInfoReliable = false }
            const [fetchedTasks, softDeletedTaskIds, tombstones] = await Promise.all([
                fetchTasks(workspaceId),
                fetchDeletedTaskIds({ onError: markDeletionInfoUnreliable }),
                fetchTombstones({ onError: markDeletionInfoUnreliable })
            ])
            assertReadCacheScope()
            assertAuthorityScope()
            if (!deletionInfoReliable) {
                console.warn('[BUG-1891] Deletion markers (soft-deleted ids / tombstones) failed to load — failing closed: ambiguous local-only tasks will NOT be re-created this load.')
            }
            const repairedLoaded = repairTaskTitles(sanitizeLoadedTasks(fetchedTasks))
            let loadedTasks = repairedLoaded.repairedTasks
            const remotelyDeletedTaskIds = new Set<string>([
                ...softDeletedTaskIds,
                ...tombstones
                    .filter(t => t.entityType === 'task')
                    .map(t => t.entityId)
            ])
            if (repairedLoaded.repairedCount > 0 && !requireRemoteAuthority) {
                console.warn(`🛠️ [TASK-TITLE-REPAIR] Repaired ${repairedLoaded.repairedCount} blank task title(s) during load`)
                try {
                    await saveTasks(loadedTasks)
                } catch (repairSaveError) {
                    console.warn('[TASK-TITLE-REPAIR] Failed to persist repaired titles during load:', repairSaveError)
                }
            }

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

            // Electron updates/restarts and hard refreshes can happen before the
            // offline sync queue has flushed a recent drag. Groups already merge
            // newer IndexedDB geometry on reload; do the same for tasks so a
            // restart cannot combine fresh group positions with stale task
            // positions from Supabase.
            const cachedTasks = (
                requireRemoteAuthority
                    ? await getCachedTasks()
                    : await getCachedTasksWithPendingWrites().catch(() => [])
            ) ?? []
            assertAuthorityScope()
            const durablePendingTaskIds = new Set<string>()
            if (requireRemoteAuthority) {
                const overlay = await overlayPendingTaskWrites(loadedTasks, {
                    scope: authorityScope,
                    fallbackTasks: cachedTasks,
                })
                loadedTasks = overlay.tasks
                for (const taskId of overlay.pendingTaskIds) durablePendingTaskIds.add(taskId)
                assertAuthorityScope()
            }
            const hasPendingTaskWrite = (taskId: string) =>
                isPendingWrite(taskId) || durablePendingTaskIds.has(taskId)
            const cachedById = new Map<string, Task>()
            for (const cachedTask of cachedTasks) {
                const existing = cachedById.get(cachedTask.id)
                const existingTime = existing?.updatedAt ? new Date(existing.updatedAt).getTime() : 0
                const cachedTime = cachedTask.updatedAt ? new Date(cachedTask.updatedAt).getTime() : 0
                const existingVersion = existing?.positionVersion ?? 0
                const cachedVersion = cachedTask.positionVersion ?? 0
                if (!existing || cachedVersion > existingVersion || (cachedVersion === existingVersion && cachedTime > existingTime)) {
                    cachedById.set(cachedTask.id, cachedTask)
                }
            }

            const locallyNewerGeometryIds = new Set<string>()
            const geometryMergedLoadedTasks = loadedTasks.map((remoteTask) => {
                const cachedTask = cachedById.get(remoteTask.id)
                if (!cachedTask) return remoteTask
                if (requireRemoteAuthority && !hasPendingTaskWrite(remoteTask.id)) return remoteTask

                const cachedVersion = cachedTask.positionVersion ?? 0
                const remoteVersion = remoteTask.positionVersion ?? 0
                const cachedTime = cachedTask.updatedAt ? new Date(cachedTask.updatedAt).getTime() : 0
                const remoteTime = remoteTask.updatedAt ? new Date(remoteTask.updatedAt).getTime() : 0
                const cachedIsNewer = cachedVersion > remoteVersion || (cachedVersion === remoteVersion && cachedTime > remoteTime)
                if (!cachedIsNewer) return remoteTask

                if (import.meta.env.DEV) {
                    console.log(`[TASK-LOAD] Preserving newer local canvas geometry for "${remoteTask.title?.slice(0, 30)}"`)
                }
                locallyNewerGeometryIds.add(remoteTask.id)
                return {
                    ...remoteTask,
                    canvasPosition: cachedTask.canvasPosition,
                    parentId: cachedTask.parentId,
                    positionFormat: cachedTask.positionFormat ?? remoteTask.positionFormat,
                    positionVersion: cachedVersion,
                    updatedAt: cachedTask.updatedAt ?? remoteTask.updatedAt,
                }
            })

            // BUG-169 FIX: Safety guard - don't overwrite existing tasks with empty array
            // This prevents data loss from race conditions during auth propagation
            // TASK-1177: Extended from 10 seconds to 60 seconds for better protection
            // Exception: workspace switches to an empty workspace are legitimate
            let emptyRemoteLoadIsProtected = false
            if (geometryMergedLoadedTasks.length === 0 && _rawTasks.value.length > 0) {
                const hasKnownRemoteDeletes = _rawTasks.value.some(task => remotelyDeletedTaskIds.has(task.id))
                if (wsStore.isSwitchingWorkspace) {
                    console.log(`🔄 [TASK-LOAD] Workspace switch — clearing ${_rawTasks.value.length} tasks for new workspace context`)
                } else if (!hasKnownRemoteDeletes) {
                    const sessionStart = typeof window !== 'undefined' ? (window as unknown as { FlowStateSessionStart?: number }).FlowStateSessionStart || 0 : 0
                    const timeSinceSessionStart = Date.now() - sessionStart

                    // In the first 60 seconds, don't overwrite existing tasks with empty
                    // This gives plenty of time for network issues to resolve
                    if (!requireRemoteAuthority && timeSinceSessionStart < 60000) {
                        console.warn(`🛡️ [TASK-LOAD] BLOCKED empty overwrite - ${_rawTasks.value.length} existing tasks would be lost (session ${timeSinceSessionStart}ms old)`)
                        emptyRemoteLoadIsProtected = true
                        return
                    }

                    console.warn(`⚠️ [TASK-LOAD] Supabase returned 0 tasks but ${_rawTasks.value.length} exist locally - proceeding with empty (session ${timeSinceSessionStart}ms old)`)
                } else if (import.meta.env.DEV) {
                    console.log('🪦 [TASK-LOAD] Empty remote load includes known deleted local tasks — allowing tombstone-aware merge')
                }
            }

            // ================================================================
            // DUPLICATE DETECTION - Supabase Load Layer (AUTHORITATIVE)
            // ================================================================
            // Uses centralized helper for consistent detection across all layers
            // A duplicate here means the bug is at the database level
            logSupabaseTaskIdHistogram(geometryMergedLoadedTasks, 'loadFromDatabase')

            // ================================================================
            // SMART MERGE STRATEGY (BUG-FIX)
            // ================================================================
            // Instead of blindly overwriting local state with DB state, we merge carefully.
            // This handles "Auth Recovery -> Reload" scenarios where local state involves
            // recent optimistic updates that haven't persisted to DB yet due to connection drop.

            // 1. Index remote tasks
            const remoteMap = new Map(geometryMergedLoadedTasks.map(t => [t.id, t]))
            const mergedTasks: Task[] = []
            const authenticatedEmptyRemoteLoad = geometryMergedLoadedTasks.length === 0 && !emptyRemoteLoadIsProtected

            // 2. Process existing local tasks (Preserve optimistic, Handle Remote Deletes)
            // A workspace load is an exact authority scope. Never compare or recover
            // tasks from another scope against this response: doing so can turn every
            // old-scope row into a CREATE in the newly selected workspace.
            const normalizedWorkspaceId = workspaceId ?? null
            const belongsToAuthorityScope = (task: Task) =>
                (task.workspaceId ?? null) === normalizedWorkspaceId
            const localTasksForScope = _rawTasks.value.filter(belongsToAuthorityScope)
            const localTasksMap = new Map(localTasksForScope.map(t => [t.id, t]))

            for (const localTask of localTasksForScope) {
                const remoteTask = remoteMap.get(localTask.id)

                // Local API receipts identify rows whose committed remote state is authoritative.
                // Accept or remove those exact rows before recent-edit/pending-write overlays,
                // while leaving unrelated local pending work protected.
                if (authoritativeTaskIds.has(localTask.id)) {
                    if (remoteTask) mergedTasks.push(remoteTask)
                    remoteMap.delete(localTask.id)
                    continue
                }

                // The durable queue overlay is already the correct local
                // projection after restart. It wins over stale in-memory state
                // for baseline and unrelated-ID reconciliation alike.
                if (requireRemoteAuthority && durablePendingTaskIds.has(localTask.id)) {
                    if (remoteTask) mergedTasks.push(remoteTask)
                    remoteMap.delete(localTask.id)
                    continue
                }

                // Canonical baseline/recovery loads accept the signed-user remote
                // projection for every non-pending row. Proven offline intent stays
                // visible until its queued operation resolves; absent non-pending rows
                // are removed without being re-created.
                if (requireRemoteAuthority && !hasPendingTaskWrite(localTask.id)) {
                    if (remoteTask) mergedTasks.push(remoteTask)
                    remoteMap.delete(localTask.id)
                    continue
                }

                // BUG-1206 FIX (Fix 1): Always preserve tasks with active pending writes.
                // A pending write means the user just edited this task and the save is still
                // in-flight or the echo hasn't been confirmed. Never accept remote data for these.
                if (remoteTask && hasPendingTaskWrite(localTask.id)) {
                    if (import.meta.env.DEV) {
                        console.log(`🛡️ [SMART-MERGE] Preserving pending-write task "${localTask.title?.slice(0, 15)}" (BUG-1206)`)
                    }
                    logPermanentDeleteTraceIfActive(localTask.id, 'task-load.smart-merge.preserve-pending-write', {
                        localTaskCount: _rawTasks.value.length,
                        remoteTaskCount: geometryMergedLoadedTasks.length,
                    })
                    mergedTasks.push(shouldPreserveRemoteTitle(localTask, remoteTask)
                        ? { ...localTask, title: remoteTask.title }
                        : localTask)
                    remoteMap.delete(localTask.id)
                    continue
                }

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
                    // BUG-1206 FIX (Fix 2): Extend isVeryRecent for Tauri.
                    // Tauri/WebKitGTK fires aggressive visibility changes that trigger loadFromDatabase()
                    // more frequently than browsers. 30s is too narrow — align with PENDING_WRITE_TIMEOUT_MS.
                    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
                    const RECENT_THRESHOLD_MS = isTauri ? PENDING_WRITE_TIMEOUT_MS : 30_000
                    const isVeryRecent = (now - localTime) < RECENT_THRESHOLD_MS

                    if (localVer > remoteVer || localTime > remoteTime || isVeryRecent) {
                        // BUG-1516 FIX (READ path): Field-level merge instead of whole-task LWW.
                        // Start with remote as base so remote-only field changes are preserved,
                        // then overlay local content fields on top (local wins for edited content).
                        // DB-authoritative fields (isPinned, is_deleted, etc.) always come from remote
                        // to prevent stale local state from overriding server truth.
                        const DB_AUTHORITATIVE_FIELDS = new Set([
                            'isPinned', '_soft_deleted', 'deletedAt',
                            'positionVersion', 'createdAt',
                            'recurrenceCount', 'recurrenceParentId',  // monotonically increasing, server is source of truth
                        ])
                        const merged = { ...remoteTask } as Task
                        for (const key of Object.keys(localTask) as (keyof Task)[]) {
                            if (key === 'title' && shouldPreserveRemoteTitle(localTask, remoteTask)) {
                                continue
                            }
                            if (localTask[key] !== undefined && !DB_AUTHORITATIVE_FIELDS.has(key)) {
                                (merged as any)[key] = localTask[key]
                            }
                        }
                        merged.updatedAt = new Date(Math.max(localTime, remoteTime))
                        if (import.meta.env.DEV) {
                            console.log(`🛡️ [SMART-MERGE] Field-merging local task "${localTask.title?.slice(0, 15)}" onto remote base (Local v${localVer} > Remote v${remoteVer} || Local newer)`)
                        }
                        logPermanentDeleteTraceIfActive(localTask.id, 'task-load.smart-merge.preserve-local-over-remote', {
                            localVer,
                            remoteVer,
                            localTime,
                            remoteTime,
                            isVeryRecent,
                        })
                        mergedTasks.push(merged)
                    } else {
                        // Remote is newer or equal -> Accept remote
                        // BUG-1206 DEBUG: Log when remote description overwrites local
                        if (localTask.description !== remoteTask.description) {
                            if (import.meta.env.DEV) {
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
                        }
                        logPermanentDeleteTraceIfActive(localTask.id, 'task-load.smart-merge.accept-remote', {
                            localTime,
                            remoteTime,
                            isVeryRecent,
                        })
                        mergedTasks.push(remoteTask)
                    }

                    // Mark as processed so we don't add it again in step 3
                    remoteMap.delete(localTask.id)
                } else {
                    // BUG-1800: A task missing from the active task query may be absent because
                    // another runtime permanently deleted it. Do not preserve and enqueue a
                    // CREATE for IDs that the server says are soft-deleted or tombstoned.
                    if (remotelyDeletedTaskIds.has(localTask.id)) {
                        if (import.meta.env.DEV) {
                            console.log(`🪦 [SMART-MERGE] Dropping deleted local-only task "${localTask.title?.slice(0, 15)}" - server has deletion marker`)
                        }
                        logPermanentDeleteTraceIfActive(localTask.id, 'task-load.smart-merge.drop-deleted-local-only', {
                            remoteTaskCount: geometryMergedLoadedTasks.length,
                            tombstoneOrSoftDelete: true,
                        })
                        continue
                    }

                    // TASK-1177 FIX: NEVER drop local-only tasks automatically
                    // Previous behavior dropped tasks older than 5 minutes, causing DATA LOSS
                    // when sync failed and user refreshed.
                    //
                    // New behavior: ALWAYS preserve local tasks and queue for sync retry.
                    // The offline-first sync system (useSyncOrchestrator) handles retries.

                    // BUG-1457: Skip soft-deleted local tasks — they were deleted (e.g., from
                    // KDE widget or another device) and the DB correctly excluded them.
                    // Preserving them would resurrect deleted tasks via the CREATE sync retry.
                    if (localTask._soft_deleted) {
                        if (import.meta.env.DEV) {
                            console.log(`🗑️ [SMART-MERGE] Dropping soft-deleted local-only task "${localTask.title?.slice(0, 15)}" - already deleted`)
                        }
                        logPermanentDeleteTraceIfActive(localTask.id, 'task-load.smart-merge.drop-soft-deleted-local-only', {
                            remoteTaskCount: geometryMergedLoadedTasks.length,
                        })
                        continue
                    }

                    // BUG-1457: If DB returned tasks (we're online) and this task has no
                    // pending sync queue entry, it was likely deleted externally (KDE widget,
                    // another device). Only preserve truly new local tasks (created recently).
                    // BUG-8: Tightened from PENDING_WRITE_TIMEOUT_MS (300s) to 30s to reduce resurrection window.
                    const RECENT_CREATE_WINDOW_MS = 30_000
                    const localCreatedAt = localTask.createdAt ? new Date(localTask.createdAt).getTime() : 0
                    const isRecentlyCreated = (Date.now() - localCreatedAt) < RECENT_CREATE_WINDOW_MS
                    const isCacheBackedLocalOnly = cachedById.has(localTask.id)
                    const shouldDropStaleLocalOnly = (geometryMergedLoadedTasks.length > 0 || authenticatedEmptyRemoteLoad)
                        && !isRecentlyCreated
                        && !isPendingWrite(localTask.id)
                        && !isCacheBackedLocalOnly
                    if (shouldDropStaleLocalOnly) {
                        if (import.meta.env.DEV) {
                            console.log(`🗑️ [SMART-MERGE] Dropping stale local-only task "${localTask.title?.slice(0, 15)}" - not in DB and not recently created`)
                        }
                        logPermanentDeleteTraceIfActive(localTask.id, 'task-load.smart-merge.drop-stale-local-only', {
                            remoteTaskCount: geometryMergedLoadedTasks.length,
                            authenticatedEmptyRemoteLoad,
                            isRecentlyCreated,
                            pendingWrite: isPendingWrite(localTask.id),
                            cacheBacked: isCacheBackedLocalOnly,
                        })
                        continue
                    }

                    if (import.meta.env.DEV) {
                        console.log(`🛡️ [SMART-MERGE] Preserving local-only task "${localTask.title?.slice(0, 15)}" - will sync when online`)
                    }
                    logPermanentDeleteTraceIfActive(localTask.id, 'task-load.smart-merge.preserve-local-only', {
                        remoteTaskCount: geometryMergedLoadedTasks.length,
                        authenticatedEmptyRemoteLoad,
                        isRecentlyCreated,
                        pendingWrite: isPendingWrite(localTask.id),
                        cacheBacked: isCacheBackedLocalOnly,
                    })
                    mergedTasks.push(localTask)

                    // BUG-1891: Fail closed. When deletion markers didn't load reliably we cannot tell a
                    // genuinely-new local task from one the server already deleted. Preserve it in memory
                    // (no data loss) but do NOT push a CREATE that could resurrect a deleted task — UNLESS
                    // it's unambiguously local new work (recently created or has a pending write).
                    if (!deletionInfoReliable && !isRecentlyCreated && !isPendingWrite(localTask.id)) {
                        if (import.meta.env.DEV) {
                            console.warn(`[BUG-1891] Skipping CREATE re-enqueue for ambiguous local-only task "${localTask.title?.slice(0, 15)}" - deletion markers unreliable this load`)
                        }
                        logPermanentDeleteTraceIfActive(localTask.id, 'task-load.smart-merge.skip-requeue-unreliable-deletion-info', {
                            remoteTaskCount: geometryMergedLoadedTasks.length,
                        })
                        continue
                    }

                    // Queue the task for sync retry via the offline sync system
                    // This is async and non-blocking - the task stays in memory regardless
                    // BUG-1533c: Use toSupabaseTask() to map app-side fields (camelCase, _soft_deleted)
                    // to DB column names. Previously sent raw localTask which caused PGRST204 errors
                    // ("Could not find the '_soft_deleted' column").
                    Promise.all([
                        import('@/composables/sync/useSyncOrchestrator'),
                        import('@/utils/supabaseMappers'),
                        import('@/stores/auth')
                    ]).then(([{ useSyncOrchestrator }, { toSupabaseTask }, { useAuthStore }]) => {
                        const sync = useSyncOrchestrator()
                        const userId = useAuthStore().user?.id
                        if (!userId) return
                        const mappedPayload = toSupabaseTask(localTask, userId)
                        // Clear soft-delete flags — this is a local-only task being preserved
                        const payload: Record<string, unknown> = {
                            ...mappedPayload,
                            is_deleted: false,
                            deleted_at: null
                        }
                        delete payload.position_version
                        sync.enqueue({
                            entityType: 'task',
                            operation: 'create',
                            entityId: localTask.id,
                            payload: JSON.parse(JSON.stringify(payload))
                        }).catch(e => {
                            console.warn(`[SMART-MERGE] Failed to queue sync for "${localTask.title?.slice(0, 15)}":`, e)
                        })
                    }).catch(() => {
                        // Sync orchestrator not available - task is still preserved in memory
                    })
                }
            }

            // 2b. Recover cache-backed tasks that are absent from both local
            // memory and the authenticated server response. This is the restore
            // path for sign-in/auth-recovery loads that briefly render an empty
            // or partial canvas even though IndexedDB still has the user's data.
            for (const [cachedTaskId, cachedTask] of cachedById) {
                if (!belongsToAuthorityScope(cachedTask)) continue
                if (localTasksMap.has(cachedTaskId) || remoteMap.has(cachedTaskId)) continue
                if (remotelyDeletedTaskIds.has(cachedTaskId) || cachedTask._soft_deleted) continue
                if (requireRemoteAuthority && !isPendingWrite(cachedTaskId)) continue

                if (import.meta.env.DEV) {
                    console.log(`🛟 [SMART-MERGE] Restoring cache-backed task "${cachedTask.title?.slice(0, 15)}" missing from local and remote`)
                }
                mergedTasks.push(cachedTask)

                // A canonical authority load may retain proven pending offline
                // intent, but must not synthesize another CREATE for it.
                if (requireRemoteAuthority) continue

                if (!deletionInfoReliable) continue

                Promise.all([
                    import('@/composables/sync/useSyncOrchestrator'),
                    import('@/utils/supabaseMappers'),
                    import('@/stores/auth')
                ]).then(([{ useSyncOrchestrator }, { toSupabaseTask }, { useAuthStore }]) => {
                    const sync = useSyncOrchestrator()
                    const userId = useAuthStore().user?.id
                    if (!userId) return
                    const mappedPayload = toSupabaseTask(cachedTask, userId)
                    const payload: Record<string, unknown> = {
                        ...mappedPayload,
                        is_deleted: false,
                        deleted_at: null
                    }
                    delete payload.position_version
                    sync.enqueue({
                        entityType: 'task',
                        operation: 'create',
                        entityId: cachedTask.id,
                        payload: JSON.parse(JSON.stringify(payload))
                    }).catch(e => {
                        console.warn(`[SMART-MERGE] Failed to queue cached task restore for "${cachedTask.title?.slice(0, 15)}":`, e)
                    })
                }).catch(() => {
                    // Sync orchestrator not available; recovered task remains visible locally.
                })
            }

            // 3. Add remaining remote tasks (New from Remote)
            for (const [_, remoteTask] of remoteMap) {
                mergedTasks.push(remoteTask)
            }

            // Canonical cursor advancement requires a durable projection. Cache
            // before mutating the visible store and re-check scope afterward so
            // an old workspace load cannot become visible in a new workspace.
            await cacheTasks(mergedTasks, {
                throwOnError: requireRemoteAuthority,
                scopeToken: readCacheScopeToken ?? undefined,
            })
            assertReadCacheScope()
            assertAuthorityScope()

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
                    logPermanentDeleteTraceIfActive(existing.id, 'task-load.apply-kept-existing', {
                        rawTaskCount: _rawTasks.value.length,
                    })
                    mergedMap.delete(existing.id)
                } else {
                    // Task not in merged result - remove it
                    logPermanentDeleteTraceIfActive(existing.id, 'task-load.apply-removed-existing', {
                        rawTaskCountBefore: _rawTasks.value.length,
                    })
                    _rawTasks.value.splice(i, 1)
                }
            }

            // Add any new tasks from merged result that weren't already in the array
            for (const [, newTask] of mergedMap) {
                _rawTasks.value.push(newTask)
            }

            // Safety dedup: ensure no duplicate task IDs in _rawTasks
            const seenIds = new Set<string>()
            for (let i = _rawTasks.value.length - 1; i >= 0; i--) {
                if (seenIds.has(_rawTasks.value[i].id)) {
                    _rawTasks.value.splice(i, 1)
                } else {
                    seenIds.add(_rawTasks.value[i].id)
                }
            }

            if (import.meta.env.DEV) {
                console.log(`✅ [SMART-MERGE] Complete. Local: ${localTasksMap.size} -> Merged: ${mergedTasks.length} (Fetched: ${loadedTasks.length})`)
            }

            for (const task of mergedTasks) {
                logPermanentDeleteTraceIfActive(task.id, 'task-load.cache-merged-includes-task', {
                    mergedTaskCount: mergedTasks.length,
                })
            }

            // If local cache had fresher geometry than the remote load, queue a
            // writeback so Supabase catches up after restart instead of leaving
            // the next cold start dependent on IndexedDB again.
            for (const taskId of locallyNewerGeometryIds) {
                const task = mergedTasks.find(t => t.id === taskId)
                if (!task) continue
                Promise.all([
                    import('@/composables/sync/useSyncOrchestrator'),
                    import('@/utils/supabaseMappers'),
                    import('@/stores/auth')
                ]).then(([{ useSyncOrchestrator }, { toSupabaseTask }, { useAuthStore }]) => {
                    const sync = useSyncOrchestrator()
                    const userId = useAuthStore().user?.id
                    if (!userId) return
                    const payload = toSupabaseTask(task, userId)
                    sync.enqueue({
                        entityType: 'task',
                        operation: 'update',
                        entityId: task.id,
                        payload: JSON.parse(JSON.stringify(payload)),
                        baseVersion: task.positionVersion ?? 0
                    }).catch(e => {
                        console.warn(`[TASK-LOAD] Failed to queue geometry catch-up for "${task.title?.slice(0, 15)}":`, e)
                    })
                }).catch(() => {
                    // Sync orchestrator not available; cached geometry is still preserved locally.
                })
            }

        } catch (error) {
            console.error('❌ [SUPABASE] Load failed:', error)

            // BUG-1411: Fall back to IndexedDB read cache when Supabase is unreachable
            if (!requireRemoteAuthority && _rawTasks.value.length === 0) {
                const cachedTasks = await getCachedTasks()
                if (cachedTasks && cachedTasks.length > 0) {
                    const repairedCached = repairTaskTitles(sanitizeLoadedTasks(cachedTasks))
                    console.log(`📦 [OFFLINE] Loaded ${cachedTasks.length} tasks from IndexedDB cache`)
                    _rawTasks.value = repairedCached.repairedTasks
                    // Don't throw — we have data from cache, degrade gracefully
                    return
                }
            }

            // BUG-1339: Re-throw so loadWithRetry in useAppInitialization can actually retry.
            // Previously this swallowed the error, making the retry mechanism dead code.
            throw error
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
        if (state.activeStatusFilter === 'all') state.activeStatusFilter = null
        activeStatusFilter.value = state.activeStatusFilter
        // TASK-1215: Restore duration filter
        activeDurationFilter.value = state.activeDurationFilter ?? null
        hideBoardDoneTasks.value = state.hideBoardDoneTasks ?? false
        hideCanvasDoneTasks.value = state.hideCanvasDoneTasks ?? true
        hideCalendarDoneTasks.value = state.hideCalendarDoneTasks ?? false
        hideCanvasOverdueTasks.value = state.hideCanvasOverdueTasks ?? false
        showFutureRecurring.value = state.showFutureRecurring ?? false
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

    let persistTimeout: ReturnType<typeof setTimeout> | null = null
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
                hideBoardDoneTasks: hideBoardDoneTasks.value,
                hideCanvasDoneTasks: hideCanvasDoneTasks.value,
                hideCalendarDoneTasks: hideCalendarDoneTasks.value,
                hideCanvasOverdueTasks: hideCanvasOverdueTasks.value,
                showFutureRecurring: showFutureRecurring.value
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
