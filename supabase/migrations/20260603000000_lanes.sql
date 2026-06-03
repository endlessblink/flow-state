-- TASK-1812: Lanes — sprint-style cross-project goals for tasks.
-- A Lane is a first-class entity (like a project) that deliberately spans projects.
-- A task belongs to at most one lane via tasks.lane_id (nullable FK).
-- v1 is a named bucket: { id, name, color }. Dates/progress/lifecycle deferred.
--
-- Mirrors the projects table: user-scoped RLS, soft-delete columns, updated_at
-- trigger, and membership in the supabase_realtime publication.

-- =============================================================================
-- Step 1: lanes table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.lanes (
    id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name         text NOT NULL,
    color        text DEFAULT '#4ECDC4',
    -- Workspace collaboration (mirrors projects.workspace_id)
    workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
    -- Soft-delete (mirrors projects)
    is_deleted   boolean DEFAULT false,
    deleted_at   timestamptz,
    created_at   timestamptz DEFAULT now(),
    updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lanes_user ON public.lanes(user_id);
CREATE INDEX IF NOT EXISTS idx_lanes_workspace ON public.lanes(workspace_id) WHERE workspace_id IS NOT NULL;

-- =============================================================================
-- Step 2: Row Level Security — user-scoped (auth.uid() = user_id)
-- =============================================================================

ALTER TABLE public.lanes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lanes"
    ON public.lanes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lanes"
    ON public.lanes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lanes"
    ON public.lanes FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lanes"
    ON public.lanes FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================================================
-- Step 3: updated_at trigger
-- =============================================================================

CREATE TRIGGER update_lanes_updated_at
    BEFORE UPDATE ON public.lanes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Step 4: tasks.lane_id FK — nullable, unassign tasks when a lane is hard-deleted
-- =============================================================================

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS lane_id uuid REFERENCES public.lanes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_lane ON public.tasks(lane_id) WHERE lane_id IS NOT NULL;

-- =============================================================================
-- Step 5: Realtime publication
-- =============================================================================

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lanes;
EXCEPTION
    WHEN duplicate_object THEN NULL;  -- already in publication
END $$;

COMMENT ON TABLE public.lanes IS 'TASK-1812: Sprint-style cross-project goals. Tasks reference a lane via tasks.lane_id (at most one). Lane is pure metadata — never carries canvas geometry.';
