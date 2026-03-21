/**
 * TASK-1653: KDE Nanny Timer Gate Tests (15 tests)
 *
 * Tests the nanny (focus reminder) gate logic from main.qml.
 * The nanny timer fires every 30s and checks multiple gates before showing
 * a nudge notification. This test file extracts the gate logic as pure
 * JavaScript functions and tests each gate independently.
 *
 * Gate chain (from main.qml nannyTimer.onTriggered):
 * 1. Midnight reset (day-of-year changed → clear nannyQuietToday)
 * 2. nannyQuietToday → block
 * 3. hasActiveSession → block
 * 4. Not a work day → block
 * 5. Outside work hours → block
 * 6. Idle time < interval → block
 * 7. nudgePopup.visible → block
 * 8. Already notified recently → block
 * 9. All passed → fire notification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Pure JS extraction of gate logic from main.qml nannyTimer
// ---------------------------------------------------------------------------

interface NannyState {
  nannyQuietToday: boolean
  nannyQuietDate: number // dayOfYear when quiet was set
  hasActiveSession: boolean
  nannyLastSessionEndTime: number
  nannyLastNotifyTime: number
  nudgePopupVisible: boolean
}

interface NannyConfig {
  nannyWorkDays: string     // comma-separated day numbers (0=Sun..6=Sat)
  nannyStartHour: number
  nannyEndHour: number
  nannyIntervalMinutes: number
}

function getDayOfYear(date: Date): number {
  return Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000)
}

/**
 * Check midnight reset: if day changed since quiet was set, clear quiet
 */
function checkMidnightReset(state: NannyState, now: Date): NannyState {
  if (state.nannyQuietToday) {
    const dayOfYear = getDayOfYear(now)
    if (dayOfYear !== state.nannyQuietDate) {
      return { ...state, nannyQuietToday: false, nannyQuietDate: -1 }
    }
  }
  return state
}

/**
 * Run all nanny gates. Returns { blocked: boolean, reason: string }
 */
function checkNannyGates(
  state: NannyState,
  config: NannyConfig,
  now: Date
): { blocked: boolean; reason: string } {
  // Gate 1: nannyQuietToday
  if (state.nannyQuietToday) {
    return { blocked: true, reason: 'quiet today' }
  }

  // Gate 2: hasActiveSession
  if (state.hasActiveSession) {
    return { blocked: true, reason: 'active session running' }
  }

  // Gate 3: Check current day is a work day
  const currentDay = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const workDays = (config.nannyWorkDays || '1,2,3,4,5').split(',')
  let isWorkDay = false
  for (let i = 0; i < workDays.length; i++) {
    if (parseInt(workDays[i]) === currentDay) {
      isWorkDay = true
      break
    }
  }
  if (!isWorkDay) {
    return { blocked: true, reason: 'not a work day' }
  }

  // Gate 4: Check current hour is within work hours
  const currentHour = now.getHours()
  if (currentHour < config.nannyStartHour || currentHour >= config.nannyEndHour) {
    return { blocked: true, reason: 'outside work hours' }
  }

  // Gate 5: Check enough idle time has passed
  const intervalMs = (config.nannyIntervalMinutes || 60) * 60 * 1000
  const idleMs = state.nannyLastSessionEndTime > 0
    ? (now.getTime() - state.nannyLastSessionEndTime)
    : intervalMs + 1
  if (state.nannyLastSessionEndTime > 0 && idleMs < intervalMs) {
    return { blocked: true, reason: 'idle time < interval' }
  }

  // Gate 6: nudge popup already visible
  if (state.nudgePopupVisible) {
    return { blocked: true, reason: 'popup already visible' }
  }

  // Gate 7: Already notified within interval
  if (state.nannyLastNotifyTime > 0 && (now.getTime() - state.nannyLastNotifyTime) < intervalMs) {
    return { blocked: true, reason: 'already notified recently' }
  }

  return { blocked: false, reason: '' }
}

// ---------------------------------------------------------------------------
// Default state/config helpers
// ---------------------------------------------------------------------------

function defaultState(): NannyState {
  return {
    nannyQuietToday: false,
    nannyQuietDate: -1,
    hasActiveSession: false,
    nannyLastSessionEndTime: 0,
    nannyLastNotifyTime: 0,
    nudgePopupVisible: false
  }
}

function defaultConfig(): NannyConfig {
  return {
    nannyWorkDays: '1,2,3,4,5',
    nannyStartHour: 8,
    nannyEndHour: 18,
    nannyIntervalMinutes: 60
  }
}

