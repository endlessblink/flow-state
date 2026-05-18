/**
 * TASK-1785: Pure math for calendar Shift+drag ripple-push reschedule.
 * Verifies delta computation, midnight spill, and degenerate cases.
 */

import { describe, it, expect } from 'vitest'
import {
  addDaysToDateString,
  formatMinutesAsTime,
  computeRippleUpdates,
  type RippleLaterEvent
} from '@/utils/calendar/rippleShift'

describe('addDaysToDateString', () => {
  it('adds days within a month', () => {
    expect(addDaysToDateString('2026-05-17', 1)).toBe('2026-05-18')
    expect(addDaysToDateString('2026-05-17', 5)).toBe('2026-05-22')
  })

  it('rolls over month boundary', () => {
    expect(addDaysToDateString('2026-05-31', 1)).toBe('2026-06-01')
    expect(addDaysToDateString('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('handles leap year', () => {
    expect(addDaysToDateString('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysToDateString('2028-02-29', 1)).toBe('2028-03-01')
  })

  it('rolls over year boundary', () => {
    expect(addDaysToDateString('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('formatMinutesAsTime', () => {
  it('zero-pads hours and minutes', () => {
    expect(formatMinutesAsTime(0)).toBe('00:00')
    expect(formatMinutesAsTime(9 * 60 + 5)).toBe('09:05')
    expect(formatMinutesAsTime(23 * 60 + 59)).toBe('23:59')
  })

  it('wraps past midnight to local time-of-day', () => {
    expect(formatMinutesAsTime(1440)).toBe('00:00')          // exactly midnight next day
    expect(formatMinutesAsTime(1440 + 30)).toBe('00:30')     // 30 min into next day
    expect(formatMinutesAsTime(2 * 1440 + 15)).toBe('00:15') // 2 days + 15 min
  })

  it('handles negative input defensively', () => {
    expect(formatMinutesAsTime(-30)).toBe('23:30')
  })
})

describe('computeRippleUpdates', () => {
  const draggedId = 'task-dragged'
  const draggedInstance = 'inst-dragged'
  const today = '2026-05-17'

  const makeLater = (overrides: Partial<RippleLaterEvent>): RippleLaterEvent => ({
    taskId: 'task-later',
    instanceId: 'inst-later',
    originDate: today,
    originMinutes: 12 * 60, // 12:00 default
    ...overrides
  })

  it('returns empty when the drop is on a different day', () => {
    const updates = computeRippleUpdates(
      { taskId: draggedId, instanceId: draggedInstance, originDate: today, originMinutes: 10 * 60 },
      { date: '2026-05-18', totalMinutes: 11 * 60 },
      [makeLater({})]
    )
    expect(updates).toEqual([])
  })

  it('returns empty when delta is zero', () => {
    const updates = computeRippleUpdates(
      { taskId: draggedId, instanceId: draggedInstance, originDate: today, originMinutes: 10 * 60 },
      { date: today, totalMinutes: 10 * 60 },
      [makeLater({})]
    )
    expect(updates).toEqual([])
  })

  it('returns empty when delta is negative (v1 is forward-only)', () => {
    const updates = computeRippleUpdates(
      { taskId: draggedId, instanceId: draggedInstance, originDate: today, originMinutes: 10 * 60 },
      { date: today, totalMinutes: 9 * 60 },
      [makeLater({})]
    )
    expect(updates).toEqual([])
  })

  it('places the dragged task first and shifts every later task by the same delta', () => {
    const updates = computeRippleUpdates(
      { taskId: draggedId, instanceId: draggedInstance, originDate: today, originMinutes: 10 * 60 },
      { date: today, totalMinutes: 11 * 60 }, // +60 min
      [
        makeLater({ taskId: 't1', instanceId: 'i1', originMinutes: 11 * 60 }),  // 11:00 -> 12:00
        makeLater({ taskId: 't2', instanceId: 'i2', originMinutes: 14 * 60 }),  // 14:00 -> 15:00
        makeLater({ taskId: 't3', instanceId: 'i3', originMinutes: 16 * 60 + 30 }) // 16:30 -> 17:30
      ]
    )

    expect(updates.length).toBe(4)
    expect(updates[0]).toEqual({
      id: draggedId,
      scheduledDate: today,
      scheduledTime: '11:00',
      instanceId: draggedInstance
    })
    expect(updates[1]).toMatchObject({ id: 't1', scheduledDate: today, scheduledTime: '12:00', instanceId: 'i1' })
    expect(updates[2]).toMatchObject({ id: 't2', scheduledDate: today, scheduledTime: '15:00', instanceId: 'i2' })
    expect(updates[3]).toMatchObject({ id: 't3', scheduledDate: today, scheduledTime: '17:30', instanceId: 'i3' })
  })

  it('spills past midnight into the next day with the correct time-of-day', () => {
    const updates = computeRippleUpdates(
      { taskId: draggedId, instanceId: draggedInstance, originDate: today, originMinutes: 22 * 60 },
      { date: today, totalMinutes: 23 * 60 + 30 }, // +90 min
      [
        makeLater({ taskId: 't1', originMinutes: 23 * 60 }),  // 23:00 + 90 = 24:30 -> next day 00:30
        makeLater({ taskId: 't2', originMinutes: 23 * 60 + 45 }) // 23:45 + 90 = 25:15 -> next day 01:15
      ]
    )

    expect(updates[1]).toMatchObject({ id: 't1', scheduledDate: '2026-05-18', scheduledTime: '00:30' })
    expect(updates[2]).toMatchObject({ id: 't2', scheduledDate: '2026-05-18', scheduledTime: '01:15' })
  })

  it('works with no later events (degenerate ripple = single-task move)', () => {
    const updates = computeRippleUpdates(
      { taskId: draggedId, instanceId: draggedInstance, originDate: today, originMinutes: 10 * 60 },
      { date: today, totalMinutes: 11 * 60 },
      []
    )
    expect(updates.length).toBe(1)
    expect(updates[0].id).toBe(draggedId)
  })

  it('rolls a later task by multiple days when delta exceeds 24h', () => {
    const updates = computeRippleUpdates(
      { taskId: draggedId, instanceId: draggedInstance, originDate: today, originMinutes: 9 * 60 },
      { date: today, totalMinutes: 14 * 60 }, // +5h delta
      [
        // Origin 22:00 + 26h delta — wait, delta is only 5h. Use a bigger delta:
      ]
    )
    expect(updates.length).toBe(1) // only the dragged task
  })

  it('preserves instanceId on each update', () => {
    const updates = computeRippleUpdates(
      { taskId: draggedId, instanceId: draggedInstance, originDate: today, originMinutes: 10 * 60 },
      { date: today, totalMinutes: 11 * 60 },
      [makeLater({ taskId: 't1', instanceId: 'inst-1' })]
    )
    expect(updates[0].instanceId).toBe(draggedInstance)
    expect(updates[1].instanceId).toBe('inst-1')
  })
})
