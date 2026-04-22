import { describe, it, expect } from 'vitest'
import { sanitizeTaskTitle, repairTaskTitles, FALLBACK_TASK_TITLE } from '../taskValidation'
import type { Task } from '@/types/tasks'

const baseTask: Task = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'real',
  description: '',
  status: 'todo',
  priority: 'medium',
  progress: 0,
  completedPomodoros: 0,
  estimatedPomodoros: 1,
  subtasks: [],
  dueDate: '',
  projectId: 'uncategorized',
  createdAt: new Date(),
  updatedAt: new Date(),
  instances: [],
  tags: [],
  isInInbox: false,
  canvasPosition: { x: 10, y: 20 },
  parentId: 'group-today',
  parentTaskId: null,
}

describe('sanitizeTaskTitle (BUG-1777)', () => {
  it('returns fallback for empty string', () => {
    expect(sanitizeTaskTitle('')).toBe(FALLBACK_TASK_TITLE)
  })

  it('returns fallback for whitespace-only string', () => {
    expect(sanitizeTaskTitle('   ')).toBe(FALLBACK_TASK_TITLE)
    expect(sanitizeTaskTitle('\t\n  \n')).toBe(FALLBACK_TASK_TITLE)
  })

  it('returns fallback for null', () => {
    expect(sanitizeTaskTitle(null)).toBe(FALLBACK_TASK_TITLE)
  })

  it('returns fallback for undefined', () => {
    expect(sanitizeTaskTitle(undefined)).toBe(FALLBACK_TASK_TITLE)
  })

  it('returns fallback for non-string values', () => {
    expect(sanitizeTaskTitle(42)).toBe(FALLBACK_TASK_TITLE)
    expect(sanitizeTaskTitle({})).toBe(FALLBACK_TASK_TITLE)
    expect(sanitizeTaskTitle([])).toBe(FALLBACK_TASK_TITLE)
  })

  it('trims surrounding whitespace but preserves real title', () => {
    expect(sanitizeTaskTitle('  Write tests  ')).toBe('Write tests')
  })

  it('preserves a valid title unchanged', () => {
    expect(sanitizeTaskTitle('Ship it')).toBe('Ship it')
  })
})

describe('repairTaskTitles (BUG-1777)', () => {
  it('does not repair a task with a valid title', () => {
    const { repairedTasks, repairedCount } = repairTaskTitles([baseTask])
    expect(repairedCount).toBe(0)
    expect(repairedTasks[0]).toBe(baseTask)
  })

  it('repairs blank title and clears canvas placement', () => {
    const blankTask: Task = { ...baseTask, title: '' }
    const { repairedTasks, repairedCount } = repairTaskTitles([blankTask])
    expect(repairedCount).toBe(1)
    expect(repairedTasks[0].title).toBe(FALLBACK_TASK_TITLE)
    expect(repairedTasks[0].canvasPosition).toBeUndefined()
    expect(repairedTasks[0].parentId).toBeUndefined()
    expect(repairedTasks[0].isInInbox).toBe(true)
  })

  it('counts multiple blank tasks and leaves valid ones alone', () => {
    const tasks: Task[] = [
      baseTask,
      { ...baseTask, id: 'id-2', title: '' },
      { ...baseTask, id: 'id-3', title: '   ' },
      { ...baseTask, id: 'id-4', title: 'Good one' },
    ]
    const { repairedTasks, repairedCount } = repairTaskTitles(tasks)
    expect(repairedCount).toBe(2)
    expect(repairedTasks[0].title).toBe('real')
    expect(repairedTasks[1].title).toBe(FALLBACK_TASK_TITLE)
    expect(repairedTasks[2].title).toBe(FALLBACK_TASK_TITLE)
    expect(repairedTasks[3].title).toBe('Good one')
  })
})
