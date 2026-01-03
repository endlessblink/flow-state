import PouchDB from 'pouchdb-browser'
import { ConflictDetector } from '@/utils/conflictDetector'
import { SyncValidator } from '@/utils/syncValidator'
import type { BackupData } from '@/composables/useBackupSystem'
import { getLogger } from '@/utils/productionLogger'

// Interface for BackupSystem (subset of useBackupSystem return)
export interface IBackupSystem {
    createBackup: (type: 'auto' | 'manual' | 'emergency') => Promise<BackupData | null>
}

export interface SyncResult {
    success: boolean
    pulled: number
    pushed: number
    error?: string
}

export class SyncOperationService {
    constructor(
        private conflictDetector: ConflictDetector,
        private syncValidator: SyncValidator,
        private backupSystem: IBackupSystem,
        private logger: ReturnType<typeof getLogger>
    ) { }

    public async performSync(
        localDB: PouchDB.Database,
        remoteDB: PouchDB.Database,
        options?: { signal?: AbortSignal }
    ): Promise<SyncResult> {
        const syncOperation = this.logger.startSyncOperation('full_sync')
        const operationId = syncOperation.operationId

        try {
            // Check signal before starting
            if (options?.signal?.aborted) {
                throw new Error('Sync aborted before start')
            }

            // Step 0: Backup before sync (safety first) - SILENT
            try {
                await this.backupSystem.createBackup('auto')
            } catch (_backupErr) {
                // Silent fail - backup is optional
            }

            // Step 1: Pre-flight & Pre-sync validation
            await this.runPreFlightChecks(localDB, remoteDB)

            const validationResult = await this.syncValidator.validateDatabase(localDB)
            if (validationResult.critical) {
                throw new Error(`Critical database validation failure: ${validationResult.errors?.[0] || 'Unknown error'}`)
            }

            // Step 3: Perform sync (PULL FIRST)
            const pullResult = await this.pullFromRemote(localDB, remoteDB, options?.signal)

            // Check signal between steps
            if (options?.signal?.aborted) {
                throw new Error('Sync aborted after pull')
            }

            const pushResult = await this.pushToLocal(localDB, remoteDB, options?.signal)

            // Success
            if ('completeSyncOperation' in this.logger) {
                (this.logger as any).completeSyncOperation(operationId, true)
            }

            return {
                success: true,
                pulled: pullResult,
                pushed: pushResult
            }

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'

            // Log as info if aborted, error otherwise
            if (errorMsg.includes('aborted') || options?.signal?.aborted) {
                this.logger.info('sync', 'Sync canceled', { operationId, reason: errorMsg })
            } else {
                this.logger.error('sync', 'Reliable sync failed', {
                    operationId,
                    error: errorMsg
                })
            }

            if ('completeSyncOperation' in this.logger) {
                (this.logger as any).completeSyncOperation(operationId, false, errorMsg)
            }

            return {
                success: false,
                pulled: 0,
                pushed: 0,
                error: errorMsg
            }
        }
    }

    private async runPreFlightChecks(localDB: PouchDB.Database, remoteDB: PouchDB.Database) {
        try {
            const localDocs = await localDB.allDocs({ startkey: 'task-', endkey: 'task-\ufff0' })
            const localTaskCount = localDocs.rows.length

            const remoteDocs = await remoteDB.allDocs({ startkey: 'task-', endkey: 'task-\ufff0' })
            const remoteTaskCount = remoteDocs.rows.length

            // CRITICAL: If remote has 0 tasks but local has many, something is wrong
            if (localTaskCount > 5 && remoteTaskCount === 0) {
                console.warn(`🛡️ [SYNC PRE-FLIGHT] ABORT: Remote has 0 tasks but local has ${localTaskCount}`)
                throw new Error(`Sync aborted: Remote DB appears empty (0 tasks) but local has ${localTaskCount} tasks.`)
            }

            console.debug(`📊 [SYNC PRE-FLIGHT] Task counts - Local: ${localTaskCount}, Remote: ${remoteTaskCount}`)
        } catch (preflightError) {
            // Re-throw if it's our specific error, otherwise just warn
            if (preflightError instanceof Error && preflightError.message.includes('Sync aborted')) {
                throw preflightError
            }
            console.warn('⚠️ [SYNC PRE-FLIGHT] Check failed, continuing with sync:', preflightError)
        }
    }

