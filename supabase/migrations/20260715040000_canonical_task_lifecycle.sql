-- TASK-1962: signed-user canonical create/delete/restore/reopen lifecycle.
--
-- This command family builds on the H3 operation, change, and receipt helpers.
-- Preview is always non-mutating. Apply is bound to the exact server-issued
-- request hash and approval receipt, and every successful retry replays the
-- original durable canonical receipt.

CREATE OR REPLACE FUNCTION public.flowstate_h4_task_read_back(p_task_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'id', task.id,
    'title', task.title,
    'description', COALESCE(task.description, ''),
    'status', CASE WHEN task.status = 'done' THEN 'done' ELSE 'todo' END,
    'completedAt', task.completed_at,
    'priority', task.priority,
    'dueDate', task.due_date,
    'projectId', task.project_id,
    'progress', task.progress,
    'isInInbox', task.is_in_inbox,
    'isDeleted', task.is_deleted,
    'deletedAt', task.deleted_at,
    'tombstonePresent', EXISTS (
      SELECT 1
      FROM public.tombstones AS tombstone
      WHERE tombstone.user_id = task.user_id
        AND tombstone.entity_type = 'task'
        AND tombstone.entity_id = task.id::text
    ),
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

CREATE OR REPLACE FUNCTION public.flowstate_h4_task_affected(
  p_task_id text,
  p_action text
)
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
      'action', p_action,
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
    SELECT public.flowstate_h4_task_read_back(task.id::text) AS value
  ) AS read_back
  WHERE task.id::text = p_task_id
$$;

