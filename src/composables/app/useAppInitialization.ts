import { onMounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { getGlobalReliableSyncManager } from '@/composables/useReliableSyncManager'
import { useSafariITPProtection } from '@/utils/safariITPProtection'
import { initGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'

export function useAppInitialization() {
    const timerStore = useTimerStore()
    const taskStore = useTaskStore()
    const canvasStore = useCanvasStore()
    const uiStore = useUIStore()
    const notificationStore = useNotificationStore()
    const itpProtection = useSafariITPProtection()

    onMounted(async () => {
        // Load UI state from localStorage
        uiStore.loadState()

        // Sync and Data loading
        const syncManager = getGlobalReliableSyncManager()
        const syncCompleted = await syncManager.waitForInitialSync(10000)

        if (!syncCompleted) {
            console.warn('⚠️ Sync did not complete in time, loading local data')
        }

        await taskStore.loadFromDatabase()
        await canvasStore.loadFromDatabase()

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
}