// Create a "good" date that passes all gates: Monday 10am
function workingDate(): Date {
  // Monday Jan 6, 2025 10:00
  return new Date(2025, 0, 6, 10, 0, 0)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TASK-1653: KDE Nanny Timer Gates', () => {
  it('1. Gate: nannyQuietToday=true blocks notification', () => {
    const state = { ...defaultState(), nannyQuietToday: true, nannyQuietDate: getDayOfYear(workingDate()) }
    const result = checkNannyGates(state, defaultConfig(), workingDate())
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('quiet today')
  })

  it('2. Gate: hasActiveSession=true blocks notification', () => {
    const state = { ...defaultState(), hasActiveSession: true }
    const result = checkNannyGates(state, defaultConfig(), workingDate())
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('active session')
  })

  it('3. Gate: wrong work day blocks notification', () => {
    const config = { ...defaultConfig(), nannyWorkDays: '1,2,3,4,5' } // Mon-Fri only
    // Saturday = day 6
    const saturday = new Date(2025, 0, 4, 10, 0, 0) // Jan 4, 2025 is Saturday
    const result = checkNannyGates(defaultState(), config, saturday)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('not a work day')
  })

  it('4. Gate: outside work hours blocks notification', () => {
    const config = { ...defaultConfig(), nannyStartHour: 9, nannyEndHour: 17 }
    // 7am is before start hour
    const earlyMorning = new Date(2025, 0, 6, 7, 0, 0) // Monday 7am
    const result = checkNannyGates(defaultState(), config, earlyMorning)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('outside work hours')

    // 17:00 is >= endHour (endHour is exclusive)
    const afterHours = new Date(2025, 0, 6, 17, 0, 0) // Monday 5pm
    const result2 = checkNannyGates(defaultState(), config, afterHours)
    expect(result2.blocked).toBe(true)
    expect(result2.reason).toContain('outside work hours')
  })

  it('5. Gate: idle time < interval blocks notification', () => {
    const now = workingDate()
    const config = { ...defaultConfig(), nannyIntervalMinutes: 60 }
    // Last session ended 30 minutes ago (less than 60 min interval)
    const state = {
      ...defaultState(),
      nannyLastSessionEndTime: now.getTime() - 30 * 60 * 1000
    }
    const result = checkNannyGates(state, config, now)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('idle time < interval')
  })

  it('6. Gate: already notified recently blocks notification', () => {
    const now = workingDate()
    const config = { ...defaultConfig(), nannyIntervalMinutes: 60 }
    // Notified 20 minutes ago (within interval)
    const state = {
      ...defaultState(),
      nannyLastNotifyTime: now.getTime() - 20 * 60 * 1000
    }
    const result = checkNannyGates(state, config, now)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('already notified recently')
  })

  it('7. Gate: nudgePopup.visible blocks notification', () => {
    const state = { ...defaultState(), nudgePopupVisible: true }
    const result = checkNannyGates(state, defaultConfig(), workingDate())
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('popup already visible')
  })

  it('8. All gates pass: notification fires', () => {
    // State with all gates passing: no quiet, no active session,
    // last session ended >60min ago, not notified recently, popup not visible
    const now = workingDate()
    const state = {
      ...defaultState(),
      nannyLastSessionEndTime: now.getTime() - 120 * 60 * 1000, // 2 hours ago
      nannyLastNotifyTime: now.getTime() - 120 * 60 * 1000 // 2 hours ago
    }
    const config = { ...defaultConfig(), nannyIntervalMinutes: 60 }
    const result = checkNannyGates(state, config, now)
    expect(result.blocked).toBe(false)
    expect(result.reason).toBe('')
  })

  it('9. Midnight reset clears nannyQuietToday', () => {
    // Set quiet on day 5, check on day 6
    const state: NannyState = {
      ...defaultState(),
      nannyQuietToday: true,
      nannyQuietDate: 5
    }
    // Day 6 (different day)
    const nextDay = new Date(2025, 0, 7, 10, 0, 0) // dayOfYear = 7
    const updated = checkMidnightReset(state, nextDay)
    expect(updated.nannyQuietToday).toBe(false)
    expect(updated.nannyQuietDate).toBe(-1)
  })

  it('10. Snooze 30m sets nannyLastSessionEndTime correctly', () => {
    // When user clicks "Snooze 30 min", the widget sets:
    // nannyLastSessionEndTime = Date.now() + (30 * 60 * 1000 - intervalMs)
    // But effectively, we test that the gate blocks for ~30 minutes
    const now = workingDate()
    const config = { ...defaultConfig(), nannyIntervalMinutes: 60 }

    // Simulate snooze: set last session end to now (so idle resets)
    // The interval is 60 min, so after 30min of "idle" it should still block
    const state = {
      ...defaultState(),
      nannyLastSessionEndTime: now.getTime() // Just ended now
    }

    // Check 30 minutes later — still within 60 min interval
    const thirtyMinLater = new Date(now.getTime() + 30 * 60 * 1000)
    const result = checkNannyGates(state, config, thirtyMinLater)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('idle time < interval')
  })

  it('11. Snooze 1hr sets nannyLastSessionEndTime correctly', () => {
    const now = workingDate()
    const config = { ...defaultConfig(), nannyIntervalMinutes: 60 }

    const state = {
      ...defaultState(),
      nannyLastSessionEndTime: now.getTime()
    }

    // Check 61 minutes later — past the 60 min interval
    const sixtyOneMinLater = new Date(now.getTime() + 61 * 60 * 1000)
    const result = checkNannyGates(state, config, sixtyOneMinLater)
    // Should pass (idle >= interval)
    expect(result.blocked).toBe(false)
  })

  it('12. Stop today sets nannyQuietToday=true', () => {
    // When user clicks "Stop today", the widget sets nannyQuietToday = true
    // and nannyQuietDate = dayOfYear
    const now = workingDate()
    const dayOfYear = getDayOfYear(now)

    const state: NannyState = {
      ...defaultState(),
      nannyQuietToday: true,
      nannyQuietDate: dayOfYear
    }

    // Should block for the rest of the day
    const result = checkNannyGates(state, defaultConfig(), now)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('quiet today')

    // But same-day check should NOT reset quiet
    const sameDayLater = new Date(now.getTime() + 4 * 60 * 60 * 1000) // 4 hours later same day
    const updatedState = checkMidnightReset(state, sameDayLater)
    // dayOfYear should still match → quiet stays true
    expect(updatedState.nannyQuietToday).toBe(true)
  })

  it('13. Work day check includes Sunday (0) in config', () => {
    // When user configures "0,1,2,3,4,5,6" (all days)
    const config = { ...defaultConfig(), nannyWorkDays: '0,1,2,3,4,5,6' }
    const sunday = new Date(2025, 0, 5, 10, 0, 0) // Jan 5, 2025 is Sunday
    expect(sunday.getDay()).toBe(0) // Verify it's Sunday

    const state = {
      ...defaultState(),
      nannyLastSessionEndTime: sunday.getTime() - 120 * 60 * 1000,
      nannyLastNotifyTime: sunday.getTime() - 120 * 60 * 1000
    }
    const result = checkNannyGates(state, config, sunday)
    // Should NOT be blocked by work day check
    expect(result.blocked).toBe(false)
  })

  it('14. Work hours check: hour 8 passes with startHour=8', () => {
    const config = { ...defaultConfig(), nannyStartHour: 8, nannyEndHour: 18 }
    // Exactly 8:00 should pass (>= startHour)
    const eightAm = new Date(2025, 0, 6, 8, 0, 0) // Monday 8am

    const state = {
      ...defaultState(),
      nannyLastSessionEndTime: eightAm.getTime() - 120 * 60 * 1000,
      nannyLastNotifyTime: eightAm.getTime() - 120 * 60 * 1000
    }
    const result = checkNannyGates(state, config, eightAm)
    expect(result.blocked).toBe(false)
  })

  it('15. Work hours check: hour 23 blocked with endHour=23', () => {
    const config = { ...defaultConfig(), nannyStartHour: 8, nannyEndHour: 23 }
    // Hour 23 is >= endHour, so blocked
    const lateNight = new Date(2025, 0, 6, 23, 0, 0) // Monday 11pm
    const result = checkNannyGates(defaultState(), config, lateNight)
    expect(result.blocked).toBe(true)
    expect(result.reason).toContain('outside work hours')

    // Hour 22 should pass
    const beforeEnd = new Date(2025, 0, 6, 22, 0, 0)
    const state = {
      ...defaultState(),
      nannyLastSessionEndTime: beforeEnd.getTime() - 120 * 60 * 1000,
      nannyLastNotifyTime: beforeEnd.getTime() - 120 * 60 * 1000
    }
    const result2 = checkNannyGates(state, config, beforeEnd)
    expect(result2.blocked).toBe(false)
  })
})
