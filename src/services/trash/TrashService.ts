import { getTaskDocId } from '@/utils/individualTaskStorage'
import type { Task } from '@/types/tasks'
import { transactionManager } from '@/services/sync/TransactionManager'
import PowerSyncService from '@/services/database/PowerSyncDatabase'
import { fromSqlTask } from '@/utils/taskMapper'
import type { SqlTask } from '@/services/database/SqlDatabaseTypes'
import { getLogger } from '@/utils/productionLogger'

export class TrashService {
    private logger = getLogger()

    constructor() {
    }

    /**
     * Get all tasks currently in the trash (soft deleted)
     */
    public async getTrash(): Promise<Task[]> {
        try {
            const db = await PowerSyncService.getInstance()
            const result = await db.getAll<SqlTask>('SELECT * FROM tasks WHERE is_deleted = 1 ORDER BY deleted_at DESC')

            return result.map(row => fromSqlTask(row))
        } catch (error) {
            console.error('❌ [TRASH] Failed to load trash:', error)
            return []
        }
    }

    /**
     * Restore a task from trash
     */
    public async restoreTask(taskId: string): Promise<void> {
        // Use WAL for safety
        const txId = await transactionManager.beginTransaction('update', 'tasks', { taskId, action: 'restore' })

        try {
            const db = await PowerSyncService.getInstance()
            await db.execute('UPDATE tasks SET is_deleted = 0, deleted_at = NULL WHERE id = ?', [taskId])

            await transactionManager.commit(txId)
            console.log(`♻️ [TRASH] Restored task ${taskId}`)

            // Trigger store reload or event? 
            // For now, user will likely need to refresh or we assume store re-fetches.
            // Ideally we dispatch an event.
            window.dispatchEvent(new CustomEvent('pomoflow-task-restored', { detail: { taskId } }))

        } catch (error) {
            await transactionManager.rollback(txId, error)
            console.error(`❌ [TRASH] Failed to restore task ${taskId}:`, error)
            throw error
        }
    }

    /**
     * Permanently delete a task (Empty Trash)
     */
    public async permanentlyDeleteTask(taskId: string): Promise<void> {
        // WAL for hard delete
        const txId = await transactionManager.beginTransaction('delete', 'tasks', { taskId, type: 'hard_delete' })

        try {
            const sqlite = await PowerSyncService.getInstance()
            await sqlite.execute('DELETE FROM tasks WHERE id = ?', [taskId])

            await transactionManager.commit(txId)
            console.log(`🔥 [TRASH] Task ${taskId} permanently deleted from SQLite`)
        } catch (error) {
            await transactionManager.rollback(txId, error)
            console.error(`❌ [TRASH] Failed to permanently delete task ${taskId}:`, error)
            throw error
        }
    }
}

export const trashService = new TrashService()
