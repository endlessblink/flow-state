/**
 * TASK-1756 v8: Tests for the pure canonical-layout primitive.
 *
 * The primitive is deterministic and has no store dependencies — these
 * tests just feed it inputs and verify the returned shape.
 */

import { describe, it, expect } from 'vitest'
import {
  computeCanonicalLayout,
  computeVisibleTaskCompaction,
  hasOverlappingRects,
  type DayGroupInput,
} from '@/composables/canvas/useCanonicalDayGroupLayout'
import { CANVAS } from '@/constants/canvas'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'

function grp(id: string, name: string, x: number, y: number): CanvasGroup {
  return {
    id,
    name,
    isVisible: true,
    position: { x, y, width: 200, height: 200 },
  } as unknown as CanvasGroup
}

function tk(id: string, parentId: string, y = 100): Task {
  return {
    id,
    parentId,
    canvasPosition: { x: 0, y },
    createdAt: '2026-01-01T00:00:00Z',
  } as unknown as Task
}

describe('computeCanonicalLayout', () => {
  it('detects overlapping rendered cards but allows touching edges', () => {
    expect(hasOverlappingRects([
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 100, top: 0, right: 200, bottom: 100 },
    ])).toBe(false)
    expect(hasOverlappingRects([
      { left: 0, top: 0, right: 100, bottom: 100 },
      { left: 80, top: 20, right: 200, bottom: 120 },
    ])).toBe(true)
  })

  it('restacks a changed shared order into distinct vertical slots', () => {
    const group = grp('ordered', 'Today', 0, 0)
    const tasks = [
      { ...tk('first', group.id, 600), order: 2 },
      { ...tk('second', group.id, 300), order: 0 },
      { ...tk('third', group.id, 300), order: 1 },
    ]
    const { taskMoves } = computeCanonicalLayout([{ group, visualPos: { x: 0, y: 0 }, tasks }], [group.id])

    expect(taskMoves.map((move) => move.taskId)).toEqual(['second', 'third', 'first'])
    expect(taskMoves.map((move) => move.position.y)).toEqual([70, 182, 294])
  })
  it('compacts visible siblings from the group header after a filtered task is hidden', () => {
    const group = grp('a', 'A', 100, 200)
    const tasks = [tk('t1', 'a', 280), tk('t3', 'a', 520)]
    const positions = computeVisibleTaskCompaction({
      group,
      visualPos: { x: 100, y: 200 },
      tasks,
      taskPositions: new Map(tasks.map((task) => [task.id, task.canvasPosition!])),
    })

    expect(positions.get('t1')).toEqual({ x: 120, y: 270 })
    expect(positions.get('t3')!.y).toBeGreaterThan(positions.get('t1')!.y)
    expect(positions.get('t3')!.y).toBeLessThan(520)
  })

  it('returns empty arrays when no inputs are given', () => {
    const { groupMoves, taskMoves } = computeCanonicalLayout([], [])
    expect(groupMoves).toEqual([])
    expect(taskMoves).toEqual([])
  })

  it('places groups on a single row at common Y, spaced by DAY_GROUP_SPACING', () => {
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 100, 500), visualPos: { x: 100, y: 500 }, tasks: [] },
      { group: grp('b', 'B', 50, 300), visualPos: { x: 50, y: 300 }, tasks: [] },
      { group: grp('c', 'C', 700, 800), visualPos: { x: 700, y: 800 }, tasks: [] },
    ]
    const ordered = ['a', 'b', 'c']
    const { groupMoves } = computeCanonicalLayout(inputs, ordered)

    // originX = min(100, 50, 700) = 50; originY = min(500, 300, 800) = 300
    expect(groupMoves[0].position).toEqual({ x: 50, y: 300 })
    expect(groupMoves[1].position).toEqual({ x: 50 + CANVAS.DAY_GROUP_SPACING, y: 300 })
    expect(groupMoves[2].position).toEqual({ x: 50 + 2 * CANVAS.DAY_GROUP_SPACING, y: 300 })
  })

  it('anchors a negative off-canvas cluster at the visible canvas origin', () => {
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', -405, -274), visualPos: { x: -405, y: -274 }, tasks: [] },
      { group: grp('b', 'B', 11, -274), visualPos: { x: 11, y: -274 }, tasks: [] },
    ]

    const { groupMoves } = computeCanonicalLayout(inputs, ['a', 'b'])

    expect(groupMoves.map((move) => move.position)).toEqual([
      { x: 0, y: 0 },
      { x: CANVAS.DAY_GROUP_SPACING, y: 0 },
    ])
  })

  it('assigns groups to slots in the orderedIds sequence, not the input array order', () => {
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 0), visualPos: { x: 0, y: 0 }, tasks: [] },
      { group: grp('b', 'B', 0, 0), visualPos: { x: 0, y: 0 }, tasks: [] },
    ]
    const { groupMoves } = computeCanonicalLayout(inputs, ['b', 'a'])
    expect(groupMoves[0].groupId).toBe('b')
    expect(groupMoves[1].groupId).toBe('a')
  })

  it('gives every group uniform width 350 and height 920 when tasks fit in one column', () => {
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 0), visualPos: { x: 0, y: 0 }, tasks: [tk('t1', 'a'), tk('t2', 'a')] },
      { group: grp('b', 'B', 0, 0), visualPos: { x: 0, y: 0 }, tasks: [] },
    ]
    const { groupMoves } = computeCanonicalLayout(inputs, ['a', 'b'])
    for (const gm of groupMoves) {
      expect(gm.size.width).toBe(CANVAS.DAY_GROUP_WIDTH_1COL)
      expect(gm.size.height).toBe(CANVAS.DAY_GROUP_HEIGHT)
    }
  })

  it('bumps group width to 700 when a group has more than 8 tasks (2-column overflow)', () => {
    const tenTasks = Array.from({ length: 10 }, (_, i) => tk(`t${i}`, 'a', i * 10))
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 0), visualPos: { x: 0, y: 0 }, tasks: tenTasks },
      { group: grp('b', 'B', 0, 0), visualPos: { x: 0, y: 0 }, tasks: [] },
    ]
    const { groupMoves } = computeCanonicalLayout(inputs, ['a', 'b'])
    expect(groupMoves.find((m) => m.groupId === 'a')!.size.width).toBe(CANVAS.DAY_GROUP_WIDTH_2COL)
    expect(groupMoves.find((m) => m.groupId === 'b')!.size.width).toBe(CANVAS.DAY_GROUP_WIDTH_1COL)
  })

  it('fills overflow rows left-to-right before moving to the next row', () => {
    const ten = Array.from({ length: 10 }, (_, i) => tk(`t${i}`, 'a', i * 10))
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 0), visualPos: { x: 0, y: 0 }, tasks: ten },
    ]
    const { taskMoves } = computeCanonicalLayout(inputs, ['a'])

    expect(taskMoves.slice(0, 2).map((t) => t.position.x)).toEqual([20, 260])
    expect(taskMoves.slice(0, 2).map((t) => t.position.y)).toEqual([70, 70])
    expect(taskMoves.slice(2, 4).map((t) => t.position.x)).toEqual([20, 260])
    expect(taskMoves.slice(2, 4).map((t) => t.position.y)).toEqual([182, 182])
  })

  it('can arrange tasks horizontally for the toolbar tidy action without changing default rotation layout', () => {
    const tasks = [tk('t1', 'a', 300), tk('t2', 'a', 100), tk('t3', 'a', 200)]
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 0), visualPos: { x: 0, y: 0 }, tasks },
    ]
    const { groupMoves, taskMoves } = computeCanonicalLayout(inputs, ['a'], { taskLayout: 'horizontal' })

    expect(taskMoves.map((t) => t.taskId)).toEqual(['t2', 't3', 't1'])
    expect(taskMoves.map((t) => t.position)).toEqual([
      { x: 20, y: 70 },
      { x: 260, y: 70 },
      { x: 20, y: 182 },
    ])
    expect(groupMoves[0].size.width).toBe(700)
  })

  it('orders tasks top-to-bottom using their current Y (stable ordering)', () => {
    // Tasks given in mixed order; layout should output them bottom-most-to-
    // top-most-in-store → sorted ascending Y → first task in moves is the
    // one that was top-most.
    const t1 = tk('t1', 'a', 500)
    const t2 = tk('t2', 'a', 100)
    const t3 = tk('t3', 'a', 300)
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 0), visualPos: { x: 0, y: 0 }, tasks: [t1, t2, t3] },
    ]
    const { taskMoves } = computeCanonicalLayout(inputs, ['a'])
    expect(taskMoves.map((t) => t.taskId)).toEqual(['t2', 't3', 't1'])
  })

  it('stacks tasks by measured height so edge gaps stay consistent', () => {
    const t1 = tk('t1', 'a', 100)
    const t2 = tk('t2', 'a', 200)
    const t3 = tk('t3', 'a', 300)
    const inputs: DayGroupInput[] = [
      {
        group: grp('a', 'A', 0, 0),
        visualPos: { x: 0, y: 0 },
        tasks: [t1, t2, t3],
        taskSizes: new Map([
          ['t1', { width: 220, height: 120 }],
          ['t2', { width: 220, height: 132 }],
          ['t3', { width: 220, height: 104 }],
        ]),
      },
    ]
    const { taskMoves } = computeCanonicalLayout(inputs, ['a'])

    expect(taskMoves.map((t) => t.position.y)).toEqual([
      70,
      214,
      358,
    ])
  })

  it('uses small-but-valid measured heights so compact cards stay close together', () => {
    const t1 = tk('t1', 'a', 100)
    const t2 = tk('t2', 'a', 200)
    const t3 = tk('t3', 'a', 300)
    const inputs: DayGroupInput[] = [
      {
        group: grp('a', 'A', 0, 0),
        visualPos: { x: 0, y: 0 },
        tasks: [t1, t2, t3],
        taskSizes: new Map([
          ['t1', { width: 220, height: 48 }],
          ['t2', { width: 220, height: 64 }],
          ['t3', { width: 220, height: 56 }],
        ]),
      },
    ]

    const { taskMoves } = computeCanonicalLayout(inputs, ['a'])

    expect(taskMoves.map((t) => t.position.y)).toEqual([
      70,
      134,
      214,
    ])
  })

  it('floors implausibly tiny measured heights so cards do not collapse together', () => {
    const t1 = tk('t1', 'a', 100)
    const t2 = tk('t2', 'a', 200)
    const t3 = tk('t3', 'a', 300)
    const inputs: DayGroupInput[] = [
      {
        group: grp('a', 'A', 0, 0),
        visualPos: { x: 0, y: 0 },
        tasks: [t1, t2, t3],
        taskSizes: new Map([
          ['t1', { width: 220, height: 1 }],
          ['t2', { width: 220, height: 1 }],
          ['t3', { width: 220, height: 1 }],
        ]),
      },
    ]

    const { taskMoves } = computeCanonicalLayout(inputs, ['a'])

    expect(taskMoves.map((t) => t.position.y)).toEqual([70, 182, 294])
  })

  it('can place varied-height cards on an equal top-to-top row pitch', () => {
    const t1 = tk('t1', 'a', 100)
    const t2 = tk('t2', 'a', 200)
    const t3 = tk('t3', 'a', 300)
    const inputs: DayGroupInput[] = [
      {
        group: grp('a', 'A', 0, 0),
        visualPos: { x: 0, y: 0 },
        tasks: [t1, t2, t3],
        taskSizes: new Map([
          ['t1', { width: 220, height: 120 }],
          ['t2', { width: 220, height: 132 }],
          ['t3', { width: 220, height: 104 }],
        ]),
      },
    ]

    const { taskMoves } = computeCanonicalLayout(inputs, ['a'], { taskSpacing: 'equalRows' })

    expect(taskMoves.map((t) => t.position.y)).toEqual([70, 214, 358])
    expect(taskMoves[1].position.y - taskMoves[0].position.y).toBe(144)
    expect(taskMoves[2].position.y - taskMoves[1].position.y).toBe(144)
  })

  it('keeps visual gaps consistent even when varied-height cards have uneven top edges', () => {
    const t1 = tk('t1', 'a', 100)
    const t2 = tk('t2', 'a', 200)
    const t3 = tk('t3', 'a', 300)
    const taskSizes = new Map([
      ['t1', { width: 220, height: 80 }],
      ['t2', { width: 220, height: 160 }],
      ['t3', { width: 220, height: 112 }],
    ])
    const inputs: DayGroupInput[] = [
      {
        group: grp('a', 'A', 0, 0),
        visualPos: { x: 0, y: 0 },
        tasks: [t1, t2, t3],
        taskSizes,
      },
    ]

    const { taskMoves } = computeCanonicalLayout(inputs, ['a'], { taskSpacing: 'contentGap' })

    expect(taskMoves[1].position.y - taskMoves[0].position.y).toBe(96)
    expect(taskMoves[2].position.y - taskMoves[1].position.y).toBe(176)
    const firstGap = taskMoves[1].position.y - (taskMoves[0].position.y + 80)
    const secondGap = taskMoves[2].position.y - (taskMoves[1].position.y + 160)
    expect(firstGap).toBe(16)
    expect(secondGap).toBe(16)
  })

  it('can compact tasks from their current top instead of teleporting them to the header', () => {
    const t1 = tk('t1', 'a', 520)
    const t2 = tk('t2', 'a', 700)
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 200), visualPos: { x: 0, y: 200 }, tasks: [t2, t1] },
    ]
    const { taskMoves } = computeCanonicalLayout(inputs, ['a'], { taskPositioning: 'compactFromCurrentTop' })

    expect(taskMoves.map((t) => t.position)).toEqual([
      { x: 20, y: 520 },
      { x: 20, y: 632 },
    ])
  })

  it('can preserve task offsets while moving groups', () => {
    const t1 = { ...tk('t1', 'a', 520), canvasPosition: { x: 140, y: 520 } }
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 100, 300), visualPos: { x: 100, y: 300 }, tasks: [t1 as Task] },
      { group: grp('b', 'B', 0, 100), visualPos: { x: 0, y: 100 }, tasks: [] },
    ]
    const { groupMoves, taskMoves } = computeCanonicalLayout(inputs, ['a', 'b'], { taskPositioning: 'preserveRelative' })

    expect(groupMoves[0].position).toEqual({ x: 0, y: 100 })
    expect(taskMoves[0].position).toEqual({ x: 40, y: 320 })
  })

  it('is pure — calling twice with same input returns deep-equal output', () => {
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 10, 20), visualPos: { x: 10, y: 20 }, tasks: [tk('t', 'a')] },
    ]
    const first = computeCanonicalLayout(inputs, ['a'])
    const second = computeCanonicalLayout(inputs, ['a'])
    expect(first).toEqual(second)
  })

  it('the 8th task bottom edge is fully inside the group bounds (BUG-1203 safety)', () => {
    // TASK-1756 v9: regression for off-by-40. BUG-1203's spatial validation
    // in useCanvasSync uses zero-padding `isNodeCompletelyInside`. If the
    // 8th task's bottom extends beyond the group's bottom edge by even 1px,
    // that task's parentId is cleared and it tears out of the group.
    const eight = Array.from({ length: 8 }, (_, i) => tk(`t${i}`, 'a', i * 10))
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 0), visualPos: { x: 0, y: 0 }, tasks: eight },
    ]
    const { groupMoves, taskMoves } = computeCanonicalLayout(inputs, ['a'])

    const group = groupMoves[0]
    const lastTask = taskMoves[taskMoves.length - 1]
    const groupBottom = group.position.y + group.size.height
    const lastTaskBottom = lastTask.position.y + CANVAS.DEFAULT_TASK_HEIGHT
    expect(lastTaskBottom).toBeLessThanOrEqual(groupBottom)
  })

  it('grows the group tall enough to contain many tall, grid-snapped tasks (TASK-1798 overflow)', () => {
    // Regression: with the old code the group height was summed from raw task
    // heights, but task Y is grid-snapped UP each step. With many tall cards the
    // real footprint drifted below the group's bottom edge and tasks overflowed.
    // Single column (maxTasksPerColumn: null, like Tidy) + tall measured cards.
    const tasks = Array.from({ length: 13 }, (_, i) => tk(`t${i}`, 'a', i * 200))
    const taskSizes = new Map(tasks.map((t) => [t.id, { width: 220, height: 140 }]))
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 0), visualPos: { x: 0, y: 0 }, tasks, taskSizes },
    ]
    const { groupMoves, taskMoves } = computeCanonicalLayout(inputs, ['a'], {
      taskPositioning: 'fromHeader',
      maxTasksPerColumn: null,
    })

    const group = groupMoves[0]
    const groupBottom = group.position.y + group.size.height
    // Every task's measured bottom edge must sit inside the group box.
    for (const move of taskMoves) {
      const bottom = move.position.y + 140
      expect(bottom).toBeLessThanOrEqual(groupBottom)
    }
    // Content clearly exceeds the 1000px floor, so this exercises real growth.
    expect(group.size.height).toBeGreaterThan(CANVAS.DAY_GROUP_HEIGHT)
  })

  it('skips orderedIds that have no matching input (defensive)', () => {
    const inputs: DayGroupInput[] = [
      { group: grp('a', 'A', 0, 0), visualPos: { x: 0, y: 0 }, tasks: [] },
    ]
    const { groupMoves } = computeCanonicalLayout(inputs, ['missing', 'a'])
    expect(groupMoves.length).toBe(1)
    expect(groupMoves[0].groupId).toBe('a')
  })

  // TASK-1809: Shift-drag reorder relies on the primitive stacking tasks by
  // their current Y order from the header down. A card dropped above another
  // (smaller Y) must take the top slot and push the rest down.
  describe('single-column reorder (TASK-1809)', () => {
    it('restacks tasks in ascending drop-Y order from the header, regardless of input order', () => {
      // Input order is t1, t2, t3 but their drop Y positions are interleaved:
      // t3 was dropped highest (y=110), so it must land in the first slot.
      const taskPositions = new Map<string, { x: number; y: number }>([
        ['t1', { x: 20, y: 400 }],
        ['t2', { x: 20, y: 250 }],
        ['t3', { x: 20, y: 110 }],
      ])
      const input: DayGroupInput = {
        group: grp('day', 'Today', 0, 0),
        visualPos: { x: 0, y: 0 },
        tasks: [tk('t1', 'day', 400), tk('t2', 'day', 250), tk('t3', 'day', 110)],
        taskPositions,
      }
      const { taskMoves } = computeCanonicalLayout([input], ['day'], {
        taskPositioning: 'fromHeader',
        maxTasksPerColumn: null,
        taskSpacing: 'contentGap',
      })

      // Order follows ascending drop-Y: t3 (110) → t2 (250) → t1 (400).
      expect(taskMoves.map((m) => m.taskId)).toEqual(['t3', 't2', 't1'])

      // Stacked top-to-bottom with no overlap.
      const ys = taskMoves.map((m) => m.position.y)
      expect(ys[0]).toBeLessThan(ys[1])
      expect(ys[1]).toBeLessThan(ys[2])

      // First card anchors just under the header (fromHeader, not the old top).
      expect(ys[0]).toBe(CANVAS.DAY_GROUP_HEADER_HEIGHT + CANVAS.GROUP_PADDING)

      // Single column — no side-by-side overflow.
      const xs = new Set(taskMoves.map((m) => m.position.x))
      expect(xs.size).toBe(1)
    })
  })
})
