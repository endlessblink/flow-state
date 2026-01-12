-- Add position_version column to tasks and groups tables
-- This enables version-based conflict resolution for canvas interactions

-- Add column to tasks if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'position_version') THEN
        ALTER TABLE tasks ADD COLUMN position_version integer DEFAULT 1;
    END IF;
END $$;

-- Add column to groups if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'groups' AND column_name = 'position_version') THEN
        ALTER TABLE groups ADD COLUMN position_version integer DEFAULT 1;
    END IF;
END $$;

-- Ensure all existing records have version 1
UPDATE tasks SET position_version = 1 WHERE position_version IS NULL;
UPDATE groups SET position_version = 1 WHERE position_version IS NULL;
