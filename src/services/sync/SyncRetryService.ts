
import { RetryManager } from '@/utils/retryManager'
import type { SyncMetrics } from '@/composables/useReliableSyncManager'
import type { Ref } from 'vue'

export class SyncRetryService {
    private retryManager: RetryManager

    constructor() {
        this.retryManager = new RetryManager({
            maxAttempts: 3,
            baseDelay: 1000,
            maxDelay: 30000,
            backoffFactor: 2,
            jitter: true
        })
    }

    public async executeWithRetry<T>(
        operation: () => Promise<T>,
        context: string,
        metrics?: Ref<SyncMetrics>
    ): Promise<T> {
        try {
            const result = await this.retryManager.executeWithRetry(
                operation,
                context,
                { context }
            )

            if (result.success) {
                return result.value as T
            }

            throw result.error || new Error('Operation failed')

        } catch (error) {
            // Update metrics if provided
            if (metrics) {
                // metrics.value.failedSyncs++ // Managed by caller usually
            }
            throw error
        }
    }

    public getStats() {
        return this.retryManager.getStats()
    }
}

export const syncRetryService = new SyncRetryService()
