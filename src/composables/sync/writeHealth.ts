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
 * single funnel every direct DB operation passes through. Two consecutive
 * write failures flip `writesFailing`; the syncStatus store overlays that on
 * the header indicator, and a rate-limited toast tells the user their changes
 * aren't saving. Any successful write clears the state.
 */
import { ref, computed } from 'vue'

/** Consecutive failed writes before we declare writes unhealthy. */
export const WRITE_FAILING_THRESHOLD = 2
/** Minimum gap between "changes aren't saving" toasts. */
export const WRITE_TOAST_COOLDOWN_MS = 5 * 60 * 1000

const consecutiveWriteFailures = ref(0)
const lastWriteFailureContext = ref('')
const lastWriteFailureMessage = ref('')
const failingSince = ref(0)
let lastToastAt = 0

type Notifier = (message: string, type: 'error' | 'success', options?: { duration?: number }) => void
let notifier: Notifier | null = null

/** Contexts that read data — never counted as writes. */
export function isWriteContext(context: string): boolean {
  if (context === 'queueFlushAuthGate') return false
  return !/^(fetch|load|get|list|check|count|search)/i.test(context)
}

export const writesFailing = computed(() => consecutiveWriteFailures.value >= WRITE_FAILING_THRESHOLD)
export const writeFailureContext = computed(() => lastWriteFailureContext.value)
export const writeFailureMessage = computed(() => lastWriteFailureMessage.value)
export const writesFailingSince = computed(() => failingSince.value)

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

export function reportWriteFailure(context: string, message: string, now: number = Date.now()): void {
  if (!isWriteContext(context)) return

  consecutiveWriteFailures.value++
  lastWriteFailureContext.value = context
  lastWriteFailureMessage.value = message
  if (consecutiveWriteFailures.value === WRITE_FAILING_THRESHOLD) {
    failingSince.value = now
  }

  if (writesFailing.value && now - lastToastAt >= WRITE_TOAST_COOLDOWN_MS) {
    lastToastAt = now
    void notify("Changes aren't saving — will keep retrying. Recent edits may be lost if you close the app.", 'error', { duration: 10000 })
  }
}

export function reportWriteSuccess(context: string, now: number = Date.now()): void {
  if (!isWriteContext(context)) return

  const wasFailing = writesFailing.value
  consecutiveWriteFailures.value = 0
  failingSince.value = 0
  lastWriteFailureContext.value = ''
  lastWriteFailureMessage.value = ''

  if (wasFailing) {
    lastToastAt = 0
    void notify('Saving works again — double-check your recent changes.', 'success', { duration: 6000 })
  }
  void now
}

/** Test-only: reset module state between specs. */
export function __resetWriteHealthForTests(): void {
  consecutiveWriteFailures.value = 0
  lastWriteFailureContext.value = ''
  lastWriteFailureMessage.value = ''
  failingSince.value = 0
  lastToastAt = 0
  notifier = null
}
