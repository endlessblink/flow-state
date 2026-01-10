/**
 * useErrorHandler - Vue composable for unified error handling
 *
 * Provides a clean interface for reporting errors from Vue components
 * and composables with automatic context enrichment.
 */

import { errorHandler, ErrorSeverity, ErrorCategory, type ErrorReport } from '@/utils/errorHandler'

export interface UseErrorHandlerOptions {
  /** Default category for errors from this component/composable */
  defaultCategory?: ErrorCategory
  /** Default context to include with all errors */
  defaultContext?: Record<string, unknown>
  /** Component or composable name for context */
  source?: string
}

export function useErrorHandler(options: UseErrorHandlerOptions = {}) {
  const {
    defaultCategory = ErrorCategory.UNKNOWN,
    defaultContext = {},
    source
  } = options

  /**
   * Report an error with full context
   */
  function reportError(
    error: Error | string,
    additionalOptions: {
      severity?: ErrorSeverity
      category?: ErrorCategory
      context?: Record<string, unknown>
      userMessage?: string
      retryable?: boolean
      showNotification?: boolean
    } = {}
  ): ErrorReport {
    return errorHandler.report({
      error,
      severity: additionalOptions.severity ?? ErrorSeverity.ERROR,
      category: additionalOptions.category ?? defaultCategory,
      context: {
        ...defaultContext,
        ...(source ? { source } : {}),
        ...additionalOptions.context
      },
      userMessage: additionalOptions.userMessage,
      retryable: additionalOptions.retryable,
      showNotification: additionalOptions.showNotification
    })
  }

  /**
   * Report a warning (non-blocking issue)
   */
  function reportWarning(
    message: string,
    context?: Record<string, unknown>
  ): ErrorReport {
    return errorHandler.report({
      message,
      severity: ErrorSeverity.WARNING,
      category: defaultCategory,
      context: { ...defaultContext, ...(source ? { source } : {}), ...context },
      showNotification: true
    })
  }

  /**
   * Report an info message (for debugging/tracking)
   */
  function reportInfo(
    message: string,
    context?: Record<string, unknown>
  ): ErrorReport {
    return errorHandler.report({
      message,
      severity: ErrorSeverity.INFO,
      category: defaultCategory,
      context: { ...defaultContext, ...(source ? { source } : {}), ...context },
      showNotification: false
    })
  }

  /**
   * Report a critical error (app may be unstable)
   */
  function reportCritical(
    error: Error | string,
    userMessage?: string,
    context?: Record<string, unknown>
  ): ErrorReport {
    return errorHandler.report({
      error,
      severity: ErrorSeverity.CRITICAL,
      category: defaultCategory,
      context: { ...defaultContext, ...(source ? { source } : {}), ...context },
      userMessage: userMessage || 'A critical error occurred. Please refresh the page.',
      showNotification: true
    })
  }

  /**
   * Wrap an async operation with error handling
   * Returns [result, error] tuple similar to Go-style error handling
   */
  async function wrapAsync<T>(
    operation: () => Promise<T>,
    options: {
      category?: ErrorCategory
      context?: Record<string, unknown>
      userMessage?: string
      showNotification?: boolean
    } = {}
  ): Promise<[T | null, ErrorReport | null]> {
    try {
      const result = await operation()
      return [result, null]
    } catch (error) {
      const report = reportError(
        error instanceof Error ? error : String(error),
        {
          category: options.category,
          context: options.context,
          userMessage: options.userMessage,
          showNotification: options.showNotification
        }
      )
      return [null, report]
    }
  }

  /**
   * Create a wrapped version of an async function with built-in error handling
   */
  function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T,
    options: {
      category?: ErrorCategory
      contextFn?: (...args: Parameters<T>) => Record<string, unknown>
      userMessage?: string
      showNotification?: boolean
    } = {}
  ): T {
    return (async (...args: Parameters<T>) => {
      try {
        return await fn(...args)
      } catch (error) {
        reportError(
          error instanceof Error ? error : String(error),
          {
            category: options.category,
            context: options.contextFn?.(...args),
            userMessage: options.userMessage,
            showNotification: options.showNotification
          }
        )
        throw error // Re-throw so callers can handle if needed
      }
    }) as T
  }

  return {
    reportError,
    reportWarning,
    reportInfo,
    reportCritical,
    wrapAsync,
    withErrorHandling,
    // Re-export enums and types for convenience
    ErrorSeverity,
    ErrorCategory
  }
}

// Export types for external use
export { ErrorSeverity, ErrorCategory, type ErrorReport }
