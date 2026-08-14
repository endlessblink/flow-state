import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/tasks'
import {
  compareTasksBySharedOrder,
  sortTasksBySharedOrder,
  orderTasksByCanvasPosition,
  getNextTaskOrder,
} from '@/utils/taskOrdering'

function task(id: string, order?: number, position?: { x: number; y: number }): Task {
  return {
    id,
    title: id,
    status: 'todo',
    createdAt: '2026-01-01T00:00:00.000Z',
    order,
    canvasPosition: position,
  } as Task
}

describe('shared task ordering', () => {
  it('uses persisted order before creation time', () => {
    const tasks = [task('late', 2), task('first', 0), task('middle', 1)]

    expect(sortTasksBySharedOrder(tasks).map(({ id }) => id)).toEqual(['first', 'middle', 'late'])
  })

  it('uses canvas row-major position when no persisted order exists', () => {
    const tasks = [
      task('bottom-left', undefined, { x: 10, y: 200 }),
      task('top-right', undefined, { x: 200, y: 10 }),
      task('top-left', undefined, { x: 10, y: 10 }),
    ]

    expect(orderTasksByCanvasPosition(tasks).map(({ id }) => id)).toEqual([
      'top-left',
      'top-right',
      'bottom-left',
    ])
  })

  it('breaks shared-order ties deterministically by id', () => {
    expect(compareTasksBySharedOrder(task('b', 1), task('a', 1))).toBeGreaterThan(0)
  })

  it('appends a newly created task after the matching status group', () => {
    expect(getNextTaskOrder([
      task('a', 0),
      task('b', 4),
      { ...task('done', 9), status: 'done' },
    ], 'todo')).toBe(5)
  })
})
