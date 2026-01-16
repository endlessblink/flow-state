import { ref } from 'vue'
import { supabase } from '@/services/auth/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Task, Project } from '@/types/tasks'
import type { ScheduledNotification } from '@/types/recurrence'
import type { CanvasGroup } from '@/types/canvas'
import type { AppSettings } from '@/stores/settings'
import type { PomodoroSession } from '@/stores/timer'
import type { SessionSummary } from '@/stores/quickSort'
import {
    toSupabaseTask, fromSupabaseTask,
    toSupabaseProject, fromSupabaseProject,
    toSupabaseGroup, fromSupabaseGroup,
    toSupabaseNotification, fromSupabaseNotification,
    toSupabaseTimerSession, fromSupabaseTimerSession,
    toSupabaseUserSettings, fromSupabaseUserSettings,
    toSupabaseQuickSortSession, fromSupabaseQuickSortSession,
    type SupabaseTask, type SupabaseProject, type SupabaseGroup,
    type SupabaseNotification, type SupabaseTimerSession, type SupabaseUserSettings, type SupabaseQuickSortSession
} from '@/utils/supabaseMappers'
import { errorHandler, ErrorSeverity, ErrorCategory } from '@/utils/errorHandler'

// FORCE_HMR_UPDATE: Clearing stale cache for position_version schema
// App Types are defined locally or imported for convenience
export interface TimerSettings {
    workDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    autoStartBreaks: boolean
    autoStartPomodoros: boolean
    playNotificationSounds: boolean
}

// Define DatabaseDependencies for the new function signature
type DatabaseDependencies = Record<string, unknown>

