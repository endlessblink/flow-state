/**
 * CSRF Protection Utility
 * Comprehensive Cross-Site Request Forgery protection
 */

import { ref as _ref } from 'vue'

export interface CSRFToken {
  token: string
  timestamp: number
  expiry: number
  sessionId: string
}

export interface CSRFConfig {
  tokenLength: number
  tokenExpiry: number // milliseconds
  requireSameOrigin: boolean
  checkReferer: boolean
  customHeaderName: string
  cookieName: string
  storageKey: string
  rotationInterval: number // milliseconds
}

export const DEFAULT_CSRF_CONFIG: CSRFConfig = {
  tokenLength: 32,
  tokenExpiry: 3600000, // 1 hour
  requireSameOrigin: true,
  checkReferer: true,
  customHeaderName: 'X-CSRF-Token',
  cookieName: 'csrf-token',
  storageKey: 'csrf-token',
  rotationInterval: 1800000 // 30 minutes
}

export class CSRFProtection {
  private config: CSRFConfig
  private currentToken: CSRFToken | null = null
  private rotationTimer: number | null = null

  constructor(config: Partial<CSRFConfig> = {}) {
    this.config = {
      ...DEFAULT_CSRF_CONFIG,
      ...config
    }

    this.initializeToken()
    this.setupTokenRotation()
  }

  // Initialize CSRF token
  private initializeToken(): void {
    const storedToken = this.getStoredToken()

    if (storedToken && this.isTokenValid(storedToken)) {
      this.currentToken = storedToken
    } else {
      this.generateNewToken()
    }
  }

  // Generate new CSRF token
  private generateNewToken(): void {
    const token = this.generateSecureToken()
    const timestamp = Date.now()
    const expiry = timestamp + this.config.tokenExpiry
    const sessionId = this.generateSessionId()

    this.currentToken = {
      token,
      timestamp,
      expiry,
      sessionId
    }

    this.storeToken(this.currentToken)
    this.setCookieToken(token)
  }

  // Generate cryptographically secure random token
  private generateSecureToken(): string {
    const array = new Uint8Array(this.config.tokenLength)
    crypto.getRandomValues(array)

    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  // Generate session identifier
  private generateSessionId(): string {
    let sessionId = sessionStorage.getItem('csrf-session-id')

    if (!sessionId) {
      sessionId = this.generateSecureToken()
      sessionStorage.setItem('csrf-session-id', sessionId)
    }

    return sessionId
  }

  // Store token in localStorage
  private storeToken(token: CSRFToken): void {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(token))
    } catch (error) {
      console.error('Failed to store CSRF token:', error)
    }
  }

  // Retrieve token from storage
  private getStoredToken(): CSRFToken | null {
    try {
      const stored = localStorage.getItem(this.config.storageKey)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('Failed to retrieve CSRF token:', error)
      return null
    }
  }

  // Set token in cookie
  private setCookieToken(token: string): void {
    const cookieValue = `${this.config.cookieName}=${token}; Path=/; SameSite=Strict; Secure`

    try {
      document.cookie = cookieValue
    } catch (error) {
      console.error('Failed to set CSRF cookie:', error)
    }
  }

  // Get token from cookie
  private getCookieToken(): string | null {
    const cookies = document.cookie.split(';')

    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === this.config.cookieName) {
        return value
      }
    }

    return null
  }

  // Check if token is valid
  private isTokenValid(token: CSRFToken): boolean {
    return !!(
      token.token &&
      token.timestamp &&
      token.expiry &&
      token.expiry > Date.now()
    )
  }

  // Setup automatic token rotation
  private setupTokenRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer)
    }

    this.rotationTimer = window.setInterval(() => {
      this.generateNewToken()
    }, this.config.rotationInterval)
  }

  // Get current CSRF token
  getToken(): string | null {
    if (!this.currentToken || !this.isTokenValid(this.currentToken)) {
      this.generateNewToken()
    }

    return this.currentToken?.token || null
  }

  // Validate CSRF token
  validateToken(token: string): boolean {
    if (!token) {
      console.warn('CSRF validation: No token provided')
      return false
    }

    if (!this.currentToken || !this.isTokenValid(this.currentToken)) {
      console.warn('CSRF validation: No valid server token')
      return false
    }

    // Check if tokens match
    if (token !== this.currentToken.token) {
      console.warn('CSRF validation: Token mismatch')
      return false
    }

    // Additional security checks
    if (this.config.requireSameOrigin && !this.isSameOrigin()) {
      console.warn('CSRF validation: Same origin check failed')
      return false
    }

    if (this.config.checkReferer && !this.isValidReferer()) {
      console.warn('CSRF validation: Invalid referer')
      return false
    }

    return true
  }

  // Check if request is from same origin
  private isSameOrigin(): boolean {
    const currentOrigin = window.location.origin
    const referer = document.referrer

    return !referer || referer.startsWith(currentOrigin)
  }

  // Check if referer is valid
  private isValidReferer(): boolean {
    const referer = document.referrer
    if (!referer) return true // Allow empty referer

    try {
      const refererUrl = new URL(referer)
      const currentUrl = new URL(window.location.href)

      return (
        refererUrl.protocol === currentUrl.protocol &&
        refererUrl.hostname === currentUrl.hostname &&
        refererUrl.port === currentUrl.port
      )
    } catch {
      return false
    }
  }

  // Add CSRF token to request headers
  addTokenToHeaders(headers: Record<string, string>): Record<string, string> {
    const token = this.getToken()

    if (token) {
      headers[this.config.customHeaderName] = token
    }

    return headers
  }

  // Add CSRF token to form data
  addTokenToFormData(formData: FormData): FormData {
    const token = this.getToken()

    if (token) {
      formData.set('csrf_token', token)
    }

    return formData
  }

  // Validate request
  validateRequest(request: Request): boolean {
    // Check custom header
    const headerToken = request.headers.get(this.config.customHeaderName)
    if (headerToken && this.validateToken(headerToken)) {
      return true
    }

    // Check form data (for POST requests)
    if (request.method === 'POST') {
      // Note: In a real implementation, you'd need to parse the request body
      // This is a simplified version for demonstration
      const cookieToken = this.getCookieToken()
      if (cookieToken && this.validateToken(cookieToken)) {
        return true
      }
    }

    return false
  }

  // Rotate token manually
  rotateToken(): void {
    this.generateNewToken()
  }

  // Clear all CSRF data
  clearTokens(): void {
    this.currentToken = null

    try {
      localStorage.removeItem(this.config.storageKey)
      sessionStorage.removeItem('csrf-session-id')

      // Clear cookie
      const cookieValue = `${this.config.cookieName}=; Path=/; SameSite=Strict; Secure; Max-Age=0`
      document.cookie = cookieValue
    } catch (error) {
      console.error('Failed to clear CSRF tokens:', error)
    }

    if (this.rotationTimer) {
      clearInterval(this.rotationTimer)
      this.rotationTimer = null
    }
  }

  // Get CSRF protection status
  getStatus(): {
    tokenExists: boolean
    tokenValid: boolean
    rotationActive: boolean
    config: CSRFConfig
  } {
    return {
      tokenExists: !!this.currentToken,
      tokenValid: this.currentToken ? this.isTokenValid(this.currentToken) : false,
      rotationActive: !!this.rotationTimer,
      config: { ...this.config }
    }
  }

  // Cleanup on destroy
  destroy(): void {
    this.clearTokens()
  }
}

