-- Regression coverage for TASK-1958's canonical non-recurring completion RPC.
-- Every fixture and canonical mutation is rolled back.
--
-- Usage:
--   docker exec -i supabase_db_flow-state psql -U postgres -v ON_ERROR_STOP=1 \
--     < scripts/db/test-complete-task-rpc.sql

BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
  (
    'c0de0000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'complete-owner@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'c0de0000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'complete-other@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  );

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, subtasks, is_in_inbox,
  workspace_id, recurrence_rule, recurrence_parent_id, is_completion_record
) VALUES
  (
    'c0de0000-0000-4000-8000-000000000101', 'c0de0000-0000-4000-8000-000000000001',
    'Complete plain fixture', 'planned', false, '[]', '[]', true,
    NULL, NULL, NULL, false
  ),
  (
    'c0de0000-0000-4000-8000-000000000102', 'c0de0000-0000-4000-8000-000000000001',
    'Complete recurring fixture', 'planned', false, '[]', '[]', true,
    NULL, '{"pattern":"daily","interval":2,"endType":"never"}'::jsonb, NULL, false
  ),
  (
    'c0de0000-0000-4000-8000-000000000103', 'c0de0000-0000-4000-8000-000000000001',
    'Complete chain-member fixture', 'planned', false, '[]', '[]', true,
    NULL, NULL, 'c0de0000-0000-4000-8000-000000000102', false
  ),
  (
    'c0de0000-0000-4000-8000-000000000104', 'c0de0000-0000-4000-8000-000000000001',
    'Complete completion-record fixture', 'done', false, '[]', '[]', true,
    NULL, NULL, NULL, true
  ),
  (
    'c0de0000-0000-4000-8000-000000000105', 'c0de0000-0000-4000-8000-000000000001',
    'Complete already-done fixture', 'done', false, '[]', '[]', true,
    NULL, NULL, NULL, false
  ),
  (
    'c0de0000-0000-4000-8000-000000000106', 'c0de0000-0000-4000-8000-000000000002',
    'Complete other-user fixture', 'planned', false, '[]', '[]', true,
    NULL, NULL, NULL, false
  );

CREATE TEMP TABLE complete_test_results (
  key text PRIMARY KEY,
  payload jsonb NOT NULL
) ON COMMIT DROP;

-- Unauthenticated callers must fail closed before any claims are set.
INSERT INTO complete_test_results (key, payload)
SELECT 'unauthenticated', public.flowstate_complete_task_v1(
  'complete-op-unauthenticated', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000101', 1
);

