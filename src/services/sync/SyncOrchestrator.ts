
import PouchDB from 'pouchdb-browser'
import { ref, type Ref } from 'vue'
import { syncState, SyncStateService } from './SyncStateService'
import { networkMonitor, NetworkMonitorService } from './NetworkMonitorService'
import { syncRetryService, SyncRetryService } from './SyncRetryService'
import { DatabaseService } from './DatabaseService'
import { SyncOperationService } from './SyncOperationService'
import { ConflictDetector } from '@/utils/conflictDetector'
import { ConflictResolver } from '@/utils/conflictResolver'
import { OfflineQueue } from '@/utils/offlineQueue'
import { getNetworkOptimizer } from '@/utils/networkOptimizer'
import { getTimezoneManager } from '@/utils/timezoneCompatibility'
import type { QueueStats } from '@/utils/offlineQueue'

export class SyncOrchestrator {
    private localDB: PouchDB.Database | null = null
    private remoteDB: PouchDB.Database | null = null

    private state: SyncStateService
    private network: NetworkMonitorService
    private retrier: SyncRetryService
    private dbService: DatabaseService
    private operationService!: SyncOperationService
    private conflictDetector: ConflictDetector
    private conflictResolver: ConflictResolver
    private offlineQueue: OfflineQueue

    // Events
    private dataPulledCallbacks: Array<() => Promise<void> | void> = []

    // Throttle state
    private lastManualSyncTime = 0
    private readonly MANUAL_SYNC_COOLDOWN = 5000

    constructor() {
        this.state = syncState
        this.network = networkMonitor
        this.retrier = syncRetryService
        this.dbService = new DatabaseService()

        // Initialize Utils
        this.conflictDetector = new ConflictDetector()
        this.conflictResolver = new ConflictResolver(this.conflictDetector.getDeviceId())
        this.offlineQueue = new OfflineQueue()

        // Operation service will be initialized in initialize() when dependencies are available
    }

    private isInitialized = false
    private isInitializing = false

    public async initialize(deps: {
        backupSystem: any,
        logger: any,
        syncValidator: any
    }) {
        if (this.isInitialized || this.isInitializing) return

        this.isInitializing = true

        // console.log('🚀 [SyncOrchestrator] Initializing...')

        this.operationService = new SyncOperationService(
            this.conflictDetector,
            deps.syncValidator,
            deps.backupSystem,
            deps.logger
        )

        try {
            this.localDB = this.dbService.initializeLocal()
                ; (window as any).pomoFlowDb = this.localDB

            this.remoteDB = await this.dbService.initializeRemote()

            if (!this.remoteDB) {
                this.state.updateStatus('offline')
                this.isInitialized = true
                return
            }

            // Init Conflicts
            if (this.localDB) {
                await this.conflictDetector.initialize(this.localDB, this.remoteDB)
            }

            // Setup Network Listeners
            this.network.setupListeners(
                () => this.handleOnline(),
                () => this.handleOffline()
            )

            this.isInitialized = true

            this.state.updateStatus('idle')
            console.debug('✅ Sync Orchestrator Initialized')
        } catch (error) {
            console.error('❌ Sync Orchestrator Initialization Failed:', error)
            throw error
        } finally {
            this.isInitializing = false
        }
    }

    public async cleanup() {
        console.debug('🧹 Cleaning up Sync Orchestrator listeners')
        this.network.cleanup()
        this.localDB = null
        this.remoteDB = null
        this.isInitialized = false
    }

    private async handleOnline() {
        console.debug('🌐 [SyncOrchestrator] Online detected')
        this.state.updateStatus('idle') // Clear offline status
        await this.performReliableSync()
    }

    private handleOffline() {
        console.debug('🔌 [SyncOrchestrator] Offline detected')
        this.state.updateStatus('offline')
    }

    public async triggerSync() {
        const now = Date.now()
        if (now - this.lastManualSyncTime < this.MANUAL_SYNC_COOLDOWN) {
            // console.log('⏳ [SyncOrchestrator] Msg throttled')
            return
        }
        this.lastManualSyncTime = now

        if (!this.network.getStatus().value) {
            // console.warn('⚠️ [SyncOrchestrator] Cannot sync: Offline')
            return
        }

        try {
            await this.performReliableSync()
        } catch (e) {
            console.error('❌ [SyncOrchestrator] Manual sync failed', e)
        }
    }

    private isSyncingProgress = false

