-- TASK-1958: dedicated canonical completion for non-recurring tasks.
--
-- Mirrors flowstate_patch_task_v1's preview/approval/apply/receipt contract but
-- performs exactly one domain command: mark a non-recurring task done and stamp
-- completed_at. Recurring tasks (rule, chain membership, or completion records)
-- are rejected so recurring completion stays on flowstate_done_for_now.

CREATE OR REPLACE FUNCTION public.flowstate_complete_task_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_task_id text,
  p_base_revision bigint,
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
  v_change_sequence bigint;
  v_normalized jsonb := pg_catalog.jsonb_build_object('status', 'done');
  v_preview_expires_at timestamptz;
  v_expected_preview_digest text;
  v_request_hash text;
  v_scope_kind text;
  v_scope_id text;
  v_read_back jsonb;
  v_read_back_hash text;
  v_receipt jsonb;
  v_preview_found boolean := false;
  v_prior_operation_id text := pg_catalog.current_setting(
    'flowstate.canonical.operation_id',
    true
  );
BEGIN
  IF v_actor IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'not_authenticated',
        'message', 'Authentication is required'
      )
    );
  END IF;

  IF p_contract_version IS DISTINCT FROM 'task-v1'
     OR nullif(pg_catalog.btrim(p_operation_id), '') IS NULL
     OR pg_catalog.char_length(p_operation_id) > 160
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR p_preview IS NULL
     OR p_source IS NULL
     OR p_source !~ '^[a-z0-9][a-z0-9._:-]{0,63}$'
     OR nullif(pg_catalog.btrim(p_task_id), '') IS NULL
     OR p_base_revision IS NULL
     OR p_base_revision < 1 THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request',
        'message', 'The canonical task request is invalid'
      )
    );
  END IF;

  v_request_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'actorUserId', v_actor,
          'contractVersion', p_contract_version,
          'source', p_source,
          'action', 'complete',
          'taskId', p_task_id,
          'baseRevision', p_base_revision,
          'payload', v_normalized,
          'workspaceId', p_workspace_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  -- Serialize preview issuance and apply for one actor/operation identity.
  -- Different operations remain concurrent and are reconciled by row revision.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || p_operation_id, 0)
  );

  IF NOT p_preview THEN
    SELECT *
      INTO v_existing
    FROM public.canonical_operations AS operation
    WHERE operation.user_id = v_actor
      AND operation.operation_id = p_operation_id;

    IF FOUND THEN
      IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false,
          'result', 'conflict',
          'error', pg_catalog.jsonb_build_object(
            'code', 'idempotency_conflict',
            'message', 'operationId was already used for another request'
          )
        );
      END IF;

      IF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', true,
          'result', 'committed',
          'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object('replayed', true)
        );
      END IF;
    END IF;

    IF nullif(p_preview_digest, '') IS NULL OR p_preview_expires_at IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'The approval does not match this request')
      );
    END IF;

    SELECT *
      INTO v_issued_preview
    FROM public.canonical_operation_previews AS issued
    WHERE issued.user_id = v_actor
      AND issued.operation_id = p_operation_id
      AND issued.preview_digest = p_preview_digest
    FOR UPDATE;
    v_preview_found := FOUND;

    IF v_preview_found AND v_issued_preview.consumed_at IS NOT NULL THEN
      SELECT *
        INTO v_existing
      FROM public.canonical_operations AS operation
      WHERE operation.user_id = v_actor
        AND operation.operation_id = p_operation_id;

      IF FOUND
         AND v_existing.request_hash = v_request_hash
         AND v_existing.state = 'committed'
         AND v_existing.canonical_result IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', true,
          'result', 'committed',
          'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object('replayed', true)
        );
      END IF;
    END IF;

    IF NOT v_preview_found
       OR v_issued_preview.request_hash IS DISTINCT FROM v_request_hash
       OR v_issued_preview.expires_at IS DISTINCT FROM p_preview_expires_at
       OR v_issued_preview.consumed_at IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'The approval does not match this request')
      );
    END IF;

    IF v_issued_preview.expires_at <= pg_catalog.clock_timestamp() THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'preview_expired', 'message', 'The approved preview has expired')
      );
    END IF;
  END IF;

  IF p_preview THEN
    SELECT *
      INTO v_task
    FROM public.tasks AS task
    WHERE task.id::text = p_task_id
      AND task.is_deleted = false;
  ELSE
    SELECT *
      INTO v_task
    FROM public.tasks AS task
    WHERE task.id::text = p_task_id
      AND task.is_deleted = false
    FOR UPDATE;
  END IF;

  IF NOT FOUND
     OR v_task.workspace_id IS DISTINCT FROM p_workspace_id
     OR (
       v_task.workspace_id IS NULL
       AND v_task.user_id IS DISTINCT FROM v_actor
     )
     OR (
       v_task.workspace_id IS NOT NULL
       AND NOT public.flowstate_can_write_workspace_v1(v_task.workspace_id)
     ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'rejected',
      'error', pg_catalog.jsonb_build_object('code', 'not_found', 'message', 'Task was not found')
    );
  END IF;

  -- Recurring identity must fail closed: a recurrence rule, membership in a
  -- recurrence chain, or a completion-history record all belong to the native
  -- recurring flow (flowstate_done_for_now), never to this command.
  IF v_task.recurrence_rule IS NOT NULL
     OR v_task.recurrence_parent_id IS NOT NULL
     OR COALESCE(v_task.is_completion_record, false) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'recurring_task',
        'message', 'Recurring tasks must be completed with the recurring flow'
      )
    );
  END IF;

  IF v_task.status = 'done' THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'already_completed',
        'message', 'Task is already completed'
      )
    );
  END IF;

  IF NOT p_preview THEN
    -- A same-operation caller may have committed while this transaction waited
    -- for the task row lock. Recheck before treating its base as stale.
    SELECT *
      INTO v_existing
    FROM public.canonical_operations AS operation
    WHERE operation.user_id = v_actor
      AND operation.operation_id = p_operation_id;

    IF FOUND THEN
      IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', false, 'result', 'conflict',
          'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId was already used for another request')
        );
      ELSIF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', true,
          'result', 'committed',
          'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object('replayed', true)
        );
      END IF;
    END IF;
  END IF;

  IF v_task.canonical_revision IS DISTINCT FROM p_base_revision THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false,
      'result', 'conflict',
      'error', pg_catalog.jsonb_build_object(
        'code', 'stale_revision',
        'message', 'Task changed after the requested base revision',
        'currentRevision', v_task.canonical_revision
      )
    );
  END IF;

  v_read_back := pg_catalog.jsonb_build_object(
    'id', v_task.id,
    'title', v_task.title,
    'description', v_task.description,
    'priority', v_task.priority,
    'dueDate', v_task.due_date,
    'progress', v_task.progress,
    'status', CASE WHEN v_task.status = 'done' THEN 'done' ELSE 'todo' END,
    'completedAt', v_task.completed_at,
    'isDeleted', v_task.is_deleted,
    'workspaceId', v_task.workspace_id,
    'canonicalRevision', v_task.canonical_revision,
    'canonicalUpdatedAt', v_task.updated_at
  );

  IF p_preview THEN
    IF EXISTS (
      SELECT 1
      FROM public.canonical_operations AS operation
      WHERE operation.user_id = v_actor
        AND operation.operation_id = p_operation_id
    ) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId was already applied')
      );
    END IF;

    SELECT *
      INTO v_issued_preview
    FROM public.canonical_operation_previews AS issued
    WHERE issued.user_id = v_actor
      AND issued.operation_id = p_operation_id
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
          'error', pg_catalog.jsonb_build_object('code', 'preview_expired', 'message', 'Use a new operationId for a fresh preview')
        );
      END IF;

      v_expected_preview_digest := v_issued_preview.preview_digest;
      v_preview_expires_at := v_issued_preview.expires_at;
    ELSE
      v_preview_expires_at := pg_catalog.clock_timestamp() + interval '15 minutes';
      v_expected_preview_digest := pg_catalog.encode(
        extensions.gen_random_bytes(32),
        'hex'
      );

      INSERT INTO public.canonical_operation_previews (
        user_id,
        operation_id,
        preview_digest,
        request_hash,
        expires_at
      ) VALUES (
        v_actor,
        p_operation_id,
        v_expected_preview_digest,
        v_request_hash,
        v_preview_expires_at
      );
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'result', 'preview',
      'contractVersion', p_contract_version,
      'operationId', p_operation_id,
      'baseRevision', p_base_revision,
      'previewDigest', v_expected_preview_digest,
      'previewExpiresAt', v_preview_expires_at,
      'normalizedPayload', v_normalized,
      'willSetCompletedAt', true,
      'readBack', v_read_back
    );
  END IF;

  v_scope_kind := CASE WHEN v_task.workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
  v_scope_id := COALESCE(v_task.workspace_id::text, v_actor::text);

  INSERT INTO public.canonical_operations (
    user_id,
    operation_id,
    contract_version,
    source,
    scope_kind,
    scope_id,
    workspace_id,
    entity_type,
    action,
    entity_id,
    request_hash,
    state
  ) VALUES (
    v_actor,
    p_operation_id,
    p_contract_version,
    p_source,
    v_scope_kind,
    v_scope_id,
    v_task.workspace_id,
    'task',
    'complete',
    v_task.id,
    v_request_hash,
    'applying'
  )
  ON CONFLICT (user_id, operation_id) DO NOTHING;

  IF NOT FOUND THEN
    SELECT *
      INTO STRICT v_existing
    FROM public.canonical_operations AS operation
    WHERE operation.user_id = v_actor
      AND operation.operation_id = p_operation_id
    FOR UPDATE;

    IF v_existing.request_hash IS DISTINCT FROM v_request_hash THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object('code', 'idempotency_conflict', 'message', 'operationId was already used for another request')
      );
    END IF;

    IF v_existing.state = 'committed' AND v_existing.canonical_result IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', true,
        'result', 'committed',
        'receipt', v_existing.canonical_result || pg_catalog.jsonb_build_object('replayed', true)
      );
    END IF;
  END IF;

  UPDATE public.canonical_operation_previews AS issued
  SET
    consumed_at = pg_catalog.clock_timestamp(),
    updated_at = pg_catalog.clock_timestamp()
  WHERE issued.user_id = v_actor
    AND issued.operation_id = p_operation_id
    AND issued.preview_digest = p_preview_digest
    AND issued.consumed_at IS NULL;

  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'conflict',
      'error', pg_catalog.jsonb_build_object('code', 'preview_mismatch', 'message', 'The approval was already consumed')
    );
  END IF;

  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', p_operation_id, true);

  UPDATE public.tasks AS task
  SET
    status = 'done',
    completed_at = pg_catalog.clock_timestamp()
  WHERE task.id = v_task.id
  RETURNING task.* INTO STRICT v_updated;

  PERFORM pg_catalog.set_config(
    'flowstate.canonical.operation_id',
    COALESCE(v_prior_operation_id, ''),
    true
  );

  SELECT change.change_sequence
    INTO STRICT v_change_sequence
  FROM public.canonical_change_log AS change
  WHERE change.actor_user_id = v_actor
    AND change.operation_id = p_operation_id
    AND change.entity_type = 'task'
    AND change.entity_id = v_updated.id::text
  ORDER BY change.change_sequence DESC
  LIMIT 1;

  v_read_back := pg_catalog.jsonb_build_object(
    'id', v_updated.id,
    'title', v_updated.title,
    'description', v_updated.description,
    'priority', v_updated.priority,
    'dueDate', v_updated.due_date,
    'progress', v_updated.progress,
    'status', CASE WHEN v_updated.status = 'done' THEN 'done' ELSE 'todo' END,
    'completedAt', v_updated.completed_at,
    'isDeleted', v_updated.is_deleted,
    'workspaceId', v_updated.workspace_id,
    'canonicalRevision', v_updated.canonical_revision,
    'canonicalUpdatedAt', v_updated.updated_at
  );

  v_read_back_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(v_read_back::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );

  v_receipt := pg_catalog.jsonb_build_object(
    'contractVersion', p_contract_version,
    'operationId', p_operation_id,
    'source', p_source,
    'entityType', 'task',
    'action', 'complete',
    'entityId', v_updated.id,
    'canonicalRevision', v_updated.canonical_revision,
    'canonicalUpdatedAt', v_updated.updated_at,
    'changeSequence', v_change_sequence,
    'replayed', false,
    'committedAt', pg_catalog.clock_timestamp(),
    'readBack', v_read_back,
    'readBackHash', v_read_back_hash
  );

  UPDATE public.canonical_operations AS operation
  SET
    state = 'committed',
    canonical_revision = v_updated.canonical_revision,
    change_sequence = v_change_sequence,
    canonical_result = v_receipt,
    committed_at = (v_receipt->>'committedAt')::timestamptz,
    updated_at = pg_catalog.clock_timestamp()
  WHERE operation.user_id = v_actor
    AND operation.operation_id = p_operation_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'result', 'committed',
    'receipt', v_receipt
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_complete_task_v1(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flowstate_complete_task_v1(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid
) FROM anon;
GRANT EXECUTE ON FUNCTION public.flowstate_complete_task_v1(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid
) TO authenticated;

COMMENT ON FUNCTION public.flowstate_complete_task_v1(
  text, text, text, text, bigint, boolean, text, timestamptz, uuid
) IS
  'Preview/apply completion of one non-recurring task and return a durable, read-back-verifiable canonical receipt.';
