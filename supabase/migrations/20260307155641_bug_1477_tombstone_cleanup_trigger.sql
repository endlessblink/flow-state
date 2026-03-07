-- BUG-1477: Safety net — when a tombstone is created for a task, hard-delete
-- the task row in the same transaction. Prevents zombie tasks that have a
-- tombstone but is_deleted=false (the exact bug that caused tasks to keep
-- reappearing after deletion).
--
-- This trigger fires AFTER INSERT on tombstones so the tombstone is committed
-- first, then the task row is removed. If the DELETE fails (e.g. row already
-- gone), it's a no-op — no error raised.

CREATE OR REPLACE FUNCTION on_tombstone_cleanup_task()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.entity_type = 'task' THEN
        DELETE FROM tasks WHERE id = NEW.entity_id::uuid;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to make migration idempotent
DROP TRIGGER IF EXISTS trg_tombstone_cleanup_task ON tombstones;

CREATE TRIGGER trg_tombstone_cleanup_task
    AFTER INSERT ON tombstones
    FOR EACH ROW
    EXECUTE FUNCTION on_tombstone_cleanup_task();

-- Also clean up any existing zombie tasks: rows that have a tombstone but
-- were never properly deleted. One-time retroactive fix.
DELETE FROM tasks t
USING tombstones ts
WHERE ts.entity_type = 'task'
  AND ts.entity_id::uuid = t.id;
