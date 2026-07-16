-- Rollback-only executable proof for the canonical task lifecycle RPC.
BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
  (
    '1cf40000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'lifecycle-owner@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    '1cf40000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'lifecycle-member@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  );

INSERT INTO public.workspaces (id, name, owner_id) VALUES (
  '1cf40000-0000-4000-8000-000000000010', 'Lifecycle workspace',
  '1cf40000-0000-4000-8000-000000000001'
);
INSERT INTO public.workspace_members (id, workspace_id, user_id, role) VALUES (
  '1cf40000-0000-4000-8000-000000000011',
  '1cf40000-0000-4000-8000-000000000010',
  '1cf40000-0000-4000-8000-000000000002', 'member'
);
INSERT INTO public.projects (id, user_id, name, is_deleted, workspace_id) VALUES
  (
    '1cf40000-0000-4000-8000-000000000201',
    '1cf40000-0000-4000-8000-000000000001',
    'Lifecycle personal project', false, NULL
  ),
  (
    '1cf40000-0000-4000-8000-000000000202',
    '1cf40000-0000-4000-8000-000000000002',
    'Lifecycle foreign project', false, NULL
  ),
  (
    '1cf40000-0000-4000-8000-000000000203',
    '1cf40000-0000-4000-8000-000000000001',
    'Lifecycle shared project', false,
    '1cf40000-0000-4000-8000-000000000010'
  );

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, instances, subtasks, is_in_inbox,
  recurrence_rule
) VALUES
  (
    '1cf40000-0000-4000-8000-000000000102',
    '1cf40000-0000-4000-8000-000000000001',
    'Recurring lifecycle fixture', 'planned', false, '[]', '[]', true,
    '{"frequency":"daily","interval":1}'
  ),
  (
    '1cf40000-0000-4000-8000-000000000103',
    '1cf40000-0000-4000-8000-000000000001',
    'Lifecycle rollback fixture', 'planned', false, '[]', '[]', true, NULL
  );

-- Stable task identities remain unavailable across owners after hard deletion.
INSERT INTO public.tombstones (
  user_id, entity_type, entity_id, deleted_at, expires_at
) VALUES (
  '1cf40000-0000-4000-8000-000000000001', 'task',
  '1cf40000-0000-4000-8000-000000000107', now(), NULL
);

SELECT set_config('request.jwt.claim.sub', '1cf40000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"1cf40000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE lifecycle_results (
  key text PRIMARY KEY,
  payload jsonb NOT NULL
) ON COMMIT DROP;

-- Stable caller id create, followed by exact replay.
INSERT INTO lifecycle_results (key, payload)
SELECT 'create_preview', public.flowstate_task_lifecycle_v1(
  'lifecycle-create', 'task-lifecycle-v1', 'local-api', 'create',
  '1cf40000-0000-4000-8000-000000000101', 0,
  '{"title":"Lifecycle created","status":"planned","description":"Exact details","priority":"high","dueDate":"2026-07-31","projectId":"1cf40000-0000-4000-8000-000000000201"}', true
);
INSERT INTO lifecycle_results (key, payload)
SELECT 'create_apply', public.flowstate_task_lifecycle_v1(
  'lifecycle-create', 'task-lifecycle-v1', 'local-api', 'create',
  '1cf40000-0000-4000-8000-000000000101', 0,
  '{"title":"Lifecycle created","status":"planned","description":"Exact details","priority":"high","dueDate":"2026-07-31","projectId":"1cf40000-0000-4000-8000-000000000201"}', false,
  preview.payload->>'previewDigest',
  (preview.payload->>'previewExpiresAt')::timestamptz
) FROM lifecycle_results AS preview WHERE preview.key = 'create_preview';
INSERT INTO lifecycle_results (key, payload)
SELECT 'create_replay', public.flowstate_task_lifecycle_v1(
  'lifecycle-create', 'task-lifecycle-v1', 'local-api', 'create',
  '1cf40000-0000-4000-8000-000000000101', 0,
  '{"title":"Lifecycle created","status":"planned","description":"Exact details","priority":"high","dueDate":"2026-07-31","projectId":"1cf40000-0000-4000-8000-000000000201"}', false,
  preview.payload->>'previewDigest',
  (preview.payload->>'previewExpiresAt')::timestamptz
) FROM lifecycle_results AS preview WHERE preview.key = 'create_preview';

