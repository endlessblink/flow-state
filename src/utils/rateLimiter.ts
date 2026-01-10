/**
 * Rate Limiting Utility
 * Comprehensive rate limiting and DDoS protection
 */

import { ref as _ref } from 'vue'

export interface RateLimitRequest {
  headers?: Record<string, string> | Headers
  ip?: string
  connection?: { remoteAddress?: string }
}

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  keyGenerator?: (req: unknown) => string
  message?: string
  standardHeaders?: boolean
  legacyHeaders?: boolean
  store?: RateLimitStore
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
  message?: string
}

export interface RateLimitEntry {
  count: number
  resetTime: number
  firstRequest: number
}

export interface RateLimitStore {
  get(key: string): RateLimitEntry | null
  set(key: string, entry: RateLimitEntry): void
  delete(key: string): void
  clear(): void
  cleanup(): void
}

export interface RateLimitStatistics {
  totalRequests: number
  blockedRequests: number
  allowedRequests: number
  uniqueKeys: number
  averageRequestsPerKey: number
  topBlockedKeys: Array<{ key: string; count: number }>
}

// Memory-based rate limit store
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: number | null = null

  constructor(private cleanupIntervalMs: number = 60000) {
    this.setupCleanup()
  }

  get(key: string): RateLimitEntry | null {
    const entry = this.store.get(key)
    if (!entry) return null

    // Check if entry has expired
    if (Date.now() > entry.resetTime) {
      this.store.delete(key)
      return null
    }

    return entry
  }

  set(key: string, entry: RateLimitEntry): void {
    this.store.set(key, entry)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }

  private setupCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = window.setInterval(() => {
      this.cleanup()
    }, this.cleanupIntervalMs)
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.clear()
  }

  // Get store statistics
  getStats(): {
    size: number
    keys: string[]
    entries: Array<{ key: string; entry: RateLimitEntry }>
  } {
    return {
      size: this.store.size,
      keys: Array.from(this.store.keys()),
      entries: Array.from(this.store.entries()).map(([key, entry]) => ({ key, entry }))
    }
  }
}

