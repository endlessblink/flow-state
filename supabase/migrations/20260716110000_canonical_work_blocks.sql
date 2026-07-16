-- Canonical preview/apply lifecycle for embedded calendar work blocks.
-- Stable work-block identifiers remain claimed after removal so retries can
-- never create a second logical block under a reused identifier.

CREATE TABLE IF NOT EXISTS public.canonical_work_block_ids (
  work_block_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  task_id text NOT NULL,
  operation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

ALTER TABLE public.canonical_work_block_ids ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.canonical_work_block_ids FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.flowstate_work_block_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_task_id text,
  p_base_revision bigint,
  p_work_block_revision bigint,
  p_command jsonb,
  p_preview boolean DEFAULT true,
  p_preview_digest text DEFAULT NULL,
  p_preview_expires_at timestamptz DEFAULT NULL,
  p_workspace_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_task public.tasks%ROWTYPE;
  v_updated public.tasks%ROWTYPE;
  v_existing public.canonical_operations%ROWTYPE;
  v_issued_preview public.canonical_operation_previews%ROWTYPE;
  v_action text;
  v_command jsonb;
  v_work_block_id text;
  v_before jsonb;
  v_after jsonb;
  v_instances jsonb;
  v_normalized jsonb;
  v_request_hash text;
  v_expected_preview_digest text;
  v_preview_expiry timestamptz;
  v_date date;
  v_time time without time zone;
  v_duration integer;
  v_timezone text;
  v_finish_by timestamp without time zone;
  v_local_start timestamp without time zone;
  v_local_end timestamp without time zone;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_overlap_warnings jsonb := '[]'::jsonb;
  v_lock_task_id text;
  v_other_task record;
  v_other jsonb;
  v_other_start timestamptz;
  v_other_end timestamptz;
  v_other_timezone text;
  v_before_interval jsonb := 'null'::jsonb;
  v_after_interval jsonb := 'null'::jsonb;
  v_preview_payload jsonb;
  v_scope_kind text;
  v_scope_id text;
  v_change_sequence bigint;
  v_read_back jsonb;
  v_read_back_hash text;
  v_receipt jsonb;
  v_now timestamptz;
  v_prior_operation_id text := pg_catalog.current_setting('flowstate.canonical.operation_id', true);
BEGIN
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','not_authenticated','message','Authentication is required'));
  END IF;
  IF p_contract_version IS DISTINCT FROM 'work-block-v1'
     OR nullif(pg_catalog.btrim(p_operation_id),'') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id) > 160
     OR p_source IS DISTINCT FROM 'local-api'
     OR nullif(pg_catalog.btrim(p_task_id),'') IS NULL
     OR p_base_revision IS NULL OR p_base_revision < 1
     OR p_work_block_revision IS NULL OR p_work_block_revision < 0
     OR p_command IS NULL OR pg_catalog.jsonb_typeof(p_command) <> 'object'
     OR pg_catalog.jsonb_typeof(p_command->'action') <> 'string'
     OR p_preview IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_request','message','The work-block request is invalid'));
  END IF;

  v_action := p_command->>'action';
  v_command := p_command;
  IF v_action NOT IN ('create','move','resize','remove') THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_action','message','action must be create, move, resize, or remove'));
  END IF;

  IF v_action = 'create' THEN
    IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(p_command) k(key) WHERE k.key NOT IN ('action','workBlock','finishBy'))
       OR pg_catalog.jsonb_typeof(p_command->'workBlock') <> 'object'
       OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(p_command->'workBlock') k(key) WHERE k.key NOT IN ('id','scheduledDate','scheduledTime','duration','timezone')) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_command','message','Create contains unsupported fields'));
    END IF;
    v_work_block_id := p_command#>>'{workBlock,id}';
    IF pg_catalog.jsonb_typeof(p_command#>'{workBlock,id}') <> 'string'
       OR v_work_block_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR p_work_block_revision <> 0 THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_work_block','message','Create requires a stable UUID and workBlockRevision 0'));
    END IF;
    v_work_block_id := pg_catalog.lower(v_work_block_id);
    v_date := (p_command#>>'{workBlock,scheduledDate}')::date;
    v_time := (p_command#>>'{workBlock,scheduledTime}')::time;
    v_timezone := p_command#>>'{workBlock,timezone}';
    v_command := pg_catalog.jsonb_set(v_command,'{workBlock,id}',pg_catalog.to_jsonb(v_work_block_id),false);
  ELSE
    v_work_block_id := p_command->>'workBlockId';
    IF pg_catalog.jsonb_typeof(p_command->'workBlockId') <> 'string'
       OR v_work_block_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR p_work_block_revision < 1 THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_work_block','message','The command requires an existing stable work-block ID and revision'));
    END IF;
    v_work_block_id := pg_catalog.lower(v_work_block_id);
    v_command := pg_catalog.jsonb_set(v_command,'{workBlockId}',pg_catalog.to_jsonb(v_work_block_id),false);
    IF v_action = 'move' THEN
      IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(p_command) k(key) WHERE k.key NOT IN ('action','workBlockId','scheduledDate','scheduledTime','timezone','finishBy')) THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_command','message','Move contains unsupported fields'));
      END IF;
      v_date := (p_command->>'scheduledDate')::date;
      v_time := (p_command->>'scheduledTime')::time;
      v_timezone := p_command->>'timezone';
    ELSIF v_action = 'resize' THEN
      IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(p_command) k(key) WHERE k.key NOT IN ('action','workBlockId','duration','finishBy')) THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_command','message','Resize contains unsupported fields'));
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(p_command) k(key) WHERE k.key NOT IN ('action','workBlockId')) THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_command','message','Remove contains unsupported fields'));
      END IF;
    END IF;
  END IF;

  -- Convert malformed scalar/date/time input into typed rejection rather than a database error.
  IF v_action IN ('create','move') AND (
       CASE WHEN v_action='create' THEN
         pg_catalog.jsonb_typeof(p_command#>'{workBlock,scheduledDate}') <> 'string'
         OR COALESCE(p_command#>>'{workBlock,scheduledDate}','') !~ '^\d{4}-\d{2}-\d{2}$'
         OR pg_catalog.jsonb_typeof(p_command#>'{workBlock,scheduledTime}') <> 'string'
         OR COALESCE(p_command#>>'{workBlock,scheduledTime}','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
       ELSE
         pg_catalog.jsonb_typeof(p_command->'scheduledDate') <> 'string'
         OR COALESCE(p_command->>'scheduledDate','') !~ '^\d{4}-\d{2}-\d{2}$'
         OR pg_catalog.jsonb_typeof(p_command->'scheduledTime') <> 'string'
         OR COALESCE(p_command->>'scheduledTime','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
       END) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_interval','message','An exact local date and time are required'));
  END IF;
  IF v_action IN ('create','resize') AND (
       CASE WHEN v_action='create' THEN pg_catalog.jsonb_typeof(p_command#>'{workBlock,duration}') ELSE pg_catalog.jsonb_typeof(p_command->'duration') END
       <> 'number'
       OR CASE WHEN v_action='create' THEN (p_command#>>'{workBlock,duration}')::numeric ELSE (p_command->>'duration')::numeric END
          <> pg_catalog.trunc(CASE WHEN v_action='create' THEN (p_command#>>'{workBlock,duration}')::numeric ELSE (p_command->>'duration')::numeric END)
       OR CASE WHEN v_action='create' THEN (p_command#>>'{workBlock,duration}')::numeric ELSE (p_command->>'duration')::numeric END NOT BETWEEN 1 AND 1440) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_duration','message','duration must be 1 to 1440 whole minutes'));
  END IF;
  IF v_action IN ('create','resize') THEN
    v_duration := CASE WHEN v_action='create' THEN (p_command#>>'{workBlock,duration}')::integer ELSE (p_command->>'duration')::integer END;
  END IF;
  IF v_action IN ('create','move') AND (
       v_timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names zone WHERE zone.name=v_timezone)) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_timezone','message','A recognized IANA timezone is required'));
  END IF;
  IF p_command ? 'finishBy' THEN
    IF pg_catalog.jsonb_typeof(p_command->'finishBy') <> 'string' OR COALESCE(p_command->>'finishBy','') !~ '^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$' THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_finish_by','message','finishBy must be an exact local minute'));
    END IF;
    v_finish_by := (p_command->>'finishBy')::timestamp;
  END IF;

  v_normalized := pg_catalog.jsonb_build_object(
    'contractVersion',p_contract_version,'source',p_source,'action',v_action,
    'taskId',p_task_id,'baseRevision',p_base_revision,
    'workBlockRevision',p_work_block_revision,'workspaceId',p_workspace_id,
    'command',v_command
  );
  v_request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.flowstate_receipt_canonical_json_v1(v_normalized),'UTF8'),'sha256'),'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_operation_id,0));
  IF NOT p_preview THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'work-block-scope:' || COALESCE(p_workspace_id::text, v_actor::text), 0
    ));
  END IF;

  SELECT * INTO v_existing FROM public.canonical_operations operation
  WHERE operation.user_id=v_actor AND operation.operation_id=p_operation_id FOR UPDATE;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId belongs to another request'));
    ELSIF p_preview THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId is already committed and its approval cannot be reopened'));
    ELSIF NOT p_preview AND v_existing.state='committed' AND v_existing.canonical_result IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object('ok',true,'status','committed','result','committed','requestHash',v_request_hash,'receipt',v_existing.canonical_result || pg_catalog.jsonb_build_object('replayed',true));
    END IF;
  END IF;

  SELECT * INTO v_task FROM public.tasks task WHERE task.id::text=p_task_id AND task.is_deleted=false;
  IF NOT FOUND OR v_task.workspace_id IS DISTINCT FROM p_workspace_id
     OR (v_task.workspace_id IS NULL AND v_task.user_id IS DISTINCT FROM v_actor)
     OR (v_task.workspace_id IS NOT NULL AND NOT public.flowstate_can_write_workspace_v1(v_task.workspace_id)) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','not_found','message','Task was not found'));
  END IF;
  IF NOT p_preview THEN
    -- Match the existing multi-task mutation convention: acquire every scope
    -- row in stable order before upgrading the target to FOR UPDATE. This
    -- prevents a work-block/merge lock cycle while keeping overlap evidence
    -- stable through commit.
    FOR v_lock_task_id IN
      SELECT task.id::text FROM public.tasks task
      WHERE task.is_deleted=false
        AND ((task.workspace_id IS NULL AND task.user_id=v_actor)
          OR (task.workspace_id IS NOT NULL AND task.workspace_id=v_task.workspace_id AND public.flowstate_can_read_workspace_v1(task.workspace_id)))
      ORDER BY task.id::text
    LOOP
      PERFORM 1 FROM public.tasks task WHERE task.id::text=v_lock_task_id FOR SHARE;
    END LOOP;
    SELECT * INTO v_task FROM public.tasks task
    WHERE task.id::text=p_task_id AND task.is_deleted=false FOR UPDATE;
    IF NOT FOUND OR v_task.workspace_id IS DISTINCT FROM p_workspace_id
       OR (v_task.workspace_id IS NULL AND v_task.user_id IS DISTINCT FROM v_actor)
       OR (v_task.workspace_id IS NOT NULL AND NOT public.flowstate_can_write_workspace_v1(v_task.workspace_id)) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','not_found','message','Task was not found'));
    END IF;
  END IF;
  IF v_task.canonical_revision IS DISTINCT FROM p_base_revision THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','stale_revision','message','Task changed after the requested base revision','currentRevision',v_task.canonical_revision));
  END IF;
  IF pg_catalog.jsonb_typeof(v_task.instances) <> 'array' THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','invalid_existing_work_blocks','message','Existing work-block data must be repaired'));
  END IF;
  v_instances := v_task.instances;
  IF EXISTS (
       SELECT 1 FROM pg_catalog.jsonb_array_elements(v_instances) item(value)
       WHERE pg_catalog.jsonb_typeof(item.value) <> 'object'
          OR pg_catalog.jsonb_typeof(item.value->'id') <> 'string'
          OR nullif(pg_catalog.btrim(item.value->>'id'),'') IS NULL
     ) OR (
       SELECT pg_catalog.count(*) IS DISTINCT FROM pg_catalog.count(DISTINCT item.value->>'id')
       FROM pg_catalog.jsonb_array_elements(v_instances) item(value)
     ) THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','invalid_existing_work_blocks','message','Existing work-block IDs must be non-empty and unique'));
  END IF;

  IF v_action='create' THEN
    IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_instances) item(value) WHERE item.value->>'id'=v_work_block_id)
       OR EXISTS (SELECT 1 FROM public.canonical_work_block_ids claim WHERE claim.work_block_id=v_work_block_id::uuid)
       OR EXISTS (
         SELECT 1 FROM public.tasks existing_task
         CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
           CASE WHEN pg_catalog.jsonb_typeof(existing_task.instances)='array' THEN existing_task.instances ELSE '[]'::jsonb END
         ) item(value)
         WHERE item.value->>'id'=v_work_block_id
       ) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','work_block_id_conflict','message','This stable work-block ID was already used'));
    END IF;
    v_after := pg_catalog.jsonb_build_object('id',v_work_block_id,'taskId',v_task.id,'scheduledDate',v_date::text,'scheduledTime',pg_catalog.to_char(v_time,'HH24:MI'),'duration',v_duration,'timezone',v_timezone,'canonicalRevision',1);
  ELSE
    SELECT item.value INTO v_before FROM pg_catalog.jsonb_array_elements(v_instances) item(value) WHERE item.value->>'id'=v_work_block_id;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','work_block_not_found','message','Work block was not found on this task'));
    END IF;
    IF pg_catalog.jsonb_typeof(v_before->'canonicalRevision') <> 'number'
       OR (v_before->>'canonicalRevision')::numeric <> pg_catalog.trunc((v_before->>'canonicalRevision')::numeric)
       OR (v_before->>'canonicalRevision')::bigint IS DISTINCT FROM p_work_block_revision THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','stale_work_block_revision','message','Work block changed after the requested revision','currentRevision',v_before->'canonicalRevision'));
    END IF;
    IF COALESCE(v_before->>'scheduledDate','') !~ '^\d{4}-\d{2}-\d{2}$'
       OR COALESCE(v_before->>'scheduledTime','') !~ '^([01]\d|2[0-3]):[0-5]\d$'
       OR pg_catalog.jsonb_typeof(v_before->'duration') <> 'number'
       OR (v_before->>'duration')::numeric <> pg_catalog.trunc((v_before->>'duration')::numeric)
       OR (v_before->>'duration')::integer NOT BETWEEN 1 AND 1440
       OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names zone WHERE zone.name=v_before->>'timezone') THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','invalid_existing_work_block','message','The existing work block cannot be interpreted canonically'));
    END IF;
    IF v_action='move' THEN
      IF v_before->>'scheduledDate'=v_date::text
         AND v_before->>'scheduledTime'=pg_catalog.to_char(v_time,'HH24:MI')
         AND v_before->>'timezone'=v_timezone THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','no_change','message','The work-block command would not change canonical state'));
      END IF;
      v_after := v_before || pg_catalog.jsonb_build_object('scheduledDate',v_date::text,'scheduledTime',pg_catalog.to_char(v_time,'HH24:MI'),'timezone',v_timezone,'canonicalRevision',p_work_block_revision+1);
    ELSIF v_action='resize' THEN
      IF (v_before->>'duration')::integer=v_duration THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','no_change','message','The work-block command would not change canonical state'));
      END IF;
      v_after := v_before || pg_catalog.jsonb_build_object('duration',v_duration,'canonicalRevision',p_work_block_revision+1);
    ELSE
      v_after := NULL;
    END IF;
  END IF;

  IF v_before IS NOT NULL THEN
    v_before_interval := pg_catalog.jsonb_build_object(
      'localStart',(v_before->>'scheduledDate') || 'T' || (v_before->>'scheduledTime'),
      'localEnd',pg_catalog.to_char((v_before->>'scheduledDate')::date + (v_before->>'scheduledTime')::time + pg_catalog.make_interval(mins=>(v_before->>'duration')::integer),'YYYY-MM-DD"T"HH24:MI')
    );
  END IF;

  IF v_after IS NOT NULL THEN
    v_date := (v_after->>'scheduledDate')::date;
    v_time := (v_after->>'scheduledTime')::time;
    v_duration := (v_after->>'duration')::integer;
    v_timezone := v_after->>'timezone';
    v_local_start := v_date + v_time;
    v_local_end := v_local_start + pg_catalog.make_interval(mins=>v_duration);
    v_start_at := v_local_start AT TIME ZONE v_timezone;
    v_end_at := v_local_end AT TIME ZONE v_timezone;
    IF v_finish_by IS NOT NULL AND v_local_end > v_finish_by THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','finish_by_exceeded','message','The work block would finish after finishBy'));
    END IF;
    v_after_interval := pg_catalog.jsonb_build_object('localStart',pg_catalog.to_char(v_local_start,'YYYY-MM-DD"T"HH24:MI'),'localEnd',pg_catalog.to_char(v_local_end,'YYYY-MM-DD"T"HH24:MI'));

    FOR v_other_task IN SELECT task.id,task.instances FROM public.tasks task
      WHERE task.is_deleted=false
        AND ((task.workspace_id IS NULL AND task.user_id=v_actor)
          OR (task.workspace_id IS NOT NULL AND task.workspace_id=v_task.workspace_id AND public.flowstate_can_read_workspace_v1(task.workspace_id)))
    LOOP
      IF pg_catalog.jsonb_typeof(v_other_task.instances)='array' THEN
        FOR v_other IN SELECT value FROM pg_catalog.jsonb_array_elements(v_other_task.instances)
        LOOP
          v_other_timezone := v_other->>'timezone';
          IF v_other->>'id' IS DISTINCT FROM v_work_block_id
             AND COALESCE(v_other->>'scheduledDate','') ~ '^\d{4}-\d{2}-\d{2}$'
             AND COALESCE(v_other->>'scheduledTime','') ~ '^([01]\d|2[0-3]):[0-5]\d$'
             AND pg_catalog.jsonb_typeof(v_other->'duration')='number'
             AND (v_other->>'duration')::numeric=pg_catalog.trunc((v_other->>'duration')::numeric)
             AND (v_other->>'duration')::integer BETWEEN 1 AND 1440
             AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names zone WHERE zone.name=v_other_timezone) THEN
            v_other_start := ((v_other->>'scheduledDate')::date + (v_other->>'scheduledTime')::time) AT TIME ZONE v_other_timezone;
            v_other_end := v_other_start + pg_catalog.make_interval(mins=>(v_other->>'duration')::integer);
            IF v_start_at < v_other_end AND v_end_at > v_other_start THEN
              v_overlap_warnings := v_overlap_warnings || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
                'taskId',v_other_task.id,'workBlockId',v_other->>'id','localStart',(v_other->>'scheduledDate') || 'T' || (v_other->>'scheduledTime'),'timezone',v_other_timezone));
            END IF;
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  IF v_action='create' THEN
    v_instances := v_instances || pg_catalog.jsonb_build_array(v_after);
  ELSIF v_action IN ('move','resize') THEN
    SELECT COALESCE(pg_catalog.jsonb_agg(CASE WHEN item.value->>'id'=v_work_block_id THEN v_after ELSE item.value END ORDER BY item.ordinality),'[]'::jsonb)
      INTO v_instances FROM pg_catalog.jsonb_array_elements(v_instances) WITH ORDINALITY item(value,ordinality);
  ELSE
    SELECT COALESCE(pg_catalog.jsonb_agg(item.value ORDER BY item.ordinality),'[]'::jsonb)
      INTO v_instances FROM pg_catalog.jsonb_array_elements(v_instances) WITH ORDINALITY item(value,ordinality) WHERE item.value->>'id' IS DISTINCT FROM v_work_block_id;
  END IF;

  v_preview_payload := pg_catalog.jsonb_build_object(
    'action',v_action,'workBlockId',v_work_block_id,
    'interval',pg_catalog.jsonb_build_object('before',v_before_interval,'after',v_after_interval),
    'timezone',COALESCE(v_after->>'timezone',v_before->>'timezone'),
    'duration',pg_catalog.jsonb_build_object('beforeMinutes',CASE WHEN v_before IS NULL THEN NULL ELSE (v_before->>'duration')::integer END,'afterMinutes',CASE WHEN v_after IS NULL THEN NULL ELSE (v_after->>'duration')::integer END),
    'overlapWarnings',v_overlap_warnings,
    'taskEffect',pg_catalog.jsonb_build_object('taskId',v_task.id,'dueDate',pg_catalog.jsonb_build_object(
      'before',CASE WHEN v_task.due_date IS NULL THEN NULL ELSE pg_catalog.to_char(v_task.due_date,'YYYY-MM-DD') END,
      'after',CASE WHEN v_task.due_date IS NULL THEN NULL ELSE pg_catalog.to_char(v_task.due_date,'YYYY-MM-DD') END)),
    'finishByBoundary',CASE WHEN v_finish_by IS NULL THEN 'null'::jsonb ELSE pg_catalog.jsonb_build_object('finishBy',pg_catalog.to_char(v_finish_by,'YYYY-MM-DD"T"HH24:MI'),'satisfied',true) END
  );
  v_preview_expiry := pg_catalog.clock_timestamp() + interval '10 minutes';
  v_expected_preview_digest := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.flowstate_receipt_canonical_json_v1(pg_catalog.jsonb_build_object('requestHash',v_request_hash,'preview',v_preview_payload,'expiresAt',v_preview_expiry)),'UTF8'),'sha256'),'hex');

  IF p_preview THEN
    SELECT * INTO v_issued_preview FROM public.canonical_operation_previews issued
      WHERE issued.user_id=v_actor AND issued.operation_id=p_operation_id FOR UPDATE;
    IF FOUND AND v_issued_preview.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId belongs to another preview request'));
    ELSIF FOUND AND v_issued_preview.consumed_at IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','idempotency_conflict','message','This operation approval was already consumed'));
    ELSIF FOUND AND v_issued_preview.consumed_at IS NULL AND v_issued_preview.expires_at>pg_catalog.clock_timestamp() THEN
      v_expected_preview_digest := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.flowstate_receipt_canonical_json_v1(pg_catalog.jsonb_build_object('requestHash',v_request_hash,'preview',v_preview_payload,'expiresAt',v_issued_preview.expires_at)),'UTF8'),'sha256'),'hex');
      IF v_issued_preview.preview_digest IS DISTINCT FROM v_expected_preview_digest THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','preview_mismatch','message','Preview evidence changed; use a new operationId'));
      END IF;
      RETURN pg_catalog.jsonb_build_object('ok',true,'status','preview','result','preview','requestHash',v_request_hash,'previewDigest',v_issued_preview.preview_digest,'previewExpiresAt',v_issued_preview.expires_at,'normalizedPayload',v_normalized,'preview',v_preview_payload,'readBack',pg_catalog.jsonb_build_object('id',v_task.id,'instances',v_instances,'canonicalRevision',v_task.canonical_revision));
    END IF;
    INSERT INTO public.canonical_operation_previews(user_id,operation_id,preview_digest,request_hash,expires_at)
    VALUES(v_actor,p_operation_id,v_expected_preview_digest,v_request_hash,v_preview_expiry)
    ON CONFLICT (user_id,operation_id) DO UPDATE SET preview_digest=excluded.preview_digest,request_hash=excluded.request_hash,expires_at=excluded.expires_at,consumed_at=NULL,updated_at=pg_catalog.clock_timestamp();
    RETURN pg_catalog.jsonb_build_object('ok',true,'status','preview','result','preview','requestHash',v_request_hash,'previewDigest',v_expected_preview_digest,'previewExpiresAt',v_preview_expiry,'normalizedPayload',v_normalized,'preview',v_preview_payload,'readBack',pg_catalog.jsonb_build_object('id',v_task.id,'instances',v_instances,'canonicalRevision',v_task.canonical_revision));
  END IF;

  SELECT * INTO v_issued_preview FROM public.canonical_operation_previews issued
    WHERE issued.user_id=v_actor AND issued.operation_id=p_operation_id FOR UPDATE;
  IF FOUND THEN
    v_expected_preview_digest := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.flowstate_receipt_canonical_json_v1(pg_catalog.jsonb_build_object('requestHash',v_request_hash,'preview',v_preview_payload,'expiresAt',v_issued_preview.expires_at)),'UTF8'),'sha256'),'hex');
  END IF;
  IF NOT FOUND OR v_issued_preview.request_hash IS DISTINCT FROM v_request_hash
     OR v_issued_preview.preview_digest IS DISTINCT FROM p_preview_digest
     OR v_expected_preview_digest IS DISTINCT FROM p_preview_digest
     OR v_issued_preview.expires_at IS DISTINCT FROM p_preview_expires_at OR v_issued_preview.consumed_at IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','preview_mismatch','message','The approval does not match this request'));
  ELSIF v_issued_preview.expires_at <= pg_catalog.clock_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','preview_expired','message','The approved preview expired'));
  END IF;

  -- Claim a create identifier before consuming approval or opening the durable
  -- operation. A concurrent claim loses cleanly with no partial operation.
  IF v_action='create' THEN
    INSERT INTO public.canonical_work_block_ids(work_block_id,user_id,task_id,operation_id)
    VALUES(v_work_block_id::uuid,v_actor,v_task.id,p_operation_id)
    ON CONFLICT (work_block_id) DO NOTHING;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','work_block_id_conflict','message','This stable work-block ID was claimed concurrently'));
    END IF;
  ELSE
    INSERT INTO public.canonical_work_block_ids(work_block_id,user_id,task_id,operation_id)
    VALUES(v_work_block_id::uuid,v_actor,v_task.id,p_operation_id)
    ON CONFLICT (work_block_id) DO NOTHING;
    IF EXISTS (
      SELECT 1 FROM public.canonical_work_block_ids claim
      WHERE claim.work_block_id=v_work_block_id::uuid AND claim.task_id IS DISTINCT FROM v_task.id
    ) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','work_block_id_conflict','message','This work-block ID is claimed by another task'));
    END IF;
  END IF;

  v_scope_kind := CASE WHEN v_task.workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
  v_scope_id := COALESCE(v_task.workspace_id::text,v_actor::text);
  INSERT INTO public.canonical_operations(user_id,operation_id,contract_version,source,scope_kind,scope_id,workspace_id,entity_type,action,entity_id,request_hash,state)
  VALUES(v_actor,p_operation_id,p_contract_version,p_source,v_scope_kind,v_scope_id,v_task.workspace_id,'task','work_block_'||v_action,v_task.id,v_request_hash,'applying')
  ON CONFLICT (user_id,operation_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId was already used'));
  END IF;
  UPDATE public.canonical_operation_previews SET consumed_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
    WHERE user_id=v_actor AND operation_id=p_operation_id AND preview_digest=p_preview_digest AND consumed_at IS NULL;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',pg_catalog.jsonb_build_object('code','preview_mismatch','message','The approval was already consumed'));
  END IF;
  v_now := pg_catalog.clock_timestamp();
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',p_operation_id,true);
  UPDATE public.tasks task SET instances=v_instances,updated_at=v_now WHERE task.id=v_task.id RETURNING task.* INTO STRICT v_updated;
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
  SELECT change.change_sequence INTO STRICT v_change_sequence FROM public.canonical_change_log change
    WHERE change.actor_user_id=v_actor AND change.operation_id=p_operation_id AND change.entity_type='task'
      AND change.entity_id=v_updated.id::text AND change.canonical_revision=v_updated.canonical_revision
    ORDER BY change.change_sequence DESC LIMIT 1;
  v_read_back := pg_catalog.jsonb_build_object(
    'id',v_updated.id,'workBlock',CASE WHEN v_after IS NULL THEN 'null'::jsonb ELSE v_after END,
    'removedWorkBlockId',CASE WHEN v_action='remove' THEN v_work_block_id ELSE NULL END,
    'instances',v_updated.instances,'workspaceId',v_updated.workspace_id,
    'canonicalRevision',v_updated.canonical_revision,'canonicalUpdatedAt',v_updated.updated_at
  );
  v_read_back_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.flowstate_receipt_canonical_json_v1(v_read_back),'UTF8'),'sha256'),'hex');
  v_receipt := pg_catalog.jsonb_build_object(
    'contractVersion',p_contract_version,'operationId',p_operation_id,'source',p_source,
    'entityType','task','action','work_block_'||v_action,'entityId',v_updated.id,
    'workBlockId',v_work_block_id,'requestHash',v_request_hash,
    'canonicalRevision',v_updated.canonical_revision,'canonicalUpdatedAt',v_updated.updated_at,
    'changeSequence',v_change_sequence,'status','committed','replayed',false,
    'committedAt',pg_catalog.clock_timestamp(),'readBack',v_read_back,'readBackHash',v_read_back_hash
  );
  UPDATE public.canonical_operations operation SET state='committed',canonical_revision=v_updated.canonical_revision,
    change_sequence=v_change_sequence,canonical_result=v_receipt,committed_at=(v_receipt->>'committedAt')::timestamptz,updated_at=pg_catalog.clock_timestamp()
    WHERE operation.user_id=v_actor AND operation.operation_id=p_operation_id;
  RETURN pg_catalog.jsonb_build_object('ok',true,'status','committed','result','committed','requestHash',v_request_hash,'receipt',v_receipt);
EXCEPTION
  WHEN invalid_datetime_format OR datetime_field_overflow OR invalid_text_representation THEN
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',pg_catalog.jsonb_build_object('code','invalid_interval','message','The local interval is invalid'));
  WHEN OTHERS THEN
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_work_block_v1(text,text,text,text,bigint,bigint,jsonb,boolean,text,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_work_block_v1(text,text,text,text,bigint,bigint,jsonb,boolean,text,timestamptz,uuid) TO authenticated;

COMMENT ON FUNCTION public.flowstate_work_block_v1(text,text,text,text,bigint,bigint,jsonb,boolean,text,timestamptz,uuid) IS
  'Preview/apply one stable create/move/resize/remove work-block command under task and work-block CAS with exact interval evidence.';
