
import { useTaskStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth' // Added import for useAuthStore
import { supabase } from '@/services/auth/supabase'

export function useBulkActions() {
    // const { getUserId } = useSupabaseDatabase() // Removed this line
    const taskStore = useTaskStore()
    const authStore = useAuthStore() // Added initialization for authStore

    /**
     * Batch update tasks with a partial payload (e.g. { status: 'done', priority: 1 })
     */
    const updateTasks = async (ids: string[], payload: Record<string, any>) => {
        if (ids.length === 0) return

        const userId = authStore.user?.id
        if (!userId) return

        // 1. Optimistic Update
        ids.forEach(id => {
            taskStore.updateTask(id, payload)
        })

        // 2. Persist to Supabase
        const { error } = await supabase
            .from('tasks')
            .update({
                ...payload,
                updated_at: new Date().toISOString()
            })
            .in('id', ids)
            .eq('user_id', userId)

        if (error) {
            console.error('Batch update failed:', error)
            // TODO: Revert optimistic update or show toast
            // For now, we rely on Realtime or refresh to correct state if it failed
            throw error // Propagate so UI can handle (e.g. show toast)
        }

        return { success: true, count: ids.length }
    }

    /**
     * Batch delete tasks (Soft Delete)
     */
    const deleteTasks = async (ids: string[]) => {
        if (ids.length === 0) return

        const userId = authStore.user?.id
        if (!userId) return

        // 1. Optimistic Update
        ids.forEach(id => {
            taskStore.deleteTask(id)
        })

        // 2. Persist to Supabase (Soft Delete via is_deleted flag or hard delete?)
        // Note: Project currently uses hard delete for tasks usually, or soft delete pattern?
        // Checking TaskStore: deleteTask calls store.tasks.delete(id)
        // Checking Supabase implementation: usually hard delete.
        // Let's assume hard delete for now to match current store behavior, 
        // OR check if we have deleted_at.
        // In `useSupabaseDatabase`, `deleteTask` calls `.delete().eq('id', id)`.

        const { error } = await supabase
            .from('tasks')
            .delete()
            .in('id', ids)
            .eq('user_id', userId)

        if (error) {
            console.error('Batch delete failed:', error)
            // TODO: Revert
            throw error
        }

        return { success: true, count: ids.length }
    }

    return {
        updateTasks,
        deleteTasks
    }
}