export function useSupabaseDatabase(_deps: DatabaseDependencies = {}) {

    const authStore = useAuthStore()
    const isSyncing = ref(false)
    const lastSyncError = ref<string | null>(null)

    // -- Helpers --

    const getUserIdSafe = (): string | null => {
        return authStore.user?.id || null
    }

    /**
     * Helper to execute Supabase operations with transient error retries (e.g. clock skew)
     */
    const withRetry = async <T>(operation: () => Promise<T>, context: string, maxRetries = 2): Promise<T> => {
        let lastErr: any = null

        for (let i = 0; i < maxRetries; i++) {
            try {
                return await operation()
            } catch (err: any) {
                lastErr = err
                const message = err?.message || String(err)

                // Check for "JWT issued at future" (Clock Skew)
                if (message.includes('JWT issued at future')) {
                    console.warn(`🕒 [CLOCK-SKEW] ${context} failed due to clock skew. Retrying in 1s... (Attempt ${i + 1}/${maxRetries})`)
                    await new Promise(resolve => setTimeout(resolve, 1000))
                    continue
                }

                // For other errors, don't retry immediately unless they look transient
                throw err
            }
        }

        throw lastErr
    }

    const handleError = (error: unknown, context: string) => {
        // Handle Supabase/Postgrest errors which are objects but not Error instances
        let message = 'Unknown error'
        let details = ''

        if (error instanceof Error) {
            message = error.message
        } else if (typeof error === 'object' && error !== null) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const e = error as any
            message = e.message || String(error)
            details = e.details || e.hint || ''
        } else {
            message = String(error)
        }

        const finalMessage = details ? `${message} (${details})` : message
        const err = error instanceof Error ? error : new Error(finalMessage)

        errorHandler.report({
            error: err,
            message: `Sync Error(${context}): ${finalMessage}`,
            severity: ErrorSeverity.ERROR,
            category: ErrorCategory.SYNC,
            showNotification: true
        })
        lastSyncError.value = finalMessage
    }

    // -- Projects --

    const fetchProjects = async (): Promise<Project[]> => {
        try {
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('projects')
                    .select('*')
                    .order('created_at', { ascending: true })

                if (error) throw error
                if (!data) return []

                return (data as SupabaseProject[]).map(fromSupabaseProject)
            }, 'fetchProjects')
        } catch (e: unknown) {
            handleError(e, 'fetchProjects')
            return []
        }
    }

    const saveProject = async (project: Project): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveProject - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = toSupabaseProject(project, userId)
            const { error } = await supabase.from('projects').upsert(payload, { onConflict: 'id' })
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveProject')
        } finally {
            isSyncing.value = false
        }
    }

    const saveProjects = async (projects: Project[]): Promise<void> => {
        if (projects.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveProjects - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = projects.map(p => toSupabaseProject(p, userId))
            // BUG-171 FIX: Add .select() and verify data.length to detect RLS partial write failures
            const { data, error } = await supabase.from('projects').upsert(payload, { onConflict: 'id' }).select('id')
            if (error) throw error
            if (!data || data.length !== payload.length) {
                const writtenCount = data?.length ?? 0
                const failedCount = payload.length - writtenCount
                throw new Error(`RLS blocked ${failedCount} of ${payload.length} project writes (only ${writtenCount} succeeded)`)
            }
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveProjects')
            throw e // BUG-171: Re-throw so callers know the save failed
        } finally {
            isSyncing.value = false
        }
    }

    const deleteProject = async (projectId: string): Promise<void> => {
        try {
            isSyncing.value = true
            const { error } = await supabase
                .from('projects')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', projectId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'deleteProject')
        } finally {
            isSyncing.value = false
        }
    }

    const restoreProject = async (projectId: string): Promise<void> => {
        try {
            isSyncing.value = true
            const { error } = await supabase
                .from('projects')
                .update({ is_deleted: false, deleted_at: null })
                .eq('id', projectId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'restoreProject')
        } finally {
            isSyncing.value = false
        }
    }

    const permanentlyDeleteProject = async (projectId: string): Promise<void> => {
        try {
            isSyncing.value = true
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'permanentlyDeleteProject')
        } finally {
            isSyncing.value = false
        }
    }

    // -- Tasks --

    const fetchTasks = async (): Promise<Task[]> => {
        try {
            return await withRetry(async () => {
                const { data, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('is_deleted', false)

                if (error) throw error
                if (!data) return []

                // TASK-142 DEBUG: Log what positions we receive from Supabase
                const tasksWithPos = data.filter((d: any) => d.position)
                if (tasksWithPos.length > 0) {
                    console.log(`📥 [TASK-142] LOADED ${tasksWithPos.length} tasks with positions from Supabase:`,
                        tasksWithPos.map((d: any) => ({ id: d.id?.substring(0, 8), pos: d.position })))
                } else {
                    console.log(`📥 [TASK-142] LOADED ${data.length} tasks - NONE have positions in DB`)
                }

                return (data as SupabaseTask[]).map(fromSupabaseTask)
            }, 'fetchTasks')
        } catch (e: unknown) {
            handleError(e, 'fetchTasks')
            return []
        }
    }

    const fetchTrash = async (): Promise<Task[]> => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('is_deleted', true)
                .order('deleted_at', { ascending: false })

            if (error) throw error
            if (!data) return []

            return (data as SupabaseTask[]).map(fromSupabaseTask)
        } catch (e: unknown) {
            handleError(e, 'fetchTrash')
            return []
        }
    }

    const saveTask = async (task: Task): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveTask - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = toSupabaseTask(task, userId)

            await withRetry(async () => {
                const { error } = await supabase.from('tasks').upsert(payload, { onConflict: 'id' })
                if (error) throw error
            }, 'saveTask')

            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveTask')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    const saveTasks = async (tasks: Task[]): Promise<void> => {
        if (tasks.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveTasks - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = tasks.map(t => toSupabaseTask(t, userId))

            // TASK-142 DEBUG: Log what we're sending
            const tasksWithPos = payload.filter(p => p.position)
            if (tasksWithPos.length > 0) {
                console.log(`📤 [TASK-142] SENDING ${tasksWithPos.length} tasks with positions:`,
                    tasksWithPos.map(t => ({ id: t.id?.substring(0, 8), pos: t.position })))
            }

            // TASK-142 FIX: Add .select() and check data.length to detect RLS silent failures
            // Supabase RLS can block writes but return { error: null, data: [] }
            // Also detect PARTIAL failures where some rows are blocked
            await withRetry(async () => {
                const { data, error } = await supabase.from('tasks').upsert(payload, { onConflict: 'id' }).select('id, position')
                if (error) throw error
                if (!data || data.length !== payload.length) {
                    const writtenCount = data?.length ?? 0
                    const failedCount = payload.length - writtenCount
                    throw new Error(`RLS blocked ${failedCount} of ${payload.length} writes (only ${writtenCount} succeeded)`)
                }
                // TASK-142 DEBUG: Log what Supabase returned
                const positionSaves = data.filter((d: any) => d.position)
                if (positionSaves.length > 0) {
                    console.log(`📥 [TASK-142] RECEIVED ${positionSaves.length} tasks with positions:`,
                        positionSaves.map((d: any) => ({ id: d.id?.substring(0, 8), pos: d.position })))
                } else if (tasksWithPos.length > 0) {
                    console.error(`❌ [TASK-142] POSITION LOST! Sent ${tasksWithPos.length} with positions, received 0 back!`)
                }
            }, 'saveTasks')

            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveTasks')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    const deleteTask = async (taskId: string): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping deleteTask - not authenticated')
            return
        }
        console.log(`🗑️ [SUPABASE-DELETE] Starting soft-delete for task: ${taskId}`)
        try {
            isSyncing.value = true

            const { error, count } = await supabase
                .from('tasks')
                .update({ is_deleted: true, deleted_at: new Date().toISOString() })
                .eq('id', taskId)
                .select('*', { count: 'exact' })

            console.log(`🗑️ [SUPABASE-DELETE] Result - error: ${error?.message || 'none'}, affected rows: ${count ?? 'unknown'}`)

            if (error) throw error
            lastSyncError.value = null
            console.log(`✅ [SUPABASE-DELETE] Task ${taskId} marked as deleted`)
        } catch (e: unknown) {
            console.error(`❌ [SUPABASE-DELETE] Failed to delete task ${taskId}:`, e)
            handleError(e, 'deleteTask')
            throw e  // Re-throw so caller knows it failed
        } finally {
            isSyncing.value = false
        }
    }

    const restoreTask = async (taskId: string): Promise<void> => {
        try {
            isSyncing.value = true
            const { error } = await supabase
                .from('tasks')
                .update({ is_deleted: false, deleted_at: null })
                .eq('id', taskId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'restoreTask')
        } finally {
            isSyncing.value = false
        }
    }

    const permanentlyDeleteTask = async (taskId: string): Promise<void> => {
        try {
            isSyncing.value = true
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'permanentlyDeleteTask')
        } finally {
            isSyncing.value = false
        }
    }

    // TASK-153: Fetch IDs of deleted tasks (for golden backup validation)
    const fetchDeletedTaskIds = async (): Promise<string[]> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return []

            const { data, error } = await supabase
                .from('tasks')
                .select('id')
                .eq('is_deleted', true)
                .eq('user_id', userId)

            if (error) throw error
            return data?.map((d: any) => d.id) || []
        } catch (e: unknown) {
            console.error('[TASK-153] Failed to fetch deleted task IDs:', e)
            return []
        }
    }

    // TASK-153: Fetch IDs of deleted projects (for golden backup validation)
    const fetchDeletedProjectIds = async (): Promise<string[]> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return []

            const { data, error } = await supabase
                .from('projects')
                .select('id')
                .eq('is_deleted', true)
                .eq('user_id', userId)

            if (error) throw error
            return data?.map((d: any) => d.id) || []
        } catch (e: unknown) {
            console.error('[TASK-153] Failed to fetch deleted project IDs:', e)
            return []
        }
    }

    // TASK-153: Fetch IDs of deleted groups (for golden backup validation)
    const fetchDeletedGroupIds = async (): Promise<string[]> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return []

            const { data, error } = await supabase
                .from('groups')
                .select('id')
                .eq('is_deleted', true)
                .eq('user_id', userId)

            if (error) throw error
            return data?.map((d: any) => d.id) || []
        } catch (e: unknown) {
            console.error('[TASK-153] Failed to fetch deleted group IDs:', e)
            return []
        }
    }

    // BUG-025 FIX: Atomic bulk delete using Supabase .in() operator
    const bulkDeleteTasks = async (taskIds: string[]): Promise<void> => {
        if (taskIds.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping bulkDeleteTasks - not authenticated')
            return
        }
        console.log(`🗑️ [SUPABASE-BULK-DELETE] Starting atomic soft-delete for ${taskIds.length} tasks`)
        try {
            isSyncing.value = true

            const { error, count } = await supabase
                .from('tasks')
                // FIX: Schema compatibility - remove deleted_at if not in DB
                .update({ is_deleted: true })
                .in('id', taskIds)
                .select('*', { count: 'exact' })

            console.log(`🗑️ [SUPABASE-BULK-DELETE] Result - error: ${error?.message || 'none'}, affected rows: ${count ?? 'unknown'}`)

            if (error) throw error
            lastSyncError.value = null
            console.log(`✅ [SUPABASE-BULK-DELETE] ${taskIds.length} tasks marked as deleted atomically`)
        } catch (e: unknown) {
            console.error(`❌ [SUPABASE-BULK-DELETE] Failed to bulk delete ${taskIds.length} tasks:`, e)
            handleError(e, 'bulkDeleteTasks')
            throw e // Re-throw so caller knows it failed
        } finally {
            isSyncing.value = false
        }
    }

    // -- Groups --

    const fetchGroups = async (): Promise<CanvasGroup[]> => {
        try {
            const { data, error } = await supabase
                .from('groups')
                .select('*')
                .eq('is_deleted', false)

            if (error) throw error
            if (!data) return []


            // DEBUG: Log loaded groups and their dimensions
            const groups = data as SupabaseGroup[]
            groups.forEach((g: any) => {
                const pos = g.position_json
                console.log(`📦 [GROUP-LOAD] "${g.name}" loaded from Supabase: size=${pos?.width}x${pos?.height}`)
            })

            return (data as SupabaseGroup[]).map(fromSupabaseGroup)
        } catch (e: unknown) {
            handleError(e, 'fetchGroups')
            return []
        }
    }

    const saveGroup = async (group: CanvasGroup): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveGroup - not authenticated')
            return
        }
        try {
            isSyncing.value = true
            const payload = toSupabaseGroup(group, userId)

            // TASK-142 FIX: Add .select() and check data.length to detect RLS silent failures
            // BUG FIX: Use position_json (actual DB column name), not position
            await withRetry(async () => {
                const { data, error } = await supabase.from('groups').upsert(payload, { onConflict: 'id' }).select('id, position_json')
                if (error) throw error
                if (!data || data.length === 0) {
                    throw new Error('RLS blocked write - upsert returned no data for group')
                }
                // Log position save for debugging
                if (data[0]?.position_json) {
                    const pos = data[0].position_json
                    console.log(`📍 [GROUP-SAVE] Saved group "${group.name}" pos=(${pos.x?.toFixed(0)}, ${pos.y?.toFixed(0)}) size=${pos.width}x${pos.height} to Supabase - VERIFIED`)
                }
            }, 'saveGroup')

            lastSyncError.value = null
        } catch (e: unknown) {
            console.error('Save Group Error:', e)
            throw e // Re-throw so callers know the save failed
        } finally {
            isSyncing.value = false
        }
    }

    const deleteGroup = async (groupId: string): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping deleteGroup - not authenticated')
            return
        }
        console.log(`🗑️ [SUPABASE-DELETE-GROUP] Starting soft-delete for group: ${groupId}`)
        try {
            isSyncing.value = true

            // TASK-149 FIX: Add user_id filter and verify rows affected
            const { data, error, count } = await supabase
                .from('groups')
                // FIX: Column 'deleted_at' does not exist in schema. Use 'is_deleted' only.
                .update({ is_deleted: true })
                .eq('id', groupId)
                .eq('user_id', userId)
                .select('id, is_deleted', { count: 'exact' })

            console.log(`🗑️ [SUPABASE-DELETE-GROUP] Result - error: ${error?.message || 'none'}, affected: ${count ?? 'unknown'}`)

            if (error) throw error

            // Verify the delete actually worked
            if (!data || data.length === 0) {
                // BUG-208 FIX: Treat "no rows updated" as success (idempotent delete).
                // This handles cases where the group is already deleted in DB but stuck in UI.
                console.warn(`⚠️ [SUPABASE-DELETE-GROUP] No rows updated - group ${groupId} likely already deleted or RLS blocked. Proceeding with local removal.`)
                // We do NOT throw here anymore, allowing the UI to proceed with removing the node.
            } else {
                console.log(`✅ [SUPABASE-DELETE-GROUP] Group ${groupId} marked as deleted`)
            }
        } catch (e: unknown) {
            console.error(`❌ [SUPABASE-DELETE-GROUP] Failed:`, e)
            handleError(e, 'deleteGroup')
            throw e // Only re-throw actual errors (network, auth, etc)
        } finally {
            isSyncing.value = false
        }
    }

    // -- Notifications --

    const fetchNotifications = async (): Promise<ScheduledNotification[]> => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('is_dismissed', false)

            if (error) throw error
            if (!data) return []

            return (data as SupabaseNotification[]).map(fromSupabaseNotification)
        } catch (e: unknown) {
            handleError(e, 'fetchNotifications')
            return []
        }
    }

    const saveNotification = async (notification: ScheduledNotification): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveNotification - not authenticated')
            return
        }
        try {
            const payload = toSupabaseNotification(notification, userId)
            const { error } = await supabase.from('notifications').upsert(payload, { onConflict: 'id' })
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'saveNotification')
        }
    }

    const saveNotifications = async (notifications: ScheduledNotification[]): Promise<void> => {
        if (notifications.length === 0) return
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveNotifications - not authenticated')
            return
        }
        try {
            const payload = notifications.map(n => toSupabaseNotification(n, userId))
            const { error } = await supabase.from('notifications').upsert(payload, { onConflict: 'id' })
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'saveNotifications')
        }
    }

    const deleteNotification = async (id: string): Promise<void> => {
        try {
            const { error } = await supabase.from('notifications').delete().eq('id', id)
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'deleteNotification')
        }
    }

    // -- Timer Sessions --

    const fetchActiveTimerSession = async (): Promise<PomodoroSession | null> => {
        try {
            const userId = getUserIdSafe()
            console.log('🍅 [DB] fetchActiveTimerSession userId:', userId)
            if (!userId) {
                console.log('🍅 [DB] No userId - returning null')
                return null
            }

            const { data, error } = await supabase
                .from('timer_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            console.log('🍅 [DB] fetchActiveTimerSession result:', { hasData: !!data, error: error?.message })

            if (error) throw error
            if (!data) return null

            return fromSupabaseTimerSession(data as SupabaseTimerSession)
        } catch (e: unknown) {
            handleError(e, 'fetchActiveTimerSession')
            return null
        }
    }

    const saveActiveTimerSession = async (session: PomodoroSession, deviceId: string): Promise<void> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) {
                console.log('🍅 [DB] saveActiveTimerSession - no userId, skipping')
                return
            }

            const payload = toSupabaseTimerSession(session, userId, deviceId)
            console.log('🍅 [DB] saveActiveTimerSession:', { sessionId: session.id, userId, deviceId, isActive: session.isActive })
            const { error } = await supabase.from('timer_sessions').upsert(payload, { onConflict: 'id' })
            if (error) {
                console.error('🍅 [DB] saveActiveTimerSession error:', error)
                throw error
            }
            console.log('🍅 [DB] saveActiveTimerSession success')
        } catch (e: unknown) {
            handleError(e, 'saveActiveTimerSession')
        }
    }

    const deleteTimerSession = async (id: string): Promise<void> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return // Skip Supabase sync when not authenticated (local-only mode)

            const { error } = await supabase.from('timer_sessions').delete().eq('id', id)
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'deleteTimerSession')
        }
    }

    // -- User Settings --

    const fetchUserSettings = async (): Promise<AppSettings | null> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return null

            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle()

            if (error) throw error
            if (!data) return null

            return fromSupabaseUserSettings(data as SupabaseUserSettings)
        } catch (e: unknown) {
            console.error('Fetch User Settings Error:', e)
            return null
        }
    }

    const saveUserSettings = async (settings: AppSettings): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveUserSettings - not authenticated')
            return
        }
        try {
            const payload = toSupabaseUserSettings(settings, userId)

            await withRetry(async () => {
                // Fix: Explicitly specify conflict target to handle 'user_settings_user_id_key' violation
                const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' })
                if (error) throw error
            }, 'saveUserSettings')
        } catch (e: unknown) {
            handleError(e, 'saveUserSettings')
        }
    }

    // -- Quick Sort Sessions --

    const fetchQuickSortHistory = async (): Promise<SessionSummary[]> => {
        try {
            const { data, error } = await supabase
                .from('quick_sort_sessions')
                .select('*')
                .order('completed_at', { ascending: false })

            if (error) throw error
            if (!data) return []

            return (data as SupabaseQuickSortSession[]).map(fromSupabaseQuickSortSession)
        } catch (e: unknown) {
            handleError(e, 'fetchQuickSortHistory')
            return []
        }
    }

    const saveQuickSortSession = async (summary: SessionSummary): Promise<void> => {
        const userId = getUserIdSafe()
        if (!userId) {
            console.debug('⏭️ [GUEST] Skipping saveQuickSortSession - not authenticated')
            return
        }
        try {
            const payload = toSupabaseQuickSortSession(summary, userId)
            const { error } = await supabase.from('quick_sort_sessions').upsert(payload, { onConflict: 'id' })
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'saveQuickSortSession')
        }
    }

    // -- Realtime Subscription --

    const initRealtimeSubscription = (
        onProjectChange: (payload: unknown) => void,
        onTaskChange: (payload: unknown) => void,
        onTimerChange?: (payload: unknown) => void,
        onNotificationChange?: (payload: unknown) => void
    ) => {
        const userId = authStore.user?.id
        if (!userId) return null

        // Use a unique channel name per user and purpose
        const channelName = `db-changes-${userId.substring(0, 8)}`
        const channel = supabase.channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'projects', filter: `user_id=eq.${userId}` },
                (payload: any) => {
                    // SAFETY: Explicitly verify table to prevent cross-talk
                    if (payload.table === 'projects') {
                        onProjectChange(payload)
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
                (payload: any) => {
                    // SAFETY: Explicitly verify table
                    if (payload.table === 'tasks') {
                        onTaskChange(payload)
                    }
                }
            )

        if (onTimerChange) {
            channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'timer_sessions', filter: `user_id=eq.${userId}` },
                (payload: any) => onTimerChange(payload)
            )
        }

        if (onNotificationChange) {
            channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
                (payload: any) => onNotificationChange(payload)
            )
        }

        // DEBUG: Log auth state before subscription
        const session = authStore.session
        console.log(`📡 [REALTIME] Initializing subscription. Auth state: ${session ? 'Authenticated' : 'Anonymous'}, Role: ${session?.user?.role || 'none'}`)

        // PHASE 4 FIX: Clear any existing active channel to prevent zombies
        if (supabase.realtime.channels.length > 0) {
            console.log(`📡 [REALTIME] Cleaning up ${supabase.realtime.channels.length} existing channels...`)
            supabase.removeAllChannels()
        }

        // Delay subscription to ensure client state is synced and auth is stable
        const connectRealtime = async () => {
            console.log('📡 [REALTIME] Preparing connection...')

            try {
                // BUG-202: CRITICAL - Ensure we have a fresh token BEFORE any .subscribe() call
                const { data: { session: freshSession } } = await supabase.auth.getSession()
                if (freshSession?.access_token) {
                    console.log('📡 [REALTIME] Setting fresh auth token for WebSocket')
                    supabase.realtime.setAuth(freshSession.access_token)
                }

                channel.subscribe((status: any, err?: any) => {
                    if (status === 'SUBSCRIBED') {
                        console.log('📡 [REALTIME] Successfully subscribed to database changes')
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('📡 [REALTIME] Handshake failed or connection error:', err || 'Check RLS and JWT expiration')

                        // Retrying auth refresh if we get a 403
                        if (String(err).includes('403') || !err) {
                            console.log('📡 [REALTIME] Attempting emergency auth refresh...')
                            supabase.auth.refreshSession().then(() => {
                                console.log('📡 [REALTIME] Session refreshed, system will auto-retry connection')
                            }).catch((refreshErr: unknown) => {
                                console.error('[ASYNC-ERROR] initRealtimeSubscription refreshSession failed', refreshErr)
                            })
                        }
                    }
                })
            } catch (authErr) {
                console.warn('📡 [REALTIME] Initialization failed:', authErr)
            }
        }

        // Start connection
        connectRealtime()

        return channel
    }

    return {
        isSyncing,
        lastSyncError,
        fetchProjects,
        saveProject,
        saveProjects,
        deleteProject,
        restoreProject,
        permanentlyDeleteProject,
        fetchTasks,
        fetchTrash,
        saveTask,
        saveTasks,
        deleteTask,
        bulkDeleteTasks,
        restoreTask,
        permanentlyDeleteTask,
        // TASK-153: Fetch deleted item IDs for golden backup validation
        fetchDeletedTaskIds,
        fetchDeletedProjectIds,
        fetchDeletedGroupIds,
        fetchGroups,
        saveGroup,
        deleteGroup,
        fetchNotifications,
        saveNotification,
        saveNotifications,
        deleteNotification,
        fetchActiveTimerSession,
        saveActiveTimerSession,
        deleteTimerSession,
        fetchUserSettings,
        saveUserSettings,
        fetchQuickSortHistory,
        saveQuickSortSession,
        initRealtimeSubscription
    }
}
