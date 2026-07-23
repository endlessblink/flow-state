\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.flowstate_fail_atomic_restore_group()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name = 'atomic-failure-probe' THEN
    RAISE EXCEPTION 'injected_atomic_restore_failure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER flowstate_fail_atomic_restore_group
BEFORE INSERT ON public.groups
FOR EACH ROW
EXECUTE FUNCTION pg_temp.flowstate_fail_atomic_restore_group();

SELECT id::text AS flowstate_test_user_id
FROM auth.users
ORDER BY created_at
LIMIT 1
\gset

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub',
  :'flowstate_test_user_id',
  true
);

DO $$
DECLARE
  v_failed boolean := false;
  v_actor uuid := (SELECT auth.uid());
BEGIN
  BEGIN
    PERFORM public.flowstate_restore_backup_v1(
      v_actor,
      'atomic-rollback-probe',
      'atomic-rollback-hash',
      '4.0.0',
      '[{
        "id":"00000000-0000-4000-8000-000000000102",
        "user_id":"00000000-0000-4000-8000-000000000999",
        "project_id":"00000000-0000-4000-8000-000000000101",
        "title":"atomic rollback task",
        "status":"planned"
      }]'::jsonb,
      '[{
        "id":"00000000-0000-4000-8000-000000000101",
        "user_id":"00000000-0000-4000-8000-000000000999",
        "name":"atomic rollback project",
        "color_type":"hex",
        "view_type":"status"
      }]'::jsonb,
      '[{
        "id":"00000000-0000-4000-8000-000000000103",
        "user_id":"00000000-0000-4000-8000-000000000999",
        "name":"atomic-failure-probe",
        "type":"custom"
      }]'::jsonb,
      '[]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%injected_atomic_restore_failure%' THEN
      RAISE;
    END IF;
    v_failed := true;
  END;
  IF NOT v_failed THEN
    RAISE EXCEPTION 'atomic restore failure injection did not fail';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.projects
    WHERE id::text = '00000000-0000-4000-8000-000000000101'
  ) OR EXISTS (
    SELECT 1 FROM public.tasks
    WHERE id::text = '00000000-0000-4000-8000-000000000102'
  ) OR EXISTS (
    SELECT 1 FROM public.groups
    WHERE id::text = '00000000-0000-4000-8000-000000000103'
  ) OR EXISTS (
    SELECT 1 FROM public.flowstate_action_receipts
    WHERE user_id = v_actor
      AND operation = 'restore_backup'
      AND request_id = 'atomic-rollback-probe'
  ) THEN
    RAISE EXCEPTION 'atomic restore left partial durable state';
  END IF;
END;
$$;

DROP TRIGGER flowstate_fail_atomic_restore_group ON public.groups;

DO $$
DECLARE
  v_first jsonb;
  v_replay jsonb;
  v_conflicted boolean := false;
  v_actor uuid := (SELECT auth.uid());
  v_tasks jsonb := '[{
    "id":"00000000-0000-4000-8000-000000000112",
    "user_id":"00000000-0000-4000-8000-000000000999",
    "project_id":"00000000-0000-4000-8000-000000000111",
    "title":"atomic replay task",
    "status":"planned"
  }]'::jsonb;
  v_projects jsonb := '[{
    "id":"00000000-0000-4000-8000-000000000111",
    "user_id":"00000000-0000-4000-8000-000000000999",
    "name":"atomic replay project",
    "color_type":"hex",
    "view_type":"status"
  }]'::jsonb;
BEGIN
  v_first := public.flowstate_restore_backup_v1(
    v_actor,
    'atomic-replay-probe',
    'atomic-replay-hash',
    '4.0.0',
    v_tasks,
    v_projects,
    '[]'::jsonb,
    '[]'::jsonb
  );
  v_replay := public.flowstate_restore_backup_v1(
    v_actor,
    'atomic-replay-probe',
    'atomic-replay-hash',
    '4.0.0',
    v_tasks,
    v_projects,
    '[]'::jsonb,
    '[]'::jsonb
  );
  IF v_first->>'ok' IS DISTINCT FROM 'true'
     OR v_replay->>'replayed' IS DISTINCT FROM 'true'
     OR (SELECT count(*) FROM public.tasks
         WHERE id::text = '00000000-0000-4000-8000-000000000112') <> 1 THEN
    RAISE EXCEPTION 'atomic restore replay did not return one committed result';
  END IF;
  BEGIN
    PERFORM public.flowstate_restore_backup_v1(
      v_actor,
      'atomic-replay-probe',
      'atomic-replay-hash',
      '4.0.0',
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%restore_idempotency_conflict%' THEN
      RAISE;
    END IF;
    v_conflicted := true;
  END;
  IF NOT v_conflicted THEN
    RAISE EXCEPTION 'atomic restore accepted altered idempotency reuse';
  END IF;
END;
$$;

\echo 'Atomic backup restore rollback and replay probes passed'

ROLLBACK;
