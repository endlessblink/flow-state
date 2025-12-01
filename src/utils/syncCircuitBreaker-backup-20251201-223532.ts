/**
 * Sync Circuit Breaker System
 *
 * Prevents infinite sync loops by implementing:
 * - Debouncing (300ms minimum between sync attempts)
 * - Concurrent sync prevention
 * - Automatic shutdown after consecutive errors
 * - Performance monitoring and metrics
 *
 * Based on 2024 best practices for Vue.js + PouchDB integration
 */

export interface SyncMetrics {
  attempts: number
  successes: number
  preventedLoops: number
  averageDuration: number
  consecutiveErrors: number
  lastSyncTime: number
  isCurrentlyActive: boolean
}

export interface SyncCircuitBreakerConfig {
  cooldownMs: number
  maxConsecutiveErrors: number
  maxSyncDuration: number
  enableMetrics: boolean
}

export class SyncCircuitBreaker {
  private config: SyncCircuitBreakerConfig
  private metrics: SyncMetrics
  private syncInProgress = false
  private isDestroyed = false
  private performanceHistory: number[] = []

  constructor(config: Partial<SyncCircuitBreakerConfig> = {}) {
    this.config = {
      cooldownMs: 300, // 300ms debouncing
      maxConsecutiveErrors: 3,
      maxSyncDuration: 30000, // 30 seconds max
      enableMetrics: true,
      ...config
    }

    this.metrics = {
      attempts: 0,
      successes: 0,
      preventedLoops: 0,
      averageDuration: 0,
      consecutiveErrors: 0,
      lastSyncTime: 0,
      isCurrentlyActive: false
    }
  }

  /**
   * Execute sync operation with circuit breaker protection
   */
  async executeSync<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    if (this.isDestroyed) {
      throw new Error('Circuit breaker destroyed - cannot execute sync')
    }

    // Check if sync is already in progress
    if (this.syncInProgress) {
      console.log(`🔌 [CIRCUIT BREAKER] Sync already in progress (${context})`)
      this.metrics.preventedLoops++
      throw new Error(`Sync already in progress: ${context}`)
    }

    // Debounce rapid sync attempts
    const now = Date.now()
    const timeSinceLastSync = now - this.metrics.lastSyncTime

    if (timeSinceLastSync < this.config.cooldownMs) {
      console.log(`⏱️ [CIRCUIT BREAKER] Sync too soon (${context}) - ${this.config.cooldownMs - timeSinceLastSync}ms remaining`)
      this.metrics.preventedLoops++
      throw new Error(`Sync debounced: ${context} (${this.config.cooldownMs - timeSinceLastSync}ms remaining)`)
    }

    // Check if circuit is open due to consecutive errors
    if (this.metrics.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      console.log(`🚨 [CIRCUIT BREAKER] Circuit OPEN - too many consecutive errors (${this.metrics.consecutiveErrors})`)
      throw new Error(`Circuit breaker open: ${this.metrics.consecutiveErrors} consecutive errors`)
    }

    // Execute sync with monitoring
    this.syncInProgress = true
    this.metrics.isCurrentlyActive = true
    this.metrics.attempts++
    this.metrics.lastSyncTime = now

    const startTime = Date.now()

