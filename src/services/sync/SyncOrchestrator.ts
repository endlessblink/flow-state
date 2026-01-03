
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
    private liveSyncHandle: { cancel: () => void } | null = null

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
        syncValidator: any,
        localDB: PouchDB.Database // INJECTED DATABASE
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
            // INJECTION: Set the local DB directly
            this.localDB = deps.localDB
            this.dbService.setLocalDatabase(this.localDB)

                // Expose for debugging
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
            console.debug('✅ Sync Orchestrator Initialized (DI Mode)')

            // Start Live Sync if remote is available
            if (this.remoteDB) {
                this.startLiveSync()
            }
        } catch (error) {
            console.error('❌ Sync Orchestrator Initialization Failed:', error)
            throw error
        } finally {
            this.isInitializing = false
        }
    }

    public async cleanup() {
        console.debug('🧹 Cleaning up Sync Orchestrator listeners')
        this.stopLiveSync()
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
    private liveSyncPausedForManual = false

    private async performReliableSync() {
        // Prevent re-entry if already working
        if (this.isSyncingProgress) {
            console.log('⏳ [SyncOrchestrator] Sync already in progress, skipping')
            return
        }
        this.isSyncingProgress = true

        // QUICK FIX: Pause live sync during manual sync to prevent conflicts
        const wasLiveSyncActive = this.liveSyncHandle !== null
        if (wasLiveSyncActive) {
            console.log('⏸️ [SyncOrchestrator] Pausing live sync for manual operation')
            this.stopLiveSync()
            this.liveSyncPausedForManual = true
        }

        this.state.updateStatus('syncing')

        // Create cancellation controller for this sync attempt
        const controller = new AbortController()

        // QUICK FIX: Increased to 120 seconds to allow for deep conflict pruning on initial sync
        let timeoutId: ReturnType<typeof setTimeout>
        const SYNC_TIMEOUT_MS = 120000 // 120 seconds max
        const masterTimeout = new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
                // FORCE KILL: Abort the underlying operations
                controller.abort(`Sync Orchestrator Master Timeout (${SYNC_TIMEOUT_MS / 1000}s)`)
                reject(new Error(`Sync Orchestrator Master Timeout (${SYNC_TIMEOUT_MS / 1000}s) - Force Reset`))
            }, SYNC_TIMEOUT_MS)
        })

        try {
            await Promise.race([
                this.retrier.executeWithRetry(async () => {
                    // Check signal before starting loop
                    if (controller.signal.aborted) throw new Error('Sync aborted')

                    // Ensure connections
                    if (!this.localDB || (this.localDB as any)._closed) {
                        console.warn('⚠️ [SyncOrchestrator] Local DB missing or closed, refreshing from singleton...')
                        this.localDB = (window as any).pomoFlowDb
                        if (this.localDB) {
                            this.dbService.setLocalDatabase(this.localDB)
                        } else {
                            throw new Error('Local DB missing in SyncOrchestrator. Initialization error?')
                        }
                    }
                    if (!this.remoteDB) {
                        this.remoteDB = await this.dbService.initializeRemote()
                        if (!this.remoteDB) throw new Error('Remote DB unavailable')
                    }

                    // QUICK FIX: Detect and AUTO-RESOLVE conflicts before sync
                    const conflicts = await this.conflictDetector.detectAllConflicts()
                    if (conflicts.length > 0) {
                        console.log(`⚔️ [SYNC] Found ${conflicts.length} conflicts - auto-resolving...`)
                        this.state.conflicts.value = conflicts

                        // Auto-resolve each conflict using LWW or smart merge
                        let resolved = 0
                        let failed = 0
                        const allLosingRevs: any[] = []

                        for (const conflict of conflicts) {
                            try {
                                // Skip manual-only conflicts
                                if (conflict.severity === 'high' && !conflict.autoResolvable) {
                                    console.log(`⏭️ [SYNC] Skipping high-severity conflict: ${conflict.documentId}`)
                                    continue
                                }

                                const result = await this.conflictResolver.resolveConflict(conflict)
                                if (result && result.resolvedDocument && this.localDB) {
                                    const resolvedDoc = result.resolvedDocument as Record<string, any>
                                    const docId = resolvedDoc._id || conflict.documentId

                                    // 1. Get ALL current revisions for this document to ensure clean pruning
                                    const currentDoc = await this.localDB.get(docId, { conflicts: true }) as any
                                    const losingRevs = currentDoc._conflicts || []

                                    // 2. Prepare the winner (Last Write Wins / Merged)
                                    const docToSave = {
                                        ...resolvedDoc,
                                        _id: docId,
                                        _rev: currentDoc._rev
                                    }

                                    // 3. Save the winner
                                    await this.localDB.put(docToSave as PouchDB.Core.PutDocument<any>)
                                    resolved++

                                    // 4. Collect losing revisions for bulk pruning
                                    if (losingRevs.length > 0) {
                                        losingRevs.forEach((rev: string) => {
                                            allLosingRevs.push({ _id: docId, _rev: rev, _deleted: true })
                                        })
                                    }
                                }
                            } catch (resolveErr) {
                                console.warn(`⚠️ [SYNC] Failed to resolve conflict ${conflict.documentId}:`, resolveErr)
                                failed++
                            }
                        }

                        // 5. BULK PRUNE LOSING REVISIONS (Optimization)
                        if (allLosingRevs.length > 0) {
                            console.log(`🧹 [SYNC] Bulk pruning ${allLosingRevs.length} losing branches...`)
                            try {
                                await this.localDB.bulkDocs(allLosingRevs)
                            } catch (bulkPruneErr) {
                                console.warn('⚠️ [SYNC] Bulk pruning encountered errors (some revisions may remain):', bulkPruneErr)
                            }
                        }

                        console.log(`✅ [SYNC] Conflict resolution: ${resolved} resolved, ${failed} failed`)

                        // Update state with remaining unresolved conflicts
                        this.state.conflicts.value = conflicts.filter(c =>
                            c.severity === 'high' && !c.autoResolvable
                        )
                    }

                    // Pass signal to operation service
                    const result = await this.operationService.performSync(
                        this.localDB,
                        this.remoteDB,
                        { signal: controller.signal }
                    )

                    if (!result.success) throw new Error(result.error)

                    if (result.pulled > 0) {
                        await this.notifyDataPulled()
                    }

                    this.state.updateLastSync(new Date())
                    this.state.markConnected()
                    this.state.recordMetric('success')

                }, 'performReliableSync'),
                masterTimeout
            ])

            clearTimeout(timeoutId!)

            this.state.updateStatus('complete')
            setTimeout(() => this.state.updateStatus('idle'), 2000)

        } catch (e) {
            clearTimeout(timeoutId!)
            // Ensure we abort if we exited via error (redundant safety)
            if (!controller.signal.aborted) controller.abort('Sync failed with error')

            const errorMsg = e instanceof Error ? e.message : 'Sync failed'
            console.error('❌ [SyncOrchestrator] Sync failed or timed out:', errorMsg)

            this.state.recordMetric('failure')
            this.state.setError(errorMsg)
            this.state.updateStatus('error')
            // Don't throw, just handle the error state so UI updates
        } finally {
            this.isSyncingProgress = false

            // QUICK FIX: Resume live sync if it was paused for manual operation
            if (this.liveSyncPausedForManual && this.remoteDB) {
                console.log('▶️ [SyncOrchestrator] Resuming live sync after manual operation')
                this.startLiveSync()
                this.liveSyncPausedForManual = false
            }
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
        return this.liveSyncHandle !== null
    }

    public async startLiveSync(): Promise<boolean> {
        if (!this.localDB || !this.remoteDB) return false
        if (this.liveSyncHandle) return true

        this.liveSyncHandle = this.operationService.startLiveSync(
            this.localDB,
            this.remoteDB
        )
        return true
    }

    public async stopLiveSync(): Promise<boolean> {
        if (this.liveSyncHandle) {
            this.liveSyncHandle.cancel()
            this.liveSyncHandle = null
        }
        return true
    }

    public async nuclearReset(): Promise<void> {
        if (!this.operationService) {
            console.error('❌ [SYNC] Operation service not initialized for nuclear reset')
            return
        }
        await this.operationService.nuclearReset()
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

    /**
     * EMERGENCY TOOLS (Phase 17)
     * Exposed for manual console usage to resolve split-brain scenarios
     */
    public async manualBackfill() {
        console.log('🚨 [MANUAL] Starting forced backfill (Local -> Remote)...')
        if (!this.localDB || !this.remoteDB) {
            console.error('❌ DBs not initialized')
            return
        }

        try {
            const info = await this.localDB.info()
            console.log(`📊 Local Docs: ${info.doc_count}`)

            await this.localDB.replicate.to(this.remoteDB, {
                batch_size: 100,
                batches_limit: 10
            })
            console.log('✅ [MANUAL] Backfill complete!')
        } catch (err) {
            console.error('❌ Backfill failed:', err)
        }
    }

    public async forcePull() {
        console.log('🚨 [MANUAL] Starting forced pull (Remote -> Local)...')
        if (!this.localDB || !this.remoteDB) {
            console.error('❌ DBs not initialized')
            return
        }

        try {
            await this.remoteDB.replicate.to(this.localDB, {
                batch_size: 100,
                batches_limit: 10
            })
            console.log('✅ [MANUAL] Force pull complete!')
            window.location.reload()
        } catch (err) {
            console.error('❌ Force pull failed:', err)
        }
    }
}

// Singleton
export const syncOrchestrator = new SyncOrchestrator()

// Expose to window for console access
if (typeof window !== 'undefined') {
    (window as any).pomoSync = syncOrchestrator
}
