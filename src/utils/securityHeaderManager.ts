/**
 * Enhanced Security Header Manager
 * Comprehensive security headers implementation with XSS protection and secure cookie handling
 */

import { ref, onMounted, onUnmounted } from 'vue'

export interface SecurityHeaderConfig {
  // XSS Protection
  xssProtection: {
    enabled: boolean
    mode: 'block' | 'sanitize'
    reportOnly?: boolean
  }

  // Cookie Security
  cookieSecurity: {
    secure: boolean
    sameSite: 'Strict' | 'Lax' | 'None'
    httpOnly: boolean
    maxAge: number
    path: string
    domain?: string
  }

  // CORS Configuration
  cors: {
    enabled: boolean
    origins: string[]
    methods: string[]
    headers: string[]
    credentials: boolean
    maxAge: number
    optionsSuccessStatus: number
  }

  // Additional Headers
  additionalHeaders: {
    'X-Content-Type-Options': boolean
    'X-Frame-Options': 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM'
    'Referrer-Policy': 'strict-origin-when-cross-origin' | 'strict-origin' | 'no-referrer' | 'unsafe-url'
    'Permissions-Policy': string
    'Clear-Site-Data': string
  }

  // Rate Limiting for API
  rateLimiting: {
    enabled: boolean
    maxRequests: number
    windowMs: number
    skipSuccessfulRequests: boolean
    skipFailedRequests: boolean
  }
}

export interface CookieSettings {
  name: string
  value: string
  options: {
    secure?: boolean
    sameSite?: 'Strict' | 'Lax' | 'None'
    httpOnly?: boolean
    maxAge?: number
    expires?: Date
    path?: string
    domain?: string
  }
}

