-- Rollback-only proof for P-013's canonical planning metadata contract.
BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES (
  'a0130000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'a013-contract@test.flowstate', '', now(), now(), now(),
  '{"provider":"email","providers":["email"]}', '{}',
  'authenticated', 'authenticated', '', ''
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.projects (id, user_id, name, is_deleted, workspace_id)
VALUES (
  'a0130000-0000-4000-8000-000000000002',
  'a0130000-0000-4000-8000-000000000001',
  'P013 contract project', false, NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, subtasks, is_in_inbox,
  canonical_revision, project_id
) VALUES (
  'a0130000-0000-4000-8000-000000000003',
  'a0130000-0000-4000-8000-000000000001',
  'P013 contract task', 'planned', false, '[]', '[]', true, 1, NULL
) ON CONFLICT (id) DO NOTHING;

SELECT set_config('request.jwt.claim.sub', 'a0130000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a0130000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

DO $$
DECLARE
  task_id text := 'a0130000-0000-4000-8000-000000000003';
  operation_id text := 'p013-planning-roundtrip';
  patch jsonb := '{"dueTime":"09:30","estimatedDuration":45,"projectId":"a0130000-0000-4000-8000-000000000002"}'::jsonb;
  preview jsonb;
  applied jsonb;
  replayed jsonb;
  stale jsonb;
  unsupported jsonb;
  revision bigint;
BEGIN
  SELECT t.canonical_revision INTO revision
  FROM public.tasks AS t
  WHERE t.id::text = task_id;

  SELECT public.flowstate_patch_task_v1(
    operation_id, 'task-v1', 'sql-p013', task_id, revision, patch,
    true, NULL, NULL, NULL, NULL
  ) INTO preview;

  IF preview->>'result' <> 'preview'
     OR preview #>> '{normalizedPayload,dueTime}' <> '09:30'
     OR (preview #>> '{normalizedPayload,estimatedDuration}')::integer <> 45
     OR preview #>> '{normalizedPayload,projectId}' <> 'a0130000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'P013 preview did not bind planning fields: %', preview;
  END IF;

  SELECT public.flowstate_patch_task_v1(
    operation_id, 'task-v1', 'sql-p013', task_id, revision, patch,
    false, preview->>'previewDigest', (preview->>'previewExpiresAt')::timestamptz,
    NULL, preview->>'requestHash'
  ) INTO applied;

  IF applied->>'result' <> 'committed'
     OR applied #>> '{receipt,readBack,dueTime}' <> '09:30'
     OR (applied #>> '{receipt,readBack,estimatedDuration}')::integer <> 45
     OR applied #>> '{receipt,readBack,projectId}' <> 'a0130000-0000-4000-8000-000000000002' THEN
    RAISE EXCEPTION 'P013 apply/read-back failed: %', applied;
  END IF;

  SELECT public.flowstate_patch_task_v1(
    operation_id, 'task-v1', 'sql-p013', task_id, revision, patch,
    false, preview->>'previewDigest', (preview->>'previewExpiresAt')::timestamptz,
    NULL, preview->>'requestHash'
  ) INTO replayed;
  IF replayed #>> '{receipt,replayed}' <> 'true' THEN
    RAISE EXCEPTION 'P013 replay was not marked replayed: %', replayed;
  END IF;

  SELECT public.flowstate_patch_task_v1(
    'p013-stale', 'task-v1', 'sql-p013', task_id, revision, '{"dueTime":"10:00"}'::jsonb,
    true, NULL, NULL, NULL, NULL
  ) INTO stale;
  IF stale #>> '{error,code}' <> 'stale_revision' THEN
    RAISE EXCEPTION 'P013 stale revision was not rejected: %', stale;
  END IF;

  SELECT public.flowstate_patch_task_v1(
    'p013-unsupported', 'task-v1', 'sql-p013', task_id, revision + 1, '{"tags":["x"]}'::jsonb,
    true, NULL, NULL, NULL, NULL
  ) INTO unsupported;
  IF unsupported #>> '{error,code}' <> 'unsupported_patch' THEN
    RAISE EXCEPTION 'P013 unsupported field was not rejected: %', unsupported;
  END IF;
END $$;

ROLLBACK;
