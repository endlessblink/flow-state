-- TASK-1403: Add recurrence_rule columns for clone-on-complete model
-- These replace the old pre-generated recurring_instances approach.
-- A recurring task is just a normal task with recurrence_rule attached.
-- When completed, the system clones it with the next due date.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule jsonb;
-- { pattern: 'weekly', interval: 1, weekdays: [5], endType: 'never', endDate: null, endCount: null }

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_parent_id text REFERENCES tasks(id) ON DELETE SET NULL;
-- Links back to the original task that started the chain (for history/analytics)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_count integer DEFAULT 0;
-- How many times this task has recurred (for AFTER_COUNT end condition)
