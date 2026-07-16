-- Canonical ordered subtask batch mutation for signed users.
-- One parent task revision protects the complete embedded subtask array.

-- This helper intentionally matches the Local API receipt verifier's narrower
-- JSON domain without changing the older canonical JSON helper used elsewhere.
CREATE OR REPLACE FUNCTION public.flowstate_receipt_canonical_json_v1(p_value jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
DECLARE
  v_type text := pg_catalog.jsonb_typeof(p_value);
  v_result text;
BEGIN
  IF v_type IN ('null', 'boolean', 'string') THEN
    RETURN p_value::text;
  ELSIF v_type = 'number' THEN
    IF p_value::text !~ '^-?(0|[1-9][0-9]*)$'
       OR pg_catalog.abs((p_value #>> '{}')::numeric) > 9007199254740991 THEN
      RAISE EXCEPTION 'Canonical JSON supports only safe integers';
    END IF;
    RETURN p_value::text;
  ELSIF v_type = 'array' THEN
    SELECT '[' || coalesce(
      pg_catalog.string_agg(public.flowstate_receipt_canonical_json_v1(item.value), ',' ORDER BY item.ordinality),
      ''
    ) || ']'
      INTO v_result
    FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY AS item(value, ordinality);
    RETURN v_result;
  ELSIF v_type = 'object' THEN
    IF EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_object_keys(p_value) AS object_key(key)
      WHERE object_key.key !~ '^[ -~]*$'
    ) THEN
      RAISE EXCEPTION 'Canonical JSON object keys must be printable ASCII';
    END IF;
    SELECT '{' || coalesce(
      pg_catalog.string_agg(
        pg_catalog.to_jsonb(entry.key)::text || ':' || public.flowstate_receipt_canonical_json_v1(entry.value),
        ',' ORDER BY entry.key COLLATE "C"
      ),
      ''
    ) || '}'
      INTO v_result
    FROM pg_catalog.jsonb_each(p_value) AS entry(key, value);
    RETURN v_result;
  END IF;
  RAISE EXCEPTION 'Unsupported canonical JSON value';
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_receipt_canonical_json_v1(jsonb)
  FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.flowstate_subtask_batch_v1(
  text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid
);

CREATE OR REPLACE FUNCTION public.flowstate_subtask_batch_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_task_id text,
  p_base_revision bigint,
  p_operations jsonb,
  p_preview boolean DEFAULT true,
  p_preview_digest text DEFAULT NULL,
  p_preview_expires_at timestamptz DEFAULT NULL,
  p_workspace_id uuid DEFAULT NULL,
  p_approved_subtask_ids jsonb DEFAULT NULL
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
  v_operation jsonb;
  v_normalized_operation jsonb;
  v_normalized_operations jsonb := '[]'::jsonb;
  v_normalized jsonb;
  v_subtasks jsonb;
  v_original_subtasks jsonb;
  v_baseline_subtasks jsonb;
  v_subtask jsonb;
  v_patch jsonb;
  v_subtask_id text;
  v_title text;
  v_action text;
  v_order integer;
  v_index integer;
  v_count integer;
  v_now timestamptz;
  v_request_hash text;
  v_expected_preview_digest text;
  v_preview_expiry timestamptz;
  v_scope_kind text;
  v_scope_id text;
  v_change_sequence bigint;
  v_read_back jsonb;
  v_read_back_hash text;
  v_receipt jsonb;
  v_prior_operation_id text := pg_catalog.current_setting('flowstate.canonical.operation_id', true);
BEGIN
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object('code', 'not_authenticated', 'message', 'Authentication is required'));
  END IF;

  IF p_contract_version IS DISTINCT FROM 'subtask-batch-v1'
     OR nullif(pg_catalog.btrim(p_operation_id), '') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id) > 160
     OR p_source IS DISTINCT FROM 'local-api'
     OR nullif(pg_catalog.btrim(p_task_id), '') IS NULL
     OR p_base_revision IS NULL OR p_base_revision < 1
     OR p_operations IS NULL OR pg_catalog.jsonb_typeof(p_operations) <> 'array'
     OR pg_catalog.jsonb_array_length(p_operations) NOT BETWEEN 1 AND 50
     OR p_preview IS NULL
     OR (p_preview AND p_approved_subtask_ids IS NOT NULL)
     OR (NOT p_preview AND (
       pg_catalog.jsonb_typeof(p_approved_subtask_ids) IS DISTINCT FROM 'array'
       OR EXISTS (
         SELECT 1 FROM pg_catalog.jsonb_array_elements(p_approved_subtask_ids) AS approved(value)
         WHERE pg_catalog.jsonb_typeof(approved.value) <> 'string'
           OR nullif(pg_catalog.btrim(approved.value #>> '{}'), '') IS NULL
       )
       OR (
         SELECT pg_catalog.count(*) IS DISTINCT FROM pg_catalog.count(DISTINCT approved.value #>> '{}')
         FROM pg_catalog.jsonb_array_elements(p_approved_subtask_ids) AS approved(value)
       )
     )) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object('code', 'invalid_request', 'message', 'The subtask batch request is invalid'));
  END IF;

  -- Normalize and strictly validate every ordered operation before durable state.
  FOR v_operation IN SELECT value FROM pg_catalog.jsonb_array_elements(p_operations)
  LOOP
    IF pg_catalog.jsonb_typeof(v_operation) <> 'object'
       OR pg_catalog.jsonb_typeof(v_operation->'action') <> 'string'
       OR NOT ((v_operation->>'action') IN ('create', 'update', 'delete')) THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object('code', 'invalid_operation', 'message', 'Each operation action must be create, update, or delete'));
    END IF;
    v_action := v_operation->>'action';

    IF v_action = 'create' THEN
      IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(v_operation) AS k(key)
                 WHERE k.key NOT IN ('action', 'subtask', 'order'))
         OR pg_catalog.jsonb_typeof(v_operation->'subtask') <> 'object'
         OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(v_operation->'subtask') AS k(key)
                    WHERE k.key NOT IN ('id', 'title', 'description', 'isCompleted', 'completedPomodoros', 'doneEnough', 'estimateMinutes')) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_operation', 'message', 'Create contains unsupported fields'));
      END IF;
      v_subtask := v_operation->'subtask';
      v_subtask_id := v_subtask->>'id';
      v_title := pg_catalog.btrim(v_subtask->>'title');
      IF pg_catalog.jsonb_typeof(v_subtask->'id') <> 'string'
         OR v_subtask_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         OR pg_catalog.jsonb_typeof(v_subtask->'title') <> 'string'
         OR nullif(v_title, '') IS NULL OR pg_catalog.char_length(v_title) > 500
         OR (v_subtask ? 'description' AND pg_catalog.jsonb_typeof(v_subtask->'description') <> 'string')
         OR pg_catalog.char_length(COALESCE(v_subtask->>'description', '')) > 10000
         OR (v_subtask ? 'isCompleted' AND pg_catalog.jsonb_typeof(v_subtask->'isCompleted') <> 'boolean')
         OR (v_subtask ? 'completedPomodoros' AND pg_catalog.jsonb_typeof(v_subtask->'completedPomodoros') <> 'number')
         OR NOT (v_subtask ? 'doneEnough')
         OR pg_catalog.jsonb_typeof(v_subtask->'doneEnough') <> 'string'
         OR nullif(pg_catalog.btrim(v_subtask->>'doneEnough'), '') IS NULL
         OR pg_catalog.char_length(pg_catalog.btrim(v_subtask->>'doneEnough')) > 1000
         OR (v_subtask ? 'estimateMinutes' AND pg_catalog.jsonb_typeof(v_subtask->'estimateMinutes') NOT IN ('number', 'null')) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_subtask', 'message', 'Create requires a stable UUID, title, and doneEnough description'));
      END IF;
      IF v_subtask ? 'completedPomodoros' AND (
           (v_subtask->>'completedPomodoros')::numeric <> pg_catalog.trunc((v_subtask->>'completedPomodoros')::numeric)
           OR (v_subtask->>'completedPomodoros')::numeric NOT BETWEEN 0 AND 100000
         ) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_subtask', 'message', 'completedPomodoros is invalid'));
      END IF;
      IF v_subtask ? 'estimateMinutes' AND pg_catalog.jsonb_typeof(v_subtask->'estimateMinutes') = 'number' AND (
           (v_subtask->>'estimateMinutes')::numeric <> pg_catalog.trunc((v_subtask->>'estimateMinutes')::numeric)
           OR (v_subtask->>'estimateMinutes')::numeric NOT BETWEEN 1 AND 10080
         ) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_subtask', 'message', 'estimateMinutes is invalid'));
      END IF;
      v_patch := pg_catalog.jsonb_build_object(
        'id', pg_catalog.lower(v_subtask_id), 'title', v_title,
        'description', COALESCE(v_subtask->>'description', ''),
        'isCompleted', COALESCE((v_subtask->>'isCompleted')::boolean, false),
        'completedPomodoros', COALESCE((v_subtask->>'completedPomodoros')::integer, 0),
        'doneEnough', pg_catalog.btrim(v_subtask->>'doneEnough'),
        'estimateMinutes', CASE WHEN pg_catalog.jsonb_typeof(v_subtask->'estimateMinutes') = 'number'
          THEN pg_catalog.to_jsonb((v_subtask->>'estimateMinutes')::integer) ELSE 'null'::jsonb END
      );
    ELSIF v_action = 'update' THEN
      IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(v_operation) AS k(key)
                 WHERE k.key NOT IN ('action', 'subtaskId', 'patch', 'order'))
         OR pg_catalog.jsonb_typeof(v_operation->'subtaskId') <> 'string'
         OR nullif(pg_catalog.btrim(v_operation->>'subtaskId'), '') IS NULL
         OR pg_catalog.jsonb_typeof(v_operation->'patch') <> 'object'
         OR EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(v_operation->'patch') AS k(key)
                    WHERE k.key NOT IN ('title', 'description', 'isCompleted', 'completedPomodoros', 'doneEnough', 'estimateMinutes'))
         OR ((v_operation->'patch') = '{}'::jsonb AND NOT (v_operation ? 'order')) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_operation', 'message', 'Update requires a subtaskId and supported patch or order'));
      END IF;
      v_subtask_id := pg_catalog.btrim(v_operation->>'subtaskId');
      v_patch := v_operation->'patch';
      IF v_patch ? 'title' THEN
        v_title := pg_catalog.btrim(v_patch->>'title');
        IF pg_catalog.jsonb_typeof(v_patch->'title') <> 'string' OR nullif(v_title, '') IS NULL OR pg_catalog.char_length(v_title) > 500 THEN
          RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected', 'error', pg_catalog.jsonb_build_object('code', 'invalid_subtask', 'message', 'title is invalid'));
        END IF;
        v_patch := v_patch || pg_catalog.jsonb_build_object('title', v_title);
      END IF;
    ELSE
      IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_object_keys(v_operation) AS k(key) WHERE k.key NOT IN ('action', 'subtaskId'))
         OR pg_catalog.jsonb_typeof(v_operation->'subtaskId') <> 'string'
         OR nullif(pg_catalog.btrim(v_operation->>'subtaskId'), '') IS NULL THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_operation', 'message', 'Delete requires only a subtaskId'));
      END IF;
      v_subtask_id := pg_catalog.btrim(v_operation->>'subtaskId');
      v_patch := NULL;
    END IF;

    IF v_patch IS NOT NULL THEN
      IF (v_patch ? 'description' AND pg_catalog.jsonb_typeof(v_patch->'description') <> 'string')
         OR pg_catalog.char_length(COALESCE(v_patch->>'description', '')) > 10000
         OR (v_patch ? 'isCompleted' AND pg_catalog.jsonb_typeof(v_patch->'isCompleted') <> 'boolean')
         OR (v_patch ? 'completedPomodoros' AND pg_catalog.jsonb_typeof(v_patch->'completedPomodoros') <> 'number')
         OR (v_patch ? 'doneEnough' AND (pg_catalog.jsonb_typeof(v_patch->'doneEnough') <> 'string'
             OR nullif(pg_catalog.btrim(v_patch->>'doneEnough'), '') IS NULL
             OR pg_catalog.char_length(pg_catalog.btrim(v_patch->>'doneEnough')) > 1000))
         OR (v_patch ? 'estimateMinutes' AND pg_catalog.jsonb_typeof(v_patch->'estimateMinutes') NOT IN ('number', 'null')) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_subtask', 'message', 'A subtask field is invalid'));
      END IF;
      IF v_patch ? 'completedPomodoros' AND (
           (v_patch->>'completedPomodoros')::numeric <> pg_catalog.trunc((v_patch->>'completedPomodoros')::numeric)
           OR (v_patch->>'completedPomodoros')::numeric NOT BETWEEN 0 AND 100000
         ) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_subtask', 'message', 'completedPomodoros is invalid'));
      END IF;
      IF v_patch ? 'estimateMinutes' AND pg_catalog.jsonb_typeof(v_patch->'estimateMinutes') = 'number' AND (
           (v_patch->>'estimateMinutes')::numeric <> pg_catalog.trunc((v_patch->>'estimateMinutes')::numeric)
           OR (v_patch->>'estimateMinutes')::numeric NOT BETWEEN 1 AND 10080
         ) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_subtask', 'message', 'estimateMinutes is invalid'));
      END IF;
      IF v_patch ? 'doneEnough' THEN v_patch := v_patch || pg_catalog.jsonb_build_object('doneEnough', pg_catalog.btrim(v_patch->>'doneEnough')); END IF;
    END IF;

    IF v_operation ? 'order' THEN
      IF pg_catalog.jsonb_typeof(v_operation->'order') <> 'number'
         OR (v_operation->>'order')::numeric <> pg_catalog.trunc((v_operation->>'order')::numeric)
         OR (v_operation->>'order')::numeric NOT BETWEEN 0 AND 100000 THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object('code', 'invalid_order', 'message', 'order must be a non-negative integer'));
      END IF;
      v_order := (v_operation->>'order')::integer;
    ELSE
      v_order := NULL;
    END IF;

    v_normalized_operation := pg_catalog.jsonb_build_object('action', v_action);
    IF v_action = 'create' THEN
      v_normalized_operation := v_normalized_operation || pg_catalog.jsonb_build_object('subtask', v_patch);
    ELSE
      v_normalized_operation := v_normalized_operation || pg_catalog.jsonb_build_object('subtaskId', v_subtask_id);
      IF v_action = 'update' THEN v_normalized_operation := v_normalized_operation || pg_catalog.jsonb_build_object('patch', v_patch); END IF;
    END IF;
    IF v_order IS NOT NULL THEN v_normalized_operation := v_normalized_operation || pg_catalog.jsonb_build_object('order', v_order); END IF;
    v_normalized_operations := v_normalized_operations || pg_catalog.jsonb_build_array(v_normalized_operation);
  END LOOP;

  v_normalized := pg_catalog.jsonb_build_object(
    'contractVersion', p_contract_version, 'source', p_source,
    'action', 'subtask_batch', 'taskId', p_task_id,
    'baseRevision', p_base_revision, 'workspaceId', p_workspace_id,
    'operations', v_normalized_operations
  );
  v_request_hash := pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(public.flowstate_receipt_canonical_json_v1(v_normalized), 'UTF8'), 'sha256'), 'hex');

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_operation_id, 0));

  IF NOT p_preview THEN
    SELECT * INTO v_existing FROM public.canonical_operations AS operation
    WHERE operation.user_id = v_actor AND operation.operation_id = p_operation_id FOR UPDATE;
    IF FOUND THEN
      IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId belongs to another request'));
      ELSIF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
        IF p_approved_subtask_ids IS DISTINCT FROM (
          SELECT COALESCE(
            pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item.value->>'id') ORDER BY item.ordinality),
            '[]'::jsonb
          )
          FROM pg_catalog.jsonb_array_elements(v_existing.canonical_result #> '{readBack,subtasks}')
            WITH ORDINALITY AS item(value, ordinality)
        ) THEN
          RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict',
            'error', pg_catalog.jsonb_build_object('code', 'approval_mismatch', 'message', 'The approved subtask order does not match the committed result'));
        END IF;
        RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'committed', 'result', 'committed', 'requestHash', v_request_hash,
          'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object('replayed', true));
      END IF;
    END IF;
  END IF;

  IF p_preview THEN
    SELECT * INTO v_task FROM public.tasks AS task WHERE task.id::text = p_task_id AND task.is_deleted = false;
  ELSE
    SELECT * INTO v_task FROM public.tasks AS task WHERE task.id::text = p_task_id AND task.is_deleted = false FOR UPDATE;
  END IF;
  IF NOT FOUND OR v_task.workspace_id IS DISTINCT FROM p_workspace_id
     OR (v_task.workspace_id IS NULL AND v_task.user_id IS DISTINCT FROM v_actor)
     OR (v_task.workspace_id IS NOT NULL AND NOT public.flowstate_can_write_workspace_v1(v_task.workspace_id)) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected', 'error', pg_catalog.jsonb_build_object('code', 'not_found', 'message', 'Task was not found'));
  END IF;
  IF v_task.canonical_revision IS DISTINCT FROM p_base_revision THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'stale_revision', 'message', 'Task changed after the requested base revision', 'currentRevision', v_task.canonical_revision));
  END IF;

  -- Apply operations to a local ordered array for both preview and commit.
  v_original_subtasks := CASE WHEN pg_catalog.jsonb_typeof(v_task.subtasks) = 'array' THEN v_task.subtasks ELSE '[]'::jsonb END;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_original_subtasks) AS item(value)
    WHERE pg_catalog.jsonb_typeof(item.value) <> 'object'
      OR pg_catalog.jsonb_typeof(item.value->'id') <> 'string'
      OR nullif(pg_catalog.btrim(item.value->>'id'), '') IS NULL
      OR pg_catalog.jsonb_typeof(item.value->'title') <> 'string'
      OR CASE
        WHEN pg_catalog.jsonb_typeof(item.value->'title') = 'string'
          THEN nullif(pg_catalog.btrim(item.value->>'title'), '') IS NULL
            OR pg_catalog.char_length(pg_catalog.btrim(item.value->>'title')) > 500
        ELSE true
      END
      OR (item.value ? 'description' AND pg_catalog.jsonb_typeof(item.value->'description') <> 'string')
      OR (item.value ? 'isCompleted' AND pg_catalog.jsonb_typeof(item.value->'isCompleted') <> 'boolean')
      OR (item.value ? 'completedPomodoros' AND (
        pg_catalog.jsonb_typeof(item.value->'completedPomodoros') <> 'number'
        OR CASE
          WHEN pg_catalog.jsonb_typeof(item.value->'completedPomodoros') = 'number'
            THEN (item.value->>'completedPomodoros')::numeric
              <> pg_catalog.trunc((item.value->>'completedPomodoros')::numeric)
              OR (item.value->>'completedPomodoros')::numeric NOT BETWEEN 0 AND 100000
          ELSE true
        END
      ))
      OR (item.value ? 'doneEnough' AND (
        pg_catalog.jsonb_typeof(item.value->'doneEnough') NOT IN ('string', 'null')
        OR CASE
          WHEN pg_catalog.jsonb_typeof(item.value->'doneEnough') = 'string'
            THEN nullif(pg_catalog.btrim(item.value->>'doneEnough'), '') IS NULL
              OR pg_catalog.char_length(pg_catalog.btrim(item.value->>'doneEnough')) > 1000
          ELSE false
        END
      ))
      OR (item.value ? 'estimateMinutes' AND (
        pg_catalog.jsonb_typeof(item.value->'estimateMinutes') NOT IN ('number', 'null')
        OR CASE
          WHEN pg_catalog.jsonb_typeof(item.value->'estimateMinutes') = 'number'
            THEN (item.value->>'estimateMinutes')::numeric
              <> pg_catalog.trunc((item.value->>'estimateMinutes')::numeric)
              OR (item.value->>'estimateMinutes')::numeric NOT BETWEEN 1 AND 10080
          ELSE false
        END
      ))
  ) OR (
    SELECT pg_catalog.count(*) IS DISTINCT FROM pg_catalog.count(DISTINCT item.value->>'id')
    FROM pg_catalog.jsonb_array_elements(v_original_subtasks) AS item(value)
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_existing_subtasks',
        'message', 'Existing subtask data must be repaired before applying a canonical batch'
      )
    );
  END IF;
  -- The receipt verifier accepts only the shared safe-integer / printable-ASCII
  -- canonical JSON domain. Reject legacy extension values outside that domain
  -- before issuing an approval preview or attempting a durable write.
  BEGIN
    PERFORM public.flowstate_receipt_canonical_json_v1(v_original_subtasks);
  EXCEPTION WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'unsupported_legacy_subtask_shape',
        'message', 'Existing subtask extensions cannot be verified canonically and must be repaired first'
      )
    );
  END;
  SELECT COALESCE(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'description', '', 'isCompleted', false, 'completedPomodoros', 0,
      'doneEnough', NULL, 'estimateMinutes', NULL
    ) || item.value ORDER BY item.ordinality
  ), '[]'::jsonb) INTO v_subtasks
  FROM pg_catalog.jsonb_array_elements(v_original_subtasks) WITH ORDINALITY AS item(value, ordinality);
  v_baseline_subtasks := v_subtasks;
  v_now := pg_catalog.clock_timestamp();
  FOR v_operation IN SELECT value FROM pg_catalog.jsonb_array_elements(v_normalized_operations)
  LOOP
    v_action := v_operation->>'action';
    IF v_action = 'create' THEN
      v_subtask_id := v_operation #>> '{subtask,id}';
      IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_array_elements(v_subtasks) AS item(value) WHERE item.value->>'id' = v_subtask_id) THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'subtask_id_conflict', 'message', 'A subtask already uses this stable id'));
      END IF;
      v_subtask := (v_operation->'subtask') || pg_catalog.jsonb_build_object(
        'parentTaskId', p_task_id, 'createdAt', v_now, 'updatedAt', v_now);
      v_count := pg_catalog.jsonb_array_length(v_subtasks);
      v_order := COALESCE((v_operation->>'order')::integer, v_count);
      v_order := least(v_order, v_count);
      SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY sort_key), '[]'::jsonb) INTO v_subtasks
      FROM (
        SELECT item.value, item.ordinality::numeric AS sort_key FROM pg_catalog.jsonb_array_elements(v_subtasks) WITH ORDINALITY AS item(value, ordinality)
        UNION ALL SELECT v_subtask, v_order::numeric + 0.5
      ) ordered;
    ELSE
      v_subtask_id := v_operation->>'subtaskId';
      SELECT (item.ordinality - 1)::integer, item.value INTO v_index, v_subtask
      FROM pg_catalog.jsonb_array_elements(v_subtasks) WITH ORDINALITY AS item(value, ordinality)
      WHERE item.value->>'id' = v_subtask_id LIMIT 1;
      IF NOT FOUND THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'subtask_not_found', 'message', 'A referenced subtask was not found', 'subtaskId', v_subtask_id));
      END IF;
      SELECT COALESCE(pg_catalog.jsonb_agg(item.value ORDER BY item.ordinality), '[]'::jsonb) INTO v_subtasks
      FROM pg_catalog.jsonb_array_elements(v_subtasks) WITH ORDINALITY AS item(value, ordinality)
      WHERE item.value->>'id' IS DISTINCT FROM v_subtask_id;
      IF v_action = 'update' THEN
        v_subtask := v_subtask || (v_operation->'patch') || pg_catalog.jsonb_build_object('updatedAt', v_now);
        v_count := pg_catalog.jsonb_array_length(v_subtasks);
        v_order := least(COALESCE((v_operation->>'order')::integer, v_index), v_count);
        SELECT COALESCE(pg_catalog.jsonb_agg(value ORDER BY sort_key), '[]'::jsonb) INTO v_subtasks
        FROM (
          SELECT item.value, item.ordinality::numeric AS sort_key FROM pg_catalog.jsonb_array_elements(v_subtasks) WITH ORDINALITY AS item(value, ordinality)
          UNION ALL SELECT v_subtask, v_order::numeric + 0.5
        ) ordered;
      END IF;
    END IF;
  END LOOP;

  IF (
    SELECT COALESCE(pg_catalog.jsonb_agg(item.value - 'updatedAt' ORDER BY item.ordinality), '[]'::jsonb)
    FROM pg_catalog.jsonb_array_elements(v_subtasks) WITH ORDINALITY AS item(value, ordinality)
  ) = (
    SELECT COALESCE(pg_catalog.jsonb_agg(item.value - 'updatedAt' ORDER BY item.ordinality), '[]'::jsonb)
    FROM pg_catalog.jsonb_array_elements(v_baseline_subtasks) WITH ORDINALITY AS item(value, ordinality)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object('code', 'no_change', 'message', 'The subtask batch would not change the task'));
  END IF;

  IF NOT p_preview AND p_approved_subtask_ids IS DISTINCT FROM (
    SELECT COALESCE(
      pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item.value->>'id') ORDER BY item.ordinality),
      '[]'::jsonb
    )
    FROM pg_catalog.jsonb_array_elements(v_subtasks) WITH ORDINALITY AS item(value, ordinality)
  ) THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'approval_mismatch', 'message', 'The approved subtask order does not match the canonical batch result'));
  END IF;

  v_read_back := pg_catalog.jsonb_build_object(
    'id', v_task.id, 'subtasks', v_subtasks, 'workspaceId', v_task.workspace_id,
    'canonicalRevision', CASE WHEN p_preview THEN v_task.canonical_revision ELSE v_task.canonical_revision + 1 END,
    'canonicalUpdatedAt', CASE WHEN p_preview THEN v_task.updated_at ELSE v_now END
  );

  IF p_preview THEN
    IF EXISTS (SELECT 1 FROM public.canonical_operations operation WHERE operation.user_id = v_actor AND operation.operation_id = p_operation_id) THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId was already applied'));
    END IF;
    SELECT * INTO v_issued_preview FROM public.canonical_operation_previews issued
    WHERE issued.user_id = v_actor AND issued.operation_id = p_operation_id FOR UPDATE;
    IF FOUND THEN
      IF v_issued_preview.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId already has another preview'));
      ELSIF v_issued_preview.consumed_at IS NOT NULL OR v_issued_preview.expires_at <= pg_catalog.clock_timestamp() THEN
        RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'preview_expired', 'message', 'Use a new operationId'));
      END IF;
      v_expected_preview_digest := v_issued_preview.preview_digest; v_preview_expiry := v_issued_preview.expires_at;
    ELSE
      v_expected_preview_digest := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
      v_preview_expiry := pg_catalog.clock_timestamp() + interval '15 minutes';
      INSERT INTO public.canonical_operation_previews(user_id, operation_id, preview_digest, request_hash, expires_at)
      VALUES (v_actor, p_operation_id, v_expected_preview_digest, v_request_hash, v_preview_expiry);
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'result', 'preview', 'contractVersion', p_contract_version,
      'operationId', p_operation_id, 'action', 'subtask_batch', 'taskId', p_task_id,
      'baseRevision', p_base_revision, 'requestHash', v_request_hash,
      'previewDigest', v_expected_preview_digest, 'previewExpiresAt', v_preview_expiry,
      'normalizedPayload', v_normalized, 'readBack', v_read_back);
  END IF;

  SELECT * INTO v_issued_preview FROM public.canonical_operation_previews issued
  WHERE issued.user_id = v_actor AND issued.operation_id = p_operation_id
    AND issued.preview_digest = p_preview_digest FOR UPDATE;
  IF NOT FOUND OR v_issued_preview.request_hash IS DISTINCT FROM v_request_hash
     OR v_issued_preview.expires_at IS DISTINCT FROM p_preview_expires_at
     OR v_issued_preview.consumed_at IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'The approval does not match this request'));
  ELSIF v_issued_preview.expires_at <= pg_catalog.clock_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'preview_expired', 'message', 'The approved preview expired'));
  END IF;

  v_scope_kind := CASE WHEN v_task.workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
  v_scope_id := COALESCE(v_task.workspace_id::text, v_actor::text);
  INSERT INTO public.canonical_operations(user_id, operation_id, contract_version, source, scope_kind, scope_id, workspace_id, entity_type, action, entity_id, request_hash, state)
  VALUES (v_actor, p_operation_id, p_contract_version, p_source, v_scope_kind, v_scope_id, v_task.workspace_id, 'task', 'subtask_batch', v_task.id, v_request_hash, 'applying')
  ON CONFLICT (user_id, operation_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId was already used'));
  END IF;
  UPDATE public.canonical_operation_previews SET consumed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  WHERE user_id = v_actor AND operation_id = p_operation_id AND preview_digest = p_preview_digest AND consumed_at IS NULL;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'conflict', 'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'The approval was already consumed'));
  END IF;

  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', p_operation_id, true);
  UPDATE public.tasks task SET subtasks = v_subtasks, updated_at = v_now WHERE task.id = v_task.id RETURNING task.* INTO STRICT v_updated;
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true);
  SELECT change.change_sequence INTO STRICT v_change_sequence FROM public.canonical_change_log change
  WHERE change.actor_user_id = v_actor AND change.operation_id = p_operation_id AND change.entity_type = 'task'
    AND change.entity_id = v_updated.id::text AND change.canonical_revision = v_updated.canonical_revision
  ORDER BY change.change_sequence DESC LIMIT 1;

  v_read_back := pg_catalog.jsonb_build_object('id', v_updated.id, 'subtasks', v_updated.subtasks,
    'workspaceId', v_updated.workspace_id, 'canonicalRevision', v_updated.canonical_revision, 'canonicalUpdatedAt', v_updated.updated_at);
  v_read_back_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(public.flowstate_receipt_canonical_json_v1(v_read_back), 'UTF8'), 'sha256'), 'hex');
  v_receipt := pg_catalog.jsonb_build_object(
    'contractVersion', p_contract_version, 'operationId', p_operation_id, 'source', p_source,
    'entityType', 'task', 'action', 'subtask_batch', 'entityId', v_updated.id,
    'requestHash', v_request_hash, 'canonicalRevision', v_updated.canonical_revision,
    'canonicalUpdatedAt', v_updated.updated_at, 'changeSequence', v_change_sequence,
    'status', 'committed', 'replayed', false, 'committedAt', pg_catalog.clock_timestamp(),
    'readBack', v_read_back, 'readBackHash', v_read_back_hash);
  UPDATE public.canonical_operations operation SET state = 'committed', canonical_revision = v_updated.canonical_revision,
    change_sequence = v_change_sequence, canonical_result = v_receipt,
    committed_at = (v_receipt->>'committedAt')::timestamptz, updated_at = pg_catalog.clock_timestamp()
  WHERE operation.user_id = v_actor AND operation.operation_id = p_operation_id;
  RETURN pg_catalog.jsonb_build_object('ok', true, 'status', 'committed', 'result', 'committed',
    'requestHash', v_request_hash, 'receipt', v_receipt);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true);
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_subtask_batch_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_subtask_batch_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,jsonb) TO authenticated;

COMMENT ON FUNCTION public.flowstate_subtask_batch_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid,jsonb) IS
  'Preview/apply one ordered create/update/delete subtask batch under parent task CAS with a durable canonical receipt.';