SELECT set_config(
  'request.jwt.claim.sub',
  'c0de0000-0000-4000-8000-000000000001',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c0de0000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- Recurring identity, chain membership, and completion history all reject.
INSERT INTO complete_test_results (key, payload)
SELECT 'recurring_rule', public.flowstate_complete_task_v1(
  'complete-op-recurring', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000102', canonical_revision
)
FROM public.tasks WHERE id = 'c0de0000-0000-4000-8000-000000000102';

INSERT INTO complete_test_results (key, payload)
SELECT 'recurring_chain', public.flowstate_complete_task_v1(
  'complete-op-chain', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000103', canonical_revision
)
FROM public.tasks WHERE id = 'c0de0000-0000-4000-8000-000000000103';

INSERT INTO complete_test_results (key, payload)
SELECT 'completion_record', public.flowstate_complete_task_v1(
  'complete-op-record', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000104', canonical_revision
)
FROM public.tasks WHERE id = 'c0de0000-0000-4000-8000-000000000104';

INSERT INTO complete_test_results (key, payload)
SELECT 'already_completed', public.flowstate_complete_task_v1(
  'complete-op-done', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000105', canonical_revision
)
FROM public.tasks WHERE id = 'c0de0000-0000-4000-8000-000000000105';

INSERT INTO complete_test_results (key, payload)
SELECT 'foreign_task', public.flowstate_complete_task_v1(
  'complete-op-foreign', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000106', 1
);

INSERT INTO complete_test_results (key, payload)
SELECT 'stale_revision', public.flowstate_complete_task_v1(
  'complete-op-stale', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000101', canonical_revision + 5
)
FROM public.tasks WHERE id = 'c0de0000-0000-4000-8000-000000000101';

INSERT INTO complete_test_results (key, payload)
SELECT 'workspace_mismatch', public.flowstate_complete_task_v1(
  'complete-op-scope', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000101', canonical_revision,
  true, NULL, NULL, 'c0de0000-0000-4000-8000-000000000099'
)
FROM public.tasks WHERE id = 'c0de0000-0000-4000-8000-000000000101';

-- Preview must be non-mutating and issue a digest-bound approval.
INSERT INTO complete_test_results (key, payload)
SELECT 'preview', public.flowstate_complete_task_v1(
  'complete-op-happy', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000101', canonical_revision
)
FROM public.tasks WHERE id = 'c0de0000-0000-4000-8000-000000000101';

DO $$
DECLARE
  v_row public.tasks%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.tasks
  WHERE id = 'c0de0000-0000-4000-8000-000000000101';
  IF v_row.status = 'done' OR v_row.completed_at IS NOT NULL OR v_row.canonical_revision <> 1 THEN
    RAISE EXCEPTION 'FAIL: preview mutated the task row';
  END IF;
END $$;

-- Apply with a forged digest must be refused.
INSERT INTO complete_test_results (key, payload)
SELECT 'forged_apply', public.flowstate_complete_task_v1(
  'complete-op-happy', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000101', canonical_revision,
  false, repeat('0', 64), clock_timestamp() + interval '15 minutes'
)
FROM public.tasks WHERE id = 'c0de0000-0000-4000-8000-000000000101';

-- Apply with the issued approval commits exactly once.
INSERT INTO complete_test_results (key, payload)
SELECT 'apply', public.flowstate_complete_task_v1(
  'complete-op-happy', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000101',
  (results.payload->>'baseRevision')::bigint,
  false,
  results.payload->>'previewDigest',
  (results.payload->>'previewExpiresAt')::timestamptz
)
FROM complete_test_results AS results WHERE results.key = 'preview';

-- Replaying the committed operation returns the durable receipt.
INSERT INTO complete_test_results (key, payload)
SELECT 'replay', public.flowstate_complete_task_v1(
  'complete-op-happy', 'task-v1', 'sql-regression',
  'c0de0000-0000-4000-8000-000000000101',
  (results.payload->>'baseRevision')::bigint,
  false,
  results.payload->>'previewDigest',
  (results.payload->>'previewExpiresAt')::timestamptz
)
FROM complete_test_results AS results WHERE results.key = 'preview';

DO $$
DECLARE
  v jsonb;
  v_receipt jsonb;
  v_row public.tasks%ROWTYPE;
  v_recomputed_hash text;
BEGIN
  SELECT payload INTO v FROM complete_test_results WHERE key = 'unauthenticated';
  IF v->'error'->>'code' IS DISTINCT FROM 'not_authenticated' THEN
    RAISE EXCEPTION 'FAIL: unauthenticated call was not rejected: %', v;
  END IF;

  FOR v IN
    SELECT payload FROM complete_test_results
    WHERE key IN ('recurring_rule', 'recurring_chain', 'completion_record')
  LOOP
    IF v->>'ok' IS DISTINCT FROM 'false'
       OR v->'error'->>'code' IS DISTINCT FROM 'recurring_task' THEN
      RAISE EXCEPTION 'FAIL: recurring identity did not fail closed: %', v;
    END IF;
  END LOOP;

  SELECT payload INTO v FROM complete_test_results WHERE key = 'already_completed';
  IF v->'error'->>'code' IS DISTINCT FROM 'already_completed' THEN
    RAISE EXCEPTION 'FAIL: already-done task was not rejected: %', v;
  END IF;

  SELECT payload INTO v FROM complete_test_results WHERE key = 'foreign_task';
  IF v->'error'->>'code' IS DISTINCT FROM 'not_found' THEN
    RAISE EXCEPTION 'FAIL: foreign task leaked past scope checks: %', v;
  END IF;

  SELECT payload INTO v FROM complete_test_results WHERE key = 'stale_revision';
  IF v->'error'->>'code' IS DISTINCT FROM 'stale_revision' THEN
    RAISE EXCEPTION 'FAIL: stale base revision was accepted: %', v;
  END IF;

  SELECT payload INTO v FROM complete_test_results WHERE key = 'workspace_mismatch';
  IF v->'error'->>'code' IS DISTINCT FROM 'not_found' THEN
    RAISE EXCEPTION 'FAIL: workspace mismatch was accepted: %', v;
  END IF;

  SELECT payload INTO v FROM complete_test_results WHERE key = 'preview';
  IF v->>'ok' IS DISTINCT FROM 'true'
     OR v->>'result' IS DISTINCT FROM 'preview'
     OR v->>'willSetCompletedAt' IS DISTINCT FROM 'true'
     OR (v->>'previewDigest') !~ '^[0-9a-f]{64}$'
     OR v->'readBack'->>'status' IS DISTINCT FROM 'todo'
     OR v->'normalizedPayload'->>'status' IS DISTINCT FROM 'done' THEN
    RAISE EXCEPTION 'FAIL: preview response is not a valid approval basis: %', v;
  END IF;

  SELECT payload INTO v FROM complete_test_results WHERE key = 'forged_apply';
  IF v->'error'->>'code' IS DISTINCT FROM 'preview_mismatch' THEN
    RAISE EXCEPTION 'FAIL: forged approval digest was accepted: %', v;
  END IF;

  SELECT payload INTO v FROM complete_test_results WHERE key = 'apply';
  v_receipt := v->'receipt';
  IF v->>'ok' IS DISTINCT FROM 'true'
     OR v->>'result' IS DISTINCT FROM 'committed'
     OR v_receipt->>'action' IS DISTINCT FROM 'complete'
     OR v_receipt->>'entityId' IS DISTINCT FROM 'c0de0000-0000-4000-8000-000000000101'
     OR (v_receipt->>'replayed')::boolean IS DISTINCT FROM false
     OR (v_receipt->>'canonicalRevision')::bigint IS DISTINCT FROM 2
     OR (v_receipt->>'changeSequence') IS NULL
     OR v_receipt->'readBack'->>'status' IS DISTINCT FROM 'done'
     OR v_receipt->'readBack'->>'completedAt' IS NULL THEN
    RAISE EXCEPTION 'FAIL: committed receipt is not proof of completion: %', v;
  END IF;

  v_recomputed_hash := encode(
    extensions.digest(convert_to((v_receipt->'readBack')::text, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_recomputed_hash IS DISTINCT FROM v_receipt->>'readBackHash' THEN
    RAISE EXCEPTION 'FAIL: readBackHash does not match the read-back payload';
  END IF;

  SELECT * INTO v_row FROM public.tasks
  WHERE id = 'c0de0000-0000-4000-8000-000000000101';
  IF v_row.status <> 'done'
     OR v_row.completed_at IS NULL
     OR v_row.canonical_revision <> 2 THEN
    RAISE EXCEPTION 'FAIL: task row does not match the committed receipt';
  END IF;

  SELECT payload INTO v FROM complete_test_results WHERE key = 'replay';
  IF v->>'result' IS DISTINCT FROM 'committed'
     OR (v->'receipt'->>'replayed')::boolean IS DISTINCT FROM true
     OR v->'receipt'->>'readBackHash' IS DISTINCT FROM v_receipt->>'readBackHash' THEN
    RAISE EXCEPTION 'FAIL: replay did not return the durable receipt: %', v;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.canonical_change_log AS change
    WHERE change.entity_id = 'c0de0000-0000-4000-8000-000000000101'
      AND change.operation_id = 'complete-op-happy'
      AND change.source = 'sql-regression'
      AND change.action = 'updated'
  ) THEN
    RAISE EXCEPTION 'FAIL: completion did not land in the canonical change log';
  END IF;

  RAISE NOTICE 'PASS: canonical non-recurring completion contract';
END $$;

ROLLBACK;
