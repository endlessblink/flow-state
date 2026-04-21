import { describe, it, expect } from 'vitest'
import { repairTaskTitles } from '@/utils/taskValidation'
import type { Task } from '@/types/tasks'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Valid Task',
    description: '',
    status: 'todo',
    priority: 'medium',
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'uncategorized',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    isInInbox: false,
    ...overrides,
  }
}

describe('repairTaskTitles', () => {
  it('repairs blank titles and pulls repaired tasks off canvas', () => {
    const task = makeTask({
      title: '   ',
      parentId: 'group-legacy-1',
      canvasPosition: { x: 100, y: 200 },
      isInInbox: false,
    })

    const { repairedTasks, repairedCount } = repairTaskTitles([task])

    expect(repairedCount).toBe(1)
    expect(repairedTasks[0]?.title).toBe('Untitled Task')
    expect(repairedTasks[0]?.canvasPosition).toBeUndefined()
    expect(repairedTasks[0]?.parentId).toBeUndefined()
    expect(repairedTasks[0]?.isInInbox).toBe(true)
  })

  it('leaves already-valid tasks unchanged', () => {
    const task = makeTask({ title: 'Real Task', isInInbox: false })
    const { repairedTasks, repairedCount } = repairTaskTitles([task])

    expect(repairedCount).toBe(0)
    expect(repairedTasks[0]).toBe(task)
  })
})
