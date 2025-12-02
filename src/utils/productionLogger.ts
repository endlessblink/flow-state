/**
 * Production Logger and Monitoring System
 * Comprehensive logging and monitoring for production sync operations
 */

import type { EnvironmentConfig } from '@/config/environments'
import { currentConfig } from '@/config/environments'

export interface LogEntry {
  id: string
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical'
  category: 'sync' | 'network' | 'database' | 'performance' | 'security' | 'user' | 'monitoring'
  message: string
  data?: any
  userId?: string
  deviceId?: string
  sessionId: string
  stack?: string
  userAgent?: string
  url?: string
}

export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'percent' | 'kbps' | 'rpm'
  timestamp: Date
  tags?: Record<string, string>
}

export interface SyncOperationMetrics {
  operationId: string
  type: 'full_sync' | 'incremental_sync' | 'batch_sync' | 'conflict_resolution'
  startTime: Date
  endTime?: Date
  duration?: number
  documentsProcessed: number
  documentsUploaded: number
  documentsDownloaded: number
  bytesTransferred: number
  conflictsDetected: number
  conflictsResolved: number
  errors: number
  networkCondition?: {
    bandwidth: number
    latency: number
    reliability: number
  }
  success: boolean
  errorMessage?: string
}

export interface SystemHealth {
  timestamp: Date
  syncStatus: 'healthy' | 'degraded' | 'unhealthy'
  lastSuccessfulSync?: Date
  consecutiveFailures: number
  averageResponseTime: number
  errorRate: number
  queueSize: number
  databaseSize: number
  memoryUsage: number
  storageQuota: number
}

export class ProductionLogger {
  private static instance: ProductionLogger
  private logs: LogEntry[] = []
  private metrics: PerformanceMetric[] = []
  private syncMetrics: SyncOperationMetrics[] = []
  private sessionId: string
  private userId?: string
  private deviceId?: string
  private config: EnvironmentConfig
  private flushInterval: ReturnType<typeof setInterval> | null = null
  private remoteEndpoint?: string

  private constructor() {
    this.config = currentConfig
    this.sessionId = this.generateSessionId()
    this.initializeLogging()
  }

  public static getInstance(): ProductionLogger {
    if (!ProductionLogger.instance) {
      ProductionLogger.instance = new ProductionLogger()
    }
    return ProductionLogger.instance
  }

  /**
   * Initialize logging system
   */
  private initializeLogging(): void {
    if (!this.config.logging.enabled) {
      console.log('📝 Logging disabled in current environment')
      return
    }

    // Set up periodic flush to remote storage
    if (this.config.logging.remoteLogging) {
      this.setupRemoteLogging()
    }

    // Set up performance monitoring
    if (this.config.monitoring.enabled) {
      this.setupPerformanceMonitoring()
    }

    console.log(`📝 Production logger initialized (${this.config.mode} mode)`)
  }

  /**
   * Set up remote logging
   */
  private setupRemoteLogging(): void {
    const interval = this.config.monitoring.metricsInterval || 30000

    this.flushInterval = setInterval(() => {
      this.flushLogs()
    }, interval)
  }

  /**
   * Set up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    // Monitor sync operations
    setInterval(() => {
      this.collectSystemMetrics()
    }, this.config.monitoring.healthCheckInterval)

    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory
        this.logMetric('memory_used', memory.usedJSHeapSize, 'bytes')
        this.logMetric('memory_total', memory.totalJSHeapSize, 'bytes')
        this.logMetric('memory_limit', memory.jsHeapSizeLimit, 'bytes')
      }, 60000) // Every minute
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return 'session_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9)
  }

  /**
   * Set user context
   */
  public setUser(userId: string): void {
    this.userId = userId
  }

  /**
   * Set device context
   */
  public setDevice(deviceId: string): void {
    this.deviceId = deviceId
  }

  /**
   * Set remote logging endpoint
   */
  public setRemoteEndpoint(endpoint: string): void {
    this.remoteEndpoint = endpoint
  }

  /**
   * Log a message
   */
  public log(level: LogEntry['level'], category: LogEntry['category'], message: string, data?: any): void {
    if (!this.shouldLog(level)) {
      return
    }

    const entry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      userId: this.userId,
      deviceId: this.deviceId,
      sessionId: this.sessionId,
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    // Add stack trace for errors
    if (level === 'error' || level === 'critical') {
      entry.stack = new Error().stack
    }

    this.logs.push(entry)

    // Maintain log size limit
    if (this.logs.length > this.config.logging.maxLogEntries) {
      this.logs.shift()
    }

    // Console output for development
    if (this.config.mode === 'development') {
      this.consoleLog(entry)
    }

    // Immediate flush for critical errors
    if (level === 'critical' && this.config.logging.remoteLogging) {
      this.flushLogs()
    }
  }

