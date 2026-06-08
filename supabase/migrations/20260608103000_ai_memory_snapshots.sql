-- Compact memory snapshots for lifecycle/summarization.
-- Append-only events remain auditable; snapshots provide bounded retrieval
-- summaries for noisy or old memory without prompt-stuffing raw history.

create table if not exists public.ai_memory_snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  snapshot_key text not null,
  scope text not null
    check (scope in ('user','project','task','week','workflow')),
  entity_keys jsonb not null default '[]'::jsonb,
  summary_text text not null,
  facts jsonb not null default '{}'::jsonb,
  source_event_count integer not null default 0,
  source_entity_count integer not null default 0,
  confidence numeric(4,3) not null default 0.5,
  stale_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, snapshot_key)
);

create index if not exists idx_ai_memory_snapshots_user_scope
  on public.ai_memory_snapshots(user_id, scope, updated_at desc);
create index if not exists idx_ai_memory_snapshots_user_key
  on public.ai_memory_snapshots(user_id, snapshot_key);
create index if not exists idx_ai_memory_snapshots_stale
  on public.ai_memory_snapshots(user_id, stale_after);

alter table public.ai_memory_snapshots enable row level security;

create policy "Users can view their own AI memory snapshots"
  on public.ai_memory_snapshots for select using (auth.uid() = user_id);
create policy "Users can insert their own AI memory snapshots"
  on public.ai_memory_snapshots for insert with check (auth.uid() = user_id);
create policy "Users can update their own AI memory snapshots"
  on public.ai_memory_snapshots for update using (auth.uid() = user_id);
create policy "Users can delete their own AI memory snapshots"
  on public.ai_memory_snapshots for delete using (auth.uid() = user_id);

drop trigger if exists update_ai_memory_snapshots_updated_at on public.ai_memory_snapshots;
create trigger update_ai_memory_snapshots_updated_at
  before update on public.ai_memory_snapshots
  for each row execute procedure update_updated_at_column();
