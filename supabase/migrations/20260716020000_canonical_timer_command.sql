-- TASK-1965: canonical explicit timer command authority.
--
-- Start, pause, resume, and stop share one signed, preview-bound, replayable
-- state machine. Legacy timer writers remain observable during migration, but
-- this RPC never uses toggle semantics or a stop-then-start client sequence.

ALTER TABLE public.timer_sessions
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canonical_revision bigint NOT NULL DEFAULT 1
    CHECK (canonical_revision > 0);

CREATE OR REPLACE FUNCTION public.flowstate_h7_timer_revision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.canonical_revision := 1;
  ELSIF ROW(
    NEW.workspace_id,NEW.task_id,NEW.start_time,NEW.duration,NEW.is_active,
    NEW.is_paused,NEW.is_break,NEW.completed_at
  ) IS NOT DISTINCT FROM ROW(
    OLD.workspace_id,OLD.task_id,OLD.start_time,OLD.duration,OLD.is_active,
    OLD.is_paused,OLD.is_break,OLD.completed_at
  ) THEN
    -- Countdown persistence and lease heartbeats are operational projections.
    -- They must not invalidate a semantic start/pause/resume/stop revision.
    NEW.canonical_revision := OLD.canonical_revision;
  ELSE
    NEW.canonical_revision := OLD.canonical_revision + 1;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_h7_timer_revision() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS flowstate_h7_timer_revision ON public.timer_sessions;
CREATE TRIGGER flowstate_h7_timer_revision
BEFORE INSERT OR UPDATE ON public.timer_sessions
FOR EACH ROW EXECUTE FUNCTION public.flowstate_h7_timer_revision();

CREATE OR REPLACE FUNCTION public.flowstate_h7_timer_read_back(p_session_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.jsonb_build_object(
    'id', session.id,
    'workspaceId', session.workspace_id,
    'taskId', session.task_id,
    'startTime', session.start_time,
    'duration', session.duration,
    'remainingTime', session.remaining_time,
    'isActive', session.is_active,
    'isPaused', session.is_paused,
    'isBreak', session.is_break,
    'completedAt', session.completed_at,
    'deviceLeaderId', session.device_leader_id,
    'canonicalRevision', session.canonical_revision,
    'canonicalUpdatedAt', session.updated_at
  )
  FROM public.timer_sessions AS session WHERE session.id = p_session_id
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h7_timer_hash(p_value jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.flowstate_canonical_json_text_v1(p_value), 'UTF8'
  ), 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h7_timer_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_row public.timer_sessions%ROWTYPE;
  v_actor uuid := (SELECT auth.uid());
  v_operation_id text := nullif(pg_catalog.current_setting('flowstate.canonical.operation_id', true), '');
  v_source text := 'legacy';
  v_action text;
  v_revision bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := OLD; v_action := 'deleted'; v_revision := OLD.canonical_revision + 1;
  ELSE
    v_row := NEW; v_action := CASE WHEN TG_OP = 'INSERT' THEN 'inserted' ELSE 'updated' END;
    v_revision := NEW.canonical_revision;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.canonical_revision = OLD.canonical_revision THEN
    RETURN NEW;
  END IF;
  IF v_operation_id IS NOT NULL THEN
    SELECT operation.source INTO v_source
    FROM public.canonical_operations AS operation
    WHERE operation.user_id = v_actor AND operation.operation_id = v_operation_id
      AND operation.entity_type = 'timer_session' AND operation.state = 'applying';
    IF NOT FOUND THEN v_operation_id := NULL; v_source := 'legacy'; END IF;
  END IF;
  INSERT INTO public.canonical_change_log (
    user_id, actor_user_id, workspace_id, entity_type, entity_id, action,
    canonical_revision, operation_id, source, tombstone, projection
  ) VALUES (
    v_row.user_id, v_actor, v_row.workspace_id, 'timer_session', v_row.id::text,
    v_action, v_revision, v_operation_id, v_source, TG_OP = 'DELETE',
    pg_catalog.jsonb_build_object(
      'id',v_row.id,'taskId',v_row.task_id,'isActive',CASE WHEN TG_OP='DELETE' THEN false ELSE v_row.is_active END,
      'isPaused',v_row.is_paused,'workspaceId',v_row.workspace_id
    )
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_h7_timer_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS flowstate_h7_timer_change ON public.timer_sessions;
CREATE TRIGGER flowstate_h7_timer_change
AFTER INSERT OR UPDATE OR DELETE ON public.timer_sessions
FOR EACH ROW EXECUTE FUNCTION public.flowstate_h7_timer_change();

CREATE OR REPLACE FUNCTION public.flowstate_h7_timer_affected(
  p_session_ids uuid[], p_operation_id text
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'entityId', requested.session_id,
      'entityType', 'timer_session',
      'action', change.action,
      'canonicalRevision', session.canonical_revision,
      'changeSequence', change.change_sequence,
      'readBack', read_back.value,
      'readBackHash', public.flowstate_h7_timer_hash(read_back.value)
    ) ORDER BY requested.ordinality
  ), '[]'::jsonb)
  FROM pg_catalog.unnest(p_session_ids) WITH ORDINALITY AS requested(session_id, ordinality)
  JOIN public.timer_sessions AS session ON session.id = requested.session_id
  JOIN LATERAL (
    SELECT log.action, log.change_sequence FROM public.canonical_change_log AS log
    WHERE log.entity_type='timer_session' AND log.entity_id=requested.session_id::text
      AND log.operation_id=p_operation_id
    ORDER BY log.change_sequence DESC LIMIT 1
  ) AS change ON true
  CROSS JOIN LATERAL (
    SELECT public.flowstate_h7_timer_read_back(requested.session_id) AS value
  ) AS read_back
