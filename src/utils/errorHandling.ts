/**
 * Global Error Handling Utilities
 * Provides consistent error handling patterns across the application
 */

// Error types for better error classification
export enum ErrorType {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  DATABASE = 'database',
  VALIDATION = 'validation',
  FILE_OPERATION = 'file_operation',
  UNKNOWN = 'unknown'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',      // User-facing, non-critical
  MEDIUM = 'medium', // Affects functionality but app continues
  HIGH = 'high',    // Critical error affecting core functionality
  CRITICAL = 'critical' // App cannot continue
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffFactor: number
  retryableErrors: string[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffFactor: 2,
  retryableErrors: [
    'NETWORK_ERROR',
    'TIMEOUT',
    'CONNECTION_LOST',
    'SERVER_ERROR',
    'RATE_LIMITED',
    'QUOTA_EXCEEDED'
  ]
}

// Error classification function
export function classifyError(error: unknown): { type: ErrorType; severity: ErrorSeverity; retryable: boolean } {
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    const name = error.name.toLowerCase()

    // Network errors
    if (message.includes('network') || message.includes('fetch') || name.includes('networkerror')) {
      return { type: ErrorType.NETWORK, severity: ErrorSeverity.MEDIUM, retryable: true }
    }

    // Authentication errors
    if (message.includes('auth') || message.includes('unauthorized') || message.includes('token')) {
      return { type: ErrorType.AUTHENTICATION, severity: ErrorSeverity.HIGH, retryable: false }
    }

    // Database errors
    if (message.includes('database') || message.includes('indexeddb') || message.includes('quota')) {
      return { type: ErrorType.DATABASE, severity: ErrorSeverity.HIGH, retryable: true }
    }

    // File operation errors
    if (message.includes('file') || message.includes('import') || message.includes('export')) {
      return { type: ErrorType.FILE_OPERATION, severity: ErrorSeverity.MEDIUM, retryable: false }
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return { type: ErrorType.VALIDATION, severity: ErrorSeverity.LOW, retryable: false }
    }
  }

  return { type: ErrorType.UNKNOWN, severity: ErrorSeverity.MEDIUM, retryable: true }
}

// Retry utility with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: string
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: unknown

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      const result = await operation()

      // Log successful retry if not first attempt
      if (attempt > 0 && context) {
        console.log(`✅ Operation succeeded after ${attempt} retries: ${context}`)
      }

      return result
    } catch (error) {
      lastError = error
      const { type, severity, retryable } = classifyError(error)

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === finalConfig.maxRetries || !retryable) {
        const errorInfo = {
          error,
          type,
          severity,
          attempts: attempt + 1,
          context
        }

        console.error(`❌ Operation failed permanently:`, errorInfo)
        throw createEnhancedError(error, errorInfo)
      }

      // Calculate delay for next retry
      const delay = Math.min(
        finalConfig.baseDelayMs * Math.pow(finalConfig.backoffFactor, attempt),
        finalConfig.maxDelayMs
      )

      if (context) {
        console.warn(`⚠️ Operation failed (attempt ${attempt + 1}/${finalConfig.maxRetries + 1}), retrying in ${delay}ms: ${context}`, error)
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  // This should never be reached, but TypeScript safety
  throw createEnhancedError(lastError, { context, attempts: finalConfig.maxRetries + 1 })
}

// Enhanced error creation
export function createEnhancedError(
  originalError: unknown,
  context: {
    type?: ErrorType
    severity?: ErrorSeverity
    attempts?: number
    context?: string
    userMessage?: string
  }
): Error & { type: ErrorType; severity: ErrorSeverity; context: string; originalError: unknown } {
  const { type, severity } = classifyError(originalError)
  const enhancedError = new Error(
    context.userMessage ||
    (originalError instanceof Error ? originalError.message : 'Unknown error occurred')
  ) as Error & { type: ErrorType; severity: ErrorSeverity; context: string; originalError: unknown }

  enhancedError.type = context.type || type
  enhancedError.severity = context.severity || severity
  enhancedError.context = context.context || 'Unknown operation'
  enhancedError.originalError = originalError

  // Maintain stack trace
  if (originalError instanceof Error && originalError.stack) {
    enhancedError.stack = originalError.stack
  }

  return enhancedError
}

