import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

const { buildRecurrenceChainRead } = require('../../../server/local-api/recurrence-chain.cjs') as {
  buildRecurrenceChainRead: (input: {
    definition: Record<string, unknown>
    history: Array<Record<string, unknown>>
  }) => Record<string, unknown>
}

const definition = {
  id: 'task-1',
  title: 'Water the plants',
  status: 'todo',
  due_date: '2026-08-29',
  due_time: '09:00',
  recurrence_rule: { pattern: 'weekly', interval: 1, weekdays: [6] },
  recurrence_count: 2,
  recurrence_parent_id: null,
  is_completion_record: false,
  instances: [
    { id: 'instance-3', taskId: 'task-1', dueDate: '2026-09-05', status: 'todo' },
    { id: 'instance-2', taskId: 'task-1', dueDate: '2026-08-29', status: 'todo' },
  ],
  workspace_id: 'workspace-1',
  canonical_revision: 7,
  updated_at: '2026-08-29T06:00:00.000Z',
}

const history = [
  {
    id: 'history-1',
    title: 'Water the plants',
    status: 'done',
    due_date: '2026-08-22',
    completed_at: '2026-08-22T09:15:00.000Z',
    recurrence_parent_id: 'task-1',
    recurrence_count: 1,
    is_completion_record: true,
  },
]

describe('recurrence chain read contract', () => {
  it('separates the living definition, completed history, current occurrence, and next occurrence', () => {
    expect(buildRecurrenceChainRead({ definition, history })).toEqual({
      ok: true,
      contractVersion: 'recurrence-chain-v1',
      definition: {
        id: 'task-1',
        title: 'Water the plants',
        status: 'todo',
        dueDate: '2026-08-29',
        dueTime: '09:00',
        recurrenceRule: { pattern: 'weekly', interval: 1, weekdays: [6] },
        recurrenceCount: 2,
        workspaceId: 'workspace-1',
        canonicalRevision: 7,
        canonicalUpdatedAt: '2026-08-29T06:00:00.000Z',
      },
      history: [{
        id: 'history-1',
        status: 'done',
        dueDate: '2026-08-22',
        completedAt: '2026-08-22T09:15:00.000Z',
        recurrenceCount: 1,
      }],
      currentOccurrence: {
        id: 'instance-2',
        taskId: 'task-1',
        dueDate: '2026-08-29',
        status: 'todo',
      },
      nextOccurrence: {
        id: 'instance-3',
        taskId: 'task-1',
        dueDate: '2026-09-05',
        status: 'todo',
      },
    })
  })

  it('does not expose descriptions, embedded internals, or unrelated row fields', () => {
    const result = buildRecurrenceChainRead({
      definition: { ...definition, description: 'private body', secret: 'must not leak' },
      history,
    })

    expect(JSON.stringify(result)).not.toContain('private body')
    expect(JSON.stringify(result)).not.toContain('must not leak')
    expect(result).not.toHaveProperty('instances')
  })
})
