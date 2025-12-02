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
  // Phase 1: Enhanced health monitoring
  conflictCount: number
  rollbackCount: number
  healthScore: number // 0-100
  lastHealthCheck: number
}

export type SyncSource = 'local' | 'remote' | 'cross-tab'

export interface SyncCircuitBreakerConfig {
  cooldownMs: number
  maxConsecutiveErrors: number
  maxSyncDuration: number
  enableMetrics: boolean
  // PHASE 0.5: Context-aware cooldowns
  contextCooldowns?: {
    local: number
    remote: number
    'cross-tab': number
  }
  // Phase 1: Health monitoring and auto-rollback
  enableHealthMonitoring?: boolean
  healthCheckInterval?: number
  autoRollbackThreshold?: number // health score below this triggers rollback
  maxConflictRate?: number // max conflicts per 100 operations
  enableProgressiveSync?: boolean
}

export class SyncCircuitBreaker {
  private config: SyncCircuitBreakerConfig
  private metrics: SyncMetrics
  private syncInProgress = false
  private isDestroyed = false
  private performanceHistory: number[] = []
  // Phase 1: Health monitoring
  private healthCheckTimer?: NodeJS.Timeout
  private conflictHistory: number[] = []
  private rollbackTriggered = false

  constructor(config: Partial<SyncCircuitBreakerConfig> = {}) {
    this.config = {
      cooldownMs: 300, // Default debouncing (backwards compatibility)
      maxConsecutiveErrors: 3,
      maxSyncDuration: 30000, // 30 seconds max
      enableMetrics: true,
      // PHASE 0.5: Context-aware cooldowns for different sync sources
      contextCooldowns: {
        local: 300,      // Standard local operations
        remote: 600,     // Remote sync is slower, longer cooldown
        'cross-tab': 200, // Cross-tab sync is faster, shorter cooldown
        ...config.contextCooldowns
      },
      // Phase 1: Health monitoring defaults
      enableHealthMonitoring: true,
      healthCheckInterval: 30000, // 30 seconds
      autoRollbackThreshold: 30, // Rollback if health < 30%
      maxConflictRate: 5, // Max 5 conflicts per 100 operations
      enableProgressiveSync: false, // Disabled by default
      ...config
    }

    this.metrics = {
      attempts: 0,
      successes: 0,
      preventedLoops: 0,
      averageDuration: 0,
      consecutiveErrors: 0,
      lastSyncTime: 0,
      isCurrentlyActive: false,
      // Phase 1: Enhanced health metrics
      conflictCount: 0,
      rollbackCount: 0,
      healthScore: 100,
      lastHealthCheck: Date.now()
    }

    // Phase 1: Start health monitoring if enabled
    if (this.config.enableHealthMonitoring) {
      this.startHealthMonitoring()
    }
  }

