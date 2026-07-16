-- TASK-1967: expose only the stable causal identity needed by complete task
-- inventory consumers. The canonical change ledger remains authoritative;
-- task rows are not given a second, denormalized provenance field.

CREATE OR REPLACE FUNCTION public.flowstate_task_change_causes_v1(
  p_task_ids text[],
  p_at_sequence bigint,
  p_user_id uuid,
  p_workspace_id uuid DEFAULT NULL
)
RETURNS TABLE (
  task_id text,
  change_sequence bigint,
  canonical_revision bigint,
  operation_id text,
  source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_count integer := pg_catalog.array_length(p_task_ids, 1);
BEGIN
  IF v_count IS NULL
     OR v_count NOT BETWEEN 1 AND 100
     OR p_at_sequence IS NULL
     OR p_at_sequence < 0
     OR p_user_id IS NULL
     OR EXISTS (
       SELECT 1
       FROM pg_catalog.unnest(p_task_ids) AS requested(task_id)
       WHERE requested.task_id IS NULL
          OR requested.task_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     )
     OR (
       SELECT pg_catalog.count(DISTINCT requested.task_id)
       FROM pg_catalog.unnest(p_task_ids) AS requested(task_id)
     ) <> v_count THEN
    RAISE EXCEPTION 'Canonical task cause request is invalid'
      USING ERRCODE = '22023';
  END IF;

  IF (SELECT auth.role()) = 'service_role' THEN
    v_actor := p_user_id;
  ELSIF v_actor IS NULL OR v_actor IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Canonical task causes require the signed-in user'
      USING ERRCODE = '42501';
  END IF;

  IF p_workspace_id IS NOT NULL
     AND (SELECT auth.role()) <> 'service_role'
     AND NOT public.flowstate_can_read_workspace_v1(p_workspace_id) THEN
    RAISE EXCEPTION 'Workspace task causes are outside the signed-in scope'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (change.entity_id)
    change.entity_id,
    change.change_sequence,
    change.canonical_revision,
    change.operation_id,
    change.source
  FROM public.canonical_change_log AS change
  WHERE change.entity_type = 'task'
    AND change.entity_id = ANY(p_task_ids)
    AND change.change_sequence <= p_at_sequence
    AND (
      (p_workspace_id IS NULL
        AND change.user_id = v_actor
        AND change.workspace_id IS NULL)
      OR (p_workspace_id IS NOT NULL
        AND change.workspace_id = p_workspace_id)
    )
  ORDER BY change.entity_id, change.change_sequence DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_task_change_causes_v1(
  text[], bigint, uuid, uuid
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_task_change_causes_v1(
  text[], bigint, uuid, uuid
) TO authenticated, service_role;

COMMENT ON FUNCTION public.flowstate_task_change_causes_v1(
  text[], bigint, uuid, uuid
) IS 'Returns bounded task operation/source identity at one canonical inventory high-water; excludes payloads, actors, receipts, and request hashes.';

NOTIFY pgrst, 'reload schema';
