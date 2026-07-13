-- Regression coverage for the transactional recurring-task "Done for now" RPC.
-- Every fixture and temporary failure hook is rolled back.
--
-- Usage:
--   docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 \
--     < scripts/db/test-done-for-now-rpc.sql

BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
  (
    'd0f00000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'done-for-now-owner@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'd0f00000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'done-for-now-other@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'd0f00000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'done-for-now-viewer@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  );

INSERT INTO public.workspaces (id, name, owner_id) VALUES
  ('d0f00000-0000-4000-8000-000000000101', 'Done for now workspace', 'd0f00000-0000-4000-8000-000000000001'),
  ('d0f00000-0000-4000-8000-000000000102', 'Wrong workspace context', 'd0f00000-0000-4000-8000-000000000001');

INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
  ('d0f00000-0000-4000-8000-000000000101', 'd0f00000-0000-4000-8000-000000000001', 'owner'),
  ('d0f00000-0000-4000-8000-000000000102', 'd0f00000-0000-4000-8000-000000000001', 'owner');

INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
  ('d0f00000-0000-4000-8000-000000000101', 'd0f00000-0000-4000-8000-000000000003', 'viewer');

INSERT INTO public.tasks (
  id, user_id, workspace_id, title, status, due_date, due_time, estimated_duration,
  recurrence_rule, recurrence_parent_id, recurrence_count,
  is_completion_record, is_deleted, instances, subtasks, is_in_inbox
) VALUES
  (
    'd0f00000-0000-4000-8000-000000000201', 'd0f00000-0000-4000-8000-000000000001', null,
    'Disposable recurring fixture', 'planned', '2026-07-12 20:00:00+03',
    '20:00', 45,
    '{"pattern":"daily","interval":1,"endType":"never"}',
    'd0f00000-0000-4000-8000-000000000201', 0, false, false,
    '[{"id":"current-instance","taskId":"d0f00000-0000-4000-8000-000000000201","scheduledDate":"2026-07-12","scheduledTime":"20:00","duration":45,"status":"scheduled"}]',
    '[{"id":"subtask-1","title":"Reset me","isCompleted":true}]', true
  ),
  (
    'd0f00000-0000-4000-8000-000000000202', 'd0f00000-0000-4000-8000-000000000001', null,
    'Disposable non-recurring fixture', 'planned', '2026-07-12', null, 25,
    null, null, 0, false, false, '[]', '[]', true
  ),
  (
    'd0f00000-0000-4000-8000-000000000203', 'd0f00000-0000-4000-8000-000000000002', null,
    'Disposable other-user fixture', 'planned', '2026-07-12', null, 25,
    '{"pattern":"daily","interval":1,"endType":"never"}',
    'd0f00000-0000-4000-8000-000000000203', 0, false, false, '[]', '[]', true
  ),
  (
    'd0f00000-0000-4000-8000-000000000206', 'd0f00000-0000-4000-8000-000000000001', null,
    'Disposable rollback fixture', 'planned', '2026-07-12', null, 25,
    '{"pattern":"daily","interval":1,"endType":"never"}',
    'd0f00000-0000-4000-8000-000000000206', 0, false, false, '[]', '[]', true
  ),
  (
    'd0f00000-0000-4000-8000-000000000204', 'd0f00000-0000-4000-8000-000000000001',
    'd0f00000-0000-4000-8000-000000000101',
    'Disposable workspace fixture', 'planned', '2026-07-12', null, 25,
    '{"pattern":"daily","interval":1,"endType":"never"}',
    'd0f00000-0000-4000-8000-000000000204', 0, false, false, '[]', '[]', true
  ),
  (
    'd0f00000-0000-4000-8000-000000000205', 'd0f00000-0000-4000-8000-000000000001', null,
    'Disposable bounded recurrence fixture', 'planned', '2026-07-12', null, 25,
    '{"pattern":"daily","interval":1,"endType":"on_date","endDate":"2026-07-16"}',
    'd0f00000-0000-4000-8000-000000000205', 0, false, false, '[]', '[]', true
  );

SELECT set_config('request.jwt.claim.sub', 'd0f00000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"d0f00000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE done_for_now_results (
  key text PRIMARY KEY,
  payload jsonb NOT NULL
) ON COMMIT DROP;

-- Preview is exact and performs no writes.
INSERT INTO done_for_now_results (key, payload)
SELECT 'preview', public.flowstate_done_for_now(
  p_task_id => 'd0f00000-0000-4000-8000-000000000201',
  p_preview => true,
  p_next_due_date => '2026-07-16'
);

