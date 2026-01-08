import { ref } from 'vue'
import { supabase } from '@/services/auth/supabase'
import { useAuthStore } from '@/stores/auth'
import type { Task, Project } from '@/types/tasks'
import type { ScheduledNotification } from '@/types/recurrence'
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

// App Types are defined locally or imported for convenience
export interface TimerSettings {
    workDuration: number
    shortBreakDuration: number
    longBreakDuration: number
    autoStartBreaks: boolean
    autoStartPomodoros: boolean
    playNotificationSounds: boolean
}

export function useSupabaseDatabase() {
    const authStore = useAuthStore()
    const isSyncing = ref(false)
    const lastSyncError = ref<string | null>(null)

    // -- Helpers --

    const getUserId = () => {
        if (!authStore.user?.id) {
            throw new Error('User not authenticated')
        }
        return authStore.user.id
    }

    const getUserIdSafe = (): string | null => {
        return authStore.user?.id || null
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
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .order('created_at', { ascending: true })

            if (error) throw error
            if (!data) return []

            return (data as SupabaseProject[]).map(fromSupabaseProject)
        } catch (e: unknown) {
            handleError(e, 'fetchProjects')
            return []
        }
    }

    const saveProject = async (project: Project): Promise<void> => {
        try {
            isSyncing.value = true
            const userId = getUserId()
            const payload = toSupabaseProject(project, userId)
            const { error } = await supabase.from('projects').upsert(payload)
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
        try {
            isSyncing.value = true
            const userId = getUserId()
            const payload = projects.map(p => toSupabaseProject(p, userId))
            const { error } = await supabase.from('projects').upsert(payload)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveProjects')
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
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('is_deleted', false)

            if (error) throw error
            if (!data) return []

            return (data as SupabaseTask[]).map(fromSupabaseTask)
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
        try {
            isSyncing.value = true
            const userId = getUserId()
            const payload = toSupabaseTask(task, userId)
            const { error } = await supabase.from('tasks').upsert(payload)
            if (error) throw error
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
        try {
            isSyncing.value = true
            const userId = getUserId()
            const payload = tasks.map(t => toSupabaseTask(t, userId))
            const { error } = await supabase.from('tasks').upsert(payload)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            handleError(e, 'saveTasks')
            throw e
        } finally {
            isSyncing.value = false
        }
    }

    const deleteTask = async (taskId: string): Promise<void> => {
        console.log(`🗑️ [SUPABASE-DELETE] Starting soft-delete for task: ${taskId}`)
        try {
            isSyncing.value = true
            // Ensure user is authenticated, will throw if not
            getUserId()

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

    // -- Groups --

    const fetchGroups = async (): Promise<any[]> => {
        try {
            const { data, error } = await supabase
                .from('groups')
                .select('*')
                .eq('is_deleted', false)

            if (error) throw error
            if (!data) return []

            return (data as SupabaseGroup[]).map(fromSupabaseGroup)
        } catch (e: unknown) {
            handleError(e, 'fetchGroups')
            return []
        }
    }

    const saveGroup = async (group: any): Promise<void> => {
        try {
            isSyncing.value = true
            const userId = getUserId()
            const payload = toSupabaseGroup(group, userId)
            const { error } = await supabase.from('groups').upsert(payload)
            if (error) throw error
            lastSyncError.value = null
        } catch (e: unknown) {
            console.error('Save Group Error:', e)
        } finally {
            isSyncing.value = false
        }
    }

    const deleteGroup = async (groupId: string): Promise<void> => {
        try {
            isSyncing.value = true
            const { error } = await supabase
                .from('groups')
                .update({ is_deleted: true })
                .eq('id', groupId)
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'deleteGroup')
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
        try {
            const userId = getUserId()
            const payload = toSupabaseNotification(notification, userId)
            const { error } = await supabase.from('notifications').upsert(payload)
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'saveNotification')
        }
    }

    const saveNotifications = async (notifications: ScheduledNotification[]): Promise<void> => {
        if (notifications.length === 0) return
        try {
            const userId = getUserId()
            const payload = notifications.map(n => toSupabaseNotification(n, userId))
            const { error } = await supabase.from('notifications').upsert(payload)
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

    const fetchActiveTimerSession = async (): Promise<any | null> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return null

            const { data, error } = await supabase
                .from('timer_sessions')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) throw error
            if (!data) return null

            return fromSupabaseTimerSession(data as SupabaseTimerSession)
        } catch (e: unknown) {
            handleError(e, 'fetchActiveTimerSession')
            return null
        }
    }

    const saveActiveTimerSession = async (session: any, deviceId: string): Promise<void> => {
        try {
            const userId = getUserIdSafe()
            if (!userId) return // Skip Supabase sync when not authenticated (local-only mode)

            const payload = toSupabaseTimerSession(session, userId, deviceId)
            const { error } = await supabase.from('timer_sessions').upsert(payload)
            if (error) throw error
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

    const fetchUserSettings = async (): Promise<any | null> => {
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

    const saveUserSettings = async (settings: any): Promise<void> => {
        try {
            const userId = getUserId()
            const payload = toSupabaseUserSettings(settings, userId)
            // Fix: Explicitly specify conflict target to handle 'user_settings_user_id_key' violation
            const { error } = await supabase.from('user_settings').upsert(payload, { onConflict: 'user_id' })
            if (error) throw error
        } catch (e: unknown) {
            handleError(e, 'saveUserSettings')
        }
    }

    // -- Quick Sort Sessions --

    const fetchQuickSortHistory = async (): Promise<any[]> => {
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

    const saveQuickSortSession = async (summary: any): Promise<void> => {
        try {
            const userId = getUserId()
            const payload = toSupabaseQuickSortSession(summary, userId)
            const { error } = await supabase.from('quick_sort_sessions').upsert(payload)
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
        if (!authStore.user?.id) return null

        const channel = supabase.channel('db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'projects' },
                (payload: unknown) => onProjectChange(payload)
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tasks' },
                (payload: unknown) => onTaskChange(payload)
            )

        if (onTimerChange) {
            channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'timer_sessions' },
                (payload: unknown) => onTimerChange(payload)
            )
        }

        if (onNotificationChange) {
            channel.on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications' },
                (payload: unknown) => onNotificationChange(payload)
            )
        }

        channel.subscribe()
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
        restoreTask,
        permanentlyDeleteTask,
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
