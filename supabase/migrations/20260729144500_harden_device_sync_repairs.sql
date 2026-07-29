alter table public.device_sync_receipts
  alter column repair_entity_ids type text[]
    using repair_entity_ids::text[],
  add column if not exists repair_request_id uuid;
