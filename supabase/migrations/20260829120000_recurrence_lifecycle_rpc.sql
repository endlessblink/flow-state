-- FEATURE-1945: approval-gated recurrence lifecycle edits.
-- Historical completion rows and embedded occurrence history are never rewritten.

CREATE OR REPLACE FUNCTION public.flowstate_edit_recurrence(
  p_task_id text,
  p_action text,
  p_recurrence_rule jsonb DEFAULT NULL,
  p_next_due_date date DEFAULT NULL,
  p_preview boolean DEFAULT true,
  p_request_id text DEFAULT NULL,
  p_preview_version text DEFAULT NULL,
  p_request_hash text DEFAULT NULL,
  p_workspace_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_task public.tasks%ROWTYPE;
  v_existing public.flowstate_action_receipts%ROWTYPE;
  v_rule jsonb;
  v_payload jsonb;
  v_payload_hash text;
  v_preview_version text;
  v_current_count integer;
  v_now timestamptz := clock_timestamp();
  v_read_back jsonb;
  v_receipt jsonb;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'not_authenticated', 'message', 'Authentication is required'));
  END IF;
  IF nullif(btrim(p_task_id), '') IS NULL OR p_action NOT IN ('set_cadence', 'pause', 'resume', 'end') THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'invalid_request', 'message', 'A supported recurrence lifecycle action is required'));
  END IF;
  IF NOT p_preview AND (nullif(btrim(p_request_id), '') IS NULL OR nullif(btrim(p_preview_version), '') IS NULL OR nullif(btrim(p_request_hash), '') IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'approval_receipt_required', 'message', 'requestId, previewVersion, and requestHash are required for apply'));
  END IF;

  IF NOT p_preview THEN
    SELECT * INTO v_existing FROM public.flowstate_action_receipts
    WHERE user_id = v_actor AND operation = 'recurrence_lifecycle' AND request_id = btrim(p_request_id);
    IF FOUND THEN
      IF v_existing.payload_hash <> p_request_hash THEN
        RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'idempotency_conflict', 'message', 'requestId was already used with a different payload'));
      END IF;
      RETURN v_existing.receipt;
    END IF;
  END IF;

  IF p_preview THEN
    SELECT * INTO v_task FROM public.tasks
    WHERE id::text = p_task_id AND is_deleted = false;
  ELSE
    SELECT * INTO v_task FROM public.tasks
    WHERE id::text = p_task_id AND is_deleted = false FOR UPDATE;
  END IF;
  IF NOT FOUND OR v_task.user_id <> v_actor OR v_task.workspace_id IS DISTINCT FROM p_workspace_id THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'not_found', 'message', 'Recurring task was not found in the active scope'));
  END IF;
  IF v_task.is_completion_record = true OR v_task.recurrence_rule IS NULL OR v_task.due_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'not_recurring', 'message', 'Task is not a living recurring definition'));
  END IF;

  SELECT count(*) INTO v_current_count
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_task.instances) = 'array' THEN v_task.instances ELSE '[]'::jsonb END) item
  WHERE COALESCE(item->>'dueDate', item->>'scheduledDate') = v_task.due_date::text;
  IF v_current_count <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'ambiguous_current_occurrence', 'message', 'Exactly one current occurrence is required'));
  END IF;

  v_rule := v_task.recurrence_rule;
  IF p_action = 'set_cadence' THEN
    IF jsonb_typeof(p_recurrence_rule) <> 'object' OR p_recurrence_rule->>'pattern' NOT IN ('daily', 'weekly', 'monthly', 'yearly') OR COALESCE((p_recurrence_rule->>'interval')::integer, 0) < 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'invalid_recurrence_rule', 'message', 'A supported recurrence rule is required'));
    END IF;
    v_rule := p_recurrence_rule;
  ELSIF p_action = 'pause' THEN
    v_rule := jsonb_set(v_rule, '{paused}', 'true'::jsonb, true);
  ELSIF p_action = 'resume' THEN
    v_rule := jsonb_set(v_rule, '{paused}', 'false'::jsonb, true);
  ELSE
    v_rule := jsonb_set(jsonb_set(v_rule, '{endType}', '"on_date"'::jsonb, true), '{endDate}', to_jsonb(v_task.due_date::text), true);
  END IF;
  IF p_action = 'set_cadence' AND p_next_due_date IS NOT NULL AND p_next_due_date <= v_task.due_date THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'invalid_next_date', 'message', 'The next date must be later than the current occurrence'));
  END IF;

  v_payload := jsonb_build_object('taskId', p_task_id, 'action', p_action, 'rule', v_rule, 'nextDueDate', COALESCE(p_next_due_date, v_task.due_date), 'baseRevision', v_task.canonical_revision);
  v_payload_hash := encode(digest(convert_to(v_payload::text, 'UTF8'), 'sha256'), 'hex');
  v_preview_version := COALESCE(v_task.canonical_revision, 0)::text;
  IF NOT p_preview AND (p_preview_version <> v_preview_version OR p_request_hash <> v_payload_hash) THEN
    RETURN jsonb_build_object('ok', false, 'error', jsonb_build_object('code', 'state_conflict', 'message', 'The recurrence changed after preview; request a new preview'));
  END IF;

  v_read_back := jsonb_build_object('id', v_task.id, 'canonicalRevision', COALESCE(v_task.canonical_revision, 0), 'dueDate', COALESCE(p_next_due_date, v_task.due_date), 'recurrenceRule', v_rule, 'historyPreserved', true);
  IF p_preview THEN
    RETURN jsonb_build_object('ok', true, 'result', 'preview', 'contractVersion', 'recurrence-lifecycle-v1', 'operationId', p_request_id, 'requestHash', v_payload_hash, 'previewVersion', v_preview_version, 'taskId', v_task.id, 'action', p_action, 'normalizedPayload', v_payload, 'readBack', v_read_back);
  END IF;

  UPDATE public.tasks
  SET recurrence_rule = v_rule,
      due_date = COALESCE(p_next_due_date, due_date),
      canonical_revision = COALESCE(canonical_revision, 0) + 1,
      updated_at = v_now
  WHERE id = v_task.id;

  v_read_back := jsonb_build_object('id', v_task.id, 'canonicalRevision', COALESCE(v_task.canonical_revision, 0) + 1, 'dueDate', COALESCE(p_next_due_date, v_task.due_date), 'recurrenceRule', v_rule, 'historyPreserved', true);
  v_receipt := jsonb_build_object('ok', true, 'result', 'committed', 'contractVersion', 'recurrence-lifecycle-v1', 'operation', 'recurrence_lifecycle', 'operationId', p_request_id, 'requestHash', v_payload_hash, 'taskId', v_task.id, 'action', p_action, 'receipt', jsonb_build_object('entityId', v_task.id, 'canonicalRevision', COALESCE(v_task.canonical_revision, 0) + 1, 'readBack', v_read_back));
  INSERT INTO public.flowstate_action_receipts(user_id, workspace_id, operation, request_id, payload_hash, preview_version, receipt)
  VALUES (v_actor, p_workspace_id, 'recurrence_lifecycle', btrim(p_request_id), v_payload_hash, v_preview_version, v_receipt);
  RETURN v_receipt;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_edit_recurrence(text, text, jsonb, date, boolean, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_edit_recurrence(text, text, jsonb, date, boolean, text, text, text, uuid) TO authenticated;
