import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260714010000_canonical_notion_activation.sql',
)
const migrationExists = existsSync(migrationPath)

function migrationSource(): string {
  return readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ')
}

describe('TASK-1948 canonical Notion activation contract', () => {
  it('ships an ordered migration on top of the canonical task contract', () => {
    expect(migrationExists).toBe(true)
  })

  describe.skipIf(!migrationExists)('migration invariants', () => {
    it('stores stable provenance with per-user active uniqueness', () => {
      const sql = migrationSource()

      for (const column of [
        'external_source',
        'external_id',
        'external_url',
        'external_data_source_id',
        'external_last_edited_at',
      ]) {
        expect(sql).toContain(`add column if not exists ${column}`)
      }
      expect(sql).toMatch(
        /create unique index[^;]+on public\.tasks\s*\(\s*user_id\s*,\s*external_source\s*,\s*external_id\s*\)[^;]+where[^;]+is_deleted\s*=\s*false/,
      )
      expect(sql).toMatch(
        /create trigger guard_task_external_provenance_v1[^;]+before insert or update on public\.tasks/,
      )
      for (const column of [
        'external_source',
        'external_id',
        'external_url',
        'external_data_source_id',
        'external_last_edited_at',
      ]) {
        expect(sql).toContain(
          `new.${column} is distinct from old.${column}`,
        )
      }
      for (const predicate of [
        "operation.state = 'applying'",
        "operation.contract_version = 'notion-activation-v1'",
        "operation.source = 'notion'",
        "operation.scope_kind = 'personal'",
        'operation.workspace_id is null',
        "operation.entity_type = 'task'",
        "operation.action = 'activate'",
        'operation.entity_id = new.id',
      ]) {
        expect(sql).toContain(predicate)
      }
    })

    it('uses the existing canonical operation and preview ledgers', () => {
      const sql = migrationSource()

      expect(sql).toMatch(
        /create or replace function public\.flowstate_activate_notion_task_v1\s*\(/,
      )
      expect(sql).toContain('public.canonical_operations')
      expect(sql).toContain('public.canonical_operation_previews')
      expect(sql).toContain('public.canonical_change_log')
      expect(sql).not.toMatch(
        /create table[^;]*(?:notion|activation)[^;]*(?:receipt|operation)/,
      )
      expect(sql).toMatch(/'contractversion'\s*,\s*'notion-activation-v1'/)
      expect(sql).toMatch(/'source'\s*,\s*'notion'/)
      expect(sql).toMatch(/'entitytype'\s*,\s*'task'/)
      expect(sql).toMatch(/'action'\s*,\s*'activate'/)
    })

    it('binds durable preview/apply and checks committed replay before expiry', () => {
      const sql = migrationSource()
      const committedReplay = sql.indexOf("v_existing.state = 'committed'")
      const expiryCheck = sql.indexOf('v_issued_preview.expires_at <=')

      expect(sql).toMatch(/pg_advisory_xact_lock\s*\(/)
      expect(sql).toMatch(/extensions\.gen_random_bytes\s*\(/)
      expect(sql).toMatch(/request_hash/)
      expect(committedReplay).toBeGreaterThan(-1)
      expect(expiryCheck).toBeGreaterThan(committedReplay)
    })

    it('validates JSON field types inside the security-definer boundary', () => {
      const sql = migrationSource()

      expect(sql).toMatch(/jsonb_typeof\(p_notion->'pageid'\)\s*<>\s*'string'/)
      expect(sql).toMatch(/jsonb_typeof\(p_task->'title'\)\s*<>\s*'string'/)
      expect(sql).toMatch(
        /jsonb_typeof\(p_work_block->'duration'\)\s*<>\s*'number'/,
      )
    })

    it('creates or reuses one provenance task and atomically appends an exact work block', () => {
      const sql = migrationSource()

      expect(sql).toMatch(/external_source\s*=\s*'notion'/)
      expect(sql).toMatch(/external_id\s*=\s*v_page_id/)
      expect(sql).toMatch(/insert into public\.tasks/)
      expect(sql).toMatch(
        /instances\s*=\s*case[^;]+coalesce\([^;]+\)\s*\|\|\s*pg_catalog\.jsonb_build_array/,
      )
      expect(sql).toMatch(/v_work_block/)
      expect(sql).toMatch(
        /pg_catalog\.set_config\s*\(\s*'flowstate\.canonical\.operation_id'/,
      )
    })

    it('does not append a duplicate exact work block under another operation', () => {
      const sql = migrationSource()

      expect(sql).toMatch(
        /jsonb_array_elements\([^;]+instances[^;]+scheduleddate[^;]+scheduledtime[^;]+duration/,
      )
      expect(sql).toMatch(/v_work_block_exists/)
    })

    it('returns a complete canonical receipt and keeps direct ledger writes revoked', () => {
      const sql = migrationSource()

      for (const field of [
        'canonicalrevision',
        'canonicalupdatedat',
        'changesequence',
        'committedat',
        'replayed',
        'readback',
        'readbackhash',
      ]) {
        expect(sql).toMatch(new RegExp(`'${field}'\\s*,`))
      }
      expect(sql).toMatch(
        /flowstate_canonical_json_text_v1\s*\(\s*v_read_back\s*\)/,
      )
      for (const table of [
        'canonical_operations',
        'canonical_operation_previews',
        'canonical_change_log',
      ]) {
        expect(sql).toMatch(
          new RegExp(
            `revoke (?:all|insert|update|delete)[^;]+public\\.${table}[^;]+authenticated`,
          ),
        )
      }
      expect(sql).toMatch(
        /revoke all on function public\.flowstate_activate_notion_task_v1[^;]+from anon/,
      )
      expect(sql).toMatch(
        /grant execute on function public\.flowstate_activate_notion_task_v1[^;]+to authenticated/,
      )
    })
  })
})
