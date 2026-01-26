import { ref, onMounted, onUnmounted } from 'vue'
import { useTimerStore } from '@/stores/timer'
import { useTaskStore } from '@/stores/tasks'
import { useProjectStore } from '@/stores/projects'
import { useCanvasStore } from '@/stores/canvas'
import { useUIStore } from '@/stores/ui'
import { useNotificationStore } from '@/stores/notifications'
import { useAuthStore } from '@/stores/auth'
import { useSupabaseDatabase, invalidateCache } from '@/composables/useSupabaseDatabase'
import { useSafariITPProtection } from '@/utils/safariITPProtection'
import { initGlobalKeyboardShortcuts } from '@/utils/globalKeyboardHandlerSimple'
import { clearGuestData, clearStaleGuestTasks } from '@/utils/guestModeStorage'
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

        console.log('🔍 [BUG-339-DEBUG] Starting database load...')
        console.log('🔍 [BUG-339-DEBUG] Auth status:', authStore.isAuthenticated)

        await Promise.all([
            taskStore.loadFromDatabase(),
            projectStore.loadProjectsFromDatabase(),
            canvasStore.loadFromDatabase()
        ])

        console.log('🔍 [BUG-339-DEBUG] Task count after load:', taskStore.tasks.length)
        console.log('🔍 [BUG-339-DEBUG] Raw tasks:', taskStore._rawTasks?.length || 'N/A')



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
            const tasks = useTaskStore()

            // HARDENED LOCK: Check store, dragging, resizing, and settling flags
            // BUG-1051: Fix sync race condition - also check for manual operations
            const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
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
            // BUG-1051: Fix sync race condition - also check for manual operations
            const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
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

            // High Severity Issue #7: Skip if task is pending local write (drag in progress)
            if (tasks.isPendingWrite(taskId)) {
                console.log(`[REALTIME] Skipping task ${taskId.slice(0,8)} - pending local write`)
                return
            }

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

        const onGroupChange = (payload: any) => {
            // BUG-FIX: Fetch FRESH store instance inside callback to prevent stale closures
            const canvas = useCanvasStore()
            const tasks = useTaskStore()

            // HARDENED LOCK: Check store, dragging, resizing, and settling flags
            const isLocked = canvas.isDragging || tasks.manualOperationInProgress || (typeof window !== 'undefined' && (
                (window as any).__FlowStateIsDragging ||
                (window as any).__FlowStateIsResizing ||
                (window as any).__FlowStateIsSettling
            ))

            if (isLocked) {
                return
            }

            const { eventType, new: newDoc, old: oldDoc } = payload
            if (eventType === 'DELETE' || (newDoc && newDoc.is_deleted)) {
                canvas.removeGroupFromSync(newDoc?.id || oldDoc?.id)
            } else if (newDoc) {
                // Map raw Supabase data to app format
                // Groups use position field directly, no special mapping needed
                canvas.updateGroupFromSync(newDoc.id, newDoc)
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
        }

        const channel = initRealtimeSubscription(onProjectChange, onTaskChange, timerHandler, undefined, onGroupChange, onRecovery)
        activeChannel.value = channel

        if (channel) {
            console.log('📡 [APP-INIT] Realtime subscription created with project, task, and timer handlers')
        }


    })

    onUnmounted(() => {
        if (activeChannel.value) {

            activeChannel.value.unsubscribe()
            activeChannel.value = null
        }
    })
}
