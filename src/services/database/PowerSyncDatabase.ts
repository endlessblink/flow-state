// import { WASQLitePowerSyncDatabaseOpenFactory, PowerSyncDatabase } from '@journeyapps/powersync-sdk-web';
import type { PowerSyncDatabase } from '@journeyapps/powersync-sdk-web';
import { AppSchema } from '@/database/AppSchema';

class PowerSyncService {
    private static instance: PowerSyncDatabase | null = null;
    private static initPromise: Promise<PowerSyncDatabase> | null = null;

    private constructor() { }

    /**
     * Initialize the PowerSync database (Offline/Local Mode)
     */
    public static async getInstance(): Promise<PowerSyncDatabase> {
        if (this.instance) return this.instance;

        // Prevent multiple concurrent initializations
        if (!this.initPromise) {
            this.initPromise = this.init();
        }

        return this.initPromise;
    }

    private static async init(): Promise<PowerSyncDatabase> {
        console.log('🔋 [POWERSYNC] Initializing WASM SQLite via Factory...');

        try {
            // DYNAMIC IMPORT: Prevent app crash if SDK fails to load (e.g. WASM/Worker issues)
            const { WASQLitePowerSyncDatabaseOpenFactory } = await import('@journeyapps/powersync-sdk-web');
            const { default: LogWorker } = await import('@/worker/db-worker.ts?worker&url');

            // Updated to use the Factory pattern which ensures correct adapter setup for Web/WASM
            const factory = new WASQLitePowerSyncDatabaseOpenFactory({
                schema: AppSchema,
                dbFilename: 'pomoflow_sqlite.db',
                // @ts-ignore - workerUri is valid for WASQLite adapter
                workerUri: LogWorker
            });

            const db = factory.getInstance() as PowerSyncDatabase;
            // DEBUG: Inspect the DB instance
            console.log('🔍 [POWERSYNC-DEBUG] DB Instance created via Factory');
            console.log('🔍 [POWERSYNC-DEBUG] Has registerListener?', (db as any).registerListener ? 'YES' : 'NO');

            await db.init();
            console.log('✅ [POWERSYNC] Database initialized successfully (Offline Mode)');
            this.instance = db;
            return db;

        } catch (err) {
            console.error('❌ [POWERSYNC] Failed to initialize database:', err);
            this.initPromise = null; // Reset promise to allow retry
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
