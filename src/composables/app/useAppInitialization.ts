import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { useGamificationStore } from '@/stores/gamification'
import { useSupabaseDatabase, invalidateCache } from '@/composables/useSupabaseDatabase'
import { useSafariITPProtection } from '@/utils/safariITPProtection'
import { initGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import { clearGuestData, clearStaleGuestTasks } from '@/utils/guestModeStorage'
// BUG-FIX: Import mappers to properly convert realtime data
import { fromSupabaseTask, fromSupabaseProject, fromSupabaseGroup, type SupabaseTask, type SupabaseProject, type SupabaseGroup } from '@/utils/supabaseMappers'
// FEATURE-1118: Gamification hooks
import { useGamificationHooks } from '@/composables/useGamificationHooks'
// FEATURE-1132: Challenge system
import { useChallengesStore } from '@/stores/challenges'
// TASK-1177: Offline-first sync system
import { useSyncOrchestrator } from '@/composables/sync/useSyncOrchestrator'
import { useBeforeUnload } from '@/composables/useBeforeUnload'
// BUG-1411: Cache stats for offline mode detection
// TASK-1425: Full cache read functions for fast offline startup
// TASK-1427: Merged versions include pending write queue operations
import { getCacheStats, getCachedTasksWithPendingWrites, getCachedGroupsWithPendingWrites, getCachedProjects } from '@/services/offline/readCacheDB'
// TASK-1219: Time block progress notifications
import { useTimeBlockNotifications } from '@/composables/useTimeBlockNotifications'

export function useAppInitialization() {
    const timerStore = useTimerStore()
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const canvasStore = useCanvasStore()
    const uiStore = useUIStore()
    const notificationStore = useNotificationStore()
    const authStore = useAuthStore()
    const gamificationStore = useGamificationStore()
    const challengesStore = useChallengesStore()
    const itpProtection = useSafariITPProtection()
    const activeChannel = ref<unknown>(null)
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


        // 0. Initialize auth and clear guest data if not authenticated
        await authStore.initialize()

        if (!authStore.isAuthenticated) {
            // Guest mode: clear transient data only (TASK-1339: tasks/groups/filters persist)
            clearGuestData()
        } else {
            // BUG-339: Clear ALL stale guest localStorage (including legacy keys)
            // This fixes race condition and historical key naming issues
            clearStaleGuestTasks()
        }

        // 1. Initial Load from Supabase

        // TASK-1083: Clear SWR cache on page load to ensure fresh positions from DB
        // This prevents stale cached positions from overriding newer data on other devices
        invalidateCache.all()
        console.log('🗑️ [TASK-1083] SWR cache cleared on page load')

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
                if (cachedTasks && cachedTasks.length > 0) {
                    taskStore._rawTasks = cachedTasks
                    console.log(`📦 [CACHE-FIRST] Loaded ${cachedTasks.length} tasks from IndexedDB cache`)
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

        // Mark data as ready — UI can render with cached data (or empty state)
        authStore.markAppInitLoadComplete()
        isDataReady.value = true

        // Phase B (non-blocking): Background sync from Supabase
        // Skip entirely when offline — no point in fetching, just wait for 'online' event
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine !== false : true
        if (authStore.isAuthenticated && isOnline) {
            const backgroundRefresh = async () => {
                try {
                    invalidateCache.all()
                    await Promise.all([
                        taskStore.loadFromDatabase(),
                        projectStore.loadProjectsFromDatabase(),
                        canvasStore.loadFromDatabase()
                    ])

                    // Clear cache-mode indicator — we have fresh data now
                    try {
                        const { useSyncStatusStore } = await import('@/stores/syncStatus')
                        useSyncStatusStore().clearCacheMode()
                    } catch { /* non-critical */ }

                    console.log('✅ [CACHE-FIRST] Background refresh complete')

                    // BUG-1339: If authenticated but got 0 tasks, schedule delayed retry
                    if (authStore.isAuthenticated && taskStore._rawTasks.length === 0) {
                        console.warn('⚠️ [BUG-1339] Authenticated but 0 tasks after refresh — scheduling delayed retry (2s)')
                        setTimeout(async () => {
                            if (taskStore._rawTasks.length === 0 && authStore.isAuthenticated) {
                                console.log('🔄 [BUG-1339] Delayed retry: invalidating cache and reloading...')
                                invalidateCache.all()
                                try {
                                    await Promise.all([
                                        taskStore.loadFromDatabase(),
                                        projectStore.loadProjectsFromDatabase(),
                                        canvasStore.loadFromDatabase()
                                    ])
                                    console.log(`✅ [BUG-1339] Delayed retry loaded ${taskStore._rawTasks.length} tasks`)
                                } catch (e) {
                                    console.warn('⚠️ [BUG-1339] Delayed retry failed:', e)
                                }
                            }
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

        // FEATURE-1118: Initialize gamification system
        try {
            await gamificationStore.initialize()
            // Record daily activity and update streak
            const gamificationHooks = useGamificationHooks()
            await gamificationHooks.onAppInitialized()
            console.log('🎮 [GAMIFICATION] Initialized successfully')
        } catch (error) {
            console.warn('⚠️ Gamification system initialization failed:', error)
        }

        // FEATURE-1132: Initialize challenge system
        try {
            await challengesStore.initialize()
            console.log('🎯 [CHALLENGES] Initialized successfully')
        } catch (error) {
            console.warn('⚠️ Challenge system initialization failed:', error)
        }

        // TASK-1418: Process deferred recurring task clones
        // Creates clones for recurring tasks whose next due date has arrived
        try {
            const { useRecurrenceScheduler } = await import('@/composables/useRecurrenceScheduler')
            const scheduler = useRecurrenceScheduler()
            const created = await scheduler.processDeferred()
            if (created > 0) {
                console.log(`[RECURRENCE] Created ${created} deferred recurring clone(s)`)
            }
        } catch (error) {
            console.warn('[RECURRENCE] Deferred scheduler failed (non-critical):', error)
        }

        // FEATURE-1317: Auto-refresh work profile insights (non-blocking)
        if (authStore.isAuthenticated) {
            try {
                const { useWorkProfile } = await import('@/composables/useWorkProfile')
                const { useSettingsStore: getSettings } = await import('@/stores/settings')
                const settings = getSettings()
                if (settings.aiLearningEnabled) {
                    const wp = useWorkProfile()
                    // Fire-and-forget: load profile then recalculate in background
                    wp.loadProfile().then(() => {
                        wp.computeCapacityMetrics().then(() => {
                            console.log('📊 [FEATURE-1317] Work profile insights auto-refreshed')
                        }).catch(e => console.debug('[FEATURE-1317] Auto-recalculate skipped:', e))
                    }).catch(() => {})
                }
            } catch (error) {
                console.debug('[FEATURE-1317] Work profile auto-refresh failed:', error)
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
        // BUG-1303: Skip browser Notification.requestPermission() in Tauri — WebKitGTK
        // can hang indefinitely on this call, blocking the entire init flow.
        // Tauri uses its own notification plugin, not the Web Notification API.
        try {
            const isTauriRuntime = typeof window !== 'undefined' && '__TAURI__' in window
            if (!isTauriRuntime && typeof Notification !== 'undefined' && Notification.permission === 'default') {
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
                            const postponeTaskId = taskIdFromUrl || 'general'
                            const isBreak = postponeTaskId === 'break'
                            timerStore.startTimer(postponeTaskId, 5 * 60, isBreak) // 5 minutes
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

        // TASK-1177: Initialize beforeunload protection
        // This warns users if they try to close the tab with unsaved changes
        try {
            useBeforeUnload()
            console.log('🛡️ [SYNC] Page close protection enabled')
        } catch (error) {
            console.warn('⚠️ [SYNC] beforeunload protection failed (non-critical):', error)
        }

        // 3. Initialize Realtime Subscriptions
        const { initRealtimeSubscription } = useSupabaseDatabase()

        const onProjectChange = (payload: Record<string, unknown>) => {
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

        const onTaskChange = (payload: Record<string, unknown>) => {
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

        const onGroupChange = (payload: Record<string, unknown>) => {
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

        const channel = initRealtimeSubscription(onProjectChange, onTaskChange, timerHandler, undefined, onGroupChange, onRecovery)
        activeChannel.value = channel
        realtimeInitialized.value = !!channel

        if (channel) {
            console.log('📡 [APP-INIT] Realtime subscription created with project, task, and timer handlers')
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
            const onProjectChange = (payload: Record<string, unknown>) => {
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

            const onTaskChange = (payload: Record<string, unknown>) => {
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

            const onGroupChange = (payload: Record<string, unknown>) => {
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
            const channel = initRealtimeSubscription(onProjectChange, onTaskChange, timerHandler, undefined, onGroupChange, onRecovery)

            if (channel) {
                activeChannel.value = channel
                realtimeInitialized.value = true
                console.log('📡 [APP-INIT] Realtime subscription created after sign-in')
            }
        }
    })

    onUnmounted(() => {
        if (activeChannel.value) {

            activeChannel.value.unsubscribe()
            activeChannel.value = null
        }
    })

    // BUG-1339: Return isDataReady so App.vue can gate view rendering
    return { isDataReady }
}