DO $$
DECLARE
  v_preview jsonb := (SELECT payload FROM done_for_now_results WHERE key = 'preview');
  v_task public.tasks%ROWTYPE;
  v_history_count integer;
  v_receipt_count integer;
BEGIN
  IF v_preview #>> '{ok}' <> 'true'
     OR v_preview #>> '{preview}' <> 'true'
     OR nullif(v_preview->>'previewVersion', '') IS NULL
     OR v_preview #>> '{currentOccurrence,dueDate}' <> '2026-07-12'
     OR v_preview #>> '{currentOccurrence,statusBefore}' <> 'todo'
     OR v_preview #>> '{currentOccurrence,statusAfter}' <> 'done'
     OR v_preview #>> '{recurrence,nextDueDateAfter}' <> '2026-07-16'
     OR v_preview #>> '{recurrence,cadencePreserved}' <> 'true' THEN
    RAISE EXCEPTION 'FAIL: preview was not exact: %', v_preview;
  END IF;

  SELECT * INTO v_task FROM public.tasks WHERE id = 'd0f00000-0000-4000-8000-000000000201';
  SELECT count(*) INTO v_history_count FROM public.tasks
    WHERE recurrence_parent_id = 'd0f00000-0000-4000-8000-000000000201' AND is_completion_record = true;
  SELECT count(*) INTO v_receipt_count FROM public.flowstate_action_receipts
    WHERE operation = 'done_for_now';

  IF v_task.due_date::date <> DATE '2026-07-12'
     OR v_task.recurrence_count <> 0
     OR jsonb_array_length(v_task.instances) <> 1
     OR v_history_count <> 0
     OR v_receipt_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: preview mutated state';
  END IF;
END $$;

-- Apply the approved preview.
INSERT INTO done_for_now_results (key, payload)
SELECT 'apply', public.flowstate_done_for_now(
  p_task_id => 'd0f00000-0000-4000-8000-000000000201',
  p_preview => false,
  p_next_due_date => '2026-07-16',
  p_request_id => 'request-stable-1',
  p_preview_version => (SELECT payload->>'previewVersion' FROM done_for_now_results WHERE key = 'preview')
);

DO $$
DECLARE
  v_apply jsonb := (SELECT payload FROM done_for_now_results WHERE key = 'apply');
  v_task public.tasks%ROWTYPE;
  v_history public.tasks%ROWTYPE;
  v_next_instance jsonb;
