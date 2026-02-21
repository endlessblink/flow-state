-- TASK-1385: Add personal_context for user's "About Me" description
-- Stores free-text describing the user's routine, energy patterns, scheduling preferences
-- Used by Weekly Plan AI for contextual task reasoning

ALTER TABLE public.ai_work_profiles
  ADD COLUMN IF NOT EXISTS personal_context text DEFAULT NULL;
