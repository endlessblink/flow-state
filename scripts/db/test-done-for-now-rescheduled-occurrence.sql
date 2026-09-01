-- BUG-2067: a historical completion cannot block a separately dated active
-- occurrence merely because both currently carry the same recurrence count.
BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'e0f00000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'bug-2067-owner@test.flowstate', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated', '', ''
);

INSERT INTO public.tasks (
  id, user_id, title, status, due_date, recurrence_rule,
  recurrence_parent_id, recurrence_count, is_completion_record, is_deleted,
  instances, subtasks, is_in_inbox
) VALUES
  (
    'e0f00000-0000-4000-8000-000000000201',
    'e0f00000-0000-4000-8000-000000000001',
    'Current rescheduled occurrence', 'planned', '2026-08-31',
    '{"pattern":"weekly","interval":1,"endType":"never"}',
    'e0f00000-0000-4000-8000-000000000201', 4, false, false,
    '[]', '[]', true
  ),
  (
    'e0f00000-0000-4000-8000-000000000202',
    'e0f00000-0000-4000-8000-000000000001',
    'Historic completed occurrence', 'done', '2026-07-28', null,
    'e0f00000-0000-4000-8000-000000000201', 4, true, false,
    '[]', '[]', false
  );

SELECT set_config('request.jwt.claim.sub', 'e0f00000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"e0f00000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

DO $$
DECLARE
  v_preview jsonb := public.flowstate_done_for_now(
    'e0f00000-0000-4000-8000-000000000201', true
  );
  v_apply jsonb;
BEGIN
  IF v_preview #>> '{ok}' <> 'true'
     OR v_preview #>> '{currentOccurrence,dueDate}' <> '2026-08-31'
     OR v_preview #>> '{recurrence,nextDueDateAfter}' <> '2026-09-07' THEN
    RAISE EXCEPTION 'BUG-2067: historic completion blocked current occurrence: %', v_preview;
  END IF;

  v_apply := public.flowstate_done_for_now(
    'e0f00000-0000-4000-8000-000000000201', false, NULL,
    'bug-2067-rescheduled', v_preview->>'previewVersion', NULL,
    v_preview->>'requestHash'
  );
  IF v_apply->>'ok' <> 'true'
     OR v_apply #>> '{receipt,readBack,currentOccurrence,dueDate}' <> '2026-08-31'
     OR v_apply #>> '{receipt,readBack,nextOccurrence,dueDate}' <> '2026-09-07' THEN
    RAISE EXCEPTION 'BUG-2067: current rescheduled occurrence did not apply: %', v_apply;
  END IF;

  IF (SELECT recurrence_count FROM public.tasks WHERE id = 'e0f00000-0000-4000-8000-000000000201') <> 6
     OR (SELECT recurrence_count FROM public.tasks WHERE id = 'e0f00000-0000-4000-8000-000000000202') <> 4 THEN
    RAISE EXCEPTION 'BUG-2067: stale count repair changed history or did not advance the active occurrence';
  END IF;
END;
$$;

INSERT INTO public.tasks (
  id, user_id, title, status, due_date, recurrence_rule,
  recurrence_parent_id, recurrence_count, is_completion_record, is_deleted,
  instances, subtasks, is_in_inbox
) VALUES
  ('e0f00000-0000-4000-8000-000000000203', 'e0f00000-0000-4000-8000-000000000001',
   'Same-date duplicate guard', 'planned', '2026-08-31',
   '{"pattern":"weekly","interval":1,"endType":"never"}',
   'e0f00000-0000-4000-8000-000000000203', 4, false, false, '[]', '[]', true),
  ('e0f00000-0000-4000-8000-000000000204', 'e0f00000-0000-4000-8000-000000000001',
   'Same-date completed occurrence', 'done', '2026-08-31', null,
   'e0f00000-0000-4000-8000-000000000203', 4, true, false, '[]', '[]', false);

DO $$
DECLARE
  v_same_date_duplicate jsonb;
BEGIN
  v_same_date_duplicate := public.flowstate_done_for_now(
    'e0f00000-0000-4000-8000-000000000203', true
  );
  IF v_same_date_duplicate #>> '{error,code}' <> 'already_completed' THEN
    RAISE EXCEPTION 'BUG-2067: same-date duplicate guard was weakened: %', v_same_date_duplicate;
  END IF;
END;
$$;

ROLLBACK;
