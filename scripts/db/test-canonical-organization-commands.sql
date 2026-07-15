-- H7 rollback-only canonical organization command contract.
BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
(
  '07a70000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'organization-owner@test.flowstate', '', now(), now(), now(), '{}', '{}',
  'authenticated', 'authenticated', '', ''
),
(
  '07a70000-0000-4000-8000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'organization-other@test.flowstate', '', now(), now(), now(), '{}', '{}',
  'authenticated', 'authenticated', '', ''
);

INSERT INTO public.projects (
  id, user_id, name, is_deleted, workspace_id
) VALUES
('07a70000-0000-4000-8000-000000000101', '07a70000-0000-4000-8000-000000000001', 'Launch', false, NULL),
('07a70000-0000-4000-8000-000000000102', '07a70000-0000-4000-8000-000000000001', 'Deleted', true, NULL),
('07a70000-0000-4000-8000-000000000103', '07a70000-0000-4000-8000-000000000002', 'Foreign', false, NULL);

INSERT INTO public.groups (
  id, user_id, name, type, position_json, is_power_mode, auto_collect,
  is_deleted, workspace_id
) VALUES
('07a70000-0000-4000-8000-000000000201', '07a70000-0000-4000-8000-000000000001', 'Writing', 'custom', '{}', false, false, false, NULL),
('07a70000-0000-4000-8000-000000000202', '07a70000-0000-4000-8000-000000000001', 'Today', 'timeline', '{}', true, true, false, NULL),
('07a70000-0000-4000-8000-000000000203', '07a70000-0000-4000-8000-000000000002', 'Foreign', 'custom', '{}', false, false, false, NULL);

INSERT INTO public.workspaces (id, name, owner_id) VALUES
('07a70000-0000-4000-8000-000000000401', 'Organization Workspace', '07a70000-0000-4000-8000-000000000001');
INSERT INTO public.workspace_members (workspace_id, user_id, role) VALUES
('07a70000-0000-4000-8000-000000000401', '07a70000-0000-4000-8000-000000000002', 'viewer');
INSERT INTO public.projects (id, user_id, name, is_deleted, workspace_id) VALUES
('07a70000-0000-4000-8000-000000000104', '07a70000-0000-4000-8000-000000000001', 'Shared Launch', false, '07a70000-0000-4000-8000-000000000401');
INSERT INTO public.groups (
  id, user_id, name, type, position_json, is_power_mode, auto_collect,
  is_deleted, workspace_id
) VALUES
('07a70000-0000-4000-8000-000000000204', '07a70000-0000-4000-8000-000000000001', 'Shared Writing', 'custom', '{}', false, false, false, '07a70000-0000-4000-8000-000000000401'),
('07a70000-0000-4000-8000-000000000205', '07a70000-0000-4000-8000-000000000001', 'Unknown Semantics', 'custom', '{}', NULL, false, false, '07a70000-0000-4000-8000-000000000401');

INSERT INTO public.tasks (
  id, user_id, title, status, is_deleted, is_in_inbox, position, workspace_id
) VALUES (
  '07a70000-0000-4000-8000-000000000301',
  '07a70000-0000-4000-8000-000000000001',
  'Organization target', 'planned', false, true,
  '{"x":120,"y":48,"width":320,"height":180,"custom":{"locked":true},"parentId":"old-group"}'::jsonb,
  NULL
), (
  '07a70000-0000-4000-8000-000000000302',
  '07a70000-0000-4000-8000-000000000001',
  'Malformed position', 'planned', false, true, '"legacy-string"'::jsonb,
  NULL
), (
  '07a70000-0000-4000-8000-000000000304',
  '07a70000-0000-4000-8000-000000000001',
  'Null Canvas position', 'planned', false, true, NULL,
  NULL
), (
  '07a70000-0000-4000-8000-000000000305',
  '07a70000-0000-4000-8000-000000000001',
  'Missing Canvas coordinate', 'planned', false, true, '{"x":12}'::jsonb,
  NULL
), (
  '07a70000-0000-4000-8000-000000000303',
  '07a70000-0000-4000-8000-000000000001',
  'Shared organization target', 'planned', false, true,
  '{"x":8,"y":16,"custom":{"shared":true}}'::jsonb,
  '07a70000-0000-4000-8000-000000000401'
);

SELECT set_config('request.jwt.claim.sub', '07a70000-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"07a70000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE organization_contract_results (
  key text PRIMARY KEY,
  payload jsonb NOT NULL
) ON COMMIT DROP;

