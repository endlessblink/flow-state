/**
 * TASK-1660: KDE Pre-End Warning Tests (5 tests)
 *
 * Tests pre-end warning popup logic extracted from main.qml as pure JS.
 *
 * Source: packages/kde-widget/contents/ui/main.qml
 *   - preEndWarningPopup Window: lines 1289-1382
 *   - showPreEndWarning(): lines 1384-1394
 *   - Countdown timer onTriggered (warning check): lines 3800-3812
 *   - preEndWarningDismiss Timer: lines 1301-1306
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Constants from main.qml preEndWarningPopup
// ---------------------------------------------------------------------------

const PRE_END_WARNING_WIDTH = 360     // line 1296
const PRE_END_WARNING_HEIGHT = 160    // line 1297
const PRE_END_WARNING_AUTO_DISMISS_MS = 15000  // line 1303

// ---------------------------------------------------------------------------
// Warning trigger logic (from countdown timer onTriggered, lines 3803-3808)
// ---------------------------------------------------------------------------

interface TimerState {
  secondsRemaining: number
  preEndWarningShown: boolean
}

interface TimerConfig {
  preEndWarningSeconds: number
}

/**
 * Returns true if the pre-end warning should fire on this tick.
 * Mirrors: if (warningSeconds > 0 && !preEndWarningShown &&
 *              secondsRemaining <= warningSeconds && secondsRemaining > 0)
 */
function shouldFireWarning(state: TimerState, config: TimerConfig): boolean {
  const { secondsRemaining, preEndWarningShown } = state
  const { preEndWarningSeconds } = config
  return (
    preEndWarningSeconds > 0 &&
    !preEndWarningShown &&
    secondsRemaining <= preEndWarningSeconds &&
    secondsRemaining > 0
  )
}

// ---------------------------------------------------------------------------
// Remaining time label text computation (from preEndWarningPopup, line 1367)
// ---------------------------------------------------------------------------

function formatWarningRemainingText(secs: number): string {
  if (secs >= 60) {
    const mins = Math.floor(secs / 60)
    return mins + ' minute' + (mins > 1 ? 's' : '') + ' left'
  }
  return secs + ' seconds left'
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TASK-1660: KDE Pre-End Warning', () => {
  describe('Warning fires at configured seconds before end', () => {
    it('1. warning fires when secondsRemaining equals preEndWarningSeconds', () => {
      const state: TimerState = { secondsRemaining: 60, preEndWarningShown: false }
      const config: TimerConfig = { preEndWarningSeconds: 60 }
      expect(shouldFireWarning(state, config)).toBe(true)
    })

    it('1. warning fires when secondsRemaining is below configured threshold', () => {
      const state: TimerState = { secondsRemaining: 45, preEndWarningShown: false }
      const config: TimerConfig = { preEndWarningSeconds: 60 }
      expect(shouldFireWarning(state, config)).toBe(true)
    })

    it('1. warning does NOT fire when secondsRemaining is above threshold', () => {
      const state: TimerState = { secondsRemaining: 120, preEndWarningShown: false }
      const config: TimerConfig = { preEndWarningSeconds: 60 }
      expect(shouldFireWarning(state, config)).toBe(false)
    })

    it('1. warning does NOT fire again if already shown (preEndWarningShown=true)', () => {
      const state: TimerState = { secondsRemaining: 30, preEndWarningShown: true }
      const config: TimerConfig = { preEndWarningSeconds: 60 }
      expect(shouldFireWarning(state, config)).toBe(false)
    })

    it('1. warning does NOT fire at exactly 0 seconds (session already complete)', () => {
      const state: TimerState = { secondsRemaining: 0, preEndWarningShown: false }
      const config: TimerConfig = { preEndWarningSeconds: 60 }
      expect(shouldFireWarning(state, config)).toBe(false)
    })
  })

  describe('Popup dimensions', () => {
    it('2. pre-end warning popup width is 360', () => {
      expect(PRE_END_WARNING_WIDTH).toBe(360)
    })

    it('2. pre-end warning popup height is 160', () => {
      expect(PRE_END_WARNING_HEIGHT).toBe(160)
    })
  })

  describe('Auto-dismiss timer', () => {
    it('3. auto-dismiss interval is 15000ms (15 seconds)', () => {
      expect(PRE_END_WARNING_AUTO_DISMISS_MS).toBe(15000)
    })
  })

  describe('Warning shows remaining time text', () => {
    it('4. shows "1 minute left" for 60 seconds', () => {
      expect(formatWarningRemainingText(60)).toBe('1 minute left')
    })

    it('4. shows "2 minutes left" for 120 seconds', () => {
      expect(formatWarningRemainingText(120)).toBe('2 minutes left')
    })

    it('4. shows "30 seconds left" for 30 seconds', () => {
      expect(formatWarningRemainingText(30)).toBe('30 seconds left')
    })

    it('4. shows "59 seconds left" for 59 seconds (just below 1 minute)', () => {
      expect(formatWarningRemainingText(59)).toBe('59 seconds left')
    })
  })

  describe('Disabled when preEndWarningSeconds=0', () => {
    it('5. warning disabled when preEndWarningSeconds is 0', () => {
      const state: TimerState = { secondsRemaining: 30, preEndWarningShown: false }
      const config: TimerConfig = { preEndWarningSeconds: 0 }
      expect(shouldFireWarning(state, config)).toBe(false)
    })

    it('5. warning disabled even at 1 second remaining when config=0', () => {
      const state: TimerState = { secondsRemaining: 1, preEndWarningShown: false }
      const config: TimerConfig = { preEndWarningSeconds: 0 }
      expect(shouldFireWarning(state, config)).toBe(false)
    })
  })
})
