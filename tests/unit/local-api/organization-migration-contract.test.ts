import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/20260716030000_canonical_organization_commands.sql'
const sqlTestPath = 'scripts/db/test-canonical-organization-commands.sql'

describe('canonical organization migration contract', () => {
  it('defines one scope-safe preview/apply RPC on the shared receipt substrate', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.flowstate_organization_task_v1(')
    expect(sql).toContain("p_action NOT IN ('assign_project', 'set_canvas_group')")
    expect(sql).toContain('public.flowstate_can_write_workspace_v1(p_workspace_id)')
    expect(sql).toContain('public.canonical_operation_previews')
    expect(sql).toContain('public.canonical_operations')
    expect(sql).toContain('public.flowstate_h3_finalize_receipt(')
    expect(sql).toContain('public.flowstate_h3_link_task_changes(')
    expect(sql).toContain('FOR UPDATE')
  })

  it('requires complete Canvas geometry, leaves coordinates intact, and exits Inbox', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toMatch(/pg_catalog\.jsonb_set\(\s*v_task\.position,\s*'\{parentId\}'/)
    expect(sql).toContain("pg_catalog.jsonb_typeof(v_task.position -> 'x') IS DISTINCT FROM 'number'")
    expect(sql).toContain("pg_catalog.jsonb_typeof(v_task.position -> 'y') IS DISTINCT FROM 'number'")
    expect(sql).toContain('is_in_inbox = false')
    expect(sql).toContain("'isInInbox', task.is_in_inbox")
    expect(sql).toContain("'unsupported_smart_group'")
    expect(sql).toContain('v_group.is_power_mode')
    expect(sql).toContain("v_group.type IS DISTINCT FROM 'custom'")
    expect(sql).toContain('v_group.filters_json IS NOT NULL')
    expect(sql).toContain('v_group.power_keyword_json IS NOT NULL')
    expect(sql).toContain('v_group.assign_on_drop_json IS NOT NULL')
    expect(sql).toContain('v_group.collect_filter_json IS NOT NULL')
    expect(sql).toContain('v_group.auto_collect')
    expect(sql).toContain("'invalid_task_position'")
    expect(sql).toContain("pg_catalog.jsonb_typeof(v_task.position) IS DISTINCT FROM 'object'")
  })

  it('ships a rollback-only disposable behavioral contract', () => {
    expect(existsSync(sqlTestPath)).toBe(true)
    const sql = readFileSync(sqlTestPath, 'utf8')

    expect(sql).toContain('BEGIN;')
    expect(sql).toContain('ROLLBACK;')
    expect(sql).toContain('preview was not zero-write')
    expect(sql).toContain('unrelated position metadata was lost')
    expect(sql).toContain('durable replay')
    expect(sql).toContain('cross-scope')
    expect(sql).toContain('deleted project')
    expect(sql).toContain('smart group')
    expect(sql).toContain('authorized workspace mutation')
    expect(sql).toContain('workspace viewer')
    expect(sql).toContain('null Canvas position')
    expect(sql).toContain('forged organization source')
  })

  it('accepts only the trusted Local API provenance source', () => {
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain("p_source IS DISTINCT FROM 'local-api'")
    expect(sql).not.toContain("p_source !~ '^[a-z0-9][a-z0-9._:-]{0,63}$'")
  })
})
