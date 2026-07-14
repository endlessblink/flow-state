import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readOptional = (path: string) => {
  const absolute = resolve(process.cwd(), path)
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : ''
}

const server = readOptional('server/local-api/server.cjs')
const migration = readOptional(
  'supabase/migrations/20260713213000_notion_task_activation.sql',
)

describe('TASK-1939 canonical Notion task activation', () => {
  it('exposes one signed-in preview-first activation route', () => {
    expect(server).toContain("path === '/api/integrations/notion/activations'")
    expect(server).toContain('async function handleNotionTaskActivation')
    expect(server).toContain("supabase.rpc('activate_notion_task'")
    expect(server).toContain('const preview = body.preview !== false')
    expect(server).toContain("error: 'operationId required'")
    expect(server).toContain("error: 'previewDigest required when preview is false'")
    expect(server).toContain("error: 'previewExpiresAt required when preview is false'")
  })

  it('stores non-secret source provenance with one active task per user and Notion page', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS external_source text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS external_id text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS external_url text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS external_data_source_id text')
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS external_last_edited_at timestamptz')
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS tasks_active_external_identity_uidx')
    expect(migration).toContain("external_source = 'notion'")
    expect(migration).not.toContain('api_key')
    expect(migration).not.toContain('token')
  })

  it('binds apply to a durable operation receipt and exact preview payload', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.notion_activation_receipts')
    expect(migration).toContain('PRIMARY KEY (user_id, operation_id)')
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain('REVOKE INSERT ON public.notion_activation_receipts FROM authenticated')
    expect(migration).not.toContain('GRANT SELECT, INSERT ON public.notion_activation_receipts')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('IF p_preview THEN')
    expect(migration).toContain("'idempotency_conflict'")
    expect(migration).toContain("'stale_preview'")
    expect(migration).toContain("'preview_expired'")
    expect(migration).toContain("'notion-activation-v1|' || v_payload_hash || '|'")
    expect(migration.indexOf('SELECT * INTO v_existing_receipt')).toBeLessThan(
      migration.indexOf('IF p_preview_expires_at < now()'),
    )
    expect(migration).toContain('INSERT INTO public.notion_activation_receipts')
  })

  it('creates the task and exact initial work block in one transaction', () => {
    expect(migration).toContain('INSERT INTO public.tasks')
    expect(migration).toContain('external_source')
    expect(migration).toContain('external_id')
    expect(migration).toContain('instances')
    expect(migration).toContain("p_work_block->>'scheduledDate'")
    expect(migration).toContain("p_work_block->>'scheduledTime'")
    expect(migration).toContain("p_work_block->>'duration'")
    expect(migration).toContain("COALESCE(v_existing_task.instances, '[]'::jsonb) || v_instances")
  })

  it('returns a typed replayable receipt and canonical task read-back', () => {
    expect(migration).toContain("'source', 'notion'")
    expect(migration).toContain("'externalId', p_notion_page_id")
    expect(migration).toContain("'operationId', p_operation_id")
    expect(migration).toContain("'replayed'")
    expect(migration).toContain("'readBack'")
    expect(server).toContain("notifyTaskMutation('create'")
  })
})
