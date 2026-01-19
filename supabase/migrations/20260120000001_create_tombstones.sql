-- TASK-317: Create tombstones table for permanent deletion tracking
-- Prevents "zombie data resurrection" during sync/restore operations
-- Based on industry patterns from AD (180-day), Cassandra (10-day gc_grace)

CREATE TABLE IF NOT EXISTS public.tombstones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type varchar(50) NOT NULL CHECK (entity_type IN ('task', 'group', 'project')),
    entity_id text NOT NULL,
    deleted_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '90 days'),
    UNIQUE(entity_type, entity_id, user_id)
);

-- Enable RLS
ALTER TABLE public.tombstones ENABLE ROW LEVEL SECURITY;

-- User isolation policy
CREATE POLICY "Users can view their own tombstones"
    ON public.tombstones FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tombstones"
    ON public.tombstones FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tombstones"
    ON public.tombstones FOR DELETE
    USING (auth.uid() = user_id);

-- Index for sync/restore lookups
CREATE INDEX IF NOT EXISTS idx_tombstones_entity
ON public.tombstones(entity_type, entity_id);

-- Index for cleanup job
CREATE INDEX IF NOT EXISTS idx_tombstones_expires
ON public.tombstones(expires_at);

-- Index for user-scoped queries
CREATE INDEX IF NOT EXISTS idx_tombstones_user
ON public.tombstones(user_id);

-- Cleanup function (can be called by cron job or manually)
CREATE OR REPLACE FUNCTION cleanup_expired_tombstones()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.tombstones WHERE expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment for documentation
COMMENT ON TABLE public.tombstones IS 'Tracks permanently deleted entities to prevent resurrection during backup restore. Entries expire after 90 days.';
