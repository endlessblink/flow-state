/**
 * BUG-1919: "+5 min" extension permanently blocks the widget's next completion.
 *
 * Live prod evidence (2026-07-04): timer_sessions row 52e15e1c — duration 1800
 * (= 25min work + 300s extension), remaining_time 0, is_active=true,
 * completed_at null, device_leader_id=kde-widget heart-beaten for ~2h past
 * expiry. Mechanism: postponeTimer's success handler (main.qml ~:4904) resumes
 * with `currentSessionId = lastCompletedSessionId` but never clears the
 * BUG-1892 idempotency guard, so the extended session's legitimate completion
 * matches `currentSessionId === lastCompletedSessionId` and is swallowed as a
 * "re-fire" — no completion PATCH, no leadership release, zombie heartbeats.
 *
 * The Vue-side BUG-1892 fix explicitly cleared its guard on addExtraTime; this
 * test pins the same contract for the QML state machine. The harness mirrors
 * the QML guard/extension sequence verbatim (same style as
 * task-list-building.test.ts); anchors: onSessionComplete main.qml:4774,
 * postponeTimer success handler main.qml:4900.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface WidgetTimerState {
  currentSessionId: string
  lastCompletedSessionId: string
  sessionJustCompleted: boolean
  isDeviceLeader: boolean
  completionPatches: string[]
}

// Mirror of onSessionComplete's guard + completion sequence (main.qml:4774)
function onSessionComplete(s: WidgetTimerState): void {
  if (s.sessionJustCompleted) return
  if (s.currentSessionId && s.currentSessionId === s.lastCompletedSessionId) return

  if (s.currentSessionId) s.completionPatches.push(s.currentSessionId)
  s.lastCompletedSessionId = s.currentSessionId
  s.sessionJustCompleted = true
  s.currentSessionId = ''
  s.isDeviceLeader = false
}

// Mirror of applyFetchedSession's guard reset when a poll sees an active row (main.qml:4371)
function pollSeesActiveRow(s: WidgetTimerState): void {
  s.sessionJustCompleted = false
}

/**
 * Mirror of postponeTimer's extension success handler — kept in lockstep with
 * main.qml via extractExtensionHandlerContract() below.
 */
function extendSessionSuccess(s: WidgetTimerState): void {
  s.currentSessionId = s.lastCompletedSessionId
  s.isDeviceLeader = true
  // BUG-1919 contract: the guard MUST be cleared so the extended session can
  // complete again. These lines must exist in main.qml's extend handler.
  s.lastCompletedSessionId = ''
  s.sessionJustCompleted = false
}

const QML = readFileSync(resolve(__dirname, '../../../packages/kde-widget/contents/ui/main.qml'), 'utf8')

/** The QML extend-success block, sliced live so mirror-drift fails loudly. */
function extensionSuccessBlock(): string {
  const anchor = QML.indexOf('root.currentSessionId = root.lastCompletedSessionId')
  expect(anchor, 'extension success handler anchor missing from main.qml').toBeGreaterThan(-1)
  // The success branch ends where the else branch (extend failure) begins
  const end = QML.indexOf('} else {', anchor)
  return QML.slice(anchor, end === -1 ? anchor + 800 : end)
}

describe('BUG-1919: extension must not permanently swallow the next completion', () => {
  let s: WidgetTimerState

  beforeEach(() => {
    s = {
      currentSessionId: 'sess-52e15e1c',
      lastCompletedSessionId: '',
      sessionJustCompleted: false,
      isDeviceLeader: true,
      completionPatches: [],
    }
  })

  it('USER REPRO: complete → +5min extend → countdown hits zero → completion must fire again', () => {
    // 25-min session hits zero
    onSessionComplete(s)
    expect(s.completionPatches).toEqual(['sess-52e15e1c'])

    // user clicks +5 min → session resumed with the SAME id
    extendSessionSuccess(s)
    // background poll sees the active row again (main.qml:4371 behavior)
    pollSeesActiveRow(s)

    // extension hits zero — this completion was being swallowed (zombie row)
    onSessionComplete(s)
    expect(s.completionPatches).toEqual(['sess-52e15e1c', 'sess-52e15e1c'])
    expect(s.isDeviceLeader).toBe(false)
  })

  it('BUG-1892 stays fixed: a genuine duplicate re-fire is still ignored', () => {
    onSessionComplete(s)
    // stale poll re-adopts the same completed session WITHOUT an extension
    s.currentSessionId = 'sess-52e15e1c'
    pollSeesActiveRow(s)
    onSessionComplete(s)
    expect(s.completionPatches).toEqual(['sess-52e15e1c'])
  })

  it('main.qml extension handler actually clears the guard (mirror-drift check)', () => {
    const block = extensionSuccessBlock()
    expect(block, 'extend success must clear lastCompletedSessionId (BUG-1919)').toContain('root.lastCompletedSessionId = ""')
    expect(block, 'extend success must clear sessionJustCompleted').toContain('root.sessionJustCompleted = false')
  })
})
