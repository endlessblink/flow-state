-- TASK-344: Immutable Task ID System - Prevent System-Generated Duplicates
-- Once a task ID is used, it's permanently reserved (active, soft-deleted, or tombstoned)
--
-- This migration:
-- 1. Makes task tombstones permanent (no expiry)
-- 2. Adds auto-trigger to create tombstone on hard delete
-- 3. Creates audit table for dedup decisions
-- 4. Adds safe_create_task RPC function with transaction safety

-- =============================================================================
-- Step 1: Make task tombstones permanent
-- =============================================================================

-- Allow NULL expires_at for permanent tombstones
ALTER TABLE public.tombstones ALTER COLUMN expires_at DROP NOT NULL;

-- Update existing task tombstones to be permanent
UPDATE public.tombstones
SET expires_at = NULL
WHERE entity_type = 'task';

-- Update the cleanup function to skip permanent tombstones (NULL expires_at)
CREATE OR REPLACE FUNCTION cleanup_expired_tombstones()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    -- Only delete tombstones with a non-null expires_at that has passed
    DELETE FROM public.tombstones
    WHERE expires_at IS NOT NULL AND expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update comment
COMMENT ON TABLE public.tombstones IS 'Tracks permanently deleted entities. Task tombstones are permanent (expires_at=NULL). Group/project tombstones expire after 90 days.';

-- =============================================================================
-- Step 2: Auto-create permanent tombstone on task hard delete
-- =============================================================================

CREATE OR REPLACE FUNCTION create_task_tombstone()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert tombstone with NULL expires_at (permanent for tasks)
    INSERT INTO public.tombstones (user_id, entity_type, entity_id, deleted_at, expires_at)
    VALUES (OLD.user_id, 'task', OLD.id, NOW(), NULL)
    ON CONFLICT (entity_type, entity_id, user_id)
    DO UPDATE SET deleted_at = NOW(), expires_at = NULL;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trg_task_tombstone ON public.tasks;

-- Create trigger on tasks table
CREATE TRIGGER trg_task_tombstone
    BEFORE DELETE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION create_task_tombstone();

-- =============================================================================
-- Step 3: Create audit table for dedup decisions (optional - for debugging)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.task_dedup_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    operation varchar(50) NOT NULL, -- 'restore', 'sync', 'create', 'safe_create'
    task_id text NOT NULL,
    decision varchar(50) NOT NULL, -- 'created', 'skipped_exists', 'skipped_tombstoned', 'failed'
    reason text,
    backup_source varchar(255), -- Which backup file, if applicable
    created_at timestamptz DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.task_dedup_audit ENABLE ROW LEVEL SECURITY;

-- Users can only see their own audit logs
CREATE POLICY "Users see own audit logs"
    ON public.task_dedup_audit FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own audit logs
CREATE POLICY "Users insert own audit logs"
    ON public.task_dedup_audit FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_task_dedup_audit_user
