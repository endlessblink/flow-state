-- Transactional duplicate-task merge regression. All fixtures roll back.
-- Usage: docker exec -i supabase_db_flow-state psql -U postgres -v ON_ERROR_STOP=1 \
--   < scripts/db/test-merge-tasks-rpc.sql

BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'd0f10000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'merge-tasks-owner@test.flowstate', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated', '', ''
);

INSERT INTO public.workspaces (id, name, owner_id) VALUES
  ('d0f10000-0000-4000-8000-000000000101', 'Merge fixture workspace', 'd0f10000-0000-4000-8000-000000000001'),
  ('d0f10000-0000-4000-8000-000000000102', 'Wrong merge workspace', 'd0f10000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
  ('d0f10000-0000-4000-8000-000000000101', 'd0f10000-0000-4000-8000-000000000001', 'owner'),
  ('d0f10000-0000-4000-8000-000000000102', 'd0f10000-0000-4000-8000-000000000001', 'owner');

INSERT INTO public.tasks (
  id, user_id, workspace_id, title, description, status, priority,
  due_date, tags, subtasks, instances, attachments, recurrence_rule,
  recurrence_parent_id, recurrence_count, is_completion_record,
  is_deleted, is_in_inbox
) VALUES
  (
    'merge-survivor', 'd0f10000-0000-4000-8000-000000000001',
    'd0f10000-0000-4000-8000-000000000101', 'Survivor', 'Keep this',
    'planned', 'high', '2026-07-20', ARRAY['survivor'],
    '[{"id":"sub-survivor","title":"Keep"}]',
    '[{"id":"block-survivor","scheduledDate":"2026-07-20","scheduledTime":"09:00","duration":25}]',
    '[{"id":"attachment-survivor","name":"keep.txt"}]', null, null, 0, false, false, true
  ),
  (
    'merge-duplicate', 'd0f10000-0000-4000-8000-000000000001',
    'd0f10000-0000-4000-8000-000000000101', 'Duplicate', 'Archived detail',
    'planned', 'high', '2026-07-20', ARRAY['duplicate'],
    '[{"id":"sub-duplicate","title":"Transfer"}]',
    '[{"id":"block-duplicate","scheduledDate":"2026-07-21","scheduledTime":"20:00","duration":45}]',
    '[{"id":"attachment-duplicate","name":"transfer.txt"}]', null, null, 0, false, false, true
  ),
  (
    'merge-recurring-a', 'd0f10000-0000-4000-8000-000000000001',
    'd0f10000-0000-4000-8000-000000000101', 'Recurring A', null,
    'planned', null, '2026-07-20', null, '[]', '[]', '[]',
    '{"pattern":"daily","interval":1,"endType":"never"}', null, 0, false, false, true
  ),
  (
    'merge-recurring-b', 'd0f10000-0000-4000-8000-000000000001',
    'd0f10000-0000-4000-8000-000000000101', 'Recurring B', null,
    'planned', null, '2026-07-20', null, '[]', '[]', '[]',
    '{"pattern":"weekly","interval":1,"weekdays":[1],"endType":"never"}', null, 0, false, false, true
  ),
  (
    'merge-rollback-survivor', 'd0f10000-0000-4000-8000-000000000001',
    'd0f10000-0000-4000-8000-000000000101', 'Rollback survivor', null,
    'planned', null, null, ARRAY['before'], '[]', '[]', '[]', null, null, 0, false, false, true
  ),
  (
    'merge-rollback-duplicate', 'd0f10000-0000-4000-8000-000000000001',
    'd0f10000-0000-4000-8000-000000000101', 'Rollback duplicate', null,
    'planned', null, null, ARRAY['must-rollback'], '[]', '[]', '[]', null, null, 0, false, false, true
  );

INSERT INTO public.task_comments (id, task_id, workspace_id, user_id, content)
VALUES (
  'd0f10000-0000-4000-8000-000000000201', 'merge-duplicate',
  'd0f10000-0000-4000-8000-000000000101',
  'd0f10000-0000-4000-8000-000000000001', 'Transfer this comment'
);

INSERT INTO public.task_contexts (
  task_id, user_id, summary, success_criteria, selection_hints,
  non_goals, user_corrections
) VALUES (
  'merge-duplicate', 'd0f10000-0000-4000-8000-000000000001',
  'Transfer this context', '[]', '[]', '[]', '[]'
);

SELECT set_config('request.jwt.claim.sub', 'd0f10000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"d0f10000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE merge_results (key text PRIMARY KEY, payload jsonb NOT NULL) ON COMMIT DROP;

INSERT INTO merge_results (key, payload)
SELECT 'preview', public.flowstate_merge_tasks(
  p_survivor_task_id => 'merge-survivor',
  p_duplicate_task_id => 'merge-duplicate',
  p_preview => true,
  p_workspace_id => 'd0f10000-0000-4000-8000-000000000101'
);

DO $$
DECLARE v jsonb := (SELECT payload FROM merge_results WHERE key = 'preview');
BEGIN
  IF v #>> '{ok}' <> 'true'
     OR v #>> '{preview}' <> 'true'
     OR nullif(v->>'previewVersion', '') IS NULL
     OR v #>> '{survivor,id}' <> 'merge-survivor'
     OR v #>> '{duplicate,id}' <> 'merge-duplicate'
     OR v #>> '{duplicate,disposition}' <> 'soft_delete'
     OR v #>> '{transfer,taskComments}' <> '1'
     OR v #>> '{transfer,taskContext}' <> 'true'
     OR v #>> '{transfer,instances}' <> '1'
     OR v #>> '{transfer,subtasks}' <> '1'
     OR v #>> '{transfer,attachments}' <> '1' THEN
    RAISE EXCEPTION 'FAIL: merge preview was not exact: %', v;
  END IF;

  IF (SELECT is_deleted FROM public.tasks WHERE id = 'merge-duplicate')
     OR (SELECT count(*) FROM public.task_comments WHERE task_id = 'merge-duplicate') <> 1
     OR (SELECT count(*) FROM public.task_contexts WHERE task_id = 'merge-duplicate') <> 1
     OR (SELECT count(*) FROM public.flowstate_action_receipts WHERE operation = 'merge_tasks') <> 0 THEN
    RAISE EXCEPTION 'FAIL: merge preview mutated state';
  END IF;
END $$;

INSERT INTO merge_results (key, payload)
SELECT 'apply', public.flowstate_merge_tasks(
  p_survivor_task_id => 'merge-survivor',
  p_duplicate_task_id => 'merge-duplicate',
  p_preview => false,
  p_request_id => 'merge-request-1',
  p_preview_version => (SELECT payload->>'previewVersion' FROM merge_results WHERE key = 'preview'),
  p_workspace_id => 'd0f10000-0000-4000-8000-000000000101'
);

DO $$
DECLARE
  v jsonb := (SELECT payload FROM merge_results WHERE key = 'apply');
  s public.tasks%ROWTYPE;
  d public.tasks%ROWTYPE;
BEGIN
  SELECT * INTO STRICT s FROM public.tasks WHERE id = 'merge-survivor';
  SELECT * INTO STRICT d FROM public.tasks WHERE id = 'merge-duplicate';

  IF v #>> '{ok}' <> 'true'
     OR v #>> '{preview}' <> 'false'
     OR v->>'requestId' <> 'merge-request-1'
     OR v #>> '{survivor,id}' <> 'merge-survivor'
     OR v #>> '{duplicate,id}' <> 'merge-duplicate'
     OR v #>> '{duplicate,status}' <> 'archived' THEN
    RAISE EXCEPTION 'FAIL: merge apply receipt was incomplete: %', v;
  END IF;

  IF s.tags @> ARRAY['survivor','duplicate'] IS NOT TRUE
     OR jsonb_array_length(s.subtasks) <> 2
     OR jsonb_array_length(s.instances) <> 2
     OR jsonb_array_length(s.attachments) <> 2
     OR d.is_deleted IS DISTINCT FROM true
     OR d.deleted_at IS NULL
     OR (SELECT count(*) FROM public.task_comments WHERE task_id = 'merge-survivor') <> 1
     OR (SELECT count(*) FROM public.task_comments WHERE task_id = 'merge-duplicate') <> 0
     OR (SELECT count(*) FROM public.task_contexts WHERE task_id = 'merge-survivor') <> 1
     OR (SELECT count(*) FROM public.task_contexts WHERE task_id = 'merge-duplicate') <> 0 THEN
    RAISE EXCEPTION 'FAIL: merge did not preserve/transfer records atomically';
  END IF;
END $$;

INSERT INTO merge_results (key, payload)
SELECT 'retry', public.flowstate_merge_tasks(
  'merge-survivor', 'merge-duplicate', false, 'merge-request-1',
  (SELECT payload->>'previewVersion' FROM merge_results WHERE key = 'preview'),
  'd0f10000-0000-4000-8000-000000000101'
);

INSERT INTO merge_results (key, payload) VALUES
  ('conflict', public.flowstate_merge_tasks(
    'merge-survivor', 'merge-duplicate', false, 'merge-request-1', 'different-preview',
    'd0f10000-0000-4000-8000-000000000101'
  )),
  ('same_task', public.flowstate_merge_tasks(
    'merge-survivor', 'merge-survivor', true, null, null,
    'd0f10000-0000-4000-8000-000000000101'
  )),
  ('wrong_workspace', public.flowstate_merge_tasks(
    'merge-recurring-a', 'merge-recurring-b', true, null, null,
    'd0f10000-0000-4000-8000-000000000102'
  )),
  ('incompatible_recurrence', public.flowstate_merge_tasks(
    'merge-recurring-a', 'merge-recurring-b', true, null, null,
    'd0f10000-0000-4000-8000-000000000101'
  ));

DO $$
BEGIN
  IF (SELECT payload FROM merge_results WHERE key = 'retry')
       IS DISTINCT FROM (SELECT payload FROM merge_results WHERE key = 'apply')
     OR (SELECT payload #>> '{error,code}' FROM merge_results WHERE key = 'conflict') <> 'idempotency_conflict'
     OR (SELECT payload #>> '{error,code}' FROM merge_results WHERE key = 'same_task') <> 'invalid_request'
     OR (SELECT payload #>> '{error,code}' FROM merge_results WHERE key = 'wrong_workspace') <> 'not_found'
     OR (SELECT payload #>> '{error,code}' FROM merge_results WHERE key = 'incompatible_recurrence') <> 'incompatible_recurrence' THEN
    RAISE EXCEPTION 'FAIL: merge retry or typed safety errors diverged: %',
      (SELECT jsonb_object_agg(key, payload) FROM merge_results);
  END IF;
END $$;

CREATE FUNCTION public.test_force_merge_archive_failure()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id = 'merge-rollback-duplicate' AND NEW.is_deleted = true THEN
    RAISE EXCEPTION 'injected duplicate archive failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_force_merge_archive_failure
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.test_force_merge_archive_failure();

DO $$
DECLARE v_preview jsonb;
BEGIN
  v_preview := public.flowstate_merge_tasks(
    'merge-rollback-survivor', 'merge-rollback-duplicate', true, null, null,
    'd0f10000-0000-4000-8000-000000000101'
  );
  BEGIN
    PERFORM public.flowstate_merge_tasks(
      'merge-rollback-survivor', 'merge-rollback-duplicate', false,
      'merge-request-rollback', v_preview->>'previewVersion',
      'd0f10000-0000-4000-8000-000000000101'
    );
    RAISE EXCEPTION 'FAIL: injected merge failure did not propagate';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'FAIL: injected merge failure did not propagate' THEN RAISE; END IF;
  END;

  IF (SELECT tags FROM public.tasks WHERE id = 'merge-rollback-survivor') IS DISTINCT FROM ARRAY['before']::text[]
     OR (SELECT is_deleted FROM public.tasks WHERE id = 'merge-rollback-duplicate')
     OR EXISTS (SELECT 1 FROM public.flowstate_action_receipts WHERE request_id = 'merge-request-rollback') THEN
    RAISE EXCEPTION 'FAIL: failed merge left partial state';
  END IF;
END $$;

DROP TRIGGER test_force_merge_archive_failure ON public.tasks;
DROP FUNCTION public.test_force_merge_archive_failure();

DO $$ BEGIN
  RAISE NOTICE 'PASS: merge preview, apply, transfer, idempotency, scope, conflict, and rollback';
END $$;

ROLLBACK;
