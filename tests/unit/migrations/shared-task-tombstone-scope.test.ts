import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// @vitest-environment node

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260922120000_shared_task_tombstone_scope_rpc.sql'),
  'utf8'
)

describe('shared-task tombstone scope RPC migration', () => {
  it('checks only an exact task id and returns no tombstone owner data', () => {
    expect(migration).toContain('flowstate_has_task_tombstone(p_task_id text)')
    expect(migration).toContain("tombstone.entity_type = 'task'")
    expect(migration).toContain('tombstone.entity_id = p_task_id')
    expect(migration).toContain('RETURN EXISTS')
    expect(migration).not.toContain('RETURNS TABLE')
  })

  it('fails closed for unauthenticated or empty scope and grants only authenticated execution', () => {
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain("SET search_path = ''")
    expect(migration).toContain('auth.uid() IS NULL')
    expect(migration).toContain("FROM PUBLIC, anon")
    expect(migration).toContain('TO authenticated')
    expect(migration).toContain('tombstone.user_id = (SELECT auth.uid())')
    expect(migration).toContain("tombstone.scope_kind = 'workspace'")
    expect(migration).toContain('public.flowstate_can_read_workspace_v1(tombstone.workspace_id)')
  })

  it('notifies PostgREST to expose the new RPC immediately', () => {
    expect(migration).toContain("NOTIFY pgrst, 'reload schema'")
  })
})
