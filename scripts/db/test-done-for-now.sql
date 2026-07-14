-- TASK-1532: disposable integration regression for the transactional recurring
-- occurrence operation. Every fixture and assertion runs inside a transaction
-- and is rolled back.
-- Usage: docker exec -i supabase_db_flow-state psql -U postgres -v ON_ERROR_STOP=1 < scripts/db/test-done-for-now.sql

BEGIN;

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381532',
  'authenticated', 'authenticated', 'done-for-now-fixture@example.invalid', now(), now()
)
ON CONFLICT (id) DO NOTHING;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd381532","role":"authenticated"}',
  true
);

INSERT INTO public.tasks (
  id, user_id, title, status, priority, progress, due_date, scheduled_date,
  recurrence_rule, recurrence_count, instances, subtasks, is_in_inbox,
  is_deleted, is_completion_record
) VALUES (
  '00000000-0000-4000-8000-000000001532',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381532',
  'Disposable recurring fixture', 'planned', 'high', 25,
  '2026-07-12', '2026-07-12',
  '{"pattern":"daily","interval":1,"endType":"never"}', 0,
  '[{"id":"fixture-block","taskId":"00000000-0000-4000-8000-000000001532","scheduledDate":"2026-07-12","scheduledTime":"20:00","duration":50,"status":"scheduled"}]',
  '[{"id":"fixture-subtask","title":"step","isCompleted":true}]',
  true, false, false
), (
  '00000000-0000-4000-8000-000000001533',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381532',
  'Disposable non-recurring fixture', 'planned', 'low', 0,
  '2026-07-12', NULL, NULL, 0, '[]', '[]', true, false, false
), (
  '00000000-0000-4000-8000-000000001534',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381532',
  'Disposable rollback fixture', 'planned', 'medium', 0,
  '2026-07-12', NULL,
  '{"pattern":"daily","interval":1,"endType":"never"}', 0,
  '[]', '[]', true, false, false
);

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_preview jsonb;
  v_apply jsonb;
  v_retry jsonb;
  v_conflict jsonb;
  v_nonrecurring jsonb;
  v_count integer;
  v_value text;
