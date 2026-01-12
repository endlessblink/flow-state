-- TASK-241: Auto-increment position_version on position change
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Trigger for TASKS table
CREATE OR REPLACE FUNCTION increment_task_position_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.position IS DISTINCT FROM NEW.position THEN
    NEW.position_version = COALESCE(OLD.position_version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_task_position_version ON public.tasks;
CREATE TRIGGER trigger_increment_task_position_version
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION increment_task_position_version();

-- 2. Trigger for GROUPS table
CREATE OR REPLACE FUNCTION increment_group_position_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.position_json IS DISTINCT FROM NEW.position_json THEN
    NEW.position_version = COALESCE(OLD.position_version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_group_position_version ON public.groups;
CREATE TRIGGER trigger_increment_group_position_version
BEFORE UPDATE ON public.groups
FOR EACH ROW
EXECUTE FUNCTION increment_group_position_version();
