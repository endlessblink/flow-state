import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/tasks'
import { getTaskDateEvidence } from '@/services/ai/taskDateInsights'

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: crypto.randomUUID(),
    title: 'Clean the apartment',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'home',
    createdAt: new Date('2026-08-01T12:00:00'),
    updatedAt: new Date('2026-08-01T12:00:00'),
    estimatedDuration: 30,
    ...overrides,
  }
}

describe('task date insights', () => {
  it('learns a repeated weekday for similar completed work', () => {
    const cleaning = task()
    const history = [
      task({ id: 'done-1', status: 'done', completedAt: '2026-08-06T10:00:00' }),
      task({ id: 'done-2', status: 'done', completedAt: '2026-08-13T10:00:00' }),
      task({ id: 'done-3', status: 'done', completedAt: '2026-08-20T10:00:00' }),
    ]

    const evidence = getTaskDateEvidence(cleaning, history, null, new Date('2026-08-26T12:00:00'))

    expect(evidence.date).toBe('2026-08-27')
    expect(evidence.confidence).toBeGreaterThanOrEqual(0.85)
    expect(evidence.basis).toContain('thursday')
  })

  it('uses learned workdays and capacity when there is no strong routine', () => {
    const evidence = getTaskDateEvidence(
      task({ title: 'Prepare quarterly report' }),
      [task({ id: 'busy', title: 'Review legal contract', dueDate: '2026-08-28', estimatedDuration: 120 })],
      {
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        daysOff: ['wednesday', 'thursday'],
        avgWorkMinutesPerDay: 120,
        maxTasksPerDay: 6,
      },
      new Date('2026-08-26T12:00:00'),
    )

    expect(evidence.date).toBe('2026-08-31')
    expect(evidence.basis).toContain('monday')
    expect(evidence.basis).toContain('planned minutes')
  })

  it('does not invent a weekend fallback when every near date is unavailable', () => {
    const evidence = getTaskDateEvidence(
      task({ title: 'Plan team workshop' }),
      [],
      { workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], maxTasksPerDay: 0 },
      new Date('2026-08-26T12:00:00'),
    )

    expect(new Date(`${evidence.date}T12:00:00`).getDay()).toBeGreaterThanOrEqual(1)
    expect(new Date(`${evidence.date}T12:00:00`).getDay()).toBeLessThanOrEqual(5)
  })
})