    private async pullFromRemote(local: PouchDB.Database, remote: PouchDB.Database, signal?: AbortSignal): Promise<number> {
        console.log('⬇️ [SYNC] Starting Pull (Remote -> Local)...')

        // Firefox/Zen optimization
        const ua = navigator.userAgent.toLowerCase()
        const isZen = ua.includes('zen')
        const isFirefox = ua.includes('firefox') || isZen

        // Use 25 for Zen/Firefox as per debug guide, 100 for Chromium
        const batchSize = isFirefox ? 25 : 100
        const batchLimit = isFirefox ? 5 : 20

        if (isFirefox) console.log(`🦊 [SYNC] Firefox/Zen detected - using optimized batch settings (${batchSize})`)

        return new Promise((resolve, reject) => {
            if (signal?.aborted) return reject(new Error('Pull aborted'))

            const pull = local.replicate.from(remote, {
                live: false,
                retry: true, // Enable retry for pull
                batch_size: batchSize,
                batches_limit: batchLimit
            })

            // Cleanup handler
            const onAbort = () => {
                pull.cancel()
                reject(new Error('Pull aborted by signal'))
            }

            if (signal) {
                signal.addEventListener('abort', onAbort)
            }

            let timer: ReturnType<typeof setTimeout>

            // QUICK FIX: Reduced inactivity timeout from 60s to 30s for faster failure
            const INACTIVITY_TIMEOUT_MS = 30000 // 30 seconds
            const resetTimeout = () => {
                if (timer) clearTimeout(timer)
                timer = setTimeout(() => {
                    pull.cancel()
                    reject(new Error(`Pull timeout after ${INACTIVITY_TIMEOUT_MS / 1000} seconds of inactivity`))
                }, INACTIVITY_TIMEOUT_MS)
            }

            resetTimeout() // Start initial timer

            pull.on('change', (info) => {
                resetTimeout() // Activity detected, reset timer

                if (signal?.aborted) pull.cancel()
                console.log(`⬇️ [SYNC] Pull progress: ${info.docs_read} docs`)

                // DEBUG: Log sample of doc IDs to see what we are pulling
                if ((info as any).docs && (info as any).docs.length > 0) {
                    const sampleIds = (info as any).docs.slice(0, 5).map((d: any) => d._id)
                    console.log(`🔍 [SYNC-DEBUG] Sample IDs pulled:`, sampleIds)
                }

                // Update UI Progress
                import('@/services/sync/SyncStateService').then(({ syncState }) => {
                    syncState.updateProgress(info.docs_read || 0, 0)
                })

                // DEBUG: Check for section docs
                const changeInfo = info as any
                const sectionDocs = changeInfo.docs?.filter((d: any) => d._id.startsWith('section-'))
                if (sectionDocs?.length) {
                    console.log('⬇️ [SYNC] Pulled SECTIONS:', sectionDocs.map((d: any) => d._id))
                    // Trigger custom event for CanvasStore to pick up? 
                    // No, we rely on the debounced reload we implemented in useReliableSyncManager.
                    // But seeing this log confirms they arrived.
                }
            })
            pull.on('complete', (info) => {
                if (timer) clearTimeout(timer)
                if (signal) signal.removeEventListener('abort', onAbort)
                console.log(`✅ [SYNC] Pull complete: ${info.docs_read} docs read, ${info.docs_written} written`)
                resolve(info.docs_written || 0)
            })
            pull.on('error', (err) => {
                if (timer) clearTimeout(timer)
                if (signal) signal.removeEventListener('abort', onAbort)
                // Don't log if cancelled
                if ((err as any)?.message === 'Replication cancelled' || signal?.aborted) {
                    reject(new Error('Pull cancelled'))
                } else {
                    console.error('❌ [SYNC] Pull error:', err)
                    reject(err)
                }
            })
            pull.on('paused', (err) => {
                console.log('⬇️ [SYNC] Pull paused', err)
                // Do not reset timeout on pause, we might be stuck
            })
            pull.on('active', () => {
                console.log('⬇️ [SYNC] Pull active')
                resetTimeout()
            })
        })
    }

