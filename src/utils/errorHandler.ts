import { useCopy } from '@/composables/useCopy'
import {
  setupGlobalErrorHandlers,
  logError,
  classifyError,
  getUserFriendlyMessage,
  ErrorType,
  ErrorSeverity
} from './errorHandling'

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
  private maxErrors = 100

  private constructor() {
    this.setupGlobalHandlers()
  }

  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler()
    }
    return GlobalErrorHandler.instance
  }

  private setupGlobalHandlers() {
    // Use the enhanced global error handlers from errorHandling.ts
    setupGlobalErrorHandlers()

    // Still capture errors for the notification system and local error tracking
    window.addEventListener('error', (event) => {
      const errorInfo: ErrorInfo = {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack,
        timestamp: new Date()
      }

      // Log with enhanced error handling
      logError(event.error, {
        operation: 'global_error_handler',
        additionalData: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })

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

      // Log with enhanced error handling
      logError(event.reason, {
        operation: 'unhandled_promise_rejection',
        additionalData: { promise: 'Unhandled promise rejection' }
      })

      this.addError(errorInfo)
      this.showErrorNotification(errorInfo)

      // Prevent default browser error page
      event.preventDefault()
    })
  }

  private addError(error: ErrorInfo) {
    this.errors.unshift(error)
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors)
    }
  }

  private showErrorNotification(error: ErrorInfo) {
    // Use enhanced error classification to determine severity and styling
    const errorClassification = classifyError(error.message || error.source || 'Unknown error')
    const userMessage = getUserFriendlyMessage(error.message)

    // Determine styling based on error severity
    const severityColors = {
      [ErrorSeverity.LOW]: { bg: '#f59e0b', border: '#d97706' },      // amber
      [ErrorSeverity.MEDIUM]: { bg: '#ef4444', border: '#dc2626' },   // red
      [ErrorSeverity.HIGH]: { bg: '#dc2626', border: '#b91c1c' },     // dark red
      [ErrorSeverity.CRITICAL]: { bg: '#991b1b', border: '#7f1d1d' }  // darker red
    }

    const colors = severityColors[errorClassification.severity] || severityColors[ErrorSeverity.MEDIUM]

    // Create a more user-friendly error notification
    const notification = document.createElement('div')
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors.bg};
      color: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      border-left: 4px solid ${colors.border};
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
    titleDiv.textContent = errorClassification.severity === ErrorSeverity.CRITICAL ? 'Critical Error' :
                           errorClassification.severity === ErrorSeverity.HIGH ? 'Error' :
                           errorClassification.severity === ErrorSeverity.MEDIUM ? 'Problem Detected' :
                           'Warning'

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
    messageDiv.textContent = userMessage

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

  // Enhanced methods using the new error handling system
  getErrorSeverity(error: unknown): ErrorSeverity {
    return classifyError(error).severity
  }

  getErrorType(error: unknown): ErrorType {
    return classifyError(error).type
  }

  getUserFriendlyErrorMessage(error: unknown): string {
    return getUserFriendlyMessage(error)
  }

  getErrorsByType(type: ErrorType): ErrorInfo[] {
    return this.errors.filter(error => {
      const classification = classifyError(error.message || error.source || 'Unknown error')
      return classification.type === type
    })
  }

  getErrorsBySeverity(severity: ErrorSeverity): ErrorInfo[] {
    return this.errors.filter(error => {
      const classification = classifyError(error.message || error.source || 'Unknown error')
      return classification.severity === severity
    })
  }

  // Method to handle errors with context
  handleErrorWithContext(error: unknown, context: {
    operation?: string
    userId?: string
    additionalData?: Record<string, any>
  }) {
    logError(error, context)

    const errorInfo: ErrorInfo = {
      message: error instanceof Error ? error.message : String(error),
      source: context.operation,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date()
    }

    this.addError(errorInfo)
    this.showErrorNotification(errorInfo)
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
    const { copyError } = useCopy()

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