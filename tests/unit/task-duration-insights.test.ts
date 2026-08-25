import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/tasks'
import { getTaskDurationEvidence } from '@/services/ai/taskDurationInsights'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'new',
    title: 'Prepare launch campaign',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'marketing',
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
    ...overrides,
  }
}

describe('task duration insights', () => {
  it('uses completed Pomodoros from matching task history', () => {
    const evidence = getTaskDurationEvidence(task(), [
      task({ id: 'done-1', status: 'done', title: 'Prepare launch email campaign', completedPomodoros: 2, estimatedDuration: 30 }),
      task({ id: 'done-2', status: 'done', title: 'Launch campaign review', completedPomodoros: 3, estimatedDuration: 60 }),
      task({ id: 'unrelated', status: 'done', title: 'Clean apartment', completedPomodoros: 8 }),
    ])

    expect(evidence).toMatchObject({ minutes: 60, sampleCount: 2 })
    expect(evidence?.basis).toContain('completed similar tasks')
  })

  it('returns no evidence when history has no measured match', () => {
    expect(getTaskDurationEvidence(task(), [
      task({ id: 'done-1', status: 'done', title: 'Clean apartment', completedPomodoros: 2 }),
    ])).toBeNull()
  })
})
