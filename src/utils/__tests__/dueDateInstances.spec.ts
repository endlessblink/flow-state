/**
 * BUG-1909: due-date edits must reconcile stale past calendar instances,
 * otherwise the card badge stays pinned to "Overdue <old date>" (permanently
 * for recurring tasks, where computeDueStatus keeps instance authority) and
 * every quick-set click looks like a no-op.
 */
import { describe, it, expect } from 'vitest'
import { reconcileStaleInstancesForDueDate } from '../dueDateInstances'
import { computeDueStatus } from '@/components/inbox/unified/dueStatus'
import type { Task } from '@/types/tasks'

const NOW = new Date(2026, 6, 3, 11, 0, 0) // 2026-07-03 local

const inst = (id: string, scheduledDate: string, extra: Record<string, unknown> = {}) =>
  ({ id, scheduledDate, scheduledTime: '10:00', duration: 60, ...extra }) as NonNullable<Task['instances']>[number]

describe('BUG-1909: reconcileStaleInstancesForDueDate', () => {
  it('reschedules a stale past instance onto the picked due date', () => {
    const result = reconcileStaleInstancesForDueDate({ instances: [inst('a', '2026-05-30')] }, '2026-07-10', NOW)
    expect(result).toHaveLength(1)
    expect(result![0]).toMatchObject({ id: 'a', scheduledDate: '2026-07-10', scheduledTime: '10:00', duration: 60 })
  })

  it('leaves future instances untouched (deliberate calendar placements)', () => {
    const result = reconcileStaleInstancesForDueDate(
      { instances: [inst('past', '2026-05-30'), inst('future', '2026-07-05')] },
      '2026-07-10',
      NOW
    )
    expect(result![0].scheduledDate).toBe('2026-07-10')
    expect(result![1].scheduledDate).toBe('2026-07-05')
  })

  it('returns undefined when nothing is stale — callers must not write instances back', () => {
    expect(reconcileStaleInstancesForDueDate({ instances: [inst('f', '2026-07-05')] }, '2026-07-10', NOW)).toBeUndefined()
    expect(reconcileStaleInstancesForDueDate({ instances: [] }, '2026-07-10', NOW)).toBeUndefined()
    expect(reconcileStaleInstancesForDueDate({ instances: undefined }, '2026-07-10', NOW)).toBeUndefined()
    expect(reconcileStaleInstancesForDueDate(null, '2026-07-10', NOW)).toBeUndefined()
  })

  it('accepts a full ISO due date and stores the date part', () => {
    const result = reconcileStaleInstancesForDueDate({ instances: [inst('a', '2026-05-30T10:00:00+00:00')] }, '2026-07-10T00:00:00+00:00', NOW)
    expect(result![0].scheduledDate).toBe('2026-07-10')
  })

  it('USER REPRO end-to-end: recurring task badge moves off "Overdue May 30" after quick-set', () => {
    const task = {
      id: 't1',
      title: 'weekly plan',
      status: 'todo',
      dueDate: '2026-07-04',
      recurrenceRule: { pattern: 'weekly', interval: 1 },
      instances: [inst('a', '2026-05-30')],
    } as unknown as Task

    // Before the fix: badge pinned to the stale past instance
    expect(computeDueStatus(task, NOW)?.text).toBe('Overdue May 30')

    // After the write-side reconcile: badge follows the picked date
    const reconciled = reconcileStaleInstancesForDueDate(task, '2026-07-04', NOW)
    expect(reconciled).toBeTruthy()
    const updated = { ...task, instances: reconciled } as Task
    expect(computeDueStatus(updated, NOW)).toMatchObject({ text: 'Tomorrow' })
  })
})
