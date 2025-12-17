/**
 * Content Security Policy Manager
 * Advanced CSP implementation with Vue 3 optimization and violation reporting
 */

import { ref as _ref, onMounted, onUnmounted } from 'vue'
import type { SecurityHeaderConfig as _SecurityHeaderConfig, CSPViolationReport } from './securityHeaders'

export interface CSPConfig {
  development: {
    enabled: boolean
    reportOnly: boolean
    directives: Record<string, string[]>
    nonceGeneration: boolean
    autoInject: boolean
  }
  production: {
    enabled: boolean
    reportOnly: boolean
    directives: Record<string, string[]>
    nonceGeneration: boolean
    autoInject: boolean
  }
  reporting: {
    endpoint?: string
    enabled: boolean
    maxReports: number
    reportInterval: number
  }
}

export interface CSPStats {
  violations: CSPViolationReport[]
  totalViolations: number
  violationsByDirective: Record<string, number>
  violationsBySource: Record<string, number>
  lastReportTime: number
  reportRate: number
}

// Vue 3 optimized CSP configuration
export const VUE_OPTIMIZED_CSP: CSPConfig = {
  development: {
    enabled: true,
    reportOnly: true, // Use report-only in development for debugging
    directives: {
      // Allow default sources
      'default-src': ["'self'"],

      // Allow scripts needed for Vue 3 dev server
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Needed for Vue 3 HMR and style injection
        "'unsafe-eval'", // Needed for Vite dev server and some Vue plugins
        'localhost:*',
        'ws:',
        'wss:',
        'http://localhost:*',
        'https://localhost:*'
      ],

      // Allow styles for Vue components
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for Vue component scoped styles
        'data:'
      ],

      // Allow images
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'http:',
        'https:',
        'http://localhost:*',
        'https://localhost:*'
      ],

      // Allow fonts
      'font-src': [
        "'self'",
        'data:',
        'http:',
        'https:',
        'http://localhost:*',
        'https://localhost:*'
      ],

      // Allow connections to APIs and dev server
      'connect-src': [
        "'self'",
        'ws:',
        'wss:',
        'http://localhost:*',
        'https://localhost:*',
        'http://84.46.253.137:5984', // CouchDB server
        'https://httpbin.org', // For testing
        'https://api.github.com',
        'https://raw.githubusercontent.com'
      ],

      // Allow media
      'media-src': [
        "'self'",
        'data:',
        'blob:',
        'http:',
        'https:'
      ],

      // Disallow objects
      'object-src': ["'none'"],

      // Allow child frames for development tools
      'child-src': [
        "'self'",
        'http://localhost:*',
        'https://localhost:*'
      ],

      // Allow workers
      'worker-src': [
        "'self'",
        'blob:',
        'data:',
        'http://localhost:*',
        'https://localhost:*'
      ],

      // Allow manifest
      'manifest-src': ["'self'"],

      // Base URI restrictions
      'base-uri': ["'self'"],

      // Form action restrictions
      'form-action': ["'self'"],

      // Frame ancestors
      'frame-ancestors': ["'self'"],

      // Upgrade insecure requests
      'upgrade-insecure-requests': []
    },
    nonceGeneration: true,
    autoInject: true
  },

  production: {
    enabled: true,
    reportOnly: false,
    directives: {
      // Strict default source
      'default-src': ["'self'"],

      // Secure scripts - no unsafe-inline or unsafe-eval in production
      'script-src': [
        "'self'",
        "'nonce-{CSP_NONCE}'", // Use nonce for inline scripts
        'http://84.46.253.137:5984',
        'https://api.github.com',
        'https://raw.githubusercontent.com'
      ],

      // Allow styles with nonce
      'style-src': [
        "'self'",
        "'nonce-{CSP_NONCE}'", // Use nonce for inline styles
        'https://fonts.googleapis.com'
      ],

      // Allow images from secure sources
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https:',
        'http://84.46.253.137:5984'
      ],

      // Allow fonts
      'font-src': [
        "'self'",
        'data:',
        'https://fonts.gstatic.com',
        'https://fonts.googleapis.com'
      ],

      // Secure connections
      'connect-src': [
        "'self'",
        'wss:',
        'https://84.46.253.137:5984',
        'https://api.github.com'
      ],

      // Allow media
      'media-src': [
        "'self'",
        'data:',
        'blob:'
      ],

      // Disallow objects
      'object-src': ["'none'"],

      // Disallow frames
      'child-src': ["'none'"],

      // Disallow workers (or restrict to specific sources)
      'worker-src': ["'none'"],

      // Allow manifest
      'manifest-src': ["'self'"],

      // Base URI restrictions
      'base-uri': ["'self'"],

      // Form action restrictions
      'form-action': ["'self'"],

      // Frame ancestors
      'frame-ancestors': ["'none'"],

      // Upgrade insecure requests
      'upgrade-insecure-requests': []
    },
    nonceGeneration: true,
    autoInject: true
  },

  reporting: {
    enabled: true,
    maxReports: 100,
    reportInterval: 5000, // 5 seconds
  }
}

