-- Disposable regression proof for TASK-1948. Every fixture is rolled back.
-- Run after the TASK-1944 and TASK-1948 migrations are loaded in the session.

BEGIN;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  aud, role, confirmation_token, recovery_token
) VALUES
  (
    'ca120000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'notion-owner@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  ),
  (
    'ca120000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'notion-other@test.flowstate', '', now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}',
    'authenticated', 'authenticated', '', ''
  );

INSERT INTO public.projects (id, user_id, name, is_deleted)
VALUES ('ca120000-0000-4000-8000-000000000100', 'ca120000-0000-4000-8000-000000000001', 'Notion project', false);

SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', 'ca120000-0000-4000-8000-000000000001', true
);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"ca120000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE notion_activation_results (
  key text PRIMARY KEY,
  payload jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO notion_activation_results (key, payload)
VALUES (
  'preview',
  public.flowstate_activate_notion_task_v1(
    p_operation_id => 'notion-activate-1',
    p_notion => '{
      "pageId":"notion-page-1",
      "dataSourceId":"notion-source-1",
      "url":"https://www.notion.so/notion-page-1",
      "lastEditedAt":"2026-07-14T08:00:00Z"
    }'::jsonb,
    p_task => '{
      "title":"Canonical Notion task",
      "description":"Exact activation fixture",
      "priority":"high",
      "dueDate":"2026-07-15T12:00:00Z",
      "projectId":"ca120000-0000-4000-8000-000000000100"
    }'::jsonb,
    p_work_block => '{
      "scheduledDate":"2026-07-14",
      "scheduledTime":"10:30",
      "duration":25
    }'::jsonb,
    p_preview => true
  )
);

DO $$
DECLARE
  v_preview jsonb := (SELECT payload FROM notion_activation_results WHERE key = 'preview');
BEGIN
  IF v_preview->>'result' <> 'preview'
     OR v_preview->>'contractVersion' <> 'notion-activation-v1'
     OR v_preview->>'operationId' <> 'notion-activate-1'
     OR v_preview #>> '{alreadyActivated}' <> 'false'
     OR v_preview #>> '{normalizedPayload,notionPageId}' <> 'notion-page-1'
     OR nullif(v_preview->>'previewDigest', '') IS NULL
     OR (v_preview->>'previewExpiresAt')::timestamptz <= pg_catalog.clock_timestamp()
     OR EXISTS (
       SELECT 1 FROM public.tasks
       WHERE user_id = 'ca120000-0000-4000-8000-000000000001'
         AND external_source = 'notion'
         AND external_id = 'notion-page-1'
     )
     OR EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE user_id = 'ca120000-0000-4000-8000-000000000001'
         AND operation_id = 'notion-activate-1'
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.canonical_operation_previews
       WHERE user_id = 'ca120000-0000-4000-8000-000000000001'
         AND operation_id = 'notion-activate-1'
         AND consumed_at IS NULL
     ) THEN
    RAISE EXCEPTION 'FAIL: preview was not durable and mutation-free: %', v_preview;
  END IF;
END $$;

INSERT INTO notion_activation_results (key, payload)
SELECT 'apply', public.flowstate_activate_notion_task_v1(
  p_operation_id => 'notion-activate-1',
  p_notion => '{
    "pageId":"notion-page-1",
    "dataSourceId":"notion-source-1",
    "url":"https://www.notion.so/notion-page-1",
    "lastEditedAt":"2026-07-14T08:00:00Z"
  }'::jsonb,
  p_task => '{
    "title":"Canonical Notion task",
    "description":"Exact activation fixture",
    "priority":"high",
    "dueDate":"2026-07-15T12:00:00Z",
    "projectId":"ca120000-0000-4000-8000-000000000100"
  }'::jsonb,
  p_work_block => '{
    "scheduledDate":"2026-07-14",
    "scheduledTime":"10:30",
    "duration":25
  }'::jsonb,
  p_preview => false,
  p_preview_digest => preview.payload->>'previewDigest',
  p_preview_expires_at => (preview.payload->>'previewExpiresAt')::timestamptz
)
FROM notion_activation_results AS preview
WHERE preview.key = 'preview';