$$;

CREATE OR REPLACE FUNCTION public.flowstate_timer_command_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_action text,
  p_session_id uuid,
  p_base_revision bigint,
  p_device_id text,
  p_workspace_id uuid DEFAULT NULL,
  p_task_id text DEFAULT NULL,
  p_started_at timestamptz DEFAULT NULL,
  p_duration_seconds integer DEFAULT NULL,
  p_is_break boolean DEFAULT NULL,
  p_preview boolean DEFAULT true,
  p_preview_digest text DEFAULT NULL,
  p_preview_expires_at timestamptz DEFAULT NULL,
  p_request_hash text DEFAULT NULL,
  p_remaining_seconds integer DEFAULT NULL,
  p_extension_seconds integer DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_existing public.canonical_operations%ROWTYPE;
  v_issued public.canonical_operation_previews%ROWTYPE;
  v_session public.timer_sessions%ROWTYPE;
  v_task public.tasks%ROWTYPE;
  v_active public.timer_sessions%ROWTYPE;
  v_normalized jsonb;
  v_request_hash text; v_preview_digest text; v_preview_expires_at timestamptz;
  v_read_back jsonb; v_replaced jsonb := '[]'::jsonb; v_replaced_ids uuid[] := ARRAY[]::uuid[];
  v_projected_revision bigint; v_now timestamptz := pg_catalog.clock_timestamp();
  v_scope_kind text; v_scope_id text; v_context jsonb; v_affected jsonb; v_receipt jsonb;
  v_change_sequence bigint; v_target_change_sequence bigint;
  v_prior_operation_id text := pg_catalog.current_setting('flowstate.canonical.operation_id', true);
