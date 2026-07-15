-- H3 rollback-only regression for one canonical receipt envelope across task
-- patch, completion, recurring Done for now, duplicate merge, and recurrence
-- merge. All fixtures, operations, and injected failures are rolled back.

BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'c3c30000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'canonical-domain-receipts@test.flowstate', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated', '', ''
);

INSERT INTO public.tasks (
  id, user_id, title, status, due_date, recurrence_rule,
  recurrence_parent_id, recurrence_count, is_completion_record,
  is_deleted, instances, subtasks, is_in_inbox
) VALUES
  ('c3c30000-0000-4000-8000-000000000101', 'c3c30000-0000-4000-8000-000000000001',
   'Patch fixture', 'planned', NULL, NULL, NULL, 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000102', 'c3c30000-0000-4000-8000-000000000001',
   'Complete fixture', 'planned', NULL, NULL, NULL, 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000103', 'c3c30000-0000-4000-8000-000000000001',
   'Done fixture', 'planned', '2026-07-15',
   '{"pattern":"daily","interval":1,"endType":"never"}',
   'c3c30000-0000-4000-8000-000000000103', 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000104', 'c3c30000-0000-4000-8000-000000000001',
   'Merge survivor', 'planned', NULL, NULL, NULL, 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000105', 'c3c30000-0000-4000-8000-000000000001',
   'Merge duplicate', 'planned', NULL, NULL, NULL, 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000106', 'c3c30000-0000-4000-8000-000000000001',
   'Recurrence survivor', 'planned', '2026-07-16',
   '{"pattern":"daily","interval":1,"endType":"never"}',
   NULL, 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000107', 'c3c30000-0000-4000-8000-000000000001',
   'Recurrence duplicate', 'planned', '2026-07-16',
   '{"pattern":"weekly","interval":1,"weekdays":[1],"endType":"never"}',
   NULL, 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000108', 'c3c30000-0000-4000-8000-000000000001',
   'Rollback survivor', 'planned', NULL, NULL, NULL, 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000109', 'c3c30000-0000-4000-8000-000000000001',
   'Rollback duplicate', 'planned', NULL, NULL, NULL, 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000110', 'c3c30000-0000-4000-8000-000000000001',
   'Unresolved recurrence A', 'planned', NULL,
   '{"pattern":"daily","interval":1,"endType":"never"}',
   NULL, 0, false, false, '[]', '[]', true),
  ('c3c30000-0000-4000-8000-000000000111', 'c3c30000-0000-4000-8000-000000000001',
   'Unresolved recurrence B', 'planned', NULL,
   '{"pattern":"weekly","interval":1,"weekdays":[1],"endType":"never"}',
   NULL, 0, false, false, '[]', '[]', true);

