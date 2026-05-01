import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { useWorkspaceStore } from '@/stores/workspace'
import { useSupabaseDatabase, invalidateCache } from '@/composables/useSupabaseDatabase'
import { useSafariITPProtection } from '@/utils/safariITPProtection'
import { initGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import { clearGuestData, clearStaleGuestTasks, getOrCreateGuestSessionId } from '@/utils/guestModeStorage'
// BUG-FIX: Import mappers to properly convert realtime data
import { fromSupabaseTask, fromSupabaseProject, fromSupabaseGroup, type SupabaseTask, type SupabaseProject, type SupabaseGroup } from '@/utils/supabaseMappers'
// TASK-1177: Offline-first sync system
import type { RealtimePayload } from '@/composables/supabase/useRealtimeSubscription'
import { useSyncOrchestrator } from '@/composables/sync/useSyncOrchestrator'
import { useBeforeUnload } from '@/composables/useBeforeUnload'
import { getInitialOnlineState } from '@/utils/platform'
// BUG-1411: Cache stats for offline mode detection
// TASK-1425: Full cache read functions for fast offline startup
// TASK-1427: Merged versions include pending write queue operations
import { getCacheStats, getCachedTasksWithPendingWrites, getCachedGroupsWithPendingWrites, getCachedProjects } from '@/services/offline/readCacheDB'
// TASK-1219: Time block progress notifications
import { useTimeBlockNotifications } from '@/composables/useTimeBlockNotifications'

export function useAppInitialization() {
    const router = useRouter()
    const timerStore = useTimerStore()
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const canvasStore = useCanvasStore()
    const uiStore = useUIStore()
    const notificationStore = useNotificationStore()
    const authStore = useAuthStore()
    const workspaceStore = useWorkspaceStore()
    const itpProtection = useSafariITPProtection()
    // BUG-1725: Must be called synchronously during setup(), not inside async onMounted
    useBeforeUnload()
    const activeChannel = ref<{ unsubscribe: () => Promise<void> } | null>(null)
    const realtimeInitialized = ref(false)
    const onMountedCompleted = ref(false)  // BUG-1106: Prevent race condition between watcher and onMounted
    // BUG-1339: Signal that initial data load has completed (tasks, projects, canvas)
    // Views should NOT render content until this is true to prevent blank-on-first-load
    const isDataReady = ref(false)

    onMounted(async () => {
        // MARK: SESSION START for stability guards
        if (typeof window !== 'undefined') {
            window.FlowStateSessionStart = Date.now()
        }

        // BUG-1743: When a new SW activates (after deploy), force reload to get fresh index.html
        // with matching CSS chunk hashes. Without this, the old page references old hashes that
        // the new SW's cleanupOutdatedCaches() already deleted. (Workbox #3126)
        if ('serviceWorker' in navigator) {
            let refreshing = false
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (refreshing) return
                refreshing = true
                window.location.reload()
            })
        }

        // BUG-1743: Load UI state and IndexedDB cache BEFORE auth initialization.
        // Auth can hang on expired JWT + flaky network, blocking the UI for up to 90s.
        // IndexedDB is local storage — it never needs auth.
        uiStore.loadState()

        // TASK-1428: Cache-first loading — always load from IndexedDB first (instant),
        // then background-sync from Supabase. This eliminates the 93-second worst-case
        // startup time (3 retries × 30s Supabase timeout) when offline or on flaky networks.

        // Phase A (blocking): Load from IndexedDB cache (~10-50ms)
        let hasCache = false
        try {
            const [cachedTasks, cachedGroups, cachedProjects] = await Promise.all([
                getCachedTasksWithPendingWrites(),
                getCachedGroupsWithPendingWrites(),
                getCachedProjects()
            ])

            hasCache = !!(cachedTasks && cachedTasks.length > 0) ||
                !!(cachedGroups && cachedGroups.length > 0) ||
                !!(cachedProjects && cachedProjects.length > 0)

            if (hasCache) {
                // SELF-HEALING: Detect impossibly large cache (corruption guard)
                // Production DB has ~500 tasks max. If cache has 1000+, it's corrupted.
                const MAX_REASONABLE_TASKS = 1000
                if (cachedTasks && cachedTasks.length > MAX_REASONABLE_TASKS) {
                    console.error(`🔴 [CACHE-CORRUPTION] IndexedDB cache has ${cachedTasks.length} tasks — clearing corrupted cache`)
                    try {
                        const { cacheTasks } = await import('@/services/offline/readCacheDB')
                        await cacheTasks([]) // Clear the corrupted cache
                    } catch (e) {
                        console.warn('[CACHE-CORRUPTION] Failed to clear cache:', e)
                    }
                    // Don't load from corrupted cache — will load fresh from Supabase in Phase B
                } else if (cachedTasks && cachedTasks.length > 0) {
                    // Dedup safety: ensure no duplicate IDs from stale cache
                    const seen = new Set<string>()
                    const dedupedCache = cachedTasks.filter(t => {
                        if (seen.has(t.id)) return false
                        seen.add(t.id)
                        return true
                    })
                    if (dedupedCache.length > MAX_REASONABLE_TASKS) {
                        console.error(`🔴 [CACHE-CORRUPTION] Even after dedup, ${dedupedCache.length} tasks remain — skipping cache`)
                    } else {
                        taskStore._rawTasks = dedupedCache
                        console.log(`📦 [CACHE-FIRST] Loaded ${cachedTasks.length} tasks from IndexedDB cache`)
                    }
                }
                if (cachedGroups && cachedGroups.length > 0) {
                    canvasStore.setGroups(cachedGroups)
                    console.log(`📦 [CACHE-FIRST] Loaded ${cachedGroups.length} groups from IndexedDB cache`)
                }
                if (cachedProjects && cachedProjects.length > 0) {
                    projectStore._rawProjects = cachedProjects
                    console.log(`📦 [CACHE-FIRST] Loaded ${cachedProjects.length} projects from IndexedDB cache`)
                }

                // Mark sync status as loaded-from-cache (will be cleared after background refresh)
                try {
                    const { useSyncStatusStore } = await import('@/stores/syncStatus')
                    const syncStatusStore = useSyncStatusStore()
                    const stats = await getCacheStats()
                    syncStatusStore.markLoadedFromCache(stats.tasks?.updatedAt)
                } catch (e) {
                    console.warn('[CACHE-FIRST] Failed to mark cache mode:', e)
                }
            } else {
                console.log('📭 [CACHE-FIRST] No IndexedDB cache found — will load from Supabase')
            }
        } catch (cacheError) {
            console.warn('[CACHE-FIRST] IndexedDB cache read failed:', cacheError)
        }

        // Load persisted filters (applies regardless of cache hit)
        await taskStore.loadPersistedFilters()

        // DEBUG: Check for duplicates after cache load
        {
          const ids = new Map<string, number>()
          for (const t of taskStore._rawTasks) ids.set(t.id, (ids.get(t.id) || 0) + 1)
          const dupes = [...ids.entries()].filter(([,c]) => c > 1)
          if (dupes.length > 0) console.error('🔴 [DEDUP] Duplicates after cache load:', dupes.length, dupes.map(([id]) => id.slice(0,8)))
          else console.log('✅ [DEDUP] No duplicates after cache load. Total:', taskStore._rawTasks.length)
        }

        // Mark data as ready — UI can render with cached data (or empty state)
        authStore.markAppInitLoadComplete()
        isDataReady.value = true

        // BUG-1743: Auth initialization now runs AFTER the cache load so a hanging
        // auth call (expired JWT + flaky network) never delays the first render.
        // 0. Initialize auth and clear guest data if not authenticated
        await authStore.initialize()

        if (!authStore.isAuthenticated) {
            // Guest mode: clear transient data only (TASK-1339: tasks/groups/filters persist)
            clearGuestData()
            // BUG-1137: Ensure guest session ID exists for future migration tracking
            getOrCreateGuestSessionId()
        } else {
            // BUG-339: Clear ALL stale guest localStorage (including legacy keys)
            // This fixes race condition and historical key naming issues
            clearStaleGuestTasks()

            // BUG-1563: Load workspaces immediately after auth (before store loads)
            // so workspace-aware queries use the correct workspace context
            try {
                const { useWorkspaceStore } = await import('@/stores/workspace')
                await useWorkspaceStore().loadWorkspaces()
            } catch (e) {
                console.warn('[MAIN] Failed to load workspaces:', e)
            }
        }

        // 1. Initial Load from Supabase

        // TASK-1083: Clear SWR cache on page load to ensure fresh positions from DB
        // This prevents stale cached positions from overriding newer data on other devices
        // BUG-1743: Moved to just before Phase B — SWR invalidation is only relevant
        // for the Supabase refresh, not the IndexedDB cache load.
        invalidateCache.all()
        console.log('🗑️ [TASK-1083] SWR cache cleared on page load')

        // Phase B (non-blocking): Background sync from Supabase
        // Skip entirely when offline — no point in fetching, just wait for 'online' event
        const isOnline = getInitialOnlineState()

        // TASK-1428: Re-apply unsynced local changes after any Supabase refresh.
        // Without this, loadFromDatabase() overwrites _rawTasks with server data
        // that doesn't reflect offline deletes/creates/updates yet.
        const reapplyPendingWrites = async () => {
            try {
                const { getWriteQueueDB } = await import('@/services/offline/writeQueueDB')
                const queueDB = getWriteQueueDB()
                const pendingOps = await queueDB.operations
                    .where('status')
                    .anyOf(['pending', 'failed', 'syncing'])
                    .toArray()

                if (pendingOps.length === 0) return

                // Sort by createdAt to preserve operation order
                pendingOps.sort((a, b) => a.createdAt - b.createdAt)

                let applied = 0

                // Apply task operations (create, update, delete)
                const taskOps = pendingOps.filter(op => op.entityType === 'task')
                for (const op of taskOps) {
                    if (op.operation === 'delete') {
                        const idx = taskStore._rawTasks.findIndex(t => t.id === op.entityId)
                        if (idx !== -1) {
                            taskStore._rawTasks.splice(idx, 1)
                            applied++
                        }
                    } else if (op.operation === 'create') {
                        if (!taskStore._rawTasks.find(t => t.id === op.entityId)) {
                            try {
                                const task = fromSupabaseTask(op.payload as unknown as SupabaseTask)
                                taskStore._rawTasks.push(task)
                                applied++
                            } catch (e) {
                                console.error('[CACHE-FIRST] Mapper failed for pending op:', op.entityId, op.operation, e)
                            }
                        }
                    } else if (op.operation === 'update') {
                        const idx = taskStore._rawTasks.findIndex(t => t.id === op.entityId)
                        if (idx !== -1) {
                            try {
                                const mapped = fromSupabaseTask({ ...op.payload, id: op.entityId } as unknown as SupabaseTask)
                                taskStore._rawTasks[idx] = { ...taskStore._rawTasks[idx], ...mapped }
                                applied++
                            } catch (e) {
                                console.error('[CACHE-FIRST] Mapper failed for pending op:', op.entityId, op.operation, e)
                            }
                        }
                    }
                }

                // Apply project operations (create, update, delete)
                const projectOps = pendingOps.filter(op => op.entityType === 'project')
                for (const op of projectOps) {
                    if (op.operation === 'delete') {
                        const idx = projectStore._rawProjects.findIndex(p => p.id === op.entityId)
                        if (idx !== -1) {
                            projectStore._rawProjects.splice(idx, 1)
                            applied++
                        }
                    } else if (op.operation === 'create') {
                        if (!projectStore._rawProjects.find(p => p.id === op.entityId)) {
                            try {
                                const project = fromSupabaseProject(op.payload as unknown as SupabaseProject)
                                projectStore._rawProjects.push(project)
                                applied++
                            } catch (e) {
                                console.error('[CACHE-FIRST] Mapper failed for pending op:', op.entityId, op.operation, e)
                            }
                        }
                    } else if (op.operation === 'update') {
                        const idx = projectStore._rawProjects.findIndex(p => p.id === op.entityId)
                        if (idx !== -1) {
                            try {
                                const mapped = fromSupabaseProject({ ...op.payload, id: op.entityId } as unknown as SupabaseProject)
                                projectStore._rawProjects[idx] = { ...projectStore._rawProjects[idx], ...mapped }
                                applied++
                            } catch (e) {
                                console.error('[CACHE-FIRST] Mapper failed for pending op:', op.entityId, op.operation, e)
                            }
                        }
                    }
                }

                // Apply group operations (create, update, delete)
                const groupOps = pendingOps.filter(op => op.entityType === 'group')
                for (const op of groupOps) {
                    if (op.operation === 'delete') {
                        const rawGroups = canvasStore._rawGroups
                        const idx = rawGroups.findIndex(g => g.id === op.entityId)
                        if (idx !== -1) {
                            rawGroups.splice(idx, 1)
                            applied++
                        }
                    } else if (op.operation === 'create') {
                        const rawGroups = canvasStore._rawGroups
                        if (!rawGroups.find(g => g.id === op.entityId)) {
                            try {
                                const group = fromSupabaseGroup(op.payload as unknown as SupabaseGroup)
                                rawGroups.push(group)
                                applied++
                            } catch (e) {
                                console.error('[CACHE-FIRST] Mapper failed for pending op:', op.entityId, op.operation, e)
                            }
                        }
                    } else if (op.operation === 'update') {
                        const rawGroups = canvasStore._rawGroups
                        const idx = rawGroups.findIndex(g => g.id === op.entityId)
                        if (idx !== -1) {
                            try {
                                const mapped = fromSupabaseGroup({ ...op.payload, id: op.entityId } as unknown as SupabaseGroup)
                                rawGroups[idx] = { ...rawGroups[idx], ...mapped }
                                applied++
                            } catch (e) {
                                console.error('[CACHE-FIRST] Mapper failed for pending op:', op.entityId, op.operation, e)
                            }
                        }
                    }
                }

                if (applied > 0) {
                    console.log(`🔄 [CACHE-FIRST] Re-applied ${applied} pending write queue operations after refresh`)
                }
            } catch (e) {
                console.warn('[CACHE-FIRST] Failed to re-apply pending writes:', e)
            }
        }

        if (authStore.isAuthenticated && isOnline) {
            const backgroundRefresh = async () => {
                try {
                    invalidateCache.all()
                    await Promise.all([
                        taskStore.loadFromDatabase(),
                        projectStore.loadProjectsFromDatabase(),
                        canvasStore.loadFromDatabase()
                    ])

                    // TASK-1428: Re-apply unsynced offline changes that Supabase doesn't know about yet
                    await reapplyPendingWrites()

                    // Clear cache-mode indicator — we have fresh data now
                    try {
                        const { useSyncStatusStore } = await import('@/stores/syncStatus')
                        useSyncStatusStore().clearCacheMode()
                    } catch { /* non-critical */ }

                    console.log('✅ [CACHE-FIRST] Background refresh complete')

                    // TASK-1418: Process deferred recurring task clones AFTER fresh data is loaded
                    // Must run here (not outside backgroundRefresh) because the fire-and-forget
                    // pattern means the scheduler would otherwise run on stale cached data.
                    try {
                        const { useRecurrenceScheduler } = await import('@/composables/useRecurrenceScheduler')
                        const sched = useRecurrenceScheduler()
                        const created = await sched.processDeferred()
                        if (created > 0) {
                            console.log(`[RECURRENCE] Created ${created} deferred recurring clone(s)`)
                        }
                    } catch (e) {
                        console.warn('[RECURRENCE] Deferred scheduler failed:', e)
                    }

                    // DEBUG: Check for duplicates after background refresh
                    {
                      const ids = new Map<string, number>()
                      for (const t of taskStore._rawTasks) ids.set(t.id, (ids.get(t.id) || 0) + 1)
                      const dupes = [...ids.entries()].filter(([,c]) => c > 1)
                      if (dupes.length > 0) console.error('🔴 [DEDUP] Duplicates after background refresh:', dupes.length, dupes.map(([id]) => id.slice(0,8)))
                      else console.log('✅ [DEDUP] No duplicates after refresh. Total:', taskStore._rawTasks.length)
                    }

                    // BUG-1339: If authenticated but got 0 tasks, schedule delayed retry
                    if (authStore.isAuthenticated && taskStore._rawTasks.length === 0) {
                        console.warn('⚠️ [BUG-1339] Authenticated but 0 tasks after refresh — scheduling delayed retry (2s)')
                        setTimeout(() => {
                            // BUG-1710: Wrap in .catch() to prevent unhandled promise rejection dialog in Tauri
                            (async () => {
                                if (taskStore._rawTasks.length === 0 && authStore.isAuthenticated) {
                                    console.log('🔄 [BUG-1339] Delayed retry: invalidating cache and reloading...')
                                    invalidateCache.all()
                                    await Promise.all([
                                        taskStore.loadFromDatabase(),
                                        projectStore.loadProjectsFromDatabase(),
                                        canvasStore.loadFromDatabase()
                                    ])
                                    await reapplyPendingWrites()
                                    console.log(`✅ [BUG-1339] Delayed retry loaded ${taskStore._rawTasks.length} tasks`)
                                }
                            })().catch(e => console.warn('⚠️ [BUG-1339] Delayed retry failed:', e))
                        }, 2000)
                    }
                } catch (refreshError) {
                    console.warn('⚠️ [CACHE-FIRST] Background refresh failed:', refreshError)

                    // Register online listener to retry when connectivity returns
                    const onBackOnline = async () => {
                        console.log('🌐 [CACHE-FIRST] Network restored — reloading from Supabase...')
                        window.removeEventListener('online', onBackOnline)
                        try {
                            invalidateCache.all()
                            await Promise.all([
                                taskStore.loadFromDatabase(),
                                projectStore.loadProjectsFromDatabase(),
                                canvasStore.loadFromDatabase()
                            ])
                            const { useSyncStatusStore } = await import('@/stores/syncStatus')
                            useSyncStatusStore().clearCacheMode()
                            console.log('✅ [CACHE-FIRST] Successfully reloaded from Supabase after reconnection')
                        } catch (e) {
                            console.warn('⚠️ [CACHE-FIRST] Reconnection reload failed, will retry on next online event:', e)
                            window.addEventListener('online', onBackOnline, { once: true })
                        }
                    }
                    window.addEventListener('online', onBackOnline, { once: true })
                }
            }

            // Fire-and-forget — don't block UI rendering
            backgroundRefresh().catch(e => {
                console.warn('⚠️ [CACHE-FIRST] Unhandled background refresh error:', e)
            })
        } else if (authStore.isAuthenticated && !isOnline) {
            // Offline: register listener to sync when connectivity returns
            console.log('📵 [CACHE-FIRST] Offline — will sync from Supabase when network returns')
            const onBackOnline = async () => {
                console.log('🌐 [CACHE-FIRST] Network restored — reloading from Supabase...')
                window.removeEventListener('online', onBackOnline)
                try {
                    invalidateCache.all()
                    await Promise.all([
                        taskStore.loadFromDatabase(),
                        projectStore.loadProjectsFromDatabase(),
                        canvasStore.loadFromDatabase()
                    ])
                    try {
                        const { useSyncStatusStore } = await import('@/stores/syncStatus')
                        useSyncStatusStore().clearCacheMode()
                    } catch { /* non-critical */ }
                    console.log('✅ [CACHE-FIRST] Successfully reloaded from Supabase after reconnection')
                } catch (e) {
                    console.warn('⚠️ [CACHE-FIRST] Reconnection reload failed, will retry on next online event:', e)
                    window.addEventListener('online', onBackOnline, { once: true })
                }
            }
            window.addEventListener('online', onBackOnline, { once: true })
        }

        // TASK-1524: Migrate old `recurrence` field to new `recurrenceRule` format
        // Must run before the recurrence scheduler so migrated tasks are processed
        try {
            const { useRecurrenceMigration } = await import('@/composables/useRecurrenceMigration')
            const migration = useRecurrenceMigration()
            await migration.migrateIfNeeded()
        } catch (error) {
            console.warn('[RECURRENCE-MIGRATION] Migration failed (non-critical):', error)
        }

        // TASK-1418: Recurrence scheduler moved inside backgroundRefresh() above
        // to ensure it runs on fresh Supabase data, not stale IndexedDB cache.

        // TASK-1500: Auto-refresh AI memory observations if stale (>24h) — non-blocking
        if (authStore.isAuthenticated) {
            try {
                const { useWorkProfile } = await import('@/composables/useWorkProfile')
                const { useSettingsStore: getSettings } = await import('@/stores/settings')
                const settings = getSettings()
                if (settings.aiLearningEnabled) {
                    const wp = useWorkProfile()
                    // Fire-and-forget: only refresh if observations are stale
                    wp.refreshIfStale().then(refreshed => {
                        if (refreshed) {
                            console.log('📊 [TASK-1500] Work profile observations refreshed (were stale)')
                        }
                    }).catch(e => console.warn('[TASK-1500] Memory refresh failed:', e))
                }
            } catch (error) {
                console.debug('[TASK-1500] Work profile auto-refresh failed:', error)
            }
        }

        // Initialize notification system
        try {
            await notificationStore.initializeNotifications()
        } catch (error) {
            console.warn('⚠️ Notification system initialization failed:', error)
        }

        // Request notification permission for timer
        try {
            await timerStore.requestNotificationPermission()
        } catch (error) {
            console.warn('⚠️ Timer notification permission request failed:', error)
        }

        // Safari ITP Protection
        try {
            itpProtection.initialize()
            itpProtection.recordInteraction()
        } catch (error) {
            console.warn('⚠️ Safari ITP check failed:', error)
        }

        // TASK-1219 + BUG-1302: Time block progress notifications
        try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
                const perm = await Notification.requestPermission()
                console.log('[TIME-BLOCK] Notification permission:', perm)
            }
            const timeBlockNotifications = useTimeBlockNotifications()
            timeBlockNotifications.start()
            console.log('[TIME-BLOCK] Initialized successfully')
        } catch (error) {
            console.warn('[TIME-BLOCK] Initialization failed:', error)
        }

        // Initialize global keyboard shortcuts
        await initGlobalKeyboardShortcuts()

        // BUG-1178: Handle timer action from URL query params (fallback when SW postMessage fails)
        // This handles the case where user clicks notification action but window wasn't ready
        // The SW opens a new window with action in URL: /?action=START_BREAK&taskId=xxx
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search)
            const action = urlParams.get('action')
            const taskIdFromUrl = urlParams.get('taskId')

            if (action) {
                console.log('🍅 [APP-INIT] Timer action from URL:', action, taskIdFromUrl)

                // Small delay to ensure timer store is ready
                setTimeout(() => {
                    const settings = timerStore.settings

                    switch (action) {
                        case 'START_BREAK':
                            timerStore.startTimer('break', settings.shortBreakDuration, true)
                            break
                        case 'START_WORK': {
                            const taskId = taskIdFromUrl && taskIdFromUrl !== 'break' ? taskIdFromUrl : 'general'
                            timerStore.startTimer(taskId, settings.workDuration, false)
                            break
                        }
                        case 'POSTPONE_5MIN': {
                            // Extend the just-completed session instead of creating a new one
                            if (timerStore.addExtraTime) {
                              timerStore.addExtraTime(5 * 60)
                            } else {
                              const postponeTaskId = taskIdFromUrl || 'general'
                              const isBreak = postponeTaskId === 'break'
                              timerStore.startTimer(postponeTaskId, 5 * 60, isBreak)
                            }
                            break
                        }
                    }

                    // Clear the URL params after handling (to prevent re-triggering on refresh)
                    window.history.replaceState({}, document.title, window.location.pathname)
                }, 100)
            }
        }

        // TASK-1177: Initialize offline-first sync system
        // This starts the background queue processor and sets up online/offline listeners
        try {
            const syncOrchestrator = useSyncOrchestrator()
            console.log('🔄 [SYNC] Offline-first sync system initialized')

            // Process any pending operations from IndexedDB (queued while offline)
            const stats = await syncOrchestrator.getQueueStats()
            if (stats.pendingCount > 0) {
                console.log(`📤 [SYNC] Found ${stats.pendingCount} pending operations - syncing...`)
                // The orchestrator will auto-process these in the background
            }
        } catch (error) {
            console.warn('⚠️ [SYNC] Sync system initialization failed (non-critical):', error)
        }

        // 3. Initialize Realtime Subscriptions
        const { initRealtimeSubscription } = useSupabaseDatabase()

        const onProjectChange = (payload: RealtimePayload) => {
            // BUG-FIX: Fetch FRESH store instance inside callback to prevent stale closures
            const canvas = useCanvasStore()
            const projects = useProjectStore()
            const tasks = useTaskStore()

            // HARDENED LOCK: Check store, dragging, resizing, and settling flags
            // BUG-1051: Fix sync race condition - also check for manual operations
            const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                window.__FlowStateIsDragging ||
                window.__FlowStateIsResizing ||
                window.__FlowStateIsSettling
            ))

            console.log('🔄 [HANDLER] onProjectChange called:', {
                eventType: payload.eventType,
                isLocked,
                projectId: payload.new?.id?.substring(0, 8) || payload.old?.id?.substring(0, 8)
            })

            if (isLocked) {
                console.log('🔒 [HANDLER] PROJECT change blocked - lock active')
                return
            }

            const { eventType, new: newDoc, old: oldDoc } = payload
            if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                console.log('🗑️ [HANDLER] Removing project from sync')
                projects.removeProjectFromSync(newDoc?.id || oldDoc?.id)
            } else if (newDoc) {
                // BUG-FIX: Map raw Supabase data to app format
                const mappedProject = fromSupabaseProject(newDoc as SupabaseProject)
                console.log('✅ [HANDLER] Updating project from sync:', mappedProject.name)
                projects.updateProjectFromSync(mappedProject.id, mappedProject)
            }
        }

        const onTaskChange = (payload: RealtimePayload) => {
            // BUG-FIX: Fetch FRESH store instance inside callback to prevent stale closures
            const canvas = useCanvasStore()
            const tasks = useTaskStore()

            // HARDENED LOCK: Check store, dragging, resizing, and settling flags
            // BUG-1051: Fix sync race condition - also check for manual operations
            const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                window.__FlowStateIsDragging ||
                window.__FlowStateIsResizing ||
                window.__FlowStateIsSettling
            ))

            const { eventType, new: newDoc, old: oldDoc } = payload
            const taskId = newDoc?.id || oldDoc?.id

            console.log('🔄 [HANDLER] onTaskChange called:', {
                eventType,
                isLocked,
                taskId: taskId?.substring(0, 8),
                title: newDoc?.title?.substring(0, 20) || oldDoc?.title?.substring(0, 20)
            })

            if (isLocked) {
                console.log('🔒 [HANDLER] TASK change blocked - lock active')
                return
            }

            if (!taskId) {
                console.log('⚠️ [HANDLER] TASK change skipped - no taskId')
                return
            }

            // High Severity Issue #7: Skip if task is pending local write (drag in progress)
            if (tasks.isPendingWrite(taskId)) {
                console.log(`🔒 [HANDLER] TASK ${taskId.slice(0,8)} skipped - pending local write`)
                return
            }

            // BUG-1329: Skip realtime events while loadFromDatabase is running.
            // Smart merge handles reconciliation — processing realtime events
            // simultaneously risks duplicates from parallel add paths.
            if (tasks.isLoadingFromDatabase) {
                console.log(`⏳ [HANDLER] TASK ${taskId.slice(0,8)} skipped - database load in progress`)
                return
            }

            // BUG-169 FIX: Safety guards to prevent spurious task deletions
            // 1. Check for hard DELETE event (eventType === 'DELETE')
            // 2. Check for soft delete ONLY if is_deleted is EXPLICITLY true (not just truthy)
            const isHardDelete = eventType === 'DELETE'
            const isSoftDelete = newDoc && newDoc.is_deleted === true

            if (isHardDelete || isSoftDelete) {
                // Extra safety: Check session start time
                const sessionStart = window.FlowStateSessionStart || 0
                const timeSinceSessionStart = Date.now() - sessionStart

                // Don't process deletions in the first 5 seconds of the session (anti-race guard)
                if (timeSinceSessionStart < 5000) {
                    console.warn(`⚠️ [HANDLER] BLOCKED deletion for task ${taskId.substring(0, 8)} - session just started`)
                    return
                }

                console.log(`🗑️ [HANDLER] Removing task ${taskId.substring(0, 8)} from sync`)
                tasks.updateTaskFromSync(taskId, null, true)
            } else if (newDoc) {
                // BUG-FIX: Map raw Supabase data to app format
                // This ensures is_deleted -> _soft_deleted, position -> canvasPosition, etc.
                const mappedTask = fromSupabaseTask(newDoc as SupabaseTask)
                console.log(`✅ [HANDLER] Updating task ${taskId.substring(0, 8)} from sync:`, mappedTask.title?.substring(0, 20))
                tasks.updateTaskFromSync(taskId, mappedTask, false)
            }
        }

        const onGroupChange = (payload: RealtimePayload) => {
            // BUG-FIX: Fetch FRESH store instance inside callback to prevent stale closures
            const canvas = useCanvasStore()
            const tasks = useTaskStore()

            // HARDENED LOCK: Check store, dragging, resizing, and settling flags
            const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                window.__FlowStateIsDragging ||
                window.__FlowStateIsResizing ||
                window.__FlowStateIsSettling
            ))

            const { eventType, new: newDoc, old: oldDoc } = payload

            console.log('🔄 [HANDLER] onGroupChange called:', {
                eventType,
                isLocked,
                groupId: newDoc?.id?.substring(0, 8) || oldDoc?.id?.substring(0, 8),
                name: newDoc?.name || oldDoc?.name
            })

            if (isLocked) {
                console.log('🔒 [HANDLER] GROUP change blocked - lock active')
                return
            }

            if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                console.log('🗑️ [HANDLER] Removing group from sync')
                canvas.removeGroupFromSync(newDoc?.id || oldDoc?.id)
            } else if (newDoc) {
                // BUG-1124 FIX: Map raw Supabase data to app format
                // Groups need mapping: position_json -> position, and other field transformations
                const mappedGroup = fromSupabaseGroup(newDoc as SupabaseGroup)
                console.log('✅ [HANDLER] Updating group from sync:', mappedGroup.name, 'position:', mappedGroup.position)
                canvas.updateGroupFromSync(mappedGroup.id, mappedGroup)
            }
        }

        // TASK-1009: Consolidated Realtime subscription with ALL handlers
        // Previously, timer store called initRealtimeSubscription separately, killing this channel
        // Now we pass the timer handler here so there's only ONE subscription point
        const timerHandler = timerStore.handleRemoteTimerUpdate

        // BUG-1056: Recovery callback to reload data after WebSocket auth recovery
        // This fixes intermittent "0 tasks" issue when initial load fails due to stale token
        const onRecovery = async () => {
            console.log('🔄 [APP-INIT] Reloading data after auth recovery...')
            await Promise.all([
                taskStore.loadFromDatabase(),
                projectStore.loadProjectsFromDatabase(),
                canvasStore.loadFromDatabase()
            ])
            // BUG-1411: Clear offline cache mode — we're back online with fresh data
            try {
                const { useSyncStatusStore } = await import('@/stores/syncStatus')
                useSyncStatusStore().clearCacheMode()
            } catch { /* non-critical */ }
            // BUG-1357: Re-sync timer state after WebSocket recovery
            // Mobile PWA may have missed timer events while backgrounded
            timerStore.resyncFromDatabase()
        }

        const channel = initRealtimeSubscription(onProjectChange, onTaskChange, timerHandler, undefined, onGroupChange, onRecovery, workspaceStore.activeWorkspaceId)
        activeChannel.value = channel
        realtimeInitialized.value = !!channel

        if (channel) {
            console.log(`📡 [APP-INIT] Realtime subscription created (workspace: ${workspaceStore.activeWorkspaceId || 'personal'})`)
        } else {
            console.log('📡 [APP-INIT] No realtime subscription (user not authenticated yet)')
        }

        // BUG-1106: Mark onMounted as complete so watcher knows it can run
        onMountedCompleted.value = true
    })

    // BUG-1106: Re-initialize realtime when user signs in after initial page load
    // This handles the case where user opens the app as guest and later signs in via modal
    watch(() => authStore.isAuthenticated, async (isAuthenticated, wasAuthenticated) => {
        // Only trigger when:
        // 1. Going from NOT authenticated to authenticated
        // 2. Realtime wasn't already initialized
        // 3. onMounted has completed (to prevent race condition with stored session)
        if (isAuthenticated && !wasAuthenticated && !realtimeInitialized.value && onMountedCompleted.value) {
            console.log('📡 [APP-INIT] User signed in after page load - initializing realtime subscription...')

            const { initRealtimeSubscription } = useSupabaseDatabase()

            // Simplified handlers for post-login initialization
            // These use the same logic as the onMounted handlers
            const onProjectChange = (payload: RealtimePayload) => {
                const canvas = useCanvasStore()
                const projects = useProjectStore()
                const tasks = useTaskStore()

                // BUG-1207: Add missing window flag checks (match primary handler)
                const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                    window.__FlowStateIsDragging ||
                    window.__FlowStateIsResizing ||
                    window.__FlowStateIsSettling
                ))
                if (isLocked) return

                const { eventType, new: newDoc, old: oldDoc } = payload
                if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                    projects.removeProjectFromSync(newDoc?.id || oldDoc?.id)
                } else if (newDoc) {
                    const mappedProject = fromSupabaseProject(newDoc as SupabaseProject)
                    projects.updateProjectFromSync(mappedProject.id, mappedProject)
                }
            }

            const onTaskChange = (payload: RealtimePayload) => {
                const canvas = useCanvasStore()
                const tasks = useTaskStore()

                // BUG-1207: Add missing window flag checks (match primary handler)
                const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                    window.__FlowStateIsDragging ||
                    window.__FlowStateIsResizing ||
                    window.__FlowStateIsSettling
                ))
                if (isLocked) return

                const { eventType, new: newDoc, old: oldDoc } = payload
                const taskId = newDoc?.id || oldDoc?.id
                if (!taskId) return
                if (tasks.isPendingWrite(taskId)) return

                const isHardDelete = eventType === 'DELETE'
                const isSoftDelete = newDoc && newDoc.is_deleted === true
                if (isHardDelete || isSoftDelete) {
                    tasks.updateTaskFromSync(taskId, null, true)
                } else if (newDoc) {
                    const mappedTask = fromSupabaseTask(newDoc as SupabaseTask)
                    tasks.updateTaskFromSync(taskId, mappedTask, false)
                }
            }

            const onGroupChange = (payload: RealtimePayload) => {
                const canvas = useCanvasStore()
                const tasks = useTaskStore()

                // BUG-1207: Add missing window flag checks (match primary handler)
                const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                    window.__FlowStateIsDragging ||
                    window.__FlowStateIsResizing ||
                    window.__FlowStateIsSettling
                ))
                if (isLocked) return

                const { eventType, new: newDoc, old: oldDoc } = payload
                if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                    canvas.removeGroupFromSync(newDoc?.id || oldDoc?.id)
                } else if (newDoc) {
                    // BUG-1207 FIX: Use fromSupabaseGroup mapper (was passing raw data)
                    const mappedGroup = fromSupabaseGroup(newDoc as SupabaseGroup)
                    canvas.updateGroupFromSync(mappedGroup.id, mappedGroup)
                }
            }

            const onRecovery = async () => {
                console.log('🔄 [APP-INIT] Reloading data after auth recovery...')
                await Promise.all([
                    taskStore.loadFromDatabase(),
                    projectStore.loadProjectsFromDatabase(),
                    canvasStore.loadFromDatabase()
                ])
            }

            const timerHandler = timerStore.handleRemoteTimerUpdate
            const channel = initRealtimeSubscription(onProjectChange, onTaskChange, timerHandler, undefined, onGroupChange, onRecovery, workspaceStore.activeWorkspaceId)

            if (channel) {
                activeChannel.value = channel
                realtimeInitialized.value = true
                console.log(`📡 [APP-INIT] Realtime subscription created after sign-in (workspace: ${workspaceStore.activeWorkspaceId || 'personal'})`)
            }
        }
    })

    // Workspace switch: re-create realtime subscription with new workspace context
    // When user switches workspace, the realtime filters must change from
    // user_id=X to workspace_id=Y (or back to user_id for personal workspace)
    watch(() => workspaceStore.activeWorkspaceId, async (newWsId, oldWsId) => {
        if (!realtimeInitialized.value || !authStore.isAuthenticated) return
        // Skip initial undefined → null transition
        if (newWsId === oldWsId) return

        console.log(`📡 [APP-INIT] Workspace switched (${oldWsId || 'personal'} → ${newWsId || 'personal'}) - re-creating realtime subscription...`)

        // Tear down existing subscription
        if (activeChannel.value) {
            try {
                await activeChannel.value.unsubscribe()
            } catch { /* channel already closed */ }
            activeChannel.value = null
        }

        const { initRealtimeSubscription: initRealtime } = useSupabaseDatabase()

        // Re-use the same handler pattern as the auth watcher
        const onProjectChange = (payload: RealtimePayload) => {
            const canvas = useCanvasStore()
            const projects = useProjectStore()
            const tasks = useTaskStore()
            const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                window.__FlowStateIsDragging ||
                window.__FlowStateIsResizing ||
                window.__FlowStateIsSettling
            ))
            if (isLocked) return
            const { eventType, new: newDoc, old: oldDoc } = payload
            if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                projects.removeProjectFromSync(newDoc?.id || oldDoc?.id)
            } else if (newDoc) {
                const mappedProject = fromSupabaseProject(newDoc as SupabaseProject)
                projects.updateProjectFromSync(mappedProject.id, mappedProject)
            }
        }

        const onTaskChange = (payload: RealtimePayload) => {
            const canvas = useCanvasStore()
            const tasks = useTaskStore()
            const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                window.__FlowStateIsDragging ||
                window.__FlowStateIsResizing ||
                window.__FlowStateIsSettling
            ))
            if (isLocked) return
            const { eventType, new: newDoc, old: oldDoc } = payload
            const taskId = newDoc?.id || oldDoc?.id
            if (!taskId) return
            if (tasks.isPendingWrite(taskId)) return
            const isHardDelete = eventType === 'DELETE'
            const isSoftDelete = newDoc && newDoc.is_deleted === true
            if (isHardDelete || isSoftDelete) {
                tasks.updateTaskFromSync(taskId, null, true)
            } else if (newDoc) {
                const mappedTask = fromSupabaseTask(newDoc as SupabaseTask)
                tasks.updateTaskFromSync(taskId, mappedTask, false)
            }
        }

        const onGroupChange = (payload: RealtimePayload) => {
            const canvas = useCanvasStore()
            const tasks = useTaskStore()
            const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                window.__FlowStateIsDragging ||
                window.__FlowStateIsResizing ||
                window.__FlowStateIsSettling
            ))
            if (isLocked) return
            const { eventType, new: newDoc, old: oldDoc } = payload
            if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                canvas.removeGroupFromSync(newDoc?.id || oldDoc?.id)
            } else if (newDoc) {
                const mappedGroup = fromSupabaseGroup(newDoc as SupabaseGroup)
                canvas.updateGroupFromSync(mappedGroup.id, mappedGroup)
            }
        }

        const onRecovery = async () => {
            console.log('🔄 [APP-INIT] Reloading data after auth recovery (workspace switch)...')
            await Promise.all([
                taskStore.loadFromDatabase(),
                projectStore.loadProjectsFromDatabase(),
                canvasStore.loadFromDatabase()
            ])
        }

        const timerHandler = timerStore.handleRemoteTimerUpdate
        const channel = initRealtime(onProjectChange, onTaskChange, timerHandler, undefined, onGroupChange, onRecovery, newWsId)

        if (channel) {
            activeChannel.value = channel
            console.log(`📡 [APP-INIT] Realtime subscription re-created for workspace: ${newWsId || 'personal'}`)
        }

        // BUG-1673: Reload data for the new workspace context
        // Without this, tasks loaded for the previous workspace remain stale
        await Promise.all([
            taskStore.loadFromDatabase(),
            projectStore.loadProjectsFromDatabase(),
            canvasStore.loadFromDatabase()
        ])
    })

    // TASK-1338: Handle SW push notification click actions
    // SW sends these messages after focusing the window on notification click
    const _swMessageHandler = (event: MessageEvent) => {
        const { type, taskId, url, minutes } = (event.data || {}) as {
            type?: string
            taskId?: string
            url?: string
            minutes?: number
        }

        switch (type) {
            case 'NAVIGATE_TO_TASK':
                if (taskId) {
                    router.push(`/focus/${taskId}`)
                }
                break
            case 'NAVIGATE_TO':
                if (url) {
                    router.push(url)
                }
                break
            case 'SNOOZE_NOTIFICATION': {
                if (taskId && minutes) {
                    const notificationStore = useNotificationStore()
                    // Find the notification for this task and snooze it
                    const notification = notificationStore.scheduledNotifications?.find(
                        (n) => n.taskId === taskId
                    )
                    if (notification) {
                        notificationStore.snoozeNotification(notification.id)
                    } else {
                        console.warn('[APP-INIT] SNOOZE_NOTIFICATION: no notification found for taskId', taskId)
                    }
                }
                break
            }
        }
    }

    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener('message', _swMessageHandler)
    }

    onUnmounted(() => {
        if (activeChannel.value) {

            activeChannel.value.unsubscribe()
            activeChannel.value = null
        }
        if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
            navigator.serviceWorker.removeEventListener('message', _swMessageHandler)
        }
    })

    // BUG-1339: Return isDataReady so App.vue can gate view rendering
    return { isDataReady }
}