export const DEFAULT_SECURITY_CONFIG: SecurityHeaderConfig = {
  xssProtection: {
    enabled: true,
    mode: 'block'
  },

  cookieSecurity: {
    secure: true,
    sameSite: 'Strict',
    httpOnly: true,
    maxAge: 31536000, // 1 year
    path: '/'
  },

  cors: {
    enabled: true,
    origins: ['http://localhost:5546', 'https://localhost:5546'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    credentials: true,
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 204
  },

  additionalHeaders: {
    'X-Content-Type-Options': true,
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
    'Clear-Site-Data': '"cookies", "storage"'
  },

  rateLimiting: {
    enabled: true,
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  }
}

export class SecurityHeaderManager {
  private config: SecurityHeaderConfig
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>()
  private nonceStore = new Map<string, string>()
  private rateLimitTimer: number | null = null

  constructor(config: Partial<SecurityHeaderConfig> = {}) {
    this.config = this.mergeConfig(DEFAULT_SECURITY_CONFIG, config)
    this.initializeRateLimiting()
  }

  // Merge default config with custom config
  private mergeConfig(
    defaultConfig: SecurityHeaderConfig,
    customConfig: Partial<SecurityHeaderConfig>
  ): SecurityHeaderConfig {
    return {
      xssProtection: { ...defaultConfig.xssProtection, ...customConfig.xssProtection },
      cookieSecurity: { ...defaultConfig.cookieSecurity, ...customConfig.cookieSecurity },
      cors: { ...defaultConfig.cors, ...customConfig.cors },
      additionalHeaders: { ...defaultConfig.additionalHeaders, ...customConfig.additionalHeaders },
      rateLimiting: { ...defaultConfig.rateLimiting, ...customConfig.rateLimiting }
    }
  }

  // Generate all security headers
  generateHeaders(): Record<string, string> {
    const headers: Record<string, string> = {}

    // XSS Protection
    if (this.config.xssProtection.enabled) {
      headers['X-XSS-Protection'] = this.config.xssProtection.mode === 'block'
        ? '1; mode=block'
        : '1; mode=sanitize'

      if (this.config.xssProtection.reportOnly) {
        headers['X-XSS-Protection'] += '; report-only'
      }
    }

    // Additional Security Headers
    if (this.config.additionalHeaders['X-Content-Type-Options']) {
      headers['X-Content-Type-Options'] = 'nosniff'
    }

    if (this.config.additionalHeaders['X-Frame-Options']) {
      headers['X-Frame-Options'] = this.config.additionalHeaders['X-Frame-Options']
    }

    if (this.config.additionalHeaders['Referrer-Policy']) {
      headers['Referrer-Policy'] = this.config.additionalHeaders['Referrer-Policy']
    }

    if (this.config.additionalHeaders['Permissions-Policy']) {
      headers['Permissions-Policy'] = this.config.additionalHeaders['Permissions-Policy']
    }

    if (this.config.additionalHeaders['Clear-Site-Data']) {
      headers['Clear-Site-Data'] = this.config.additionalHeaders['Clear-Site-Data']
    }

    return headers
  }

  // Generate CORS headers
  generateCORSHeaders(requestOrigin?: string, requestMethod?: string): Record<string, string> {
    const headers: Record<string, string> = {}

    if (!this.config.cors.enabled) {
      return headers
    }

    // Determine if origin is allowed
    const isOriginAllowed = requestOrigin
      ? this.config.cors.origins.includes(requestOrigin) || this.config.cors.origins.includes('*')
      : true

    // Access-Control-Allow-Origin
    if (isOriginAllowed) {
      headers['Access-Control-Allow-Origin'] = requestOrigin || '*'
    }

    // Access-Control-Allow-Methods
    headers['Access-Control-Allow-Methods'] = this.config.cors.methods.join(', ')

    // Access-Control-Allow-Headers
    headers['Access-Control-Allow-Headers'] = this.config.cors.headers.join(', ')

    // Access-Control-Allow-Credentials
    headers['Access-Control-Allow-Credentials'] = this.config.cors.credentials.toString()

    // Access-Control-Max-Age
    headers['Access-Control-Max-Age'] = this.config.cors.maxAge.toString()

    // Access-Control-Allow-Methods for preflight
    if (requestMethod === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = 'GET, HEAD, POST, PUT, DELETE, OPTIONS'
    }

    // Access-Control-Allow-Methods for actual request
    if (!headers['Access-Control-Allow-Methods'] && isOriginAllowed) {
      headers['Access-Control-Allow-Methods'] = this.config.cors.methods.join(', ')
    }

    return headers
  }

  // Generate nonce for CSP
  generateNonce(identifier: string = 'default'): string {
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    const nonce = btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    this.nonceStore.set(identifier, nonce)
    return nonce
  }

  // Get stored nonce
  getNonce(identifier: string = 'default'): string | null {
    return this.nonceStore.get(identifier) || null
  }

  // Clear nonce
  clearNonce(identifier: string = 'default'): void {
    this.nonceStore.delete(identifier)
  }

  // Set secure cookie
  setCookie(settings: CookieSettings): void {
    const {
      name,
      value,
      options
    } = settings

    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`

    // Add security options
    if (options.secure !== false) {
      cookieString += '; Secure'
    }

    if (options.sameSite) {
      cookieString += `; SameSite=${options.sameSite}`
    }

    if (options.httpOnly) {
      cookieString += '; HttpOnly'
    }

    if (options.maxAge) {
      cookieString += `; Max-Age=${options.maxAge}`
    }

    if (options.expires) {
      cookieString += `; Expires=${options.expires.toUTCString()}`
    }

    if (options.path) {
      cookieString += `; Path=${options.path}`
    }

    if (options.domain) {
      cookieString += `; Domain=${options.domain}`
    }

    // Add SameSite and other attributes for security
    cookieString += '; SameSite=' + (this.config.cookieSecurity.sameSite || 'Strict')
    cookieString += '; Path=' + (options.path || this.config.cookieSecurity.path)

    document.cookie = cookieString

    console.log(`🍪 Secure cookie set: ${name}`)
  }

  // Get cookie value
  getCookie(name: string): string | null {
    const cookies = document.cookie.split(';')
    const cookieName = encodeURIComponent(name)

    for (const cookie of cookies) {
      const [cookieNameInCookie, cookieValue] = cookie.trim().split('=')
      if (cookieNameInCookie === cookieName) {
        return decodeURIComponent(cookieValue)
      }
    }

    return null
  }

  // Delete cookie
  deleteCookie(name: string): void {
    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=${this.config.cookieSecurity.path}; SameSite=${this.config.cookieSecurity.sameSite}`
  }

  // Apply secure cookie settings to all cookies
  secureAllCookies(): void {
    const cookies = document.cookie.split(';')

    cookies.forEach(cookie => {
      const [name] = cookie.trim().split('=')
      if (name) {
        const value = this.getCookie(name)
        if (value) {
          // Re-set with secure options
          this.setCookie({
            name,
            value,
            options: this.config.cookieSecurity
          })
        }
      }
    })
  }

  // Check rate limit
  checkRateLimit(identifier: string = 'default'): { allowed: boolean; limit: number; remaining: number; resetTime: number } {
    if (!this.config.rateLimiting.enabled) {
      return {
        allowed: true,
        limit: this.config.rateLimiting.maxRequests,
        remaining: this.config.rateLimiting.maxRequests,
        resetTime: Date.now() + this.config.rateLimiting.windowMs
      }
    }

    const now = Date.now()
    const existingLimit = this.rateLimitStore.get(identifier)

    if (!existingLimit || now > existingLimit.resetTime) {
      // Create new rate limit entry
      const newLimit = {
        count: 1,
        resetTime: now + this.config.rateLimiting.windowMs
      }
      this.rateLimitStore.set(identifier, newLimit)

      return {
        allowed: true,
        limit: this.config.rateLimiting.maxRequests,
        remaining: this.config.rateLimiting.maxRequests - 1,
        resetTime: newLimit.resetTime
      }
    }

    // Increment count
    existingLimit.count++

    const allowed = existingLimit.count <= this.config.rateLimiting.maxRequests
    const remaining = Math.max(0, this.config.rateLimiting.maxRequests - existingLimit.count)

    return {
      allowed,
      limit: this.config.rateLimiting.maxRequests,
      remaining,
      resetTime: existingLimit.resetTime
    }
  }

  // Apply rate limiting to fetch request
  async rateLimitedFetch(url: string, options: RequestInit = {}, identifier: string = 'default'): Promise<Response> {
    const rateLimitResult = this.checkRateLimit(identifier)

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again after ${Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)} seconds.`,
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        }),
        {
          status: 429,
          statusText: 'Too Many Requests',
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime / 1000).toString(),
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString()
          }
        }
      )
    }

    // Add rate limit headers to successful response
    const response = await fetch(url, options)

    // Clone response to modify headers
    const headers = new Headers(response.headers)
    headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
    headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString())

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }

  // Initialize rate limiting cleanup
  private initializeRateLimiting(): void {
    // Clean up expired rate limits every minute
    this.rateLimitTimer = window.setInterval(() => {
      const now = Date.now()
      for (const [key, limit] of this.rateLimitStore.entries()) {
        if (now > limit.resetTime) {
          this.rateLimitStore.delete(key)
        }
      }
    }, 60000) // 1 minute
  }

  // Apply security headers to document
  applySecurityHeaders(): void {
    const headers = this.generateHeaders()

    Object.entries(headers).forEach(([name, value]) => {
      // Remove existing meta tag
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

  // Security check for XSS
  checkForXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b[^>]*>/gi,
      /<object\b[^>]*>/gi,
      /<embed\b[^>]*>/gi,
      /vbscript:/gi,
      /data:text\/html/gi,
      /&#x[0-9a-f]+;?/gi,
      /&#\d+;?/gi
    ]

    return xssPatterns.some(pattern => pattern.test(input))
  }

  // Sanitize user input for XSS
  sanitizeForXSS(input: string): string {
    let sanitized = input

    // Remove dangerous patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /vbscript:/gi,
      /data:text\/html/gi
    ]

    xssPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '')
    })

    // Escape HTML entities
    sanitized = sanitized.replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

    return sanitized
  }

  // Get current configuration
  getConfig(): SecurityHeaderConfig {
    return { ...this.config }
  }

  // Update configuration
  updateConfig(newConfig: Partial<SecurityHeaderConfig>): void {
    this.config = this.mergeConfig(this.config, newConfig)
    this.applySecurityHeaders()
  }

  // Get rate limit statistics
  getRateLimitStats(): {
    totalLimits: number
    activeLimits: number
    averageRequests: number
    mostActiveKey: string | null
  } {
    const entries = Array.from(this.rateLimitStore.entries())
    const now = Date.now()
    const activeLimits = entries.filter(([_, limit]) => limit.resetTime > now)

    const totalRequests = entries.reduce((sum, [_, limit]) => sum + limit.count, 0)
    const averageRequests = activeLimits.length > 0 ? totalRequests / activeLimits.length : 0

    const mostActiveEntry = activeLimits.reduce((max: [string, { count: number; resetTime: number }], [key, limit]) =>
      limit.count > max[1].count ? [key, limit] : max,
      ['', { count: 0, resetTime: 0 }]
    )

    return {
      totalLimits: entries.length,
      activeLimits: activeLimits.length,
      averageRequests,
      mostActiveKey: mostActiveEntry[0] || null
    }
  }

  // Cleanup
  destroy(): void {
    if (this.rateLimitTimer) {
      clearInterval(this.rateLimitTimer)
    }
    this.rateLimitStore.clear()
    this.nonceStore.clear()
  }
}

// Vue composable for easy integration
export function useSecurityHeaderManager(config?: Partial<SecurityHeaderConfig>) {
  const manager = new SecurityHeaderManager(config)

  const generateHeaders = () => manager.generateHeaders()
  const generateCORSHeaders = (origin?: string, method?: string) =>
    manager.generateCORSHeaders(origin, method)

  const generateNonce = (identifier?: string) => manager.generateNonce(identifier)
  const getNonce = (identifier?: string) => manager.getNonce(identifier)
  const clearNonce = (identifier?: string) => manager.clearNonce(identifier)

  const setCookie = (settings: CookieSettings) => manager.setCookie(settings)
  const getCookie = (name: string) => manager.getCookie(name)
  const deleteCookie = (name: string) => manager.deleteCookie(name)
  const secureAllCookies = () => manager.secureAllCookies()

  const rateLimitedFetch = (url: string, options?: RequestInit, identifier?: string) =>
    manager.rateLimitedFetch(url, options, identifier)

  const checkRateLimit = (identifier?: string) => manager.checkRateLimit(identifier)
  const checkForXSS = (input: string) => manager.checkForXSS(input)
  const sanitizeForXSS = (input: string) => manager.sanitizeForXSS(input)

  const applySecurityHeaders = () => manager.applySecurityHeaders()
  const updateConfig = (newConfig: Partial<SecurityHeaderConfig>) => manager.updateConfig(newConfig)

  const getRateLimitStats = () => manager.getRateLimitStats()

  // Auto-apply security headers on mount
  onMounted(() => {
    applySecurityHeaders()
  })

  onUnmounted(() => {
    manager.destroy()
  })

  return {
    generateHeaders,
    generateCORSHeaders,
    generateNonce,
    getNonce,
    clearNonce,
    setCookie,
    getCookie,
    deleteCookie,
    secureAllCookies,
    rateLimitedFetch,
    checkRateLimit,
    checkForXSS,
    sanitizeForXSS,
    applySecurityHeaders,
    updateConfig,
    getRateLimitStats,
    config: manager.getConfig()
  }
}

export default SecurityHeaderManager