CREATE OR REPLACE FUNCTION public.flowstate_task_lifecycle_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_action text,
  p_task_id text,
  p_base_revision bigint,
  p_payload jsonb DEFAULT '{}'::jsonb,
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
  v_task_ref public.tasks.id%TYPE;
  v_project_ref public.projects.id%TYPE;
  v_existing public.canonical_operations%ROWTYPE;
  v_issued_preview public.canonical_operation_previews%ROWTYPE;
  v_normalized jsonb := '{}'::jsonb;
  v_unknown_keys text[];
  v_task_id text;
  v_deterministic_hex text;
  v_request_hash text;
  v_preview_digest text;
  v_preview_expires_at timestamptz;
  v_scope_kind text;
  v_scope_id text;
  v_read_back jsonb;
  v_affected jsonb;
  v_receipt jsonb;
  v_prior_operation_id text := pg_catalog.current_setting(
    'flowstate.canonical.operation_id', true
  );
  v_before_sequence bigint;
  v_affected_action text;
  v_now timestamptz;
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
     OR nullif(pg_catalog.btrim(p_operation_id), '') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id) > 160
     OR p_source IS NULL
     OR p_source !~ '^[a-z0-9][a-z0-9._:-]{0,63}$'
     OR p_action NOT IN ('create', 'delete', 'restore', 'reopen')
     OR p_preview IS NULL
     OR p_payload IS NULL
     OR pg_catalog.jsonb_typeof(p_payload) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'The canonical lifecycle request is invalid'
      )
    );
  END IF;

  IF p_action = 'create' THEN
    SELECT pg_catalog.array_agg(key ORDER BY key)
      INTO v_unknown_keys
    FROM pg_catalog.jsonb_object_keys(p_payload) AS payload_key(key)
    WHERE key NOT IN (
      'title', 'description', 'priority', 'dueDate', 'projectId', 'status', 'isInInbox'
    );
    IF v_unknown_keys IS NOT NULL
       OR pg_catalog.jsonb_typeof(p_payload->'title') <> 'string'
       OR nullif(pg_catalog.btrim(p_payload->>'title'), '') IS NULL
       OR (p_payload ? 'status' AND p_payload->>'status' <> 'planned')
       OR (p_payload ? 'description' AND pg_catalog.jsonb_typeof(p_payload->'description') NOT IN ('string', 'null'))
       OR (p_payload ? 'priority' AND NOT (
         pg_catalog.jsonb_typeof(p_payload->'priority') = 'null'
         OR (
           pg_catalog.jsonb_typeof(p_payload->'priority') = 'string'
           AND p_payload->>'priority' IN ('low', 'medium', 'high')
         )
       ))
       OR (p_payload ? 'dueDate' AND pg_catalog.jsonb_typeof(p_payload->'dueDate') NOT IN ('string', 'null'))
       OR (p_payload ? 'projectId' AND pg_catalog.jsonb_typeof(p_payload->'projectId') NOT IN ('string', 'null'))
       OR (p_payload ? 'isInInbox' AND pg_catalog.jsonb_typeof(p_payload->'isInInbox') <> 'boolean')
       OR p_base_revision NOT IN (0) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_request', 'message', 'The canonical create payload is invalid'
        )
      );
    END IF;

    IF p_payload ? 'dueDate' AND pg_catalog.jsonb_typeof(p_payload->'dueDate') = 'string' THEN
      BEGIN
        PERFORM (p_payload->>'dueDate')::timestamptz;
      EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object(
            'code', 'invalid_due_date', 'message', 'dueDate must be an ISO date or timestamp'
          )
        );
      END;
    END IF;

    v_deterministic_hex := pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(v_actor::text || ':' || p_operation_id, 'UTF8'),
        'sha256'
      ),
      'hex'
    );
    v_task_id := (
      pg_catalog.substr(v_deterministic_hex, 1, 8) || '-'
      || pg_catalog.substr(v_deterministic_hex, 9, 4) || '-4'
      || pg_catalog.substr(v_deterministic_hex, 14, 3) || '-8'
      || pg_catalog.substr(v_deterministic_hex, 18, 3) || '-'
      || pg_catalog.substr(v_deterministic_hex, 21, 12)
    );
    IF p_task_id IS NOT NULL AND p_task_id IS DISTINCT FROM v_task_id THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'idempotency_conflict',
          'message', 'The create task identity does not match this operation'
        )
      );
    END IF;
    v_task_ref := v_task_id;
    v_normalized := pg_catalog.jsonb_build_object(
      'title', pg_catalog.btrim(p_payload->>'title'),
      'description', CASE
        WHEN pg_catalog.jsonb_typeof(p_payload->'description') = 'string'
          THEN p_payload->>'description'
        ELSE ''
      END,
      'priority', CASE
        WHEN pg_catalog.jsonb_typeof(p_payload->'priority') = 'string'
          THEN p_payload->>'priority'
        ELSE NULL
      END,
      'dueDate', CASE
        WHEN pg_catalog.jsonb_typeof(p_payload->'dueDate') = 'string'
          THEN p_payload->>'dueDate'
        ELSE NULL
      END,
      'projectId', CASE
        WHEN pg_catalog.jsonb_typeof(p_payload->'projectId') = 'string'
          THEN p_payload->>'projectId'
        ELSE NULL
      END,
      'status', 'planned',
      'isInInbox', COALESCE((p_payload->>'isInInbox')::boolean, true)
    );
  ELSE
    IF nullif(pg_catalog.btrim(p_task_id), '') IS NULL
       OR p_base_revision IS NULL
       OR p_base_revision < 1
       OR p_payload <> '{}'::jsonb THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_request', 'message', 'The canonical lifecycle request is invalid'
        )
      );
    END IF;
    v_task_id := p_task_id;
  END IF;

  IF p_workspace_id IS NOT NULL
     AND NOT public.flowstate_can_write_workspace_v1(p_workspace_id) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'scope_denied', 'message', 'Workspace write access is required'
      )
    );
  END IF;

  IF p_action = 'create' AND v_normalized->>'projectId' IS NOT NULL THEN
    SELECT project.id INTO v_project_ref
    FROM public.projects AS project
    WHERE project.id::text = v_normalized->>'projectId'
      AND project.is_deleted = false
      AND project.workspace_id IS NOT DISTINCT FROM p_workspace_id
      AND (
        (project.workspace_id IS NULL AND project.user_id = v_actor)
        OR (
          project.workspace_id IS NOT NULL
          AND public.flowstate_can_write_workspace_v1(project.workspace_id)
        )
      );
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'project_not_found', 'message', 'Project was not found'
        )
      );
    END IF;
  END IF;

  v_request_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        public.flowstate_canonical_json_text_v1(
          pg_catalog.jsonb_build_object(
            'actorUserId', v_actor,
            'contractVersion', p_contract_version,
            'source', p_source,
            'action', p_action,
            'taskId', v_task_id,
            'baseRevision', COALESCE(p_base_revision, 0),
            'payload', v_normalized,
            'workspaceId', p_workspace_id
          )
        ),
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
        'ok', true,
        'result', 'committed',
        'operationId', p_operation_id,
        'action', p_action,
        'taskId', v_task_id,
        'requestHash', v_request_hash,
        'receipt', v_receipt
      );
    END IF;
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

  IF p_action <> 'create' THEN
    IF p_preview THEN
      SELECT * INTO v_task
      FROM public.tasks AS task
      WHERE task.id::text = v_task_id;
    ELSE
      SELECT * INTO v_task
      FROM public.tasks AS task
      WHERE task.id::text = v_task_id
      FOR UPDATE;
    END IF;
    IF NOT FOUND THEN
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
    IF v_task.workspace_id IS NULL AND v_task.user_id IS DISTINCT FROM v_actor THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'not_found', 'message', 'Task was not found'
        )
      );
    END IF;
    IF v_task.workspace_id IS NOT NULL
       AND NOT public.flowstate_can_write_workspace_v1(v_task.workspace_id) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'scope_denied', 'message', 'Workspace write access is required'
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
    IF p_action = 'delete' AND v_task.is_deleted THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'already_deleted', 'message', 'Task is already deleted'
        )
      );
    ELSIF p_action = 'restore' AND NOT v_task.is_deleted THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'already_open', 'message', 'Task is already active'
        )
      );
    ELSIF p_action = 'reopen' THEN
      IF v_task.is_deleted OR v_task.status <> 'done' THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object(
            'code', 'already_open', 'message', 'Task is not a completed active task'
          )
        );
      END IF;
      IF v_task.recurrence_rule IS NOT NULL
         OR v_task.recurrence_parent_id IS NOT NULL
         OR v_task.is_completion_record THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object(
            'code', 'recurring_task',
            'message', 'Recurring completion history requires its domain command'
          )
        );
      END IF;
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM public.tasks AS task WHERE task.id::text = v_task_id
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'task_id_conflict', 'message', 'The deterministic task identity is unavailable'
      )
    );
  END IF;

  IF p_action = 'create' THEN
    v_read_back := pg_catalog.jsonb_build_object(
      'id', v_task_id,
      'title', v_normalized->>'title',
      'description', v_normalized->>'description',
      'status', 'todo',
      'completedAt', NULL,
      'priority', v_normalized->'priority',
      'dueDate', v_normalized->'dueDate',
      'projectId', v_normalized->'projectId',
      'progress', 0,
      'isInInbox', (v_normalized->>'isInInbox')::boolean,
      'isDeleted', false,
      'deletedAt', NULL,
      'tombstonePresent', false,
      'workspaceId', p_workspace_id,
      'canonicalRevision', 0,
      'canonicalUpdatedAt', NULL,
      'recurrenceRule', NULL,
      'recurrenceParentId', NULL,
      'recurrenceCount', 0,
      'isCompletionRecord', false
    );
  ELSE
    v_read_back := public.flowstate_h4_task_read_back(v_task_id);
    IF p_action = 'delete' THEN
      v_read_back := v_read_back || pg_catalog.jsonb_build_object(
        'isDeleted', true,
        'deletedAt', pg_catalog.clock_timestamp(),
        'tombstonePresent', true
      );
    ELSIF p_action = 'restore' THEN
      v_read_back := v_read_back || pg_catalog.jsonb_build_object(
        'isDeleted', false, 'deletedAt', NULL, 'tombstonePresent', false
      );
    ELSIF p_action = 'reopen' THEN
      v_read_back := v_read_back || pg_catalog.jsonb_build_object(
        'status', 'todo', 'completedAt', NULL
      );
    END IF;
  END IF;

  IF p_preview THEN
    IF EXISTS (
      SELECT 1 FROM public.canonical_operations AS operation
      WHERE operation.user_id = v_actor
        AND operation.operation_id = p_operation_id
    ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'idempotency_conflict', 'message', 'operationId was already applied'
        )
      );
    END IF;

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
      'ok', true,
      'result', 'preview',
      'preview', true,
      'contractVersion', p_contract_version,
      'operationId', p_operation_id,
      'action', p_action,
      'taskId', v_task_id,
      'baseRevision', COALESCE(p_base_revision, 0),
      'requestHash', v_request_hash,
      'previewDigest', v_preview_digest,
      'previewExpiresAt', v_preview_expires_at,
      'normalizedPayload', v_normalized || pg_catalog.jsonb_build_object('taskId', v_task_id),
      'readBack', v_read_back
    );
  END IF;

  v_scope_kind := CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
  v_scope_id := COALESCE(p_workspace_id::text, v_actor::text);
  v_affected_action := CASE WHEN p_action = 'reopen' THEN 'update' ELSE p_action END;

  BEGIN
    INSERT INTO public.canonical_operations (
      user_id, operation_id, contract_version, source,
      scope_kind, scope_id, workspace_id,
      entity_type, action, entity_id, request_hash, state,
      operation_context
    ) VALUES (
      v_actor, p_operation_id, p_contract_version, p_source,
      v_scope_kind, v_scope_id, p_workspace_id,
      'task', p_action, v_task_id, v_request_hash, 'applying',
      pg_catalog.jsonb_build_object(
        'action', p_action,
        'taskId', v_task_id,
        'baseRevision', COALESCE(p_base_revision, 0),
        'normalizedPayload', v_normalized,
        'workspaceId', p_workspace_id
      )
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
          'operationId', p_operation_id, 'action', p_action, 'taskId', v_task_id,
          'requestHash', v_request_hash, 'receipt', v_receipt
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
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'preview_mismatch', 'message', 'The approval was already consumed'
        )
      );
    END IF;

    SELECT COALESCE(pg_catalog.max(change_sequence), 0)
      INTO v_before_sequence
    FROM public.canonical_change_log;
    PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', p_operation_id, true);
    v_now := pg_catalog.clock_timestamp();

    IF p_action = 'create' THEN
      INSERT INTO public.tasks (
        id, user_id, workspace_id, project_id, title, description,
        status, priority, due_date, progress, is_in_inbox,
        is_deleted, deleted_at, created_at, updated_at
      ) VALUES (
        v_task_ref, v_actor, p_workspace_id, v_project_ref,
        v_normalized->>'title', v_normalized->>'description',
        'planned',
        CASE WHEN pg_catalog.jsonb_typeof(v_normalized->'priority') = 'string'
          THEN v_normalized->>'priority' ELSE NULL END,
        CASE WHEN pg_catalog.jsonb_typeof(v_normalized->'dueDate') = 'string'
          THEN (v_normalized->>'dueDate')::timestamptz ELSE NULL END,
        0, (v_normalized->>'isInInbox')::boolean,
        false, NULL, v_now, v_now
      ) RETURNING * INTO STRICT v_updated;
    ELSIF p_action = 'delete' THEN
      UPDATE public.tasks AS task
      SET is_deleted = true, deleted_at = v_now, updated_at = v_now
      WHERE task.id::text = v_task_id
      RETURNING * INTO STRICT v_updated;
    ELSIF p_action = 'restore' THEN
      UPDATE public.tasks AS task
      SET is_deleted = false, deleted_at = NULL, updated_at = v_now
      WHERE task.id::text = v_task_id
      RETURNING * INTO STRICT v_updated;
    ELSE
      UPDATE public.tasks AS task
      SET status = 'planned', completed_at = NULL, updated_at = v_now
      WHERE task.id::text = v_task_id
      RETURNING * INTO STRICT v_updated;
    END IF;

    PERFORM pg_catalog.set_config(
      'flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true
    );
    PERFORM public.flowstate_h3_link_task_changes(
      ARRAY[v_task_id], p_operation_id, v_before_sequence
    );
    v_affected := public.flowstate_h4_task_affected(v_task_id, v_affected_action);
    v_receipt := public.flowstate_h3_finalize_receipt(
      v_actor,
      p_operation_id,
      pg_catalog.jsonb_build_object(
        'readBack', public.flowstate_h4_task_read_back(v_task_id)
      ),
      pg_catalog.jsonb_build_object(
        'action', p_action,
        'taskId', v_task_id,
        'baseRevision', COALESCE(p_base_revision, 0),
        'normalizedPayload', v_normalized,
        'workspaceId', p_workspace_id
      ),
      v_affected
    );
  EXCEPTION WHEN unique_violation THEN
    PERFORM pg_catalog.set_config(
      'flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true
    );
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', CASE WHEN p_action = 'restore' THEN 'restore_conflict' ELSE 'task_id_conflict' END,
        'message', CASE
          WHEN p_action = 'restore' THEN 'Task restore conflicts with an active recurrence identity'
          ELSE 'The deterministic task identity is unavailable'
        END
      )
    );
  END;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'result', 'committed',
    'operationId', p_operation_id,
    'action', p_action,
    'taskId', v_task_id,
    'requestHash', v_request_hash,
    'receipt', v_receipt || pg_catalog.jsonb_build_object(
      'status', 'committed', 'replayed', false
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_h4_task_read_back(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h4_task_affected(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_task_lifecycle_v1(
  text, text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_task_lifecycle_v1(
  text, text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid, text
) TO authenticated;

COMMENT ON FUNCTION public.flowstate_task_lifecycle_v1(
  text, text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid, text
) IS
  'Preview/apply canonical task create, soft-delete, restore, or non-recurring reopen with durable replay and H3 receipt proof.';
