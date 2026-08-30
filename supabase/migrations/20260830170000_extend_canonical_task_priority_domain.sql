-- BUG-2063: The Board and task schema support five priority values, but the
-- canonical task patch RPC still rejected Immediate and Relaxed. Patch the
-- already-deployed function in place so all later contract changes remain
-- intact. Fail closed if the expected validator is not present exactly once.
DO $migration$
DECLARE
  v_definition text;
  v_old text := 'p_patch->>''priority'' IN (''low'', ''medium'', ''high'')';
  v_new text := 'p_patch->>''priority'' IN (''low'', ''medium'', ''high'', ''immediate'', ''relaxed'')';
  v_occurrences integer;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.flowstate_patch_task_v1_h3_base(text,text,text,text,bigint,jsonb,boolean,text,timestamptz,uuid)'::pg_catalog.regprocedure
  ) INTO v_definition;

  IF pg_catalog.strpos(v_definition, v_new) > 0 THEN
    RETURN;
  END IF;

  v_occurrences := (
    pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_old, ''))
  ) / pg_catalog.length(v_old);

  IF v_occurrences IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'unexpected flowstate_patch_task_v1 priority validator';
  END IF;

  EXECUTE pg_catalog.replace(v_definition, v_old, v_new);
END
$migration$;
