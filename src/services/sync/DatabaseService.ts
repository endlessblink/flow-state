import PouchDB from 'pouchdb-browser'
import { getDatabaseConfig } from '@/config/database'

export class DatabaseService {
    private localDB: PouchDB.Database | null = null
    private remoteDB: PouchDB.Database | null = null

    constructor() { }

    /**
     * Set local PouchDB instance (Dependency Injection)
     * Replaces internal creation logic to prevent multiple instances
     */
    public setLocalDatabase(db: PouchDB.Database): void {
        if (!db) {
            console.warn('⚠️ [DatabaseService] Attempted to set null database')
            return
        }
        this.localDB = db
        console.log('✅ [DatabaseService] Local Database Injected')
    }

    /**
     * Setup remote PouchDB connection with error handling
     */
    public async initializeRemote(): Promise<PouchDB.Database | null> {
        try {
            console.log('🔌 [REMOTE] Starting remote connection setup...')

            const config = getDatabaseConfig()

            if (!config.remote?.url) {
                console.log('📱 DatabaseService: No remote URL configured, using local-only mode')
                this.remoteDB = null
                return null
            }

            console.log(`🔌 [REMOTE] URL: ${config.remote.url}`)

            const remoteOptions: PouchDB.Configuration.RemoteDatabaseConfiguration = {}

            if (config.remote.auth) {
                remoteOptions.auth = {
                    username: config.remote.auth.username,
                    password: config.remote.auth.password
                }
                console.log(`🔌 [REMOTE] Auth configured for user: ${config.remote.auth.username}`)
            }

            // Add timeout property - reduced to 10 seconds for faster feedback
            (remoteOptions as PouchDB.Configuration.RemoteDatabaseConfiguration & { timeout?: number }).timeout = 10000
            remoteOptions.skip_setup = false

            console.log('🔌 [REMOTE] Creating PouchDB instance...')
            const remoteInstance = new PouchDB(config.remote.url, remoteOptions)
            console.log('🔌 [REMOTE] PouchDB instance created, testing connection...')

            // Use a timeout wrapper for the info() call
            try {
                const infoPromise = remoteInstance.info()
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Connection timeout after 10s')), 10000)
                )

                const info = await Promise.race([infoPromise, timeoutPromise]) as PouchDB.Core.DatabaseInfo
                console.log(`🌐 DatabaseService: Remote CouchDB connected: ${config.remote.url}`)
                console.log(`📊 Remote DB info:`, {
                    name: info.db_name,
                    doc_count: info.doc_count,
                    update_seq: info.update_seq
                })

                this.remoteDB = remoteInstance
                return this.remoteDB
            } catch (connectionError) {
                console.warn('⚠️ Remote connection test failed:', connectionError)
                // Still return the remoteDB - sync might work even if info() fails
                this.remoteDB = remoteInstance
                return this.remoteDB
            }
        } catch (err) {
            console.error('❌ Failed to setup remote connection:', err instanceof Error ? err.message : 'Unknown error')
            this.remoteDB = null
            return null
        }
    }

    public getLocalDB(): PouchDB.Database | null {
        return this.localDB
    }

    public getRemoteDB(): PouchDB.Database | null {
        return this.remoteDB
    }
}
