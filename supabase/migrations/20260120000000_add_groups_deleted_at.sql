-- TASK-317: Add deleted_at column to groups table for deletion tracking
-- Required for deletion-aware restore

-- Add deleted_at column (matches tasks and projects schema)
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Create composite index for efficient deleted item queries
CREATE INDEX IF NOT EXISTS idx_groups_deleted
ON public.groups(user_id, is_deleted)
WHERE is_deleted = true;

-- Comment for documentation
COMMENT ON COLUMN public.groups.deleted_at IS 'Timestamp when the group was soft-deleted. Used for deletion-aware backup restore.';
