create table if not exists public.device_sync_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null,
  runtime text not null check (runtime in ('pwa', 'electron', 'capacitor', 'browser')),
  app_version text not null,
  status text not null check (status in ('synced', 'syncing', 'pending', 'error', 'offline')),
  is_online boolean not null,
  last_sync_at timestamptz,
  queue jsonb not null default '{}'::jsonb,
  operations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (user_id, device_id),
  constraint device_sync_receipts_operations_array
    check (jsonb_typeof(operations) = 'array' and jsonb_array_length(operations) <= 20),
  constraint device_sync_receipts_queue_object
    check (jsonb_typeof(queue) = 'object')
);

alter table public.device_sync_receipts enable row level security;

drop policy if exists "Users can read own device sync receipts" on public.device_sync_receipts;
create policy "Users can read own device sync receipts"
  on public.device_sync_receipts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own device sync receipts" on public.device_sync_receipts;
create policy "Users can insert own device sync receipts"
  on public.device_sync_receipts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own device sync receipts" on public.device_sync_receipts;
create policy "Users can update own device sync receipts"
  on public.device_sync_receipts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.device_sync_receipts from anon;
grant select, insert, update on public.device_sync_receipts to authenticated;
