import type { Ref } from 'vue'

export class DatabaseMaintenanceService {
    private isRunning = false
    private db: any // PouchDB instance

    constructor(dbInstance: any) {
        this.db = dbInstance
    }

    /**
     * Compact the database to remove old revision history.
     * This reduces disk space and improves performance.
     * Safe to run regularly.
     */
    async compact(): Promise<{ ok: boolean; error?: any }> {
        if (this.isRunning) return { ok: false, error: 'Maintenance already in progress' }
        this.isRunning = true

        console.log('🧹 [Maintenance] Starting database compaction...')
        try {
            if (!this.db) throw new Error('Database not initialized')

            const result = await this.db.compact()
            console.log('✅ [Maintenance] Compaction complete:', result)
            return { ok: true }
        } catch (error) {
            console.error('❌ [Maintenance] Compaction failed:', error)
            return { ok: false, error }
        } finally {
            this.isRunning = false
        }
    }

    /**
     * Check detailed stats to see if maintenance is needed
     */
    async checkStorageStats(): Promise<{ doc_count: number; update_seq: number | string }> {
        try {
            const info = await this.db.info()
            return {
                doc_count: info.doc_count,
                update_seq: info.update_seq
            }
        } catch (e) {
            console.error('Failed to get DB stats', e)
            return { doc_count: -1, update_seq: 0 }
        }
    }

    /**
     * Schedule automated maintenance (e.g. weekly)
     * For now, simplistic implementation using localStorage to track last run
     */
    async runScheduledMaintenance() {
        const LAST_RUN_KEY = 'pomo-flow-maintenance-last-run'
        const ONE_WEEK = 7 * 24 * 60 * 60 * 1000

        const lastRunStr = localStorage.getItem(LAST_RUN_KEY)
        const lastRun = lastRunStr ? parseInt(lastRunStr) : 0
        const now = Date.now()

        if (now - lastRun > ONE_WEEK) {
            console.log('⏰ [Maintenance] Weekly maintenance triggered')
            const result = await this.compact()
            if (result.ok) {
                localStorage.setItem(LAST_RUN_KEY, now.toString())
            }
        } else {
            console.log('💤 [Maintenance] Maintenance not due yet')
        }
    }
}

// Singleton-like accessor (factory)
let instance: DatabaseMaintenanceService | null = null

export const getMaintenanceService = (dbInstance?: any) => {
    if (dbInstance && !instance) {
        instance = new DatabaseMaintenanceService(dbInstance)
    }
    return instance
}
