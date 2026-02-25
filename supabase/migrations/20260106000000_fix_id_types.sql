-- Migration: Change tasks and projects ID columns from UUID to TEXT
-- This allows CouchDB-style IDs like "project-1766441343920" and "task-1767348738643"

-- 1. Drop foreign key constraints first
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_parent_task_id_fkey;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_parent_id_fkey;
ALTER TABLE public.pomodoro_history DROP CONSTRAINT IF EXISTS pomodoro_history_task_id_fkey;

-- 2. Alter projects table
ALTER TABLE public.projects
  ALTER COLUMN id TYPE text,
  ALTER COLUMN parent_id TYPE text;

-- 3. Alter tasks table
ALTER TABLE public.tasks
  ALTER COLUMN id TYPE text,
  ALTER COLUMN project_id TYPE text,
  ALTER COLUMN parent_task_id TYPE text;

-- 4. Alter pomodoro_history table
ALTER TABLE public.pomodoro_history
  ALTER COLUMN task_id TYPE text;

-- 5. Re-add foreign key constraints with text type
ALTER TABLE public.projects
  ADD CONSTRAINT projects_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_parent_task_id_fkey
  FOREIGN KEY (parent_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Note: pomodoro_history.task_id won't have FK constraint for flexibility

-- 6. Update depends_on column to text array
ALTER TABLE public.tasks
  ALTER COLUMN depends_on TYPE text[];
