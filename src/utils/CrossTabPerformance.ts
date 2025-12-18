/**
 * Cross Tab Performance Manager
 *
 * Optimizes performance for cross-tab synchronization by implementing
 * efficient data batching, throttling, and memory management.
 */

export interface PerformanceConfig {
  batchSize: number
  throttleDelay: number
  maxMemoryUsage: number // in MB
  compressionEnabled: boolean
  cachingEnabled: boolean
  maxCacheSize: number
}

export interface PerformanceMetrics {
  batchCount: number
  totalDataSize: number
  processingTime: number
  memoryUsage: number
  cacheHitRate: number
}

export interface BatchedData {
  id: string
  data: any[]
  timestamp: number
  size: number
  compressed?: boolean
}

export class CrossTabPerformance {
  private config: PerformanceConfig
  private dataQueue: any[] = []
  private cache: Map<string, any> = new Map()
  private metrics: PerformanceMetrics
  private throttleTimer: number | null = null
  private memoryMonitor: number

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      batchSize: config.batchSize || 100,
      throttleDelay: config.throttleDelay || 100,
      maxMemoryUsage: config.maxMemoryUsage || 50,
      compressionEnabled: config.compressionEnabled !== undefined ? config.compressionEnabled : true,
      cachingEnabled: config.cachingEnabled !== undefined ? config.cachingEnabled : true,
      maxCacheSize: config.maxCacheSize || 1000
    }

    this.metrics = {
      batchCount: 0,
      totalDataSize: 0,
      processingTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0
    }

    this.memoryMonitor = setInterval(() => this.checkMemoryUsage(), 5000) as any
  }

  /**
   * Add data to the processing queue with batching
   */
  addToQueue(data: any): void {
    this.dataQueue.push(data)

    if (this.dataQueue.length >= this.config.batchSize) {
      this.processBatch()
    } else if (!this.throttleTimer) {
      this.throttleTimer = setTimeout(() => {
        this.processBatch()
      }, this.config.throttleDelay) as unknown as number
    }
  }

  /**
   * Process the current data queue as a batch
   */
  async processBatch(): Promise<BatchedData> {
    if (this.dataQueue.length === 0) {
      throw new Error('No data to process')
    }

    const startTime = performance.now()

    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer)
      this.throttleTimer = null
    }

    const batch = this.dataQueue.splice(0, this.config.batchSize)
    const batchData: BatchedData = {
      id: this.generateBatchId(),
      data: batch,
      timestamp: Date.now(),
      size: this.calculateDataSize(batch)
    }

    // Apply compression if enabled
    if (this.config.compressionEnabled) {
      batchData.compressed = true
      batchData.data = this.compressData(batchData.data)
    }

    // Update cache if enabled
    if (this.config.cachingEnabled) {
      this.updateCache(batchData)
    }

    // Update metrics
    this.metrics.batchCount++
    this.metrics.totalDataSize += batchData.size
    this.metrics.processingTime += performance.now() - startTime

    return batchData
  }

  /**
   * Retrieve data from cache
   */
  getCachedData(id: string): any | null {
    if (!this.config.cachingEnabled) return null

    const cached = this.cache.get(id)
    if (cached) {
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * 0.9) + (1 * 0.1) // Moving average
      return cached
    }

    this.metrics.cacheHitRate = (this.metrics.cacheHitRate * 0.9) + (0 * 0.1)
    return null
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    this.metrics.memoryUsage = this.getMemoryUsage()
    return { ...this.metrics }
  }

  /**
   * Clear cache and reset metrics
   */
  reset(): void {
    this.cache.clear()
    this.dataQueue = []
    this.metrics = {
      batchCount: 0,
      totalDataSize: 0,
      processingTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0
    }
  }

  /**
   * Optimize performance settings based on current usage
   */
  optimize(): void {
    const memoryUsage = this.getMemoryUsage()

    // Reduce batch size if memory usage is high
    if (memoryUsage > this.config.maxMemoryUsage) {
      this.config.batchSize = Math.max(10, Math.floor(this.config.batchSize * 0.7))
    }

    // Increase batch size if memory usage is low and processing is slow
    if (memoryUsage < this.config.maxMemoryUsage * 0.5 && this.metrics.processingTime > 100) {
      this.config.batchSize = Math.min(500, Math.floor(this.config.batchSize * 1.3))
    }

    // Adjust throttle delay based on processing time
    if (this.metrics.processingTime > 50) {
      this.config.throttleDelay = Math.min(500, this.config.throttleDelay + 50)
    } else if (this.metrics.processingTime < 20) {
      this.config.throttleDelay = Math.max(50, this.config.throttleDelay - 25)
    }
  }

  /**
   * Compress data to reduce transmission size
   */
  private compressData(data: any[]): any[] {
    // Simple compression - remove null/undefined values and duplicate objects
    return data.map(item => {
      const compressed: any = {}
      for (const key in item) {
        if (item[key] !== null && item[key] !== undefined) {
          compressed[key] = item[key]
        }
      }
      return compressed
    })
  }

  /**
   * Calculate approximate data size in bytes
   */
  private calculateDataSize(data: any[]): number {
    return JSON.stringify(data).length * 2 // Rough estimate (UTF-16)
  }

  /**
   * Update cache with size management
   */
  private updateCache(batchData: BatchedData): void {
    this.cache.set(batchData.id, batchData)

    // Remove oldest entries if cache is too large
    if (this.cache.size > this.config.maxCacheSize) {
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => (a[1] as BatchedData).timestamp - (b[1] as BatchedData).timestamp)

      const toRemove = entries.slice(0, this.cache.size - this.config.maxCacheSize)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }
  }

  /**
   * Get current memory usage estimate
   */
  private getMemoryUsage(): number {
    // Estimate based on cache size and queue size
    const cacheSize = JSON.stringify(Array.from(this.cache.values())).length * 2
    const queueSize = JSON.stringify(this.dataQueue).length * 2
    return (cacheSize + queueSize) / (1024 * 1024) // Convert to MB
  }

  /**
   * Monitor memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage(): void {
    const usage = this.getMemoryUsage()

    if (usage > this.config.maxMemoryUsage) {
      console.warn(`CrossTabPerformance: Memory usage (${usage.toFixed(2)}MB) exceeds limit (${this.config.maxMemoryUsage}MB)`)

      // Clear old cache entries
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => (a[1] as BatchedData).timestamp - (b[1] as BatchedData).timestamp)

      const toRemove = entries.slice(0, Math.floor(entries.length * 0.3))
      toRemove.forEach(([key]) => this.cache.delete(key))

      // Process any pending queue to clear memory
      if (this.dataQueue.length > 0) {
        this.processBatch()
      }
    }
  }

  /**
   * Generate unique batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer)
    }
    if (this.memoryMonitor) {
      clearInterval(this.memoryMonitor)
    }
    this.reset()
  }

  // ========== Message Deduplication ==========
  private processedMessages: Map<string, number> = new Map()
  private readonly MESSAGE_EXPIRY_MS = 5000 // 5 seconds

  /**
   * Check if a message should be processed (deduplication)
   */
  shouldProcessMessage(messageId: string, _message: any): boolean {
    this.cleanupExpiredMessages()

    if (this.processedMessages.has(messageId)) {
      return false // Duplicate
    }

    this.processedMessages.set(messageId, Date.now())
    return true
  }

  /**
   * Record a message processing event
   */
  recordMessage(messageId: string, startTime: number, endTime: number): void {
    const processingTime = endTime - startTime
    this.metrics.processingTime = (this.metrics.processingTime + processingTime) / 2 // Rolling average
  }

  /**
   * Clean up expired message IDs
   */
  private cleanupExpiredMessages(): void {
    const now = Date.now()
    for (const [id, timestamp] of this.processedMessages.entries()) {
      if (now - timestamp > this.MESSAGE_EXPIRY_MS) {
        this.processedMessages.delete(id)
      }
    }
  }

  // ========== Config Management ==========

  /**
   * Get current configuration
   */
  getConfig(): PerformanceConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * Optimize configuration based on current metrics
   */
  optimizeConfiguration(): void {
    this.optimize()
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      batchCount: 0,
      totalDataSize: 0,
      processingTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0
    }
    this.processedMessages.clear()
  }

  /**
   * Export performance data with recommendations
   */
  exportPerformanceData(): { metrics: PerformanceMetrics; config: PerformanceConfig; recommendations: string[] } {
    const metrics = this.getMetrics()
    const recommendations: string[] = []

    // Generate recommendations based on metrics
    if (metrics.memoryUsage > this.config.maxMemoryUsage * 0.8) {
      recommendations.push('Memory usage is high. Consider reducing batch size.')
    }
    if (metrics.processingTime > 100) {
      recommendations.push('Processing time is high. Consider increasing throttle delay.')
    }
    if (metrics.cacheHitRate < 0.5 && this.config.cachingEnabled) {
      recommendations.push('Cache hit rate is low. Cache may not be effective.')
    }

    return {
      metrics,
      config: this.getConfig(),
      recommendations
    }
  }
}

export default CrossTabPerformance