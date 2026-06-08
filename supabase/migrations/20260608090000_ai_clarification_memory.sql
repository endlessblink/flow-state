-- General AI clarification memory.
-- Stores reusable context and question history for real entities and synthetic
-- buckets such as "Work", "My Projects", or "uncategorized".

create table if not exists public.ai_context_entities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_key text not null,
  entity_type text not null
    check (entity_type in ('project','task','week','preference','synthetic_group','workflow')),
  display_name text not null,
  canonical_project_id text,
  canonical_task_id text,
  summary text,
  facts jsonb not null default '{}'::jsonb,
  corrections jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) not null default 0,
  completeness_score numeric(4,3) not null default 0,
  last_asked_at timestamptz,
  last_answered_at timestamptz,
  ask_count integer not null default 0,
  stale_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, entity_key)
);

create table if not exists public.ai_clarification_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_key text not null,
  entity_type text not null
    check (entity_type in ('project','task','week','preference','synthetic_group','workflow')),
  question_id text not null,
  event_type text not null
    check (event_type in ('asked','answered','dismissed','generated_with_uncertainty','showed_candidates','correction')),
  question text,
  selected_option_id text,
  selected_label text,
  free_text text,
  memory_patch jsonb,
  source_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_context_entities_user_key on public.ai_context_entities(user_id, entity_key);
create index if not exists idx_ai_context_entities_project on public.ai_context_entities(user_id, canonical_project_id);
create index if not exists idx_ai_context_entities_task on public.ai_context_entities(user_id, canonical_task_id);
create index if not exists idx_ai_clarification_events_user_key on public.ai_clarification_events(user_id, entity_key, created_at desc);
create index if not exists idx_ai_clarification_events_question on public.ai_clarification_events(user_id, question_id, created_at desc);

alter table public.ai_context_entities enable row level security;
alter table public.ai_clarification_events enable row level security;

create policy "Users can view their own AI context entities"
  on public.ai_context_entities for select using (auth.uid() = user_id);
create policy "Users can insert their own AI context entities"
  on public.ai_context_entities for insert with check (auth.uid() = user_id);
create policy "Users can update their own AI context entities"
  on public.ai_context_entities for update using (auth.uid() = user_id);
create policy "Users can delete their own AI context entities"
  on public.ai_context_entities for delete using (auth.uid() = user_id);

create policy "Users can view their own AI clarification events"
  on public.ai_clarification_events for select using (auth.uid() = user_id);
create policy "Users can insert their own AI clarification events"
  on public.ai_clarification_events for insert with check (auth.uid() = user_id);

drop trigger if exists update_ai_context_entities_updated_at on public.ai_context_entities;
create trigger update_ai_context_entities_updated_at
  before update on public.ai_context_entities
  for each row execute procedure update_updated_at_column();
