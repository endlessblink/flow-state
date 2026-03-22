-- BUG-1477: Zombie task cleanup
--
-- The tasks table already has `trg_task_tombstone` (BEFORE DELETE) that
-- auto-creates tombstones. An additional AFTER INSERT trigger on tombstones
-- caused PostgreSQL error 27000 (same-command tuple modification conflict).
--
-- This migration:
-- 1. Drops the conflicting trigger+function if they exist
-- 2. Cleans up zombie tasks (rows with tombstones that were never deleted)

-- Drop the conflicting trigger and function (created earlier in this session)
DROP TRIGGER IF EXISTS trg_tombstone_cleanup_task ON tombstones;
DROP FUNCTION IF EXISTS on_tombstone_cleanup_task();

-- Retroactive cleanup: remove any task rows that have tombstones
-- (these are zombies from the old bug where delete failed but tombstone succeeded)
DELETE FROM tasks t
USING tombstones ts
WHERE ts.entity_type = 'task'
  AND ts.entity_id = t.id;
