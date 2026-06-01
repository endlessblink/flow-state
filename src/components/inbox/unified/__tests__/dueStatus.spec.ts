import { describe, it, expect } from 'vitest'
import { computeDueStatus, representativeInstanceDate } from '../dueStatus'
import type { Task } from '@/types/tasks'

// today = 2026-06-01 (local), boundary for "next 3 days" = 2026-06-04 (exclusive)
const NOW = new Date(2026, 5, 1, 20, 0, 0)

const task = (overrides: Partial<Task>): Task =>
  ({ id: 't', title: 't', status: 'planned', ...overrides } as Task)

describe('representativeInstanceDate', () => {
  it('returns the soonest upcoming instance (>= today)', () => {
    const t = task({ instances: [
      { scheduledDate: '2026-05-25' },
      { scheduledDate: '2026-06-02' },
      { scheduledDate: '2026-06-09' },
    ] as Task['instances'] })
    expect(representativeInstanceDate(t, '2026-06-01')).toBe('2026-06-02')
  })

  it('falls back to the latest past instance when none are upcoming', () => {
    const t = task({ instances: [
      { scheduledDate: '2026-05-20' },
      { scheduledDate: '2026-05-29' },
    ] as Task['instances'] })
    expect(representativeInstanceDate(t, '2026-06-01')).toBe('2026-05-29')
  })

  it('returns null with no instances', () => {
    expect(representativeInstanceDate(task({}), '2026-06-01')).toBeNull()
  })
})

describe('computeDueStatus', () => {
  // BUG-1810: the reported bug — recurring task with far-future master dueDate but a
  // near-term instance. The badge must reflect the in-window instance, not Jun 8.
  it('shows the near-term instance date for a recurring task, not the far dueDate', () => {
    // instance Jun 3 is in-window but not today/tomorrow → shows "Jun 3", not "Jun 8"
    const t = task({
      dueDate: '2026-06-08',
      instances: [{ scheduledDate: '2026-06-03' }] as Task['instances'],
    })
    expect(computeDueStatus(t, NOW)).toEqual({ type: 'scheduled-future', text: 'Jun 3' })

    // instance tomorrow (Jun 2) → friendly "Tomorrow" label, still not Jun 8
    const t2 = task({
      dueDate: '2026-06-08',
      instances: [{ scheduledDate: '2026-06-02' }] as Task['instances'],
    })
    expect(computeDueStatus(t2, NOW)).toEqual({ type: 'scheduled-tomorrow', text: 'Tomorrow' })
  })

  it('labels a past representative instance as overdue, not future', () => {
    const t = task({
      dueDate: '2026-06-08',
      instances: [{ scheduledDate: '2026-05-29' }] as Task['instances'],
    })
    expect(computeDueStatus(t, NOW)).toEqual({ type: 'overdue', text: 'Overdue May 29' })
  })

  it('uses the master dueDate when there are no instances', () => {
    expect(computeDueStatus(task({ dueDate: '2026-06-08' }), NOW)).toEqual({
      type: 'future',
      text: 'Jun 8',
    })
  })

  it('marks a plain dueDate today / tomorrow / overdue correctly', () => {
    expect(computeDueStatus(task({ dueDate: '2026-06-01' }), NOW)?.type).toBe('today')
    expect(computeDueStatus(task({ dueDate: '2026-06-02' }), NOW)?.type).toBe('tomorrow')
    expect(computeDueStatus(task({ dueDate: '2026-05-29' }), NOW)?.type).toBe('overdue')
  })

  it('falls back to scheduledDate when no dueDate and no instances', () => {
    expect(computeDueStatus(task({ scheduledDate: '2026-06-03' }), NOW)).toEqual({
      type: 'scheduled-future',
      text: 'Jun 3',
    })
  })

  it('returns null when the task has no date information', () => {
    expect(computeDueStatus(task({}), NOW)).toBeNull()
  })
})
