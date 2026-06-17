/**
 * Legacy group-id migration helpers (TASK-1871)
 * =============================================
 * Older canvas groups (day-columns like "Monday"/"Tomorrow") were created with
 * legacy non-UUID ids. `toSupabaseGroup` refuses to persist those, so they were
 * silently NEVER saved to Supabase — every device kept its own local-only copy
 * and they drifted apart with no way to reconcile. (Confirmed in production:
 * console showed "⏭️ [LEGACY-GROUP] Skipping save for group 'Monday'...".)
 *
 * The fix migrates each legacy group to a real UUID. To converge across devices
 * instead of creating duplicates, the new id is DERIVED DETERMINISTICALLY from
 * the group's power-keyword (e.g. "monday", "tomorrow") + the user id — so every
 * device's "Monday" maps to the exact same UUID and Supabase upsert folds them
 * into one row.
 */
import { v5 as uuidv5 } from 'uuid'
import { detectPowerKeyword } from '@/composables/usePowerKeywords'

// Fixed namespace for FlowState legacy group-id derivation. NEVER change this —
// changing it would remap every already-migrated group to a new id.
const FLOWSTATE_GROUP_NAMESPACE = '1b671a64-40d5-491e-99b0-da01ff1f3341'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** True when an id is a real UUID (the format toSupabaseGroup will actually sync). */
export const isUuidGroupId = (id?: string | null): boolean => !!id && UUID_RE.test(id)

// Only day-column groups are auto-migrated. Restricting to date/day-of-week
// keywords prevents the migration from minting UUID copies of unrelated legacy
// groups ("Done", "1", etc.) — which would resurrect junk after a dedup cleanup.
const DAY_COLUMN_CATEGORIES = new Set(['date', 'day_of_week'])

/** True when a group name is a day-column (Today/Tomorrow/Monday–Sunday). */
export const isMigratableDayGroup = (name?: string | null): boolean => {
  if (!name) return false
  const kw = detectPowerKeyword(name)
  return !!kw && DAY_COLUMN_CATEGORIES.has(kw.category)
}

/**
 * Deterministic UUID for a legacy-id group.
 * - Power-keyword/day groups key by the detected keyword (stable across devices
 *   even after the daily rotation rewrites the visible name with a date suffix),
 *   so two devices' "Monday" converge to one id.
 * - Any other legacy group falls back to its own legacy id: it will start syncing,
 *   but (being device-specific) won't cross-device merge — acceptable and rare.
 */
export const deterministicGroupId = (
  userId: string,
  group: { id: string; name: string }
): string => {
  const kw = detectPowerKeyword(group.name)
  const key = kw ? `pk:${kw.category}:${kw.value}` : `id:${group.id}`
  return uuidv5(`flowstate-group:${userId}:${key}`, FLOWSTATE_GROUP_NAMESPACE)
}
