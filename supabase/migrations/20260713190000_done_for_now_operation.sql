-- TASK-1532: one transactional, user-scoped authority for recurring "Done for now".
-- The living task keeps its id and recurrence definition. A completed occurrence is
-- a separate task row with is_completion_record=true. Durable receipts make retries
-- safe across Local API, renderer, and process restarts.

CREATE TABLE IF NOT EXISTS public.done_for_now_receipts (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 200),
  task_id text NOT NULL,
  payload_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);

ALTER TABLE public.done_for_now_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own done for now receipts" ON public.done_for_now_receipts;
CREATE POLICY "Users can read own done for now receipts"
  ON public.done_for_now_receipts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own done for now receipts" ON public.done_for_now_receipts;
CREATE POLICY "Users can create own done for now receipts"
  ON public.done_for_now_receipts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.done_for_now_receipts TO authenticated;

CREATE OR REPLACE FUNCTION public.compute_next_recurring_due_date(
  p_current date,
  p_rule jsonb,
  p_next_count integer
) RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_pattern text := p_rule->>'pattern';
  v_interval integer := GREATEST(COALESCE((p_rule->>'interval')::integer, 1), 1);
  v_next date;
  v_current_dow integer := EXTRACT(DOW FROM p_current)::integer;
  v_next_dow integer;
  v_first_dow integer;
  v_month_start date;
  v_month_end date;
  v_month_day integer;
  v_weekday integer;
  v_nth integer;
BEGIN
  IF p_rule IS NULL THEN RETURN NULL; END IF;
  IF p_rule->>'endType' = 'after_count'
     AND p_rule ? 'endCount'
     AND p_next_count >= (p_rule->>'endCount')::integer THEN
    RETURN NULL;
  END IF;

  CASE v_pattern
    WHEN 'daily' THEN
      v_next := p_current + v_interval;
    WHEN 'weekly' THEN
      IF jsonb_typeof(p_rule->'weekdays') = 'array' AND jsonb_array_length(p_rule->'weekdays') > 0 THEN
        SELECT min(value::integer) FILTER (WHERE value::integer > v_current_dow), min(value::integer)
          INTO v_next_dow, v_first_dow
          FROM jsonb_array_elements_text(p_rule->'weekdays');
        IF v_next_dow IS NOT NULL THEN
          v_next := p_current + (v_next_dow - v_current_dow);
        ELSE
          v_next := p_current + (7 * v_interval - v_current_dow + v_first_dow);
        END IF;
      ELSE
        v_next := p_current + (7 * v_interval);
      END IF;
    WHEN 'monthly' THEN
      v_month_start := (date_trunc('month', p_current)::date + make_interval(months => v_interval))::date;
      v_month_end := (v_month_start + interval '1 month - 1 day')::date;
      IF p_rule ? 'monthDay' AND (p_rule->>'monthDay') IS NOT NULL THEN
        v_month_day := GREATEST((p_rule->>'monthDay')::integer, 1);
        v_next := v_month_start + (LEAST(v_month_day, EXTRACT(DAY FROM v_month_end)::integer) - 1);
      ELSIF jsonb_typeof(p_rule->'monthWeekday') = 'object' THEN
        v_weekday := (p_rule->'monthWeekday'->>'day')::integer;
        v_nth := (p_rule->'monthWeekday'->>'nth')::integer;
        v_next := v_month_start + ((v_weekday - EXTRACT(DOW FROM v_month_start)::integer + 7) % 7);
        IF v_nth = -1 THEN
          WHILE v_next + 7 <= v_month_end LOOP v_next := v_next + 7; END LOOP;
        ELSE
          v_next := v_next + (GREATEST(v_nth, 1) - 1) * 7;
          IF v_next > v_month_end THEN RETURN NULL; END IF;
        END IF;
      ELSE
        v_next := v_month_start + (LEAST(EXTRACT(DAY FROM p_current)::integer, EXTRACT(DAY FROM v_month_end)::integer) - 1);
      END IF;
    WHEN 'yearly' THEN
      v_next := (p_current + make_interval(years => v_interval))::date;
    ELSE
      RETURN NULL;
  END CASE;

  IF p_rule->>'endType' = 'on_date'
     AND NULLIF(p_rule->>'endDate', '') IS NOT NULL
     AND v_next > (p_rule->>'endDate')::date THEN
    RETURN NULL;
  END IF;
  RETURN v_next;
END;
$$;