-- Project preview is approval-bound and zero-domain-write.
DO $$
DECLARE
  v_revision bigint;
  v_change_count bigint;
  v_preview jsonb;
BEGIN
  SELECT canonical_revision INTO v_revision
  FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000301';
  SELECT count(*) INTO v_change_count FROM public.canonical_change_log;
  v_preview := public.flowstate_organization_task_v1(
    'organization-project-main', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000301', v_revision,
    '07a70000-0000-4000-8000-000000000101', true
  );
  IF v_preview->>'result' <> 'preview'
     OR v_preview #>> '{normalizedPayload,projectId}' <> '07a70000-0000-4000-8000-000000000101'
     OR v_preview #>> '{readBack,projectId}' <> '07a70000-0000-4000-8000-000000000101'
     OR (SELECT project_id FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000301') IS NOT NULL
     OR (SELECT canonical_revision FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000301') <> v_revision
     OR (SELECT count(*) FROM public.canonical_change_log) <> v_change_count THEN
    RAISE EXCEPTION 'FAIL: project preview was not zero-write: %', v_preview;
  END IF;
  INSERT INTO organization_contract_results VALUES ('project-preview', v_preview);
END $$;

-- Authorized workspace owner can apply exact shared-scope organization changes.
DO $$
DECLARE
  v_revision bigint := (
    SELECT canonical_revision FROM public.tasks
    WHERE id = '07a70000-0000-4000-8000-000000000303'
  );
  v_preview jsonb;
  v_apply jsonb;
BEGIN
  v_preview := public.flowstate_organization_task_v1(
    'organization-workspace-owner', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000303', v_revision,
    '07a70000-0000-4000-8000-000000000104', true,
    NULL, NULL, '07a70000-0000-4000-8000-000000000401'
  );
  v_apply := public.flowstate_organization_task_v1(
    'organization-workspace-owner', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000303', v_revision,
    '07a70000-0000-4000-8000-000000000104', false,
    v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz,
    '07a70000-0000-4000-8000-000000000401',
    v_preview->>'requestHash'
  );
  IF v_preview->>'result' <> 'preview'
     OR v_apply->>'result' <> 'committed'
     OR v_apply #>> '{receipt,scopeKind}' <> 'workspace'
     OR v_apply #>> '{receipt,workspaceId}' <> '07a70000-0000-4000-8000-000000000401'
     OR v_apply #>> '{receipt,readBack,projectId}' <> '07a70000-0000-4000-8000-000000000104' THEN
    RAISE EXCEPTION 'FAIL: authorized workspace mutation failed: %, %', v_preview, v_apply;
  END IF;
END $$;

-- Workspace viewers remain read-only at the canonical mutation boundary.
DO $$
DECLARE
  v_revision bigint := (
    SELECT canonical_revision FROM public.tasks
    WHERE id = '07a70000-0000-4000-8000-000000000303'
  );
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '07a70000-0000-4000-8000-000000000002', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"07a70000-0000-4000-8000-000000000002","role":"authenticated"}',
    true
  );
  v_result := public.flowstate_organization_task_v1(
    'organization-workspace-viewer', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000303', v_revision,
    '07a70000-0000-4000-8000-000000000104', true,
    NULL, NULL, '07a70000-0000-4000-8000-000000000401'
  );
  IF v_result #>> '{error,code}' <> 'scope_denied' THEN
    RAISE EXCEPTION 'FAIL: workspace viewer could mutate organization: %', v_result;
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '07a70000-0000-4000-8000-000000000001', true);
  PERFORM set_config(
    'request.jwt.claims',
    '{"sub":"07a70000-0000-4000-8000-000000000001","role":"authenticated"}',
    true
  );
END $$;

-- Apply returns one canonical receipt and identical retry is durable replay.
DO $$
DECLARE
  v_preview jsonb := (
    SELECT payload FROM organization_contract_results WHERE key = 'project-preview'
  );
  v_apply jsonb;
  v_replay jsonb;
