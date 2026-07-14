-- Safe, preview-first duplicate task merge for the signed-in user.
-- Recurring chains are deliberately unsupported until FlowState has product-level
-- series merge semantics. The duplicate remains as a soft-deleted audit record.

CREATE TABLE IF NOT EXISTS public.merge_task_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 200),
  survivor_task_id text NOT NULL,
  duplicate_task_id text NOT NULL,
  payload_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

ALTER TABLE public.merge_task_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own merge task receipts" ON public.merge_task_receipts;
CREATE POLICY "Users can read own merge task receipts"
  ON public.merge_task_receipts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own merge task receipts" ON public.merge_task_receipts;
CREATE POLICY "Users can create own merge task receipts"
  ON public.merge_task_receipts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.merge_task_receipts TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_task_jsonb_arrays(
  p_left jsonb,
  p_right jsonb
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(value ORDER BY source_order, item_order), '[]'::jsonb)
  FROM (
    SELECT DISTINCT ON (item_key)
      value,
      source_order,
      item_order
    FROM (
      SELECT value,
        0 AS source_order,
        ordinality AS item_order,
        COALESCE(NULLIF(value->>'id', ''), 'value:' || value::text) AS item_key
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_left) = 'array' THEN p_left ELSE '[]'::jsonb END
      ) WITH ORDINALITY
      UNION ALL
      SELECT value,
        1 AS source_order,
        ordinality AS item_order,
        COALESCE(NULLIF(value->>'id', ''), 'value:' || value::text) AS item_key
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(p_right) = 'array' THEN p_right ELSE '[]'::jsonb END
      ) WITH ORDINALITY
    ) candidates
    ORDER BY item_key, source_order, item_order
  ) unique_items;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_task_jsonb_arrays(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_task_jsonb_arrays(jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_task_jsonb_id_conflict(
  p_left jsonb,
  p_right jsonb
) RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_left) = 'array' THEN p_left ELSE '[]'::jsonb END) left_item
    JOIN jsonb_array_elements(CASE WHEN jsonb_typeof(p_right) = 'array' THEN p_right ELSE '[]'::jsonb END) right_item
      ON NULLIF(left_item->>'id', '') = NULLIF(right_item->>'id', '')
    WHERE NULLIF(left_item->>'id', '') IS NOT NULL
      AND left_item <> right_item
  );
$$;

