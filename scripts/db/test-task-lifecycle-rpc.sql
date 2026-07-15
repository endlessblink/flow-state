-- TASK-1962: canonical create/delete/restore/reopen lifecycle contract.
--
-- This file is intentionally a RED contract until
-- 20260715040000_canonical_task_lifecycle.sql implements the single
-- flowstate_task_lifecycle_v1 RPC family. Every fixture and injected failure
-- is transaction-owned and rolled back.

BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
  (
    '1fc20000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'lifecycle-owner@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    '1fc20000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'lifecycle-viewer@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    '1fc20000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'lifecycle-outsider@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  );

INSERT INTO public.workspaces (id, name, owner_id)
VALUES (
  '1fc20000-0000-4000-8000-000000000010',
  'Lifecycle contract workspace',
  '1fc20000-0000-4000-8000-000000000001'
);

INSERT INTO public.workspace_members (id, workspace_id, user_id, role)
VALUES (
  '1fc20000-0000-4000-8000-000000000011',
  '1fc20000-0000-4000-8000-000000000010',
  '1fc20000-0000-4000-8000-000000000002',
  'viewer'
);

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, completed_at, instances, subtasks,
  is_in_inbox, workspace_id, recurrence_rule
) VALUES
  (
    '1fc20000-0000-4000-8000-000000000101',
    '1fc20000-0000-4000-8000-000000000001',
    'Lifecycle delete fixture', 'planned', false, NULL, '[]', '[]', true, NULL, NULL
  ),
  (
    '1fc20000-0000-4000-8000-000000000102',
    '1fc20000-0000-4000-8000-000000000001',
    'Lifecycle reopen fixture', 'done', false, clock_timestamp(), '[]', '[]', true, NULL, NULL
  ),
  (
    '1fc20000-0000-4000-8000-000000000103',
    '1fc20000-0000-4000-8000-000000000001',
    'Lifecycle recurring fixture', 'done', false, clock_timestamp(), '[]', '[]', true, NULL,
    '{"frequency":"daily","interval":1}'
  ),
  (
    '1fc20000-0000-4000-8000-000000000104',
    '1fc20000-0000-4000-8000-000000000003',
    'Lifecycle other-person fixture', 'planned', false, NULL, '[]', '[]', true, NULL, NULL
  ),
  (
    '1fc20000-0000-4000-8000-000000000105',
    '1fc20000-0000-4000-8000-000000000001',
    'Lifecycle workspace fixture', 'planned', false, NULL, '[]', '[]', true,
    '1fc20000-0000-4000-8000-000000000010', NULL
  ),
  (
    '1fc20000-0000-4000-8000-000000000106',
    '1fc20000-0000-4000-8000-000000000001',
    'Lifecycle rollback fixture', 'planned', false, NULL, '[]', '[]', true, NULL, NULL
  ),
  (
    '1fc20000-0000-4000-8000-000000000107',
    '1fc20000-0000-4000-8000-000000000001',
    'Lifecycle deleted recurrence fixture', 'planned', true, NULL, '[]', '[]', true, NULL, NULL
  ),
  (
    '1fc20000-0000-4000-8000-000000000108',
    '1fc20000-0000-4000-8000-000000000001',
    'Lifecycle active recurrence fixture', 'planned', false, NULL, '[]', '[]', true, NULL, NULL
  );

UPDATE public.tasks
SET recurrence_parent_id = '1fc20000-0000-4000-8000-000000000103',
    recurrence_count = 1,
    deleted_at = CASE WHEN id = '1fc20000-0000-4000-8000-000000000107'
      THEN clock_timestamp() ELSE NULL END
WHERE id IN (
  '1fc20000-0000-4000-8000-000000000107',
  '1fc20000-0000-4000-8000-000000000108'
);

