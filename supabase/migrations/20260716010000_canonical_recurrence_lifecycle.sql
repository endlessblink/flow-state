-- TASK-1965: signed recurrence-chain reads and canonical future lifecycle authority.
-- Completed history rows are read-only evidence. Only the one unambiguous living
-- occurrence and the series-state row can be changed by this surface.

CREATE TABLE IF NOT EXISTS public.recurrence_series_state (
  series_id text PRIMARY KEY REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NULL,
  lifecycle_status text NOT NULL CHECK (lifecycle_status IN ('active', 'paused', 'ended')),
  recurrence_definition jsonb NOT NULL,
  current_task_id text NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

ALTER TABLE public.recurrence_series_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS recurrence_series_state_select ON public.recurrence_series_state;
CREATE POLICY recurrence_series_state_select ON public.recurrence_series_state
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.flowstate_can_read_workspace_v1(workspace_id))
  );
REVOKE ALL ON TABLE public.recurrence_series_state FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.recurrence_series_state TO authenticated;

CREATE OR REPLACE FUNCTION public.flowstate_h7_bounded_integer(p_value text, p_max integer)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE v_value bigint;
BEGIN
  IF p_value IS NULL OR p_value !~ '^[1-9][0-9]*$' THEN RETURN NULL; END IF;
  v_value:=p_value::bigint;
  IF v_value>p_max THEN RETURN NULL; END IF;
  RETURN v_value::integer;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h7_valid_date(p_value text)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  RETURN p_value ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND pg_catalog.to_char(p_value::date,'YYYY-MM-DD')=p_value;
