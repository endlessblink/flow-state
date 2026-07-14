-- TASK-1939: one preview-first, user-scoped activation boundary for Notion tasks.
-- Notion stays authoritative for project work. FlowState stores a personal task
-- only after an exact activation preview is approved.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS external_data_source_id text,
  ADD COLUMN IF NOT EXISTS external_last_edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_operation_id text;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_active_external_identity_uidx
  ON public.tasks (user_id, external_source, external_id)
  WHERE is_deleted = false
    AND external_source IS NOT NULL
    AND external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notion_activation_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation_id text NOT NULL CHECK (char_length(operation_id) BETWEEN 1 AND 200),
  notion_page_id text NOT NULL,
  payload_hash text NOT NULL,
  task_id text NOT NULL REFERENCES public.tasks(id) ON DELETE RESTRICT,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_id)
);

ALTER TABLE public.notion_activation_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own Notion activation receipts"
  ON public.notion_activation_receipts;
CREATE POLICY "Users can read own Notion activation receipts"
  ON public.notion_activation_receipts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own Notion activation receipts"
  ON public.notion_activation_receipts;

GRANT SELECT ON public.notion_activation_receipts TO authenticated;
REVOKE INSERT ON public.notion_activation_receipts FROM authenticated;

CREATE OR REPLACE FUNCTION public.activate_notion_task(
  p_operation_id text,
  p_notion_page_id text,
  p_notion_data_source_id text,
  p_notion_url text,
  p_notion_last_edited_at timestamptz,
  p_title text,
  p_description text DEFAULT '',
  p_priority text DEFAULT NULL,
  p_due_date date DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_work_block jsonb DEFAULT NULL,
  p_preview boolean DEFAULT true,
  p_preview_digest text DEFAULT NULL,
  p_preview_expires_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_receipt public.notion_activation_receipts%ROWTYPE;
  v_existing_task public.tasks%ROWTYPE;
  v_created_task public.tasks%ROWTYPE;
  v_payload jsonb;
  v_payload_hash text;
  v_preview_digest text;
  v_preview_expires_at timestamptz := COALESCE(
    p_preview_expires_at, now() + interval '15 minutes');
  v_instances jsonb := '[]'::jsonb;
  v_response jsonb;
  v_read_back jsonb;
  v_duration integer;
  v_work_date text;
  v_work_time text;
  v_was_existing boolean := false;
  v_block_exists boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'unauthorized', 'message', 'Signed-in user required'));
  END IF;
  IF p_operation_id IS NULL OR btrim(p_operation_id) = ''
     OR char_length(p_operation_id) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'invalid_operation_id', 'message', 'operationId required'));
  END IF;
  IF p_notion_page_id IS NULL OR btrim(p_notion_page_id) = ''
     OR char_length(p_notion_page_id) > 200
     OR p_notion_data_source_id IS NULL OR btrim(p_notion_data_source_id) = ''
     OR char_length(p_notion_data_source_id) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'invalid_provenance', 'message', 'Exact Notion page and data source ids required'));
  END IF;
  IF p_notion_url IS NULL OR p_notion_url !~ '^https://'
     OR char_length(p_notion_url) > 2000 OR p_notion_last_edited_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'invalid_provenance', 'message', 'Notion URL and last-edited timestamp required'));
  END IF;
  IF p_title IS NULL OR btrim(p_title) = '' OR char_length(p_title) > 500
     OR char_length(COALESCE(p_description, '')) > 10000 THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'invalid_task', 'message', 'A bounded task title and description are required'));
  END IF;
  IF p_priority IS NOT NULL AND p_priority NOT IN ('low', 'medium', 'high') THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'invalid_priority', 'message', 'priority must be low, medium, high, or null'));
  END IF;
  IF p_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = p_project_id AND user_id = v_user_id AND is_deleted = false
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'project_not_found', 'message', 'Project is outside the signed-in user scope'));
  END IF;

  IF p_work_block IS NOT NULL THEN
    IF jsonb_typeof(p_work_block) <> 'object'
       OR (p_work_block - ARRAY['scheduledDate', 'scheduledTime', 'duration']) <> '{}'::jsonb THEN
      RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
        'code', 'invalid_work_block', 'message', 'Work block fields are invalid'));
    END IF;
    v_work_date := p_work_block->>'scheduledDate';
    v_work_time := p_work_block->>'scheduledTime';
    IF v_work_date IS NULL OR v_work_date !~ '^\d{4}-\d{2}-\d{2}$'
       OR v_work_time IS NULL OR v_work_time !~ '^([01]\d|2[0-3]):[0-5]\d$'
       OR COALESCE(p_work_block->>'duration', '') !~ '^\d{1,4}$' THEN
      RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
        'code', 'invalid_work_block', 'message', 'Exact date, time, and duration are required'));
    END IF;
    v_duration := (p_work_block->>'duration')::integer;
    IF v_duration < 1 OR v_duration > 1440 THEN
      RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
        'code', 'invalid_work_block', 'message', 'duration must be 1 to 1440 minutes'));
    END IF;
    v_instances := jsonb_build_array(jsonb_build_object(
      'id', gen_random_uuid()::text,
      'scheduledDate', p_work_block->>'scheduledDate',
      'scheduledTime', p_work_block->>'scheduledTime',
      'duration', (p_work_block->>'duration')::integer
    ));
  END IF;

  v_payload := jsonb_build_object(
    'operationId', p_operation_id,
    'notionPageId', p_notion_page_id,
    'notionDataSourceId', p_notion_data_source_id,
    'notionUrl', p_notion_url,
    'notionLastEditedAt', p_notion_last_edited_at,
    'task', jsonb_build_object(
      'title', btrim(p_title),
      'description', COALESCE(p_description, ''),
      'priority', p_priority,
      'dueDate', p_due_date,
      'projectId', p_project_id
    ),
    'workBlock', p_work_block
  );
  v_payload_hash := encode(sha256(convert_to(v_payload::text, 'UTF8')), 'hex');
  v_preview_digest := encode(sha256(convert_to(
    'notion-activation-v1|' || v_payload_hash || '|' ||
    extract(epoch FROM v_preview_expires_at)::numeric::text, 'UTF8')), 'hex');

  SELECT * INTO v_existing_task
  FROM public.tasks
  WHERE user_id = v_user_id
    AND external_source = 'notion'
    AND external_id = p_notion_page_id
    AND is_deleted = false
  LIMIT 1;

  IF p_preview THEN
    RETURN jsonb_build_object(
      'ok', true,
      'result', 'preview',
      'contractVersion', 'notion-activation-v1',
      'operationId', p_operation_id,
      'previewDigest', v_preview_digest,
      'previewExpiresAt', v_preview_expires_at,
      'alreadyActivated', FOUND,
      'normalizedPayload', v_payload,
      'readBack', CASE WHEN FOUND THEN jsonb_build_object(
        'id', v_existing_task.id,
        'title', v_existing_task.title,
        'externalSource', v_existing_task.external_source,
        'externalId', v_existing_task.external_id,
        'instances', COALESCE(v_existing_task.instances, '[]'::jsonb)
      ) ELSE NULL END
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_user_id::text || ':notion:' || p_notion_page_id, 0));
  SELECT * INTO v_existing_receipt
  FROM public.notion_activation_receipts
  WHERE user_id = v_user_id AND operation_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_receipt.payload_hash <> v_payload_hash
       OR v_existing_receipt.notion_page_id <> p_notion_page_id THEN
      RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
        'code', 'idempotency_conflict',
        'message', 'operationId was already used with a different payload'));
    END IF;
    RETURN jsonb_set(v_existing_receipt.response, '{receipt,replayed}', 'true'::jsonb, false);
  END IF;

  IF p_preview_digest IS NULL OR btrim(p_preview_digest) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'preview_required', 'message', 'previewDigest required when preview is false'));
  END IF;
  IF p_preview_expires_at IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'preview_required', 'message', 'previewExpiresAt required when preview is false'));
  END IF;
  IF p_preview_expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'preview_expired', 'message', 'Approved preview expired'));
  END IF;
  IF p_preview_digest <> v_preview_digest THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object(
      'code', 'stale_preview', 'message', 'Activation payload changed since preview'));
  END IF;

  SELECT * INTO v_existing_task
  FROM public.tasks
  WHERE user_id = v_user_id
    AND external_source = 'notion'
    AND external_id = p_notion_page_id
    AND is_deleted = false
  LIMIT 1
  FOR UPDATE;
  v_was_existing := FOUND;

  IF v_was_existing THEN
    IF p_work_block IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(v_existing_task.instances, '[]'::jsonb)) AS item
        WHERE item->>'scheduledDate' = p_work_block->>'scheduledDate'
          AND item->>'scheduledTime' = p_work_block->>'scheduledTime'
          AND item->>'duration' = p_work_block->>'duration'
      ) INTO v_block_exists;
    END IF;
    IF p_work_block IS NOT NULL AND NOT v_block_exists THEN
      UPDATE public.tasks
      SET instances = COALESCE(v_existing_task.instances, '[]'::jsonb) || v_instances,
          updated_at = now()
      WHERE id = v_existing_task.id AND user_id = v_user_id
      RETURNING * INTO v_created_task;
    ELSE
      v_created_task := v_existing_task;
    END IF;
  ELSE
    INSERT INTO public.tasks (
      user_id, project_id, title, description, status, priority, due_date,
      instances, progress, is_deleted, external_source, external_id,
      external_url, external_data_source_id, external_last_edited_at,
      activation_operation_id, created_at, updated_at
    ) VALUES (
      v_user_id, p_project_id, btrim(p_title), COALESCE(p_description, ''),
      'planned', p_priority, p_due_date, v_instances, 0, false, 'notion',
      p_notion_page_id, p_notion_url, p_notion_data_source_id,
      p_notion_last_edited_at, p_operation_id, now(), now()
    )
    RETURNING * INTO v_created_task;
  END IF;

  v_read_back := jsonb_build_object(
    'id', v_created_task.id,
    'title', v_created_task.title,
    'description', COALESCE(v_created_task.description, ''),
    'status', CASE WHEN v_created_task.status = 'done' THEN 'done' ELSE 'todo' END,
    'priority', v_created_task.priority,
    'dueDate', v_created_task.due_date::date,
    'projectId', v_created_task.project_id,
    'instances', COALESCE(v_created_task.instances, '[]'::jsonb),
    'externalSource', v_created_task.external_source,
    'externalId', v_created_task.external_id,
    'externalUrl', v_created_task.external_url,
    'externalDataSourceId', v_created_task.external_data_source_id,
    'externalLastEditedAt', v_created_task.external_last_edited_at,
    'updatedAt', v_created_task.updated_at
  );
  v_response := jsonb_build_object(
    'ok', true,
    'result', 'committed',
    'receipt', jsonb_build_object(
      'contractVersion', 'notion-activation-v1',
      'source', 'notion',
      'externalId', p_notion_page_id,
      'operationId', p_operation_id,
      'entityType', 'task',
      'entityId', v_created_task.id,
      'replayed', false,
      'alreadyActivated', v_was_existing,
      'committedAt', now(),
      'readBack', v_read_back
    )
  );

  INSERT INTO public.notion_activation_receipts (
    user_id, operation_id, notion_page_id, payload_hash, task_id, response
  ) VALUES (
    v_user_id, p_operation_id, p_notion_page_id, v_payload_hash,
    v_created_task.id, v_response
  );
  RETURN v_response;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_notion_task(
  text, text, text, text, timestamptz, text, text, text, date, text,
  jsonb, boolean, text, timestamptz
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_notion_task(
  text, text, text, text, timestamptz, text, text, text, date, text,
  jsonb, boolean, text, timestamptz
) TO authenticated;
