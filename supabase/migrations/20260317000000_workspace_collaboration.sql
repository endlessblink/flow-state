-- =============================================================================
-- MIGRATION: Workspace Collaboration
-- Date: 2026-03-17
-- Description: Adds workspace collaboration tables, alters existing tables,
--              introduces SECURITY DEFINER helpers, and rewrites RLS policies
--              to support both personal (workspace_id IS NULL) and shared
--              workspace access.
-- =============================================================================

-- ============================================================
-- SECTION 1a: New Tables
-- ============================================================

-- workspaces: top-level collaboration container
CREATE TABLE IF NOT EXISTS public.workspaces (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  owner_id   uuid        NOT NULL REFERENCES auth.users(id),
  icon       text,
  color      text        DEFAULT '#4ECDC4',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- workspace_members: join table linking users to workspaces with a role
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  role         text        NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at    timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user      ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- workspace_invites: token-based email invitations
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  invited_by     uuid        NOT NULL REFERENCES auth.users(id),
  invited_email  text        NOT NULL,
  token          text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role           text        NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status         text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at     timestamptz DEFAULT now() + interval '7 days',
  accepted_at    timestamptz,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON public.workspace_invites(token)         WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON public.workspace_invites(invited_email) WHERE status = 'pending';

-- task_comments: per-task threaded comments (Phase 3 — table created now)
CREATE TABLE IF NOT EXISTS public.task_comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      text        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  content      text        NOT NULL,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- workspace_activity: audit log for workspace events (Phase 3 — table created now)
CREATE TABLE IF NOT EXISTS public.workspace_activity (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  action       text        NOT NULL,
  entity_type  text        NOT NULL,
  entity_id    uuid,
  metadata     jsonb       DEFAULT '{}',
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_workspace ON public.workspace_activity(workspace_id, created_at DESC);

-- ============================================================
-- SECTION 1b: ALTER Existing Tables
-- ============================================================

-- tasks: add workspace_id (nullable — NULL means personal task) and assigned_to
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to  uuid REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id) WHERE workspace_id IS NOT NULL;

-- projects: add workspace_id
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_workspace ON public.projects(workspace_id) WHERE workspace_id IS NOT NULL;

-- groups (canvas groups): add workspace_id
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_groups_workspace ON public.groups(workspace_id) WHERE workspace_id IS NOT NULL;

-- ============================================================
-- SECTION 1c: SECURITY DEFINER helper — user_workspace_ids()
-- Returns the list of workspace IDs the calling user belongs to.
-- SECURITY DEFINER so RLS policies can call it without recursion.
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_workspace_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(workspace_id), ARRAY[]::uuid[])
  FROM workspace_members
  WHERE user_id = auth.uid()
$$;

-- ============================================================
-- SECTION 1d: SECURITY DEFINER function — accept_workspace_invite(p_token)
-- Atomically accepts a pending invite, inserts the member row,
-- and marks the invite as accepted. Returns a jsonb result object.
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_workspace_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite workspace_invites%ROWTYPE;
BEGIN
  -- Lock the invite row to prevent concurrent acceptance races
  SELECT * INTO v_invite
  FROM workspace_invites
  WHERE token = p_token
    AND status  = 'pending'
    AND expires_at > now()
  FOR UPDATE;

  IF v_invite IS NULL THEN
    RETURN jsonb_build_object('status', 'error', 'message', 'Invalid or expired invite');
  END IF;

  -- Insert member record; silently ignore if the user is already a member
  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_invite.workspace_id, auth.uid(), v_invite.role)
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Mark invite as accepted
  UPDATE workspace_invites
  SET status      = 'accepted',
      accepted_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'status',       'success',
    'workspace_id', v_invite.workspace_id,
    'role',         v_invite.role
  );
END;
$$;

-- ============================================================
-- SECTION 1e: Enable RLS on ALL new tables
-- ============================================================

