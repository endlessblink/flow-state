import { useCopy } from '@/composables/useCopy'

// Error severity levels for categorizing impact
export enum ErrorSeverity {
  INFO = 'info',       // Informational, no action needed
  WARNING = 'warning', // Something went wrong but app continues
  ERROR = 'error',     // Operation failed but app stable
  CRITICAL = 'critical' // App may be unstable, user action needed
}

// Error categories for routing and filtering
export enum ErrorCategory {
  DATABASE = 'database',     // IndexedDB, PouchDB, localStorage
  NETWORK = 'network',       // API calls, sync, fetch
  VALIDATION = 'validation', // Input validation, schema errors
  STATE = 'state',           // Pinia store, reactive state
  COMPONENT = 'component',   // Vue component lifecycle
  SYNC = 'sync',             // Cross-tab, device sync
  UNKNOWN = 'unknown'        // Unclassified errors
}

// Structured error report for unified handling
export interface ErrorReport {
  id: string
  severity: ErrorSeverity
  category: ErrorCategory
  message: string
  userMessage?: string       // User-friendly message
  error?: Error | string     // Original error
  context?: Record<string, unknown>
  timestamp: Date
  stack?: string
  retryable?: boolean
}

export interface ErrorInfo {
  message: string
  source?: string
  line?: number
  column?: number
  stack?: string
  timestamp: Date
}

