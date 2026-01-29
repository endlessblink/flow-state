/**
 * Centralized logging utility for FlowState
 * TASK-1107: Cohesive Console Logging System
 *
 * Features:
 * - Consistent [MODULE] prefix format
 * - Dev-only debug logs (stripped in production)
 * - Log level filtering
 * - Structured data output
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerOptions {
  /** Enable debug logs even in production (use sparingly) */
  forceDebug?: boolean
}

const isDev = import.meta.env.DEV

/**
 * Create a logger instance for a specific module
 *
 * @example
 * const log = createLogger('AUTH')
 * log.info('User signed in', { userId: '123' })
 * // Output: [AUTH] User signed in { userId: '123' }
 *
 * log.debug('Token refresh cycle', { expiresIn: 3600 })
 * // Only outputs in development mode
 */
export function createLogger(module: string, options: LoggerOptions = {}) {
  const prefix = `[${module}]`
  const { forceDebug = false } = options

  return {
    /**
     * Debug-level logs - ONLY shown in development mode
     * Use for verbose tracing, state dumps, performance timing
     */
    debug: (message: string, ...args: unknown[]) => {
      if (isDev || forceDebug) {
        console.debug(prefix, message, ...args)
      }
    },

    /**
     * Info-level logs - Important state changes, lifecycle events
     * Shown in all environments
     */
    info: (message: string, ...args: unknown[]) => {
      console.log(prefix, message, ...args)
    },

    /**
     * Warning-level logs - Recoverable issues, deprecation notices
     * Shown in all environments
     */
    warn: (message: string, ...args: unknown[]) => {
      console.warn(prefix, message, ...args)
    },

    /**
     * Error-level logs - Failures, exceptions, critical issues
     * Shown in all environments
     */
    error: (message: string, ...args: unknown[]) => {
      console.error(prefix, message, ...args)
    },

    /**
     * Grouped logging for related operations
     * @example
     * log.group('Sync Operation', () => {
     *   log.info('Fetching tasks')
     *   log.info('Updating store')
     * })
     */
    group: (label: string, fn: () => void) => {
      if (isDev) {
        console.group(`${prefix} ${label}`)
        try {
          fn()
        } finally {
          console.groupEnd()
        }
      } else {
        fn()
      }
    },

    /**
     * Time a block of code (dev only)
     * @example
     * await log.time('Database query', async () => {
     *   await fetchTasks()
     * })
     */
    time: async <T>(label: string, fn: () => T | Promise<T>): Promise<T> => {
      if (isDev) {
        const start = performance.now()
        try {
          return await fn()
        } finally {
          const duration = (performance.now() - start).toFixed(2)
          console.debug(prefix, `${label} completed in ${duration}ms`)
        }
      }
      return fn()
    },
  }
}

/**
 * Pre-configured loggers for common modules
 * Import directly for convenience
 */
export const loggers = {
  auth: createLogger('AUTH'),
  sync: createLogger('SYNC'),
  canvas: createLogger('CANVAS'),
  tasks: createLogger('TASKS'),
  timer: createLogger('TIMER'),
  backup: createLogger('BACKUP'),
  realtime: createLogger('REALTIME'),
  router: createLogger('ROUTER'),
  ui: createLogger('UI'),
}

/**
 * Shorthand for creating a scoped logger with sub-module
 * @example
 * const log = scopedLogger('CANVAS', 'DRAG')
 * log.info('Started') // [CANVAS:DRAG] Started
 */
export function scopedLogger(module: string, submodule: string, options?: LoggerOptions) {
  return createLogger(`${module}:${submodule}`, options)
}
