-- FEATURE-1363: Add reminders column to tasks and settings column to user_settings
-- Reminders stores an array of custom reminder objects (date/time reminders)
-- Settings stores notification preferences for the push service

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS reminders JSONB DEFAULT '[]'::jsonb;

-- Add settings JSONB column to user_settings for push notification preferences
-- The push service reads this column to determine notification delivery preferences
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- GIN index for efficient JSONB queries on reminders
CREATE INDEX IF NOT EXISTS idx_tasks_reminders ON public.tasks USING GIN (reminders jsonb_path_ops);

-- Comment for documentation
COMMENT ON COLUMN public.tasks.reminders IS 'FEATURE-1363: Array of custom date/time reminders [{id, datetime, label, fired, dismissed, createdAt}]';
COMMENT ON COLUMN public.user_settings.settings IS 'FEATURE-1363: Notification preferences for push service {pushNotifications, timeBlockNotifications, ...}';
