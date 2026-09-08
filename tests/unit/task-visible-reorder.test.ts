import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/tasks'
import { mergeVisibleTaskOrder } from '@/utils/taskOrdering'

const task = (id: string, order: number): Task => ({
  id,
  title: id,
  status: 'todo',
  order,
} as Task)

describe('TASK-2069 focused timeline ordering', () => {
  it('reorders visible tasks inside their original slots without moving hidden tasks', () => {
    const all = [task('a', 0), task('hidden-1', 1), task('b', 2), task('hidden-2', 3), task('c', 4)]

    const result = mergeVisibleTaskOrder(all, ['c', 'a', 'b'], new Set(['a', 'b', 'c']))

    expect(result.map(item => item.id)).toEqual(['c', 'hidden-1', 'a', 'hidden-2', 'b'])
    expect(result.map(item => item.order)).toEqual([0, 1, 2, 3, 4])
    expect(result.find(item => item.id === 'hidden-1')?.order).toBe(1)
    expect(result.find(item => item.id === 'hidden-2')?.order).toBe(3)
  })

  it('normalizes missing and equal legacy orders deterministically', () => {
    const all = [task('b', 0), task('a', 0), { ...task('c', 3), order: undefined }]

    const result = mergeVisibleTaskOrder(all, ['c', 'b', 'a'], new Set(['a', 'b', 'c']))

    expect(result.map(item => item.id)).toEqual(['c', 'b', 'a'])
    expect(result.map(item => item.order)).toEqual([0, 1, 2])
  })
})
