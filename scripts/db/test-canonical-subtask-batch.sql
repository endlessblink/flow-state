-- Rollback-only proof for canonical ordered subtask batch mutations.
BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, confirmation_token, recovery_token
) VALUES
('5b700000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','subtask-owner@test.flowstate','',now(),now(),now(),'{}','{}','authenticated','authenticated','',''),
('5b700000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','subtask-other@test.flowstate','',now(),now(),now(),'{}','{}','authenticated','authenticated','','');

INSERT INTO public.workspaces (id,name,owner_id) VALUES
('5b700000-0000-4000-8000-000000000010','Subtask shared workspace','5b700000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members (id,workspace_id,user_id,role) VALUES
('5b700000-0000-4000-8000-000000000011','5b700000-0000-4000-8000-000000000010','5b700000-0000-4000-8000-000000000002','member');

INSERT INTO public.tasks (id,user_id,title,status,is_deleted,instances,subtasks,is_in_inbox) VALUES
('5b700000-0000-4000-8000-000000000101','5b700000-0000-4000-8000-000000000001','Subtask batch fixture','planned',false,'[]','[]',true),
('5b700000-0000-4000-8000-000000000102','5b700000-0000-4000-8000-000000000002','Foreign subtask fixture','planned',false,'[]','[]',true),
('5b700000-0000-4000-8000-000000000103','5b700000-0000-4000-8000-000000000001','Rollback subtask fixture','planned',false,'[]','[]',true),
('5b700000-0000-4000-8000-000000000104','5b700000-0000-4000-8000-000000000001','Malformed subtask fixture','planned',false,'[]','["broken"]',true),
('5b700000-0000-4000-8000-000000000105','5b700000-0000-4000-8000-000000000001','Unverifiable subtask fixture','planned',false,'[]','[{"id":"legacy-float","title":"Legacy float","canvasPosition":{"x":1.5,"y":2}}]',true),
('5b700000-0000-4000-8000-000000000106','5b700000-0000-4000-8000-000000000001','Duplicate subtask fixture','planned',false,'[]','[{"id":"duplicate","title":"First"},{"id":"duplicate","title":"Second"}]',true);
INSERT INTO public.tasks (id,user_id,workspace_id,title,status,is_deleted,instances,subtasks,is_in_inbox) VALUES
('5b700000-0000-4000-8000-000000000107','5b700000-0000-4000-8000-000000000001','5b700000-0000-4000-8000-000000000010','Shared subtask fixture','planned',false,'[]','[]',true);

SELECT set_config('request.jwt.claim.sub','5b700000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"5b700000-0000-4000-8000-000000000001","role":"authenticated"}',true);

CREATE TEMP TABLE subtask_results(key text PRIMARY KEY,payload jsonb NOT NULL) ON COMMIT DROP;

INSERT INTO subtask_results SELECT 'preview', public.flowstate_subtask_batch_v1(
  'subtask-batch-create-update-delete','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000101',1,
  '[
    {"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000201","title":"First","doneEnough":"Draft is reviewable","estimateMinutes":30},"order":0},
    {"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000202","title":"Temporary","doneEnough":"Decision captured","estimateMinutes":10},"order":1},
    {"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000206","title":"Keeper","doneEnough":"Keeper remains"},"order":2},
    {"action":"update","subtaskId":"5b700000-0000-4000-8000-000000000201","patch":{"title":"First revised","isCompleted":true,"completedPomodoros":2,"doneEnough":"Review accepted","estimateMinutes":45},"order":2},
    {"action":"delete","subtaskId":"5b700000-0000-4000-8000-000000000202"}
  ]', true
);
INSERT INTO subtask_results
SELECT 'apply', public.flowstate_subtask_batch_v1(
  'subtask-batch-create-update-delete','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000101',1,
  '[
    {"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000201","title":"First","doneEnough":"Draft is reviewable","estimateMinutes":30},"order":0},
    {"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000202","title":"Temporary","doneEnough":"Decision captured","estimateMinutes":10},"order":1},
    {"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000206","title":"Keeper","doneEnough":"Keeper remains"},"order":2},
    {"action":"update","subtaskId":"5b700000-0000-4000-8000-000000000201","patch":{"title":"First revised","isCompleted":true,"completedPomodoros":2,"doneEnough":"Review accepted","estimateMinutes":45},"order":2},
    {"action":"delete","subtaskId":"5b700000-0000-4000-8000-000000000202"}
  ]', false, preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz,
  p_approved_subtask_ids => '["5b700000-0000-4000-8000-000000000206","5b700000-0000-4000-8000-000000000201"]'
) FROM subtask_results preview WHERE key='preview';
INSERT INTO subtask_results
SELECT 'replay', public.flowstate_subtask_batch_v1(
  'subtask-batch-create-update-delete','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000101',1,
  '[
    {"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000201","title":"First","doneEnough":"Draft is reviewable","estimateMinutes":30},"order":0},
    {"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000202","title":"Temporary","doneEnough":"Decision captured","estimateMinutes":10},"order":1},
    {"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000206","title":"Keeper","doneEnough":"Keeper remains"},"order":2},
    {"action":"update","subtaskId":"5b700000-0000-4000-8000-000000000201","patch":{"title":"First revised","isCompleted":true,"completedPomodoros":2,"doneEnough":"Review accepted","estimateMinutes":45},"order":2},
    {"action":"delete","subtaskId":"5b700000-0000-4000-8000-000000000202"}
  ]', false, preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz,
  p_approved_subtask_ids => '["5b700000-0000-4000-8000-000000000206","5b700000-0000-4000-8000-000000000201"]'
) FROM subtask_results preview WHERE key='preview';