BEGIN
  IF v_apply #>> '{ok}' <> 'true'
     OR v_apply #>> '{preview}' <> 'false'
     OR v_apply->>'requestId' <> 'request-stable-1'
     OR v_apply->>'taskId' <> 'd0f00000-0000-4000-8000-000000000201'
     OR v_apply #>> '{currentOccurrence,dueDate}' <> '2026-07-12'
     OR nullif(v_apply #>> '{completedOccurrence,id}', '') IS NULL
     OR v_apply #>> '{completedOccurrence,status}' <> 'done'
     OR v_apply #>> '{nextOccurrence,dueDate}' <> '2026-07-16'
     OR v_apply #>> '{nextOccurrence,scheduledTime}' <> '20:00'
     OR v_apply #>> '{nextOccurrence,duration}' <> '45'
     OR nullif(v_apply #>> '{nextOccurrence,id}', '') IS NULL THEN
    RAISE EXCEPTION 'FAIL: apply receipt was incomplete: %', v_apply;
  END IF;

  SELECT * INTO STRICT v_task FROM public.tasks WHERE id = 'd0f00000-0000-4000-8000-000000000201';
  SELECT * INTO STRICT v_history FROM public.tasks
    WHERE id::text = v_apply #>> '{completedOccurrence,id}';
  v_next_instance := v_task.instances->0;

  IF v_history.status <> 'done'
     OR v_history.completed_at IS NULL
     OR v_history.due_date::date <> DATE '2026-07-12'
     OR v_history.is_completion_record IS DISTINCT FROM true
     OR v_history.recurrence_parent_id <> 'd0f00000-0000-4000-8000-000000000201'
     OR v_history.recurrence_count <> 0
     OR v_history.recurrence_rule IS NOT NULL
     OR v_history.instances #>> '{0,status}' <> 'completed' THEN
    RAISE EXCEPTION 'FAIL: completion history was not preserved: %', row_to_json(v_history);
  END IF;

  IF v_task.status <> 'planned'
     OR v_task.due_date::date <> DATE '2026-07-16'
     OR v_task.recurrence_count <> 1
     OR v_task.recurrence_rule IS NULL
     OR v_task.is_completion_record IS DISTINCT FROM false
     OR jsonb_array_length(v_task.instances) <> 1
     OR v_next_instance->>'scheduledDate' <> '2026-07-16'
     OR v_next_instance->>'scheduledTime' <> '20:00'
     OR v_next_instance->>'scheduledTime' IS DISTINCT FROM v_apply #>> '{nextOccurrence,scheduledTime}'
     OR v_next_instance->>'duration' IS DISTINCT FROM v_apply #>> '{nextOccurrence,duration}'
     OR v_next_instance->>'status' <> 'scheduled'
     OR v_task.subtasks #>> '{0,isCompleted}' <> 'false' THEN
    RAISE EXCEPTION 'FAIL: living recurrence was not advanced exactly once: %', row_to_json(v_task);
  END IF;
END $$;

-- Identical retry returns the original receipt and creates no duplicates.
INSERT INTO done_for_now_results (key, payload)
SELECT 'retry', public.flowstate_done_for_now(
  p_task_id => 'd0f00000-0000-4000-8000-000000000201',
  p_preview => false,
  p_next_due_date => '2026-07-16',
  p_request_id => 'request-stable-1',
  p_preview_version => (SELECT payload->>'previewVersion' FROM done_for_now_results WHERE key = 'preview')
);

DO $$
DECLARE
  v_count integer;
BEGIN
  IF (SELECT payload FROM done_for_now_results WHERE key = 'retry')
     IS DISTINCT FROM
     (SELECT payload FROM done_for_now_results WHERE key = 'apply') THEN
    RAISE EXCEPTION 'FAIL: identical retry did not return the stable receipt';
  END IF;

  SELECT count(*) INTO v_count FROM public.tasks
    WHERE recurrence_parent_id = 'd0f00000-0000-4000-8000-000000000201' AND is_completion_record = true;
  IF v_count <> 1 OR (SELECT recurrence_count FROM public.tasks WHERE id = 'd0f00000-0000-4000-8000-000000000201') <> 1 THEN
    RAISE EXCEPTION 'FAIL: retry duplicated history or advanced recurrence twice';
  END IF;
END $$;

-- Reusing the request id with another payload is a typed conflict.
INSERT INTO done_for_now_results (key, payload)
SELECT 'conflict', public.flowstate_done_for_now(
  p_task_id => 'd0f00000-0000-4000-8000-000000000201',
  p_preview => false,
  p_next_due_date => '2026-07-17',
  p_request_id => 'request-stable-1',
  p_preview_version => (SELECT payload->>'previewVersion' FROM done_for_now_results WHERE key = 'preview')
);

-- Typed validation and scope failures do not mutate rows.
SELECT set_config('request.jwt.claim.sub', 'd0f00000-0000-4000-8000-000000000003', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"d0f00000-0000-4000-8000-000000000003","role":"authenticated"}',
  true
);
INSERT INTO done_for_now_results (key, payload)
SELECT 'shared_viewer', public.flowstate_done_for_now(
  p_task_id => 'dfn-shared', p_preview => true,
  p_workspace_id => 'd0f00000-0000-4000-8000-000000000101'
);
SELECT set_config('request.jwt.claim.sub', 'd0f00000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"d0f00000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
INSERT INTO done_for_now_results (key, payload) VALUES
  ('non_recurring', public.flowstate_done_for_now('d0f00000-0000-4000-8000-000000000202', true)),
  ('missing', public.flowstate_done_for_now('d0f00000-0000-4000-8000-000000000299', true)),
  ('cross_scope', public.flowstate_done_for_now('d0f00000-0000-4000-8000-000000000203', true)),
  ('invalid_date', public.flowstate_done_for_now('d0f00000-0000-4000-8000-000000000206', true, '2026-07-12')),
  ('personal_wrong_workspace', public.flowstate_done_for_now(
    p_task_id => 'd0f00000-0000-4000-8000-000000000206', p_preview => true,
    p_workspace_id => 'd0f00000-0000-4000-8000-000000000101'
  )),
  ('shared_missing_workspace', public.flowstate_done_for_now('d0f00000-0000-4000-8000-000000000204', true)),
  ('shared_wrong_workspace', public.flowstate_done_for_now(
    p_task_id => 'd0f00000-0000-4000-8000-000000000204', p_preview => true,
    p_workspace_id => 'd0f00000-0000-4000-8000-000000000102'
  )),
  ('shared_exact_workspace', public.flowstate_done_for_now(
    p_task_id => 'd0f00000-0000-4000-8000-000000000204', p_preview => true,
    p_workspace_id => 'd0f00000-0000-4000-8000-000000000101'
  )),
  ('override_beyond_end', public.flowstate_done_for_now(
    p_task_id => 'd0f00000-0000-4000-8000-000000000205', p_preview => true,
    p_next_due_date => '2026-07-17'
  ));

DO $$
BEGIN
  IF (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'conflict') <> 'idempotency_conflict'
     OR (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'non_recurring') <> 'not_recurring'
     OR (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'missing') <> 'not_found'
     OR (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'cross_scope') <> 'not_found'
     OR (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'invalid_date') <> 'invalid_next_date'
     OR (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'personal_wrong_workspace') <> 'not_found'
     OR (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'shared_missing_workspace') <> 'not_found'
     OR (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'shared_wrong_workspace') <> 'not_found'
     OR (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'shared_viewer') <> 'not_found'
     OR (SELECT payload #>> '{ok}' FROM done_for_now_results WHERE key = 'shared_exact_workspace') <> 'true'
     OR (SELECT payload #>> '{error,code}' FROM done_for_now_results WHERE key = 'override_beyond_end') <> 'invalid_next_date' THEN
    RAISE EXCEPTION 'FAIL: typed errors were not stable: %',
      (SELECT jsonb_object_agg(key, payload) FROM done_for_now_results);
  END IF;
END $$;

-- The SQL planner mirrors SimpleRecurrenceRule semantics.
DO $$
BEGIN
  IF public.flowstate_next_recurrence_date(
       '2026-07-12', '{"pattern":"daily","interval":2,"endType":"never"}', 1
     ) <> DATE '2026-07-14'
     OR public.flowstate_next_recurrence_date(
       '2026-07-12', '{"pattern":"weekly","interval":1,"weekdays":[1,4],"endType":"never"}', 1
     ) <> DATE '2026-07-13'
     OR public.flowstate_next_recurrence_date(
       '2026-07-31', '{"pattern":"monthly","interval":1,"monthDay":31,"endType":"never"}', 1
     ) <> DATE '2026-08-31'
     OR public.flowstate_next_recurrence_date(
       '2026-07-01', '{"pattern":"monthly","interval":1,"monthWeekday":{"nth":-1,"day":1},"endType":"never"}', 1
     ) <> DATE '2026-08-31'
     OR public.flowstate_next_recurrence_date(
       '2024-02-29', '{"pattern":"yearly","interval":1,"endType":"never"}', 1
     ) <> DATE '2025-02-28'
     OR public.flowstate_next_recurrence_date(
       '2026-07-12', '{"pattern":"daily","interval":1,"endType":"after_count","endCount":1}', 1
     ) IS NOT NULL
     OR public.flowstate_next_recurrence_date(
       '2026-07-12', '{"pattern":"daily","interval":2,"endType":"on_date","endDate":"2026-07-13"}', 1
     ) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: recurrence planner diverged from SimpleRecurrenceRule';
  END IF;
END $$;

-- Force the final living-task update to fail after the history insert. The RPC
-- statement must roll the history insert back with it.
CREATE FUNCTION public.test_force_done_for_now_update_failure()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id = 'd0f00000-0000-4000-8000-000000000206' THEN
    RAISE EXCEPTION 'injected next-occurrence write failure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER test_force_done_for_now_update_failure
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.test_force_done_for_now_update_failure();

DO $$
DECLARE
  v_preview jsonb;
BEGIN
  v_preview := public.flowstate_done_for_now('d0f00000-0000-4000-8000-000000000206', true);
  BEGIN
    PERFORM public.flowstate_done_for_now(
      'd0f00000-0000-4000-8000-000000000206', false, null, 'request-rollback-1', v_preview->>'previewVersion'
    );
    RAISE EXCEPTION 'FAIL: injected transaction failure did not propagate';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'FAIL: injected transaction failure did not propagate' THEN
        RAISE;
      END IF;
  END;

  IF EXISTS (
       SELECT 1 FROM public.tasks
       WHERE recurrence_parent_id = 'd0f00000-0000-4000-8000-000000000206' AND is_completion_record = true
     )
     OR (SELECT recurrence_count FROM public.tasks WHERE id = 'd0f00000-0000-4000-8000-000000000206') <> 0
     OR (SELECT due_date::date FROM public.tasks WHERE id = 'd0f00000-0000-4000-8000-000000000206') <> DATE '2026-07-12'
     OR EXISTS (
       SELECT 1 FROM public.flowstate_action_receipts WHERE request_id = 'request-rollback-1'
     ) THEN
    RAISE EXCEPTION 'FAIL: transaction failure left partial recurring completion state';
  END IF;
END $$;

DROP TRIGGER test_force_done_for_now_update_failure ON public.tasks;
DROP FUNCTION public.test_force_done_for_now_update_failure();

DO $$
BEGIN
  RAISE NOTICE 'PASS: Done for now preview, apply, idempotency, scope, planner, and rollback';
END $$;

ROLLBACK;
