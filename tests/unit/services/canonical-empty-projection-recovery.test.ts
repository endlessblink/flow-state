import { describe, expect, it, vi } from 'vitest'
import {
  createCanonicalChangeCatchup,
  recoverEmptyAuthenticatedProjection,
} from '@/services/sync/canonicalChangeCatchup'
import {
  canonicalChangeCursorKey,
  createCanonicalChangeCursorStore,
  type CanonicalChangeScope,
} from '@/services/sync/canonicalChangeCursor'

type RecoveryOptions = {
  failedScope: CanonicalChangeScope
  getActiveScope: () => CanonicalChangeScope | null
  hasVisibleTasks: () => boolean
  clearCursor: (scope: CanonicalChangeScope) => void
  runCatchup: (scope: CanonicalChangeScope) => Promise<unknown>
  onError?: (error: unknown) => void
}

const typedRecovery: (options: RecoveryOptions) => Promise<boolean> = recoverEmptyAuthenticatedProjection

const personalScope = (userId = 'user-1'): CanonicalChangeScope => ({
  kind: 'personal',
  userId,
})

describe('authenticated empty projection recovery', () => {
  it('provides a scoped recovery entrypoint', () => {
    expect(typedRecovery).toBeTypeOf('function')
  })

  it('clears a stale cursor and leaves failed baseline recovery retryable', async () => {
    const storage = new Map<string, string>()
    const storageAdapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    }
    const cursorStore = createCanonicalChangeCursorStore(storageAdapter)
    const scope = personalScope()
    cursorStore.write(scope, 41)

    let visibleTaskCount = 0
    let baselineAttempts = 0
    const catchup = createCanonicalChangeCatchup({
      readCursor: value => cursorStore.read(value),
      persistCursor: async (value, sequence) => cursorStore.write(value, sequence),
      resetCursor: async (value, sequence) => cursorStore.reset(value, sequence),
      readHighWater: async () => 41,
      reloadAuthoritativeScope: async () => {
        baselineAttempts += 1
        if (baselineAttempts === 1) throw new Error('transient renderer hydration failure')
        visibleTaskCount = 25
      },
      fetchChanges: vi.fn(async () => []),
      reconcileTaskIds: vi.fn(async () => undefined),
    })
    const errors: unknown[] = []

    const started = await typedRecovery({
      failedScope: scope,
      getActiveScope: () => scope,
      hasVisibleTasks: () => visibleTaskCount > 0,
      clearCursor: value => cursorStore.clear(value),
      runCatchup: value => catchup.run(value),
      onError: error => errors.push(error),
    })

    expect(started).toBe(true)
    expect(baselineAttempts).toBe(1)
    expect(errors).toHaveLength(1)
    expect(storage.has(canonicalChangeCursorKey(scope))).toBe(false)

    await catchup.run(scope)

    expect(baselineAttempts).toBe(2)
    expect(visibleTaskCount).toBe(25)
    expect(cursorStore.read(scope)).toBe(41)
  })

  it('does not clear or reload after auth/workspace scope changes', async () => {
    const clearCursor = vi.fn()
    const runCatchup = vi.fn(async () => undefined)
    const started = await typedRecovery({
      failedScope: personalScope('user-a'),
      getActiveScope: () => personalScope('user-b'),
      hasVisibleTasks: () => false,
      clearCursor,
      runCatchup,
    })

    expect(started).toBe(false)
    expect(clearCursor).not.toHaveBeenCalled()
    expect(runCatchup).not.toHaveBeenCalled()
  })

  it('does nothing when the renderer already has visible account tasks', async () => {
    const clearCursor = vi.fn()
    const runCatchup = vi.fn(async () => undefined)
    const scope = personalScope()
    const started = await typedRecovery({
      failedScope: scope,
      getActiveScope: () => scope,
      hasVisibleTasks: () => true,
      clearCursor,
      runCatchup,
    })

    expect(started).toBe(false)
    expect(clearCursor).not.toHaveBeenCalled()
    expect(runCatchup).not.toHaveBeenCalled()
  })
})