export class CSPManager {
  private config: CSPConfig
  private currentNonce: string | null = null
  private stats: CSPStats = {
    violations: [],
    totalViolations: 0,
    violationsByDirective: {},
    violationsBySource: {},
    lastReportTime: 0,
    reportRate: 0
  }
  private violationQueue: CSPViolationReport[] = []
  private reportTimer: number | null = null

  constructor(config: Partial<CSPConfig> = {}) {
    this.config = this.mergeConfig(VUE_OPTIMIZED_CSP, config)
    this.initializeCSP()
  }

  // Merge default config with custom config
  private mergeConfig(defaultConfig: CSPConfig, customConfig: Partial<CSPConfig>): CSPConfig {
    return {
      development: { ...defaultConfig.development, ...customConfig.development },
      production: { ...defaultConfig.production, ...customConfig.production },
      reporting: { ...defaultConfig.reporting, ...customConfig.reporting }
    }
  }

  // Determine current environment
  private isDevelopment(): boolean {
    return import.meta.env.DEV || import.meta.env.MODE === 'development'
  }

  // Initialize CSP
  private initializeCSP(): void {
    const env = this.isDevelopment() ? 'development' : 'production'
    const cspConfig = this.config[env]

    if (!cspConfig.enabled) {
      console.log('🛡️ CSP is disabled')
      return
    }

    console.log(`🛡️ Initializing CSP for ${env} environment (Report-Only: ${cspConfig.reportOnly})`)

    // Generate nonce if needed
    if (cspConfig.nonceGeneration) {
      this.currentNonce = this.generateNonce()
    }

    // Setup violation reporting
    this.setupViolationReporting()

    // Auto-inject CSP headers
    if (cspConfig.autoInject) {
      this.injectCSPHeaders(cspConfig)
    }

    // Setup reporting endpoint
    if (this.config.reporting.enabled) {
      this.setupReportingEndpoint()
    }
  }

  // Generate cryptographically secure nonce
  private generateNonce(): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  // Get current nonce
  getNonce(): string | null {
    return this.currentNonce
  }

  // Generate new nonce
  refreshNonce(): string {
    this.currentNonce = this.generateNonce()
    return this.currentNonce
  }

  // Build CSP header
  private buildCSPHeader(cspConfig: CSPConfig['development'] | CSPConfig['production']): string {
    const directives = cspConfig.directives
    const cspParts: string[] = []

    Object.entries(directives).forEach(([directive, sources]) => {
      if (sources.length > 0) {
        let sourceList = sources.join(' ')

        // Replace nonce placeholder with actual nonce
        if (this.currentNonce && sourceList.includes('{CSP_NONCE}')) {
          sourceList = sourceList.replace(/{CSP_NONCE}/g, this.currentNonce)
        }

        cspParts.push(`${directive} ${sourceList}`)
      }
    })

    // Add report-uri if reporting is enabled
    if (this.config.reporting.endpoint) {
      cspParts.push(`report-uri ${this.config.reporting.endpoint}`)
    }

    return cspParts.join('; ')
  }

  // Inject CSP headers into meta tags
  private injectCSPHeaders(cspConfig: CSPConfig['development'] | CSPConfig['production']): void {
    const headerName = cspConfig.reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy'

    // Remove existing CSP meta tags
    const existingTags = document.querySelectorAll(
      `meta[http-equiv="${headerName}"], meta[name="Content-Security-Policy"]`
    )
    existingTags.forEach(tag => tag.remove())

    // Create and inject new CSP meta tag
    const meta = document.createElement('meta')
    meta.httpEquiv = headerName
    meta.content = this.buildCSPHeader(cspConfig)

    // Add to head
    if (document.head) {
      document.head.appendChild(meta)
    }

    console.log(`🛡️ CSP header injected: ${headerName}`)
    console.log(`🛡️ Content: ${meta.content}`)
  }

