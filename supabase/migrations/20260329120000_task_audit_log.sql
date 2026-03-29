-- TASK-1734: Task Audit Log - Forensic Task Lifecycle Tracker
-- Immutable, append-only audit trail capturing every task lifecycle event
-- with title and key fields for forensic querying.
--
-- This migration:
-- 1. Enables pg_trgm extension for fuzzy title search
-- 2. Creates task_audit_log table (immutable, append-only)
-- 3. Adds indexes for task history, user timeline, and fuzzy title search
-- 4. Enforces immutability via RULE (blocks UPDATE/DELETE)
-- 5. Enables RLS with workspace-aware SELECT policy, INSERT blocked for users
-- 6. Creates trigger function fn_task_audit_log() (SECURITY DEFINER)
-- 7. Attaches two triggers: AFTER INSERT OR UPDATE, BEFORE DELETE
-- 8. Creates search_task_audit() RPC for authenticated querying

-- =============================================================================
-- Step 1: Enable pg_trgm extension
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- Step 2: Create task_audit_log table
-- =============================================================================

CREATE TABLE public.task_audit_log (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_at    timestamptz NOT NULL DEFAULT now(),
    event_type  text NOT NULL CHECK (event_type IN (
                    'CREATED', 'SOFT_DELETED', 'RESTORED',
                    'STATUS_CHANGED', 'HARD_DELETED')),
    task_id     text NOT NULL,
    user_id     uuid NOT NULL,
    title       text,
    status      text,
    project_id  text,
    priority    text,
    is_deleted  boolean,
    old_values  jsonb DEFAULT '{}'::jsonb,
    new_values  jsonb DEFAULT '{}'::jsonb,
    source      text DEFAULT 'trigger',
    workspace_id uuid
);

-- =============================================================================
-- Step 3: Indexes
-- =============================================================================

-- Task history: look up all events for a given task in chronological order
CREATE INDEX idx_task_audit_log_task_id
    ON public.task_audit_log (task_id, event_at DESC);

-- User timeline: all events for a user (also supports RLS evaluation)
CREATE INDEX idx_task_audit_log_user_id
    ON public.task_audit_log (user_id, event_at DESC);

-- Fuzzy title search via pg_trgm
CREATE INDEX idx_task_audit_log_title_trgm
    ON public.task_audit_log USING gin (title gin_trgm_ops);

-- Filter by event type with time ordering
CREATE INDEX idx_task_audit_log_event_type
    ON public.task_audit_log (event_type, event_at DESC);

-- =============================================================================
-- Step 4: Immutability enforcement
-- =============================================================================

CREATE RULE task_audit_log_no_update AS ON UPDATE TO public.task_audit_log DO INSTEAD NOTHING;
CREATE RULE task_audit_log_no_delete AS ON DELETE TO public.task_audit_log DO INSTEAD NOTHING;

-- =============================================================================
-- Step 5: Row Level Security
-- =============================================================================

ALTER TABLE public.task_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: user sees their own rows, plus workspace rows if they belong to that workspace
CREATE POLICY "Users can view own or workspace audit log entries"
    ON public.task_audit_log FOR SELECT
    USING (
        (workspace_id IS NULL AND auth.uid() = user_id)
        OR
        (workspace_id = ANY(user_workspace_ids()))
    );

-- INSERT: blocked for all authenticated users — only the SECURITY DEFINER trigger may insert
CREATE POLICY "No direct inserts — trigger only"
    ON public.task_audit_log FOR INSERT
    WITH CHECK (false);

-- =============================================================================
-- Step 6: Trigger function fn_task_audit_log()
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_task_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_event_type  text;
    v_task_id     text;
    v_user_id     uuid;
    v_title       text;
    v_status      text;
    v_project_id  text;
    v_priority    text;
    v_is_deleted  boolean;
    v_old_values  jsonb;
    v_new_values  jsonb;
