-- TASK-1965: recurrence chain/history read and lifecycle authority contract.
-- Disposable fixtures and every mutation are transaction-owned and rolled back.
BEGIN;

INSERT INTO auth.users (
 id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,
 raw_app_meta_data,raw_user_meta_data,aud,role,confirmation_token,recovery_token
) VALUES
 ('19650000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
  'TASK-1965-owner@test.flowstate','',now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated','',''),
 ('19650000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
  'TASK-1965-other@test.flowstate','',now(),now(),now(),'{"provider":"email","providers":["email"]}','{}','authenticated','authenticated','','');

INSERT INTO public.tasks (
 id,user_id,title,status,is_deleted,due_date,recurrence_rule,recurrence_count,
 recurrence_parent_id,is_completion_record,is_in_inbox,completed_at
) VALUES
 ('19650000-0000-4000-8000-000000000101','19650000-0000-4000-8000-000000000001',
  'TASK-1965 living series','planned',false,'2026-07-16',
  '{"pattern":"daily","interval":1,"endType":"never"}',2,NULL,false,true,NULL),
 ('19650000-0000-4000-8000-000000000102','19650000-0000-4000-8000-000000000001',
  'TASK-1965 completed one','done',false,'2026-07-14',NULL,0,
  '19650000-0000-4000-8000-000000000101',true,false,'2026-07-14T09:00:00Z'),
 ('19650000-0000-4000-8000-000000000103','19650000-0000-4000-8000-000000000001',
  'TASK-1965 completed two','done',false,'2026-07-15',NULL,1,
  '19650000-0000-4000-8000-000000000101',true,false,'2026-07-15T09:00:00Z'),
 ('19650000-0000-4000-8000-000000000201','19650000-0000-4000-8000-000000000001',
  'TASK-1965 rollback series','planned',false,'2026-07-16',
  '{"pattern":"weekly","interval":1,"weekdays":[4],"endType":"never"}',0,NULL,false,true,NULL),
 ('19650000-0000-4000-8000-000000000301','19650000-0000-4000-8000-000000000001',
  'TASK-1965 ambiguous history series','planned',false,'2026-07-16',
  '{"pattern":"daily","interval":1,"endType":"never"}',2,NULL,false,true,NULL),
 ('19650000-0000-4000-8000-000000000302','19650000-0000-4000-8000-000000000001',
  'TASK-1965 ambiguous history one','done',false,'2026-07-14',NULL,0,
  '19650000-0000-4000-8000-000000000301',true,false,'2026-07-14T09:00:00Z'),
 ('19650000-0000-4000-8000-000000000303','19650000-0000-4000-8000-000000000001',
  'TASK-1965 ambiguous history two','done',false,'2026-07-14',NULL,1,
 '19650000-0000-4000-8000-000000000301',true,false,'2026-07-14T10:00:00Z');

INSERT INTO public.workspaces(id,name,owner_id) VALUES
 ('19650000-0000-4000-8000-000000000401','TASK-1965 workspace A','19650000-0000-4000-8000-000000000001'),
 ('19650000-0000-4000-8000-000000000402','TASK-1965 workspace B','19650000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES
 ('19650000-0000-4000-8000-000000000401','19650000-0000-4000-8000-000000000002','viewer');
INSERT INTO public.tasks(
 id,user_id,title,status,is_deleted,due_date,recurrence_rule,recurrence_count,
 recurrence_parent_id,is_completion_record,is_in_inbox,completed_at,workspace_id
) VALUES
 ('19650000-0000-4000-8000-000000000501','19650000-0000-4000-8000-000000000001',
  'Workspace A series','planned',false,'2026-07-16','{"pattern":"daily","interval":1,"endType":"never"}',1,
  NULL,false,true,NULL,'19650000-0000-4000-8000-000000000401'),
 ('19650000-0000-4000-8000-000000000502','19650000-0000-4000-8000-000000000001',
  'Workspace A history','done',false,'2026-07-15',NULL,0,
  '19650000-0000-4000-8000-000000000501',true,false,'2026-07-15T09:00:00Z','19650000-0000-4000-8000-000000000401'),
 ('19650000-0000-4000-8000-000000000503','19650000-0000-4000-8000-000000000001',
  'Workspace B contaminant','done',false,'2026-07-14',NULL,7,
  '19650000-0000-4000-8000-000000000501',true,false,'2026-07-14T09:00:00Z','19650000-0000-4000-8000-000000000402'),
 ('19650000-0000-4000-8000-000000000504','19650000-0000-4000-8000-000000000002',
  'Other user contaminant','done',false,'2026-07-13',NULL,8,
  '19650000-0000-4000-8000-000000000101',true,false,'2026-07-13T09:00:00Z',NULL);

SELECT set_config('request.jwt.claim.sub','19650000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"19650000-0000-4000-8000-000000000001","role":"authenticated"}',true);
CREATE TEMP TABLE recurrence_results(key text PRIMARY KEY,payload jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE recurrence_history_snapshot(key text PRIMARY KEY,payload jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO recurrence_history_snapshot
SELECT 'main',COALESCE(jsonb_agg(to_jsonb(task) ORDER BY task.id),'[]'::jsonb)
FROM public.tasks task WHERE task.recurrence_parent_id='19650000-0000-4000-8000-000000000101' AND task.is_completion_record;

-- Native finite/infinite rule variants and date-only calculations retain the
-- renderer's recurrence semantics without local-time timestamp drift.
DO $$
BEGIN
 IF NOT public.flowstate_h7_valid_rule('{"pattern":"weekly","interval":2,"endType":"never"}')
    OR public.flowstate_h7_next_due_date('2026-07-16','{"pattern":"weekly","interval":2,"endType":"never"}',1)<>'2026-07-30'
    OR public.flowstate_h7_next_due_date('2026-01-31','{"pattern":"monthly","interval":1,"endType":"never"}',1)<>'2026-02-28'
    OR public.flowstate_h7_next_due_date('2026-01-30','{"pattern":"monthly","interval":1,"monthWeekday":{"nth":-1,"day":5},"endType":"never"}',1)<>'2026-02-27'
    OR public.flowstate_h7_next_due_date('2026-07-16','{"pattern":"daily","interval":1,"endType":"after_count","endCount":2}',3) IS NOT NULL
    OR public.flowstate_h7_next_due_date('2026-07-16','{"pattern":"daily","interval":1,"endType":"on_date","endDate":"2026-07-16"}',1) IS NOT NULL THEN
  RAISE EXCEPTION 'FAIL: finite/infinite recurrence rule calculation mismatch';
 END IF;
END $$;

-- Related rows from another user or workspace never contaminate a scoped series.
DO $$
DECLARE personal_chain jsonb; workspace_chain jsonb;
BEGIN
 personal_chain:=public.flowstate_recurrence_chain_v1('task-v1','19650000-0000-4000-8000-000000000101',NULL);
 workspace_chain:=public.flowstate_recurrence_chain_v1(
  'task-v1','19650000-0000-4000-8000-000000000501','19650000-0000-4000-8000-000000000401'
 );
 IF jsonb_array_length(personal_chain->'history')<>2
    OR personal_chain @> '{"history":[{"id":"19650000-0000-4000-8000-000000000504"}]}'::jsonb THEN
  RAISE EXCEPTION 'FAIL: cross-user recurrence contamination: %',personal_chain;
 END IF;
 IF workspace_chain->>'ok'<>'true' OR jsonb_array_length(workspace_chain->'history')<>1
    OR workspace_chain#>>'{history,0,id}'<>'19650000-0000-4000-8000-000000000502' THEN
  RAISE EXCEPTION 'FAIL: cross-workspace recurrence contamination: %',workspace_chain;
 END IF;
END $$;

-- Read-only workspace members can inspect exact recurrence evidence for
-- planning, while the mutation helper still requires write authority under
-- the task lock.
SELECT set_config('request.jwt.claim.sub','19650000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"19650000-0000-4000-8000-000000000002","role":"authenticated"}',true);
DO $$
DECLARE viewer_chain jsonb; viewer_preview jsonb; r bigint;
BEGIN
 viewer_chain:=public.flowstate_recurrence_chain_v1(
  'task-v1','19650000-0000-4000-8000-000000000501','19650000-0000-4000-8000-000000000401'
 );
 IF viewer_chain->>'ok'<>'true' OR jsonb_array_length(viewer_chain->'history')<>1 THEN
  RAISE EXCEPTION 'FAIL: workspace viewer can read recurrence evidence: %',viewer_chain;
 END IF;
 r:=(viewer_chain->>'canonicalRevision')::bigint;
 viewer_preview:=public.flowstate_recurrence_lifecycle_v1(
  'task-v1','local-api','TASK-1965-viewer-cannot-write',
  '19650000-0000-4000-8000-000000000501',r,'pause',NULL,NULL,
  'Asia/Jerusalem',true,NULL,NULL,NULL,'19650000-0000-4000-8000-000000000401'
 );
 IF viewer_preview#>>'{error,code}'<>'scope_denied' THEN
  RAISE EXCEPTION 'FAIL: workspace viewer cannot mutate recurrence: %',viewer_preview;
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','19650000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"19650000-0000-4000-8000-000000000001","role":"authenticated"}',true);

-- The apply helper revalidates exact scope after acquiring the task lock.
DO $$
DECLARE before_row jsonb; rejected boolean:=false;
BEGIN
 SELECT to_jsonb(task) INTO before_row FROM public.tasks task
 WHERE task.id='19650000-0000-4000-8000-000000000201';
 BEGIN
  PERFORM public.flowstate_h7_mutate_series(
   '19650000-0000-4000-8000-000000000002',
   '19650000-0000-4000-8000-000000000201',
   '19650000-0000-4000-8000-000000000201',
   (before_row->>'canonical_revision')::bigint,'pause',NULL,NULL,NULL
  );
 EXCEPTION WHEN OTHERS THEN
  rejected:=SQLERRM='scope_denied';
 END;
 IF NOT rejected OR (SELECT to_jsonb(task) FROM public.tasks task
    WHERE task.id='19650000-0000-4000-8000-000000000201') IS DISTINCT FROM before_row THEN
  RAISE EXCEPTION 'FAIL: recurrence apply scope move-race did not roll back';
 END IF;
END $$;

DO $$
DECLARE v_chain jsonb;
BEGIN
 v_chain:=public.flowstate_recurrence_chain_v1('task-v1','19650000-0000-4000-8000-000000000101',NULL);
 IF v_chain->>'ok'<>'true' OR v_chain->>'fresh'<>'true'
    OR v_chain->>'seriesId'<>'19650000-0000-4000-8000-000000000101'
    OR v_chain->>'lifecycleStatus'<>'active' OR jsonb_array_length(v_chain->'history')<>2
    OR v_chain#>>'{history,0,id}'<>'19650000-0000-4000-8000-000000000102'
    OR v_chain#>>'{history,1,id}'<>'19650000-0000-4000-8000-000000000103'
    OR v_chain#>>'{currentOccurrence,id}'<>'19650000-0000-4000-8000-000000000101'
    OR v_chain#>>'{nextOccurrence,dueDate}'<>'2026-07-17' THEN
   RAISE EXCEPTION 'FAIL: exact recurrence chain/history read is invalid: %',v_chain;
 END IF;
END $$;

-- Any exact occurrence identity resolves to the canonical root, while writes
-- are receipted against the living current occurrence that was mutated.
DO $$
DECLARE r bigint; preview jsonb; applied jsonb; resume_preview jsonb; resumed jsonb;
BEGIN
 SELECT canonical_revision INTO r FROM public.tasks
 WHERE id='19650000-0000-4000-8000-000000000101';
 preview:=public.flowstate_recurrence_lifecycle_v1(
  'task-v1','local-api','TASK-1965-history-member-pause',
  '19650000-0000-4000-8000-000000000102',r,'pause',NULL,NULL,
  'Asia/Jerusalem',true,NULL,NULL,NULL,NULL
 );
 applied:=public.flowstate_recurrence_lifecycle_v1(
  'task-v1','local-api','TASK-1965-history-member-pause',
  '19650000-0000-4000-8000-000000000102',r,'pause',NULL,NULL,
  'Asia/Jerusalem',false,preview->>'previewDigest',
  (preview->>'previewExpiresAt')::timestamptz,preview->>'requestHash',NULL
 );
 IF preview->>'seriesId'<>'19650000-0000-4000-8000-000000000101'
    OR preview#>>'{readBack,id}'<>'19650000-0000-4000-8000-000000000101'
    OR applied#>>'{receipt,entityId}'<>'19650000-0000-4000-8000-000000000101'
    OR applied#>>'{receipt,affected,0,entityId}'<>'19650000-0000-4000-8000-000000000101'
    OR applied#>>'{receipt,affected,0,readBack,id}'<>'19650000-0000-4000-8000-000000000101'
    OR applied#>>'{receipt,readBack,id}'<>'19650000-0000-4000-8000-000000000101'
    OR applied#>>'{receipt,operationContext,requestedTaskId}'<>'19650000-0000-4000-8000-000000000102'
    OR applied#>>'{receipt,operationContext,currentTaskId}'<>'19650000-0000-4000-8000-000000000101' THEN
  RAISE EXCEPTION 'FAIL: history-member recurrence command identity mismatch: %, %',preview,applied;
 END IF;

 SELECT canonical_revision INTO r FROM public.tasks
 WHERE id='19650000-0000-4000-8000-000000000101';
 resume_preview:=public.flowstate_recurrence_lifecycle_v1(
  'task-v1','local-api','TASK-1965-history-member-resume',
  '19650000-0000-4000-8000-000000000101',r,'resume',NULL,NULL,
  'Asia/Jerusalem',true,NULL,NULL,NULL,NULL
 );
 resumed:=public.flowstate_recurrence_lifecycle_v1(
  'task-v1','local-api','TASK-1965-history-member-resume',
  '19650000-0000-4000-8000-000000000101',r,'resume',NULL,NULL,
  'Asia/Jerusalem',false,resume_preview->>'previewDigest',
  (resume_preview->>'previewExpiresAt')::timestamptz,resume_preview->>'requestHash',NULL
 );
 IF resumed#>>'{receipt,readBack,lifecycleStatus}'<>'active' THEN
  RAISE EXCEPTION 'FAIL: history-member recurrence cleanup resume failed: %',resumed;
 END IF;
END $$;

-- Signed scope.
SELECT set_config('request.jwt.claim.sub','19650000-0000-4000-8000-000000000002',true);
DO $$ DECLARE v jsonb; BEGIN
 v:=public.flowstate_recurrence_chain_v1('task-v1','19650000-0000-4000-8000-000000000101',NULL);
 IF v#>>'{error,code}'<>'not_found' THEN RAISE EXCEPTION 'FAIL: signed scope: %',v; END IF;
END $$;
SELECT set_config('request.jwt.claim.sub','19650000-0000-4000-8000-000000000001',true);

-- Edit future, immutable history, and response-loss replay.
DO $$
DECLARE r bigint; before_rule jsonb; preview jsonb; applied jsonb; replayed jsonb; history_now jsonb;
BEGIN
 SELECT canonical_revision,recurrence_rule INTO r,before_rule FROM public.tasks WHERE id='19650000-0000-4000-8000-000000000101';
 preview:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-edit',
  '19650000-0000-4000-8000-000000000101',r,'edit_future',
  '{"pattern":"weekly","interval":1,"weekdays":[1,4],"endType":"never"}',NULL,
  'Asia/Jerusalem',true,NULL,NULL,NULL,NULL);
 IF preview->>'result'<>'preview' OR preview#>>'{readBack,definition,pattern}'<>'weekly'
    OR (SELECT recurrence_rule FROM public.tasks WHERE id='19650000-0000-4000-8000-000000000101') IS DISTINCT FROM before_rule THEN
  RAISE EXCEPTION 'FAIL: edit preview: %',preview;
 END IF;
 applied:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-edit',
  '19650000-0000-4000-8000-000000000101',r,'edit_future',
  '{"pattern":"weekly","interval":1,"weekdays":[1,4],"endType":"never"}',NULL,
  'Asia/Jerusalem',false,preview->>'previewDigest',(preview->>'previewExpiresAt')::timestamptz,preview->>'requestHash',NULL);
 IF applied->>'result'<>'committed' OR applied#>>'{receipt,status}'<>'committed'
    OR applied#>>'{receipt,action}'<>'recurrence_edit_future'
    OR applied#>>'{receipt,readBack,definition,pattern}'<>'weekly'
    OR applied#>>'{receipt,readBackHash}' !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'FAIL: edit apply: %',applied;
 END IF;
 replayed:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-edit',
  '19650000-0000-4000-8000-000000000101',r,'edit_future',
  '{"pattern":"weekly","interval":1,"weekdays":[1,4],"endType":"never"}',NULL,
  'Asia/Jerusalem',false,preview->>'previewDigest',(preview->>'previewExpiresAt')::timestamptz,preview->>'requestHash',NULL);
 IF replayed#>>'{receipt,status}'<>'replayed' OR replayed#>>'{receipt,replayed}'<>'true'
    OR (((replayed->'receipt')-'status'::text)-'replayed'::text)
       IS DISTINCT FROM (((applied->'receipt')-'status'::text)-'replayed'::text) THEN
  RAISE EXCEPTION 'FAIL: response-loss replay: %',replayed;
 END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(task) ORDER BY task.id),'[]'::jsonb) INTO history_now
 FROM public.tasks task WHERE task.recurrence_parent_id='19650000-0000-4000-8000-000000000101' AND task.is_completion_record;
 IF history_now IS DISTINCT FROM (SELECT payload FROM recurrence_history_snapshot WHERE key='main') THEN
  RAISE EXCEPTION 'history changed during recurrence lifecycle mutation';
 END IF;
