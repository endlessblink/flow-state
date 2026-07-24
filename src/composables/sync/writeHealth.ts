/**
 * TASK-1916: Central write-health tracking — no more silent dropped writes.
 *
 * BUG-1913 background: the header SyncStatusIndicator mirrors only the offline
 * queue (useSyncOrchestrator), but most CRUD still writes DIRECTLY through the
 * supabase modules. When those direct writes fail after retries, the app used
 * to swallow the outcome (console-only) — the indicator kept saying
 * "All changes saved" while the user's deletions/edits silently died
 * (prod-proven: hour-long write-dead windows perceived as "resurrection").
 *
 * This module is fed by `withRetry` in supabase/_infrastructure.ts — the
 * single funnel every direct DB operation passes through. Two unresolved failures
 * for the same write identity flip `writesFailing`; the syncStatus store overlays that on the
 * header indicator, and a rate-limited toast tells the user their changes
 * aren't saving. A success only resolves failures for the same operation.
 */
import { ref, computed } from 'vue'

/** Consecutive failed writes before we declare writes unhealthy. */
export const WRITE_FAILING_THRESHOLD = 2
/** Minimum gap between "changes aren't saving" toasts. */
export const WRITE_TOAST_COOLDOWN_MS = 5 * 60 * 1000
export const WRITE_HEALTH_STORAGE_KEY = 'flowstate-unresolved-write-health-v1'
const RESTORED_FAILURE_MESSAGE = 'A previous change may not have saved. Retry or verify the affected change.'

interface WriteFailureIncident {
  context: string
  count: number
  message: string
  firstFailedAt: number
  lastFailedAt: number
}

const failureIncidents = ref<Record<string, WriteFailureIncident>>({})
const scopedIncidentMemory = new Map<string, Record<string, WriteFailureIncident>>()
const ANONYMOUS_SCOPE = '__anonymous__'
let activeScope: string | null = null
let lastToastAt = 0

type Notifier = (message: string, type: 'error' | 'success', options?: { duration?: number }) => void
let notifier: Notifier | null = null

function storageKey(scope: string): string {
  return `${WRITE_HEALTH_STORAGE_KEY}:${scope}`
}

function memoryKey(scope: string | null): string {
  return scope ?? ANONYMOUS_SCOPE
}

function readStoredIncidents(scope: string): Record<string, WriteFailureIncident> {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(storageKey(scope))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Partial<WriteFailureIncident>>
    const restored: Record<string, WriteFailureIncident> = {}
    for (const [identity, incident] of Object.entries(parsed)) {
      const context = typeof incident.context === 'string' ? incident.context : ''
      if (!isWriteContext(context)) continue
      const count = Number(incident.count)
      const firstFailedAt = Number(incident.firstFailedAt)
      const lastFailedAt = Number(incident.lastFailedAt)
      if (!Number.isFinite(count) || count < 1 || !Number.isFinite(firstFailedAt) || !Number.isFinite(lastFailedAt)) continue
      restored[identity] = {
        context,
        count,
        message: RESTORED_FAILURE_MESSAGE,
        firstFailedAt,
        lastFailedAt,
      }
    }
    return restored
  } catch {
    try {
      localStorage.removeItem(storageKey(scope))
    } catch {
      // Storage can be present but blocked by browser policy.
    }
    return {}
  }
}

function writeStoredIncidents(scope: string, incidents: Record<string, WriteFailureIncident>): void {
  try {
    if (typeof localStorage === 'undefined') return
    const key = storageKey(scope)
    if (Object.keys(incidents).length === 0) {
      localStorage.removeItem(key)
      return
    }
    const durableIncidents = Object.fromEntries(
      Object.entries(incidents).map(([identity, incident]) => [
        identity,
        {
          context: incident.context,
          count: incident.count,
          firstFailedAt: incident.firstFailedAt,
          lastFailedAt: incident.lastFailedAt,
        },
      ])
    )
    localStorage.setItem(key, JSON.stringify(durableIncidents))
  } catch {
    // The in-memory warning remains active if browser storage is unavailable.
  }
}

function getScopeIncidents(scope: string | null): Record<string, WriteFailureIncident> {
  const key = memoryKey(scope)
  const inMemory = scopedIncidentMemory.get(key)
  if (inMemory) return inMemory
  const restored = scope ? readStoredIncidents(scope) : {}
  scopedIncidentMemory.set(key, restored)
  return restored
}

function setScopeIncidents(scope: string | null, incidents: Record<string, WriteFailureIncident>): void {
  scopedIncidentMemory.set(memoryKey(scope), incidents)
  if (scope) writeStoredIncidents(scope, incidents)
  if (scope === activeScope) failureIncidents.value = incidents
}