DO $$
DECLARE v_apply jsonb := (SELECT payload FROM subtask_results WHERE key='apply');
        v_replay jsonb := (SELECT payload FROM subtask_results WHERE key='replay');
        v_hash text;
BEGIN
  v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.flowstate_receipt_canonical_json_v1(v_apply #> '{receipt,readBack}'),'UTF8'),'sha256'),'hex');
  IF v_apply->>'status' <> 'committed'
     OR v_apply #>> '{receipt,action}' <> 'subtask_batch'
     OR v_apply #>> '{receipt,canonicalRevision}' <> '2'
     OR v_apply #>> '{receipt,readBackHash}' <> v_hash
     OR pg_catalog.jsonb_array_length(v_apply #> '{receipt,readBack,subtasks}') <> 2
     OR v_apply #>> '{receipt,readBack,subtasks,0,id}' <> '5b700000-0000-4000-8000-000000000206'
     OR v_apply #>> '{receipt,readBack,subtasks,1,id}' <> '5b700000-0000-4000-8000-000000000201'
     OR v_apply #>> '{receipt,readBack,subtasks,1,title}' <> 'First revised'
     OR v_apply #>> '{receipt,readBack,subtasks,1,isCompleted}' <> 'true'
     OR v_apply #>> '{receipt,readBack,subtasks,1,doneEnough}' <> 'Review accepted'
     OR v_apply #>> '{receipt,readBack,subtasks,1,estimateMinutes}' <> '45'
     OR v_replay #>> '{receipt,replayed}' <> 'true'
     OR (v_replay #- '{receipt,replayed}') IS DISTINCT FROM (v_apply #- '{receipt,replayed}')
     OR (SELECT count(*) FROM public.canonical_change_log WHERE operation_id='subtask-batch-create-update-delete') <> 1
     OR (v_apply #>> '{receipt,changeSequence}')::bigint IS DISTINCT FROM (
       SELECT change_sequence FROM public.canonical_change_log
       WHERE actor_user_id='5b700000-0000-4000-8000-000000000001'
         AND operation_id='subtask-batch-create-update-delete'
         AND entity_id='5b700000-0000-4000-8000-000000000101'
         AND canonical_revision=2
     ) THEN
    RAISE EXCEPTION 'FAIL: canonical subtask batch receipt/readback/replay diverged: %, %',v_apply,v_replay;
  END IF;
END $$;

-- Approval tokens bind the exact normalized payload, digest, and expiry, and
-- an operation id cannot be reused for a different payload before or after commit.
INSERT INTO subtask_results SELECT 'approval_preview', public.flowstate_subtask_batch_v1(
  'subtask-approval-guards','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000207","title":"Approved","doneEnough":"Approved result exists"}}]',true);
INSERT INTO subtask_results SELECT 'altered_apply', public.flowstate_subtask_batch_v1(
  'subtask-approval-guards','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000207","title":"Altered","doneEnough":"Altered result exists"}}]',false,
  preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz,
  p_approved_subtask_ids => '["5b700000-0000-4000-8000-000000000207"]')
FROM subtask_results preview WHERE key='approval_preview';
INSERT INTO subtask_results SELECT 'wrong_digest', public.flowstate_subtask_batch_v1(
  'subtask-approval-guards','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000207","title":"Approved","doneEnough":"Approved result exists"}}]',false,
  repeat('0',64),(preview.payload->>'previewExpiresAt')::timestamptz,
  p_approved_subtask_ids => '["5b700000-0000-4000-8000-000000000207"]')
FROM subtask_results preview WHERE key='approval_preview';
INSERT INTO subtask_results SELECT 'wrong_expiry', public.flowstate_subtask_batch_v1(
  'subtask-approval-guards','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000207","title":"Approved","doneEnough":"Approved result exists"}}]',false,
  preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz + interval '1 second',
  p_approved_subtask_ids => '["5b700000-0000-4000-8000-000000000207"]')
FROM subtask_results preview WHERE key='approval_preview';
INSERT INTO subtask_results SELECT 'wrong_approved_order', public.flowstate_subtask_batch_v1(
  'subtask-approval-guards','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000207","title":"Approved","doneEnough":"Approved result exists"}}]',false,
  preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz,
  p_approved_subtask_ids => '[]')
FROM subtask_results preview WHERE key='approval_preview';
INSERT INTO subtask_results SELECT 'different_before_commit', public.flowstate_subtask_batch_v1(
  'subtask-approval-guards','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000207","title":"Different preview","doneEnough":"Different result exists"}}]',true);
INSERT INTO subtask_results SELECT 'different_after_commit', public.flowstate_subtask_batch_v1(
  'subtask-batch-create-update-delete','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000101',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000209","title":"Different replay","doneEnough":"Must never be written"}}]',false,
  preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz,
  p_approved_subtask_ids => '["5b700000-0000-4000-8000-000000000206","5b700000-0000-4000-8000-000000000201"]')
FROM subtask_results preview WHERE key='preview';

INSERT INTO subtask_results SELECT 'expired_preview', public.flowstate_subtask_batch_v1(
  'subtask-expired-approval','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000208","title":"Expired","doneEnough":"Must be approved again"}}]',true);
UPDATE public.canonical_operation_previews
SET expires_at=pg_catalog.clock_timestamp() - interval '1 second'
WHERE user_id='5b700000-0000-4000-8000-000000000001' AND operation_id='subtask-expired-approval';
INSERT INTO subtask_results SELECT 'expired_apply', public.flowstate_subtask_batch_v1(
  'subtask-expired-approval','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000208","title":"Expired","doneEnough":"Must be approved again"}}]',false,
  preview.payload->>'previewDigest',issued.expires_at,
  p_approved_subtask_ids => '["5b700000-0000-4000-8000-000000000208"]')
FROM subtask_results preview
JOIN public.canonical_operation_previews issued
  ON issued.user_id='5b700000-0000-4000-8000-000000000001'
 AND issued.operation_id='subtask-expired-approval'
WHERE preview.key='expired_preview';

DO $$
BEGIN
  IF (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='altered_apply') <> 'preview_mismatch'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='wrong_digest') <> 'preview_mismatch'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='wrong_expiry') <> 'preview_mismatch'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='wrong_approved_order') <> 'approval_mismatch'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='different_before_commit') <> 'idempotency_conflict'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='different_after_commit') <> 'idempotency_conflict'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='expired_apply') <> 'preview_expired'
     OR EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id IN ('subtask-approval-guards','subtask-expired-approval'))
     OR EXISTS (SELECT 1 FROM public.canonical_change_log WHERE operation_id IN ('subtask-approval-guards','subtask-expired-approval'))
     OR EXISTS (
       SELECT 1 FROM public.canonical_operation_previews
       WHERE operation_id IN ('subtask-approval-guards','subtask-expired-approval') AND consumed_at IS NOT NULL
     )
     OR (SELECT canonical_revision FROM public.tasks WHERE id='5b700000-0000-4000-8000-000000000103') <> 1
     OR (SELECT subtasks FROM public.tasks WHERE id='5b700000-0000-4000-8000-000000000103') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: subtask approval binding or operation-id durability diverged: %',
      (SELECT pg_catalog.jsonb_object_agg(key,payload) FROM subtask_results
       WHERE key IN ('altered_apply','wrong_digest','wrong_expiry','wrong_approved_order','different_before_commit','different_after_commit','expired_apply'));
  END IF;
