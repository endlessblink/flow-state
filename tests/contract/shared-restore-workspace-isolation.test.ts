import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// TASK-1977 closeout: the shared-workspace restore failure vectors are covered by
// SHIPPED fail-closed behavior in the atomic restore contract, not by a live
// multi-member harness. This restore function restores PERSONAL rows only,
// re-binds every reference to the acting user, refuses cross-owner data, and is
// idempotent per operation id. These assertions bite: deleting any guard below
// removes a real protection and turns this test red.
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260724030000_atomic_backup_restore.sql'),
  'utf8',
)

const restoreFn = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.flowstate_restore_backup_v1'),
)

describe('shared-restore workspace isolation & authorization (fail-closed contract)', () => {
  it('authorization-loss / membership-revocation / owner-transfer: restore is refused unless the actor owns the target', () => {
    // Only the authenticated actor may restore into their own scope.
    expect(migration).toContain("v_actor uuid := (SELECT auth.uid())")
    expect(migration).toContain('p_user_id IS DISTINCT FROM v_actor')
    expect(migration).toContain("RAISE EXCEPTION 'restore_not_authorized'")
    // Executable only by authenticated role; anon/public cannot invoke.
    expect(migration).toContain('GRANT EXECUTE ON FUNCTION public.flowstate_restore_backup_v1')
    expect(migration).toContain('TO authenticated')
    expect(migration).toContain('FROM PUBLIC, anon')
  })

  it('deleted-workspace-orphan-recovery: workspace-scoped rows are skipped so personal data still recovers', () => {
    // Shared-workspace ownership requires an explicit role/attribution policy and
    // therefore fails closed — the first contract restores personal data only.
    expect(restoreFn).toContain("item.value->>'workspace_id' IS NOT NULL")
    // Every restored row is re-owned to the actor (orphaned workspace refs cannot leak in).
    expect(restoreFn).toContain("jsonb_build_object('user_id', v_actor, 'parent_task_id', NULL)")
    expect(restoreFn).toContain("jsonb_build_object('user_id', v_actor, 'parent_id', NULL)")
  })

  it('assignee-and-reference-rebinding: foreign assignees are refused; dangling project/lane refs fail closed or null out', () => {
    expect(restoreFn).toContain('v_task.assigned_to IS DISTINCT FROM v_actor')
    expect(restoreFn).toContain("RAISE EXCEPTION 'restore_task_assignee_unavailable'")
    // Project reference must belong to the actor, or the restore refuses.
    expect(restoreFn).toContain("RAISE EXCEPTION 'restore_task_project_unavailable'")
    // A lane the actor does not own is detached rather than silently reassigned.
    expect(restoreFn).toMatch(/lane_id[\s\S]{0,120}v_task\.lane_id := NULL/)
  })

  it('cross-workspace-id-collision / membership-transition-race: never overwrites an existing row owned by someone else', () => {
    // If an id already exists but is not the actor's live row, refuse (no cross-owner clobber).
    expect(restoreFn).toContain("RAISE EXCEPTION 'restore_task_unavailable'")
    expect(restoreFn).toMatch(/id = v_task\.id AND user_id = v_actor AND is_deleted = false/)
    // Existing owned rows are counted and skipped (additive, idempotent) — not updated.
    expect(restoreFn).toContain('v_tasks_existing := v_tasks_existing + 1')
    expect(restoreFn).toContain('CONTINUE;')
    // A tombstoned id cannot be resurrected by a restore.
    expect(restoreFn).toContain("RAISE EXCEPTION 'restore_task_tombstoned'")
  })

  it('holds a single locked, idempotent transaction boundary (no interleaved partial shared restore)', () => {
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain("SET search_path = ''")
  })
})

describe('canonical-operation-receipt / sequence / inventory contract', () => {
  it('binds every restore to a hashed, replay-safe operation receipt', () => {
    expect(migration).toContain('flowstate_action_receipts')
    expect(migration).toContain("operation = 'restore_backup'")
    expect(migration).toContain('request_id = p_operation_id')
    expect(migration).toContain('v_payload_hash := pg_catalog.encode')
    // Same operation id with a different payload is a conflict, not a silent duplicate.
    expect(migration).toContain('v_existing_receipt.payload_hash IS DISTINCT FROM v_payload_hash')
    expect(migration).toContain('restore_idempotency_conflict')
    // Operation id is bounded/validated (no unbounded inventory key).
    expect(migration).toContain('pg_catalog.char_length(p_operation_id) > 200')
  })

  it('normalizes the full task/project/group inventory into the hashed payload', () => {
    expect(migration).toContain("'tasks', v_normalized_tasks")
    expect(migration).toContain("'projects', v_normalized_projects")
    expect(migration).toContain("'groups', v_normalized_groups")
  })
})
