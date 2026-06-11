import type { Task } from '@/types/tasks'
// TASK-129: Removed transactionManager (PouchDB WAL stub no longer needed)
import { getLogger } from '@/utils/productionLogger'
import { useSupabaseDatabase } from '@/composables/useSupabaseDatabase'
import { useTaskStore } from '@/stores/tasks'
import { deleteOperationsForEntity } from '@/services/offline/writeQueueDB'
import { logPermanentDeleteTrace } from '@/utils/permanentDeleteTrace'

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
            const restoredTask = await this.db.restoreTask(taskId)
            console.log(`♻️ [TRASH] Restored task ${taskId}`)

            // Re-inject task into Pinia store so it reappears without a page reload
            if (restoredTask) {
                const taskStore = useTaskStore()
                const existing = taskStore._rawTasks.findIndex((t: Task) => t.id === taskId)
                if (existing === -1) {
                    taskStore._rawTasks.push(restoredTask)
                } else {
                    // Already present (e.g. from a realtime event) — ensure is_deleted flag is cleared
                    taskStore._rawTasks[existing] = restoredTask
                }
                console.log(`✅ [TRASH] Task ${taskId} re-injected into store`)
            }

            // Cancel any pending DELETE operations in the sync queue so a
            // cross-device queued delete cannot re-soft-delete this task after restore
            const cancelledOps = await deleteOperationsForEntity('task', taskId)
            if (cancelledOps > 0) {
                console.log(`🧹 [TRASH] Cancelled ${cancelledOps} pending queue operation(s) for task ${taskId} to prevent re-deletion`)
            }

            // Keep the event for any legacy listeners
            window.dispatchEvent(new CustomEvent('flowstate-task-restored', { detail: { taskId } }))

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
            logPermanentDeleteTrace(taskId, 'trash-service.before-db-delete')
            await this.db.permanentlyDeleteTask(taskId)
            logPermanentDeleteTrace(taskId, 'trash-service.after-db-delete')
            console.log(`🔥 [TRASH] Task ${taskId} permanently deleted from Supabase`)
        } catch (error) {
            logPermanentDeleteTrace(taskId, 'trash-service.error', {
                error: error instanceof Error ? error.message : String(error),
            })
            console.error(`❌ [TRASH] Failed to permanently delete task ${taskId}:`, error)
            throw error
        }
    }
}

export const trashService = new TrashService()
