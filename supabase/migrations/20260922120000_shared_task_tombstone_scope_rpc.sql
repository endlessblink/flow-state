-- BUG-2069: confirm an already-deleted shared task without assuming the
-- current actor owns its tombstone. Task IDs are immutable and exact; this
-- RPC reveals tombstone presence only to its owner or current workspace readers.
CREATE OR REPLACE FUNCTION public.flowstate_has_task_tombstone(p_task_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_task_id IS NULL OR pg_catalog.btrim(p_task_id) = '' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.tombstones AS tombstone
    WHERE tombstone.entity_type = 'task'
      AND tombstone.entity_id = p_task_id
      AND (
        tombstone.user_id = (SELECT auth.uid())
        OR (
          tombstone.scope_kind = 'workspace'
          AND public.flowstate_can_read_workspace_v1(tombstone.workspace_id)
        )
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flowstate_has_task_tombstone(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_has_task_tombstone(text)
  TO authenticated;

COMMENT ON FUNCTION public.flowstate_has_task_tombstone(text) IS
  'Returns whether an exact immutable task id has a permanent tombstone only to its owner or a current workspace reader, allowing authorized shared-task delete retries to recognize the owner-scoped trigger tombstone.';

NOTIFY pgrst, 'reload schema';
