/**
 * BUG-2106: all views share one task sequence — the Canvas order (day groups
 * in reading order, Today first; shared `order` inside a day) — unless the
 * user deliberately re-sorts a view.
 */
import { describe, it, expect, afterEach } from 'vitest'
import type { Task } from '@/types/tasks'
import type { CanvasGroup } from '@/types/canvas'
import { buildCanvasSequenceSections } from '@/utils/canvas/canvasSequence'
import {
  getSharedOrderSection,
  setSharedOrderSectionResolver,
  sortTasksBySharedOrder,
  visibleReorderUpdates,
} from '@/utils/taskOrdering'
import { sortTasksForBoard } from '@/composables/board/useBoardState'

const group = (id: string, name: string, x: number, extra: Partial<CanvasGroup> = {}) =>
  ({ id, name, position: { x, y: 0, width: 400, height: 1000 }, isVisible: true, ...extra }) as unknown as CanvasGroup
const task = (id: string, order: number, parentId?: string, priority: Task['priority'] = null) =>
  ({ id, title: id, order, parentId, priority, status: 'planned' }) as unknown as Task

// Mirrors the user's data: a Thursday task holds the lowest global order,
// and an Immediate task sits third in Today.
const groups = [group('today', 'Today', 0), group('tomorrow', 'Tomorrow', 400), group('thu', 'Thursday', 1600)]
const tasks = [
  task('yaniv-thu', 3, 'thu', 'immediate'),
  task('lecture', 13, 'today', 'high'),
  task('slides', 24, 'today', 'high'),
  task('dishes', 31, 'today', 'immediate'),
  task('tomorrow-1', 40, 'tomorrow'),
  task('loose', 1),
]

const useCanvasSequence = () => {
  const sections = buildCanvasSequenceSections(groups, tasks, new Set(), 'today')
  setSharedOrderSectionResolver(candidate => sections.get(candidate.id))
}

afterEach(() => setSharedOrderSectionResolver(null))

describe('synced Canvas order', () => {
  it('starts every synced view with the first task on Canvas, not the lowest global order or priority', () => {
    useCanvasSequence()
    const expected = ['lecture', 'slides', 'dishes', 'tomorrow-1', 'yaniv-thu', 'loose']
    expect(sortTasksBySharedOrder(tasks).map(t => t.id)).toEqual(expected)
    expect(sortTasksForBoard(tasks, 'manual').map(t => t.id)).toEqual(expected)
  })

  it('still lets a view be re-sorted on purpose', () => {
    useCanvasSequence()
    expect(sortTasksForBoard(tasks, 'priority_desc')[0].id).toBe('dishes')
  })

  it('projects smart Today membership and nested groups onto their Canvas day', () => {
    const nested = group('focus', 'Focus block', 0, { parentGroupId: 'thu' } as Partial<CanvasGroup>)
    const sections = buildCanvasSequenceSections(
      [...groups, nested],
      [task('due-today', 50), task('in-nested', 2, 'focus')],
      new Set(['due-today']),
      'today',
    )
    expect(sections.get('due-today')).toMatchObject({ key: 'today', rank: 0 })
    expect(sections.get('in-nested')).toMatchObject({ key: 'thu', label: 'Thursday' })
  })

  it('reorders within a day by writing only that day\'s moved tasks', () => {
    useCanvasSequence()
    const visible = new Set(tasks.map(t => t.id))
    const current = sortTasksBySharedOrder(tasks).map(t => t.id)
    // Move "dishes" to the top of Today.
    const requested = ['dishes', 'lecture', 'slides', ...current.slice(3)]
    expect(visibleReorderUpdates(tasks, requested, visible)).toEqual([
      { id: 'dishes', order: 13 },
      { id: 'lecture', order: 24 },
      { id: 'slides', order: 31 },
    ])
    expect(getSharedOrderSection(tasks[0])?.label).toBe('Thursday')
  })
})
