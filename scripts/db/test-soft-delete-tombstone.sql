-- BUG-1891: Verify the symmetric soft-delete tombstone trigger.
-- Asserts that flipping is_deleted true writes a permanent tombstone, and
-- flipping it back to false removes it. Runs inside a transaction and ROLLBACKs,
-- so it is non-destructive (no test rows or tombstones persist).
--
-- Usage: docker exec -i supabase_db_flow-state psql -U postgres -v ON_ERROR_STOP=1 < scripts/db/test-soft-delete-tombstone.sql
-- Exit code 0 = pass, non-zero = fail (a failed assertion RAISEs).

\set tid '00000000-dead-beef-0000-000000001891'
\set uid 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'

BEGIN;

-- Clean slate inside the txn
DELETE FROM public.tombstones WHERE entity_type = 'task' AND entity_id = :'tid';
DELETE FROM public.tasks WHERE id = :'tid';

-- Seed a live task
INSERT INTO public.tasks (id, user_id, title, is_deleted)
VALUES (:'tid', :'uid', 'BUG-1891 trigger test', false);

-- (1) Soft delete -> tombstone MUST exist
UPDATE public.tasks SET is_deleted = true, deleted_at = now() WHERE id = :'tid';
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM public.tombstones
    WHERE entity_type = 'task' AND entity_id = '00000000-dead-beef-0000-000000001891';
    IF n <> 1 THEN
        RAISE EXCEPTION 'FAIL(1): soft-delete did not write exactly one tombstone (found %)', n;
    END IF;
    RAISE NOTICE 'PASS(1): soft-delete wrote a tombstone';
END $$;

-- (1b) Tombstone MUST be permanent (expires_at NULL) for tasks
DO $$
DECLARE e timestamptz;
BEGIN
    SELECT expires_at INTO e FROM public.tombstones
    WHERE entity_type = 'task' AND entity_id = '00000000-dead-beef-0000-000000001891';
    IF e IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL(1b): task tombstone is not permanent (expires_at=%)', e;
    END IF;
    RAISE NOTICE 'PASS(1b): tombstone is permanent';
END $$;

-- (2) Restore (is_deleted -> false) MUST remove the tombstone
UPDATE public.tasks SET is_deleted = false, deleted_at = null WHERE id = :'tid';
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM public.tombstones
    WHERE entity_type = 'task' AND entity_id = '00000000-dead-beef-0000-000000001891';
    IF n <> 0 THEN
        RAISE EXCEPTION 'FAIL(2): restore did not remove tombstone (found %)', n;
    END IF;
    RAISE NOTICE 'PASS(2): restore removed the tombstone';
END $$;

-- (3) No-op update (is_deleted unchanged) MUST NOT touch tombstones
UPDATE public.tasks SET is_deleted = true, deleted_at = now() WHERE id = :'tid';   -- create one
UPDATE public.tasks SET title = 'BUG-1891 noop' WHERE id = :'tid';                 -- unrelated change
DO $$
DECLARE n int;
BEGIN
    SELECT count(*) INTO n FROM public.tombstones
    WHERE entity_type = 'task' AND entity_id = '00000000-dead-beef-0000-000000001891';
    IF n <> 1 THEN
        RAISE EXCEPTION 'FAIL(3): non-is_deleted update changed tombstone count (found %)', n;
    END IF;
    RAISE NOTICE 'PASS(3): unrelated update left tombstone intact';
END $$;

\echo 'ALL ASSERTIONS PASSED'

ROLLBACK;
