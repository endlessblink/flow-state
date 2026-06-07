import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'
import {
  buildDayPlanTaskUpdates,
  flattenDayPlanTaskIds,
  isOverwhelmedDayPlanRequest,
} from '@/services/ai/pipeline/dayPlan'

const todayGroup = {
  id: 'group-today',
  name: 'Today',
  type: 'custom',
  isVisible: true,
  position: { x: 100, y: 200, width: 360, height: 300 },
} as CanvasGroup

function task(overrides: Partial<Task> & { id: string; title?: string }): Task {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    status: 'todo',
    priority: 'medium',
    createdAt: '2026-06-06T00:00:00.000Z',
    updatedAt: '2026-06-06T00:00:00.000Z',
    ...overrides,
  } as Task
}

describe('AI day plan helpers', () => {
  // The day-plan tests below pass a hardcoded "today" of 2026-06-06, but the
  // group matcher (findMatchingGroupForDueDate → getSmartGroupDate) reads the
  // real system clock to resolve the "Today" group. Pin the clock so the two
  // agree regardless of when the suite runs.
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-06T12:00:00'))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('detects overwhelmed day-plan requests in English and Hebrew', () => {
    expect(isOverwhelmedDayPlanRequest("I'm overwhelmed, reorder my day")).toBe(true)
    expect(isOverwhelmedDayPlanRequest('אני מוצף, תסדר לי את היום')).toBe(true)
    expect(isOverwhelmedDayPlanRequest('show me my projects')).toBe(false)
  })

  it('flattens grouped plan tasks without duplicates', () => {
    expect(flattenDayPlanTaskIds([
      { name: 'A', tasks: [{ id: 't1' }, { id: 't2' }] },
      { name: 'B', tasks: [{ id: 't2' }, { id: 't3' }] },
    ])).toEqual(['t1', 't2', 't3'])
  })

  it('puts planned tasks first in the Today group and preserves existing siblings after them', () => {
    const result = buildDayPlanTaskUpdates(
      [
        { name: 'First', tasks: [{ id: 't2' }, { id: 't1' }] },
      ],
      [
        task({ id: 't1', title: 'First planned' }),
        task({ id: 't2', title: 'Second planned' }),
        task({ id: 'existing', title: 'Existing today', parentId: 'group-today', canvasPosition: { x: 120, y: 260 } }),
      ],
      [todayGroup],
      '2026-06-06',
    )

    expect(result.targetGroupName).toBe('Today')
    expect(result.plannedCount).toBe(2)
    expect(result.taskUpdates.map(update => update.id)).toEqual(['t2', 't1', 'existing'])
    expect(result.taskUpdates[0].updates).toMatchObject({
      dueDate: '2026-06-06',
      parentId: 'group-today',
      canvasPosition: { x: 120, y: 270 },
      isInInbox: false,
      canvasDismissed: false,
    })
    expect(result.taskUpdates[1].updates.canvasPosition).toEqual({ x: 120, y: 380 })
    expect(result.taskUpdates[2].updates).not.toHaveProperty('dueDate')
    expect(result.taskUpdates[2].updates.canvasPosition).toEqual({ x: 120, y: 490 })
  })

  it('falls back to due-date updates when there is no Today group', () => {
    const result = buildDayPlanTaskUpdates(
      [{ name: 'First', tasks: [{ id: 't1' }] }],
      [task({ id: 't1' })],
      [],
      '2026-06-06',
    )

    expect(result.targetGroupName).toBeNull()
    expect(result.taskUpdates).toEqual([{ id: 't1', updates: { dueDate: '2026-06-06' } }])
  })
})
