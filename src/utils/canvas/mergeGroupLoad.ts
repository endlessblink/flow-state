import type { CanvasGroup } from '@/types/canvas'

/**
 * BUG-1899: keep freshly-created local groups alive through a canvas load.
 *
 * loadFromDatabase replaces the store wholesale with the server result. A
 * group created moments earlier — whose create op is still in the sync queue —
 * is absent from that result and was silently wiped, reappearing seconds later
 * at its seed position when the create echo landed (recorder-proven cause of
 * Tidy/drag no-ops on fresh groups and the "briefly removed freshly-pushed
 * groups" behavior).
 *
 * We preserve in-memory groups that are missing from the server result while
 * they are RECENT (pending-create grace). Remote deletions are not affected:
 * they arrive as is_deleted rows / realtime DELETE events, not as absence,
 * and stale local-only zombies fall outside the grace window.
 */
export const PENDING_CREATE_GRACE_MS = 10 * 60 * 1000

export function preserveRecentLocalGroups(
  merged: CanvasGroup[],
  inMemory: CanvasGroup[],
  nowMs: number,
  graceMs: number = PENDING_CREATE_GRACE_MS,
  recoveryCandidates: CanvasGroup[] = []
): CanvasGroup[] {
  const serverIds = new Set(merged.map(g => g.id))
  const preserved = inMemory.filter(g => {
    if (serverIds.has(g.id)) return false
    // No updatedAt = never-synced local entity (fresh create / local seed) —
    // absence of a stamp is not staleness; wiping it destroys user data.
    // Stale zombies always carry updatedAt from the store op that cached them.
    if (!g.updatedAt) return true
    const t = new Date(g.updatedAt).getTime()
    return Number.isFinite(t) && nowMs - t < graceMs
  })
  const preservedIds = new Set([...serverIds, ...preserved.map(g => g.id)])
  const recoveryPreserved = recoveryCandidates.filter(g => {
    if (preservedIds.has(g.id)) return false
    return true
  })
  if ((preserved.length > 0 || recoveryPreserved.length > 0) && import.meta.env.DEV) {
    console.log(`[CANVAS:LOAD] Preserving ${preserved.length + recoveryPreserved.length} local group(s) missing from server:`, [...preserved, ...recoveryPreserved].map(g => g.id.slice(0, 8)))
  }
  return preserved.length > 0 || recoveryPreserved.length > 0
    ? [...merged, ...preserved, ...recoveryPreserved]
    : merged
}
