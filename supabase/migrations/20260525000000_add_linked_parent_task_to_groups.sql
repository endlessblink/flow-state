-- tasks.id is TEXT (not uuid), so the FK column must also be text — a uuid column
-- referencing a text key fails on a fresh DB with "incompatible types: uuid and text"
-- (SQLSTATE 42804), which broke the CI two-client Realtime e2e boot.
alter table public.groups
  add column if not exists linked_parent_task_id text references public.tasks(id) on delete set null;

notify pgrst, 'reload schema';