DO $$
DECLARE
  v_apply jsonb := (SELECT payload FROM notion_activation_results WHERE key = 'apply');
  v_task public.tasks%ROWTYPE;
  v_change public.canonical_change_log%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_task
  FROM public.tasks
  WHERE user_id = 'ca120000-0000-4000-8000-000000000001'
    AND external_source = 'notion'
    AND external_id = 'notion-page-1'
    AND is_deleted = false;
  SELECT * INTO STRICT v_change
  FROM public.canonical_change_log
  WHERE operation_id = 'notion-activate-1'
  ORDER BY change_sequence DESC LIMIT 1;

  IF v_apply->>'result' <> 'committed'
     OR v_apply #>> '{receipt,contractVersion}' <> 'notion-activation-v1'
     OR v_apply #>> '{receipt,source}' <> 'notion'
     OR v_apply #>> '{receipt,entityType}' <> 'task'
     OR v_apply #>> '{receipt,action}' <> 'activate'
     OR v_apply #>> '{receipt,externalId}' <> 'notion-page-1'
     OR v_apply #>> '{receipt,replayed}' <> 'false'
     OR (v_apply #>> '{receipt,canonicalRevision}')::bigint <> v_task.canonical_revision
     OR (v_apply #>> '{receipt,changeSequence}')::bigint <> v_change.change_sequence
     OR v_apply #>> '{receipt,readBack,externalSource}' <> 'notion'
     OR v_apply #>> '{receipt,readBack,externalDataSourceId}' <> 'notion-source-1'
     OR v_apply #>> '{receipt,readBack,instances,0,scheduledDate}' <> '2026-07-14'
     OR v_apply #>> '{receipt,readBack,instances,0,scheduledTime}' <> '10:30'
     OR v_apply #>> '{receipt,readBack,instances,0,duration}' <> '25'
     OR pg_catalog.char_length(v_apply #>> '{receipt,readBackHash}') <> 64
     OR v_apply #>> '{receipt,readBackHash}' <> pg_catalog.encode(
       extensions.digest(
         pg_catalog.convert_to(
           public.flowstate_canonical_json_text_v1(
             v_apply #> '{receipt,readBack}'
           ),
           'UTF8'
         ),
         'sha256'
       ),
       'hex'
     )
     OR v_change.source <> 'notion'
     OR v_change.canonical_revision <> v_task.canonical_revision
     OR NOT EXISTS (
       SELECT 1 FROM public.canonical_operations
       WHERE user_id = 'ca120000-0000-4000-8000-000000000001'
         AND operation_id = 'notion-activate-1'
         AND state = 'committed'
         AND canonical_result = v_apply->'receipt'
     ) THEN
    RAISE EXCEPTION 'FAIL: canonical activation receipt is incomplete: %', v_apply;
  END IF;
END $$;

-- Authenticated legacy writers may keep editing ordinary task fields, but no
-- direct task write may create, change, or clear canonical Notion provenance.
GRANT SELECT ON notion_activation_results TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_column text;
  v_rejected boolean;
BEGIN
  BEGIN
    INSERT INTO public.tasks (
      id, user_id, title, status, progress, is_deleted,
      external_source, external_id, created_at, updated_at
    ) VALUES (
      'ca120000-0000-4000-8000-000000000201',
      'ca120000-0000-4000-8000-000000000001',
      'Forged provenance', 'planned', 0, false,
      'notion', 'forged-page', pg_catalog.now(), pg_catalog.now()
    );
    RAISE EXCEPTION 'FAIL: direct provenance insert was accepted';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  INSERT INTO public.tasks (
    id, user_id, title, status, progress, is_deleted, created_at, updated_at
  ) VALUES (
    'ca120000-0000-4000-8000-000000000202',
    'ca120000-0000-4000-8000-000000000001',
    'Ordinary direct task', 'planned', 0, false,
    pg_catalog.now(), pg_catalog.now()
  );

  SELECT pg_catalog.jsonb_build_array(
    external_source, external_id, external_url,
    external_data_source_id, external_last_edited_at
  ) INTO STRICT v_before
  FROM public.tasks
  WHERE id::text = (SELECT payload #>> '{receipt,entityId}'
              FROM notion_activation_results WHERE key = 'apply');

  UPDATE public.tasks
  SET title = 'Allowed ordinary edit'
  WHERE id::text = (SELECT payload #>> '{receipt,entityId}'
              FROM notion_activation_results WHERE key = 'apply');

  SELECT pg_catalog.jsonb_build_array(
    external_source, external_id, external_url,
    external_data_source_id, external_last_edited_at
  ) INTO STRICT v_after
  FROM public.tasks
  WHERE id::text = (SELECT payload #>> '{receipt,entityId}'
              FROM notion_activation_results WHERE key = 'apply');
  IF v_after IS DISTINCT FROM v_before THEN
    RAISE EXCEPTION 'FAIL: ordinary update changed provenance';
  END IF;

  FOREACH v_column IN ARRAY ARRAY[
    'external_source', 'external_id', 'external_url',
    'external_data_source_id', 'external_last_edited_at'
  ] LOOP
    v_rejected := false;
    BEGIN
      EXECUTE pg_catalog.format(
        'UPDATE public.tasks SET %I = NULL WHERE id = %L',
        v_column,
        (SELECT payload #>> '{receipt,entityId}'
         FROM notion_activation_results WHERE key = 'apply')
      );
    EXCEPTION WHEN insufficient_privilege THEN
      v_rejected := true;
    END;
    IF NOT v_rejected THEN
      RAISE EXCEPTION 'FAIL: direct provenance change was accepted for %', v_column;
    END IF;
  END LOOP;

  PERFORM pg_catalog.set_config(
    'flowstate.canonical.operation_id', 'forged-operation', true
  );
  BEGIN
    UPDATE public.tasks
    SET external_url = NULL
    WHERE id::text = (SELECT payload #>> '{receipt,entityId}'
                FROM notion_activation_results WHERE key = 'apply');
    RAISE EXCEPTION 'FAIL: arbitrary canonical GUC authorized provenance';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  PERFORM pg_catalog.set_config('flowstate.canonical.operation_id', '', true);
END $$;
RESET ROLE;

-- A committed retry must win even after its durable preview has expired.
UPDATE public.canonical_operation_previews
SET expires_at = pg_catalog.clock_timestamp() - interval '1 minute'
WHERE user_id = 'ca120000-0000-4000-8000-000000000001'
  AND operation_id = 'notion-activate-1';

INSERT INTO notion_activation_results (key, payload)
SELECT 'replay', public.flowstate_activate_notion_task_v1(
  'notion-activate-1',
  '{"pageId":"notion-page-1","dataSourceId":"notion-source-1","url":"https://www.notion.so/notion-page-1","lastEditedAt":"2026-07-14T08:00:00Z"}'::jsonb,
  '{"title":"Canonical Notion task","description":"Exact activation fixture","priority":"high","dueDate":"2026-07-15T12:00:00Z","projectId":"ca120000-0000-4000-8000-000000000100"}'::jsonb,
  '{"scheduledDate":"2026-07-14","scheduledTime":"10:30","duration":25}'::jsonb,
  false,
  preview.payload->>'previewDigest',
  pg_catalog.clock_timestamp() - interval '1 minute'
)
FROM notion_activation_results AS preview
WHERE preview.key = 'preview';

DO $$
DECLARE
  v_apply jsonb := (SELECT payload FROM notion_activation_results WHERE key = 'apply');
  v_replay jsonb := (SELECT payload FROM notion_activation_results WHERE key = 'replay');
BEGIN
  IF v_replay #>> '{receipt,replayed}' <> 'true'
     OR (v_replay #- '{receipt,replayed}') IS DISTINCT FROM (v_apply #- '{receipt,replayed}')
     OR (SELECT count(*) FROM public.tasks
         WHERE user_id = 'ca120000-0000-4000-8000-000000000001'
           AND external_source = 'notion' AND external_id = 'notion-page-1'
           AND is_deleted = false) <> 1
     OR (SELECT count(*) FROM public.canonical_change_log
         WHERE operation_id = 'notion-activate-1') <> 1 THEN
    RAISE EXCEPTION 'FAIL: committed replay was not stable: apply=%, replay=%', v_apply, v_replay;
  END IF;
END $$;

-- A new operation on the same provenance reuses the task and appends its exact
-- approved block once, rather than silently dropping scheduling intent.
INSERT INTO notion_activation_results (key, payload)
VALUES (
  'existing_preview',
  public.flowstate_activate_notion_task_v1(
    'notion-activate-2',
    '{"pageId":"notion-page-1","dataSourceId":"notion-source-1","url":"https://www.notion.so/notion-page-1","lastEditedAt":"2026-07-14T09:00:00Z"}'::jsonb,
    '{"title":"Canonical Notion task refreshed","description":"Exact activation fixture","priority":"high","dueDate":"2026-07-15T12:00:00Z","projectId":"ca120000-0000-4000-8000-000000000100"}'::jsonb,
    '{"scheduledDate":"2026-07-14","scheduledTime":"14:00","duration":40}'::jsonb,
    true
  )
);

INSERT INTO notion_activation_results (key, payload)
SELECT 'existing_apply', public.flowstate_activate_notion_task_v1(
  'notion-activate-2',
  '{"pageId":"notion-page-1","dataSourceId":"notion-source-1","url":"https://www.notion.so/notion-page-1","lastEditedAt":"2026-07-14T09:00:00Z"}'::jsonb,
  '{"title":"Canonical Notion task refreshed","description":"Exact activation fixture","priority":"high","dueDate":"2026-07-15T12:00:00Z","projectId":"ca120000-0000-4000-8000-000000000100"}'::jsonb,
  '{"scheduledDate":"2026-07-14","scheduledTime":"14:00","duration":40}'::jsonb,
  false,
  preview.payload->>'previewDigest',
  (preview.payload->>'previewExpiresAt')::timestamptz
)
FROM notion_activation_results AS preview
WHERE preview.key = 'existing_preview';

DO $$
DECLARE
  v_result jsonb := (SELECT payload FROM notion_activation_results WHERE key = 'existing_apply');
BEGIN
  IF v_result #>> '{receipt,alreadyActivated}' <> 'true'
     OR v_result #>> '{receipt,readBack,title}' <> 'Canonical Notion task refreshed'
     OR jsonb_array_length(v_result #> '{receipt,readBack,instances}') <> 2
     OR v_result #>> '{receipt,readBack,instances,1,scheduledTime}' <> '14:00'
     OR (SELECT count(*) FROM public.tasks
         WHERE user_id = 'ca120000-0000-4000-8000-000000000001'
           AND external_source = 'notion' AND external_id = 'notion-page-1'
           AND is_deleted = false) <> 1 THEN
    RAISE EXCEPTION 'FAIL: existing activation did not add its exact work block: %', v_result;
  END IF;
END $$;

INSERT INTO notion_activation_results (key, payload)
VALUES (
  'duplicate_block_preview',
  public.flowstate_activate_notion_task_v1(
    'notion-activate-3',
    '{"pageId":"notion-page-1","dataSourceId":"notion-source-1","url":"https://www.notion.so/notion-page-1","lastEditedAt":"2026-07-14T09:00:00Z"}'::jsonb,
    '{"title":"Canonical Notion task refreshed","description":"Exact activation fixture","priority":"high","dueDate":"2026-07-15T12:00:00Z","projectId":"ca120000-0000-4000-8000-000000000100"}'::jsonb,
    '{"scheduledDate":"2026-07-14","scheduledTime":"14:00","duration":40}'::jsonb,
    true
  )
);

INSERT INTO notion_activation_results (key, payload)
SELECT 'duplicate_block_apply', public.flowstate_activate_notion_task_v1(
  'notion-activate-3',
  '{"pageId":"notion-page-1","dataSourceId":"notion-source-1","url":"https://www.notion.so/notion-page-1","lastEditedAt":"2026-07-14T09:00:00Z"}'::jsonb,
  '{"title":"Canonical Notion task refreshed","description":"Exact activation fixture","priority":"high","dueDate":"2026-07-15T12:00:00Z","projectId":"ca120000-0000-4000-8000-000000000100"}'::jsonb,
  '{"scheduledDate":"2026-07-14","scheduledTime":"14:00","duration":40}'::jsonb,
  false,
  preview.payload->>'previewDigest',
  (preview.payload->>'previewExpiresAt')::timestamptz
)
FROM notion_activation_results AS preview
WHERE preview.key = 'duplicate_block_preview';

DO $$
DECLARE
  v_result jsonb := (
    SELECT payload FROM notion_activation_results WHERE key = 'duplicate_block_apply'
  );
BEGIN
  IF v_result #>> '{receipt,alreadyActivated}' <> 'true'
     OR jsonb_array_length(v_result #> '{receipt,readBack,instances}') <> 2
     OR (SELECT count(*)
         FROM jsonb_array_elements(v_result #> '{receipt,readBack,instances}') AS instance
         WHERE instance->>'scheduledDate' = '2026-07-14'
           AND instance->>'scheduledTime' = '14:00'
           AND instance->>'duration' = '40') <> 1
     OR (SELECT count(*) FROM public.canonical_change_log
         WHERE operation_id = 'notion-activate-3') <> 1 THEN
    RAISE EXCEPTION 'FAIL: a different operation duplicated an exact work block: %', v_result;
  END IF;
END $$;

INSERT INTO notion_activation_results (key, payload)
VALUES (
  'conflict',
  public.flowstate_activate_notion_task_v1(
    'notion-activate-1',
    '{"pageId":"notion-page-1","dataSourceId":"notion-source-1","url":"https://www.notion.so/notion-page-1","lastEditedAt":"2026-07-14T08:00:00Z"}'::jsonb,
    '{"title":"Altered operation payload"}'::jsonb,
    NULL, false, repeat('a', 64), pg_catalog.clock_timestamp() + interval '1 hour'
  )
);

-- Another signed user cannot smuggle an owner-only project into activation.
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub', 'ca120000-0000-4000-8000-000000000002', true
);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"ca120000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
INSERT INTO notion_activation_results (key, payload)
VALUES (
  'cross_user_project',
  public.flowstate_activate_notion_task_v1(
    'notion-cross-user',
    '{"pageId":"notion-page-2","dataSourceId":"notion-source-1","url":"https://www.notion.so/notion-page-2","lastEditedAt":"2026-07-14T08:00:00Z"}'::jsonb,
    '{"title":"Must reject","projectId":"ca120000-0000-4000-8000-000000000100"}'::jsonb,
    NULL, true
  )
);

DO $$
BEGIN
  IF (SELECT payload #>> '{error,code}' FROM notion_activation_results WHERE key = 'conflict')
       <> 'idempotency_conflict'
     OR (SELECT payload #>> '{error,code}' FROM notion_activation_results WHERE key = 'cross_user_project')
       <> 'project_not_found'
     OR pg_catalog.has_table_privilege('authenticated', 'public.canonical_operations', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.canonical_operation_previews', 'INSERT')
     OR pg_catalog.has_table_privilege('authenticated', 'public.canonical_change_log', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: identity collision, user scope, or ledger ACL failed closed';
  END IF;
  RAISE NOTICE 'TASK-1948 disposable canonical Notion activation contract passed';
END $$;

ROLLBACK;
