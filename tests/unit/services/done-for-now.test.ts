import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/services/auth/supabase', () => ({ supabase: { rpc } }))

import {
  applyDoneForNow,
  DoneForNowError,
  previewDoneForNow,
} from '@/services/tasks/doneForNow'

const row = (overrides: Record<string, unknown>) => ({
  id: 'task-1',
  user_id: 'user-1',
  title: 'Recurring fixture',
  description: '',
  status: 'planned',
  priority: 'high',
  progress: 0,
  project_id: null,
  due_date: '2026-07-16T00:00:00+00:00',
  subtasks: [],
  instances: [],
  recurring_instances: [],
  is_in_inbox: true,
  is_deleted: false,
  is_completion_record: false,
  created_at: '2026-07-01T00:00:00+00:00',
  updated_at: '2026-07-13T00:00:00+00:00',
  ...overrides,
})

describe('Done for now domain service', () => {
  beforeEach(() => rpc.mockReset())

  it('previews without apply-only identifiers', async () => {
    rpc.mockResolvedValue({
      error: null,
      data: {
        ok: true,
        preview: true,
        requestId: null,
        previewVersion: 'state-v1',
        task: { id: 'task-1', title: 'Recurring fixture' },
        currentOccurrence: { occurrenceKey: 'task-1:0', dueDate: '2026-07-12', statusBefore: 'todo', statusAfter: 'done' },
        recurrence: { nextDueDateBefore: '2026-07-13', nextDueDateAfter: '2026-07-16', cadencePreserved: true, overrideApplied: true },
        willWrite: ['completion history'],
      },
    })

    const result = await previewDoneForNow('task-1', '2026-07-16')

    expect(result.preview).toBe(true)
    expect(result.previewVersion).toBe('state-v1')
    expect(rpc).toHaveBeenCalledWith('done_for_now_task', {
      p_task_id: 'task-1',
      p_preview: true,
      p_request_id: null,
      p_preview_version: null,
      p_next_due_date: '2026-07-16',
    })
  })

  it('applies the state-bound request and maps exact database rows for the UI', async () => {
    rpc.mockResolvedValue({
      error: null,
      data: {
        ok: true,
        preview: false,
        requestId: 'request-1',
        previewVersion: 'state-v1',
        receipt: {
          requestId: 'request-1', taskId: 'task-1', completedOccurrenceId: 'history-1',
          completedOccurrenceKey: 'task-1:0', nextOccurrenceId: 'task-1', nextOccurrenceKey: 'task-1:1',
        },
        readBack: {
          taskId: 'task-1',
          completedOccurrence: { id: 'history-1', status: 'done', dueDate: '2026-07-12' },
          nextOccurrence: { id: 'task-1', status: 'todo', dueDate: '2026-07-16', recurrenceCount: 1 },
          nextDueDate: '2026-07-16',
          recurrenceActive: true,
        },
        state: {
          livingTask: row({ recurrence_rule: { pattern: 'daily', interval: 1, endType: 'never' }, recurrence_count: 1 }),
          completionTask: row({ id: 'history-1', status: 'done', progress: 100, due_date: '2026-07-12', is_completion_record: true }),
        },
      },
    })

    const result = await applyDoneForNow('task-1', {
      requestId: 'request-1', previewVersion: 'state-v1', nextDueDate: '2026-07-16',
    })

    expect(result.tasks.living.dueDate).toBe('2026-07-16')
    expect(result.tasks.living.recurrenceCount).toBe(1)
    expect(result.tasks.completion.id).toBe('history-1')
    expect(result.tasks.completion.isCompletionRecord).toBe(true)
  })

  it('preserves typed domain errors', async () => {
    rpc.mockResolvedValue({
      error: null,
      data: { ok: false, error: { code: 'stale_preview', message: 'Preview no longer matches current state' } },
    })

    await expect(applyDoneForNow('task-1', {
      requestId: 'request-1', previewVersion: 'old-state',
    })).rejects.toMatchObject<Partial<DoneForNowError>>({ code: 'stale_preview' })
  })
})
