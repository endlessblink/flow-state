\set ON_ERROR_STOP on

BEGIN;

SELECT id AS actor_id
FROM auth.users
ORDER BY created_at
LIMIT 1
\gset

DELETE FROM public.tombstones
WHERE entity_type = 'task'
  AND entity_id IN (
    '97000000-0000-4000-8000-000000000001',
    '97000000-0000-4000-8000-000000000002',
    '97000000-0000-4000-8000-000000000003',
    '97000000-0000-4000-8000-000000000004'
  );

DELETE FROM public.flowstate_action_receipts
WHERE user_id = :'actor_id'
  AND operation = 'permanently_delete_tasks'
  AND request_id IN ('atomic-delete-success', 'atomic-delete-rollback');

INSERT INTO public.tasks (
  id, user_id, title, status, recurrence_rule, recurrence_parent_id
) VALUES
  (
    '97000000-0000-4000-8000-000000000001',
    :'actor_id',
    'Atomic delete selected',
    'planned',
    '{"pattern":"daily","interval":1,"endType":"never"}'::jsonb,
    NULL
  ),
  (
    '97000000-0000-4000-8000-000000000002',
    :'actor_id',
    'Atomic delete surviving chain member',
    'done',
    '{"pattern":"daily","interval":1,"endType":"never"}'::jsonb,
    '97000000-0000-4000-8000-000000000001'
  ),
  (
    '97000000-0000-4000-8000-000000000003',
    :'actor_id',
    'Atomic delete second selected',
    'planned',
    NULL,
    NULL
  ),
  (
    '97000000-0000-4000-8000-000000000004',
    :'actor_id',
    'Atomic delete rollback survivor',
    'planned',
    NULL,
    NULL
  );

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub', :'actor_id', true);

DO $$
DECLARE
  v_actor uuid := auth.uid();
  v_receipt jsonb;
  v_retry jsonb;
  v_count integer;
  v_rule jsonb;
BEGIN
  v_receipt := public.flowstate_permanently_delete_tasks(
    ARRAY[
      '97000000-0000-4000-8000-000000000001',
      '97000000-0000-4000-8000-000000000003'
    ]::text[],
    v_actor,
    'atomic-delete-success'
  );

  IF (v_receipt->>'deleted_count')::integer <> 2 THEN
    RAISE EXCEPTION 'FAIL: first receipt did not confirm both deletes: %', v_receipt;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.tasks
  WHERE id IN (
    '97000000-0000-4000-8000-000000000001',
    '97000000-0000-4000-8000-000000000003'
  );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: selected tasks still exist: %', v_count;
  END IF;

  SELECT recurrence_rule INTO v_rule
  FROM public.tasks
  WHERE id = '97000000-0000-4000-8000-000000000002';
  IF v_rule IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: surviving chain member retained recurrence rule';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.tombstones
  WHERE entity_type = 'task'
    AND entity_id IN (
      '97000000-0000-4000-8000-000000000001',
      '97000000-0000-4000-8000-000000000003'
    );
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: hard delete did not create two tombstones: %', v_count;
  END IF;

  v_retry := public.flowstate_permanently_delete_tasks(
    ARRAY[
      '97000000-0000-4000-8000-000000000001',
      '97000000-0000-4000-8000-000000000003'
    ]::text[],
    v_actor,
    'atomic-delete-success'
  );
  IF v_retry IS DISTINCT FROM v_receipt THEN
    RAISE EXCEPTION 'FAIL: identical retry did not return the durable receipt';
  END IF;

  BEGIN
    PERFORM public.flowstate_permanently_delete_tasks(
      ARRAY[
        '97000000-0000-4000-8000-000000000004',
        '97000000-0000-4000-8000-999999999999'
      ]::text[],
      v_actor,
      'atomic-delete-rollback'
    );
    RAISE EXCEPTION 'FAIL: incomplete selection unexpectedly succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;

  SELECT count(*) INTO v_count
  FROM public.tasks
  WHERE id = '97000000-0000-4000-8000-000000000004';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: scope mismatch partially deleted the visible task';
  END IF;

  RAISE NOTICE 'PASS: batch permanent delete is atomic, recurrence-safe, tombstoned, and retry-idempotent';
END;
$$;

RESET ROLE;
ROLLBACK;