// Safe async operation wrapper
export async function safeAsyncOperation<T>(
  operation: () => Promise<T>,
  options: {
    context?: string
    retryConfig?: Partial<RetryConfig>
    fallback?: (error: unknown) => T | Promise<T>
    onError?: (error: unknown) => void
    onSuccess?: (result: T) => void
  } = {}
): Promise<T | null> {
  try {
    const result = await retryWithBackoff(operation, options.retryConfig, options.context)
    options.onSuccess?.(result)
    return result
  } catch (error) {
    const enhancedError = createEnhancedError(error, {
      context: options.context,
      userMessage: 'Operation failed. Please try again.'
    })

    options.onError?.(enhancedError)

    // Return fallback if provided
    if (options.fallback) {
      try {
        const fallbackResult = await options.fallback(enhancedError)
        return fallbackResult
      } catch (fallbackError) {
        console.error('Fallback operation also failed:', fallbackError)
      }
    }

    // Log error for debugging
    console.error('Safe async operation failed:', {
      error: enhancedError,
      context: options.context,
      timestamp: new Date().toISOString()
    })

    return null
  }
}

// User-friendly error messages
export function getUserFriendlyMessage(error: unknown): string {
  const { type, severity } = classifyError(error)

  switch (type) {
    case ErrorType.NETWORK:
      return 'Connection problem. Please check your internet connection and try again.'

    case ErrorType.AUTHENTICATION:
      return 'Please sign in again to continue.'

    case ErrorType.DATABASE:
      return 'Data storage problem. Please try refreshing the page.'

    case ErrorType.FILE_OPERATION:
      return 'File operation failed. Please check the file and try again.'

    case ErrorType.VALIDATION:
      return 'Please check your input and try again.'

    default:
      return 'Something went wrong. Please try again.'
  }
}

// Error logging utility
export function logError(error: unknown, context: {
  operation?: string
  userId?: string
  additionalData?: Record<string, any>
} = {}): void {
  const enhancedError = createEnhancedError(error, {
    context: context.operation
  })

  const logEntry = {
    timestamp: new Date().toISOString(),
    error: {
      message: enhancedError.message,
      type: enhancedError.type,
      severity: enhancedError.severity,
      context: enhancedError.context
    },
    user: context.userId || 'anonymous',
    additionalData: context.additionalData
  }

  // In development, log to console with formatting
  if (import.meta.env.DEV) {
    console.group(`🚨 Error [${enhancedError.severity.toUpperCase()}] ${enhancedError.type}`)
    console.error('Message:', enhancedError.message)
    console.error('Context:', enhancedError.context)
    console.error('Original Error:', enhancedError.originalError)
    console.error('Log Entry:', logEntry)
    console.groupEnd()
  } else {
    // In production, send to error logging service
    console.error('Application Error:', logEntry)
    // TODO: Send to error tracking service (Sentry, etc.)
  }
}

// Global error handler setup
export function setupGlobalErrorHandlers(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, {
      operation: 'unhandled_promise_rejection',
      additionalData: { promise: event.promise }
    })

    // Prevent default browser error page
    event.preventDefault()
  })

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    logError(event.error, {
      operation: 'uncaught_error',
      additionalData: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }
    })
  })
}

// Export error handling hooks for Vue composables
export function useErrorHandler() {
  const handleError = (error: unknown, context?: string) => {
    logError(error, { operation: context })
  }

  const safeOperation = <T>(
    operation: () => Promise<T>,
    context?: string,
    retryConfig?: Partial<RetryConfig>
  ) => {
    return safeAsyncOperation(operation, {
      context,
      retryConfig,
      onError: (error) => handleError(error, context)
    })
  }

  return {
    handleError,
    safeOperation,
    getUserMessage: getUserFriendlyMessage,
    classifyError,
    retryWithBackoff
  }
}