EXCEPTION WHEN OTHERS THEN RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h7_valid_rule(p_rule jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_rule IS NOT NULL
    AND pg_catalog.jsonb_typeof(p_rule) = 'object'
    AND p_rule->>'pattern' IN ('daily','weekly','monthly','yearly')
    AND p_rule->>'endType' IN ('never','after_count','on_date')
    AND public.flowstate_h7_bounded_integer(p_rule->>'interval',999) IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_object_keys(p_rule) AS key(value)
      WHERE key.value NOT IN ('pattern','interval','weekdays','monthDay','monthWeekday','endType','endDate','endCount')
    )
    AND CASE p_rule->>'pattern'
      WHEN 'weekly' THEN NOT (p_rule ? 'weekdays') OR (
        pg_catalog.jsonb_typeof(p_rule->'weekdays') = 'array'
        AND pg_catalog.jsonb_array_length(p_rule->'weekdays') BETWEEN 1 AND 7
        AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.jsonb_array_elements_text(p_rule->'weekdays') day(value)
          WHERE public.flowstate_h7_bounded_integer(day.value,6) IS NULL AND day.value<>'0'
        )
        AND pg_catalog.jsonb_array_length(p_rule->'weekdays') = (
          SELECT pg_catalog.count(DISTINCT day.value)
          FROM pg_catalog.jsonb_array_elements_text(p_rule->'weekdays') day(value)
        )
      )
      WHEN 'monthly' THEN (
        (NOT (p_rule ?| ARRAY['monthDay','monthWeekday']))
        OR
        (public.flowstate_h7_bounded_integer(p_rule->>'monthDay',31) IS NOT NULL AND NOT (p_rule ? 'monthWeekday'))
        OR (
          NOT (p_rule ? 'monthDay')
          AND pg_catalog.jsonb_typeof(p_rule->'monthWeekday') = 'object'
          AND (p_rule#>>'{monthWeekday,nth}'='-1' OR public.flowstate_h7_bounded_integer(p_rule#>>'{monthWeekday,nth}',5) IS NOT NULL)
          AND (public.flowstate_h7_bounded_integer(p_rule#>>'{monthWeekday,day}',6) IS NOT NULL OR p_rule#>>'{monthWeekday,day}'='0')
          AND NOT EXISTS (
            SELECT 1 FROM pg_catalog.jsonb_object_keys(p_rule->'monthWeekday') key(value)
            WHERE key.value NOT IN ('nth','day')
          )
        )
      )
      ELSE NOT (p_rule ?| ARRAY['weekdays','monthDay','monthWeekday'])
    END
    AND CASE p_rule->>'endType'
      WHEN 'never' THEN NOT (p_rule ?| ARRAY['endDate','endCount'])
      WHEN 'after_count' THEN public.flowstate_h7_bounded_integer(p_rule->>'endCount',2147483647) IS NOT NULL AND NOT (p_rule ? 'endDate')
      WHEN 'on_date' THEN public.flowstate_h7_valid_date(p_rule->>'endDate')
        AND NOT (p_rule ? 'endCount')
      ELSE false
    END
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h7_next_due_date(
  p_base date, p_rule jsonb, p_next_count integer
)
RETURNS date
LANGUAGE plpgsql IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_candidate date;
  v_month date;
  v_nth integer;
  v_day integer;
  v_last_day integer;
  v_offset integer;
BEGIN
  IF p_base IS NULL OR NOT public.flowstate_h7_valid_rule(p_rule) OR p_next_count < 1 THEN RETURN NULL; END IF;
  IF p_rule->>'endType' = 'after_count' AND p_next_count > (p_rule->>'endCount')::integer THEN RETURN NULL; END IF;
  CASE p_rule->>'pattern'
    WHEN 'daily' THEN v_candidate := p_base + (p_rule->>'interval')::integer;
    WHEN 'weekly' THEN
      IF NOT (p_rule ? 'weekdays') THEN
        v_candidate:=p_base+(7*(p_rule->>'interval')::integer);
      ELSE
        FOR v_offset IN 1..(7 * (p_rule->>'interval')::integer + 7) LOOP
          v_candidate := p_base + v_offset;
          IF extract(dow FROM v_candidate)::integer IN (
            SELECT day.value::integer FROM pg_catalog.jsonb_array_elements_text(p_rule->'weekdays') day(value)
          ) AND (
            (v_candidate - pg_catalog.date_trunc('week', p_base)::date) / 7
          ) % (p_rule->>'interval')::integer = 0 THEN EXIT; END IF;
          v_candidate := NULL;
        END LOOP;
      END IF;
    WHEN 'monthly' THEN
      v_month := (pg_catalog.date_trunc('month', p_base) + ((p_rule->>'interval')::integer || ' months')::interval)::date;
      v_last_day := extract(day FROM (v_month + interval '1 month - 1 day'))::integer;
      IF NOT (p_rule ?| ARRAY['monthDay','monthWeekday']) THEN
        v_candidate:=v_month+(least(extract(day FROM p_base)::integer,v_last_day)-1);
      ELSIF p_rule ? 'monthDay' THEN
        v_candidate := v_month + (least((p_rule->>'monthDay')::integer, v_last_day) - 1);
      ELSE
        v_nth := (p_rule#>>'{monthWeekday,nth}')::integer;
        v_day := (p_rule#>>'{monthWeekday,day}')::integer;
        IF v_nth=-1 THEN
          v_candidate:=(v_month+interval '1 month - 1 day')::date;
          v_candidate:=v_candidate-((extract(dow FROM v_candidate)::integer-v_day+7)%7);
        ELSE
          v_candidate := v_month + ((v_day - extract(dow FROM v_month)::integer + 7) % 7) + (7 * (v_nth - 1));
          IF v_candidate >= v_month + interval '1 month' THEN v_candidate := NULL; END IF;
        END IF;
      END IF;
    WHEN 'yearly' THEN
      v_candidate := (p_base + ((p_rule->>'interval')::integer || ' years')::interval)::date;
  END CASE;
  IF p_rule->>'endType' = 'on_date' AND v_candidate > (p_rule->>'endDate')::date THEN RETURN NULL; END IF;
  RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_recurrence_chain_v1(
  p_contract_version text,
  p_task_id text,
  p_workspace_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_seed public.tasks%ROWTYPE;
  v_current public.tasks%ROWTYPE;
  v_state public.recurrence_series_state%ROWTYPE;
  v_series_id text;
  v_current_count integer;
  v_other_count integer;
  v_bad_history_count integer;
  v_history_count integer;
  v_distinct_history_count integer;
  v_distinct_history_date_count integer;
  v_history jsonb;
  v_definition jsonb;
  v_status text;
  v_next_date date;
BEGIN
  IF v_actor IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','signed_user_required','message','A signed user is required')); END IF;
  IF p_contract_version <> 'task-v1' OR nullif(pg_catalog.btrim(p_task_id),'') IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','invalid_request','message','Exact task identity and task-v1 are required'));
  END IF;
  IF p_workspace_id IS NOT NULL AND NOT public.flowstate_can_read_workspace_v1(p_workspace_id) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','scope_denied','message','Workspace read access is required'));
  END IF;
  SELECT * INTO v_seed FROM public.tasks task
  WHERE task.id::text=p_task_id
    AND task.workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND ((p_workspace_id IS NULL AND task.user_id=v_actor) OR p_workspace_id IS NOT NULL);
  IF NOT FOUND THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','not_found','message','Task was not found in the active scope')); END IF;
  v_series_id := COALESCE(v_seed.recurrence_parent_id, v_seed.id);

  SELECT pg_catalog.count(*) FILTER (WHERE NOT task.is_completion_record AND NOT task.is_deleted AND task.status<>'done'),
         pg_catalog.count(*) FILTER (WHERE NOT task.is_completion_record AND (task.id<>v_series_id OR task.status='done' OR task.is_deleted)),
         pg_catalog.count(*) FILTER (WHERE task.is_completion_record AND (task.status<>'done' OR task.completed_at IS NULL OR task.recurrence_parent_id IS DISTINCT FROM v_series_id)),
         pg_catalog.count(*) FILTER (WHERE task.is_completion_record),
         pg_catalog.count(DISTINCT task.recurrence_count) FILTER (WHERE task.is_completion_record),
         pg_catalog.count(DISTINCT task.due_date::date) FILTER (WHERE task.is_completion_record)
  INTO v_current_count,v_other_count,v_bad_history_count,v_history_count,v_distinct_history_count,v_distinct_history_date_count
  FROM public.tasks task
  WHERE (task.id=v_series_id OR task.recurrence_parent_id=v_series_id)
    AND task.workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND ((p_workspace_id IS NULL AND task.user_id=v_actor) OR p_workspace_id IS NOT NULL);
  IF v_current_count<>1 THEN
    RETURN pg_catalog.jsonb_build_object('ok',true,'fresh',true,'ambiguity',pg_catalog.jsonb_build_object('code','ambiguous_current_occurrence','count',v_current_count));
  END IF;
  IF v_bad_history_count<>0 OR v_history_count<>v_distinct_history_count
     OR v_history_count<>v_distinct_history_date_count OR v_other_count<>0 THEN
    RETURN pg_catalog.jsonb_build_object('ok',true,'fresh',true,'ambiguity',pg_catalog.jsonb_build_object('code','ambiguous_history'));
  END IF;
  SELECT * INTO STRICT v_current FROM public.tasks task
  WHERE (task.id=v_series_id OR task.recurrence_parent_id=v_series_id)
    AND task.workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND ((p_workspace_id IS NULL AND task.user_id=v_actor) OR p_workspace_id IS NOT NULL)
    AND NOT task.is_completion_record AND NOT task.is_deleted AND task.status<>'done';
  SELECT * INTO v_state FROM public.recurrence_series_state state WHERE state.series_id=v_series_id;
  IF FOUND THEN
    IF (p_workspace_id IS NULL AND v_state.user_id<>v_actor)
       OR v_state.workspace_id IS DISTINCT FROM p_workspace_id OR v_state.current_task_id<>v_current.id THEN
      RETURN pg_catalog.jsonb_build_object('ok',true,'fresh',true,'ambiguity',pg_catalog.jsonb_build_object('code','ambiguous_current_occurrence'));
    END IF;
    v_status:=v_state.lifecycle_status;
    v_definition:=CASE WHEN v_status='ended' THEN NULL ELSE v_state.recurrence_definition END;
  ELSIF v_current.recurrence_rule IS NOT NULL THEN
    v_status:='active'; v_definition:=v_current.recurrence_rule;
  ELSE
    RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','recurrence_not_found','message','Task has no authoritative recurrence definition'));
  END IF;
  IF v_status='active' AND (v_current.recurrence_rule IS NULL OR NOT public.flowstate_h7_valid_rule(v_definition)) THEN
    RETURN pg_catalog.jsonb_build_object('ok',true,'fresh',true,'ambiguity',pg_catalog.jsonb_build_object('code','ambiguous_current_occurrence'));
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',task.id,'recurrenceCount',task.recurrence_count,'dueDate',task.due_date::date,
      'status','done','completedAt',task.completed_at,'canonicalRevision',task.canonical_revision,
      'canonicalUpdatedAt',task.updated_at
    ) ORDER BY task.recurrence_count,task.id),'[]'::jsonb)
  INTO v_history FROM public.tasks task
  WHERE task.recurrence_parent_id=v_series_id
    AND task.workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND ((p_workspace_id IS NULL AND task.user_id=v_actor) OR p_workspace_id IS NOT NULL)
    AND task.is_completion_record;
  v_next_date:=CASE WHEN v_status='active' THEN public.flowstate_h7_next_due_date(v_current.due_date::date,v_definition,COALESCE(v_current.recurrence_count,0)+1) ELSE NULL END;
  RETURN pg_catalog.jsonb_build_object(
    'ok',true,'fresh',true,'contractVersion','task-v1','seriesId',v_series_id,'id',v_current.id,
    'workspaceId',p_workspace_id,'lifecycleStatus',v_status,'definition',v_definition,
    'seriesRevision',v_current.canonical_revision,'canonicalRevision',v_current.canonical_revision,
    'canonicalUpdatedAt',v_current.updated_at,'history',v_history,
    'currentOccurrence',pg_catalog.jsonb_build_object('id',v_current.id,'recurrenceCount',COALESCE(v_current.recurrence_count,0),
      'dueDate',v_current.due_date::date,'status',CASE WHEN v_current.status='done' THEN 'done' ELSE 'todo' END,
      'canonicalRevision',v_current.canonical_revision,'canonicalUpdatedAt',v_current.updated_at),
    'nextOccurrence',CASE WHEN v_next_date IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
      'dueDate',v_next_date,'recurrenceCount',COALESCE(v_current.recurrence_count,0)+1) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h7_mutate_series(
  p_actor uuid,p_series_id text,p_current_id text,p_expected_revision bigint,p_action text,p_rule jsonb,p_next_date date,p_workspace_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current public.tasks%ROWTYPE;
  v_state public.recurrence_series_state%ROWTYPE;
  v_status text;
  v_definition jsonb;
BEGIN
  SELECT * INTO STRICT v_current FROM public.tasks task WHERE task.id=p_current_id FOR UPDATE;
  IF v_current.workspace_id IS DISTINCT FROM p_workspace_id
     OR (p_workspace_id IS NULL AND v_current.user_id IS DISTINCT FROM p_actor)
     OR (p_workspace_id IS NOT NULL AND NOT public.flowstate_can_write_workspace_v1(p_workspace_id)) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='scope_denied';
  END IF;
  IF v_current.canonical_revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='stale_revision';
  END IF;
  SELECT * INTO v_state FROM public.recurrence_series_state state WHERE state.series_id=p_series_id FOR UPDATE;
  IF FOUND THEN
    IF v_state.workspace_id IS DISTINCT FROM p_workspace_id
       OR (p_workspace_id IS NULL AND v_state.user_id IS DISTINCT FROM p_actor) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='scope_denied';
    END IF;
    v_status:=v_state.lifecycle_status; v_definition:=v_state.recurrence_definition;
  ELSE v_status:='active'; v_definition:=v_current.recurrence_rule; END IF;
  IF p_action='edit_future' THEN
    IF v_status='ended' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='series_ended'; END IF;
    v_definition:=p_rule;
  ELSIF p_action='pause' THEN
    IF v_status='paused' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='already_paused'; END IF;
    IF v_status='ended' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='series_ended'; END IF;
    v_status:='paused';
  ELSIF p_action='resume' THEN
    IF v_status<>'paused' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='not_paused'; END IF;
    v_status:='active';
  ELSIF p_action='end_series' THEN
    IF v_status='ended' THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='series_ended'; END IF;
    v_status:='ended';
  ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='invalid_action'; END IF;
  INSERT INTO public.recurrence_series_state(series_id,user_id,workspace_id,lifecycle_status,recurrence_definition,current_task_id)
  VALUES(p_series_id,p_actor,p_workspace_id,v_status,v_definition,p_current_id)
  ON CONFLICT(series_id) DO UPDATE SET lifecycle_status=EXCLUDED.lifecycle_status,
    recurrence_definition=EXCLUDED.recurrence_definition,current_task_id=EXCLUDED.current_task_id,
    updated_at=pg_catalog.clock_timestamp();
  UPDATE public.tasks task SET
    recurrence_rule=CASE WHEN v_status='active' THEN v_definition ELSE NULL END,
    due_date=COALESCE(p_next_date,task.due_date),updated_at=pg_catalog.clock_timestamp()
  WHERE task.id=p_current_id
    AND task.workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND ((p_workspace_id IS NULL AND task.user_id=p_actor) OR p_workspace_id IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_recurrence_lifecycle_v1(
  p_contract_version text,p_source text,p_operation_id text,p_task_id text,p_base_revision bigint,
  p_action text,p_recurrence_rule jsonb DEFAULT NULL,p_next_due_date date DEFAULT NULL,
  p_time_zone text DEFAULT 'UTC',p_preview boolean DEFAULT true,p_preview_digest text DEFAULT NULL,
  p_preview_expires_at timestamptz DEFAULT NULL,p_request_hash text DEFAULT NULL,p_workspace_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid:=auth.uid(); v_chain jsonb; v_series_id text; v_current_id text;
  v_request_hash text; v_preview_digest text; v_preview_expires_at timestamptz;
  v_existing public.canonical_operations%ROWTYPE; v_issued public.canonical_operation_previews%ROWTYPE;
  v_history_before jsonb; v_history_after jsonb; v_read_back jsonb; v_affected jsonb; v_receipt jsonb;
  v_change_floor bigint; v_change_sequence bigint; v_prior_operation_id text:=pg_catalog.current_setting('flowstate.canonical.operation_id',true);
  v_expected_next date; v_base_date date; v_context jsonb;
BEGIN
  IF v_actor IS NULL THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','signed_user_required','message','A signed user is required')); END IF;
  IF p_contract_version<>'task-v1' OR p_source<>'local-api' OR nullif(pg_catalog.btrim(p_operation_id),'') IS NULL
     OR pg_catalog.length(p_operation_id)>160 OR p_action NOT IN ('edit_future','pause','resume','end_series')
     OR p_base_revision<1 OR nullif(pg_catalog.btrim(p_time_zone),'') IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','invalid_request','message','Invalid recurrence lifecycle request'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names zone WHERE zone.name=p_time_zone) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','invalid_request','message','A valid IANA time zone is required'));
  END IF;
  IF p_action='edit_future' AND NOT public.flowstate_h7_valid_rule(p_recurrence_rule) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','invalid_recurrence_rule','message','A valid recurrence rule is required'));
  END IF;
  IF p_action<>'edit_future' AND (p_recurrence_rule IS NOT NULL OR p_next_due_date IS NOT NULL) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','invalid_request','message','Only edit_future accepts recurrence data'));
  END IF;
  v_request_hash:=pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
    'actorUserId',v_actor,'contractVersion',p_contract_version,'source',p_source,'action',p_action,
    'taskId',p_task_id,'baseRevision',p_base_revision,'recurrenceRule',p_recurrence_rule,
    'nextDueDate',p_next_due_date,'timeZone',p_time_zone,'workspaceId',p_workspace_id
  )),'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_operation_id,0));
  SELECT * INTO v_existing FROM public.canonical_operations operation WHERE operation.user_id=v_actor AND operation.operation_id=p_operation_id;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId was already used')); END IF;
    IF v_existing.state='committed' AND v_existing.canonical_result IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',true,'result','committed','action','recurrence_'||p_action,
        'operationId',p_operation_id,'requestHash',v_request_hash,'receipt',v_existing.canonical_result||pg_catalog.jsonb_build_object('status','replayed','replayed',true));
    END IF;
  END IF;
  IF NOT p_preview THEN
    SELECT * INTO v_issued FROM public.canonical_operation_previews issued WHERE issued.user_id=v_actor AND issued.operation_id=p_operation_id FOR UPDATE;
    IF NOT FOUND OR v_issued.request_hash IS DISTINCT FROM v_request_hash OR p_request_hash IS DISTINCT FROM v_request_hash
       OR v_issued.preview_digest IS DISTINCT FROM p_preview_digest OR v_issued.expires_at IS DISTINCT FROM p_preview_expires_at
       OR v_issued.consumed_at IS NOT NULL THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','preview_mismatch','message','Approval does not match this request')); END IF;
    IF v_issued.expires_at<=pg_catalog.clock_timestamp() THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','preview_expired','message','Approval expired')); END IF;
  END IF;
  v_chain:=public.flowstate_recurrence_chain_v1(p_contract_version,p_task_id,p_workspace_id);
  IF v_chain->'ambiguity' IS NOT NULL THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',v_chain->'ambiguity'); END IF;
  IF v_chain->>'ok'<>'true' THEN RETURN v_chain; END IF;
  v_series_id:=v_chain->>'seriesId'; v_current_id:=v_chain#>>'{currentOccurrence,id}';
  IF (v_chain->>'seriesRevision')::bigint<>p_base_revision THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','stale_revision','message','Current occurrence changed','currentRevision',(v_chain->>'seriesRevision')::bigint));
  END IF;
  SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(task) ORDER BY task.id),'[]'::jsonb) INTO v_history_before
  FROM public.tasks task WHERE task.recurrence_parent_id=v_series_id
    AND task.workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND ((p_workspace_id IS NULL AND task.user_id=v_actor) OR p_workspace_id IS NOT NULL)
    AND task.is_completion_record;
  IF p_next_due_date IS NOT NULL THEN
    SELECT pg_catalog.max(task.due_date::date) INTO v_base_date FROM public.tasks task
    WHERE task.recurrence_parent_id=v_series_id
      AND task.workspace_id IS NOT DISTINCT FROM p_workspace_id
      AND ((p_workspace_id IS NULL AND task.user_id=v_actor) OR p_workspace_id IS NOT NULL)
      AND task.is_completion_record;
    v_base_date:=COALESCE(v_base_date,(v_chain#>>'{currentOccurrence,dueDate}')::date);
    v_expected_next:=public.flowstate_h7_next_due_date(v_base_date,p_recurrence_rule,(v_chain#>>'{currentOccurrence,recurrenceCount}')::integer);
    IF v_expected_next IS DISTINCT FROM p_next_due_date THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','invalid_next_date','message','nextDueDate is incompatible with the recurrence definition','expectedNextDate',v_expected_next)); END IF;
  END IF;
  IF p_preview THEN
    BEGIN
      PERFORM public.flowstate_h7_mutate_series(v_actor,v_series_id,v_current_id,p_base_revision,p_action,p_recurrence_rule,p_next_due_date,p_workspace_id);
      v_read_back:=public.flowstate_recurrence_chain_v1(p_contract_version,p_task_id,p_workspace_id);
      RAISE EXCEPTION 'flowstate H7 preview rollback';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM<>'flowstate H7 preview rollback' THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code',SQLERRM,'message','Recurrence preview was rejected'));
      END IF;
    END;
    SELECT * INTO v_issued FROM public.canonical_operation_previews issued WHERE issued.user_id=v_actor AND issued.operation_id=p_operation_id FOR UPDATE;
    IF FOUND THEN
      IF v_issued.request_hash IS DISTINCT FROM v_request_hash THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId already has another preview')); END IF;
      IF v_issued.consumed_at IS NOT NULL OR v_issued.expires_at<=pg_catalog.clock_timestamp() THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','preview_expired','message','Use a new operationId')); END IF;
      v_preview_digest:=v_issued.preview_digest; v_preview_expires_at:=v_issued.expires_at;
    ELSE
      v_preview_digest:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex'); v_preview_expires_at:=pg_catalog.clock_timestamp()+interval '15 minutes';
      INSERT INTO public.canonical_operation_previews(user_id,operation_id,preview_digest,request_hash,expires_at)
      VALUES(v_actor,p_operation_id,v_preview_digest,v_request_hash,v_preview_expires_at);
    END IF;
    RETURN pg_catalog.jsonb_build_object('ok',true,'result','preview','preview',true,'contractVersion',p_contract_version,
      'action','recurrence_'||p_action,'operationId',p_operation_id,'requestHash',v_request_hash,
      'previewDigest',v_preview_digest,'previewExpiresAt',v_preview_expires_at,'seriesId',v_series_id,
      'workspaceId',p_workspace_id,'baseRevision',p_base_revision,'normalizedPayload',pg_catalog.jsonb_build_object(
        'action',p_action,'recurrenceRule',p_recurrence_rule,'nextDueDate',p_next_due_date),'readBack',v_read_back);
  END IF;
  v_context:=pg_catalog.jsonb_build_object('action','recurrence_'||p_action,'seriesId',v_series_id,
    'requestedTaskId',p_task_id,'currentTaskId',v_current_id,'timeZone',p_time_zone,
    'recurrenceRule',p_recurrence_rule,'nextDueDate',p_next_due_date,'workspaceId',p_workspace_id);
  BEGIN
    INSERT INTO public.canonical_operations(user_id,operation_id,contract_version,source,scope_kind,scope_id,workspace_id,
      entity_type,action,entity_id,request_hash,state,operation_context)
    VALUES(v_actor,p_operation_id,p_contract_version,p_source,CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END,
      COALESCE(p_workspace_id::text,v_actor::text),p_workspace_id,'task','recurrence_'||p_action,v_current_id,v_request_hash,'applying',v_context);
    UPDATE public.canonical_operation_previews issued SET consumed_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
    WHERE issued.user_id=v_actor AND issued.operation_id=p_operation_id AND issued.preview_digest=p_preview_digest AND issued.consumed_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'preview consumption race'; END IF;
    SELECT COALESCE(pg_catalog.max(change_sequence),0) INTO v_change_floor FROM public.canonical_change_log;
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',p_operation_id,true);
    PERFORM public.flowstate_h7_mutate_series(v_actor,v_series_id,v_current_id,p_base_revision,p_action,p_recurrence_rule,p_next_due_date,p_workspace_id);
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
    PERFORM public.flowstate_h3_link_task_changes(ARRAY[v_current_id],p_operation_id,v_change_floor);
    UPDATE public.canonical_change_log SET source=p_source WHERE operation_id=p_operation_id AND change_sequence>v_change_floor;
    v_read_back:=public.flowstate_recurrence_chain_v1(p_contract_version,p_task_id,p_workspace_id);
    SELECT COALESCE(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(task) ORDER BY task.id),'[]'::jsonb) INTO v_history_after
    FROM public.tasks task WHERE task.recurrence_parent_id=v_series_id
      AND task.workspace_id IS NOT DISTINCT FROM p_workspace_id
      AND ((p_workspace_id IS NULL AND task.user_id=v_actor) OR p_workspace_id IS NOT NULL)
      AND task.is_completion_record;
    IF v_history_after IS DISTINCT FROM v_history_before THEN RAISE EXCEPTION 'history changed during recurrence lifecycle mutation'; END IF;
    SELECT change.change_sequence INTO STRICT v_change_sequence FROM public.canonical_change_log change
    WHERE change.operation_id=p_operation_id AND change.entity_type='task' AND change.entity_id=v_current_id ORDER BY change.change_sequence DESC LIMIT 1;
    v_affected:=pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('entityId',v_current_id,'entityType','task','action','update',
      'canonicalRevision',(v_read_back->>'canonicalRevision')::bigint,'changeSequence',v_change_sequence,
      'readBack',public.flowstate_h3_task_read_back(v_current_id),
      'readBackHash',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.flowstate_canonical_json_text_v1(
        public.flowstate_h3_task_read_back(v_current_id)),'UTF8'),'sha256'),'hex')));
    v_receipt:=pg_catalog.jsonb_build_object('ok',true,'status','committed','replayed',false,'operationId',p_operation_id,
      'requestHash',v_request_hash,'contractVersion',p_contract_version,'source',p_source,'entityType','task',
      'action','recurrence_'||p_action,'entityId',v_current_id,'canonicalRevision',(v_read_back->>'canonicalRevision')::bigint,
      'canonicalUpdatedAt',v_read_back->>'canonicalUpdatedAt','changeSequence',v_change_sequence,'committedAt',pg_catalog.clock_timestamp(),
      'readBack',v_read_back,'readBackHash',pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.flowstate_canonical_json_text_v1(v_read_back),'UTF8'),'sha256'),'hex'),
      'affected',v_affected,'operationContext',v_context);
    UPDATE public.canonical_operations SET state='committed',canonical_revision=(v_read_back->>'canonicalRevision')::bigint,
      change_sequence=v_change_sequence,canonical_result=v_receipt,affected_entities=v_affected,
      committed_at=(v_receipt->>'committedAt')::timestamptz,updated_at=pg_catalog.clock_timestamp()
    WHERE user_id=v_actor AND operation_id=p_operation_id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
    IF SQLERRM IN ('series_ended','already_paused','not_paused','stale_revision','scope_denied') THEN RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code',SQLERRM,'message','Recurrence lifecycle conflict')); END IF;
    RETURN pg_catalog.jsonb_build_object('ok',false,'error',pg_catalog.jsonb_build_object('code','internal_error','message','Canonical recurrence lifecycle rolled back'));
  END;
  RETURN pg_catalog.jsonb_build_object('ok',true,'result','committed','action','recurrence_'||p_action,
    'operationId',p_operation_id,'requestHash',v_request_hash,'receipt',v_receipt);
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_h7_valid_rule(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h7_bounded_integer(text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h7_valid_date(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h7_next_due_date(date,jsonb,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h7_mutate_series(uuid,text,text,bigint,text,jsonb,date,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.flowstate_recurrence_chain_v1(text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flowstate_recurrence_chain_v1(text,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.flowstate_recurrence_lifecycle_v1(text,text,text,text,bigint,text,jsonb,date,text,boolean,text,timestamptz,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flowstate_recurrence_lifecycle_v1(text,text,text,text,bigint,text,jsonb,date,text,boolean,text,timestamptz,text,uuid) TO authenticated;

COMMENT ON FUNCTION public.flowstate_recurrence_lifecycle_v1(text,text,text,text,bigint,text,jsonb,date,text,boolean,text,timestamptz,text,uuid)
IS 'TASK-1965 preview/apply recurrence future-definition edit, pause, resume, and end-series authority with exact immutable completion history, revision CAS, and stable replay.';

NOTIFY pgrst, 'reload schema';
