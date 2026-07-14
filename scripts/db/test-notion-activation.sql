\set ON_ERROR_STOP on

SELECT id::text AS test_user_id FROM auth.users ORDER BY created_at LIMIT 1 \gset
SELECT set_config('request.jwt.claim.sub', :'test_user_id', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  INSERT INTO public.notion_activation_receipts (
    user_id, operation_id, notion_page_id, payload_hash, task_id, response
  ) VALUES (
    auth.uid(), 'forged-operation', 'forged-page', 'forged-hash',
    'forged-task', '{"ok":true}'::jsonb
  );
  RAISE EXCEPTION 'authenticated role could forge a Notion activation receipt';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END;
$$;

DO $$
DECLARE
  v_page_id text := 'notion-fixture-' || gen_random_uuid()::text;
  v_operation_id text := 'activation-fixture-' || gen_random_uuid()::text;
  v_preview jsonb;
  v_apply jsonb;
  v_extended_expiry jsonb;
  v_replay jsonb;
  v_second_preview jsonb;
  v_second_apply jsonb;
  v_changed_preview jsonb;
  v_conflict jsonb;
  v_task_id text;
  v_count integer;
BEGIN
  v_preview := public.activate_notion_task(
    p_operation_id => v_operation_id,
    p_notion_page_id => v_page_id,
    p_notion_data_source_id => 'fixture-data-source',
    p_notion_url => 'https://www.notion.so/' || v_page_id,
    p_notion_last_edited_at => '2026-07-13T20:00:00Z',
    p_title => 'Disposable Notion activation fixture',
    p_description => 'Never committed outside this transaction',
    p_priority => 'high',
    p_due_date => '2026-07-14',
    p_work_block => jsonb_build_object(
      'scheduledDate', '2026-07-14',
      'scheduledTime', '10:30',
      'duration', 25
    ),
    p_preview => true
  );
  IF v_preview->>'result' <> 'preview' OR (v_preview->>'alreadyActivated')::boolean THEN
    RAISE EXCEPTION 'preview contract failed: %', v_preview;
  END IF;
  SELECT count(*) INTO v_count FROM public.tasks
  WHERE user_id = auth.uid() AND external_source = 'notion' AND external_id = v_page_id;
  IF v_count <> 0 THEN RAISE EXCEPTION 'preview mutated tasks'; END IF;

  v_extended_expiry := public.activate_notion_task(
    p_operation_id => v_operation_id,
    p_notion_page_id => v_page_id,
    p_notion_data_source_id => 'fixture-data-source',
    p_notion_url => 'https://www.notion.so/' || v_page_id,
    p_notion_last_edited_at => '2026-07-13T20:00:00Z',
    p_title => 'Disposable Notion activation fixture',
    p_description => 'Never committed outside this transaction',
    p_priority => 'high',
    p_due_date => '2026-07-14',
    p_work_block => jsonb_build_object(
      'scheduledDate', '2026-07-14',
      'scheduledTime', '10:30',
      'duration', 25
    ),
    p_preview => false,
    p_preview_digest => v_preview->>'previewDigest',
    p_preview_expires_at => (v_preview->>'previewExpiresAt')::timestamptz + interval '1 hour'
  );
  IF v_extended_expiry#>>'{error,code}' <> 'stale_preview' THEN
    RAISE EXCEPTION 'preview expiry was not digest-bound: %', v_extended_expiry;
  END IF;

  v_apply := public.activate_notion_task(
    p_operation_id => v_operation_id,
    p_notion_page_id => v_page_id,
    p_notion_data_source_id => 'fixture-data-source',
    p_notion_url => 'https://www.notion.so/' || v_page_id,
    p_notion_last_edited_at => '2026-07-13T20:00:00Z',
    p_title => 'Disposable Notion activation fixture',
    p_description => 'Never committed outside this transaction',
    p_priority => 'high',
    p_due_date => '2026-07-14',
    p_work_block => jsonb_build_object(
      'scheduledDate', '2026-07-14',
      'scheduledTime', '10:30',
      'duration', 25
    ),
    p_preview => false,
    p_preview_digest => v_preview->>'previewDigest',
    p_preview_expires_at => (v_preview->>'previewExpiresAt')::timestamptz
  );
  IF v_apply->>'result' <> 'committed' THEN
    RAISE EXCEPTION 'apply contract failed: %', v_apply;
  END IF;
  v_task_id := v_apply#>>'{receipt,entityId}';
  IF v_task_id IS NULL
     OR v_apply#>>'{receipt,readBack,externalId}' <> v_page_id
     OR jsonb_array_length(v_apply#>'{receipt,readBack,instances}') <> 1
     OR v_apply#>>'{receipt,readBack,instances,0,scheduledTime}' <> '10:30' THEN
    RAISE EXCEPTION 'read-back contract failed: %', v_apply;
  END IF;

  v_replay := public.activate_notion_task(
    p_operation_id => v_operation_id,
    p_notion_page_id => v_page_id,
    p_notion_data_source_id => 'fixture-data-source',
    p_notion_url => 'https://www.notion.so/' || v_page_id,
    p_notion_last_edited_at => '2026-07-13T20:00:00Z',
    p_title => 'Disposable Notion activation fixture',
    p_description => 'Never committed outside this transaction',
    p_priority => 'high',
    p_due_date => '2026-07-14',
    p_work_block => jsonb_build_object(
      'scheduledDate', '2026-07-14',
      'scheduledTime', '10:30',
      'duration', 25
    ),
    p_preview => false,
    p_preview_digest => v_preview->>'previewDigest',
    p_preview_expires_at => '2000-01-01T00:00:00Z'
  );
  IF v_replay#>>'{receipt,entityId}' <> v_task_id
     OR NOT (v_replay#>>'{receipt,replayed}')::boolean THEN
    RAISE EXCEPTION 'replay contract failed: %', v_replay;
  END IF;
  SELECT count(*) INTO v_count FROM public.tasks
  WHERE user_id = auth.uid() AND external_source = 'notion' AND external_id = v_page_id;
  IF v_count <> 1 THEN RAISE EXCEPTION 'duplicate provenance created % rows', v_count; END IF;

  v_second_preview := public.activate_notion_task(
    p_operation_id => v_operation_id || '-second-block',
    p_notion_page_id => v_page_id,
    p_notion_data_source_id => 'fixture-data-source',
    p_notion_url => 'https://www.notion.so/' || v_page_id,
    p_notion_last_edited_at => '2026-07-13T20:00:00Z',
    p_title => 'Disposable Notion activation fixture',
    p_description => 'Never committed outside this transaction',
    p_priority => 'high',
    p_due_date => '2026-07-14',
    p_work_block => jsonb_build_object(
      'scheduledDate', '2026-07-14',
      'scheduledTime', '14:00',
      'duration', 40
    ),
    p_preview => true
  );
  IF NOT (v_second_preview->>'alreadyActivated')::boolean THEN
    RAISE EXCEPTION 'existing provenance was not surfaced: %', v_second_preview;
  END IF;
  v_second_apply := public.activate_notion_task(
    p_operation_id => v_operation_id || '-second-block',
    p_notion_page_id => v_page_id,
    p_notion_data_source_id => 'fixture-data-source',
    p_notion_url => 'https://www.notion.so/' || v_page_id,
    p_notion_last_edited_at => '2026-07-13T20:00:00Z',
    p_title => 'Disposable Notion activation fixture',
    p_description => 'Never committed outside this transaction',
    p_priority => 'high',
    p_due_date => '2026-07-14',
    p_work_block => jsonb_build_object(
      'scheduledDate', '2026-07-14',
      'scheduledTime', '14:00',
      'duration', 40
    ),
    p_preview => false,
    p_preview_digest => v_second_preview->>'previewDigest',
    p_preview_expires_at => (v_second_preview->>'previewExpiresAt')::timestamptz
  );
  IF jsonb_array_length(v_second_apply#>'{receipt,readBack,instances}') <> 2
     OR v_second_apply#>>'{receipt,readBack,instances,1,scheduledTime}' <> '14:00' THEN
    RAISE EXCEPTION 'approved block was dropped for existing task: %', v_second_apply;
  END IF;

  v_changed_preview := public.activate_notion_task(
    p_operation_id => v_operation_id,
    p_notion_page_id => v_page_id,
    p_notion_data_source_id => 'fixture-data-source',
    p_notion_url => 'https://www.notion.so/' || v_page_id,
    p_notion_last_edited_at => '2026-07-13T20:00:00Z',
    p_title => 'Changed payload',
    p_preview => true
  );
  v_conflict := public.activate_notion_task(
    p_operation_id => v_operation_id,
    p_notion_page_id => v_page_id,
    p_notion_data_source_id => 'fixture-data-source',
    p_notion_url => 'https://www.notion.so/' || v_page_id,
    p_notion_last_edited_at => '2026-07-13T20:00:00Z',
    p_title => 'Changed payload',
    p_preview => false,
    p_preview_digest => v_changed_preview->>'previewDigest',
    p_preview_expires_at => (v_changed_preview->>'previewExpiresAt')::timestamptz
  );
  IF v_conflict#>>'{error,code}' <> 'idempotency_conflict' THEN
    RAISE EXCEPTION 'operation collision was not rejected: %', v_conflict;
  END IF;

  RAISE NOTICE 'TASK-1939 disposable activation contract passed';
END;
$$;