BEGIN
  v_preview := public.done_for_now_task(
    '00000000-0000-4000-8000-000000001532', true, NULL, NULL, '2026-07-16'
  );
  IF v_preview->>'ok' <> 'true' OR v_preview->>'preview' <> 'true' THEN
    RAISE EXCEPTION 'FAIL preview response: %', v_preview;
  END IF;
  IF v_preview#>>'{currentOccurrence,dueDate}' <> '2026-07-12'
     OR v_preview#>>'{recurrence,nextDueDateAfter}' <> '2026-07-16' THEN
    RAISE EXCEPTION 'FAIL preview did not describe exact occurrence transition: %', v_preview;
  END IF;
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE recurrence_parent_id::text = '00000000-0000-4000-8000-000000001532' AND is_completion_record = true;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL preview mutated completion history'; END IF;
  SELECT due_date::date::text INTO v_value FROM public.tasks WHERE id::text = '00000000-0000-4000-8000-000000001532';
  IF v_value <> '2026-07-12' THEN RAISE EXCEPTION 'FAIL preview changed living task'; END IF;

  v_apply := public.done_for_now_task(
    '00000000-0000-4000-8000-000000001532', false, 'request-1532',
    v_preview->>'previewVersion', '2026-07-16'
  );
  IF v_apply->>'ok' <> 'true' OR v_apply->>'preview' <> 'false' THEN
    RAISE EXCEPTION 'FAIL apply response: %', v_apply;
  END IF;
  IF v_apply#>>'{readBack,completedOccurrence,dueDate}' <> '2026-07-12'
     OR v_apply#>>'{readBack,nextOccurrence,dueDate}' <> '2026-07-16' THEN
    RAISE EXCEPTION 'FAIL apply read-back: %', v_apply;
  END IF;

  SELECT count(*) INTO v_count FROM public.tasks
    WHERE recurrence_parent_id::text = '00000000-0000-4000-8000-000000001532'
      AND is_completion_record = true AND due_date::date = '2026-07-12';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL expected exactly one completion history row, found %', v_count; END IF;
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE id::text = '00000000-0000-4000-8000-000000001532'
      AND status <> 'done' AND due_date::date = '2026-07-16'
      AND recurrence_rule IS NOT NULL AND recurrence_count = 1;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL living recurring definition did not advance exactly once'; END IF;
  SELECT count(*) INTO v_count FROM public.tasks t, jsonb_array_elements(t.instances) instance
    WHERE t.id::text = '00000000-0000-4000-8000-000000001532'
      AND instance->>'scheduledDate' = '2026-07-16'
      AND instance->>'scheduledTime' = '20:00';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL expected exactly one next Canvas/work block, found %', v_count; END IF;

  -- User-visible query invariants: not overdue on July 13, discoverable in
  -- Search/Inbox, not in Today on July 13, and present on July 16/Canvas.
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE id::text = '00000000-0000-4000-8000-000000001532' AND status <> 'done' AND due_date::date < '2026-07-13';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL completed occurrence remains overdue'; END IF;
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE id::text = '00000000-0000-4000-8000-000000001532' AND is_deleted = false AND is_in_inbox = true;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL Search/Inbox cannot resolve living task'; END IF;
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE id::text = '00000000-0000-4000-8000-000000001532' AND status <> 'done' AND due_date::date = '2026-07-13';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL task incorrectly appears in Today'; END IF;

  v_retry := public.done_for_now_task(
    '00000000-0000-4000-8000-000000001532', false, 'request-1532',
    v_preview->>'previewVersion', '2026-07-16'
  );
  IF v_retry <> v_apply THEN RAISE EXCEPTION 'FAIL identical retry did not return stable receipt'; END IF;
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE recurrence_parent_id::text = '00000000-0000-4000-8000-000000001532' AND is_completion_record = true;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL retry duplicated completion history'; END IF;

  v_conflict := public.done_for_now_task(
    '00000000-0000-4000-8000-000000001532', false, 'request-1532',
    v_preview->>'previewVersion', '2026-07-17'
  );
  IF v_conflict#>>'{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'FAIL changed retry was not a typed conflict: %', v_conflict;
  END IF;

  v_nonrecurring := public.done_for_now_task(
    '00000000-0000-4000-8000-000000001533', true, NULL, NULL, NULL
  );
  IF v_nonrecurring#>>'{error,code}' <> 'non_recurring_task' THEN
    RAISE EXCEPTION 'FAIL non-recurring task was not rejected: %', v_nonrecurring;
  END IF;
  SELECT status INTO v_value FROM public.tasks WHERE id::text = '00000000-0000-4000-8000-000000001533';
  IF v_value <> 'planned' THEN RAISE EXCEPTION 'FAIL non-recurring task was changed'; END IF;
END $$;

RESET ROLE;

CREATE OR REPLACE FUNCTION pg_temp.fail_done_for_now_history_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_completion_record = true AND NEW.title = 'Disposable rollback fixture' THEN
    RAISE EXCEPTION 'forced next-step failure';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER test_done_for_now_rollback
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_done_for_now_history_insert();

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_preview jsonb;
  v_count integer;
  v_due text;
  v_recurrence_count integer;
BEGIN
  v_preview := public.done_for_now_task('00000000-0000-4000-8000-000000001534', true, NULL, NULL, NULL);
  BEGIN
    PERFORM public.done_for_now_task(
      '00000000-0000-4000-8000-000000001534', false, 'request-rollback-1532',
      v_preview->>'previewVersion', NULL
    );
    RAISE EXCEPTION 'FAIL forced transaction failure did not propagate';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'FAIL forced transaction failure did not propagate' THEN RAISE; END IF;
  END;

  SELECT due_date::date::text, recurrence_count INTO v_due, v_recurrence_count
    FROM public.tasks WHERE id::text = '00000000-0000-4000-8000-000000001534';
  IF v_due <> '2026-07-12' OR v_recurrence_count <> 0 THEN
    RAISE EXCEPTION 'FAIL transaction left partially advanced living state';
  END IF;
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE recurrence_parent_id::text = '00000000-0000-4000-8000-000000001534' AND is_completion_record = true;
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL transaction left partial completion history'; END IF;
  SELECT count(*) INTO v_count FROM public.done_for_now_receipts
    WHERE request_id = 'request-rollback-1532';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL transaction left partial receipt'; END IF;
END $$;

\echo 'ALL DONE-FOR-NOW ASSERTIONS PASSED'
ROLLBACK;
