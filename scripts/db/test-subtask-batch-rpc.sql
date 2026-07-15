-- TASK-1963: canonical ordered subtask breakdown contract.
--
-- Intentionally RED until flowstate_subtask_batch_v1 provides preview/apply
-- binding, durable idempotency, canonical revisions, and atomic receipts.
-- All disposable fixtures are transaction-owned and rolled back.

BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
  (
    '1fc30000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'subtask-owner@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    '1fc30000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'subtask-viewer@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  );

INSERT INTO public.workspaces (id, name, owner_id)
VALUES (
  '1fc30000-0000-4000-8000-000000000010',
  'Subtask batch contract workspace',
  '1fc30000-0000-4000-8000-000000000001'
);

INSERT INTO public.workspace_members (id, workspace_id, user_id, role)
VALUES (
  '1fc30000-0000-4000-8000-000000000011',
  '1fc30000-0000-4000-8000-000000000010',
  '1fc30000-0000-4000-8000-000000000002',
  'viewer'
);

INSERT INTO public.tasks (
  id, user_id, title, status, completed_at, is_deleted, instances, subtasks,
  is_in_inbox, workspace_id
) VALUES
  (
    '1fc30000-0000-4000-8000-000000000101',
    '1fc30000-0000-4000-8000-000000000001',
    'Break down launch preparation', 'planned', NULL, false, '[]',
    '[{"id":"existing-step","parentTaskId":"1fc30000-0000-4000-8000-000000000101","order":0,"title":"Collect source material","doneEnough":"Links are in one note","estimateMinutes":15,"isCompleted":false,"legacyMarker":"preserve-me"},{"id":"obsolete-step","parentTaskId":"1fc30000-0000-4000-8000-000000000101","order":1,"title":"Obsolete step","isCompleted":false,"legacyMarker":"delete-only-this"}]',
    true, NULL
  ),
  (
    '1fc30000-0000-4000-8000-000000000102',
    '1fc30000-0000-4000-8000-000000000001',
    'Workspace breakdown fixture', 'planned', NULL, false, '[]', '[]', true,
    '1fc30000-0000-4000-8000-000000000010'
  ),
  (
    '1fc30000-0000-4000-8000-000000000103',
    '1fc30000-0000-4000-8000-000000000001',
    'Rollback breakdown fixture', 'planned', NULL, false, '[]', '[]', true, NULL
  );

