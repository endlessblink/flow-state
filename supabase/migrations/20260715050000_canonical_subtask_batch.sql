-- TASK-1963: canonical ordered subtask batches.
--
-- Subtasks remain embedded in their parent task, but changes are expressed as
-- ordered create/update/delete operations. The public command is the only
-- signed-user entry point; helpers are private and never bypass parent scope,
-- revision, preview, or durable-operation checks.

CREATE OR REPLACE FUNCTION public.flowstate_h5_subtask_id(
  p_actor uuid,
  p_task_id text,
  p_operation_id text,
  p_client_id text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 'subtask-' || pg_catalog.substr(
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          p_actor::text || ':' || p_task_id || ':' || p_operation_id || ':' || p_client_id,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ),
    1,
    32
  )
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h5_insert_subtask(
  p_subtasks jsonb,
  p_subtask jsonb,
  p_order integer
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_length integer := pg_catalog.jsonb_array_length(p_subtasks);
  v_order integer := greatest(0, least(p_order, v_length));
BEGIN
  IF v_length = 0 THEN
    RETURN pg_catalog.jsonb_build_array(p_subtask);
  ELSIF v_order = 0 THEN
    RETURN pg_catalog.jsonb_build_array(p_subtask) || p_subtasks;
  ELSIF v_order = v_length THEN
    RETURN p_subtasks || pg_catalog.jsonb_build_array(p_subtask);
  END IF;
  RETURN pg_catalog.jsonb_insert(p_subtasks, ARRAY[v_order::text], p_subtask, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h5_valid_timestamp(p_value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_value IS NULL
     OR pg_catalog.char_length(p_value) > 64
     OR p_value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$' THEN
    RETURN false;
  END IF;
  PERFORM p_value::timestamptz;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

DROP FUNCTION IF EXISTS public.flowstate_h5_valid_subtasks(jsonb);

CREATE OR REPLACE FUNCTION public.flowstate_h5_valid_subtasks(
  p_subtasks jsonb,
  p_parent_task_id text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_subtask jsonb;
  v_position integer := 0;
  v_ids text[] := ARRAY[]::text[];
  v_client_ids text[] := ARRAY[]::text[];
BEGIN
  IF nullif(pg_catalog.btrim(p_parent_task_id), '') IS NULL
     OR p_parent_task_id IS DISTINCT FROM pg_catalog.btrim(p_parent_task_id)
     OR pg_catalog.jsonb_typeof(p_subtasks) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(p_subtasks) > 10001 THEN
    RETURN false;
  END IF;

  FOR v_subtask IN
    SELECT item.value
    FROM pg_catalog.jsonb_array_elements(p_subtasks) WITH ORDINALITY
      AS item(value, ordinality)
    ORDER BY item.ordinality
  LOOP
    IF pg_catalog.jsonb_typeof(v_subtask) IS DISTINCT FROM 'object'
       OR EXISTS (
         SELECT 1
         FROM pg_catalog.jsonb_object_keys(v_subtask) AS subtask_key(key)
         WHERE key NOT IN (
           'id', 'clientId', 'parentTaskId', 'title', 'description', 'isCompleted',
           'doneEnough', 'estimateMinutes', 'completedPomodoros', 'canvasPosition',
           'createdAt', 'updatedAt', 'order'
         )
       )
       OR pg_catalog.jsonb_typeof(v_subtask->'id') IS DISTINCT FROM 'string'
       OR nullif(pg_catalog.btrim(v_subtask->>'id'), '') IS NULL
       OR v_subtask->>'id' IS DISTINCT FROM pg_catalog.btrim(v_subtask->>'id')
       OR pg_catalog.char_length(v_subtask->>'id') > 256
       OR v_subtask->>'id' = ANY(v_ids)
       OR pg_catalog.jsonb_typeof(v_subtask->'title') IS DISTINCT FROM 'string'
       OR nullif(pg_catalog.btrim(v_subtask->>'title'), '') IS NULL
       OR v_subtask->>'title' IS DISTINCT FROM pg_catalog.btrim(v_subtask->>'title')
       OR pg_catalog.char_length(v_subtask->>'title') > 500
       OR pg_catalog.jsonb_typeof(v_subtask->'order') IS DISTINCT FROM 'number'
       OR v_subtask->>'order' !~ '^(0|[1-9][0-9]*)$'
       OR (v_subtask->>'order')::numeric IS DISTINCT FROM v_position::numeric THEN
      RETURN false;
    END IF;

    IF (v_subtask ? 'clientId' AND (
         pg_catalog.jsonb_typeof(v_subtask->'clientId') IS DISTINCT FROM 'string'
         OR nullif(pg_catalog.btrim(v_subtask->>'clientId'), '') IS NULL
         OR v_subtask->>'clientId' IS DISTINCT FROM pg_catalog.btrim(v_subtask->>'clientId')
         OR pg_catalog.char_length(v_subtask->>'clientId') > 160
         OR v_subtask->>'clientId' = ANY(v_client_ids)
       ))
       OR (v_subtask ? 'parentTaskId' AND (
         pg_catalog.jsonb_typeof(v_subtask->'parentTaskId') IS DISTINCT FROM 'string'
         OR nullif(pg_catalog.btrim(v_subtask->>'parentTaskId'), '') IS NULL
         OR v_subtask->>'parentTaskId' IS DISTINCT FROM pg_catalog.btrim(v_subtask->>'parentTaskId')
         OR pg_catalog.char_length(v_subtask->>'parentTaskId') > 256
         OR v_subtask->>'parentTaskId' IS DISTINCT FROM p_parent_task_id
       ))
       OR (v_subtask ? 'description' AND (
         pg_catalog.jsonb_typeof(v_subtask->'description') IS DISTINCT FROM 'string'
         OR pg_catalog.char_length(v_subtask->>'description') > 10000
       ))
       OR (v_subtask ? 'isCompleted'
           AND pg_catalog.jsonb_typeof(v_subtask->'isCompleted') IS DISTINCT FROM 'boolean')
       OR (v_subtask ? 'doneEnough' AND (
         pg_catalog.jsonb_typeof(v_subtask->'doneEnough') NOT IN ('string', 'null')
         OR (pg_catalog.jsonb_typeof(v_subtask->'doneEnough') = 'string'
             AND pg_catalog.char_length(v_subtask->>'doneEnough') > 2000)
       ))
       OR (v_subtask ? 'estimateMinutes' AND NOT (
         pg_catalog.jsonb_typeof(v_subtask->'estimateMinutes') = 'null'
         OR (
           pg_catalog.jsonb_typeof(v_subtask->'estimateMinutes') = 'number'
           AND v_subtask->>'estimateMinutes' ~ '^[1-9][0-9]*$'
           AND (v_subtask->>'estimateMinutes')::numeric <= 1440
         )
       ))
       OR (v_subtask ? 'completedPomodoros' AND NOT (
         pg_catalog.jsonb_typeof(v_subtask->'completedPomodoros') = 'number'
         AND v_subtask->>'completedPomodoros' ~ '^(0|[1-9][0-9]*)$'
         AND (v_subtask->>'completedPomodoros')::numeric <= 1000000
       ))
       OR (v_subtask ? 'canvasPosition' AND NOT (
         pg_catalog.jsonb_typeof(v_subtask->'canvasPosition') = 'null'
         OR (
           pg_catalog.jsonb_typeof(v_subtask->'canvasPosition') = 'object'
           AND v_subtask->'canvasPosition' ?& ARRAY['x', 'y']
           AND NOT EXISTS (
             SELECT 1
             FROM pg_catalog.jsonb_object_keys(v_subtask->'canvasPosition') AS position_key(key)
             WHERE key NOT IN ('x', 'y')
           )
           AND pg_catalog.jsonb_typeof(v_subtask #> '{canvasPosition,x}') = 'number'
           AND pg_catalog.jsonb_typeof(v_subtask #> '{canvasPosition,y}') = 'number'
           AND pg_catalog.abs((v_subtask #>> '{canvasPosition,x}')::numeric)
                 <= 1.7976931348623157e308::numeric
           AND pg_catalog.abs((v_subtask #>> '{canvasPosition,y}')::numeric)
                 <= 1.7976931348623157e308::numeric
         )
       ))
       OR (v_subtask ? 'createdAt' AND (
         pg_catalog.jsonb_typeof(v_subtask->'createdAt') IS DISTINCT FROM 'string'
         OR NOT public.flowstate_h5_valid_timestamp(v_subtask->>'createdAt')
       ))
       OR (v_subtask ? 'updatedAt' AND (
         pg_catalog.jsonb_typeof(v_subtask->'updatedAt') IS DISTINCT FROM 'string'
         OR NOT public.flowstate_h5_valid_timestamp(v_subtask->>'updatedAt')
       )) THEN
      RETURN false;
    END IF;

    v_ids := pg_catalog.array_append(v_ids, v_subtask->>'id');
    IF v_subtask ? 'clientId' THEN
      v_client_ids := pg_catalog.array_append(v_client_ids, v_subtask->>'clientId');
    END IF;
    v_position := v_position + 1;
  END LOOP;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h5_canonicalize_legacy_subtasks(
  p_subtasks jsonb,
  p_parent_task_id text
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_item record;
BEGIN
  IF pg_catalog.jsonb_typeof(p_subtasks) IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_array_length(p_subtasks) > 10001 THEN
    RETURN p_subtasks;
  END IF;
  FOR v_item IN
    SELECT item.value, item.ordinality
    FROM pg_catalog.jsonb_array_elements(p_subtasks) WITH ORDINALITY
      AS item(value, ordinality)
    ORDER BY item.ordinality
  LOOP
    IF pg_catalog.jsonb_typeof(v_item.value) IS DISTINCT FROM 'object'
       OR v_item.value ? 'order' THEN
      RETURN p_subtasks;
    END IF;
    v_result := v_result || pg_catalog.jsonb_build_array(
      v_item.value || pg_catalog.jsonb_build_object('order', v_item.ordinality - 1)
    );
  END LOOP;
  IF public.flowstate_h5_valid_subtasks(v_result, p_parent_task_id) THEN
    RETURN v_result;
  END IF;
  RETURN p_subtasks;
EXCEPTION WHEN OTHERS THEN
  RETURN p_subtasks;
END;
$$;

DO $$
DECLARE
  v_prior_operation_id text := pg_catalog.current_setting(
    'flowstate.canonical.operation_id', true
  );
BEGIN
  PERFORM pg_catalog.set_config(
    'flowstate.canonical.operation_id', 'migration:h5-canonicalize-legacy-subtasks', true
  );
  UPDATE public.tasks AS task
  SET subtasks = public.flowstate_h5_canonicalize_legacy_subtasks(
    task.subtasks, task.id::text
  )
  WHERE pg_catalog.jsonb_typeof(task.subtasks) = 'array'
    AND public.flowstate_h5_canonicalize_legacy_subtasks(
      task.subtasks, task.id::text
    ) IS DISTINCT FROM task.subtasks
    AND public.flowstate_h5_valid_subtasks(
      public.flowstate_h5_canonicalize_legacy_subtasks(
        task.subtasks, task.id::text
      ),
      task.id::text
    );
  PERFORM pg_catalog.set_config(
    'flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h5_apply_subtask_operations(
  p_subtasks jsonb,
  p_operations jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := COALESCE(p_subtasks, '[]'::jsonb);
  v_operation jsonb;
  v_subtask jsonb;
  v_index integer;
  v_order integer;
  v_length integer;
  v_position integer;
BEGIN
  FOR v_operation IN
    SELECT operation.value
    FROM pg_catalog.jsonb_array_elements(p_operations) WITH ORDINALITY
      AS operation(value, ordinality)
    ORDER BY operation.ordinality
  LOOP
    IF v_operation->>'kind' = 'create' THEN
      v_subtask := pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'id', v_operation->>'subtaskId',
        'clientId', v_operation->>'clientId',
        'parentTaskId', v_operation->>'parentTaskId',
        'title', v_operation->>'title',
        'description', v_operation->>'description',
        'isCompleted', COALESCE((v_operation->>'isCompleted')::boolean, false),
        'doneEnough', v_operation->'doneEnough',
        'estimateMinutes', v_operation->'estimateMinutes',
        'completedPomodoros', COALESCE(v_operation->'completedPomodoros', '0'::jsonb),
        'canvasPosition', v_operation->'canvasPosition'
      ));
      v_order := COALESCE(
        (v_operation->>'order')::integer,
        pg_catalog.jsonb_array_length(v_result)
      );
      v_result := public.flowstate_h5_insert_subtask(v_result, v_subtask, v_order);
    ELSE
      SELECT (item.ordinality - 1)::integer
        INTO v_index
      FROM pg_catalog.jsonb_array_elements(v_result) WITH ORDINALITY
        AS item(value, ordinality)
      WHERE item.value->>'id' = v_operation->>'subtaskId'
      LIMIT 1;

      IF v_operation->>'kind' = 'delete' THEN
        v_result := v_result - v_index;
      ELSE
        v_subtask := v_result->v_index;
        IF v_operation ? 'title' THEN
          v_subtask := pg_catalog.jsonb_set(
            v_subtask, '{title}', v_operation->'title', true
          );
        END IF;
        IF v_operation ? 'description' THEN
          v_subtask := pg_catalog.jsonb_set(
            v_subtask, '{description}', v_operation->'description', true
          );
        END IF;
        IF v_operation ? 'isCompleted' THEN
          v_subtask := pg_catalog.jsonb_set(
            v_subtask, '{isCompleted}', v_operation->'isCompleted', true
          );
        END IF;
        IF v_operation ? 'doneEnough' THEN
          v_subtask := CASE
            WHEN pg_catalog.jsonb_typeof(v_operation->'doneEnough') = 'null'
              THEN v_subtask - 'doneEnough'
            ELSE pg_catalog.jsonb_set(
              v_subtask, '{doneEnough}', v_operation->'doneEnough', true
            )
          END;
        END IF;
        IF v_operation ? 'estimateMinutes' THEN
          v_subtask := CASE
            WHEN pg_catalog.jsonb_typeof(v_operation->'estimateMinutes') = 'null'
              THEN v_subtask - 'estimateMinutes'
            ELSE pg_catalog.jsonb_set(
              v_subtask, '{estimateMinutes}', v_operation->'estimateMinutes', true
            )
          END;
        END IF;
        IF v_operation ? 'completedPomodoros' THEN
          v_subtask := pg_catalog.jsonb_set(
            v_subtask, '{completedPomodoros}', v_operation->'completedPomodoros', true
          );
        END IF;
        IF v_operation ? 'canvasPosition' THEN
          v_subtask := CASE
            WHEN pg_catalog.jsonb_typeof(v_operation->'canvasPosition') = 'null'
              THEN v_subtask - 'canvasPosition'
            ELSE pg_catalog.jsonb_set(
              v_subtask, '{canvasPosition}', v_operation->'canvasPosition', true
            )
          END;
        END IF;
        v_result := v_result - v_index;
        v_order := COALESCE(
          (v_operation->>'order')::integer,
          least(v_index, pg_catalog.jsonb_array_length(v_result))
        );
        v_result := public.flowstate_h5_insert_subtask(v_result, v_subtask, v_order);
      END IF;
    END IF;
  END LOOP;

  v_length := pg_catalog.jsonb_array_length(v_result);
  IF v_length = 0 THEN
    RETURN '[]'::jsonb;
  END IF;
  FOR v_position IN 0..v_length - 1 LOOP
    v_result := pg_catalog.jsonb_set(
      v_result,
      ARRAY[v_position::text, 'order'],
      pg_catalog.to_jsonb(v_position),
      true
    );
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h5_task_read_back(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.flowstate_h3_task_read_back(task.id::text)
    || pg_catalog.jsonb_build_object('subtasks', COALESCE(task.subtasks, '[]'::jsonb))
  FROM public.tasks AS task
  WHERE task.id::text = p_task_id
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h5_task_affected(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_array(
    pg_catalog.jsonb_build_object(
      'entityId', task.id::text,
      'entityType', 'task',
      'action', 'update',
      'canonicalRevision', task.canonical_revision,
      'changeSequence', change.change_sequence,
      'readBack', read_back.value,
      'readBackHash', pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to(
            public.flowstate_canonical_json_text_v1(read_back.value), 'UTF8'
          ),
          'sha256'
        ),
        'hex'
      )
    )
  )
  FROM public.tasks AS task
  JOIN LATERAL (
    SELECT change_log.change_sequence
    FROM public.canonical_change_log AS change_log
    WHERE change_log.entity_type = 'task'
      AND change_log.entity_id = task.id::text
    ORDER BY change_log.change_sequence DESC
    LIMIT 1
  ) AS change ON true
  CROSS JOIN LATERAL (
    SELECT public.flowstate_h5_task_read_back(task.id::text) AS value
  ) AS read_back
  WHERE task.id::text = p_task_id
$$;

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
  p_request_hash text DEFAULT NULL
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
  v_execution_operation jsonb;
  v_execution_operations jsonb := '[]'::jsonb;
  v_unknown_keys text[];
  v_kind text;
  v_subtask_id text;
  v_client_id text;
  v_index integer;
  v_seen_client_ids text[] := ARRAY[]::text[];
  v_seen_target_ids text[] := ARRAY[]::text[];
  v_result_subtasks jsonb;
  v_request_hash text;
  v_preview_digest text;
  v_preview_expires_at timestamptz;
  v_read_back jsonb;
  v_affected jsonb;
  v_receipt jsonb;
  v_context jsonb;
  v_scope_kind text;
  v_scope_id text;
  v_change_floor bigint;
  v_current_revision bigint;
  v_prior_operation_id text := pg_catalog.current_setting(
    'flowstate.canonical.operation_id', true
  );
BEGIN
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'not_authenticated', 'message', 'Authentication is required'
      )
    );
  END IF;

  IF p_contract_version IS DISTINCT FROM 'task-v1'
     OR p_source NOT IN ('local-api', 'web-pwa')
     OR nullif(pg_catalog.btrim(p_operation_id), '') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id) > 160
     OR nullif(pg_catalog.btrim(p_task_id), '') IS NULL
     OR p_base_revision IS NULL OR p_base_revision < 1
     OR p_preview IS NULL
     OR pg_catalog.jsonb_typeof(p_operations) <> 'array'
     OR pg_catalog.jsonb_array_length(p_operations) NOT BETWEEN 1 AND 50 THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'The canonical subtask request is invalid'
      )
    );
  END IF;

  FOR v_operation IN
    SELECT operation.value
    FROM pg_catalog.jsonb_array_elements(p_operations) WITH ORDINALITY
      AS operation(value, ordinality)
    ORDER BY operation.ordinality
  LOOP
    IF pg_catalog.jsonb_typeof(v_operation) <> 'object' THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_operations', 'message', 'Each subtask operation must be an object'
        )
      );
    END IF;
    v_kind := v_operation->>'kind';
    IF v_kind NOT IN ('create', 'update', 'delete') THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_operations', 'message', 'Subtask kind must be create, update, or delete'
        )
      );
    END IF;

    SELECT pg_catalog.array_agg(key ORDER BY key)
      INTO v_unknown_keys
    FROM pg_catalog.jsonb_object_keys(v_operation) AS operation_key(key)
    WHERE key NOT IN (
      'kind', 'clientId', 'subtaskId', 'title', 'description', 'doneEnough',
      'estimateMinutes', 'completedPomodoros', 'canvasPosition', 'isCompleted', 'order'
    );
    IF v_unknown_keys IS NOT NULL
       OR (v_operation ? 'order' AND (
         pg_catalog.jsonb_typeof(v_operation->'order') <> 'number'
         OR (v_operation->>'order') !~ '^[0-9]+$'
         OR (v_operation->>'order')::numeric > 10000
       ))
       OR (v_operation ? 'isCompleted'
           AND pg_catalog.jsonb_typeof(v_operation->'isCompleted') <> 'boolean')
       OR (v_operation ? 'description' AND (
         pg_catalog.jsonb_typeof(v_operation->'description') <> 'string'
         OR pg_catalog.char_length(v_operation->>'description') > 10000
       ))
       OR (v_operation ? 'doneEnough' AND (
         pg_catalog.jsonb_typeof(v_operation->'doneEnough') NOT IN ('string', 'null')
         OR (
           pg_catalog.jsonb_typeof(v_operation->'doneEnough') = 'string'
           AND pg_catalog.char_length(pg_catalog.btrim(v_operation->>'doneEnough')) > 2000
         )
       ))
       OR (v_operation ? 'estimateMinutes' AND NOT (
         pg_catalog.jsonb_typeof(v_operation->'estimateMinutes') = 'null'
         OR (
           pg_catalog.jsonb_typeof(v_operation->'estimateMinutes') = 'number'
           AND (v_operation->>'estimateMinutes') ~ '^[1-9][0-9]*$'
           AND (v_operation->>'estimateMinutes')::numeric <= 1440
         )
       ))
       OR (v_operation ? 'completedPomodoros' AND NOT (
         pg_catalog.jsonb_typeof(v_operation->'completedPomodoros') = 'number'
         AND (v_operation->>'completedPomodoros') ~ '^[0-9]+$'
         AND (v_operation->>'completedPomodoros')::numeric <= 1000000
       ))
       OR (v_operation ? 'canvasPosition' AND NOT (
         pg_catalog.jsonb_typeof(v_operation->'canvasPosition') = 'null'
         OR (
           pg_catalog.jsonb_typeof(v_operation->'canvasPosition') = 'object'
           AND v_operation->'canvasPosition' ?& ARRAY['x', 'y']
           AND NOT EXISTS (
             SELECT 1
             FROM pg_catalog.jsonb_object_keys(v_operation->'canvasPosition') AS position_key(key)
             WHERE key NOT IN ('x', 'y')
           )
           AND pg_catalog.jsonb_typeof(v_operation #> '{canvasPosition,x}') = 'number'
           AND pg_catalog.jsonb_typeof(v_operation #> '{canvasPosition,y}') = 'number'
         )
       )) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_operations', 'message', 'Subtask operation fields are invalid'
        )
      );
    END IF;

    IF v_kind = 'create' THEN
      v_client_id := v_operation->>'clientId';
      IF nullif(pg_catalog.btrim(v_client_id), '') IS NULL
         OR v_client_id IS DISTINCT FROM pg_catalog.btrim(v_client_id)
         OR pg_catalog.char_length(v_client_id) > 160
         OR v_operation ? 'subtaskId'
         OR pg_catalog.jsonb_typeof(v_operation->'title') <> 'string'
         OR nullif(pg_catalog.btrim(v_operation->>'title'), '') IS NULL
         OR pg_catalog.char_length(pg_catalog.btrim(v_operation->>'title')) > 500
         OR v_client_id = ANY(v_seen_client_ids) THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object(
            'code', 'invalid_operations', 'message', 'Create requires a unique clientId and title'
          )
        );
      END IF;
      v_subtask_id := public.flowstate_h5_subtask_id(
        v_actor, p_task_id, p_operation_id, v_client_id
      );
      v_seen_client_ids := pg_catalog.array_append(v_seen_client_ids, v_client_id);
      v_normalized_operation := pg_catalog.jsonb_set(
        v_operation,
        '{title}',
        pg_catalog.to_jsonb(pg_catalog.btrim(v_operation->>'title')),
        true
      );
      IF pg_catalog.jsonb_typeof(v_operation->'doneEnough') = 'string' THEN
        v_normalized_operation := pg_catalog.jsonb_set(
          v_normalized_operation,
          '{doneEnough}',
          pg_catalog.to_jsonb(pg_catalog.btrim(v_operation->>'doneEnough')),
          true
        );
      END IF;
      v_execution_operation := v_normalized_operation
        || pg_catalog.jsonb_build_object(
          'subtaskId', v_subtask_id,
          'parentTaskId', p_task_id
        );
    ELSE
      v_subtask_id := v_operation->>'subtaskId';
      IF nullif(pg_catalog.btrim(v_subtask_id), '') IS NULL
         OR v_subtask_id IS DISTINCT FROM pg_catalog.btrim(v_subtask_id)
         OR pg_catalog.char_length(v_subtask_id) > 256
         OR v_operation ? 'clientId'
         OR v_subtask_id = ANY(v_seen_target_ids)
         OR (v_kind = 'delete' AND v_operation <> pg_catalog.jsonb_build_object(
           'kind', 'delete', 'subtaskId', v_subtask_id
         ))
         OR (v_kind = 'update' AND NOT (
           v_operation ? 'title' OR v_operation ? 'description' OR v_operation ? 'doneEnough'
           OR v_operation ? 'estimateMinutes' OR v_operation ? 'isCompleted'
           OR v_operation ? 'completedPomodoros' OR v_operation ? 'canvasPosition'
           OR v_operation ? 'order'
         ))
         OR (v_operation ? 'title' AND (
           pg_catalog.jsonb_typeof(v_operation->'title') <> 'string'
           OR nullif(pg_catalog.btrim(v_operation->>'title'), '') IS NULL
           OR pg_catalog.char_length(pg_catalog.btrim(v_operation->>'title')) > 500
         )) THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object(
            'code', 'invalid_operations', 'message', 'Update/delete requires a valid subtaskId'
          )
        );
      END IF;
      v_seen_target_ids := pg_catalog.array_append(v_seen_target_ids, v_subtask_id);
      v_normalized_operation := v_operation;
      IF v_operation ? 'title' THEN
        v_normalized_operation := pg_catalog.jsonb_set(
          v_normalized_operation,
          '{title}',
          pg_catalog.to_jsonb(pg_catalog.btrim(v_operation->>'title')),
          true
        );
      END IF;
      IF pg_catalog.jsonb_typeof(v_operation->'doneEnough') = 'string' THEN
        v_normalized_operation := pg_catalog.jsonb_set(
          v_normalized_operation,
          '{doneEnough}',
          pg_catalog.to_jsonb(pg_catalog.btrim(v_operation->>'doneEnough')),
          true
        );
      END IF;
      v_execution_operation := v_normalized_operation;
    END IF;
    v_normalized_operations := v_normalized_operations
      || pg_catalog.jsonb_build_array(v_normalized_operation);
    v_execution_operations := v_execution_operations
      || pg_catalog.jsonb_build_array(v_execution_operation);
  END LOOP;

  v_request_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
          'actorUserId', v_actor,
          'contractVersion', p_contract_version,
          'source', p_source,
          'action', 'subtask_batch',
          'taskId', p_task_id,
          'baseRevision', p_base_revision,
          'operations', v_normalized_operations,
          'workspaceId', p_workspace_id
        )),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || p_operation_id, 0)
  );
  SELECT * INTO v_existing
  FROM public.canonical_operations AS operation
  WHERE operation.user_id = v_actor
    AND operation.operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'idempotency_conflict',
          'message', 'operationId was already used for another request'
        )
      );
    END IF;
    IF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
      v_receipt := v_existing.canonical_result || pg_catalog.jsonb_build_object(
        'status', 'replayed', 'replayed', true
      );
      RETURN pg_catalog.jsonb_build_object(
        'ok', true, 'result', 'committed',
        'operationId', p_operation_id, 'action', 'subtask_batch',
        'taskId', p_task_id, 'requestHash', v_request_hash,
        'receipt', v_receipt
      );
    END IF;
  END IF;

  IF p_preview THEN
    SELECT * INTO v_task
    FROM public.tasks AS task
    WHERE task.id::text = p_task_id;
  ELSE
    SELECT * INTO v_task
    FROM public.tasks AS task
    WHERE task.id::text = p_task_id
    FOR UPDATE;
  END IF;
  IF NOT FOUND OR v_task.is_deleted THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'not_found', 'message', 'Task was not found'
      )
    );
  END IF;
  IF v_task.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'scope_denied', 'message', 'Task is outside the active scope'
      )
    );
  END IF;
  IF (v_task.workspace_id IS NULL AND v_task.user_id IS DISTINCT FROM v_actor)
     OR (v_task.workspace_id IS NOT NULL
         AND NOT public.flowstate_can_write_workspace_v1(v_task.workspace_id)) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'scope_denied', 'message', 'Task write access is required'
      )
    );
  END IF;
  IF v_task.canonical_revision IS DISTINCT FROM p_base_revision THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'stale_revision',
        'message', 'Task changed after the requested base revision',
        'currentRevision', v_task.canonical_revision
      )
    );
  END IF;
  IF NOT public.flowstate_h5_valid_subtasks(v_task.subtasks, p_task_id) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_existing_subtasks',
        'message', 'Existing subtasks are not canonical'
      )
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(v_normalized_operations) AS requested(operation)
    JOIN pg_catalog.jsonb_array_elements(v_task.subtasks) AS existing(subtask)
      ON existing.subtask->>'clientId' = requested.operation->>'clientId'
    WHERE requested.operation->>'kind' = 'create'
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'client_id_conflict',
        'message', 'A subtask already uses this clientId'
      )
    );
  END IF;

  IF NOT p_preview THEN
    IF nullif(pg_catalog.btrim(p_request_hash), '') IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'request_hash_required',
          'message', 'The server-issued requestHash is required for apply'
        )
      );
    END IF;
    SELECT * INTO v_issued_preview
    FROM public.canonical_operation_previews AS issued
    WHERE issued.user_id = v_actor
      AND issued.operation_id = p_operation_id
    FOR UPDATE;
    IF NOT FOUND
       OR v_issued_preview.request_hash IS DISTINCT FROM v_request_hash
       OR p_request_hash IS DISTINCT FROM v_request_hash
       OR v_issued_preview.preview_digest IS DISTINCT FROM p_preview_digest
       OR v_issued_preview.expires_at IS DISTINCT FROM p_preview_expires_at
       OR v_issued_preview.consumed_at IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'preview_mismatch', 'message', 'The approval does not match this request'
        )
      );
    END IF;
    IF v_issued_preview.expires_at <= pg_catalog.clock_timestamp() THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'preview_expired', 'message', 'The approved preview has expired'
        )
      );
    END IF;
  END IF;

  FOR v_operation IN
    SELECT operation.value
    FROM pg_catalog.jsonb_array_elements(v_execution_operations) WITH ORDINALITY
      AS operation(value, ordinality)
    ORDER BY operation.ordinality
  LOOP
    v_subtask_id := v_operation->>'subtaskId';
    SELECT (item.ordinality - 1)::integer INTO v_index
    FROM pg_catalog.jsonb_array_elements(COALESCE(v_task.subtasks, '[]'::jsonb))
      WITH ORDINALITY AS item(value, ordinality)
    WHERE item.value->>'id' = v_subtask_id
    LIMIT 1;
    IF v_operation->>'kind' = 'create' THEN
      IF v_index IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object(
            'code', 'subtask_id_conflict', 'message', 'Generated subtask identity is unavailable'
          )
        );
      END IF;
    ELSIF v_index IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'subtask_not_found', 'message', 'Subtask was not found'
        )
      );
    END IF;
  END LOOP;

  v_result_subtasks := public.flowstate_h5_apply_subtask_operations(
    COALESCE(v_task.subtasks, '[]'::jsonb), v_execution_operations
  );
  IF pg_catalog.jsonb_array_length(v_result_subtasks) > 10001 THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'subtask_limit_exceeded',
        'message', 'Subtask batch exceeds the canonical task limit'
      )
    );
  END IF;
  v_read_back := public.flowstate_h3_task_read_back(p_task_id)
    || pg_catalog.jsonb_build_object(
      'canonicalRevision', p_base_revision,
      'subtasks', v_result_subtasks
    );

  IF p_preview THEN
    SELECT * INTO v_issued_preview
    FROM public.canonical_operation_previews AS issued
    WHERE issued.user_id = v_actor
      AND issued.operation_id = p_operation_id
    FOR UPDATE;
    IF FOUND THEN
      IF v_issued_preview.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object(
            'code', 'idempotency_conflict', 'message', 'operationId already has another preview'
          )
        );
      END IF;
      IF v_issued_preview.consumed_at IS NOT NULL
         OR v_issued_preview.expires_at <= pg_catalog.clock_timestamp() THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object(
            'code', 'preview_expired', 'message', 'Use a new operationId for a fresh preview'
          )
        );
      END IF;
      v_preview_digest := v_issued_preview.preview_digest;
      v_preview_expires_at := v_issued_preview.expires_at;
    ELSE
      v_preview_digest := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
      v_preview_expires_at := pg_catalog.clock_timestamp() + interval '15 minutes';
      INSERT INTO public.canonical_operation_previews (
        user_id, operation_id, preview_digest, request_hash, expires_at
      ) VALUES (
        v_actor, p_operation_id, v_preview_digest, v_request_hash, v_preview_expires_at
      );
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'result', 'preview', 'preview', true,
      'contractVersion', p_contract_version,
      'operationId', p_operation_id, 'action', 'subtask_batch',
      'taskId', p_task_id, 'baseRevision', p_base_revision,
      'requestHash', v_request_hash,
      'previewDigest', v_preview_digest,
      'previewExpiresAt', v_preview_expires_at,
      'normalizedPayload', pg_catalog.jsonb_build_object(
        'taskId', p_task_id, 'operations', v_normalized_operations
      ),
      'readBack', v_read_back
    );
  END IF;

  v_scope_kind := CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
  v_scope_id := COALESCE(p_workspace_id::text, v_actor::text);
  v_context := pg_catalog.jsonb_build_object(
    'action', 'subtask_batch',
    'taskId', p_task_id,
    'baseRevision', p_base_revision,
    'normalizedPayload', pg_catalog.jsonb_build_object(
      'operations', v_normalized_operations
    ),
    'workspaceId', p_workspace_id
  );

  BEGIN
    INSERT INTO public.canonical_operations (
      user_id, operation_id, contract_version, source,
      scope_kind, scope_id, workspace_id,
      entity_type, action, entity_id, request_hash, state,
      operation_context
    ) VALUES (
      v_actor, p_operation_id, p_contract_version, p_source,
      v_scope_kind, v_scope_id, p_workspace_id,
      'task', 'subtask_batch', p_task_id, v_request_hash, 'applying',
      v_context
    ) ON CONFLICT (user_id, operation_id) DO NOTHING;
    IF NOT FOUND THEN
      SELECT * INTO STRICT v_existing
      FROM public.canonical_operations AS operation
      WHERE operation.user_id = v_actor
        AND operation.operation_id = p_operation_id
      FOR UPDATE;
      IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object(
            'code', 'idempotency_conflict', 'message', 'operationId was already used'
          )
        );
      END IF;
    END IF;

    UPDATE public.canonical_operation_previews AS issued
    SET consumed_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp()
    WHERE issued.user_id = v_actor
      AND issued.operation_id = p_operation_id
      AND issued.preview_digest = p_preview_digest
      AND issued.consumed_at IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'preview consumption race';
    END IF;

    SELECT COALESCE(pg_catalog.max(change_sequence), 0)
      INTO v_change_floor
    FROM public.canonical_change_log;
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', p_operation_id, true);
    UPDATE public.tasks AS task
    SET subtasks = v_result_subtasks,
        updated_at = pg_catalog.clock_timestamp()
    WHERE task.id::text = p_task_id
      AND task.canonical_revision = p_base_revision
    RETURNING * INTO v_updated;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'task revision changed during apply';
    END IF;
    PERFORM pg_catalog.set_config(
      'flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true
    );
    PERFORM public.flowstate_h3_link_task_changes(
      ARRAY[p_task_id], p_operation_id, v_change_floor
    );
    v_affected := public.flowstate_h5_task_affected(p_task_id);
    v_receipt := public.flowstate_h3_finalize_receipt(
      v_actor,
      p_operation_id,
      pg_catalog.jsonb_build_object(
        'readBack', public.flowstate_h5_task_read_back(p_task_id)
      ),
      v_context,
      v_affected
    );
  EXCEPTION WHEN serialization_failure THEN
    PERFORM pg_catalog.set_config(
      'flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true
    );
    SELECT task.canonical_revision INTO v_current_revision
    FROM public.tasks AS task
    WHERE task.id::text = p_task_id;
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'stale_revision', 'message', 'Task changed during apply',
        'currentRevision', v_current_revision
      )
    );
  WHEN OTHERS THEN
    PERFORM pg_catalog.set_config(
      'flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true
    );
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'internal_error', 'message', 'Canonical subtask batch rolled back'
      )
    );
  END;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'result', 'committed',
    'operationId', p_operation_id, 'action', 'subtask_batch',
    'taskId', p_task_id, 'requestHash', v_request_hash,
    'receipt', v_receipt || pg_catalog.jsonb_build_object(
      'status', 'committed', 'replayed', false
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_h5_subtask_id(uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h5_insert_subtask(jsonb, jsonb, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h5_valid_timestamp(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h5_valid_subtasks(jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h5_canonicalize_legacy_subtasks(jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h5_apply_subtask_operations(jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h5_task_read_back(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h5_task_affected(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_subtask_batch_v1(
  text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_subtask_batch_v1(
  text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid, text
) TO authenticated;

COMMENT ON FUNCTION public.flowstate_subtask_batch_v1(
  text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid, text
) IS
  'Preview/apply 1-50 exact ordered subtask create/update/delete operations with stable identities, parent revision CAS, durable replay, and canonical read-back.';
