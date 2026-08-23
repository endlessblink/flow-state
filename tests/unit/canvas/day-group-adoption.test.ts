import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  collectDayGroupAdoptions,
  isEligibleForDayGroupAdoption,
} from '@/composables/canvas/useCanvasDayGroupAdoption'
import type { CanvasGroup } from '@/types/canvas'
import type { Task } from '@/types/tasks'

const today = new Date(2026, 3, 19, 10, 0, 0, 0)

function group(id: string, name: string): CanvasGroup {
  return {
    id,
    name,
    isVisible: true,
    position: { x: 0, y: 0, width: 400, height: 600 },
  } as CanvasGroup
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Active task',
    status: 'todo',
    dueDate: '2026-04-19',
    parentId: 'wrong-group',
    canvasPosition: { x: 900, y: 900 },
    ...overrides,
  } as Task
}

describe('Canvas day-group adoption', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(today)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shares one eligibility rule for a matching active task', () => {
    expect(isEligibleForDayGroupAdoption(task())).toBe(true)
    expect(collectDayGroupAdoptions([task()], [group('today', 'Today')])).toEqual(
      new Map([['task-1', 'today']]),
    )
  })

  it.each([
    ['undated', { dueDate: undefined }],
    ['completed', { status: 'done' }],
    ['pinned', { isPinned: true }],
    ['deleted', { _soft_deleted: true }],
    ['dismissed', { canvasDismissed: true }],
    ['explicitly hidden', { isVisible: false }],
  ])('leaves %s tasks untouched', (_label, overrides) => {
    const candidate = task(overrides as Partial<Task> & { isVisible?: boolean })
    expect(isEligibleForDayGroupAdoption(candidate)).toBe(false)
    expect(collectDayGroupAdoptions([candidate], [group('today', 'Today')])).toEqual(new Map())
  })

  it('adopts a task without a current canvas position when its due date matches', () => {
    const candidate = task({ canvasPosition: undefined })
    expect(collectDayGroupAdoptions([candidate], [group('today', 'Today')])).toEqual(
      new Map([['task-1', 'today']]),
    )
  })
})
