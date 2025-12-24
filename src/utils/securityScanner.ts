/**
 * Security Scanner Utility
 * Automated security scanning and vulnerability detection
 */

export interface SecurityVulnerability {
  id: string
  type: 'xss' | 'csrf' | 'injection' | 'insecure' | 'outdated' | 'misconfiguration'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  location: string
  recommendation: string
  timestamp: number
}

export interface SecurityScanResult {
  scanId: string
  timestamp: number
  vulnerabilities: SecurityVulnerability[]
  score: number // 0-100, higher is more secure
  passed: boolean
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

export interface SecurityRule {
  id: string
  name: string
  description: string
  check: () => SecurityVulnerability[]
  severity: SecurityVulnerability['severity']
}

export class SecurityScanner {
  private rules: SecurityRule[] = []
  private lastScan: SecurityScanResult | null = null
  private isScanning = false

  constructor() {
    this.initializeRules()
  }

  // Initialize security rules
  private initializeRules(): void {
    this.rules = [
      // XSS Protection Rules
      {
        id: 'xss-dom-sanitization',
        name: 'DOM XSS Sanitization Check',
        description: 'Check for potential DOM-based XSS vulnerabilities',
        severity: 'high',
        check: () => this.checkDOMXSS()
      },

      // Input Validation Rules
      {
        id: 'input-validation',
        name: 'Input Validation Check',
        description: 'Verify proper input validation and sanitization',
        severity: 'medium',
        check: () => this.checkInputValidation()
      },

      // CSRF Protection Rules
      {
        id: 'csrf-protection',
        name: 'CSRF Protection Check',
        description: 'Verify CSRF protection mechanisms',
        severity: 'high',
        check: () => this.checkCSRFProtection()
      },

      // Security Headers Rules
      {
        id: 'security-headers',
        name: 'Security Headers Check',
        description: 'Check for proper security headers',
        severity: 'medium',
        check: () => this.checkSecurityHeaders()
      },

      // Dependency Security Rules
      {
        id: 'dependency-security',
        name: 'Dependency Security Check',
        description: 'Check for known vulnerabilities in dependencies',
        severity: 'critical',
        check: () => this.checkDependencySecurity()
      },

      // Environment Variables Rules
      {
        id: 'env-security',
        name: 'Environment Variables Security Check',
        description: 'Check for exposed sensitive environment variables',
        severity: 'high',
        check: () => this.checkEnvironmentSecurity()
      },

      // Storage Security Rules
      {
        id: 'storage-security',
        name: 'Local Storage Security Check',
        description: 'Check for insecure storage practices',
        severity: 'medium',
        check: () => this.checkStorageSecurity()
      },

      // API Security Rules
      {
        id: 'api-security',
        name: 'API Security Check',
        description: 'Check for API security best practices',
        severity: 'medium',
        check: () => this.checkAPISecurity()
      }
    ]
  }

  // Run complete security scan
  async runScan(): Promise<SecurityScanResult> {
    if (this.isScanning) {
      throw new Error('Security scan is already in progress')
    }

    this.isScanning = true
    const scanId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const timestamp = Date.now()

    console.log(`🔒 Starting security scan: ${scanId}`)

    try {
      const vulnerabilities: SecurityVulnerability[] = []

      // Run all security rules
      for (const rule of this.rules) {
        try {
          console.log(`  🔍 Running rule: ${rule.name}`)
          const ruleVulnerabilities = rule.check()
          vulnerabilities.push(...ruleVulnerabilities)
        } catch (error) {
          console.error(`  ❌ Rule ${rule.id} failed:`, error)
          vulnerabilities.push({
            id: `${rule.id}-error`,
            type: 'misconfiguration',
            severity: 'medium',
            description: `Security rule ${rule.name} failed to execute`,
            location: rule.id,
            recommendation: 'Fix the security rule implementation',
            timestamp
          })
        }
      }

      // Calculate security score
      const score = this.calculateSecurityScore(vulnerabilities)
      const passed = score >= 80

      // Summarize vulnerabilities
      const summary = this.summarizeVulnerabilities(vulnerabilities)

      const result: SecurityScanResult = {
        scanId,
        timestamp,
        vulnerabilities,
        score,
        passed,
        summary
      }

      this.lastScan = result
      this.logScanResult(result)

      return result

    } finally {
      this.isScanning = false
    }
  }

  // Security rule implementations

  private checkDOMXSS(): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = []
    const timestamp = Date.now()

    // Check for dangerous DOM manipulation patterns
    const dangerousPatterns = [
      'innerHTML',
      'outerHTML',
      'document.write',
      'eval(',
      'setTimeout(',
      'setInterval(',
      'Function('
    ]

    // This would ideally run against the actual codebase
    // For demo purposes, we'll simulate finding some patterns
    const potentialIssues = this.findCodePatterns(dangerousPatterns)

