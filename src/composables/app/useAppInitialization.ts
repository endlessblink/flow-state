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

export function useAppInitialization() {
    const timerStore = useTimerStore()
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const canvasStore = useCanvasStore()
    const uiStore = useUIStore()
    const notificationStore = useNotificationStore()
    const itpProtection = useSafariITPProtection()

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

    onMounted(async () => {
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
        // The callback above will reload stores when sync completes
        syncManager.waitForInitialSync(30000).then(syncCompleted => {
            if (syncCompleted) {
                console.log('✅ [APP] Background sync completed')
            } else {
                console.warn('⚠️ [APP] Background sync timed out - using local data')
            }
        }).catch(err => {
            console.warn('⚠️ [APP] Background sync failed:', err)
        })

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
    })

    // BUG-054 FIX: Cleanup callback registration on unmount
    onUnmounted(() => {
        if (unregisterDataPulledCallback) {
            unregisterDataPulledCallback()
        }
    })
}