BEGIN
  v_apply := public.flowstate_organization_task_v1(
    'organization-project-main', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000301',
    (v_preview->>'baseRevision')::bigint,
    '07a70000-0000-4000-8000-000000000101', false,
    v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz,
    NULL,
    v_preview->>'requestHash'
  );
  v_replay := public.flowstate_organization_task_v1(
    'organization-project-main', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000301',
    (v_preview->>'baseRevision')::bigint,
    '07a70000-0000-4000-8000-000000000101', false,
    v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz,
    NULL,
    v_preview->>'requestHash'
  );
  IF v_apply->>'result' <> 'committed'
     OR v_apply #>> '{receipt,status}' <> 'committed'
     OR v_apply #>> '{receipt,action}' <> 'assign_project'
     OR v_apply #>> '{receipt,readBack,projectId}' <> '07a70000-0000-4000-8000-000000000101'
     OR v_apply #>> '{receipt,operationContext,projectId}' <> '07a70000-0000-4000-8000-000000000101'
     OR v_replay #>> '{receipt,status}' <> 'replayed'
     OR v_replay #>> '{receipt,replayed}' <> 'true'
     OR (SELECT project_id::text FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000301') <> '07a70000-0000-4000-8000-000000000101'
     OR (SELECT count(*) FROM public.canonical_change_log WHERE operation_id = 'organization-project-main') <> 1 THEN
    RAISE EXCEPTION 'FAIL: project assignment did not return durable replay: %, %', v_apply, v_replay;
  END IF;
END $$;

-- Plain Canvas membership changes parentId only and preserves every other key.
DO $$
DECLARE
  v_revision bigint;
  v_before jsonb;
  v_preview jsonb;
  v_apply jsonb;
BEGIN
  SELECT canonical_revision, position INTO v_revision, v_before
  FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000301';
  v_preview := public.flowstate_organization_task_v1(
    'organization-group-main', 'task-v1', 'local-api', 'set_canvas_group',
    '07a70000-0000-4000-8000-000000000301', v_revision,
    '07a70000-0000-4000-8000-000000000201', true
  );
  IF v_preview->>'result' <> 'preview'
     OR v_preview #>> '{readBack,position,parentId}' <> '07a70000-0000-4000-8000-000000000201'
     OR (v_preview #> '{readBack,position}') - 'parentId' <> v_before - 'parentId'
     OR (SELECT position FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000301') <> v_before THEN
    RAISE EXCEPTION 'FAIL: Canvas membership preview changed unrelated position metadata: %', v_preview;
  END IF;
  v_apply := public.flowstate_organization_task_v1(
    'organization-group-main', 'task-v1', 'local-api', 'set_canvas_group',
    '07a70000-0000-4000-8000-000000000301', v_revision,
    '07a70000-0000-4000-8000-000000000201', false,
    v_preview->>'previewDigest',
    (v_preview->>'previewExpiresAt')::timestamptz,
    NULL,
    v_preview->>'requestHash'
  );
  IF v_apply->>'result' <> 'committed'
     OR v_apply #>> '{receipt,readBack,position,parentId}' <> '07a70000-0000-4000-8000-000000000201'
     OR v_apply #>> '{receipt,readBack,isInInbox}' <> 'false'
     OR (SELECT is_in_inbox FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000301')
     OR ((SELECT position FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000301') - 'parentId') <> (v_before - 'parentId') THEN
    RAISE EXCEPTION 'FAIL: unrelated position metadata was lost: %', v_apply;
  END IF;
END $$;

-- Missing/deleted/cross-scope targets and unsupported smart group semantics fail closed.
DO $$
DECLARE
  v_revision bigint := (
    SELECT canonical_revision FROM public.tasks
    WHERE id = '07a70000-0000-4000-8000-000000000301'
  );
  v_result jsonb;
BEGIN
  v_result := public.flowstate_organization_task_v1(
    'organization-deleted-project', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000301', v_revision,
    '07a70000-0000-4000-8000-000000000102', true
  );
  IF v_result #>> '{error,code}' <> 'project_not_found' THEN
    RAISE EXCEPTION 'FAIL: deleted project was assignable: %', v_result;
  END IF;
  v_result := public.flowstate_organization_task_v1(
    'organization-cross-scope-project', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000301', v_revision,
    '07a70000-0000-4000-8000-000000000103', true
  );
  IF v_result #>> '{error,code}' <> 'project_not_found' THEN
    RAISE EXCEPTION 'FAIL: cross-scope project was assignable: %', v_result;
  END IF;
  v_result := public.flowstate_organization_task_v1(
    'organization-cross-scope-group', 'task-v1', 'local-api', 'set_canvas_group',
    '07a70000-0000-4000-8000-000000000301', v_revision,
    '07a70000-0000-4000-8000-000000000203', true
  );
  IF v_result #>> '{error,code}' <> 'group_not_found' THEN
    RAISE EXCEPTION 'FAIL: cross-scope Canvas group was assignable: %', v_result;
  END IF;
  v_result := public.flowstate_organization_task_v1(
    'organization-smart-group', 'task-v1', 'local-api', 'set_canvas_group',
    '07a70000-0000-4000-8000-000000000301', v_revision,
    '07a70000-0000-4000-8000-000000000202', true
  );
  IF v_result #>> '{error,code}' <> 'unsupported_smart_group' THEN
    RAISE EXCEPTION 'FAIL: smart group semantics were guessed: %', v_result;
  END IF;
  v_result := public.flowstate_organization_task_v1(
    'organization-null-smart-flags', 'task-v1', 'local-api', 'set_canvas_group',
    '07a70000-0000-4000-8000-000000000303',
    (SELECT canonical_revision FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000303'),
    '07a70000-0000-4000-8000-000000000205', true,
    NULL, NULL, '07a70000-0000-4000-8000-000000000401'
  );
  IF v_result #>> '{error,code}' <> 'unsupported_smart_group' THEN
    RAISE EXCEPTION 'FAIL: unknown smart-group flags were guessed: %', v_result;
  END IF;
  v_result := public.flowstate_organization_task_v1(
    'organization-malformed-position', 'task-v1', 'local-api', 'set_canvas_group',
    '07a70000-0000-4000-8000-000000000302',
    (SELECT canonical_revision FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000302'),
    '07a70000-0000-4000-8000-000000000201', true
  );
  IF v_result #>> '{error,code}' <> 'invalid_task_position' THEN
    RAISE EXCEPTION 'FAIL: malformed Canvas position was not typed: %', v_result;
  END IF;
  v_result := public.flowstate_organization_task_v1(
    'organization-null-position', 'task-v1', 'local-api', 'set_canvas_group',
    '07a70000-0000-4000-8000-000000000304',
    (SELECT canonical_revision FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000304'),
    '07a70000-0000-4000-8000-000000000201', true
  );
  IF v_result #>> '{error,code}' <> 'invalid_task_position' THEN
    RAISE EXCEPTION 'FAIL: null Canvas position was not rejected: %', v_result;
  END IF;
  v_result := public.flowstate_organization_task_v1(
    'organization-missing-coordinate', 'task-v1', 'local-api', 'set_canvas_group',
    '07a70000-0000-4000-8000-000000000305',
    (SELECT canonical_revision FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000305'),
    '07a70000-0000-4000-8000-000000000201', true
  );
  IF v_result #>> '{error,code}' <> 'invalid_task_position' THEN
    RAISE EXCEPTION 'FAIL: incomplete Canvas geometry was not rejected: %', v_result;
  END IF;
END $$;

-- Audit provenance cannot be forged by direct authenticated RPC callers.
DO $$
DECLARE v_result jsonb;
BEGIN
  v_result := public.flowstate_organization_task_v1(
    'organization-forged-source', 'task-v1', 'forged-client', 'assign_project',
    '07a70000-0000-4000-8000-000000000301',
    (SELECT canonical_revision FROM public.tasks WHERE id = '07a70000-0000-4000-8000-000000000301'),
    '07a70000-0000-4000-8000-000000000101', true
  );
  IF v_result #>> '{error,code}' <> 'invalid_request' THEN
    RAISE EXCEPTION 'FAIL: forged organization source was accepted: %', v_result;
  END IF;
END $$;

-- Forged approval and stale revision do not mutate the task.
DO $$
DECLARE
  v_revision bigint := (
    SELECT canonical_revision FROM public.tasks
    WHERE id = '07a70000-0000-4000-8000-000000000301'
  );
  v_preview jsonb;
  v_result jsonb;
BEGIN
  v_preview := public.flowstate_organization_task_v1(
    'organization-approval-bind', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000301', v_revision,
    '07a70000-0000-4000-8000-000000000101', true
  );
  v_result := public.flowstate_organization_task_v1(
    'organization-approval-bind', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000301', v_revision,
    '07a70000-0000-4000-8000-000000000101', false,
    repeat('0', 64),
    (v_preview->>'previewExpiresAt')::timestamptz,
    NULL,
    v_preview->>'requestHash'
  );
  IF v_result #>> '{error,code}' <> 'preview_mismatch' THEN
    RAISE EXCEPTION 'FAIL: forged approval was accepted: %', v_result;
  END IF;
  v_result := public.flowstate_organization_task_v1(
    'organization-stale', 'task-v1', 'local-api', 'assign_project',
    '07a70000-0000-4000-8000-000000000301', v_revision - 1,
    '07a70000-0000-4000-8000-000000000101', true
  );
  IF v_result #>> '{error,code}' <> 'stale_revision' THEN
    RAISE EXCEPTION 'FAIL: stale revision was accepted: %', v_result;
  END IF;
END $$;

ROLLBACK;
SELECT 'H7 canonical organization rollback-only contract passed' AS result;
