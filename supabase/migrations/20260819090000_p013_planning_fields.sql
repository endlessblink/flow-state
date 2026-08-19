-- P-013: upgrade already-installed canonical task functions.
-- This migration rewrites the existing function bodies so deployed databases
-- receive the same contract as fresh databases.

DO $$
DECLARE
  definition text;
  nl text := pg_catalog.chr(10);
  old_fragment text;
  project_is_uuid boolean;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.flowstate_patch_task_v1_h3_base(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'::pg_catalog.regprocedure
  ) INTO definition;

  SELECT pg_catalog.format_type(att.atttypid, att.atttypmod) = 'uuid'
    INTO project_is_uuid
  FROM pg_catalog.pg_attribute AS att
  WHERE att.attrelid = 'public.tasks'::pg_catalog.regclass
    AND att.attname = 'project_id'
    AND att.attnum > 0
    AND NOT att.attisdropped;

  definition := pg_catalog.regexp_replace(
    definition,
    $q$WHERE key NOT IN \([^;]*\);$q$,
    $q$WHERE key NOT IN ('title', 'description', 'priority', 'dueDate', 'dueTime', 'estimatedDuration', 'projectId', 'progress');$q$,
    'g'
  );

  old_fragment := $q$  WHERE key NOT IN ('title', 'description', 'priority', 'dueDate', 'progress');$q$;
  definition := pg_catalog.replace(
    definition,
    old_fragment,
    $q$  WHERE key NOT IN ('title', 'description', 'priority', 'dueDate', 'dueTime', 'estimatedDuration', 'projectId', 'progress');$q$
  );

  old_fragment := $q$  IF p_patch ? 'progress' THEN$q$;
  IF pg_catalog.strpos(definition, $q$  IF p_patch ? 'dueTime' THEN$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      $q$  IF p_patch ? 'dueTime' THEN$q$ || nl ||
      $q$    IF pg_catalog.jsonb_typeof(p_patch->'dueTime') NOT IN ('string', 'null')
       OR (pg_catalog.jsonb_typeof(p_patch->'dueTime') = 'string'
           AND p_patch->>'dueTime' !~ '^([01]\d|2[0-3]):[0-5]\d$') THEN$q$ || nl ||
      $q$      RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected', 'error', pg_catalog.jsonb_build_object('code', 'invalid_due_time', 'message', 'dueTime must be HH:MM or null'));$q$ || nl ||
      $q$    END IF;$q$ || nl ||
      $q$    v_normalized := v_normalized || pg_catalog.jsonb_build_object('dueTime', p_patch->'dueTime');$q$ || nl ||
      $q$  END IF;$q$ || nl || nl ||
      old_fragment
    );
  END IF;

  old_fragment := $q$  IF p_patch ? 'progress' THEN$q$;
  IF pg_catalog.strpos(definition, $q$  IF p_patch ? 'projectId' THEN$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      $q$  IF p_patch ? 'projectId' THEN$q$ || nl ||
      $q$    IF pg_catalog.jsonb_typeof(p_patch->'projectId') NOT IN ('string', 'null')
       OR (pg_catalog.jsonb_typeof(p_patch->'projectId') = 'string'
           AND nullif(pg_catalog.btrim(p_patch->>'projectId'), '') IS NULL) THEN$q$ || nl ||
      $q$      RETURN pg_catalog.jsonb_build_object('ok', false, 'result', 'rejected', 'error', pg_catalog.jsonb_build_object('code', 'invalid_project_id', 'message', 'projectId must be a non-empty string or null'));$q$ || nl ||
      $q$    END IF;$q$ || nl ||
      $q$    v_normalized := v_normalized || pg_catalog.jsonb_build_object('projectId', p_patch->'projectId');$q$ || nl ||
      $q$  END IF;$q$ || nl || nl ||
      old_fragment
    );
  END IF;

  old_fragment := $q$    'dueDate', v_task.due_date,$q$;
  IF pg_catalog.strpos(definition, $q$    'dueTime', v_task.due_time,$q$) = 0
     OR pg_catalog.strpos(definition, $q$    'projectId', v_task.project_id,$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      old_fragment || nl ||
      $q$    'dueTime', v_task.due_time,$q$ || nl ||
      $q$    'estimatedDuration', v_task.estimated_duration,$q$ || nl ||
      $q$    'projectId', v_task.project_id,$q$
    );
  END IF;

  old_fragment := $q$    progress = CASE$q$ || nl ||
    $q$      WHEN v_normalized ? 'progress' THEN (v_normalized->>'progress')::integer$q$ || nl ||
    $q$      ELSE task.progress$q$ || nl || $q$    END$q$;
  IF pg_catalog.strpos(definition, $q$    due_time = CASE$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      old_fragment || $q$,$q$ || nl ||
      $q$    due_time = CASE$q$ || nl ||
      $q$      WHEN v_normalized ? 'dueTime' AND pg_catalog.jsonb_typeof(v_normalized->'dueTime') = 'null' THEN NULL$q$ || nl ||
      $q$      WHEN v_normalized ? 'dueTime' THEN v_normalized->>'dueTime'$q$ || nl ||
      $q$      ELSE task.due_time$q$ || nl || $q$    END,$q$ || nl ||
      $q$    estimated_duration = CASE$q$ || nl ||
      $q$      WHEN v_normalized ? 'estimatedDuration' AND pg_catalog.jsonb_typeof(v_normalized->'estimatedDuration') = 'null' THEN NULL$q$ || nl ||
      $q$      WHEN v_normalized ? 'estimatedDuration' THEN (v_normalized->>'estimatedDuration')::integer$q$ || nl ||
      $q$      ELSE task.estimated_duration$q$ || nl || $q$    END,$q$ || nl ||
      $q$    project_id = CASE$q$ || nl ||
      $q$      WHEN v_normalized ? 'projectId' AND pg_catalog.jsonb_typeof(v_normalized->'projectId') = 'null' THEN NULL$q$ || nl ||
      $q$      WHEN v_normalized ? 'projectId' THEN v_normalized->>'projectId'$q$ || nl ||
      $q$      ELSE task.project_id$q$ || nl || $q$    END$q$
    );
  END IF;

  old_fragment := $q$    'dueDate', v_updated.due_date,$q$;
  IF pg_catalog.strpos(definition, $q$    'dueTime', v_updated.due_time,$q$) = 0
     OR pg_catalog.strpos(definition, $q$    'projectId', v_updated.project_id,$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      old_fragment || nl ||
      $q$    'dueTime', v_updated.due_time,$q$ || nl ||
      $q$    'estimatedDuration', v_updated.estimated_duration,$q$ || nl ||
      $q$    'projectId', v_updated.project_id,$q$
    );
  END IF;

  IF coalesce(project_is_uuid, false) THEN
    definition := pg_catalog.replace(
      definition,
      $q$WHEN v_normalized ? 'projectId' THEN v_normalized->>'projectId'$q$,
      $q$WHEN v_normalized ? 'projectId' THEN (v_normalized->>'projectId')::uuid$q$
    );
  END IF;

  EXECUTE definition;
