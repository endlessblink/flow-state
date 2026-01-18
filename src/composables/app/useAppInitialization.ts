import { ref, onMounted, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
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
    const activeChannel = ref<any>(null)

    onMounted(async () => {
        // MARK: SESSION START for stability guards
        if (typeof window !== 'undefined') {
            (window as any).FlowStateSessionStart = Date.now()
        }


        // 0. Initialize auth and clear guest data if not authenticated
        const authStore = useAuthStore()
        await authStore.initialize()

        if (!authStore.isAuthenticated) {
            // Guest mode: clear all persisted data for fresh experience
            clearGuestData()

        }

        // 1. Initial Load from Supabase

        uiStore.loadState()

        await Promise.all([
            taskStore.loadFromDatabase(),
            projectStore.loadProjectsFromDatabase(),
            canvasStore.loadFromDatabase()
        ])



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
            // BUG-FIX: Fetch FRESH store instance inside callback to prevent stale closures
            const canvas = useCanvasStore()
            const projects = useProjectStore()

            // HARDENED LOCK: Check store, dragging, resizing, and settling flags
            const isLocked = canvas.isDragging || (typeof window !== 'undefined' && (
                (window as any).__FlowStateIsDragging ||
                (window as any).__FlowStateIsResizing ||
                (window as any).__FlowStateIsSettling
            ))

            if (isLocked) {

                return
            }

            const { eventType, new: newDoc, old: oldDoc } = payload
            if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                projects.removeProjectFromSync(newDoc?.id || oldDoc?.id)
            } else if (newDoc) {
                // BUG-FIX: Map raw Supabase data to app format
                const mappedProject = fromSupabaseProject(newDoc as SupabaseProject)
                projects.updateProjectFromSync(mappedProject.id, mappedProject)
            }
        }

        const onTaskChange = (payload: any) => {
            // BUG-FIX: Fetch FRESH store instance inside callback to prevent stale closures
            const canvas = useCanvasStore()
            const tasks = useTaskStore()

            // HARDENED LOCK: Check store, dragging, resizing, and settling flags
            const isLocked = canvas.isDragging || (typeof window !== 'undefined' && (
                (window as any).__FlowStateIsDragging ||
                (window as any).__FlowStateIsResizing ||
                (window as any).__FlowStateIsSettling
            ))

            if (isLocked) {

                return
            }

            const { eventType, new: newDoc, old: oldDoc } = payload
            const taskId = newDoc?.id || oldDoc?.id
            if (!taskId) return

            // BUG-169 DEBUG: Log ALL realtime events to diagnose task disappearance
            /* console.log(`[REALTIME] Task event:`, {
                eventType,
                taskId: taskId?.substring(0, 8),
                is_deleted: newDoc?.is_deleted,
                title: newDoc?.title?.substring(0, 20) || oldDoc?.title?.substring(0, 20)
            }) */

            // BUG-169 FIX: Safety guards to prevent spurious task deletions
            // 1. Check for hard DELETE event (eventType === 'DELETE')
            // 2. Check for soft delete ONLY if is_deleted is EXPLICITLY true (not just truthy)
            const isHardDelete = eventType === 'DELETE'
            const isSoftDelete = newDoc && newDoc.is_deleted === true

            if (isHardDelete || isSoftDelete) {
                // Extra safety: Check session start time
                const sessionStart = (window as any).FlowStateSessionStart || 0
                const timeSinceSessionStart = Date.now() - sessionStart

                // Don't process deletions in the first 5 seconds of the session (anti-race guard)
                if (timeSinceSessionStart < 5000) {
                    console.warn(`[REALTIME] BLOCKED deletion for task ${taskId.substring(0, 8)} - session just started`)
                    return
                }

                console.warn(`[REALTIME] Removing task ${taskId.substring(0, 8)}`)
                tasks.updateTaskFromSync(taskId, null, true)
            } else if (newDoc) {
                // BUG-FIX: Map raw Supabase data to app format
                // This ensures is_deleted -> _soft_deleted, position -> canvasPosition, etc.
                const mappedTask = fromSupabaseTask(newDoc as SupabaseTask)

                tasks.updateTaskFromSync(taskId, mappedTask, false)
            }
        }

        const channel = initRealtimeSubscription(onProjectChange, onTaskChange)
        activeChannel.value = channel

        if (channel) {

        }


    })

    onUnmounted(() => {
        if (activeChannel.value) {

            activeChannel.value.unsubscribe()
            activeChannel.value = null
        }
    })
}
