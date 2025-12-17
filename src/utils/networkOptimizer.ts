/**
 * Network Optimizer and Condition Simulator
 * Optimizes sync performance for various network conditions
 */

export interface NetworkCondition {
  type: 'excellent' | 'good' | 'fair' | 'poor' | 'offline'
  bandwidth: number        // in bytes per second
  latency: number           // in milliseconds
  packetLoss: number        // percentage 0-100
  reliability: number       // 0-1, probability of success
}

export interface SyncOptimizationConfig {
  batchSize: number
  compressionEnabled: boolean
  retryAttempts: number
  timeoutMs: number
  syncIntervalMs: number
  parallelUploads: number
  useIncremental: boolean
}

export interface NetworkMetrics {
  currentCondition: NetworkCondition
  averageBandwidth: number
  averageLatency: number
  successRate: number
  lastMeasurement: Date
  consecutiveFailures: number
}

export class NetworkOptimizer {
  private static instance: NetworkOptimizer
  private metrics: NetworkMetrics
  private conditionHistory: NetworkCondition[] = []
  private maxHistorySize = 50
  private measurements: { bandwidth: number; latency: number; timestamp: Date }[] = []

  private constructor() {
    this.metrics = {
      currentCondition: this.getDefaultCondition(),
      averageBandwidth: 0,
      averageLatency: 0,
      successRate: 1,
      lastMeasurement: new Date(),
      consecutiveFailures: 0
    }

    // Start network monitoring
    this.startNetworkMonitoring()
  }

  public static getInstance(): NetworkOptimizer {
    if (!NetworkOptimizer.instance) {
      NetworkOptimizer.instance = new NetworkOptimizer()
    }
    return NetworkOptimizer.instance
  }

  private getDefaultCondition(): NetworkCondition {
    return {
      type: 'good',
      bandwidth: 1000000, // 1 MB/s
      latency: 100,       // 100ms
      packetLoss: 0,      // 0%
      reliability: 0.95   // 95%
    }
  }

  /**
   * Start monitoring network conditions
   */
  private startNetworkMonitoring(): void {
    // Monitor network changes
    window.addEventListener('online', () => this.handleNetworkChange())
    window.addEventListener('offline', () => this.handleNetworkChange())

    // Periodic network assessment
    setInterval(() => {
      this.assessNetworkCondition()
    }, 30000) // Every 30 seconds
  }

  /**
   * Handle network state changes
   */
  private handleNetworkChange(): void {
    const isOnline = navigator.onLine
    if (!isOnline) {
      this.updateNetworkCondition({
        type: 'offline',
        bandwidth: 0,
        latency: Infinity,
        packetLoss: 100,
        reliability: 0
      })
    } else {
      // Re-assess when coming back online
      setTimeout(() => this.assessNetworkCondition(), 1000)
    }
  }

  /**
   * Assess current network condition
   */
  private async assessNetworkCondition(): Promise<void> {
    if (!navigator.onLine) {
      return
    }

    try {
      // Measure bandwidth and latency
      const measurement = await this.measureNetworkPerformance()
      this.measurements.push({
        ...measurement,
        timestamp: new Date()
      })

      // Keep only recent measurements
      if (this.measurements.length > 10) {
        this.measurements.shift()
      }

      // Calculate averages
      const avgBandwidth = this.measurements.reduce((sum, m) => sum + m.bandwidth, 0) / this.measurements.length
      const avgLatency = this.measurements.reduce((sum, m) => sum + m.latency, 0) / this.measurements.length

      // Determine network condition
      const condition = this.determineNetworkCondition(avgBandwidth, avgLatency)
      this.updateNetworkCondition(condition)

    } catch (error) {
      console.warn('Network assessment failed:', error)
    }
  }

