import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/tasks'
import { sortTasksForShuffle, planTaskShuffleOrders } from '@/composables/tasks/useTaskShuffle'

function task(id: string, order: number, priority: Task['priority'], estimatedDuration?: number, status: Task['status'] = 'todo'): Task {
  return { id, order, priority, estimatedDuration, status, title: id, createdAt: new Date(0) } as Task
}

describe('one-time shared task shuffle', () => {
  const tasks = [
    task('missing', 0, null),
    task('low', 1, 'low', 45),
    task('done', 2, 'immediate', 1, 'done'),
    task('short', 3, 'high', 10),
    task('immediate', 4, 'immediate', 30),
    task('tie', 5, 'high', 10),
  ]

  it('sorts priority descending and keeps equal priorities in existing shared order', () => {
    expect(sortTasksForShuffle(tasks.filter(item => item.status !== 'done'), 'priority').map(item => item.id))
      .toEqual(['immediate', 'short', 'tie', 'low', 'missing'])
  })

  it('sorts duration shortest first and places unknown durations last', () => {
    expect(sortTasksForShuffle(tasks.filter(item => item.status !== 'done'), 'duration').map(item => item.id))
      .toEqual(['short', 'tie', 'immediate', 'low', 'missing'])
  })

  it('replaces active slots globally while preserving completed task placement', () => {
    const planned = planTaskShuffleOrders(tasks, 'priority')
    expect(planned.map(item => item.id)).toEqual(['immediate', 'short', 'done', 'tie', 'low', 'missing'])
    expect(planned.map(item => item.order)).toEqual([0, 1, 2, 3, 4, 5])
  })
})
