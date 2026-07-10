import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/tasks'
import { selectQuickSortTasks, type QuickSortSource } from '@/utils/quickSortTaskFilters'

const NOW = new Date(2026, 6, 10, 12)

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    description: '',
    status: 'todo',
    priority: null,
    progress: 0,
    completedPomodoros: 0,
    subtasks: [],
    dueDate: '',
    projectId: 'project-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  }
}

const isUncategorized = (candidate: Task) => !candidate.projectId || candidate.projectId === 'uncategorized'
const idsFor = (tasks: Task[], sources: QuickSortSource[]) => (
  selectQuickSortTasks(tasks, sources, isUncategorized, NOW).map(candidate => candidate.id)
)

describe('Quick Sort task pool predicates', () => {
  it('uses independent local due-date boundaries', () => {
    const tasks = [
      task('overdue', { dueDate: '2026-07-09' }),
      task('today', { dueDate: '2026-07-10' }),
      task('tomorrow', { dueDate: '2026-07-11' }),
      task('day-3', { dueDate: '2026-07-13' }),
      task('day-4', { dueDate: '2026-07-14' }),
      task('day-7', { dueDate: '2026-07-17' }),
      task('day-8', { dueDate: '2026-07-18' })
    ]

    expect(idsFor(tasks, ['overdue'])).toEqual(['overdue'])
    expect(idsFor(tasks, ['today'])).toEqual(['today'])
    expect(idsFor(tasks, ['next-3-days'])).toEqual(['tomorrow', 'day-3'])
    expect(idsFor(tasks, ['next-7-days'])).toEqual(['tomorrow', 'day-3', 'day-4', 'day-7'])
  })

  it('uses dueDate only and treats blank or invalid deadlines as no due date', () => {
    const tasks = [
      task('blank', { dueDate: '', scheduledDate: '2026-07-11' }),
      task('invalid', { dueDate: '2026-99-99' }),
      task('iso', { dueDate: '2026-07-11T00:00:00.000Z' })
    ]

    expect(idsFor(tasks, ['no-due-date'])).toEqual(['blank', 'invalid'])
    expect(idsFor(tasks, ['next-3-days'])).toEqual(['iso'])
  })

  it('deduplicates overlapping sources and preserves input order', () => {
    const tasks = [
      task('inbox-today', { projectId: '', dueDate: '2026-07-10' }),
      task('assigned-today', { dueDate: '2026-07-10' }),
      task('inbox-later', { projectId: '', dueDate: '2026-08-01' })
    ]

    expect(idsFor(tasks, ['uncategorized', 'today'])).toEqual([
      'inbox-today',
      'assigned-today',
      'inbox-later'
    ])
  })

  it('excludes completed, pinned, and soft-deleted tasks from every pool', () => {
    const tasks = [
      task('eligible', { dueDate: '2026-07-09' }),
      task('done', { dueDate: '2026-07-09', status: 'done' }),
      task('pinned', { dueDate: '2026-07-09', isPinned: true }),
      task('deleted', { dueDate: '2026-07-09', _soft_deleted: true })
    ]

    expect(idsFor(tasks, ['overdue'])).toEqual(['eligible'])
  })
})