SELECT set_config('request.jwt.claim.sub', '1fc30000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"1fc30000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE subtask_batch_results (
  key text PRIMARY KEY,
  payload jsonb NOT NULL
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.assert_subtask_preview(
  p_preview jsonb,
  p_operation_id text,
  p_revision bigint
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_preview->>'ok' IS DISTINCT FROM 'true'
     OR p_preview->>'result' IS DISTINCT FROM 'preview'
     OR p_preview->>'contractVersion' IS DISTINCT FROM 'task-v1'
     OR p_preview->>'action' IS DISTINCT FROM 'subtask_batch'
     OR p_preview->>'operationId' IS DISTINCT FROM p_operation_id
     OR (p_preview->>'baseRevision')::bigint IS DISTINCT FROM p_revision
     OR p_preview->>'requestHash' !~ '^[0-9a-f]{64}$'
     OR p_preview->>'previewDigest' !~ '^[0-9a-f]{64}$'
     OR (p_preview->>'previewExpiresAt')::timestamptz <= clock_timestamp()
     OR p_preview #>> '{normalizedPayload,taskId}'
          IS DISTINCT FROM '1fc30000-0000-4000-8000-000000000101'
     OR jsonb_array_length(p_preview #> '{normalizedPayload,operations}') <> 3
     OR p_preview #>> '{readBack,id}'
          IS DISTINCT FROM '1fc30000-0000-4000-8000-000000000101'
     OR (p_preview #>> '{readBack,canonicalRevision}')::bigint IS DISTINCT FROM p_revision THEN
    RAISE EXCEPTION 'FAIL: invalid canonical subtask preview: %', p_preview;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_subtask_receipt(
  p_envelope jsonb,
  p_status text,
  p_operation_id text,
  p_revision bigint
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_receipt jsonb := p_envelope->'receipt';
BEGIN
  IF p_envelope->>'ok' IS DISTINCT FROM 'true'
     OR p_envelope->>'result' IS DISTINCT FROM 'committed'
     OR p_envelope->>'operationId' IS DISTINCT FROM p_operation_id
     OR v_receipt->>'status' IS DISTINCT FROM p_status
     OR v_receipt->>'operationId' IS DISTINCT FROM p_operation_id
     OR v_receipt->>'contractVersion' IS DISTINCT FROM 'task-v1'
     OR v_receipt->>'source' IS DISTINCT FROM 'local-api'
     OR v_receipt->>'entityType' IS DISTINCT FROM 'task'
     OR v_receipt->>'action' IS DISTINCT FROM 'subtask_batch'
     OR v_receipt->>'entityId'
          IS DISTINCT FROM '1fc30000-0000-4000-8000-000000000101'
     OR (v_receipt->>'canonicalRevision')::bigint IS DISTINCT FROM p_revision
     OR (v_receipt->>'changeSequence')::bigint < 1
     OR (v_receipt->>'replayed')::boolean IS DISTINCT FROM (p_status = 'replayed')
     OR jsonb_array_length(v_receipt->'affected') <> 1
     OR v_receipt #>> '{affected,0,action}' IS DISTINCT FROM 'update'
     OR v_receipt #>> '{affected,0,entityId}'
          IS DISTINCT FROM '1fc30000-0000-4000-8000-000000000101'
     OR v_receipt #>> '{readBack,id}'
          IS DISTINCT FROM '1fc30000-0000-4000-8000-000000000101'
     OR jsonb_array_length(v_receipt #> '{readBack,subtasks}') <> 2 THEN
    RAISE EXCEPTION 'FAIL: invalid canonical subtask receipt: %', p_envelope;
  END IF;
END;
$$;

-- Preview is deterministic and changes no task, operation, or change row.
DO $$
DECLARE
  v_revision bigint;
  v_before_subtasks jsonb;
  v_preview jsonb;
  v_preview_again jsonb;
  v_operations bigint;
  v_changes bigint;
BEGIN
  SELECT canonical_revision, subtasks INTO v_revision, v_before_subtasks
  FROM public.tasks WHERE id = '1fc30000-0000-4000-8000-000000000101';
  SELECT count(*) INTO v_operations FROM public.canonical_operations;
  SELECT count(*) INTO v_changes FROM public.canonical_change_log;

  v_preview := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-main', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000101', v_revision,
    '[
      {"kind":"update","subtaskId":"existing-step","order":0,"isCompleted":true,"completedPomodoros":2,"canvasPosition":{"x":420,"y":260}},
      {"kind":"delete","subtaskId":"obsolete-step"},
      {"kind":"create","clientId":"outline-step","title":"  Draft smallest outline  ","doneEnough":"Five ordered bullets exist","estimateMinutes":25,"order":1}
    ]',
    true, NULL, NULL, NULL, NULL
  );
  v_preview_again := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-main', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000101', v_revision,
    '[
      {"kind":"update","subtaskId":"existing-step","order":0,"isCompleted":true,"completedPomodoros":2,"canvasPosition":{"x":420,"y":260}},
      {"kind":"delete","subtaskId":"obsolete-step"},
      {"kind":"create","clientId":"outline-step","title":"  Draft smallest outline  ","doneEnough":"Five ordered bullets exist","estimateMinutes":25,"order":1}
    ]',
    true, NULL, NULL, NULL, NULL
  );
  PERFORM pg_temp.assert_subtask_preview(v_preview, 'subtask-breakdown-main', v_revision);
  PERFORM pg_temp.assert_subtask_preview(v_preview_again, 'subtask-breakdown-main', v_revision);

  IF v_preview->>'previewDigest' IS DISTINCT FROM v_preview_again->>'previewDigest'
     OR v_preview #>> '{normalizedPayload,operations,0,kind}' IS DISTINCT FROM 'update'
     OR v_preview #>> '{normalizedPayload,operations,0,subtaskId}' IS DISTINCT FROM 'existing-step'
     OR (v_preview #>> '{normalizedPayload,operations,0,isCompleted}')::boolean IS DISTINCT FROM true
     OR (v_preview #>> '{normalizedPayload,operations,0,completedPomodoros}')::integer <> 2
     OR (v_preview #>> '{normalizedPayload,operations,0,canvasPosition,x}')::integer <> 420
     OR (v_preview #>> '{normalizedPayload,operations,0,canvasPosition,y}')::integer <> 260
     OR v_preview #>> '{normalizedPayload,operations,1,kind}' IS DISTINCT FROM 'delete'
     OR v_preview #>> '{normalizedPayload,operations,1,subtaskId}' IS DISTINCT FROM 'obsolete-step'
     OR v_preview #>> '{normalizedPayload,operations,2,kind}' IS DISTINCT FROM 'create'
     OR v_preview #>> '{normalizedPayload,operations,2,clientId}' IS DISTINCT FROM 'outline-step'
     OR v_preview #>> '{normalizedPayload,operations,2,title}' IS DISTINCT FROM 'Draft smallest outline'
     OR v_preview #>> '{normalizedPayload,operations,2,doneEnough}' IS DISTINCT FROM 'Five ordered bullets exist'
     OR (v_preview #>> '{normalizedPayload,operations,2,estimateMinutes}')::integer <> 25
     OR (v_preview #>> '{normalizedPayload,operations,2,order}')::integer <> 1
     OR nullif(v_preview #>> '{readBack,subtasks,1,id}', '') IS NULL
     OR (SELECT subtasks FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') IS DISTINCT FROM v_before_subtasks
     OR (SELECT canonical_revision FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> v_revision
     OR (SELECT count(*) FROM public.canonical_operations) <> v_operations
     OR (SELECT count(*) FROM public.canonical_change_log) <> v_changes THEN
    RAISE EXCEPTION 'FAIL: subtask preview was not exact, ordered, deterministic, and zero-write';
  END IF;

  INSERT INTO subtask_batch_results VALUES ('main-preview', v_preview);
END;
$$;

-- An altered payload cannot consume approval for a different breakdown.
DO $$
DECLARE
  v_preview jsonb := (SELECT payload FROM subtask_batch_results WHERE key = 'main-preview');
  v_revision bigint;
  v_result jsonb;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc30000-0000-4000-8000-000000000101';
  v_result := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-main', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000101', v_revision,
    '[
      {"kind":"create","clientId":"outline-step","title":"Draft smallest outline","doneEnough":"Five ordered bullets exist","estimateMinutes":90,"order":1},
      {"kind":"delete","subtaskId":"obsolete-step"},
      {"kind":"update","subtaskId":"existing-step","order":0,"isCompleted":true,"completedPomodoros":2,"canvasPosition":{"x":420,"y":260}}
    ]',
    false, v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
  );
  IF v_result #>> '{error,code}' NOT IN ('preview_mismatch', 'request_hash_mismatch') THEN
    RAISE EXCEPTION 'FAIL: altered ordered breakdown consumed approval: %', v_result;
  END IF;
END;
$$;

-- Apply commits the exact ordered operation batch once, preserving untouched
-- legacy metadata. Partial subtask completion does not complete the parent.
DO $$
DECLARE
  v_preview jsonb := (SELECT payload FROM subtask_batch_results WHERE key = 'main-preview');
  v_revision bigint;
  v_apply jsonb;
  v_after_revision bigint;
  v_replay jsonb;
  v_conflict jsonb;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc30000-0000-4000-8000-000000000101';
  v_apply := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-main', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000101', v_revision,
    '[
      {"kind":"update","subtaskId":"existing-step","order":0,"isCompleted":true,"completedPomodoros":2,"canvasPosition":{"x":420,"y":260}},
      {"kind":"delete","subtaskId":"obsolete-step"},
      {"kind":"create","clientId":"outline-step","title":"  Draft smallest outline  ","doneEnough":"Five ordered bullets exist","estimateMinutes":25,"order":1}
    ]',
    false, v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
  );
  SELECT canonical_revision INTO v_after_revision FROM public.tasks
  WHERE id = '1fc30000-0000-4000-8000-000000000101';
  PERFORM pg_temp.assert_subtask_receipt(
    v_apply, 'committed', 'subtask-breakdown-main', v_after_revision
  );
  IF v_after_revision <> v_revision + 1
     OR (SELECT status FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> 'planned'
     OR (SELECT completed_at FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') IS NOT NULL
     OR (SELECT subtasks #>> '{0,isCompleted}' FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> 'true'
     OR (SELECT subtasks #>> '{0,completedPomodoros}' FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> '2'
     OR (SELECT subtasks #>> '{0,canvasPosition,x}' FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> '420'
     OR (SELECT subtasks #>> '{0,canvasPosition,y}' FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> '260'
     OR (SELECT subtasks #>> '{1,isCompleted}' FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> 'false'
     OR (SELECT subtasks #>> '{0,legacyMarker}' FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> 'preserve-me'
     OR (SELECT subtasks #>> '{1,clientId}' FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> 'outline-step'
     OR (SELECT count(*) FROM public.canonical_change_log
         WHERE operation_id = 'subtask-breakdown-main') <> 1 THEN
    RAISE EXCEPTION 'FAIL: subtask apply was partial or completed the parent: %', v_apply;
  END IF;

  v_replay := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-main', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000101', v_revision,
    '[
      {"kind":"update","subtaskId":"existing-step","order":0,"isCompleted":true,"completedPomodoros":2,"canvasPosition":{"x":420,"y":260}},
      {"kind":"delete","subtaskId":"obsolete-step"},
      {"kind":"create","clientId":"outline-step","title":"  Draft smallest outline  ","doneEnough":"Five ordered bullets exist","estimateMinutes":25,"order":1}
    ]',
    false, v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_subtask_receipt(
    v_replay, 'replayed', 'subtask-breakdown-main', v_after_revision
  );
  IF (SELECT canonical_revision FROM public.tasks
      WHERE id = '1fc30000-0000-4000-8000-000000000101') <> v_after_revision
     OR (SELECT count(*) FROM public.canonical_change_log
         WHERE operation_id = 'subtask-breakdown-main') <> 1 THEN
    RAISE EXCEPTION 'FAIL: replay duplicated subtask state or evidence';
  END IF;

  v_conflict := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-main', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000101', v_revision,
    '[{"kind":"create","clientId":"changed-step","title":"Changed after restart","doneEnough":"Different output","estimateMinutes":60,"order":0}]',
    false, v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
  );
  IF v_conflict #>> '{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'FAIL: durable operation identity accepted changed payload: %', v_conflict;
  END IF;
END;
$$;

-- A concurrent task edit invalidates the approved base revision.
DO $$
DECLARE
  v_revision bigint;
  v_preview jsonb;
  v_result jsonb;
  v_before_subtasks jsonb;
BEGIN
  SELECT canonical_revision, subtasks INTO v_revision, v_before_subtasks
  FROM public.tasks WHERE id = '1fc30000-0000-4000-8000-000000000103';
  v_preview := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-stale', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000103', v_revision,
    '[{"kind":"create","clientId":"safe-step","title":"Safe step","doneEnough":"Output exists","estimateMinutes":10,"order":0}]',
    true, NULL, NULL, NULL, NULL
  );
  UPDATE public.tasks SET planning_notes = '[{"type":"note","content":"concurrent edit"}]'
  WHERE id = '1fc30000-0000-4000-8000-000000000103';
  v_result := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-stale', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000103', v_revision,
    '[{"kind":"create","clientId":"safe-step","title":"Safe step","doneEnough":"Output exists","estimateMinutes":10,"order":0}]',
    false, v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
  );
  IF v_result #>> '{error,code}' <> 'stale_revision'
     OR (SELECT subtasks FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000103') IS DISTINCT FROM v_before_subtasks THEN
    RAISE EXCEPTION 'FAIL: concurrent edit did not prevent subtask operations: %', v_result;
  END IF;
END;
$$;

-- A viewer cannot mutate a workspace task.
DO $$
DECLARE
  v_revision bigint;
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '1fc30000-0000-4000-8000-000000000002', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"1fc30000-0000-4000-8000-000000000002","role":"authenticated"}',
    true
  );
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc30000-0000-4000-8000-000000000102';
  v_result := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-denied', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000102', v_revision,
    '[{"kind":"create","clientId":"forbidden-step","title":"Forbidden step","doneEnough":"Never written","estimateMinutes":10,"order":0}]',
    true, NULL, NULL, '1fc30000-0000-4000-8000-000000000010', NULL
  );
  IF v_result #>> '{error,code}' <> 'scope_denied'
     OR (SELECT subtasks FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000102') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: workspace viewer was allowed to change subtasks: %', v_result;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '1fc30000-0000-4000-8000-000000000001', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"1fc30000-0000-4000-8000-000000000001","role":"authenticated"}',
    true
  );
END;
$$;

-- A failure after task update must roll back task, operation, and change event.
CREATE OR REPLACE FUNCTION public.flowstate_test_reject_subtask_batch_fixture()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id::text = '1fc30000-0000-4000-8000-000000000103'
     AND jsonb_array_length(NEW.subtasks) > 0 THEN
    RAISE EXCEPTION 'injected subtask batch failure';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_revision bigint;
  v_before_subtasks jsonb;
  v_preview jsonb;
  v_result jsonb;
BEGIN
  SELECT canonical_revision, subtasks INTO v_revision, v_before_subtasks
  FROM public.tasks WHERE id = '1fc30000-0000-4000-8000-000000000103';
  v_preview := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-rollback', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000103', v_revision,
    '[{"kind":"create","clientId":"rollback-step","title":"Rollback step","doneEnough":"Never persists","estimateMinutes":10,"order":0}]',
    true, NULL, NULL, NULL, NULL
  );

  CREATE TRIGGER reject_subtask_batch_fixture
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.flowstate_test_reject_subtask_batch_fixture();

  BEGIN
    v_result := public.flowstate_subtask_batch_v1(
      'subtask-breakdown-rollback', 'task-v1', 'local-api',
      '1fc30000-0000-4000-8000-000000000103', v_revision,
      '[{"kind":"create","clientId":"rollback-step","title":"Rollback step","doneEnough":"Never persists","estimateMinutes":10,"order":0}]',
      false, v_preview->>'previewDigest',
      (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_result := jsonb_build_object('error', jsonb_build_object('code', 'injected_exception'));
  END;

  DROP TRIGGER reject_subtask_batch_fixture ON public.tasks;

  IF v_result #>> '{error,code}' NOT IN ('internal_error', 'injected_exception')
     OR (SELECT subtasks FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000103') IS DISTINCT FROM v_before_subtasks
     OR (SELECT canonical_revision FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000103') <> v_revision
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE operation_id = 'subtask-breakdown-rollback' AND state = 'committed'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_change_log
       WHERE operation_id = 'subtask-breakdown-rollback'
     ) THEN
    RAISE EXCEPTION 'FAIL: injected subtask failure left partial canonical state: %', v_result;
  END IF;
END;
$$;

-- The authenticated renderer uses the same authority with a distinct source.
DO $$
DECLARE
  v_revision bigint;
  v_preview jsonb;
BEGIN
  SELECT canonical_revision INTO v_revision
  FROM public.tasks WHERE id = '1fc30000-0000-4000-8000-000000000101';
  v_preview := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-web-preview', 'task-v1', 'web-pwa',
    '1fc30000-0000-4000-8000-000000000101', v_revision,
    '[{"kind":"update","subtaskId":"existing-step","title":"Renderer-safe title"}]',
    true, NULL, NULL, NULL, NULL
  );
  IF v_preview->>'ok' IS DISTINCT FROM 'true'
     OR v_preview->>'result' IS DISTINCT FROM 'preview'
     OR v_preview #>> '{normalizedPayload,operations,0,title}'
          IS DISTINCT FROM 'Renderer-safe title' THEN
    RAISE EXCEPTION 'FAIL: signed renderer source could not use canonical subtask preview: %', v_preview;
  END IF;
END;
$$;

ROLLBACK;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tasks WHERE id::text LIKE '1fc30000-0000-4000-8000-%'
  ) OR EXISTS (
    SELECT 1 FROM auth.users WHERE id::text LIKE '1fc30000-0000-4000-8000-%'
  ) THEN
    RAISE EXCEPTION 'FAIL: TASK-1963 disposable fixtures survived rollback';
  END IF;
  RAISE NOTICE 'TASK-1963 canonical subtask batch rollback-only contract passed';
END;
$$;
