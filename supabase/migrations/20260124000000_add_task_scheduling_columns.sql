-- Migration: Add missing task scheduling columns (BUG-1051)
-- These columns were added to the mapper but the migration was missing
-- Causing 400 Bad Request errors on production

-- Add scheduled_date column for calendar scheduling
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS scheduled_date timestamptz;

-- Add scheduled_time column for time-specific scheduling
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS scheduled_time text;

-- Add is_uncategorized flag for tasks without a project
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS is_uncategorized boolean DEFAULT false;

-- Add helpful comment
COMMENT ON COLUMN public.tasks.scheduled_date IS 'Date when task is scheduled (separate from due_date for calendar view)';
COMMENT ON COLUMN public.tasks.scheduled_time IS 'Time when task is scheduled (HH:MM format)';
COMMENT ON COLUMN public.tasks.is_uncategorized IS 'True if task has no project assigned';
