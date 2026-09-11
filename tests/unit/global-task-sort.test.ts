import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Task } from '@/types/tasks'
import {
  compareTasksBySort,
  sortTasksByMainAndSecondary,
  type TaskSortSpec,
} from '@/utils/taskSort'
import { useTaskSortStore } from '@/stores/taskSort'

const task = (overrides: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
  status: 'todo',
  createdAt: '2026-09-11T08:00:00.000Z',
  updatedAt: '2026-09-11T08:00:00.000Z',
  order: 0,
  ...overrides,
} as Task)

describe('global task sorting', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('shares one reactive main sort between every consumer', () => {
    const catalog = useTaskSortStore()
    const inbox = useTaskSortStore()

    catalog.mainSortKey = 'priority'
    catalog.mainSortDirection = 'desc'

    expect(inbox.mainSortKey).toBe('priority')
    expect(inbox.mainSortDirection).toBe('desc')
  })

  it('keeps the main sort authoritative and applies the inbox sort only to ties', () => {
    const tasks = [
      task({ id: 'medium-early', title: 'A', priority: 'medium', dueDate: '2026-09-11', order: 2 }),
      task({ id: 'high-late', title: 'B', priority: 'high', dueDate: '2026-09-13', order: 1 }),
      task({ id: 'high-early', title: 'C', priority: 'high', dueDate: '2026-09-11', order: 3 }),
    ]
    const main: TaskSortSpec = { key: 'priority', direction: 'asc' }
    const secondary: TaskSortSpec = { key: 'dueDate', direction: 'asc' }

    expect(sortTasksByMainAndSecondary(tasks, main, secondary).map(item => item.id)).toEqual([
      'high-early',
      'high-late',
      'medium-early',
    ])
  })

  it('uses the shared manual order and id as a deterministic fallback', () => {
    const first = task({ id: 'a', title: 'Same', order: 2 })
    const second = task({ id: 'b', title: 'Same', order: 1 })

    expect(compareTasksBySort(first, second, { key: 'title', direction: 'asc' })).toBeGreaterThan(0)
    expect(sortTasksByMainAndSecondary([first, second], { key: 'title', direction: 'asc' }).map(item => item.id)).toEqual(['b', 'a'])
  })

  it('keeps tasks with missing due dates after dated tasks in either direction', () => {
    const dated = task({ id: 'dated', title: 'Dated', dueDate: '2026-09-11' })
    const missing = task({ id: 'missing', title: 'Missing' })

    expect(sortTasksByMainAndSecondary([missing, dated], { key: 'dueDate', direction: 'asc' }).map(item => item.id)).toEqual(['dated', 'missing'])
    expect(sortTasksByMainAndSecondary([missing, dated], { key: 'dueDate', direction: 'desc' }).map(item => item.id)).toEqual(['dated', 'missing'])
  })
})
