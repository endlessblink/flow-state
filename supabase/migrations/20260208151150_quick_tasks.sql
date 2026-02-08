-- FEATURE-1248: Quick Tasks — Pinned & Frequent Task Shortcuts
-- Creates pinned_tasks table for user's manual quick task shortcuts

CREATE TABLE IF NOT EXISTS pinned_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    priority TEXT DEFAULT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user-scoped ordered queries
CREATE INDEX IF NOT EXISTS idx_pinned_tasks_user_sort ON pinned_tasks(user_id, sort_order);

-- RLS: Enable row-level security
ALTER TABLE pinned_tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own pinned tasks
CREATE POLICY "Users can view their own pinned tasks"
    ON pinned_tasks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own pinned tasks"
    ON pinned_tasks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pinned tasks"
    ON pinned_tasks FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pinned tasks"
    ON pinned_tasks FOR DELETE
    USING (auth.uid() = user_id);

-- Auto-update updated_at on changes (reuses existing trigger function)
CREATE TRIGGER update_pinned_tasks_updated_at
    BEFORE UPDATE ON pinned_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