END $$;

-- Pause, resume, end.
DO $$
DECLARE action text; op text; r bigint; preview jsonb; applied jsonb; expected text;
BEGIN
 FOREACH action IN ARRAY ARRAY['pause','resume','end_series'] LOOP
  op:='TASK-1965-'||action;
  SELECT canonical_revision INTO r FROM public.tasks WHERE id='19650000-0000-4000-8000-000000000101';
  preview:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api',op,
   '19650000-0000-4000-8000-000000000101',r,action,NULL,NULL,'Asia/Jerusalem',true,NULL,NULL,NULL,NULL);
  applied:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api',op,
   '19650000-0000-4000-8000-000000000101',r,action,NULL,NULL,'Asia/Jerusalem',false,
   preview->>'previewDigest',(preview->>'previewExpiresAt')::timestamptz,preview->>'requestHash',NULL);
  expected:=CASE action WHEN 'pause' THEN 'paused' WHEN 'resume' THEN 'active' ELSE 'ended' END;
  IF applied->>'result'<>'committed' OR applied#>>'{receipt,readBack,lifecycleStatus}'<>expected THEN
   RAISE EXCEPTION 'FAIL: % transition: %',action,applied;
  END IF;
 END LOOP;
END $$;

-- Typed idempotency and revision conflicts.
DO $$
DECLARE r bigint; conflict jsonb; stale jsonb;
BEGIN
 SELECT canonical_revision INTO r FROM public.tasks WHERE id='19650000-0000-4000-8000-000000000101';
 conflict:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-edit',
  '19650000-0000-4000-8000-000000000101',r,'pause',NULL,NULL,'Asia/Jerusalem',true,NULL,NULL,NULL,NULL);
 IF conflict#>>'{error,code}'<>'idempotency_conflict' THEN RAISE EXCEPTION 'FAIL: idempotency conflict: %',conflict; END IF;
 SELECT canonical_revision INTO r FROM public.tasks WHERE id='19650000-0000-4000-8000-000000000201';
 stale:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-stale',
  '19650000-0000-4000-8000-000000000201',r+1,'pause',NULL,NULL,'Asia/Jerusalem',true,NULL,NULL,NULL,NULL);
 IF stale#>>'{error,code}'<>'stale_revision' THEN RAISE EXCEPTION 'FAIL: stale revision: %',stale; END IF;
