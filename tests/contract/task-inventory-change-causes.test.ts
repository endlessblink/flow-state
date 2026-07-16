import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260716040000_task_inventory_change_causes.sql',
)

describe('TASK-1967 task inventory canonical cause contract', () => {
  it('ships a bounded authenticated cause reader without exposing event payloads', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase().replace(/\s+/g, ' ')

    expect(sql).toMatch(/flowstate_task_change_causes_v1\s*\(/)
    expect(sql).toContain('security definer')
    expect(sql).toContain("set search_path = ''")
    expect(sql).toContain('auth.uid()')
    expect(sql).toMatch(/auth\.role\(\)\)?\s*=\s*'service_role'/)
    expect(sql).toMatch(/array_length\([^)]*task_ids[^)]*\)/)
    expect(sql).toMatch(/v_count not between 1 and 100/)
    expect(sql).toMatch(/count\s*\(\s*distinct[^)]*task_id/)
    expect(sql).toContain('change_sequence <= p_at_sequence')
    expect(sql).toMatch(/distinct on\s*\(\s*change\.entity_id\s*\)/)
    expect(sql).toContain('public.flowstate_can_read_workspace_v1')
    expect(sql).toMatch(/revoke all on function public\.flowstate_task_change_causes_v1[^;]+from public/)
    expect(sql).toMatch(/grant execute on function public\.flowstate_task_change_causes_v1[^;]+to authenticated/)
    expect(sql).toMatch(/to authenticated, service_role/)
    expect(sql).not.toMatch(/returns table\s*\([^)]*(actor_user_id|projection|operation_context|request_hash)/)
  })
})