END $$;

-- A current workspace member may preview, but removal invalidates that approval
-- before apply and blocks fresh previews without consuming or writing anything.
SELECT set_config('request.jwt.claim.sub','5b700000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"5b700000-0000-4000-8000-000000000002","role":"authenticated"}',true);
INSERT INTO subtask_results SELECT 'workspace_preview', public.flowstate_subtask_batch_v1(
  'subtask-workspace-membership','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000107',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000210","title":"Shared","doneEnough":"Member result exists"}}]',true,
  NULL,NULL,'5b700000-0000-4000-8000-000000000010');
DELETE FROM public.workspace_members
WHERE workspace_id='5b700000-0000-4000-8000-000000000010' AND user_id='5b700000-0000-4000-8000-000000000002';
INSERT INTO subtask_results SELECT 'workspace_apply_removed', public.flowstate_subtask_batch_v1(
  'subtask-workspace-membership','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000107',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000210","title":"Shared","doneEnough":"Member result exists"}}]',false,
  preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz,'5b700000-0000-4000-8000-000000000010',
  '["5b700000-0000-4000-8000-000000000210"]')
FROM subtask_results preview WHERE key='workspace_preview';
INSERT INTO subtask_results SELECT 'workspace_preview_removed', public.flowstate_subtask_batch_v1(
  'subtask-workspace-after-removal','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000107',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000211","title":"Removed","doneEnough":"Must not happen"}}]',true,
  NULL,NULL,'5b700000-0000-4000-8000-000000000010');