END $$;

-- Approval expiry and invalid time zones are typed before mutation.
DO $$
DECLARE r bigint; preview jsonb; expired jsonb; invalid_zone jsonb; expired_at timestamptz;
BEGIN
 SELECT canonical_revision INTO r FROM public.tasks WHERE id='19650000-0000-4000-8000-000000000201';
 invalid_zone:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-zone',
  '19650000-0000-4000-8000-000000000201',r,'pause',NULL,NULL,'Not/A-TimeZone',true,NULL,NULL,NULL,NULL);
 IF invalid_zone#>>'{error,code}'<>'invalid_request' THEN RAISE EXCEPTION 'FAIL: invalid time zone: %',invalid_zone; END IF;
 preview:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-expired',
  '19650000-0000-4000-8000-000000000201',r,'pause',NULL,NULL,'Asia/Jerusalem',true,NULL,NULL,NULL,NULL);
 UPDATE public.canonical_operation_previews SET expires_at=clock_timestamp()-interval '1 second'
 WHERE operation_id='TASK-1965-expired';
 SELECT expires_at INTO expired_at FROM public.canonical_operation_previews WHERE operation_id='TASK-1965-expired';
 expired:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-expired',
  '19650000-0000-4000-8000-000000000201',r,'pause',NULL,NULL,'Asia/Jerusalem',false,
  preview->>'previewDigest',expired_at,preview->>'requestHash',NULL);
 IF expired#>>'{error,code}'<>'preview_expired' THEN RAISE EXCEPTION 'FAIL: expired approval: %',expired; END IF;
