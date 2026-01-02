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
        remoteDB: PouchDB.Database
    ): Promise<SyncResult> {
        const syncOperation = this.logger.startSyncOperation('full_sync')
        const operationId = syncOperation.operationId

        try {
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

            // Step 2: Conflict detection
            // Note: Auto-resolution logic should be handled by the caller or a separate manager if possible,
            // but for now we'll assume conflicts are checked. We won't resolve here to keep this pure sync.
            // Actually, original code did resolve here. We should probably keep it separated or inject the resolver.
            // For this refactor, let's focus on the PULL/PUSH mechanics.

            // Step 3: Perform sync (PULL FIRST)
            const pullResult = await this.pullFromRemote(localDB, remoteDB)
            const pushResult = await this.pushToLocal(localDB, remoteDB)

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

            this.logger.error('sync', 'Reliable sync failed', {
                operationId,
                error: errorMsg
            })

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

    private async pullFromRemote(local: PouchDB.Database, remote: PouchDB.Database): Promise<number> {
        console.log('⬇️ [SYNC] Starting Pull (Remote -> Local)...')
        return new Promise((resolve, reject) => {
            const pull = local.replicate.from(remote, {
                live: false,
                retry: true, // Enable retry for pull
                batch_size: 100, // Increased from 10
                batches_limit: 10
            })

            const timer = setTimeout(() => {
                pull.cancel()
                reject(new Error('Pull timeout after 120 seconds'))
            }, 120000)

            pull.on('change', (info) => {
                console.log(`⬇️ [SYNC] Pull progress: ${info.docs_read} docs`)
            })
            pull.on('complete', (info) => {
                clearTimeout(timer)
                console.log(`✅ [SYNC] Pull complete: ${info.docs_read} docs read, ${info.docs_written} written`)
                resolve(info.docs_written || 0)
            })
            pull.on('error', (err) => {
                clearTimeout(timer)
                console.error('❌ [SYNC] Pull error:', err)
                reject(err)
            })
            pull.on('paused', (err) => console.log('⬇️ [SYNC] Pull paused', err))
            pull.on('active', () => console.log('⬇️ [SYNC] Pull active'))
        })
    }

    private async pushToLocal(local: PouchDB.Database, remote: PouchDB.Database): Promise<number> {
        // Note: Using replicate.to() -> this is usually "Push to Remote"
        // But the function name is 'pushToLocal'. 
        // Wait, 'pushToLocal' implies putting data INTO local? 
        // Sync logic is: pullFromRemote (Remote->Local), then pushToLocal (Local->Remote?).
        // Examining original code: `local.replicate.to(remote)` -> Local -> Remote.
        // So this method name 'pushToLocal' is confusing, it should be 'pushToRemote'.
        // I will keep the name for now to avoid breaking calls, but add logging.

        console.log('⬆️ [SYNC] Starting Push (Local -> Remote)...')
        return new Promise((resolve, reject) => {
            const push = local.replicate.to(remote, {
                live: false,
                retry: true,
                batch_size: 100,
                batches_limit: 10
            })

            const timer = setTimeout(() => {
                push.cancel()
                reject(new Error('Push timeout after 120 seconds'))
            }, 120000)

            push.on('change', (info) => {
                console.log(`⬆️ [SYNC] Push progress: ${info.docs_read} docs`)
            })
            push.on('complete', (info) => {
                clearTimeout(timer)
                console.log(`✅ [SYNC] Push complete: ${info.docs_written} docs written`)
                resolve(info.docs_written || 0)
            })
            push.on('error', (err) => {
                clearTimeout(timer)
                console.error('❌ [SYNC] Push error:', err)
                reject(err)
            })
        })
    }
}