SELECT set_config('request.jwt.claim.sub', 'c3c30000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"c3c30000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE FUNCTION pg_temp.assert_canonical_envelope(
  p_envelope jsonb,
  p_status text,
  p_operation_id text,
  p_expected_affected integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_receipt jsonb := p_envelope->'receipt';
  v_affected jsonb;
BEGIN
  IF p_envelope->>'ok' IS DISTINCT FROM 'true'
     OR p_envelope->>'result' IS DISTINCT FROM 'committed'
     OR p_envelope->>'requestHash' IS NULL
     OR p_envelope->>'requestHash' !~ '^[0-9a-f]{64}$'
     OR v_receipt->>'ok' IS DISTINCT FROM 'true'
     OR v_receipt->>'status' IS DISTINCT FROM p_status
     OR v_receipt->>'operationId' IS DISTINCT FROM p_operation_id
     OR v_receipt->>'requestHash' IS DISTINCT FROM p_envelope->>'requestHash'
     OR v_receipt->>'source' IS DISTINCT FROM 'local-api'
     OR v_receipt->>'entityType' IS DISTINCT FROM 'task'
     OR nullif(v_receipt->>'action', '') IS NULL
     OR nullif(v_receipt->>'entityId', '') IS NULL
     OR nullif(v_receipt->>'contractVersion', '') IS NULL
     OR (v_receipt->>'canonicalRevision')::bigint < 1
     OR (v_receipt->>'canonicalUpdatedAt')::timestamptz IS NULL
     OR (v_receipt->>'changeSequence')::bigint < 1
     OR (v_receipt->>'committedAt')::timestamptz IS NULL
     OR (v_receipt->>'replayed')::boolean IS DISTINCT FROM (p_status = 'replayed')
     OR v_receipt->'readBack' IS NULL
     OR v_receipt->>'readBackHash' IS DISTINCT FROM encode(
       digest(convert_to(
         public.flowstate_canonical_json_text_v1(v_receipt->'readBack'), 'UTF8'
       ), 'sha256'), 'hex'
     )
     OR jsonb_array_length(v_receipt->'affected') <> p_expected_affected
     OR jsonb_array_length(v_receipt->'affected') <> (
       SELECT count(DISTINCT affected.value->>'entityId')
       FROM jsonb_array_elements(v_receipt->'affected') AS affected(value)
     ) THEN
    RAISE EXCEPTION 'FAIL: invalid canonical envelope: %', p_envelope;
  END IF;

  FOR v_affected IN SELECT value FROM jsonb_array_elements(v_receipt->'affected')
  LOOP
    IF nullif(v_affected->>'entityId', '') IS NULL
       OR v_affected->>'entityType' IS DISTINCT FROM 'task'
       OR nullif(v_affected->>'action', '') IS NULL
       OR (v_affected->>'canonicalRevision')::bigint < 1
       OR (v_affected->>'changeSequence')::bigint < 1
       OR NOT EXISTS (
         SELECT 1
         FROM public.canonical_change_log AS change_log
         WHERE change_log.entity_type = 'task'
           AND change_log.entity_id = v_affected->>'entityId'
           AND change_log.change_sequence = (v_affected->>'changeSequence')::bigint
           AND change_log.operation_id = p_operation_id
           AND change_log.source = 'local-api'
       )
       OR v_affected->'readBack' IS NULL
       OR v_affected->>'readBackHash' IS DISTINCT FROM encode(
         digest(convert_to(
           public.flowstate_canonical_json_text_v1(v_affected->'readBack'), 'UTF8'
         ), 'sha256'), 'hex'
       ) THEN
      RAISE EXCEPTION 'FAIL: invalid affected-row link: %', v_affected;
    END IF;
  END LOOP;
END;
$$;

CREATE FUNCTION pg_temp.assert_canonical_preview(
  p_preview jsonb,
  p_operation_id text,
  p_contract_version text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_preview->>'ok' IS DISTINCT FROM 'true'
     OR p_preview->>'result' IS DISTINCT FROM 'preview'
     OR (p_preview->>'preview')::boolean IS DISTINCT FROM true
     OR p_preview->>'operationId' IS DISTINCT FROM p_operation_id
     OR p_preview->>'contractVersion' IS DISTINCT FROM p_contract_version
     OR nullif(p_preview->>'previewVersion', '') IS NULL
     OR p_preview->>'requestHash' !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'FAIL: invalid canonical preview: %', p_preview;
  END IF;
END;
$$;

DO $$
DECLARE
  v_preview jsonb;
  v_apply jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_missing_hash jsonb;
  v_revision bigint;
  v_change_count bigint;
  v_stored_result jsonb;
  v_stored_revision bigint;
  v_stored_sequence bigint;
  v_stored_updated_at timestamptz;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = 'c3c30000-0000-4000-8000-000000000101';
  v_preview := public.flowstate_patch_task_v1(
    'h3-patch', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000101', v_revision,
    '{"title":"Patched once"}'
  );
  PERFORM pg_temp.assert_canonical_preview(v_preview, 'h3-patch', 'task-v1');
  v_missing_hash := public.flowstate_patch_task_v1(
    'h3-patch', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000101', v_revision,
    '{"title":"Patched once"}', false,
    v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz
  );
  IF v_missing_hash #>> '{error,code}' <> 'request_hash_required' THEN
    RAISE EXCEPTION 'FAIL: old patch apply did not fail closed: %', v_missing_hash;
  END IF;
  v_apply := public.flowstate_patch_task_v1(
    'h3-patch', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000101', v_revision,
    '{"title":"Patched once"}', false,
    v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz,
    NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_apply, 'committed', 'h3-patch', 1);
  IF v_apply #>> '{receipt,action}' <> 'patch' THEN
    RAISE EXCEPTION 'FAIL: patch receipt action is wrong: %', v_apply;
  END IF;
  SELECT count(*) INTO v_change_count FROM public.canonical_change_log
  WHERE operation_id = 'h3-patch';
  v_replay := public.flowstate_patch_task_v1(
    'h3-patch', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000101', v_revision,
    '{"title":"Patched once"}', false,
    v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz,
    NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_replay, 'replayed', 'h3-patch', 1);
  IF v_replay #>> '{receipt,readBackHash}' <> v_apply #>> '{receipt,readBackHash}'
     OR (SELECT count(*) FROM public.canonical_change_log WHERE operation_id = 'h3-patch') <> v_change_count THEN
    RAISE EXCEPTION 'FAIL: patch response-loss replay mutated state';
  END IF;
  SELECT canonical_result, canonical_revision, change_sequence, updated_at
  INTO v_stored_result, v_stored_revision, v_stored_sequence, v_stored_updated_at
  FROM public.canonical_operations WHERE operation_id = 'h3-patch';
  UPDATE public.tasks
  SET planning_notes = '[{"type":"note","content":"later mutation"}]'::jsonb
  WHERE id = 'c3c30000-0000-4000-8000-000000000101';
  v_replay := public.flowstate_patch_task_v1(
    'h3-patch', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000101', v_revision,
    '{"title":"Patched once"}', false,
    v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz,
    NULL, v_preview->>'requestHash'
  );
  IF v_replay #>> '{receipt,readBackHash}' <> v_apply #>> '{receipt,readBackHash}'
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE operation_id = 'h3-patch'
         AND (canonical_result IS DISTINCT FROM v_stored_result
           OR canonical_revision IS DISTINCT FROM v_stored_revision
           OR change_sequence IS DISTINCT FROM v_stored_sequence
           OR updated_at IS DISTINCT FROM v_stored_updated_at)
     ) THEN
    RAISE EXCEPTION 'FAIL: patch replay rewrote canonical evidence after a later mutation';
  END IF;
  v_conflict := public.flowstate_patch_task_v1(
    'h3-patch', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000101', v_revision,
    '{"title":"Changed payload"}', false,
    v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz,
    NULL, v_preview->>'requestHash'
  );
  IF v_conflict #>> '{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'FAIL: patch changed payload did not conflict: %', v_conflict;
  END IF;
END;
$$;

DO $$
DECLARE
  v_preview jsonb;
  v_apply jsonb;
  v_replay jsonb;
  v_missing_hash jsonb;
  v_revision bigint;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.tasks
  WHERE id = 'c3c30000-0000-4000-8000-000000000102';
  v_preview := public.flowstate_complete_task_v1(
    'h3-complete', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000102', v_revision
  );
  PERFORM pg_temp.assert_canonical_preview(v_preview, 'h3-complete', 'task-v1');
  v_missing_hash := public.flowstate_complete_task_v1(
    'h3-complete', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000102', v_revision, false,
    v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz
  );
  IF v_missing_hash #>> '{error,code}' <> 'request_hash_required' THEN
    RAISE EXCEPTION 'FAIL: old complete apply did not fail closed: %', v_missing_hash;
  END IF;
  v_apply := public.flowstate_complete_task_v1(
    'h3-complete', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000102', v_revision, false,
    v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz,
    NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_apply, 'committed', 'h3-complete', 1);
  IF v_apply #>> '{receipt,action}' <> 'complete' THEN
    RAISE EXCEPTION 'FAIL: complete receipt action is wrong: %', v_apply;
  END IF;
  v_replay := public.flowstate_complete_task_v1(
    'h3-complete', 'task-v1', 'local-api',
    'c3c30000-0000-4000-8000-000000000102', v_revision, false,
    v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz,
    NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_replay, 'replayed', 'h3-complete', 1);
  IF v_replay #>> '{receipt,readBackHash}' <> v_apply #>> '{receipt,readBackHash}' THEN
    RAISE EXCEPTION 'FAIL: complete replay changed the read-back hash';
  END IF;
END;
$$;

DO $$
DECLARE
  v_preview jsonb;
  v_apply jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_request_hash text;
  v_missing_hash jsonb;
  v_preview_alt jsonb;
  v_padded jsonb;
  v_wrong_hash jsonb;
BEGIN
  v_preview := public.flowstate_done_for_now(
    'c3c30000-0000-4000-8000-000000000103', true, '2026-07-17', 'h3-done'
  );
  PERFORM pg_temp.assert_canonical_preview(v_preview, 'h3-done', 'task-v1');
  IF v_preview->>'requestHash' IS DISTINCT FROM encode(digest(convert_to(
    public.flowstate_canonical_json_text_v1(jsonb_build_object(
      'actorUserId', 'c3c30000-0000-4000-8000-000000000001'::uuid,
      'contractVersion', 'task-v1', 'source', 'local-api',
      'action', 'done_for_now',
      'taskId', 'c3c30000-0000-4000-8000-000000000103',
      'normalizedPayload', jsonb_build_object('nextDueDate', '2026-07-17'::date),
      'previewVersion', v_preview->>'previewVersion', 'workspaceId', NULL
    )), 'UTF8'), 'sha256'), 'hex') THEN
    RAISE EXCEPTION 'FAIL: done-for-now requestHash vector drifted: %', v_preview;
  END IF;
  v_preview_alt := public.flowstate_done_for_now(
    'c3c30000-0000-4000-8000-000000000103', true, '2026-07-17', 'h3-done-alt'
  );
  v_padded := public.flowstate_done_for_now(
    'c3c30000-0000-4000-8000-000000000103', true, '2026-07-17', ' h3-done '
  );
  IF v_preview_alt->>'requestHash' IS DISTINCT FROM v_preview->>'requestHash'
     OR v_padded #>> '{error,code}' <> 'invalid_request' THEN
    RAISE EXCEPTION 'FAIL: requestHash was operation-bound or padded identity was accepted';
  END IF;
  v_missing_hash := public.flowstate_done_for_now(
    'c3c30000-0000-4000-8000-000000000103', false, '2026-07-17',
    'h3-done', v_preview->>'previewVersion'
  );
  IF v_missing_hash #>> '{error,code}' <> 'request_hash_required' THEN
    RAISE EXCEPTION 'FAIL: old done-for-now apply did not fail closed: %', v_missing_hash;
  END IF;
  v_apply := public.flowstate_done_for_now(
    'c3c30000-0000-4000-8000-000000000103', false, '2026-07-17',
    'h3-done', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_apply, 'committed', 'h3-done', 2);
  IF v_apply #>> '{receipt,contractVersion}' <> 'task-v1'
     OR v_apply #>> '{receipt,action}' <> 'done_for_now'
     OR v_apply #>> '{receipt,affected,0,action}' <> 'update'
     OR v_apply #>> '{receipt,affected,1,action}' <> 'create'
     OR v_apply #>> '{receipt,readBack,id}' <> 'c3c30000-0000-4000-8000-000000000103'
     OR v_apply #>> '{receipt,readBack,completedOccurrence,id}'
       <> v_apply #>> '{receipt,affected,1,entityId}'
     OR v_apply #> '{receipt,readBack,nextOccurrence}' IS NULL THEN
    RAISE EXCEPTION 'FAIL: done-for-now receipt action linkage is wrong: %', v_apply;
  END IF;
  v_request_hash := v_apply->>'requestHash';
  v_replay := public.flowstate_done_for_now(
    'c3c30000-0000-4000-8000-000000000103', false, '2026-07-17',
    'h3-done', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_replay, 'replayed', 'h3-done', 2);
  IF v_replay->>'requestHash' <> v_request_hash
     OR v_replay #>> '{receipt,readBackHash}' <> v_apply #>> '{receipt,readBackHash}' THEN
    RAISE EXCEPTION 'FAIL: done-for-now replay changed canonical evidence';
  END IF;
  v_wrong_hash := public.flowstate_done_for_now(
    'c3c30000-0000-4000-8000-000000000103', false, '2026-07-17',
    'h3-done', v_preview->>'previewVersion', NULL, repeat('0', 64)
  );
  IF v_wrong_hash #>> '{error,code}' <> 'request_hash_mismatch' THEN
    RAISE EXCEPTION 'FAIL: done-for-now replay accepted a wrong requestHash: %', v_wrong_hash;
  END IF;
  v_conflict := public.flowstate_done_for_now(
    'c3c30000-0000-4000-8000-000000000103', false, '2026-07-18',
    'h3-done', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
  );
  IF v_conflict #>> '{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'FAIL: done-for-now changed payload did not conflict: %', v_conflict;
  END IF;
END;
$$;

DO $$
DECLARE
  v_preview jsonb;
  v_apply jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_missing_hash jsonb;
  v_wrong_hash jsonb;
BEGIN
  v_preview := public.flowstate_merge_tasks(
    'c3c30000-0000-4000-8000-000000000104',
    'c3c30000-0000-4000-8000-000000000105', true, 'h3-merge'
  );
  PERFORM pg_temp.assert_canonical_preview(v_preview, 'h3-merge', 'task-v1');
  IF v_preview->>'requestHash' IS DISTINCT FROM encode(digest(convert_to(
    public.flowstate_canonical_json_text_v1(jsonb_build_object(
      'actorUserId', 'c3c30000-0000-4000-8000-000000000001'::uuid,
      'contractVersion', 'task-v1', 'source', 'local-api', 'action', 'merge',
      'survivorTaskId', 'c3c30000-0000-4000-8000-000000000104',
      'duplicateTaskId', 'c3c30000-0000-4000-8000-000000000105',
      'normalizedPayload', '{}'::jsonb,
      'previewVersion', v_preview->>'previewVersion', 'workspaceId', NULL
    )), 'UTF8'), 'sha256'), 'hex') THEN
    RAISE EXCEPTION 'FAIL: merge requestHash vector drifted: %', v_preview;
  END IF;
  v_missing_hash := public.flowstate_merge_tasks(
    'c3c30000-0000-4000-8000-000000000104',
    'c3c30000-0000-4000-8000-000000000105', false,
    'h3-merge', v_preview->>'previewVersion'
  );
  IF v_missing_hash #>> '{error,code}' <> 'request_hash_required' THEN
    RAISE EXCEPTION 'FAIL: old merge apply did not fail closed: %', v_missing_hash;
  END IF;
  v_apply := public.flowstate_merge_tasks(
    'c3c30000-0000-4000-8000-000000000104',
    'c3c30000-0000-4000-8000-000000000105', false,
    'h3-merge', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_apply, 'committed', 'h3-merge', 2);
  IF v_apply #>> '{receipt,contractVersion}' <> 'task-v1'
     OR v_apply #>> '{receipt,action}' <> 'merge'
     OR v_apply #>> '{receipt,affected,0,action}' <> 'update'
     OR v_apply #>> '{receipt,affected,1,action}' <> 'archive'
     OR v_apply #>> '{receipt,readBack,id}' <> 'c3c30000-0000-4000-8000-000000000104'
     OR v_apply #>> '{receipt,readBack,survivorTaskId}' <> 'c3c30000-0000-4000-8000-000000000104'
     OR v_apply #>> '{receipt,readBack,duplicateTaskId}' <> 'c3c30000-0000-4000-8000-000000000105'
     OR (v_apply #>> '{receipt,readBack,duplicateArchived}')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: merge receipt action linkage is wrong: %', v_apply;
  END IF;
  v_replay := public.flowstate_merge_tasks(
    'c3c30000-0000-4000-8000-000000000104',
    'c3c30000-0000-4000-8000-000000000105', false,
    'h3-merge', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_replay, 'replayed', 'h3-merge', 2);
  IF v_replay #>> '{receipt,readBackHash}' <> v_apply #>> '{receipt,readBackHash}' THEN
    RAISE EXCEPTION 'FAIL: merge replay changed canonical evidence';
  END IF;
  v_wrong_hash := public.flowstate_merge_tasks(
    'c3c30000-0000-4000-8000-000000000104',
    'c3c30000-0000-4000-8000-000000000105', false,
    'h3-merge', v_preview->>'previewVersion', NULL, repeat('0', 64)
  );
  IF v_wrong_hash #>> '{error,code}' <> 'request_hash_mismatch' THEN
    RAISE EXCEPTION 'FAIL: merge replay accepted a wrong requestHash: %', v_wrong_hash;
  END IF;
  v_conflict := public.flowstate_merge_tasks(
    'c3c30000-0000-4000-8000-000000000105',
    'c3c30000-0000-4000-8000-000000000104', false,
    'h3-merge', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
  );
  IF v_conflict #>> '{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'FAIL: merge changed payload did not conflict: %', v_conflict;
  END IF;
END;
$$;

DO $$
DECLARE
  v_preview jsonb;
  v_apply jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_unresolved jsonb;
  v_missing_hash jsonb;
  v_wrong_hash jsonb;
BEGIN
  v_unresolved := public.flowstate_merge_tasks(
    'c3c30000-0000-4000-8000-000000000110',
    'c3c30000-0000-4000-8000-000000000111', true
  );
  IF v_unresolved #>> '{error,code}' <> 'incompatible_recurrence'
     OR EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id = 'h3-unresolved') THEN
    RAISE EXCEPTION 'FAIL: unresolved recurrence semantics changed: %', v_unresolved;
  END IF;

  v_preview := public.flowstate_merge_tasks_with_recurrence(
    'c3c30000-0000-4000-8000-000000000106',
    'c3c30000-0000-4000-8000-000000000107',
    '{"pattern":"daily","interval":3,"endType":"never"}', true,
    'h3-recurrence-merge'
  );
  PERFORM pg_temp.assert_canonical_preview(
    v_preview, 'h3-recurrence-merge', 'task-v1'
  );
  IF v_preview->>'requestHash' IS DISTINCT FROM encode(digest(convert_to(
    public.flowstate_canonical_json_text_v1(jsonb_build_object(
      'actorUserId', 'c3c30000-0000-4000-8000-000000000001'::uuid,
      'contractVersion', 'task-v1', 'source', 'local-api', 'action', 'merge',
      'survivorTaskId', 'c3c30000-0000-4000-8000-000000000106',
      'duplicateTaskId', 'c3c30000-0000-4000-8000-000000000107',
      'normalizedPayload', jsonb_build_object(
        'recurrenceResolution', '{"pattern":"daily","interval":3,"endType":"never"}'::jsonb
      ),
      'previewVersion', v_preview->>'previewVersion', 'workspaceId', NULL
    )), 'UTF8'), 'sha256'), 'hex') THEN
    RAISE EXCEPTION 'FAIL: recurrence merge requestHash vector drifted: %', v_preview;
  END IF;
  v_missing_hash := public.flowstate_merge_tasks_with_recurrence(
    'c3c30000-0000-4000-8000-000000000106',
    'c3c30000-0000-4000-8000-000000000107',
    '{"pattern":"daily","interval":3,"endType":"never"}', false,
    'h3-recurrence-merge', v_preview->>'previewVersion'
  );
  IF v_missing_hash #>> '{error,code}' <> 'request_hash_required' THEN
    RAISE EXCEPTION 'FAIL: old recurrence merge apply did not fail closed: %', v_missing_hash;
  END IF;
  v_apply := public.flowstate_merge_tasks_with_recurrence(
    'c3c30000-0000-4000-8000-000000000106',
    'c3c30000-0000-4000-8000-000000000107',
    '{"pattern":"daily","interval":3,"endType":"never"}', false,
    'h3-recurrence-merge', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_apply, 'committed', 'h3-recurrence-merge', 2);
  IF v_apply #>> '{receipt,contractVersion}' <> 'task-v1'
     OR v_apply #>> '{receipt,action}' <> 'merge'
     OR v_apply #>> '{receipt,affected,0,action}' <> 'update'
     OR v_apply #>> '{receipt,affected,1,action}' <> 'archive' THEN
    RAISE EXCEPTION 'FAIL: recurrence merge receipt action linkage is wrong: %', v_apply;
  END IF;
  v_replay := public.flowstate_merge_tasks_with_recurrence(
    'c3c30000-0000-4000-8000-000000000106',
    'c3c30000-0000-4000-8000-000000000107',
    '{"pattern":"daily","interval":3,"endType":"never"}', false,
    'h3-recurrence-merge', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
  );
  PERFORM pg_temp.assert_canonical_envelope(v_replay, 'replayed', 'h3-recurrence-merge', 2);
  v_wrong_hash := public.flowstate_merge_tasks_with_recurrence(
    'c3c30000-0000-4000-8000-000000000106',
    'c3c30000-0000-4000-8000-000000000107',
    '{"pattern":"daily","interval":3,"endType":"never"}', false,
    'h3-recurrence-merge', v_preview->>'previewVersion', NULL, repeat('0', 64)
  );
  IF v_wrong_hash #>> '{error,code}' <> 'request_hash_mismatch' THEN
    RAISE EXCEPTION 'FAIL: recurrence replay accepted a wrong requestHash: %', v_wrong_hash;
  END IF;
  v_conflict := public.flowstate_merge_tasks_with_recurrence(
    'c3c30000-0000-4000-8000-000000000106',
    'c3c30000-0000-4000-8000-000000000107',
    '{"pattern":"daily","interval":4,"endType":"never"}', false,
    'h3-recurrence-merge', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
  );
  IF v_conflict #>> '{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'FAIL: recurrence changed payload did not conflict: %', v_conflict;
  END IF;
END;
$$;

CREATE FUNCTION pg_temp.force_h3_merge_failure()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id::text = 'c3c30000-0000-4000-8000-000000000109'
     AND NEW.is_deleted THEN
    RAISE EXCEPTION 'forced H3 merge rollback';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER force_h3_merge_failure
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION pg_temp.force_h3_merge_failure();

DO $$
DECLARE
  v_preview jsonb;
BEGIN
  v_preview := public.flowstate_merge_tasks(
    'c3c30000-0000-4000-8000-000000000108',
    'c3c30000-0000-4000-8000-000000000109', true, 'h3-rollback'
  );
  BEGIN
    PERFORM public.flowstate_merge_tasks(
      'c3c30000-0000-4000-8000-000000000108',
      'c3c30000-0000-4000-8000-000000000109', false,
      'h3-rollback', v_preview->>'previewVersion', NULL, v_preview->>'requestHash'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'forced H3 merge rollback' THEN RAISE; END IF;
  END;

  IF EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id = 'h3-rollback')
     OR EXISTS (
       SELECT 1 FROM public.flowstate_action_receipts
       WHERE operation = 'merge_tasks' AND request_id = 'h3-rollback'
     )
     OR (SELECT is_deleted FROM public.tasks WHERE id = 'c3c30000-0000-4000-8000-000000000109')
     OR (SELECT title FROM public.tasks WHERE id = 'c3c30000-0000-4000-8000-000000000108') <> 'Rollback survivor' THEN
    RAISE EXCEPTION 'FAIL: rollback left a mutation or canonical receipt';
  END IF;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,text)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'
     ) IS NOT NULL
     OR to_regprocedure(
       'public.flowstate_done_for_now(text,boolean,date,text,text,uuid,text)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_merge_tasks(text,text,boolean,text,text,uuid,text)'
     ) IS NULL
     OR to_regprocedure(
       'public.flowstate_merge_tasks_with_recurrence(text,text,jsonb,boolean,text,text,uuid,text)'
     ) IS NULL THEN
    RAISE EXCEPTION 'FAIL: H3 RPC signatures are ambiguous or incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.canonical_operations AS operation
    WHERE operation.operation_id IN (
      'h3-patch', 'h3-complete', 'h3-done', 'h3-merge', 'h3-recurrence-merge'
    )
      AND (
        operation.request_hash !~ '^[0-9a-f]{64}$'
        OR operation.state <> 'committed'
        OR operation.operation_context = '{}'::jsonb
        OR jsonb_array_length(operation.affected_entities) < 1
        OR operation.canonical_result->>'requestHash' <> operation.request_hash
      )
  ) OR (
    SELECT count(*) FROM public.canonical_operations
    WHERE operation_id IN (
      'h3-patch', 'h3-complete', 'h3-done', 'h3-merge', 'h3-recurrence-merge'
    )
  ) <> 5 THEN
    RAISE EXCEPTION 'FAIL: canonical operation ledger linkage is incomplete';
  END IF;
END;
$$;

ROLLBACK;
