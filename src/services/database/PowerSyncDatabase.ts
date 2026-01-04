import { PowerSyncDatabase, WASQLiteOpenFactory } from '@powersync/web';
import { AppSchema } from '@/database/AppSchema';
import { PowerSyncConnector } from './PowerSyncConnector';

class PowerSyncService {
    private static instance: PowerSyncDatabase | null = null;
    private static initPromise: Promise<PowerSyncDatabase> | null = null;

    private constructor() { }

    public static async getInstance(): Promise<PowerSyncDatabase> {
        if (this.instance) return this.instance;
        if (!this.initPromise) {
            this.initPromise = this.init();
        }
        return this.initPromise;
    }

    private static async init(): Promise<PowerSyncDatabase> {
        console.log('🔋 [POWERSYNC] Initializing Remote Sync via @powersync/web...');

        try {
            const factory = new WASQLiteOpenFactory({
                dbFilename: 'pomoflow_sqlite_v2.db',
            });

            const db = new PowerSyncDatabase({
                schema: AppSchema,
                database: factory
            });

            await db.init();

            // Connect to remote sync service
            const connector = new PowerSyncConnector();
            db.connect(connector);

            console.log('✅ [POWERSYNC] Connected to remote sync stack');
            this.instance = db;
            return db;

        } catch (err) {
            console.error('❌ [POWERSYNC] Initialization failed:', err);
            this.initPromise = null;
            throw err;
        }
    }

    /**
     * resetDatabase (Destructive - like "Nuke")
     */
    public static async resetDatabase(): Promise<void> {
        if (this.instance) {
            console.warn('🔥 [POWERSYNC] Nuke triggered - disconnecting and deleting DB');
            await this.instance.disconnectAndClear();
            this.instance = null;
            this.initPromise = null;
        }
    }
}

export default PowerSyncService;
