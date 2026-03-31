import { describe, it, expect } from 'vitest'
import { getTaskCompleteness } from '@/composables/useTaskCompleteness'
import type { Task, Subtask } from '@/types/tasks'

function mockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-1',
    title: 'Test task',
    description: '',
    status: 'todo',
    priority: null,
    dueDate: '',
    estimatedDuration: undefined,
    subtasks: [],
    projectId: 'proj-1',
    completedPomodoros: 0,
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }
}

describe('getTaskCompleteness', () => {
  it('returns score 0 for task with no metadata', () => {
    const { score, missing } = getTaskCompleteness(mockTask())
    expect(score).toBe(0)
    expect(missing).toHaveLength(4)
  })

  it('returns score 1.0 for fully complete task', () => {
    const { score, missing } = getTaskCompleteness(mockTask({
      priority: 'high',
      dueDate: '2026-04-01',
      estimatedDuration: 60,
      subtasks: [{ id: 's1', parentTaskId: 'test-1', title: 'Sub', description: '', isCompleted: false, completedPomodoros: 0, createdAt: new Date(), updatedAt: new Date() }]
    }))
    expect(score).toBe(1)
    expect(missing).toHaveLength(0)
  })

  it('returns correct missing fields list', () => {
    const { missing } = getTaskCompleteness(mockTask({ priority: 'medium' }))
    expect(missing).toEqual(expect.arrayContaining(['dueDate', 'estimatedDuration', 'subtasks']))
    expect(missing).not.toContain('priority')
  })

  it('gives partial credit for subtasks only', () => {
    const { score } = getTaskCompleteness(mockTask({
      subtasks: [{ id: 's1', parentTaskId: 'test-1', title: 'Research', description: '', isCompleted: false, completedPomodoros: 0, createdAt: new Date(), updatedAt: new Date() }]
    }))
    expect(score).toBe(0.25)
  })
})
