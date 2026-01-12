import type { Task } from '@/types/tasks'
// TASK-129: Removed transactionManager (PouchDB WAL stub no longer needed)
import { getLogger } from '@/utils/productionLogger'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'

export class TrashService {
    private logger = getLogger()
    private db = useSupabaseDatabase()

    constructor() {
    }

    /**
     * Get all tasks currently in the trash (soft deleted)
     */
    public async getTrash(): Promise<Task[]> {
        try {
            return await this.db.fetchTrash()
        } catch (error) {
            console.error('❌ [TRASH] Failed to load trash:', error)
            return []
        }
    }

    /**
     * Restore a task from trash
     */
    public async restoreTask(taskId: string): Promise<void> {
        try {
            await this.db.restoreTask(taskId)
            console.log(`♻️ [TRASH] Restored task ${taskId}`)

            // Trigger store reload or event
            window.dispatchEvent(new CustomEvent('pomoflow-task-restored', { detail: { taskId } }))

        } catch (error) {
            console.error(`❌ [TRASH] Failed to restore task ${taskId}:`, error)
            throw error
        }
    }

    /**
     * Permanently delete a task (Empty Trash)
     */
    public async permanentlyDeleteTask(taskId: string): Promise<void> {
        try {
            await this.db.permanentlyDeleteTask(taskId)
            console.log(`🔥 [TRASH] Task ${taskId} permanently deleted from Supabase`)
        } catch (error) {
            console.error(`❌ [TRASH] Failed to permanently delete task ${taskId}:`, error)
            throw error
        }
    }
}

export const trashService = new TrashService()