REVOKE EXECUTE ON FUNCTION public.merge_task_jsonb_id_conflict(jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_task_jsonb_id_conflict(jsonb, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.retarget_task_jsonb_array(
  p_items jsonb,
  p_from_id text,
  p_to_id text
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(
    item
      || CASE WHEN item->>'taskId' = p_from_id THEN jsonb_build_object('taskId', p_to_id) ELSE '{}'::jsonb END
      || CASE WHEN item->>'parentTaskId' = p_from_id THEN jsonb_build_object('parentTaskId', p_to_id) ELSE '{}'::jsonb END
      || CASE WHEN item->>'task_id' = p_from_id THEN jsonb_build_object('task_id', p_to_id) ELSE '{}'::jsonb END
      || CASE WHEN item->>'parent_task_id' = p_from_id THEN jsonb_build_object('parent_task_id', p_to_id) ELSE '{}'::jsonb END
    ORDER BY ordinality
  ), '[]'::jsonb)
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END)
    WITH ORDINALITY AS entries(item, ordinality);
$$;

REVOKE EXECUTE ON FUNCTION public.retarget_task_jsonb_array(jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.retarget_task_jsonb_array(jsonb, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.merge_tasks(
  p_survivor_task_id text,
  p_duplicate_task_id text,
  p_preview boolean DEFAULT true,
  p_request_id text DEFAULT NULL,
  p_preview_version text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_survivor public.tasks%ROWTYPE;
  v_duplicate public.tasks%ROWTYPE;
  v_existing public.merge_task_receipts%ROWTYPE;
  v_payload_hash text;
  v_preview_version text;
  v_conflicts jsonb := '[]'::jsonb;
  v_transfers jsonb := '[]'::jsonb;
  v_response jsonb;
  v_has_recurring_links boolean := false;
  v_survivor_context boolean := false;
  v_duplicate_context boolean := false;
  v_active_duplicate_timer boolean := false;
  v_live_relation_state jsonb := '{}'::jsonb;
  v_historical_state jsonb := '{}'::jsonb;
  v_comments_count integer := 0;
  v_history_count integer := 0;
  v_links_count integer := 0;
  v_children_count integer := 0;
  v_memory_count integer := 0;
  v_group_count integer := 0;
  v_incoming_dependency_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'unauthorized', 'message', 'Signed-in user required'));
  END IF;
  IF p_survivor_task_id IS NULL OR btrim(p_survivor_task_id) = ''
     OR p_duplicate_task_id IS NULL OR btrim(p_duplicate_task_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'invalid_task_id', 'message', 'Exact survivor and duplicate task ids required'));
  END IF;
  IF p_survivor_task_id = p_duplicate_task_id THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'same_task', 'message', 'Survivor and duplicate must be different tasks'));
  END IF;

  v_payload_hash := encode(sha256(convert_to(
    p_survivor_task_id || '|' || p_duplicate_task_id,
    'UTF8'
  )), 'hex');

  IF NOT p_preview THEN
    IF p_request_id IS NULL OR btrim(p_request_id) = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'request_id_required', 'message', 'requestId required when preview is false'));
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_request_id, 0));
    SELECT * INTO v_existing
      FROM public.merge_task_receipts
      WHERE user_id = v_user_id AND request_id = p_request_id;
    IF FOUND THEN
      IF v_existing.payload_hash <> v_payload_hash
         OR v_existing.survivor_task_id <> p_survivor_task_id
         OR v_existing.duplicate_task_id <> p_duplicate_task_id THEN
        RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'idempotency_conflict', 'message', 'requestId was already used with a different payload'));
      END IF;
      RETURN v_existing.response;
    END IF;
  END IF;

  IF NOT p_preview THEN
    -- Lock in a deterministic order to avoid two opposite merges deadlocking.
    PERFORM 1 FROM public.tasks
      WHERE id::text IN (p_survivor_task_id, p_duplicate_task_id)
        AND user_id = v_user_id
      ORDER BY id::text
      FOR UPDATE;
    PERFORM 1 FROM public.task_comments
      WHERE task_id::text IN (p_survivor_task_id, p_duplicate_task_id)
        AND user_id = v_user_id
      ORDER BY id
      FOR UPDATE;
    PERFORM 1 FROM public.task_contexts
      WHERE task_id::text IN (p_survivor_task_id, p_duplicate_task_id)
        AND user_id = v_user_id
      ORDER BY task_id::text
      FOR UPDATE;
    PERFORM 1 FROM public.project_task_links
      WHERE task_id::text IN (p_survivor_task_id, p_duplicate_task_id)
        AND user_id = v_user_id
      ORDER BY project_id::text, link_type
      FOR UPDATE;
  END IF;

  SELECT * INTO v_survivor FROM public.tasks
    WHERE id::text = p_survivor_task_id
      AND user_id = v_user_id
      AND is_deleted = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'survivor_not_found', 'message', 'Survivor task not found'));
  END IF;

  SELECT * INTO v_duplicate FROM public.tasks
    WHERE id::text = p_duplicate_task_id
      AND user_id = v_user_id
      AND is_deleted = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'duplicate_not_found', 'message', 'Duplicate task not found'));
  END IF;

  IF v_survivor.workspace_id IS DISTINCT FROM v_duplicate.workspace_id THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'workspace_mismatch', 'message', 'Tasks belong to different workspace boundaries'));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE user_id = v_user_id
      AND recurrence_parent_id::text IN (p_survivor_task_id, p_duplicate_task_id)
  ) INTO v_has_recurring_links;

  IF v_survivor.recurrence_rule IS NOT NULL OR v_duplicate.recurrence_rule IS NOT NULL
     OR v_survivor.recurrence IS NOT NULL OR v_duplicate.recurrence IS NOT NULL
     OR (v_survivor.recurring_instances IS NOT NULL AND v_survivor.recurring_instances <> '[]'::jsonb)
     OR (v_duplicate.recurring_instances IS NOT NULL AND v_duplicate.recurring_instances <> '[]'::jsonb)
     OR v_survivor.recurrence_parent_id IS NOT NULL OR v_duplicate.recurrence_parent_id IS NOT NULL
     OR COALESCE(v_survivor.is_completion_record, false)
     OR COALESCE(v_duplicate.is_completion_record, false)
     OR v_has_recurring_links THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object(
      'code', 'recurring_merge_unsupported',
      'message', 'Recurring definitions and occurrence history require explicit series merge semantics'
    ));
  END IF;

  IF v_survivor.project_id IS NOT NULL AND v_duplicate.project_id IS NOT NULL
     AND v_survivor.project_id::text <> v_duplicate.project_id::text THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'project_conflict', 'message', 'Tasks have different projects'));
  END IF;
  IF v_survivor.status IS DISTINCT FROM v_duplicate.status
     OR COALESCE(v_survivor.progress, 0) <> COALESCE(v_duplicate.progress, 0)
     OR COALESCE(v_survivor.completed_pomodoros, 0) <> COALESCE(v_duplicate.completed_pomodoros, 0) THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'completion_state_conflict', 'message', 'Tasks have different status, progress, or completion counts'));
  END IF;
  IF v_survivor.priority IS NOT NULL AND v_duplicate.priority IS NOT NULL
     AND v_survivor.priority IS DISTINCT FROM v_duplicate.priority THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'priority_conflict', 'message', 'Tasks have different priorities'));
  END IF;
  IF v_survivor.lane_id IS NOT NULL AND v_duplicate.lane_id IS NOT NULL
     AND v_survivor.lane_id IS DISTINCT FROM v_duplicate.lane_id THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'lane_conflict', 'message', 'Tasks have different lanes'));
  END IF;
  IF v_survivor.assigned_to IS NOT NULL AND v_duplicate.assigned_to IS NOT NULL
     AND v_survivor.assigned_to IS DISTINCT FROM v_duplicate.assigned_to THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'assignment_conflict', 'message', 'Tasks have different assignees'));
  END IF;
  IF NULLIF(btrim(COALESCE(v_survivor.description, '')), '') IS NOT NULL
     AND NULLIF(btrim(COALESCE(v_duplicate.description, '')), '') IS NOT NULL
     AND v_survivor.description <> v_duplicate.description THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'description_conflict', 'message', 'Tasks have different non-empty descriptions'));
  END IF;
  IF v_survivor.due_date IS NOT NULL AND v_duplicate.due_date IS NOT NULL
     AND v_survivor.due_date <> v_duplicate.due_date THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'due_date_conflict', 'message', 'Tasks have different due dates'));
  END IF;
  IF v_survivor.due_time IS NOT NULL AND v_duplicate.due_time IS NOT NULL
     AND v_survivor.due_time IS DISTINCT FROM v_duplicate.due_time THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'due_time_conflict', 'message', 'Tasks have different due times'));
  END IF;
  IF v_survivor.scheduled_date IS NOT NULL AND v_duplicate.scheduled_date IS NOT NULL
     AND v_survivor.scheduled_date IS DISTINCT FROM v_duplicate.scheduled_date THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'scheduled_date_conflict', 'message', 'Tasks have different scheduled dates'));
  END IF;
  IF v_survivor.scheduled_time IS NOT NULL AND v_duplicate.scheduled_time IS NOT NULL
     AND v_survivor.scheduled_time IS DISTINCT FROM v_duplicate.scheduled_time THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'scheduled_time_conflict', 'message', 'Tasks have different scheduled times'));
  END IF;
  IF v_survivor.position IS NOT NULL AND v_duplicate.position IS NOT NULL
     AND v_survivor.position <> v_duplicate.position THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'canvas_position_conflict', 'message', 'Tasks have different Canvas positions'));
  END IF;
  IF v_duplicate.parent_task_id IS NOT NULL OR v_survivor.parent_task_id IS DISTINCT FROM v_duplicate.parent_task_id THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'parent_hierarchy_conflict', 'message', 'Duplicate task participates in a parent hierarchy'));
  END IF;
  IF COALESCE(jsonb_array_length(to_jsonb(v_duplicate.depends_on)), 0) > 0
     OR (v_duplicate.connection_types IS NOT NULL AND v_duplicate.connection_types <> '{}'::jsonb)
     OR EXISTS (
       SELECT 1 FROM public.tasks dependency_task
       WHERE dependency_task.user_id = v_user_id
         AND dependency_task.is_deleted = false
         AND (
           COALESCE(to_jsonb(dependency_task.depends_on), '[]'::jsonb) @> jsonb_build_array(p_duplicate_task_id)
           OR COALESCE(dependency_task.connection_types, '{}'::jsonb) ? p_duplicate_task_id
         )
     ) THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'dependency_conflict', 'message', 'Duplicate task participates in task dependencies'));
  END IF;
  IF v_survivor.notification_prefs IS NOT NULL AND v_duplicate.notification_prefs IS NOT NULL
     AND v_survivor.notification_prefs IS DISTINCT FROM v_duplicate.notification_prefs THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'notification_preferences_conflict', 'message', 'Tasks have different notification preferences'));
  END IF;
  IF v_survivor.reminders IS NOT NULL AND v_duplicate.reminders IS NOT NULL
     AND v_survivor.reminders IS DISTINCT FROM v_duplicate.reminders THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'reminder_conflict', 'message', 'Tasks have different reminders'));
  END IF;

  IF public.merge_task_jsonb_id_conflict(v_survivor.subtasks, v_duplicate.subtasks) THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'stable_id_collision', 'collection', 'subtasks', 'message', 'Subtasks contain the same id with different data'));
  END IF;
  IF public.merge_task_jsonb_id_conflict(v_survivor.instances, v_duplicate.instances) THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'stable_id_collision', 'collection', 'instances', 'message', 'Instances contain the same id with different data'));
  END IF;
  IF public.merge_task_jsonb_id_conflict(v_survivor.attachments, v_duplicate.attachments) THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'stable_id_collision', 'collection', 'attachments', 'message', 'Attachments contain the same id with different data'));
  END IF;
  IF public.merge_task_jsonb_id_conflict(v_survivor.planning_notes, v_duplicate.planning_notes) THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'stable_id_collision', 'collection', 'planningNotes', 'message', 'Planning notes contain the same id with different data'));
  END IF;
  IF public.merge_task_jsonb_id_conflict(v_survivor.mini_canvas_edges, v_duplicate.mini_canvas_edges) THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'stable_id_collision', 'collection', 'miniCanvasEdges', 'message', 'Mini Canvas edges contain the same id with different data'));
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.task_contexts WHERE task_id::text = p_survivor_task_id AND user_id = v_user_id)
    INTO v_survivor_context;
  SELECT EXISTS (SELECT 1 FROM public.task_contexts WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id)
    INTO v_duplicate_context;
  IF v_survivor_context AND v_duplicate_context THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'task_context_conflict', 'message', 'Both tasks have assistant context'));
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.timer_sessions
    WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id AND is_active = true
  ) INTO v_active_duplicate_timer;
  IF v_active_duplicate_timer THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'active_timer_conflict', 'message', 'Duplicate task has an active timer'));
  END IF;

  SELECT count(*) INTO v_comments_count FROM public.task_comments
    WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id;
  SELECT count(*) INTO v_history_count FROM public.pomodoro_history
    WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id;
  SELECT count(*) INTO v_links_count FROM public.project_task_links
    WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id;
  SELECT count(*) INTO v_children_count FROM public.tasks
    WHERE parent_task_id::text = p_duplicate_task_id AND user_id = v_user_id;
  SELECT count(*) INTO v_memory_count FROM public.ai_context_entities
    WHERE user_id = v_user_id
      AND (canonical_task_id::text IN (p_survivor_task_id, p_duplicate_task_id)
        OR entity_key IN ('task:' || p_survivor_task_id, 'task:' || p_duplicate_task_id));
  SELECT count(*) INTO v_group_count FROM public.groups
    WHERE linked_parent_task_id::text = p_duplicate_task_id AND user_id = v_user_id;
  SELECT count(*) INTO v_incoming_dependency_count FROM public.tasks dependency_task
    WHERE dependency_task.user_id = v_user_id
      AND dependency_task.is_deleted = false
      AND (
        COALESCE(to_jsonb(dependency_task.depends_on), '[]'::jsonb) @> jsonb_build_array(p_duplicate_task_id)
        OR COALESCE(dependency_task.connection_types, '{}'::jsonb) ? p_duplicate_task_id
      );

  IF v_children_count > 0 THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'parent_hierarchy_conflict', 'message', 'Duplicate task has child tasks'));
  END IF;
  IF v_group_count > 0 THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'group_assignment_conflict', 'message', 'Duplicate task has a linked Canvas group'));
  END IF;
  IF v_memory_count > 0 THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'assistant_memory_merge_unsupported', 'message', 'Task-linked assistant memory requires graph-aware merge semantics'));
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.task_comments
    WHERE task_id::text = p_duplicate_task_id
      AND user_id = v_user_id
      AND workspace_id IS DISTINCT FROM v_survivor.workspace_id
  ) THEN
    v_conflicts := v_conflicts || jsonb_build_array(jsonb_build_object('code', 'comment_workspace_mismatch', 'message', 'A duplicate comment belongs to a different workspace boundary'));
  END IF;

  SELECT jsonb_build_object(
    'survivorTask', to_jsonb(v_survivor),
    'duplicateTask', to_jsonb(v_duplicate),
    'comments', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.task_comments c WHERE c.task_id::text IN (p_survivor_task_id, p_duplicate_task_id) AND c.user_id = v_user_id), '[]'::jsonb),
    'contexts', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.task_id::text) FROM public.task_contexts c WHERE c.task_id::text IN (p_survivor_task_id, p_duplicate_task_id) AND c.user_id = v_user_id), '[]'::jsonb),
    'projectLinks', COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.project_id::text, l.link_type, l.task_id::text) FROM public.project_task_links l WHERE l.task_id::text IN (p_survivor_task_id, p_duplicate_task_id) AND l.user_id = v_user_id), '[]'::jsonb),
    'groupCount', v_group_count,
    'memoryCount', v_memory_count,
    'childCount', v_children_count,
    'incomingDependencyCount', v_incoming_dependency_count,
    'activeDuplicateTimer', v_active_duplicate_timer
  ) INTO v_live_relation_state;

  SELECT jsonb_build_object(
    'pomodoroHistoryCount', v_history_count,
    'inactiveTimerCount', (SELECT count(*) FROM public.timer_sessions WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id AND is_active = false),
    'recommendationFeedbackCount', (SELECT count(*) FROM public.ai_recommendation_feedback WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id)
  ) INTO v_historical_state;

  v_transfers := jsonb_build_array(
    jsonb_build_object('kind', 'subtasks', 'count', jsonb_array_length(CASE WHEN jsonb_typeof(v_duplicate.subtasks) = 'array' THEN v_duplicate.subtasks ELSE '[]'::jsonb END)),
    jsonb_build_object('kind', 'instances', 'count', jsonb_array_length(CASE WHEN jsonb_typeof(v_duplicate.instances) = 'array' THEN v_duplicate.instances ELSE '[]'::jsonb END)),
    jsonb_build_object('kind', 'attachments', 'count', jsonb_array_length(CASE WHEN jsonb_typeof(v_duplicate.attachments) = 'array' THEN v_duplicate.attachments ELSE '[]'::jsonb END)),
    jsonb_build_object('kind', 'comments', 'count', v_comments_count),
    jsonb_build_object('kind', 'projectLinks', 'count', v_links_count),
    jsonb_build_object('kind', 'taskContext', 'count', CASE WHEN v_duplicate_context THEN 1 ELSE 0 END)
  );

  v_preview_version := encode(sha256(convert_to(concat_ws('|',
    v_live_relation_state::text, v_conflicts::text, v_transfers::text
  ), 'UTF8')), 'hex');

  IF p_preview THEN
    RETURN jsonb_build_object(
      'ok', true,
      'preview', true,
      'requestId', NULL,
      'previewVersion', v_preview_version,
      'survivor', jsonb_build_object('id', v_survivor.id, 'title', v_survivor.title),
      'duplicate', jsonb_build_object('id', v_duplicate.id, 'title', v_duplicate.title),
      'transfers', v_transfers,
      'preserved', v_historical_state,
      'conflicts', v_conflicts,
      'deletion', jsonb_build_object('mode', 'soft-delete', 'taskId', v_duplicate.id)
    );
  END IF;

  IF p_preview_version IS NULL OR btrim(p_preview_version) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'preview_version_required', 'message', 'previewVersion required when preview is false'));
  END IF;
  IF p_preview_version <> v_preview_version THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'stale_preview', 'message', 'Preview no longer matches current state'));
  END IF;
  IF jsonb_array_length(v_conflicts) > 0 THEN
    IF v_conflicts @> '[{"code":"recurring_merge_unsupported"}]'::jsonb THEN
      RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'recurring_merge_unsupported', 'message', 'Recurring task merge is not supported', 'conflicts', v_conflicts));
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'merge_conflict', 'message', 'Merge has unresolved conflicts', 'conflicts', v_conflicts));
  END IF;

  UPDATE public.tasks SET
    description = CASE WHEN NULLIF(btrim(COALESCE(v_survivor.description, '')), '') IS NULL THEN v_duplicate.description ELSE v_survivor.description END,
    project_id = COALESCE(v_survivor.project_id, v_duplicate.project_id),
    lane_id = COALESCE(v_survivor.lane_id, v_duplicate.lane_id),
    assigned_to = COALESCE(v_survivor.assigned_to, v_duplicate.assigned_to),
    due_date = COALESCE(v_survivor.due_date, v_duplicate.due_date),
    due_time = COALESCE(v_survivor.due_time, v_duplicate.due_time),
    scheduled_date = COALESCE(v_survivor.scheduled_date, v_duplicate.scheduled_date),
    scheduled_time = COALESCE(v_survivor.scheduled_time, v_duplicate.scheduled_time),
    position = COALESCE(v_survivor.position, v_duplicate.position),
    notification_prefs = COALESCE(v_survivor.notification_prefs, v_duplicate.notification_prefs),
    reminders = COALESCE(v_survivor.reminders, v_duplicate.reminders),
    tags = ARRAY(SELECT DISTINCT value FROM unnest(COALESCE(v_survivor.tags, ARRAY[]::text[]) || COALESCE(v_duplicate.tags, ARRAY[]::text[])) value ORDER BY value),
    subtasks = public.merge_task_jsonb_arrays(
      v_survivor.subtasks,
      public.retarget_task_jsonb_array(v_duplicate.subtasks, p_duplicate_task_id, p_survivor_task_id)
    ),
    instances = public.merge_task_jsonb_arrays(
      v_survivor.instances,
      public.retarget_task_jsonb_array(v_duplicate.instances, p_duplicate_task_id, p_survivor_task_id)
    ),
    attachments = public.merge_task_jsonb_arrays(v_survivor.attachments, v_duplicate.attachments),
    planning_notes = public.merge_task_jsonb_arrays(v_survivor.planning_notes, v_duplicate.planning_notes),
    mini_canvas_edges = public.merge_task_jsonb_arrays(
      v_survivor.mini_canvas_edges,
      public.retarget_task_jsonb_array(v_duplicate.mini_canvas_edges, p_duplicate_task_id, p_survivor_task_id)
    ),
    updated_at = now()
  WHERE id::text = p_survivor_task_id AND user_id = v_user_id;

  UPDATE public.task_comments SET task_id = v_survivor.id
    WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id;

  -- Avoid a uniqueness collision when both tasks already have the same project link.
  DELETE FROM public.project_task_links duplicate_link
    WHERE duplicate_link.task_id::text = p_duplicate_task_id
      AND duplicate_link.user_id = v_user_id
      AND EXISTS (
        SELECT 1 FROM public.project_task_links survivor_link
        WHERE survivor_link.task_id::text = p_survivor_task_id
          AND survivor_link.user_id = v_user_id
          AND survivor_link.project_id = duplicate_link.project_id
          AND survivor_link.link_type = duplicate_link.link_type
      );
  UPDATE public.project_task_links SET task_id = v_survivor.id
    WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id;

  IF v_duplicate_context THEN
    UPDATE public.task_contexts SET task_id = v_survivor.id, updated_at = now()
      WHERE task_id::text = p_duplicate_task_id AND user_id = v_user_id;
  END IF;

  UPDATE public.tasks SET
    is_deleted = true,
    deleted_at = now(),
    updated_at = now()
  WHERE id::text = p_duplicate_task_id AND user_id = v_user_id;

  v_response := jsonb_build_object(
    'ok', true,
    'preview', false,
    'previewVersion', v_preview_version,
    'receipt', jsonb_build_object(
      'requestId', p_request_id,
      'survivorTaskId', v_survivor.id,
      'duplicateTaskId', v_duplicate.id,
      'replayed', false,
      'mergedAt', now()
    ),
    'transfers', v_transfers,
    'preserved', v_historical_state,
    'readBack', jsonb_build_object(
      'survivorTaskId', v_survivor.id,
      'duplicateTaskId', v_duplicate.id,
      'duplicateArchived', true
    )
  );

  INSERT INTO public.merge_task_receipts (
    user_id, request_id, survivor_task_id, duplicate_task_id, payload_hash, response
  ) VALUES (
    v_user_id, p_request_id, p_survivor_task_id, p_duplicate_task_id, v_payload_hash, v_response
  );

  RETURN v_response;
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'operation_failed', 'message', 'Merge transaction failed'));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_tasks(text, text, boolean, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_tasks(text, text, boolean, text, text) TO authenticated;
