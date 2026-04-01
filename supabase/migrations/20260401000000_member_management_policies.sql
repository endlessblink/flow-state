-- TASK-1557: Member management policies
-- Adds UPDATE policy for role changes and RPC for ownership transfer

-- 1. UPDATE policy on workspace_members (owner/admin can change roles)
CREATE POLICY "members_update" ON public.workspace_members FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- 2. RPC for atomic ownership transfer
CREATE OR REPLACE FUNCTION public.transfer_workspace_ownership(
  p_workspace_id uuid,
  p_new_owner_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_owner_id uuid;
  v_is_member boolean;
BEGIN
  -- Get current owner and verify caller is the owner
  SELECT owner_id INTO v_current_owner_id
  FROM workspaces WHERE id = p_workspace_id;

  IF v_current_owner_id IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Workspace not found');
  END IF;

  IF v_current_owner_id != auth.uid() THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Only the owner can transfer ownership');
  END IF;

  IF v_current_owner_id = p_new_owner_id THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Already the owner');
  END IF;

  -- Verify new owner is a member
  SELECT EXISTS(
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'User is not a member of this workspace');
  END IF;

  -- Atomic transfer: update workspace owner_id
  UPDATE workspaces SET owner_id = p_new_owner_id, updated_at = now()
  WHERE id = p_workspace_id;

  -- Demote old owner to admin
  UPDATE workspace_members SET role = 'admin'
  WHERE workspace_id = p_workspace_id AND user_id = v_current_owner_id;

  -- Promote new owner
  UPDATE workspace_members SET role = 'owner'
  WHERE workspace_id = p_workspace_id AND user_id = p_new_owner_id;

  RETURN jsonb_build_object('status', 'success', 'workspace_id', p_workspace_id);
END;
$$;
