-- Drop orphaned FK constraint on tasks.parent_id
-- This constraint was added manually to production but never existed in migrations.
-- Canvas group association is stored in position.parentId (JSONB), not the parent_id column.
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_parent_id_fkey;
