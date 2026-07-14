-- TASK-1948: signed-user Notion activation through the TASK-1944 authority.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS external_data_source_id text,
  ADD COLUMN IF NOT EXISTS external_last_edited_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_active_external_identity_uidx
  ON public.tasks (user_id, external_source, external_id)
  WHERE is_deleted = false
    AND external_source IS NOT NULL
    AND external_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.flowstate_canonical_json_text_v1(p_value jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  v_result text;
BEGIN
  CASE pg_catalog.jsonb_typeof(p_value)
    WHEN 'object' THEN
      SELECT '{' || COALESCE(
        pg_catalog.string_agg(
          pg_catalog.to_jsonb(entry.key)::text || ':'
            || public.flowstate_canonical_json_text_v1(entry.value),
          ',' ORDER BY entry.key COLLATE "C"
        ),
        ''
      ) || '}'
      INTO v_result
      FROM pg_catalog.jsonb_each(p_value) AS entry(key, value);
      RETURN v_result;
    WHEN 'array' THEN
      SELECT '[' || COALESCE(
        pg_catalog.string_agg(
          public.flowstate_canonical_json_text_v1(entry.value),
          ',' ORDER BY entry.ordinality
        ),
        ''
      ) || ']'
      INTO v_result
      FROM pg_catalog.jsonb_array_elements(p_value)
        WITH ORDINALITY AS entry(value, ordinality);
      RETURN v_result;
    ELSE
      RETURN p_value::text;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_canonical_json_text_v1(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_task_external_provenance_v1()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_operation_id text := nullif(pg_catalog.current_setting(
    'flowstate.canonical.operation_id', true
  ), '');
  v_changed boolean;
BEGIN
  v_changed := CASE WHEN TG_OP = 'INSERT' THEN
    NEW.external_source IS NOT NULL
      OR NEW.external_id IS NOT NULL
      OR NEW.external_url IS NOT NULL
      OR NEW.external_data_source_id IS NOT NULL
      OR NEW.external_last_edited_at IS NOT NULL
  ELSE
    NEW.external_source IS DISTINCT FROM OLD.external_source
      OR NEW.external_id IS DISTINCT FROM OLD.external_id
      OR NEW.external_url IS DISTINCT FROM OLD.external_url
      OR NEW.external_data_source_id IS DISTINCT FROM OLD.external_data_source_id
      OR NEW.external_last_edited_at IS DISTINCT FROM OLD.external_last_edited_at
  END;

  IF NOT v_changed THEN
    RETURN NEW;
  END IF;

  IF v_actor IS NULL OR v_operation_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.canonical_operations AS operation
    WHERE operation.user_id = v_actor
      AND operation.operation_id = v_operation_id
      AND operation.state = 'applying'
      AND operation.contract_version = 'notion-activation-v1'
      AND operation.source = 'notion'
      AND operation.scope_kind = 'personal'
      AND operation.scope_id = v_actor::text
      AND operation.workspace_id IS NULL
      AND operation.entity_type = 'task'
      AND operation.action = 'activate'
      AND operation.entity_id = NEW.id::text
  ) THEN
    RAISE EXCEPTION 'External task provenance requires a canonical Notion activation'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_task_external_provenance_v1()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_task_external_provenance_v1 ON public.tasks;
CREATE TRIGGER guard_task_external_provenance_v1
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_task_external_provenance_v1();

-- The typed RPC is the only writer. Canonical receipts remain in the existing
-- TASK-1944 ledger; this migration deliberately creates no activation ledger.
REVOKE ALL ON public.canonical_operations FROM authenticated;
REVOKE ALL ON public.canonical_operation_previews FROM authenticated;
REVOKE ALL ON public.canonical_change_log FROM authenticated;
GRANT SELECT ON public.canonical_operations TO authenticated;
GRANT SELECT ON public.canonical_change_log TO authenticated;

CREATE OR REPLACE FUNCTION public.flowstate_activate_notion_task_v1(
  p_operation_id text,
  p_notion jsonb,
  p_task jsonb,
  p_work_block jsonb DEFAULT NULL,
  p_preview boolean DEFAULT true,
  p_preview_digest text DEFAULT NULL,
  p_preview_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_existing public.canonical_operations%ROWTYPE;
  v_issued_preview public.canonical_operation_previews%ROWTYPE;
  v_task public.tasks%ROWTYPE;
  v_updated public.tasks%ROWTYPE;
  v_page_id text;
  v_data_source_id text;
  v_url text;
  v_last_edited_at timestamptz;
  v_title text;
  v_description text;
  v_priority text;
  v_due_date timestamptz;
  v_project_id text;
  v_project_ref public.projects.id%TYPE;
  v_work_block jsonb;
  v_normalized jsonb;
  v_request_hash text;
  v_expected_preview_digest text;
  v_preview_expires_at timestamptz;
  v_change_sequence bigint;
  v_task_id public.tasks.id%TYPE;
  v_already_activated boolean := false;
  v_work_block_exists boolean := false;
  v_read_back jsonb;
  v_read_back_hash text;
  v_provenance jsonb;
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

  IF nullif(pg_catalog.btrim(p_operation_id), '') IS NULL
     OR p_operation_id IS DISTINCT FROM pg_catalog.btrim(p_operation_id)
     OR pg_catalog.char_length(p_operation_id) > 160
     OR p_preview IS NULL
     OR p_notion IS NULL OR pg_catalog.jsonb_typeof(p_notion) <> 'object'
     OR p_task IS NULL OR pg_catalog.jsonb_typeof(p_task) <> 'object'
     OR p_work_block IS NOT NULL AND pg_catalog.jsonb_typeof(p_work_block) <> 'object' THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'The Notion activation request is invalid'
      )
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_object_keys(p_notion) AS key(name)
    WHERE name NOT IN ('pageId', 'dataSourceId', 'url', 'lastEditedAt')
  ) OR EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_object_keys(p_task) AS key(name)
    WHERE name NOT IN ('title', 'description', 'priority', 'dueDate', 'projectId')
  ) OR p_work_block IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_object_keys(p_work_block) AS key(name)
    WHERE name NOT IN ('scheduledDate', 'scheduledTime', 'duration')
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'The activation contains unsupported fields'
      )
    );
  END IF;

  IF pg_catalog.jsonb_typeof(p_notion->'pageId') <> 'string'
     OR pg_catalog.jsonb_typeof(p_notion->'dataSourceId') <> 'string'
     OR pg_catalog.jsonb_typeof(p_notion->'url') <> 'string'
     OR pg_catalog.jsonb_typeof(p_notion->'lastEditedAt') <> 'string'
     OR pg_catalog.jsonb_typeof(p_task->'title') <> 'string'
     OR p_task ? 'description'
       AND pg_catalog.jsonb_typeof(p_task->'description') NOT IN ('string', 'null')
     OR p_task ? 'priority'
       AND pg_catalog.jsonb_typeof(p_task->'priority') NOT IN ('string', 'null')
     OR p_task ? 'dueDate'
       AND pg_catalog.jsonb_typeof(p_task->'dueDate') NOT IN ('string', 'null')
     OR p_task ? 'projectId'
       AND pg_catalog.jsonb_typeof(p_task->'projectId') NOT IN ('string', 'null') THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'Activation field types are invalid'
      )
    );
  END IF;

  v_page_id := p_notion->>'pageId';
  v_data_source_id := p_notion->>'dataSourceId';
  v_url := p_notion->>'url';
  v_title := pg_catalog.btrim(p_task->>'title');
  v_description := COALESCE(p_task->>'description', '');
  v_priority := p_task->>'priority';
  v_project_id := p_task->>'projectId';

  IF nullif(pg_catalog.btrim(v_page_id), '') IS NULL
     OR pg_catalog.char_length(v_page_id) > 200
     OR nullif(pg_catalog.btrim(v_data_source_id), '') IS NULL
     OR pg_catalog.char_length(v_data_source_id) > 200
     OR nullif(pg_catalog.btrim(v_url), '') IS NULL
     OR v_url !~ '^https://'
     OR pg_catalog.char_length(v_url) > 2000
     OR nullif(v_title, '') IS NULL
     OR pg_catalog.char_length(v_title) > 500
     OR pg_catalog.char_length(v_description) > 10000
     OR v_priority IS NOT NULL AND v_priority NOT IN ('low', 'medium', 'high') THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'Notion provenance or task fields are invalid'
      )
    );
  END IF;

  BEGIN
    v_last_edited_at := (p_notion->>'lastEditedAt')::timestamptz;
    IF p_task ? 'dueDate'
       AND pg_catalog.jsonb_typeof(p_task->'dueDate') <> 'null' THEN
      v_due_date := (p_task->>'dueDate')::timestamptz;
    END IF;
  EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'Notion timestamps are invalid'
      )
    );
  END;

  IF v_last_edited_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'invalid_request', 'message', 'Notion lastEditedAt is required'
      )
    );
  END IF;

  IF v_project_id IS NOT NULL THEN
    SELECT project.id INTO v_project_ref
    FROM public.projects AS project
    WHERE project.id::text = v_project_id
      AND project.user_id = v_actor
      AND project.is_deleted = false;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'project_not_found', 'message', 'Project was not found'
        )
      );
    END IF;
  END IF;

  IF p_work_block IS NOT NULL THEN
    IF pg_catalog.jsonb_typeof(p_work_block->'scheduledDate') <> 'string'
       OR pg_catalog.jsonb_typeof(p_work_block->'scheduledTime') <> 'string'
       OR pg_catalog.jsonb_typeof(p_work_block->'duration') <> 'number'
       OR COALESCE(p_work_block->>'scheduledDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
       OR COALESCE(p_work_block->>'scheduledTime', '') !~ '^([01]\d|2[0-3]):[0-5]\d$'
       OR (p_work_block->>'duration')::numeric
         <> pg_catalog.trunc((p_work_block->>'duration')::numeric)
       OR (p_work_block->>'duration')::numeric NOT BETWEEN 1 AND 1440 THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_work_block', 'message', 'The work block is invalid'
        )
      );
    END IF;
    BEGIN
      PERFORM (p_work_block->>'scheduledDate')::date;
    EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'invalid_work_block', 'message', 'The work block date is invalid'
        )
      );
    END;
    v_work_block := pg_catalog.jsonb_build_object(
      'scheduledDate', p_work_block->>'scheduledDate',
      'scheduledTime', p_work_block->>'scheduledTime',
      'duration', (p_work_block->>'duration')::integer
    );
  END IF;

  v_normalized := pg_catalog.jsonb_build_object(
    'notion', pg_catalog.jsonb_build_object(
      'pageId', v_page_id,
      'dataSourceId', v_data_source_id,
      'url', v_url,
      'lastEditedAt', v_last_edited_at
    ),
    'task', pg_catalog.jsonb_build_object(
      'title', v_title,
      'description', v_description,
      'priority', v_priority,
      'dueDate', v_due_date,
      'projectId', v_project_id
    ),
    'workBlock', v_work_block
  );
  v_request_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'actorUserId', v_actor,
          'contractVersion', 'notion-activation-v1',
          'source', 'notion',
          'payload', v_normalized
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':' || p_operation_id, 0)
  );

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
            'code', 'idempotency_conflict',
            'message', 'operationId was already used for another request'
          )
        );
      END IF;
      IF v_existing.state = 'committed'
         AND v_existing.canonical_result IS NOT NULL THEN
        RETURN pg_catalog.jsonb_build_object(
          'ok', true, 'result', 'committed',
          'receipt', v_existing.canonical_result
            || pg_catalog.jsonb_build_object('replayed', true)
        );
      END IF;
    END IF;

    IF nullif(p_preview_digest, '') IS NULL OR p_preview_expires_at IS NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'conflict',
        'error', pg_catalog.jsonb_build_object(
          'code', 'preview_mismatch', 'message', 'The approval does not match this request'
        )
      );
    END IF;

    SELECT * INTO v_issued_preview
    FROM public.canonical_operation_previews AS issued
    WHERE issued.user_id = v_actor
      AND issued.operation_id = p_operation_id
      AND issued.preview_digest = p_preview_digest
    FOR UPDATE;

    IF NOT FOUND
       OR v_issued_preview.request_hash IS DISTINCT FROM v_request_hash
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

  SELECT * INTO v_task
  FROM public.tasks AS task
  WHERE task.user_id = v_actor
    AND task.external_source = 'notion'
    AND task.external_id = v_page_id
    AND task.is_deleted = false
  LIMIT 1;
  v_already_activated := FOUND;

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
      v_expected_preview_digest := v_issued_preview.preview_digest;
      v_preview_expires_at := v_issued_preview.expires_at;
    ELSE
      v_preview_expires_at := pg_catalog.clock_timestamp() + interval '15 minutes';
      v_expected_preview_digest := pg_catalog.encode(
        extensions.gen_random_bytes(32), 'hex'
      );
      INSERT INTO public.canonical_operation_previews (
        user_id, operation_id, preview_digest, request_hash, expires_at
      ) VALUES (
        v_actor, p_operation_id, v_expected_preview_digest,
        v_request_hash, v_preview_expires_at
      );
    END IF;

    IF v_already_activated THEN
      v_read_back := pg_catalog.jsonb_build_object(
        'id', v_task.id,
        'title', v_task.title,
        'canonicalRevision', v_task.canonical_revision,
        'canonicalUpdatedAt', v_task.updated_at,
        'instances', COALESCE(v_task.instances, '[]'::jsonb),
        'provenance', pg_catalog.jsonb_build_object(
          'source', v_task.external_source,
          'externalId', v_task.external_id,
          'dataSourceId', v_task.external_data_source_id,
          'url', v_task.external_url,
          'lastEditedAt', v_task.external_last_edited_at
        )
      );
    END IF;

    RETURN pg_catalog.jsonb_build_object(
      'ok', true,
      'result', 'preview',
      'contractVersion', 'notion-activation-v1',
      'operationId', p_operation_id,
      'previewDigest', v_expected_preview_digest,
      'previewExpiresAt', v_preview_expires_at,
      'alreadyActivated', v_already_activated,
      'normalizedPayload', pg_catalog.jsonb_build_object(
        'operationId', p_operation_id,
        'notionPageId', v_page_id,
        'notionDataSourceId', v_data_source_id,
        'notionUrl', v_url,
        'notionLastEditedAt', v_last_edited_at,
        'task', v_normalized->'task',
        'workBlock', v_work_block
      ),
      'readBack', v_read_back
    );
  END IF;

  -- Serialize all operation identities that target one external page so two
  -- concurrent first activations cannot race past the partial unique index.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':notion:' || v_page_id, 0)
  );
  SELECT * INTO v_task
  FROM public.tasks AS task
  WHERE task.user_id = v_actor
    AND task.external_source = 'notion'
    AND task.external_id = v_page_id
    AND task.is_deleted = false
  LIMIT 1
  FOR UPDATE;
  v_already_activated := FOUND;
  IF v_already_activated THEN
    v_task_id := v_task.id;
  ELSE
    v_task_id := extensions.gen_random_uuid();
  END IF;

  INSERT INTO public.canonical_operations (
    user_id, operation_id, contract_version, source,
    scope_kind, scope_id, workspace_id, entity_type, action,
    entity_id, request_hash, state
  ) VALUES (
    v_actor, p_operation_id, 'notion-activation-v1', 'notion',
    'personal', v_actor::text, NULL, 'task', 'activate',
    v_task_id::text, v_request_hash, 'applying'
  )
  ON CONFLICT (user_id, operation_id) DO NOTHING;

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
    IF v_existing.state = 'committed'
       AND v_existing.canonical_result IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', true, 'result', 'committed',
        'receipt', v_existing.canonical_result
          || pg_catalog.jsonb_build_object('replayed', true)
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

  PERFORM pg_catalog.set_config(
    'flowstate.canonical.operation_id', p_operation_id, true
  );

  IF v_already_activated THEN
    IF v_work_block IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.jsonb_array_elements(
          COALESCE(v_task.instances, '[]'::jsonb)
        ) AS instance(value)
        WHERE value->>'scheduledDate' = v_work_block->>'scheduledDate'
          AND value->>'scheduledTime' = v_work_block->>'scheduledTime'
          AND value->>'duration' = v_work_block->>'duration'
      ) INTO v_work_block_exists;
    END IF;

    UPDATE public.tasks AS task
    SET title = v_title,
        description = v_description,
        priority = v_priority,
        due_date = v_due_date,
        project_id = v_project_ref,
        external_url = v_url,
        external_data_source_id = v_data_source_id,
        external_last_edited_at = v_last_edited_at,
        instances = CASE WHEN v_work_block IS NULL OR v_work_block_exists
          THEN COALESCE(task.instances, '[]'::jsonb)
          ELSE COALESCE(task.instances, '[]'::jsonb)
            || pg_catalog.jsonb_build_array(
              pg_catalog.jsonb_build_object(
                'id', extensions.gen_random_uuid()::text,
                'scheduledDate', v_work_block->>'scheduledDate',
                'scheduledTime', v_work_block->>'scheduledTime',
                'duration', (v_work_block->>'duration')::integer
              )
            )
        END,
        updated_at = pg_catalog.clock_timestamp()
    WHERE task.id = v_task_id
      AND task.user_id = v_actor
    RETURNING task.* INTO STRICT v_updated;
  ELSE
    INSERT INTO public.tasks (
      id, user_id, project_id, title, description, status, priority,
      due_date, instances, progress, is_deleted, external_source,
      external_id, external_url, external_data_source_id,
      external_last_edited_at, created_at, updated_at
    ) VALUES (
      v_task_id, v_actor, v_project_ref, v_title, v_description,
      'planned', v_priority, v_due_date,
      CASE WHEN v_work_block IS NULL THEN '[]'::jsonb
        ELSE pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'id', extensions.gen_random_uuid()::text,
            'scheduledDate', v_work_block->>'scheduledDate',
            'scheduledTime', v_work_block->>'scheduledTime',
            'duration', (v_work_block->>'duration')::integer
          )
        )
      END,
      0, false, 'notion', v_page_id, v_url, v_data_source_id,
      v_last_edited_at, pg_catalog.clock_timestamp(), pg_catalog.clock_timestamp()
    )
    RETURNING * INTO STRICT v_updated;
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
  ORDER BY change.change_sequence DESC
  LIMIT 1;

  v_provenance := pg_catalog.jsonb_build_object(
    'source', 'notion',
    'externalId', v_updated.external_id,
    'dataSourceId', v_updated.external_data_source_id,
    'url', v_updated.external_url,
    'lastEditedAt', v_updated.external_last_edited_at
  );
  v_read_back := pg_catalog.jsonb_build_object(
    'id', v_updated.id,
    'title', v_updated.title,
    'description', v_updated.description,
    'status', CASE WHEN v_updated.status = 'done' THEN 'done' ELSE 'todo' END,
    'priority', v_updated.priority,
    'dueDate', v_updated.due_date,
    'projectId', v_updated.project_id,
    'instances', COALESCE(v_updated.instances, '[]'::jsonb),
    'canonicalRevision', v_updated.canonical_revision,
    'canonicalUpdatedAt', v_updated.updated_at,
    'externalSource', 'notion',
    'externalId', v_updated.external_id,
    'externalDataSourceId', v_updated.external_data_source_id,
    'externalUrl', v_updated.external_url,
    'externalLastEditedAt', v_updated.external_last_edited_at,
    'provenance', v_provenance
  );
  v_read_back_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        public.flowstate_canonical_json_text_v1(v_read_back), 'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
  v_receipt := pg_catalog.jsonb_build_object(
    'contractVersion', 'notion-activation-v1',
    'operationId', p_operation_id,
    'source', 'notion',
    'entityType', 'task',
    'action', 'activate',
    'entityId', v_updated.id,
    'externalId', v_updated.external_id,
    'canonicalRevision', v_updated.canonical_revision,
    'canonicalUpdatedAt', v_updated.updated_at,
    'changeSequence', v_change_sequence,
    'committedAt', pg_catalog.clock_timestamp(),
    'replayed', false,
    'alreadyActivated', v_already_activated,
    'provenance', v_provenance,
    'readBack', v_read_back,
    'readBackHash', v_read_back_hash
  );

  UPDATE public.canonical_operations AS operation
  SET state = 'committed',
      canonical_revision = v_updated.canonical_revision,
      change_sequence = v_change_sequence,
      canonical_result = v_receipt,
      committed_at = (v_receipt->>'committedAt')::timestamptz,
      updated_at = pg_catalog.clock_timestamp()
  WHERE operation.user_id = v_actor
    AND operation.operation_id = p_operation_id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true, 'result', 'committed', 'receipt', v_receipt
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_activate_notion_task_v1(
  text, jsonb, jsonb, jsonb, boolean, text, timestamptz
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flowstate_activate_notion_task_v1(
  text, jsonb, jsonb, jsonb, boolean, text, timestamptz
) FROM anon;
GRANT EXECUTE ON FUNCTION public.flowstate_activate_notion_task_v1(
  text, jsonb, jsonb, jsonb, boolean, text, timestamptz
) TO authenticated;

COMMENT ON FUNCTION public.flowstate_activate_notion_task_v1(
  text, jsonb, jsonb, jsonb, boolean, text, timestamptz
) IS 'Preview/apply one signed-user Notion activation through the canonical operation ledger.';