SELECT set_config('request.jwt.claim.sub', '1fc20000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"1fc20000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE lifecycle_results (
  key text PRIMARY KEY,
  payload jsonb NOT NULL
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.assert_lifecycle_preview(
  p_preview jsonb,
  p_operation_id text,
  p_action text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_preview->>'ok' IS DISTINCT FROM 'true'
     OR p_preview->>'result' IS DISTINCT FROM 'preview'
     OR p_preview->>'contractVersion' IS DISTINCT FROM 'task-v1'
     OR p_preview->>'operationId' IS DISTINCT FROM p_operation_id
     OR p_preview->>'action' IS DISTINCT FROM p_action
     OR nullif(p_preview->>'taskId', '') IS NULL
     OR nullif(p_preview->>'previewDigest', '') IS NULL
     OR (p_preview->>'previewExpiresAt')::timestamptz <= clock_timestamp()
     OR p_preview->>'requestHash' !~ '^[0-9a-f]{64}$'
     OR p_preview->'normalizedPayload' IS NULL THEN
    RAISE EXCEPTION 'FAIL: invalid % lifecycle preview: %', p_action, p_preview;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_lifecycle_receipt(
  p_envelope jsonb,
  p_status text,
  p_operation_id text,
  p_action text,
  p_task_id text
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
     OR p_envelope->>'requestHash' !~ '^[0-9a-f]{64}$'
     OR v_receipt->>'status' IS DISTINCT FROM p_status
     OR v_receipt->>'operationId' IS DISTINCT FROM p_operation_id
     OR v_receipt->>'requestHash' IS DISTINCT FROM p_envelope->>'requestHash'
     OR v_receipt->>'contractVersion' IS DISTINCT FROM 'task-v1'
     OR v_receipt->>'action' IS DISTINCT FROM p_action
     OR v_receipt->>'entityType' IS DISTINCT FROM 'task'
     OR v_receipt->>'entityId' IS DISTINCT FROM p_task_id
     OR (v_receipt->>'canonicalRevision')::bigint < 1
     OR (v_receipt->>'changeSequence')::bigint < 1
     OR (v_receipt->>'committedAt')::timestamptz IS NULL
     OR (v_receipt->>'replayed')::boolean IS DISTINCT FROM (p_status = 'replayed')
     OR jsonb_array_length(v_receipt->'affected') <> 1
     OR v_receipt #>> '{affected,0,entityId}' IS DISTINCT FROM p_task_id
     OR v_receipt #>> '{affected,0,canonicalRevision}'
          IS DISTINCT FROM v_receipt->>'canonicalRevision'
     OR v_receipt #>> '{affected,0,changeSequence}'
          IS DISTINCT FROM v_receipt->>'changeSequence'
     OR v_receipt #>> '{readBack,id}' IS DISTINCT FROM p_task_id
     OR v_receipt->>'readBackHash' IS DISTINCT FROM pg_catalog.encode(
       extensions.digest(pg_catalog.convert_to(
         public.flowstate_canonical_json_text_v1(v_receipt->'readBack'), 'UTF8'
       ), 'sha256'), 'hex'
     ) THEN
    RAISE EXCEPTION 'FAIL: invalid % lifecycle receipt: %', p_action, p_envelope;
  END IF;
END;
$$;

-- CREATE: repeated preview is zero-write and binds one deterministic ID.
DO $$
DECLARE
  v_preview jsonb;
  v_preview_again jsonb;
  v_apply jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_task_id text;
  v_task_count bigint;
  v_operation_count bigint;
  v_change_count bigint;
BEGIN
  SELECT count(*) INTO v_task_count FROM public.tasks;
  SELECT count(*) INTO v_operation_count FROM public.canonical_operations;
  SELECT count(*) INTO v_change_count FROM public.canonical_change_log;

  v_preview := public.flowstate_task_lifecycle_v1(
    'lifecycle-create', 'task-v1', 'local-api', 'create', NULL, 0,
    '{"title":"  Stable lifecycle task  ","status":"planned","priority":"high","isInInbox":true}',
    true, NULL, NULL, NULL, NULL
  );
  v_preview_again := public.flowstate_task_lifecycle_v1(
    'lifecycle-create', 'task-v1', 'local-api', 'create', NULL, 0,
    '{"title":"  Stable lifecycle task  ","status":"planned","priority":"high","isInInbox":true}',
    true, NULL, NULL, NULL, NULL
  );
  PERFORM pg_temp.assert_lifecycle_preview(v_preview, 'lifecycle-create', 'create');
  PERFORM pg_temp.assert_lifecycle_preview(v_preview_again, 'lifecycle-create', 'create');
  v_task_id := v_preview->>'taskId';

  IF v_task_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     OR v_preview_again->>'taskId' IS DISTINCT FROM v_task_id
     OR v_preview_again->>'previewDigest' IS DISTINCT FROM v_preview->>'previewDigest'
     OR v_preview #>> '{normalizedPayload,title}' IS DISTINCT FROM 'Stable lifecycle task'
     OR (SELECT count(*) FROM public.tasks) <> v_task_count
     OR (SELECT count(*) FROM public.canonical_operations) <> v_operation_count
     OR (SELECT count(*) FROM public.canonical_change_log) <> v_change_count
     OR EXISTS (SELECT 1 FROM public.tasks WHERE id::text = v_task_id) THEN
    RAISE EXCEPTION 'FAIL: create preview was not deterministic and zero-write: % / %',
      v_preview, v_preview_again;
  END IF;

  v_apply := public.flowstate_task_lifecycle_v1(
    'lifecycle-create', 'task-v1', 'local-api', 'create', v_task_id, 0,
    '{"title":"  Stable lifecycle task  ","status":"planned","priority":"high","isInInbox":true}',
    false, v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz,
    NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_lifecycle_receipt(
    v_apply, 'committed', 'lifecycle-create', 'create', v_task_id
  );
  IF NOT EXISTS (
       SELECT 1 FROM public.tasks
       WHERE id::text = v_task_id
         AND user_id = '1fc20000-0000-4000-8000-000000000001'
         AND workspace_id IS NULL
         AND title = 'Stable lifecycle task'
         AND status = 'planned'
         AND is_deleted = false
     ) THEN
    RAISE EXCEPTION 'FAIL: create apply did not write the bound canonical row: %', v_apply;
  END IF;

  v_replay := public.flowstate_task_lifecycle_v1(
    'lifecycle-create', 'task-v1', 'local-api', 'create', v_task_id, 0,
    '{"title":"  Stable lifecycle task  ","status":"planned","priority":"high","isInInbox":true}',
    false, v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz,
    NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_lifecycle_receipt(
    v_replay, 'replayed', 'lifecycle-create', 'create', v_task_id
  );
  IF v_replay #>> '{receipt,readBackHash}'
       IS DISTINCT FROM v_apply #>> '{receipt,readBackHash}'
     OR (SELECT count(*) FROM public.canonical_change_log WHERE operation_id = 'lifecycle-create') <> 1 THEN
    RAISE EXCEPTION 'FAIL: create response-loss replay changed state or evidence';
  END IF;

  v_conflict := public.flowstate_task_lifecycle_v1(
    'lifecycle-create', 'task-v1', 'local-api', 'create', v_task_id, 0,
    '{"title":"Altered lifecycle task","status":"planned","priority":"high","isInInbox":true}',
    false, v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz,
    NULL, v_preview->>'requestHash'
  );
  IF v_conflict #>> '{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'FAIL: altered create replay did not conflict: %', v_conflict;
  END IF;
END;
$$;

-- DELETE: stale revisions fail; apply writes one symmetric tombstone.
DO $$
DECLARE
  v_stale_revision bigint;
  v_revision bigint;
  v_stale jsonb;
  v_preview jsonb;
  v_apply jsonb;
BEGIN
  SELECT canonical_revision INTO v_stale_revision FROM public.tasks
  WHERE id = '1fc20000-0000-4000-8000-000000000101';
  UPDATE public.tasks SET planning_notes = '[{"type":"note","content":"advance revision"}]'
  WHERE id = '1fc20000-0000-4000-8000-000000000101';
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc20000-0000-4000-8000-000000000101';

  v_stale := public.flowstate_task_lifecycle_v1(
    'lifecycle-delete-stale', 'task-v1', 'local-api', 'delete',
    '1fc20000-0000-4000-8000-000000000101', v_stale_revision,
    '{}'::jsonb, true, NULL, NULL, NULL, NULL
  );
  IF v_stale #>> '{error,code}' <> 'stale_revision' THEN
    RAISE EXCEPTION 'FAIL: stale delete revision was accepted: %', v_stale;
  END IF;

  v_preview := public.flowstate_task_lifecycle_v1(
    'lifecycle-delete', 'task-v1', 'local-api', 'delete',
    '1fc20000-0000-4000-8000-000000000101', v_revision,
    '{}'::jsonb, true, NULL, NULL, NULL, NULL
  );
  PERFORM pg_temp.assert_lifecycle_preview(v_preview, 'lifecycle-delete', 'delete');
  IF (SELECT is_deleted FROM public.tasks WHERE id = '1fc20000-0000-4000-8000-000000000101')
     OR EXISTS (
       SELECT 1 FROM public.tombstones
       WHERE entity_type = 'task' AND entity_id = '1fc20000-0000-4000-8000-000000000101'
     ) THEN
    RAISE EXCEPTION 'FAIL: delete preview mutated task or tombstone';
  END IF;

  v_apply := public.flowstate_task_lifecycle_v1(
    'lifecycle-delete', 'task-v1', 'local-api', 'delete',
    '1fc20000-0000-4000-8000-000000000101', v_revision,
    '{}'::jsonb, false, v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_lifecycle_receipt(
    v_apply, 'committed', 'lifecycle-delete', 'delete',
    '1fc20000-0000-4000-8000-000000000101'
  );
  IF (v_apply #>> '{receipt,readBack,isDeleted}')::boolean IS DISTINCT FROM true
     OR NOT (SELECT is_deleted FROM public.tasks WHERE id = '1fc20000-0000-4000-8000-000000000101')
     OR (SELECT count(*) FROM public.tombstones
         WHERE user_id = '1fc20000-0000-4000-8000-000000000001'
           AND entity_type = 'task'
           AND entity_id = '1fc20000-0000-4000-8000-000000000101') <> 1 THEN
    RAISE EXCEPTION 'FAIL: delete did not preserve tombstone symmetry: %', v_apply;
  END IF;
END;
$$;

-- RESTORE CONFLICT: a deleted recurrence identity cannot displace its living peer.
DO $$
DECLARE
  v_revision bigint;
  v_preview jsonb;
  v_conflict jsonb;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc20000-0000-4000-8000-000000000107';
  v_preview := public.flowstate_task_lifecycle_v1(
    'lifecycle-restore-conflict', 'task-v1', 'local-api', 'restore',
    '1fc20000-0000-4000-8000-000000000107', v_revision,
    '{}'::jsonb, true, NULL, NULL, NULL, NULL
  );
  PERFORM pg_temp.assert_lifecycle_preview(
    v_preview, 'lifecycle-restore-conflict', 'restore'
  );
  v_conflict := public.flowstate_task_lifecycle_v1(
    'lifecycle-restore-conflict', 'task-v1', 'local-api', 'restore',
    '1fc20000-0000-4000-8000-000000000107', v_revision,
    '{}'::jsonb, false, v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
  );
  IF v_conflict #>> '{error,code}' <> 'restore_conflict'
     OR NOT (SELECT is_deleted FROM public.tasks
             WHERE id = '1fc20000-0000-4000-8000-000000000107') THEN
    RAISE EXCEPTION 'FAIL: restore recurrence conflict was not atomic: %', v_conflict;
  END IF;
END;
$$;

-- RESTORE: uses the deleted row's current revision and removes its tombstone.
DO $$
DECLARE
  v_revision bigint;
  v_preview jsonb;
  v_apply jsonb;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc20000-0000-4000-8000-000000000101';
  v_preview := public.flowstate_task_lifecycle_v1(
    'lifecycle-restore', 'task-v1', 'local-api', 'restore',
    '1fc20000-0000-4000-8000-000000000101', v_revision,
    '{}'::jsonb, true, NULL, NULL, NULL, NULL
  );
  PERFORM pg_temp.assert_lifecycle_preview(v_preview, 'lifecycle-restore', 'restore');
  v_apply := public.flowstate_task_lifecycle_v1(
    'lifecycle-restore', 'task-v1', 'local-api', 'restore',
    '1fc20000-0000-4000-8000-000000000101', v_revision,
    '{}'::jsonb, false, v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_lifecycle_receipt(
    v_apply, 'committed', 'lifecycle-restore', 'restore',
    '1fc20000-0000-4000-8000-000000000101'
  );
  IF (v_apply #>> '{receipt,readBack,isDeleted}')::boolean IS DISTINCT FROM false
     OR (SELECT is_deleted FROM public.tasks WHERE id = '1fc20000-0000-4000-8000-000000000101')
     OR EXISTS (
       SELECT 1 FROM public.tombstones
       WHERE entity_type = 'task' AND entity_id = '1fc20000-0000-4000-8000-000000000101'
     ) THEN
    RAISE EXCEPTION 'FAIL: restore did not remove the tombstone: %', v_apply;
  END IF;
END;
$$;

-- REOPEN: clears completedAt for non-recurring tasks and rejects recurrence.
DO $$
DECLARE
  v_revision bigint;
  v_preview jsonb;
  v_apply jsonb;
  v_recurring jsonb;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc20000-0000-4000-8000-000000000102';
  v_preview := public.flowstate_task_lifecycle_v1(
    'lifecycle-reopen', 'task-v1', 'local-api', 'reopen',
    '1fc20000-0000-4000-8000-000000000102', v_revision,
    '{}'::jsonb, true, NULL, NULL, NULL, NULL
  );
  PERFORM pg_temp.assert_lifecycle_preview(v_preview, 'lifecycle-reopen', 'reopen');
  v_apply := public.flowstate_task_lifecycle_v1(
    'lifecycle-reopen', 'task-v1', 'local-api', 'reopen',
    '1fc20000-0000-4000-8000-000000000102', v_revision,
    '{}'::jsonb, false, v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_lifecycle_receipt(
    v_apply, 'committed', 'lifecycle-reopen', 'reopen',
    '1fc20000-0000-4000-8000-000000000102'
  );
  IF v_apply #>> '{receipt,readBack,status}' IS DISTINCT FROM 'todo'
     OR v_apply #> '{receipt,readBack,completedAt}' IS DISTINCT FROM 'null'::jsonb
     OR (SELECT status FROM public.tasks WHERE id = '1fc20000-0000-4000-8000-000000000102') <> 'planned'
     OR (SELECT completed_at FROM public.tasks WHERE id = '1fc20000-0000-4000-8000-000000000102') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: reopen did not clear completion state: %', v_apply;
  END IF;

  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc20000-0000-4000-8000-000000000103';
  v_recurring := public.flowstate_task_lifecycle_v1(
    'lifecycle-reopen-recurring', 'task-v1', 'local-api', 'reopen',
    '1fc20000-0000-4000-8000-000000000103', v_revision,
    '{}'::jsonb, true, NULL, NULL, NULL, NULL
  );
  IF v_recurring #>> '{error,code}' <> 'recurring_task' THEN
    RAISE EXCEPTION 'FAIL: recurring task reopen did not fail closed: %', v_recurring;
  END IF;
END;
$$;

-- Both personal and workspace scope checks deny callers without write authority.
DO $$
DECLARE
  v_personal jsonb;
  v_workspace jsonb;
  v_revision bigint;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc20000-0000-4000-8000-000000000104';
  v_personal := public.flowstate_task_lifecycle_v1(
    'lifecycle-personal-denied', 'task-v1', 'local-api', 'delete',
    '1fc20000-0000-4000-8000-000000000104', v_revision,
    '{}'::jsonb, true, NULL, NULL, NULL, NULL
  );
  IF v_personal #>> '{error,code}' NOT IN ('not_found', 'scope_denied') THEN
    RAISE EXCEPTION 'FAIL: cross-personal lifecycle request leaked authority: %', v_personal;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '1fc20000-0000-4000-8000-000000000002', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"1fc20000-0000-4000-8000-000000000002","role":"authenticated"}',
    true
  );
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc20000-0000-4000-8000-000000000105';
  v_workspace := public.flowstate_task_lifecycle_v1(
    'lifecycle-workspace-denied', 'task-v1', 'local-api', 'delete',
    '1fc20000-0000-4000-8000-000000000105', v_revision,
    '{}'::jsonb, true, NULL, NULL, '1fc20000-0000-4000-8000-000000000010', NULL
  );
  IF v_workspace #>> '{error,code}' <> 'scope_denied' THEN
    RAISE EXCEPTION 'FAIL: workspace viewer lifecycle request was accepted: %', v_workspace;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '1fc20000-0000-4000-8000-000000000001', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"1fc20000-0000-4000-8000-000000000001","role":"authenticated"}',
    true
  );
END;
$$;

-- An exception after the row mutation must roll back the row, tombstone,
-- operation ledger, and change event together.
CREATE OR REPLACE FUNCTION public.flowstate_test_reject_lifecycle_rollback_fixture()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id::text = '1fc20000-0000-4000-8000-000000000106' THEN
    RAISE EXCEPTION 'injected lifecycle mutation failure';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_revision bigint;
  v_preview jsonb;
  v_result jsonb;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = '1fc20000-0000-4000-8000-000000000106';
  v_preview := public.flowstate_task_lifecycle_v1(
    'lifecycle-injected-rollback', 'task-v1', 'local-api', 'delete',
    '1fc20000-0000-4000-8000-000000000106', v_revision,
    '{}'::jsonb, true, NULL, NULL, NULL, NULL
  );

  CREATE TRIGGER reject_lifecycle_rollback_fixture
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.flowstate_test_reject_lifecycle_rollback_fixture();

  BEGIN
    v_result := public.flowstate_task_lifecycle_v1(
      'lifecycle-injected-rollback', 'task-v1', 'local-api', 'delete',
      '1fc20000-0000-4000-8000-000000000106', v_revision,
      '{}'::jsonb, false, v_preview->>'previewDigest',
      (v_preview->>'previewExpiresAt')::timestamptz, NULL, v_preview->>'requestHash'
    );
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      v_result := jsonb_build_object('error', jsonb_build_object('code', 'injected_exception'));
  END;

  IF v_result #>> '{error,code}' NOT IN ('internal_error', 'injected_exception') THEN
    RAISE EXCEPTION 'FAIL: injected lifecycle failure was reported as success: %', v_result;
  END IF;

  DROP TRIGGER reject_lifecycle_rollback_fixture ON public.tasks;

  IF (SELECT is_deleted FROM public.tasks WHERE id = '1fc20000-0000-4000-8000-000000000106')
     OR (SELECT canonical_revision FROM public.tasks
         WHERE id = '1fc20000-0000-4000-8000-000000000106') <> v_revision
     OR EXISTS (
       SELECT 1 FROM public.tombstones
       WHERE entity_type = 'task' AND entity_id = '1fc20000-0000-4000-8000-000000000106'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE operation_id = 'lifecycle-injected-rollback' AND state = 'committed'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_change_log
       WHERE operation_id = 'lifecycle-injected-rollback'
     ) THEN
    RAISE EXCEPTION 'FAIL: injected lifecycle failure left partial canonical state';
  END IF;
END;
$$;

ROLLBACK;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE id::text LIKE '1fc20000-0000-4000-8000-%'
  ) OR EXISTS (
    SELECT 1 FROM public.canonical_operations
    WHERE operation_id LIKE 'lifecycle-%'
  ) THEN
    RAISE EXCEPTION 'FAIL: lifecycle disposable fixtures survived rollback';
  END IF;
  RAISE NOTICE 'TASK-1962 canonical lifecycle rollback-only contract passed';
END;
$$;
