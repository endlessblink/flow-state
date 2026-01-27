-- Add done_for_now_until column to tasks table
-- This tracks when a task was rescheduled via "Done for now" feature
-- The badge shows when dueDate matches this value, and disappears when user changes dueDate

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS done_for_now_until DATE;

-- Add comment for documentation
COMMENT ON COLUMN tasks.done_for_now_until IS 'Tracks when task was rescheduled via "Done for now" feature. Badge shows when dueDate matches this value.';
