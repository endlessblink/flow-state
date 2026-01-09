-- Migration: Enable RLS on all tables
-- TASK-161: Critical security fix - RLS policies exist but were not enabled
-- Created: January 9, 2026
--
-- ISSUE: Supabase linter detected that RLS policies were defined but RLS
-- was not enabled on the tables, meaning the policies were not enforced.
-- This allowed any authenticated user to potentially access all users' data.

-- =============================================================================
-- 1. ENABLE RLS ON ALL TABLES WITH EXISTING POLICIES
-- =============================================================================

-- These tables already have policies defined, just need RLS enabled
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_sort_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_history ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 2. HANDLE TABLES WITHOUT USER_ID COLUMN
-- =============================================================================

-- deleted_tasks_log and tasks_backup may not have user_id columns
-- These are internal/admin tables, so we'll restrict them to service role only
-- by enabling RLS with NO policies (blocks all access except service role)

-- deleted_tasks_log - Enable RLS (service role only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'deleted_tasks_log' AND table_schema = 'public') THEN
    ALTER TABLE public.deleted_tasks_log ENABLE ROW LEVEL SECURITY;
    -- No policies = only service role can access
    RAISE NOTICE 'RLS enabled on deleted_tasks_log (service role only)';
  END IF;
END $$;

-- tasks_backup - Enable RLS (service role only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks_backup' AND table_schema = 'public') THEN
    ALTER TABLE public.tasks_backup ENABLE ROW LEVEL SECURITY;
    -- No policies = only service role can access
    RAISE NOTICE 'RLS enabled on tasks_backup (service role only)';
  END IF;
END $$;

-- =============================================================================
-- 3. VERIFICATION QUERY (run after migration to confirm)
-- =============================================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public';
--
-- All tables should show rowsecurity = true
