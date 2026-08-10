import type { CanonicalChangeScope } from './canonicalChangeCursor'

export interface CanonicalChange {
  changeSequence: number
  entityType: string
  entityId: string
  action: 'inserted' | 'updated' | 'deleted' | 'restored'
  tombstone: boolean
}

export interface CanonicalChangePageRequest {
  scope: CanonicalChangeScope
  afterSequence: number
  order: 'ascending'
  limit: number
}

export interface CanonicalTaskReconciliationRequest {
  scope: CanonicalChangeScope
  taskIds: string[]
  tombstoneTaskIds: string[]
}

export interface CanonicalChangeCatchupDependencies {
  readCursor(scope: CanonicalChangeScope): number | null
  persistCursor(scope: CanonicalChangeScope, sequence: number): Promise<void>
  resetCursor(scope: CanonicalChangeScope, sequence: number): Promise<void>
  readHighWater(scope: CanonicalChangeScope): Promise<number>
  reloadAuthoritativeScope(scope: CanonicalChangeScope): Promise<void>
  fetchChanges(request: CanonicalChangePageRequest): Promise<CanonicalChange[]>
  reconcileTaskIds(request: CanonicalTaskReconciliationRequest): Promise<void>
}

export interface CanonicalChangeCatchupResult {
  baseline: boolean
  finalSequence: number
  reconciledTaskIds: string[]
}

interface EmptyProjectionRecoveryOptions {
  failedScope: CanonicalChangeScope
  getActiveScope(): CanonicalChangeScope | null
  hasVisibleTasks(): boolean
  clearCursor(scope: CanonicalChangeScope): void
  runCatchup(scope: CanonicalChangeScope): Promise<unknown>
  onError?(error: unknown): void
}

function sameScope(left: CanonicalChangeScope | null, right: CanonicalChangeScope): boolean {
  if (!left || left.kind !== right.kind || left.userId !== right.userId) return false
  if (left.kind === 'personal') return true
  return right.kind === 'workspace' && left.workspaceId === right.workspaceId
}

/**
 * A durable canonical cursor proves which remote changes were consumed; it does
 * not prove the renderer still has that projection. If authenticated hydration
 * fails while the visible task store is empty, clear only the still-active
 * scope so the existing baseline/poller path remains retryable.
 */
export async function recoverEmptyAuthenticatedProjection(
  options: EmptyProjectionRecoveryOptions,
): Promise<boolean> {
  if (options.hasVisibleTasks()) return false
  if (!sameScope(options.getActiveScope(), options.failedScope)) return false

  options.clearCursor(options.failedScope)
  try {
    await options.runCatchup(options.failedScope)
  } catch (error) {
    options.onError?.(error)
  }
  return true
}

const PAGE_SIZE = 200
const MAX_PAGES_PER_RUN = 20

function scopeKey(scope: CanonicalChangeScope): string {
  return scope.kind === 'personal'
    ? `personal:${scope.userId}`
    : `workspace:${scope.userId}:${scope.workspaceId}`
}

function validatePage(page: CanonicalChange[], afterSequence: number): void {
  let previous = afterSequence
  for (const change of page) {
    if (!Number.isSafeInteger(change.changeSequence) || change.changeSequence <= previous) {
      throw new Error('Canonical change page is not strictly ascending')
    }
    if (!change.entityId || typeof change.entityId !== 'string') {
      throw new Error('Canonical change page contains an invalid entity identity')
    }
    previous = change.changeSequence
  }
}

