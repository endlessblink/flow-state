-- Regression coverage for TASK-1944's canonical task mutation foundation.
-- Every fixture, compatibility-trigger event, and failure hook is rolled back.
--
-- Usage:
--   docker exec -i supabase-db psql -U postgres -v ON_ERROR_STOP=1 \
--     < scripts/db/test-canonical-task-contract.sql

BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
  (
    'ca110000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'canonical-owner@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'ca110000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'canonical-other@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  );

INSERT INTO public.workspaces (id, name, owner_id)
VALUES (
  'ca110000-0000-4000-8000-000000000010',
  'Canonical contract workspace',
  'ca110000-0000-4000-8000-000000000001'
);

INSERT INTO public.workspace_members (id, workspace_id, user_id, role)
VALUES (
  'ca110000-0000-4000-8000-000000000011',
  'ca110000-0000-4000-8000-000000000010',
  'ca110000-0000-4000-8000-000000000002',
  'member'
);

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, subtasks, is_in_inbox,
  workspace_id
) VALUES
  (
    'canonical-owned', 'ca110000-0000-4000-8000-000000000001',
    'Canonical owned fixture', 'planned', false, '[]', '[]', true, NULL
  ),
  (
    'canonical-other', 'ca110000-0000-4000-8000-000000000002',
    'Canonical other-user fixture', 'planned', false, '[]', '[]', true, NULL
  ),
  (
    'canonical-rollback', 'ca110000-0000-4000-8000-000000000001',
    'Canonical rollback fixture', 'planned', false, '[]', '[]', true, NULL
  ),
  (
    'canonical-shared', 'ca110000-0000-4000-8000-000000000001',
    'Canonical shared fixture', 'planned', false, '[]', '[]', true,
    'ca110000-0000-4000-8000-000000000010'
  ),
  (
    'canonical-soft-deleted', 'ca110000-0000-4000-8000-000000000001',
    'Canonical deleted fixture', 'planned', true, '[]', '[]', true, NULL
  ),
  (
    'canonical-hard-delete', 'ca110000-0000-4000-8000-000000000001',
    'Canonical hard-delete fixture', 'planned', false, '[]', '[]', true, NULL
  );

