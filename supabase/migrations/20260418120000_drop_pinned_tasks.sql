-- TASK-1772: Unify "Pinned" onto task.is_pinned.
--
-- Two parallel pinning systems had drifted: standalone `pinned_tasks` shortcut
-- rows (powering the top-right lightning-icon dropdown + KDE widget) and the
-- `tasks.is_pinned` flag (powering the Inbox sidebar). Same label, different
-- data. This migration converts every `pinned_tasks` row into a real task
-- with `is_pinned = true` (preserving project/priority/description) and then
-- drops the obsolete table. Idempotent and safe to re-run.
--
-- Matching strategy:
--   1. If an active (non-deleted, non-done) task with the same (user_id, lower(title))
--      already exists, flip its `is_pinned` to true instead of creating a duplicate.
--   2. Otherwise insert a new task carrying the pinned_tasks metadata.

DO $$
DECLARE
    flagged INT := 0;
    inserted INT := 0;
    dropped_count INT := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'pinned_tasks'
    ) THEN
        RAISE NOTICE 'pinned_tasks table does not exist — nothing to migrate.';
        RETURN;
    END IF;

    -- 1. Flip is_pinned=true on existing active tasks that match a pinned_tasks title.
    WITH matched AS (
        UPDATE public.tasks t
        SET is_pinned = TRUE,
            updated_at = now()
        FROM public.pinned_tasks p
        WHERE t.user_id = p.user_id
          AND lower(t.title) = lower(p.title)
          AND COALESCE(t.is_deleted, FALSE) = FALSE
          AND t.status IS DISTINCT FROM 'done'
          AND COALESCE(t.is_pinned, FALSE) = FALSE
        RETURNING t.id
    )
    SELECT COUNT(*) INTO flagged FROM matched;

    -- 2. For pinned_tasks rows with no matching active task, create one.
    WITH created AS (
        INSERT INTO public.tasks (
            id, user_id, title, description, project_id, priority,
            status, is_pinned, is_in_inbox, is_deleted, created_at, updated_at
        )
        SELECT
            gen_random_uuid(),
            p.user_id,
            p.title,
            COALESCE(p.description, ''),
            p.project_id,
            p.priority,
            'planned',
            TRUE,
            TRUE,
            FALSE,
            now(),
            now()
        FROM public.pinned_tasks p
        WHERE NOT EXISTS (
            SELECT 1 FROM public.tasks t
            WHERE t.user_id = p.user_id
              AND lower(t.title) = lower(p.title)
              AND COALESCE(t.is_deleted, FALSE) = FALSE
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO inserted FROM created;

    SELECT COUNT(*) INTO dropped_count FROM public.pinned_tasks;

    RAISE NOTICE 'TASK-1772 migration: flagged %, inserted %, dropping % rows from pinned_tasks.',
        flagged, inserted, dropped_count;
END $$;

DROP TABLE IF EXISTS public.pinned_tasks CASCADE;
