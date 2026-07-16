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
    '[{"id":"existing-step","clientId":"existing-client","parentTaskId":"1fc30000-0000-4000-8000-000000000101","order":0,"title":"Collect source material","doneEnough":"Links are in one note","estimateMinutes":15,"isCompleted":false},{"id":"obsolete-step","parentTaskId":"1fc30000-0000-4000-8000-000000000101","order":1,"title":"Obsolete step","isCompleted":false}]',
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
  ),
  (
    '1fc30000-0000-4000-8000-000000000104',
    '1fc30000-0000-4000-8000-000000000001',
    'Malformed legacy breakdown fixture', 'planned', NULL, false, '[]',
    '[{"id":"legacy-step","parentTaskId":"1fc30000-0000-4000-8000-000000000104","order":0,"title":"Legacy step","isCompleted":false,"legacyMarker":"must-not-be-canonicalized"}]',
    true, NULL
  ),
  (
    '1fc30000-0000-4000-8000-000000000105',
    '1fc30000-0000-4000-8000-000000000001',
    'Wrong parent provenance fixture', 'planned', NULL, false, '[]',
    '[{"id":"wrong-parent-step","parentTaskId":"1fc30000-0000-4000-8000-000000000999","order":0,"title":"Wrong parent","isCompleted":false}]',
    true, NULL
  ),
  (
    '1fc30000-0000-4000-8000-000000000106',
    '1fc30000-0000-4000-8000-000000000001',
    'Duplicate client provenance fixture', 'planned', NULL, false, '[]',
    '[{"id":"client-step-one","clientId":"same-client","order":0,"title":"First","isCompleted":false},{"id":"client-step-two","clientId":"same-client","order":1,"title":"Second","isCompleted":false}]',
    true, NULL
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

-- The private validator matches the exact-read row contract, including shape,
-- identity uniqueness, ordering, optional types, and timezone-aware timestamps.
DO $$
BEGIN
  IF public.flowstate_h5_valid_subtasks('{}'::jsonb, 'parent')
     OR public.flowstate_h5_valid_subtasks(
       '[{"id":"same","title":"One","order":0},{"id":"same","title":"Two","order":1}]', 'parent'
     )
     OR public.flowstate_h5_valid_subtasks(
       '[{"id":"wrong-order","title":"Wrong order","order":1}]', 'parent'
     )
     OR public.flowstate_h5_valid_subtasks(
       '[{"id":"bad-estimate","title":"Bad estimate","order":0,"estimateMinutes":"20"}]', 'parent'
     )
     OR public.flowstate_h5_valid_subtasks(
       '[{"id":"bad-time","title":"Bad time","order":0,"createdAt":"2026-07-16T08:00:00"}]', 'parent'
     )
     OR public.flowstate_h5_valid_subtasks(
       '[{"id":"unknown","title":"Unknown","order":0,"legacyMarker":true}]', 'parent'
     )
     OR public.flowstate_h5_valid_subtasks(
       '[{"id":"wrong-parent","parentTaskId":"other","title":"Wrong parent","order":0}]', 'parent'
     )
     OR public.flowstate_h5_valid_subtasks(
       '[{"id":"one","clientId":"same-client","title":"One","order":0},{"id":"two","clientId":"same-client","title":"Two","order":1}]', 'parent'
     )
     OR NOT public.flowstate_h5_valid_subtasks(
       '[{"id":"valid","clientId":"client","parentTaskId":"parent","title":"Valid","description":"","isCompleted":false,"doneEnough":null,"estimateMinutes":20,"completedPomodoros":1,"canvasPosition":{"x":1.5,"y":-2},"createdAt":"2026-07-16T08:00:00.000Z","updatedAt":"2026-07-16T10:00:00+02:00","order":0}]', 'parent'
     )
     OR NOT public.flowstate_h5_valid_subtasks(
       '[{"id":"legacy-no-parent","clientId":"legacy-client","title":"Legacy without parentTaskId","order":0}]', 'parent'
     ) THEN
    RAISE EXCEPTION 'FAIL: canonical existing-subtask validator accepted malformed rows or rejected the exact shape';
  END IF;
END;
$$;

-- Provenance corruption is rejected by the real RPC, not only its private
-- validator, and produces no approval or canonical mutation evidence.
DO $$
DECLARE
  v_before_previews bigint;
  v_before_operations bigint;
  v_before_changes bigint;
  v_task_id text;
  v_revision bigint;
  v_subtasks jsonb;
  v_result jsonb;
BEGIN
  SELECT count(*) INTO v_before_previews FROM public.canonical_operation_previews;
  SELECT count(*) INTO v_before_operations FROM public.canonical_operations;
  SELECT count(*) INTO v_before_changes FROM public.canonical_change_log;

  FOREACH v_task_id IN ARRAY ARRAY[
    '1fc30000-0000-4000-8000-000000000105',
    '1fc30000-0000-4000-8000-000000000106'
  ] LOOP
    SELECT canonical_revision, subtasks INTO v_revision, v_subtasks
    FROM public.tasks WHERE id::text = v_task_id;

    v_result := public.flowstate_subtask_batch_v1(
      'subtask-provenance-' || v_task_id, 'task-v1', 'local-api',
      v_task_id, v_revision,
      '[{"kind":"create","clientId":"new-step","title":"New step"}]',
      true, NULL, NULL, NULL, NULL
    );

    IF v_result #>> '{error,code}' IS DISTINCT FROM 'invalid_existing_subtasks'
       OR v_result->>'result' IS DISTINCT FROM 'conflict'
       OR (SELECT canonical_revision FROM public.tasks WHERE id::text = v_task_id) <> v_revision
       OR (SELECT subtasks FROM public.tasks WHERE id::text = v_task_id) IS DISTINCT FROM v_subtasks THEN
      RAISE EXCEPTION 'FAIL: malformed provenance did not fail closed for %: %',
        v_task_id, v_result;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM public.canonical_operation_previews) <> v_before_previews
     OR (SELECT count(*) FROM public.canonical_operations) <> v_before_operations
     OR (SELECT count(*) FROM public.canonical_change_log) <> v_before_changes THEN
    RAISE EXCEPTION 'FAIL: malformed provenance wrote preview or canonical evidence';
  END IF;
