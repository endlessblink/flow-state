'use strict'

/**
 * Resolve the local timer snapshot the sidecar serves at /api/timer/current
 * (the endpoint the KDE widget polls).
 *
 * TASK-1977 — zombie paused-timer fix. Extracted from server.cjs so the
 * age-out logic is unit-testable.
 *
 * The snapshot is written only by the Electron app (via IPC) and stamped with
 * `updatedAt`. When the app is alive it refreshes the snapshot at least every
 * ~10s (heartbeat), so a fresh snapshot means "the app is here". When the app
 * closes or crashes, the snapshot stops being refreshed and its age grows past
 * the grace window — at which point any session it holds is an orphan and must
 * be reported inactive so the widget clears it.
 *
 * The original logic aged out only INACTIVE snapshots and RUNNING sessions that
 * had drifted to zero. A PAUSED active session never drifts, so it was served
 * as active forever once orphaned — a phantom timer the widget could not clear.
 *
 * @param {object|null} snapshot  { active, updatedAt, session } or null
 * @param {{ nowMs:number, graceMs:number, nowIso:string }} clock
 * @returns {object|null} { active, session, source:'local-snapshot' } or null
 */
function resolveLocalTimerSnapshot(snapshot, clock) {
  const { nowMs, graceMs, nowIso } = clock
  if (!snapshot || typeof snapshot !== 'object') return null

  const updatedAt = Number(snapshot.updatedAt) || nowMs
  const ageMs = Math.max(0, nowMs - updatedAt)

  // No active session in the snapshot: serve "inactive" only while fresh; once
  // stale, the app is gone and there is nothing to report.
  if (!snapshot.active || !snapshot.session) {
    if (ageMs > graceMs) return null
    return { active: false, session: null, source: 'local-snapshot' }
  }

  const session = { ...snapshot.session }

  // Running timer: apply drift so the widget counts down even between pushes;
  // once it hits zero (and is stale) it is over.
  if (session.is_active && !session.is_paused) {
    const driftSeconds = Math.max(0, Math.floor(ageMs / 1000))
    session.remaining_time = Math.max(0, Number(session.remaining_time || 0) - driftSeconds)
    if (session.remaining_time <= 0) {
      if (ageMs > graceMs) return null
      return { active: false, session: null, source: 'local-snapshot' }
    }
  }

  // TASK-1977: a PAUSED active session does not drift, so it cannot self-expire.
  // If its snapshot is stale beyond the grace, the app has stopped refreshing it
  // (closed/crashed) and the session is a zombie the widget must be told to
  // clear. A live paused timer is re-pushed every ~10s (< grace) so it never
  // reaches this branch.
  if (session.is_active && session.is_paused && ageMs > graceMs) {
    return { active: false, session: null, source: 'local-snapshot' }
  }

  session.device_leader_last_seen = nowIso
  return { active: true, session, source: 'local-snapshot' }
}

module.exports = { resolveLocalTimerSnapshot }