export function createCanonicalChangeCatchup(deps: CanonicalChangeCatchupDependencies) {
  const inFlight = new Map<string, Promise<CanonicalChangeCatchupResult>>()

  const execute = async (scope: CanonicalChangeScope): Promise<CanonicalChangeCatchupResult> => {
    const persisted = deps.readCursor(scope)
    if (persisted === null) {
      const highWater = await deps.readHighWater(scope)
      if (!Number.isSafeInteger(highWater) || highWater < 0) {
        throw new Error('Canonical high-water sequence is invalid')
      }
      await deps.reloadAuthoritativeScope(scope)
      await deps.persistCursor(scope, highWater)
      return { baseline: true, finalSequence: highWater, reconciledTaskIds: [] }
    }

    const currentHighWater = await deps.readHighWater(scope)
    if (!Number.isSafeInteger(currentHighWater) || currentHighWater < 0) {
      throw new Error('Canonical high-water sequence is invalid')
    }
    if (persisted > currentHighWater) {
      await deps.reloadAuthoritativeScope(scope)
      await deps.resetCursor(scope, currentHighWater)
      return { baseline: true, finalSequence: currentHighWater, reconciledTaskIds: [] }
    }

    let afterSequence = persisted
    const changes: CanonicalChange[] = []
    for (let pageNumber = 0; pageNumber < MAX_PAGES_PER_RUN; pageNumber += 1) {
      const page = await deps.fetchChanges({
        scope,
        afterSequence,
        order: 'ascending',
        limit: PAGE_SIZE,
      })
      validatePage(page, afterSequence)
      if (page.length === 0) break
      changes.push(...page)
      afterSequence = page[page.length - 1].changeSequence
      if (page.length < PAGE_SIZE) break
    }

    if (changes.length === 0) {
      return { baseline: false, finalSequence: persisted, reconciledTaskIds: [] }
    }

    const latestTaskState = new Map<string, 'present' | 'tombstone'>()
    for (const change of changes) {
      if (change.entityType !== 'task') continue
      latestTaskState.set(
        change.entityId,
        change.tombstone || change.action === 'deleted' ? 'tombstone' : 'present',
      )
    }
    const taskIds = [...latestTaskState]
      .filter(([, state]) => state === 'present')
      .map(([taskId]) => taskId)
    const tombstoneTaskIds = [...latestTaskState]
      .filter(([, state]) => state === 'tombstone')
      .map(([taskId]) => taskId)

    if (taskIds.length > 0 || tombstoneTaskIds.length > 0) {
      await deps.reconcileTaskIds({
        scope,
        taskIds,
        tombstoneTaskIds,
      })
    }
    await deps.persistCursor(scope, afterSequence)
    return {
      baseline: false,
      finalSequence: afterSequence,
      reconciledTaskIds: [...taskIds, ...tombstoneTaskIds],
    }
  }

  return {
    run(scope: CanonicalChangeScope): Promise<CanonicalChangeCatchupResult> {
      const key = scopeKey(scope)
      const existing = inFlight.get(key)
      if (existing) return existing
      const promise = execute(scope).finally(() => {
        if (inFlight.get(key) === promise) inFlight.delete(key)
      })
      inFlight.set(key, promise)
      return promise
    },
  }
}

interface CanonicalChangePollerOptions {
  run(scope: CanonicalChangeScope): Promise<unknown>
  getScopes(): CanonicalChangeScope[]
  isAuthenticated(): boolean
  isOnline(): boolean
  intervalMs?: number
  afterRun?(scope: CanonicalChangeScope): Promise<void> | void
  onError?(error: unknown): void
}

export function createCanonicalChangePoller(options: CanonicalChangePollerOptions) {
  let timer: ReturnType<typeof setInterval> | null = null
  let busy = false
  const tick = async () => {
    if (busy || !options.isAuthenticated() || !options.isOnline()) return
    busy = true
    try {
      const scopes = options.getScopes()
      await Promise.all(scopes.map(scope => options.run(scope)))
      if (options.afterRun) {
        await Promise.all(scopes.map(scope => options.afterRun!(scope)))
      }
    } catch (error) {
      options.onError?.(error)
    } finally {
      busy = false
    }
  }

  return {
    start(): void {
      if (timer !== null) return
      timer = setInterval(() => { void tick() }, options.intervalMs ?? 60_000)
    },
    stop(): void {
      if (timer === null) return
      clearInterval(timer)
      timer = null
    },
  }
}