BEGIN
    -- -------------------------------------------------------------------------
    -- HARD DELETE: row being permanently removed
    -- -------------------------------------------------------------------------
    IF TG_OP = 'DELETE' THEN
        v_event_type  := 'HARD_DELETED';
        v_task_id     := OLD.id::text;
        v_user_id     := OLD.user_id;
        v_title       := OLD.title;
        v_status      := OLD.status;
        v_project_id  := OLD.project_id::text;
        v_priority    := OLD.priority;
        v_is_deleted  := OLD.is_deleted;

        v_old_values := jsonb_build_object(
            'description', LEFT(COALESCE(OLD.description, ''), 500),
            'due_date',    OLD.due_date,
            'tags',        OLD.tags,
            'is_deleted',  OLD.is_deleted,
            'deleted_at',  OLD.deleted_at,
            'subtasks_count', COALESCE(jsonb_array_length(OLD.subtasks), 0)
        );
        v_new_values := '{}'::jsonb;

        INSERT INTO public.task_audit_log
            (event_type, task_id, user_id, title, status, project_id,
             priority, is_deleted, old_values, new_values)
        VALUES
            (v_event_type, v_task_id, v_user_id, v_title, v_status, v_project_id,
             v_priority, v_is_deleted, v_old_values, v_new_values);

        RETURN OLD;
    END IF;

    -- -------------------------------------------------------------------------
    -- INSERT: new task created
    -- -------------------------------------------------------------------------
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.task_audit_log
            (event_type, task_id, user_id, title, status, project_id,
             priority, is_deleted, old_values, new_values)
        VALUES
            ('CREATED', NEW.id::text, NEW.user_id, NEW.title, NEW.status,
             NEW.project_id::text, NEW.priority, NEW.is_deleted,
             '{}'::jsonb, '{}'::jsonb);

        RETURN NEW;
    END IF;

    -- -------------------------------------------------------------------------
    -- UPDATE: only log meaningful lifecycle changes — skip position/description noise
    -- -------------------------------------------------------------------------
    IF TG_OP = 'UPDATE' THEN
        -- Soft-delete or restore
        IF OLD.is_deleted IS DISTINCT FROM NEW.is_deleted THEN
            v_event_type := CASE WHEN NEW.is_deleted THEN 'SOFT_DELETED' ELSE 'RESTORED' END;

        -- Status change
        ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
            v_event_type := 'STATUS_CHANGED';

        -- Nothing interesting changed — skip audit to avoid noise
        ELSE
            RETURN NEW;
        END IF;

        v_old_values := jsonb_build_object(
            'status',     OLD.status,
            'is_deleted', OLD.is_deleted
        );
        v_new_values := jsonb_build_object(
            'status',     NEW.status,
            'is_deleted', NEW.is_deleted
        );

        INSERT INTO public.task_audit_log
            (event_type, task_id, user_id, title, status, project_id,
             priority, is_deleted, old_values, new_values)
        VALUES
            (v_event_type,
             NEW.id::text,
             NEW.user_id,
             COALESCE(NEW.title, OLD.title),
             NEW.status,
             NEW.project_id::text,
             NEW.priority,
             NEW.is_deleted,
             v_old_values,
             v_new_values);

        RETURN NEW;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Step 7: Attach triggers to tasks table
-- =============================================================================

-- Drop existing triggers if re-running migration (idempotency)
DROP TRIGGER IF EXISTS trg_task_audit_log_iu ON public.tasks;
DROP TRIGGER IF EXISTS trg_task_audit_log_d  ON public.tasks;

-- AFTER INSERT OR UPDATE: captures CREATED, STATUS_CHANGED, SOFT_DELETED, RESTORED
CREATE TRIGGER trg_task_audit_log_iu
    AFTER INSERT OR UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION fn_task_audit_log();

-- BEFORE DELETE: captures HARD_DELETED (runs alongside trg_task_tombstone)
CREATE TRIGGER trg_task_audit_log_d
    BEFORE DELETE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION fn_task_audit_log();

-- =============================================================================
-- Step 8: RPC function search_task_audit
-- =============================================================================

CREATE OR REPLACE FUNCTION search_task_audit(
    p_query       text    DEFAULT NULL,
    p_event_types text[]  DEFAULT NULL,
    p_limit       int     DEFAULT 50
)
RETURNS TABLE (
    event_at    timestamptz,
    event_type  text,
    task_id     text,
    title       text,
    status      text,
    priority    text,
    project_id  text,
    is_deleted  boolean,
    old_values  jsonb,
    new_values  jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT  a.event_at,
            a.event_type,
            a.task_id,
            a.title,
            a.status,
            a.priority,
            a.project_id,
            a.is_deleted,
            a.old_values,
            a.new_values
    FROM    task_audit_log a
    WHERE   a.user_id = auth.uid()
      AND   (p_query IS NULL OR a.title ILIKE '%' || p_query || '%')
      AND   (p_event_types IS NULL OR a.event_type = ANY(p_event_types))
    ORDER BY a.event_at DESC
    LIMIT   p_limit;
$$;

GRANT EXECUTE ON FUNCTION search_task_audit TO authenticated;

-- =============================================================================
-- Step 9: Table comment
-- =============================================================================

COMMENT ON TABLE public.task_audit_log IS 'Immutable audit trail for task lifecycle events. Retained indefinitely. No UPDATE/DELETE allowed. Search by title via pg_trgm index.';
