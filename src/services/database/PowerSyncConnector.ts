import type { PowerSyncBackendConnector, AbstractPowerSyncDatabase } from '@powersync/web';
import * as jose from 'jose';

/**
 * PowerSync Connector for Pomo-Flow
 */
export class PowerSyncConnector implements PowerSyncBackendConnector {
    private readonly endpoint: string;
    private readonly secret: string;

    constructor() {
        this.endpoint = import.meta.env.VITE_POWERSYNC_URL || 'http://localhost:8080';
        this.secret = 'dev_secret';
    }

    async fetchCredentials() {
        console.debug('🔋 [POWERSYNC] Fetching development credentials...');

        const secret = new TextEncoder().encode(this.secret);
        const token = await new jose.SignJWT({ sub: 'local-user' })
            .setProtectedHeader({ alg: 'HS256', kid: 'local-dev-key' })
            .setIssuedAt()
            .setAudience('pomoflow')
            .setExpirationTime('24h')
            .sign(secret);

        return {
            token,
            endpoint: this.endpoint
        };
    }

    async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) {
            return;
        }

        console.log('🚀 [POWERSYNC] Uploading transaction...', transaction);

        try {
            const resp = await fetch(`${this.endpoint.replace(':8080', ':3000')}/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${(await this.fetchCredentials())?.token}`
                },
                body: JSON.stringify({ batch: transaction.crud })
            });

            if (!resp.ok) {
                throw new Error(`Upload failed: ${resp.statusText}`);
            }

            await transaction.complete();
            console.log('✅ [POWERSYNC] Transaction uploaded and completed');
        } catch (e) {
            console.error('❌ [POWERSYNC] Upload failed:', e);
        }
    }
}
