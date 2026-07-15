-- TASK-1965: disposable canonical timer state-machine contract.
BEGIN;

INSERT INTO auth.users (
  id,instance_id,email,encrypted_password,email_confirmed_at,created_at,updated_at,
  raw_app_meta_data,raw_user_meta_data,aud,role,confirmation_token,recovery_token
) VALUES
('1fc50000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'timer-owner@test.flowstate','',now(),now(),now(),'{}','{}','authenticated','authenticated','',''),
('1fc50000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
 'timer-other@test.flowstate','',now(),now(),now(),'{}','{}','authenticated','authenticated','','');

INSERT INTO public.tasks (id,user_id,title,status,is_deleted,is_in_inbox)
VALUES
('1fc50000-0000-4000-8000-000000000101','1fc50000-0000-4000-8000-000000000001','Timer task','planned',false,true),
('1fc50000-0000-4000-8000-000000000102','1fc50000-0000-4000-8000-000000000002','Other timer task','planned',false,true);

SELECT set_config('request.jwt.claim.sub','1fc50000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"1fc50000-0000-4000-8000-000000000001","role":"authenticated"}',true);

INSERT INTO public.timer_sessions (
  id,user_id,task_id,start_time,duration,remaining_time,is_active,is_paused,is_break,
  device_leader_id,device_leader_last_seen
) VALUES (
  '1fc50000-0000-4000-8000-000000000201','1fc50000-0000-4000-8000-000000000001',
  '1fc50000-0000-4000-8000-000000000101',now()-interval '20 minutes',1500,600,true,false,false,
  'desktop-1',now()
);

CREATE TEMP TABLE timer_contract_results (key text PRIMARY KEY,payload jsonb NOT NULL) ON COMMIT DROP;

-- Preview projects atomic replacement but changes no timer domain row.
DO $$
DECLARE v_preview jsonb; v_revision bigint; v_change_count bigint;
BEGIN
  SELECT canonical_revision INTO v_revision FROM public.timer_sessions
  WHERE id='1fc50000-0000-4000-8000-000000000201';
  SELECT count(*) INTO v_change_count FROM public.canonical_change_log;
  v_preview:=public.flowstate_timer_command_v1(
    'timer-start-main','timer-v1','web-pwa','start',
    '1fc50000-0000-4000-8000-000000000202',0,'desktop-1',NULL,
    '1fc50000-0000-4000-8000-000000000101','2026-07-16T10:00:00+03:00',1500,false,
    true,NULL,NULL,NULL
  );
  IF v_preview->>'result'<>'preview' OR v_preview->>'action'<>'start'
     OR v_preview #>> '{normalizedPayload,sessionId}'<>'1fc50000-0000-4000-8000-000000000202'
     OR v_preview #>> '{readBack,isActive}'<>'true'
     OR v_preview #>> '{readBack,isPaused}'<>'false'
     OR v_preview #>> '{readBack,deviceLeaderId}'<>'desktop-1'
     OR jsonb_array_length(v_preview->'replacedSessions')<>1
     OR v_preview #>> '{replacedSessions,0,isActive}'<>'false'
     OR NOT (SELECT is_active FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000201')
     OR EXISTS (SELECT 1 FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000202')
     OR (SELECT canonical_revision FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000201')<>v_revision
     OR (SELECT count(*) FROM public.canonical_change_log)<>v_change_count THEN
    RAISE EXCEPTION 'FAIL: timer start preview was not stable and zero-domain-write: %',v_preview;
  END IF;
  INSERT INTO timer_contract_results VALUES ('start-preview',v_preview);
END $$;

-- One transaction stops the previous session and starts the stable new id.
DO $$
DECLARE v_preview jsonb:=(SELECT payload FROM timer_contract_results WHERE key='start-preview');
  v_apply jsonb; v_replay jsonb;
BEGIN
  v_apply:=public.flowstate_timer_command_v1(
    'timer-start-main','timer-v1','web-pwa','start',
    '1fc50000-0000-4000-8000-000000000202',0,'desktop-1',NULL,
    '1fc50000-0000-4000-8000-000000000101','2026-07-16T10:00:00+03:00',1500,false,
    false,v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,v_preview->>'requestHash'
  );
  IF v_apply->>'result'<>'committed' OR v_apply #>> '{receipt,status}'<>'committed'
     OR v_apply #>> '{receipt,entityType}'<>'timer_session'
     OR v_apply #>> '{receipt,entityId}'<>'1fc50000-0000-4000-8000-000000000202'
     OR v_apply #>> '{receipt,action}'<>'start'
     OR v_apply #>> '{receipt,readBack,isActive}'<>'true'
     OR v_apply #>> '{receipt,readBack,deviceLeaderId}'<>'desktop-1'
     OR jsonb_array_length(v_apply #> '{receipt,affected}')<>2
     OR jsonb_array_length(v_apply #> '{receipt,operationContext,replacedSessionIds}')<>1
     OR (SELECT is_active FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000201')
     OR NOT (SELECT is_active FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000202')
     OR (SELECT count(*) FROM public.timer_sessions WHERE user_id='1fc50000-0000-4000-8000-000000000001' AND is_active)<>1
     OR (SELECT count(*) FROM public.canonical_change_log WHERE operation_id='timer-start-main')<>2 THEN
    RAISE EXCEPTION 'FAIL: timer start was not one canonical replacement: %',v_apply;
  END IF;
  v_replay:=public.flowstate_timer_command_v1(
    'timer-start-main','timer-v1','web-pwa','start',
    '1fc50000-0000-4000-8000-000000000202',0,'desktop-1',NULL,
    '1fc50000-0000-4000-8000-000000000101','2026-07-16T10:00:00+03:00',1500,false,
    true,NULL,NULL,NULL
  );
  IF v_replay #>> '{receipt,status}'<>'replayed'
     OR (SELECT count(*) FROM public.canonical_change_log WHERE operation_id='timer-start-main')<>2 THEN
    RAISE EXCEPTION 'FAIL: lost-response retry did not return durable replay: %',v_replay;
  END IF;
END $$;

-- Lease/countdown heartbeats remain operational and cannot stale a semantic command.
DO $$
DECLARE v_id uuid:='1fc50000-0000-4000-8000-000000000202'; v_r bigint; v_changes bigint;
  v_remaining integer; v_heartbeat boolean;
BEGIN
  SELECT canonical_revision,remaining_time INTO v_r,v_remaining FROM public.timer_sessions WHERE id=v_id;
  SELECT count(*) INTO v_changes FROM public.canonical_change_log WHERE entity_id=v_id::text;
  v_heartbeat:=public.heartbeat_timer_session(v_id,'desktop-1',v_remaining-1);
  IF NOT v_heartbeat
     OR (SELECT remaining_time FROM public.timer_sessions WHERE id=v_id)<>v_remaining-1
     OR (SELECT canonical_revision FROM public.timer_sessions WHERE id=v_id)<>v_r
     OR (SELECT count(*) FROM public.canonical_change_log WHERE entity_id=v_id::text)<>v_changes THEN
    RAISE EXCEPTION 'FAIL: operational heartbeat changed semantic revision or evidence';
  END IF;
END $$;

-- Explicit pause, resume, and stop enforce legal revisions and state.
DO $$
DECLARE v_id uuid:='1fc50000-0000-4000-8000-000000000202'; v_r bigint;
  v_preview jsonb; v_apply jsonb; v_bad jsonb;
BEGIN
  SELECT canonical_revision INTO v_r FROM public.timer_sessions WHERE id=v_id;
  v_preview:=public.flowstate_timer_command_v1('timer-pause','timer-v1','web-pwa','pause',v_id,v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,1499,NULL);
  v_apply:=public.flowstate_timer_command_v1('timer-pause','timer-v1','web-pwa','pause',v_id,v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,false,
    v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,v_preview->>'requestHash',1499,NULL);
  IF v_apply #>> '{receipt,readBack,isPaused}'<>'true' THEN RAISE EXCEPTION 'FAIL: explicit pause failed: %',v_apply; END IF;
  v_bad:=public.flowstate_timer_command_v1('timer-pause-again','timer-v1','web-pwa','pause',v_id,
    (SELECT canonical_revision FROM public.timer_sessions WHERE id=v_id),'desktop-1',NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,1499,NULL);
  IF v_bad #>> '{error,code}'<>'illegal_transition' THEN RAISE EXCEPTION 'FAIL: double pause accepted: %',v_bad; END IF;
  SELECT canonical_revision INTO v_r FROM public.timer_sessions WHERE id=v_id;
  v_preview:=public.flowstate_timer_command_v1('timer-resume','timer-v1','web-pwa','resume',v_id,v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,1499,NULL);
  v_apply:=public.flowstate_timer_command_v1('timer-resume','timer-v1','web-pwa','resume',v_id,v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,false,
    v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,v_preview->>'requestHash',1499,NULL);
  IF v_apply #>> '{receipt,readBack,isPaused}'<>'false' OR v_apply #>> '{receipt,readBack,isActive}'<>'true' THEN
    RAISE EXCEPTION 'FAIL: explicit resume failed: %',v_apply;
  END IF;
  SELECT canonical_revision INTO v_r FROM public.timer_sessions WHERE id=v_id;
  v_preview:=public.flowstate_timer_command_v1('timer-stop','timer-v1','web-pwa','stop',v_id,v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,1499,NULL);
  v_apply:=public.flowstate_timer_command_v1('timer-stop','timer-v1','web-pwa','stop',v_id,v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,false,
    v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,v_preview->>'requestHash',1499,NULL);
  IF v_apply #>> '{receipt,readBack,isActive}'<>'false' OR v_apply #>> '{receipt,readBack,completedAt}' IS NULL THEN
    RAISE EXCEPTION 'FAIL: explicit stop failed: %',v_apply;
  END IF;
END $$;

-- Signed switch/extend remain canonical and transition payloads cannot rewind elapsed time.
DO $$
DECLARE v_id uuid:='1fc50000-0000-4000-8000-000000000202'; v_r bigint;
  v_preview jsonb; v_apply jsonb; v_bad jsonb;
BEGIN
  SELECT canonical_revision INTO v_r FROM public.timer_sessions WHERE id=v_id;
  v_preview:=public.flowstate_timer_command_v1('timer-extend','timer-v1','web-pwa','extend',v_id,v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,NULL,300);
  v_apply:=public.flowstate_timer_command_v1('timer-extend','timer-v1','web-pwa','extend',v_id,v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,false,
    v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,v_preview->>'requestHash',NULL,300);
  IF v_apply #>> '{receipt,readBack,isActive}'<>'true' OR v_apply #>> '{receipt,readBack,remainingTime}'<>'300' THEN
    RAISE EXCEPTION 'FAIL: canonical extension failed: %',v_apply;
  END IF;
  SELECT canonical_revision INTO v_r FROM public.timer_sessions WHERE id=v_id;
  v_bad:=public.flowstate_timer_command_v1('timer-rewind','timer-v1','web-pwa','pause',v_id,v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,350,NULL);
  IF v_bad #>> '{error,code}'<>'illegal_transition' THEN RAISE EXCEPTION 'FAIL: elapsed time rewind accepted: %',v_bad; END IF;
  v_preview:=public.flowstate_timer_command_v1('timer-switch','timer-v1','web-pwa','switch_task',v_id,v_r,'desktop-1',NULL,'general',NULL,NULL,NULL,true,NULL,NULL,NULL,300,NULL);
  v_apply:=public.flowstate_timer_command_v1('timer-switch','timer-v1','web-pwa','switch_task',v_id,v_r,'desktop-1',NULL,'general',NULL,NULL,NULL,false,
    v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,v_preview->>'requestHash',300,NULL);
  IF v_apply #>> '{receipt,readBack,taskId}'<>'general' OR v_apply #>> '{receipt,readBack,remainingTime}'<>'300' THEN
    RAISE EXCEPTION 'FAIL: canonical task switch failed: %',v_apply;
  END IF;
END $$;

-- Fresh foreign leadership, wrong scope, stale revision, and approval mismatch fail closed.
DO $$
DECLARE v_r bigint; v_result jsonb; v_preview jsonb;
BEGIN
  INSERT INTO public.timer_sessions (id,user_id,task_id,start_time,duration,remaining_time,is_active,is_paused,is_break,device_leader_id,device_leader_last_seen)
  VALUES ('1fc50000-0000-4000-8000-000000000203','1fc50000-0000-4000-8000-000000000001','general',now(),300,300,true,false,false,'phone-2',now());
  SELECT canonical_revision INTO v_r FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000203';
  v_result:=public.flowstate_timer_command_v1('leader-conflict','timer-v1','web-pwa','pause','1fc50000-0000-4000-8000-000000000203',v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,300,NULL);
  IF v_result #>> '{error,code}'<>'leader_conflict' THEN RAISE EXCEPTION 'FAIL: fresh foreign leader was ignored: %',v_result; END IF;
  v_result:=public.flowstate_timer_command_v1('stale-revision','timer-v1','web-pwa','pause','1fc50000-0000-4000-8000-000000000203',99,'phone-2',NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,300,NULL);
  IF v_result #>> '{error,code}'<>'stale_revision' THEN RAISE EXCEPTION 'FAIL: stale revision accepted: %',v_result; END IF;
  v_result:=public.flowstate_timer_command_v1('foreign-scope','timer-v1','web-pwa','start','1fc50000-0000-4000-8000-000000000204',0,'desktop-1',NULL,
    '1fc50000-0000-4000-8000-000000000102',now(),300,false,true,NULL,NULL,NULL);
  IF v_result #>> '{error,code}'<>'scope_denied' THEN RAISE EXCEPTION 'FAIL: foreign task scope accepted: %',v_result; END IF;
  UPDATE public.timer_sessions SET device_leader_id='desktop-1',device_leader_last_seen=now()-interval '1 minute'
    WHERE id='1fc50000-0000-4000-8000-000000000203';
  SELECT canonical_revision INTO v_r FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000203';
  v_preview:=public.flowstate_timer_command_v1('approval-bind','timer-v1','web-pwa','pause','1fc50000-0000-4000-8000-000000000203',v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,true,NULL,NULL,NULL,300,NULL);
  v_result:=public.flowstate_timer_command_v1('approval-bind','timer-v1','web-pwa','pause','1fc50000-0000-4000-8000-000000000203',v_r,'desktop-1',NULL,NULL,NULL,NULL,NULL,false,
    repeat('0',64),(v_preview->>'previewExpiresAt')::timestamptz,v_preview->>'requestHash',300,NULL);
  IF v_result #>> '{error,code}'<>'preview_mismatch' THEN RAISE EXCEPTION 'FAIL: forged approval accepted: %',v_result; END IF;
END $$;

-- Injected failure after replacement proves the old active row and operation survive untouched.
DO $$
DECLARE v_preview jsonb; v_result jsonb; v_old_revision bigint;
BEGIN
  SELECT canonical_revision INTO v_old_revision FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000203';
  v_preview:=public.flowstate_timer_command_v1('timer-rollback','timer-v1','web-pwa','start','1fc50000-0000-4000-8000-000000000205',0,'desktop-1',NULL,'general',now(),600,false,true,NULL,NULL,NULL);
  PERFORM set_config('flowstate.test.fail_timer_after_replacement','on',true);
  v_result:=public.flowstate_timer_command_v1('timer-rollback','timer-v1','web-pwa','start','1fc50000-0000-4000-8000-000000000205',0,'desktop-1',NULL,'general',now(),600,false,false,
    v_preview->>'previewDigest',(v_preview->>'previewExpiresAt')::timestamptz,v_preview->>'requestHash');
  PERFORM set_config('flowstate.test.fail_timer_after_replacement','off',true);
  IF v_result #>> '{error,code}'<>'internal_error'
     OR NOT (SELECT is_active FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000203')
     OR (SELECT canonical_revision FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000203')<>v_old_revision
     OR EXISTS (SELECT 1 FROM public.timer_sessions WHERE id='1fc50000-0000-4000-8000-000000000205')
     OR EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id='timer-rollback')
     OR EXISTS (SELECT 1 FROM public.canonical_change_log WHERE operation_id='timer-rollback') THEN
    RAISE EXCEPTION 'FAIL: timer replacement failure partially committed: %',v_result;
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);
DO $$ DECLARE v_result jsonb; BEGIN
  v_result:=public.flowstate_timer_command_v1('timer-anon','timer-v1','web-pwa','start','1fc50000-0000-4000-8000-000000000206',0,'desktop-1',NULL,'general',now(),300,false,true,NULL,NULL,NULL);
  IF v_result #>> '{error,code}'<>'not_authenticated' THEN RAISE EXCEPTION 'FAIL: anonymous timer command accepted: %',v_result; END IF;
END $$;

ROLLBACK;
SELECT 'TASK-1965 canonical timer command rollback-only contract passed' AS result;