    private async pushToLocal(local: PouchDB.Database, remote: PouchDB.Database, signal?: AbortSignal): Promise<number> {
        // Note: 'pushToLocal' actually pushes Local -> Remote. Keeping name for compatibility.
        console.log('⬆️ [SYNC] Starting Push (Local -> Remote)...')

        // Firefox/Zen optimization
        const ua = navigator.userAgent.toLowerCase()
        const isZen = ua.includes('zen')
        const isFirefox = ua.includes('firefox') || isZen

        // Use 25 for Zen/Firefox as per debug guide, 100 for Chromium
        const batchSize = isFirefox ? 25 : 100
        const batchLimit = isFirefox ? 5 : 20

        return new Promise((resolve, reject) => {
            if (signal?.aborted) return reject(new Error('Push aborted'))

            const push = local.replicate.to(remote, {
                live: false,
                retry: true,
                batch_size: batchSize,
                batches_limit: batchLimit
            })

            const onAbort = () => {
                push.cancel()
                reject(new Error('Push aborted by signal'))
            }

            if (signal) {
                signal.addEventListener('abort', onAbort)
            }

            let timer: ReturnType<typeof setTimeout>

            // QUICK FIX: Reduced inactivity timeout from 60s to 30s for faster failure
            const PUSH_INACTIVITY_TIMEOUT_MS = 30000 // 30 seconds
            const resetTimeout = () => {
                if (timer) clearTimeout(timer)
                timer = setTimeout(() => {
                    push.cancel()
                    reject(new Error(`Push timeout after ${PUSH_INACTIVITY_TIMEOUT_MS / 1000} seconds of inactivity`))
                }, PUSH_INACTIVITY_TIMEOUT_MS)
            }

            resetTimeout() // Start initial timer

            push.on('change', (info) => {
                resetTimeout() // Activity detected
                if (signal?.aborted) push.cancel()
                console.log(`⬆️ [SYNC] Push progress: ${info.docs_written} docs`)

                // Update UI Progress
                import('@/services/sync/SyncStateService').then(({ syncState }) => {
                    syncState.updateProgress(0, info.docs_written || 0)
                })
            })
            push.on('complete', (info) => {
                if (timer) clearTimeout(timer)
                if (signal) signal.removeEventListener('abort', onAbort)
                console.log(`✅ [SYNC] Push complete: ${info.docs_written} docs written`)
                resolve(info.docs_written || 0)
            })
            push.on('error', (err) => {
                if (timer) clearTimeout(timer)
                if (signal) signal.removeEventListener('abort', onAbort)

                if ((err as any)?.message === 'Replication cancelled' || signal?.aborted) {
                    reject(new Error('Push cancelled'))
                } else {
                    console.error('❌ [SYNC] Push error:', err)
                    reject(err)
                }
            })
            push.on('paused', (err) => {
                console.log('⬆️ [SYNC] Push paused', err)
            })
            push.on('active', () => {
                console.log('⬆️ [SYNC] Push active')
                resetTimeout()
            })
        })
    }

    /**
     * Emergency database recovery for orphaned revision corruption
     * Clears local IndexedDB and reloads to re-sync from CouchDB
     */
    private async triggerDatabaseRecovery(): Promise<void> {
        console.warn('🚨 [RECOVERY] Critical corruption detected. Initiating Nuclear Reset...')
        await this.nuclearReset()
    }