    try {
      console.log(`🚀 [CIRCUIT BREAKER] Starting sync operation: ${context}`)

      // Add timeout protection
      const result = await this.withTimeout(operation(), this.config.maxSyncDuration, context)

      // Success - reset error counter
      this.metrics.successes++
      this.metrics.consecutiveErrors = 0

      const duration = Date.now() - startTime
      this.updatePerformanceMetrics(duration)

      console.log(`✅ [CIRCUIT BREAKER] Sync completed: ${context} (${duration}ms)`)
      return result

    } catch (error) {
      // Increment error counter
      this.metrics.consecutiveErrors++
      const duration = Date.now() - startTime

      console.error(`❌ [CIRCUIT BREAKER] Sync failed: ${context} (${duration}ms) - Error:`, error)

      // Auto-shutdown if too many consecutive errors
      if (this.metrics.consecutiveErrors >= this.config.maxConsecutiveErrors) {
        console.warn(`🚨 [CIRCUIT BREAKER] Auto-shutdown triggered - ${this.metrics.consecutiveErrors} consecutive errors`)
        this.destroy()
      }

      throw error

    } finally {
      this.syncInProgress = false
      this.metrics.isCurrentlyActive = false
    }
  }

  /**
   * Add timeout protection to sync operations
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    context: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Sync timeout: ${context} (${timeoutMs}ms)`))
        }, timeoutMs)
      })
    ])
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(duration: number): void {
    this.performanceHistory.push(duration)

    // Keep only last 10 operations for average
    if (this.performanceHistory.length > 10) {
      this.performanceHistory.shift()
    }

    // Calculate average duration
    this.metrics.averageDuration = this.performanceHistory.reduce((sum, d) => sum + d, 0) / this.performanceHistory.length
  }

  /**
   * Get current metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics }
  }

  /**
   * Check if circuit breaker is healthy
   */
  isHealthy(): boolean {
    return !this.isDestroyed &&
           this.metrics.consecutiveErrors < this.config.maxConsecutiveErrors &&
           !this.syncInProgress
  }

  /**
   * Check if sync can be attempted
   */
  canSync(): boolean {
    if (this.isDestroyed) return false
    if (this.syncInProgress) return false
    if (this.metrics.consecutiveErrors >= this.config.maxConsecutiveErrors) return false

    const now = Date.now()
    const timeSinceLastSync = now - this.metrics.lastSyncTime
    return timeSinceLastSync >= this.config.cooldownMs
  }

  /**
   * Reset circuit breaker state (for recovery)
   */
  reset(): void {
    this.metrics.consecutiveErrors = 0
    this.syncInProgress = false
    this.isDestroyed = false
    console.log(`🔄 [CIRCUIT BREAKER] Reset - ready for sync operations`)
  }

  /**
   * Destroy circuit breaker (emergency shutdown)
   */
  destroy(): void {
    this.isDestroyed = true
    this.syncInProgress = false
    console.log(`🛑 [CIRCUIT BREAKER] Destroyed - no more sync operations allowed`)
  }

  /**
   * Get time until next sync can be attempted
   */
  getTimeUntilNextSync(): number {
    if (this.isDestroyed) return Infinity
    if (this.metrics.consecutiveErrors >= this.config.maxConsecutiveErrors) return Infinity

    const now = Date.now()
    const timeSinceLastSync = now - this.metrics.lastSyncTime
    return Math.max(0, this.config.cooldownMs - timeSinceLastSync)
  }

  /**
   * Create a debounced version of a sync function
   */
  createDebouncedSync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: string
  ): (...args: T) => Promise<R> {
    return (...args: T) => this.executeSync(() => fn(...args), context)
  }
}

/**
 * Global circuit breaker instance for sync operations
 */
export const globalSyncCircuitBreaker = new SyncCircuitBreaker({
  cooldownMs: 300,
  maxConsecutiveErrors: 3,
  maxSyncDuration: 30000,
  enableMetrics: true
})

/**
 * Utility function to execute sync with global circuit breaker
 */
export const executeSyncWithCircuitBreaker = async <T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> => {
  return globalSyncCircuitBreaker.executeSync(operation, context)
}

/**
 * Create change detection guard to prevent Vue.js reactivity loops
 */
export const createChangeDetectionGuard = () => {
  let lastValue: any = null
  let isUpdating = false

  return {
    shouldUpdate: (newValue: any): boolean => {
      if (isUpdating) return false

      // Deep compare using JSON serialization
      const frozenNew = JSON.parse(JSON.stringify(newValue))
      const frozenOld = JSON.parse(JSON.stringify(lastValue))

      const hasChanged = JSON.stringify(frozenNew) !== JSON.stringify(frozenOld)

      if (hasChanged) {
        lastValue = frozenNew
      }

      return hasChanged
    },

    setUpdating: (updating: boolean): void => {
      isUpdating = updating
    },

    freezeData: <T>(data: T): T => {
      return Object.freeze(JSON.parse(JSON.stringify(data)))
    }
  }
}

export default SyncCircuitBreaker