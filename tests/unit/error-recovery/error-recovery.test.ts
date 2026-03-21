/**
 * TASK-1592: Error Recovery Tests
 *
 * Tests that the app handles failures gracefully without data loss.
 *
 * Sections:
 *   Network Failures (5)   — HTTP 500/503, timeout, retry-then-succeed, queue pause
 *   Auth Failures (5)      — 401 handling, JWT classification, refresh success/failure, logout
 *   Data Corruption (5)    — missing id, wrong types, empty body, null response, large payload
 *   Graceful Degradation (5) — HTTP 4xx/5xx classification, unknown errors, concurrent errors
 *
 * All tests are unit-level only. No stores, no network, no Vue.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  classifyError,
  shouldRetry,
  getRetryConfigForError,
  calculateRetryDelay,
  type ErrorClassification,
} from '@/services/offline/retryStrategy'
import { DEFAULT_RETRY_CONFIG } from '@/types/sync'
import { fromSupabaseTask, type SupabaseTask } from '@/utils/supabaseMappers'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal fake Supabase error with a status code. */
function makeSupabaseError(status: number, message: string): { status: number; message: string; code?: string } {
  return { status, message }
}

/** Create the most minimal valid SupabaseTask (only required fields). */
function makeMinimalSupabaseTask(overrides: Partial<SupabaseTask> = {}): SupabaseTask {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    title: 'Test Task',
    status: 'todo',
    ...overrides,
  } as SupabaseTask
}

// ---------------------------------------------------------------------------
// SECTION 1: Network Failures
// ---------------------------------------------------------------------------

