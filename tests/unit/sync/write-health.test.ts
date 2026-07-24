/**
 * TASK-1916 / BUG-1913: silent dropped writes must become user-visible.
 *
 * Prod-proven failure: direct DB writes died for an hour with the header
 * indicator green and zero user feedback. These tests pin the new contract:
 * exhausted write failures flip `writesFailing` + toast once per cooldown,
 * only the matching write clears it, and read fetches never trip it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  reportWriteFailure,
  reportWriteSuccess,
  writesFailing,
  writeFailureMessage,
  isWriteContext,
  setWriteHealthNotifier,
  __resetWriteHealthForTests,
  WRITE_FAILING_THRESHOLD,
  WRITE_HEALTH_STORAGE_KEY,
  WRITE_TOAST_COOLDOWN_MS,
  restoreUnresolvedWriteHealth,
  setWriteHealthScope,
} from '@/composables/sync/writeHealth'
import { createDatabaseHelpers } from '@/composables/supabase/_infrastructure'
import { ref } from 'vue'

describe('writeHealth core (TASK-1916)', () => {
  let toasts: Array<{ message: string; type: string }>

  beforeEach(() => {
    __resetWriteHealthForTests()
    setWriteHealthScope('user-a')
    toasts = []
    setWriteHealthNotifier((message, type) => toasts.push({ message, type }))
  })

  it('flips writesFailing after consecutive write failures and toasts once', () => {
    const t0 = 1_000_000
    reportWriteFailure('saveTask', 'boom', t0)
    expect(writesFailing.value).toBe(false)

    reportWriteFailure('saveTask', 'boom', t0 + 1000)
    expect(writesFailing.value).toBe(true)
    expect(writeFailureMessage.value).toBe('boom')
    expect(toasts.filter(t => t.type === 'error')).toHaveLength(1)

    // More failures inside the cooldown do NOT re-toast
    reportWriteFailure('deleteTask', 'boom2', t0 + 2000)
    expect(toasts.filter(t => t.type === 'error')).toHaveLength(1)

    // Past the cooldown, the reminder fires again
    reportWriteFailure('saveTask', 'boom3', t0 + 2000 + WRITE_TOAST_COOLDOWN_MS)
    expect(toasts.filter(t => t.type === 'error')).toHaveLength(2)
  })

  it('a successful write clears the same failing operation and announces recovery', () => {
    const t0 = 2_000_000
    for (let i = 0; i < WRITE_FAILING_THRESHOLD; i++) {
      reportWriteFailure('saveTask', 'boom', t0 + i)
    }
    expect(writesFailing.value).toBe(true)

    reportWriteSuccess('saveTask', t0 + 5000, 'saveTask')
    expect(writesFailing.value).toBe(false)
    expect(toasts.some(t => t.type === 'success')).toBe(true)

    // Recovery without prior failure state stays silent
    toasts = []
    reportWriteSuccess('saveTask', t0 + 6000, 'saveTask')
    expect(toasts).toHaveLength(0)
  })

  it('does not let an unrelated successful write hide a persistent failure', () => {
    const t0 = 2_500_000
    reportWriteFailure('saveTask', 'task write failed', t0)
    reportWriteFailure('saveTask', 'task write failed', t0 + 1)
    expect(writesFailing.value).toBe(true)

    reportWriteSuccess('saveProject', t0 + 2)

    expect(writesFailing.value).toBe(true)
    expect(writeFailureMessage.value).toBe('task write failed')
    expect(toasts.some(t => t.type === 'success')).toBe(false)
  })

  it('does not combine isolated failures from unrelated records into a false outage', () => {
    const t0 = 2_550_000
    reportWriteFailure('saveTask', 'task A failed once', t0, 'saveTask:task-a')
    reportWriteFailure('saveTask', 'task B failed once', t0 + 1, 'saveTask:task-b')

    expect(writesFailing.value).toBe(false)
    expect(writeFailureMessage.value).toBe('')
    expect(toasts).toHaveLength(0)
  })

  it('does not let the same operation on another task hide the failed task', () => {
    const t0 = 2_600_000
    reportWriteFailure('saveTask', 'task A failed', t0, 'saveTask:task-a')
    reportWriteFailure('saveTask', 'task A failed', t0 + 1, 'saveTask:task-a')

    reportWriteSuccess('saveTask', t0 + 2, 'saveTask:task-b')

    expect(writesFailing.value).toBe(true)
    expect(writeFailureMessage.value).toBe('task A failed')

    reportWriteSuccess('saveTask', t0 + 3, 'saveTask:task-a')
    expect(writesFailing.value).toBe(false)
  })

  it('restores unresolved write failures after a renderer restart', () => {
    const t0 = 2_750_000
    reportWriteFailure('saveTask', 'sensitive server detail', t0)
    reportWriteFailure('saveTask', 'sensitive server detail', t0 + 1)
    const storageKey = `${WRITE_HEALTH_STORAGE_KEY}:user-a`
    const durableState = localStorage.getItem(storageKey)
    expect(durableState).not.toContain('sensitive server detail')

    __resetWriteHealthForTests()
    localStorage.setItem(storageKey, durableState!)
    setWriteHealthScope('user-a')
    restoreUnresolvedWriteHealth()

    expect(writesFailing.value).toBe(true)
    expect(writeFailureMessage.value).toContain('previous change may not have saved')

    reportWriteSuccess('saveProject', t0 + 2)
    expect(writesFailing.value).toBe(true)

    reportWriteSuccess('saveTask', t0 + 3, 'saveTask')
    expect(writesFailing.value).toBe(false)
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('isolates unresolved failures between signed-in accounts', () => {
    const t0 = 2_800_000
    reportWriteFailure('saveTask', 'user A failed', t0, 'saveTask:task-a')
    reportWriteFailure('saveTask', 'user A failed', t0 + 1, 'saveTask:task-a')
    expect(writesFailing.value).toBe(true)

    setWriteHealthScope('user-b')
    expect(writesFailing.value).toBe(false)

    reportWriteSuccess('saveTask', t0 + 2, 'saveTask:task-a')
    setWriteHealthScope('user-a')
    expect(writesFailing.value).toBe(true)
  })

  it('keeps the in-memory warning working when browser storage is blocked', () => {
    const originalStorage = localStorage
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new DOMException('blocked', 'SecurityError') },
      setItem: () => { throw new DOMException('blocked', 'SecurityError') },
      removeItem: () => { throw new DOMException('blocked', 'SecurityError') },
      key: () => null,
      length: 0,
    })

    try {
      setWriteHealthScope('blocked-storage-user')
      reportWriteFailure('saveTask', 'failed', 2_900_000, 'saveTask:task-a')
      reportWriteFailure('saveTask', 'failed', 2_900_001, 'saveTask:task-a')
      expect(writesFailing.value).toBe(true)
    } finally {
      vi.stubGlobal('localStorage', originalStorage)
    }
  })

  it('retains inactive-account and anonymous failures in memory when storage is blocked', () => {
    const originalStorage = localStorage
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new DOMException('blocked', 'SecurityError') },
      setItem: () => { throw new DOMException('blocked', 'SecurityError') },
      removeItem: () => { throw new DOMException('blocked', 'SecurityError') },
      key: () => null,
      length: 0,
    })

    try {
      setWriteHealthScope('user-b')
      reportWriteFailure('saveTask', 'late user A failure', 2_950_000, 'saveTask:task-a', 'user-a')
      reportWriteFailure('saveTask', 'late user A failure', 2_950_001, 'saveTask:task-a', 'user-a')
      reportWriteFailure('saveTask', 'anonymous failure', 2_950_002, 'saveTask:task-x', null)
      reportWriteFailure('saveTask', 'anonymous failure', 2_950_003, 'saveTask:task-x', null)
      expect(writesFailing.value).toBe(false)

      setWriteHealthScope('user-a')
      expect(writesFailing.value).toBe(true)

      setWriteHealthScope(null)
      expect(writesFailing.value).toBe(true)
    } finally {
      vi.stubGlobal('localStorage', originalStorage)
    }
  })

  it('read contexts never count as writes in either direction', () => {
    const t0 = 3_000_000
    reportWriteFailure('fetchTasks', 'net down', t0)
    reportWriteFailure('fetchTasks', 'net down', t0 + 1)
    reportWriteFailure('loadSettings', 'net down', t0 + 2)
    expect(writesFailing.value).toBe(false)
    expect(toasts).toHaveLength(0)

    // A read success must not clear genuine write failures
    reportWriteFailure('saveTask', 'boom', t0 + 3)
    reportWriteFailure('saveTask', 'boom', t0 + 4)
    expect(writesFailing.value).toBe(true)
    reportWriteSuccess('fetchTasks', t0 + 5)
    expect(writesFailing.value).toBe(true)
  })

  it('classifies contexts used across the supabase modules', () => {
    for (const write of ['saveTask', 'saveTasks', 'deleteTask', 'permanentlyDeleteTask', 'updateGroup', 'upsertSettings']) {
      expect(isWriteContext(write), write).toBe(true)
    }
    for (const read of ['fetchTasks', 'fetchGroups', 'loadUserSettings', 'getTask', 'listProjects', 'checkTaskId']) {
      expect(isWriteContext(read), read).toBe(false)
    }
  })

  it('does not classify queue auth-gate skips as direct write failures', () => {
    const t0 = 4_000_000
    reportWriteFailure('queueFlushAuthGate', 'Sign-in expired — sign in again', t0)
    reportWriteFailure('queueFlushAuthGate', 'Sign-in expired — sign in again', t0 + 1)

    expect(isWriteContext('queueFlushAuthGate')).toBe(false)
    expect(writesFailing.value).toBe(false)
    expect(writeFailureMessage.value).toBe('')
    expect(toasts).toHaveLength(0)
  })
})

describe('withRetry feeds writeHealth (BUG-1913 regression)', () => {
  beforeEach(() => {
    __resetWriteHealthForTests()
    setWriteHealthScope('test-user')
    setWriteHealthNotifier(() => {})
  })

  it('exhausted write failures flip writesFailing; a later matching success clears it', async () => {
    const { withRetry } = createDatabaseHelpers(ref<string | null>(null), () => 'test-user')
    const nonTransient = Object.assign(new Error('RLS blocked'), { status: 400 })

    await expect(withRetry(() => Promise.reject(nonTransient), 'saveTask', 3, 'saveTask:task-a')).rejects.toThrow('RLS blocked')
    expect(writesFailing.value).toBe(false)

    await expect(withRetry(() => Promise.reject(nonTransient), 'saveTask', 3, 'saveTask:task-a')).rejects.toThrow('RLS blocked')
    expect(writesFailing.value).toBe(true)

    await withRetry(() => Promise.resolve('ok'), 'saveTask', 3, 'saveTask:task-a')
    expect(writesFailing.value).toBe(false)
  })

  it('never lets a legacy context-only success claim record-level recovery', async () => {
    const { withRetry } = createDatabaseHelpers(ref<string | null>(null), () => 'test-user')
    const nonTransient = Object.assign(new Error('RLS blocked'), { status: 400 })

    await expect(withRetry(() => Promise.reject(nonTransient), 'saveProject')).rejects.toThrow()
    await expect(withRetry(() => Promise.reject(nonTransient), 'saveProject')).rejects.toThrow()
    expect(writesFailing.value).toBe(true)

    await withRetry(() => Promise.resolve('ok'), 'saveProject')
    expect(writesFailing.value).toBe(true)
  })

  it('withRetry keeps failures isolated by write identity', async () => {
    const { withRetry } = createDatabaseHelpers(ref<string | null>(null), () => 'test-user')
    const nonTransient = Object.assign(new Error('RLS blocked'), { status: 400 })

    await expect(withRetry(
      () => Promise.reject(nonTransient),
      'saveTask',
      3,
      'saveTask:task-a'
    )).rejects.toThrow('RLS blocked')
    await expect(withRetry(
      () => Promise.reject(nonTransient),
      'saveTask',
      3,
      'saveTask:task-a'
    )).rejects.toThrow('RLS blocked')
    expect(writesFailing.value).toBe(true)

    await withRetry(() => Promise.resolve('ok'), 'saveTask', 3, 'saveTask:task-b')
    expect(writesFailing.value).toBe(true)

    await withRetry(() => Promise.resolve('ok'), 'saveTask', 3, 'saveTask:task-a')
    expect(writesFailing.value).toBe(false)
  })

  it('attributes late write failures to the account that started the request', async () => {
    let currentUser = 'user-a'
    const { withRetry } = createDatabaseHelpers(ref<string | null>(null), () => currentUser)
    const nonTransient = Object.assign(new Error('late RLS failure'), { status: 400 })
    setWriteHealthScope('user-a')

    const first = withRetry(
      () => Promise.reject(nonTransient),
      'saveTask',
      3,
      'saveTask:task-a'
    )
    currentUser = 'user-b'
    setWriteHealthScope('user-b')
    await expect(first).rejects.toThrow('late RLS failure')
    expect(writesFailing.value).toBe(false)

    currentUser = 'user-a'
    const second = withRetry(
      () => Promise.reject(nonTransient),
      'saveTask',
      3,
      'saveTask:task-a'
    )
    currentUser = 'user-b'
    await expect(second).rejects.toThrow('late RLS failure')
    expect(writesFailing.value).toBe(false)

    setWriteHealthScope('user-a')
    expect(writesFailing.value).toBe(true)
  })

  it('failing READ fetches never flip the indicator', async () => {
    const { withRetry } = createDatabaseHelpers(ref<string | null>(null), () => 'test-user')
    const nonTransient = Object.assign(new Error('parse error'), { status: 400 })

    for (let i = 0; i < 3; i++) {
      await expect(withRetry(() => Promise.reject(nonTransient), 'fetchTasks')).rejects.toThrow()
    }
    expect(writesFailing.value).toBe(false)
  })
})
