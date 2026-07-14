-- TASK-1951: repair canonical assistant functions on UUID production schemas.
-- The original migrations remain portable for fresh installs; this forward
-- migration updates databases that already installed their earlier bodies.

DO $migration$
DECLARE
  v_definition text;
  v_old text[];
  v_new text[];
  v_index integer;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.flowstate_task_canonical_change()'::pg_catalog.regprocedure
  ) INTO STRICT v_definition;
  v_old := ARRAY[
    $old$AND operation.entity_id = v_row.id
$old$
  ];
  v_new := ARRAY[
    $new$AND operation.entity_id = v_row.id::text
$new$
  ];
  FOR v_index IN 1..pg_catalog.array_length(v_old, 1) LOOP
    IF pg_catalog.strpos(v_definition, v_new[v_index]) > 0 THEN
      NULL;
    ELSIF pg_catalog.strpos(v_definition, v_old[v_index]) > 0 THEN
      v_definition := pg_catalog.replace(v_definition, v_old[v_index], v_new[v_index]);
    ELSE
      RAISE EXCEPTION 'Unexpected canonical change function body at patch %', v_index;
    END IF;
  END LOOP;
  EXECUTE v_definition;

  SELECT pg_catalog.pg_get_functiondef(
    'public.flowstate_patch_task_v1(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'::pg_catalog.regprocedure
  ) INTO STRICT v_definition;
  v_old := ARRAY[
    $old$WHERE task.id = p_task_id
$old$,
    $old$AND change.entity_id = v_updated.id
$old$
  ];
  v_new := ARRAY[
    $new$WHERE task.id::text = p_task_id
$new$,
    $new$AND change.entity_id = v_updated.id::text
$new$
  ];
  FOR v_index IN 1..pg_catalog.array_length(v_old, 1) LOOP
    IF pg_catalog.strpos(v_definition, v_new[v_index]) > 0 THEN
      NULL;
    ELSIF pg_catalog.strpos(v_definition, v_old[v_index]) > 0 THEN
      v_definition := pg_catalog.replace(v_definition, v_old[v_index], v_new[v_index]);
    ELSE
      RAISE EXCEPTION 'Unexpected canonical patch function body at patch %', v_index;
    END IF;
  END LOOP;
  EXECUTE v_definition;

  SELECT pg_catalog.pg_get_functiondef(
    'public.guard_task_external_provenance_v1()'::pg_catalog.regprocedure
  ) INTO STRICT v_definition;
  v_old := ARRAY[
    $old$AND operation.entity_id = NEW.id
$old$
  ];
  v_new := ARRAY[
    $new$AND operation.entity_id = NEW.id::text
$new$
  ];
  FOR v_index IN 1..pg_catalog.array_length(v_old, 1) LOOP
    IF pg_catalog.strpos(v_definition, v_new[v_index]) > 0 THEN
      NULL;
    ELSIF pg_catalog.strpos(v_definition, v_old[v_index]) > 0 THEN
      v_definition := pg_catalog.replace(v_definition, v_old[v_index], v_new[v_index]);
    ELSE
      RAISE EXCEPTION 'Unexpected provenance guard body at patch %', v_index;
    END IF;
  END LOOP;
  EXECUTE v_definition;

  SELECT pg_catalog.pg_get_functiondef(
    'public.flowstate_activate_notion_task_v1(text,jsonb,jsonb,jsonb,boolean,text,timestamptz)'::pg_catalog.regprocedure
  ) INTO STRICT v_definition;
  v_old := ARRAY[
    $old$  v_project_id text;
$old$,
    $old$  v_task_id text;
$old$,
    $old$  IF v_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects AS project
    WHERE project.id = v_project_id
      AND project.user_id = v_actor
      AND project.is_deleted = false
  ) THEN
    RETURN pg_catalog.jsonb_build_object(
      'ok', false, 'result', 'rejected',
      'error', pg_catalog.jsonb_build_object(
        'code', 'project_not_found', 'message', 'Project was not found'
      )
    );
  END IF;
$old$,
    $old$  v_task_id := CASE
    WHEN v_already_activated THEN v_task.id
    ELSE 'task-' || extensions.gen_random_uuid()::text
  END;
$old$,
    $old$    v_task_id, v_request_hash, 'applying'
$old$,
    $old$        project_id = v_project_id,
$old$,
    $old$      v_task_id, v_actor, v_project_id, v_title, v_description,
$old$,
    $old$AND change.entity_id = v_updated.id
$old$
  ];
  v_new := ARRAY[
    $new$  v_project_id text;
  v_project_ref public.projects.id%TYPE;
$new$,
    $new$  v_task_id public.tasks.id%TYPE;
$new$,
    $new$  IF v_project_id IS NOT NULL THEN
    SELECT project.id INTO v_project_ref
    FROM public.projects AS project
    WHERE project.id::text = v_project_id
      AND project.user_id = v_actor
      AND project.is_deleted = false;
    IF NOT FOUND THEN
      RETURN pg_catalog.jsonb_build_object(
        'ok', false, 'result', 'rejected',
        'error', pg_catalog.jsonb_build_object(
          'code', 'project_not_found', 'message', 'Project was not found'
        )
      );
    END IF;
  END IF;
$new$,
    $new$  IF v_already_activated THEN
    v_task_id := v_task.id;
  ELSE
    v_task_id := extensions.gen_random_uuid();
  END IF;
$new$,
    $new$    v_task_id::text, v_request_hash, 'applying'
$new$,
    $new$        project_id = v_project_ref,
$new$,
    $new$      v_task_id, v_actor, v_project_ref, v_title, v_description,
$new$,
    $new$AND change.entity_id = v_updated.id::text
$new$
  ];
  FOR v_index IN 1..pg_catalog.array_length(v_old, 1) LOOP
    IF pg_catalog.strpos(v_definition, v_new[v_index]) > 0 THEN
      NULL;
    ELSIF pg_catalog.strpos(v_definition, v_old[v_index]) > 0 THEN
      v_definition := pg_catalog.replace(v_definition, v_old[v_index], v_new[v_index]);
    ELSE
      RAISE EXCEPTION 'Unexpected Notion activation function body at patch %', v_index;
    END IF;
  END LOOP;
  EXECUTE v_definition;
END
$migration$;