    private async performReliableSync() {
        // Prevent re-entry if already working
        if (this.isSyncingProgress) return
        this.isSyncingProgress = true

        this.state.updateStatus('syncing')

        try {
            await this.retrier.executeWithRetry(async () => {
                // Ensure connections
                if (!this.localDB) {
                    this.localDB = this.dbService.initializeLocal()
                }
                if (!this.remoteDB) {
                    this.remoteDB = await this.dbService.initializeRemote()
                    if (!this.remoteDB) throw new Error('Remote DB unavailable')
                }

                // Conflicts
                const conflicts = await this.conflictDetector.detectAllConflicts()
                if (conflicts.length > 0) {
                    this.state.conflicts.value = conflicts
                    // Auto-resolve logic would go here
                }

                const result = await this.operationService.performSync(this.localDB, this.remoteDB)

                if (!result.success) throw new Error(result.error)

                if (result.pulled > 0) {
                    await this.notifyDataPulled()
                }

                this.state.updateLastSync(new Date())
                this.state.markConnected()
                this.state.recordMetric('success')

            }, 'performReliableSync')

            this.state.updateStatus('complete')
            setTimeout(() => this.state.updateStatus('idle'), 2000)

        } catch (e) {
            this.state.recordMetric('failure')
            this.state.setError('Sync failed')
            this.state.updateStatus('error')
            throw e
        } finally {
            this.isSyncingProgress = false
        }
    }

    public getSyncState() {
        return this.state
    }

    public registerDataPulledCallback(callback: () => Promise<void> | void): () => void {
        this.dataPulledCallbacks.push(callback)
        return () => {
            const index = this.dataPulledCallbacks.indexOf(callback)
            if (index > -1) this.dataPulledCallbacks.splice(index, 1)
        }
    }

    private async notifyDataPulled() {
        for (const callback of this.dataPulledCallbacks) {
            try { await callback() } catch (e) { console.error(e) }
        }
    }

    public async waitForInitialSync(timeoutMs = 10000): Promise<boolean> {
        // Simple check if we ever connected or synced
        if (this.state.hasConnectedEver.value || this.state.lastSyncTime.value) return true

        // Wait loop similar to original
        const start = Date.now()
        while (!this.state.lastSyncTime.value && Date.now() - start < timeoutMs) {
            await new Promise(r => setTimeout(r, 100))
        }
        return !!this.state.lastSyncTime.value
    }

    // Conflict Resolution Proxies
    public async resolveConflict(conflictId: string, resolution: any) {
        if (!this.localDB) throw new Error('Local DB not ready')
        console.log('Resolving conflict via orchestrator', conflictId)
        // Pending
    }

    public async retryResolveConflict(conflictId: string) {
        console.log('Retrying conflict via orchestrator', conflictId)
    }

    public async ignoreConflict(conflictId: string) {
        console.log('Ignoring conflict via orchestrator', conflictId)
        this.state.conflicts.value = this.state.conflicts.value.filter(c => c.documentId !== conflictId)
    }

    public async runHealthCheck() {
        if (!this.localDB) return
        const { integrityDoctor } = await import('@/services/doctor/IntegrityDoctorService')
        return integrityDoctor.checkAndHeal(this.localDB)
    }

    public getSyncMetrics() {
        return this.state.metrics.value
    }

    public clearSyncErrors() {
        this.state.setError(null)
    }

    public getRetryStats() {
        return this.retrier.getStats()
    }

    public getSyncHealth() {
        return this.state.getHealth()
    }

    // Compatibility Helpers for useAppInitialization
    public isLiveSyncActive(): boolean {
        return this.isInitialized && this.state.syncStatus.value !== 'offline'
    }

    public async startLiveSync(): Promise<boolean> {
        // console.log('🔄 Start Live Sync (Compatibility Dummy)')
        return true
    }

    public async stopLiveSync(): Promise<boolean> {
        // console.log('⏹️ Stop Live Sync (Compatibility Dummy)')
        return true
    }

    public async configureProvider(config: any): Promise<void> {
        // console.log('⚙️ Configure Provider (Compatibility Dummy)', config)
        // Store config in state if needed
    }

    public async enableProvider(): Promise<void> {
        // console.log('✅ Enable Provider (Compatibility Dummy)')
    }

    public async disableProvider(): Promise<void> {
        // console.log('🚫 Disable Provider (Compatibility Dummy)')
    }

    public async pauseSync() {
        console.log('⏸️ Pause Sync (Compatibility Dummy)')
        this.state.updateStatus('paused')
    }

    public async resumeSync() {
        console.log('▶️ Resume Sync (Compatibility Dummy)')
        this.state.updateStatus('idle')
    }

    public async toggleSync() {
        if (this.state.syncStatus.value === 'paused') {
            return this.resumeSync()
        } else {
            return this.pauseSync()
        }
    }

    public async throttledSync(priority: string = 'normal') {
        console.log(`🚀 Throttled Sync Requested (Priority: ${priority})`)
        return this.triggerSync()
    }

    public getOfflineQueueStats(): QueueStats {
        // Return compliant dummy stats for now
        return {
            length: 0,
            processing: false,
            isOnline: this.state.isOnline.value,
            byType: { create: 0, update: 0, delete: 0, sync: 0, merge: 0 },
            byPriority: { critical: 0, high: 0, normal: 0, low: 0 },
            byStatus: { pending: 0, processing: 0, completed: 0, failed: 0, conflict: 0 },
            oldestOperation: undefined,
            totalProcessingTime: 0,
            estimatedProcessingTime: 0,
            conflictCount: 0
        }
    }

    public getNetworkOptimizer() {
        return getNetworkOptimizer()
    }
}

// Singleton
export const syncOrchestrator = new SyncOrchestrator()
