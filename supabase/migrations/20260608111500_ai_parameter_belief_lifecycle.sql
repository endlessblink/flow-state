-- Lifecycle metadata for structured clarification beliefs.
-- Beliefs suppress repeat questions, so they need the same freshness and
-- reinforcement metadata as context entities instead of relying only on
-- updated_at.

alter table public.ai_parameter_beliefs
  add column if not exists stale_after timestamptz,
  add column if not exists last_reinforced_at timestamptz,
  add column if not exists reinforcement_count integer not null default 0,
  add column if not exists decay_score numeric(4,3);

create index if not exists idx_ai_parameter_beliefs_stale
  on public.ai_parameter_beliefs(user_id, stale_after);
