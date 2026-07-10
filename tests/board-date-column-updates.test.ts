/**
 * BUG-1935: the patch a Board due-date column drop applies to the dragged task.
 *
 * The bug: the drop wrote only `{ dueDate }`, but grouping keyed on calendar instances,
 * so the card re-bucketed to its origin column and the drag appeared to do nothing.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { getDateColumnUpdates, isDropTarget } from '@/composables/board/dateColumnUpdates'
import type { Task, TaskInstance } from '@/types/tasks'

function makeTask(overrides: Partial<Task> = {}): Task {
  return { id: 't1', title: 'Test', status: 'pending', ...overrides } as Task
}

function inst(overrides: Partial<TaskInstance> & { scheduledDate: string }): TaskInstance {
  return { id: 'inst-1', scheduledTime: '09:00', duration: 60, ...overrides }
}

/** Freeze "today" at Friday 2026-03-06. */
function mockToday() {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 2, 6, 10, 0, 0).getTime())
}

afterEach(() => {
  vi.useRealTimers()
})

describe('isDropTarget', () => {
  it('rejects the overdue column — "make this task late" is not a user intent', () => {
    expect(isDropTarget('overdue')).toBe(false)
  })

  it('accepts every other date column', () => {
    for (const column of ['noDate', 'today', 'tomorrow', 'thisWeek', 'nextWeek', 'later']) {
      expect(isDropTarget(column)).toBe(true)
    }
  })
})

describe('getDateColumnUpdates', () => {
  it('returns null for the overdue column so the caller can refuse the drop', () => {
    mockToday()
    expect(getDateColumnUpdates(makeTask(), 'overdue')).toBeNull()
  })

  it('sets dueDate to the target day', () => {
    mockToday()
    expect(getDateColumnUpdates(makeTask(), 'today')?.dueDate).toBe('2026-03-06')
    expect(getDateColumnUpdates(makeTask(), 'tomorrow')?.dueDate).toBe('2026-03-07')
  })

  it('rebases a past instance onto the target day, preserving time and identity', () => {
    mockToday()
    const task = makeTask({ instances: [inst({ scheduledDate: '2026-03-02', scheduledTime: '18:30' })] })

    const updates = getDateColumnUpdates(task, 'today')

    expect(updates?.dueDate).toBe('2026-03-06')
    expect(updates?.instances).toEqual([
      { id: 'inst-1', scheduledDate: '2026-03-06', scheduledTime: '18:30', duration: 60 },
    ])
  })

  it('leaves future instances alone and omits the key entirely', () => {
    mockToday()
    const task = makeTask({ instances: [inst({ scheduledDate: '2026-03-20' })] })

    const updates = getDateColumnUpdates(task, 'today')

    // Omitted, not `[]` — an `instances` key would trip syncDateFields' instances→dueDate back-sync.
    expect(updates).not.toHaveProperty('instances')
    expect(updates?.dueDate).toBe('2026-03-06')
  })

  it('never rebases an isLater instance', () => {
    mockToday()
    const task = makeTask({ instances: [inst({ scheduledDate: '2026-03-02', isLater: true })] })
    expect(getDateColumnUpdates(task, 'today')).not.toHaveProperty('instances')
  })

  it('rebases recurringInstances too', () => {
    mockToday()
    const task = makeTask({ recurringInstances: [inst({ scheduledDate: '2026-03-02' })] })

    const updates = getDateColumnUpdates(task, 'tomorrow')

    expect(updates?.recurringInstances?.[0].scheduledDate).toBe('2026-03-07')
  })

  it('noDate clears dueDate, instances AND recurringInstances', () => {
    mockToday()
    const task = makeTask({
      dueDate: '2026-03-02',
      instances: [inst({ scheduledDate: '2026-03-02' })],
      recurringInstances: [inst({ id: 'r1', scheduledDate: '2026-03-02' })],
    })

    const updates = getDateColumnUpdates(task, 'noDate')

    expect(updates).toEqual({ dueDate: undefined, instances: [], recurringInstances: [] })
  })

  it('inbox clears dates and flags the task as inbox', () => {
    mockToday()
    const updates = getDateColumnUpdates(makeTask(), 'inbox')
    expect(updates?.isInInbox).toBe(true)
    expect(updates?.dueDate).toBeUndefined()
  })
})
