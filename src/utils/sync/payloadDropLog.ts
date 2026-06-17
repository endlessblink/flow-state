/**
 * Sync payload-drop instrumentation (TASK-1871 Phase 0)
 * =====================================================
 * Records which changed fields were NOT included in the DB sync payload — the
 * "field-completeness trap" that has repeatedly caused "sync stops propagating"
 * regressions (BUG-1799 added 7 missing fields; lane sync was a fresh instance).
 *
 * This is observation-only. Phase 2 replaces the allowlist payload builder with
 * a denylist + a deterministic schema-vs-payload completeness test; until then
 * this surfaces silent drops so they can be caught instead of shipping.
 */

export interface PayloadDropEvent {
  entityType: 'task' | 'group'
  entityId: string
  /** Keys that changed in the store. */
  changedKeys: string[]
  /** Keys actually present in the enqueued DB payload. */
  sentKeys: string[]
  /** changedKeys that never made it into the payload (the silent drops). */
  droppedKeys: string[]
  ts: number
}

const RING_SIZE = 200
const ring: PayloadDropEvent[] = []
let seq = 0

/** Local-only / derived keys that intentionally never sync (not real drops). */
const KNOWN_LOCAL_ONLY = new Set<string>([
  'id',
  'positionVersion',
  'isSelected',
  'isEditing',
  '_localOnly',
])

function debugEnabled(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      (window as unknown as Record<string, unknown>).__FlowStateDebugSync === true
    )
  } catch {
    return false
  }
}

/**
 * Record a sync payload and compute which changed keys were dropped.
 * Returns the dropped keys so callers can assert on them in tests.
 */
export function recordSyncPayload(
  entityType: 'task' | 'group',
  entityId: string,
  changedKeys: string[],
  sentKeys: string[]
): string[] {
  const sent = new Set(sentKeys)
  const droppedKeys = changedKeys.filter(
    (k) => !sent.has(k) && !KNOWN_LOCAL_ONLY.has(k)
  )

  const event: PayloadDropEvent = {
    entityType,
    entityId,
    changedKeys,
    sentKeys,
    droppedKeys,
    ts: seq++,
  }
  ring.push(event)
  if (ring.length > RING_SIZE) ring.shift()

  try {
    if (typeof window !== 'undefined') {
      const w = window as unknown as Record<string, unknown>
      w.__FlowStateSyncDrops = ring
    }
  } catch {
    /* non-browser env */
  }

  if (droppedKeys.length && debugEnabled()) {
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️ [SYNC-DROP] ${entityType}:${entityId.slice(0, 8)} dropped fields:`,
      droppedKeys
    )
  }

  return droppedKeys
}

export function getSyncDrops(): PayloadDropEvent[] {
  return [...ring]
}

export function clearSyncDrops(): void {
  ring.length = 0
  seq = 0
}