  /**
   * Measure network performance
   */
  private async measureNetworkPerformance(): Promise<{ bandwidth: number; latency: number }> {
    const startTime = Date.now()

    try {
      // Create a small test request to measure latency
      const _response = await fetch('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==', {
        cache: 'no-cache',
        method: 'GET'
      })

      const latency = Date.now() - startTime

      // Estimate bandwidth based on response time and content size
      const contentSize = 100 // bytes (approximate)
      const bandwidth = (contentSize * 1000) / Math.max(latency, 1) // bytes per second

      return { bandwidth, latency }
    } catch (_error) {
      // Fallback to Connection API if available
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        return {
          bandwidth: connection.downlink * 125000, // Convert Mbps to bytes/s
          latency: connection.rtt || 200
        }
      }

      return {
        bandwidth: 1000000, // Default 1 MB/s
        latency: 200
      }
    }
  }

  /**
   * Determine network condition from metrics
   */
  private determineNetworkCondition(bandwidth: number, latency: number): NetworkCondition {
    // Excellent: >10MB/s, <50ms
    if (bandwidth > 10000000 && latency < 50) {
      return {
        type: 'excellent',
        bandwidth,
        latency,
        packetLoss: 0,
        reliability: 0.99
      }
    }

    // Good: 1-10MB/s, 50-150ms
    if (bandwidth > 1000000 && latency < 150) {
      return {
        type: 'good',
        bandwidth,
        latency,
        packetLoss: 0,
        reliability: 0.95
      }
    }

    // Fair: 100KB/s-1MB/s, 150-500ms
    if (bandwidth > 100000 && latency < 500) {
      return {
        type: 'fair',
        bandwidth,
        latency,
        packetLoss: 1,
        reliability: 0.85
      }
    }

    // Poor: <100KB/s, >500ms
    return {
      type: 'poor',
      bandwidth,
      latency,
      packetLoss: 5,
      reliability: 0.7
    }
  }

  /**
   * Update network condition metrics
   */
  private updateNetworkCondition(condition: NetworkCondition): void {
    this.conditionHistory.push(condition)
    if (this.conditionHistory.length > this.maxHistorySize) {
      this.conditionHistory.shift()
    }

    this.metrics.currentCondition = condition
    this.metrics.lastMeasurement = new Date()

    // Update averages
    const recentConditions = this.conditionHistory.slice(-5) // Last 5 measurements
    this.metrics.averageBandwidth = recentConditions.reduce((sum, c) => sum + c.bandwidth, 0) / recentConditions.length
    this.metrics.averageLatency = recentConditions.reduce((sum, c) => sum + c.latency, 0) / recentConditions.length
  }

  /**
   * Get optimized sync configuration for current network
   */
  public getOptimizedConfig(): SyncOptimizationConfig {
    const condition = this.metrics.currentCondition

    switch (condition.type) {
      case 'excellent':
        return {
          batchSize: 100,
          compressionEnabled: false,
          retryAttempts: 2,
          timeoutMs: 5000,
          syncIntervalMs: 10000,    // 10 seconds
          parallelUploads: 5,
          useIncremental: true
        }

      case 'good':
        return {
          batchSize: 50,
          compressionEnabled: true,
          retryAttempts: 3,
          timeoutMs: 10000,
          syncIntervalMs: 30000,    // 30 seconds
          parallelUploads: 3,
          useIncremental: true
        }

      case 'fair':
        return {
          batchSize: 25,
          compressionEnabled: true,
          retryAttempts: 5,
          timeoutMs: 20000,
          syncIntervalMs: 60000,    // 1 minute
          parallelUploads: 2,
          useIncremental: true
        }

      case 'poor':
        return {
          batchSize: 10,
          compressionEnabled: true,
          retryAttempts: 7,
          timeoutMs: 45000,
          syncIntervalMs: 300000,   // 5 minutes
          parallelUploads: 1,
          useIncremental: true
        }

      case 'offline':
        return {
          batchSize: 0,
          compressionEnabled: false,
          retryAttempts: 0,
          timeoutMs: 0,
          syncIntervalMs: 0,
          parallelUploads: 0,
          useIncremental: false
        }

      default:
        return this.getOptimizedConfig() // Recursive call to get default
    }
  }

  /**
   * Simulate network conditions for testing
   */
  public simulateNetworkCondition(condition: Partial<NetworkCondition>, durationMs: number = 60000): void {
    const simulatedCondition: NetworkCondition = {
      type: condition.type || 'good',
      bandwidth: condition.bandwidth || 1000000,
      latency: condition.latency || 100,
      packetLoss: condition.packetLoss || 0,
      reliability: condition.reliability || 0.95
    }

    console.log(`🌐 Simulating ${simulatedCondition.type} network for ${durationMs}ms`)
    this.updateNetworkCondition(simulatedCondition)

    // Reset after duration
    setTimeout(() => {
      console.log('🌐 Ending network simulation, assessing real conditions...')
      this.assessNetworkCondition()
    }, durationMs)
  }

  /**
   * Record sync success/failure for metrics
   */
  public recordSyncResult(success: boolean): void {
    if (success) {
      this.metrics.consecutiveFailures = 0
    } else {
      this.metrics.consecutiveFailures++
    }

    // Update success rate (rolling average)
    const totalRecords = Math.min(this.conditionHistory.length, 20)
    const failedRecords = Math.min(this.metrics.consecutiveFailures, totalRecords)
    this.metrics.successRate = (totalRecords - failedRecords) / totalRecords
  }

  /**
   * Get network metrics
   */
  public getMetrics(): NetworkMetrics {
    return { ...this.metrics }
  }

  /**
   * Get network condition history
   */
  public getConditionHistory(): NetworkCondition[] {
    return [...this.conditionHistory]
  }

  /**
   * Check if sync should be attempted
   */
  public shouldSync(): boolean {
    const condition = this.metrics.currentCondition

    // Don't sync if offline
    if (condition.type === 'offline') {
      return false
    }

    // Don't sync if too many consecutive failures
    if (this.metrics.consecutiveFailures > 5) {
      console.warn('🌐 Too many consecutive failures, pausing sync')
      return false
    }

    // Don't sync if reliability is too low
    if (condition.reliability < 0.5) {
      console.warn('🌐 Network reliability too low, pausing sync')
      return false
    }

    return true
  }

  /**
   * Get adaptive delay before next sync
   */
  public getSyncDelay(): number {
    const config = this.getOptimizedConfig()
    const failureMultiplier = Math.pow(2, Math.min(this.metrics.consecutiveFailures, 5))

    return config.syncIntervalMs * failureMultiplier
  }

  /**
   * Estimate sync duration for given data size
   */
  public estimateSyncDuration(dataSizeBytes: number): number {
    const condition = this.metrics.currentCondition
    const effectiveBandwidth = condition.bandwidth * condition.reliability

    // Add latency overhead
    const latencyOverhead = condition.latency * 2 // Round trip

    // Calculate base duration
    const baseDuration = (dataSizeBytes / effectiveBandwidth) * 1000 + latencyOverhead

    // Add buffer for processing
    return baseDuration * 1.5
  }

  /**
   * Check if compression should be used
   */
  public shouldCompress(dataSizeBytes: number): boolean {
    const config = this.getOptimizedConfig()
    return config.compressionEnabled && dataSizeBytes > 10240 // 10KB threshold
  }

  /**
   * Get recommended batch size for current conditions
   */
  public getRecommendedBatchSize(): number {
    const config = this.getOptimizedConfig()
    return config.batchSize
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      currentCondition: this.getDefaultCondition(),
      averageBandwidth: 0,
      averageLatency: 0,
      successRate: 1,
      lastMeasurement: new Date(),
      consecutiveFailures: 0
    }
    this.conditionHistory = []
    this.measurements = []
  }
}

// Export singleton instance
export const getNetworkOptimizer = () => NetworkOptimizer.getInstance()

// Types are already exported above - no need to re-export