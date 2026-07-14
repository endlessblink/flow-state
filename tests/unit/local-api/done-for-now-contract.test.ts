import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const readOptionalSource = (path: string) => {
  const absolute = resolve(process.cwd(), path)
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : ''
}

const server = readSource('server/local-api/server.cjs')
const storeOperations = readSource('src/stores/tasks/taskOperations.ts')
const service = readOptionalSource('src/services/tasks/doneForNow.ts')
const migration = readOptionalSource('supabase/migrations/20260713190000_done_for_now_operation.sql')

describe('TASK-1532 recurring Done for now shared operation', () => {
  it('exposes one preview-first Local API route with state-bound apply', () => {
    expect(server).toContain("path.match(/^\\/api\\/tasks\\/([^/]+)\\/done-for-now$/)")
    expect(server).toContain('handleDoneForNow')
    expect(server).toContain('body.preview !== false')
    expect(server).toContain("error: 'requestId required when preview is false'")
    expect(server).toContain("error: 'previewVersion required when preview is false'")
  })

  it('routes both renderer and Local API through the same transactional RPC', () => {
    expect(service).toContain(".rpc('done_for_now_task'")
    expect(server).toContain(".rpc('done_for_now_task'")
    expect(storeOperations).toContain('applyDoneForNow')
    expect(storeOperations).not.toContain('const completionRecord: Partial<Task>')
  })

  it('keeps preview read-only and apply atomic with durable idempotency receipts', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.done_for_now_receipts')
    expect(migration).toContain('PRIMARY KEY (user_id, request_id)')
    expect(migration).toContain('FOR UPDATE')
    expect(migration).toContain('IF p_preview THEN')
    expect(migration).toContain('INSERT INTO public.done_for_now_receipts')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('idempotency_conflict')
    expect(migration).toContain('stale_preview')
  })

  it('records the actual overdue occurrence and preserves coherent next work blocks', () => {
    expect(migration).toContain("'due_date', v_current_due_date")
    expect(migration).toContain("item->>'scheduledDate' = v_current_due_date::text")
    expect(migration).toContain('v_next_instances')
    expect(migration).toContain('jsonb_array_length(v_matching_instances) > 0')
    expect(migration).toContain('recurrence_rule = v_task.recurrence_rule')
  })

  it('returns real history and living-task identifiers for read-back verification', () => {
    expect(migration).toContain("'completedOccurrenceId', v_completion_id")
    expect(migration).toContain("'taskId', v_task.id")
    expect(migration).toContain("'nextDueDate', v_next_due_date")
    expect(server).toContain("notifyTaskMutation('update', id)")
  })

  it('keeps explicit next-date selection inside the same recurrence transaction', () => {
    const contextMenu = readSource('src/components/tasks/TaskContextMenu.vue')
    expect(contextMenu).toContain('doneForNow(taskId, { nextDueDate: dateStr })')
    expect(contextMenu).not.toContain("await taskStore.updateTask(taskId, { dueDate: dateStr })")
  })
})
