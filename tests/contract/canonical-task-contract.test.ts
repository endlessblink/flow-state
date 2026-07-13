import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260713012000_canonical_task_contract.sql',
)
const migrationExists = existsSync(migrationPath)

function migrationSource(): string {
  return readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ')
}

describe('TASK-1944 canonical task mutation contract', () => {
  it('ships the canonical task contract as an ordered migration', () => {
    expect(migrationExists).toBe(true)
  })

  describe.skipIf(!migrationExists)('migration invariants', () => {
    it('gives tasks an independent canonical revision', () => {
      const sql = migrationSource()

      expect(sql).toMatch(
        /alter table public\.tasks add column if not exists canonical_revision bigint not null default 1/,
      )
      expect(sql).not.toMatch(/canonical_revision[^;]*position_version/)
    })

    it('persists idempotent operations and a durable global change sequence', () => {
      const sql = migrationSource()

      expect(sql).toContain('create table if not exists public.canonical_operations')
      expect(sql).toContain('create table if not exists public.canonical_operation_previews')
      expect(sql).toContain('create table if not exists public.canonical_change_log')
      expect(sql).toMatch(/unique\s*\(\s*user_id\s*,\s*operation_id\s*\)/)
      expect(sql).toMatch(/request_hash\s+text\s+not null/)
      expect(sql).toMatch(/canonical_result\s+jsonb/)
      expect(sql).toMatch(/create sequence(?: if not exists)? public\.change_sequence/)
      expect(sql).toMatch(
        /change_sequence\s+bigint\s+not null\s+default\s+nextval\('\s*public\.change_sequence'(?:::regclass)?\)/,
      )
      expect(sql).toMatch(
        /change_sequence\s+bigint\s+not null\s+default[^,;]+\bunique\b|unique\s*\(\s*change_sequence\s*\)/,
      )
    })

    it('enforces user-scoped RLS on both canonical ledgers', () => {
      const sql = migrationSource()

      for (const table of ['canonical_operations', 'canonical_change_log']) {
        expect(sql).toContain(`alter table public.${table} enable row level security`)
        expect(sql).toMatch(new RegExp(`create policy[^;]+on public\\.${table}[^;]+for select`))
      }

      expect(sql).toMatch(
        /create or replace function public\.flowstate_can_write_workspace_v1\s*\([^)]*workspace_id[^)]*\)/,
      )
      expect(sql).toMatch(/workspace_members[^;]+role\s+in\s*\(\s*'owner'\s*,\s*'admin'\s*,\s*'member'\s*\)/)
      expect(sql).not.toMatch(/role\s+in\s*\([^)]*'viewer'/)
      expect(sql).toMatch(
        /create policy[^;]+on public\.tasks[^;]+(?:for (?:insert|update)|with check)[^;]+public\.flowstate_can_write_workspace_v1\s*\(/,
      )
      expect(sql).toMatch(/create or replace function public\.[a-z_]*task[a-z_]*scope[a-z_]*\s*\(/)
      expect(sql).toMatch(/new\.user_id\s+is distinct from\s+old\.user_id/)
      expect(sql).toMatch(/new\.workspace_id\s+is distinct from\s+old\.workspace_id/)
      expect(sql).toMatch(/workspace_id is null[^;]+auth\.uid\(\)[^;]+user_id/)
    })

    it('keeps the patch RPC signed-user scoped and locked down', () => {
      const sql = migrationSource()

      expect(sql).toMatch(/create or replace function public\.flowstate_patch_task_v1\s*\(/)
      expect(sql).toMatch(/security definer/)
      expect(sql).toMatch(/set search_path\s*=\s*''/)
      expect(sql).toContain('auth.uid()')
      expect(sql).toMatch(/public\.flowstate_can_write_workspace_v1\s*\(/)
      expect(sql).toMatch(/p_preview\s+is\s+null/)
      expect(sql).toMatch(/extensions\.gen_random_bytes\s*\(/)
      expect(sql).toMatch(/pg_advisory_xact_lock\s*\(/)
      expect(sql).toMatch(/from public\.canonical_operation_previews[^;]+user_id\s*=\s*v_actor/)
      expect(sql).not.toMatch(/on conflict\s*\(\s*user_id\s*,\s*operation_id\s*\)\s*do update[^;]+canonical_operation_previews/)
      expect(sql).toMatch(/(?:v_task|task)\.is_deleted\s*=\s*false/)
      expect(sql).toMatch(/p_source\s+is\s+null/)
      expect(sql).toMatch(/revoke all on function public\.flowstate_patch_task_v1[^;]+from public/)
      expect(sql).toMatch(/revoke all on function public\.flowstate_patch_task_v1[^;]+from anon/)
      expect(sql).toMatch(
        /grant execute on function public\.flowstate_patch_task_v1[^;]+to authenticated/,
      )
      expect(sql).not.toMatch(/grant execute[^;]+to anon/)
    })

    it('binds apply to an idempotent preview and returns verifiable read-back receipts', () => {
      const sql = migrationSource()

      expect(sql).toContain('preview_digest')
      expect(sql).toMatch(/digest\s*\(/)
      expect(sql).toContain('base_revision')
      expect(sql).toContain('contract_version')
      expect(sql).toMatch(/insert into public\.canonical_operations\s*\([^;]+request_hash[^;]+\)/)
      expect(sql).toMatch(/update public\.canonical_operations[^;]+canonical_result\s*=/)
      expect(sql).toMatch(/'replayed'\s*,/)
      expect(sql).toMatch(/'readback'\s*,/)
      expect(sql).toMatch(/'readbackhash'\s*,/)
      expect(sql).toMatch(/'canonicalrevision'\s*,/)
      expect(sql).toMatch(/'changesequence'\s*,/)
      expect(sql).not.toMatch(/'queued'\s*,/)
    })

    it('separates compatibility revision and change-log triggers', () => {
      const sql = migrationSource()

      expect(sql).toMatch(/create or replace function public\.[a-z_]*task[a-z_]*revision[a-z_]*\s*\(/)
      expect(sql).toMatch(/canonical_revision\s*:?=\s*old\.canonical_revision\s*\+\s*1/)
      expect(sql).toMatch(/create trigger [a-z_]*task[a-z_]*revision[a-z_]*/)
      expect(sql).toMatch(/before (?:insert or update|update or insert)[^;]+on public\.tasks/)

      expect(sql).toMatch(/create or replace function public\.[a-z_]*task[a-z_]*change[a-z_]*\s*\(/)
      expect(sql).toMatch(/insert into public\.canonical_change_log/)
      expect(sql).toMatch(/'isdeleted'\s*,\s*tg_op\s*=\s*'delete'\s+or\s+coalesce\(v_row\.is_deleted,\s*false\)/)
      expect(sql).toMatch(/current_setting\([^)]*canonical[^)]*operation[^)]*true[^)]*\)/)
      expect(sql).toMatch(/from public\.canonical_operations[^;]+state\s*=\s*'applying'/)
      expect(sql).toMatch(/(?:v_source|source)\s*:=\s*'legacy'/)
      expect(sql).not.toMatch(/current_setting\([^)]*canonical[^)]*source/)
      expect(sql).toMatch(/create trigger [a-z_]*task[a-z_]*change[a-z_]*/)
      expect(sql).toMatch(/after (?:insert or update|update or insert)[^;]+on public\.tasks/)
    })
  })
})
