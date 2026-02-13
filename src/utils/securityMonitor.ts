/**
 * Security Monitoring and Logging Utility
 * Comprehensive security event monitoring, logging, and alerting
 */

import { ref as _ref } from 'vue'

export interface SecurityEvent {
  id: string
  type: SecurityEventType
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: number
  description: string
  details: Record<string, unknown>
  source: string
  userAgent?: string
  ip?: string
  sessionId?: string
  resolved: boolean
}

export type SecurityEventType =
  | 'csrf_violation'
  | 'xss_attempt'
  | 'sql_injection_attempt'
  | 'rate_limit_exceeded'
  | 'unauthorized_access'
  | 'suspicious_activity'
  | 'csp_violation'
  | 'invalid_token'
  | 'brute_force_attempt'
  | 'data_exfiltration'
  | 'session_hijacking'
  | 'malicious_request'
  | 'security_misconfiguration'

export interface SecurityMonitorConfig {
  enableLogging: boolean
  enableAlerting: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  maxEvents: number
  retentionPeriod: number // milliseconds
  alertThresholds: {
    criticalEventsPerMinute: number
    highEventsPerMinute: number
    mediumEventsPerMinute: number
    suspiciousPatternThreshold: number
  }
  externalEndpoints?: {
    webhook?: string
    slack?: string
    email?: string
  }
}

export interface SecurityStatistics {
  totalEvents: number
  eventsByType: Record<SecurityEventType, number>
  eventsBySeverity: Record<string, number>
  recentActivity: SecurityEvent[]
  threatsDetected: number
  threatsResolved: number
  averageResponseTime: number
  topThreats: Array<{ type: SecurityEventType; count: number }>
  hourlyActivity: Array<{ hour: number; count: number }>
}

export const DEFAULT_MONITOR_CONFIG: SecurityMonitorConfig = {
  enableLogging: true,
  enableAlerting: true,
  logLevel: 'warn',
  maxEvents: 1000,
  retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  alertThresholds: {
    criticalEventsPerMinute: 1,
    highEventsPerMinute: 5,
    mediumEventsPerMinute: 10,
    suspiciousPatternThreshold: 3
  }
}

export class SecurityMonitor {
  private config: SecurityMonitorConfig
  private events: SecurityEvent[] = []
  private alertTimers: Map<string, number> = new Map()
  private statisticsInterval: number | null = null
  private lastAlertTime = 0

  constructor(config: Partial<SecurityMonitorConfig> = {}) {
    this.config = {
      ...DEFAULT_MONITOR_CONFIG,
      ...config
    }

    this.initializeMonitoring()
  }

  // Initialize monitoring systems
  private initializeMonitoring(): void {
    // Setup periodic statistics and cleanup
    this.statisticsInterval = window.setInterval(() => {
      this.cleanupOldEvents()
      this.checkForSuspiciousPatterns()
    }, 60000) // Every minute

    // Setup global error handlers
    this.setupErrorHandlers()

    // Setup performance observer for security events
    this.setupPerformanceObserver()
  }

