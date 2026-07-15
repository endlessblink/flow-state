import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260716010000_canonical_recurrence_lifecycle.sql'
const sqlTestPath = 'scripts/db/test-recurrence-lifecycle-rpc.sql'

describe('canonical recurrence migration scope contract', () => {
  it('scopes every series scan to the exact actor and workspace', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql.match(/task\.workspace_id IS NOT DISTINCT FROM p_workspace_id/g)?.length).toBeGreaterThanOrEqual(5)
    expect(sql.match(/p_workspace_id IS NULL AND task\.user_id=v_actor/g)?.length).toBeGreaterThanOrEqual(4)
  })

  it('revalidates actor and workspace after locking the current occurrence', () => {
    const sql = readFileSync(migrationPath, 'utf8')
    const helper = sql.slice(
      sql.indexOf('CREATE OR REPLACE FUNCTION public.flowstate_h7_mutate_series('),
      sql.indexOf('CREATE OR REPLACE FUNCTION public.flowstate_recurrence_lifecycle_v1('),
    )

    expect(helper).toContain('FOR UPDATE')
    expect(helper).toContain('v_current.workspace_id IS DISTINCT FROM p_workspace_id')
    expect(helper).toContain('v_current.user_id IS DISTINCT FROM p_actor')
    expect(helper).toContain("MESSAGE='scope_denied'")
  })

  it('ships cross-user, cross-workspace, and post-lock rollback probes', () => {
    const sql = readFileSync(sqlTestPath, 'utf8')

    expect(sql).toContain('cross-user recurrence contamination')
    expect(sql).toContain('cross-workspace recurrence contamination')
    expect(sql).toContain('recurrence apply scope move-race did not roll back')
  })
})
