-- BUG-1891: Unify deletion truth on tombstones — kill task resurrection once and for all.
--
-- Problem: a SOFT delete (the normal "delete a task" path) only sets is_deleted=true and
-- never writes a tombstone, while EVERY resurrection guard (sync CREATE guard, safe_create_task,
-- load-merge) keys off the tombstones table. So 100% of soft-deleted tasks are unprotected and
-- any stale CREATE / fail-open merge / cross-device race flips is_deleted back to false.
--
-- Fix: enforce the invariant server-side. A single BEFORE UPDATE trigger keeps the tombstone in
-- lockstep with is_deleted, so no client/queue/merge path can forget:
--   * is_deleted false -> true  : write a permanent tombstone (mirrors create_task_tombstone)
--   * is_deleted true  -> false : remove the tombstone (makes Trash-restore safe automatically)
--
-- Undo already removes the tombstone before re-creating (clearTombstoneForUndo), and recurrence
-- uses fresh UUIDs, so neither is affected. See plan: is-1-safe-fizzy-snowflake.md.

-- =============================================================================
-- Step 1: Symmetric soft-delete tombstone trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_soft_delete_tombstone()
RETURNS TRIGGER AS $$
BEGIN
    -- Only react when the deletion flag actually flips.
    -- NOTE: tombstones.entity_id is text while tasks.id is uuid on production (text on local) —
    -- cast NEW.id::text so this works on both schemas. (Prod-vs-local drift; see BUG-1891.)
    IF OLD.is_deleted IS DISTINCT FROM NEW.is_deleted THEN
        IF NEW.is_deleted = true THEN
            -- Soft delete -> permanent tombstone (expires_at = NULL for tasks, matching TASK-344).
            INSERT INTO public.tombstones (user_id, entity_type, entity_id, deleted_at, expires_at)
            VALUES (NEW.user_id, 'task', NEW.id::text, COALESCE(NEW.deleted_at, NOW()), NULL)
            ON CONFLICT (entity_type, entity_id, user_id)
            DO UPDATE SET deleted_at = COALESCE(EXCLUDED.deleted_at, NOW()), expires_at = NULL;
        ELSE
            -- Restore / undelete -> drop the tombstone so the live row is no longer blocked.
            DELETE FROM public.tombstones
            WHERE entity_type = 'task' AND entity_id = NEW.id::text AND user_id = NEW.user_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Idempotent re-create. Named so it does not depend on firing order relative to the other
-- BEFORE UPDATE triggers (trigger_increment_task_position_version, update_tasks_updated_at),
-- which only mutate NEW columns and never touch the tombstones table.
DROP TRIGGER IF EXISTS trg_task_soft_delete_tombstone ON public.tasks;
CREATE TRIGGER trg_task_soft_delete_tombstone
    BEFORE UPDATE OF is_deleted ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_soft_delete_tombstone();

-- =============================================================================
-- Step 2: Backfill tombstones for already soft-deleted tasks (currently unprotected)
-- =============================================================================

INSERT INTO public.tombstones (user_id, entity_type, entity_id, deleted_at, expires_at)
SELECT user_id, 'task', id::text, COALESCE(deleted_at, now()), NULL
FROM public.tasks
WHERE is_deleted = true
ON CONFLICT (entity_type, entity_id, user_id) DO NOTHING;

-- =============================================================================
-- Step 3: Report (do NOT auto-resolve) existing zombies — live rows that already
-- carry a tombstone. Deleting either side risks data loss, so surface for manual review.
-- =============================================================================

DO $$
DECLARE z int;
BEGIN
    SELECT count(*) INTO z
    FROM public.tasks t
    JOIN public.tombstones tb
      ON tb.entity_type = 'task' AND tb.entity_id = t.id::text AND tb.user_id = t.user_id
    WHERE t.is_deleted = false;
    IF z > 0 THEN
        RAISE WARNING 'BUG-1891: % live task(s) still carry a tombstone (zombie state) — review manually, not auto-resolved.', z;
    END IF;
END $$;

COMMENT ON FUNCTION public.sync_soft_delete_tombstone() IS
    'BUG-1891: Keeps tombstones in lockstep with tasks.is_deleted so soft-deleted tasks can never be resurrected by any sync/merge/queue path. Soft-delete writes a permanent tombstone; restore removes it.';