END;
$$;

-- A create clientId is stable provenance and cannot be reused by another
-- operation against an existing canonical row. Rejection writes no evidence.
DO $$
DECLARE
  v_revision bigint;
  v_before_subtasks jsonb;
  v_before_previews bigint;
  v_before_operations bigint;
  v_before_changes bigint;
  v_result jsonb;
BEGIN
  SELECT canonical_revision, subtasks INTO v_revision, v_before_subtasks
  FROM public.tasks WHERE id = '1fc30000-0000-4000-8000-000000000101';
  SELECT count(*) INTO v_before_previews FROM public.canonical_operation_previews;
  SELECT count(*) INTO v_before_operations FROM public.canonical_operations;
  SELECT count(*) INTO v_before_changes FROM public.canonical_change_log;

  v_result := public.flowstate_subtask_batch_v1(
    'subtask-existing-client-collision', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000101', v_revision,
    '[{"kind":"create","clientId":"existing-client","title":"Duplicate provenance"}]',
    true, NULL, NULL, NULL, NULL
  );

  IF v_result #>> '{error,code}' IS DISTINCT FROM 'client_id_conflict'
     OR v_result->>'result' IS DISTINCT FROM 'conflict'
     OR (SELECT canonical_revision FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> v_revision
     OR (SELECT subtasks FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') IS DISTINCT FROM v_before_subtasks
     OR (SELECT count(*) FROM public.canonical_operation_previews) <> v_before_previews
     OR (SELECT count(*) FROM public.canonical_operations) <> v_before_operations
     OR (SELECT count(*) FROM public.canonical_change_log) <> v_before_changes THEN
    RAISE EXCEPTION 'FAIL: existing clientId collision did not fail closed: %', v_result;
  END IF;
END;
$$;

-- Existing malformed rows are not silently stripped or preserved as canonical.
-- Both preview and apply fail closed before durable evidence or task state changes.
DO $$
DECLARE
  v_revision bigint;
  v_before_subtasks jsonb;
  v_before_previews bigint;
  v_before_operations bigint;
  v_before_changes bigint;
  v_preview_result jsonb;
  v_apply_result jsonb;
BEGIN
  SELECT canonical_revision, subtasks INTO v_revision, v_before_subtasks
  FROM public.tasks WHERE id = '1fc30000-0000-4000-8000-000000000104';
  SELECT count(*) INTO v_before_previews FROM public.canonical_operation_previews;
  SELECT count(*) INTO v_before_operations FROM public.canonical_operations;
  SELECT count(*) INTO v_before_changes FROM public.canonical_change_log;

  v_preview_result := public.flowstate_subtask_batch_v1(
    'subtask-malformed-existing-preview', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000104', v_revision,
    '[{"kind":"create","clientId":"new-step","title":"New step"}]',
    true, NULL, NULL, NULL, NULL
  );
  v_apply_result := public.flowstate_subtask_batch_v1(
    'subtask-malformed-existing-apply', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000104', v_revision,
    '[{"kind":"create","clientId":"new-step","title":"New step"}]',
    false, repeat('b', 64), clock_timestamp() + interval '15 minutes',
    NULL, repeat('a', 64)
  );

  IF v_preview_result #>> '{error,code}' IS DISTINCT FROM 'invalid_existing_subtasks'
     OR v_preview_result->>'result' IS DISTINCT FROM 'conflict'
     OR v_apply_result #>> '{error,code}' IS DISTINCT FROM 'invalid_existing_subtasks'
     OR v_apply_result->>'result' IS DISTINCT FROM 'conflict'
     OR (SELECT canonical_revision FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000104') <> v_revision
     OR (SELECT subtasks FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000104') IS DISTINCT FROM v_before_subtasks
     OR (SELECT count(*) FROM public.canonical_operation_previews) <> v_before_previews
     OR (SELECT count(*) FROM public.canonical_operations) <> v_before_operations
     OR (SELECT count(*) FROM public.canonical_change_log) <> v_before_changes THEN
    RAISE EXCEPTION 'FAIL: malformed existing subtasks did not fail closed: preview=%, apply=%',
      v_preview_result, v_apply_result;
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

-- Duplicate client/target identities are rejected before preview state exists.
DO $$
DECLARE
  v_revision bigint;
  v_result jsonb;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc30000-0000-4000-8000-000000000103';

  v_result := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-duplicate-client', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000103', v_revision,
    '[
      {"kind":"create","clientId":"same-step","title":"First step"},
      {"kind":"create","clientId":"same-step","title":"Second step"}
    ]',
    true, NULL, NULL, NULL, NULL
  );
  IF v_result #>> '{error,code}' <> 'invalid_operations'
     OR EXISTS (
       SELECT 1 FROM public.canonical_operation_previews
       WHERE operation_id = 'subtask-breakdown-duplicate-client'
     ) THEN
    RAISE EXCEPTION 'FAIL: duplicate subtask identity reached preview state: %', v_result;
  END IF;

  v_result := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-duplicate-target', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000101',
    (SELECT canonical_revision FROM public.tasks
     WHERE id = '1fc30000-0000-4000-8000-000000000101'),
    '[
      {"kind":"update","subtaskId":"existing-step","title":"First edit"},
      {"kind":"update","subtaskId":"existing-step","title":"Second edit"}
    ]',
    true, NULL, NULL, NULL, NULL
  );
  IF v_result #>> '{error,code}' <> 'invalid_operations'
     OR EXISTS (
       SELECT 1 FROM public.canonical_operation_previews
       WHERE operation_id = 'subtask-breakdown-duplicate-target'
     ) THEN
    RAISE EXCEPTION 'FAIL: duplicate subtask target reached preview state: %', v_result;
  END IF;
