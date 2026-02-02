/**
 * Retry Strategy with Exponential Backoff
 *
 * Calculates retry delays using exponential backoff with jitter.
 * Default progression: 1s, 2s, 4s, 8s, 16s, 32s, 60s (capped)
 */

import { type RetryConfig, DEFAULT_RETRY_CONFIG } from '@/types/sync'

/**
 * Calculate the next retry delay in milliseconds
 *
 * Uses exponential backoff: delay = initialDelay * (multiplier ^ retryCount)
 * Adds jitter to prevent thundering herd problem
 *
 * @param retryCount Number of previous retry attempts (0-based)
 * @param config Retry configuration
 * @returns Delay in milliseconds until next retry
 */
export function calculateRetryDelay(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Calculate base delay with exponential backoff
  const baseDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, retryCount)

  // Cap at maximum delay
  const cappedDelay = Math.min(baseDelay, config.maxDelayMs)

  // Add jitter to prevent synchronized retries
  const jitter = cappedDelay * config.jitterFactor * Math.random()

  return Math.round(cappedDelay + jitter)
}

/**
 * Calculate the absolute timestamp for the next retry
 *
 * @param retryCount Number of previous retry attempts
 * @param config Retry configuration
 * @returns Unix timestamp (milliseconds) when retry should occur
 */
export function calculateNextRetryTime(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = calculateRetryDelay(retryCount, config)
  return Date.now() + delay
}

/**
 * Check if we should retry based on attempt count
 *
 * @param retryCount Number of previous retry attempts
 * @param config Retry configuration
 * @returns True if we should retry, false if max retries exceeded
 */
export function shouldRetry(
  retryCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  return retryCount < config.maxRetries
}

/**
 * Get a human-readable description of the retry schedule
 *
 * Useful for debugging and UI display.
 *
 * @param config Retry configuration
 * @returns Array of delay descriptions for each attempt
 */
export function getRetryScheduleDescription(
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): string[] {
  const descriptions: string[] = []

  for (let i = 0; i < config.maxRetries; i++) {
    const delay = calculateRetryDelay(i, { ...config, jitterFactor: 0 })
    const seconds = Math.round(delay / 1000)

    if (seconds < 60) {
      descriptions.push(`Attempt ${i + 1}: ${seconds}s`)
    } else {
      const minutes = Math.round(seconds / 60)
      descriptions.push(`Attempt ${i + 1}: ${minutes}m`)
    }
  }

  return descriptions
}

/**
 * Format remaining time until retry as human-readable string
 *
 * @param nextRetryAt Unix timestamp of next retry
 * @returns Human-readable string like "5s", "2m 30s", "in 1m"
 */
export function formatTimeUntilRetry(nextRetryAt: number): string {
  const now = Date.now()
  const remaining = nextRetryAt - now

  if (remaining <= 0) {
    return 'now'
  }

  const seconds = Math.round(remaining / 1000)

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (remainingSeconds === 0) {
    return `${minutes}m`
  }

  return `${minutes}m ${remainingSeconds}s`
}

/**
 * Classify an error to determine retry strategy
 *
 * Some errors should be retried immediately, others with backoff,
 * and some should not be retried at all.
 */
export type ErrorClassification =
  | 'transient'   // Network issues, timeouts - retry with backoff
  | 'conflict'    // Version conflict - needs resolution
  | 'permanent'   // Auth failed, not found - don't retry
  | 'unknown'     // Unknown error - retry with backoff

/**
 * Classify an error for retry strategy
 *
 * @param error The error object or message
 * @returns Classification of the error
 */
export function classifyError(error: unknown): ErrorClassification {
  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  // Network/transient errors - should retry
  if (
    lowerMessage.includes('network') ||
    lowerMessage.includes('timeout') ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('fetch') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('econnrefused') ||
    lowerMessage.includes('enotfound') ||
    lowerMessage.includes('502') ||
    lowerMessage.includes('503') ||
    lowerMessage.includes('504') ||
    lowerMessage.includes('rate limit')
  ) {
    return 'transient'
  }

  // Conflict errors - need special handling
  if (
    lowerMessage.includes('conflict') ||
    lowerMessage.includes('version mismatch') ||
    lowerMessage.includes('optimistic lock')
  ) {
    return 'conflict'
  }

  // Permanent errors - don't retry (data validation, auth, not found)
  if (
    lowerMessage.includes('401') ||
    lowerMessage.includes('403') ||
    lowerMessage.includes('404') ||
    lowerMessage.includes('400') ||  // Bad request (validation errors)
    lowerMessage.includes('not found') ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('forbidden') ||
    lowerMessage.includes('invalid') ||
    lowerMessage.includes('malformed') ||
    lowerMessage.includes('syntax') ||  // "invalid input syntax for type uuid"
    lowerMessage.includes('violates') || // constraint violations
    lowerMessage.includes('schema cache') // schema mismatch
  ) {
    return 'permanent'
  }

  // Unknown - treat as transient, retry with backoff
  return 'unknown'
}

/**
 * Get retry config based on error classification
 *
 * Different errors may need different retry strategies.
 */
export function getRetryConfigForError(
  classification: ErrorClassification
): RetryConfig | null {
  switch (classification) {
    case 'transient':
    case 'unknown':
      // Standard exponential backoff
      return DEFAULT_RETRY_CONFIG

    case 'conflict':
      // Fewer retries for conflicts (user intervention likely needed)
      return {
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 3
      }

    case 'permanent':
      // Don't retry permanent errors
      return null
  }
}