ALTER TABLE public.workspaces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invites  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_activity ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECTION 1f: RLS Policy Rewrite — existing tables
-- Drop old single-user policies, replace with workspace-aware ones.
-- Pattern: personal rows (workspace_id IS NULL, auth.uid() = user_id)
--          OR shared rows (workspace_id IN user's workspaces)
-- ============================================================

-- ---- tasks ----
DROP POLICY IF EXISTS "Users can view their own tasks"   ON public.tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
-- Also drop alternate name variants
DROP POLICY IF EXISTS "Users can view own tasks"   ON public.tasks;
DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);

-- ---- projects ----
DROP POLICY IF EXISTS "Users can view their own projects"   ON public.projects;
DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view own projects"   ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);

-- ---- groups (canvas groups) ----
DROP POLICY IF EXISTS "Users can view their own groups"   ON public.groups;
DROP POLICY IF EXISTS "Users can insert their own groups" ON public.groups;
DROP POLICY IF EXISTS "Users can update their own groups" ON public.groups;
DROP POLICY IF EXISTS "Users can delete their own groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view own groups"   ON public.groups;
DROP POLICY IF EXISTS "Users can insert own groups" ON public.groups;
DROP POLICY IF EXISTS "Users can update own groups" ON public.groups;
DROP POLICY IF EXISTS "Users can delete own groups" ON public.groups;
DROP POLICY IF EXISTS "groups_select" ON public.groups;
DROP POLICY IF EXISTS "groups_insert" ON public.groups;
DROP POLICY IF EXISTS "groups_update" ON public.groups;
DROP POLICY IF EXISTS "groups_delete" ON public.groups;

CREATE POLICY "groups_select" ON public.groups FOR SELECT USING (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);
CREATE POLICY "groups_insert" ON public.groups FOR INSERT WITH CHECK (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);
CREATE POLICY "groups_update" ON public.groups FOR UPDATE USING (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);
CREATE POLICY "groups_delete" ON public.groups FOR DELETE USING (
  (workspace_id IS NULL AND auth.uid() = user_id)
  OR (workspace_id = ANY(user_workspace_ids()))
);

-- ---- notifications ----
DROP POLICY IF EXISTS "Users can view their own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (
  auth.uid() = user_id
);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (
  auth.uid() = user_id
);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (
  auth.uid() = user_id
);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (
  auth.uid() = user_id
);

-- ============================================================
-- SECTION 1g: RLS Policies for NEW tables
-- ============================================================

-- ---- workspaces ----
-- SELECT: any member of the workspace, OR the workspace owner (for bootstrap before membership row exists)
DROP POLICY IF EXISTS "workspaces_select" ON public.workspaces;
CREATE POLICY "workspaces_select" ON public.workspaces FOR SELECT USING (
  id = ANY(user_workspace_ids())
);
DROP POLICY IF EXISTS "workspaces_select_owner" ON public.workspaces;
CREATE POLICY "workspaces_select_owner" ON public.workspaces FOR SELECT USING (
  auth.uid() = owner_id
);
-- INSERT: authenticated user creating their own workspace
DROP POLICY IF EXISTS "workspaces_insert" ON public.workspaces;
CREATE POLICY "workspaces_insert" ON public.workspaces FOR INSERT WITH CHECK (
  auth.uid() = owner_id
);
-- UPDATE: any member (owner/admin can manage settings via application logic)
DROP POLICY IF EXISTS "workspaces_update" ON public.workspaces;
CREATE POLICY "workspaces_update" ON public.workspaces FOR UPDATE USING (
  id = ANY(user_workspace_ids())
);
-- DELETE: owner only
DROP POLICY IF EXISTS "workspaces_delete" ON public.workspaces;
CREATE POLICY "workspaces_delete" ON public.workspaces FOR DELETE USING (
  auth.uid() = owner_id
);

