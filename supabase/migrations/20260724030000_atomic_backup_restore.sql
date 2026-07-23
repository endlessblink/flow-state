-- Restore one personal FlowState backup as one idempotent database transaction.
-- Any uncaught error rolls back every entity and the durable receipt together.

CREATE OR REPLACE FUNCTION public.flowstate_restore_backup_v1(
  p_user_id uuid,
  p_operation_id text,
  p_artifact_hash text,
  p_schema_version text,
  p_tasks jsonb DEFAULT '[]'::jsonb,
  p_projects jsonb DEFAULT '[]'::jsonb,
  p_groups jsonb DEFAULT '[]'::jsonb,
  p_tombstones jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_existing_receipt public.flowstate_action_receipts%ROWTYPE;
  v_item jsonb;
  v_task public.tasks%ROWTYPE;
  v_project public.projects%ROWTYPE;
  v_group public.groups%ROWTYPE;
  v_inserted_task_ids text[] := ARRAY[]::text[];
  v_inserted_project_ids text[] := ARRAY[]::text[];
  v_inserted_group_ids text[] := ARRAY[]::text[];
  v_tasks_created integer := 0;
  v_tasks_existing integer := 0;
  v_projects_created integer := 0;
  v_projects_existing integer := 0;
  v_groups_created integer := 0;
  v_groups_existing integer := 0;
  v_tombstones_created integer := 0;
  v_normalized_tasks jsonb;
  v_normalized_projects jsonb;
  v_normalized_groups jsonb;
  v_payload_hash text;
  v_receipt jsonb;
BEGIN
  IF v_actor IS NULL OR p_user_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'restore_not_authorized';
  END IF;
  IF nullif(pg_catalog.btrim(p_operation_id), '') IS NULL
     OR pg_catalog.char_length(p_operation_id) > 200
     OR nullif(pg_catalog.btrim(p_artifact_hash), '') IS NULL
     OR nullif(pg_catalog.btrim(p_schema_version), '') IS NULL
     OR pg_catalog.jsonb_typeof(p_tasks) <> 'array'
     OR pg_catalog.jsonb_typeof(p_projects) <> 'array'
     OR pg_catalog.jsonb_typeof(p_groups) <> 'array'
     OR pg_catalog.jsonb_typeof(p_tombstones) <> 'array' THEN
    RAISE EXCEPTION 'restore_invalid_request';
  END IF;

  -- Bind replay to the exact durable payload, excluding only mapper-generated
  -- update timestamps that legitimately change while retrying a lost response.
  SELECT COALESCE(pg_catalog.jsonb_agg(item.value - 'updated_at'), '[]'::jsonb)
  INTO v_normalized_tasks
  FROM pg_catalog.jsonb_array_elements(p_tasks) AS item(value);
  SELECT COALESCE(pg_catalog.jsonb_agg(item.value - 'updated_at'), '[]'::jsonb)
  INTO v_normalized_projects
  FROM pg_catalog.jsonb_array_elements(p_projects) AS item(value);
  SELECT COALESCE(pg_catalog.jsonb_agg(item.value - 'updated_at'), '[]'::jsonb)
  INTO v_normalized_groups
  FROM pg_catalog.jsonb_array_elements(p_groups) AS item(value);
  v_payload_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'artifactHash', p_artifact_hash,
          'schemaVersion', p_schema_version,
          'tasks', v_normalized_tasks,
          'projects', v_normalized_projects,
          'groups', v_normalized_groups,
          'tombstones', p_tombstones
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  SELECT * INTO v_existing_receipt
  FROM public.flowstate_action_receipts AS receipt
  WHERE receipt.user_id = v_actor
    AND receipt.operation = 'restore_backup'
    AND receipt.request_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_receipt.payload_hash IS DISTINCT FROM v_payload_hash
       OR v_existing_receipt.preview_version IS DISTINCT FROM p_schema_version THEN
      RAISE EXCEPTION 'restore_idempotency_conflict';
    END IF;
    RETURN v_existing_receipt.receipt
      || pg_catalog.jsonb_build_object('replayed', true);
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_actor::text || ':backup-restore', 0)
  );

  SELECT * INTO v_existing_receipt
  FROM public.flowstate_action_receipts AS receipt
  WHERE receipt.user_id = v_actor
    AND receipt.operation = 'restore_backup'
    AND receipt.request_id = p_operation_id;
  IF FOUND THEN
    IF v_existing_receipt.payload_hash IS DISTINCT FROM v_payload_hash
       OR v_existing_receipt.preview_version IS DISTINCT FROM p_schema_version THEN
      RAISE EXCEPTION 'restore_idempotency_conflict';
    END IF;
    RETURN v_existing_receipt.receipt
      || pg_catalog.jsonb_build_object('replayed', true);
  END IF;

  -- This first contract restores personal data only. Shared-workspace ownership
  -- requires an explicit role/attribution policy and therefore fails closed.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_tasks || p_projects || p_groups) AS item(value)
    WHERE item.value->>'workspace_id' IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'restore_workspace_scope_requires_explicit_policy';
  END IF;

  -- Projects are inserted without parents, then linked after every new parent
  -- exists. Existing active rows are current truth and are never overwritten.
  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_projects)
  LOOP
    v_project := pg_catalog.jsonb_populate_record(
      NULL::public.projects,
      v_item || pg_catalog.jsonb_build_object('user_id', v_actor, 'parent_id', NULL)
    );
    IF v_project.id IS NULL OR nullif(pg_catalog.btrim(v_project.name), '') IS NULL THEN
      RAISE EXCEPTION 'restore_invalid_project';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.tombstones
      WHERE user_id = v_actor AND entity_type = 'project' AND entity_id = v_project.id::text
    ) THEN
      RAISE EXCEPTION 'restore_project_tombstoned';
    END IF;
    IF EXISTS (SELECT 1 FROM public.projects WHERE id = v_project.id) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = v_project.id AND user_id = v_actor AND is_deleted = false
      ) THEN
        RAISE EXCEPTION 'restore_project_unavailable';
      END IF;
      v_projects_existing := v_projects_existing + 1;
      CONTINUE;
    END IF;
    INSERT INTO public.projects (
      id, user_id, name, color, color_type, view_type, parent_id, "order",
      is_deleted, deleted_at, created_at, updated_at, workspace_id
    ) VALUES (
      v_project.id, v_actor, v_project.name, v_project.color, v_project.color_type,
      v_project.view_type, NULL, v_project."order", COALESCE(v_project.is_deleted, false),
      v_project.deleted_at, COALESCE(v_project.created_at, pg_catalog.now()),
      COALESCE(v_project.updated_at, pg_catalog.now()), NULL
    );
    v_inserted_project_ids := pg_catalog.array_append(v_inserted_project_ids, v_project.id::text);
    v_projects_created := v_projects_created + 1;
  END LOOP;

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_projects)
  LOOP
    v_project := pg_catalog.jsonb_populate_record(NULL::public.projects, v_item);
    IF v_project.parent_id IS NOT NULL
       AND v_project.id::text = ANY(v_inserted_project_ids) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.projects
        WHERE id = v_project.parent_id AND user_id = v_actor AND is_deleted = false
      ) THEN
        RAISE EXCEPTION 'restore_project_parent_unavailable';
      END IF;
      UPDATE public.projects
      SET parent_id = v_project.parent_id
      WHERE id = v_project.id AND user_id = v_actor;
    END IF;
  END LOOP;

  -- Tasks are likewise inserted parentless first so child-before-parent
  -- artifacts remain valid without weakening the FK.
  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_tasks)
  LOOP
    v_task := pg_catalog.jsonb_populate_record(
      NULL::public.tasks,
      v_item || pg_catalog.jsonb_build_object('user_id', v_actor, 'parent_task_id', NULL)
    );
    IF v_task.id IS NULL OR nullif(pg_catalog.btrim(v_task.title), '') IS NULL THEN
      RAISE EXCEPTION 'restore_invalid_task';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.tombstones
      WHERE user_id = v_actor AND entity_type = 'task' AND entity_id = v_task.id::text
    ) THEN
      RAISE EXCEPTION 'restore_task_tombstoned';
    END IF;
    IF EXISTS (SELECT 1 FROM public.tasks WHERE id = v_task.id) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE id = v_task.id AND user_id = v_actor AND is_deleted = false
      ) THEN
        RAISE EXCEPTION 'restore_task_unavailable';
      END IF;
      v_tasks_existing := v_tasks_existing + 1;
      CONTINUE;
    END IF;
    INSERT INTO public.tasks (
      id, user_id, project_id, lane_id, title, description, status, priority,
      progress, total_pomodoros, completed_pomodoros, estimated_pomodoros,
      due_date, due_time, estimated_duration, subtasks, tags, depends_on,
      position, instances, connection_types, recurrence, recurring_instances,
      notification_prefs, reminders, attachments, planning_notes, mini_canvas_edges,
      recurrence_rule, recurrence_parent_id, recurrence_count, parent_task_id,
      "order", column_id, is_in_inbox, scheduled_date, scheduled_time,
      is_uncategorized, is_deleted, deleted_at, completed_at, created_at, updated_at,
      done_for_now_until, is_completion_record, is_pinned, calendar_locked,
      workspace_id, assigned_to
    ) VALUES (
      v_task.id, v_actor, v_task.project_id, v_task.lane_id, v_task.title,
      v_task.description, v_task.status, v_task.priority, v_task.progress,
      v_task.total_pomodoros, v_task.completed_pomodoros, v_task.estimated_pomodoros,
      v_task.due_date, v_task.due_time, v_task.estimated_duration, v_task.subtasks,
      v_task.tags, v_task.depends_on, v_task.position, v_task.instances,
      v_task.connection_types, v_task.recurrence, v_task.recurring_instances,
      v_task.notification_prefs, v_task.reminders, v_task.attachments,
      v_task.planning_notes, v_task.mini_canvas_edges, v_task.recurrence_rule,
      v_task.recurrence_parent_id, v_task.recurrence_count, NULL, v_task."order",
      v_task.column_id, v_task.is_in_inbox, v_task.scheduled_date,
      v_task.scheduled_time, v_task.is_uncategorized, COALESCE(v_task.is_deleted, false),
      v_task.deleted_at, v_task.completed_at, COALESCE(v_task.created_at, pg_catalog.now()),
      COALESCE(v_task.updated_at, pg_catalog.now()), v_task.done_for_now_until,
      COALESCE(v_task.is_completion_record, false), COALESCE(v_task.is_pinned, false),
      COALESCE(v_task.calendar_locked, false), NULL, v_task.assigned_to
    );
    v_inserted_task_ids := pg_catalog.array_append(v_inserted_task_ids, v_task.id::text);
    v_tasks_created := v_tasks_created + 1;
  END LOOP;

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_tasks)
  LOOP
    v_task := pg_catalog.jsonb_populate_record(NULL::public.tasks, v_item);
    IF v_task.parent_task_id IS NOT NULL
       AND v_task.id::text = ANY(v_inserted_task_ids) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE id = v_task.parent_task_id AND user_id = v_actor AND is_deleted = false
      ) THEN
        RAISE EXCEPTION 'restore_task_parent_unavailable';
      END IF;
      UPDATE public.tasks
      SET parent_task_id = v_task.parent_task_id
      WHERE id = v_task.id AND user_id = v_actor;
    END IF;
  END LOOP;

  -- Groups are inserted unlinked and connected only after their task/group
  -- dependencies are proven visible.
  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_groups)
  LOOP
    v_group := pg_catalog.jsonb_populate_record(
      NULL::public.groups,
      v_item || pg_catalog.jsonb_build_object(
        'user_id', v_actor,
        'parent_group_id', NULL,
        'linked_parent_task_id', NULL
      )
    );
    IF v_group.id IS NULL OR nullif(pg_catalog.btrim(v_group.name), '') IS NULL THEN
      RAISE EXCEPTION 'restore_invalid_group';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.tombstones
      WHERE user_id = v_actor AND entity_type = 'group' AND entity_id = v_group.id::text
    ) THEN
      RAISE EXCEPTION 'restore_group_tombstoned';
    END IF;
    IF EXISTS (SELECT 1 FROM public.groups WHERE id = v_group.id) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = v_group.id AND user_id = v_actor AND is_deleted = false
      ) THEN
        RAISE EXCEPTION 'restore_group_unavailable';
      END IF;
      v_groups_existing := v_groups_existing + 1;
      CONTINUE;
    END IF;
    INSERT INTO public.groups (
      id, user_id, name, type, color, position_json, layout, is_visible,
      is_collapsed, collapsed_height, parent_group_id, linked_parent_task_id,
      filters_json, is_power_mode, power_keyword_json, assign_on_drop_json,
      collect_filter_json, auto_collect, is_pinned, property_value,
      is_deleted, deleted_at, created_at, updated_at, workspace_id
    ) VALUES (
      v_group.id, v_actor, v_group.name, v_group.type, v_group.color,
      v_group.position_json, v_group.layout, v_group.is_visible,
      v_group.is_collapsed, v_group.collapsed_height, NULL, NULL,
      v_group.filters_json, v_group.is_power_mode, v_group.power_keyword_json,
      v_group.assign_on_drop_json, v_group.collect_filter_json,
      v_group.auto_collect, v_group.is_pinned, v_group.property_value,
      COALESCE(v_group.is_deleted, false), v_group.deleted_at,
      COALESCE(v_group.created_at, pg_catalog.now()),
      COALESCE(v_group.updated_at, pg_catalog.now()), NULL
    );
    v_inserted_group_ids := pg_catalog.array_append(v_inserted_group_ids, v_group.id::text);
    v_groups_created := v_groups_created + 1;
  END LOOP;

  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_groups)
  LOOP
    v_group := pg_catalog.jsonb_populate_record(NULL::public.groups, v_item);
    IF v_group.id::text = ANY(v_inserted_group_ids) THEN
      IF v_group.parent_group_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.groups
        WHERE id = v_group.parent_group_id AND user_id = v_actor AND is_deleted = false
      ) THEN
        RAISE EXCEPTION 'restore_group_parent_unavailable';
      END IF;
      IF v_group.linked_parent_task_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.tasks
        WHERE id = v_group.linked_parent_task_id AND user_id = v_actor AND is_deleted = false
      ) THEN
        RAISE EXCEPTION 'restore_group_task_unavailable';
      END IF;
      UPDATE public.groups
      SET parent_group_id = v_group.parent_group_id,
          linked_parent_task_id = v_group.linked_parent_task_id
      WHERE id = v_group.id AND user_id = v_actor;
    END IF;
  END LOOP;

  -- Permanent-deletion markers are last and may never contradict live truth.
  FOR v_item IN SELECT value FROM pg_catalog.jsonb_array_elements(p_tombstones)
  LOOP
    IF v_item->>'entity_type' NOT IN ('task', 'project', 'group', 'lane')
       OR nullif(pg_catalog.btrim(v_item->>'entity_id'), '') IS NULL THEN
      RAISE EXCEPTION 'restore_invalid_tombstone';
    END IF;
    IF (v_item->>'entity_type' = 'task' AND EXISTS (
          SELECT 1 FROM public.tasks
          WHERE id::text = v_item->>'entity_id' AND user_id = v_actor
       ))
       OR (v_item->>'entity_type' = 'project' AND EXISTS (
          SELECT 1 FROM public.projects
          WHERE id::text = v_item->>'entity_id' AND user_id = v_actor
       ))
       OR (v_item->>'entity_type' = 'group' AND EXISTS (
          SELECT 1 FROM public.groups
          WHERE id::text = v_item->>'entity_id' AND user_id = v_actor
       ))
       OR (v_item->>'entity_type' = 'lane' AND EXISTS (
          SELECT 1 FROM public.lanes
          WHERE id::text = v_item->>'entity_id' AND user_id = v_actor
       )) THEN
      RAISE EXCEPTION 'restore_tombstone_contradicts_live_entity';
    END IF;
    INSERT INTO public.tombstones (
      user_id, entity_type, entity_id, deleted_at, expires_at
    ) VALUES (
      v_actor,
      v_item->>'entity_type',
      v_item->>'entity_id',
      pg_catalog.now(),
      CASE WHEN v_item->>'entity_type' = 'task'
        THEN NULL
        ELSE pg_catalog.now() + interval '90 days'
      END
    )
    ON CONFLICT (entity_type, entity_id, user_id) DO NOTHING;
    IF FOUND THEN
      v_tombstones_created := v_tombstones_created + 1;
    END IF;
  END LOOP;

  v_receipt := pg_catalog.jsonb_build_object(
    'ok', true,
    'operationId', p_operation_id,
    'artifactHash', p_artifact_hash,
    'schemaVersion', p_schema_version,
    'tasksCreated', v_tasks_created,
    'tasksExisting', v_tasks_existing,
    'projectsCreated', v_projects_created,
    'projectsExisting', v_projects_existing,
    'groupsCreated', v_groups_created,
    'groupsExisting', v_groups_existing,
    'tombstonesCreated', v_tombstones_created,
    'replayed', false
  );

  INSERT INTO public.flowstate_action_receipts (
    user_id, workspace_id, operation, request_id, payload_hash,
    preview_version, receipt
  ) VALUES (
    v_actor, NULL, 'restore_backup', p_operation_id, v_payload_hash,
    p_schema_version, v_receipt
  );

  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_restore_backup_v1(
  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_restore_backup_v1(
  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) TO authenticated;

COMMENT ON FUNCTION public.flowstate_restore_backup_v1(
  uuid, text, text, text, jsonb, jsonb, jsonb, jsonb
) IS 'Idempotently restores one personal backup in one all-or-nothing transaction.';

NOTIFY pgrst, 'reload schema';
