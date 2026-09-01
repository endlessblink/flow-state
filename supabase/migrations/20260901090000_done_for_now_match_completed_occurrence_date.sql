-- BUG-2067: a rescheduled active occurrence can retain a count already used
-- by historical completion. Advance its local occurrence identity to the
-- next unused count, while preserving same-date duplicate protection.
DO $$
DECLARE
  v_definition text;
  v_legacy_block text := $block$
  v_current_due := COALESCE(v_task.due_date::date, v_task.scheduled_date::date, CURRENT_DATE);
  v_next_count := COALESCE(v_task.recurrence_count, 0) + 1;

  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE recurrence_parent_id = v_parent_id
      AND recurrence_count = COALESCE(v_task.recurrence_count, 0)
      AND is_completion_record = true
      AND is_deleted = false
  ) THEN
  $block$;
  v_repaired_block text := $block$
  v_current_due := COALESCE(v_task.due_date::date, v_task.scheduled_date::date, CURRENT_DATE);
  v_current_count := COALESCE(v_task.recurrence_count, 0);

  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE recurrence_parent_id = v_parent_id
      AND recurrence_count = v_current_count
      AND is_completion_record = true
      AND is_deleted = false
      AND COALESCE(due_date::date, scheduled_date::date) IS DISTINCT FROM v_current_due
  ) THEN
    SELECT GREATEST(v_current_count, COALESCE(max(recurrence_count), v_current_count) + 1)
      INTO v_current_count
    FROM public.tasks
    WHERE recurrence_parent_id = v_parent_id
      AND is_completion_record = true
      AND is_deleted = false;
  END IF;

  v_next_count := v_current_count + 1;

  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE recurrence_parent_id = v_parent_id
      AND recurrence_count = v_current_count
      AND is_completion_record = true
      AND is_deleted = false
      AND COALESCE(due_date::date, scheduled_date::date) = v_current_due
  ) THEN
  $block$;
BEGIN
  SELECT pg_get_functiondef(
    'public.flowstate_done_for_now_h3_base(text,boolean,date,text,text,uuid)'::regprocedure
  ) INTO v_definition;

  IF position('v_current_count := COALESCE(v_task.recurrence_count, 0);' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position(v_legacy_block IN v_definition) = 0 THEN
    RAISE EXCEPTION 'BUG-2067: expected done-for-now occurrence guard was not found';
  END IF;

  v_definition := replace(v_definition, '  v_next_count integer;', E'  v_next_count integer;\n  v_current_count integer;');
  v_definition := replace(v_definition, v_legacy_block, v_repaired_block);
  v_definition := replace(v_definition, '''recurrenceCount'', COALESCE(v_task.recurrence_count, 0)', '''recurrenceCount'', v_current_count');
  v_definition := replace(v_definition, '''countBefore'', COALESCE(v_task.recurrence_count, 0)', '''countBefore'', v_current_count');
  v_definition := replace(v_definition, 'v_completion_instances, null, v_parent_id, COALESCE(v_task.recurrence_count, 0),', 'v_completion_instances, null, v_parent_id, v_current_count,');
  EXECUTE v_definition;
END;
$$;

COMMENT ON FUNCTION public.flowstate_done_for_now_h3_base(text, boolean, date, text, text, uuid) IS
  'BUG-2067: stale recurring counts are advanced to an unused completed-occurrence identity.';