SELECT set_config(
  'request.jwt.claim.sub',
  'ca110000-0000-4000-8000-000000000001',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ca110000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE canonical_test_results (
  key text PRIMARY KEY,
  payload jsonb NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE canonical_test_snapshots (
  key text PRIMARY KEY,
  revision bigint NOT NULL,
  change_sequence bigint,
  change_count bigint NOT NULL
) ON COMMIT DROP;

-- Null control flags, untyped sources, non-ISO dates, forged approvals, and
-- soft-deleted tasks must all fail closed before any canonical mutation.
INSERT INTO canonical_test_results (key, payload)
SELECT 'null_preview', public.flowstate_patch_task_v1(
  'canonical-op-null-preview', 'task-v1', 'sql-regression', 'canonical-owned',
  canonical_revision, '{"title":"Must not apply"}'::jsonb, NULL
)
FROM public.tasks WHERE id = 'canonical-owned';

INSERT INTO canonical_test_results (key, payload)
SELECT 'null_source', public.flowstate_patch_task_v1(
  'canonical-op-null-source', 'task-v1', NULL, 'canonical-owned',
  canonical_revision, '{"title":"Must not apply"}'::jsonb, true
)
FROM public.tasks WHERE id = 'canonical-owned';

INSERT INTO canonical_test_results (key, payload)
SELECT 'non_iso_due_date', public.flowstate_patch_task_v1(
  'canonical-op-non-iso-date', 'task-v1', 'sql-regression', 'canonical-owned',
  canonical_revision, '{"dueDate":"tomorrow"}'::jsonb, true
)
FROM public.tasks WHERE id = 'canonical-owned';

INSERT INTO canonical_test_results (key, payload)
SELECT 'forged_preview', public.flowstate_patch_task_v1(
  'canonical-op-forged-preview', 'task-v1', 'sql-regression', 'canonical-owned',
  canonical_revision, '{"title":"Must not apply"}'::jsonb, false,
  repeat('a', 64), clock_timestamp() + interval '1 hour'
)
FROM public.tasks WHERE id = 'canonical-owned';

INSERT INTO canonical_test_results (key, payload)
SELECT 'soft_deleted', public.flowstate_patch_task_v1(
  'canonical-op-soft-deleted', 'task-v1', 'sql-regression', 'canonical-soft-deleted',
  canonical_revision, '{"title":"Must not apply"}'::jsonb, true
)
FROM public.tasks WHERE id = 'canonical-soft-deleted';

DO $$
BEGIN
  IF (SELECT payload #>> '{error,code}' FROM canonical_test_results WHERE key = 'null_preview') <> 'invalid_request'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results WHERE key = 'null_source') <> 'invalid_request'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results WHERE key = 'non_iso_due_date') <> 'invalid_due_date'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results WHERE key = 'forged_preview') <> 'preview_mismatch'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results WHERE key = 'soft_deleted') <> 'not_found'
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE operation_id IN (
         'canonical-op-null-preview', 'canonical-op-null-source',
         'canonical-op-non-iso-date', 'canonical-op-forged-preview',
         'canonical-op-soft-deleted'
       )
     ) THEN
    RAISE EXCEPTION 'FAIL: invalid or forged canonical request did not fail closed';
  END IF;
END $$;

-- Compatibility writes must receive a row revision and a durable legacy event
-- before any existing writer is migrated to the canonical RPC.
INSERT INTO canonical_test_snapshots (key, revision, change_sequence, change_count)
SELECT
  'before_legacy',
  canonical_revision,
  (
    SELECT max(change_sequence)
    FROM public.canonical_change_log
    WHERE entity_type = 'task' AND entity_id = 'canonical-owned'
  ),
  (
    SELECT count(*)
    FROM public.canonical_change_log
    WHERE entity_type = 'task' AND entity_id = 'canonical-owned'
  )
FROM public.tasks
WHERE id = 'canonical-owned';

UPDATE public.tasks
SET planning_notes = '[{"type":"note","content":"legacy compatibility write"}]'::jsonb
WHERE id = 'canonical-owned';

DO $$
DECLARE
  v_before canonical_test_snapshots%ROWTYPE;
  v_after_revision bigint;
  v_change public.canonical_change_log%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_before
  FROM canonical_test_snapshots WHERE key = 'before_legacy';

  SELECT canonical_revision INTO STRICT v_after_revision
  FROM public.tasks WHERE id = 'canonical-owned';

  SELECT * INTO STRICT v_change
  FROM public.canonical_change_log
  WHERE entity_type = 'task' AND entity_id = 'canonical-owned'
  ORDER BY change_sequence DESC
  LIMIT 1;

  IF v_before.revision < 1
     OR v_after_revision <> v_before.revision + 1
     OR v_change.canonical_revision <> v_after_revision
     OR v_change.user_id <> 'ca110000-0000-4000-8000-000000000001'
     OR v_change.source <> 'legacy'
     OR v_change.action <> 'updated'
     OR v_change.operation_id IS NOT NULL
     OR v_change.change_sequence <= COALESCE(v_before.change_sequence, 0) THEN
    RAISE EXCEPTION 'FAIL: legacy write did not produce one canonical revision/event';
  END IF;
END $$;

DELETE FROM public.tasks WHERE id = 'canonical-hard-delete';

DO $$
DECLARE
  v_change public.canonical_change_log%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_change
  FROM public.canonical_change_log
  WHERE entity_type = 'task' AND entity_id = 'canonical-hard-delete'
  ORDER BY change_sequence DESC
  LIMIT 1;

  IF v_change.action <> 'deleted'
     OR v_change.tombstone IS NOT true
     OR v_change.projection #>> '{isDeleted}' <> 'true'
     OR v_change.canonical_revision <> 2 THEN
    RAISE EXCEPTION 'FAIL: hard-delete event could resurrect a deleted task: %', to_jsonb(v_change);
  END IF;
END $$;

INSERT INTO canonical_test_snapshots (key, revision, change_sequence, change_count)
SELECT
  'before_preview',
  canonical_revision,
  (SELECT max(change_sequence) FROM public.canonical_change_log),
  (SELECT count(*) FROM public.canonical_change_log)
FROM public.tasks
WHERE id = 'canonical-owned';

-- Preview binds the normalized request and exact read-back projection but does
-- not write the task, operation ledger, or change log.
INSERT INTO canonical_test_results (key, payload)
SELECT 'preview', public.flowstate_patch_task_v1(
  p_operation_id => 'canonical-op-apply',
  p_contract_version => 'task-v1',
  p_source => 'sql-regression',
  p_task_id => 'canonical-owned',
  p_base_revision => (
    SELECT revision FROM canonical_test_snapshots WHERE key = 'before_preview'
  ),
  p_patch => '{"title":"Canonical title after apply"}'::jsonb,
  p_preview => true
);

DO $$
DECLARE
  v_preview jsonb := (
    SELECT payload FROM canonical_test_results WHERE key = 'preview'
  );
  v_before canonical_test_snapshots%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_before
  FROM canonical_test_snapshots WHERE key = 'before_preview';

  IF v_preview->>'result' <> 'preview'
     OR v_preview->>'contractVersion' <> 'task-v1'
     OR v_preview->>'operationId' <> 'canonical-op-apply'
     OR (v_preview->>'baseRevision')::bigint <> v_before.revision
     OR nullif(v_preview->>'previewDigest', '') IS NULL
     OR (v_preview->>'previewExpiresAt')::timestamptz <= clock_timestamp()
     OR v_preview #>> '{normalizedPayload,title}' <> 'Canonical title after apply'
     OR v_preview #>> '{readBack,title}' = 'Canonical title after apply' THEN
    RAISE EXCEPTION 'FAIL: canonical preview contract was incomplete: %', v_preview;
  END IF;

  IF (SELECT title FROM public.tasks WHERE id = 'canonical-owned')
       <> 'Canonical owned fixture'
     OR (SELECT canonical_revision FROM public.tasks WHERE id = 'canonical-owned')
       <> v_before.revision
     OR (SELECT count(*) FROM public.canonical_change_log) <> v_before.change_count
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE user_id = 'ca110000-0000-4000-8000-000000000001'
         AND operation_id = 'canonical-op-apply'
     ) THEN
    RAISE EXCEPTION 'FAIL: preview mutated canonical state';
  END IF;
END $$;

-- Apply the approved preview and require a complete canonical read-back receipt.
INSERT INTO canonical_test_results (key, payload)
SELECT 'apply', public.flowstate_patch_task_v1(
  p_operation_id => 'canonical-op-apply',
  p_contract_version => 'task-v1',
  p_source => 'sql-regression',
  p_task_id => 'canonical-owned',
  p_base_revision => (
    SELECT revision FROM canonical_test_snapshots WHERE key = 'before_preview'
  ),
  p_patch => '{"title":"Canonical title after apply"}'::jsonb,
  p_preview => false,
  p_preview_digest => (
    SELECT payload->>'previewDigest'
    FROM canonical_test_results WHERE key = 'preview'
  ),
  p_preview_expires_at => (
    SELECT (payload->>'previewExpiresAt')::timestamptz
    FROM canonical_test_results WHERE key = 'preview'
  )
);

DO $$
DECLARE
  v_apply jsonb := (
    SELECT payload FROM canonical_test_results WHERE key = 'apply'
  );
  v_before canonical_test_snapshots%ROWTYPE;
  v_change public.canonical_change_log%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_before
  FROM canonical_test_snapshots WHERE key = 'before_preview';

  SELECT * INTO STRICT v_change
  FROM public.canonical_change_log
  WHERE operation_id = 'canonical-op-apply'
  ORDER BY change_sequence DESC
  LIMIT 1;

  IF v_apply->>'result' <> 'committed'
     OR v_apply #>> '{receipt,contractVersion}' <> 'task-v1'
     OR v_apply #>> '{receipt,operationId}' <> 'canonical-op-apply'
     OR v_apply #>> '{receipt,source}' <> 'sql-regression'
     OR v_apply #>> '{receipt,entityType}' <> 'task'
     OR v_apply #>> '{receipt,action}' <> 'patch'
     OR v_apply #>> '{receipt,entityId}' <> 'canonical-owned'
     OR (v_apply #>> '{receipt,canonicalRevision}')::bigint <> v_before.revision + 1
     OR nullif(v_apply #>> '{receipt,canonicalUpdatedAt}', '') IS NULL
     OR (v_apply #>> '{receipt,changeSequence}')::bigint <> v_change.change_sequence
     OR v_apply #>> '{receipt,replayed}' <> 'false'
     OR nullif(v_apply #>> '{receipt,committedAt}', '') IS NULL
     OR v_apply #>> '{receipt,readBack,title}' <> 'Canonical title after apply'
     OR nullif(v_apply #>> '{receipt,readBackHash}', '') IS NULL
     OR (SELECT canonical_revision FROM public.tasks WHERE id = 'canonical-owned')
       <> v_before.revision + 1
     OR v_change.canonical_revision <> v_before.revision + 1
     OR v_change.source <> 'sql-regression'
     OR v_change.action <> 'updated' THEN
    RAISE EXCEPTION 'FAIL: apply receipt/read-back was incomplete: %', v_apply;
  END IF;
END $$;

-- An identical retry returns the durable receipt without a second write.
INSERT INTO canonical_test_results (key, payload)
SELECT 'replay', public.flowstate_patch_task_v1(
  p_operation_id => 'canonical-op-apply',
  p_contract_version => 'task-v1',
  p_source => 'sql-regression',
  p_task_id => 'canonical-owned',
  p_base_revision => (
    SELECT revision FROM canonical_test_snapshots WHERE key = 'before_preview'
  ),
  p_patch => '{"title":"Canonical title after apply"}'::jsonb,
  p_preview => false,
  p_preview_digest => (
    SELECT payload->>'previewDigest'
    FROM canonical_test_results WHERE key = 'preview'
  ),
  p_preview_expires_at => (
    SELECT (payload->>'previewExpiresAt')::timestamptz
    FROM canonical_test_results WHERE key = 'preview'
  )
);

DO $$
DECLARE
  v_apply jsonb := (SELECT payload FROM canonical_test_results WHERE key = 'apply');
  v_replay jsonb := (SELECT payload FROM canonical_test_results WHERE key = 'replay');
BEGIN
  IF v_replay #>> '{receipt,replayed}' <> 'true'
     OR (v_replay #- '{receipt,replayed}') IS DISTINCT FROM (v_apply #- '{receipt,replayed}')
     OR (SELECT count(*) FROM public.canonical_operations
         WHERE user_id = 'ca110000-0000-4000-8000-000000000001'
           AND operation_id = 'canonical-op-apply') <> 1
     OR (SELECT count(*) FROM public.canonical_change_log
         WHERE operation_id = 'canonical-op-apply') <> 1 THEN
    RAISE EXCEPTION 'FAIL: replay was not stable and exactly-once: apply=%, replay=%',
      v_apply, v_replay;
  END IF;
END $$;

-- Reusing an operation id for another payload is a typed conflict, even when
-- the caller presents the original approval digest.
INSERT INTO canonical_test_results (key, payload)
SELECT 'payload_conflict', public.flowstate_patch_task_v1(
  p_operation_id => 'canonical-op-apply',
  p_contract_version => 'task-v1',
  p_source => 'sql-regression',
  p_task_id => 'canonical-owned',
  p_base_revision => (
    SELECT revision FROM canonical_test_snapshots WHERE key = 'before_preview'
  ),
  p_patch => '{"title":"Conflicting replay payload"}'::jsonb,
  p_preview => false,
  p_preview_digest => (
    SELECT payload->>'previewDigest'
    FROM canonical_test_results WHERE key = 'preview'
  ),
  p_preview_expires_at => (
    SELECT (payload->>'previewExpiresAt')::timestamptz
    FROM canonical_test_results WHERE key = 'preview'
  )
);

-- Stale base revisions, changed approvals, and expired approvals are distinct,
-- stable refusal modes and never create an operation or change row.
INSERT INTO canonical_test_results (key, payload)
SELECT 'stale_revision', public.flowstate_patch_task_v1(
  'canonical-op-stale', 'task-v1', 'sql-regression', 'canonical-owned',
  (SELECT revision FROM canonical_test_snapshots WHERE key = 'before_preview'),
  '{"title":"Stale title"}'::jsonb, true
);

INSERT INTO canonical_test_results (key, payload)
SELECT 'mismatch_preview', public.flowstate_patch_task_v1(
  'canonical-op-mismatch', 'task-v1', 'sql-regression', 'canonical-owned',
  canonical_revision, '{"title":"Mismatched title"}'::jsonb, false,
  'not-the-approved-digest', clock_timestamp() + interval '5 minutes'
)
FROM public.tasks WHERE id = 'canonical-owned';

INSERT INTO canonical_test_results (key, payload)
SELECT 'expiry_issued', public.flowstate_patch_task_v1(
  'canonical-op-expired', 'task-v1', 'sql-regression', 'canonical-owned',
  canonical_revision, '{"title":"Expired title"}'::jsonb, true
)
FROM public.tasks WHERE id = 'canonical-owned';

UPDATE public.canonical_operation_previews
SET expires_at = clock_timestamp() - interval '1 second'
WHERE user_id = 'ca110000-0000-4000-8000-000000000001'
  AND operation_id = 'canonical-op-expired';

INSERT INTO canonical_test_results (key, payload)
SELECT 'expiry_preview', public.flowstate_patch_task_v1(
  'canonical-op-expired', 'task-v1', 'sql-regression', 'canonical-owned',
  task.canonical_revision, '{"title":"Expired title"}'::jsonb, false,
  preview.preview_digest, preview.expires_at
)
FROM public.tasks AS task
JOIN public.canonical_operation_previews AS preview
  ON preview.user_id = 'ca110000-0000-4000-8000-000000000001'
 AND preview.operation_id = 'canonical-op-expired'
WHERE task.id = 'canonical-owned';

DO $$
BEGIN
  IF (SELECT payload #>> '{error,code}' FROM canonical_test_results
      WHERE key = 'payload_conflict') <> 'idempotency_conflict'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results
         WHERE key = 'stale_revision') <> 'stale_revision'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results
         WHERE key = 'mismatch_preview') <> 'preview_mismatch'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results
         WHERE key = 'expiry_preview') <> 'preview_expired'
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE operation_id IN ('canonical-op-stale', 'canonical-op-mismatch', 'canonical-op-expired')
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_change_log
       WHERE operation_id IN ('canonical-op-stale', 'canonical-op-mismatch', 'canonical-op-expired')
     ) THEN
    RAISE EXCEPTION 'FAIL: typed stale/approval conflicts were not stable: %',
      (SELECT jsonb_object_agg(key, payload) FROM canonical_test_results);
  END IF;
END $$;

-- Missing auth and another signed-in user must not reveal whether the task or
-- operation exists. The same isolation must hold for direct RLS reads.
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);

INSERT INTO canonical_test_results (key, payload)
SELECT 'not_authenticated', public.flowstate_patch_task_v1(
  'canonical-op-no-auth', 'task-v1', 'sql-regression', 'canonical-owned', 1,
  '{"title":"Must not apply"}'::jsonb, true
);

SELECT set_config(
  'request.jwt.claim.sub',
  'ca110000-0000-4000-8000-000000000002',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ca110000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

INSERT INTO canonical_test_results (key, payload)
SELECT 'cross_user', public.flowstate_patch_task_v1(
  'canonical-op-cross-user', 'task-v1', 'sql-regression', 'canonical-owned',
  (SELECT canonical_revision FROM public.tasks WHERE id = 'canonical-owned'),
  '{"title":"Must not apply"}'::jsonb, true
);

INSERT INTO canonical_test_results (key, payload)
SELECT 'workspace_member', public.flowstate_patch_task_v1(
  'canonical-op-workspace-member', 'task-v1', 'sql-regression',
  'canonical-shared', canonical_revision,
  '{"title":"Member-approved shared preview"}'::jsonb, true,
  NULL, NULL, 'ca110000-0000-4000-8000-000000000010'
)
FROM public.tasks WHERE id = 'canonical-shared';

INSERT INTO canonical_test_results (key, payload)
SELECT 'wrong_workspace', public.flowstate_patch_task_v1(
  'canonical-op-wrong-workspace', 'task-v1', 'sql-regression',
  'canonical-shared', canonical_revision,
  '{"title":"Wrong-scope preview"}'::jsonb, true
)
FROM public.tasks WHERE id = 'canonical-shared';

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    UPDATE public.tasks
    SET user_id = 'ca110000-0000-4000-8000-000000000002'
    WHERE id = 'canonical-shared';
    RAISE EXCEPTION 'FAIL: workspace member changed task ownership';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    UPDATE public.tasks
    SET workspace_id = NULL
    WHERE id = 'canonical-shared';
    RAISE EXCEPTION 'FAIL: workspace member reassigned task scope';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    INSERT INTO public.tasks (
      id, user_id, title, status, is_deleted, instances, subtasks,
      is_in_inbox, workspace_id
    ) VALUES (
      'canonical-forged-owner',
      'ca110000-0000-4000-8000-000000000001',
      'Forged owner', 'planned', false, '[]', '[]', true,
      'ca110000-0000-4000-8000-000000000010'
    );
    RAISE EXCEPTION 'FAIL: workspace member inserted a forged task owner';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

UPDATE public.workspace_members
SET role = 'viewer'
WHERE workspace_id = 'ca110000-0000-4000-8000-000000000010'
  AND user_id = 'ca110000-0000-4000-8000-000000000002';

INSERT INTO canonical_test_results (key, payload)
SELECT 'workspace_viewer', public.flowstate_patch_task_v1(
  'canonical-op-workspace-viewer', 'task-v1', 'sql-regression',
  'canonical-shared', canonical_revision,
  '{"title":"Viewer must not write"}'::jsonb, true,
  NULL, NULL, 'ca110000-0000-4000-8000-000000000010'
)
FROM public.tasks WHERE id = 'canonical-shared';

DO $$
BEGIN
  IF (SELECT payload #>> '{error,code}' FROM canonical_test_results
      WHERE key = 'not_authenticated') <> 'not_authenticated'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results
         WHERE key = 'cross_user') <> 'not_found'
     OR (SELECT payload->>'result' FROM canonical_test_results
         WHERE key = 'workspace_member') <> 'preview'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results
         WHERE key = 'wrong_workspace') <> 'not_found'
     OR (SELECT payload #>> '{error,code}' FROM canonical_test_results
         WHERE key = 'workspace_viewer') <> 'not_found' THEN
    RAISE EXCEPTION 'FAIL: auth/scope errors leaked or diverged: %',
      (SELECT jsonb_object_agg(key, payload)
       FROM canonical_test_results
       WHERE key IN ('not_authenticated', 'cross_user'));
  END IF;
END $$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.tasks
  SET title = 'Viewer direct write must be filtered'
  WHERE id = 'canonical-shared';
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE user_id = 'ca110000-0000-4000-8000-000000000001'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_change_log
       WHERE user_id = 'ca110000-0000-4000-8000-000000000001'
         AND workspace_id IS NULL
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.canonical_change_log
       WHERE entity_id = 'canonical-shared'
         AND workspace_id = 'ca110000-0000-4000-8000-000000000010'
     )
     OR v_updated <> 0
     OR (SELECT title FROM public.tasks WHERE id = 'canonical-shared')
       <> 'Canonical shared fixture'
  THEN
    RAISE EXCEPTION 'FAIL: workspace viewer RLS read/write scope was incorrect';
  END IF;

  BEGIN
    INSERT INTO public.canonical_operations (
      user_id, operation_id, contract_version, source, scope_kind, scope_id,
      entity_type, action, entity_id, request_hash, state
    ) VALUES (
      'ca110000-0000-4000-8000-000000000002', 'forged-ledger-row',
      'task-v1', 'sql-regression', 'personal',
      'ca110000-0000-4000-8000-000000000002', 'task', 'patch',
      'canonical-other', repeat('0', 64), 'applying'
    );
    RAISE EXCEPTION 'FAIL: authenticated caller inserted directly into operation ledger';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    UPDATE public.canonical_change_log
    SET source = 'forged'
    WHERE entity_id = 'canonical-shared';
    RAISE EXCEPTION 'FAIL: authenticated caller updated the change log';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    DELETE FROM public.canonical_change_log
    WHERE entity_id = 'canonical-shared';
    RAISE EXCEPTION 'FAIL: authenticated caller deleted from the change log';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;

