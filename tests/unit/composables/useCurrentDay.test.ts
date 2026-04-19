/**
 * TASK-1756: Verify the shared reactive today ref updates at midnight so
 * canvas group headers refresh without manual reload.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  useCurrentDay,
  __forceRefreshCurrentDay,
  __resetCurrentDayForTest,
} from '@/composables/useCurrentDay'

const THURSDAY_23_59 = new Date(2026, 3, 16, 23, 59, 0, 0) // Apr 16 2026 23:59
const FRIDAY_00_01 = new Date(2026, 3, 17, 0, 1, 0, 0)     // Apr 17 2026 00:01

describe('useCurrentDay()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(THURSDAY_23_59)
    __resetCurrentDayForTest()
  })
  afterEach(() => {
    __resetCurrentDayForTest()
    vi.useRealTimers()
  })

  it('flips when the clock crosses midnight and the internal timer fires', () => {
    const today = useCurrentDay()
    // At 23:59 on Thursday the ref should still read Thursday (start of day)
    expect(today.value.getDate()).toBe(16)

    // Advance past midnight and let the scheduled timer run
    vi.setSystemTime(FRIDAY_00_01)
    vi.advanceTimersByTime(2 * 60 * 1000) // 2 minutes

    expect(today.value.getDate()).toBe(17)
  })

  it('manual force-refresh picks up the new day immediately (tab-visibility path)', () => {
    const today = useCurrentDay()
    expect(today.value.getDate()).toBe(16)

    vi.setSystemTime(FRIDAY_00_01)
    __forceRefreshCurrentDay()

    expect(today.value.getDate()).toBe(17)
  })

  it('returns the same ref instance across calls (singleton)', () => {
    const a = useCurrentDay()
    const b = useCurrentDay()
    expect(a).toBe(b)
  })

  // ------------------------------------------------------------------------
  // TASK-1756: resume-from-dormant signals — pageshow, focus, online
  // ------------------------------------------------------------------------

  it('picks up the new day on a `focus` event (Electron window regain)', () => {
    const today = useCurrentDay()
    expect(today.value.getDate()).toBe(16)

    vi.setSystemTime(FRIDAY_00_01)
    window.dispatchEvent(new Event('focus'))

    expect(today.value.getDate()).toBe(17)
  })

  it('picks up the new day on a `pageshow` event (bfcache restore)', () => {
    const today = useCurrentDay()
    expect(today.value.getDate()).toBe(16)

    vi.setSystemTime(FRIDAY_00_01)
    window.dispatchEvent(new Event('pageshow'))

    expect(today.value.getDate()).toBe(17)
  })

  it('picks up the new day on an `online` event (PWA offline→online)', () => {
    const today = useCurrentDay()
    expect(today.value.getDate()).toBe(16)

    vi.setSystemTime(FRIDAY_00_01)
    window.dispatchEvent(new Event('online'))

    expect(today.value.getDate()).toBe(17)
  })
})
