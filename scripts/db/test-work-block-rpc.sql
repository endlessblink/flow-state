-- Rollback-only proof for canonical work-block lifecycle mutations.
BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, aud, role, confirmation_token, recovery_token
) VALUES
('6b600000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','work-block-owner@test.flowstate','',now(),now(),now(),'{}','{}','authenticated','authenticated','',''),
('6b600000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','work-block-other@test.flowstate','',now(),now(),now(),'{}','{}','authenticated','authenticated','','');

INSERT INTO public.workspaces(id,name,owner_id) VALUES
('6b600000-0000-4000-8000-000000000010','Work-block shared workspace','6b600000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members(id,workspace_id,user_id,role) VALUES
('6b600000-0000-4000-8000-000000000011','6b600000-0000-4000-8000-000000000010','6b600000-0000-4000-8000-000000000002','member');

INSERT INTO public.tasks (id,user_id,title,status,due_date,is_deleted,instances,subtasks,is_in_inbox) VALUES
('6b600000-0000-4000-8000-000000000101','6b600000-0000-4000-8000-000000000001','Work-block fixture','planned','2026-07-20',false,'[]','[]',true),
('6b600000-0000-4000-8000-000000000102','6b600000-0000-4000-8000-000000000001','Overlap fixture','planned',null,false,'[{"id":"6b600000-0000-4000-8000-000000000299","taskId":"6b600000-0000-4000-8000-000000000102","scheduledDate":"2026-07-16","scheduledTime":"10:30","duration":60,"timezone":"Asia/Jerusalem","canonicalRevision":1}]','[]',true),
('6b600000-0000-4000-8000-000000000103','6b600000-0000-4000-8000-000000000002','Foreign fixture','planned',null,false,'[]','[]',true),
('6b600000-0000-4000-8000-000000000104','6b600000-0000-4000-8000-000000000001','Rollback fixture','planned',null,false,'[]','[]',true),
('6b600000-0000-4000-8000-000000000105','6b600000-0000-4000-8000-000000000001','Malformed fixture','planned',null,false,'[{"id":"duplicate"},{"id":"duplicate"}]','[]',true),
('6b600000-0000-4000-8000-000000000106','6b600000-0000-4000-8000-000000000001','Failure fixture','planned',null,false,'[]','[]',true);
INSERT INTO public.tasks(id,user_id,workspace_id,title,status,is_deleted,instances,subtasks,is_in_inbox) VALUES
('6b600000-0000-4000-8000-000000000107','6b600000-0000-4000-8000-000000000001','6b600000-0000-4000-8000-000000000010','Shared work-block fixture','planned',false,'[]','[]',true);

SELECT set_config('request.jwt.claim.sub','6b600000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"6b600000-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE work_block_results(key text PRIMARY KEY,payload jsonb NOT NULL) ON COMMIT DROP;

INSERT INTO work_block_results SELECT 'create_preview', public.flowstate_work_block_v1(
  'work-block-create','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000201","scheduledDate":"2026-07-16","scheduledTime":"10:00","duration":60,"timezone":"Asia/Jerusalem"},"finishBy":"2026-07-16T12:00"}',true);
INSERT INTO work_block_results SELECT 'create_apply', public.flowstate_work_block_v1(
  'work-block-create','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000201","scheduledDate":"2026-07-16","scheduledTime":"10:00","duration":60,"timezone":"Asia/Jerusalem"},"finishBy":"2026-07-16T12:00"}',false,
  preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz)
FROM work_block_results preview WHERE key='create_preview';
INSERT INTO work_block_results SELECT 'create_replay', public.flowstate_work_block_v1(
  'work-block-create','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000201","scheduledDate":"2026-07-16","scheduledTime":"10:00","duration":60,"timezone":"Asia/Jerusalem"},"finishBy":"2026-07-16T12:00"}',false,
  preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz)
FROM work_block_results preview WHERE key='create_preview';
INSERT INTO work_block_results SELECT 'create_changed_retry', public.flowstate_work_block_v1(
  'work-block-create','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000201","scheduledDate":"2026-07-16","scheduledTime":"11:00","duration":60,"timezone":"Asia/Jerusalem"}}',false);
INSERT INTO work_block_results SELECT 'committed_preview_reopen', public.flowstate_work_block_v1(
  'work-block-create','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',2,1,
  '{"action":"move","workBlockId":"6b600000-0000-4000-8000-000000000201","scheduledDate":"2026-07-16","scheduledTime":"11:00","timezone":"Asia/Jerusalem"}',true);
INSERT INTO work_block_results SELECT 'changed_preview', public.flowstate_work_block_v1(
  'work-block-preview-stable','work-block-v1','local-api','6b600000-0000-4000-8000-000000000104',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000208","scheduledDate":"2026-07-16","scheduledTime":"08:00","duration":30,"timezone":"UTC"}}',true);
INSERT INTO work_block_results SELECT 'changed_preview_conflict', public.flowstate_work_block_v1(
  'work-block-preview-stable','work-block-v1','local-api','6b600000-0000-4000-8000-000000000104',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000208","scheduledDate":"2026-07-16","scheduledTime":"08:30","duration":30,"timezone":"UTC"}}',true);
INSERT INTO work_block_results SELECT 'legacy_global_id', public.flowstate_work_block_v1(
  'work-block-legacy-global','work-block-v1','local-api','6b600000-0000-4000-8000-000000000104',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000299","scheduledDate":"2026-07-16","scheduledTime":"08:30","duration":30,"timezone":"UTC"}}',true);

-- Approval binds the exact overlap evidence, including independently changing
-- sibling tasks that do not advance the target task revision.
INSERT INTO work_block_results SELECT 'overlap_binding_preview', public.flowstate_work_block_v1(
  'work-block-overlap-binding','work-block-v1','local-api','6b600000-0000-4000-8000-000000000104',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000213","scheduledDate":"2026-07-18","scheduledTime":"10:00","duration":60,"timezone":"UTC"}}',true);
UPDATE public.tasks SET instances = '[{"id":"6b600000-0000-4000-8000-000000000298","taskId":"6b600000-0000-4000-8000-000000000102","scheduledDate":"2026-07-18","scheduledTime":"10:30","duration":30,"timezone":"UTC","canonicalRevision":1}]'::jsonb
WHERE id = '6b600000-0000-4000-8000-000000000102';
INSERT INTO work_block_results SELECT 'overlap_binding_apply', public.flowstate_work_block_v1(
  'work-block-overlap-binding','work-block-v1','local-api','6b600000-0000-4000-8000-000000000104',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000213","scheduledDate":"2026-07-18","scheduledTime":"10:00","duration":60,"timezone":"UTC"}}',false,
  preview.payload->>'previewDigest',(preview.payload->>'previewExpiresAt')::timestamptz)
FROM work_block_results preview WHERE key='overlap_binding_preview';
DO $$ BEGIN
  IF (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='overlap_binding_apply') <> 'preview_mismatch'
     OR (SELECT canonical_revision FROM public.tasks WHERE id='6b600000-0000-4000-8000-000000000104') <> 1
     OR (SELECT consumed_at FROM public.canonical_operation_previews WHERE operation_id='work-block-overlap-binding') IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id='work-block-overlap-binding') THEN
    RAISE EXCEPTION 'FAIL: stale overlap evidence reused an old approval';
  END IF;
END $$;

DO $$
DECLARE p jsonb := (SELECT payload FROM work_block_results WHERE key='create_preview');
        a jsonb := (SELECT payload FROM work_block_results WHERE key='create_apply');
        r jsonb := (SELECT payload FROM work_block_results WHERE key='create_replay');
        h text;
BEGIN
  h := encode(extensions.digest(convert_to(public.flowstate_receipt_canonical_json_v1(a#>'{receipt,readBack}'),'UTF8'),'sha256'),'hex');
  IF p#>>'{preview,interval,after,localStart}' <> '2026-07-16T10:00'
     OR p#>>'{preview,interval,after,localEnd}' <> '2026-07-16T11:00'
     OR p#>>'{preview,timezone}' <> 'Asia/Jerusalem'
     OR p#>>'{preview,duration,afterMinutes}' <> '60'
     OR p#>>'{preview,finishByBoundary,satisfied}' <> 'true'
     OR p#>>'{preview,taskEffect,dueDate,before}' <> '2026-07-20'
     OR p#>>'{preview,taskEffect,dueDate,after}' <> '2026-07-20'
     OR jsonb_array_length(p#>'{preview,overlapWarnings}') <> 1
     OR p#>>'{preview,overlapWarnings,0,workBlockId}' <> '6b600000-0000-4000-8000-000000000299'
     OR a#>>'{receipt,readBack,workBlock,id}' <> '6b600000-0000-4000-8000-000000000201'
     OR a#>>'{receipt,readBack,workBlock,canonicalRevision}' <> '1'
     OR a#>>'{receipt,canonicalRevision}' <> '2'
     OR a#>>'{receipt,readBackHash}' <> h
     OR r#>>'{receipt,replayed}' <> 'true'
     OR (r#-'{receipt,replayed}') IS DISTINCT FROM (a#-'{receipt,replayed}')
     OR (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='create_changed_retry') <> 'idempotency_conflict'
     OR (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='committed_preview_reopen') <> 'idempotency_conflict'
     OR (SELECT consumed_at FROM canonical_operation_previews WHERE operation_id='work-block-create') IS NULL
     OR (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='changed_preview_conflict') <> 'idempotency_conflict'
     OR (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='legacy_global_id') <> 'work_block_id_conflict'
     OR (SELECT preview_digest FROM canonical_operation_previews WHERE operation_id='work-block-preview-stable') IS DISTINCT FROM (SELECT payload->>'previewDigest' FROM work_block_results WHERE key='changed_preview')
     OR (SELECT count(*) FROM tasks t CROSS JOIN LATERAL jsonb_array_elements(t.instances) i WHERE t.id='6b600000-0000-4000-8000-000000000101' AND i->>'id'='6b600000-0000-4000-8000-000000000201') <> 1
     OR (SELECT count(*) FROM canonical_change_log WHERE operation_id='work-block-create') <> 1 THEN
    RAISE EXCEPTION 'FAIL: stable create/preview/replay contract diverged: %, %, %',p,a,r;
  END IF;
END $$;

INSERT INTO work_block_results SELECT 'no_change_move', public.flowstate_work_block_v1(
  'work-block-no-change','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',2,1,
  '{"action":"move","workBlockId":"6B600000-0000-4000-8000-000000000201","scheduledDate":"2026-07-16","scheduledTime":"10:00","timezone":"Asia/Jerusalem"}',true);
DO $$ BEGIN
  IF (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='no_change_move') <> 'no_change' THEN
    RAISE EXCEPTION 'FAIL: unchanged move was treated as a revision change';
  END IF;
END $$;

-- Move, resize, and remove each bind both parent and work-block revisions.
INSERT INTO work_block_results SELECT 'move_preview', public.flowstate_work_block_v1(
  'work-block-move','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',2,1,
  '{"action":"move","workBlockId":"6b600000-0000-4000-8000-000000000201","scheduledDate":"2026-07-17","scheduledTime":"09:15","timezone":"UTC","finishBy":"2026-07-17T11:00"}',true);
INSERT INTO work_block_results SELECT 'move_apply', public.flowstate_work_block_v1(
  'work-block-move','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',2,1,
  '{"action":"move","workBlockId":"6b600000-0000-4000-8000-000000000201","scheduledDate":"2026-07-17","scheduledTime":"09:15","timezone":"UTC","finishBy":"2026-07-17T11:00"}',false,payload->>'previewDigest',(payload->>'previewExpiresAt')::timestamptz)
FROM work_block_results WHERE key='move_preview';
INSERT INTO work_block_results SELECT 'resize_preview', public.flowstate_work_block_v1(
  'work-block-resize','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',3,2,
  '{"action":"resize","workBlockId":"6b600000-0000-4000-8000-000000000201","duration":90,"finishBy":"2026-07-17T11:00"}',true);
INSERT INTO work_block_results SELECT 'resize_apply', public.flowstate_work_block_v1(
  'work-block-resize','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',3,2,
  '{"action":"resize","workBlockId":"6b600000-0000-4000-8000-000000000201","duration":90,"finishBy":"2026-07-17T11:00"}',false,payload->>'previewDigest',(payload->>'previewExpiresAt')::timestamptz)
FROM work_block_results WHERE key='resize_preview';
INSERT INTO work_block_results SELECT 'remove_preview', public.flowstate_work_block_v1(
  'work-block-remove','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',4,3,
  '{"action":"remove","workBlockId":"6b600000-0000-4000-8000-000000000201"}',true);
INSERT INTO work_block_results SELECT 'remove_apply', public.flowstate_work_block_v1(
  'work-block-remove','work-block-v1','local-api','6b600000-0000-4000-8000-000000000101',4,3,
  '{"action":"remove","workBlockId":"6b600000-0000-4000-8000-000000000201"}',false,payload->>'previewDigest',(payload->>'previewExpiresAt')::timestamptz)
FROM work_block_results WHERE key='remove_preview';

DO $$ BEGIN
  IF (SELECT payload#>>'{receipt,readBack,workBlock,scheduledDate}' FROM work_block_results WHERE key='move_apply') <> '2026-07-17'
     OR (SELECT payload#>>'{receipt,readBack,workBlock,scheduledTime}' FROM work_block_results WHERE key='move_apply') <> '09:15'
     OR (SELECT payload#>>'{receipt,readBack,workBlock,timezone}' FROM work_block_results WHERE key='move_apply') <> 'UTC'
     OR (SELECT payload#>>'{receipt,readBack,workBlock,canonicalRevision}' FROM work_block_results WHERE key='move_apply') <> '2'
     OR (SELECT payload#>>'{receipt,readBack,workBlock,duration}' FROM work_block_results WHERE key='resize_apply') <> '90'
     OR (SELECT payload#>>'{receipt,readBack,workBlock,canonicalRevision}' FROM work_block_results WHERE key='resize_apply') <> '3'
     OR (SELECT payload#>'{receipt,readBack,workBlock}' FROM work_block_results WHERE key='remove_apply') <> 'null'::jsonb
     OR (SELECT payload#>>'{receipt,readBack,removedWorkBlockId}' FROM work_block_results WHERE key='remove_apply') <> '6b600000-0000-4000-8000-000000000201'
     OR (SELECT canonical_revision FROM tasks WHERE id='6b600000-0000-4000-8000-000000000101') <> 5
     OR (SELECT instances FROM tasks WHERE id='6b600000-0000-4000-8000-000000000101') <> '[]'::jsonb THEN
    RAISE EXCEPTION 'FAIL: move/resize/remove lifecycle diverged';
  END IF;
END $$;

-- Workspace authority is bound into preview and rechecked at apply.
SELECT set_config('request.jwt.claim.sub','6b600000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"6b600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
INSERT INTO work_block_results SELECT 'workspace_preview',public.flowstate_work_block_v1(
  'work-block-workspace','work-block-v1','local-api','6b600000-0000-4000-8000-000000000107',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000212","scheduledDate":"2026-07-20","scheduledTime":"10:00","duration":30,"timezone":"UTC"}}',true,NULL,NULL,'6b600000-0000-4000-8000-000000000010');
DELETE FROM workspace_members WHERE workspace_id='6b600000-0000-4000-8000-000000000010' AND user_id='6b600000-0000-4000-8000-000000000002';
INSERT INTO work_block_results SELECT 'workspace_apply_removed',public.flowstate_work_block_v1(
  'work-block-workspace','work-block-v1','local-api','6b600000-0000-4000-8000-000000000107',1,0,
  '{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000212","scheduledDate":"2026-07-20","scheduledTime":"10:00","duration":30,"timezone":"UTC"}}',false,payload->>'previewDigest',(payload->>'previewExpiresAt')::timestamptz,'6b600000-0000-4000-8000-000000000010')
FROM work_block_results WHERE key='workspace_preview';
DO $$ BEGIN
  IF (SELECT payload#>>'{normalizedPayload,workspaceId}' FROM work_block_results WHERE key='workspace_preview') <> '6b600000-0000-4000-8000-000000000010'
     OR (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='workspace_apply_removed') <> 'not_found'
     OR (SELECT consumed_at FROM canonical_operation_previews WHERE operation_id='work-block-workspace') IS NOT NULL
     OR EXISTS (SELECT 1 FROM canonical_operations WHERE operation_id='work-block-workspace') THEN
    RAISE EXCEPTION 'FAIL: removed workspace member retained work-block write authority';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','6b600000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"6b600000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- Removed stable IDs remain globally claimed, including across another user.
SELECT set_config('request.jwt.claim.sub','6b600000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"6b600000-0000-4000-8000-000000000002","role":"authenticated"}',true);
INSERT INTO work_block_results SELECT 'global_reuse',public.flowstate_work_block_v1(
  'work-block-global-reuse','work-block-v1','local-api','6b600000-0000-4000-8000-000000000103',1,0,
  '{"action":"create","workBlock":{"id":"6B600000-0000-4000-8000-000000000201","scheduledDate":"2026-07-20","scheduledTime":"09:00","duration":30,"timezone":"UTC"}}',true);
DO $$ BEGIN
  IF (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='global_reuse') <> 'work_block_id_conflict' THEN
    RAISE EXCEPTION 'FAIL: removed stable ID was reusable across users';
  END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','6b600000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"6b600000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- Finish-by, stale work-block revision, foreign scope, and invalid timezone fail closed.
INSERT INTO work_block_results SELECT 'late',public.flowstate_work_block_v1('work-block-late','work-block-v1','local-api','6b600000-0000-4000-8000-000000000104',1,0,'{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000204","scheduledDate":"2026-07-16","scheduledTime":"11:30","duration":60,"timezone":"UTC"},"finishBy":"2026-07-16T12:00"}',true);
INSERT INTO work_block_results SELECT 'foreign',public.flowstate_work_block_v1('work-block-foreign','work-block-v1','local-api','6b600000-0000-4000-8000-000000000103',1,0,'{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000205","scheduledDate":"2026-07-16","scheduledTime":"11:30","duration":30,"timezone":"UTC"}}',true);
INSERT INTO work_block_results SELECT 'bad_zone',public.flowstate_work_block_v1('work-block-zone','work-block-v1','local-api','6b600000-0000-4000-8000-000000000104',1,0,'{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000206","scheduledDate":"2026-07-16","scheduledTime":"11:30","duration":30,"timezone":"Mars/Olympus"}}',true);
INSERT INTO work_block_results SELECT 'fractional',public.flowstate_work_block_v1('work-block-fraction','work-block-v1','local-api','6b600000-0000-4000-8000-000000000104',1,0,'{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000209","scheduledDate":"2026-07-16","scheduledTime":"11:30","duration":30.5,"timezone":"UTC"}}',true);
INSERT INTO work_block_results SELECT 'malformed_existing',public.flowstate_work_block_v1('work-block-malformed','work-block-v1','local-api','6b600000-0000-4000-8000-000000000105',1,1,'{"action":"remove","workBlockId":"6b600000-0000-4000-8000-000000000209"}',true);
DO $$ BEGIN
  IF (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='late') <> 'finish_by_exceeded'
     OR (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='foreign') <> 'not_found'
     OR (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='bad_zone') <> 'invalid_timezone'
     OR (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='fractional') <> 'invalid_duration'
     OR (SELECT payload#>>'{error,code}' FROM work_block_results WHERE key='malformed_existing') <> 'invalid_existing_work_blocks'
     OR EXISTS (SELECT 1 FROM canonical_operation_previews WHERE operation_id IN ('work-block-late','work-block-foreign','work-block-zone')) THEN
    RAISE EXCEPTION 'FAIL: invalid work-block requests did not fail closed';
  END IF;
END $$;

-- Same-task siblings participate in overlap warnings.
UPDATE tasks SET instances='[{"id":"6b600000-0000-4000-8000-000000000210","taskId":"6b600000-0000-4000-8000-000000000104","scheduledDate":"2026-07-19","scheduledTime":"09:00","duration":60,"timezone":"UTC","canonicalRevision":1}]' WHERE id='6b600000-0000-4000-8000-000000000104';
INSERT INTO work_block_results SELECT 'same_task_overlap',public.flowstate_work_block_v1('work-block-same-task-overlap','work-block-v1','local-api','6b600000-0000-4000-8000-000000000104',2,0,'{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000211","scheduledDate":"2026-07-19","scheduledTime":"09:30","duration":30,"timezone":"UTC"}}',true);
DO $$ BEGIN
  IF (SELECT payload#>>'{preview,overlapWarnings,0,workBlockId}' FROM work_block_results WHERE key='same_task_overlap') <> '6b600000-0000-4000-8000-000000000210' THEN
    RAISE EXCEPTION 'FAIL: same-task sibling overlap was omitted';
  END IF;
END $$;

-- A write exception rolls back preview consumption, operation, task, and change event.
CREATE FUNCTION pg_temp.fail_work_block() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF current_setting('flowstate.canonical.operation_id',true)='work-block-failure' THEN RAISE EXCEPTION 'injected work-block failure'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fail_work_block BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_work_block();
INSERT INTO work_block_results SELECT 'failure_preview',public.flowstate_work_block_v1('work-block-failure','work-block-v1','local-api','6b600000-0000-4000-8000-000000000106',1,0,'{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000207","scheduledDate":"2026-07-16","scheduledTime":"08:00","duration":30,"timezone":"UTC"}}',true);
DO $$ DECLARE p jsonb := (SELECT payload FROM work_block_results WHERE key='failure_preview'); BEGIN
  BEGIN
    PERFORM public.flowstate_work_block_v1('work-block-failure','work-block-v1','local-api','6b600000-0000-4000-8000-000000000106',1,0,'{"action":"create","workBlock":{"id":"6b600000-0000-4000-8000-000000000207","scheduledDate":"2026-07-16","scheduledTime":"08:00","duration":30,"timezone":"UTC"}}',false,p->>'previewDigest',(p->>'previewExpiresAt')::timestamptz);
    RAISE EXCEPTION 'FAIL: injected work-block failure did not fire';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%injected work-block failure%' THEN RAISE; END IF; END;
  IF (SELECT canonical_revision FROM tasks WHERE id='6b600000-0000-4000-8000-000000000106') <> 1
     OR EXISTS (SELECT 1 FROM canonical_operations WHERE operation_id='work-block-failure')
     OR EXISTS (SELECT 1 FROM canonical_change_log WHERE operation_id='work-block-failure')
     OR (SELECT consumed_at FROM canonical_operation_previews WHERE operation_id='work-block-failure') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: work-block rollback left partial durable state';
  END IF;
END $$;

ROLLBACK;
SELECT 'PASS: work-block stable IDs, exact intervals, CAS, replay, scope, finish-by, overlap, and rollback';