END $$;

-- Ambiguous current and history fail closed.
INSERT INTO public.tasks(id,user_id,title,status,is_deleted,due_date,recurrence_rule,recurrence_count,recurrence_parent_id,is_completion_record,is_in_inbox)
VALUES('19650000-0000-4000-8000-000000000104','19650000-0000-4000-8000-000000000001','ambiguous current','planned',false,'2026-07-17',
 '{"pattern":"daily","interval":1,"endType":"never"}',3,'19650000-0000-4000-8000-000000000101',false,true);
DO $$ DECLARE v jsonb; BEGIN
 v:=public.flowstate_recurrence_chain_v1('task-v1','19650000-0000-4000-8000-000000000101',NULL);
 IF v#>>'{ambiguity,code}'<>'ambiguous_current_occurrence' THEN RAISE EXCEPTION 'FAIL: ambiguous current: %',v; END IF;
END $$;
DELETE FROM public.tasks WHERE id='19650000-0000-4000-8000-000000000104';
DO $$ DECLARE v jsonb; BEGIN
 v:=public.flowstate_recurrence_chain_v1('task-v1','19650000-0000-4000-8000-000000000301',NULL);
 IF v#>>'{ambiguity,code}'<>'ambiguous_history' THEN RAISE EXCEPTION 'FAIL: ambiguous history: %',v; END IF;