  /**
   * PHASE 0.5 Enhanced: Execute sync operation with circuit breaker protection and context-aware throttling
   */
  async executeSync<T>(
    operation: () => Promise<T>,
    context: string,
    source: SyncSource = 'local'
  ): Promise<T> {
    if (this.isDestroyed) {
      throw new Error('Circuit breaker destroyed - cannot execute sync')
    }

    // Check if sync is already in progress
    if (this.syncInProgress) {
      console.log(`🔌 [CIRCUIT BREAKER] Sync already in progress (${context}, source: ${source})`)
      this.metrics.preventedLoops++
      throw new Error(`Sync already in progress: ${context}`)
    }

    // PHASE 0.5: Context-aware debouncing
    const now = Date.now()
    const timeSinceLastSync = now - this.metrics.lastSyncTime

    // Get appropriate cooldown based on source
    const cooldownMs = this.getContextAwareCooldown(source)

    if (timeSinceLastSync < cooldownMs) {
      console.log(`⏱️ [CIRCUIT BREAKER] Sync too soon (${context}, source: ${source}) - ${cooldownMs - timeSinceLastSync}ms remaining`)
      this.metrics.preventedLoops++
      throw new Error(`Sync debounced: ${context} (${cooldownMs - timeSinceLastSync}ms remaining)`)
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
      console.log(`🚀 [CIRCUIT BREAKER] Starting sync operation: ${context} (source: ${source})`)

      // Add timeout protection
      const result = await this.withTimeout(operation(), this.config.maxSyncDuration, context)

      // Success - reset error counter
      this.metrics.successes++
      this.metrics.consecutiveErrors = 0

      const duration = Date.now() - startTime
      this.updatePerformanceMetrics(duration)

      console.log(`✅ [CIRCUIT BREAKER] Sync completed: ${context} (source: ${source}, ${duration}ms)`)
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
   * PHASE 0.5: Get context-aware cooldown based on sync source
   */
  private getContextAwareCooldown(source: SyncSource): number {
    if (this.config.contextCooldowns && this.config.contextCooldowns[source]) {
      return this.config.contextCooldowns[source]
    }

    // Fallback to default cooldown if context-specific not configured
    console.warn(`⚠️ [CIRCUIT BREAKER] No cooldown configured for source: ${source}, using default`)
    return this.config.cooldownMs
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

    // Phase 1: Clean up health monitoring
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = undefined
    }

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

  // Phase 1: Health Monitoring & Auto-Rollback Methods

  /**
   * Phase 1: Start health monitoring timer
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, this.config.healthCheckInterval)

    console.log(`🏥 [CIRCUIT BREAKER] Health monitoring started (interval: ${this.config.healthCheckInterval}ms)`)
  }

  /**
   * Phase 1: Perform comprehensive health check
   */
  private performHealthCheck(): void {
    const now = Date.now()
    this.metrics.lastHealthCheck = now

    // Calculate health score based on multiple factors
    let healthScore = 100

    // Factor 1: Success rate (40% weight)
    const successRate = this.metrics.attempts > 0 ? (this.metrics.successes / this.metrics.attempts) * 100 : 100
    healthScore -= (100 - successRate) * 0.4

    // Factor 2: Error rate (30% weight)
    const errorRate = this.metrics.attempts > 0 ? (this.metrics.consecutiveErrors / this.metrics.attempts) * 100 : 0
    healthScore -= errorRate * 0.3

    // Factor 3: Conflict rate (20% weight)
    const conflictRate = this.metrics.attempts > 0 ? (this.metrics.conflictCount / this.metrics.attempts) * 100 : 0
    healthScore -= Math.min(conflictRate, this.config.maxConflictRate!) * 0.2

    // Factor 4: Performance (10% weight)
    if (this.metrics.averageDuration > 5000) { // 5 seconds is slow
      healthScore -= 10
    }

    // Ensure health score stays within bounds
    this.metrics.healthScore = Math.max(0, Math.min(100, healthScore))

    console.log(`🏥 [CIRCUIT BREAKER] Health check: ${this.metrics.healthScore.toFixed(1)}% (success: ${successRate.toFixed(1)}%, errors: ${errorRate.toFixed(1)}%, conflicts: ${conflictRate.toFixed(1)}%)`)

    // Auto-rollback if health is critically low
    if (this.metrics.healthScore < this.config.autoRollbackThreshold! && !this.rollbackTriggered) {
      this.triggerAutoRollback()
    }
  }

  /**
   * Phase 1: Trigger automatic rollback due to poor health
   */
  private triggerAutoRollback(): void {
    this.rollbackTriggered = true
    this.metrics.rollbackCount++

    console.warn(`🚨 [CIRCUIT BREAKER] AUTO-ROLLBACK TRIGGERED - Health: ${this.metrics.healthScore.toFixed(1)}% < ${this.config.autoRollbackThreshold}%`)

    // Emit rollback event for monitoring systems
    this.emitHealthEvent('auto-rollback', {
      healthScore: this.metrics.healthScore,
      metrics: this.metrics,
      timestamp: Date.now()
    })

    // Temporarily disable aggressive sync to prevent further damage
    this.config.cooldownMs = Math.max(this.config.cooldownMs * 2, 1000)
    this.config.maxConsecutiveErrors = Math.max(this.config.maxConsecutiveErrors - 1, 1)

    console.log(`🛡️ [CIRCUIT BREAKER] Protective measures activated - cooldown increased to ${this.config.cooldownMs}ms`)
  }

  /**
   * Phase 1: Record a conflict event
   */
  recordConflict(context: string, details?: any): void {
    this.metrics.conflictCount++
    this.conflictHistory.push(Date.now())

    // Keep only last 50 conflicts for rate calculation
    if (this.conflictHistory.length > 50) {
      this.conflictHistory.shift()
    }

    console.warn(`⚠️ [CIRCUIT BREAKER] Conflict recorded: ${context} (total: ${this.metrics.conflictCount})`, details)

    // Emit conflict event for monitoring
    this.emitHealthEvent('conflict', {
      context,
      details,
      conflictCount: this.metrics.conflictCount,
      timestamp: Date.now()
    })
  }

  /**
   * Phase 1: Get conflict rate per 100 operations
   */
  getConflictRate(): number {
    return this.metrics.attempts > 0 ? (this.metrics.conflictCount / this.metrics.attempts) * 100 : 0
  }

  /**
   * Phase 1: Check if system is healthy enough for progressive sync
   */
  isReadyForProgressiveSync(): boolean {
    return this.metrics.healthScore >= 70 && // Good health
           this.getConflictRate() < this.config.maxConflictRate! && // Low conflict rate
           this.metrics.consecutiveErrors === 0 // No recent errors
  }

  /**
   * Phase 1: Enable progressive sync mode
   */
  enableProgressiveSync(): void {
    if (!this.isReadyForProgressiveSync()) {
      throw new Error(`System not ready for progressive sync - Health: ${this.metrics.healthScore}%, Conflicts: ${this.getConflictRate()}%`)
    }

    this.config.enableProgressiveSync = true
    console.log(`🚀 [CIRCUIT BREAKER] Progressive sync enabled - Health: ${this.metrics.healthScore}%`)

    this.emitHealthEvent('progressive-sync-enabled', {
      healthScore: this.metrics.healthScore,
      conflictRate: this.getConflictRate(),
      timestamp: Date.now()
    })
  }

  /**
   * Phase 1: Disable progressive sync mode
   */
  disableProgressiveSync(): void {
    this.config.enableProgressiveSync = false
    console.log(`🛑 [CIRCUIT BREAKER] Progressive sync disabled`)

    this.emitHealthEvent('progressive-sync-disabled', {
      healthScore: this.metrics.healthScore,
      timestamp: Date.now()
    })
  }

  /**
   * Phase 1: Emit health events for monitoring systems
   */
  private emitHealthEvent(event: string, data: any): void {
    // Emit custom event for monitoring dashboard
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync-circuit-breaker-health', {
        detail: { event, data }
      }))
    }
  }

  /**
   * Phase 1: Get comprehensive health report
   */
  getHealthReport(): {
    overall: 'healthy' | 'warning' | 'critical'
    score: number
    metrics: SyncMetrics
    recommendations: string[]
    isReadyForProgressiveSync: boolean
  } {
    const health = this.metrics.healthScore
    let overall: 'healthy' | 'warning' | 'critical'
    let recommendations: string[] = []

    if (health >= 80) {
      overall = 'healthy'
      recommendations.push('System operating normally')
    } else if (health >= 50) {
      overall = 'warning'
      recommendations.push('Monitor system closely')
      if (this.getConflictRate() > this.config.maxConflictRate!) {
        recommendations.push('Consider reducing sync frequency')
      }
    } else {
      overall = 'critical'
      recommendations.push('Immediate attention required')
      recommendations.push('Consider disabling sync temporarily')
    }

    if (this.metrics.consecutiveErrors > 0) {
      recommendations.push('Address consecutive sync errors')
    }

    if (this.metrics.averageDuration > 5000) {
      recommendations.push('Optimize sync performance')
    }

    return {
      overall,
      score: health,
      metrics: { ...this.metrics },
      recommendations,
      isReadyForProgressiveSync: this.isReadyForProgressiveSync()
    }
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
 * PHASE 0.5 Enhanced: Utility function to execute sync with global circuit breaker and context-aware throttling
 */
export const executeSyncWithCircuitBreaker = async <T>(
  operation: () => Promise<T>,
  context: string,
  source: SyncSource = 'local'
): Promise<T> => {
  return globalSyncCircuitBreaker.executeSync(operation, context, source)
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