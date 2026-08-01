-- Repair privilege drift for the RLS helper used by workspace write policies.
-- Keep the helper callable by signed-in clients only; viewers remain read-only.
REVOKE ALL ON FUNCTION public.flowstate_can_write_workspace_v1(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flowstate_can_write_workspace_v1(uuid)
  TO authenticated;
