/**
 * Vue Flow Error Handling System
 * Provides comprehensive error handling, recovery strategies, and user feedback for Vue Flow operations
 */

import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'

// Type alias for VueFlow severity
type VueFlowSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface VueFlowError {
  id: string
  type: 'validation' | 'rendering' | 'interaction' | 'state' | 'performance' | 'network'
  message: string
  details?: any
  timestamp: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  recoverable: boolean
  recovered: boolean
  attempts: number
}

export interface ErrorRecoveryStrategy {
  type: 'retry' | 'fallback' | 'reset' | 'skip' | 'user-intervention'
  description: string
  execute: () => Promise<boolean>
  maxAttempts?: number
}

export interface ErrorHandlingConfig {
  enableAutoRecovery?: boolean
  maxRetryAttempts?: number
  enableUserNotifications?: boolean
  enableErrorLogging?: boolean
  enablePerformanceMonitoring?: boolean
}

/**
 * Vue Flow Error Handler
 */
export function useVueFlowErrorHandling(config: ErrorHandlingConfig = {}) {
  const {
    enableAutoRecovery = true,
    maxRetryAttempts = 3,
    enableUserNotifications = true,
    enableErrorLogging = true,
    enablePerformanceMonitoring = false
  } = config

  // State
  const errors = ref<VueFlowError[]>([])
  const isRecovering = ref(false)
  const lastErrorTime = ref(0)
  const errorCount = ref(0)

  // Message system for user notifications
  const message = useMessage()

  // Error statistics
  const errorStats = ref({
    total: 0,
    byType: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    recovered: 0,
    unrecovered: 0
  })

  // Recovery strategies
  const recoveryStrategies = ref<Map<string, ErrorRecoveryStrategy[]>>(new Map())

  // Computed properties
  const hasErrors = computed(() => errors.value.length > 0)
  const hasUnrecoverableErrors = computed(() =>
    errors.value.some(e => !e.recoverable && !e.recovered)
  )
  const criticalErrors = computed(() =>
    errors.value.filter(e => e.severity === 'critical')
  )
  const recentErrors = computed(() =>
    errors.value.filter(e => Date.now() - e.timestamp < 60000) // Last minute
  )

  /**
   * Initialize error handling system
   */
  const initialize = () => {
    console.log('🔧 [VUE_FLOW_ERROR] Initializing error handling system...')

    // Set up global error handlers
    setupGlobalErrorHandlers()

    // Set up recovery strategies
    setupRecoveryStrategies()

    // Set up performance monitoring
    if (enablePerformanceMonitoring) {
      setupPerformanceMonitoring()
    }

    console.log('✅ [VUE_FLOW_ERROR] Error handling system initialized')
  }

  /**
   * Set up global error handlers
   */
  const setupGlobalErrorHandlers = () => {
    if (typeof window !== 'undefined') {
      // Handle uncaught errors
      window.addEventListener('error', (event) => {
        if (isVueFlowRelatedError(event)) {
          handleError({
            id: generateErrorId(),
            type: 'rendering',
            message: event.message || 'Unknown error',
            details: {
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
              stack: event.error?.stack
            },
            timestamp: Date.now(),
            severity: 'high',
            recoverable: true,
            recovered: false,
            attempts: 0
          })
        }
      })

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        if (isVueFlowRelatedError(event)) {
          handleError({
            id: generateErrorId(),
            type: 'state',
            message: event.reason?.message || 'Unhandled promise rejection',
            details: event.reason,
            timestamp: Date.now(),
            severity: 'high',
            recoverable: true,
            recovered: false,
            attempts: 0
          })
        }
      })
    }
  }

  /**
   * Set up recovery strategies
   */
  const setupRecoveryStrategies = () => {
    // Node validation errors
    recoveryStrategies.value.set('validation-node-invalid', [
      {
        type: 'retry',
        description: 'Retry node validation',
        execute: async () => {
          console.log('🔄 [VUE_FLOW_ERROR] Retrying node validation...')
          return true // Implementation specific to validation context
        },
        maxAttempts: 2
      },
      {
        type: 'fallback',
        description: 'Skip invalid node',
        execute: async () => {
          console.log('⏭️ [VUE_FLOW_ERROR] Skipping invalid node')
          return true
        }
      }
    ])

    // Edge connection errors
    recoveryStrategies.value.set('interaction-edge-connection', [
      {
        type: 'retry',
        description: 'Retry edge connection',
        execute: async () => {
          console.log('🔄 [VUE_FLOW_ERROR] Retrying edge connection...')
          return true
        },
        maxAttempts: 2
      },
      {
        type: 'fallback',
        description: 'Skip edge creation',
        execute: async () => {
          console.log('⏭️ [VUE_FLOW_ERROR] Skipping edge creation')
          return true
        }
      }
    ])

    // Rendering errors
    recoveryStrategies.value.set('rendering-canvas-failure', [
      {
        type: 'reset',
        description: 'Reset canvas viewport',
        execute: async () => {
          console.log('🔄 [VUE_FLOW_ERROR] Resetting canvas viewport...')
          // Implementation specific to canvas reset
          return true
        }
      },
      {
        type: 'retry',
        description: 'Retry rendering',
        execute: async () => {
          console.log('🔄 [VUE_FLOW_ERROR] Retrying canvas rendering...')
          return true
        },
        maxAttempts: 3
      }
    ])

    // Performance errors
    recoveryStrategies.value.set('performance-overload', [
      {
        type: 'fallback',
        description: 'Reduce canvas complexity',
        execute: async () => {
          console.log('⚡ [VUE_FLOW_ERROR] Reducing canvas complexity...')
          // Implementation to reduce node count or complexity
          return true
        }
      }
    ])
  }

  /**
   * Set up performance monitoring
   */
  const setupPerformanceMonitoring = () => {
    // Monitor memory usage
    if (typeof window !== 'undefined' && 'performance' in window && 'memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory
        if (memory && memory.usedJSHeapSize > 100 * 1024 * 1024) { // 100MB
          console.warn('⚠️ [VUE_FLOW_ERROR] High memory usage detected:', Math.round(memory.usedJSHeapSize / 1024 / 1024) + 'MB')
        }
      }, 30000) // Every 30 seconds
    }

    // Monitor frame rate
    let frameCount = 0
    let lastFrameTime = performance.now()

    const measureFrameRate = () => {
      frameCount++
      const currentTime = performance.now()
      const deltaTime = currentTime - lastFrameTime

      if (deltaTime >= 1000) { // Every second
        const fps = Math.round((frameCount * 1000) / deltaTime)
        frameCount = 0
        lastFrameTime = currentTime

        if (fps < 30) {
          console.warn(`⚠️ [VUE_FLOW_ERROR] Low FPS detected: ${fps}`)
          handleError({
            id: generateErrorId(),
            type: 'performance',
            message: `Low frame rate: ${fps} FPS`,
            details: { fps },
            timestamp: Date.now(),
            severity: 'medium',
            recoverable: true,
            recovered: false,
            attempts: 0
          })
        }
      }

      requestAnimationFrame(measureFrameRate)
    }

    requestAnimationFrame(measureFrameRate)
  }

  /**
   * Check if error is Vue Flow related
   */
  const isVueFlowRelatedError = (event: any): boolean => {
    const errorString = String(event.error?.message || event.reason?.message || event.message || '')
    const filename = event.filename || ''

    return (
      errorString.includes('vue-flow') ||
      errorString.includes('canvas') ||
      errorString.includes('node') ||
      errorString.includes('edge') ||
      filename.includes('vue-flow') ||
      filename.includes('CanvasView')
    )
  }

  /**
   * Generate unique error ID
   */
  const generateErrorId = (): string => {
    return `vue-flow-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Handle new error
   */
  const handleError = async (error: VueFlowError) => {
    console.error('❌ [VUE_FLOW_ERROR] New error:', error)

    // Add to errors list
    errors.value.push(error)

    // Update statistics
    errorCount.value++
    errorStats.value.total++
    errorStats.value.byType[error.type] = (errorStats.value.byType[error.type] || 0) + 1
    errorStats.value.bySeverity[error.severity] = (errorStats.value.bySeverity[error.severity] || 0) + 1

    lastErrorTime.value = Date.now()

    // Log error if enabled
    if (enableErrorLogging) {
      logError(error)
    }

    // Show user notification for critical errors
    if (enableUserNotifications && error.severity === 'critical') {
      showUserNotification(error)
    }

    // Attempt recovery if enabled
    if (enableAutoRecovery && error.recoverable && !error.recovered) {
      await attemptRecovery(error)
    }

    return error
  }

  /**
   * Log error details
   */
  const logError = (error: VueFlowError) => {
    const _logData = {
      id: error.id,
      type: error.type,
      message: error.message,
      severity: error.severity,
      timestamp: new Date(error.timestamp).toISOString(),
      details: error.details,
      attempts: error.attempts,
      recoverable: error.recoverable
    }

    console.group(`📝 [VUE_FLOW_ERROR] ${error.type.toUpperCase()} - ${error.id}`)
    console.log('Message:', error.message)
    console.log('Severity:', error.severity)
    console.log('Details:', error.details)
    console.log('Attempts:', error.attempts)
    console.log('Recoverable:', error.recoverable)
    console.groupEnd()
  }

  /**
   * Show user notification
   */
  const showUserNotification = (error: VueFlowError) => {
    const notificationType = error.severity === 'critical' ? 'error' : 'warning'
    const duration = error.severity === 'critical' ? 0 : 5000

    ;(message as any)[notificationType]({
      content: error.message,
      duration,
      closable: true,
      keepAliveOnHover: true
    } as any)
  }

  /**
   * Attempt error recovery
   */
  const attemptRecovery = async (error: VueFlowError): Promise<boolean> => {
    if (isRecovering.value) {
      return false
    }

    isRecovering.value = true
    error.attempts++

    try {
      // Get recovery strategies for this error type
      const strategies = recoveryStrategies.value.get(`${error.type}-${error.id}`) ||
                       recoveryStrategies.value.get(error.type) ||
                       []

      if (strategies.length === 0) {
        console.warn(`⚠️ [VUE_FLOW_ERROR] No recovery strategies for error type: ${error.type}`)
        return false
      }

      // Try each strategy in order
      for (const strategy of strategies) {
        console.log(`🔄 [VUE_FLOW_ERROR] Trying recovery strategy: ${strategy.description}`)

        const maxAttempts = strategy.maxAttempts || maxRetryAttempts
        if (error.attempts > maxAttempts) {
          console.log(`⏭️ [VUE_FLOW_ERROR] Max attempts reached for strategy: ${strategy.description}`)
          continue
        }

        try {
          const success = await strategy.execute()
          if (success) {
            error.recovered = true
            errorStats.value.recovered++

            console.log(`✅ [VUE_FLOW_ERROR] Recovery successful: ${strategy.description}`)

            // Show success notification
            if (enableUserNotifications) {
              (message as any).success({
                content: `Recovered: ${error.message}`,
                duration: 3000
              } as any)
            }

            return true
          }
        } catch (recoveryError) {
          console.error(`❌ [VUE_FLOW_ERROR] Recovery strategy failed: ${strategy.description}`, recoveryError)
        }
      }

      console.error(`💀 [VUE_FLOW_ERROR] All recovery strategies failed for error: ${error.id}`)
      errorStats.value.unrecovered++

      return false
    } catch (recoveryError) {
      console.error('❌ [VUE_FLOW_ERROR] Recovery process failed:', recoveryError)
      return false
    } finally {
      isRecovering.value = false
    }
  }

  /**
   * Create error handler wrapper
   */
  const createErrorHandler = <T extends any[], R>(
    name: string,
    fn: (...args: T) => R,
    options?: {
      errorType?: VueFlowError['type']
      severity?: VueFlowSeverity
      recoverable?: boolean
    }
  ) => {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args)
      } catch (error) {
        const vueFlowError: VueFlowError = {
          id: generateErrorId(),
          type: options?.errorType || 'interaction',
          message: `${name}: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
          timestamp: Date.now(),
          severity: options?.severity || 'medium',
          recoverable: options?.recoverable ?? true,
          recovered: false,
          attempts: 0
        }

        await handleError(vueFlowError)

        // Re-throw critical errors
        if (vueFlowError.severity === 'critical') {
          throw error
        }

        // Return null for non-critical errors
        return null as R
      }
    }
  }

  /**
   * Add custom recovery strategy
   */
  const addRecoveryStrategy = (
    errorKey: string,
    strategy: ErrorRecoveryStrategy
  ) => {
    const strategies = recoveryStrategies.value.get(errorKey) || []
    strategies.push(strategy)
    recoveryStrategies.value.set(errorKey, strategies)
  }

  /**
   * Clear errors
   */
  const clearErrors = () => {
    errors.value = []
    errorCount.value = 0
    console.log('🗑️ [VUE_FLOW_ERROR] All errors cleared')
  }

  /**
   * Clear old errors (older than specified time)
   */
  const clearOldErrors = (maxAge: number = 300000) => { // 5 minutes
    const cutoff = Date.now() - maxAge
    const oldCount = errors.value.length
    errors.value = errors.value.filter(error => error.timestamp > cutoff)
    const removedCount = oldCount - errors.value.length

    if (removedCount > 0) {
      console.log(`🗑️ [VUE_FLOW_ERROR] Cleared ${removedCount} old errors`)
    }
  }

  /**
   * Get error summary
   */
  const getErrorSummary = () => {
    return {
      total: errorStats.value.total,
      byType: { ...errorStats.value.byType },
      bySeverity: { ...errorStats.value.bySeverity },
      recovered: errorStats.value.recovered,
      unrecovered: errorStats.value.unrecovered,
      current: errors.value.length,
      recent: recentErrors.value.length,
      critical: criticalErrors.value.length,
      recoverable: errors.value.filter(e => e.recoverable && !e.recovered).length
    }
  }

  /**
   * Generate error report
   */
  const generateErrorReport = () => {
    const summary = getErrorSummary()

    return {
      summary,
      errors: errors.value.map(error => ({
        id: error.id,
        type: error.type,
        message: error.message,
        severity: error.severity,
        recoverable: error.recoverable,
        recovered: error.recovered,
        attempts: error.attempts,
        timestamp: new Date(error.timestamp).toISOString(),
        details: error.details
      })),
      generatedAt: new Date().toISOString(),
      recommendations: generateRecommendations(summary)
    }
  }

  /**
   * Generate recommendations based on error patterns
   */
  const generateRecommendations = (summary: any) => {
    const recommendations: string[] = []

    if (summary.byType.validation > 5) {
      recommendations.push('Consider improving data validation before creating nodes/edges')
    }

    if (summary.byType.performance > 3) {
      recommendations.push('Consider optimizing canvas performance or reducing complexity')
    }

    if (summary.uncovered > 0) {
      recommendations.push('Review unrecoverable errors and implement manual fixes')
    }

    if (summary.critical > 0) {
      recommendations.push('Address critical errors immediately to prevent data loss')
    }

    return recommendations
  }

  /**
   * Cleanup function
   */
  const cleanup = () => {
    clearErrors()
    recoveryStrategies.value.clear()
    console.log('🧹 [VUE_FLOW_ERROR] Error handling cleanup completed')
  }

  return {
    // State
    errors: computed(() => errors.value),
    isRecovering: computed(() => isRecovering.value),
    hasErrors,
    hasUnrecoverableErrors,
    criticalErrors,
    recentErrors,
    errorStats: computed(() => errorStats.value),

    // Actions
    initialize,
    handleError,
    createErrorHandler,
    addRecoveryStrategy,
    clearErrors,
    clearOldErrors,

    // Utilities
    getErrorSummary,
    generateErrorReport,
    cleanup
  }
}