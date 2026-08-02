import { describe, expect, it } from 'vitest'
import { isCalendarInboxTaskDueToday } from '@/utils/calendar/inboxTodayFilter'

describe('calendar inbox Today filter', () => {
  it('hides an event scheduled today when its due date is in the future', () => {
    expect(
      isCalendarInboxTaskDueToday(
        { dueDate: '2026-08-04' },
        new Date('2026-08-02T12:00:00+03:00'),
      ),
    ).toBe(false)
  })

  it('shows a task whose due date is today', () => {
    expect(
      isCalendarInboxTaskDueToday(
        { dueDate: '2026-08-02' },
        new Date('2026-08-02T12:00:00+03:00'),
      ),
    ).toBe(true)
  })
})