-- ---- workspace_members ----
-- SELECT: any member of the same workspace can see membership list
DROP POLICY IF EXISTS "members_select" ON public.workspace_members;
CREATE POLICY "members_select" ON public.workspace_members FOR SELECT USING (
  workspace_id = ANY(user_workspace_ids())
);
-- INSERT: owner/admin of the workspace, OR the user inserting themselves,
--         OR the workspace owner bootstrapping their first membership row
DROP POLICY IF EXISTS "members_insert" ON public.workspace_members;
CREATE POLICY "members_insert" ON public.workspace_members FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR auth.uid() = user_id
  OR workspace_id IN (
    SELECT id FROM workspaces WHERE owner_id = auth.uid()
  )
);
-- SELECT: user can always see their own memberships (needed for INSERT+RETURNING)
DROP POLICY IF EXISTS "members_select_self" ON public.workspace_members;
CREATE POLICY "members_select_self" ON public.workspace_members FOR SELECT USING (
  auth.uid() = user_id
);
-- DELETE: owner/admin removes others, OR member removes themselves (leave workspace)
DROP POLICY IF EXISTS "members_delete" ON public.workspace_members;
CREATE POLICY "members_delete" ON public.workspace_members FOR DELETE USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
  OR auth.uid() = user_id
);

-- ---- workspace_invites ----
-- SELECT: workspace members can see invites for their workspace;
--         invited user can see their own invite by email
DROP POLICY IF EXISTS "invites_select" ON public.workspace_invites;
CREATE POLICY "invites_select" ON public.workspace_invites FOR SELECT USING (
  workspace_id = ANY(user_workspace_ids())
  OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
-- INSERT: owner/admin only
DROP POLICY IF EXISTS "invites_insert" ON public.workspace_invites;
CREATE POLICY "invites_insert" ON public.workspace_invites FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);
-- UPDATE: owner/admin only (e.g. revoke invite)
DROP POLICY IF EXISTS "invites_update" ON public.workspace_invites;
CREATE POLICY "invites_update" ON public.workspace_invites FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);

-- ---- task_comments ----
-- SELECT: any member of the comment's workspace
DROP POLICY IF EXISTS "task_comments_select" ON public.task_comments;
CREATE POLICY "task_comments_select" ON public.task_comments FOR SELECT USING (
  workspace_id = ANY(user_workspace_ids())
);
-- INSERT: any member of the workspace
DROP POLICY IF EXISTS "task_comments_insert" ON public.task_comments;
CREATE POLICY "task_comments_insert" ON public.task_comments FOR INSERT WITH CHECK (
  workspace_id = ANY(user_workspace_ids())
  AND auth.uid() = user_id
);
-- UPDATE: own comments only
DROP POLICY IF EXISTS "task_comments_update" ON public.task_comments;
CREATE POLICY "task_comments_update" ON public.task_comments FOR UPDATE USING (
  auth.uid() = user_id
);
-- DELETE: own comments only
DROP POLICY IF EXISTS "task_comments_delete" ON public.task_comments;
CREATE POLICY "task_comments_delete" ON public.task_comments FOR DELETE USING (
  auth.uid() = user_id
);

-- ---- workspace_activity ----
-- SELECT: any member of the workspace can read its activity feed
DROP POLICY IF EXISTS "workspace_activity_select" ON public.workspace_activity;
CREATE POLICY "workspace_activity_select" ON public.workspace_activity FOR SELECT USING (
  workspace_id = ANY(user_workspace_ids())
);
-- INSERT: any member of the workspace can write activity entries
DROP POLICY IF EXISTS "workspace_activity_insert" ON public.workspace_activity;
CREATE POLICY "workspace_activity_insert" ON public.workspace_activity FOR INSERT WITH CHECK (
  workspace_id = ANY(user_workspace_ids())
  AND auth.uid() = user_id
);
-- No UPDATE/DELETE on activity log (append-only audit trail)

-- ============================================================
-- SECTION 1h: Add new tables to Realtime publication
-- ============================================================

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_activity;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- SECTION 1i: updated_at triggers for new tables
-- Assumes update_updated_at_column() already exists from a prior migration.
-- ============================================================

DROP TRIGGER IF EXISTS set_updated_at ON public.workspaces;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at ON public.task_comments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