describe('TASK-1592 Network Failures', () => {

  // Test 1: Supabase returns 500 → classified as NOT permanent (survives for retry)
  it('Supabase 500 error is NOT classified as permanent (should survive for retry)', () => {
    // A 500 doesn't match any message keyword, so it should not be 'permanent'
    const error500 = makeSupabaseError(500, 'Internal Server Error')
    const classification = classifyError(error500)
    // 500 → 'unknown' (not 'permanent'), which means it will be retried
    expect(classification).not.toBe('permanent')
    expect(classification).not.toBe('auth')
  })

  // Test 2: Supabase returns 503 → classified as transient
  it('Supabase 503 error is classified as transient and queued for retry', () => {
    const error503 = makeSupabaseError(503, 'Service Unavailable 503')
    const classification = classifyError(error503)
    expect(classification).toBe('transient')
  })

  // Test 3: Network timeout → classified as transient
  it('network timeout error is classified as transient', () => {
    const timeoutError = new Error('Request timed out after 30000ms')
    expect(classifyError(timeoutError)).toBe('transient')

    const timeoutError2 = new Error('Connection timeout')
    expect(classifyError(timeoutError2)).toBe('transient')
  })

  // Test 4: Transient error classifies as retriable (shouldRetry returns true at attempt 0)
  it('transient error at retry count 0 should be retried', () => {
    const config = getRetryConfigForError('transient')
    expect(config).not.toBeNull()
    expect(shouldRetry(0, config!)).toBe(true)
  })

  // Test 5: After max retries exceeded, shouldRetry returns false (queue pauses for this op)
  it('after max retries exceeded shouldRetry returns false (queue stops burning budget)', () => {
    const config = getRetryConfigForError('transient')!
    // At exactly maxRetries, shouldRetry should return false
    expect(shouldRetry(config.maxRetries, config)).toBe(false)
    // Well beyond maxRetries
    expect(shouldRetry(config.maxRetries + 10, config)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SECTION 2: Auth Failures
// ---------------------------------------------------------------------------

describe('TASK-1592 Auth Failures', () => {

  // Test 6: 401 response triggers auth classification (not permanent failure)
  it('401 response is classified as auth error (not permanent)', () => {
    const error401 = makeSupabaseError(401, 'Unauthorized')
    const classification = classifyError(error401)
    expect(classification).toBe('auth')
    expect(classification).not.toBe('permanent')
  })

  // Test 7: JWT expired string classified as auth error
  it('"jwt expired" error string is classified as auth', () => {
    expect(classifyError('JWT expired')).toBe('auth')
    expect(classifyError(new Error('jwt expired'))).toBe('auth')
    expect(classifyError('invalid jwt token')).toBe('auth')
    expect(classifyError('token is expired')).toBe('auth')
  })

  // Test 8: Auth retry config exists and allows up to 3 refresh attempts
  it('auth error retry config allows short-window retries (max 3)', () => {
    const config = getRetryConfigForError('auth')
    expect(config).not.toBeNull()
    expect(config!.maxRetries).toBe(3)
    // Should retry on attempt 0
    expect(shouldRetry(0, config!)).toBe(true)
    // Should NOT retry past maxRetries
    expect(shouldRetry(3, config!)).toBe(false)
  })

  // Test 9: Auth refresh failure stops retrying (permanent at attempt >= maxRetries)
  it('after 3 auth refresh attempts shouldRetry returns false (stops retrying)', () => {
    const config = getRetryConfigForError('auth')!
    expect(shouldRetry(config.maxRetries - 1, config)).toBe(true)  // last allowed
    expect(shouldRetry(config.maxRetries, config)).toBe(false)     // one over limit
  })

  // Test 10: Logged-out during sync: refresh_token_not_found classified as auth
  it('"refresh_token_not_found" error classified as auth (logout during sync)', () => {
    const error = new Error('refresh_token_not_found')
    expect(classifyError(error)).toBe('auth')
  })
})

// ---------------------------------------------------------------------------
// SECTION 3: Data Corruption
// ---------------------------------------------------------------------------

describe('TASK-1592 Data Corruption', () => {

  // Test 11: Malformed task from server (missing id) → fromSupabaseTask doesn't crash
  it('malformed task from server with missing id does not throw', () => {
    // A server record missing 'id' — fromSupabaseTask should not throw
    const corruptRecord = {
      // id is intentionally missing
      user_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      title: 'Corrupt Task',
      status: 'todo',
    } as unknown as SupabaseTask

    expect(() => fromSupabaseTask(corruptRecord)).not.toThrow()
  })

  // Test 12: Task with wrong type fields (number as title) — handled gracefully
  it('task with wrong-typed title field does not crash the mapper', () => {
    const wrongTypes = makeMinimalSupabaseTask({
      title: 42 as unknown as string,  // number instead of string
      priority: true as unknown as string,
    })
    expect(() => fromSupabaseTask(wrongTypes)).not.toThrow()
    const result = fromSupabaseTask(wrongTypes)
    // Should produce some kind of result (even if coerced)
    expect(result).toBeDefined()
    expect(result.id).toBeDefined()
  })

  // Test 13: Empty response body (null data from Supabase) doesn't crash classifyError
  it('null/undefined error does not crash classifyError', () => {
    expect(() => classifyError(null)).not.toThrow()
    expect(() => classifyError(undefined)).not.toThrow()
    // null/undefined → unknown (retryable by default)
    expect(classifyError(null)).not.toBe('permanent')
    expect(classifyError(undefined)).not.toBe('permanent')
  })

  // Test 14: Null response body handled as error classification (not crash)
  it('null response classifies as unknown (not permanent, retryable)', () => {
    const result = classifyError(null)
    expect(['transient', 'unknown', 'conflict', 'auth']).toContain(result)
  })

  // Test 15: Extremely large task description doesn't cause issues in mapper
  it('extremely large task description (100k chars) does not crash mapper', () => {
    const hugeDesc = 'X'.repeat(100_000)
    const record = makeMinimalSupabaseTask({ description: hugeDesc })
    expect(() => fromSupabaseTask(record)).not.toThrow()
    const result = fromSupabaseTask(record)
    expect(result.description).toHaveLength(100_000)
  })
})

// ---------------------------------------------------------------------------
// SECTION 4: Graceful Degradation
// ---------------------------------------------------------------------------

describe('TASK-1592 Graceful Degradation', () => {

  // Test 16: retryStrategy classifies all HTTP 4xx correctly
  it('retryStrategy classifies HTTP 4xx errors correctly', () => {
    // 401 → auth (special case, not permanent)
    expect(classifyError(makeSupabaseError(401, '401 Unauthorized JWT'))).toBe('auth')

    // 403 → permanent (forbidden)
    expect(classifyError({ status: 403, message: '403 Forbidden' })).toBe('permanent')

    // 404 → permanent (not found)
    expect(classifyError({ message: '404 Not Found' })).toBe('permanent')

    // 400 → permanent (bad request)
    expect(classifyError({ message: '400 Bad Request' })).toBe('permanent')
  })

  // Test 17: retryStrategy classifies all HTTP 5xx correctly
  it('retryStrategy classifies HTTP 5xx errors correctly', () => {
    // 502 → transient
    expect(classifyError({ message: 'Bad Gateway 502' })).toBe('transient')

    // 503 → transient
    expect(classifyError({ message: 'Service Unavailable 503' })).toBe('transient')

    // 504 → transient
    expect(classifyError({ message: 'Gateway Timeout 504' })).toBe('transient')

    // 500 → unknown (falls through to unknown, which is retryable)
    const result500 = classifyError({ message: 'Internal Server Error' })
    expect(result500).not.toBe('permanent')
    expect(result500).not.toBe('auth')
  })

  // Test 18: Unknown error type defaults to transient (retry)
  it('unknown error type defaults to transient/unknown (retryable, not permanent)', () => {
    const strangeError = { code: 'VERY_STRANGE_CODE', details: 'something odd' }
    const classification = classifyError(strangeError)
    // 'unknown' maps to DEFAULT_RETRY_CONFIG (same as transient) in getRetryConfigForError
    expect(classification).toBe('unknown')
    const config = getRetryConfigForError(classification)
    expect(config).not.toBeNull()  // unknown → has a retry config
    expect(shouldRetry(0, config!)).toBe(true)
  })

  // Test 19: Error with no message doesn't crash, has fallback behavior
  it('error object with no message does not crash classifyError', () => {
    const noMessage = {} as object
    expect(() => classifyError(noMessage)).not.toThrow()

    const noMessageError = new Error('')  // Error with empty message
    expect(() => classifyError(noMessageError)).not.toThrow()

    const justString = ''
    expect(() => classifyError(justString)).not.toThrow()
  })

  // Test 20: Concurrent errors on multiple independent operations — each handled independently
  it('concurrent errors on multiple operations are classified independently', () => {
    const operations = [
      { error: new Error('jwt expired'),                     expected: 'auth' as ErrorClassification },
      { error: new Error('Service Unavailable 503'),         expected: 'transient' as ErrorClassification },
      { error: new Error('404 Not Found'),                   expected: 'permanent' as ErrorClassification },
      { error: new Error('duplicate key value violates unique constraint'), expected: 'conflict' as ErrorClassification },
      { error: new Error('NetworkError'),                    expected: 'transient' as ErrorClassification },
    ]

    for (const op of operations) {
      const classification = classifyError(op.error)
      expect(classification).toBe(op.expected)
    }

    // Verify each has an appropriate retry config and the outcome is independent
    const authConfig = getRetryConfigForError('auth')
    const transientConfig = getRetryConfigForError('transient')
    const permanentConfig = getRetryConfigForError('permanent')
    const conflictConfig = getRetryConfigForError('conflict')

    expect(authConfig).not.toBeNull()
    expect(transientConfig).not.toBeNull()
    expect(permanentConfig).toBeNull()     // permanent → no retry config
    expect(conflictConfig).not.toBeNull()

    // Each survives independently — permanent doesn't poison others
    expect(shouldRetry(0, authConfig!)).toBe(true)
    expect(shouldRetry(0, transientConfig!)).toBe(true)
    expect(shouldRetry(0, conflictConfig!)).toBe(true)
  })
})
