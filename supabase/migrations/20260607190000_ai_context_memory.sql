-- AI project/task understanding memory.
-- Stores user-confirmed meaning separately from operational task data.

create extension if not exists pg_trgm;

create table if not exists public.project_contexts (
  -- text, not uuid: projects.id is text (fix_id_types). A uuid FK fails on fresh DB boot.
  project_id text primary key references public.projects(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  summary text,
  domain text not null default 'unknown'
    check (domain in ('work','personal','creative','admin','learning','health','unknown')),
  life_area text,
  why_it_matters text,
  success_criteria jsonb not null default '[]'::jsonb,
  failure_risks jsonb not null default '[]'::jsonb,
  current_stakes text not null default 'unknown'
    check (current_stakes in ('low','medium','high','critical','unknown')),
  urgency_window text not null default 'unknown'
    check (urgency_window in ('none','this_week','this_month','date_bound','unknown')),
  preferred_cadence text
    check (preferred_cadence is null or preferred_cadence in ('daily','weekly','occasional','paused','unknown')),
  task_selection_hints jsonb not null default '[]'::jsonb,
  non_goals jsonb not null default '[]'::jsonb,
  user_corrections jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) not null default 0,
  completeness_score numeric(4,3) not null default 0,
  last_confirmed_at timestamptz,
  last_updated_at timestamptz not null default now(),
  stale_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.task_contexts (
  -- text, not uuid: tasks.id/projects.id are text (fix_id_types).
  task_id text primary key references public.tasks(id) on delete cascade,
  project_id text references public.projects(id) on delete set null,
  user_id uuid references auth.users(id) on delete cascade not null,
  summary text,
  why_it_matters text,
  success_criteria jsonb not null default '[]'::jsonb,
  current_stakes text not null default 'unknown'
    check (current_stakes in ('low','medium','high','critical','unknown')),
  urgency_window text not null default 'unknown'
    check (urgency_window in ('none','this_week','this_month','date_bound','unknown')),
  selection_hints jsonb not null default '[]'::jsonb,
  non_goals jsonb not null default '[]'::jsonb,
  user_corrections jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) not null default 0,
  completeness_score numeric(4,3) not null default 0,
  last_confirmed_at timestamptz,
  last_updated_at timestamptz not null default now(),
  stale_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_task_links (
  -- text, not uuid: projects.id/tasks.id are text (fix_id_types).
  project_id text references public.projects(id) on delete cascade,
  task_id text references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade not null,
  link_type text not null
    check (link_type in ('belongs_to','maybe_belongs_to','follow_up','blocked_by')),
  confidence numeric(4,3) not null default 0,
  source text,
  created_at timestamptz not null default now(),
  primary key (project_id, task_id, link_type)
);

create table if not exists public.memory_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_type text not null check (entity_type in ('project','task','preference','correction')),
  entity_id uuid not null,
  event_type text not null
    check (event_type in ('user_answer','correction','inferred_candidate','confirmation','stale_flag','patch')),
  field text,
  old_value jsonb,
  new_value jsonb,
  confidence numeric(4,3) not null default 0,
  source_message_id text,
  source text,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_contexts_user_id on public.project_contexts(user_id);
create index if not exists idx_task_contexts_user_id on public.task_contexts(user_id);
create index if not exists idx_task_contexts_project_id on public.task_contexts(project_id);
create index if not exists idx_project_task_links_user_id on public.project_task_links(user_id);
create index if not exists idx_memory_events_entity on public.memory_events(user_id, entity_type, entity_id, created_at desc);

create index if not exists idx_project_contexts_search on public.project_contexts using gin (
  to_tsvector('simple',
    coalesce(summary, '') || ' ' ||
    coalesce(why_it_matters, '') || ' ' ||
    coalesce(success_criteria::text, '') || ' ' ||
    coalesce(user_corrections::text, '')
  )
);

create index if not exists idx_task_contexts_search on public.task_contexts using gin (
  to_tsvector('simple',
    coalesce(summary, '') || ' ' ||
    coalesce(why_it_matters, '') || ' ' ||
    coalesce(success_criteria::text, '') || ' ' ||
    coalesce(user_corrections::text, '')
  )
);

alter table public.project_contexts enable row level security;
alter table public.task_contexts enable row level security;
alter table public.project_task_links enable row level security;
alter table public.memory_events enable row level security;

create policy "Users can view their own project contexts"
  on public.project_contexts for select using (auth.uid() = user_id);
create policy "Users can insert their own project contexts"
  on public.project_contexts for insert with check (auth.uid() = user_id);
create policy "Users can update their own project contexts"
  on public.project_contexts for update using (auth.uid() = user_id);
create policy "Users can delete their own project contexts"
  on public.project_contexts for delete using (auth.uid() = user_id);

create policy "Users can view their own task contexts"
  on public.task_contexts for select using (auth.uid() = user_id);
create policy "Users can insert their own task contexts"
  on public.task_contexts for insert with check (auth.uid() = user_id);
create policy "Users can update their own task contexts"
  on public.task_contexts for update using (auth.uid() = user_id);
create policy "Users can delete their own task contexts"
  on public.task_contexts for delete using (auth.uid() = user_id);

create policy "Users can view their own project task links"
  on public.project_task_links for select using (auth.uid() = user_id);
create policy "Users can insert their own project task links"
  on public.project_task_links for insert with check (auth.uid() = user_id);
create policy "Users can update their own project task links"
  on public.project_task_links for update using (auth.uid() = user_id);
create policy "Users can delete their own project task links"
  on public.project_task_links for delete using (auth.uid() = user_id);

create policy "Users can view their own memory events"
  on public.memory_events for select using (auth.uid() = user_id);
create policy "Users can insert their own memory events"
  on public.memory_events for insert with check (auth.uid() = user_id);

drop trigger if exists update_project_contexts_updated_at on public.project_contexts;
create trigger update_project_contexts_updated_at
  before update on public.project_contexts
  for each row execute procedure update_updated_at_column();

drop trigger if exists update_task_contexts_updated_at on public.task_contexts;
create trigger update_task_contexts_updated_at
  before update on public.task_contexts
  for each row execute procedure update_updated_at_column();
