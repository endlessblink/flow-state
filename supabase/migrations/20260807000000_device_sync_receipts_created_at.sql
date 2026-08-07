alter table public.device_sync_receipts
  add column if not exists created_at timestamptz not null default now();
