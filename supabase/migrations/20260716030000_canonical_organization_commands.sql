-- H7: canonical project assignment and plain Canvas group membership.
--
-- Organization reads stay scope-filtered in the Local API. These two writes
-- use the shared task receipt substrate, preserve unrelated Canvas position
-- metadata, and reject smart-group semantics instead of guessing side effects.

CREATE OR REPLACE FUNCTION public.flowstate_h7_organization_task_read_back(
  p_task_id text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'id', task.id::text,
    'title', task.title,
    'projectId', task.project_id,
    'position', COALESCE(task.position, '{}'::jsonb),
    'isInInbox', task.is_in_inbox,
    'workspaceId', task.workspace_id,
    'canonicalRevision', task.canonical_revision,
    'canonicalUpdatedAt', task.updated_at
  )
  FROM public.tasks AS task
  WHERE task.id::text = p_task_id
$$;

CREATE OR REPLACE FUNCTION public.flowstate_h7_organization_task_affected(
  p_task_id text
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
      'action', 'update',
      'canonicalRevision', task.canonical_revision,
      'changeSequence', change.change_sequence,
      'readBack', read_back.value,
      'readBackHash', pg_catalog.encode(
        extensions.digest(
          pg_catalog.convert_to(
            public.flowstate_canonical_json_text_v1(read_back.value),
            'UTF8'
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
    SELECT public.flowstate_h7_organization_task_read_back(task.id::text) AS value
  ) AS read_back
  WHERE task.id::text = p_task_id
$$;

CREATE OR REPLACE FUNCTION public.flowstate_organization_task_v1(
  p_operation_id text,
  p_contract_version text,
  p_source text,
  p_action text,
  p_task_id text,
  p_base_revision bigint,
  p_target_id text,
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
  v_project public.projects%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_existing public.canonical_operations%ROWTYPE;
  v_issued_preview public.canonical_operation_previews%ROWTYPE;
  v_target_key text;
  v_request_hash text;
  v_preview_digest text;
  v_preview_expires_at timestamptz;
  v_projected_position jsonb;
  v_read_back jsonb;
  v_affected jsonb;
  v_receipt jsonb;
  v_operation_context jsonb;
  v_scope_kind text;
  v_scope_id text;
  v_before_sequence bigint;
  v_now timestamptz;
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
     OR nullif(pg_catalog.btrim(p_operation_id), '') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id) > 160
     OR p_source IS DISTINCT FROM 'local-api'
     OR p_action NOT IN ('assign_project', 'set_canvas_group')
     OR nullif(pg_catalog.btrim(p_task_id), '') IS NULL
     OR p_task_id IS DISTINCT FROM pg_catalog.btrim(p_task_id)
     OR nullif(pg_catalog.btrim(p_target_id), '') IS NULL
     OR p_target_id IS DISTINCT FROM pg_catalog.btrim(p_target_id)
     OR p_base_revision IS NULL
     OR p_base_revision < 1
     OR p_preview IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'The organization request is invalid'
      )
    );
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

  v_target_key := CASE
    WHEN p_action = 'assign_project' THEN 'projectId'
    ELSE 'groupId'
  END;
  v_operation_context := pg_catalog.jsonb_build_object(
    'action', p_action,
    'taskId', p_task_id,
    'baseRevision', p_base_revision,
    v_target_key, p_target_id,
    'workspaceId', p_workspace_id
  );
  v_request_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        public.flowstate_canonical_json_text_v1(
          pg_catalog.jsonb_build_object(
            'actorUserId', v_actor,
            'contractVersion', p_contract_version,
            'source', p_source,
            'action', p_action,
            'taskId', p_task_id,
            'baseRevision', p_base_revision,
            v_target_key, p_target_id,
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
        'taskId', p_task_id,
        'requestHash', v_request_hash,
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
        'code', 'task_not_found', 'message', 'Task was not found'
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
        'code', 'task_not_found', 'message', 'Task was not found'
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

  IF p_action = 'assign_project' THEN
    IF p_preview THEN
      SELECT * INTO v_project
      FROM public.projects AS project
      WHERE project.id::text = p_target_id;
    ELSE
      SELECT * INTO v_project
      FROM public.projects AS project
      WHERE project.id::text = p_target_id
      FOR UPDATE;
    END IF;
    IF NOT FOUND
       OR v_project.is_deleted
       OR v_project.workspace_id IS DISTINCT FROM p_workspace_id
       OR (v_project.workspace_id IS NULL AND v_project.user_id IS DISTINCT FROM v_actor) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'project_not_found', 'message', 'Project was not found in the active scope'
        )
      );
    END IF;
  ELSE
    IF p_preview THEN
      SELECT * INTO v_group
      FROM public.groups AS canvas_group
      WHERE canvas_group.id = p_target_id;
    ELSE
      SELECT * INTO v_group
      FROM public.groups AS canvas_group
      WHERE canvas_group.id = p_target_id
      FOR UPDATE;
    END IF;
    IF NOT FOUND
       OR v_group.is_deleted
       OR v_group.workspace_id IS DISTINCT FROM p_workspace_id
       OR (v_group.workspace_id IS NULL AND v_group.user_id IS DISTINCT FROM v_actor) THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'group_not_found', 'message', 'Canvas group was not found in the active scope'
        )
      );
    END IF;
    IF v_group.type IS DISTINCT FROM 'custom'
       OR v_group.is_power_mode IS DISTINCT FROM false
       OR v_group.auto_collect IS DISTINCT FROM false
       OR v_group.filters_json IS NOT NULL
       OR v_group.power_keyword_json IS NOT NULL
       OR v_group.assign_on_drop_json IS NOT NULL
       OR v_group.collect_filter_json IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'unsupported_smart_group',
          'message', 'Smart group assignment requires its domain command'
        )
      );
    END IF;
    IF v_task.position IS NULL
       OR pg_catalog.jsonb_typeof(v_task.position) IS DISTINCT FROM 'object'
       OR pg_catalog.jsonb_typeof(v_task.position -> 'x') IS DISTINCT FROM 'number'
       OR pg_catalog.jsonb_typeof(v_task.position -> 'y') IS DISTINCT FROM 'number' THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_task_position',
          'message', 'Canvas membership requires an existing numeric x/y placement'
        )
      );
    END IF;
    v_projected_position := pg_catalog.jsonb_set(
      v_task.position,
      '{parentId}',
      pg_catalog.to_jsonb(p_target_id),
      true
    );
  END IF;

  v_read_back := public.flowstate_h7_organization_task_read_back(p_task_id);
  IF p_action = 'assign_project' THEN
    v_read_back := pg_catalog.jsonb_set(
      v_read_back, '{projectId}', pg_catalog.to_jsonb(v_project.id), true
    );
  ELSE
    v_read_back := pg_catalog.jsonb_set(
      v_read_back, '{position}', v_projected_position, true
    );
    v_read_back := pg_catalog.jsonb_set(
      v_read_back, '{isInInbox}', 'false'::jsonb, true
    );
  END IF;

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
            'code', 'idempotency_conflict',
            'message', 'operationId already has another preview'
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
      'taskId', p_task_id,
      'baseRevision', p_base_revision,
      'requestHash', v_request_hash,
      'previewDigest', v_preview_digest,
      'previewExpiresAt', v_preview_expires_at,
      'normalizedPayload', pg_catalog.jsonb_build_object(
        'taskId', p_task_id, v_target_key, p_target_id
      ),
      'readBack', v_read_back
    );
  END IF;

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

  v_scope_kind := CASE WHEN p_workspace_id IS NULL THEN 'personal' ELSE 'workspace' END;
  v_scope_id := COALESCE(p_workspace_id::text, v_actor::text);
  INSERT INTO public.canonical_operations (
    user_id, operation_id, contract_version, source,
    scope_kind, scope_id, workspace_id,
    entity_type, action, entity_id, request_hash, state,
    operation_context
  ) VALUES (
    v_actor, p_operation_id, p_contract_version, p_source,
    v_scope_kind, v_scope_id, p_workspace_id,
    'task', p_action, p_task_id, v_request_hash, 'applying',
    v_operation_context
  );

  SELECT COALESCE(pg_catalog.max(change_sequence), 0)
    INTO v_before_sequence
  FROM public.canonical_change_log;
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', p_operation_id, true);
  v_now := pg_catalog.clock_timestamp();
  IF p_action = 'assign_project' THEN
    UPDATE public.tasks AS task
    SET project_id = v_project.id,
        updated_at = v_now
    WHERE task.id::text = p_task_id
      AND task.canonical_revision = p_base_revision
    RETURNING * INTO STRICT v_updated;
  ELSE
    UPDATE public.tasks AS task
    SET position = v_projected_position,
        is_in_inbox = false,
        updated_at = v_now
    WHERE task.id::text = p_task_id
      AND task.canonical_revision = p_base_revision
    RETURNING * INTO STRICT v_updated;
  END IF;
  PERFORM pg_catalog.set_config(
    'flowstate.canonical.operation_id', COALESCE(v_prior_operation_id, ''), true
  );

  PERFORM public.flowstate_h3_link_task_changes(
    ARRAY[p_task_id], p_operation_id, v_before_sequence
  );
  v_affected := public.flowstate_h7_organization_task_affected(p_task_id);
  v_receipt := public.flowstate_h3_finalize_receipt(
    v_actor,
    p_operation_id,
    pg_catalog.jsonb_build_object(
      'readBack', public.flowstate_h7_organization_task_read_back(p_task_id)
    ),
    v_operation_context,
    v_affected
  );

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'result', 'committed',
    'operationId', p_operation_id,
    'action', p_action,
    'taskId', p_task_id,
    'requestHash', v_request_hash,
    'receipt', v_receipt || pg_catalog.jsonb_build_object(
      'status', 'committed', 'replayed', false
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_h7_organization_task_read_back(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_h7_organization_task_affected(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.flowstate_organization_task_v1(
  text, text, text, text, text, bigint, text,
  boolean, text, timestamptz, uuid, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_organization_task_v1(
  text, text, text, text, text, bigint, text,
  boolean, text, timestamptz, uuid, text
) TO authenticated;

COMMENT ON FUNCTION public.flowstate_organization_task_v1(
  text, text, text, text, text, bigint, text,
  boolean, text, timestamptz, uuid, text
) IS
  'Preview/apply exact project assignment or plain Canvas group membership with durable canonical task receipt replay.';
