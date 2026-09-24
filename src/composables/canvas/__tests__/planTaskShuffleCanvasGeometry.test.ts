import { describe, expect, it } from 'vitest'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import { planTaskShuffleCanvasGeometry } from '../planTaskShuffleCanvasGeometry'

const group = (id: string, x: number, height = 200): CanvasGroup => ({
  id, name: id, type: 'custom', layout: 'vertical', color: '#fff',
  isVisible: true, isCollapsed: false,
  position: { x, y: 30, width: 320, height },
})
const task = (id: string, parentId: string): Task => ({
  id, title: id, parentId, canvasPosition: { x: 0, y: 0 },
} as Task)

describe('planTaskShuffleCanvasGeometry', () => {
  it('restacks sorted members inside their existing groups, including hidden cards', () => {
    const groups = [group('today', 100), group('tomorrow', 500, 1000)]
    const tasks = [task('hidden', 'today'), task('other', 'tomorrow'), task('first', 'today')]
    const { taskPositions, groupPositions } = planTaskShuffleCanvasGeometry(
      groups, tasks, (id) => id === 'hidden' ? undefined : { width: 220, height: 140 },
    )

    expect(taskPositions.get('hidden')).toEqual({ x: 120, y: 100 })
    expect(taskPositions.get('first')).toEqual({ x: 120, y: 210 })
    expect(taskPositions.get('other')).toEqual({ x: 520, y: 100 })
    expect(groupPositions.get('today')).toEqual({ x: 100, y: 30, width: 320, height: 340 })
    expect(groupPositions.has('tomorrow')).toBe(false)
    expect(groups[0].position).toEqual({ x: 100, y: 30, width: 320, height: 200 })
  })

  it('reserves visible completed and pinned cards while excluding deleted and dismissed tasks', () => {
    const tasks = [task('loose', ''), task('kept', 'today'),
      { ...task('deleted', 'today'), _soft_deleted: true },
      { ...task('done', 'today'), status: 'done' as const },
      { ...task('pinned', 'today'), isPinned: true },
      { ...task('dismissed', 'today'), canvasDismissed: true }]
    const result = planTaskShuffleCanvasGeometry([group('today', 0)], tasks, () => undefined)
    expect([...result.taskPositions.keys()]).toEqual(['kept', 'done', 'pinned'])
    expect(result.taskPositions.get('pinned')).toEqual({ x: 20, y: 320 })
  })

  it('uses measured tall-card height before placing the next card', () => {
    const result = planTaskShuffleCanvasGeometry(
      [group('today', 0)],
      [task('tall', 'today'), { ...task('completed', 'today'), status: 'done' as const }, task('next', 'today')],
      id => ({ width: 220, height: id === 'tall' ? 320 : 120 }),
    )
    expect(result.taskPositions.get('completed')).toEqual({ x: 20, y: 430 })
    expect(result.taskPositions.get('next')).toEqual({ x: 20, y: 560 })
  })
})
