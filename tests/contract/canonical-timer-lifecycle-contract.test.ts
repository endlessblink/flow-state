import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  resolve(__dirname, '../../supabase/migrations/20260721130000_canonical_timer_lifecycle.sql'),
  'utf8',
).toLowerCase()

describe('canonical timer lifecycle database contract', () => {
  it('adds a semantic revision and enforces one active timer per user', () => {
    expect(sql).toContain('add column if not exists canonical_revision')
    expect(sql).toContain('create unique index if not exists timer_sessions_one_active_per_user_idx')
    expect(sql).toContain('where is_active = true')
    expect(sql).toContain('flowstate_increment_timer_revision_v1')
  })

  it('exposes one signed-user transaction for start, pause, resume, and stop', () => {
    expect(sql).toContain('function public.flowstate_timer_lifecycle_v1')
    for (const action of ['start', 'pause', 'resume', 'stop']) {
      expect(sql).toContain(`'${action}'`)
    }
    expect(sql).toContain('select auth.uid()')
    expect(sql).toContain('for update')
    expect(sql).toContain('pg_advisory_xact_lock')
  })

  it('binds preview, request identity, revision, and durable receipt before applying', () => {
    expect(sql).toContain('canonical_operation_previews')
    expect(sql).toContain('canonical_operations')
    expect(sql).toContain('canonical_change_log')
    expect(sql).toContain('idempotency_conflict')
    expect(sql).toContain('preview_mismatch')
    expect(sql).toContain('preview_expired')
    expect(sql).toContain('stale_revision')
    expect(sql).toContain('request_hash')
    expect(sql).toContain('readbackhash')
    expect(sql).toContain('flowstate_canonical_json_text_v1')
  })

  it('materializes companion-only elapsed time and retires expired active rows', () => {
    expect(sql).toContain('v_effective_remaining')
    expect(sql).toContain('device_leader_last_seen, v_session.updated_at, v_session.start_time')
    expect(sql).toContain('set remaining_time = 0')
    expect(sql).toContain('is_active = false')
    expect(sql).toContain('set remaining_time = v_effective_remaining')
    expect(sql).toContain("'timer has already expired'")
  })

  it('never grants timer authority through a service role or anonymous caller', () => {
    expect(sql).toContain('not_authenticated')
    expect(sql).toContain('revoke all on function public.flowstate_timer_lifecycle_v1')
    expect(sql).toContain('grant execute on function public.flowstate_timer_lifecycle_v1')
    expect(sql).toContain('to authenticated')
    expect(sql).not.toContain('to service_role')
  })
})
