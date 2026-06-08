-- Stores structured uncertainty slots for ask-then-plan decisions.
-- Entity keys are text on purpose: synthetic buckets such as Work, My Projects,
-- and uncategorized must be first-class memory targets without UUID casting.

create table if not exists public.ai_parameter_beliefs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  entity_key text not null,
  entity_type text not null
    check (entity_type in ('project','task','week','preference','synthetic_group','workflow')),
  parameter_key text not null,
  belief_json jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 0,
  impact_weight numeric(4,3) not null default 0.5,
  last_answered_at timestamptz,
  source_question_id text,
  source_event_id uuid references public.ai_clarification_events(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, entity_key, parameter_key)
);

create index if not exists idx_ai_parameter_beliefs_user_entity
  on public.ai_parameter_beliefs(user_id, entity_key);
create index if not exists idx_ai_parameter_beliefs_user_parameter
  on public.ai_parameter_beliefs(user_id, parameter_key, updated_at desc);
create index if not exists idx_ai_parameter_beliefs_low_confidence
  on public.ai_parameter_beliefs(user_id, confidence, impact_weight desc);

alter table public.ai_parameter_beliefs enable row level security;

create policy "Users can view their own AI parameter beliefs"
  on public.ai_parameter_beliefs for select using (auth.uid() = user_id);
create policy "Users can insert their own AI parameter beliefs"
  on public.ai_parameter_beliefs for insert with check (auth.uid() = user_id);
create policy "Users can update their own AI parameter beliefs"
  on public.ai_parameter_beliefs for update using (auth.uid() = user_id);
create policy "Users can delete their own AI parameter beliefs"
  on public.ai_parameter_beliefs for delete using (auth.uid() = user_id);

drop trigger if exists update_ai_parameter_beliefs_updated_at on public.ai_parameter_beliefs;
create trigger update_ai_parameter_beliefs_updated_at
  before update on public.ai_parameter_beliefs
  for each row execute procedure update_updated_at_column();
