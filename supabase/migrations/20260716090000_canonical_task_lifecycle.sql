-- Canonical signed-user task lifecycle commands for assistant and renderer writers.
-- The caller supplies the task id for create so retries cannot allocate duplicates.

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
  p_workspace_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_task_id public.tasks.id%TYPE;
  v_task public.tasks%ROWTYPE;
  v_updated public.tasks%ROWTYPE;
  v_project_id public.projects.id%TYPE;
  v_due_date date;
  v_existing public.canonical_operations%ROWTYPE;
  v_issued_preview public.canonical_operation_previews%ROWTYPE;
  v_normalized jsonb;
  v_request_hash text;
  v_expected_preview_digest text;
  v_preview_expiry timestamptz;
  v_scope_kind text;
  v_scope_id text;
  v_change_sequence bigint;
  v_read_back jsonb;
  v_read_back_hash text;
  v_receipt jsonb;
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

  IF p_contract_version IS DISTINCT FROM 'task-lifecycle-v1'
     OR nullif(pg_catalog.btrim(p_operation_id), '') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id) > 160
     OR p_source IS DISTINCT FROM 'local-api'
     OR p_action IS NULL
     OR NOT (p_action IN ('create', 'soft_delete', 'restore', 'set_status'))
     OR nullif(pg_catalog.btrim(p_task_id), '') IS NULL
     OR p_task_id IS DISTINCT FROM pg_catalog.btrim(p_task_id)
     OR p_base_revision IS NULL
     OR p_payload IS NULL
     OR pg_catalog.jsonb_typeof(p_payload) <> 'object'
     OR p_preview IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'The lifecycle request is invalid'
      )
    );
  END IF;

  BEGIN
    SELECT decoded.id INTO STRICT v_task_id
    FROM pg_catalog.jsonb_populate_record(
      NULL::public.tasks,
      pg_catalog.jsonb_build_object('id', p_task_id)
    ) AS decoded;
  EXCEPTION WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_task_id', 'message', 'taskId is invalid'
      )
    );
  END;

  IF p_action = 'create' THEN
    IF p_base_revision <> 0
       OR NOT (p_payload ? 'title')
       OR EXISTS (
         SELECT 1 FROM pg_catalog.jsonb_object_keys(p_payload) AS item(key)
         WHERE item.key NOT IN (
           'title', 'status', 'description', 'priority', 'dueDate', 'projectId'
         )
       )
       OR pg_catalog.jsonb_typeof(p_payload->'title') <> 'string'
       OR nullif(pg_catalog.btrim(p_payload->>'title'), '') IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_payload->>'title')) > 500
       OR (
         p_payload ? 'description'
         AND pg_catalog.jsonb_typeof(p_payload->'description') <> 'string'
       )
       OR pg_catalog.char_length(COALESCE(p_payload->>'description', '')) > 10000
       OR (
         p_payload ? 'priority'
         AND pg_catalog.jsonb_typeof(p_payload->'priority') NOT IN ('string', 'null')
       )
       OR (
         p_payload->>'priority' IS NOT NULL
         AND p_payload->>'priority' NOT IN ('low', 'medium', 'high')
       )
       OR (
         p_payload ? 'dueDate'
         AND pg_catalog.jsonb_typeof(p_payload->'dueDate') NOT IN ('string', 'null')
       )
       OR (
         p_payload ? 'projectId'
         AND pg_catalog.jsonb_typeof(p_payload->'projectId') NOT IN ('string', 'null')
       )
       OR (
         p_payload ? 'status'
         AND (
           pg_catalog.jsonb_typeof(p_payload->'status') <> 'string'
           OR p_payload->>'status' NOT IN ('planned', 'in_progress', 'backlog', 'on_hold')
         )
       ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_create', 'message', 'Create requires a title, revision zero, and an open status'
        )
      );
    END IF;

    IF p_payload->>'dueDate' IS NOT NULL THEN
      BEGIN
        IF p_payload->>'dueDate' !~ '^\d{4}-\d{2}-\d{2}$' THEN
          RAISE EXCEPTION 'invalid due date';
        END IF;
        v_due_date := pg_catalog.to_date(p_payload->>'dueDate', 'YYYY-MM-DD');
        IF pg_catalog.to_char(v_due_date, 'YYYY-MM-DD') IS DISTINCT FROM p_payload->>'dueDate' THEN
          RAISE EXCEPTION 'invalid due date';
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object(
            'code', 'invalid_create', 'message', 'Create dueDate must be an ISO date or null'
          )
        );
      END;
    END IF;

    IF p_payload->>'projectId' IS NOT NULL THEN
      BEGIN
        SELECT decoded.id INTO STRICT v_project_id
        FROM pg_catalog.jsonb_populate_record(
          NULL::public.projects,
          pg_catalog.jsonb_build_object('id', p_payload->>'projectId')
        ) AS decoded;
      EXCEPTION WHEN OTHERS THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'rejected',
          'error', pg_catalog.jsonb_build_object(
            'code', 'invalid_create', 'message', 'Create projectId is invalid'
          )
        );
      END;
    END IF;

    v_normalized := pg_catalog.jsonb_build_object(
      'title', pg_catalog.btrim(p_payload->>'title'),
      'status', COALESCE(p_payload->>'status', 'planned'),
      'description', COALESCE(p_payload->>'description', ''),
      'priority', p_payload->>'priority',
      'dueDate', CASE WHEN v_due_date IS NULL THEN NULL ELSE pg_catalog.to_char(v_due_date, 'YYYY-MM-DD') END,
      'projectId', CASE WHEN v_project_id IS NULL THEN NULL ELSE v_project_id::text END
    );
  ELSIF p_action = 'set_status' THEN
    IF p_base_revision < 1
       OR NOT (p_payload ? 'status')
       OR p_payload <> pg_catalog.jsonb_build_object('status', p_payload->'status')
       OR pg_catalog.jsonb_typeof(p_payload->'status') <> 'string'
       OR p_payload->>'status' NOT IN ('planned', 'in_progress', 'done', 'backlog', 'on_hold') THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_status', 'message', 'set_status requires one supported status'
        )
      );
    END IF;
    v_normalized := pg_catalog.jsonb_build_object('status', p_payload->>'status');
  ELSE
    IF p_base_revision < 1 OR p_payload <> '{}'::jsonb THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_request', 'message', 'Delete and restore do not accept payload fields'
        )
      );
    END IF;
    v_normalized := '{}'::jsonb;
  END IF;

  v_normalized := pg_catalog.jsonb_build_object(
    'contractVersion', p_contract_version,
    'source', p_source,
    'action', p_action,
    'taskId', p_task_id,
    'baseRevision', p_base_revision,
    'workspaceId', p_workspace_id,
    'payload', v_normalized
  );
  v_request_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(public.flowstate_canonical_json_text_v1(v_normalized), 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  -- A committed apply is authoritative even if the task changed again or the
  -- original preview has expired. Altered reuse of the operation id is denied.
  IF NOT p_preview THEN
    SELECT * INTO v_existing
    FROM public.canonical_operations AS operation
    WHERE operation.user_id = v_actor
      AND operation.operation_id = p_operation_id
    FOR UPDATE;
    IF FOUND THEN
      IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object(
            'code', 'idempotency_conflict', 'message', 'operationId belongs to another request'
          )
        );
      END IF;
      IF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', true, 'status', 'committed', 'result', 'committed',
          'requestHash', v_request_hash,
          'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object('replayed', true)
        );
      END IF;
    END IF;
  END IF;

  -- Serialize all lifecycle operations targeting the same stable task id.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':task-lifecycle:' || p_task_id, 0)
  );

  -- A concurrent identical apply may have committed while this transaction
  -- waited for the stable task-id lock. Replay that exact durable result before
  -- checking the now-mutated task row.
  IF NOT p_preview THEN
    SELECT * INTO v_existing
    FROM public.canonical_operations AS operation
    WHERE operation.user_id = v_actor
      AND operation.operation_id = p_operation_id;
    IF FOUND THEN
      IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object(
            'code', 'idempotency_conflict', 'message', 'operationId belongs to another request'
          )
        );
      END IF;
      IF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', true, 'status', 'committed', 'result', 'committed',
          'requestHash', v_request_hash,
          'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object('replayed', true)
        );
      END IF;
    END IF;
  END IF;

  IF p_action = 'create' THEN
    IF p_workspace_id IS NOT NULL
       AND NOT public.flowstate_can_write_workspace_v1(p_workspace_id) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object('code', 'not_found', 'message', 'Task scope was not found')
      );
    END IF;
    IF EXISTS (SELECT 1 FROM public.tasks AS task WHERE task.id = v_task_id)
       OR EXISTS (
         SELECT 1 FROM public.tombstones AS tombstone
         WHERE tombstone.entity_type = 'task'
           AND tombstone.entity_id = p_task_id
       ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'task_id_unavailable', 'message', 'taskId is unavailable')
      );
    END IF;
    IF v_project_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.projects AS project
      WHERE project.id = v_project_id
        AND project.is_deleted = false
        AND (
          (
            p_workspace_id IS NULL
            AND project.workspace_id IS NULL
            AND project.user_id = v_actor
          )
          OR (
            p_workspace_id IS NOT NULL
            AND project.workspace_id = p_workspace_id
            AND public.flowstate_can_write_workspace_v1(p_workspace_id)
          )
        )
    ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'project_not_found', 'message', 'Project is outside the signed-in task scope'
        )
      );
    END IF;
    v_scope_kind := CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
    v_scope_id := COALESCE(p_workspace_id::text, v_actor::text);
  ELSE
    SELECT * INTO v_task
    FROM public.tasks AS task
    WHERE task.id = v_task_id
      AND (
        (p_workspace_id IS NULL AND task.workspace_id IS NULL AND task.user_id = v_actor)
        OR (
          p_workspace_id IS NOT NULL
          AND task.workspace_id = p_workspace_id
          AND public.flowstate_can_write_workspace_v1(p_workspace_id)
        )
      )
    FOR UPDATE;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object('code', 'not_found', 'message', 'Task was not found')
      );
    END IF;
    IF v_task.canonical_revision IS DISTINCT FROM p_base_revision THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'stale_revision', 'message', 'Task changed after it was read',
          'currentRevision', v_task.canonical_revision
        )
      );
    END IF;
    IF p_action = 'soft_delete' AND v_task.is_deleted THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'already_deleted', 'message', 'Task is already deleted')
      );
    ELSIF p_action = 'restore' AND (
      NOT v_task.is_deleted OR NOT EXISTS (
        SELECT 1 FROM public.tombstones AS tombstone
        WHERE tombstone.user_id = v_task.user_id
          AND tombstone.entity_type = 'task'
          AND tombstone.entity_id = v_task.id::text
      )
    ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'restore_not_available', 'message', 'Deleted task evidence is incomplete')
      );
    ELSIF p_action = 'set_status' AND v_task.is_deleted THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'task_deleted', 'message', 'Deleted tasks cannot change status')
      );
    ELSIF p_action = 'set_status' AND v_task.status = v_normalized #>> '{payload,status}' THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'no_change', 'message', 'Task already has that status')
      );
    ELSIF p_action = 'set_status'
       AND v_normalized #>> '{payload,status}' = 'done'
       AND (
         v_task.recurrence_rule IS NOT NULL
         OR v_task.recurrence_parent_id IS NOT NULL
         OR COALESCE(v_task.is_completion_record, false)
       ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'recurrence_requires_done_for_now',
          'message', 'Recurring tasks must use the recurrence-aware completion command'
        )
      );
    END IF;
    v_scope_kind := CASE WHEN v_task.workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
    v_scope_id := COALESCE(v_task.workspace_id::text, v_actor::text);
  END IF;

  IF p_preview THEN
    IF EXISTS (
      SELECT 1 FROM public.canonical_operations AS operation
      WHERE operation.user_id = v_actor AND operation.operation_id = p_operation_id
    ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId was already applied')
      );
    END IF;
    SELECT * INTO v_issued_preview
    FROM public.canonical_operation_previews AS issued
    WHERE issued.user_id = v_actor AND issued.operation_id = p_operation_id
    FOR UPDATE;
    IF FOUND THEN
      IF v_issued_preview.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId already has another preview')
        );
      END IF;
      IF v_issued_preview.consumed_at IS NOT NULL
         OR v_issued_preview.expires_at <= pg_catalog.clock_timestamp() THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object('code', 'preview_expired', 'message', 'Use a new operationId')
        );
      END IF;
      v_expected_preview_digest := v_issued_preview.preview_digest;
      v_preview_expiry := v_issued_preview.expires_at;
    ELSE
      v_expected_preview_digest := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
      v_preview_expiry := pg_catalog.clock_timestamp() + interval '15 minutes';
      INSERT INTO public.canonical_operation_previews (
        user_id, operation_id, preview_digest, request_hash, expires_at
      ) VALUES (
        v_actor, p_operation_id, v_expected_preview_digest, v_request_hash, v_preview_expiry
      );
    END IF;
    RETURN pg_catalog.jsonb_build_object(
      'ok', true, 'result', 'preview', 'contractVersion', p_contract_version,
      'operationId', p_operation_id, 'action', p_action, 'taskId', p_task_id,
      'baseRevision', p_base_revision, 'requestHash', v_request_hash,
      'previewDigest', v_expected_preview_digest,
      'previewExpiresAt', v_preview_expiry,
      'normalizedPayload', v_normalized
    );
  END IF;

  SELECT * INTO v_issued_preview
  FROM public.canonical_operation_previews AS issued
  WHERE issued.user_id = v_actor
    AND issued.operation_id = p_operation_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_issued_preview.request_hash IS DISTINCT FROM v_request_hash
     OR v_issued_preview.preview_digest IS DISTINCT FROM p_preview_digest
     OR v_issued_preview.expires_at IS DISTINCT FROM p_preview_expires_at THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'Approval does not match the request')
    );
  END IF;
  IF v_issued_preview.expires_at <= pg_catalog.clock_timestamp() THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'preview_expired', 'message', 'Approval expired')
    );
  END IF;
  IF v_issued_preview.consumed_at IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'Approval was already consumed')
    );
  END IF;

  INSERT INTO public.canonical_operations (
    user_id, operation_id, contract_version, source, scope_kind, scope_id,
    workspace_id, entity_type, action, entity_id, request_hash, state
  ) VALUES (
    v_actor, p_operation_id, p_contract_version, p_source, v_scope_kind, v_scope_id,
    p_workspace_id, 'task', p_action, p_task_id, v_request_hash, 'applying'
  )
  ON CONFLICT (user_id, operation_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId is already applying')
    );
  END IF;

  UPDATE public.canonical_operation_previews AS issued
  SET consumed_at = pg_catalog.clock_timestamp(), updated_at = pg_catalog.clock_timestamp()
  WHERE issued.id = v_issued_preview.id;

  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', p_operation_id, true);
  IF p_action = 'create' THEN
    INSERT INTO public.tasks (
      id, user_id, project_id, title, description, status, priority, due_date,
      is_deleted, instances, subtasks,
      is_in_inbox, workspace_id, created_at, updated_at
    ) VALUES (
      v_task_id, v_actor, v_project_id, v_normalized #>> '{payload,title}',
      v_normalized #>> '{payload,description}', v_normalized #>> '{payload,status}',
      v_normalized #>> '{payload,priority}',
      CASE WHEN v_due_date IS NULL THEN NULL ELSE (v_due_date::text || 'T00:00:00Z')::timestamptz END,
      false, '[]'::jsonb, '[]'::jsonb,
      true, p_workspace_id, pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
    ) RETURNING * INTO STRICT v_updated;
  ELSIF p_action = 'soft_delete' THEN
    UPDATE public.tasks AS task
    SET is_deleted = true, deleted_at = pg_catalog.clock_timestamp(),
        updated_at = pg_catalog.clock_timestamp()
    WHERE task.id = v_task.id RETURNING * INTO STRICT v_updated;
  ELSIF p_action = 'restore' THEN
    UPDATE public.tasks AS task
    SET is_deleted = false, deleted_at = NULL,
        updated_at = pg_catalog.clock_timestamp()
    WHERE task.id = v_task.id RETURNING * INTO STRICT v_updated;
  ELSE
    UPDATE public.tasks AS task
    SET status = v_normalized #>> '{payload,status}',
        updated_at = pg_catalog.clock_timestamp()
    WHERE task.id = v_task.id RETURNING * INTO STRICT v_updated;
  END IF;
  PERFORM pg_catalog.set_config(
    'flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true
  );

  SELECT change.change_sequence INTO STRICT v_change_sequence
  FROM public.canonical_change_log AS change
  WHERE change.actor_user_id = v_actor
    AND change.operation_id = p_operation_id
    AND change.entity_type = 'task'
    AND change.entity_id = v_updated.id::text
  ORDER BY change.change_sequence DESC LIMIT 1;

  v_read_back := pg_catalog.jsonb_build_object(
    'id', v_updated.id, 'title', v_updated.title, 'status', v_updated.status,
    'description', COALESCE(v_updated.description, ''),
    'priority', v_updated.priority,
    'dueDate', CASE
      WHEN v_updated.due_date IS NULL THEN NULL
      ELSE pg_catalog.to_char(v_updated.due_date AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    END,
    'projectId', v_updated.project_id,
    'isDeleted', v_updated.is_deleted, 'deletedAt', v_updated.deleted_at,
    'tombstone', EXISTS (
      SELECT 1 FROM public.tombstones AS tombstone
      WHERE tombstone.user_id = v_updated.user_id
        AND tombstone.entity_type = 'task'
        AND tombstone.entity_id = v_updated.id::text
    ),
    'workspaceId', v_updated.workspace_id,
    'canonicalRevision', v_updated.canonical_revision,
    'canonicalUpdatedAt', v_updated.updated_at
  );
  v_read_back_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(public.flowstate_canonical_json_text_v1(v_read_back), 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  v_receipt := pg_catalog.jsonb_build_object(
    'contractVersion', p_contract_version, 'operationId', p_operation_id,
    'source', p_source, 'status', 'committed', 'requestHash', v_request_hash,
    'entityType', 'task', 'action', p_action, 'entityId', v_updated.id,
    'canonicalRevision', v_updated.canonical_revision,
    'canonicalUpdatedAt', v_updated.updated_at,
    'changeSequence', v_change_sequence, 'replayed', false,
    'committedAt', pg_catalog.clock_timestamp(),
    'readBack', v_read_back, 'readBackHash', v_read_back_hash
  );
  UPDATE public.canonical_operations AS operation
  SET state = 'committed', canonical_revision = v_updated.canonical_revision,
      change_sequence = v_change_sequence, canonical_result = v_receipt,
      committed_at = (v_receipt->>'committedAt')::timestamptz,
      updated_at = pg_catalog.clock_timestamp()
  WHERE operation.user_id = v_actor AND operation.operation_id = p_operation_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'status', 'committed', 'result', 'committed',
    'requestHash', v_request_hash, 'receipt', v_receipt
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_task_lifecycle_v1(
  text, text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_task_lifecycle_v1(
  text, text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid
) TO authenticated;

COMMENT ON FUNCTION public.flowstate_task_lifecycle_v1(
  text, text, text, text, text, bigint, jsonb, boolean, text, timestamptz, uuid
) IS
  'Preview/apply signed-user task create, soft-delete, restore, and status transitions with CAS and canonical receipts.';
