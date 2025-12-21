/**
 * Retry Manager with Exponential Backoff
 * Automatically retries failed operations with intelligent error handling
 */

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number      // Base delay in milliseconds
  maxDelay: number       // Maximum delay in milliseconds
  backoffFactor: number // Multiplier for delay increase
  jitter: boolean        // Add random jitter to prevent thundering herd
  nonRetryableErrors?: (error: unknown) => boolean
}

export interface RetryAttempt {
  attempt: number
  timestamp: Date
  delay: number
  error?: unknown
  success: boolean
}

export interface RetryResult<T = unknown> {
  success: boolean
  value?: T
  error?: Error
  attempts: RetryAttempt[]
  totalDuration: number
}

export class RetryManager {
  private config: RetryConfig
  private attemptHistory: Map<string, RetryAttempt[]> = new Map()

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxAttempts: 3,
      baseDelay: 1000,    // 1 second
      maxDelay: 30000,    // 30 seconds
      backoffFactor: 2,
      jitter: true,
      nonRetryableErrors: this.defaultNonRetryableErrors,
      ...config
    }

    console.log('🔄 RetryManager initialized:', this.config)
  }

  /**
   * Execute an operation with automatic retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context: Record<string, unknown> = {}
  ): Promise<RetryResult<T>> {
    const operationId = this.generateOperationId(operationName, context)
    const attempts: RetryAttempt[] = []
    let lastError: Error | null = null
    const startTime = Date.now()

    console.log(`🔄 Executing ${operationName} (attempt 1/${this.config.maxAttempts})`)

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        const attemptStart = Date.now()
        const result = await operation()
        const attemptDuration = Date.now() - attemptStart

        // Record successful attempt
        attempts.push({
          attempt,
          timestamp: new Date(),
          delay: 0,
          success: true
        })

        // Store in history
        this.attemptHistory.set(operationId, attempts)

        if (attempt > 1) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt} (${attemptDuration}ms)`)
        }

        return {
          success: true,
          value: result,
          attempts,
          totalDuration: Date.now() - startTime
        }

      } catch (error) {
        lastError = error as Error
        const _attemptDuration = Date.now() - startTime
        const delay = this.calculateDelay(attempt)

        // Record failed attempt
        attempts.push({
          attempt,
          timestamp: new Date(),
          delay,
          error,
          success: false
        })

        console.warn(`❌ ${operationName} failed on attempt ${attempt}:`, this.formatError(error))

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          console.error(`🚫 ${operationName} failed with non-retryable error:`, this.formatError(error))
          break
        }

        // Don't wait after the last attempt
        if (attempt < this.config.maxAttempts) {
          console.log(`⏳ Waiting ${delay}ms before retry...`)
          await this.sleep(delay)
        }
      }
    }

    console.error(`💥 ${operationName} failed after ${this.config.maxAttempts} attempts (${Date.now() - startTime}ms total)`)
    this.attemptHistory.set(operationId, attempts)

    return {
      success: false,
      error: lastError || new Error('Operation failed'),
      attempts,
      totalDuration: Date.now() - startTime
    }
  }

  /**
   * Execute multiple operations with retry, returning aggregated results
   */
  async executeMultipleWithRetry<T>(
    operations: Array<{ operation: () => Promise<T>; name: string; context?: Record<string, unknown> }>
  ): Promise<{ results: RetryResult<T>[]; summary: { successful: number; failed: number; totalDuration: number } }> {
    const results: RetryResult<T>[] = []
    let successful = 0
    let failed = 0
    const startTime = Date.now()

    console.log(`🔄 Executing ${operations.length} operations with retry logic`)

    for (let i = 0; i < operations.length; i++) {
      const { operation, name, context } = operations[i]
      console.log(`🔄 Processing operation ${i + 1}/${operations.length}: ${name}`)

      try {
        const result = await this.executeWithRetry(operation, name, context)
        results.push(result)

        if (result.success) {
          successful++
          console.log(`✅ Operation ${name} succeeded`)
        } else {
          failed++
          console.error(`❌ Operation ${name} failed after ${result.attempts.length} attempts`)
        }
      } catch (error) {
        console.error(`💥 Operation ${name} threw unexpected error:`, error)
        failed++
        results.push({
          success: false,
          error: error as Error,
          attempts: [],
          totalDuration: 0
        })
      }
    }

    const totalDuration = Date.now() - startTime
    const summary = { successful, failed, totalDuration }

    console.log(`📊 Batch execution complete: ${successful}/${operations.length} successful (${totalDuration}ms)`)

    return { results, summary }
  }

  /**
   * Calculate retry delay using exponential backoff
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * (backoffFactor ^ (attempt - 1))
    let delay = this.config.baseDelay * Math.pow(this.config.backoffFactor, attempt - 1)

    // Cap at max delay
    delay = Math.min(delay, this.config.maxDelay)

    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      const jitterRange = delay * 0.1 // 10% jitter
      delay += Math.random() * jitterRange - jitterRange / 2
    }

    return Math.floor(delay)
  }

  /**
   * Check if an error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    // Use custom non-retryable function if provided
    if (this.config.nonRetryableErrors && this.config.nonRetryableErrors(error)) {
      return true
    }

    // Check for HTTP status codes
    const errorObj = error as Record<string, unknown>
    const responseObj = errorObj?.response as Record<string, unknown>
    const httpStatus = (errorObj?.status as number) || (responseObj?.status as number)
    const nonRetryableStatuses = [401, 403, 404, 422, 429, 500, 501, 502, 503]

    if (httpStatus && nonRetryableStatuses.includes(httpStatus)) {
      return true
    }

    // Check for specific error messages
    const errorMessage = (typeof errorObj?.message === 'string' ? errorObj.message : '').toLowerCase()
    const nonRetryableKeywords = [
      'authentication',
      'unauthorized',
      'forbidden',
      'payment required',
      'account suspended',
      'quota exceeded',
      'rate limited'
    ]

    return nonRetryableKeywords.some(keyword => errorMessage.includes(keyword))
  }

  /**
   * Default function to identify non-retryable errors
   */
  private defaultNonRetryableErrors = (_error: unknown): boolean => {
    // Add application-specific non-retryable error logic here
    return false
  }

  /**
   * Sleep for specified duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  }

  /**
   * Format error for logging
   */
  private formatError(error: unknown): string {
    if (!error) return 'Unknown error'
    if (error instanceof Error) return error.message
    if (typeof error === 'string') return error

    const errorObj = error as Record<string, unknown>
    if (typeof errorObj.message === 'string') return errorObj.message

    // Handle cyclic objects safely
    try {
      return JSON.stringify(error)
    } catch {
      return String(error) || 'Error (could not stringify)'
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(name: string, context: Record<string, unknown>): string {
    const contextStr = Object.entries(context)
      .map(([key, value]) => `${key}=${value}`)
      .join('&')

    return `${name}_${Date.now()}_${contextStr ? btoa(contextStr).slice(0, 8) : ''}`
  }

  /**
   * Get retry statistics
   */
  getStats() {
    const allAttempts = Array.from(this.attemptHistory.values()).flat()
    const totalAttempts = allAttempts.length
    const successfulAttempts = allAttempts.filter(a => a.success).length
    const failedAttempts = totalAttempts - successfulAttempts

    const averageDelay = allAttempts.length > 0
      ? allAttempts.reduce((sum, a) => sum + a.delay, 0) / allAttempts.length
      : 0

    const totalDelay = allAttempts.reduce((sum, a) => sum + a.delay, 0)
    const successRate = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0

    return {
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      successRate: Math.round(successRate * 100) / 100,
      averageDelay: Math.round(averageDelay),
      totalDelay,
      recentFailures: allAttempts
        .filter(a => !a.success && new Date(a.timestamp).getTime() > Date.now() - 3600000) // Last hour
        .length
    }
  }

  /**
   * Get retry history for a specific operation
   */
  getOperationHistory(operationName: string): RetryAttempt[] {
    const matching: RetryAttempt[] = []

    for (const [operationId, attempts] of this.attemptHistory) {
      if (operationId.startsWith(operationName)) {
        matching.push(...attempts)
      }
    }

    return matching.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }

  /**
   * Clear retry history (optionally for a specific operation)
   */
  clearHistory(operationName?: string): void {
    if (operationName) {
      // Clear history for specific operation
      const toDelete: string[] = []
      for (const [operationId] of this.attemptHistory.keys()) {
        if (operationId.startsWith(operationName)) {
          toDelete.push(operationId)
        }
      }
      toDelete.forEach(id => this.attemptHistory.delete(id))
    } else {
      // Clear all history
      this.attemptHistory.clear()
    }
    console.log('🧹 Retry history cleared' + (operationName ? ` for ${operationName}` : ''))
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config }
  }

  /**
   * Update configuration (existing operations use new config)
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('⚙️ RetryManager config updated:', this.config)
  }
}