export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler
  private errors: ErrorInfo[] = []
  private reports: ErrorReport[] = []
  private maxErrors = 100
  private maxReports = 200

  private constructor() {
    this.setupGlobalHandlers()
  }

  /**
   * Report a structured error with severity and category
   * This is the primary method for unified error handling
   */
  report(options: {
    error?: Error | string
    message?: string
    severity?: ErrorSeverity
    category?: ErrorCategory
    context?: Record<string, unknown>
    userMessage?: string
    retryable?: boolean
    showNotification?: boolean
  }): ErrorReport {
    const {
      error,
      message,
      severity = ErrorSeverity.ERROR,
      category = ErrorCategory.UNKNOWN,
      context,
      userMessage,
      retryable = false,
      showNotification = true
    } = options

    // Extract message from error or use provided message
    const errorMessage = message ||
      (error instanceof Error ? error.message : String(error || 'Unknown error'))

    // Extract stack trace
    const stack = error instanceof Error ? error.stack : undefined

    const report: ErrorReport = {
      id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      severity,
      category,
      message: errorMessage,
      userMessage,
      error,
      context,
      timestamp: new Date(),
      stack,
      retryable
    }

    // Store the report
    this.addReport(report)

    // Log to console with appropriate level
    this.logToConsole(report)

    // Show notification based on severity
    if (showNotification && severity !== ErrorSeverity.INFO) {
      this.showReportNotification(report)
    }

    return report
  }

  private addReport(report: ErrorReport) {
    this.reports.unshift(report)
    if (this.reports.length > this.maxReports) {
      this.reports = this.reports.slice(0, this.maxReports)
    }
  }

  private logToConsole(report: ErrorReport) {
    const prefix = `[${report.category.toUpperCase()}]`
    const contextStr = report.context ? ` | Context: ${JSON.stringify(report.context)}` : ''

    switch (report.severity) {
      case ErrorSeverity.INFO:
        console.info(`ℹ️ ${prefix} ${report.message}${contextStr}`)
        break
      case ErrorSeverity.WARNING:
        console.warn(`⚠️ ${prefix} ${report.message}${contextStr}`)
        break
      case ErrorSeverity.ERROR:
        console.error(`❌ ${prefix} ${report.message}${contextStr}`)
        if (report.stack) console.error(report.stack)
        break
      case ErrorSeverity.CRITICAL:
        console.error(`🚨 CRITICAL ${prefix} ${report.message}${contextStr}`)
        if (report.stack) console.error(report.stack)
        break
    }
  }

  private showReportNotification(report: ErrorReport) {
    const colors = {
      [ErrorSeverity.INFO]: '#3b82f6',     // Blue
      [ErrorSeverity.WARNING]: '#f59e0b',  // Amber
      [ErrorSeverity.ERROR]: '#ef4444',    // Red
      [ErrorSeverity.CRITICAL]: '#dc2626'  // Dark red
    }

    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[report.severity]};
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10001;
      max-width: 400px;
      font-family: system-ui, -apple-system, sans-serif;
    `

    const headerDiv = document.createElement('div')
    headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;'

    const titleDiv = document.createElement('div')
    titleDiv.style.cssText = 'font-weight: 600; font-size: 14px;'
    titleDiv.textContent = report.severity === ErrorSeverity.CRITICAL
      ? '🚨 Critical Error'
      : report.severity === ErrorSeverity.WARNING
        ? '⚠️ Warning'
        : '❌ Error'

    const closeButton = document.createElement('button')
    closeButton.style.cssText = 'background: none; border: none; color: white; cursor: pointer; font-size: 18px;'
    closeButton.textContent = '×'
    closeButton.onclick = () => notification.remove()

    headerDiv.appendChild(titleDiv)
    headerDiv.appendChild(closeButton)

    const messageDiv = document.createElement('div')
    messageDiv.style.cssText = 'font-size: 13px; margin-bottom: 8px; opacity: 0.95;'
    messageDiv.textContent = report.userMessage || report.message

    const categoryDiv = document.createElement('div')
    categoryDiv.style.cssText = 'font-size: 11px; opacity: 0.7;'
    categoryDiv.textContent = `Category: ${report.category}`

    notification.appendChild(headerDiv)
    notification.appendChild(messageDiv)
    notification.appendChild(categoryDiv)

    document.body.appendChild(notification)

    // Auto-dismiss based on severity
    const timeout = report.severity === ErrorSeverity.CRITICAL ? 15000 : 8000
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove()
      }
    }, timeout)
  }

  getReports(): ErrorReport[] {
    return [...this.reports]
  }

  getReportsByCategory(category: ErrorCategory): ErrorReport[] {
    return this.reports.filter(r => r.category === category)
  }

  getReportsBySeverity(severity: ErrorSeverity): ErrorReport[] {
    return this.reports.filter(r => r.severity === severity)
  }

  clearReports() {
    this.reports = []
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler()
    }
    return GlobalErrorHandler.instance
  }

  private setupGlobalHandlers() {
    // Capture unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      const errorInfo: ErrorInfo = {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
        timestamp: new Date()
      }
      this.addError(errorInfo)
      this.showErrorNotification(errorInfo)
    })

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const errorInfo: ErrorInfo = {
        message: event.reason?.message || 'Unhandled promise rejection',
        source: 'Promise',
        stack: event.reason?.stack,
        timestamp: new Date()
      }
      this.addError(errorInfo)
      this.showErrorNotification(errorInfo)
    })
  }

  private addError(error: ErrorInfo) {
    this.errors.unshift(error)
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors)
    }
  }

  private showErrorNotification(error: ErrorInfo) {
    // Create a more user-friendly error notification
    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
      z-index: 10001;
      max-width: 400px;
      font-family: system-ui, -apple-system, sans-serif;
    `

    const location = error.source ? `${error.source}:${error.line || 0}:${error.column || 0}` : 'Unknown location'

    // Create safe DOM structure instead of innerHTML
    const headerDiv = document.createElement('div')
    headerDiv.style.display = 'flex'
    headerDiv.style.justifyContent = 'space-between'
    headerDiv.style.alignItems = 'start'
    headerDiv.style.marginBottom = '8px'

    const titleDiv = document.createElement('div')
    titleDiv.style.fontWeight = '600'
    titleDiv.style.fontSize = '14px'
    titleDiv.textContent = 'JavaScript Error'

    const closeButton = document.createElement('button')
    closeButton.style.background = 'none'
    closeButton.style.border = 'none'
    closeButton.style.color = 'white'
    closeButton.style.cursor = 'pointer'
    closeButton.style.fontSize = '18px'
    closeButton.textContent = '×'
    closeButton.addEventListener('click', () => notification.remove())

    headerDiv.appendChild(titleDiv)
    headerDiv.appendChild(closeButton)

    const messageDiv = document.createElement('div')
    messageDiv.style.fontSize = '13px'
    messageDiv.style.marginBottom = '12px'
    messageDiv.style.opacity = '0.9'
    messageDiv.textContent = error.message

    const locationDiv = document.createElement('div')
    locationDiv.style.fontSize = '11px'
    locationDiv.style.opacity = '0.7'
    locationDiv.style.marginBottom = '12px'
    locationDiv.textContent = location

    const buttonDiv = document.createElement('div')
    buttonDiv.style.display = 'flex'
    buttonDiv.style.gap = '8px'

    const copyButton = document.createElement('button')
    copyButton.style.background = 'rgba(255,255,255,0.2)'
    copyButton.style.border = 'none'
    copyButton.style.color = 'white'
    copyButton.style.padding = '6px 12px'
    copyButton.style.borderRadius = '4px'
    copyButton.style.cursor = 'pointer'
    copyButton.style.fontSize = '12px'
    copyButton.textContent = 'Copy Error'
    copyButton.addEventListener('click', () => {
      window.copyError(btoa(JSON.stringify(error)))
      copyButton.textContent = 'Copied!'
      setTimeout(() => {
        copyButton.textContent = 'Copy Error'
      }, 1500)
    })

    const detailsButton = document.createElement('button')
    detailsButton.style.background = 'rgba(255,255,255,0.1)'
    detailsButton.style.border = 'none'
    detailsButton.style.color = 'white'
    detailsButton.style.padding = '6px 12px'
    detailsButton.style.borderRadius = '4px'
    detailsButton.style.cursor = 'pointer'
    detailsButton.style.fontSize = '12px'
    detailsButton.textContent = 'Full Details'
    detailsButton.addEventListener('click', () => {
      window.showFullError(btoa(JSON.stringify(error)))
    })

    buttonDiv.appendChild(copyButton)
    buttonDiv.appendChild(detailsButton)

    notification.appendChild(headerDiv)
    notification.appendChild(messageDiv)
    notification.appendChild(locationDiv)
    notification.appendChild(buttonDiv)

    document.body.appendChild(notification)

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove()
      }
    }, 10000)
  }

  getErrors(): ErrorInfo[] {
    return [...this.errors]
  }

  clearErrors() {
    this.errors = []
  }
}

