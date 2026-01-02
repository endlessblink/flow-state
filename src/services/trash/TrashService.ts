import PouchDB from 'pouchdb-browser'
import { getLogger } from '@/utils/productionLogger'
import { TASK_DOC_PREFIX, getTaskDocId } from '@/utils/individualTaskStorage'
import type { Task } from '@/types/tasks'
import { transactionManager } from '@/services/sync/TransactionManager'

export class TrashService {
    private db: PouchDB.Database | null = null
    private logger = getLogger()

    constructor() {
        // We defer DB initialization or get it from window/service
    }

    private getDB(): PouchDB.Database {
        // Helper to get global DB instance
        // Ideally should be injected, but following current pattern
        const db = (window as any).pomoFlowDb
        if (!db) {
            throw new Error('Database not initialized')
        }
        return db
    }

    /**
     * Get all tasks currently in the trash (soft deleted)
     */
    public async getTrash(): Promise<Task[]> {
        const db = this.getDB()
        try {
            const result = await db.allDocs({
                include_docs: true,
                startkey: TASK_DOC_PREFIX,
                endkey: `${TASK_DOC_PREFIX}\ufff0`
            })

            const trash: Task[] = []

            for (const row of result.rows) {
                if (row.doc) {
                    const data = (row.doc as any).data || {}
                    // check internal flag
                    if (data._soft_deleted) {
                        trash.push({
                            ...data,
                            id: data.id || row.id.replace(TASK_DOC_PREFIX, '')
                        } as Task)
                    }
                }
            }

            return trash.sort((a, b) => {
                const dateA = new Date(a.deletedAt || 0).getTime()
                const dateB = new Date(b.deletedAt || 0).getTime()
                return dateB - dateA
            })
        } catch (error) {
            console.error('❌ [TRASH] Failed to load trash:', error)
            this.logger.error('database', 'Failed to load trash', { error })
            return []
        }
    }

    /**
     * Restore a task from trash
     */
    public async restoreTask(taskId: string): Promise<void> {
        const db = this.getDB()
        const docId = getTaskDocId(taskId)

        // Use WAL for safety
        const txId = await transactionManager.beginTransaction('update', 'tasks', { taskId, action: 'restore' })

        try {
            const doc = await db.get(docId)
            const data = (doc as any).data || {}

            if (!data._soft_deleted) {
                console.warn(`⚠️ [TRASH] Task ${taskId} is not in trash`)
                await transactionManager.commit(txId)
                return
            }

            delete data._soft_deleted
            delete data.deletedAt

            await db.put({
                ...doc,
                data
            })

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
        const db = this.getDB()
        const docId = getTaskDocId(taskId)

        // WAL for hard delete
        const txId = await transactionManager.beginTransaction('delete', 'tasks', { taskId, type: 'hard_delete' })

        try {
            const doc = await db.get(docId)
            await db.remove(doc)

            await transactionManager.commit(txId)
            console.log(`🔥 [TRASH] Permanently deleted task ${taskId}`)
        } catch (error) {
            await transactionManager.rollback(txId, error)
            console.error(`❌ [TRASH] Failed to permanently delete ${taskId}:`, error)
            throw error
        }
    }
}

export const trashService = new TrashService()
