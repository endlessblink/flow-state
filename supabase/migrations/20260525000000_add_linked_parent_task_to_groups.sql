alter table public.groups
  add column if not exists linked_parent_task_id uuid references public.tasks(id) on delete set null;

notify pgrst, 'reload schema';
