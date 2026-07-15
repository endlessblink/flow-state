-- TASK-1964: canonical atomic work-block batches.
--
-- Calendar blocks remain embedded in tasks.instances. This command gives that
-- array stable element identities, exact-content CAS, signed-user scope,
-- preview/apply approval binding, atomic multi-parent writes, and replayable
-- canonical evidence without treating due_date as a scheduled interval.

CREATE OR REPLACE FUNCTION public.flowstate_h6_work_block_id(
  p_actor uuid, p_task_id text, p_operation_id text, p_client_id text
)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT 'work-block-' || pg_catalog.substr(pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(
      p_actor::text || ':' || p_task_id || ':' || p_operation_id || ':' || p_client_id,
      'UTF8'
    ), 'sha256'), 'hex'), 1, 32)
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h6_work_block_hash(p_block jsonb)
RETURNS text LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.flowstate_canonical_json_text_v1(p_block), 'UTF8'
  ), 'sha256'), 'hex')
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h6_task_read_back(
  p_task_id text, p_instances jsonb DEFAULT NULL, p_inbox boolean DEFAULT NULL,
  p_revision bigint DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.flowstate_h4_task_read_back(task.id::text)
    || pg_catalog.jsonb_build_object(
      'canonicalRevision', COALESCE(p_revision, task.canonical_revision),
      'instances', COALESCE(p_instances, task.instances, '[]'::jsonb),
      'recurringInstances', COALESCE(task.recurring_instances, '[]'::jsonb),
      'isInInbox', CASE
        WHEN p_inbox IS NULL THEN task.is_in_inbox
        ELSE p_inbox AND task.position IS NULL
      END
    )
  FROM public.tasks AS task WHERE task.id::text = p_task_id
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h6_task_affected(p_task_ids text[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'entityId', requested.task_id,
      'entityType', 'task',
      'action', 'update',
      'canonicalRevision', task.canonical_revision,
      'changeSequence', change.change_sequence,
      'readBack', read_back.value,
      'readBackHash', public.flowstate_h6_work_block_hash(read_back.value)
    ) ORDER BY requested.ordinality
  ), '[]'::jsonb)
  FROM pg_catalog.unnest(p_task_ids) WITH ORDINALITY AS requested(task_id, ordinality)
  JOIN public.tasks AS task ON task.id::text = requested.task_id
  JOIN LATERAL (
    SELECT log.change_sequence FROM public.canonical_change_log AS log
    WHERE log.entity_type = 'task' AND log.entity_id = requested.task_id
    ORDER BY log.change_sequence DESC LIMIT 1
  ) AS change ON true
  CROSS JOIN LATERAL (
    SELECT public.flowstate_h6_task_read_back(requested.task_id) AS value
  ) AS read_back
$$;

CREATE OR REPLACE FUNCTION public.flowstate_work_block_batch_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_operations jsonb,
  p_time_zone text,
  p_finish_by timestamptz DEFAULT NULL,
  p_preview boolean DEFAULT true,
  p_preview_digest text DEFAULT NULL,
  p_preview_expires_at timestamptz DEFAULT NULL,
  p_workspace_id uuid DEFAULT NULL,
  p_request_hash text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_existing public.canonical_operations%ROWTYPE;
  v_issued public.canonical_operation_previews%ROWTYPE;
  v_task public.tasks%ROWTYPE;
  v_updated public.tasks%ROWTYPE;
  v_operation jsonb;
  v_normalized jsonb;
  v_normalized_operations jsonb := '[]'::jsonb;
  v_unknown_keys text[];
  v_kind text; v_task_id text; v_block_id text; v_client_id text;
  v_base_revision bigint; v_index integer; v_current jsonb; v_next jsonb;
  v_instances jsonb; v_projected jsonb := '{}'::jsonb;
  v_base_revisions jsonb := '{}'::jsonb;
  v_task_ids text[] := ARRAY[]::text[];
  v_seen_clients text[] := ARRAY[]::text[];
  v_seen_task_ids text[] := ARRAY[]::text[];
  v_request_hash text; v_preview_digest text; v_preview_expires_at timestamptz;
  v_read_back jsonb := '[]'::jsonb; v_affected jsonb; v_receipt jsonb;
  v_overlap_warnings jsonb := '[]'::jsonb;
  v_context jsonb; v_scope_kind text; v_scope_id text;
  v_change_floor bigint; v_prior_operation_id text := pg_catalog.current_setting(
    'flowstate.canonical.operation_id', true
  );
  v_block_start timestamptz; v_block_end timestamptz;
  v_left jsonb; v_right jsonb; v_left_start timestamptz; v_right_start timestamptz;
  v_ordinal integer;
  v_date_valid boolean;
