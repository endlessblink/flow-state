import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/tasks'
import { sortTasksForBoard } from '@/composables/board/useBoardState'

const task = (id: string, priority: Task['priority']): Task => ({
  id,
  title: id,
  description: '',
  status: 'todo',
  priority,
  tags: [],
  subtasks: [],
  isInInbox: true,
  createdAt: new Date(id === 'high' ? '2026-08-01' : '2026-08-02'),
  updatedAt: new Date('2026-08-02')
})

describe('board priority sorting', () => {
  it('places immediate, high, medium, low, relaxed, then unset priorities first', () => {
    const tasks = [
      task('unset', null),
      task('relaxed', 'relaxed'),
      task('low', 'low'),
      task('high', 'high'),
      task('immediate', 'immediate'),
      task('medium', 'medium')
    ]

    expect(sortTasksForBoard(tasks, 'priority_desc').map(item => item.id)).toEqual([
      'immediate',
      'high',
      'medium',
      'low',
      'relaxed',
      'unset'
    ])
  })

  it('keeps manual ordering behavior available', () => {
    const tasks = [task('low', 'low'), task('high', 'high')]

    expect(sortTasksForBoard(tasks, 'manual').map(item => item.id)).toEqual(['high', 'low'])
  })
})
