import PouchDB from 'pouchdb-browser'
import { getLogger } from '@/utils/productionLogger'

export interface WALEntry {
    _id: string
    operation: 'create' | 'update' | 'delete' | 'bulk_update'
    collection: string // e.g., 'tasks', 'projects'
    data: any
    timestamp: number
    status: 'pending' | 'committed' | 'failed'
    error?: string
}

export class TransactionManager {
    private walDB: PouchDB.Database<WALEntry>
    private logger = getLogger()
    private initialized = false

    constructor(dbName = 'pomoflow_wal') {
        this.walDB = new PouchDB(dbName)
    }

    public async initialize(): Promise<void> {
        if (this.initialized) return

        try {
            const info = await this.walDB.info()
            console.log(`📝 [WAL] Initialized Write-Ahead Log (${info.doc_count} docs)`)
            this.initialized = true

            // Auto-replay on startup
            await this.replayPendingTransactions()
        } catch (err) {
            console.error('❌ [WAL] Failed to initialize:', err)
            this.logger.error('wal', 'Initialization failed', { error: err })
        }
    }

    /**
     * Log an operation before executing it
     * Returns transaction ID
     */
    public async beginTransaction(
        operation: WALEntry['operation'],
        collection: string,
        data: any
    ): Promise<string> {
        const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const entry: WALEntry = {
            _id: txId,
            operation,
            collection,
            data,
            timestamp: Date.now(),
            status: 'pending'
        }

        try {
            await this.walDB.put(entry)
            return txId
        } catch (err) {
            console.error('❌ [WAL] Failed to log transaction:', err)
            // If we can't log, we should strictly fail to prevent data consistency issues?
            // Or proceed with warning? Proceeding risks data loss if crash happens.
            // Better to throw.
            throw new Error(`WAL Write Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
    }

    /**
     * Mark transaction as committed (success) and remove from log
     */
    public async commit(txId: string): Promise<void> {
        try {
            // We explicitly fetch to get latest rev, just in case
            const doc = await this.walDB.get(txId)
            await this.walDB.remove(doc)
            // console.log(`✅ [WAL] Committed tx: ${txId}`)
        } catch (err) {
            console.error(`⚠️ [WAL] Failed to commit (remove) tx ${txId}:`, err)
            // This is non-fatal but implies the log will grow or re-play.
            // We should try to update status to 'committed' if remove fails? 
            // Actually standard Pouch remove is safe enough.
        }
    }

    /**
     * Mark transaction as failed (optional, usually we just don't commit)
     */
    public async rollback(txId: string, error?: any): Promise<void> {
        try {
            const doc = await this.walDB.get(txId)
            doc.status = 'failed'
            doc.error = error instanceof Error ? error.message : String(error)
            await this.walDB.put(doc)
            console.warn(`↩️ [WAL] Rolled back tx: ${txId}`)
        } catch (err) {
            console.error(`⚠️ [WAL] Failed to rollback tx ${txId}:`, err)
        }
    }

    /**
     * Replay any pending transactions found on startup
     * This is the Crash Recovery mechanism
     */
    public async replayPendingTransactions(): Promise<void> {
        try {
            const result = await this.walDB.allDocs({ include_docs: true })
            const pending = result.rows
                .map(row => row.doc as WALEntry)
                .filter(doc => doc.status === 'pending')
                .sort((a, b) => a.timestamp - b.timestamp) // Process in order

            if (pending.length === 0) return

            console.warn(`🔄 [WAL] Found ${pending.length} pending transactions from previous session (CRASH RECOVERY)`)

            for (const tx of pending) {
                console.log(`🔄 [WAL] Replaying ${tx.operation} on ${tx.collection}`, tx._id)

                // Emitting event so stores can listen and re-execute
                // Why event? Because TransactionManager doesn't know about TaskStore/CanvasStore.
                // Stores should subscribe to 'wal-replay' or we inject handler.
                window.dispatchEvent(new CustomEvent('pomoflow-wal-replay', { detail: tx }))

                // We assume the store handles it and calls commit(tx._id) if successful.
                // But if we're just emitting, we can't await correctness easily unless we use a callback registry.
                // For simplicity in Phase 14 part 1, we'll just log availability.
                // TODO: Wire up actual replay logic in Store.
            }
        } catch (err) {
            console.error('❌ [WAL] Failed to replay transactions:', err)
        }
    }

    /**
     * Clean up old failed/committed logs
     */
    public async pruneLog(): Promise<void> {
        // TODO: Implement cleaner
    }
}

// Singleton instance
export const transactionManager = new TransactionManager()
