import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260715050000_canonical_subtask_batch.sql',
)

describe('TASK-1963 canonical subtask migration contract', () => {
  it('ships one signed-user revision-bound preview and apply RPC', () => {
    expect(existsSync(migrationPath)).toBe(true)
    const sql = readFileSync(migrationPath, 'utf8')

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.flowstate_subtask_batch_v1(')
    expect(sql).toContain('p_operation_id text')
    expect(sql).toContain('p_base_revision bigint')
    expect(sql).toContain('p_preview_digest text DEFAULT NULL')
    expect(sql).toContain('p_request_hash text DEFAULT NULL')
    expect(sql).toContain('FOR UPDATE')
    expect(sql).toContain("'code', 'stale_revision'")
    expect(sql).toContain("'code', 'invalid_existing_subtasks'")
    expect(sql).toContain("'code', 'client_id_conflict'")
    expect(sql).toContain("'code', 'subtask_id_conflict'")
    expect(sql).toContain("'code', 'subtask_limit_exceeded'")
    expect(sql).toContain('pg_catalog.jsonb_array_length(v_result_subtasks) > 10001')
    expect(sql).toContain('v_execution_operations jsonb')
    expect(sql).toContain("'operations', v_normalized_operations")
    expect(sql).toContain('flowstate_h5_canonicalize_legacy_subtasks')
    expect(sql).toContain("'currentRevision', v_current_revision")
    expect(sql).toContain("'normalizedPayload'")
    expect(sql).toContain("'previewExpiresAt'")
    expect(sql).toContain('public.flowstate_h3_finalize_receipt(')
    expect(sql).toContain('public.flowstate_h3_task_read_back(')
    expect(sql).not.toContain('public.flowstate_h4_task_read_back(')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.flowstate_subtask_batch_v1(')
    expect(sql).toContain('TO authenticated')
  })
})