BEGIN
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
      pg_catalog.jsonb_build_object('code','not_authenticated','message','Authentication is required'));
  END IF;
  IF p_contract_version IS DISTINCT FROM 'timer-v1'
     OR p_source NOT IN ('local-api','web-pwa')
     OR p_action NOT IN ('start','pause','resume','stop','switch_task','extend')
     OR nullif(pg_catalog.btrim(p_operation_id),'') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id)>160
     OR p_session_id IS NULL
     OR nullif(pg_catalog.btrim(p_device_id),'') IS NULL
     OR p_device_id IS DISTINCT FROM pg_catalog.btrim(p_device_id)
     OR pg_catalog.char_length(p_device_id)>160
     OR p_preview IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
      pg_catalog.jsonb_build_object('code','invalid_request','message','The canonical timer request is invalid'));
  END IF;
  IF p_action='start' THEN
    IF p_base_revision IS DISTINCT FROM 0 OR nullif(pg_catalog.btrim(p_task_id),'') IS NULL
       OR p_started_at IS NULL OR p_duration_seconds NOT BETWEEN 1 AND 86400 OR p_is_break IS NULL
       OR p_remaining_seconds IS NOT NULL OR p_extension_seconds IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','invalid_request','message','Start requires stable session, interval, task, and break identity'));
    END IF;
  ELSIF p_base_revision IS NULL OR p_base_revision<1 THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
      pg_catalog.jsonb_build_object('code','invalid_request','message','Transition fields are invalid'));
  ELSIF p_action='switch_task' THEN
    IF nullif(pg_catalog.btrim(p_task_id),'') IS NULL OR p_remaining_seconds<0
       OR p_remaining_seconds IS NULL OR p_started_at IS NOT NULL OR p_duration_seconds IS NOT NULL
       OR p_extension_seconds IS NOT NULL OR p_is_break IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','invalid_request','message','Task switch fields are invalid'));
    END IF;
  ELSIF p_action='extend' THEN
    IF p_extension_seconds NOT BETWEEN 1 AND 86400 OR p_task_id IS NOT NULL
       OR p_started_at IS NOT NULL OR p_duration_seconds IS NOT NULL
       OR p_remaining_seconds IS NOT NULL OR p_is_break IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','invalid_request','message','Extension fields are invalid'));
    END IF;
  ELSIF p_task_id IS NOT NULL OR p_started_at IS NOT NULL OR p_duration_seconds IS NOT NULL
     OR p_extension_seconds IS NOT NULL OR p_is_break IS NOT NULL
     OR p_remaining_seconds IS NULL OR p_remaining_seconds<0 THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
      pg_catalog.jsonb_build_object('code','invalid_request','message','Transition fields are invalid'));
  END IF;

  v_normalized := pg_catalog.jsonb_build_object(
    'action',p_action,'sessionId',p_session_id,'baseRevision',p_base_revision,
    'deviceId',p_device_id,'workspaceId',p_workspace_id,'taskId',p_task_id,
    'startedAt',p_started_at,'durationSeconds',p_duration_seconds,'isBreak',p_is_break,
    'remainingSeconds',p_remaining_seconds,'extensionSeconds',p_extension_seconds
  );
  v_request_hash := public.flowstate_h7_timer_hash(pg_catalog.jsonb_build_object(
    'actorUserId',v_actor,'contractVersion',p_contract_version,'source',p_source,
    'normalizedPayload',v_normalized
  ));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_operation_id,0));
  -- Timer replacement is actor-global (a start retires the actor's active
  -- session even when it came from another workspace), so distinct operation
  -- IDs and scopes must share one serialization lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text||':timer-authority',0));
  SELECT * INTO v_existing FROM public.canonical_operations AS operation
  WHERE operation.user_id=v_actor AND operation.operation_id=p_operation_id;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId was already used'));
    END IF;
    IF v_existing.state='committed' AND v_existing.canonical_result IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',true,'result','committed','action',p_action,
        'operationId',p_operation_id,'requestHash',v_request_hash,'receipt',
        v_existing.canonical_result||pg_catalog.jsonb_build_object('status','replayed','replayed',true));
    END IF;
  END IF;

  IF p_action IN ('start','switch_task') THEN
    IF p_task_id NOT IN ('general','break') THEN
      SELECT * INTO v_task FROM public.tasks AS task WHERE task.id::text=p_task_id AND NOT task.is_deleted;
      IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
          pg_catalog.jsonb_build_object('code','task_not_found','message','Timer task was not found'));
      END IF;
      IF v_task.workspace_id IS DISTINCT FROM p_workspace_id
         OR (p_workspace_id IS NULL AND v_task.user_id IS DISTINCT FROM v_actor)
         OR (p_workspace_id IS NOT NULL AND NOT public.flowstate_can_read_workspace_v1(p_workspace_id)) THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
          pg_catalog.jsonb_build_object('code','scope_denied','message','Timer task is outside the active scope'));
      END IF;
    ELSIF p_workspace_id IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','scope_denied','message','General timers use personal scope'));
    END IF;
    IF p_action='start' AND EXISTS (SELECT 1 FROM public.timer_sessions AS active
      WHERE active.user_id=v_actor AND active.is_active
        AND active.device_leader_id IS DISTINCT FROM p_device_id
        AND active.device_leader_last_seen >= v_now-pg_catalog.make_interval(secs => 30)) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','leader_conflict','message','Another device holds the active timer lease'));
    END IF;
    IF p_action='start' AND EXISTS (SELECT 1 FROM public.timer_sessions WHERE id=p_session_id) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','session_id_conflict','message','sessionId already exists'));
    END IF;
    IF p_action='start' THEN
    v_projected_revision:=1;
    v_read_back:=pg_catalog.jsonb_build_object(
      'id',p_session_id,'workspaceId',p_workspace_id,'taskId',p_task_id,
      'startTime',p_started_at,'duration',p_duration_seconds,'remainingTime',p_duration_seconds,
      'isActive',true,'isPaused',false,'isBreak',p_is_break,'completedAt',NULL,
      'deviceLeaderId',p_device_id,'canonicalRevision',1,'canonicalUpdatedAt',v_now
    );
    SELECT COALESCE(pg_catalog.jsonb_agg(public.flowstate_h7_timer_read_back(active.id)
      ||pg_catalog.jsonb_build_object('isActive',false,'completedAt',v_now,
        'canonicalRevision',active.canonical_revision+1,'canonicalUpdatedAt',v_now)
      ORDER BY active.updated_at,active.id),'[]'::jsonb)
    INTO v_replaced FROM public.timer_sessions AS active WHERE active.user_id=v_actor AND active.is_active;
    ELSE
      SELECT * INTO v_session FROM public.timer_sessions AS session
      WHERE session.id=p_session_id AND session.user_id=v_actor;
      IF NOT FOUND OR v_session.workspace_id IS DISTINCT FROM p_workspace_id
         OR NOT v_session.is_active OR v_session.canonical_revision IS DISTINCT FROM p_base_revision
         OR p_remaining_seconds>v_session.remaining_time THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','stale_revision','message','Timer changed before task switch'));
      END IF;
      v_projected_revision:=v_session.canonical_revision+1;
      v_read_back:=public.flowstate_h7_timer_read_back(p_session_id)||pg_catalog.jsonb_build_object(
        'taskId',p_task_id,'remainingTime',p_remaining_seconds,
        'canonicalRevision',v_projected_revision,'canonicalUpdatedAt',v_now);
    END IF;
  ELSE
    SELECT * INTO v_session FROM public.timer_sessions AS session
    WHERE session.id=p_session_id AND session.user_id=v_actor;
    IF NOT FOUND OR v_session.workspace_id IS DISTINCT FROM p_workspace_id THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','not_found','message','Timer session was not found in scope'));
    END IF;
    IF v_session.canonical_revision IS DISTINCT FROM p_base_revision THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','stale_revision','message','Timer session changed','currentRevision',v_session.canonical_revision));
    END IF;
    IF (p_action='extend' AND (v_session.is_active OR v_session.completed_at IS NULL
          OR v_session.duration+p_extension_seconds>86400))
       OR (p_action<>'extend' AND (NOT v_session.is_active
          OR (p_action='pause' AND v_session.is_paused)
          OR (p_action='resume' AND NOT v_session.is_paused)
          OR p_remaining_seconds>v_session.remaining_time)) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','illegal_transition','message','Timer action is not legal from current state'));
    END IF;
    IF v_session.device_leader_id IS DISTINCT FROM p_device_id
       AND v_session.device_leader_last_seen >= v_now-pg_catalog.make_interval(secs => 30) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','leader_conflict','message','Another device holds the active timer lease',
          'currentRevision',v_session.canonical_revision));
    END IF;
    v_projected_revision:=v_session.canonical_revision+1;
    v_read_back:=public.flowstate_h7_timer_read_back(p_session_id)||pg_catalog.jsonb_build_object(
      'duration',CASE WHEN p_action='extend' THEN v_session.duration+p_extension_seconds ELSE v_session.duration END,
      'remainingTime',CASE WHEN p_action='extend' THEN p_extension_seconds ELSE p_remaining_seconds END,
      'isActive',p_action<>'stop','isPaused',p_action='pause',
      'completedAt',CASE WHEN p_action='stop' THEN v_now ELSE NULL END,
      'deviceLeaderId',p_device_id,'canonicalRevision',v_projected_revision,'canonicalUpdatedAt',v_now
    );
  END IF;

  IF p_preview THEN
    v_preview_expires_at:=v_now+pg_catalog.interval '5 minutes';
    v_preview_digest:=public.flowstate_h7_timer_hash(pg_catalog.jsonb_build_object(
      'operationId',p_operation_id,'requestHash',v_request_hash,'expiresAt',v_preview_expires_at
    ));
    INSERT INTO public.canonical_operation_previews (
      user_id,operation_id,preview_digest,request_hash,expires_at,consumed_at,updated_at
    ) VALUES (v_actor,p_operation_id,v_preview_digest,v_request_hash,v_preview_expires_at,NULL,v_now)
    ON CONFLICT (user_id,operation_id) DO UPDATE SET
      preview_digest=EXCLUDED.preview_digest,request_hash=EXCLUDED.request_hash,
      expires_at=EXCLUDED.expires_at,consumed_at=NULL,updated_at=EXCLUDED.updated_at;
    RETURN pg_catalog.jsonb_build_object(
      'ok',true,'result','preview','contractVersion',p_contract_version,'action',p_action,
      'operationId',p_operation_id,'requestHash',v_request_hash,'previewDigest',v_preview_digest,
      'previewExpiresAt',v_preview_expires_at,'normalizedPayload',v_normalized,
      'readBack',v_read_back,'replacedSessions',v_replaced
    );
  END IF;

  SELECT * INTO v_issued FROM public.canonical_operation_previews AS preview
  WHERE preview.user_id=v_actor AND preview.operation_id=p_operation_id FOR UPDATE;
  IF NOT FOUND OR v_issued.request_hash IS DISTINCT FROM v_request_hash
     OR p_request_hash IS DISTINCT FROM v_request_hash
     OR v_issued.preview_digest IS DISTINCT FROM p_preview_digest
     OR v_issued.expires_at IS DISTINCT FROM p_preview_expires_at
     OR v_issued.consumed_at IS NOT NULL OR v_issued.expires_at<=v_now THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
      pg_catalog.jsonb_build_object('code','preview_mismatch','message','Timer approval is invalid or expired'));
  END IF;

  -- Re-lock and revalidate immediately before the atomic state transition.
  PERFORM 1 FROM public.timer_sessions AS session WHERE session.user_id=v_actor
  ORDER BY session.id FOR UPDATE;
  IF p_action='start' THEN
    IF EXISTS (SELECT 1 FROM public.timer_sessions AS active
      WHERE active.user_id=v_actor AND active.is_active
        AND active.device_leader_id IS DISTINCT FROM p_device_id
        AND active.device_leader_last_seen >= v_now-pg_catalog.make_interval(secs => 30))
       OR EXISTS (SELECT 1 FROM public.timer_sessions WHERE id=p_session_id) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','leader_conflict','message','Timer state changed after preview'));
    END IF;
  ELSE
    SELECT * INTO v_session FROM public.timer_sessions AS session
    WHERE session.id=p_session_id AND session.user_id=v_actor FOR UPDATE;
    IF NOT FOUND OR v_session.canonical_revision IS DISTINCT FROM p_base_revision
       OR (p_action='extend' AND (v_session.is_active OR v_session.completed_at IS NULL
          OR v_session.duration+p_extension_seconds>86400))
       OR (p_action<>'extend' AND (NOT v_session.is_active
          OR (p_action='pause' AND v_session.is_paused)
          OR (p_action='resume' AND NOT v_session.is_paused)
          OR p_remaining_seconds>v_session.remaining_time)) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','stale_revision','message','Timer changed after preview'));
    END IF;
    IF v_session.device_leader_id IS DISTINCT FROM p_device_id
       AND v_session.device_leader_last_seen >= v_now-pg_catalog.make_interval(secs => 30) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','leader_conflict','message','Another device holds the lease'));
    END IF;
  END IF;

  v_scope_kind:=CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
  v_scope_id:=COALESCE(p_workspace_id::text,v_actor::text);
  INSERT INTO public.canonical_operations (
    user_id,operation_id,contract_version,source,scope_kind,scope_id,workspace_id,
    entity_type,action,entity_id,request_hash,state,operation_context,affected_entities
  ) VALUES (
    v_actor,p_operation_id,p_contract_version,p_source,v_scope_kind,v_scope_id,p_workspace_id,
    'timer_session',p_action,p_session_id::text,v_request_hash,'applying','{}','[]'
  ) ON CONFLICT (user_id,operation_id) DO NOTHING;
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',p_operation_id,true);

  IF p_action='start' THEN
    SELECT COALESCE(pg_catalog.array_agg(active.id ORDER BY active.updated_at,active.id),ARRAY[]::uuid[])
      INTO v_replaced_ids FROM public.timer_sessions AS active WHERE active.user_id=v_actor AND active.is_active;
    UPDATE public.timer_sessions SET is_active=false,completed_at=v_now,updated_at=v_now
    WHERE user_id=v_actor AND is_active;
    IF pg_catalog.current_setting('flowstate.test.fail_timer_after_replacement',true)='on' THEN
      RAISE EXCEPTION 'injected timer replacement failure';
    END IF;
    INSERT INTO public.timer_sessions (
      id,user_id,workspace_id,task_id,start_time,duration,remaining_time,is_active,is_paused,
      is_break,completed_at,device_leader_id,device_leader_last_seen,created_at,updated_at
    ) VALUES (
      p_session_id,v_actor,p_workspace_id,p_task_id,p_started_at,p_duration_seconds,p_duration_seconds,
      true,false,p_is_break,NULL,p_device_id,v_now,v_now,v_now
    );
  ELSIF p_action='switch_task' THEN
    UPDATE public.timer_sessions SET task_id=p_task_id,remaining_time=p_remaining_seconds,
      device_leader_id=p_device_id,device_leader_last_seen=v_now,updated_at=v_now
    WHERE id=p_session_id AND user_id=v_actor;
  ELSIF p_action='extend' THEN
    UPDATE public.timer_sessions SET duration=duration+p_extension_seconds,
      remaining_time=p_extension_seconds,is_active=true,is_paused=false,completed_at=NULL,
      device_leader_id=p_device_id,device_leader_last_seen=v_now,updated_at=v_now
    WHERE id=p_session_id AND user_id=v_actor;
  ELSE
    UPDATE public.timer_sessions SET
      is_active=p_action<>'stop',is_paused=p_action='pause',
      remaining_time=p_remaining_seconds,
      completed_at=CASE WHEN p_action='stop' THEN v_now ELSE NULL END,
      device_leader_id=p_device_id,device_leader_last_seen=v_now,updated_at=v_now
    WHERE id=p_session_id AND user_id=v_actor;
  END IF;
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
  UPDATE public.canonical_operation_previews SET consumed_at=v_now,updated_at=v_now
  WHERE user_id=v_actor AND operation_id=p_operation_id;

  v_affected:=public.flowstate_h7_timer_affected(
    ARRAY[p_session_id]||v_replaced_ids,p_operation_id
  );
  IF pg_catalog.jsonb_array_length(v_affected)<>1+COALESCE(pg_catalog.array_length(v_replaced_ids,1),0) THEN
    RAISE EXCEPTION 'canonical timer change evidence is incomplete';
  END IF;
  v_read_back:=public.flowstate_h7_timer_read_back(p_session_id);
  v_target_change_sequence:=(v_affected #>> '{0,changeSequence}')::bigint;
  v_change_sequence:=v_target_change_sequence;
  v_context:=pg_catalog.jsonb_build_object('replacedSessionIds',pg_catalog.to_jsonb(v_replaced_ids));
  v_receipt:=pg_catalog.jsonb_build_object(
    'ok',true,'status','committed','contractVersion',p_contract_version,
    'operationId',p_operation_id,'requestHash',v_request_hash,'source',p_source,
    'entityType','timer_session','entityId',p_session_id,'action',p_action,
    'canonicalRevision',(v_read_back->>'canonicalRevision')::bigint,
    'canonicalUpdatedAt',v_read_back->>'canonicalUpdatedAt','changeSequence',v_change_sequence,
    'replayed',false,'committedAt',v_now,'affected',v_affected,'readBack',v_read_back,
    'readBackHash',public.flowstate_h7_timer_hash(v_read_back),'operationContext',v_context
  );
  UPDATE public.canonical_operations SET
    state='committed',canonical_revision=(v_read_back->>'canonicalRevision')::bigint,
    change_sequence=v_change_sequence,canonical_result=v_receipt,operation_context=v_context,
    affected_entities=v_affected,committed_at=v_now,updated_at=v_now
  WHERE user_id=v_actor AND operation_id=p_operation_id;
  RETURN pg_catalog.jsonb_build_object('ok',true,'result','committed','action',p_action,
    'operationId',p_operation_id,'requestHash',v_request_hash,'receipt',v_receipt);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
  RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
    pg_catalog.jsonb_build_object('code','internal_error','message','Canonical timer command rolled back'));
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_timer_session(
  p_session_id uuid,
  p_device_id text,
  p_remaining_time integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid:=auth.uid();
  v_rows integer;
BEGIN
  IF v_actor IS NULL OR p_device_id IS NULL OR pg_catalog.btrim(p_device_id)='' THEN
    RETURN false;
  END IF;
  UPDATE public.timer_sessions
  SET remaining_time=GREATEST(0,LEAST(duration,p_remaining_time)),
      device_leader_id=p_device_id,
      device_leader_last_seen=pg_catalog.now(),
      updated_at=pg_catalog.now()
  WHERE id=p_session_id AND user_id=v_actor AND is_active
    AND (
      device_leader_id IS NULL OR device_leader_id=p_device_id OR
      device_leader_last_seen<pg_catalog.now()-pg_catalog.make_interval(secs=>30)
    );
  GET DIAGNOSTICS v_rows=ROW_COUNT;
  RETURN v_rows=1;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_h7_timer_read_back(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h7_timer_hash(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h7_timer_affected(uuid[],text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_timer_command_v1(
  text,text,text,text,uuid,bigint,text,uuid,text,timestamptz,integer,boolean,boolean,text,timestamptz,text,integer,integer
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_timer_command_v1(
  text,text,text,text,uuid,bigint,text,uuid,text,timestamptz,integer,boolean,boolean,text,timestamptz,text,integer,integer
) TO authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_timer_session(uuid,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.heartbeat_timer_session(uuid,text,integer) TO authenticated;

COMMENT ON FUNCTION public.flowstate_timer_command_v1(
  text,text,text,text,uuid,bigint,text,uuid,text,timestamptz,integer,boolean,boolean,text,timestamptz,text,integer,integer
) IS 'TASK-1965 explicit canonical timer actions with atomic replacement and durable replay';
COMMENT ON FUNCTION public.heartbeat_timer_session(uuid,text,integer)
IS 'TASK-1965 operational timer lease and countdown heartbeat; never changes semantic canonical revision';
