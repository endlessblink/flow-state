/**
 * Security Headers Utility
 * Comprehensive security headers management and CSP implementation
 */

import { ref } from 'vue'

export interface SecurityHeaderConfig {
  contentSecurityPolicy?: {
    enabled: boolean
    directives: Record<string, string[]>
    reportOnly?: boolean
  }
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM'
  xContentTypeOptions?: boolean
  referrerPolicy?: ReferrerPolicy
  permissionsPolicy?: Record<string, string[]>
  strictTransportSecurity?: {
    enabled: boolean
    maxAge: number
    includeSubDomains?: boolean
    preload?: boolean
  }
  xXSSProtection?: boolean
  customHeaders?: Record<string, string>
}

export interface CSPViolationReport {
  blockedURI: string
  documentURI: string
  effectiveDirective: string
  originalPolicy: string
  referrer: string
  sample: string
  sourceFile: string
  lineNumber: number
  columnNumber: number
  disposition: 'report' | 'enforce'
  timestamp: number
}

export const DEFAULT_SECURITY_CONFIG: SecurityHeaderConfig = {
  contentSecurityPolicy: {
    enabled: true,
    directives: {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow unsafe for Vue dev
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:', 'http:'],
      'font-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'ws:', 'wss:', 'https://httpbin.org', 'http://84.46.253.137:5984'],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': []
    },
    reportOnly: false
  },
  xFrameOptions: 'DENY',
  xContentTypeOptions: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: {
    'geolocation': [],
    'microphone': [],
    'camera': [],
    'payment': [],
    'usb': [],
    'magnetometer': [],
    'gyroscope': [],
    'accelerometer': [],
    'ambient-light-sensor': []
  },
  strictTransportSecurity: {
    enabled: false, // Only enable in production with HTTPS
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  xXSSProtection: true
}

export class SecurityHeaders {
  private config: SecurityHeaderConfig
  private cspViolations: CSPViolationReport[] = []
  private reportEndpoint?: string

  constructor(config: Partial<SecurityHeaderConfig> = {}) {
    this.config = {
      ...DEFAULT_SECURITY_CONFIG,
      ...config
    }

    this.setupCSPReporting()
  }

  // Generate all security headers
  generateHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}

    // Content Security Policy
    if (this.config.contentSecurityPolicy?.enabled) {
      const cspHeader = this.config.contentSecurityPolicy.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy'

      headers[cspHeader] = this.generateCSPHeader()
    }

    // X-Frame-Options
    if (this.config.xFrameOptions) {
      headers['X-Frame-Options'] = this.config.xFrameOptions
    }

    // X-Content-Type-Options
    if (this.config.xContentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff'
    }

    // Referrer Policy
    if (this.config.referrerPolicy) {
      headers['Referrer-Policy'] = this.config.referrerPolicy
    }

    // Permissions Policy
    if (this.config.permissionsPolicy) {
      headers['Permissions-Policy'] = this.generatePermissionsPolicy()
    }

    // Strict Transport Security (HTTPS only)
    if (this.config.strictTransportSecurity?.enabled && this.isHTTPS()) {
      headers['Strict-Transport-Security'] = this.generateHSTSHeader()
    }

    // X-XSS-Protection (legacy)
    if (this.config.xXSSProtection) {
      headers['X-XSS-Protection'] = '1; mode=block'
    }

    // Custom headers
    if (this.config.customHeaders) {
      Object.assign(headers, this.config.customHeaders)
    }

    return headers
  }

  // Generate CSP header
  private generateCSPHeader(): string {
    if (!this.config.contentSecurityPolicy?.directives) {
      return ''
    }

    const directives = this.config.contentSecurityPolicy.directives
    const cspParts: string[] = []

    Object.entries(directives).forEach(([directive, values]) => {
      if (values.length > 0) {
        cspParts.push(`${directive} ${values.join(' ')}`)
      }
    })

    // Add report-uri if reporting is enabled
    if (this.reportEndpoint) {
      cspParts.push(`report-uri ${this.reportEndpoint}`)
    }

    return cspParts.join('; ')
  }

  // Generate Permissions Policy header
  private generatePermissionsPolicy(): string {
    if (!this.config.permissionsPolicy) {
      return ''
    }

    const policies: string[] = []

    Object.entries(this.config.permissionsPolicy).forEach(([feature, origins]) => {
      const directive = origins.length > 0
        ? `${feature}=(${origins.join(' ')})`
        : feature
      policies.push(directive)
    })

    return policies.join(', ')
  }

  // Generate HSTS header
  private generateHSTSHeader(): string {
    const hsts = this.config.strictTransportSecurity
    if (!hsts) return ''

    let header = `max-age=${hsts.maxAge}`

    if (hsts.includeSubDomains) {
      header += '; includeSubDomains'
    }

    if (hsts.preload) {
      header += '; preload'
    }

    return header
  }

  // Check if running on HTTPS
  private isHTTPS(): boolean {
    return (
      typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
    )
  }

  // Setup CSP violation reporting
  private setupCSPReporting(): void {
    if (typeof window === 'undefined') return

    // Handle CSP violation reports
    document.addEventListener('securitypolicyviolation', (event) => {
      const violation: CSPViolationReport = {
        blockedURI: event.blockedURI || '',
        documentURI: event.documentURI || '',
        effectiveDirective: event.effectiveDirective || '',
        originalPolicy: event.originalPolicy || '',
        referrer: event.referrer || '',
        sample: event.sample || '',
        sourceFile: event.sourceFile || '',
        lineNumber: event.lineNumber || 0,
        columnNumber: event.columnNumber || 0,
        disposition: event.disposition as 'report' | 'enforce',
        timestamp: Date.now()
      }

      this.handleCSPViolation(violation)
    })

    // Setup report-to endpoint if available
    if ('ReportingObserver' in window) {
      const observer = new ReportingObserver((reports) => {
        reports.forEach((report) => {
          if (report.type === 'csp-violation') {
            this.handleCSPViolation(report.body as unknown as CSPViolationReport)
          }
        })
      })

      observer.observe()
    }
  }

  // Handle CSP violation
  private handleCSPViolation(violation: CSPViolationReport): void {
    this.cspViolations.push(violation)

    // Log violation
    console.warn('🛡️ CSP Violation:', violation)

    // Send to external endpoint if configured
    if (this.reportEndpoint) {
      this.sendViolationReport(violation)
    }

    // Keep only recent violations (last 100)
    if (this.cspViolations.length > 100) {
      this.cspViolations = this.cspViolations.slice(-100)
    }
  }

  // Send violation report to endpoint
  private async sendViolationReport(violation: CSPViolationReport): Promise<void> {
    if (!this.reportEndpoint) return

    try {
      await fetch(this.reportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'csp-violation',
          violation,
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        })
      })
    } catch (error) {
      console.error('Failed to send CSP violation report:', error)
    }
  }

  // Set CSP report endpoint
  setReportEndpoint(endpoint: string): void {
    this.reportEndpoint = endpoint
  }

  // Get recent CSP violations
  getCSPViolations(limit: number = 10): CSPViolationReport[] {
    return this.cspViolations.slice(-limit)
  }

  // Clear CSP violations
  clearCSPViolations(): void {
    this.cspViolations = []
  }

  // Update configuration
  updateConfig(newConfig: Partial<SecurityHeaderConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    }
  }

  // Get current configuration
  getConfig(): SecurityHeaderConfig {
    return { ...this.config }
  }

  // Validate CSP directives
  validateCSPDirectives(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    const directives = this.config.contentSecurityPolicy?.directives

    if (!directives) {
      return { isValid: false, errors: ['CSP directives not configured'] }
    }

    // Check for required directives
    const requiredDirectives = ['default-src', 'script-src', 'style-src']
    requiredDirectives.forEach(directive => {
      if (!directives[directive] || directives[directive].length === 0) {
        errors.push(`Missing required CSP directive: ${directive}`)
      }
    })

    // Check for unsafe values
    const unsafeDirectives = ['script-src', 'object-src']
    unsafeDirectives.forEach(directive => {
      if (directives[directive]) {
        const hasUnsafe = directives[directive].some(value =>
          value.includes("'unsafe-inline'") ||
          value.includes("'unsafe-eval'") ||
          value.includes('*') ||
          value.includes('data:')
        )

        if (hasUnsafe && directive === 'object-src') {
          errors.push(`Unsafe value in ${directive}: should be 'none'`)
        }
      }
    })

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Generate nonce for CSP
  generateNonce(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode(...array))
  }

  // Get CSP header value for script-src with nonce
  getScriptSrcWithNonce(nonce: string): string {
    const scriptSrc = this.config.contentSecurityPolicy?.directives?.['script-src'] || []
    return `${scriptSrc.join(' ')} 'nonce-${nonce}'`
  }
}