function persistFailureIncidents(): void {
  setScopeIncidents(activeScope, failureIncidents.value)
}

export function restoreUnresolvedWriteHealth(): void {
  scopedIncidentMemory.delete(memoryKey(activeScope))
  failureIncidents.value = getScopeIncidents(activeScope)
  persistFailureIncidents()
}

export function setWriteHealthScope(scope: string | null): void {
  if (scope === activeScope) return
  activeScope = scope
  failureIncidents.value = getScopeIncidents(scope)
  lastToastAt = 0
}

/** Contexts that read data — never counted as writes. */
export function isWriteContext(context: string): boolean {
  if (context === 'queueFlushAuthGate') return false
  return !/^(fetch|load|get|list|check|count|search)/i.test(context)
}

const latestFailure = computed(() =>
  Object.entries(failureIncidents.value)
    .filter(([, incident]) => incident.count >= WRITE_FAILING_THRESHOLD)
    .sort(([, left], [, right]) => right.lastFailedAt - left.lastFailedAt)[0]
)

export const writesFailing = computed(() =>
  Object.values(failureIncidents.value).some(incident => incident.count >= WRITE_FAILING_THRESHOLD)
)
export const writeFailureContext = computed(() => latestFailure.value?.[1].context ?? '')
export const writeFailureMessage = computed(() => latestFailure.value?.[1].message ?? '')
export const writesFailingSince = computed(() => {
  if (!writesFailing.value) return 0
  const incidents = Object.values(failureIncidents.value)
    .filter(incident => incident.count >= WRITE_FAILING_THRESHOLD)
  return incidents.length > 0 ? Math.min(...incidents.map(incident => incident.firstFailedAt)) : 0
})
/**
 * Override the toast sink (tests). Production lazily uses useToast on first
 * failure so importing this module never touches the DOM.
 */
export function setWriteHealthNotifier(fn: Notifier | null): void {
  notifier = fn
}

async function notify(message: string, type: 'error' | 'success', options?: { duration?: number }): Promise<void> {
  if (notifier) {
    notifier(message, type, options)
    return
  }
  try {
    const { useToast } = await import('@/composables/useToast')
    useToast().showToast(message, type, options)
  } catch {
    // Toast infrastructure unavailable (headless) — the indicator still shows it.
  }
}

export function reportWriteFailure(
  context: string,
  message: string,
  now: number = Date.now(),
  identity: string = context,
  scope: string | null | undefined = undefined
): void {
  if (!isWriteContext(context)) return

  const effectiveScope = scope === undefined ? activeScope : scope
  const incidents = getScopeIncidents(effectiveScope)
  const previous = incidents[identity]
  const updated = {
    ...incidents,
    [identity]: {
      context,
      count: (previous?.count ?? 0) + 1,
      message,
      firstFailedAt: previous?.firstFailedAt ?? now,
      lastFailedAt: now,
    },
  }
  setScopeIncidents(effectiveScope, updated)
  if (effectiveScope !== activeScope) {
    return
  }

  if (writesFailing.value && now - lastToastAt >= WRITE_TOAST_COOLDOWN_MS) {
    lastToastAt = now
    void notify("Changes aren't saving — will keep retrying. Recent edits may be lost if you close the app.", 'error', { duration: 10000 })
  }
}

export function reportWriteSuccess(
  context: string,
  now: number = Date.now(),
  identity?: string,
  scope: string | null | undefined = undefined
): void {
  if (!isWriteContext(context)) return
  // Legacy context-only callers cannot prove which record recovered.
  if (!identity) return

  const effectiveScope = scope === undefined ? activeScope : scope
  const incidents = getScopeIncidents(effectiveScope)
  if (!(identity in incidents)) return
  const wasFailing = effectiveScope === activeScope && writesFailing.value
  const { [identity]: _resolved, ...unresolved } = incidents
  setScopeIncidents(effectiveScope, unresolved)
  if (effectiveScope !== activeScope) {
    return
  }
  if (wasFailing && !writesFailing.value) {
    lastToastAt = 0
    void notify('Saving works again — double-check your recent changes.', 'success', { duration: 6000 })
  }
  void now
}

/** Test-only: reset module state between specs. */
export function __resetWriteHealthForTests(): void {
  failureIncidents.value = {}
  scopedIncidentMemory.clear()
  lastToastAt = 0
  notifier = null
  activeScope = null
  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index)
      if (key?.startsWith(`${WRITE_HEALTH_STORAGE_KEY}:`)) localStorage.removeItem(key)
    }
  } catch {
    // Test environment has no browser storage.
  }
}