ON public.task_dedup_audit(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_task_dedup_audit_task
ON public.task_dedup_audit(task_id);

COMMENT ON TABLE public.task_dedup_audit IS 'Audit log of task ID deduplication decisions for debugging and transparency.';

-- =============================================================================
-- Step 4: Safe create task RPC function with full transaction safety
-- =============================================================================

CREATE OR REPLACE FUNCTION safe_create_task(
    p_task_id uuid,
    p_user_id uuid,
    p_title text,
    p_description text DEFAULT '',
    p_status text DEFAULT 'planned',
    p_priority text DEFAULT 'medium',
    p_due_date text DEFAULT NULL,
    p_project_id text DEFAULT 'uncategorized',
    p_position jsonb DEFAULT NULL,
    p_tags text[] DEFAULT '{}',
    p_is_in_inbox boolean DEFAULT true,
    p_parent_task_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_existing_task record;
    v_tombstone record;
    v_result jsonb;
BEGIN
    -- Verify user is authenticated
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'task_id', p_task_id,
            'message', 'Unauthorized - user mismatch or not authenticated'
        );
    END IF;

    -- 1. Check if task already exists (active or soft-deleted)
    SELECT id, is_deleted, title INTO v_existing_task
    FROM public.tasks
    WHERE id = p_task_id AND user_id = p_user_id
    FOR UPDATE SKIP LOCKED;

    IF v_existing_task.id IS NOT NULL THEN
        -- Log audit
        INSERT INTO public.task_dedup_audit (user_id, operation, task_id, decision, reason)
        VALUES (p_user_id, 'safe_create', p_task_id::text, 'skipped_exists',
                'Task ID already exists (is_deleted=' || v_existing_task.is_deleted || ')');

        RETURN jsonb_build_object(
            'status', 'exists',
            'task_id', v_existing_task.id,
            'is_deleted', v_existing_task.is_deleted,
            'title', v_existing_task.title,
            'message', 'Task with this ID already exists'
        );
    END IF;

    -- 2. Check tombstones
    SELECT entity_id, deleted_at INTO v_tombstone
    FROM public.tombstones
    WHERE entity_type = 'task'
      AND entity_id = p_task_id::text
      AND user_id = p_user_id;

    IF v_tombstone.entity_id IS NOT NULL THEN
        -- Log audit
        INSERT INTO public.task_dedup_audit (user_id, operation, task_id, decision, reason)
        VALUES (p_user_id, 'safe_create', p_task_id::text, 'skipped_tombstoned',
                'Task ID was permanently deleted on ' || v_tombstone.deleted_at);

        RETURN jsonb_build_object(
            'status', 'tombstoned',
            'task_id', p_task_id,
            'deleted_at', v_tombstone.deleted_at,
            'message', 'Task ID was permanently deleted and cannot be reused'
        );
    END IF;

    -- 3. Safe to insert
    BEGIN
        INSERT INTO public.tasks (
            id, user_id, title, description, status, priority,
            due_date, project_id, position, tags, is_in_inbox,
            parent_task_id, created_at, updated_at
        )
        VALUES (
            p_task_id, p_user_id, p_title, p_description, p_status, p_priority,
            p_due_date, p_project_id, p_position, p_tags, p_is_in_inbox,
            p_parent_task_id, NOW(), NOW()
        );

        -- Log audit
        INSERT INTO public.task_dedup_audit (user_id, operation, task_id, decision, reason)
        VALUES (p_user_id, 'safe_create', p_task_id::text, 'created', 'New task created successfully');

        RETURN jsonb_build_object(
            'status', 'created',
            'task_id', p_task_id,
            'message', 'Task created successfully'
        );

    EXCEPTION WHEN unique_violation THEN
        -- Race condition - another transaction inserted first
        INSERT INTO public.task_dedup_audit (user_id, operation, task_id, decision, reason)
        VALUES (p_user_id, 'safe_create', p_task_id::text, 'failed', 'Race condition - duplicate key');

        RETURN jsonb_build_object(
            'status', 'exists',
            'task_id', p_task_id,
            'message', 'Task was created by another transaction'
        );
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION safe_create_task TO authenticated;

COMMENT ON FUNCTION safe_create_task IS 'Safely creates a task, checking for existing IDs and tombstones. Returns status object instead of throwing errors.';

-- =============================================================================
-- Step 5: Batch check function for restore operations
-- =============================================================================

CREATE OR REPLACE FUNCTION check_task_ids_availability(
    p_user_id uuid,
    p_task_ids uuid[]
)
RETURNS TABLE (
    task_id uuid,
    status text,
    reason text
) AS $$
BEGIN
    RETURN QUERY
    WITH input_ids AS (
        SELECT unnest(p_task_ids) AS id
    ),
    existing_check AS (
        SELECT t.id,
               CASE WHEN t.is_deleted THEN 'soft_deleted' ELSE 'active' END AS status
        FROM public.tasks t
        INNER JOIN input_ids i ON t.id = i.id
        WHERE t.user_id = p_user_id
    ),
    tombstone_check AS (
        SELECT ts.entity_id::uuid AS id, 'tombstoned' AS status
        FROM public.tombstones ts
        INNER JOIN input_ids i ON ts.entity_id = i.id::text
        WHERE ts.entity_type = 'task' AND ts.user_id = p_user_id
    )
    SELECT
        i.id AS task_id,
        COALESCE(e.status, t.status, 'available') AS status,
        CASE
            WHEN e.status IS NOT NULL THEN 'Task exists in database (' || e.status || ')'
            WHEN t.status IS NOT NULL THEN 'Task ID is tombstoned (permanently deleted)'
            ELSE 'Task ID is available for creation'
        END AS reason
    FROM input_ids i
    LEFT JOIN existing_check e ON i.id = e.id
    LEFT JOIN tombstone_check t ON i.id = t.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_task_ids_availability TO authenticated;

COMMENT ON FUNCTION check_task_ids_availability IS 'Batch check task ID availability for restore operations. Returns status for each ID.';
