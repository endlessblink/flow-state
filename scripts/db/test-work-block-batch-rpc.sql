-- TASK-1964: canonical atomic work-block batch contract.
-- Disposable fixtures are transaction-owned and always rolled back.

BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
  ('1fc40000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
   'block-owner@test.flowstate','',now(),now(),now(),'{"provider":"email","providers":["email"]}','{}',
   'authenticated','authenticated','',''),
  ('1fc40000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
   'block-viewer@test.flowstate','',now(),now(),now(),'{"provider":"email","providers":["email"]}','{}',
   'authenticated','authenticated','','');

INSERT INTO public.workspaces (id, name, owner_id)
VALUES ('1fc40000-0000-4000-8000-000000000010','Work block contract workspace',
        '1fc40000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members (id, workspace_id, user_id, role)
VALUES ('1fc40000-0000-4000-8000-000000000011','1fc40000-0000-4000-8000-000000000010',
        '1fc40000-0000-4000-8000-000000000002','viewer');

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, recurring_instances,
  is_in_inbox, due_date, workspace_id
) VALUES
  ('1fc40000-0000-4000-8000-000000000101','1fc40000-0000-4000-8000-000000000001',
   'First block parent','planned',false,
   '[{"id":"existing-block","scheduledDate":"2026-07-15","scheduledTime":"09:00","duration":30,"legacyMarker":"preserve-me"}]',
   '[]',false,'2026-07-31',NULL),
  ('1fc40000-0000-4000-8000-000000000102','1fc40000-0000-4000-8000-000000000001',
   'Second block parent','planned',false,'[]','[]',true,'2026-08-01',NULL),
  ('1fc40000-0000-4000-8000-000000000103','1fc40000-0000-4000-8000-000000000001',
   'Recurring block parent','planned',false,'[]','[{"id":"occurrence-block"}]',true,NULL,NULL),
  ('1fc40000-0000-4000-8000-000000000104','1fc40000-0000-4000-8000-000000000001',
   'Workspace block parent','planned',false,'[]','[]',true,NULL,
   '1fc40000-0000-4000-8000-000000000010'),
  ('1fc40000-0000-4000-8000-000000000105','1fc40000-0000-4000-8000-000000000001',
   'Rollback block parent','planned',false,'[]','[]',true,NULL,NULL),
  ('1fc40000-0000-4000-8000-000000000106','1fc40000-0000-4000-8000-000000000001',
   'Rollback first block parent','planned',false,'[]','[]',true,NULL,NULL),
  ('1fc40000-0000-4000-8000-000000000107','1fc40000-0000-4000-8000-000000000001',
   'Legacy overlapping blocks','planned',false,
   '[{"id":"legacy-a","scheduledDate":"2026-07-22","scheduledTime":"09:00","duration":60},{"id":"legacy-b","scheduledDate":"2026-07-22","scheduledTime":"09:30","duration":30}]',
   '[]',false,NULL,NULL);

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, recurring_instances,
  is_in_inbox, position
) VALUES (
  '1fc40000-0000-4000-8000-000000000108','1fc40000-0000-4000-8000-000000000001',
  'Canvas-positioned block parent','planned',false,
  '[{"id":"canvas-block","scheduledDate":"2026-07-22","scheduledTime":"13:00","duration":30}]',
  '[]',false,'{"x":100,"y":200}'
);

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, recurring_instances,
  recurrence, is_in_inbox
) VALUES (
  '1fc40000-0000-4000-8000-000000000109','1fc40000-0000-4000-8000-000000000001',
  'Legacy recurring block parent','planned',false,'[]','[]',
  '{"pattern":"daily","interval":1}',true
);

SELECT set_config('request.jwt.claim.sub','1fc40000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims',
  '{"sub":"1fc40000-0000-4000-8000-000000000001","role":"authenticated"}',true);

