/**
 * TASK-1916 / BUG-1913: silent dropped writes must become user-visible.
 *
 * Prod-proven failure: direct DB writes died for an hour with the header
 * indicator green and zero user feedback. These tests pin the new contract:
 * exhausted write failures flip `writesFailing` + toast once per cooldown,
 * any successful write clears it, and read fetches never trip it.
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
  WRITE_TOAST_COOLDOWN_MS,
} from '@/composables/sync/writeHealth'
import { createDatabaseHelpers } from '@/composables/supabase/_infrastructure'
import { ref } from 'vue'

describe('writeHealth core (TASK-1916)', () => {
  let toasts: Array<{ message: string; type: string }>

  beforeEach(() => {
    __resetWriteHealthForTests()
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

  it('a successful write clears the failing state and announces recovery', () => {
    const t0 = 2_000_000
    for (let i = 0; i < WRITE_FAILING_THRESHOLD; i++) {
      reportWriteFailure('saveTask', 'boom', t0 + i)
    }
    expect(writesFailing.value).toBe(true)

    reportWriteSuccess('saveTask', t0 + 5000)
    expect(writesFailing.value).toBe(false)
    expect(toasts.some(t => t.type === 'success')).toBe(true)

    // Recovery without prior failure state stays silent
    toasts = []
    reportWriteSuccess('saveTask', t0 + 6000)
    expect(toasts).toHaveLength(0)
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
    setWriteHealthNotifier(() => {})
  })

  it('exhausted write failures flip writesFailing; a later success clears it', async () => {
    const { withRetry } = createDatabaseHelpers(ref<string | null>(null))
    const nonTransient = Object.assign(new Error('RLS blocked'), { status: 400 })

    await expect(withRetry(() => Promise.reject(nonTransient), 'saveTask')).rejects.toThrow('RLS blocked')
    expect(writesFailing.value).toBe(false)

    await expect(withRetry(() => Promise.reject(nonTransient), 'saveTask')).rejects.toThrow('RLS blocked')
    expect(writesFailing.value).toBe(true)

    await withRetry(() => Promise.resolve('ok'), 'saveTask')
    expect(writesFailing.value).toBe(false)
  })

  it('failing READ fetches never flip the indicator', async () => {
    const { withRetry } = createDatabaseHelpers(ref<string | null>(null))
    const nonTransient = Object.assign(new Error('parse error'), { status: 400 })

    for (let i = 0; i < 3; i++) {
      await expect(withRetry(() => Promise.reject(nonTransient), 'fetchTasks')).rejects.toThrow()
    }
    expect(writesFailing.value).toBe(false)
  })
})
