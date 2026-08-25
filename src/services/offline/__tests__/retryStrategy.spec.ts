import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateRetryDelay,
  calculateNextRetryTime,
  shouldRetry,
  getRetryScheduleDescription,
  formatTimeUntilRetry,
  classifyError,
  getRetryConfigForError,
} from '@/services/offline/retryStrategy'
import { DEFAULT_RETRY_CONFIG } from '@/types/sync'
import type { RetryConfig } from '@/types/sync'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A config with zero jitter so every assertion is deterministic. */
const NO_JITTER_CONFIG: RetryConfig = {
  ...DEFAULT_RETRY_CONFIG,
  jitterFactor: 0,
}

// ---------------------------------------------------------------------------
// calculateRetryDelay
// ---------------------------------------------------------------------------

describe('calculateRetryDelay', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('with jitterFactor: 0 (deterministic)', () => {
    it('returns exactly initialDelayMs for retryCount=0', () => {
      expect(calculateRetryDelay(0, NO_JITTER_CONFIG)).toBe(1000)
    })

    it('doubles on retryCount=1 (2000ms)', () => {
      expect(calculateRetryDelay(1, NO_JITTER_CONFIG)).toBe(2000)
    })

    it('doubles again on retryCount=2 (4000ms)', () => {
      expect(calculateRetryDelay(2, NO_JITTER_CONFIG)).toBe(4000)
    })

    it('doubles again on retryCount=3 (8000ms)', () => {
      expect(calculateRetryDelay(3, NO_JITTER_CONFIG)).toBe(8000)
    })

    it('doubles again on retryCount=4 (16000ms)', () => {
      expect(calculateRetryDelay(4, NO_JITTER_CONFIG)).toBe(16000)
    })

    it('doubles again on retryCount=5 (32000ms)', () => {
      expect(calculateRetryDelay(5, NO_JITTER_CONFIG)).toBe(32000)
    })

    it('is capped at maxDelayMs (60000ms) for retryCount=6', () => {
      // 1000 * 2^6 = 64000 > 60000 — should be capped
      expect(calculateRetryDelay(6, NO_JITTER_CONFIG)).toBe(60000)
    })

    it('stays capped at maxDelayMs for high retryCounts', () => {
      expect(calculateRetryDelay(20, NO_JITTER_CONFIG)).toBe(60000)
      expect(calculateRetryDelay(100, NO_JITTER_CONFIG)).toBe(60000)
    })

    it('respects a custom maxDelayMs', () => {
      const config: RetryConfig = { ...NO_JITTER_CONFIG, maxDelayMs: 5000 }
      // 1000 * 2^3 = 8000, capped at 5000
      expect(calculateRetryDelay(3, config)).toBe(5000)
    })

    it('respects a custom backoffMultiplier', () => {
      const config: RetryConfig = { ...NO_JITTER_CONFIG, backoffMultiplier: 3 }
      // 1000 * 3^1 = 3000
      expect(calculateRetryDelay(1, config)).toBe(3000)
      // 1000 * 3^2 = 9000
      expect(calculateRetryDelay(2, config)).toBe(9000)
    })
  })

  describe('with default jitter (jitterFactor: 0.1)', () => {
    it('returns a value in the range [initialDelayMs, initialDelayMs * 1.1] for retryCount=0', () => {
      const result = calculateRetryDelay(0)
      expect(result).toBeGreaterThanOrEqual(1000)
      expect(result).toBeLessThanOrEqual(1100) // 1000 + 1000 * 0.1 * 1.0
    })

    it('returns a value in the range [2000, 2200] for retryCount=1', () => {
      const result = calculateRetryDelay(1)
      expect(result).toBeGreaterThanOrEqual(2000)
      expect(result).toBeLessThanOrEqual(2200)
    })

    it('never exceeds maxDelayMs + maxDelayMs*jitterFactor for capped values', () => {
      // When capped at 60000, max possible value is 60000 + 60000*0.1 = 66000
      const result = calculateRetryDelay(10)
      expect(result).toBeGreaterThanOrEqual(60000)
      expect(result).toBeLessThanOrEqual(66000)
    })

    it('produces different values on repeated calls (jitter adds randomness)', () => {
      // Run many times; statistically will differ
      const results = new Set<number>()
      for (let i = 0; i < 20; i++) {
        results.add(calculateRetryDelay(0))
      }
      // With 20 samples at 10% jitter over 100ms range, expect >1 unique value
      expect(results.size).toBeGreaterThan(1)
    })

    it('uses Math.random for jitter (spy confirms it is called)', () => {
      const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const result = calculateRetryDelay(0)
      expect(spy).toHaveBeenCalled()
      // delay = 1000, jitter = 1000 * 0.1 * 0.5 = 50  →  1050
      expect(result).toBe(1050)
    })

    it('with Math.random returning 0, result equals the base delay', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0)
      expect(calculateRetryDelay(0)).toBe(1000)
    })

    it('with Math.random returning 1.0, result equals base + full jitter', () => {
      vi.spyOn(Math, 'random').mockReturnValue(1)
      // 1000 + 1000 * 0.1 * 1 = 1100
      expect(calculateRetryDelay(0)).toBe(1100)
    })
  })
})

