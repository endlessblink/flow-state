-- TASK-1957: atomically reconcile an explicitly approved root-task cadence
-- while reusing the canonical duplicate merge transaction.

CREATE OR REPLACE FUNCTION public.flowstate_valid_recurrence_resolution(p_rule jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_pattern text;
  v_end_type text;
  v_interval integer;
  v_month_day integer;
  v_nth integer;
  v_day integer;
BEGIN
  IF p_rule IS NULL OR jsonb_typeof(p_rule) <> 'object' THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_rule) key
    WHERE key NOT IN (
      'pattern', 'interval', 'weekdays', 'monthDay', 'monthWeekday',
      'endType', 'endDate', 'endCount'
    )
  ) THEN
    RETURN false;
  END IF;

  v_pattern := p_rule->>'pattern';
  v_end_type := p_rule->>'endType';
  IF v_pattern NOT IN ('daily', 'weekly', 'monthly', 'yearly')
     OR v_end_type NOT IN ('never', 'after_count', 'on_date')
     OR jsonb_typeof(p_rule->'interval') <> 'number'
     OR (p_rule->>'interval') !~ '^[0-9]+$' THEN
    RETURN false;
  END IF;
  v_interval := (p_rule->>'interval')::integer;
  IF v_interval < 1 OR v_interval > 365 THEN
    RETURN false;
  END IF;

  IF v_end_type = 'never' AND (p_rule ? 'endDate' OR p_rule ? 'endCount') THEN
    RETURN false;
  ELSIF v_end_type = 'after_count' THEN
    IF p_rule ? 'endDate'
       OR jsonb_typeof(p_rule->'endCount') <> 'number'
       OR (p_rule->>'endCount') !~ '^[0-9]+$'
       OR (p_rule->>'endCount')::integer < 1 THEN
      RETURN false;
    END IF;
  ELSIF v_end_type = 'on_date' THEN
    IF p_rule ? 'endCount'
       OR COALESCE(p_rule->>'endDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
       OR to_char((p_rule->>'endDate')::date, 'YYYY-MM-DD') <> p_rule->>'endDate' THEN
      RETURN false;
    END IF;
  END IF;

  IF v_pattern IN ('daily', 'yearly')
     AND (p_rule ? 'weekdays' OR p_rule ? 'monthDay' OR p_rule ? 'monthWeekday') THEN
    RETURN false;
  ELSIF v_pattern = 'weekly' THEN
    IF p_rule ? 'monthDay' OR p_rule ? 'monthWeekday'
       OR jsonb_typeof(p_rule->'weekdays') <> 'array'
       OR jsonb_array_length(p_rule->'weekdays') = 0
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(p_rule->'weekdays') value
         WHERE jsonb_typeof(value) <> 'number'
            OR value::text !~ '^[0-6]$'
       )
       OR (
         SELECT count(*) FROM jsonb_array_elements(p_rule->'weekdays')
       ) <> (
         SELECT count(DISTINCT value) FROM jsonb_array_elements(p_rule->'weekdays') value
       ) THEN
      RETURN false;
    END IF;
  ELSIF v_pattern = 'monthly' THEN
    IF p_rule ? 'weekdays' OR (p_rule ? 'monthDay') = (p_rule ? 'monthWeekday') THEN
      RETURN false;
    END IF;
    IF p_rule ? 'monthDay' THEN
      IF jsonb_typeof(p_rule->'monthDay') <> 'number'
         OR (p_rule->>'monthDay') !~ '^[0-9]+$' THEN
        RETURN false;
      END IF;
      v_month_day := (p_rule->>'monthDay')::integer;
      IF v_month_day < 1 OR v_month_day > 31 THEN
        RETURN false;
      END IF;
    ELSE
      IF jsonb_typeof(p_rule->'monthWeekday') <> 'object'
         OR (SELECT count(*) FROM jsonb_object_keys(p_rule->'monthWeekday')) <> 2
         OR NOT (p_rule->'monthWeekday' ? 'nth')
         OR NOT (p_rule->'monthWeekday' ? 'day')
         OR jsonb_typeof(p_rule->'monthWeekday'->'nth') <> 'number'
         OR jsonb_typeof(p_rule->'monthWeekday'->'day') <> 'number'
         OR (p_rule #>> '{monthWeekday,nth}') !~ '^-?[0-9]+$'
         OR (p_rule #>> '{monthWeekday,day}') !~ '^[0-9]+$' THEN
        RETURN false;
      END IF;
      v_nth := (p_rule #>> '{monthWeekday,nth}')::integer;
      v_day := (p_rule #>> '{monthWeekday,day}')::integer;
      IF v_nth NOT IN (-1, 1, 2, 3, 4, 5) OR v_day < 0 OR v_day > 6 THEN
        RETURN false;
      END IF;
    END IF;
  END IF;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_valid_recurrence_resolution(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_valid_recurrence_resolution(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.flowstate_merge_tasks_with_recurrence(
  p_survivor_task_id text,
  p_duplicate_task_id text,
  p_recurrence_resolution jsonb,
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
  v_inner_preview jsonb;
  v_inner_apply jsonb;
  v_payload_hash text;
  v_preview_version text;
  v_internal_request_id text;
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
      'error', jsonb_build_object('code', 'invalid_request', 'message', 'Distinct exact task ids are required')
    );
  END IF;
  IF NOT public.flowstate_valid_recurrence_resolution(p_recurrence_resolution) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'invalid_recurrence_resolution',
        'message', 'recurrenceResolution is not a canonical FlowState recurrence rule'
      )
    );
  END IF;
  IF NOT p_preview AND (
    nullif(btrim(p_request_id), '') IS NULL
    OR nullif(btrim(p_preview_version), '') IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'approval_receipt_required',
        'message', 'requestId and previewVersion are required for apply'
      )
    );
  END IF;

  v_payload_hash := encode(digest(convert_to(jsonb_build_object(
    'survivorTaskId', p_survivor_task_id,
    'duplicateTaskId', p_duplicate_task_id,
    'recurrenceResolution', p_recurrence_resolution,
    'workspaceId', p_workspace_id,
    'previewVersion', p_preview_version
  )::text, 'UTF8'), 'sha256'), 'hex');

  IF NOT p_preview THEN
    -- Serialize this user-scoped operation identity even when two callers use
    -- the same request id against different task pairs.
    PERFORM pg_advisory_xact_lock(hashtextextended(
      v_actor::text || '|merge_tasks_recurrence|' || btrim(p_request_id),
      0
    ));

    SELECT * INTO v_existing_receipt
    FROM public.flowstate_action_receipts
    WHERE user_id = v_actor
      AND operation = 'merge_tasks_recurrence'
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

    PERFORM 1 FROM public.tasks
    WHERE id::text IN (p_survivor_task_id, p_duplicate_task_id)
    ORDER BY id::text
    FOR UPDATE;

    -- A concurrent identical apply may have committed while this call waited
    -- for task locks. Re-read the durable receipt before inspecting task state.
    SELECT * INTO v_existing_receipt
    FROM public.flowstate_action_receipts
    WHERE user_id = v_actor
      AND operation = 'merge_tasks_recurrence'
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

  SELECT * INTO v_survivor FROM public.tasks
  WHERE id::text = p_survivor_task_id AND is_deleted = false;
  SELECT * INTO v_duplicate FROM public.tasks
  WHERE id::text = p_duplicate_task_id AND is_deleted = false;

  IF v_survivor.id IS NULL OR v_duplicate.id IS NULL
     OR v_survivor.workspace_id IS DISTINCT FROM v_duplicate.workspace_id
     OR v_survivor.workspace_id IS DISTINCT FROM p_workspace_id
     OR (
       p_workspace_id IS NULL
       AND (v_survivor.user_id <> v_actor OR v_duplicate.user_id <> v_actor)
     )
     OR (
       p_workspace_id IS NOT NULL
       AND NOT public.flowstate_can_write_workspace_v1(p_workspace_id)
     ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object('code', 'not_found', 'message', 'Merge tasks were not found')
    );
  END IF;

  IF v_survivor.recurrence_parent_id IS NOT NULL
     OR v_duplicate.recurrence_parent_id IS NOT NULL
     OR COALESCE(v_survivor.recurrence_count, 0) <> 0
     OR COALESCE(v_duplicate.recurrence_count, 0) <> 0
     OR COALESCE(v_survivor.is_completion_record, false)
     OR COALESCE(v_duplicate.is_completion_record, false)
     OR v_survivor.recurrence IS NOT NULL
     OR v_duplicate.recurrence IS NOT NULL
     OR (v_survivor.recurring_instances IS NOT NULL AND v_survivor.recurring_instances <> '[]'::jsonb)
     OR (v_duplicate.recurring_instances IS NOT NULL AND v_duplicate.recurring_instances <> '[]'::jsonb)
     OR EXISTS (
       SELECT 1 FROM public.tasks
       WHERE recurrence_parent_id::text IN (p_survivor_task_id, p_duplicate_task_id)
     ) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'recurrence_history_unsupported',
        'message', 'Established recurrence chains or completion history cannot be merged'
      )
    );
  END IF;

  -- Ask the existing merge operation for its complete preview with only the
  -- root cadence fields temporarily hidden. The forced exception rolls back
  -- the temporary writes and every trigger side effect before returning.
  BEGIN
    UPDATE public.tasks SET recurrence_rule = NULL
    WHERE id IN (v_survivor.id, v_duplicate.id);
    v_inner_preview := public.flowstate_merge_tasks(
      p_survivor_task_id,
      p_duplicate_task_id,
      true,
      NULL,
      NULL,
      p_workspace_id
    );
    RAISE EXCEPTION 'flowstate recurrence preview rollback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'flowstate recurrence preview rollback' THEN
      RAISE;
    END IF;
  END;

  IF v_inner_preview #>> '{ok}' <> 'true' THEN
    RETURN v_inner_preview;
  END IF;

  v_preview_version := encode(digest(convert_to(jsonb_build_object(
    -- The base preview version is volatile because the temporary cadence hide
    -- fires updated_at triggers. Its remaining preview body is stable and
    -- binds comments, context, Canvas links, timers, notifications, memory,
    -- histories, and transfer counts to the exact approval.
    'innerPreviewContract', v_inner_preview - 'previewVersion',
    'survivorUpdatedAt', v_survivor.updated_at,
    'duplicateUpdatedAt', v_duplicate.updated_at,
    'survivorRecurrenceRule', v_survivor.recurrence_rule,
    'duplicateRecurrenceRule', v_duplicate.recurrence_rule,
    'recurrenceResolution', p_recurrence_resolution,
    'workspaceId', p_workspace_id
  )::text, 'UTF8'), 'sha256'), 'hex');

  IF p_preview THEN
    RETURN v_inner_preview || jsonb_build_object(
      'previewVersion', v_preview_version,
      'recurrenceResolution', p_recurrence_resolution,
      'recurrenceReconciliation', jsonb_build_object(
        'mode', 'replace_root_cadence',
        'survivorPreviousRule', v_survivor.recurrence_rule,
        'duplicatePreviousRule', v_duplicate.recurrence_rule,
        'duplicateSourcePreserved', true
      )
    );
  END IF;

  IF p_preview_version <> v_preview_version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', jsonb_build_object(
        'code', 'state_conflict',
        'message', 'One of the tasks or the recurrence resolution changed after preview'
      )
    );
  END IF;

  v_internal_request_id := 'rr-' || substr(encode(digest(convert_to(
    v_actor::text || '|' || btrim(p_request_id) || '|' || v_preview_version,
    'UTF8'
  ), 'sha256'), 'hex'), 1, 60);

  BEGIN
    UPDATE public.tasks SET recurrence_rule = NULL
    WHERE id IN (v_survivor.id, v_duplicate.id);

    v_inner_apply := public.flowstate_merge_tasks(
      p_survivor_task_id,
      p_duplicate_task_id,
      false,
      v_internal_request_id,
      v_inner_preview->>'previewVersion',
      p_workspace_id
    );
    IF v_inner_apply #>> '{ok}' <> 'true' THEN
      RAISE EXCEPTION 'flowstate recurrence apply rollback';
    END IF;

    UPDATE public.tasks
    SET recurrence_rule = p_recurrence_resolution,
        recurrence_parent_id = NULL,
        recurrence_count = 0,
        updated_at = clock_timestamp()
    WHERE id = v_survivor.id;

    UPDATE public.tasks
    SET recurrence_rule = v_duplicate.recurrence_rule,
        recurrence_parent_id = v_duplicate.recurrence_parent_id,
        recurrence_count = v_duplicate.recurrence_count
    WHERE id = v_duplicate.id;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'flowstate recurrence apply rollback' THEN
      RETURN v_inner_apply;
    END IF;
    RAISE;
  END;

  v_receipt := v_inner_apply || jsonb_build_object(
    'requestId', btrim(p_request_id),
    'previewVersion', v_preview_version,
    'recurrenceResolution', p_recurrence_resolution,
    'readBack', jsonb_build_object(
      'survivorTaskId', v_survivor.id,
      'duplicateTaskId', v_duplicate.id,
      'duplicateArchived', true,
      'recurrenceRule', p_recurrence_resolution
    )
  );

  INSERT INTO public.flowstate_action_receipts (
    user_id, workspace_id, operation, request_id,
    payload_hash, preview_version, receipt
  ) VALUES (
    v_actor, p_workspace_id, 'merge_tasks_recurrence', btrim(p_request_id),
    v_payload_hash, v_preview_version, v_receipt
  );

  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_merge_tasks_with_recurrence(
  text, text, jsonb, boolean, text, text, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_merge_tasks_with_recurrence(
  text, text, jsonb, boolean, text, text, uuid
) TO authenticated;

COMMENT ON FUNCTION public.flowstate_merge_tasks_with_recurrence(
  text, text, jsonb, boolean, text, text, uuid
) IS 'Previews or atomically merges safe root duplicates while applying one explicitly approved canonical recurrence rule.';

NOTIFY pgrst, 'reload schema';