DELETE FROM public.workspace_members
WHERE workspace_id = 'ca110000-0000-4000-8000-000000000010'
  AND user_id = 'ca110000-0000-4000-8000-000000000002';

SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF EXISTS (
       SELECT 1 FROM public.tasks WHERE id = 'canonical-shared'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_change_log
       WHERE entity_id = 'canonical-shared'
     ) THEN
    RAISE EXCEPTION 'FAIL: removed workspace member retained task/change-log access';
  END IF;
END $$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claim.sub',
  'ca110000-0000-4000-8000-000000000001',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ca110000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- A later legacy write has a globally increasing sequence. This is the durable
-- catch-up cursor used when Realtime is absent; gaps from other scopes are valid.
UPDATE public.tasks
SET planning_notes = '[{"type":"note","content":"second legacy write"}]'::jsonb
WHERE id = 'canonical-owned';

DO $$
DECLARE
  v_apply_sequence bigint := (
    SELECT (payload #>> '{receipt,changeSequence}')::bigint
    FROM canonical_test_results WHERE key = 'apply'
  );
  v_latest_sequence bigint;
BEGIN
  SELECT max(change_sequence) INTO STRICT v_latest_sequence
  FROM public.canonical_change_log
  WHERE user_id = 'ca110000-0000-4000-8000-000000000001';

  IF v_latest_sequence <= v_apply_sequence THEN
    RAISE EXCEPTION 'FAIL: canonical change sequence did not advance monotonically';
  END IF;
END $$;

-- Inject a task write failure after preview. Apply must leave the task revision,
-- change log, and durable operation free of any false committed receipt.
INSERT INTO canonical_test_results (key, payload)
SELECT 'rollback_preview', public.flowstate_patch_task_v1(
  'canonical-op-rollback', 'task-v1', 'sql-regression', 'canonical-rollback',
  canonical_revision, '{"title":"Must roll back"}'::jsonb, true
)
FROM public.tasks WHERE id = 'canonical-rollback';

INSERT INTO canonical_test_snapshots (key, revision, change_sequence, change_count)
SELECT
  'before_rollback', canonical_revision,
  (SELECT max(change_sequence) FROM public.canonical_change_log),
  (SELECT count(*) FROM public.canonical_change_log)
FROM public.tasks WHERE id = 'canonical-rollback';

CREATE FUNCTION public.test_force_canonical_task_failure()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id = 'canonical-rollback' THEN
    RAISE EXCEPTION 'injected canonical task failure';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER test_force_canonical_task_failure
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.test_force_canonical_task_failure();

DO $$
DECLARE
  v_result jsonb;
  v_preview jsonb := (
    SELECT payload FROM canonical_test_results WHERE key = 'rollback_preview'
  );
BEGIN
  BEGIN
    v_result := public.flowstate_patch_task_v1(
      'canonical-op-rollback', 'task-v1', 'sql-regression', 'canonical-rollback',
      (SELECT revision FROM canonical_test_snapshots WHERE key = 'before_rollback'),
      '{"title":"Must roll back"}'::jsonb, false,
      v_preview->>'previewDigest',
      (v_preview->>'previewExpiresAt')::timestamptz
    );

    IF v_result->>'result' NOT IN ('rejected', 'unavailable') THEN
      RAISE EXCEPTION 'FAIL: injected failure returned false success: %', v_result;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE 'FAIL:%' THEN
        RAISE;
      END IF;
      -- Propagating the injected database exception is also safe. The following
      -- assertions prove the statement left no partial canonical commit.
  END;

  IF (SELECT title FROM public.tasks WHERE id = 'canonical-rollback')
       <> 'Canonical rollback fixture'
     OR (SELECT canonical_revision FROM public.tasks WHERE id = 'canonical-rollback')
       <> (SELECT revision FROM canonical_test_snapshots WHERE key = 'before_rollback')
     OR EXISTS (
       SELECT 1 FROM public.canonical_change_log
       WHERE operation_id = 'canonical-op-rollback'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations AS op
       WHERE operation_id = 'canonical-op-rollback'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_operation_previews AS preview
       WHERE preview.operation_id = 'canonical-op-rollback'
         AND preview.consumed_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'FAIL: failed apply left partial canonical state';
  END IF;
END $$;

DROP TRIGGER test_force_canonical_task_failure ON public.tasks;
DROP FUNCTION public.test_force_canonical_task_failure();

DO $$
BEGIN
  RAISE NOTICE 'PASS: canonical task preview/apply, replay, conflicts, RLS, sequence, and rollback';
END $$;

ROLLBACK;
