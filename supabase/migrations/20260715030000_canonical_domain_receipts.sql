-- H3: one canonical receipt envelope for assistant-facing task operations.
--
-- Existing domain bodies are retained under private base names so their
-- validation, recurrence compatibility, lock ordering, and rollback semantics
-- remain unchanged. Public wrappers add a server-owned request hash, exact
-- affected-row evidence, and canonical_operations replay only after the base
-- operation has committed successfully in the same transaction.

ALTER TABLE public.canonical_operations
  ADD COLUMN IF NOT EXISTS operation_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS affected_entities jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.flowstate_h3_task_read_back(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'id', task.id,
    'title', task.title,
    'status', CASE WHEN task.status = 'done' THEN 'done' ELSE 'todo' END,
    'completedAt', task.completed_at,
    'dueDate', task.due_date,
    'isDeleted', task.is_deleted,
    'deletedAt', task.deleted_at,
    'workspaceId', task.workspace_id,
    'canonicalRevision', task.canonical_revision,
    'canonicalUpdatedAt', task.updated_at,
    'recurrenceRule', task.recurrence_rule,
    'recurrenceParentId', task.recurrence_parent_id,
    'recurrenceCount', task.recurrence_count,
    'isCompletionRecord', task.is_completion_record
  )
  FROM public.tasks AS task
  WHERE task.id::text = p_task_id
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h3_task_affected(
  p_task_ids text[],
  p_actions text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'entityId', requested.task_id,
        'entityType', 'task',
        'action', COALESCE(p_actions[requested.ordinality], change.action),
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
      ) ORDER BY requested.ordinality
    ),
    '[]'::jsonb
  )
  FROM pg_catalog.unnest(p_task_ids) WITH ORDINALITY AS requested(task_id, ordinality)
  JOIN public.tasks AS task ON task.id::text = requested.task_id
  JOIN LATERAL (
    SELECT change_log.action, change_log.change_sequence
    FROM public.canonical_change_log AS change_log
    WHERE change_log.entity_type = 'task'
      AND change_log.entity_id = requested.task_id
    ORDER BY change_log.change_sequence DESC
    LIMIT 1
  ) AS change ON true
  CROSS JOIN LATERAL (
    SELECT public.flowstate_h3_task_read_back(requested.task_id) AS value
  ) AS read_back
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h3_link_task_changes(
  p_task_ids text[],
  p_operation_id text,
  p_after_sequence bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expected integer;
  v_linked integer;
BEGIN
  SELECT pg_catalog.count(DISTINCT requested.task_id)::integer
  INTO v_expected
  FROM pg_catalog.unnest(p_task_ids) AS requested(task_id);

  IF v_expected <> pg_catalog.array_length(p_task_ids, 1) THEN
    RAISE EXCEPTION 'canonical operation has duplicate affected task identities';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (change_log.entity_id) change_log.id
    FROM public.canonical_change_log AS change_log
    WHERE change_log.entity_type = 'task'
      AND change_log.entity_id = ANY(p_task_ids)
      AND change_log.change_sequence > p_after_sequence
    ORDER BY change_log.entity_id, change_log.change_sequence DESC
  )
  UPDATE public.canonical_change_log AS change_log
  SET operation_id = p_operation_id,
      source = 'local-api'
  FROM latest
  WHERE change_log.id = latest.id;
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  IF v_linked <> v_expected THEN
    RAISE EXCEPTION 'canonical operation did not produce one linked change per affected task';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h3_finalize_receipt(
  p_actor uuid,
  p_operation_id text,
  p_domain_result jsonb,
  p_operation_context jsonb,
  p_affected jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_operation public.canonical_operations%ROWTYPE;
  v_primary jsonb := p_affected->0;
  v_read_back jsonb;
  v_domain_read_back jsonb;
  v_read_back_hash text;
  v_receipt jsonb;
  v_committed_at timestamptz;
BEGIN
  SELECT * INTO STRICT v_operation
  FROM public.canonical_operations AS operation
  WHERE operation.user_id = p_actor
    AND operation.operation_id = p_operation_id
  FOR UPDATE;

  IF pg_catalog.jsonb_array_length(p_affected) < 1
     OR (v_primary->>'canonicalRevision')::bigint < 1
     OR (v_primary->>'changeSequence')::bigint < 1 THEN
    RAISE EXCEPTION 'canonical receipt has no affected task evidence';
  END IF;

  IF pg_catalog.jsonb_array_length(p_affected) <> (
    SELECT pg_catalog.count(DISTINCT affected.value->>'entityId')
    FROM pg_catalog.jsonb_array_elements(p_affected) AS affected(value)
  ) THEN
    RAISE EXCEPTION 'canonical receipt has duplicate affected task identities';
  END IF;

  v_domain_read_back := COALESCE(p_domain_result->'readBack', p_domain_result);
  v_read_back := CASE
    WHEN v_operation.action = 'done_for_now' THEN
      (v_primary->'readBack') || pg_catalog.jsonb_build_object(
        'completedOccurrence',
          COALESCE(v_domain_read_back->'completedOccurrence', '{}'::jsonb)
          || COALESCE(p_affected #> '{1,readBack}', '{}'::jsonb)
          || pg_catalog.jsonb_build_object(
            'id', p_affected #>> '{1,entityId}',
            'canonicalRevision', (p_affected #>> '{1,canonicalRevision}')::bigint,
            'changeSequence', (p_affected #>> '{1,changeSequence}')::bigint
          ),
        'nextOccurrence',
          COALESCE(v_domain_read_back->'nextOccurrence', '{}'::jsonb)
          || pg_catalog.jsonb_build_object(
            'taskId', v_primary->>'entityId'
          )
      )
    WHEN v_operation.action = 'merge' THEN
      (v_primary->'readBack')
      || COALESCE(v_domain_read_back, '{}'::jsonb)
      || pg_catalog.jsonb_build_object(
        'survivorTaskId', p_operation_context->>'survivorTaskId',
        'duplicateTaskId', p_operation_context->>'duplicateTaskId',
        'duplicateArchived', true
      )
    ELSE
      (v_primary->'readBack') || COALESCE(p_domain_result->'readBack', '{}'::jsonb)
  END;
  v_read_back_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(
      public.flowstate_canonical_json_text_v1(v_read_back), 'UTF8'
    ), 'sha256'),
    'hex'
  );
  v_committed_at := COALESCE(v_operation.committed_at, pg_catalog.clock_timestamp());

  v_receipt := pg_catalog.jsonb_build_object(
    'ok', true,
    'status', 'committed',
    'operationId', v_operation.operation_id,
    'requestHash', v_operation.request_hash,
    'contractVersion', v_operation.contract_version,
    'source', v_operation.source,
    'entityType', v_operation.entity_type,
    'action', v_operation.action,
    'entityId', v_primary->>'entityId',
    'canonicalRevision', (v_primary->>'canonicalRevision')::bigint,
    'canonicalUpdatedAt', v_primary #>> '{readBack,canonicalUpdatedAt}',
    'changeSequence', (v_primary->>'changeSequence')::bigint,
    'committedAt', v_committed_at,
    'replayed', false,
    'readBack', v_read_back,
    'readBackHash', v_read_back_hash,
    'affected', p_affected,
    'operationContext', p_operation_context
  );

  UPDATE public.canonical_operations AS operation
  SET state = 'committed',
      canonical_revision = (v_primary->>'canonicalRevision')::bigint,
      change_sequence = (v_primary->>'changeSequence')::bigint,
      canonical_result = v_receipt,
      operation_context = p_operation_context,
      affected_entities = p_affected,
      committed_at = v_committed_at,
      updated_at = pg_catalog.clock_timestamp()
  WHERE operation.user_id = p_actor
    AND operation.operation_id = p_operation_id;

  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_h3_task_read_back(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h3_task_affected(text[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h3_link_task_changes(text[], text, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h3_finalize_receipt(uuid, text, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

-- Preserve each existing implementation body exactly once. Conditional
-- renames make validation/recovery replays safe after the public wrappers exist.
DO $migration$
BEGIN
  IF pg_catalog.to_regprocedure(
       'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_patch_task_v1_h3_base(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_patch_task_v1(
      text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid
    ) RENAME TO flowstate_patch_task_v1_h3_base;
  END IF;
  IF pg_catalog.to_regprocedure(
       'public.flowstate_complete_task_v1(text,text,text,text,bigint,boolean,text,timestamptz,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_complete_task_v1_h3_base(text,text,text,text,bigint,boolean,text,timestamptz,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_complete_task_v1(
      text, text, text, text, bigint, boolean, text, timestamptz, uuid
    ) RENAME TO flowstate_complete_task_v1_h3_base;
  END IF;
  IF pg_catalog.to_regprocedure(
       'public.flowstate_done_for_now(text,boolean,date,text,text,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_done_for_now_h3_base(text,boolean,date,text,text,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_done_for_now(text, boolean, date, text, text, uuid)
      RENAME TO flowstate_done_for_now_h3_base;
  END IF;
  IF pg_catalog.to_regprocedure(
       'public.flowstate_merge_tasks(text,text,boolean,text,text,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_merge_tasks_h3_base(text,text,boolean,text,text,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_merge_tasks(text, text, boolean, text, text, uuid)
      RENAME TO flowstate_merge_tasks_h3_base;
  END IF;
  IF pg_catalog.to_regprocedure(
       'public.flowstate_merge_tasks_with_recurrence(text,text,jsonb,boolean,text,text,uuid)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.flowstate_merge_tasks_with_recurrence_h3_base(text,text,jsonb,boolean,text,text,uuid)'
     ) IS NULL THEN
    ALTER FUNCTION public.flowstate_merge_tasks_with_recurrence(
      text, text, jsonb, boolean, text, text, uuid
    ) RENAME TO flowstate_merge_tasks_with_recurrence_h3_base;
  END IF;
END;
$migration$;

REVOKE ALL ON FUNCTION public.flowstate_patch_task_v1_h3_base(
  text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_complete_task_v1_h3_base(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_done_for_now_h3_base(
  text, boolean, date, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_merge_tasks_h3_base(
  text, text, boolean, text, text, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_merge_tasks_with_recurrence_h3_base(
  text, text, jsonb, boolean, text, text, uuid
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.flowstate_patch_task_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_task_id text,
  p_base_revision bigint,
  p_patch jsonb,
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
  v_result jsonb;
  v_receipt jsonb;
  v_server_hash text;
  v_affected jsonb;
  v_replayed boolean;
BEGIN
  IF NOT p_preview AND nullif(pg_catalog.btrim(p_request_hash), '') IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'request_hash_required',
        'message', 'The server-issued requestHash is required for apply'
      )
    );
  END IF;

  IF NOT p_preview THEN
    SELECT preview.request_hash INTO v_server_hash
    FROM public.canonical_operation_previews AS preview
    WHERE preview.user_id = v_actor AND preview.operation_id = p_operation_id;
    IF v_server_hash IS NULL OR v_server_hash IS DISTINCT FROM p_request_hash THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'request_hash_mismatch',
          'message', 'The requestHash does not match the approved operation'
        )
      );
    END IF;
  END IF;

  v_result := public.flowstate_patch_task_v1_h3_base(
    p_operation_id, p_contract_version, p_source, p_task_id, p_base_revision,
    p_patch, p_preview, p_preview_digest, p_preview_expires_at, p_workspace_id
  );

  IF p_preview AND v_result->>'ok' = 'true' THEN
    SELECT preview.request_hash INTO v_server_hash
    FROM public.canonical_operation_previews AS preview
    WHERE preview.user_id = v_actor AND preview.operation_id = p_operation_id;
    RETURN v_result || pg_catalog.jsonb_build_object(
      'result', 'preview', 'preview', true,
      'contractVersion', p_contract_version,
      'operationId', p_operation_id,
      'taskId', p_task_id,
      'previewVersion', COALESCE(v_result->>'previewVersion', v_result->>'previewDigest'),
      'requestHash', v_server_hash
    );
  END IF;
  IF v_result->>'ok' IS DISTINCT FROM 'true' OR v_result->>'result' <> 'committed' THEN
    RETURN v_result;
  END IF;

  v_replayed := COALESCE(
    COALESCE((v_result #>> '{receipt,replayed}')::boolean, false)
      OR (v_result #>> '{receipt,status}') = 'replayed',
    false
  );
  IF v_replayed THEN
    RETURN (v_result - 'receipt') || pg_catalog.jsonb_build_object(
      'requestHash', p_request_hash,
      'receipt', (v_result->'receipt') || pg_catalog.jsonb_build_object(
        'status', 'replayed', 'replayed', true
      )
    );
  END IF;
  v_affected := public.flowstate_h3_task_affected(
    ARRAY[p_task_id], ARRAY['update']
  );
  v_receipt := public.flowstate_h3_finalize_receipt(
    v_actor, p_operation_id, v_result->'receipt',
    pg_catalog.jsonb_build_object(
      'taskId', p_task_id, 'baseRevision', p_base_revision,
      'normalizedPayload', p_patch, 'workspaceId', p_workspace_id
    ),
    v_affected
  );
  RETURN (v_result - 'receipt') || pg_catalog.jsonb_build_object(
    'requestHash', p_request_hash,
    'receipt', v_receipt || pg_catalog.jsonb_build_object(
      'status', CASE WHEN v_replayed THEN 'replayed' ELSE 'committed' END,
      'replayed', v_replayed
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_complete_task_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_task_id text,
  p_base_revision bigint,
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
  v_result jsonb;
  v_receipt jsonb;
  v_server_hash text;
  v_affected jsonb;
  v_replayed boolean;
BEGIN
  IF NOT p_preview AND nullif(pg_catalog.btrim(p_request_hash), '') IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'request_hash_required', 'message', 'The server-issued requestHash is required for apply')
    );
  END IF;
  IF NOT p_preview THEN
    SELECT preview.request_hash INTO v_server_hash
    FROM public.canonical_operation_previews AS preview
    WHERE preview.user_id = v_actor AND preview.operation_id = p_operation_id;
    IF v_server_hash IS NULL OR v_server_hash IS DISTINCT FROM p_request_hash THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'request_hash_mismatch', 'message', 'The requestHash does not match the approved operation')
      );
    END IF;
  END IF;

  v_result := public.flowstate_complete_task_v1_h3_base(
    p_operation_id, p_contract_version, p_source, p_task_id, p_base_revision,
    p_preview, p_preview_digest, p_preview_expires_at, p_workspace_id
  );
  IF p_preview AND v_result->>'ok' = 'true' THEN
    SELECT preview.request_hash INTO v_server_hash
    FROM public.canonical_operation_previews AS preview
    WHERE preview.user_id = v_actor AND preview.operation_id = p_operation_id;
    RETURN v_result || pg_catalog.jsonb_build_object(
      'result', 'preview', 'preview', true,
      'contractVersion', p_contract_version,
      'operationId', p_operation_id,
      'taskId', p_task_id,
      'previewVersion', COALESCE(v_result->>'previewVersion', v_result->>'previewDigest'),
      'requestHash', v_server_hash
    );
  END IF;
  IF v_result->>'ok' IS DISTINCT FROM 'true' OR v_result->>'result' <> 'committed' THEN
    RETURN v_result;
  END IF;

  v_replayed := COALESCE(
    COALESCE((v_result #>> '{receipt,replayed}')::boolean, false)
      OR (v_result #>> '{receipt,status}') = 'replayed',
    false
  );
  IF v_replayed THEN
    RETURN (v_result - 'receipt') || pg_catalog.jsonb_build_object(
      'requestHash', p_request_hash,
      'receipt', (v_result->'receipt') || pg_catalog.jsonb_build_object(
        'status', 'replayed', 'replayed', true
      )
    );
  END IF;
  v_affected := public.flowstate_h3_task_affected(
    ARRAY[p_task_id], ARRAY['update']
  );
  v_receipt := public.flowstate_h3_finalize_receipt(
    v_actor, p_operation_id, v_result->'receipt',
    pg_catalog.jsonb_build_object(
      'taskId', p_task_id, 'baseRevision', p_base_revision,
      'normalizedPayload', pg_catalog.jsonb_build_object('status', 'done'),
      'workspaceId', p_workspace_id
    ),
    v_affected
  );
  RETURN (v_result - 'receipt') || pg_catalog.jsonb_build_object(
    'requestHash', p_request_hash,
    'receipt', v_receipt || pg_catalog.jsonb_build_object(
      'status', CASE WHEN v_replayed THEN 'replayed' ELSE 'committed' END,
      'replayed', v_replayed
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_done_for_now(
  p_task_id text,
  p_preview boolean DEFAULT true,
  p_next_due_date date DEFAULT NULL,
  p_request_id text DEFAULT NULL,
  p_preview_version text DEFAULT NULL,
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
  v_result jsonb;
  v_existing public.canonical_operations%ROWTYPE;
  v_hash text;
  v_prior_operation_id text := pg_catalog.current_setting('flowstate.canonical.operation_id', true);
  v_affected jsonb;
  v_receipt jsonb;
  v_context jsonb;
  v_change_floor bigint;
BEGIN
  IF p_request_id IS NOT NULL
     AND p_request_id IS DISTINCT FROM pg_catalog.btrim(p_request_id) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request',
        'message', 'requestId must not contain leading or trailing whitespace'
      )
    );
  END IF;
  IF p_preview THEN
    v_result := public.flowstate_done_for_now_h3_base(
      p_task_id, true, p_next_due_date, NULL, NULL, p_workspace_id
    );
    IF v_result->>'ok' = 'true' THEN
      v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
        public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
          'actorUserId', v_actor,
          'contractVersion', 'task-v1',
          'source', 'local-api',
          'action', 'done_for_now',
          'taskId', p_task_id,
          'normalizedPayload', pg_catalog.jsonb_build_object(
            'nextDueDate', p_next_due_date
          ),
          'previewVersion', v_result->>'previewVersion',
          'workspaceId', p_workspace_id
        )), 'UTF8'
      ), 'sha256'), 'hex');
      RETURN v_result || pg_catalog.jsonb_build_object(
        'result', 'preview', 'preview', true,
        'contractVersion', 'task-v1',
        'operationId', p_request_id,
        'taskId', p_task_id,
        'requestHash', v_hash
      );
    END IF;
    RETURN v_result;
  END IF;
  IF nullif(pg_catalog.btrim(p_request_hash), '') IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'error', pg_catalog.jsonb_build_object('code', 'request_hash_required', 'message', 'The server-issued requestHash is required for apply')
    );
  END IF;
  v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
      'actorUserId', v_actor,
      'contractVersion', 'task-v1',
      'source', 'local-api',
      'action', 'done_for_now',
      'taskId', p_task_id,
      'normalizedPayload', pg_catalog.jsonb_build_object(
        'nextDueDate', p_next_due_date
      ),
      'previewVersion', p_preview_version,
      'workspaceId', p_workspace_id
    )), 'UTF8'
  ), 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_request_id, 0));
  SELECT * INTO v_existing FROM public.canonical_operations AS operation
  WHERE operation.user_id = v_actor AND operation.operation_id = p_request_id;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'requestId was already used with a different payload'));
    END IF;
    IF v_hash IS DISTINCT FROM p_request_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'request_hash_mismatch', 'message', 'The requestHash does not match the approved operation'));
    END IF;
    IF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', true, 'result', 'committed', 'requestHash', v_hash,
        'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object(
          'status', 'replayed', 'replayed', true
        )
      );
    END IF;
  END IF;
  IF v_hash IS DISTINCT FROM p_request_hash THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'request_hash_mismatch', 'message', 'The requestHash does not match the approved operation'));
  END IF;
  SELECT COALESCE(pg_catalog.max(change_log.change_sequence), 0)
  INTO v_change_floor
  FROM public.canonical_change_log AS change_log;
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', p_request_id, true);
  v_result := public.flowstate_done_for_now_h3_base(
    p_task_id, false, p_next_due_date, p_request_id, p_preview_version, p_workspace_id
  );
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true);
  IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_result; END IF;

  PERFORM public.flowstate_h3_link_task_changes(
    ARRAY[
      p_task_id,
      COALESCE(
        v_result #>> '{readBack,completedOccurrence,id}',
        v_result #>> '{completedOccurrence,id}'
      )
    ],
    p_request_id,
    v_change_floor
  );
  v_affected := public.flowstate_h3_task_affected(
    ARRAY[
      p_task_id,
      COALESCE(
        v_result #>> '{readBack,completedOccurrence,id}',
        v_result #>> '{completedOccurrence,id}'
      )
    ],
    ARRAY['update', 'create']
  );
  v_context := pg_catalog.jsonb_build_object(
    'taskId', p_task_id, 'workspaceId', p_workspace_id,
    'nextDueDate', p_next_due_date, 'previewVersion', p_preview_version
  );
  INSERT INTO public.canonical_operations (
    user_id, operation_id, contract_version, source, scope_kind, scope_id,
    workspace_id, entity_type, action, entity_id, request_hash, state,
    canonical_revision, change_sequence, operation_context, affected_entities,
    committed_at
  ) VALUES (
    v_actor, p_request_id, 'task-v1', 'local-api',
    CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END,
    COALESCE(p_workspace_id::text, v_actor::text), p_workspace_id,
    'task', 'done_for_now', p_task_id, v_hash, 'committed',
    (v_affected #>> '{0,canonicalRevision}')::bigint,
    (v_affected #>> '{0,changeSequence}')::bigint,
    v_context, v_affected, pg_catalog.clock_timestamp()
  );
  v_receipt := public.flowstate_h3_finalize_receipt(v_actor, p_request_id, v_result, v_context, v_affected);
  RETURN v_result || pg_catalog.jsonb_build_object(
    'result', 'committed', 'requestHash', v_hash, 'receipt', v_receipt
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_merge_tasks(
  p_survivor_task_id text,
  p_duplicate_task_id text,
  p_preview boolean DEFAULT true,
  p_request_id text DEFAULT NULL,
  p_preview_version text DEFAULT NULL,
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
  v_result jsonb;
  v_existing public.canonical_operations%ROWTYPE;
  v_hash text;
  v_prior_operation_id text := pg_catalog.current_setting('flowstate.canonical.operation_id', true);
  v_affected jsonb;
  v_receipt jsonb;
  v_context jsonb;
  v_nested_recurrence boolean := pg_catalog.current_setting('flowstate.h3.recurrence_wrapper', true) = 'on';
  v_change_floor bigint;
BEGIN
  IF p_request_id IS NOT NULL
     AND p_request_id IS DISTINCT FROM pg_catalog.btrim(p_request_id) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request',
        'message', 'requestId must not contain leading or trailing whitespace'
      )
    );
  END IF;
  IF v_nested_recurrence THEN
    RETURN public.flowstate_merge_tasks_h3_base(
      p_survivor_task_id, p_duplicate_task_id, p_preview,
      p_request_id, p_preview_version, p_workspace_id
    );
  END IF;
  IF p_preview THEN
    v_result := public.flowstate_merge_tasks_h3_base(
      p_survivor_task_id, p_duplicate_task_id, true, NULL, NULL, p_workspace_id
    );
    IF v_result->>'ok' = 'true' THEN
      v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
        public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
          'actorUserId', v_actor,
          'contractVersion', 'task-v1',
          'source', 'local-api',
          'action', 'merge',
          'survivorTaskId', p_survivor_task_id,
          'duplicateTaskId', p_duplicate_task_id,
          'normalizedPayload', '{}'::jsonb,
          'previewVersion', v_result->>'previewVersion',
          'workspaceId', p_workspace_id
        )), 'UTF8'
      ), 'sha256'), 'hex');
      RETURN v_result || pg_catalog.jsonb_build_object(
        'result', 'preview', 'preview', true,
        'contractVersion', 'task-v1',
        'operationId', p_request_id,
        'survivorTaskId', p_survivor_task_id,
        'duplicateTaskId', p_duplicate_task_id,
        'requestHash', v_hash
      );
    END IF;
    RETURN v_result;
  END IF;
  IF nullif(pg_catalog.btrim(p_request_hash), '') IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'request_hash_required', 'message', 'The server-issued requestHash is required for apply'));
  END IF;
  v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
      'actorUserId', v_actor,
      'contractVersion', 'task-v1',
      'source', 'local-api',
      'action', 'merge',
      'survivorTaskId', p_survivor_task_id,
      'duplicateTaskId', p_duplicate_task_id,
      'normalizedPayload', '{}'::jsonb,
      'previewVersion', p_preview_version,
      'workspaceId', p_workspace_id
    )), 'UTF8'
  ), 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_request_id, 0));
  SELECT * INTO v_existing FROM public.canonical_operations AS operation
  WHERE operation.user_id = v_actor AND operation.operation_id = p_request_id;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'requestId was already used with a different payload'));
    END IF;
    IF v_hash IS DISTINCT FROM p_request_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'request_hash_mismatch', 'message', 'The requestHash does not match the approved operation'));
    END IF;
    IF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', true, 'result', 'committed', 'requestHash', v_hash,
        'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object(
          'status', 'replayed', 'replayed', true
        )
      );
    END IF;
  END IF;
  IF v_hash IS DISTINCT FROM p_request_hash THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'request_hash_mismatch', 'message', 'The requestHash does not match the approved operation'));
  END IF;
  SELECT COALESCE(pg_catalog.max(change_log.change_sequence), 0)
  INTO v_change_floor
  FROM public.canonical_change_log AS change_log;
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', p_request_id, true);
  v_result := public.flowstate_merge_tasks_h3_base(
    p_survivor_task_id, p_duplicate_task_id, false,
    p_request_id, p_preview_version, p_workspace_id
  );
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true);
  IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_result; END IF;

  PERFORM public.flowstate_h3_link_task_changes(
    ARRAY[p_survivor_task_id, p_duplicate_task_id],
    p_request_id,
    v_change_floor
  );
  v_affected := public.flowstate_h3_task_affected(
    ARRAY[p_survivor_task_id, p_duplicate_task_id],
    ARRAY['update', 'archive']
  );
  v_context := pg_catalog.jsonb_build_object(
    'survivorTaskId', p_survivor_task_id,
    'duplicateTaskId', p_duplicate_task_id,
    'workspaceId', p_workspace_id, 'previewVersion', p_preview_version
  );
  INSERT INTO public.canonical_operations (
    user_id, operation_id, contract_version, source, scope_kind, scope_id,
    workspace_id, entity_type, action, entity_id, request_hash, state,
    canonical_revision, change_sequence, operation_context, affected_entities,
    committed_at
  ) VALUES (
    v_actor, p_request_id, 'task-v1', 'local-api',
    CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END,
    COALESCE(p_workspace_id::text, v_actor::text), p_workspace_id,
    'task', 'merge', p_survivor_task_id, v_hash, 'committed',
    (v_affected #>> '{0,canonicalRevision}')::bigint,
    (v_affected #>> '{0,changeSequence}')::bigint,
    v_context, v_affected, pg_catalog.clock_timestamp()
  );
  v_receipt := public.flowstate_h3_finalize_receipt(v_actor, p_request_id, v_result, v_context, v_affected);
  RETURN v_result || pg_catalog.jsonb_build_object('result', 'committed', 'requestHash', v_hash, 'receipt', v_receipt);
END;
$$;

CREATE OR REPLACE FUNCTION public.flowstate_merge_tasks_with_recurrence(
  p_survivor_task_id text,
  p_duplicate_task_id text,
  p_recurrence_resolution jsonb,
  p_preview boolean DEFAULT true,
  p_request_id text DEFAULT NULL,
  p_preview_version text DEFAULT NULL,
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
  v_result jsonb;
  v_existing public.canonical_operations%ROWTYPE;
  v_hash text;
  v_prior_operation_id text := pg_catalog.current_setting('flowstate.canonical.operation_id', true);
  v_prior_wrapper text := pg_catalog.current_setting('flowstate.h3.recurrence_wrapper', true);
  v_affected jsonb;
  v_receipt jsonb;
  v_context jsonb;
  v_change_floor bigint;
BEGIN
  IF p_request_id IS NOT NULL
     AND p_request_id IS DISTINCT FROM pg_catalog.btrim(p_request_id) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request',
        'message', 'requestId must not contain leading or trailing whitespace'
      )
    );
  END IF;
  IF p_preview THEN
    PERFORM pg_catalog.set_config('flowstate.h3.recurrence_wrapper', 'on', true);
    v_result := public.flowstate_merge_tasks_with_recurrence_h3_base(
      p_survivor_task_id, p_duplicate_task_id, p_recurrence_resolution,
      true, NULL, NULL, p_workspace_id
    );
    PERFORM pg_catalog.set_config(
      'flowstate.h3.recurrence_wrapper', COALESCE(v_prior_wrapper, ''), true
    );
    IF v_result->>'ok' = 'true' THEN
      v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
        public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
          'actorUserId', v_actor,
          'contractVersion', 'task-v1',
          'source', 'local-api',
          'action', 'merge',
          'survivorTaskId', p_survivor_task_id,
          'duplicateTaskId', p_duplicate_task_id,
          'normalizedPayload', pg_catalog.jsonb_build_object(
            'recurrenceResolution', p_recurrence_resolution
          ),
          'previewVersion', v_result->>'previewVersion',
          'workspaceId', p_workspace_id
        )), 'UTF8'
      ), 'sha256'), 'hex');
      RETURN v_result || pg_catalog.jsonb_build_object(
        'result', 'preview', 'preview', true,
        'contractVersion', 'task-v1',
        'operationId', p_request_id,
        'survivorTaskId', p_survivor_task_id,
        'duplicateTaskId', p_duplicate_task_id,
        'requestHash', v_hash
      );
    END IF;
    RETURN v_result;
  END IF;
  IF nullif(pg_catalog.btrim(p_request_hash), '') IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'request_hash_required', 'message', 'The server-issued requestHash is required for apply'));
  END IF;
  v_hash := pg_catalog.encode(extensions.digest(pg_catalog.convert_to(
    public.flowstate_canonical_json_text_v1(pg_catalog.jsonb_build_object(
      'actorUserId', v_actor,
      'contractVersion', 'task-v1',
      'source', 'local-api',
      'action', 'merge',
      'survivorTaskId', p_survivor_task_id,
      'duplicateTaskId', p_duplicate_task_id,
      'normalizedPayload', pg_catalog.jsonb_build_object(
        'recurrenceResolution', p_recurrence_resolution
      ),
      'previewVersion', p_preview_version,
      'workspaceId', p_workspace_id
    )), 'UTF8'
  ), 'sha256'), 'hex');
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text || ':' || p_request_id, 0));
  SELECT * INTO v_existing FROM public.canonical_operations AS operation
  WHERE operation.user_id = v_actor AND operation.operation_id = p_request_id;
  IF FOUND THEN
    IF v_existing.request_hash IS DISTINCT FROM v_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'requestId was already used with a different payload'));
    END IF;
    IF v_hash IS DISTINCT FROM p_request_hash THEN
      RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'request_hash_mismatch', 'message', 'The requestHash does not match the approved operation'));
    END IF;
    IF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', true, 'result', 'committed', 'requestHash', v_hash,
        'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object(
          'status', 'replayed', 'replayed', true
        )
      );
    END IF;
  END IF;
  IF v_hash IS DISTINCT FROM p_request_hash THEN
    RETURN pg_catalog.jsonb_build_object('ok', false, 'error', pg_catalog.jsonb_build_object('code', 'request_hash_mismatch', 'message', 'The requestHash does not match the approved operation'));
  END IF;
  SELECT COALESCE(pg_catalog.max(change_log.change_sequence), 0)
  INTO v_change_floor
  FROM public.canonical_change_log AS change_log;
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', p_request_id, true);
  PERFORM pg_catalog.set_config('flowstate.h3.recurrence_wrapper', 'on', true);
  v_result := public.flowstate_merge_tasks_with_recurrence_h3_base(
    p_survivor_task_id, p_duplicate_task_id, p_recurrence_resolution,
    false, p_request_id, p_preview_version, p_workspace_id
  );
  PERFORM pg_catalog.set_config('flowstate.h3.recurrence_wrapper', COALESCE(v_prior_wrapper, ''), true);
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true);
  IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RETURN v_result; END IF;

  PERFORM public.flowstate_h3_link_task_changes(
    ARRAY[p_survivor_task_id, p_duplicate_task_id],
    p_request_id,
    v_change_floor
  );
  v_affected := public.flowstate_h3_task_affected(
    ARRAY[p_survivor_task_id, p_duplicate_task_id],
    ARRAY['update', 'archive']
  );
  v_context := pg_catalog.jsonb_build_object(
    'survivorTaskId', p_survivor_task_id,
    'duplicateTaskId', p_duplicate_task_id,
    'recurrenceResolution', p_recurrence_resolution,
    'workspaceId', p_workspace_id, 'previewVersion', p_preview_version
  );
  INSERT INTO public.canonical_operations (
    user_id, operation_id, contract_version, source, scope_kind, scope_id,
    workspace_id, entity_type, action, entity_id, request_hash, state,
    canonical_revision, change_sequence, operation_context, affected_entities,
    committed_at
  ) VALUES (
    v_actor, p_request_id, 'task-v1', 'local-api',
    CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END,
    COALESCE(p_workspace_id::text, v_actor::text), p_workspace_id,
    'task', 'merge', p_survivor_task_id, v_hash, 'committed',
    (v_affected #>> '{0,canonicalRevision}')::bigint,
    (v_affected #>> '{0,changeSequence}')::bigint,
    v_context, v_affected, pg_catalog.clock_timestamp()
  );
  v_receipt := public.flowstate_h3_finalize_receipt(v_actor, p_request_id, v_result, v_context, v_affected);
  RETURN v_result || pg_catalog.jsonb_build_object('result', 'committed', 'requestHash', v_hash, 'receipt', v_receipt);
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_patch_task_v1(
  text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flowstate_complete_task_v1(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flowstate_done_for_now(
  text, boolean, date, text, text, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flowstate_merge_tasks(
  text, text, boolean, text, text, uuid, text
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flowstate_merge_tasks_with_recurrence(
  text, text, jsonb, boolean, text, text, uuid, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.flowstate_patch_task_v1(
  text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flowstate_complete_task_v1(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flowstate_done_for_now(
  text, boolean, date, text, text, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flowstate_merge_tasks(
  text, text, boolean, text, text, uuid, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flowstate_merge_tasks_with_recurrence(
  text, text, jsonb, boolean, text, text, uuid, text
) TO authenticated;

COMMENT ON COLUMN public.canonical_operations.operation_context IS
  'Normalized operation inputs bound by request_hash; contains no credentials.';
COMMENT ON COLUMN public.canonical_operations.affected_entities IS
  'Exact task revision, change-sequence, and read-back evidence for every affected task row.';

NOTIFY pgrst, 'reload schema';