CREATE TEMP TABLE work_block_results (key text PRIMARY KEY, payload jsonb NOT NULL) ON COMMIT DROP;

-- Preview is deterministic and zero-write across two parents. A created block
-- gets the same server identity in repeated previews.
DO $$
DECLARE
  v_r1 bigint; v_r2 bigint; v_before1 jsonb; v_before2 jsonb;
  v_preview jsonb; v_again jsonb; v_operations bigint; v_changes bigint;
BEGIN
  SELECT canonical_revision, instances INTO v_r1, v_before1 FROM public.tasks
    WHERE id='1fc40000-0000-4000-8000-000000000101';
  SELECT canonical_revision, instances INTO v_r2, v_before2 FROM public.tasks
    WHERE id='1fc40000-0000-4000-8000-000000000102';
  SELECT count(*) INTO v_operations FROM public.canonical_operations;
  SELECT count(*) INTO v_changes FROM public.canonical_change_log;
  v_preview := public.flowstate_work_block_batch_v1(
    'work-block-main','task-v1','local-api',
    jsonb_build_array(
      jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000101','baseRevision',v_r1,
        'kind','move','workBlockId','existing-block',
        'baseWorkBlockHash',public.flowstate_h6_work_block_hash(
          '{"id":"existing-block","scheduledDate":"2026-07-15","scheduledTime":"09:00","duration":30,"legacyMarker":"preserve-me"}'::jsonb),
        'scheduledDate','2026-07-16','scheduledTime','10:15','duration',45),
      jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000102','baseRevision',v_r2,
        'kind','create','clientId','afternoon-focus','scheduledDate','2026-07-16','scheduledTime','14:00','duration',60)
    ), 'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  v_again := public.flowstate_work_block_batch_v1(
    'work-block-main','task-v1','local-api',
    v_preview->'requestedPayload','Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_preview->>'ok' <> 'true' OR v_preview->>'result' <> 'preview'
     OR v_preview->>'action' <> 'work_block_batch'
     OR v_preview->>'requestHash' !~ '^[0-9a-f]{64}$'
     OR v_preview->>'previewDigest' !~ '^[0-9a-f]{64}$'
     OR v_preview->>'previewDigest' <> v_again->>'previewDigest'
     OR jsonb_array_length(v_preview #> '{normalizedPayload,operations}') <> 2
     OR v_preview #>> '{normalizedPayload,operations,1,workBlockId}'
          IS DISTINCT FROM v_again #>> '{normalizedPayload,operations,1,workBlockId}'
     OR v_preview #>> '{readBack,0,instances,0,legacyMarker}' <> 'preserve-me'
     OR v_preview #>> '{readBack,0,instances,0,scheduledDate}' <> '2026-07-16'
     OR v_preview #>> '{readBack,0,instances,0,scheduledTime}' <> '10:15'
     OR (v_preview #>> '{readBack,0,instances,0,duration}')::int <> 45
     OR v_preview #>> '{readBack,1,isInInbox}' <> 'false'
     OR (SELECT due_date FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000101') <> '2026-07-31'
     OR (SELECT instances FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000101') IS DISTINCT FROM v_before1
     OR (SELECT instances FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000102') IS DISTINCT FROM v_before2
     OR (SELECT count(*) FROM public.canonical_operations) <> v_operations
     OR (SELECT count(*) FROM public.canonical_change_log) <> v_changes THEN
    RAISE EXCEPTION 'FAIL: invalid deterministic zero-write work-block preview: %',v_preview;
  END IF;
  INSERT INTO work_block_results VALUES ('main-preview',v_preview);
END $$;

-- Exact approval applies all parents atomically; replay returns the durable receipt.
DO $$
DECLARE
  v_preview jsonb := (SELECT payload FROM work_block_results WHERE key='main-preview');
  v_apply jsonb; v_replay jsonb; v_created_id text;
BEGIN
  v_apply := public.flowstate_work_block_batch_v1(
    'work-block-main','task-v1','local-api',v_preview->'requestedPayload',
    'Asia/Jerusalem',NULL,false,
    v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,NULL,
    v_preview->>'requestHash');
  IF v_apply->>'ok' <> 'true' OR v_apply->>'result' <> 'committed'
     OR v_apply #>> '{receipt,status}' <> 'committed'
     OR v_apply #>> '{receipt,action}' <> 'work_block_batch'
     OR v_apply #>> '{receipt,entityType}' <> 'batch'
     OR v_apply #>> '{receipt,entityId}' <> 'work-block-main'
     OR v_apply #>> '{receipt,readBackHash}' !~ '^[0-9a-f]{64}$'
     OR jsonb_array_length(v_apply #> '{receipt,affected}') <> 2
     OR v_apply #>> '{receipt,affected,0,readBackHash}' !~ '^[0-9a-f]{64}$'
     OR v_apply #>> '{receipt,affected,1,readBackHash}' !~ '^[0-9a-f]{64}$'
     OR (SELECT instances #>> '{0,legacyMarker}' FROM public.tasks
         WHERE id='1fc40000-0000-4000-8000-000000000101') <> 'preserve-me'
     OR (SELECT instances #>> '{0,scheduledDate}' FROM public.tasks
         WHERE id='1fc40000-0000-4000-8000-000000000101') <> '2026-07-16'
     OR (SELECT due_date FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000102') <> '2026-08-01'
     OR (SELECT is_in_inbox FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000102')
     OR (SELECT count(*) FROM public.canonical_change_log WHERE operation_id='work-block-main') <> 2 THEN
    RAISE EXCEPTION 'FAIL: work-block batch did not commit exact atomic state: %',v_apply;
  END IF;
  v_created_id := v_apply #>> '{receipt,readBack,1,instances,0,id}';
  IF v_created_id IS NULL OR v_created_id <> v_preview #>> '{normalizedPayload,operations,1,workBlockId}' THEN
    RAISE EXCEPTION 'FAIL: create identity changed between preview and apply';
  END IF;
  IF v_apply #>> '{receipt,readBack,1,instances,0,clientId}' <> 'afternoon-focus'
     OR v_apply #>> '{receipt,readBack,1,instances,0,taskId}' <> '1fc40000-0000-4000-8000-000000000102'
     OR v_apply #>> '{receipt,readBack,1,instances,0,timeZone}' <> 'Asia/Jerusalem'
     OR v_apply #>> '{receipt,readBack,1,instances,0,status}' <> 'scheduled' THEN
    RAISE EXCEPTION 'FAIL: created work block lost canonical identity/context: %', v_apply;
  END IF;
  v_replay := public.flowstate_work_block_batch_v1(
    'work-block-main','task-v1','local-api',v_preview->'requestedPayload',
    'Asia/Jerusalem',NULL,false,
    v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,NULL,
    v_preview->>'requestHash');
  IF v_replay #>> '{receipt,status}' <> 'replayed'
     OR (SELECT count(*) FROM public.canonical_change_log WHERE operation_id='work-block-main') <> 2 THEN
    RAISE EXCEPTION 'FAIL: work-block replay duplicated state: %',v_replay;
  END IF;
  v_replay := public.flowstate_work_block_batch_v1(
    'work-block-main','task-v1','local-api',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000102',
      'baseRevision',1,'kind','create','clientId','changed','scheduledDate','2026-07-30','scheduledTime','12:00','duration',10)),
    'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_replay #>> '{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'FAIL: changed payload reused durable operation identity: %',v_replay;
  END IF;
END $$;

-- Remove uses exact element CAS, restores inbox when the sole block leaves, and
-- never rewrites the task deadline.
DO $$
DECLARE v_r bigint; v_block jsonb; v_preview jsonb; v_apply jsonb;
BEGIN
  SELECT canonical_revision,instances->0 INTO v_r,v_block FROM public.tasks
    WHERE id='1fc40000-0000-4000-8000-000000000102';
  v_preview:=public.flowstate_work_block_batch_v1('wb-remove','task-v1','web-pwa',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000102',
      'baseRevision',v_r,'kind','remove','workBlockId',v_block->>'id',
      'baseWorkBlockHash',public.flowstate_h6_work_block_hash(v_block))),
    'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  v_apply:=public.flowstate_work_block_batch_v1('wb-remove','task-v1','web-pwa',
    v_preview->'requestedPayload','Asia/Jerusalem',NULL,false,v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz,NULL,v_preview->>'requestHash');
  IF v_apply->>'ok'<>'true'
     OR (SELECT instances FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000102')<>'[]'::jsonb
     OR NOT (SELECT is_in_inbox FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000102')
     OR (SELECT due_date FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000102')<>'2026-08-01'
     OR (SELECT source FROM public.canonical_change_log WHERE operation_id='wb-remove' LIMIT 1)<>'web-pwa' THEN
    RAISE EXCEPTION 'FAIL: remove did not preserve deadline and canonical source: %',v_apply;
  END IF;
END $$;

-- Removing the last calendar block does not put a Canvas-positioned task in Inbox.
DO $$
DECLARE v_r bigint; v_hash text; v_preview jsonb; v_apply jsonb;
BEGIN
  SELECT canonical_revision, public.flowstate_h6_work_block_hash(instances->0)
    INTO v_r, v_hash FROM public.tasks
    WHERE id='1fc40000-0000-4000-8000-000000000108';
  v_preview:=public.flowstate_work_block_batch_v1('wb-canvas-remove','task-v1','web-pwa',
    jsonb_build_array(jsonb_build_object(
      'taskId','1fc40000-0000-4000-8000-000000000108','baseRevision',v_r,
      'kind','remove','workBlockId','canvas-block','baseWorkBlockHash',v_hash)),
    'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_preview #>> '{readBack,0,isInInbox}' <> 'false' THEN
    RAISE EXCEPTION 'FAIL: preview moved Canvas task into Inbox: %', v_preview;
  END IF;
  v_apply:=public.flowstate_work_block_batch_v1('wb-canvas-remove','task-v1','web-pwa',
    v_preview->'requestedPayload','Asia/Jerusalem',NULL,false,
    v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,NULL,
    v_preview->>'requestHash');
  IF v_apply->>'result'<>'committed'
     OR (SELECT is_in_inbox FROM public.tasks
         WHERE id='1fc40000-0000-4000-8000-000000000108') THEN
    RAISE EXCEPTION 'FAIL: apply moved Canvas task into Inbox: %', v_apply;
  END IF;
END $$;

-- Existing-block creation is refused, finishBy is an exact local-time bound,
-- and legacy overlaps are surfaced as warnings rather than hidden failures.
DO $$
DECLARE v_r bigint; v_hash text; v_result jsonb;
BEGIN
  SELECT canonical_revision INTO v_r FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000101';
  v_result:=public.flowstate_work_block_batch_v1('wb-second-create','task-v1','local-api',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000101',
      'baseRevision',v_r,'kind','create','clientId','second','scheduledDate','2026-07-23','scheduledTime','09:00','duration',30)),
    'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_result #>> '{error,code}'<>'work_block_already_exists' THEN
    RAISE EXCEPTION 'FAIL: second non-recurring block was accepted: %',v_result;
  END IF;
  SELECT canonical_revision INTO v_r FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000106';
  v_result:=public.flowstate_work_block_batch_v1('wb-finish-bound','task-v1','local-api',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000106',
      'baseRevision',v_r,'kind','create','clientId','late','scheduledDate','2026-07-21','scheduledTime','09:15','duration',30)),
    'Asia/Jerusalem','2026-07-21 06:30:00+00',true,NULL,NULL,NULL,NULL);
  IF v_result #>> '{error,code}'<>'finish_by_exceeded' THEN
    RAISE EXCEPTION 'FAIL: finishBy bound was ignored: %',v_result;
  END IF;
  SELECT canonical_revision INTO v_r FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000107';
  SELECT public.flowstate_h6_work_block_hash(instances->1) INTO v_hash FROM public.tasks
    WHERE id='1fc40000-0000-4000-8000-000000000107';
  v_result:=public.flowstate_work_block_batch_v1('wb-overlap-warning','task-v1','local-api',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000107',
      'baseRevision',v_r,'kind','move','workBlockId','legacy-b','baseWorkBlockHash',v_hash,
      'scheduledDate','2026-07-22','scheduledTime','09:45','duration',20)),
    'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_result->>'ok'<>'true' OR jsonb_array_length(v_result->'overlapWarnings')<>1
     OR (v_result #>> '{readBack,0,instances,1,duration}')::integer<>20 THEN
    RAISE EXCEPTION 'FAIL: allowed overlap was not surfaced as a warning: %',v_result;
  END IF;
END $$;

-- Strict malformed input, recurring editing, stale parent revisions, and stale
-- work-block content are typed conflicts/rejections.
DO $$
DECLARE v_r bigint; v_hash text; v_result jsonb;
BEGIN
  SELECT canonical_revision INTO v_r FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000101';
  v_result := public.flowstate_work_block_batch_v1('wb-invalid','task-v1','local-api',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000101',
      'baseRevision',v_r,'kind','create','clientId','bad','scheduledDate','2026-02-30','scheduledTime','9:00','duration',0)),
    'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_result #>> '{error,code}' <> 'invalid_operations' THEN
    RAISE EXCEPTION 'FAIL: malformed schedule accepted: %',v_result;
  END IF;
  SELECT canonical_revision INTO v_r FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000103';
  v_result := public.flowstate_work_block_batch_v1('wb-recurring','task-v1','local-api',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000103',
      'baseRevision',v_r,'kind','create','clientId','bad','scheduledDate','2026-07-20','scheduledTime','09:00','duration',30)),
    'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_result #>> '{error,code}' <> 'recurring_work_block_unsupported' THEN
    RAISE EXCEPTION 'FAIL: recurring instance editing accepted: %',v_result;
  END IF;
  SELECT canonical_revision INTO v_r FROM public.tasks
    WHERE id='1fc40000-0000-4000-8000-000000000109';
  v_result := public.flowstate_work_block_batch_v1('wb-legacy-recurring','task-v1','local-api',
    jsonb_build_array(jsonb_build_object(
      'taskId','1fc40000-0000-4000-8000-000000000109','baseRevision',v_r,
      'kind','create','clientId','bad-legacy','scheduledDate','2026-07-20',
      'scheduledTime','09:00','duration',30)),
    'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_result #>> '{error,code}' <> 'recurring_work_block_unsupported' THEN
    RAISE EXCEPTION 'FAIL: legacy recurrence editing accepted: %',v_result;
  END IF;
  SELECT canonical_revision INTO v_r FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000101';
  v_result := public.flowstate_work_block_batch_v1('wb-stale-parent','task-v1','local-api',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000101',
      'baseRevision',v_r-1,'kind','remove','workBlockId','existing-block',
      'baseWorkBlockHash',repeat('0',64))),'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_result #>> '{error,code}' <> 'stale_revision' THEN
    RAISE EXCEPTION 'FAIL: stale parent accepted: %',v_result;
  END IF;
  v_result := public.flowstate_work_block_batch_v1('wb-stale-block','task-v1','local-api',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000101',
      'baseRevision',v_r,'kind','remove','workBlockId','existing-block',
      'baseWorkBlockHash',repeat('0',64))),'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  IF v_result #>> '{error,code}' <> 'stale_work_block' THEN
    RAISE EXCEPTION 'FAIL: stale work-block hash accepted: %',v_result;
  END IF;
END $$;

-- Workspace viewers cannot mutate.
DO $$
DECLARE v_r bigint; v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','1fc40000-0000-4000-8000-000000000002',true);
  PERFORM set_config('request.jwt.claims','{"sub":"1fc40000-0000-4000-8000-000000000002","role":"authenticated"}',true);
  SELECT canonical_revision INTO v_r FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000104';
  v_result := public.flowstate_work_block_batch_v1('wb-denied','task-v1','local-api',
    jsonb_build_array(jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000104',
      'baseRevision',v_r,'kind','create','clientId','denied','scheduledDate','2026-07-20','scheduledTime','09:00','duration',30)),
    'Asia/Jerusalem',NULL,true,NULL,NULL,'1fc40000-0000-4000-8000-000000000010',NULL);
  IF v_result #>> '{error,code}' <> 'scope_denied' THEN
    RAISE EXCEPTION 'FAIL: viewer mutation accepted: %',v_result;
  END IF;
  PERFORM set_config('request.jwt.claim.sub','1fc40000-0000-4000-8000-000000000001',true);
  PERFORM set_config('request.jwt.claims','{"sub":"1fc40000-0000-4000-8000-000000000001","role":"authenticated"}',true);
END $$;

-- An injected failure after one parent update rolls back every parent, receipt,
-- operation, and linked change.
CREATE OR REPLACE FUNCTION public.flowstate_test_reject_work_block_fixture()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id::text='1fc40000-0000-4000-8000-000000000105' AND jsonb_array_length(NEW.instances)>0 THEN
    RAISE EXCEPTION 'injected work-block failure';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE v_r1 bigint; v_r2 bigint; v_before1 jsonb; v_before2 jsonb; v_preview jsonb; v_result jsonb;
BEGIN
  SELECT canonical_revision,instances INTO v_r1,v_before1 FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000106';
  SELECT canonical_revision,instances INTO v_r2,v_before2 FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000105';
  v_preview := public.flowstate_work_block_batch_v1('wb-rollback','task-v1','local-api',
    jsonb_build_array(
      jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000106','baseRevision',v_r1,'kind','create','clientId','first','scheduledDate','2026-07-21','scheduledTime','10:00','duration',30),
      jsonb_build_object('taskId','1fc40000-0000-4000-8000-000000000105','baseRevision',v_r2,'kind','create','clientId','second','scheduledDate','2026-07-21','scheduledTime','11:00','duration',30)
    ),'Asia/Jerusalem',NULL,true,NULL,NULL,NULL,NULL);
  CREATE TRIGGER reject_work_block_fixture BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.flowstate_test_reject_work_block_fixture();
  v_result := public.flowstate_work_block_batch_v1('wb-rollback','task-v1','local-api',
    v_preview->'requestedPayload','Asia/Jerusalem',NULL,false,v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz,NULL,v_preview->>'requestHash');
  DROP TRIGGER reject_work_block_fixture ON public.tasks;
  IF v_result #>> '{error,code}' <> 'internal_error'
     OR (SELECT instances FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000106') IS DISTINCT FROM v_before1
     OR (SELECT instances FROM public.tasks WHERE id='1fc40000-0000-4000-8000-000000000105') IS DISTINCT FROM v_before2
     OR EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id='wb-rollback' AND state='committed')
     OR EXISTS (SELECT 1 FROM public.canonical_change_log WHERE operation_id='wb-rollback') THEN
    RAISE EXCEPTION 'FAIL: injected failure left partial work-block state: %',v_result;
  END IF;
END $$;

ROLLBACK;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.tasks WHERE id::text LIKE '1fc40000-0000-4000-8000-%') THEN
    RAISE EXCEPTION 'FAIL: TASK-1964 fixtures survived rollback';
  END IF;
  RAISE NOTICE 'TASK-1964 canonical work-block batch rollback-only contract passed';
END $$;
