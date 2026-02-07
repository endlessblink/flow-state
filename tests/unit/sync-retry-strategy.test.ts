import { describe, it, expect } from 'vitest'
import {
  classifyError,
  calculateRetryDelay,
  shouldRetry,
  getRetryConfigForError,
  type ErrorClassification
} from '@/services/offline/retryStrategy'
import { DEFAULT_RETRY_CONFIG } from '@/types/sync'

describe('BUG-1212: classifyError — duplicate key errors', () => {
  it('classifies duplicate key violation as conflict, not permanent', () => {
    const error = 'duplicate key value violates unique constraint "tasks_pkey"'
    expect(classifyError(error)).toBe('conflict')
  })

  it('classifies Supabase PostgREST wrapped duplicate key as conflict', () => {
    const error = '{"code":"23505","details":"Key (id)=(abc-123) already exists.","hint":null,"message":"duplicate key value violates unique constraint \\"tasks_pkey\\""}'
    expect(classifyError(error)).toBe('conflict')
  })

  it('classifies other unique constraint violations as conflict', () => {
    const error = 'duplicate key value violates unique constraint "user_settings_pkey"'
    expect(classifyError(error)).toBe('conflict')
  })

  it('classifies PostgreSQL error code 23505 as conflict', () => {
    const error = '23505: duplicate key value violates unique constraint'
    expect(classifyError(error)).toBe('conflict')
  })

  it('handles Error objects, not just strings', () => {
    const error = new Error('duplicate key value violates unique constraint "tasks_pkey"')
    expect(classifyError(error)).toBe('conflict')
  })
})

describe('classifyError — existing classifications remain correct', () => {
  it('classifies RLS/permission errors as permanent', () => {
    expect(classifyError('new row violates row-level security policy')).toBe('permanent')
  })

  it('classifies network errors as transient', () => {
    expect(classifyError('Failed to fetch')).toBe('transient')
    expect(classifyError('NetworkError')).toBe('transient')
  })

  it('classifies connection errors as transient', () => {
    expect(classifyError('ECONNREFUSED')).toBe('transient')
    expect(classifyError('connection refused')).toBe('transient')
  })

  it('classifies server errors as transient', () => {
    expect(classifyError('502 Bad Gateway')).toBe('transient')
    expect(classifyError('503 Service Unavailable')).toBe('transient')
    expect(classifyError('504 Gateway Timeout')).toBe('transient')
  })

  it('classifies timeout errors as transient', () => {
    expect(classifyError('Request timed out')).toBe('transient')
    expect(classifyError('timeout exceeded')).toBe('transient')
  })

  it('classifies rate limiting as transient', () => {
    expect(classifyError('rate limit exceeded')).toBe('transient')
  })

  it('classifies auth errors as permanent', () => {
    expect(classifyError('401 Unauthorized')).toBe('permanent')
    expect(classifyError('403 Forbidden')).toBe('permanent')
  })

  it('classifies 400 bad request as permanent', () => {
    expect(classifyError('400 Bad Request')).toBe('permanent')
  })

  it('classifies not-found as permanent', () => {
    expect(classifyError('404 Not Found')).toBe('permanent')
  })

  it('classifies schema cache errors as permanent', () => {
    expect(classifyError('schema cache lookup failed')).toBe('permanent')
  })

  it('classifies unknown errors as unknown', () => {
    expect(classifyError('something totally unexpected happened')).toBe('unknown')
  })

  it('handles non-string, non-Error inputs gracefully', () => {
    expect(classifyError(42)).toBe('unknown')
    expect(classifyError(null)).toBe('unknown')
    expect(classifyError(undefined)).toBe('unknown')
  })
})

describe('getRetryConfigForError — retry policies', () => {
  it('returns standard config for transient errors', () => {
    const config = getRetryConfigForError('transient')
    expect(config).not.toBeNull()
    expect(config!.maxRetries).toBe(DEFAULT_RETRY_CONFIG.maxRetries)
  })

  it('returns reduced retries for conflict errors', () => {
    const config = getRetryConfigForError('conflict')
    expect(config).not.toBeNull()
    expect(config!.maxRetries).toBe(3)
  })

  it('returns null for permanent errors (no retry)', () => {
    const config = getRetryConfigForError('permanent')
    expect(config).toBeNull()
  })

  it('returns standard config for unknown errors', () => {
    const config = getRetryConfigForError('unknown')
    expect(config).not.toBeNull()
    expect(config!.maxRetries).toBe(DEFAULT_RETRY_CONFIG.maxRetries)
  })

  it('conflict from duplicate key gets limited retries (BUG-1212 integration)', () => {
    const classification = classifyError('duplicate key value violates unique constraint "tasks_pkey"')
    const config = getRetryConfigForError(classification)
    expect(config).not.toBeNull()
    expect(config!.maxRetries).toBe(3)
  })
})

describe('calculateRetryDelay — exponential backoff', () => {
  it('increases delay exponentially', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 }
    const delay0 = calculateRetryDelay(0, config)
    const delay1 = calculateRetryDelay(1, config)
    const delay2 = calculateRetryDelay(2, config)

    expect(delay0).toBe(1000)
    expect(delay1).toBe(2000)
    expect(delay2).toBe(4000)
  })

  it('caps at maxDelayMs', () => {
    const config = { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 }
    const delay = calculateRetryDelay(100, config) // Very high retry count
    expect(delay).toBe(config.maxDelayMs)
  })
})

describe('shouldRetry — attempt limits', () => {
  it('allows retries within limit', () => {
    expect(shouldRetry(0)).toBe(true)
    expect(shouldRetry(DEFAULT_RETRY_CONFIG.maxRetries - 1)).toBe(true)
  })

  it('blocks retries at or beyond limit', () => {
    expect(shouldRetry(DEFAULT_RETRY_CONFIG.maxRetries)).toBe(false)
    expect(shouldRetry(DEFAULT_RETRY_CONFIG.maxRetries + 1)).toBe(false)
  })
})