CREATE OR REPLACE FUNCTION public.done_for_now_task(
  p_task_id text,
  p_preview boolean DEFAULT true,
  p_request_id text DEFAULT NULL,
  p_preview_version text DEFAULT NULL,
  p_next_due_date date DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
  v_living_after public.tasks%ROWTYPE;
  v_completion_after public.tasks%ROWTYPE;
  v_existing public.done_for_now_receipts%ROWTYPE;
  v_current_due_date date;
  v_cadence_due_date date;
  v_next_due_date date;
  v_next_count integer;
  v_preview_version text;
  v_payload_hash text;
  v_chain_id text;
  v_matching_instances jsonb := '[]'::jsonb;
  v_completion_instances jsonb := '[]'::jsonb;
  v_next_instances jsonb := '[]'::jsonb;
  v_reset_subtasks jsonb := '[]'::jsonb;
  v_completion_id text := gen_random_uuid()::text;
  v_response jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'unauthorized', 'message', 'Signed-in user required'));
  END IF;
  IF p_task_id IS NULL OR btrim(p_task_id) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'invalid_task_id', 'message', 'Exact task id required'));
  END IF;

  v_payload_hash := encode(sha256(convert_to(p_task_id || '|' || COALESCE(p_next_due_date::text, ''), 'UTF8')), 'hex');

  IF NOT p_preview THEN
    IF p_request_id IS NULL OR btrim(p_request_id) = '' THEN
      RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'request_id_required', 'message', 'requestId required when preview is false'));
    END IF;
    -- Serialize concurrent retries before checking the durable receipt. Without
    -- this lock, two identical requests can both miss the receipt and the loser
    -- can observe the already-advanced occurrence instead of replaying it.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_request_id, 0));
    SELECT * INTO v_existing
      FROM public.done_for_now_receipts
      WHERE user_id = v_user_id AND request_id = p_request_id;
    IF FOUND THEN
      IF v_existing.payload_hash <> v_payload_hash OR v_existing.task_id <> p_task_id THEN
        RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'idempotency_conflict', 'message', 'requestId was already used with a different payload'));
      END IF;
      RETURN v_existing.response;
    END IF;
  END IF;

  SELECT * INTO v_task
    FROM public.tasks
    WHERE id::text = p_task_id
      AND user_id = v_user_id
      AND is_deleted = false
      AND COALESCE(is_completion_record, false) = false
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'task_not_found', 'message', 'Task not found'));
  END IF;
  IF v_task.recurrence_rule IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'non_recurring_task', 'message', 'Done for now requires a recurring task'));
  END IF;
  IF v_task.status = 'done' THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'occurrence_already_completed', 'message', 'Current occurrence is already completed'));
  END IF;
  IF v_task.due_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'missing_occurrence_date', 'message', 'Recurring task has no current occurrence date'));
  END IF;

  v_current_due_date := v_task.due_date::date;
  v_next_count := COALESCE(v_task.recurrence_count, 0) + 1;
  v_cadence_due_date := public.compute_next_recurring_due_date(v_current_due_date, v_task.recurrence_rule, v_next_count);
  IF v_cadence_due_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'recurrence_ended', 'message', 'Recurrence has no next occurrence'));
  END IF;
  IF p_next_due_date IS NOT NULL AND p_next_due_date <= v_current_due_date THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'invalid_next_due_date', 'message', 'Next occurrence must be after the completed occurrence'));
  END IF;
  v_next_due_date := COALESCE(p_next_due_date, v_cadence_due_date);
  v_preview_version := encode(sha256(convert_to(
    concat_ws('|', v_task.id, v_task.updated_at::text, v_current_due_date::text,
      COALESCE(v_task.recurrence_count, 0)::text, v_task.recurrence_rule::text, v_next_due_date::text),
    'UTF8'
  )), 'hex');

  IF p_preview THEN
    RETURN jsonb_build_object(
      'ok', true,
      'preview', true,
      'requestId', NULL,
      'previewVersion', v_preview_version,
      'task', jsonb_build_object('id', v_task.id, 'title', v_task.title),
      'currentOccurrence', jsonb_build_object(
        'occurrenceKey', v_task.id::text || ':' || COALESCE(v_task.recurrence_count, 0)::text,
        'dueDate', v_current_due_date,
        'statusBefore', 'todo',
        'statusAfter', 'done'
      ),
      'recurrence', jsonb_build_object(
        'nextDueDateBefore', v_cadence_due_date,
        'nextDueDateAfter', v_next_due_date,
        'cadencePreserved', v_task.recurrence_rule IS NOT NULL,
        'overrideApplied', p_next_due_date IS NOT NULL
      ),
      'willWrite', jsonb_build_array('current occurrence completion', 'completion history', 'next occurrence schedule')
    );
  END IF;

  IF p_preview_version IS NULL OR btrim(p_preview_version) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'preview_version_required', 'message', 'previewVersion required when preview is false'));
  END IF;
  IF p_preview_version <> v_preview_version THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'stale_preview', 'message', 'Preview no longer matches current state'));
  END IF;

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb) INTO v_matching_instances
    FROM jsonb_array_elements(COALESCE(v_task.instances, '[]'::jsonb)) item
    WHERE item->>'scheduledDate' = v_current_due_date::text;
  SELECT COALESCE(jsonb_agg(item || jsonb_build_object('status', 'completed')), '[]'::jsonb)
    INTO v_completion_instances
    FROM jsonb_array_elements(v_matching_instances) item;
  IF jsonb_array_length(v_matching_instances) > 0 THEN
    SELECT COALESCE(jsonb_agg(
      item || jsonb_build_object(
        'id', 'instance-' || v_task.id || '-' || gen_random_uuid()::text,
        'taskId', v_task.id,
        'scheduledDate', v_next_due_date::text,
        'status', 'scheduled'
      )
    ), '[]'::jsonb) INTO v_next_instances
      FROM jsonb_array_elements(v_matching_instances) item;
  END IF;
  SELECT COALESCE(jsonb_agg(item || jsonb_build_object('isCompleted', false, 'updatedAt', now())), '[]'::jsonb)
    INTO v_reset_subtasks
    FROM jsonb_array_elements(COALESCE(v_task.subtasks, '[]'::jsonb)) item;

  v_chain_id := COALESCE(v_task.recurrence_parent_id, v_task.id);

  UPDATE public.tasks SET
    status = 'planned',
    progress = 0,
    completed_at = NULL,
    due_date = v_next_due_date,
    scheduled_date = CASE WHEN v_task.scheduled_date IS NULL THEN NULL ELSE v_next_due_date::timestamptz END,
    recurrence_count = v_next_count,
    recurrence_rule = v_task.recurrence_rule,
    instances = v_next_instances,
    subtasks = v_reset_subtasks,
    position = NULL,
    is_in_inbox = true,
    updated_at = now()
  WHERE id = v_task.id AND user_id = v_user_id;

  INSERT INTO public.tasks
  SELECT (jsonb_populate_record(
    NULL::public.tasks,
    to_jsonb(v_task) || jsonb_build_object(
      'id', v_completion_id,
      'status', 'done',
      'progress', 100,
      'completed_at', now(),
      'due_date', v_current_due_date,
      'scheduled_date', CASE WHEN v_task.scheduled_date IS NULL THEN NULL ELSE v_current_due_date END,
      'recurrence_parent_id', v_chain_id,
      'recurrence_count', COALESCE(v_task.recurrence_count, 0),
      'recurrence_rule', NULL,
      'is_completion_record', true,
      'instances', v_completion_instances,
      'recurring_instances', '[]'::jsonb,
      'position', NULL,
      'is_in_inbox', false,
      'is_pinned', false,
      'done_for_now_until', NULL,
      'created_at', now(),
      'updated_at', now()
    )
  )).*;

  SELECT * INTO v_living_after
    FROM public.tasks
    WHERE id::text = v_task.id::text AND user_id = v_user_id;
  SELECT * INTO v_completion_after
    FROM public.tasks
    WHERE id::text = v_completion_id AND user_id = v_user_id;

  v_response := jsonb_build_object(
    'ok', true,
    'preview', false,
    'requestId', p_request_id,
    'previewVersion', v_preview_version,
    'receipt', jsonb_build_object(
      'requestId', p_request_id,
      'taskId', v_task.id,
      'completedOccurrenceId', v_completion_id,
      'completedOccurrenceKey', v_task.id::text || ':' || COALESCE(v_task.recurrence_count, 0)::text,
      'nextOccurrenceId', v_task.id,
      'nextOccurrenceKey', v_task.id::text || ':' || v_next_count::text
    ),
    'readBack', jsonb_build_object(
      'taskId', v_task.id,
      'completedOccurrence', jsonb_build_object('id', v_completion_id, 'status', 'done', 'dueDate', v_current_due_date),
      'nextOccurrence', jsonb_build_object('id', v_task.id, 'status', 'todo', 'dueDate', v_next_due_date, 'recurrenceCount', v_next_count),
      'nextDueDate', v_next_due_date,
      'recurrenceActive', true
    ),
    -- Renderer-only exact rows. The Local API deliberately strips this field
    -- and returns the user-safe readBack receipt above.
    'state', jsonb_build_object(
      'livingTask', to_jsonb(v_living_after),
      'completionTask', to_jsonb(v_completion_after)
    )
  );

  INSERT INTO public.done_for_now_receipts(user_id, request_id, task_id, payload_hash, response)
  VALUES (v_user_id, p_request_id, v_task.id, v_payload_hash, v_response);

  RETURN v_response;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_next_recurring_due_date(date, jsonb, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.done_for_now_task(text, boolean, text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_next_recurring_due_date(date, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.done_for_now_task(text, boolean, text, text, date) TO authenticated;
