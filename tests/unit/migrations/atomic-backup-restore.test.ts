import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(
    process.cwd(),
    'supabase/migrations/20260724030000_atomic_backup_restore.sql',
  ),
  'utf8',
)

describe('atomic backup restore migration contract', () => {
  it('uses one authenticated, locked, idempotent transaction boundary', () => {
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain("SET search_path = ''")
    expect(migration).toContain('p_user_id IS DISTINCT FROM v_actor')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain("operation = 'restore_backup'")
    expect(migration).toContain('restore_idempotency_conflict')
    expect(migration).toContain('v_payload_hash := pg_catalog.encode')
    expect(migration).toContain("'tasks', v_normalized_tasks")
    expect(migration).toContain("'projects', v_normalized_projects")
    expect(migration).toContain("'groups', v_normalized_groups")
    expect(migration).toContain("'tombstones', p_tombstones")
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.flowstate_restore_backup_v1")
    expect(migration).toContain('TO authenticated')
    expect(migration).toContain('FROM PUBLIC, anon')
  })

  it('is additive and never overwrites active task, project, or group truth', () => {
    expect(migration).not.toMatch(/ON CONFLICT[^;]+DO UPDATE/is)
    expect(migration.match(/UPDATE public\.tasks/g)).toHaveLength(1)
    expect(migration.match(/UPDATE public\.projects/g)).toHaveLength(1)
    expect(migration.match(/UPDATE public\.groups/g)).toHaveLength(1)
    expect(migration).toMatch(/UPDATE public\.tasks\s+SET parent_task_id/)
    expect(migration).toMatch(/UPDATE public\.projects\s+SET parent_id/)
    expect(migration).toMatch(/UPDATE public\.groups\s+SET parent_group_id/)
    expect(migration).toContain('v_tasks_existing := v_tasks_existing + 1')
    expect(migration).toContain('v_projects_existing := v_projects_existing + 1')
    expect(migration).toContain('v_groups_existing := v_groups_existing + 1')
  })

  it('inserts dependencies first and permanent-deletion markers last', () => {
    const projectInsert = migration.indexOf('INSERT INTO public.projects')
    const taskInsert = migration.indexOf('INSERT INTO public.tasks')
    const groupInsert = migration.indexOf('INSERT INTO public.groups')
    const tombstoneInsert = migration.indexOf('INSERT INTO public.tombstones')
    const receiptInsert = migration.indexOf('INSERT INTO public.flowstate_action_receipts')

    expect(projectInsert).toBeGreaterThan(-1)
    expect(taskInsert).toBeGreaterThan(projectInsert)
    expect(groupInsert).toBeGreaterThan(taskInsert)
    expect(tombstoneInsert).toBeGreaterThan(groupInsert)
    expect(receiptInsert).toBeGreaterThan(tombstoneInsert)
    expect(migration).toContain('restore_tombstone_contradicts_live_entity')
  })

  it('fails closed for shared workspace ownership until an explicit policy exists', () => {
    expect(migration).toContain('restore_workspace_scope_requires_explicit_policy')
    expect(migration).toContain("item.value->>'workspace_id' IS NOT NULL")
  })

  it('rejects personal-task references outside the authenticated owner scope', () => {
    expect(migration).toContain('restore_task_project_unavailable')
    expect(migration).toContain('restore_task_assignee_unavailable')
    expect(migration).toMatch(
      /v_task\.project_id IS NOT NULL[\s\S]+public\.projects[\s\S]+user_id = v_actor/,
    )
    expect(migration).toMatch(
      /v_task\.lane_id IS NOT NULL[\s\S]+public\.lanes[\s\S]+user_id = v_actor/,
    )
    expect(migration).toMatch(
      /IF v_task\.lane_id IS NOT NULL[\s\S]+THEN\s+v_task\.lane_id := NULL;/,
    )
    expect(migration).toContain(
      'v_task.assigned_to IS NOT NULL AND v_task.assigned_to IS DISTINCT FROM v_actor',
    )
  })
})
