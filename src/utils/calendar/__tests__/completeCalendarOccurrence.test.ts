import { describe, expect, it } from 'vitest'
import type { Task } from '@/types/tasks'
import { buildCalendarDoneForTodayUpdate } from '../completeCalendarOccurrence'

const task = {
  id: 'task-1',
  dueDate: '2026-08-02',
  scheduledDate: '2026-08-02',
  instances: [
    {
      id: 'instance-today',
      taskId: 'task-1',
      scheduledDate: '2026-08-02',
      scheduledTime: '09:00',
      duration: 45,
      status: 'scheduled'
    }
  ]
} as unknown as Task

describe('buildCalendarDoneForTodayUpdate', () => {
  it('completes only the selected occurrence and preserves other scheduled blocks and history', () => {
    const current = (task.instances ?? [])[0]
    const history = { ...current, id: 'history', scheduledDate: '2026-08-01', status: 'completed' as const }
    const laterToday = { ...current, id: 'later-today', scheduledTime: '16:00' }
    const future = { ...current, id: 'future', scheduledDate: '2026-08-05', scheduledTime: '14:00' }
    const update = buildCalendarDoneForTodayUpdate(
      { ...task, instances: [history, ...(task.instances ?? []), laterToday, future] }, 'instance-today', '2026-08-03'
    )
    expect(update.instances).toEqual([
      history, { ...current, status: 'completed' }, laterToday, future
    ])
    expect(update.scheduledTime).toBeUndefined()
    expect(update.dueDate).toBe('2026-08-03')
  })

  it('preserves all existing occurrences when the selected occurrence is missing', () => {
    const update = buildCalendarDoneForTodayUpdate(task, 'missing', '2026-08-03')
    expect(update.instances).toEqual(task.instances)
  })

  it('keeps today completed and returns tomorrow to the date-only inbox', () => {
    const update = buildCalendarDoneForTodayUpdate(task, 'instance-today', '2026-08-03', () => 'instance-tomorrow')

    expect(update).toMatchObject({
      dueDate: '2026-08-03',
      doneForNowUntil: '2026-08-03'
    })
    expect(update.scheduledDate).toBeUndefined()
    expect(update.scheduledTime).toBeUndefined()
    expect(update.dueTime).toBeUndefined()
    expect(update.instances).toEqual([
      expect.objectContaining({
        id: 'instance-today',
        scheduledDate: '2026-08-02',
        scheduledTime: '09:00',
        status: 'completed'
      })
    ])
  })
})
