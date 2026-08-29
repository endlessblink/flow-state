import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'

const { planRecurrenceLifecycle } = require('../../../server/local-api/recurrence-lifecycle.cjs') as {
  planRecurrenceLifecycle: (input: Record<string, unknown>) => Record<string, unknown>
}

const definition = {
  id: 'task-1',
  due_date: '2026-08-29',
  recurrence_rule: { pattern: 'weekly', interval: 1, weekdays: [6], endType: 'never' },
  recurrence_count: 2,
  canonical_revision: 7,
}

const occurrences = [
  { id: 'instance-2', dueDate: '2026-08-29', status: 'todo' },
  { id: 'instance-3', dueDate: '2026-09-05', status: 'todo' },
]

describe('recurrence lifecycle planning', () => {
  it('previews a cadence change without rewriting history or creating occurrences', () => {
    expect(planRecurrenceLifecycle({
      definition,
      occurrences,
      action: 'set_cadence',
      recurrenceRule: { pattern: 'daily', interval: 2, endType: 'never' },
      nextDueDate: '2026-08-31',
    })).toEqual({
      ok: true,
      result: 'preview',
      contractVersion: 'recurrence-lifecycle-v1',
      action: 'set_cadence',
      taskId: 'task-1',
      baseRevision: 7,
      currentOccurrence: { id: 'instance-2', dueDate: '2026-08-29', status: 'todo' },
      proposedDefinition: {
        recurrenceRule: { pattern: 'daily', interval: 2, endType: 'never' },
        dueDate: '2026-08-31',
      },
      historyDisposition: 'preserve',
      occurrenceDisposition: 'replace-future-only',
    })
  })

  it.each([
    ['pause', { paused: true }],
    ['resume', { paused: false }],
    ['end', { endType: 'on_date', endDate: '2026-08-29' }],
  ])('plans %s without changing the current occurrence', (action, rulePatch) => {
    const result = planRecurrenceLifecycle({ definition, occurrences, action })
    expect(result).toMatchObject({
      ok: true,
      result: 'preview',
      action,
      currentOccurrence: { id: 'instance-2' },
      historyDisposition: 'preserve',
      occurrenceDisposition: action === 'end' ? 'close-future-only' : action === 'pause' ? 'retain-future-paused' : 'restore-future',
    })
    expect((result.proposedDefinition as Record<string, unknown>).recurrenceRule).toMatchObject(rulePatch)
  })

  it('rejects ambiguous current occurrences, invalid dates, and invalid actions', () => {
    expect(() => planRecurrenceLifecycle({ definition, occurrences: [...occurrences, occurrences[0]], action: 'pause' }))
      .toThrow('ambiguous current occurrence')
    expect(() => planRecurrenceLifecycle({ definition, occurrences, action: 'set_cadence', recurrenceRule: definition.recurrence_rule, nextDueDate: '2026-8-31' }))
      .toThrow('YYYY-MM-DD')
    expect(() => planRecurrenceLifecycle({ definition, occurrences, action: 'delete' })).toThrow('unsupported lifecycle action')
  })

  it('defaults to preview and never notifies the renderer', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      ok: true,
      result: 'preview',
      contractVersion: 'recurrence-lifecycle-v1',
      operationId: 'operation-1',
      previewVersion: 'revision-7',
      taskId: 'task-1',
      action: 'pause',
    }, error: null })
    const notify = vi.fn()
    const { executeRecurrenceLifecycle } = require('../../../server/local-api/recurrence-lifecycle.cjs') as {
      executeRecurrenceLifecycle: (context: Record<string, unknown>, taskId: string, body: Record<string, unknown>, notify: () => void) => Promise<Record<string, unknown>>
    }

    const result = await executeRecurrenceLifecycle({ supabase: { rpc }, activeWorkspaceId: null }, 'task-1', {
      requestId: 'operation-1', action: 'pause',
    }, notify)

    expect(result).toEqual(expect.objectContaining({ status: 200, body: expect.objectContaining({ result: 'preview' }) }))
    expect(rpc).toHaveBeenCalledWith('flowstate_edit_recurrence', expect.objectContaining({
      p_action: 'pause', p_preview: true, p_task_id: 'task-1', p_request_id: 'operation-1',
    }))
    expect(notify).not.toHaveBeenCalled()
  })

  it('requires approval fields before apply and notifies only after a committed response', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      ok: true, result: 'committed', contractVersion: 'recurrence-lifecycle-v1',
      action: 'resume', taskId: 'task-1', requestHash: 'a'.repeat(64),
      receipt: { operation: 'recurrence_lifecycle' },
    }, error: null })
    const notify = vi.fn()
    const { executeRecurrenceLifecycle } = require('../../../server/local-api/recurrence-lifecycle.cjs')
    const missing = await executeRecurrenceLifecycle({ supabase: { rpc } }, 'task-1', { preview: false, action: 'resume', requestId: 'operation-1' }, notify)
    expect(missing).toMatchObject({ status: 400, body: { ok: false, error: { code: 'approval_receipt_required' } } })
    expect(rpc).not.toHaveBeenCalled()

    const result = await executeRecurrenceLifecycle({ supabase: { rpc } }, 'task-1', {
      preview: false, action: 'resume', requestId: 'operation-1', previewVersion: 'revision-7', requestHash: 'a'.repeat(64),
    }, notify)
    expect(result).toMatchObject({ status: 200, body: { result: 'committed' } })
    expect(notify).toHaveBeenCalledWith('update', 'task-1')
  })
})
