import { onMounted, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { getGlobalReliableSyncManager } from '@/composables/useReliableSyncManager'
import { useSafariITPProtection } from '@/utils/safariITPProtection'
import { initGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import { useDatabaseHealthCheck, runPreInitializationCheck } from '@/composables/useDatabaseHealthCheck'
import { initCrossTabCoordination } from '@/composables/useCrossTabCoordination'
import { startPeriodicPruning } from '@/composables/useConflictPruning'

export function useAppInitialization() {
    const timerStore = useTimerStore()
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const canvasStore = useCanvasStore()
    const uiStore = useUIStore()
    const notificationStore = useNotificationStore()
    const itpProtection = useSafariITPProtection()

    // TASK-085: Initialize corruption prevention safeguards
    const { checkHealth } = useDatabaseHealthCheck()

    // BUG-054 FIX: Get sync manager and register callback IMMEDIATELY
    // Stores are created above which triggers useDatabase → sync starts in background
    // We MUST register the callback NOW, before sync can complete and notify
    const syncManager = getGlobalReliableSyncManager()

    // BUG-054 FIX: Register callback as early as possible (outside onMounted)
    // This ensures we catch data pulled events even from initial sync
    const unregisterDataPulledCallback = syncManager.registerDataPulledCallback(async () => {
        console.log('🔄 [APP] Reloading stores after sync pulled data...')
        await taskStore.loadFromDatabase()
        await projectStore.loadProjectsFromPouchDB()
        await canvasStore.loadFromDatabase()
        console.log('✅ [APP] Stores reloaded after sync')
    })

    // BUG-057 FIX: Define handler at composable level for proper cleanup
    // BUG-061 FIX: Properly extract task data from PouchDB document format
    const handlePouchDBChange = (event: Event) => {
        const detail = (event as CustomEvent).detail
        if (!detail) return

        const { id, doc, deleted } = detail

        // Handle task documents (task-{id})
        if (id.startsWith('task-')) {
            const taskId = id.replace('task-', '')
            if (taskStore.syncInProgress) return // Skip if already processing

            // BUG-061 FIX: PouchDB docs have nested format: { _id, _rev, type, data: { id, title, ... } }
            // We need to extract the actual task data from doc.data and convert dates
            if (deleted) {
                taskStore.updateTaskFromSync(taskId, null, true)
                return
            }

            // Extract task data from nested format
            let taskData = null
            if (doc?.data && typeof doc.data === 'object') {
                // Standard format: { data: { id, title, updatedAt, ... } }
                taskData = doc.data
            } else if (doc?.id && doc?.title !== undefined) {
                // Flat format (legacy): { id, title, updatedAt, ... }
                taskData = doc
            }

            // Validate task has required fields
            if (!taskData || !taskData.id) {
                console.warn('⚠️ [SYNC] Skipping invalid task doc (no id):', id)
                return
            }

            // Convert dates from ISO strings to Date objects
            const normalizedTask = {
                ...taskData,
                createdAt: taskData.createdAt
                    ? new Date(taskData.createdAt)
                    : new Date(),
                updatedAt: taskData.updatedAt
                    ? new Date(taskData.updatedAt)
                    : new Date()
            }

            taskStore.updateTaskFromSync(taskId, normalizedTask, false)
        }

        // Handle project documents (project-{id})
        if (id.startsWith('project-')) {
            // Projects don't have incremental update yet, but we can add it
            console.log('📥 [APP] Project change:', id, deleted ? 'deleted' : 'updated')
        }

        // Handle canvas section documents (section-{id} or group-{id})
        if (id.startsWith('section-') || id.startsWith('group-')) {
            console.log('📥 [APP] Canvas section change:', id, deleted ? 'deleted' : 'updated')
        }
    }

    onMounted(async () => {
        // BUG-057: Run PRE-INITIALIZATION check for Firefox/Zen browser compatibility
        // This must run FIRST - before any PouchDB operations
        // It tests IndexedDB directly and clears corrupted databases
        const preCheckResult = await runPreInitializationCheck()
        if (preCheckResult.cleared) {
            console.log('🔄 [APP] Corrupted IndexedDB was cleared - reloading page to sync fresh data...')
            // Give a moment for the deletion to complete
            setTimeout(() => {
                window.location.reload()
            }, 500)
            return
        }
        if (!preCheckResult.healthy && preCheckResult.error) {
            console.warn('⚠️ [APP] IndexedDB pre-check warning:', preCheckResult.error)
        }

        // TASK-085: Initialize cross-tab coordination for write safety
        initCrossTabCoordination()

        // TASK-085: Run database health check before loading data
        // If corrupted and CouchDB has data, will auto-clear and reload page
        const healthResult = await checkHealth()
        if (healthResult.action === 'cleared-will-sync') {
            // Page will reload - don't continue initialization
            return
        }

        // Load UI state from localStorage
        uiStore.loadState()

        // BUG-054 FIX: Load local data IMMEDIATELY - don't block UI waiting for sync
        // This ensures instant app responsiveness while sync runs in background
        console.log('⚡ [APP] Loading local data immediately...')
        await taskStore.loadFromDatabase()
        await projectStore.loadProjectsFromPouchDB()
        await canvasStore.loadFromDatabase()
        console.log('✅ [APP] Local data loaded - UI ready')

        // Start sync in background - don't await, let it run while app is usable
        // ALWAYS reload stores after sync completes (fixes empty data on fresh browser)
        let hasReloadedStores = false

        syncManager.waitForInitialSync(30000).then(async (syncCompleted) => {
            if (hasReloadedStores) {
                console.log('ℹ️ [APP] Stores already reloaded by fallback timer')
                return
            }
            hasReloadedStores = true
            if (syncCompleted) {
                console.log('✅ [APP] Background sync completed - reloading stores...')
                // Always reload stores after sync to catch conflict-resolved data
                await taskStore.loadFromDatabase()
                await projectStore.loadProjectsFromPouchDB()
                await canvasStore.loadFromDatabase()
                console.log('✅ [APP] Stores reloaded after sync')
            } else {
                console.warn('⚠️ [APP] Background sync timed out - using local data')
            }

            // BUG-057 FIX: Start live sync with changes feed pattern
            // Now uses incremental updates instead of full store reloads
            if (syncManager.remoteConnected?.value || syncManager.hasConnectedEver?.value) {
                console.log('🔄 [APP] Starting live sync with incremental updates...')
                syncManager.startLiveSync().then(success => {
                    if (success) {
                        console.log('✅ [APP] Live sync started')
                    }
                }).catch(err => {
                    console.warn('⚠️ [APP] Live sync error:', err)
                })
            }
        }).catch(err => {
            console.warn('⚠️ [APP] Background sync failed:', err)
        })

        // BUG-055 FALLBACK: Force reload stores after 10 seconds if sync hasn't completed
        // This handles cases where sync hangs or takes too long in some browsers (Firefox/Zen)
        setTimeout(async () => {
            if (hasReloadedStores) {
                console.log('ℹ️ [APP] Fallback timer: stores already reloaded')
                return
            }
            console.log('⏰ [APP] Fallback timer triggered - force reloading stores...')
            hasReloadedStores = true
            await taskStore.loadFromDatabase()
            await projectStore.loadProjectsFromPouchDB()
            await canvasStore.loadFromDatabase()
            console.log('✅ [APP] Stores force-reloaded by fallback timer')

            // BUG-057 FIX: Start live sync from fallback if not already running
            if (!syncManager.isLiveSyncActive() && (syncManager.remoteConnected?.value || syncManager.hasConnectedEver?.value)) {
                console.log('🔄 [APP] Fallback: Starting live sync...')
                syncManager.startLiveSync().catch(() => {})
            }
        }, 10000)

        // BUG-057 FIX: Listen for incremental PouchDB changes
        // Handler is defined at composable level for proper cleanup
        window.addEventListener('pouchdb-change', handlePouchDBChange)

        // Clean up legacy monolithic documents if in individual-only mode
        // This ensures database pruning after successful migration
        const dbInstance = window.pomoFlowDb
        if (dbInstance) {
            const { cleanupLegacyMonolithicDocuments } = await import('@/utils/legacyStorageCleanup')
            cleanupLegacyMonolithicDocuments(dbInstance).catch(err => {
                console.warn('⚠️ Legacy storage cleanup failed:', err)
            })
        }

        // Initialize notification system
        if (taskStore.tasks.length >= 0) {
            try {
                await notificationStore.initializeNotifications()
            } catch (error) {
                console.warn('⚠️ Notification system initialization failed:', error)
            }
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
            if (itpProtection.shouldShowWarning.value) {
                const warningMessage = itpProtection.warningMessage.value
                if (warningMessage) {
                    console.warn('🍎 [Safari ITP]', warningMessage)
                    itpProtection.markAsWarned()
                }
            }
            itpProtection.recordInteraction()
        } catch (error) {
            console.warn('⚠️ Safari ITP check failed:', error)
        }

        // Initialize global keyboard shortcuts (system-level: undo/redo/new-task)
        await initGlobalKeyboardShortcuts()

        // TASK-085: Start periodic conflict pruning (hourly background job)
        startPeriodicPruning()
    })

    // BUG-054/057 FIX: Cleanup on unmount
    onUnmounted(() => {
        if (unregisterDataPulledCallback) {
            unregisterDataPulledCallback()
        }
        // BUG-057: Remove changes feed listener
        window.removeEventListener('pouchdb-change', handlePouchDBChange)
    })
}
