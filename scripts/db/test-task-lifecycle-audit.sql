-- BUG-1941: Verify immutable task lifecycle audit and tombstone symmetry.
-- Runs in one transaction and always rolls back, so no test task, audit row,
-- or tombstone persists.
--
-- Usage: docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 < scripts/db/test-task-lifecycle-audit.sql

BEGIN;

CREATE TEMP TABLE lifecycle_smoke_ids ON COMMIT DROP AS
SELECT gen_random_uuid() AS tid,id AS uid
FROM auth.users
WHERE email NOT LIKE '%@test.flowstate'
ORDER BY created_at
LIMIT 1;

INSERT INTO public.tasks (id,user_id,title,status,is_deleted)
SELECT tid,uid,'BUG-1941 lifecycle audit test','planned',false
FROM lifecycle_smoke_ids;

UPDATE public.tasks SET status='done'
WHERE id=(SELECT tid FROM lifecycle_smoke_ids);
UPDATE public.tasks SET is_deleted=true,deleted_at=now()
WHERE id=(SELECT tid FROM lifecycle_smoke_ids);
UPDATE public.tasks SET is_deleted=false,deleted_at=NULL
WHERE id=(SELECT tid FROM lifecycle_smoke_ids);
DELETE FROM public.tasks WHERE id=(SELECT tid FROM lifecycle_smoke_ids);

DO $$
DECLARE
  events text[];
  tombstone_count int;
  live_count int;
  test_tid uuid;
BEGIN
  SELECT tid INTO test_tid FROM lifecycle_smoke_ids;
  IF test_tid IS NULL THEN
    RAISE EXCEPTION 'FAIL: no non-test auth user available for lifecycle smoke';
  END IF;

  SELECT array_agg(event_type ORDER BY event_at,id) INTO events
  FROM public.task_audit_log
  WHERE task_id=test_tid::text;

  IF events IS DISTINCT FROM ARRAY['CREATED','STATUS_CHANGED','SOFT_DELETED','RESTORED','HARD_DELETED']::text[] THEN
    RAISE EXCEPTION 'FAIL: lifecycle audit sequence was %',events;
  END IF;

  SELECT count(*) INTO tombstone_count FROM public.tombstones
  WHERE entity_type='task' AND entity_id=test_tid::text;
  IF tombstone_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: hard delete must leave one tombstone, found %',tombstone_count;
  END IF;

  SELECT count(*) INTO live_count FROM public.tasks
  WHERE id=test_tid;
  IF live_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: hard-deleted test row still exists';
  END IF;

  RAISE NOTICE 'PASS: lifecycle audit sequence, hard delete, and tombstone agree';
END $$;

ROLLBACK;