// Vue composable for easy integration
export function useSecurityHeaders(config?: Partial<SecurityHeaderConfig>) {
  const securityHeaders = new SecurityHeaders(config)

  const generateHeaders = () => securityHeaders.generateHeaders()

  const getCSPViolations = (limit?: number) => securityHeaders.getCSPViolations(limit)

  const clearCSPViolations = () => securityHeaders.clearCSPViolations()

  const generateNonce = () => securityHeaders.generateNonce()

  // Apply security headers to meta tags
  const applySecurityHeaders = () => {
    const headers = generateHeaders()

    Object.entries(headers).forEach(([name, value]) => {
      // Remove existing meta tag if present
      const existing = document.querySelector(`meta[http-equiv="${name}"]`)
      if (existing) {
        existing.remove()
      }

      // Add new meta tag
      const meta = document.createElement('meta')
      meta.httpEquiv = name
      meta.content = value
      document.head.appendChild(meta)
    })
  }

  // Apply to document on mount
  if (typeof document !== 'undefined') {
    applySecurityHeaders()
  }

  return {
    generateHeaders,
    applySecurityHeaders,
    getCSPViolations,
    clearCSPViolations,
    generateNonce,
    validateCSP: () => securityHeaders.validateCSPDirectives(),
    updateConfig: (newConfig: Partial<SecurityHeaderConfig>) => securityHeaders.updateConfig(newConfig)
  }
}

// Development helper for CSP violations
export function useCSPViolationLogger() {
  const violations = ref<CSPViolationReport[]>([])

  const logViolation = (violation: CSPViolationReport) => {
    violations.value.push(violation)
    console.group('🛡️ CSP Violation Detected')
    console.log('Directive:', violation.effectiveDirective)
    console.log('Blocked URI:', violation.blockedURI)
    console.log('Source File:', violation.sourceFile)
    console.log('Line Number:', violation.lineNumber)
    console.log('Timestamp:', new Date(violation.timestamp))
    console.groupEnd()
  }

  const clearViolations = () => {
    violations.value = []
  }

  return {
    violations,
    logViolation,
    clearViolations
  }
}

export default SecurityHeaders