END $$;

-- Injected recurrence lifecycle rollback.
DO $$
DECLARE r bigint; preview jsonb;
BEGIN
 SELECT canonical_revision INTO r FROM public.tasks WHERE id='19650000-0000-4000-8000-000000000201';
 preview:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-rollback',
  '19650000-0000-4000-8000-000000000201',r,'pause',NULL,NULL,'Asia/Jerusalem',true,NULL,NULL,NULL,NULL);
 INSERT INTO recurrence_results VALUES('rollback-preview',preview);
END $$;
CREATE OR REPLACE FUNCTION public.flowstate_test_reject_recurrence_lifecycle()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.id='19650000-0000-4000-8000-000000000201' THEN RAISE EXCEPTION 'injected recurrence lifecycle rollback'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reject_recurrence_lifecycle BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.flowstate_test_reject_recurrence_lifecycle();
DO $$
DECLARE r bigint; before_row jsonb; result jsonb; preview jsonb; history_now jsonb;
BEGIN
 SELECT canonical_revision,to_jsonb(task) INTO r,before_row FROM public.tasks task WHERE id='19650000-0000-4000-8000-000000000201';
 preview:=(SELECT payload FROM recurrence_results WHERE key='rollback-preview');
 result:=public.flowstate_recurrence_lifecycle_v1('task-v1','local-api','TASK-1965-rollback',
  '19650000-0000-4000-8000-000000000201',r,'pause',NULL,NULL,'Asia/Jerusalem',false,
  preview->>'previewDigest',(preview->>'previewExpiresAt')::timestamptz,preview->>'requestHash',NULL);
 IF result#>>'{error,code}'<>'internal_error'
    OR (SELECT to_jsonb(task) FROM public.tasks task WHERE id='19650000-0000-4000-8000-000000000201') IS DISTINCT FROM before_row
    OR EXISTS(SELECT 1 FROM public.canonical_operations WHERE operation_id='TASK-1965-rollback')
    OR EXISTS(SELECT 1 FROM public.recurrence_series_state WHERE series_id='19650000-0000-4000-8000-000000000201')
    OR (SELECT consumed_at FROM public.canonical_operation_previews WHERE operation_id='TASK-1965-rollback') IS NOT NULL THEN
  RAISE EXCEPTION 'FAIL: injected recurrence lifecycle rollback was not atomic: %',result;
 END IF;
 SELECT COALESCE(jsonb_agg(to_jsonb(task) ORDER BY task.id),'[]'::jsonb) INTO history_now
 FROM public.tasks task WHERE task.recurrence_parent_id='19650000-0000-4000-8000-000000000101' AND task.is_completion_record;
 IF history_now IS DISTINCT FROM (SELECT payload FROM recurrence_history_snapshot WHERE key='main') THEN
  RAISE EXCEPTION 'history changed during recurrence lifecycle mutation';
 END IF;
END $$;
DROP TRIGGER reject_recurrence_lifecycle ON public.tasks;
DROP FUNCTION public.flowstate_test_reject_recurrence_lifecycle();
DO $$ BEGIN RAISE NOTICE 'TASK-1965 recurrence lifecycle contract passed'; END $$;
ROLLBACK;
