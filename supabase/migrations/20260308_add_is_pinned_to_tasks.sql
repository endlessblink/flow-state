-- Add is_pinned column to tasks table for TASK-1486
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