DO $$
BEGIN
  IF (SELECT payload->>'result' FROM subtask_results WHERE key='workspace_preview') <> 'preview'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='workspace_apply_removed') <> 'not_found'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='workspace_preview_removed') <> 'not_found'
     OR EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id IN ('subtask-workspace-membership','subtask-workspace-after-removal'))
     OR EXISTS (SELECT 1 FROM public.canonical_change_log WHERE operation_id IN ('subtask-workspace-membership','subtask-workspace-after-removal'))
     OR (SELECT consumed_at FROM public.canonical_operation_previews WHERE user_id='5b700000-0000-4000-8000-000000000002' AND operation_id='subtask-workspace-membership') IS NOT NULL
     OR (SELECT canonical_revision FROM public.tasks WHERE id='5b700000-0000-4000-8000-000000000107') <> 1
     OR (SELECT subtasks FROM public.tasks WHERE id='5b700000-0000-4000-8000-000000000107') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: removed workspace member retained canonical subtask write authority';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','5b700000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"5b700000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- Invalid, stale, foreign, duplicate-id, and semantic no-op requests fail closed.
INSERT INTO subtask_results SELECT 'missing_done', public.flowstate_subtask_batch_v1(
  'subtask-missing-done','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000101',2,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000203","title":"Unsafe"}}]',true);
INSERT INTO subtask_results SELECT 'stale', public.flowstate_subtask_batch_v1(
  'subtask-stale','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000101',1,
  '[{"action":"update","subtaskId":"5b700000-0000-4000-8000-000000000201","patch":{"title":"Stale"}}]',true);
INSERT INTO subtask_results SELECT 'foreign', public.flowstate_subtask_batch_v1(
  'subtask-foreign','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000102',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000204","title":"Foreign","doneEnough":"Must not happen"}}]',true);
INSERT INTO subtask_results SELECT 'no_change', public.flowstate_subtask_batch_v1(
  'subtask-no-change','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000101',2,
  '[{"action":"update","subtaskId":"5b700000-0000-4000-8000-000000000201","patch":{"title":"First revised"}}]',true);
INSERT INTO subtask_results SELECT 'invalid_existing', public.flowstate_subtask_batch_v1(
  'subtask-invalid-existing','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000104',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000206","title":"Must not commit","doneEnough":"Never written"}}]',true);
INSERT INTO subtask_results SELECT 'unsupported_legacy', public.flowstate_subtask_batch_v1(
  'subtask-unsupported-legacy','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000105',1,
  '[{"action":"update","subtaskId":"legacy-float","patch":{"title":"Must not commit"}}]',true);
INSERT INTO subtask_results SELECT 'duplicate_update', public.flowstate_subtask_batch_v1(
  'subtask-duplicate-update','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000106',1,
  '[{"action":"update","subtaskId":"duplicate","patch":{"title":"Must not collapse"}}]',true);
INSERT INTO subtask_results SELECT 'duplicate_delete', public.flowstate_subtask_batch_v1(
  'subtask-duplicate-delete','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000106',1,
  '[{"action":"delete","subtaskId":"duplicate"}]',true);
DO $$ BEGIN
  IF (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='missing_done') <> 'invalid_subtask'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='stale') <> 'stale_revision'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='foreign') <> 'not_found'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='no_change') <> 'no_change'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='invalid_existing') <> 'invalid_existing_subtasks'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='unsupported_legacy') <> 'unsupported_legacy_subtask_shape'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='duplicate_update') <> 'invalid_existing_subtasks'
     OR (SELECT payload #>> '{error,code}' FROM subtask_results WHERE key='duplicate_delete') <> 'invalid_existing_subtasks'
     OR EXISTS (SELECT 1 FROM public.canonical_operation_previews WHERE operation_id IN ('subtask-missing-done','subtask-stale','subtask-foreign','subtask-no-change','subtask-invalid-existing','subtask-unsupported-legacy','subtask-duplicate-update','subtask-duplicate-delete'))
     OR EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id IN ('subtask-invalid-existing','subtask-unsupported-legacy','subtask-duplicate-update','subtask-duplicate-delete'))
     OR EXISTS (SELECT 1 FROM public.canonical_change_log WHERE operation_id IN ('subtask-invalid-existing','subtask-unsupported-legacy','subtask-duplicate-update','subtask-duplicate-delete'))
     OR (SELECT canonical_revision FROM public.tasks WHERE id='5b700000-0000-4000-8000-000000000105') <> 1
     OR (SELECT canonical_revision FROM public.tasks WHERE id='5b700000-0000-4000-8000-000000000106') <> 1
     OR (SELECT subtasks FROM public.tasks WHERE id='5b700000-0000-4000-8000-000000000106')
       <> '[{"id":"duplicate","title":"First"},{"id":"duplicate","title":"Second"}]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: invalid subtask batch escaped fail-closed validation';
  END IF;
