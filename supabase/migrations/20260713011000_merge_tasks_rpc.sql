-- Safe, approval-gated duplicate-task merge.
-- FlowState previously exposed task duplication and soft deletion, but no merge
-- domain operation. This RPC is the canonical transactional merge seam.

CREATE OR REPLACE FUNCTION public.flowstate_merge_tasks(
  p_survivor_task_id text,
  p_duplicate_task_id text,
  p_preview boolean DEFAULT true,
  p_request_id text DEFAULT NULL,
  p_preview_version text DEFAULT NULL,
  p_workspace_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_survivor public.tasks%ROWTYPE;
  v_duplicate public.tasks%ROWTYPE;
  v_existing_receipt public.flowstate_action_receipts%ROWTYPE;
  v_payload_hash text;
  v_preview_version text;
  v_now timestamptz := clock_timestamp();
  v_comment_count integer := 0;
  v_duplicate_context boolean := false;
  v_survivor_context boolean := false;
  v_instance_transfer_count integer := 0;
  v_subtask_transfer_count integer := 0;
  v_attachment_transfer_count integer := 0;
  v_group_link_count integer := 0;
  v_group_link_type text;
  v_merged_instances jsonb;
  v_merged_subtasks jsonb;
  v_merged_attachments jsonb;
  v_merged_reminders jsonb;
  v_merged_planning_notes jsonb;
  v_merged_mini_canvas_edges jsonb;
  v_receipt jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'not_authenticated', 'message', 'Authentication is required')
    );
  END IF;

  IF nullif(btrim(p_survivor_task_id), '') IS NULL
     OR nullif(btrim(p_duplicate_task_id), '') IS NULL
     OR p_survivor_task_id = p_duplicate_task_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_request',
        'message', 'Distinct exact survivor and duplicate task ids are required'
      )
    );
  END IF;

  IF NOT p_preview
     AND (nullif(btrim(p_request_id), '') IS NULL
          OR nullif(btrim(p_preview_version), '') IS NULL) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'approval_receipt_required',
        'message', 'requestId and previewVersion are required for apply'
      )
    );
  END IF;

  v_payload_hash := encode(
    digest(
      convert_to(
        jsonb_build_object(
          'survivorTaskId', p_survivor_task_id,
          'duplicateTaskId', p_duplicate_task_id,
          'workspaceId', p_workspace_id,
          'previewVersion', p_preview_version
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  IF NOT p_preview THEN
    SELECT * INTO v_existing_receipt
    FROM public.flowstate_action_receipts
    WHERE user_id = v_actor
      AND operation = 'merge_tasks'
      AND request_id = btrim(p_request_id);

    IF FOUND THEN
      IF v_existing_receipt.payload_hash <> v_payload_hash THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'idempotency_conflict',
            'message', 'requestId was already used with a different payload'
          )
        );
      END IF;
      RETURN v_existing_receipt.receipt;
    END IF;
  END IF;

  IF NOT p_preview THEN
    -- Stable lock order prevents survivor/duplicate inversion deadlocks.
    PERFORM 1 FROM public.tasks
    WHERE id IN (p_survivor_task_id, p_duplicate_task_id)
    ORDER BY id
    FOR UPDATE;
  END IF;

  SELECT * INTO v_survivor FROM public.tasks
  WHERE id = p_survivor_task_id AND is_deleted = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'not_found', 'message', 'Merge tasks were not found')
    );
  END IF;

  SELECT * INTO v_duplicate FROM public.tasks
  WHERE id = p_duplicate_task_id AND is_deleted = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'not_found', 'message', 'Merge tasks were not found')
    );
  END IF;

  IF v_survivor.workspace_id IS DISTINCT FROM v_duplicate.workspace_id
     OR v_survivor.workspace_id IS DISTINCT FROM p_workspace_id
     OR (
       p_workspace_id IS NULL
       AND (v_survivor.user_id <> v_actor OR v_duplicate.user_id <> v_actor)
     )
     OR (
       p_workspace_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.workspace_members
         WHERE workspace_id = p_workspace_id AND user_id = v_actor
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.workspaces
         WHERE id = p_workspace_id AND owner_id = v_actor
       )
     ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'not_found', 'message', 'Merge tasks were not found')
    );
  END IF;

  -- An identical call may have committed while this transaction waited.
  IF NOT p_preview THEN
    SELECT * INTO v_existing_receipt
    FROM public.flowstate_action_receipts
    WHERE user_id = v_actor
      AND operation = 'merge_tasks'
      AND request_id = btrim(p_request_id);
    IF FOUND THEN
      IF v_existing_receipt.payload_hash <> v_payload_hash THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', jsonb_build_object(
            'code', 'idempotency_conflict',
            'message', 'requestId was already used with a different payload'
          )
        );
      END IF;
      RETURN v_existing_receipt.receipt;
    END IF;
  END IF;

  IF v_survivor.is_completion_record = true OR v_duplicate.is_completion_record = true THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'incompatible_completion_history',
        'message', 'Completion-history records cannot be merged as living tasks'
      )
    );
  END IF;

  IF v_survivor.recurrence_rule IS DISTINCT FROM v_duplicate.recurrence_rule
     OR v_survivor.recurrence_parent_id IS DISTINCT FROM v_duplicate.recurrence_parent_id
     OR COALESCE(v_survivor.recurrence_count, 0) <> COALESCE(v_duplicate.recurrence_count, 0) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'incompatible_recurrence',
        'message', 'Recurring definitions or chain identities are incompatible'
      )
    );
  END IF;

  IF v_survivor.status IS DISTINCT FROM v_duplicate.status THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'incompatible_status', 'message', 'Task statuses are incompatible')
    );
  END IF;

  IF v_survivor.project_id IS NOT NULL AND v_duplicate.project_id IS NOT NULL
     AND v_survivor.project_id <> v_duplicate.project_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'incompatible_project', 'message', 'Project assignments are incompatible')
    );
  END IF;

  IF v_survivor.position IS NOT NULL AND v_duplicate.position IS NOT NULL
     AND v_survivor.position IS DISTINCT FROM v_duplicate.position THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'incompatible_canvas', 'message', 'Canvas placements are incompatible')
    );
  END IF;

  IF v_survivor.parent_task_id IS NOT NULL AND v_duplicate.parent_task_id IS NOT NULL
     AND v_survivor.parent_task_id <> v_duplicate.parent_task_id THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'incompatible_parent', 'message', 'Parent task relationships are incompatible')
    );
  END IF;

  IF v_survivor.due_date IS NOT NULL AND v_duplicate.due_date IS NOT NULL
     AND v_survivor.due_date IS DISTINCT FROM v_duplicate.due_date THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'incompatible_schedule', 'message', 'Task due dates are incompatible')
    );
  END IF;

  -- Same embedded identifier with different payload would silently discard data.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_survivor.instances, '[]')) s,
         jsonb_array_elements(COALESCE(v_duplicate.instances, '[]')) d
    WHERE nullif(s->>'id', '') = nullif(d->>'id', '') AND s IS DISTINCT FROM d
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'incompatible_instances', 'message', 'Work-block identifiers conflict')
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_survivor.subtasks, '[]')) s,
         jsonb_array_elements(COALESCE(v_duplicate.subtasks, '[]')) d
    WHERE nullif(s->>'id', '') = nullif(d->>'id', '') AND s IS DISTINCT FROM d
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'incompatible_subtasks', 'message', 'Subtask identifiers conflict')
    );
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(v_survivor.attachments, '[]')) s,
         jsonb_array_elements(COALESCE(v_duplicate.attachments, '[]')) d
    WHERE nullif(s->>'id', '') = nullif(d->>'id', '') AND s IS DISTINCT FROM d
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'incompatible_attachments', 'message', 'Attachment identifiers conflict')
    );
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.task_contexts WHERE task_id = v_survivor.id)
    INTO v_survivor_context;
  SELECT EXISTS(SELECT 1 FROM public.task_contexts WHERE task_id = v_duplicate.id)
    INTO v_duplicate_context;
  IF v_survivor_context AND v_duplicate_context THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'incompatible_task_context',
        'message', 'Both tasks have assistant context; an explicit context resolution is required'
      )
    );
  END IF;

  SELECT count(*) INTO v_comment_count FROM public.task_comments
  WHERE task_id = v_duplicate.id;

  SELECT format_type(a.atttypid, a.atttypmod)
  INTO v_group_link_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.groups'::regclass
    AND a.attname = 'linked_parent_task_id'
    AND NOT a.attisdropped;
  EXECUTE
    'SELECT count(*) FROM public.groups '
    || 'WHERE linked_parent_task_id::text = $1 AND workspace_id IS NOT DISTINCT FROM $2'
    INTO v_group_link_count
    USING v_duplicate.id, p_workspace_id;

  IF v_group_link_count > 0
     AND v_group_link_type = 'uuid'
     AND (
       v_survivor.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       OR v_duplicate.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'incompatible_canvas',
        'message', 'Canvas linked-task storage cannot represent these task ids'
      )
    );
  END IF;

  SELECT count(*) INTO v_instance_transfer_count
  FROM jsonb_array_elements(COALESCE(v_duplicate.instances, '[]')) d
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_survivor.instances, '[]')) s WHERE s = d
  );
  SELECT count(*) INTO v_subtask_transfer_count
  FROM jsonb_array_elements(COALESCE(v_duplicate.subtasks, '[]')) d
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_survivor.subtasks, '[]')) s WHERE s = d
  );
  SELECT count(*) INTO v_attachment_transfer_count
  FROM jsonb_array_elements(COALESCE(v_duplicate.attachments, '[]')) d
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(v_survivor.attachments, '[]')) s WHERE s = d
  );

  v_preview_version := encode(
    digest(
      convert_to(
        jsonb_build_object(
          'survivor', jsonb_build_object(
            'id', v_survivor.id, 'updatedAt', v_survivor.updated_at,
            'projectId', v_survivor.project_id, 'position', v_survivor.position,
            'recurrenceRule', v_survivor.recurrence_rule,
            'instances', v_survivor.instances, 'subtasks', v_survivor.subtasks,
            'attachments', v_survivor.attachments
          ),
          'duplicate', jsonb_build_object(
            'id', v_duplicate.id, 'updatedAt', v_duplicate.updated_at,
            'projectId', v_duplicate.project_id, 'position', v_duplicate.position,
            'recurrenceRule', v_duplicate.recurrence_rule,
            'instances', v_duplicate.instances, 'subtasks', v_duplicate.subtasks,
            'attachments', v_duplicate.attachments
          ),
          'comments', v_comment_count,
          'duplicateContext', v_duplicate_context,
          'canvasLinks', v_group_link_count,
          'workspaceId', p_workspace_id
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  IF p_preview THEN
    RETURN jsonb_build_object(
      'ok', true,
      'preview', true,
      'previewVersion', v_preview_version,
      'survivor', jsonb_build_object(
        'id', v_survivor.id,
        'title', v_survivor.title,
        'workspaceId', v_survivor.workspace_id
      ),
      'duplicate', jsonb_build_object(
        'id', v_duplicate.id,
        'title', v_duplicate.title,
        'disposition', 'soft_delete'
      ),
      'transfer', jsonb_build_object(
        'instances', v_instance_transfer_count,
        'subtasks', v_subtask_transfer_count,
        'attachments', v_attachment_transfer_count,
        'taskComments', v_comment_count,
        'taskContext', v_duplicate_context,
        'canvasLinks', v_group_link_count,
        'tags', COALESCE(cardinality(v_duplicate.tags), 0)
      ),
      'preserved', jsonb_build_array(
        'survivor identity and scalar choices',
        'duplicate archived source record',
        'task audit history',
        'recurrence chain metadata'
      )
    );
  END IF;

  IF p_preview_version <> v_preview_version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'state_conflict',
        'message', 'One of the tasks changed after preview; preview the merge again'
      )
    );
  END IF;

  SELECT COALESCE(jsonb_agg(value ORDER BY value::text), '[]'::jsonb)
  INTO v_merged_instances
  FROM (
    SELECT DISTINCT value FROM (
      SELECT value FROM jsonb_array_elements(COALESCE(v_survivor.instances, '[]'))
      UNION ALL
      SELECT value FROM jsonb_array_elements(COALESCE(v_duplicate.instances, '[]'))
    ) all_values
  ) unique_values;

  SELECT COALESCE(jsonb_agg(value ORDER BY value::text), '[]'::jsonb)
  INTO v_merged_subtasks
  FROM (
    SELECT DISTINCT value FROM (
      SELECT value FROM jsonb_array_elements(COALESCE(v_survivor.subtasks, '[]'))
      UNION ALL
      SELECT value FROM jsonb_array_elements(COALESCE(v_duplicate.subtasks, '[]'))
    ) all_values
  ) unique_values;

  SELECT COALESCE(jsonb_agg(value ORDER BY value::text), '[]'::jsonb)
  INTO v_merged_attachments
  FROM (
    SELECT DISTINCT value FROM (
      SELECT value FROM jsonb_array_elements(COALESCE(v_survivor.attachments, '[]'))
      UNION ALL
      SELECT value FROM jsonb_array_elements(COALESCE(v_duplicate.attachments, '[]'))
    ) all_values
  ) unique_values;

  SELECT COALESCE(jsonb_agg(value ORDER BY value::text), '[]'::jsonb)
  INTO v_merged_reminders
  FROM (
    SELECT DISTINCT value FROM (
      SELECT value FROM jsonb_array_elements(COALESCE(v_survivor.reminders, '[]'))
      UNION ALL
      SELECT value FROM jsonb_array_elements(COALESCE(v_duplicate.reminders, '[]'))
    ) all_values
  ) unique_values;

  SELECT COALESCE(jsonb_agg(value ORDER BY value::text), '[]'::jsonb)
  INTO v_merged_planning_notes
  FROM (
    SELECT DISTINCT value FROM (
      SELECT value FROM jsonb_array_elements(COALESCE(v_survivor.planning_notes, '[]'))
      UNION ALL
      SELECT value FROM jsonb_array_elements(COALESCE(v_duplicate.planning_notes, '[]'))
    ) all_values
  ) unique_values;

  SELECT COALESCE(jsonb_agg(value ORDER BY value::text), '[]'::jsonb)
  INTO v_merged_mini_canvas_edges
  FROM (
    SELECT DISTINCT value FROM (
      SELECT value FROM jsonb_array_elements(COALESCE(v_survivor.mini_canvas_edges, '[]'))
      UNION ALL
      SELECT value FROM jsonb_array_elements(COALESCE(v_duplicate.mini_canvas_edges, '[]'))
    ) all_values
  ) unique_values;

  UPDATE public.tasks
  SET description = CASE
        WHEN nullif(btrim(description), '') IS NULL THEN v_duplicate.description
        ELSE description
      END,
      priority = COALESCE(priority, v_duplicate.priority),
      project_id = COALESCE(project_id, v_duplicate.project_id),
      due_date = COALESCE(due_date, v_duplicate.due_date),
      due_time = COALESCE(due_time, v_duplicate.due_time),
      estimated_duration = COALESCE(estimated_duration, v_duplicate.estimated_duration),
      tags = ARRAY(
        SELECT DISTINCT tag
        FROM unnest(COALESCE(v_survivor.tags, ARRAY[]::text[])
                    || COALESCE(v_duplicate.tags, ARRAY[]::text[])) tag
        ORDER BY tag
      ),
      subtasks = v_merged_subtasks,
      instances = v_merged_instances,
      attachments = v_merged_attachments,
      reminders = v_merged_reminders,
      planning_notes = v_merged_planning_notes,
      mini_canvas_edges = v_merged_mini_canvas_edges,
      position = COALESCE(position, v_duplicate.position),
      parent_task_id = COALESCE(parent_task_id, v_duplicate.parent_task_id),
      lane_id = COALESCE(lane_id, v_duplicate.lane_id),
      scheduled_date = COALESCE(scheduled_date, v_duplicate.scheduled_date),
      scheduled_time = COALESCE(scheduled_time, v_duplicate.scheduled_time),
      is_in_inbox = COALESCE(is_in_inbox, false) OR COALESCE(v_duplicate.is_in_inbox, false),
      updated_at = v_now
  WHERE id = v_survivor.id;

  UPDATE public.task_comments SET task_id = v_survivor.id
  WHERE task_id = v_duplicate.id;

  IF v_duplicate_context THEN
    UPDATE public.task_contexts SET task_id = v_survivor.id
    WHERE task_id = v_duplicate.id;
  END IF;

  INSERT INTO public.project_task_links (
    project_id, task_id, user_id, link_type, confidence, source, created_at
  )
  SELECT project_id, v_survivor.id, user_id, link_type, confidence, source, created_at
  FROM public.project_task_links
  WHERE task_id = v_duplicate.id
  ON CONFLICT (project_id, task_id, link_type) DO UPDATE
  SET confidence = greatest(public.project_task_links.confidence, EXCLUDED.confidence),
      source = COALESCE(public.project_task_links.source, EXCLUDED.source);
  DELETE FROM public.project_task_links WHERE task_id = v_duplicate.id;

  UPDATE public.timer_sessions SET task_id = v_survivor.id
  WHERE task_id = v_duplicate.id AND user_id = v_actor;
  UPDATE public.notifications SET task_id = v_survivor.id
  WHERE task_id = v_duplicate.id AND user_id = v_actor;
  UPDATE public.pomodoro_history SET task_id = v_survivor.id
  WHERE task_id = v_duplicate.id AND user_id = v_actor;
  IF v_group_link_count > 0 THEN
    EXECUTE format(
      'UPDATE public.groups SET linked_parent_task_id = $1::%s '
      || 'WHERE linked_parent_task_id::text = $2 AND workspace_id IS NOT DISTINCT FROM $3',
      v_group_link_type
    ) USING v_survivor.id, v_duplicate.id, p_workspace_id;
  END IF;

  -- Archive only after every transfer succeeds. The original duplicate row
  -- remains available to audit/restore and preserves all scalar source data.
  UPDATE public.tasks
  SET is_deleted = true, deleted_at = v_now, updated_at = v_now
  WHERE id = v_duplicate.id;

  v_receipt := jsonb_build_object(
    'ok', true,
    'preview', false,
    'requestId', btrim(p_request_id),
    'previewVersion', v_preview_version,
    'survivor', jsonb_build_object(
      'id', v_survivor.id,
      'status', CASE WHEN v_survivor.status = 'done' THEN 'done' ELSE 'todo' END,
      'instanceCount', jsonb_array_length(v_merged_instances),
      'subtaskCount', jsonb_array_length(v_merged_subtasks),
      'attachmentCount', jsonb_array_length(v_merged_attachments)
    ),
    'duplicate', jsonb_build_object(
      'id', v_duplicate.id,
      'status', 'archived',
      'deletedAt', v_now
    ),
    'transferred', jsonb_build_object(
      'instances', v_instance_transfer_count,
      'subtasks', v_subtask_transfer_count,
      'attachments', v_attachment_transfer_count,
      'taskComments', v_comment_count,
      'taskContext', v_duplicate_context
    )
  );

  INSERT INTO public.flowstate_action_receipts (
    user_id, workspace_id, operation, request_id,
    payload_hash, preview_version, receipt
  ) VALUES (
    v_actor, p_workspace_id, 'merge_tasks', btrim(p_request_id),
    v_payload_hash, v_preview_version, v_receipt
  );

  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_merge_tasks(text, text, boolean, text, text, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_merge_tasks(text, text, boolean, text, text, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.flowstate_merge_tasks(text, text, boolean, text, text, uuid) IS
  'Previews or atomically transfers safe duplicate-task data into an exact survivor and soft-deletes the duplicate.';
