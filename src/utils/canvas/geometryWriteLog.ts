/**
 * Geometry-write instrumentation (TASK-1871 Phase 0)
 * ==================================================
 * A single observable chokepoint for every canvas geometry mutation
 * (parentId / canvasPosition / group position). Used to catch the recurring
 * "all nodes shift" / "tasks repositioned themselves" regressions red-handed:
 * tests assert WHICH source moved WHICH entity, and devs get a console trail.
 *
 * Design constraints:
 * - Zero behavioural effect — this only records, never mutates.
 * - Cheap in production: events are kept in a small ring buffer; verbose
 *   console output only when `__FlowStateDebugGeometry` is enabled.
 * - Test-observable: the ring buffer is mirrored to
 *   `window.__FlowStateGeometryWrites` so Playwright/Vitest can read it.
 */

export interface GeometryWriteEvent {
  source: string
  entityType: 'task' | 'group'
  entityId: string
  before?: { parentId?: string | null; x?: number; y?: number }
  after?: { parentId?: string | null; x?: number; y?: number }
  /** Set when the change was blocked/stripped by the geometry guard. */
  blocked?: boolean
  ts: number
  stack?: string
}

const RING_SIZE = 200
const ring: GeometryWriteEvent[] = []

// Use a monotonic counter instead of Date.now() so this stays deterministic
// and never trips environments where Date.now is stubbed.
let seq = 0

function debugEnabled(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      (window as unknown as Record<string, unknown>).__FlowStateDebugGeometry === true
    )
  } catch {
    return false
  }
}

/**
 * Record a geometry write. Call this from every geometry chokepoint
 * (task geometry sanitizer, group geometry sanitizer, layout move applier).
 */
export function logGeometryWrite(
  event: Omit<GeometryWriteEvent, 'ts' | 'stack'> & { stack?: string }
): void {
  const full: GeometryWriteEvent = {
    ...event,
    ts: seq++,
    stack: event.stack ?? (debugEnabled() ? new Error().stack : undefined),
  }

  ring.push(full)
  if (ring.length > RING_SIZE) ring.shift()

  try {
    if (typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>
      w.__FlowStateGeometryWrites = ring
    }
  } catch {
    /* non-browser env */
  }

  if (debugEnabled()) {
    const tag = full.blocked ? '🚫 [GEO-BLOCKED]' : '✏️ [GEO-WRITE]'
    // eslint-disable-next-line no-console
    console.log(
      `${tag} ${full.source} ${full.entityType}:${full.entityId.slice(0, 8)}`,
      { before: full.before, after: full.after }
    )
  }
}

/** Drain the in-memory geometry-write ring buffer (mainly for unit tests). */
export function getGeometryWrites(): GeometryWriteEvent[] {
  return [...ring]
}

/** Clear the ring buffer (call between test cases). */
export function clearGeometryWrites(): void {
  ring.length = 0
  seq = 0
}