DO $$
DECLARE
  v_apply jsonb := (SELECT payload FROM lifecycle_results WHERE key = 'create_apply');
  v_replay jsonb := (SELECT payload FROM lifecycle_results WHERE key = 'create_replay');
  v_read_back jsonb := v_apply #> '{receipt,readBack}';
  v_hash text;
BEGIN
  v_hash := pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(public.flowstate_canonical_json_text_v1(v_read_back), 'UTF8'),
      'sha256'
    ), 'hex'
  );
  IF v_apply #>> '{receipt,entityId}' <> '1cf40000-0000-4000-8000-000000000101'
     OR v_apply #>> '{receipt,action}' <> 'create'
     OR v_apply #>> '{receipt,status}' <> 'committed'
     OR nullif(v_apply #>> '{receipt,requestHash}', '') IS NULL
     OR v_apply #>> '{receipt,readBackHash}' <> v_hash
     OR v_apply #>> '{receipt,readBack,title}' <> 'Lifecycle created'
     OR v_apply #>> '{receipt,readBack,description}' <> 'Exact details'
     OR v_apply #>> '{receipt,readBack,priority}' <> 'high'
     OR v_apply #>> '{receipt,readBack,dueDate}' <> '2026-07-31'
     OR v_apply #>> '{receipt,readBack,projectId}' <> '1cf40000-0000-4000-8000-000000000201'
     OR v_apply #>> '{receipt,readBack,tombstone}' <> 'false'
     OR v_replay #>> '{receipt,replayed}' <> 'true'
     OR (v_replay #- '{receipt,replayed}') IS DISTINCT FROM (v_apply #- '{receipt,replayed}')
     OR (SELECT count(*) FROM public.canonical_change_log WHERE operation_id = 'lifecycle-create') <> 1 THEN
    RAISE EXCEPTION 'FAIL: lifecycle create/replay receipt is incomplete: %, %', v_apply, v_replay;
  END IF;
END $$;

-- Invalid optional fields and foreign projects must fail before creating durable state.
INSERT INTO lifecycle_results (key, payload)
SELECT 'invalid_create_date', public.flowstate_task_lifecycle_v1(
  'lifecycle-invalid-date', 'task-lifecycle-v1', 'local-api', 'create',
  '1cf40000-0000-4000-8000-000000000105', 0,
  '{"title":"Bad date","dueDate":"2026-02-30"}', true
);
INSERT INTO lifecycle_results (key, payload)
SELECT 'foreign_create_project', public.flowstate_task_lifecycle_v1(
  'lifecycle-foreign-project', 'task-lifecycle-v1', 'local-api', 'create',
  '1cf40000-0000-4000-8000-000000000106', 0,
  '{"title":"Wrong project","projectId":"1cf40000-0000-4000-8000-000000000202"}', true
);
INSERT INTO lifecycle_results (key, payload)
SELECT 'spoofed_source', public.flowstate_task_lifecycle_v1(
  'lifecycle-spoofed-source', 'task-lifecycle-v1', 'notion', 'create',
  '1cf40000-0000-4000-8000-000000000108', 0,
  '{"title":"Spoofed provenance"}', true
);
DO $$
BEGIN
  IF (SELECT payload #>> '{error,code}' FROM lifecycle_results WHERE key = 'invalid_create_date') <> 'invalid_create'
     OR (SELECT payload #>> '{error,code}' FROM lifecycle_results WHERE key = 'foreign_create_project') <> 'project_not_found'
     OR (SELECT payload #>> '{error,code}' FROM lifecycle_results WHERE key = 'spoofed_source') <> 'invalid_request'
     OR EXISTS (
       SELECT 1 FROM public.tasks
       WHERE id::text IN (
         '1cf40000-0000-4000-8000-000000000105',
         '1cf40000-0000-4000-8000-000000000106',
         '1cf40000-0000-4000-8000-000000000108'
       )
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_operation_previews
       WHERE operation_id IN (
         'lifecycle-invalid-date', 'lifecycle-foreign-project', 'lifecycle-spoofed-source'
       )
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE operation_id IN (
         'lifecycle-invalid-date', 'lifecycle-foreign-project', 'lifecycle-spoofed-source'
       )
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_change_log
       WHERE operation_id IN (
         'lifecycle-invalid-date', 'lifecycle-foreign-project', 'lifecycle-spoofed-source'
       )
     ) THEN
    RAISE EXCEPTION 'FAIL: invalid lifecycle create escaped validation';
  END IF;
END $$;

-- Soft delete writes a permanent tombstone; restore removes it.
INSERT INTO lifecycle_results (key, payload)
SELECT 'delete_preview', public.flowstate_task_lifecycle_v1(
  'lifecycle-soft-delete', 'task-lifecycle-v1', 'local-api', 'soft_delete',
  task.id::text, task.canonical_revision, '{}'::jsonb, true
) FROM public.tasks AS task WHERE task.id::text = '1cf40000-0000-4000-8000-000000000101';
INSERT INTO lifecycle_results (key, payload)
SELECT 'delete_apply', public.flowstate_task_lifecycle_v1(
  'lifecycle-soft-delete', 'task-lifecycle-v1', 'local-api', 'soft_delete',
  '1cf40000-0000-4000-8000-000000000101',
  (preview.payload->>'baseRevision')::bigint, '{}'::jsonb, false,
  preview.payload->>'previewDigest', (preview.payload->>'previewExpiresAt')::timestamptz
) FROM lifecycle_results AS preview WHERE preview.key = 'delete_preview';

INSERT INTO lifecycle_results (key, payload)
SELECT 'restore_preview', public.flowstate_task_lifecycle_v1(
  'lifecycle-restore', 'task-lifecycle-v1', 'local-api', 'restore',
  task.id::text, task.canonical_revision, '{}'::jsonb, true
) FROM public.tasks AS task WHERE task.id::text = '1cf40000-0000-4000-8000-000000000101';
INSERT INTO lifecycle_results (key, payload)
SELECT 'restore_apply', public.flowstate_task_lifecycle_v1(
  'lifecycle-restore', 'task-lifecycle-v1', 'local-api', 'restore',
  '1cf40000-0000-4000-8000-000000000101',
  (preview.payload->>'baseRevision')::bigint, '{}'::jsonb, false,
  preview.payload->>'previewDigest', (preview.payload->>'previewExpiresAt')::timestamptz
) FROM lifecycle_results AS preview WHERE preview.key = 'restore_preview';

DO $$
BEGIN
  IF (SELECT payload #>> '{receipt,readBack,isDeleted}' FROM lifecycle_results WHERE key = 'delete_apply') <> 'true'
     OR (SELECT payload #>> '{receipt,readBack,tombstone}' FROM lifecycle_results WHERE key = 'delete_apply') <> 'true'
     OR (SELECT payload #>> '{receipt,readBack,isDeleted}' FROM lifecycle_results WHERE key = 'restore_apply') <> 'false'
     OR (SELECT payload #>> '{receipt,readBack,tombstone}' FROM lifecycle_results WHERE key = 'restore_apply') <> 'false'
     OR EXISTS (
       SELECT 1 FROM public.tombstones
       WHERE entity_type = 'task' AND entity_id = '1cf40000-0000-4000-8000-000000000101'
     ) THEN
    RAISE EXCEPTION 'FAIL: lifecycle tombstone semantics diverged';
  END IF;
END $$;

-- Status uses CAS. Recurring completion must use done-for-now instead.
INSERT INTO lifecycle_results (key, payload)
SELECT 'status_preview', public.flowstate_task_lifecycle_v1(
  'lifecycle-set-status', 'task-lifecycle-v1', 'local-api', 'set_status',
  task.id::text, task.canonical_revision, '{"status":"in_progress"}', true
) FROM public.tasks AS task WHERE task.id::text = '1cf40000-0000-4000-8000-000000000101';
INSERT INTO lifecycle_results (key, payload)
SELECT 'status_apply', public.flowstate_task_lifecycle_v1(
  'lifecycle-set-status', 'task-lifecycle-v1', 'local-api', 'set_status',
  '1cf40000-0000-4000-8000-000000000101',
  (preview.payload->>'baseRevision')::bigint, '{"status":"in_progress"}', false,
  preview.payload->>'previewDigest', (preview.payload->>'previewExpiresAt')::timestamptz
) FROM lifecycle_results AS preview WHERE preview.key = 'status_preview';
INSERT INTO lifecycle_results (key, payload)
SELECT 'recurring_done', public.flowstate_task_lifecycle_v1(
  'lifecycle-recurring-done', 'task-lifecycle-v1', 'local-api', 'set_status',
  task.id::text, task.canonical_revision, '{"status":"done"}', true
) FROM public.tasks AS task WHERE task.id::text = '1cf40000-0000-4000-8000-000000000102';
INSERT INTO lifecycle_results (key, payload)
SELECT 'stale_status', public.flowstate_task_lifecycle_v1(
  'lifecycle-stale-status', 'task-lifecycle-v1', 'local-api', 'set_status',
  task.id::text, task.canonical_revision - 1, '{"status":"done"}', true
) FROM public.tasks AS task WHERE task.id::text = '1cf40000-0000-4000-8000-000000000101';

DO $$
BEGIN
  IF (SELECT payload #>> '{receipt,readBack,status}' FROM lifecycle_results WHERE key = 'status_apply') <> 'in_progress'
     OR (SELECT payload #>> '{error,code}' FROM lifecycle_results WHERE key = 'recurring_done') <> 'recurrence_requires_done_for_now'
     OR (SELECT payload #>> '{error,code}' FROM lifecycle_results WHERE key = 'stale_status') <> 'stale_revision' THEN
    RAISE EXCEPTION 'FAIL: lifecycle status/CAS/recurrence safeguards diverged';
  END IF;
END $$;

-- A workspace member may create in the shared scope; an unrelated scope is hidden.
SELECT set_config('request.jwt.claim.sub', '1cf40000-0000-4000-8000-000000000002', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"1cf40000-0000-4000-8000-000000000002","role":"authenticated"}', true
);
INSERT INTO lifecycle_results (key, payload)
SELECT 'workspace_preview', public.flowstate_task_lifecycle_v1(
  'lifecycle-workspace-create', 'task-lifecycle-v1', 'local-api', 'create',
  '1cf40000-0000-4000-8000-000000000104', 0,
  '{"title":"Shared member task","projectId":"1cf40000-0000-4000-8000-000000000203"}', true, NULL, NULL,
  '1cf40000-0000-4000-8000-000000000010'
);
INSERT INTO lifecycle_results (key, payload)
SELECT 'wrong_scope', public.flowstate_task_lifecycle_v1(
  'lifecycle-wrong-scope', 'task-lifecycle-v1', 'local-api', 'soft_delete',
  '1cf40000-0000-4000-8000-000000000101', 1, '{}'::jsonb, true
);
INSERT INTO lifecycle_results (key, payload)
SELECT 'cross_owner_tombstone', public.flowstate_task_lifecycle_v1(
  'lifecycle-cross-owner-tombstone', 'task-lifecycle-v1', 'local-api', 'create',
  '1cf40000-0000-4000-8000-000000000107', 0,
  '{"title":"Must remain deleted"}', true, NULL, NULL,
  '1cf40000-0000-4000-8000-000000000010'
);
DO $$
BEGIN
  IF (SELECT payload->>'result' FROM lifecycle_results WHERE key = 'workspace_preview') <> 'preview'
     OR (SELECT payload #>> '{error,code}' FROM lifecycle_results WHERE key = 'wrong_scope') <> 'not_found' THEN
    RAISE EXCEPTION 'FAIL: lifecycle workspace/RLS scope diverged';
  END IF;
  IF (SELECT payload #>> '{error,code}' FROM lifecycle_results WHERE key = 'cross_owner_tombstone') <> 'task_id_unavailable'
     OR EXISTS (
       SELECT 1 FROM public.tasks
       WHERE id::text = '1cf40000-0000-4000-8000-000000000107'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_operation_previews
       WHERE operation_id = 'lifecycle-cross-owner-tombstone'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE operation_id = 'lifecycle-cross-owner-tombstone'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_change_log
       WHERE operation_id = 'lifecycle-cross-owner-tombstone'
     ) THEN
    RAISE EXCEPTION 'FAIL: cross-owner tombstone identity was reusable';
  END IF;
END $$;

-- Injected failure must roll back row, change, operation, and preview consumption.
SELECT set_config('request.jwt.claim.sub', '1cf40000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"1cf40000-0000-4000-8000-000000000001","role":"authenticated"}', true
);
INSERT INTO lifecycle_results (key, payload)
SELECT 'rollback_preview', public.flowstate_task_lifecycle_v1(
  'lifecycle-rollback', 'task-lifecycle-v1', 'local-api', 'set_status',
  task.id::text, task.canonical_revision, '{"status":"in_progress"}', true
) FROM public.tasks AS task WHERE task.id::text = '1cf40000-0000-4000-8000-000000000103';

CREATE FUNCTION public.test_force_lifecycle_failure()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id::text = '1cf40000-0000-4000-8000-000000000103'
     AND NEW.status = 'in_progress' THEN
    RAISE EXCEPTION 'injected lifecycle failure';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_force_lifecycle_failure
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.test_force_lifecycle_failure();

DO $$
DECLARE
  v_preview jsonb := (SELECT payload FROM lifecycle_results WHERE key = 'rollback_preview');
BEGIN
  BEGIN
    PERFORM public.flowstate_task_lifecycle_v1(
      'lifecycle-rollback', 'task-lifecycle-v1', 'local-api', 'set_status',
      '1cf40000-0000-4000-8000-000000000103',
      (v_preview->>'baseRevision')::bigint, '{"status":"in_progress"}', false,
      v_preview->>'previewDigest', (v_preview->>'previewExpiresAt')::timestamptz
    );
    RAISE EXCEPTION 'FAIL: injected lifecycle failure did not propagate';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'FAIL: injected lifecycle failure did not propagate' THEN RAISE; END IF;
    IF SQLERRM <> 'injected lifecycle failure' THEN RAISE; END IF;
  END;

  IF (SELECT status FROM public.tasks WHERE id::text = '1cf40000-0000-4000-8000-000000000103') <> 'planned'
     OR EXISTS (SELECT 1 FROM public.canonical_change_log WHERE operation_id = 'lifecycle-rollback')
     OR EXISTS (SELECT 1 FROM public.canonical_operations WHERE operation_id = 'lifecycle-rollback')
     OR EXISTS (
       SELECT 1 FROM public.canonical_operation_previews
       WHERE operation_id = 'lifecycle-rollback' AND consumed_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'failed lifecycle apply left partial canonical state';
  END IF;
END $$;

DROP TRIGGER test_force_lifecycle_failure ON public.tasks;
DROP FUNCTION public.test_force_lifecycle_failure();

DO $$ BEGIN
  RAISE NOTICE 'PASS: lifecycle create, delete, restore, status, replay, scope, and rollback';
END $$;

ROLLBACK;
