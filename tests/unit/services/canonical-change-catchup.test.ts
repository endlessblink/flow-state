import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCanonicalChangeCatchup,
  createCanonicalChangePoller,
  type CanonicalChange,
  type CanonicalChangeCatchupDependencies,
  type CanonicalChangePageRequest,
} from '@/services/sync/canonicalChangeCatchup'
import type { CanonicalChangeScope } from '@/services/sync/canonicalChangeCursor'

const personalScope: CanonicalChangeScope = { kind: 'personal', userId: 'user-a' }
const workspaceScope: CanonicalChangeScope = {
  kind: 'workspace',
  userId: 'user-a',
  workspaceId: 'workspace-a',
}

function change(
  changeSequence: number,
  entityId: string,
  overrides: Partial<CanonicalChange> = {}
): CanonicalChange {
  return {
    changeSequence,
    entityType: 'task',
    entityId,
    action: 'updated',
    tombstone: false,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function createHarness(overrides: Partial<CanonicalChangeCatchupDependencies> = {}) {
  const cursors = new Map<string, number>()
  const scopeKey = (scope: CanonicalChangeScope) => JSON.stringify(scope)
  const deps: CanonicalChangeCatchupDependencies = {
    readCursor: vi.fn(scope => cursors.get(scopeKey(scope)) ?? null),
    persistCursor: vi.fn(async (scope, sequence) => {
      cursors.set(scopeKey(scope), sequence)
    }),
    resetCursor: vi.fn(async (scope, sequence) => {
      cursors.set(scopeKey(scope), sequence)
    }),
    readHighWater: vi.fn().mockResolvedValue(1_000),
    reloadAuthoritativeScope: vi.fn().mockResolvedValue(undefined),
    fetchChanges: vi.fn().mockResolvedValue([]),
    reconcileTaskIds: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  return { deps, cursors, scopeKey, catchup: createCanonicalChangeCatchup(deps) }
}

describe('TASK-1947 deterministic canonical change catch-up', () => {
  it('takes a first-run high-water baseline before reload and persists it only after reload succeeds', async () => {
    const order: string[] = []
    const harness = createHarness({
      readHighWater: vi.fn(async () => {
        order.push('high-water')
        return 73
      }),
      reloadAuthoritativeScope: vi.fn(async () => {
        order.push('reload')
      }),
      persistCursor: vi.fn(async () => {
        order.push('persist')
      }),
    })

    await harness.catchup.run(personalScope)

    expect(order).toEqual(['high-water', 'reload', 'persist'])
    expect(harness.deps.persistCursor).toHaveBeenCalledWith(personalScope, 73)
    expect(harness.deps.fetchChanges).not.toHaveBeenCalled()
  })

  it('does not persist a first-run baseline when authoritative reload fails', async () => {
    const harness = createHarness({
      readHighWater: vi.fn().mockResolvedValue(73),
      reloadAuthoritativeScope: vi.fn().mockRejectedValue(new Error('reload failed')),
    })

    await expect(harness.catchup.run(personalScope)).rejects.toThrow('reload failed')

    expect(harness.deps.persistCursor).not.toHaveBeenCalled()
  })

  it('forces an authoritative rebaseline when the stored cursor is ahead of scoped high-water', async () => {
    const order: string[] = []
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(900),
      readHighWater: vi.fn().mockResolvedValue(12),
      reloadAuthoritativeScope: vi.fn(async () => { order.push('reload') }),
      resetCursor: vi.fn(async (_scope, sequence) => { order.push(`reset:${sequence}`) }),
    })

    await harness.catchup.run(personalScope)

    expect(order).toEqual(['reload', 'reset:12'])
    expect(harness.deps.fetchChanges).not.toHaveBeenCalled()
  })

  it('requests ascending bounded pages after the persisted sequence with exact personal scope filters', async () => {
    const requests: CanonicalChangePageRequest[] = []
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(10),
      fetchChanges: vi.fn(async request => {
        requests.push(request)
        if (requests.length === 1) {
          return Array.from({ length: 200 }, (_, index) =>
            change(11 + index, `task-${index}`)
          )
        }
        return []
      }),
    })

    await harness.catchup.run(personalScope)

    expect(requests).toEqual([
      {
        scope: { kind: 'personal', userId: 'user-a' },
        afterSequence: 10,
        order: 'ascending',
        limit: 200,
      },
      {
        scope: { kind: 'personal', userId: 'user-a' },
        afterSequence: 210,
        order: 'ascending',
        limit: 200,
      },
    ])
  })

  it('uses only the exact workspace scope when reading workspace changes', async () => {
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(4),
    })

    await harness.catchup.run(workspaceScope)

    expect(harness.deps.fetchChanges).toHaveBeenCalledWith({
      scope: {
        kind: 'workspace',
        userId: 'user-a',
        workspaceId: 'workspace-a',
      },
      afterSequence: 4,
      order: 'ascending',
      limit: 200,
    })
  })

  it('reconciles exact task IDs and tombstones from change evidence before advancing', async () => {
    const order: string[] = []
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(20),
      fetchChanges: vi
        .fn()
        .mockResolvedValueOnce([
          change(21, 'task-a'),
          change(22, 'task-a'),
          change(23, 'task-deleted', { action: 'deleted', tombstone: true }),
          change(24, 'project-ignored', { entityType: 'project' }),
        ])
        .mockResolvedValueOnce([]),
      reconcileTaskIds: vi.fn(async request => {
        order.push('reconcile')
        expect(request).toEqual({
          scope: personalScope,
          taskIds: ['task-a'],
          tombstoneTaskIds: ['task-deleted'],
        })
      }),
      persistCursor: vi.fn(async (_scope, sequence) => {
        order.push(`persist:${sequence}`)
      }),
    })

    await harness.catchup.run(personalScope)

    expect(order).toEqual(['reconcile', 'persist:24'])
  })

  it('uses the latest ordered task action when a task is deleted then restored in one batch', async () => {
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(24),
      fetchChanges: vi.fn().mockResolvedValue([
        change(25, 'task-a', { action: 'deleted', tombstone: true }),
        change(26, 'task-a', { action: 'restored', tombstone: false }),
      ]),
    })

    await harness.catchup.run(personalScope)

    expect(harness.deps.reconcileTaskIds).toHaveBeenCalledWith({
      scope: personalScope,
      taskIds: ['task-a'],
      tombstoneTaskIds: [],
    })
  })

  it('keeps the prior cursor when the page query fails', async () => {
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(30),
      fetchChanges: vi.fn().mockRejectedValue(new Error('query failed')),
    })

    await expect(harness.catchup.run(personalScope)).rejects.toThrow('query failed')

    expect(harness.deps.reconcileTaskIds).not.toHaveBeenCalled()
    expect(harness.deps.persistCursor).not.toHaveBeenCalled()
  })

  it('keeps the prior cursor when authoritative task reconciliation fails', async () => {
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(30),
      fetchChanges: vi.fn().mockResolvedValue([change(31, 'task-a')]),
      reconcileTaskIds: vi.fn().mockRejectedValue(new Error('persistence failed')),
    })

    await expect(harness.catchup.run(personalScope)).rejects.toThrow('persistence failed')

    expect(harness.deps.persistCursor).not.toHaveBeenCalled()
  })

  it('advances the cursor only after authoritative projection persistence resolves', async () => {
    const persisted = deferred<void>()
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(40),
      fetchChanges: vi
        .fn()
        .mockResolvedValueOnce([change(41, 'task-a')])
        .mockResolvedValueOnce([]),
      reconcileTaskIds: vi.fn().mockReturnValue(persisted.promise),
    })

    const run = harness.catchup.run(personalScope)
    await Promise.resolve()
    await Promise.resolve()
    expect(harness.deps.persistCursor).not.toHaveBeenCalled()

    persisted.resolve()
    await run

    expect(harness.deps.persistCursor).toHaveBeenCalledWith(personalScope, 41)
  })

  it('coalesces concurrent triggers for the same scope into one in-flight run', async () => {
    const page = deferred<CanonicalChange[]>()
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(50),
      fetchChanges: vi.fn().mockReturnValue(page.promise),
    })

    const first = harness.catchup.run(personalScope)
    const second = harness.catchup.run(personalScope)
    await Promise.resolve()
    expect(harness.deps.fetchChanges).toHaveBeenCalledTimes(1)

    page.resolve([])
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({ finalSequence: 50 }),
      expect.objectContaining({ finalSequence: 50 }),
    ])
    expect(harness.deps.fetchChanges).toHaveBeenCalledTimes(1)
  })

  it('does not coalesce different personal or workspace scopes', async () => {
    const harness = createHarness({
      readCursor: vi.fn().mockReturnValue(1),
    })

    await Promise.all([harness.catchup.run(personalScope), harness.catchup.run(workspaceScope)])

    expect(harness.deps.fetchChanges).toHaveBeenCalledTimes(2)
  })
})