  /**
   * Convenience methods for different log levels
   */
  public debug(category: LogEntry['category'], message: string, data?: any): void {
    this.log('debug', category, message, data)
  }

  public info(category: LogEntry['category'], message: string, data?: any): void {
    this.log('info', category, message, data)
  }

  public warn(category: LogEntry['category'], message: string, data?: any): void {
    this.log('warn', category, message, data)
  }

  public error(category: LogEntry['category'], message: string, data?: any): void {
    this.log('error', category, message, data)
  }

  public critical(category: LogEntry['category'], message: string, data?: any): void {
    this.log('critical', category, message, data)
  }

  /**
   * Log performance metric
   */
  public logMetric(name: string, value: number, unit: PerformanceMetric['unit'], tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    }

    this.metrics.push(metric)

    // Maintain metrics size limit
    if (this.metrics.length > 1000) {
      this.metrics.shift()
    }
  }

  /**
   * Start tracking a sync operation
   */
  public startSyncOperation(
    type: SyncOperationMetrics['type'],
    operationId?: string
  ): SyncOperationMetrics {
    const operation: SyncOperationMetrics = {
      operationId: operationId || this.generateOperationId(),
      type,
      startTime: new Date(),
      documentsProcessed: 0,
      documentsUploaded: 0,
      documentsDownloaded: 0,
      bytesTransferred: 0,
      conflictsDetected: 0,
      conflictsResolved: 0,
      errors: 0,
      success: false
    }

    this.syncMetrics.push(operation)
    return operation
  }

  /**
   * Update sync operation progress
   */
  public updateSyncOperation(
    operationId: string,
    updates: Partial<SyncOperationMetrics>
  ): void {
    const operation = this.syncMetrics.find(op => op.operationId === operationId)
    if (operation) {
      Object.assign(operation, updates)
    }
  }

  /**
   * Complete a sync operation
   */
  public completeSyncOperation(
    operationId: string,
    success: boolean,
    errorMessage?: string
  ): void {
    const operation = this.syncMetrics.find(op => op.operationId === operationId)
    if (operation) {
      operation.endTime = new Date()
      operation.duration = operation.endTime.getTime() - operation.startTime.getTime()
      operation.success = success
      operation.errorMessage = errorMessage

      // Log completion
      const level = success ? 'info' : 'error'
      const category = 'sync'
      const message = success ? 'Sync operation completed successfully' : 'Sync operation failed'
      const data = {
        operationId,
        duration: operation.duration,
        documentsProcessed: operation.documentsProcessed,
        type: operation.type,
        success
      }

      this.log(level, category, message, data)

      // Log performance metrics
      if (success) {
        this.logMetric('sync_duration', operation.duration, 'ms', {
          type: operation.type
        })
        this.logMetric('sync_documents', operation.documentsProcessed, 'count')
        this.logMetric('sync_bytes', operation.bytesTransferred, 'bytes')
      }
    }
  }

  /**
   * Get system health metrics
   */
  public async getSystemHealth(): Promise<SystemHealth> {
    const recentLogs = this.logs.filter(log =>
      log.timestamp.getTime() > Date.now() - 300000 // Last 5 minutes
    )

    const recentErrors = recentLogs.filter(log => log.level === 'error' || log.level === 'critical')
    const recentSyncOps = this.syncMetrics.filter(op =>
      op.startTime.getTime() > Date.now() - 300000
    )

    const lastSuccessfulSync = recentSyncOps
      .filter(op => op.success)
      .sort((a, b) => b.endTime?.getTime() || 0 - (a.endTime?.getTime() || 0))[0]?.endTime

    const consecutiveFailures = this.getConsecutiveFailures()
    const averageResponseTime = this.getAverageResponseTime()
    const errorRate = recentLogs.length > 0 ? (recentErrors.length / recentLogs.length) * 100 : 0

    // Get database size (approximation)
    const databaseSize = await this.getDatabaseSize()

    let syncStatus: SystemHealth['syncStatus'] = 'healthy'
    if (errorRate > 10 || consecutiveFailures > 3) {
      syncStatus = 'unhealthy'
    } else if (errorRate > 5 || consecutiveFailures > 1) {
      syncStatus = 'degraded'
    }

    const memoryUsage = (performance as any).memory?.usedJSHeapSize || 0
    const storageQuota = await this.getStorageQuota()

    return {
      timestamp: new Date(),
      syncStatus,
      lastSuccessfulSync,
      consecutiveFailures,
      averageResponseTime,
      errorRate,
      queueSize: 0, // Would be populated by sync manager
      databaseSize,
      memoryUsage,
      storageQuota
    }
  }

  /**
   * Get logs for a specific time range and level
   */
  public getLogs(options: {
    level?: LogEntry['level']
    category?: LogEntry['category']
    since?: Date
    limit?: number
  } = {}): LogEntry[] {
    let filteredLogs = [...this.logs]

    if (options.level) {
      filteredLogs = filteredLogs.filter(log => log.level === options.level)
    }

    if (options.category) {
      filteredLogs = filteredLogs.filter(log => log.category === options.category)
    }

    if (options.since) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= options.since!)
    }

    if (options.limit) {
      filteredLogs = filteredLogs.slice(-options.limit)
    }

    return filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Get metrics for analysis
   */
  public getMetrics(name?: string, since?: Date): PerformanceMetric[] {
    let filteredMetrics = [...this.metrics]

    if (name) {
      filteredMetrics = filteredMetrics.filter(metric => metric.name === name)
    }

    if (since) {
      filteredMetrics = filteredMetrics.filter(metric => metric.timestamp >= since)
    }

    return filteredMetrics
  }

  /**
   * Flush logs to remote storage
   */
  private async flushLogs(): Promise<void> {
    if (!this.config.logging.remoteLogging || !this.remoteEndpoint) {
      return
    }

    try {
      const payload = {
        logs: this.logs,
        metrics: this.metrics,
        syncMetrics: this.syncMetrics,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      }

      const response = await fetch(this.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        // Clear logs that were successfully sent
        this.logs = []
        this.metrics = []
        // Keep recent sync metrics for analysis
        this.syncMetrics = this.syncMetrics.filter(metric =>
          metric.startTime.getTime() > Date.now() - 3600000 // Keep last hour
        )
      }

    } catch (error) {
      console.warn('⚠️ Failed to flush logs to remote storage:', error)
    }
  }

  /**
   * Check if log should be recorded based on current log level
   */
  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'critical']
    const currentLevelIndex = levels.indexOf(this.config.logging.level)
    const logLevelIndex = levels.indexOf(level)

    return logLevelIndex >= currentLevelIndex
  }

  /**
   * Console log with formatting
   */
  private consoleLog(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString()
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`

    switch (entry.level) {
      case 'debug':
        console.debug(prefix, entry.message, entry.data)
        break
      case 'info':
        console.info(prefix, entry.message, entry.data)
        break
      case 'warn':
        console.warn(prefix, entry.message, entry.data)
        break
      case 'error':
      case 'critical':
        console.error(prefix, entry.message, entry.data, entry.stack)
        break
    }
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9)
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return 'op_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9)
  }

  /**
   * Get authentication token for remote logging
   */
  private getAuthToken(): string {
    // This should be implemented based on your auth system
    return localStorage.getItem('auth_token') || ''
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const connection = (navigator as any).connection
    if (connection) {
      this.logMetric('network_bandwidth', connection.downlink, 'kbps')
      this.logMetric('network_rtt', connection.rtt, 'ms')
    }

    // Battery API if available
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.logMetric('battery_level', battery.level * 100, 'percent')
        this.logMetric('battery_charging', battery.charging ? 1 : 0, 'count')
      })
    }
  }

  /**
   * Get consecutive failures count
   */
  private getConsecutiveFailures(): number {
    const recentSyncs = this.syncMetrics
      .sort((a, b) => b.endTime?.getTime() || 0 - (a.endTime?.getTime() || 0))
      .slice(0, 10)

    let failures = 0
    for (const sync of recentSyncs) {
      if (!sync.success) {
        failures++
      } else {
        break
      }
    }

    return failures
  }

  /**
   * Get average response time
   */
  private getAverageResponseTime(): number {
    const responseTimeMetrics = this.metrics.filter(m => m.name === 'response_time')
    if (responseTimeMetrics.length === 0) return 0

    const total = responseTimeMetrics.reduce((sum, metric) => sum + metric.value, 0)
    return total / responseTimeMetrics.length
  }

  /**
   * Get database size (approximation)
   */
  private async getDatabaseSize(): Promise<number> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        return estimate.usage || 0
      }
    } catch (error) {
      console.warn('Could not get storage estimate:', error)
    }
    return 0
  }

  /**
   * Get storage quota
   */
  private async getStorageQuota(): Promise<number> {
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate()
        return estimate.quota || 0
      }
    } catch (error) {
      console.warn('Could not get storage quota:', error)
    }
    return 0
  }

  /**
   * Cleanup and destroy logger
   */
  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
    }

    // Final flush
    if (this.config.logging.remoteLogging) {
      this.flushLogs()
    }

    // Clear data
    this.logs = []
    this.metrics = []
    this.syncMetrics = []
  }
}

// Export singleton instance
export const getLogger = () => ProductionLogger.getInstance()

// Export types
// Types already exported as interfaces above