/**
 * Sync Validation Service
 *
 * Global service for real-time task filtering consistency monitoring
 * across all views in the Pomo-Flow application.
 */

import { ref, computed } from 'vue'
import type { Task } from '@/stores/tasks'
import { createGlobalSyncValidation } from '@/composables/useRealTimeSyncValidation'

export interface SyncValidationEvent {
  id: string
  timestamp: Date
  type: 'validation_started' | 'validation_completed' | 'mismatch_detected' | 'mismatch_resolved'
  data: any
}

export interface SyncValidationMetrics {
  totalValidations: number
  totalMismatches: number
  averageValidationTime: number
  mostCommonIssues: Array<{
    type: string
    count: number
    lastOccurrence: Date
  }>
  viewHealthScores: Record<string, number>
}

export class SyncValidationService {
  private static instance: SyncValidationService | null = null
  private validationInstance: ReturnType<typeof createGlobalSyncValidation> | null = null
  private eventHistory: SyncValidationEvent[] = []
  private metrics: SyncValidationMetrics = {
    totalValidations: 0,
    totalMismatches: 0,
    averageValidationTime: 0,
    mostCommonIssues: [],
    viewHealthScores: {}
  }

  private readonly maxEventHistory = 100

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SyncValidationService {
    if (!SyncValidationService.instance) {
      SyncValidationService.instance = new SyncValidationService()
    }
    return SyncValidationService.instance
  }

  /**
   * Initialize validation service with task data
   */
  initialize(tasks: Task[] | Parameters<typeof createGlobalSyncValidation>[0]): void {
    if (this.validationInstance) {
      console.warn('SyncValidationService already initialized')
      return
    }

    this.logEvent('validation_started', { taskCount: Array.isArray(tasks) ? tasks.length : tasks.value?.length || 0 })

    this.validationInstance = createGlobalSyncValidation(tasks, {
      enabled: true,
      monitoringInterval: 3000,
      maxHistorySize: 50,
      strictMode: false,
      enableAutoHealing: false,
      visualFeedback: true,
      logToConsole: true
    })

    // Set up monitoring for validation results
    this.setupResultMonitoring()

    console.log('✅ [SYNC_VALIDATION_SERVICE] Initialized successfully')
  }

  /**
   * Set up monitoring for validation results
   */
  private setupResultMonitoring(): void {
    if (!this.validationInstance) return

    // Monitor validation state changes
    const validationStateWatcher = computed(() => ({
      isValid: this.validationInstance?.isValid.value,
      isMonitoring: this.validationInstance?.isMonitoring.value,
      totalMismatches: this.validationInstance?.validationState.value.totalMismatches || 0,
      errorCount: this.validationInstance?.validationState.value.errorCount || 0,
      warningCount: this.validationInstance?.validationState.value.warningCount || 0
    }))

    // Watch for validation changes
    let previousState = validationStateWatcher.value
    const checkInterval = setInterval(() => {
      const currentState = validationStateWatcher.value

      if (currentState !== previousState) {
        this.handleValidationStateChange(previousState, currentState)
        previousState = currentState
      }
    }, 1000)

    // Cleanup on service destruction
    this.setupCleanup(() => clearInterval(checkInterval))
  }

  /**
   * Handle validation state changes
   */
  private handleValidationStateChange(
    previous: any,
    current: any
  ): void {
    // Log new mismatches
    if (current.totalMismatches > previous.totalMismatches) {
      this.logEvent('mismatch_detected', {
        currentCount: current.totalMismatches,
        previousCount: previous.totalMismatches,
        newMismatches: current.totalMismatches - previous.totalMismatches
      })

      this.updateMetrics()
    }

    // Log resolved mismatches
    if (current.totalMismatches < previous.totalMismatches) {
      this.logEvent('mismatch_resolved', {
        currentCount: current.totalMismatches,
        previousCount: previous.totalMismatches,
        resolvedMismatches: previous.totalMismatches - current.totalMismatches
      })
    }

    this.logEvent('validation_completed', {
      isValid: current.isValid,
      totalMismatches: current.totalMismatches,
      errorCount: current.errorCount,
      warningCount: current.warningCount
    })

    this.metrics.totalValidations++
  }

