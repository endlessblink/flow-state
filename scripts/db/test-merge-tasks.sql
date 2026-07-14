-- Disposable transaction regression for preview-first duplicate task merge.
-- All rows are rolled back. IDs are valid UUID strings so the same fixture runs
-- against both the source text-ID schema and the production UUID-ID schema.

BEGIN;

INSERT INTO auth.users (id, aud, role, email, created_at, updated_at)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  'authenticated', 'authenticated', 'merge-task-fixture@example.invalid', now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, name, owner_id)
VALUES ('00000000-0000-4000-8000-000000002000', 'Disposable merge workspace', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
VALUES (
  '00000000-0000-4000-8000-000000002000',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  'owner'
)
ON CONFLICT DO NOTHING;

INSERT INTO public.projects (id, user_id, name, is_deleted, workspace_id)
VALUES (
  '00000000-0000-4000-8000-000000002001',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  'Disposable merge project', false,
  '00000000-0000-4000-8000-000000002000'
);

INSERT INTO public.tasks (
  id, user_id, workspace_id, title, description, status, priority, progress,
  project_id, due_date, tags, subtasks, instances, attachments, planning_notes,
  mini_canvas_edges, is_deleted, is_completion_record
) VALUES (
  '00000000-0000-4000-8000-000000002010',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable survivor', '', 'planned', 'high', 0, NULL, NULL,
  ARRAY['survivor-tag'],
  '[{"id":"survivor-subtask","parentTaskId":"00000000-0000-4000-8000-000000002010","title":"keep"}]',
  '[{"id":"survivor-instance","taskId":"00000000-0000-4000-8000-000000002010","scheduledDate":"2026-07-14","scheduledTime":"20:00"}]',
  '[]', '[]', '[]', false, false
), (
  '00000000-0000-4000-8000-000000002011',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable duplicate', 'Transferred description', 'planned', 'high', 0,
  '00000000-0000-4000-8000-000000002001', '2026-07-16',
  ARRAY['duplicate-tag'],
  '[{"id":"duplicate-subtask","parentTaskId":"00000000-0000-4000-8000-000000002011","title":"transfer"}]',
  '[{"id":"duplicate-instance","taskId":"00000000-0000-4000-8000-000000002011","scheduledDate":"2026-07-16","scheduledTime":"20:00"}]',
  '[{"id":"duplicate-attachment","name":"fixture.txt"}]',
  '[{"id":"duplicate-note","text":"fixture"}]',
  '[]', false, false
), (
  '00000000-0000-4000-8000-000000002012',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable changed payload', '', 'planned', 'high', 0,
  NULL, NULL, ARRAY[]::text[], '[]', '[]', '[]', '[]', '[]', false, false
), (
  '00000000-0000-4000-8000-000000002013',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable recurring conflict', '', 'planned', 'high', 0,
  NULL, '2026-07-13', ARRAY[]::text[], '[]', '[]', '[]', '[]', '[]', false, false
), (
  '00000000-0000-4000-8000-000000002014',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable rollback survivor', '', 'planned', 'medium', 0,
  NULL, NULL, ARRAY[]::text[], '[]', '[]', '[]', '[]', '[]', false, false
), (
  '00000000-0000-4000-8000-000000002015',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable rollback duplicate', 'must rollback', 'planned', 'medium', 0,
  NULL, NULL, ARRAY[]::text[], '[]', '[]', '[]', '[]', '[]', false, false
);

UPDATE public.tasks
SET recurrence_rule = '{"pattern":"daily","interval":1,"endType":"never"}'
WHERE id::text = '00000000-0000-4000-8000-000000002013';

INSERT INTO public.tasks (
  id, user_id, workspace_id, title, status, priority, progress, subtasks,
  instances, attachments, planning_notes, mini_canvas_edges, tags,
  is_deleted, is_completion_record
) VALUES (
  '00000000-0000-4000-8000-000000002016',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable stale survivor', 'planned', 'low', 0,
  '[]', '[]', '[]', '[]', '[]', ARRAY[]::text[], false, false
), (
  '00000000-0000-4000-8000-000000002017',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable stale duplicate', 'planned', 'low', 0,
  '[]', '[]', '[]', '[]', '[]', ARRAY[]::text[], false, false
), (
  '00000000-0000-4000-8000-000000002018',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable collision survivor', 'planned', 'low', 0,
  '[{"id":"same-id","title":"survivor value"}]', '[]', '[]', '[]', '[]', ARRAY[]::text[], false, false
), (
  '00000000-0000-4000-8000-000000002019',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002000',
  'Disposable collision duplicate', 'planned', 'low', 0,
  '[{"id":"same-id","title":"duplicate value"}]', '[]', '[]', '[]', '[]', ARRAY[]::text[], false, false
);

INSERT INTO public.task_comments (task_id, workspace_id, user_id, content)
VALUES (
  '00000000-0000-4000-8000-000000002017',
  '00000000-0000-4000-8000-000000002000',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  'Stale preview original'
);

INSERT INTO public.task_comments (task_id, workspace_id, user_id, content)
VALUES (
  '00000000-0000-4000-8000-000000002011',
  '00000000-0000-4000-8000-000000002000',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  'Disposable comment'
);

INSERT INTO public.task_contexts (task_id, project_id, user_id, summary)
VALUES (
  '00000000-0000-4000-8000-000000002011',
  '00000000-0000-4000-8000-000000002001',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  'Disposable context'
);

INSERT INTO public.project_task_links (project_id, task_id, user_id, link_type, source)
VALUES (
  '00000000-0000-4000-8000-000000002001',
  '00000000-0000-4000-8000-000000002011',
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  'belongs_to', 'fixture'
);

INSERT INTO public.pomodoro_history (
  user_id, task_id, duration, is_break, started_at, completed_at
) VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533',
  '00000000-0000-4000-8000-000000002011',
  1500, false, now() - interval '25 minutes', now()
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd381533","role":"authenticated"}',
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_preview jsonb;
  v_apply jsonb;
  v_retry jsonb;
  v_result jsonb;
  v_count integer;
BEGIN
  SELECT jsonb_build_object(
    'tasks', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id::text) FROM public.tasks t WHERE t.id::text IN ('00000000-0000-4000-8000-000000002010', '00000000-0000-4000-8000-000000002011')),
    'comments', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.task_comments c WHERE c.task_id::text = '00000000-0000-4000-8000-000000002011'),
    'contexts', (SELECT jsonb_agg(to_jsonb(c)) FROM public.task_contexts c WHERE c.task_id::text = '00000000-0000-4000-8000-000000002011'),
    'links', (SELECT jsonb_agg(to_jsonb(l)) FROM public.project_task_links l WHERE l.task_id::text = '00000000-0000-4000-8000-000000002011'),
    'receipts', (SELECT count(*) FROM public.merge_task_receipts WHERE user_id = auth.uid())
  ) INTO v_before;

  v_preview := public.merge_tasks(
    '00000000-0000-4000-8000-000000002010',
    '00000000-0000-4000-8000-000000002011',
    true, NULL, NULL
  );
  IF v_preview->>'ok' <> 'true' OR v_preview->>'preview' <> 'true'
     OR jsonb_array_length(v_preview->'conflicts') <> 0 THEN
    RAISE EXCEPTION 'FAIL merge preview: %', v_preview;
  END IF;
  IF v_preview#>>'{deletion,mode}' <> 'soft-delete'
     OR jsonb_array_length(v_preview->'transfers') < 5
     OR v_preview#>>'{preserved,pomodoroHistoryCount}' <> '1' THEN
    RAISE EXCEPTION 'FAIL preview omitted exact effects: %', v_preview;
  END IF;

  SELECT jsonb_build_object(
    'tasks', (SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id::text) FROM public.tasks t WHERE t.id::text IN ('00000000-0000-4000-8000-000000002010', '00000000-0000-4000-8000-000000002011')),
    'comments', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.task_comments c WHERE c.task_id::text = '00000000-0000-4000-8000-000000002011'),
    'contexts', (SELECT jsonb_agg(to_jsonb(c)) FROM public.task_contexts c WHERE c.task_id::text = '00000000-0000-4000-8000-000000002011'),
    'links', (SELECT jsonb_agg(to_jsonb(l)) FROM public.project_task_links l WHERE l.task_id::text = '00000000-0000-4000-8000-000000002011'),
    'receipts', (SELECT count(*) FROM public.merge_task_receipts WHERE user_id = auth.uid())
  ) INTO v_after;
  IF v_before IS DISTINCT FROM v_after THEN
    RAISE EXCEPTION 'FAIL preview mutated state';
  END IF;

  v_apply := public.merge_tasks(
    '00000000-0000-4000-8000-000000002010',
    '00000000-0000-4000-8000-000000002011',
    false, 'merge-request-1', v_preview->>'previewVersion'
  );
  IF v_apply->>'ok' <> 'true' OR v_apply#>>'{readBack,duplicateArchived}' <> 'true' THEN
    RAISE EXCEPTION 'FAIL merge apply: %', v_apply;
  END IF;

  SELECT count(*) INTO v_count FROM public.tasks
    WHERE id::text = '00000000-0000-4000-8000-000000002010'
      AND is_deleted = false
      AND description = 'Transferred description'
      AND project_id::text = '00000000-0000-4000-8000-000000002001'
      AND due_date::date = '2026-07-16'
      AND tags @> ARRAY['survivor-tag', 'duplicate-tag'];
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL survivor scalar/array read-back'; END IF;

  SELECT count(*) INTO v_count FROM public.tasks t,
    jsonb_array_elements(t.subtasks) subtask
    WHERE t.id::text = '00000000-0000-4000-8000-000000002010'
      AND subtask->>'id' = 'duplicate-subtask'
      AND subtask->>'parentTaskId' = '00000000-0000-4000-8000-000000002010';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL transferred subtask ownership'; END IF;

  SELECT count(*) INTO v_count FROM public.tasks t,
    jsonb_array_elements(t.instances) instance
    WHERE t.id::text = '00000000-0000-4000-8000-000000002010'
      AND instance->>'id' = 'duplicate-instance'
      AND instance->>'taskId' = '00000000-0000-4000-8000-000000002010'
      AND instance->>'scheduledTime' = '20:00';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL transferred work block ownership/time'; END IF;

  SELECT count(*) INTO v_count FROM public.tasks
    WHERE id::text = '00000000-0000-4000-8000-000000002011' AND is_deleted = true;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL duplicate was not soft-deleted'; END IF;
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE id::text IN ('00000000-0000-4000-8000-000000002010', '00000000-0000-4000-8000-000000002011') AND is_deleted = false;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL Search/UI active query did not resolve exactly one task'; END IF;
  SELECT count(*) INTO v_count FROM public.task_comments WHERE task_id::text = '00000000-0000-4000-8000-000000002010';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL comment transfer'; END IF;
  SELECT count(*) INTO v_count FROM public.task_contexts WHERE task_id::text = '00000000-0000-4000-8000-000000002010';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL task context transfer'; END IF;
  SELECT count(*) INTO v_count FROM public.project_task_links WHERE task_id::text = '00000000-0000-4000-8000-000000002010';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL project link transfer'; END IF;
  SELECT count(*) INTO v_count FROM public.pomodoro_history WHERE task_id::text = '00000000-0000-4000-8000-000000002011';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL historical provenance was moved or lost'; END IF;

  v_retry := public.merge_tasks(
    '00000000-0000-4000-8000-000000002010',
    '00000000-0000-4000-8000-000000002011',
    false, 'merge-request-1', v_preview->>'previewVersion'
  );
  IF v_retry IS DISTINCT FROM v_apply THEN RAISE EXCEPTION 'FAIL retry receipt is not stable'; END IF;
  SELECT count(*) INTO v_count FROM public.task_comments WHERE task_id::text = '00000000-0000-4000-8000-000000002010';
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL retry duplicated transfers'; END IF;

  v_result := public.merge_tasks(
    '00000000-0000-4000-8000-000000002010',
    '00000000-0000-4000-8000-000000002012',
    false, 'merge-request-1', v_preview->>'previewVersion'
  );
  IF v_result#>>'{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'FAIL changed payload was not rejected: %', v_result;
  END IF;

  v_result := public.merge_tasks(
    '00000000-0000-4000-8000-000000002012',
    '00000000-0000-4000-8000-000000002013',
    true, NULL, NULL
  );
  IF NOT (v_result->'conflicts' @> '[{"code":"recurring_merge_unsupported"}]'::jsonb) THEN
    RAISE EXCEPTION 'FAIL recurring merge was not typed unsupported: %', v_result;
  END IF;

  v_result := public.merge_tasks(
    '00000000-0000-4000-8000-000000002018',
    '00000000-0000-4000-8000-000000002019',
    true, NULL, NULL
  );
  IF NOT (v_result->'conflicts' @> '[{"code":"stable_id_collision","collection":"subtasks"}]'::jsonb) THEN
    RAISE EXCEPTION 'FAIL stable-id collision was not reported: %', v_result;
  END IF;

  v_result := public.merge_tasks(
    '00000000-0000-4000-8000-000000002016',
    '00000000-0000-4000-8000-000000002017',
    true, NULL, NULL
  );
  UPDATE public.task_comments SET content = 'Stale preview changed'
    WHERE task_id::text = '00000000-0000-4000-8000-000000002017';
  v_result := public.merge_tasks(
    '00000000-0000-4000-8000-000000002016',
    '00000000-0000-4000-8000-000000002017',
    false, 'merge-stale-request', v_result->>'previewVersion'
  );
  IF v_result#>>'{error,code}' <> 'stale_preview' THEN
    RAISE EXCEPTION 'FAIL relation mutation did not stale the preview: %', v_result;
  END IF;
