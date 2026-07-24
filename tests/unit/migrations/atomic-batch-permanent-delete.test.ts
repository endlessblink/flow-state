import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260724060000_atomic_batch_permanent_delete.sql'),
  'utf8'
)

describe('atomic batch permanent delete migration', () => {
  it('locks and validates the complete visible selection before deleting', () => {
    expect(migration).toContain('p_task_ids text[]')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('v_visible_count IS DISTINCT FROM v_requested_count')
    expect(migration).toContain('v_deleted_ids')
    expect(migration).toContain('cardinality(v_deleted_ids) IS DISTINCT FROM v_requested_count')
    expect(migration).toContain("ERRCODE = '42501'")
  })

  it('clears recurrence chains and hard deletes inside the same transaction', () => {
    expect(migration).toContain('FILTER (WHERE task.recurrence_rule IS NOT NULL)')
    expect(migration).toContain('SET recurrence_rule = NULL')
    expect(migration).toContain('recurrence_parent_id = ANY(v_chain_ids)')
    expect(migration).toContain('DELETE FROM public.tasks')
    expect(migration).toContain('RETURNING id')
  })

  it('is caller-scoped, idempotent, and unavailable to anonymous clients', () => {
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain('p_user_id IS DISTINCT FROM v_actor')
    expect(migration).toContain("operation = 'permanently_delete_tasks'")
    expect(migration).toContain('v_existing_receipt.receipt')
    expect(migration).toContain('FROM PUBLIC, anon')
    expect(migration).toContain('TO authenticated')
  })
})