  /**
   * Update service metrics
   */
  private updateMetrics(): void {
    if (!this.validationInstance) return

    const mismatches = this.validationInstance.mismatches.value
    this.metrics.totalMismatches = mismatches.length

    // Calculate most common issues
    const issueCounts = mismatches.reduce((acc, mismatch) => {
      acc[mismatch.type] = (acc[mismatch.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    this.metrics.mostCommonIssues = Object.entries(issueCounts)
      .map(([type, count]) => ({
        type,
        count,
        lastOccurrence: Math.max(...mismatches
          .filter(m => m.type === type)
          .map(m => m.timestamp.getTime())
        ) > 0 ? new Date(Math.max(...mismatches
          .filter(m => m.type === type)
          .map(m => m.timestamp.getTime())
        )) : new Date()
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Calculate view health scores (0-100)
    const viewHealth: Record<string, number> = {}
    const monitoredViews = ['Board', 'Today', 'Inbox', 'Canvas']

    monitoredViews.forEach(view => {
      const viewMismatches = mismatches.filter(m => m.affectedViews.includes(view))
      const errorCount = viewMismatches.filter(m => m.severity === 'error').length
      const warningCount = viewMismatches.filter(m => m.severity === 'warning').length

      // Health score: 100 - (errors * 20) - (warnings * 5)
      let healthScore = 100 - (errorCount * 20) - (warningCount * 5)
      healthScore = Math.max(0, Math.min(100, healthScore))

      viewHealth[view] = healthScore
    })

    this.metrics.viewHealthScores = viewHealth
  }

  /**
   * Log an event to the history
   */
  private logEvent(type: SyncValidationEvent['type'], data: any): void {
    const event: SyncValidationEvent = {
      id: `sync_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      data
    }

    this.eventHistory.push(event)

    // Maintain history size limit
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxEventHistory)
    }
  }

  /**
   * Get current validation status
   */
  getStatus() {
    if (!this.validationInstance) {
      return {
        isInitialized: false,
        isMonitoring: false,
        isValid: false,
        message: 'Validation service not initialized'
      }
    }

    return {
      isInitialized: true,
      isMonitoring: this.validationInstance.isMonitoring.value,
      isValid: this.validationInstance.isValid.value,
      summary: this.validationInstance.validationSummary.value,
      state: this.validationInstance.validationState.value
    }
  }

  /**
   * Get validation metrics
   */
  getMetrics(): SyncValidationMetrics {
    this.updateMetrics()
    return { ...this.metrics }
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 20): SyncValidationEvent[] {
    return this.eventHistory.slice(-limit).reverse()
  }

  /**
   * Get latest mismatches
   */
  getLatestMismatches(severity?: 'error' | 'warning' | 'info', limit: number = 10) {
    if (!this.validationInstance) return []
    return this.validationInstance.getLatestMismatches(severity, limit)
  }

  /**
   * Force validation run
   */
  async performValidation(): Promise<void> {
    if (!this.validationInstance) {
      throw new Error('Validation service not initialized')
    }

    const startTime = performance.now()
    this.validationInstance.performValidation()

    const validationTime = performance.now() - startTime
    this.metrics.averageValidationTime =
      (this.metrics.averageValidationTime * (this.metrics.totalValidations - 1) + validationTime) /
      this.metrics.totalValidations
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    if (!this.validationInstance) {
      throw new Error('Validation service not initialized')
    }

    this.validationInstance.startMonitoring()
    this.logEvent('validation_started', { action: 'start_monitoring' })
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.validationInstance) return

    this.validationInstance.stopMonitoring()
    this.logEvent('validation_completed', { action: 'stop_monitoring' })
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    if (!this.validationInstance) return

    this.validationInstance.clearHistory()
    this.eventHistory = []
    this.metrics = {
      totalValidations: 0,
      totalMismatches: 0,
      averageValidationTime: 0,
      mostCommonIssues: [],
      viewHealthScores: {}
    }

    this.logEvent('validation_completed', { action: 'clear_history' })
  }

  /**
   * Setup cleanup function
   */
  private setupCleanup(cleanupFn: () => void): void {
    // Store cleanup functions for service destruction
    if (!this.cleanupFunctions) {
      this.cleanupFunctions = []
    }
    this.cleanupFunctions.push(cleanupFn)
  }

  private cleanupFunctions: (() => void)[] = []

  /**
   * Destroy the service and cleanup resources
   */
  destroy(): void {
    if (this.validationInstance) {
      this.validationInstance.stopMonitoring()
      this.validationInstance = null
    }

    // Run all cleanup functions
    this.cleanupFunctions.forEach(fn => fn())
    this.cleanupFunctions = []

    this.eventHistory = []
    this.metrics = {
      totalValidations: 0,
      totalMismatches: 0,
      averageValidationTime: 0,
      mostCommonIssues: [],
      viewHealthScores: {}
    }

    SyncValidationService.instance = null
    console.log('🗑️ [SYNC_VALIDATION_SERVICE] Service destroyed')
  }

  /**
   * Export service data for debugging
   */
  exportDebugData(): {
    metrics: SyncValidationMetrics
    events: SyncValidationEvent[]
    status: any
    mismatches: any[]
  } {
    return {
      metrics: this.getMetrics(),
      events: this.getRecentEvents(50),
      status: this.getStatus(),
      mismatches: this.getLatestMismatches()
    }
  }
}

/**
 * Get the global sync validation service instance
 */
export const getSyncValidationService = (): SyncValidationService => {
  return SyncValidationService.getInstance()
}