END $$;

DO $$
DECLARE
  definition text;
  nl text := pg_catalog.chr(10);
  old_fragment text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.flowstate_task_lifecycle_v1(text,text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'::pg_catalog.regprocedure
  ) INTO definition;

  old_fragment := $q$           'title', 'status', 'description', 'priority', 'dueDate', 'projectId'$q$;
  definition := pg_catalog.replace(
    definition,
    old_fragment,
    $q$           'title', 'status', 'description', 'priority', 'dueDate', 'dueTime', 'estimatedDuration', 'projectId'$q$
  );

  old_fragment := $q$       OR (
         p_payload ? 'status'$q$;
  IF pg_catalog.strpos(definition, $q$       OR (
         p_payload ? 'dueTime'$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      $q$       OR (
         p_payload ? 'dueTime'
         AND (
           pg_catalog.jsonb_typeof(p_payload->'dueTime') NOT IN ('string', 'null')
           OR (pg_catalog.jsonb_typeof(p_payload->'dueTime') = 'string'
               AND p_payload->>'dueTime' !~ '^([01]\d|2[0-3]):[0-5]\d$')
         )
       )
       OR (
         p_payload ? 'estimatedDuration'
         AND (
           pg_catalog.jsonb_typeof(p_payload->'estimatedDuration') NOT IN ('number', 'null')
           OR (pg_catalog.jsonb_typeof(p_payload->'estimatedDuration') = 'number'
               AND ((p_payload->>'estimatedDuration')::numeric <> pg_catalog.trunc((p_payload->>'estimatedDuration')::numeric)
                    OR (p_payload->>'estimatedDuration')::numeric < 0))
         )
       )
       OR (
         p_payload ? 'status'$q$
    );
  END IF;

  old_fragment := $q$      'dueDate', CASE WHEN v_due_date IS NULL THEN NULL ELSE pg_catalog.to_char(v_due_date, 'YYYY-MM-DD') END,
      'projectId'$q$;
  IF pg_catalog.strpos(definition, $q$      'dueTime', p_payload->'dueTime'$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      $q$      'dueDate', CASE WHEN v_due_date IS NULL THEN NULL ELSE pg_catalog.to_char(v_due_date, 'YYYY-MM-DD') END,
      'dueTime', p_payload->'dueTime',
      'estimatedDuration', p_payload->'estimatedDuration',
      'projectId'$q$
    );
  END IF;

  old_fragment := $q$      id, user_id, project_id, title, description, status, priority, due_date,$q$;
  IF pg_catalog.strpos(definition, $q$      due_time,$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      old_fragment || nl || $q$      due_time, estimated_duration,$q$
    );
  END IF;

  old_fragment := $q$      CASE WHEN v_due_date IS NULL THEN NULL ELSE (v_due_date::text || 'T00:00:00Z')::timestamptz END,$q$;
  IF pg_catalog.strpos(definition, $q$      v_normalized #>> '{payload,dueTime}',$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      old_fragment || nl ||
      $q$      v_normalized #>> '{payload,dueTime}',$q$ || nl ||
      $q$      (v_normalized #>> '{payload,estimatedDuration}')::integer,$q$
    );
  END IF;

  old_fragment := $q$    'projectId', v_updated.project_id,$q$;
  IF pg_catalog.strpos(definition, $q$    'estimatedDuration', v_updated.estimated_duration,$q$) = 0 THEN
    definition := pg_catalog.replace(
      definition,
      old_fragment,
      $q$    'dueTime', v_updated.due_time,$q$ || nl ||
      $q$    'estimatedDuration', v_updated.estimated_duration,$q$ || nl ||
      old_fragment
    );
  END IF;

  EXECUTE definition;
END $$;