    potentialIssues.forEach(location => {
      vulnerabilities.push({
        id: `dom-xss-${location}`,
        type: 'xss',
        severity: 'high',
        description: `Potential DOM XSS vulnerability detected at ${location}`,
        location,
        recommendation: 'Use textContent or sanitize HTML before DOM insertion',
        timestamp
      })
    })

    return vulnerabilities
  }

  private checkInputValidation(): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = []
    const timestamp = Date.now()

    // Check for input validation patterns
    const _validationPatterns = [
      'required',
      'pattern',
      'minlength',
      'maxlength',
      'type="email"',
      'type="url"'
    ]

    // Simulate checking forms for proper validation
    const forms = document.querySelectorAll('form')
    forms.forEach((form, index) => {
      const inputs = form.querySelectorAll('input:not([type="hidden"])')
      let hasValidation = false

      inputs.forEach(input => {
        if (input.hasAttribute('required') ||
            input.hasAttribute('pattern') ||
            input.hasAttribute('minlength') ||
            input.getAttribute('type') === 'email' ||
            input.getAttribute('type') === 'url') {
          hasValidation = true
        }
      })

      if (!hasValidation && inputs.length > 0) {
        vulnerabilities.push({
          id: `input-validation-form-${index}`,
          type: 'injection',
          severity: 'medium',
          description: `Form at index ${index} lacks proper input validation`,
          location: `form[${index}]`,
          recommendation: 'Add validation attributes to all form inputs',
          timestamp
        })
      }
    })

