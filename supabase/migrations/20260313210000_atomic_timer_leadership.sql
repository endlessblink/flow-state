-- BUG-1511: Atomic timer leadership claim via conditional UPDATE
-- Prevents two devices from both becoming leader (dual leadership → 2x countdown speed, double XP)
--
-- The function updates device_leader_id only when:
--   1. No leader is currently set, OR
--   2. The requesting device is already the leader (heartbeat renewal), OR
--   3. The current leader's last_seen is older than p_stale_threshold_seconds
--
-- Returns TRUE if leadership was granted, FALSE if another device holds a fresh lease.

CREATE OR REPLACE FUNCTION claim_timer_leadership(
  p_session_id UUID,
  p_new_leader TEXT,
  p_stale_threshold_seconds INTEGER DEFAULT 30
) RETURNS BOOLEAN AS $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE timer_sessions
  SET device_leader_id = p_new_leader,
      device_leader_last_seen = NOW()
  WHERE id = p_session_id
    AND (
      device_leader_id IS NULL
      OR device_leader_id = p_new_leader
      OR device_leader_last_seen < NOW() - (p_stale_threshold_seconds || ' seconds')::INTERVAL
    );
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  RETURN rows_affected > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
