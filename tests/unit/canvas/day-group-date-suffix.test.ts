/**
 * TASK-1756 (reopened 2026-04-17):
 * Both the canvas group header suffix (GroupNodeSimple.vue) and the midnight
 * rotation (useDayGroupRotation.ts) must resolve the same date for a given
 * weekday. These tests pin down the shared helper that both call.
 *
 * Regression: the old code in GroupNodeSimple.vue used `((7 + dayIndex -
 * today.getDay()) % 7) || 7`, which turned today=target into +7 days. That
 * caused the Friday group on a Friday to display next Friday's date while
 * the rotation set tasks' dueDate to today — header and rotation disagreed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getDayGroupDate,
  toDateString,
  formatDayGroupSuffix,
} from '@/utils/dayGroupDate'

const FRIDAY_2026_04_17 = new Date(2026, 3, 17, 12, 0, 0, 0)

describe('getDayGroupDate()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FRIDAY_2026_04_17)
  })
  afterEach(() => vi.useRealTimers())

  it('Friday group on a Friday with NO smart group resolves to today', () => {
    const d = getDayGroupDate(5, FRIDAY_2026_04_17, false)
    expect(toDateString(d)).toBe('2026-04-17')
  })

  it('Friday group on a Friday WITH Today smart-group resolves to next Friday', () => {
    const d = getDayGroupDate(5, FRIDAY_2026_04_17, true)
    expect(toDateString(d)).toBe('2026-04-24')
  })

  it('Saturday group on a Friday resolves to tomorrow (no smart group)', () => {
    const d = getDayGroupDate(6, FRIDAY_2026_04_17, false)
    expect(toDateString(d)).toBe('2026-04-18')
  })

  it('Saturday group on a Friday with Today/Tomorrow smart-group skips a week', () => {
    // Tomorrow (Sat) is already covered by Tomorrow smart-group → show next Saturday
    const d = getDayGroupDate(6, FRIDAY_2026_04_17, true)
    expect(toDateString(d)).toBe('2026-04-25')
  })

  it('Sunday group on a Friday resolves to Apr 19 (2 days out)', () => {
    const d = getDayGroupDate(0, FRIDAY_2026_04_17, false)
    expect(toDateString(d)).toBe('2026-04-19')
  })

  it('Thursday group on a Friday resolves to next Thursday (6 days out)', () => {
    const d = getDayGroupDate(4, FRIDAY_2026_04_17, false)
    expect(toDateString(d)).toBe('2026-04-23')
  })

  it('header suffix formatter matches the D.M.YY layout used in GroupNodeSimple', () => {
    expect(formatDayGroupSuffix(new Date(2026, 3, 17))).toBe('17.4.26')
    expect(formatDayGroupSuffix(new Date(2026, 11, 5))).toBe('5.12.26')
  })
})
