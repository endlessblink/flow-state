import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const server = readFileSync(resolve(process.cwd(), 'server/local-api/server.cjs'), 'utf8')
const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260713200000_merge_tasks_operation.sql'),
  'utf8',
)

describe('safe duplicate task merge contract', () => {
  it('exposes preview-first merge through the signed-in Local API', () => {
    expect(server).toContain("path.match(/^\\/api\\/tasks\\/([^/]+)\\/merge$/)")
    expect(server).toContain('async function handleMergeTasks')
    expect(server).toContain("supabase.rpc('merge_tasks'")
    expect(server).toContain("const preview = body.preview !== false")
    expect(server).toContain("notifyTaskMutation('update', survivorTaskId)")
    expect(server).toContain("notifyTaskMutation('delete', duplicateTaskId)")
  })

  it('binds apply to a durable request receipt and exact preview state', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.merge_task_receipts')
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.merge_tasks')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain("'idempotency_conflict'")
    expect(migration).toContain("'preview_version_required'")
    expect(migration).toContain("'stale_preview'")
  })

  it('refuses unsafe recurrence and conflicting state instead of guessing', () => {
    expect(migration).toContain("'recurring_merge_unsupported'")
    expect(migration).toContain("'merge_conflict'")
    expect(migration).toContain("'same_task'")
    expect(migration).toContain("'workspace_mismatch'")
  })

  it('transfers supported relationships before soft-deleting the duplicate', () => {
    expect(migration).toContain('UPDATE public.task_comments')
    expect(migration).toContain('UPDATE public.project_task_links')
    expect(migration).toContain('UPDATE public.task_contexts')
    expect(migration).not.toContain('UPDATE public.pomodoro_history')
    expect(migration).not.toContain('UPDATE public.ai_recommendation_feedback')
    expect(migration).toContain('UPDATE public.tasks')
    expect(migration).toContain('is_deleted = true')
    expect(migration).toContain("'duplicateArchived', true")
  })
})
