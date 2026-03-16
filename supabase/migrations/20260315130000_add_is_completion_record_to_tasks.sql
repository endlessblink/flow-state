-- TASK-1532: Add is_completion_record column for "Done for Now" recurring task completion history
-- Completion records are calendar-only snapshots of recurring task completions.
-- They are filtered out of board/canvas/inbox views.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_completion_record BOOLEAN DEFAULT FALSE;

-- Index for efficient filtering of completion records in calendar queries
CREATE INDEX IF NOT EXISTS idx_tasks_is_completion_record ON tasks (is_completion_record) WHERE is_completion_record = TRUE;
