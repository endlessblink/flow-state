-- Extends AI assistant memory for VPS/server-backed ask-then-plan behavior.
-- These columns keep uncertainty decisions, cooldowns, and feedback auditable
-- without relying on localStorage or UUID-only project/task tables.

alter table public.ai_context_entities
  add column if not exists memory_type text
    check (memory_type in ('semantic','episodic_summary','preference','procedural')),
  add column if not exists scope text
    check (scope in ('user','project','task','week','workflow')),
  add column if not exists reinforcement_count integer not null default 0,
  add column if not exists last_reinforced_at timestamptz,
  add column if not exists related_entities jsonb not null default '[]'::jsonb,
  add column if not exists decay_score numeric(4,3);

alter table public.ai_clarification_events
  add column if not exists coverage_score_at_time numeric(4,3),
  add column if not exists uncertainty_dimensions jsonb not null default '[]'::jsonb,
  add column if not exists path_type text
    check (path_type in ('clarify_first','generated_with_uncertainty','showed_candidates','pause_save','context_sufficient','memory_timeout')),
  add column if not exists context_snapshot jsonb;

create table if not exists public.ai_recommendation_feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  generated_plan_id text,
  recommendation_id text not null,
  task_id text references public.tasks(id) on delete set null,
  entity_key text,
  action text not null
    check (action in ('accept','timeblock','postpone','dismiss','simplify','explain','ignore')),
  reason_category text
    check (reason_category in ('too_hard','low_energy','not_important','wrong_context','already_done','needs_more_info','too_much','other')),
  free_text text,
  revisit_at timestamptz,
  outcome_signals jsonb not null default '{}'::jsonb,
  implicit_positive boolean not null default false,
  source_message_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_context_edges (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source_entity_key text not null,
  target_entity_key text not null,
  relation_type text not null
    check (relation_type in ('belongs_to','blocks','blocked_by','follow_up','corrected_by','similar_to','part_of_week','preference_affects','mentioned_with')),
  confidence numeric(4,3) not null default 0.5,
  evidence jsonb not null default '{}'::jsonb,
  source_event_id uuid references public.ai_clarification_events(id) on delete set null,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, source_entity_key, target_entity_key, relation_type)
);

create index if not exists idx_ai_context_entities_memory_scope on public.ai_context_entities(user_id, memory_type, scope);
create index if not exists idx_ai_context_entities_last_reinforced on public.ai_context_entities(user_id, last_reinforced_at desc);
create index if not exists idx_ai_clarification_events_path on public.ai_clarification_events(user_id, path_type, created_at desc);
create index if not exists idx_ai_recommendation_feedback_user_action on public.ai_recommendation_feedback(user_id, action, created_at desc);
create index if not exists idx_ai_recommendation_feedback_task on public.ai_recommendation_feedback(user_id, task_id, created_at desc);
create index if not exists idx_ai_recommendation_feedback_entity on public.ai_recommendation_feedback(user_id, entity_key, created_at desc);
create index if not exists idx_ai_context_edges_source on public.ai_context_edges(user_id, source_entity_key, relation_type);
create index if not exists idx_ai_context_edges_target on public.ai_context_edges(user_id, target_entity_key, relation_type);

alter table public.ai_recommendation_feedback enable row level security;
alter table public.ai_context_edges enable row level security;

create policy "Users can view their own AI recommendation feedback"
  on public.ai_recommendation_feedback for select using (auth.uid() = user_id);
create policy "Users can insert their own AI recommendation feedback"
  on public.ai_recommendation_feedback for insert with check (auth.uid() = user_id);
create policy "Users can update their own AI recommendation feedback"
  on public.ai_recommendation_feedback for update using (auth.uid() = user_id);
create policy "Users can delete their own AI recommendation feedback"
  on public.ai_recommendation_feedback for delete using (auth.uid() = user_id);

create policy "Users can view their own AI context edges"
  on public.ai_context_edges for select using (auth.uid() = user_id);
create policy "Users can insert their own AI context edges"
  on public.ai_context_edges for insert with check (auth.uid() = user_id);
create policy "Users can update their own AI context edges"
  on public.ai_context_edges for update using (auth.uid() = user_id);
create policy "Users can delete their own AI context edges"
  on public.ai_context_edges for delete using (auth.uid() = user_id);
