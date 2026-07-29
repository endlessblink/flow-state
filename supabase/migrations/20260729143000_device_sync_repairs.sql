alter table public.device_sync_receipts
  add column if not exists repair_entity_ids uuid[] not null default '{}',
  add column if not exists repair_requested_at timestamptz,
  add column if not exists repair_completed_at timestamptz,
  add column if not exists repair_error_code text;