END $$;

RESET ROLE;

CREATE OR REPLACE FUNCTION pg_temp.fail_merge_archive()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id::text = '00000000-0000-4000-8000-000000002015' AND NEW.is_deleted = true THEN
    RAISE EXCEPTION 'forced archive failure';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER test_merge_rollback
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_merge_archive();

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_preview jsonb;
  v_result jsonb;
  v_count integer;
BEGIN
  v_preview := public.merge_tasks(
    '00000000-0000-4000-8000-000000002014',
    '00000000-0000-4000-8000-000000002015', true, NULL, NULL
  );
  v_result := public.merge_tasks(
    '00000000-0000-4000-8000-000000002014',
    '00000000-0000-4000-8000-000000002015', false,
    'merge-rollback-request', v_preview->>'previewVersion'
  );
  IF v_result#>>'{error,code}' <> 'operation_failed' THEN
    RAISE EXCEPTION 'FAIL forced transaction error was not typed: %', v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE id::text = '00000000-0000-4000-8000-000000002014'
      AND description = '' AND is_deleted = false;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL survivor changed after rollback'; END IF;
  SELECT count(*) INTO v_count FROM public.tasks
    WHERE id::text = '00000000-0000-4000-8000-000000002015' AND is_deleted = false;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FAIL duplicate archived after rollback'; END IF;
  SELECT count(*) INTO v_count FROM public.merge_task_receipts WHERE request_id = 'merge-rollback-request';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL rollback left a receipt'; END IF;
END $$;

\echo 'ALL MERGE-TASK ASSERTIONS PASSED'
ROLLBACK;
