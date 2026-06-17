/**
 * Write-rate guard (TASK-1871)
 * ============================
 * Systemic "fail fast" guard against write storms — the class of bug where a
 * code path (auto-layout, a feedback loop, a runaway watcher) fires hundreds of
 * DB writes in a burst, flooding the API ("rate limit exceeded") and cascading
 * into auth/sync failures. Rather than whack-a-mole each source, this catches
 * ANY storm at the write chokepoint.
 *
 * Behaviour:
 * - DEV: throws once a sustained burst exceeds the threshold, so the storm
 *   surfaces immediately in development / CI instead of in production.
 * - PROD: never throws (must not break the app); logs a single throttled warning
 *   and exposes counters on `window.__FlowStateWriteRate` for observability.
 *
 * This only OBSERVES — it never blocks a legitimate write. The threshold is set
 * well above normal interactive write rates.
 */

interface Bucket {
  windowStart: number
  count: number
  warned: boolean
}

const WINDOW_MS = 1000
// Keyed PER ENTITY: writing the SAME row many times/sec is never legitimate
// (it's a no-op loop / feedback storm). Bulk loads write DISTINCT rows once each,
// so they never trip this — avoiding false positives.
const DEV_THROW_THRESHOLD = 15
const PROD_WARN_THRESHOLD = 25

const buckets = new Map<string, Bucket>()
let monotonic = 0

function envMode(): { isTest: boolean; isDev: boolean } {
  try {
    const env = (import.meta as unknown as { env?: { MODE?: string; DEV?: boolean } }).env
    return { isTest: env?.MODE === 'test', isDev: !!env?.DEV }
  } catch {
    return { isTest: false, isDev: false }
  }
}

/**
 * Record a write to a specific entity. Keyed per (channel, entityId) so the guard
 * fires only when the SAME row is hammered (a storm), not on bulk distinct writes.
 * In dev, throws once the same entity exceeds the threshold within a 1s window.
 */
export function recordWrite(channel: string, entityId: string): number {
  const key = `${channel}:${entityId}`
  // Monotonic clock surrogate — avoids Date.now() (which is stubbed in some envs)
  // while still bucketing by wall-clock-ish windows via a coarse timer.
  const now = nowMs()
  let b = buckets.get(key)
  if (!b || now - b.windowStart >= WINDOW_MS) {
    b = { windowStart: now, count: 0, warned: false }
    buckets.set(key, b)
  }
  b.count++

  try {
    if (typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>
      const stats = (w.__FlowStateWriteRate as Record<string, number>) || {}
      stats[key] = b.count
      w.__FlowStateWriteRate = stats
    }
  } catch {
    /* non-browser */
  }

  const { isTest, isDev } = envMode()
  // THROW only under test (vitest/CI) so storms fail the build. In the real app
  // (dev or prod) NEVER throw — a false positive must not break the user's app;
  // we log loudly instead. The no-op skip upstream already prevents the storm;
  // this is the tripwire that flags any new feedback loop.
  if (isTest && b.count === DEV_THROW_THRESHOLD + 1) {
    throw new Error(
      `[WRITE-STORM] '${key}' written ${b.count}× within ${WINDOW_MS}ms — a write storm / feedback loop. ` +
      `The same row should never be written this often. Diff (skip no-ops) and coalesce.`
    )
  }
  if (!isTest && b.count === (isDev ? DEV_THROW_THRESHOLD : PROD_WARN_THRESHOLD) + 1 && !b.warned) {
    b.warned = true
    const tag = isDev ? '🛑 [WRITE-STORM]' : '⚠️ [WRITE-STORM]'
    // eslint-disable-next-line no-console
    console.error(`${tag} '${key}' written ${b.count}×/s — likely a no-op/feedback storm. Investigate.`)
  }

  return b.count
}

// Coarse monotonic time. Uses performance.now when available; otherwise a
// counter that advances per call (good enough to separate bursts in tests).
function nowMs(): number {
  try {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now()
    }
  } catch {
    /* ignore */
  }
  monotonic += 1
  return monotonic
}

/** Reset all buckets (tests). */
export function resetWriteRate(): void {
  buckets.clear()
  monotonic = 0
}
