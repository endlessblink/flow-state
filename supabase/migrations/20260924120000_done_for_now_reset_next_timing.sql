-- BUG-2095: Done for now advances the recurring task by date, without
-- carrying an explicitly timed occurrence into its next cycle. Preserve the
-- completed record and its original instance unchanged.
DO $$
DECLARE
  v_definition text;
  v_old_next_instance text := $block$
  v_next_instances := jsonb_build_array(
    jsonb_strip_nulls(jsonb_build_object(
      'id', v_next_instance_id,
      'taskId', v_task.id,
      'scheduledDate', v_next_due,
      'scheduledTime', COALESCE(v_current_instance->>'scheduledTime', v_task.due_time, v_task.scheduled_time),
      'duration', COALESCE(
        (v_current_instance->>'duration')::integer,
        v_task.estimated_duration,
        25
      ),
      'status', 'scheduled',
      'isRecurring', true,
      'createdAt', v_now,
      'updatedAt', v_now
    ))
  );
  $block$;
  v_old_update text := $block$
      due_date = v_next_due_timestamp,
      scheduled_date = v_next_due_timestamp,
  $block$;
  v_old_due_timestamp text := $block$
  v_next_due_timestamp := v_next_due::timestamp
    + COALESCE(v_task.due_date::time, time '00:00');
  $block$;
  v_new_due_timestamp text := $block$
  v_next_due_timestamp := (v_next_due::text || 'T00:00:00Z')::timestamptz;
  $block$;
  v_old_receipt_time text := $block$
      'scheduledTime', v_next_instances #>> '{0,scheduledTime}',
      'duration', (v_next_instances #>> '{0,duration}')::integer
  $block$;
  v_new_receipt_time text := $block$
      'scheduledTime', null,
      'duration', null
  $block$;
  v_new_update text := $block$
      due_date = v_next_due_timestamp,
      due_time = null,
      scheduled_date = null,
      scheduled_time = null,
  $block$;
BEGIN
  SELECT pg_get_functiondef(
    'public.flowstate_done_for_now_h3_base(text,boolean,date,text,text,uuid)'::regprocedure
  ) INTO v_definition;

  IF position('v_next_instances := ''[]''::jsonb;' IN v_definition) > 0
     AND position('due_time = null,' IN v_definition) > 0
     AND position('scheduled_date = null,' IN v_definition) > 0
     AND position('scheduled_time = null,' IN v_definition) > 0
     AND position('''scheduledTime'', null' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position(btrim(v_old_next_instance, E' \n') IN v_definition) = 0
     OR position(btrim(v_old_update, E' \n') IN v_definition) = 0
     OR position(btrim(v_old_due_timestamp, E' \n') IN v_definition) = 0
     OR position(btrim(v_old_receipt_time, E' \n') IN v_definition) = 0 THEN
    RAISE EXCEPTION 'BUG-2095: expected done-for-now timing contract was not found';
  END IF;

  v_definition := replace(v_definition, btrim(v_old_next_instance, E' \n'), 'v_next_instances := ''[]''::jsonb;');
  v_definition := replace(
    v_definition,
    btrim(v_old_due_timestamp, E' \n'),
    btrim(v_new_due_timestamp, E' \n')
  );
  v_definition := replace(v_definition, btrim(v_old_update, E' \n'), btrim(v_new_update, E' \n'));
  v_definition := replace(
    v_definition,
    btrim(v_old_receipt_time, E' \n'),
    btrim(v_new_receipt_time, E' \n')
  );

  EXECUTE v_definition;
END;
$$;

COMMENT ON FUNCTION public.flowstate_done_for_now_h3_base(text, boolean, date, text, text, uuid) IS
  'Completes the current recurring occurrence with its history intact and advances the living task by date without scheduling a time.';