END;
$$;

-- Text that the exact canonical reader cannot safely return is rejected before
-- preview state, task state, or a durable operation receipt can be created.
DO $$
DECLARE
  v_revision bigint;
  v_before_subtasks jsonb;
  v_before_previews bigint;
  v_before_operations bigint;
  v_before_changes bigint;
  v_case jsonb;
  v_result jsonb;
BEGIN
  SELECT canonical_revision, subtasks INTO v_revision, v_before_subtasks
  FROM public.tasks WHERE id = '1fc30000-0000-4000-8000-000000000101';
  SELECT count(*) INTO v_before_previews FROM public.canonical_operation_previews;
  SELECT count(*) INTO v_before_operations FROM public.canonical_operations;
  SELECT count(*) INTO v_before_changes FROM public.canonical_change_log;

  FOR v_case IN
    SELECT item.value
    FROM jsonb_array_elements(jsonb_build_array(
      jsonb_build_object(
        'operationId', 'subtask-over-limit-create-title',
        'operations', jsonb_build_array(jsonb_build_object(
          'kind', 'create', 'clientId', 'long-create-title', 'title', repeat('x', 501)
        ))
      ),
      jsonb_build_object(
        'operationId', 'subtask-over-limit-update-title',
        'operations', jsonb_build_array(jsonb_build_object(
          'kind', 'update', 'subtaskId', 'existing-step', 'title', repeat('x', 501)
        ))
      ),
      jsonb_build_object(
        'operationId', 'subtask-over-limit-create-description',
        'operations', jsonb_build_array(jsonb_build_object(
          'kind', 'create', 'clientId', 'long-create-description', 'title', 'Step',
          'description', repeat('x', 10001)
        ))
      ),
      jsonb_build_object(
        'operationId', 'subtask-over-limit-update-description',
        'operations', jsonb_build_array(jsonb_build_object(
          'kind', 'update', 'subtaskId', 'existing-step', 'description', repeat('x', 10001)
        ))
      ),
      jsonb_build_object(
        'operationId', 'subtask-over-limit-create-done-enough',
        'operations', jsonb_build_array(jsonb_build_object(
          'kind', 'create', 'clientId', 'long-create-done-enough', 'title', 'Step',
          'doneEnough', repeat('x', 2001)
        ))
      ),
      jsonb_build_object(
        'operationId', 'subtask-over-limit-update-done-enough',
        'operations', jsonb_build_array(jsonb_build_object(
          'kind', 'update', 'subtaskId', 'existing-step', 'doneEnough', repeat('x', 2001)
        ))
      )
    )) AS item(value)
  LOOP
    v_result := public.flowstate_subtask_batch_v1(
      v_case->>'operationId', 'task-v1', 'local-api',
      '1fc30000-0000-4000-8000-000000000101', v_revision,
      v_case->'operations', true, NULL, NULL, NULL, NULL
    );
    IF v_result #>> '{error,code}' IS DISTINCT FROM 'invalid_operations' THEN
      RAISE EXCEPTION 'FAIL: over-limit subtask text reached preview state: %', v_result;
    END IF;
  END LOOP;

  IF (SELECT canonical_revision FROM public.tasks
      WHERE id = '1fc30000-0000-4000-8000-000000000101') <> v_revision
     OR (SELECT subtasks FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') IS DISTINCT FROM v_before_subtasks
     OR (SELECT count(*) FROM public.canonical_operation_previews) <> v_before_previews
     OR (SELECT count(*) FROM public.canonical_operations) <> v_before_operations
     OR (SELECT count(*) FROM public.canonical_change_log) <> v_before_changes THEN
    RAISE EXCEPTION 'FAIL: rejected over-limit subtask text changed canonical state or receipts: %',
      jsonb_build_object(
        'revisionBefore', v_revision,
        'revisionAfter', (SELECT canonical_revision FROM public.tasks
                          WHERE id = '1fc30000-0000-4000-8000-000000000101'),
        'subtasksChanged', (SELECT subtasks FROM public.tasks
                            WHERE id = '1fc30000-0000-4000-8000-000000000101')
                           IS DISTINCT FROM v_before_subtasks,
        'previewsBefore', v_before_previews,
        'previewsAfter', (SELECT count(*) FROM public.canonical_operation_previews),
        'operationsBefore', v_before_operations,
        'operationsAfter', (SELECT count(*) FROM public.canonical_operations),
        'changesBefore', v_before_changes,
        'changesAfter', (SELECT count(*) FROM public.canonical_change_log)
      );
  END IF;
END;
$$;

-- An expired approval fails closed without consuming the preview or writing.
DO $$
DECLARE
  v_revision bigint;
  v_before_subtasks jsonb;
  v_preview jsonb;
  v_expired_at timestamptz;
  v_result jsonb;
BEGIN
  SELECT canonical_revision, subtasks INTO v_revision, v_before_subtasks
  FROM public.tasks WHERE id = '1fc30000-0000-4000-8000-000000000103';
  v_preview := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-expired', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000103', v_revision,
    '[{"kind":"create","clientId":"expired-step","title":"Expired step"}]',
    true, NULL, NULL, NULL, NULL
  );
  v_expired_at := clock_timestamp() - interval '1 second';
  UPDATE public.canonical_operation_previews
  SET expires_at = v_expired_at
  WHERE user_id = '1fc30000-0000-4000-8000-000000000001'
    AND operation_id = 'subtask-breakdown-expired';

  v_result := public.flowstate_subtask_batch_v1(
    'subtask-breakdown-expired', 'task-v1', 'local-api',
    '1fc30000-0000-4000-8000-000000000103', v_revision,
    '[{"kind":"create","clientId":"expired-step","title":"Expired step"}]',
    false, v_preview->>'previewDigest', v_expired_at, NULL, v_preview->>'requestHash'
  );
  IF v_result #>> '{error,code}' <> 'preview_expired'
     OR (SELECT subtasks FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000103') IS DISTINCT FROM v_before_subtasks
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE operation_id = 'subtask-breakdown-expired'
     )
     OR (SELECT consumed_at FROM public.canonical_operation_previews
         WHERE user_id = '1fc30000-0000-4000-8000-000000000001'
           AND operation_id = 'subtask-breakdown-expired') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: expired subtask approval did not fail closed: %', v_result;
  END IF;
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
     OR (SELECT subtasks #>> '{1,clientId}' FROM public.tasks
         WHERE id = '1fc30000-0000-4000-8000-000000000101') <> 'outline-step'
     OR (SELECT count(*) FROM public.canonical_change_log
         WHERE operation_id = 'subtask-breakdown-main') <> 1 THEN
    RAISE EXCEPTION 'FAIL: subtask apply was partial or completed the parent: %', v_apply;
  END IF;

  -- Model a lost HTTP response followed by a delayed retry. A committed
  -- operation must replay before the now-expired/consumed preview is checked.
  UPDATE public.canonical_operation_previews
  SET expires_at = clock_timestamp() - interval '1 second'
  WHERE user_id = '1fc30000-0000-4000-8000-000000000001'
    AND operation_id = 'subtask-breakdown-main';

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
