/**
 * Centralized logging utility with environment-based log levels
 *
 * Usage:
 *   import { logger } from '@/utils/logger'
 *   logger.debug('Debug message', data)
 *   logger.info('Info message')
 *   logger.warn('Warning message')
 *   logger.error('Error message', error)
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel

  constructor() {
    // Read from environment variable, default to ERROR in production
    const envLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase() || 'error'

    switch (envLevel) {
      case 'debug':
        this.level = LogLevel.DEBUG
        break
      case 'info':
        this.level = LogLevel.INFO
        break
      case 'warn':
        this.level = LogLevel.WARN
        break
      case 'error':
      default:
        this.level = LogLevel.ERROR
        break
    }

    // Show current log level on startup
    if (this.level >= LogLevel.INFO) {
      console.log(`📊 Logger initialized with level: ${LogLevel[this.level]}`)
    }
  }

  /**
   * Set log level programmatically (useful for debugging)
   */
  setLevel(level: LogLevel) {
    this.level = level
    console.log(`📊 Log level changed to: ${LogLevel[level]}`)
  }

  /**
   * Debug-level logging (most verbose)
   */
  debug(message: string, ...args: any[]) {
    if (this.level >= LogLevel.DEBUG) {
      console.log(`🔍 ${message}`, ...args)
    }
  }

  /**
   * Info-level logging
   */
  info(message: string, ...args: any[]) {
    if (this.level >= LogLevel.INFO) {
      console.log(`ℹ️  ${message}`, ...args)
    }
  }

  /**
   * Warning-level logging
   */
  warn(message: string, ...args: any[]) {
    if (this.level >= LogLevel.WARN) {
      console.warn(`⚠️  ${message}`, ...args)
    }
  }

  /**
   * Error-level logging (always shown)
   */
  error(message: string, ...args: any[]) {
    if (this.level >= LogLevel.ERROR) {
      console.error(`❌ ${message}`, ...args)
    }
  }

  /**
   * Group logging (for collapsed debug sections)
   */
  group(label: string, callback: () => void) {
    if (this.level >= LogLevel.DEBUG) {
      console.group(label)
      callback()
      console.groupEnd()
    }
  }

  /**
   * Performance timing
   */
  time(label: string) {
    if (this.level >= LogLevel.DEBUG) {
      console.time(label)
    }
  }

  timeEnd(label: string) {
    if (this.level >= LogLevel.DEBUG) {
      console.timeEnd(label)
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Export for direct access in development
if (import.meta.env.DEV) {
  ;(window as any).logger = logger
}