// Main Rate Limiter class
export class RateLimiter {
  private config: Required<RateLimitConfig>
  private store: RateLimitStore
  private statistics = {
    totalRequests: 0,
    blockedRequests: 0,
    allowedRequests: 0,
    keyCounts: new Map<string, number>()
  }

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      message: config.message || 'Too many requests, please try again later.',
      standardHeaders: config.standardHeaders !== false,
      legacyHeaders: config.legacyHeaders !== false,
      store: config.store || new MemoryRateLimitStore()
    }

    this.store = this.config.store
  }

  // Default key generator
  private defaultKeyGenerator(req: unknown): string {
    const request = req as { headers?: Record<string, string>; ip?: string; connection?: { remoteAddress?: string } }
    // Use IP address as default key
    const headers = request.headers
    if (headers instanceof Headers) {
      const forwardedFor = headers.get('x-forwarded-for')
      if (forwardedFor) return forwardedFor.split(',')[0].trim()

      const realIp = headers.get('x-real-ip')
      if (realIp) return realIp
    } else if (headers) {
      if (headers['x-forwarded-for']) return headers['x-forwarded-for'].split(',')[0].trim()
      if (headers['x-real-ip']) return headers['x-real-ip']
    }
    if (request.ip) {
      return request.ip
    }
    if (request.connection?.remoteAddress) {
      return request.connection.remoteAddress
    }

    // Fallback to a unique identifier
    return 'anonymous'
  }

  // Check if request should be rate limited
  checkLimit(req?: RateLimitRequest): RateLimitResult {
    const key = this.config.keyGenerator(req || {})
    const now = Date.now()

    // Update statistics
    this.statistics.totalRequests++
    const keyCount = (this.statistics.keyCounts.get(key) || 0) + 1
    this.statistics.keyCounts.set(key, keyCount)

    // Get current entry for this key
    let entry = this.store.get(key)

    // Create new entry if it doesn't exist
    if (!entry) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstRequest: now
      }
    }

    // Check if the window has expired
    if (now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
        firstRequest: now
      }
    }

    // Increment request count
    entry.count++

    // Store updated entry
    this.store.set(key, entry)

    // Check if limit is exceeded
    const allowed = entry.count <= this.config.maxRequests
    const remaining = Math.max(0, this.config.maxRequests - entry.count)
    const resetTime = entry.resetTime

    if (!allowed) {
      this.statistics.blockedRequests++
    } else {
      this.statistics.allowedRequests++
    }

    const result: RateLimitResult = {
      allowed,
      limit: this.config.maxRequests,
      remaining,
      resetTime,
      message: allowed ? undefined : this.config.message
    }

    // Add retry-after header for blocked requests
    if (!allowed) {
      result.retryAfter = Math.ceil((resetTime - now) / 1000)
    }

    return result
  }

  // Middleware function for fetch API
  middleware() {
    return (req: Request, next: (req: Request) => Promise<Response>) => {
      const result = this.checkLimit(req)

      if (!result.allowed) {
        return Promise.resolve(
          new Response(JSON.stringify({
            error: 'Too Many Requests',
            message: result.message,
            retryAfter: result.retryAfter
          }), {
            status: 429,
            headers: this.getResponseHeaders(result)
          })
        )
      }

      // Add rate limit headers to successful response
      return next(req).then(response => {
        // Clone response to modify headers
        const headers = this.getResponseHeaders(result)
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value)
        })
        return response
      })
    }
  }

  // Get response headers
  private getResponseHeaders(result: RateLimitResult): Record<string, string> {
    const headers: Record<string, string> = {}

    if (this.config.standardHeaders) {
      headers['RateLimit-Limit'] = result.limit.toString()
      headers['RateLimit-Remaining'] = result.remaining.toString()
      headers['RateLimit-Reset'] = Math.ceil(result.resetTime / 1000).toString()
    }

    if (this.config.legacyHeaders) {
      headers['X-RateLimit-Limit'] = result.limit.toString()
      headers['X-RateLimit-Remaining'] = result.remaining.toString()
      headers['X-RateLimit-Reset'] = Math.ceil(result.resetTime / 1000).toString()
    }

    if (result.retryAfter) {
      headers['Retry-After'] = result.retryAfter.toString()
    }

    return headers
  }

  // Reset rate limit for a specific key
  resetKey(key: string): void {
    this.store.delete(key)
    this.statistics.keyCounts.delete(key)
  }

  // Reset all rate limits
  resetAll(): void {
    this.store.clear()
    this.statistics.keyCounts.clear()
  }

  // Get current statistics
  getStatistics(): RateLimitStatistics {
    const keyCounts = Array.from(this.statistics.keyCounts.values())
    const totalKeys = this.statistics.keyCounts.size
    const averageRequestsPerKey = totalKeys > 0 ? keyCounts.reduce((a, b) => a + b, 0) / totalKeys : 0

    // Get top blocked keys (simplified - in real implementation you'd track blocked counts)
    const topBlockedKeys = Array.from(this.statistics.keyCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }))

    return {
      totalRequests: this.statistics.totalRequests,
      blockedRequests: this.statistics.blockedRequests,
      allowedRequests: this.statistics.allowedRequests,
      uniqueKeys: totalKeys,
      averageRequestsPerKey,
      topBlockedKeys
    }
  }

  // Get current configuration
  getConfig(): Required<RateLimitConfig> {
    return { ...this.config }
  }

  // Update configuration
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig }

    if (newConfig.store) {
      this.store = newConfig.store
    }
  }

  // Get store statistics
  getStoreStats() {
    if (this.store instanceof MemoryRateLimitStore) {
      return this.store.getStats()
    }
    return null
  }

  // Cleanup expired entries
  cleanup(): void {
    this.store.cleanup()
  }

  // Destroy rate limiter
  destroy(): void {
    this.resetAll()
    if (this.store instanceof MemoryRateLimitStore) {
      this.store.destroy()
    }
  }
}

// Vue composable for easy integration
export function useRateLimiter(config: RateLimitConfig) {
  const rateLimiter = new RateLimiter(config)

  const checkLimit = (req?: RateLimitRequest) => rateLimiter.checkLimit(req)
  const resetKey = (key: string) => rateLimiter.resetKey(key)
  const resetAll = () => rateLimiter.resetAll()
  const getStatistics = () => rateLimiter.getStatistics()
  const cleanup = () => rateLimiter.cleanup()

  // Secure fetch wrapper
  const secureFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const req = new Request(url, options)
    const result = checkLimit(req)

    if (!result.allowed) {
      return new Response(JSON.stringify({
        error: 'Too Many Requests',
        message: result.message
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': result.retryAfter?.toString() || '60'
        }
      })
    }

    // Add rate limit headers to response
    return fetch(url, options).then(response => {
      // Clone response to modify headers
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      })

      // Add rate limit headers
      if (rateLimiter.getConfig().standardHeaders) {
        newResponse.headers.set('RateLimit-Limit', result.limit.toString())
        newResponse.headers.set('RateLimit-Remaining', result.remaining.toString())
        newResponse.headers.set('RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString())
      }

      return newResponse
    })
  }

  return {
    checkLimit,
    secureFetch,
    resetKey,
    resetAll,
    getStatistics,
    cleanup,
    config: rateLimiter.getConfig()
  }
}

// Predefined rate limit configurations
export const RateLimitPresets = {
  // Very strict (for sensitive operations)
  strict: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5
  },

  // Normal API usage
  normal: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100
  },

  // Permissive (for public endpoints)
  permissive: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 1000
  },

  // Login attempts
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5
  },

  // File uploads
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10
  }
}

export default RateLimiter