// Setup global copy function for error notifications
declare global {
  interface Window {
    copyError: (encodedError: string) => void
    showFullError: (encodedError: string) => void
  }
}

window.copyError = (encodedError: string) => {
  try {
    const error: ErrorInfo = JSON.parse(atob(encodedError))
    const { copyError } = useCopy()

    const errorText = error.stack
      ? `Error: ${error.message}\n\nLocation: ${error.source}:${error.line}:${error.column}\n\nStack Trace:\n${error.stack}`
      : `Error: ${error.message}\n\nLocation: ${error.source}:${error.line}:${error.column}`

    copyError(errorText, error.stack)
  } catch (err) {
    console.error('Failed to copy error:', err)
  }
}

window.showFullError = (encodedError: string) => {
  try {
    const error: ErrorInfo = JSON.parse(atob(encodedError))
    const { copyError: _copyError } = useCopy()

    // Create a modal with full error details
    const modal = document.createElement('div')
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10002;
      padding: 20px;
    `

    const content = document.createElement('div')
    content.style.cssText = `
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      color: #1f2937;
    `

    const errorText = error.stack
      ? `Error: ${error.message}\n\nLocation: ${error.source}:${error.line}:${error.column}\n\nTimestamp: ${error.timestamp.toISOString()}\n\nStack Trace:\n${error.stack}`
      : `Error: ${error.message}\n\nLocation: ${error.source}:${error.line}:${error.column}\n\nTimestamp: ${error.timestamp.toISOString()}`

    // Create safe DOM structure instead of innerHTML
    const headerDiv = document.createElement('div')
    headerDiv.style.display = 'flex'
    headerDiv.style.justifyContent = 'space-between'
    headerDiv.style.alignItems = 'center'
    headerDiv.style.marginBottom = '16px'

    const title = document.createElement('h3')
    title.style.margin = '0'
    title.style.fontSize = '18px'
    title.style.fontWeight = '600'
    title.textContent = 'Error Details'

    const closeBtn = document.createElement('button')
    closeBtn.style.background = 'none'
    closeBtn.style.border = 'none'
    closeBtn.style.color = '#6b7280'
    closeBtn.style.cursor = 'pointer'
    closeBtn.style.fontSize = '24px'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => modal.remove())

    headerDiv.appendChild(title)
    headerDiv.appendChild(closeBtn)

    const pre = document.createElement('pre')
    pre.style.background = '#f3f4f6'
    pre.style.padding = '16px'
    pre.style.borderRadius = '8px'
    pre.style.fontSize = '12px'
    pre.style.whiteSpace = 'pre-wrap'
    pre.style.margin = '0'
    pre.textContent = errorText

    const buttonDiv = document.createElement('div')
    buttonDiv.style.marginTop = '16px'
    buttonDiv.style.display = 'flex'
    buttonDiv.style.gap = '8px'

    const copyBtn = document.createElement('button')
    copyBtn.style.background = '#3b82f6'
    copyBtn.style.color = 'white'
    copyBtn.style.border = 'none'
    copyBtn.style.padding = '8px 16px'
    copyBtn.style.borderRadius = '6px'
    copyBtn.style.cursor = 'pointer'
    copyBtn.style.fontSize = '14px'
    copyBtn.textContent = 'Copy Error'
    copyBtn.addEventListener('click', () => {
      window.copyError(encodedError)
      copyBtn.textContent = 'Copied!'
      setTimeout(() => {
        copyBtn.textContent = 'Copy Error'
      }, 1500)
    })

    const closeBtn2 = document.createElement('button')
    closeBtn2.style.background = '#e5e7eb'
    closeBtn2.style.color = '#374151'
    closeBtn2.style.border = 'none'
    closeBtn2.style.padding = '8px 16px'
    closeBtn2.style.borderRadius = '6px'
    closeBtn2.style.cursor = 'pointer'
    closeBtn2.style.fontSize = '14px'
    closeBtn2.textContent = 'Close'
    closeBtn2.addEventListener('click', () => modal.remove())

    buttonDiv.appendChild(copyBtn)
    buttonDiv.appendChild(closeBtn2)

    content.appendChild(headerDiv)
    content.appendChild(pre)
    content.appendChild(buttonDiv)

    modal.setAttribute('data-error-modal', '')
    modal.appendChild(content)
    document.body.appendChild(modal)

    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove()
      }
    })
  } catch (err) {
    console.error('Failed to show error details:', err)
  }
}

// Initialize the global error handler
export const errorHandler = GlobalErrorHandler.getInstance()