END $$;

-- An apply exception rolls back operation, preview consumption, task, revision, and change event.
CREATE FUNCTION pg_temp.fail_subtask_batch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_catalog.current_setting('flowstate.canonical.operation_id',true)='subtask-injected-failure' THEN
    RAISE EXCEPTION 'injected subtask batch failure';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fail_subtask_batch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_subtask_batch();
INSERT INTO subtask_results SELECT 'failure_preview', public.flowstate_subtask_batch_v1(
  'subtask-injected-failure','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
  '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000205","title":"Rollback","doneEnough":"Never persisted"}}]',true);
DO $$
DECLARE v_preview jsonb := (SELECT payload FROM subtask_results WHERE key='failure_preview');
BEGIN
  BEGIN
    PERFORM public.flowstate_subtask_batch_v1(
      'subtask-injected-failure','subtask-batch-v1','local-api','5b700000-0000-4000-8000-000000000103',1,
      '[{"action":"create","subtask":{"id":"5b700000-0000-4000-8000-000000000205","title":"Rollback","doneEnough":"Never persisted"}}]',false,
      v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,
      p_approved_subtask_ids => '["5b700000-0000-4000-8000-000000000205"]');
    RAISE EXCEPTION 'FAIL: injected subtask batch failure did not fire';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%injected subtask batch failure%' THEN RAISE; END IF;
  END;
  IF (SELECT canonical_revision FROM public.tasks WHERE id='5b700000-0000-4000-8000-000000000103') <> 1
     OR (SELECT subtasks FROM public.tasks WHERE id='5b700000-0000-4000-8000-000000000103') <> '[]'::jsonb
     OR EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id='subtask-injected-failure')
     OR EXISTS (SELECT 1 FROM public.canonical_change_log WHERE operation_id='subtask-injected-failure')
     OR (SELECT consumed_at FROM public.canonical_operation_previews WHERE operation_id='subtask-injected-failure') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: failed subtask batch apply left partial canonical state';
  END IF;
END $$;

ROLLBACK;
SELECT 'PASS: canonical subtask ordering, stable IDs, CAS, replay, scope, and rollback';