  // Log security event
  logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>): SecurityEvent {
    const securityEvent: SecurityEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: Date.now(),
      resolved: false
    }

    // Add contextual information
    securityEvent.userAgent = navigator.userAgent
    securityEvent.ip = this.getClientIP()
    securityEvent.sessionId = this.getSessionId()

    // Add to events array
    this.events.unshift(securityEvent)

    // Maintain maximum events limit
    if (this.events.length > this.config.maxEvents) {
      this.events = this.events.slice(0, this.config.maxEvents)
    }

    // Log to console if enabled
    if (this.config.enableLogging) {
      this.logToConsole(securityEvent)
    }

    // Trigger alerts if needed
    if (this.config.enableAlerting) {
      this.triggerAlert(securityEvent)
    }

    // Send to external endpoints if configured
    this.sendToExternalEndpoints(securityEvent)

    return securityEvent
  }

  // Generate unique event ID
  private generateEventId(): string {
    return `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Get client IP (simplified - in real app would use server-side detection)
  private getClientIP(): string {
    return 'client-ip-detected'
  }

  // Get session ID
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('security-session-id')
    if (!sessionId) {
      sessionId = this.generateEventId()
      sessionStorage.setItem('security-session-id', sessionId)
    }
    return sessionId
  }

  // Log to console
  private logToConsole(event: SecurityEvent): void {
    const logMethod = this.getLogLevelMethod(event.severity)
    const emoji = this.getSeverityEmoji(event.severity)

    logMethod(`${emoji} SECURITY [${event.type.toUpperCase()}]: ${event.description}`, {
      id: event.id,
      type: event.type,
      severity: event.severity,
      timestamp: new Date(event.timestamp).toISOString(),
      source: event.source,
      details: event.details
    })
  }

  // Get console log method based on severity
  private getLogLevelMethod(severity: string): Console['log'] | Console['warn'] | Console['error'] | Console['info'] {
    switch (severity) {
      case 'critical':
      case 'high':
        return console.error
      case 'medium':
        return console.warn
      case 'low':
        return console.info
      default:
        return console.log
    }
  }

  // Get emoji for severity
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🚨'
      case 'high':
        return '⚠️'
      case 'medium':
        return '🔶'
      case 'low':
        return '🟡'
      default:
        return 'ℹ️'
    }
  }

  // Trigger security alerts
  private triggerAlert(event: SecurityEvent): void {
    const now = Date.now()
    const timeSinceLastAlert = now - this.lastAlertTime

    // Rate limit alerts to avoid spam
    if (timeSinceLastAlert < 5000 && event.severity !== 'critical') {
      return
    }

    this.lastAlertTime = now

    // Check alert thresholds
    if (this.shouldTriggerAlert(event)) {
      this.sendAlert(event)
    }
  }

  // Check if alert should be triggered
  private shouldTriggerAlert(event: SecurityEvent): boolean {
    const recentEvents = this.getRecentEvents(60000) // Last minute
    const threshold = this.config.alertThresholds

    switch (event.severity) {
      case 'critical':
        return true
      case 'high':
        return recentEvents.filter(e => e.severity === 'high').length >= threshold.highEventsPerMinute
      case 'medium':
        return recentEvents.filter(e => e.severity === 'medium').length >= threshold.mediumEventsPerMinute
      default:
        return false
    }
  }

  // Send alert
  private sendAlert(event: SecurityEvent): void {
    const alertMessage = `🚨 Security Alert: ${event.description}`

    // Browser notification
    if (this.shouldShowNotification(event)) {
      this.showNotification(event)
    }

    // Log alert
    console.error(`🚨 SECURITY ALERT: ${alertMessage}`, event)

    // Send to external endpoints
    if (this.config.externalEndpoints?.webhook) {
      this.sendWebhookAlert(event)
    }
  }

  // Check if browser notification should be shown
  private shouldShowNotification(event: SecurityEvent): boolean {
    return event.severity === 'critical' || event.severity === 'high'
  }

  // Show browser notification
  private showNotification(event: SecurityEvent): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Security Alert: ${event.type}`, {
        body: event.description,
        icon: '/favicon.ico',
        tag: event.id
      })
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      // BUG-1303: Skip in Tauri — WebKitGTK hangs on requestPermission()
      const isTauriRuntime = typeof window !== 'undefined' && '__TAURI__' in window
      if (!isTauriRuntime) {
        Notification.requestPermission()
      }
    }
  }

  // Send webhook alert
  private async sendWebhookAlert(event: SecurityEvent): Promise<void> {
    if (!this.config.externalEndpoints?.webhook) return

    try {
      await fetch(this.config.externalEndpoints.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'security_alert',
          event,
          timestamp: Date.now()
        })
      })
    } catch (error) {
      console.error('Failed to send webhook alert:', error)
    }
  }

  // Send to external endpoints
  private sendToExternalEndpoints(_event: SecurityEvent): void {
    // Implementation for various external services
    // This would integrate with services like Slack, email, SIEM systems, etc.
  }

  // Get recent events within time window
  public getRecentEvents(timeWindowMs?: number): SecurityEvent[] {
    if (!timeWindowMs) return this.events
    const cutoff = Date.now() - timeWindowMs
    return this.events.filter(event => event.timestamp >= cutoff)
  }

  // Check for suspicious patterns
  private checkForSuspiciousPatterns(): void {
    const recentEvents = this.getRecentEvents(300000) // Last 5 minutes
    const patterns = this.detectPatterns(recentEvents)

    patterns.forEach(pattern => {
      this.logEvent({
        type: 'suspicious_activity',
        severity: 'medium',
        description: `Suspicious pattern detected: ${pattern.description}`,
        details: pattern,
        source: 'security-monitor'
      })
    })
  }

  // Detect suspicious patterns
  private detectPatterns(events: SecurityEvent[]): Array<{ description: string; events: SecurityEvent[] }> {
    const patterns: Array<{ description: string; events: SecurityEvent[] }> = []

    // Multiple failed login attempts
    const failedLogins = events.filter(e => e.type === 'brute_force_attempt')
    if (failedLogins.length >= this.config.alertThresholds.suspiciousPatternThreshold) {
      patterns.push({
        description: `${failedLogins.length} failed login attempts detected`,
        events: failedLogins
      })
    }

    // Multiple CSRF violations
    const csrfViolations = events.filter(e => e.type === 'csrf_violation')
    if (csrfViolations.length >= this.config.alertThresholds.suspiciousPatternThreshold) {
      patterns.push({
        description: `${csrfViolations.length} CSRF violations detected`,
        events: csrfViolations
      })
    }

    // Multiple XSS attempts
    const xssAttempts = events.filter(e => e.type === 'xss_attempt')
    if (xssAttempts.length >= this.config.alertThresholds.suspiciousPatternThreshold) {
      patterns.push({
        description: `${xssAttempts.length} XSS attempts detected`,
        events: xssAttempts
      })
    }

    return patterns
  }

  // Setup global error handlers
  private setupErrorHandlers(): void {
    window.addEventListener('error', (event) => {
      if (this.isSecurityRelatedError(event.error)) {
        this.logEvent({
          type: 'malicious_request',
          severity: 'medium',
          description: 'Security-related JavaScript error',
          details: {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          },
          source: 'javascript-error'
        })
      }
    })

    window.addEventListener('unhandledrejection', (event) => {
      if (this.isSecurityRelatedError(event.reason)) {
        this.logEvent({
          type: 'malicious_request',
          severity: 'medium',
          description: 'Security-related promise rejection',
          details: {
            reason: event.reason
          },
          source: 'promise-rejection'
        })
      }
    })
  }

  // Check if error is security-related
  private isSecurityRelatedError(error: unknown): boolean {
    if (!error) return false

    const errorString = error.toString().toLowerCase()
    const securityKeywords = [
      'csrf',
      'xss',
      'injection',
      'unauthorized',
      'forbidden',
      'security',
      'attack',
      'malicious'
    ]

    return securityKeywords.some(keyword => errorString.includes(keyword))
  }

  // Setup performance observer
  private setupPerformanceObserver(): void {
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure' && entry.name.includes('security')) {
            // Log security performance metrics
            this.logEvent({
              type: 'security_misconfiguration',
              severity: 'low',
              description: `Security performance metric: ${entry.name}`,
              details: {
                duration: entry.duration,
                startTime: entry.startTime
              },
              source: 'performance-observer'
            })
          }
        }
      })

      try {
        observer.observe({ entryTypes: ['measure'] })
      } catch (error) {
        console.warn('Failed to setup performance observer for security monitoring:', error)
      }
    }
  }

  // Cleanup old events
  private cleanupOldEvents(): void {
    const cutoff = Date.now() - this.config.retentionPeriod
    this.events = this.events.filter(event => event.timestamp >= cutoff)
  }

  // Get security statistics
  getStatistics(): SecurityStatistics {
    const eventsByType: Record<string, number> = {}
    const eventsBySeverity: Record<string, number> = {}
    const threatsDetected = this.events.filter(e => !e.resolved).length
    const threatsResolved = this.events.filter(e => e.resolved).length

    // Count events by type and severity
    this.events.forEach(event => {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1
      eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1
    })

    // Get top threats
    const topThreats = Object.entries(eventsByType)
      .map(([type, count]) => ({ type: type as SecurityEventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate hourly activity (last 24 hours)
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
      const hourStart = Date.now() - (23 - i) * 60 * 60 * 1000
      const hourEnd = hourStart + 60 * 60 * 1000
      const count = this.events.filter(e => e.timestamp >= hourStart && e.timestamp < hourEnd).length
      return { hour: 23 - i, count }
    })

    return {
      totalEvents: this.events.length,
      eventsByType: eventsByType as Record<SecurityEventType, number>,
      eventsBySeverity,
      recentActivity: this.events.slice(0, 10),
      threatsDetected,
      threatsResolved,
      averageResponseTime: 0, // Would be calculated from actual response times
      topThreats,
      hourlyActivity
    }
  }

  // Get events by type
  getEventsByType(type: SecurityEventType): SecurityEvent[] {
    return this.events.filter(event => event.type === type)
  }

  // Get events by severity
  getEventsBySeverity(severity: string): SecurityEvent[] {
    return this.events.filter(event => event.severity === severity)
  }

  // Resolve event
  resolveEvent(eventId: string): boolean {
    const event = this.events.find(e => e.id === eventId)
    if (event) {
      event.resolved = true
      return true
    }
    return false
  }

  // Clear all events
  clearEvents(): void {
    this.events = []
  }

  // Export events
  exportEvents(): string {
    return JSON.stringify({
      timestamp: Date.now(),
      config: this.config,
      events: this.events,
      statistics: this.getStatistics()
    }, null, 2)
  }

  // Update configuration
  updateConfig(newConfig: Partial<SecurityMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // Destroy monitor
  destroy(): void {
    if (this.statisticsInterval) {
      clearInterval(this.statisticsInterval)
    }
    this.alertTimers.forEach(timerId => clearTimeout(timerId))
    this.clearEvents()
  }

  public getConfig(): SecurityMonitorConfig {
    return { ...this.config }
  }
}

// Vue composable for easy integration
export function useSecurityMonitor(config?: Partial<SecurityMonitorConfig>) {
  const monitor = new SecurityMonitor(config)

  const logEvent = (event: Omit<SecurityEvent, 'id' | 'timestamp' | 'resolved'>) => {
    return monitor.logEvent(event)
  }

  const getStatistics = () => monitor.getStatistics()
  const getRecentEvents = (limit?: number) => monitor.getRecentEvents(limit)
  const resolveEvent = (eventId: string) => monitor.resolveEvent(eventId)

  // Convenience methods for common events
  const logCSRFViolation = (details: Record<string, unknown> = {}) => {
    return logEvent({
      type: 'csrf_violation',
      severity: 'high',
      description: 'CSRF token validation failed',
      details,
      source: 'csrf-protection'
    })
  }

  const logXSSAttempt = (details: Record<string, unknown> = {}) => {
    return logEvent({
      type: 'xss_attempt',
      severity: 'high',
      description: 'XSS attack attempt detected',
      details,
      source: 'input-sanitizer'
    })
  }

  const logRateLimitExceeded = (details: Record<string, unknown> = {}) => {
    return logEvent({
      type: 'rate_limit_exceeded',
      severity: 'medium',
      description: 'Rate limit exceeded',
      details,
      source: 'rate-limiter'
    })
  }

  const logUnauthorizedAccess = (details: Record<string, unknown> = {}) => {
    return logEvent({
      type: 'unauthorized_access',
      severity: 'high',
      description: 'Unauthorized access attempt',
      details,
      source: 'auth-system'
    })
  }

  return {
    logEvent,
    logCSRFViolation,
    logXSSAttempt,
    logRateLimitExceeded,
    logUnauthorizedAccess,
    getStatistics,
    getRecentEvents,
    resolveEvent,
    clearEvents: () => monitor.clearEvents(),
    exportEvents: () => monitor.exportEvents(),
    config: monitor.getConfig()
  }
}

export default SecurityMonitor