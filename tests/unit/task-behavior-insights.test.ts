import { describe, expect, it } from 'vitest'
import { buildTaskBehaviorInsights } from '@/services/ai/taskBehaviorInsights'
import type { Task } from '@/types/tasks'

function task(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    title: 'Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'project-1',
    createdAt: new Date('2026-06-01T09:00:00Z'),
    updatedAt: new Date('2026-06-01T09:00:00Z'),
    ...overrides
  }
}

describe('buildTaskBehaviorInsights', () => {
  it('learns a recurring weekday from repeated dated tasks', () => {
    const tasks = [
      '2026-07-02', '2026-07-09', '2026-07-16', '2026-07-23', '2026-07-24'
    ].map((dueDate, index) => task({ id: `clean-${index}`, title: 'Clean apartment', dueDate }))

    const insight = buildTaskBehaviorInsights(tasks, new Date('2026-08-24T12:00:00Z'))
      .find(observation => observation.relation === 'routine_weekday')

    expect(insight).toMatchObject({ entity: 'routine:clean apartment', source: 'task_history' })
    expect(insight?.value).toContain('thursday')
    expect(insight?.value).toContain('4/5')
  })

  it('does not promote an ambiguous pattern to a routine', () => {
    const tasks = ['2026-07-02', '2026-07-03', '2026-07-09', '2026-07-10']
      .map((dueDate, index) => task({ id: `mixed-${index}`, title: 'Review inbox', dueDate }))

    expect(buildTaskBehaviorInsights(tasks, new Date('2026-08-24T12:00:00Z')))
      .not.toEqual(expect.arrayContaining([
        expect.objectContaining({ entity: 'routine:review inbox', relation: 'routine_weekday' })
      ]))
  })

  it('measures deadline reliability and planning horizon from completed tasks', () => {
    const tasks = [
      ['2026-07-10', '2026-07-09'],
      ['2026-07-11', '2026-07-13'],
      ['2026-07-20', '2026-07-20']
    ].map(([dueDate, completedAt], index) => task({
      id: `deadline-${index}`,
      title: `Deliver report ${index}`,
      dueDate,
      status: 'done',
      completedAt,
      createdAt: new Date('2026-07-01T09:00:00Z')
    }))

    const insights = buildTaskBehaviorInsights(tasks, new Date('2026-08-24T12:00:00Z'))
    expect(insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ relation: 'deadline_reliability', value: '67% completed by the due date (2/3)' }),
      expect.objectContaining({ relation: 'planning_horizon', value: expect.stringContaining('typically sets due dates about 10 days') })
    ]))
  })
})
