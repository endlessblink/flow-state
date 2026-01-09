import { onMounted, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabaseV2'
import { useSafariITPProtection } from '@/utils/safariITPProtection'
import { initGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import { clearGuestData } from '@/utils/guestModeStorage'
// BUG-FIX: Import mappers to properly convert realtime data
import { fromSupabaseTask, fromSupabaseProject, type SupabaseTask, type SupabaseProject } from '@/utils/supabaseMappers'

export function useAppInitialization() {
    const timerStore = useTimerStore()
    const taskStore = useTaskStore()
    const projectStore = useProjectStore()
    const canvasStore = useCanvasStore()
    const uiStore = useUIStore()
    const notificationStore = useNotificationStore()
    const itpProtection = useSafariITPProtection()

    onMounted(async () => {
        // MARK: SESSION START for stability guards
        if (typeof window !== 'undefined') {
            (window as any).PomoFlowSessionStart = Date.now()
        }
        console.log('🚀 [APP] Starting strictly ordered initialization (Supabase Mode)...')

        // 0. Initialize auth and clear guest data if not authenticated
        const authStore = useAuthStore()
        await authStore.initialize()

        if (!authStore.isAuthenticated) {
            // Guest mode: clear all persisted data for fresh experience
            clearGuestData()
            console.log('👤 [APP] Guest mode: starting with fresh empty app')
        }

        // 1. Initial Load from Supabase
        console.log('⚡ [APP] Loading stores from Supabase...')
        uiStore.loadState()

        await Promise.all([
            taskStore.loadFromDatabase(),
            projectStore.loadProjectsFromDatabase(),
            canvasStore.loadFromDatabase()
        ])

        console.log('✅ [APP] Core stores loaded')

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

        // Initialize global keyboard shortcuts
        await initGlobalKeyboardShortcuts()

        // 3. Initialize Realtime Subscriptions
        const { initRealtimeSubscription } = useSupabaseDatabase()

        const onProjectChange = (payload: any) => {
            const { eventType, new: newDoc, old: oldDoc } = payload
            if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                projectStore.removeProjectFromSync(newDoc?.id || oldDoc?.id)
            } else if (newDoc) {
                // BUG-FIX: Map raw Supabase data to app format
                const mappedProject = fromSupabaseProject(newDoc as SupabaseProject)
                projectStore.updateProjectFromSync(mappedProject.id, mappedProject)
            }
        }

        const onTaskChange = (payload: any) => {
            const { eventType, new: newDoc, old: oldDoc } = payload
            const taskId = newDoc?.id || oldDoc?.id
            if (!taskId) return

            if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                taskStore.updateTaskFromSync(taskId, null, true)
            } else if (newDoc) {
                // BUG-FIX: Map raw Supabase data to app format
                // This ensures is_deleted -> _soft_deleted, position -> canvasPosition, etc.
                const mappedTask = fromSupabaseTask(newDoc as SupabaseTask)
                taskStore.updateTaskFromSync(taskId, mappedTask, false)
            }
        }

        const channel = initRealtimeSubscription(onProjectChange, onTaskChange)
        if (channel) {
            console.log('📡 [APP] Realtime subscriptions active')
            // Option: store channel for cleanup
        }

        console.log('✅ [APP] Initialization complete')
    })

    onUnmounted(() => {
        // Cleanup if any
    })
}
