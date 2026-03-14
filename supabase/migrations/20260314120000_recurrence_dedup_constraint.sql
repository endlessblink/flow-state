-- SOP-065: Server-side dedup for recurring task clones.
-- Prevents two devices from creating the same recurrence occurrence simultaneously.
-- The constraint ensures only one clone per (recurrence_parent_id, recurrence_count) exists.
-- ON CONFLICT at the application level (createTask uses upsert) will silently skip duplicates.

-- Only add the constraint if there are no existing duplicates that would block it.
-- First, clean up any existing duplicates (keep the oldest by created_at).
DO $$
DECLARE
    _dupes RECORD;
BEGIN
    FOR _dupes IN
        SELECT recurrence_parent_id, recurrence_count, 
               array_agg(id ORDER BY created_at ASC) as ids
        FROM tasks
        WHERE recurrence_parent_id IS NOT NULL 
          AND recurrence_count IS NOT NULL
          AND is_deleted = false
        GROUP BY recurrence_parent_id, recurrence_count
        HAVING count(*) > 1
    LOOP
        -- Soft-delete all but the first (oldest)
        UPDATE tasks 
        SET is_deleted = true, deleted_at = now(), updated_at = now()
        WHERE id = ANY(_dupes.ids[2:]);
    END LOOP;
END $$;

-- Create a partial unique index (only on non-deleted tasks with a recurrence parent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_recurrence_occurrence 
    ON tasks (recurrence_parent_id, recurrence_count) 
    WHERE recurrence_parent_id IS NOT NULL 
      AND recurrence_count IS NOT NULL 
      AND is_deleted = false;