BEGIN
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
      pg_catalog.jsonb_build_object('code','not_authenticated','message','Authentication is required'));
  END IF;
  IF p_contract_version IS DISTINCT FROM 'task-v1'
     OR p_source NOT IN ('local-api','web-pwa')
     OR nullif(pg_catalog.btrim(p_operation_id),'') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id)>160
     OR pg_catalog.jsonb_typeof(p_operations)<>'array'
     OR pg_catalog.jsonb_array_length(p_operations) NOT BETWEEN 1 AND 50
     OR nullif(pg_catalog.btrim(p_time_zone),'') IS NULL
     OR p_time_zone IS DISTINCT FROM pg_catalog.btrim(p_time_zone)
     OR pg_catalog.char_length(p_time_zone)>100
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_time_zone)
     OR p_preview IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
      pg_catalog.jsonb_build_object('code','invalid_request','message','The canonical work-block request is invalid'));
  END IF;

  -- Normalize shape before state inspection so request identity and durable
  -- replay do not depend on the current task revision.
  FOR v_operation IN
    SELECT item.value FROM pg_catalog.jsonb_array_elements(p_operations) WITH ORDINALITY item(value,ord)
    ORDER BY item.ord
  LOOP
    IF pg_catalog.jsonb_typeof(v_operation)<>'object' THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','invalid_operations','message','Each work-block operation must be an object'));
    END IF;
    v_kind := v_operation->>'kind'; v_task_id := v_operation->>'taskId';
    BEGIN v_base_revision := (v_operation->>'baseRevision')::bigint;
    EXCEPTION WHEN OTHERS THEN v_base_revision := NULL; END;
    SELECT pg_catalog.array_agg(key ORDER BY key) INTO v_unknown_keys
    FROM pg_catalog.jsonb_object_keys(v_operation) AS object_key(key)
    WHERE key NOT IN ('taskId','baseRevision','kind','clientId','workBlockId',
                      'baseWorkBlockHash','scheduledDate','scheduledTime','duration');
    IF v_unknown_keys IS NOT NULL OR v_kind NOT IN ('create','move','resize','remove')
       OR nullif(pg_catalog.btrim(v_task_id),'') IS NULL
       OR v_task_id IS DISTINCT FROM pg_catalog.btrim(v_task_id)
       OR pg_catalog.char_length(v_task_id)>256 OR v_base_revision IS NULL OR v_base_revision<1 THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','invalid_operations','message','Work-block operation identity is invalid'));
    END IF;
    IF v_task_id=ANY(v_seen_task_ids) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','invalid_operations','message','Each task can appear only once in a work-block batch'));
    END IF;
    v_seen_task_ids:=pg_catalog.array_append(v_seen_task_ids,v_task_id);
    IF v_kind='create' THEN
      v_client_id := v_operation->>'clientId';
      IF v_operation ? 'workBlockId' OR v_operation ? 'baseWorkBlockHash'
         OR nullif(pg_catalog.btrim(v_client_id),'') IS NULL
         OR v_client_id IS DISTINCT FROM pg_catalog.btrim(v_client_id)
         OR pg_catalog.char_length(v_client_id)>160
         OR (v_task_id || ':' || v_client_id)=ANY(v_seen_clients)
         OR v_operation - ARRAY['taskId','baseRevision','kind','clientId','scheduledDate','scheduledTime','duration'] <> '{}'::jsonb THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
          pg_catalog.jsonb_build_object('code','invalid_operations','message','Create requires one unique clientId and exact schedule fields'));
      END IF;
      v_seen_clients := pg_catalog.array_append(v_seen_clients,v_task_id || ':' || v_client_id);
      v_block_id := public.flowstate_h6_work_block_id(v_actor,v_task_id,p_operation_id,v_client_id);
    ELSE
      v_block_id := v_operation->>'workBlockId';
      IF nullif(pg_catalog.btrim(v_block_id),'') IS NULL
         OR v_block_id IS DISTINCT FROM pg_catalog.btrim(v_block_id)
         OR pg_catalog.char_length(v_block_id)>256
         OR (v_operation->>'baseWorkBlockHash') !~ '^[0-9a-f]{64}$'
         OR v_operation ? 'clientId'
         OR (v_kind='move' AND v_operation - ARRAY['taskId','baseRevision','kind','workBlockId','baseWorkBlockHash','scheduledDate','scheduledTime','duration'] <> '{}'::jsonb)
         OR (v_kind='resize' AND v_operation - ARRAY['taskId','baseRevision','kind','workBlockId','baseWorkBlockHash','duration'] <> '{}'::jsonb)
         OR (v_kind='remove' AND v_operation - ARRAY['taskId','baseRevision','kind','workBlockId','baseWorkBlockHash'] <> '{}'::jsonb) THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
          pg_catalog.jsonb_build_object('code','invalid_operations','message','Move, resize, and remove require exact block identity and hash'));
      END IF;
    END IF;
    v_date_valid := true;
    IF v_kind IN ('create','move') THEN
      BEGIN
        v_date_valid := pg_catalog.to_char(
          pg_catalog.to_date(v_operation->>'scheduledDate','YYYY-MM-DD'),'YYYY-MM-DD'
        ) = v_operation->>'scheduledDate';
      EXCEPTION WHEN OTHERS THEN
        v_date_valid := false;
      END;
    END IF;
    IF v_kind IN ('create','move') AND (
         (v_operation->>'scheduledDate') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         OR NOT v_date_valid
         OR (v_operation->>'scheduledTime') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       ) OR (v_kind IN ('create','resize') OR (v_kind='move' AND v_operation ? 'duration')) AND (
         pg_catalog.jsonb_typeof(v_operation->'duration')<>'number'
         OR (v_operation->>'duration') !~ '^[1-9][0-9]*$'
         OR (v_operation->>'duration')::numeric>1440
       ) THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','invalid_operations','message','Work-block date, time, or duration is invalid'));
    END IF;
    v_normalized := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'taskId',v_task_id,'baseRevision',v_base_revision,'kind',v_kind,
      'clientId',CASE WHEN v_kind='create' THEN v_client_id END,
      'workBlockId',v_block_id,
      'baseWorkBlockHash',CASE WHEN v_kind<>'create' THEN v_operation->>'baseWorkBlockHash' END,
      'scheduledDate',CASE WHEN v_kind IN ('create','move') THEN v_operation->>'scheduledDate' END,
      'scheduledTime',CASE WHEN v_kind IN ('create','move') THEN v_operation->>'scheduledTime' END,
      'duration',CASE WHEN v_kind IN ('create','resize') OR (v_kind='move' AND v_operation ? 'duration')
        THEN v_operation->'duration' END
    ));
    v_normalized_operations := v_normalized_operations || pg_catalog.jsonb_build_array(v_normalized);
  END LOOP;

  v_request_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
      'actorUserId',v_actor,'contractVersion',p_contract_version,'source',p_source,
      'action','work_block_batch','operations',v_normalized_operations,
      'timeZone',p_time_zone,'finishBy',p_finish_by,'workspaceId',p_workspace_id
    )), 'UTF8'), 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_operation_id,0));
  SELECT * INTO v_existing FROM public.canonical_operations AS operation
  WHERE operation.user_id=v_actor AND operation.operation_id=p_operation_id;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId was already used for another request'));
    END IF;
    IF v_existing.state='committed' AND v_existing.canonical_result IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',true,'result','committed','operationId',p_operation_id,
        'action','work_block_batch','requestHash',v_request_hash,'receipt',
        v_existing.canonical_result || pg_catalog.jsonb_build_object('status','replayed','replayed',true));
    END IF;
  END IF;
  IF NOT p_preview THEN
    IF nullif(pg_catalog.btrim(p_request_hash),'') IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','request_hash_required','message','The server-issued requestHash is required for apply'));
    END IF;
    SELECT * INTO v_issued FROM public.canonical_operation_previews AS issued
    WHERE issued.user_id=v_actor AND issued.operation_id=p_operation_id FOR UPDATE;
    IF NOT FOUND OR v_issued.request_hash IS DISTINCT FROM v_request_hash
       OR p_request_hash IS DISTINCT FROM v_request_hash
       OR v_issued.preview_digest IS DISTINCT FROM p_preview_digest
       OR v_issued.expires_at IS DISTINCT FROM p_preview_expires_at
       OR v_issued.consumed_at IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','preview_mismatch','message','The approval does not match this request'));
    END IF;
    IF v_issued.expires_at<=pg_catalog.clock_timestamp() THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
        pg_catalog.jsonb_build_object('code','preview_expired','message','The approved preview has expired'));
    END IF;
    -- Stable lock order prevents two multi-parent commands from deadlocking.
    PERFORM 1 FROM public.tasks AS task
    WHERE task.id::text IN (SELECT DISTINCT item.value->>'taskId' FROM pg_catalog.jsonb_array_elements(v_normalized_operations) item(value))
    ORDER BY task.id::text FOR UPDATE;
  END IF;

  -- Simulate the exact ordered element operations against one snapshot per task.
  FOR v_operation IN
    SELECT item.value FROM pg_catalog.jsonb_array_elements(v_normalized_operations) WITH ORDINALITY item(value,ord)
    ORDER BY item.ord
  LOOP
    v_task_id:=v_operation->>'taskId'; v_kind:=v_operation->>'kind'; v_block_id:=v_operation->>'workBlockId';
    v_base_revision:=(v_operation->>'baseRevision')::bigint;
    IF NOT (v_projected ? v_task_id) THEN
      SELECT * INTO v_task FROM public.tasks AS task WHERE task.id::text=v_task_id;
      IF NOT FOUND OR v_task.is_deleted THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
          pg_catalog.jsonb_build_object('code','not_found','message','Task was not found'));
      END IF;
      IF v_task.workspace_id IS DISTINCT FROM p_workspace_id
         OR (v_task.workspace_id IS NULL AND v_task.user_id IS DISTINCT FROM v_actor)
         OR (v_task.workspace_id IS NOT NULL AND NOT public.flowstate_can_write_workspace_v1(v_task.workspace_id)) THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
          pg_catalog.jsonb_build_object('code','scope_denied','message','Task is outside the writable active scope'));
      END IF;
      IF COALESCE(v_task.recurring_instances,'[]'::jsonb)<>'[]'::jsonb
         OR v_task.recurrence IS NOT NULL OR v_task.recurrence_rule IS NOT NULL
         OR v_task.recurrence_parent_id IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
          pg_catalog.jsonb_build_object('code','recurring_work_block_unsupported','message','Recurring work blocks require the occurrence command'));
      END IF;
      IF v_task.canonical_revision IS DISTINCT FROM v_base_revision THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','stale_revision','message','Task changed after the base revision','currentRevision',v_task.canonical_revision));
      END IF;
      v_projected:=pg_catalog.jsonb_set(v_projected,ARRAY[v_task_id],COALESCE(v_task.instances,'[]'::jsonb),true);
      v_base_revisions:=pg_catalog.jsonb_set(v_base_revisions,ARRAY[v_task_id],pg_catalog.to_jsonb(v_base_revision),true);
      v_task_ids:=pg_catalog.array_append(v_task_ids,v_task_id);
    ELSIF (v_base_revisions->>v_task_id)::bigint IS DISTINCT FROM v_base_revision THEN
      RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
        pg_catalog.jsonb_build_object('code','invalid_operations','message','One task cannot have multiple base revisions'));
    END IF;
    v_instances:=v_projected->v_task_id; v_index:=NULL; v_current:=NULL;
    SELECT (item.ordinality-1)::integer,item.value INTO v_index,v_current
    FROM pg_catalog.jsonb_array_elements(v_instances) WITH ORDINALITY item(value,ordinality)
    WHERE item.value->>'id'=v_block_id LIMIT 1;
    IF v_kind='create' THEN
      IF pg_catalog.jsonb_array_length(v_instances)>0 THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','work_block_already_exists','message','Non-recurring tasks can have only one work block'));
      ELSIF v_index IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','work_block_id_conflict','message','Generated work-block identity is unavailable'));
      END IF;
      v_next:=pg_catalog.jsonb_build_object(
        'id',v_block_id,
        'clientId',v_operation->>'clientId',
        'taskId',v_task_id,
        'scheduledDate',v_operation->>'scheduledDate',
        'scheduledTime',v_operation->>'scheduledTime',
        'duration',(v_operation->>'duration')::integer,
        'status','scheduled',
        'timeZone',p_time_zone
      );
      v_instances:=v_instances || pg_catalog.jsonb_build_array(v_next);
    ELSE
      IF v_index IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','work_block_not_found','message','Work block was not found'));
      END IF;
      IF public.flowstate_h6_work_block_hash(v_current) IS DISTINCT FROM v_operation->>'baseWorkBlockHash' THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','stale_work_block','message','Work block changed after the supplied content hash',
            'currentWorkBlockHash',public.flowstate_h6_work_block_hash(v_current)));
      END IF;
      IF v_kind='remove' THEN v_instances:=v_instances-v_index;
      ELSE
        v_next:=v_current;
        IF v_kind='move' THEN
          v_next:=pg_catalog.jsonb_set(v_next,'{scheduledDate}',v_operation->'scheduledDate',true);
          v_next:=pg_catalog.jsonb_set(v_next,'{scheduledTime}',v_operation->'scheduledTime',true);
          IF v_operation ? 'duration' THEN
            v_next:=pg_catalog.jsonb_set(v_next,'{duration}',v_operation->'duration',true);
          END IF;
        ELSE
          v_next:=pg_catalog.jsonb_set(v_next,'{duration}',v_operation->'duration',true);
        END IF;
        v_instances:=pg_catalog.jsonb_set(v_instances,ARRAY[v_index::text],v_next,false);
      END IF;
    END IF;
    IF v_kind<>'remove' THEN
      v_block_start:=((v_next->>'scheduledDate') || ' ' || (v_next->>'scheduledTime'))::timestamp AT TIME ZONE p_time_zone;
      v_block_end:=v_block_start + ((v_next->>'duration')::integer * interval '1 minute');
      IF p_finish_by IS NOT NULL AND v_block_end>p_finish_by THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','finish_by_exceeded','message','A proposed work block ends after finishBy',
            'taskId',v_task_id,'workBlockId',v_block_id,'blockEndsAt',v_block_end,'finishBy',p_finish_by));
      END IF;
    END IF;
    v_projected:=pg_catalog.jsonb_set(v_projected,ARRAY[v_task_id],v_instances,true);
  END LOOP;

  -- Same-task overlaps are warnings, never hidden rejections.
  FOREACH v_task_id IN ARRAY v_task_ids LOOP
    v_instances:=v_projected->v_task_id;
    FOR v_left,v_right IN
      SELECT left_item.value,right_item.value
      FROM pg_catalog.jsonb_array_elements(v_instances) WITH ORDINALITY left_item(value,ord)
      JOIN pg_catalog.jsonb_array_elements(v_instances) WITH ORDINALITY right_item(value,ord)
        ON left_item.ord<right_item.ord
    LOOP
      IF (v_left->>'scheduledDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         AND (v_left->>'scheduledTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         AND (v_left->>'duration') ~ '^[1-9][0-9]*$'
         AND (v_right->>'scheduledDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
         AND (v_right->>'scheduledTime') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         AND (v_right->>'duration') ~ '^[1-9][0-9]*$' THEN
        v_left_start:=((v_left->>'scheduledDate')||' '||(v_left->>'scheduledTime'))::timestamp AT TIME ZONE p_time_zone;
        v_right_start:=((v_right->>'scheduledDate')||' '||(v_right->>'scheduledTime'))::timestamp AT TIME ZONE p_time_zone;
        IF v_left_start < v_right_start + ((v_right->>'duration')::integer*interval '1 minute')
           AND v_right_start < v_left_start + ((v_left->>'duration')::integer*interval '1 minute') THEN
          v_overlap_warnings:=v_overlap_warnings || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
            'taskId',v_task_id,'workBlockId',v_left->>'id','overlapsWorkBlockId',v_right->>'id'));
        END IF;
      END IF;
    END LOOP;
    v_read_back:=v_read_back || pg_catalog.jsonb_build_array(public.flowstate_h6_task_read_back(
      v_task_id,v_projected->v_task_id,pg_catalog.jsonb_array_length(v_projected->v_task_id)=0,
      (v_base_revisions->>v_task_id)::bigint));
  END LOOP;

  IF p_preview THEN
    SELECT * INTO v_issued FROM public.canonical_operation_previews AS issued
    WHERE issued.user_id=v_actor AND issued.operation_id=p_operation_id FOR UPDATE;
    IF FOUND THEN
      IF v_issued.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId already has another preview'));
      END IF;
      IF v_issued.consumed_at IS NOT NULL OR v_issued.expires_at<=pg_catalog.clock_timestamp() THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','preview_expired','message','Use a new operationId for a fresh preview'));
      END IF;
      v_preview_digest:=v_issued.preview_digest; v_preview_expires_at:=v_issued.expires_at;
    ELSE
      v_preview_digest:=pg_catalog.encode(extensions.gen_random_bytes(32),'hex');
      v_preview_expires_at:=pg_catalog.clock_timestamp()+interval '15 minutes';
      INSERT INTO public.canonical_operation_previews(user_id,operation_id,preview_digest,request_hash,expires_at)
      VALUES(v_actor,p_operation_id,v_preview_digest,v_request_hash,v_preview_expires_at);
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok',true,'result','preview','preview',true,'contractVersion',p_contract_version,
      'operationId',p_operation_id,'action','work_block_batch','requestHash',v_request_hash,
      'previewDigest',v_preview_digest,'previewExpiresAt',v_preview_expires_at,
      'workspaceId',p_workspace_id,'timeZone',p_time_zone,'finishBy',p_finish_by,
      'overlapWarnings',v_overlap_warnings,
      'requestedPayload',p_operations,
      'normalizedPayload',pg_catalog.jsonb_build_object('operations',v_normalized_operations,
        'timeZone',p_time_zone,'finishBy',p_finish_by),
      'readBack',v_read_back);
  END IF;

  v_scope_kind:=CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
  v_scope_id:=COALESCE(p_workspace_id::text,v_actor::text);
  v_context:=pg_catalog.jsonb_build_object('action','work_block_batch','operations',v_normalized_operations,
    'timeZone',p_time_zone,'finishBy',p_finish_by,'workspaceId',p_workspace_id,
    'overlapWarnings',v_overlap_warnings);
  BEGIN
    INSERT INTO public.canonical_operations(
      user_id,operation_id,contract_version,source,scope_kind,scope_id,workspace_id,
      entity_type,action,entity_id,request_hash,state,operation_context
    ) VALUES(v_actor,p_operation_id,p_contract_version,p_source,v_scope_kind,v_scope_id,p_workspace_id,
      'batch','work_block_batch',p_operation_id,v_request_hash,'applying',v_context)
    ON CONFLICT(user_id,operation_id) DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO STRICT v_existing FROM public.canonical_operations AS operation
      WHERE operation.user_id=v_actor AND operation.operation_id=p_operation_id FOR UPDATE;
      IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
          pg_catalog.jsonb_build_object('code','idempotency_conflict','message','operationId was already used'));
      END IF;
    END IF;
    UPDATE public.canonical_operation_previews AS issued SET consumed_at=pg_catalog.clock_timestamp(),
      updated_at=pg_catalog.clock_timestamp()
    WHERE issued.user_id=v_actor AND issued.operation_id=p_operation_id
      AND issued.preview_digest=p_preview_digest AND issued.consumed_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='preview consumption race'; END IF;
    SELECT COALESCE(pg_catalog.max(change_sequence),0) INTO v_change_floor FROM public.canonical_change_log;
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',p_operation_id,true);
    FOREACH v_task_id IN ARRAY v_task_ids LOOP
      UPDATE public.tasks AS task SET instances=v_projected->v_task_id,
        is_in_inbox=(pg_catalog.jsonb_array_length(v_projected->v_task_id)=0 AND task.position IS NULL),
        updated_at=pg_catalog.clock_timestamp()
      WHERE task.id::text=v_task_id AND task.canonical_revision=(v_base_revisions->>v_task_id)::bigint
      RETURNING * INTO v_updated;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='task revision changed during apply'; END IF;
    END LOOP;
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
    PERFORM public.flowstate_h3_link_task_changes(v_task_ids,p_operation_id,v_change_floor);
    UPDATE public.canonical_change_log SET source=p_source
    WHERE operation_id=p_operation_id AND change_sequence>v_change_floor;
    v_affected:=public.flowstate_h6_task_affected(v_task_ids);
    v_read_back:='[]'::jsonb;
    FOR v_ordinal IN 0..pg_catalog.array_length(v_task_ids,1)-1 LOOP
      v_read_back:=v_read_back || pg_catalog.jsonb_build_array(v_affected #> ARRAY[v_ordinal::text,'readBack']);
    END LOOP;
    v_receipt:=pg_catalog.jsonb_build_object(
      'ok',true,'status','committed','operationId',p_operation_id,'requestHash',v_request_hash,
      'contractVersion',p_contract_version,'source',p_source,'entityType','batch',
      'action','work_block_batch','entityId',p_operation_id,
      'canonicalRevision',(v_affected #>> '{0,canonicalRevision}')::bigint,
      'changeSequence',(v_affected #>> '{0,changeSequence}')::bigint,
      'committedAt',pg_catalog.clock_timestamp(),'replayed',false,
      'readBack',v_read_back,'readBackHash',public.flowstate_h6_work_block_hash(v_read_back),
      'affected',v_affected,'operationContext',v_context);
    UPDATE public.canonical_operations SET state='committed',
      canonical_revision=(v_affected #>> '{0,canonicalRevision}')::bigint,
      change_sequence=(v_affected #>> '{0,changeSequence}')::bigint,
      canonical_result=v_receipt,affected_entities=v_affected,
      committed_at=(v_receipt->>'committedAt')::timestamptz,updated_at=pg_catalog.clock_timestamp()
    WHERE user_id=v_actor AND operation_id=p_operation_id;
  EXCEPTION WHEN serialization_failure THEN
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','conflict','error',
      pg_catalog.jsonb_build_object('code','stale_revision','message','Task changed during apply'));
  WHEN OTHERS THEN
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id',COALESCE(v_prior_operation_id,''),true);
    RETURN pg_catalog.jsonb_build_object('ok',false,'result','rejected','error',
      pg_catalog.jsonb_build_object('code','internal_error','message','Canonical work-block batch rolled back'));
  END;
  RETURN pg_catalog.jsonb_build_object('ok',true,'result','committed','operationId',p_operation_id,
    'action','work_block_batch','requestHash',v_request_hash,'receipt',v_receipt);
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_h6_work_block_id(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h6_work_block_hash(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flowstate_h6_work_block_hash(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h6_task_read_back(text,jsonb,boolean,bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h6_task_affected(text[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.flowstate_work_block_batch_v1(
  text,text,text,jsonb,text,timestamptz,boolean,text,timestamptz,uuid,text
) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.flowstate_work_block_batch_v1(
  text,text,text,jsonb,text,timestamptz,boolean,text,timestamptz,uuid,text
) TO authenticated;

COMMENT ON FUNCTION public.flowstate_work_block_batch_v1(
  text,text,text,jsonb,text,timestamptz,boolean,text,timestamptz,uuid,text
) IS 'Preview/apply 1-50 ordered create/move/resize/remove work-block operations atomically across signed-user task parents with stable identities, exact element hashes, local-time context, durable replay, and canonical batch evidence.';
