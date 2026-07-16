-- Disposable regression coverage for TASK-1967's bounded causal inventory read.
BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
  (
    'ca170000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'cause-owner@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'ca170000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'cause-other@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  );

INSERT INTO public.workspaces (id, name, owner_id)
VALUES (
  'ca170000-0000-4000-8000-000000000010',
  'Cause contract workspace',
  'ca170000-0000-4000-8000-000000000001'
);

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, subtasks,
  is_in_inbox, workspace_id
) VALUES
  (
    'ca170000-0000-4000-8000-000000000101',
    'ca170000-0000-4000-8000-000000000001',
    'Cause owner fixture', 'planned', false, '[]', '[]', true, NULL
  ),
  (
    'ca170000-0000-4000-8000-000000000102',
    'ca170000-0000-4000-8000-000000000002',
    'Cause other fixture', 'planned', false, '[]', '[]', true, NULL
  ),
  (
    'ca170000-0000-4000-8000-000000000103',
    'ca170000-0000-4000-8000-000000000001',
    'Cause workspace fixture', 'planned', false, '[]', '[]', true,
    'ca170000-0000-4000-8000-000000000010'
  );

SELECT set_config(
  'request.jwt.claim.sub',
  'ca170000-0000-4000-8000-000000000001',
  true
);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"ca170000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

INSERT INTO public.canonical_operations (
  user_id, operation_id, contract_version, source, scope_kind, scope_id,
  workspace_id, entity_type, action, entity_id, request_hash, state
) VALUES (
  'ca170000-0000-4000-8000-000000000001',
  'hermes:planning:episode-1:patch-1', 'task-v1', 'local-api',
  'personal', 'ca170000-0000-4000-8000-000000000001', NULL,
  'task', 'patch', 'ca170000-0000-4000-8000-000000000101',
  repeat('a', 64), 'applying'
);
SELECT set_config(
  'flowstate.canonical.operation_id',
  'hermes:planning:episode-1:patch-1',
  true
);
UPDATE public.tasks
SET title = 'Cause owner fixture updated'
WHERE id = 'ca170000-0000-4000-8000-000000000101';
SELECT set_config('flowstate.canonical.operation_id', '', true);

DO $$
DECLARE
  v_high_water bigint;
  v_personal record;
  v_workspace_count integer;
  v_cross_scope_denied boolean := false;
  v_oversize_denied boolean := false;
BEGIN
  IF NOT pg_catalog.has_function_privilege(
       'authenticated',
       'public.flowstate_task_change_causes_v1(text[],bigint,uuid,uuid)',
       'EXECUTE'
     )
     OR NOT pg_catalog.has_function_privilege(
       'service_role',
       'public.flowstate_task_change_causes_v1(text[],bigint,uuid,uuid)',
       'EXECUTE'
     )
     OR pg_catalog.has_function_privilege(
       'anon',
       'public.flowstate_task_change_causes_v1(text[],bigint,uuid,uuid)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'FAIL: cause reader execution privileges are unsafe';
  END IF;

  SELECT pg_catalog.max(change_sequence)
    INTO v_high_water
  FROM public.canonical_change_log;

  SELECT * INTO STRICT v_personal
  FROM public.flowstate_task_change_causes_v1(
    ARRAY[
      'ca170000-0000-4000-8000-000000000101',
      'ca170000-0000-4000-8000-000000000102'
    ],
    v_high_water,
    'ca170000-0000-4000-8000-000000000001',
    NULL
  );
  IF v_personal.task_id <> 'ca170000-0000-4000-8000-000000000101'
     OR v_personal.operation_id <> 'hermes:planning:episode-1:patch-1'
     OR v_personal.source <> 'local-api'
     OR v_personal.change_sequence > v_high_water THEN
    RAISE EXCEPTION 'FAIL: personal cause was not exact or user scoped';
  END IF;

  SELECT pg_catalog.count(*) INTO v_workspace_count
  FROM public.flowstate_task_change_causes_v1(
    ARRAY['ca170000-0000-4000-8000-000000000103'],
    v_high_water,
    'ca170000-0000-4000-8000-000000000001',
    'ca170000-0000-4000-8000-000000000010'
  );
  IF v_workspace_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: readable workspace cause was not returned';
  END IF;

  BEGIN
    PERFORM * FROM public.flowstate_task_change_causes_v1(
      ARRAY['ca170000-0000-4000-8000-000000000101'],
      v_high_water,
      'ca170000-0000-4000-8000-000000000002',
      NULL
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_cross_scope_denied := true;
  END;
  IF NOT v_cross_scope_denied THEN
    RAISE EXCEPTION 'FAIL: a signed user selected another personal scope';
  END IF;

  BEGIN
    PERFORM * FROM public.flowstate_task_change_causes_v1(
      ARRAY(SELECT extensions.gen_random_uuid()::text FROM pg_catalog.generate_series(1, 101)),
      v_high_water,
      'ca170000-0000-4000-8000-000000000001',
      NULL
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    v_oversize_denied := true;
  END;
  IF NOT v_oversize_denied THEN
    RAISE EXCEPTION 'FAIL: cause reader accepted more than 100 task identities';
  END IF;
END;
$$;

ROLLBACK;

SELECT 'PASS: task inventory canonical change causes' AS result;
