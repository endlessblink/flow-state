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

            // BUG-169 DEBUG: Log ALL realtime events to diagnose task disappearance
            console.log(`🔔 [REALTIME] Task event:`, {
                eventType,
                taskId: taskId?.substring(0, 8),
                is_deleted: newDoc?.is_deleted,
                is_deleted_type: typeof newDoc?.is_deleted,
                title: newDoc?.title?.substring(0, 20) || oldDoc?.title?.substring(0, 20),
                created_at: newDoc?.created_at,
                updated_at: newDoc?.updated_at
            })

            // BUG-169 FIX: Safety guards to prevent spurious task deletions
            // 1. Check for hard DELETE event (eventType === 'DELETE')
            // 2. Check for soft delete ONLY if is_deleted is EXPLICITLY true (not just truthy)
            //    This prevents issues where undefined/null might be misinterpreted
            const isHardDelete = eventType === 'DELETE'
            const isSoftDelete = newDoc && newDoc.is_deleted === true

            if (isHardDelete || isSoftDelete) {
                // Extra safety: Check if this task exists locally and was recently created
                // If created in the last 10 seconds, block the deletion (likely a sync race)
                const sessionStart = (window as any).PomoFlowSessionStart || 0
                const timeSinceSessionStart = Date.now() - sessionStart

                // Don't process deletions in the first 5 seconds of the session (anti-race guard)
                if (timeSinceSessionStart < 5000) {
                    console.warn(`🛡️ [REALTIME] BLOCKED deletion for task ${taskId.substring(0, 8)} - session just started (${timeSinceSessionStart}ms ago)`)
                    return
                }

                console.warn(`⚠️ [REALTIME] Removing task ${taskId.substring(0, 8)} - eventType: ${eventType}, is_deleted: ${newDoc?.is_deleted}`)
                taskStore.updateTaskFromSync(taskId, null, true)
            } else if (newDoc) {
                // BUG-FIX: Map raw Supabase data to app format
                // This ensures is_deleted -> _soft_deleted, position -> canvasPosition, etc.
                const mappedTask = fromSupabaseTask(newDoc as SupabaseTask)
                console.log(`✅ [REALTIME] Updating task ${taskId.substring(0, 8)} - title: ${mappedTask.title?.substring(0, 20)}`)
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