// Vue composable for easy integration
export function useCSRFProtection(config?: Partial<CSRFConfig>) {
  const csrf = new CSRFProtection(config)

  const getToken = () => csrf.getToken()
  const validateToken = (token: string) => csrf.validateToken(token)
  const rotateToken = () => csrf.rotateToken()
  const clearTokens = () => csrf.clearTokens()

  // Add token to fetch requests
  const secureFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const headers = new Headers(options.headers)

    // Add CSRF token to headers
    csrf.addTokenToHeaders(headers as unknown as Record<string, string>)

    const secureOptions = {
      ...options,
      headers
    }

    return fetch(url, secureOptions)
  }

  // Validate form before submission
  const validateForm = (form: HTMLFormElement): boolean => {
    const tokenInput = form.querySelector('input[name="csrf_token"]') as HTMLInputElement

    if (tokenInput && tokenInput.value) {
      return csrf.validateToken(tokenInput.value)
    }

    // Fallback to header validation for AJAX forms
    return true
  }

  // Add CSRF token to forms
  const addTokenToForm = (form: HTMLFormElement): void => {
    const token = csrf.getToken()
    if (!token) return

    // Check if token input already exists
    let tokenInput = form.querySelector('input[name="csrf_token"]') as HTMLInputElement

    if (!tokenInput) {
      tokenInput = document.createElement('input')
      tokenInput.type = 'hidden'
      tokenInput.name = 'csrf_token'
      form.appendChild(tokenInput)
    }

    tokenInput.value = token
  }

  return {
    getToken,
    validateToken,
    rotateToken,
    clearTokens,
    secureFetch,
    validateForm,
    addTokenToForm,
    status: csrf.getStatus()
  }
}

// Middleware for fetch API
export function createCSRFMiddleware(csrf: CSRFProtection) {
  return (request: Request, next: (req: Request) => Promise<Response>): Promise<Response> => {
    // Add CSRF token to request
    const headers = new Headers(request.headers)
    csrf.addTokenToHeaders(headers as unknown as Record<string, string>)

    const secureRequest = new Request(request, {
      headers
    })

    return next(secureRequest)
  }
}

export default CSRFProtection