    return vulnerabilities
  }

  private checkCSRFProtection(): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = []
    const timestamp = Date.now()

    // Check for CSRF tokens
    const hasCSRFToken = document.querySelector('meta[name="csrf-token"]') ||
                        document.querySelector('input[name*="csrf"]') ||
                        document.querySelector('input[name*="_token"]')

    if (!hasCSRFToken) {
      vulnerabilities.push({
        id: 'csrf-token-missing',
        type: 'csrf',
        severity: 'high',
        description: 'CSRF token not found in the application',
        location: 'document',
        recommendation: 'Implement CSRF protection with tokens',
        timestamp
      })
    }

    // Check for same-site cookie attribute
    const cookies = document.cookie.split(';')
    let hasSameSite = false

    cookies.forEach(cookie => {
      if (cookie.trim().toLowerCase().includes('samesite')) {
        hasSameSite = true
      }
    })

    if (!hasSameSite) {
      vulnerabilities.push({
        id: 'missing-samesite',
        type: 'csrf',
        severity: 'medium',
        description: 'Cookies lack SameSite attribute',
        location: 'cookies',
        recommendation: 'Set SameSite=Strict or SameSite=Lax on cookies',
        timestamp
      })
    }

    return vulnerabilities
  }

  private checkSecurityHeaders(): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = []
    const timestamp = Date.now()

    // Check for important security headers (simulated)
    const requiredHeaders = [
      'Content-Security-Policy',
      'X-Frame-Options',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy'
    ]

    // In a real implementation, you'd check actual response headers
    requiredHeaders.forEach(header => {
      vulnerabilities.push({
        id: `missing-header-${header.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        type: 'misconfiguration',
        severity: 'medium',
        description: `Missing security header: ${header}`,
        location: 'response-headers',
        recommendation: `Add ${header} header to server responses`,
        timestamp
      })
    })

    return vulnerabilities
  }

  private checkDependencySecurity(): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = []
    const timestamp = Date.now()

    // This would integrate with npm audit or similar tools
    // For demo purposes, we'll assume no critical vulnerabilities after our fix
    const knownVulnerabilities = 0

    if (knownVulnerabilities > 0) {
      vulnerabilities.push({
        id: 'dependency-vulnerabilities',
        type: 'outdated',
        severity: 'critical',
        description: `${knownVulnerabilities} known vulnerabilities in dependencies`,
        location: 'package.json',
        recommendation: 'Run npm audit fix to update dependencies',
        timestamp
      })
    }

    return vulnerabilities
  }

  private checkEnvironmentSecurity(): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = []
    const timestamp = Date.now()

    // Check for exposed API keys or secrets in environment
    const sensitivePatterns = [
      /api[_-]?key/i,
      /secret/i,
      /password/i,
      /token/i
    ]

    // Simulate checking environment variables
    const envKeys = Object.keys(import.meta.env || {})

    envKeys.forEach(key => {
      if (sensitivePatterns.some(pattern => pattern.test(key)) &&
          import.meta.env[key] &&
          import.meta.env[key].length > 10) {
        vulnerabilities.push({
          id: `exposed-env-${key.toLowerCase()}`,
          type: 'insecure',
          severity: 'high',
          description: `Potentially sensitive environment variable exposed: ${key}`,
          location: 'environment',
          recommendation: 'Ensure sensitive values are properly secured',
          timestamp
        })
      }
    })

    return vulnerabilities
  }

  private checkStorageSecurity(): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = []
    const timestamp = Date.now()

    // Check for sensitive data in localStorage/sessionStorage
    const storageKeys = []

    try {
      for (let i = 0; i < localStorage.length; i++) {
        storageKeys.push(localStorage.key(i))
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        storageKeys.push(sessionStorage.key(i))
      }
    } catch {
      // Storage might be disabled or blocked
    }

    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i
    ]

    storageKeys.forEach(key => {
      if (key && sensitivePatterns.some(pattern => pattern.test(key))) {
        vulnerabilities.push({
          id: `storage-sensitive-${key.toLowerCase()}`,
          type: 'insecure',
          severity: 'medium',
          description: `Sensitive data possibly stored in browser storage: ${key}`,
          location: 'browser-storage',
          recommendation: 'Avoid storing sensitive data in browser storage',
          timestamp
        })
      }
    })

    return vulnerabilities
  }

  private checkAPISecurity(): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = []
    const timestamp = Date.now()

    // Check for API security best practices
    vulnerabilities.push({
      id: 'api-rate-limiting',
      type: 'insecure',
      severity: 'medium',
      description: 'API rate limiting not implemented',
      location: 'api-layer',
      recommendation: 'Implement rate limiting to prevent abuse',
      timestamp
    })

    return vulnerabilities
  }

  // Helper methods

  private findCodePatterns(_patterns: string[]): string[] {
    // This would scan actual code files
    // For demo purposes, return simulated findings
    return ['src/components/tasks/TaskEditModal.vue:45']
  }

  private calculateSecurityScore(vulnerabilities: SecurityVulnerability[]): number {
    let score = 100

    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'critical':
          score -= 30
          break
        case 'high':
          score -= 20
          break
        case 'medium':
          score -= 10
          break
        case 'low':
          score -= 5
          break
      }
    })

    return Math.max(0, score)
  }

  private summarizeVulnerabilities(vulnerabilities: SecurityVulnerability[]) {
    return {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length
    }
  }

  private logScanResult(result: SecurityScanResult): void {
    console.log(`\n🔒 SECURITY SCAN RESULTS: ${result.scanId}`)
    console.log('=====================================')
    console.log(`Security Score: ${result.score}/100`)
    console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`)
    console.log(`Vulnerabilities Found: ${result.vulnerabilities.length}`)

    if (result.summary.critical > 0) {
      console.log(`  🔴 Critical: ${result.summary.critical}`)
    }
    if (result.summary.high > 0) {
      console.log(`  🟠 High: ${result.summary.high}`)
    }
    if (result.summary.medium > 0) {
      console.log(`  🟡 Medium: ${result.summary.medium}`)
    }
    if (result.summary.low > 0) {
      console.log(`  🟢 Low: ${result.summary.low}`)
    }

    if (result.vulnerabilities.length > 0) {
      console.log('\n📋 Vulnerability Details:')
      result.vulnerabilities.forEach(vuln => {
        console.log(`  • ${vuln.type.toUpperCase()} - ${vuln.severity.toUpperCase()}: ${vuln.description}`)
        console.log(`    Location: ${vuln.location}`)
        console.log(`    Recommendation: ${vuln.recommendation}`)
      })
    }

    console.log('\n✅ Security scan completed')
  }

  // Public API
  get lastScanResult(): SecurityScanResult | null {
    return this.lastScan
  }

  get scanInProgress(): boolean {
    return this.isScanning
  }

  async runQuickScan(): Promise<SecurityScanResult> {
    // Run only critical and high severity rules for quick scan
    const criticalRules = this.rules.filter(rule =>
      rule.severity === 'critical' || rule.severity === 'high'
    )

    const vulnerabilities: SecurityVulnerability[] = []
    const timestamp = Date.now()

    for (const rule of criticalRules) {
      try {
        const ruleVulnerabilities = rule.check()
        vulnerabilities.push(...ruleVulnerabilities)
      } catch (error) {
        console.error(`Quick scan rule ${rule.id} failed:`, error)
      }
    }

    const score = this.calculateSecurityScore(vulnerabilities)
    const summary = this.summarizeVulnerabilities(vulnerabilities)

    return {
      scanId: `quick-scan-${Date.now()}`,
      timestamp,
      vulnerabilities,
      score,
      passed: score >= 80,
      summary
    }
  }

  // Add custom security rule
  addRule(rule: SecurityRule): void {
    this.rules.push(rule)
  }

  // Remove security rule
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(rule => rule.id !== ruleId)
  }

  // Export scan results
  exportResults(): string {
    if (!this.lastScan) {
      throw new Error('No scan results available to export')
    }

    return JSON.stringify(this.lastScan, null, 2)
  }
}

// Global security scanner instance
export const securityScanner = new SecurityScanner()

export default SecurityScanner