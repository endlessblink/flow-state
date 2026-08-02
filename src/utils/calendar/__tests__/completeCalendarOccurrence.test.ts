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
  it('keeps today completed and creates a separate tomorrow occurrence', () => {
    const update = buildCalendarDoneForTodayUpdate(task, 'instance-today', '2026-08-03', () => 'instance-tomorrow')

    expect(update).toMatchObject({
      dueDate: '2026-08-03',
      scheduledDate: '2026-08-03',
      doneForNowUntil: '2026-08-03'
    })
    expect(update.instances).toEqual([
      expect.objectContaining({
        id: 'instance-today',
        scheduledDate: '2026-08-02',
        status: 'completed'
      }),
      expect.objectContaining({
        id: 'instance-tomorrow',
        taskId: 'task-1',
        scheduledDate: '2026-08-03',
        scheduledTime: '09:00',
        duration: 45,
        status: 'scheduled'
      })
    ])
  })
})