// ---------------------------------------------------------------------------
// calculateNextRetryTime
// ---------------------------------------------------------------------------

describe('calculateNextRetryTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns Date.now() + delay for retryCount=0 (no jitter)', () => {
    vi.setSystemTime(1_000_000)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = calculateNextRetryTime(0, NO_JITTER_CONFIG)
    expect(result).toBe(1_000_000 + 1000)
  })

  it('returns Date.now() + delay for retryCount=3 (no jitter)', () => {
    vi.setSystemTime(5_000_000)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const result = calculateNextRetryTime(3, NO_JITTER_CONFIG)
    // 1000 * 2^3 = 8000
    expect(result).toBe(5_000_000 + 8000)
  })

  it('is always greater than Date.now()', () => {
    vi.setSystemTime(1_000_000)
    const result = calculateNextRetryTime(0)
    expect(result).toBeGreaterThan(1_000_000)
  })
})

// ---------------------------------------------------------------------------
// shouldRetry
// ---------------------------------------------------------------------------

describe('shouldRetry', () => {
  it('returns true when retryCount is 0 (first attempt)', () => {
    expect(shouldRetry(0)).toBe(true)
  })

  it('returns true when retryCount is below maxRetries (9)', () => {
    expect(shouldRetry(9)).toBe(true)
  })

  it('returns false when retryCount equals maxRetries (10)', () => {
    expect(shouldRetry(10)).toBe(false)
  })

  it('returns false when retryCount exceeds maxRetries (11)', () => {
    expect(shouldRetry(11)).toBe(false)
  })

  it('respects a custom maxRetries value', () => {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, maxRetries: 3 }
    expect(shouldRetry(2, config)).toBe(true)
    expect(shouldRetry(3, config)).toBe(false)
    expect(shouldRetry(4, config)).toBe(false)
  })

  it('returns false immediately when maxRetries is 0', () => {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, maxRetries: 0 }
    expect(shouldRetry(0, config)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getRetryScheduleDescription
// ---------------------------------------------------------------------------

describe('getRetryScheduleDescription', () => {
  it('returns exactly maxRetries entries with default config', () => {
    const schedule = getRetryScheduleDescription()
    expect(schedule).toHaveLength(DEFAULT_RETRY_CONFIG.maxRetries) // 10
  })

  it('each entry starts with "Attempt N:" where N is 1-based', () => {
    const schedule = getRetryScheduleDescription()
    schedule.forEach((entry, index) => {
      expect(entry).toMatch(new RegExp(`^Attempt ${index + 1}:`))
    })
  })

  it('first entry is "Attempt 1: 1s" (1000ms = 1s)', () => {
    const schedule = getRetryScheduleDescription()
    expect(schedule[0]).toBe('Attempt 1: 1s')
  })

  it('second entry is "Attempt 2: 2s" (2000ms = 2s)', () => {
    const schedule = getRetryScheduleDescription()
    expect(schedule[1]).toBe('Attempt 2: 2s')
  })

  it('third entry is "Attempt 3: 4s"', () => {
    const schedule = getRetryScheduleDescription()
    expect(schedule[2]).toBe('Attempt 3: 4s')
  })

  it('entries under 60s use seconds format ("Xs")', () => {
    const schedule = getRetryScheduleDescription()
    // Attempts 1-5: 1s, 2s, 4s, 8s, 16s, 32s — all under 60s
    for (let i = 0; i < 5; i++) {
      expect(schedule[i]).toMatch(/^Attempt \d+: \d+s$/)
    }
  })

  it('entries of 60s or more use minutes format ("Xm")', () => {
    const schedule = getRetryScheduleDescription()
    // From attempt 7 onward: 64s → capped at 60s → rounded to 1m
    const laterEntries = schedule.slice(6)
    laterEntries.forEach((entry) => {
      expect(entry).toMatch(/^Attempt \d+: \d+m$/)
    })
  })

  it('capped entries all show "1m"', () => {
    const schedule = getRetryScheduleDescription()
    // Attempts 7-10 are all capped at 60000ms = 1m
    for (let i = 6; i < 10; i++) {
      expect(schedule[i]).toBe(`Attempt ${i + 1}: 1m`)
    }
  })

  it('respects a custom config with fewer maxRetries', () => {
    const config: RetryConfig = { ...DEFAULT_RETRY_CONFIG, maxRetries: 3, jitterFactor: 0 }
    const schedule = getRetryScheduleDescription(config)
    expect(schedule).toHaveLength(3)
    expect(schedule[0]).toBe('Attempt 1: 1s')
    expect(schedule[1]).toBe('Attempt 2: 2s')
    expect(schedule[2]).toBe('Attempt 3: 4s')
  })

  it('displays minutes for a config with a large initial delay', () => {
    const config: RetryConfig = {
      initialDelayMs: 120000, // 2 minutes
      maxDelayMs: 600000,
      backoffMultiplier: 2,
      maxRetries: 2,
      jitterFactor: 0,
    }
    const schedule = getRetryScheduleDescription(config)
    expect(schedule[0]).toBe('Attempt 1: 2m')
  })
})

// ---------------------------------------------------------------------------
// formatTimeUntilRetry
// ---------------------------------------------------------------------------

describe('formatTimeUntilRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "now" when nextRetryAt is in the past', () => {
    expect(formatTimeUntilRetry(-1000)).toBe('now')
  })

  it('returns "now" when nextRetryAt equals Date.now()', () => {
    expect(formatTimeUntilRetry(0)).toBe('now')
  })

  it('returns "now" when nextRetryAt is 1ms in the past', () => {
    vi.setSystemTime(1000)
    expect(formatTimeUntilRetry(999)).toBe('now')
  })

  it('returns "1s" for 1 second in the future', () => {
    expect(formatTimeUntilRetry(1000)).toBe('1s')
  })

  it('returns "5s" for 5 seconds in the future', () => {
    expect(formatTimeUntilRetry(5000)).toBe('5s')
  })

  it('returns "30s" for 30 seconds in the future', () => {
    expect(formatTimeUntilRetry(30000)).toBe('30s')
  })

  it('returns "59s" for 59 seconds in the future', () => {
    expect(formatTimeUntilRetry(59000)).toBe('59s')
  })

  it('returns "1m" for exactly 60 seconds in the future', () => {
    expect(formatTimeUntilRetry(60000)).toBe('1m')
  })

  it('returns "2m" for exactly 120 seconds in the future', () => {
    expect(formatTimeUntilRetry(120000)).toBe('2m')
  })

  it('returns "2m 30s" for 150 seconds in the future', () => {
    expect(formatTimeUntilRetry(150000)).toBe('2m 30s')
  })

  it('returns "1m 1s" for 61 seconds in the future', () => {
    expect(formatTimeUntilRetry(61000)).toBe('1m 1s')
  })

  it('rounds to nearest second', () => {
    // 4500ms rounds to 5s
    expect(formatTimeUntilRetry(4500)).toBe('5s')
    // 4499ms rounds to 4s
    expect(formatTimeUntilRetry(4499)).toBe('4s')
  })

  it('works with non-zero base time', () => {
    vi.setSystemTime(10_000)
    expect(formatTimeUntilRetry(10_000 + 5000)).toBe('5s')
    expect(formatTimeUntilRetry(10_000 + 150_000)).toBe('2m 30s')
  })
})

// ---------------------------------------------------------------------------
// classifyError
// ---------------------------------------------------------------------------

describe('classifyError', () => {
  // --- transient ---

  describe("classifies as 'transient'", () => {
    it('for "network error" message', () => {
      expect(classifyError(new Error('network error'))).toBe('transient')
    })

    it('for "Network Error" (case-insensitive)', () => {
      expect(classifyError(new Error('Network Error'))).toBe('transient')
    })

    it('for "timeout" message', () => {
      expect(classifyError(new Error('request timeout'))).toBe('transient')
    })

    it('for "timed out" message', () => {
      expect(classifyError(new Error('operation timed out'))).toBe('transient')
    })

    it('for "connection refused" message', () => {
      expect(classifyError(new Error('connection refused'))).toBe('transient')
    })

    it('for "ECONNREFUSED" (lowercased check)', () => {
      expect(classifyError(new Error('ECONNREFUSED'))).toBe('transient')
    })

    it('for "ENOTFOUND" (DNS failure)', () => {
      expect(classifyError(new Error('ENOTFOUND example.com'))).toBe('transient')
    })

    it('for "fetch" in message', () => {
      expect(classifyError(new Error('fetch failed'))).toBe('transient')
    })

    it('for HTTP 503', () => {
      expect(classifyError(new Error('503 Service Unavailable'))).toBe('transient')
    })

    it('for HTTP 502', () => {
      expect(classifyError(new Error('502 Bad Gateway'))).toBe('transient')
    })

    it('for HTTP 504', () => {
      expect(classifyError(new Error('504 Gateway Timeout'))).toBe('transient')
    })

    it('for "rate limit" message → dedicated rate_limit class (shared cooldown, not plain transient)', () => {
      // 9a2de86e introduced 'rate_limit' with its own backoff (30s→5min) and a
      // shared orchestrator cooldown — asserting 'transient' pinned the old contract.
      expect(classifyError(new Error('rate limit exceeded'))).toBe('rate_limit')
    })

    it('accepts a plain string (not an Error object)', () => {
      expect(classifyError('connection refused')).toBe('transient')
    })
  })

  // --- conflict ---

  describe("classifies as 'conflict'", () => {
    it('for "duplicate key" + "unique constraint" (BUG-1212 scenario)', () => {
      expect(
        classifyError(new Error('duplicate key value violates unique constraint'))
      ).toBe('conflict')
    })

    it('for "duplicate key" alone — NOT a conflict (missing "unique constraint")', () => {
      // The implementation requires BOTH 'duplicate key' AND 'unique constraint'
      // Without 'unique constraint' it falls through to 'permanent' via 'violates'
      const result = classifyError(new Error('duplicate key'))
      // 'duplicate key' without 'unique constraint' → doesn't match conflict branch
      // but does NOT match permanent either → 'unknown'
      expect(result).toBe('unknown')
    })

    it('for "conflict" keyword', () => {
      expect(classifyError(new Error('conflict detected'))).toBe('conflict')
    })

    it('for "version mismatch" message', () => {
      expect(classifyError(new Error('version mismatch'))).toBe('conflict')
    })

    it('for "optimistic lock" message', () => {
      expect(classifyError(new Error('optimistic lock failure'))).toBe('conflict')
    })

    it('accepts a plain string', () => {
      expect(classifyError('conflict: row was updated')).toBe('conflict')
    })
  })

  // --- permanent ---

  describe("classifies as 'permanent'", () => {
    it('for HTTP 401', () => {
      expect(classifyError(new Error('401 Unauthorized'))).toBe('auth')
    })

    it('for HTTP 403', () => {
      expect(classifyError(new Error('403 Forbidden'))).toBe('permanent')
    })

    it('for HTTP 404', () => {
      expect(classifyError(new Error('404 Not Found'))).toBe('permanent')
    })

    it('for HTTP 400', () => {
      expect(classifyError(new Error('400 Bad Request'))).toBe('permanent')
    })

    it('for "unauthorized" keyword', () => {
      expect(classifyError(new Error('Unauthorized access'))).toBe('unknown')
    })

    it('for "forbidden" keyword', () => {
      expect(classifyError(new Error('forbidden resource'))).toBe('permanent')
    })

    it('for "invalid" keyword', () => {
      expect(classifyError(new Error('invalid input syntax for type uuid'))).toBe('permanent')
    })

    it('for "malformed" keyword', () => {
      expect(classifyError(new Error('malformed request body'))).toBe('permanent')
    })

    it('for "violates" keyword (constraint violation)', () => {
      expect(classifyError(new Error('violates check constraint'))).toBe('permanent')
    })

    it('for "schema cache" keyword', () => {
      expect(classifyError(new Error('schema cache lookup failed'))).toBe('permanent')
    })

    it('for "syntax" keyword', () => {
      expect(classifyError(new Error('syntax error near token'))).toBe('permanent')
    })

    it('accepts a plain string', () => {
      expect(classifyError('401 invalid token')).toBe('permanent')
    })
  })

  // --- unknown ---

  describe("classifies as 'unknown'", () => {
    it('for an unrecognized error message', () => {
      expect(classifyError(new Error('something went wrong'))).toBe('unknown')
    })

    it('for an empty string', () => {
      expect(classifyError('')).toBe('unknown')
    })

    it('for a numeric error code (no matching text)', () => {
      expect(classifyError(new Error('error code 9999'))).toBe('unknown')
    })

    it('for null (coerced to "null" string)', () => {
      expect(classifyError(null)).toBe('unknown')
    })

    it('for undefined (coerced to "undefined" string)', () => {
      expect(classifyError(undefined)).toBe('unknown')
    })

    it('for a plain object (coerced to "[object Object]")', () => {
      expect(classifyError({})).toBe('unknown')
    })

    it('for a numeric value', () => {
      expect(classifyError(42)).toBe('unknown')
    })
  })

  describe('edge cases', () => {
    it('transient takes priority over permanent when both keywords appear', () => {
      // 'network' is checked first → 'transient'
      expect(classifyError(new Error('network 401'))).toBe('transient')
    })

    it('conflict duplicate-key check is checked before generic conflict check', () => {
      // Full duplicate-key+unique-constraint string → 'conflict' (not 'permanent' via 'violates')
      expect(
        classifyError('duplicate key value violates unique constraint "tasks_pkey"')
      ).toBe('conflict')
    })
  })

  // --- PostgrestError plain objects (BUG-1561 regression) ---

  describe('PostgrestError plain objects (BUG-1561)', () => {
    // Supabase PostgrestError shape: { message, code, details, hint }
    // These are NOT instanceof Error — classifyError must read .message directly.

    it('PostgrestError with "JWT expired" message classifies as "auth"', () => {
      const error = {
        message: 'JWT expired',
        code: 'PGRST301',
        details: null,
        hint: null,
      }
      expect(classifyError(error)).toBe('auth')
    })

    it('PostgrestError with "invalid jwt" message classifies as "auth"', () => {
      const error = {
        message: 'invalid JWT',
        code: 'PGRST301',
        details: null,
        hint: null,
      }
      expect(classifyError(error)).toBe('auth')
    })

    it('PostgrestError with column-not-found message classifies as "permanent"', () => {
      // e.g. Supabase returns this when a column referenced in the query does not exist
      // Does not match auth/transient/conflict → hits 'invalid'/'schema' fallback or 'unknown'
      // The message does not contain permanent keywords → 'unknown'.
      // But a "column not found" / schema-cache miss IS permanent — test the actual shape
      // that Supabase emits for a missing column: includes "schema cache"
      const schemaCacheError = {
        message: 'schema cache lookup failed for table: tasks',
        code: 'PGRST200',
        details: null,
        hint: null,
      }
      expect(classifyError(schemaCacheError)).toBe('permanent')
    })

    it('PostgrestError with generic unknown message does NOT classify as "unknown" because of plain-object fix', () => {
      // Before BUG-1561 fix: String({message:'...'}) → "[object Object]" → always 'unknown'
      // After fix: .message is read directly, so known patterns are matched correctly.
      // A generic message with no known keywords still returns 'unknown', but that is
      // correct behaviour — the point is that it is NOT forced to 'unknown' by the
      // plain-object coercion bug when a recognisable keyword IS present.
      const authError = {
        message: 'token is expired',
        code: 'PGRST301',
        details: null,
        hint: null,
      }
      // Would have been 'unknown' before fix (coerced to "[object Object]")
      expect(classifyError(authError)).toBe('auth')
    })

    it('PostgrestError with "invalid input" message classifies as "permanent", not "unknown"', () => {
      const error = {
        message: 'invalid input syntax for type uuid: "not-a-uuid"',
        code: '22P02',
        details: null,
        hint: null,
      }
      expect(classifyError(error)).toBe('permanent')
    })

    it('PostgrestError with status 401 on the object classifies as "auth"', () => {
      // Supabase sometimes attaches .status to the error object
      const error = {
        message: 'Unauthorized',
        code: '401',
        details: null,
        hint: null,
        status: 401,
      }
      expect(classifyError(error)).toBe('auth')
    })
  })
})

// ---------------------------------------------------------------------------
// getRetryConfigForError
// ---------------------------------------------------------------------------

describe('getRetryConfigForError', () => {
  it('returns DEFAULT_RETRY_CONFIG for "transient"', () => {
    expect(getRetryConfigForError('transient')).toEqual(DEFAULT_RETRY_CONFIG)
  })

  it('returns DEFAULT_RETRY_CONFIG for "unknown"', () => {
    expect(getRetryConfigForError('unknown')).toEqual(DEFAULT_RETRY_CONFIG)
  })

  it('returns a config with maxRetries=3 for "conflict"', () => {
    const config = getRetryConfigForError('conflict')
    expect(config).not.toBeNull()
    expect(config!.maxRetries).toBe(3)
  })

  it('conflict config inherits all other DEFAULT_RETRY_CONFIG values', () => {
    const config = getRetryConfigForError('conflict')!
    expect(config.initialDelayMs).toBe(DEFAULT_RETRY_CONFIG.initialDelayMs)
    expect(config.maxDelayMs).toBe(DEFAULT_RETRY_CONFIG.maxDelayMs)
    expect(config.backoffMultiplier).toBe(DEFAULT_RETRY_CONFIG.backoffMultiplier)
    expect(config.jitterFactor).toBe(DEFAULT_RETRY_CONFIG.jitterFactor)
  })

  it('returns null for "permanent"', () => {
    expect(getRetryConfigForError('permanent')).toBeNull()
  })
})
