import { describe, expect, it, vi } from 'vitest'
import { getCanonicalTodayTaskIds, getCanonicalTodayTasks } from '@/utils/todayTaskProjection'
import type { Task } from '@/types/tasks'

function task(id: string, order: number, dueDate = '2026-08-14'): Task {
  return {
    id,
    title: id,
    status: 'planned',
    priority: 'medium',
    dueDate,
    order,
    createdAt: `2026-08-14T0${order}:00:00.000Z`,
    updatedAt: `2026-08-14T0${order}:00:00.000Z`,
    instances: [],
    recurringInstances: [],
  } as Task
}

describe('canonical Today task projection', () => {
  it('returns the exact shared task order used by every view', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-14T12:00:00.000Z'))

    const tasks = [task('third', 2), task('first', 0), task('second', 1), task('tomorrow', 3, '2026-08-15')]
    expect(getCanonicalTodayTasks(tasks).map(item => item.id)).toEqual(['first', 'second', 'third'])
    expect([...getCanonicalTodayTaskIds(tasks)]).toEqual(['first', 'second', 'third'])

    vi.useRealTimers()
  })
})