describe('TASK-1947 foreground catch-up poller', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls every 60 seconds while authenticated and online, including hidden renderers', async () => {
    const state = { authenticated: true, online: true, visible: true }
    const run = vi.fn().mockResolvedValue(undefined)
    const poller = createCanonicalChangePoller({
      run,
      getScopes: () => [personalScope],
      isAuthenticated: () => state.authenticated,
      isOnline: () => state.online,
    })
    poller.start()

    await vi.advanceTimersByTimeAsync(59_999)
    expect(run).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledOnce()

    state.visible = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledTimes(2)

    state.visible = true
    state.online = false
    await vi.advanceTimersByTimeAsync(60_000)
    state.online = true
    state.authenticated = false
    await vi.advanceTimersByTimeAsync(60_000)

    expect(run).toHaveBeenCalledTimes(2)
    poller.stop()
  })

  it('does not overlap foreground poll runs when one interval is still in flight', async () => {
    const inFlight = deferred<void>()
    const run = vi.fn().mockReturnValue(inFlight.promise)
    const poller = createCanonicalChangePoller({
      run,
      getScopes: () => [personalScope],
      isAuthenticated: () => true,
      isOnline: () => true,
    })
    poller.start()

    await vi.advanceTimersByTimeAsync(180_000)
    expect(run).toHaveBeenCalledOnce()

    inFlight.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledTimes(2)
    poller.stop()
  })

  it('runs the projection recovery hook after canonical catch-up completes', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const afterRun = vi.fn().mockResolvedValue(undefined)
    const poller = createCanonicalChangePoller({
      run,
      afterRun,
      getScopes: () => [personalScope],
      isAuthenticated: () => true,
      isOnline: () => true,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(run).toHaveBeenCalledOnce()
    expect(afterRun).toHaveBeenCalledWith(personalScope)
    expect(afterRun.mock.invocationCallOrder[0]).toBeGreaterThan(run.mock.invocationCallOrder[0])
    poller.stop()
  })

  it('runs projection recovery even when canonical catch-up fails', async () => {
    const run = vi.fn().mockRejectedValue(new Error('cursor read failed'))
    const afterRun = vi.fn().mockResolvedValue(undefined)
    const onError = vi.fn()
    const poller = createCanonicalChangePoller({
      run,
      afterRun,
      onError,
      getScopes: () => [personalScope],
      isAuthenticated: () => true,
      isOnline: () => true,
    })

    poller.start()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(afterRun).toHaveBeenCalledWith(personalScope)
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'cursor read failed' }))
    poller.stop()
  })

  it('stops the foreground interval cleanly', async () => {
    const run = vi.fn().mockResolvedValue(undefined)
    const poller = createCanonicalChangePoller({
      run,
      getScopes: () => [personalScope],
      isAuthenticated: () => true,
      isOnline: () => true,
    })

    poller.start()
    poller.stop()
    await vi.advanceTimersByTimeAsync(120_000)

    expect(run).not.toHaveBeenCalled()
  })
})