    /**
     * NUCLEAR RESET: The ultimate recovery tool.
     * Wipes all local PouchDB/IndexedDB data and reloads the application.
     * This provides a clean slate by forcing a full re-sync from the server.
     */
    public async nuclearReset(): Promise<void> {
        try {
            console.log('☢️ [NUCLEAR-RESET] Starting emergency wipe...')

            // 1. Clear PouchDB-related IndexedDB databases
            const databases = await indexedDB.databases()
            const pouchDBs = databases.filter(db => db.name?.startsWith('_pouch_'))

            console.log(`☢️ [NUCLEAR-RESET] Deleting ${pouchDBs.length} local databases...`)

            const deletionPromises = pouchDBs.map(db => {
                return new Promise<void>((resolve) => {
                    if (!db.name) return resolve()
                    const req = indexedDB.deleteDatabase(db.name)
                    req.onsuccess = () => {
                        console.log(`✅ [NUCLEAR-RESET] Deleted: ${db.name}`)
                        resolve()
                    }
                    req.onerror = () => {
                        console.error(`❌ [NUCLEAR-RESET] Failed to delete: ${db.name}`)
                        resolve() // Continue anyway
                    }
                    req.onblocked = () => {
                        console.warn(`⚠️ [NUCLEAR-RESET] Deletion blocked for: ${db.name}`)
                        resolve()
                    }
                })
            })

            await Promise.all(deletionPromises)

            // 2. Clear relevant localStorage items (optional but recommended for clean state)
            // Leave core auth/session keys if they exist, but clear sync metadata
            Object.keys(localStorage).forEach(key => {
                if (key.includes('sync') || key.includes('pouch') || key.includes('last_sync')) {
                    localStorage.removeItem(key)
                }
            })

            console.log('☢️ [NUCLEAR-RESET] Wipe complete. Reloading...')

            // 3. Force reload
            window.location.href = window.location.origin
        } catch (error) {
            console.error('❌ [NUCLEAR-RESET] Reset failed:', error)
            alert('Emergency reset failed. Please manually clear your browser data (IndexedDB and LocalStorage) and reload.')
        }
    }

    /**
     * Start continuous bidirectional replication
     */
    public startLiveSync(
        local: PouchDB.Database,
        remote: PouchDB.Database
    ): { cancel: () => void } {
        console.log('🔄 [SYNC] Starting LIVE Bidirectional Sync...')

        const pull = local.replicate.from(remote, {
            live: true,
            retry: true,
            batch_size: 25,
            batches_limit: 5
        })

        const push = local.replicate.to(remote, {
            live: true,
            retry: true,
            batch_size: 25,
            batches_limit: 5
        })

        pull.on('change', (info) => {
            // console.log('⬇️ [SYNC-LIVE] Remote change detected:', info.docs_read, 'docs')
            // This will trigger the global callback via Orchestrator
            import('@/services/sync/SyncOrchestrator').then(({ syncOrchestrator }) => {
                (syncOrchestrator as any).notifyDataPulled()
            })
        })

        push.on('change', (info) => {
            // console.log('⬆️ [SYNC-LIVE] Local change pushed:', info.docs_written, 'docs')
        })

        const onError = async (type: string, err: any) => {
            console.error(`❌ [SYNC-LIVE] ${type} Error:`, err)

            // Detect orphaned revision error - indicates database corruption
            const errorMessage = err?.message || err?.toString() || ''
            if (errorMessage.includes('Unable to resolve latest revision')) {
                console.error('🔴 [SYNC] CRITICAL: Orphaned revision detected. Database corruption.')
                console.error('🔴 [SYNC] Auto-recovery: Clearing local IndexedDB and reloading...')

                // Cancel sync immediately
                pull.cancel()
                push.cancel()

                // Trigger auto-recovery
                await this.triggerDatabaseRecovery()
            }
        }

        pull.on('error', (err) => onError('Pull', err))
        push.on('error', (err) => onError('Push', err))

        return {
            cancel: () => {
                console.log('⏹️ [SYNC] Stopping LIVE Sync')
                pull.cancel()
                push.cancel()
            }
        }
    }
}