  // Setup CSP violation reporting
  private setupViolationReporting(): void {
    // Handle CSP violation reports
    const handleViolation = (event: SecurityPolicyViolationEvent) => {
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
        disposition: event.disposition === 'report' ? 'report' : 'enforce',
        timestamp: Date.now()
      }

      this.processViolation(violation)
    }

    // Add event listeners
    document.addEventListener('securitypolicyviolation', handleViolation)

    // Add ReportingObserver if available
    if ('ReportingObserver' in window) {
      const observer = new ReportingObserver((reports) => {
        reports.forEach((report) => {
          if (report.type === 'csp-violation') {
            this.processViolation(report.body as unknown as CSPViolationReport)
          }
        })
      })

      try {
        observer.observe()
      } catch (error) {
        console.warn('Failed to setup CSP ReportingObserver:', error)
      }
    }
  }

  // Process CSP violation
  private processViolation(violation: CSPViolationReport): void {
    // Add to stats
    this.stats.totalViolations++
    this.stats.violations.push(violation)
    this.stats.lastReportTime = Date.now()

    // Count by directive
    const directive = violation.effectiveDirective
    this.stats.violationsByDirective[directive] = (this.stats.violationsByDirective[directive] || 0) + 1

    // Count by source
    const source = violation.blockedURI || 'unknown'
    this.stats.violationsBySource[source] = (this.stats.violationsBySource[source] || 0) + 1

    // Log violation
    this.logViolation(violation)

    // Add to queue for batch reporting
    this.violationQueue.push(violation)

    // Limit queue size
    if (this.violationQueue.length > this.config.reporting.maxReports) {
      this.violationQueue = this.violationQueue.slice(-this.config.reporting.maxReports)
    }
  }

  // Log CSP violation
  private logViolation(violation: CSPViolationReport): void {
    const emoji = violation.disposition === 'enforce' ? '🚫' : '⚠️'
    console.group(`${emoji} CSP Violation: ${violation.effectiveDirective}`)
    console.log(`Blocked URI: ${violation.blockedURI}`)
    console.log(`Document URI: ${violation.documentURI}`)

    if (violation.sourceFile) {
      console.log(`Source File: ${violation.sourceFile}:${violation.lineNumber}:${violation.columnNumber}`)
    }

    if (violation.sample) {
      console.log(`Sample: ${violation.sample}`)
    }

    console.log(`Disposition: ${violation.disposition}`)
    console.log(`Timestamp: ${new Date(violation.timestamp).toISOString()}`)
    console.groupEnd()
  }

  // Setup reporting endpoint
  private setupReportingEndpoint(): void {
    if (!this.config.reporting.endpoint) return

    // Batch reports to avoid overwhelming the endpoint
    this.reportTimer = setInterval(() => {
      this.sendBatchReports()
    }, this.config.reporting.reportInterval) as any
  }

  // Send batch reports
  private async sendBatchReports(): Promise<void> {
    if (this.violationQueue.length === 0) return

    const reports = [...this.violationQueue]
    this.violationQueue = []

    try {
      await fetch(this.config.reporting.endpoint!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Report-To': 'csp-endpoint'
        },
        body: JSON.stringify({
          type: 'csp-report',
          reports,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      })

      console.log(`📊 Sent ${reports.length} CSP violation reports`)
    } catch (error) {
      console.error('Failed to send CSP violation reports:', error)
    }
  }

  // Apply nonce to script/style tags
  applyNonceToElement(element: HTMLElement): void {
    if (!this.currentNonce) return

    const tagName = element.tagName.toLowerCase()

    if (tagName === 'script' || tagName === 'style') {
      element.setAttribute('nonce', this.currentNonce)
    }
  }

  // Apply nonce to all inline scripts and styles
  applyNonceToDocument(): void {
    if (!this.currentNonce) return

    // Apply to inline scripts
    const scripts = document.querySelectorAll('script:not([src])')
    scripts.forEach(script => {
      if (!script.hasAttribute('nonce')) {
        script.setAttribute('nonce', this.currentNonce || '')
      }
    })

    // Apply to inline styles
    const styles = document.querySelectorAll('style:not([href])')
    styles.forEach(style => {
      if (!style.hasAttribute('nonce')) {
        style.setAttribute('nonce', this.currentNonce || '')
      }
    })
  }

  // Get CSP statistics
  getStats(): CSPStats {
    const now = Date.now()
    const timeSinceLastReport = now - this.stats.lastReportTime
    this.stats.reportRate = this.stats.totalViolations / Math.max(timeSinceLastReport / 1000, 1)

    return { ...this.stats }
  }

  // Get recent violations
  getRecentViolations(limit: number = 50): CSPViolationReport[] {
    return this.stats.violations.slice(0, limit)
  }

  // Get violations by directive
  getViolationsByDirective(directive: string): CSPViolationReport[] {
    return this.stats.violations.filter(v => v.effectiveDirective === directive)
  }

  // Clear violation statistics
  clearStats(): void {
    this.stats = {
      violations: [],
      totalViolations: 0,
      violationsByDirective: {},
      violationsBySource: {},
      lastReportTime: 0,
      reportRate: 0
    }
    this.violationQueue = []
  }

  // Test CSP compliance
  testCompliance(): { compliant: boolean; issues: string[] } {
    const issues: string[] = []
    const env = this.isDevelopment() ? 'development' : 'production'
    const config = this.config[env]

    if (!config.enabled) {
      issues.push('CSP is disabled')
    }

    if (config.directives['script-src']?.includes("'unsafe-inline'") && !config.reportOnly) {
      issues.push('Unsafe inline scripts allowed in production')
    }

    if (config.directives['script-src']?.includes("'unsafe-eval'") && !config.reportOnly) {
      issues.push('Unsafe eval allowed in production')
    }

    if (!config.directives['object-src']?.includes("'none'")) {
      issues.push('object-src should be set to \'none\' for better security')
    }

    if (!config.directives['frame-ancestors']?.includes("'none'")) {
      issues.push('frame-ancestors should be set to \'none\' to prevent clickjacking')
    }

    return {
      compliant: issues.length === 0,
      issues
    }
  }

  // Optimize CSP for Vue 3
  optimizeForVue3(): void {
    const env = this.isDevelopment() ? 'development' : 'production'
    const config = this.config[env]

    // Vue 3 specific optimizations
    if (env === 'development') {
      // Allow HMR and dev server functionality
      config.directives['script-src'] = [
        ...(config.directives['script-src'] || []),
        "'unsafe-inline'", // Required for HMR
        "'unsafe-eval'",  // Required for Vite
        'ws:',
        'http://localhost:*'
      ]

      config.directives['connect-src'] = [
        ...(config.directives['connect-src'] || []),
        'ws:',
        'http://localhost:*'
      ]
    } else {
      // Production optimizations
      // Remove unsafe inline and eval
      config.directives['script-src'] = (config.directives['script-src'] || [])
        .filter(src => src !== "'unsafe-inline'" && src !== "'unsafe-eval'")

      // Add nonce support
      config.directives['script-src'] = [
        ...(config.directives['script-src'] || []),
        "'nonce-{CSP_NONCE}'"
      ]
    }

    console.log('🔧 CSP optimized for Vue 3')
  }

  // Cleanup
  destroy(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer)
    }
    this.clearStats()
  }
}

// Vue composable for CSP management
export function useCSPManager(config?: Partial<CSPConfig>) {
  const cspManager = new CSPManager(config)

  onMounted(() => {
    // Apply nonce to existing elements
    cspManager.applyNonceToDocument()

    // Watch for new elements and apply nonce
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            cspManager.applyNonceToElement(node as HTMLElement)
          }
        })
      })
    })

    observer.observe(document.head, { childList: true })
    observer.observe(document.body, { childList: true })
  })

  onUnmounted(() => {
    cspManager.destroy()
  })

  return {
    getNonce: () => cspManager.getNonce(),
    refreshNonce: () => cspManager.refreshNonce(),
    getStats: () => cspManager.getStats(),
    getRecentViolations: (limit?: number) => cspManager.getRecentViolations(limit),
    testCompliance: () => cspManager.testCompliance(),
    clearStats: () => cspManager.clearStats(),
    optimizeForVue3: () => cspManager.optimizeForVue3()
  }
}

export default CSPManager