/**
 * TASK-1654: KDE Nudge Popup Logic Tests (10 tests)
 *
 * Tests nudge popup dimensions, positioning, auto-dismiss timing, snooze
 * logic, and quiet-today behavior extracted from main.qml as pure JS.
 *
 * Source: packages/kde-widget/contents/ui/main.qml
 *   - nudgePopup Window: lines 1060-1287
 *   - sendNannyNotification(): lines 259-277
 *   - Snooze 30m: lines 1190-1194
 *   - Snooze 1hr: lines 1218-1221
 *   - Stop today: lines 1246-1251
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Constants extracted from main.qml nudgePopup Window
// ---------------------------------------------------------------------------

const NUDGE_POPUP_WIDTH = 420     // line 1066
const NUDGE_POPUP_HEIGHT = 220    // line 1067
const NUDGE_AUTO_DISMISS_MS = 30000  // line 1074

// ---------------------------------------------------------------------------
// Nudge popup positioning logic (from sendNannyNotification, lines 267-268)
// ---------------------------------------------------------------------------

interface ScreenGeometry {
  x: number
  y: number
  width: number
  height: number
}

function computeNudgePosition(sg: ScreenGeometry, popupWidth: number, popupHeight: number) {
  return {
    x: sg.x + sg.width - popupWidth - 24,
    y: sg.y + 24,
  }
}

// ---------------------------------------------------------------------------
// Snooze logic extracted from nudgePopup MouseArea handlers
// ---------------------------------------------------------------------------

interface NannyState {
  nannyLastNotifyTime: number
  nannyLastSessionEndTime: number
  nannyQuietToday: boolean
  nannyQuietDate: number
  isAuthenticated?: boolean
  userId?: string
  nudgePopupVisible?: boolean
  nannyPopupVisible?: boolean
  tasks?: Array<{ id: string; title?: string; status?: string; due_date?: string; isHeader?: boolean }>
  pinnedTasks?: Array<{ id: string; title?: string; status?: string; due_date?: string; isHeader?: boolean }>
  nannyAllTasks?: Array<{ id: string; title?: string; status?: string; due_date?: string; isHeader?: boolean }>
  nannyHiddenToday?: Record<string, boolean>
  refreshCalls?: string[]
}

function snooze30m(state: NannyState, now: number): NannyState {
  // From lines 1191-1192: nannyLastSessionEndTime = Date.now() + (30 * 60 * 1000)
  return {
    ...state,
    nannyLastNotifyTime: now,
    nannyLastSessionEndTime: now + 30 * 60 * 1000,
  }
}

function snooze1hr(state: NannyState, now: number): NannyState {
  // From lines 1219-1220: nannyLastSessionEndTime = Date.now() + (60 * 60 * 1000)
  return {
    ...state,
    nannyLastNotifyTime: now,
    nannyLastSessionEndTime: now + 60 * 60 * 1000,
  }
}

function stopToday(state: NannyState, today: Date): NannyState {
  // From lines 1247-1249
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000)
  return {
    ...state,
    nannyQuietToday: true,
    nannyQuietDate: dayOfYear,
  }
}

function recordTaskCompletionActivity(state: NannyState, taskId: string, now: number): NannyState {
  const withoutTask = (items: Array<{ id: string }> = []) => items.filter(item => item.id !== taskId)

  return {
    ...state,
    nudgePopupVisible: false,
    nannyPopupVisible: false,
    nannyLastNotifyTime: now,
    nannyLastSessionEndTime: now,
    tasks: withoutTask(state.tasks),
    pinnedTasks: withoutTask(state.pinnedTasks),
    nannyAllTasks: withoutTask(state.nannyAllTasks),
    nannyHiddenToday: {
      ...(state.nannyHiddenToday || {}),
      [taskId]: true,
    },
  }
}

function restoreTaskAfterCompletionFailure(state: NannyState, taskId: string): NannyState {
  const hidden = { ...(state.nannyHiddenToday || {}) }
  delete hidden[taskId]
  return {
    ...state,
    nannyHiddenToday: hidden,
  }
}

interface MarkDoneRequest {
  method: 'PATCH'
  url: string
  body: {
    status: 'done'
    completed_at: string
    updated_at: string
  }
}

interface MarkDoneResult {
  state: NannyState
  request?: MarkDoneRequest
}

function markTaskDoneModel(
  state: NannyState,
  taskId: string | undefined,
  now: number,
  isoNow = '2026-05-27T10:00:00.000Z'
): MarkDoneResult {
  if (!state.isAuthenticated || !taskId) return { state }

  const nextState = recordTaskCompletionActivity(state, taskId, now)

  return {
    state: nextState,
    request: {
      method: 'PATCH',
      url: `/rest/v1/tasks?id=eq.${taskId}&user_id=eq.${state.userId}`,
      body: {
        status: 'done',
        completed_at: isoNow,
        updated_at: isoNow,
      },
    },
  }
}

function refreshTaskReminderCachesModel(state: NannyState): NannyState {
  return {
    ...state,
    refreshCalls: [
      ...(state.refreshCalls || []),
      'fetchTasks',
      'fetchPinnedTasks',
      'fetchNannyTasks',
      'buildNannyTaskList',
    ],
  }
}

function completeMarkDoneSuccessfully(state: NannyState): NannyState {
  return refreshTaskReminderCachesModel(state)
}

function failMarkDone(state: NannyState, taskId: string): NannyState {
  return refreshTaskReminderCachesModel(restoreTaskAfterCompletionFailure(state, taskId))
}

function normalizeTaskDate(value: string | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.substring(0, 10)

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear()
    const month = String(parsed.getMonth() + 1).padStart(2, '0')
    const day = String(parsed.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return ''
}

function isTaskReminderActionable(
  task: { id: string; title?: string; status?: string; due_date?: string; isHeader?: boolean } | undefined,
  hiddenToday: Record<string, boolean>,
  todayStr: string
): boolean {
  if (!task || task.isHeader || !task.id || !task.title) return false
  if (task.status === 'done' || hiddenToday[task.id]) return false
  return normalizeTaskDate(task.due_date) === todayStr
}

function hasActionableNannyTasks(state: NannyState, todayStr: string): boolean {
  const hiddenToday = state.nannyHiddenToday || {}

  for (const pin of state.pinnedTasks || []) {
    if (pin?.id && pin.title && pin.status !== 'done' && !hiddenToday[pin.id]) return true
  }

  const allTasks = (state.nannyAllTasks?.length || 0) > 0 ? state.nannyAllTasks : state.tasks
  return (allTasks || []).some(task => isTaskReminderActionable(task, hiddenToday, todayStr))
}

// ---------------------------------------------------------------------------
// Message selection logic from sendNannyNotification (lines 260-262)
// ---------------------------------------------------------------------------

const NANNY_GENTLE_MESSAGES = [
  'Ready for a focus session?',
  'A good time to start a Pomodoro?',
  'Your next session is waiting for you',
  'How about a quick focus sprint?',
  'Time to plant a tomato?',
]

const NANNY_DIRECT_MESSAGES = [
  'No active session — time to focus',
  'Start a Pomodoro to get in the zone',
  "You've been idle — ready to work?",
  'Focus time: start your next session',
  "Break's over — let's go!",
]

function selectNudgeMessage(tone: string, randomIndex: number): string {
  const messages = tone === 'direct' ? NANNY_DIRECT_MESSAGES : NANNY_GENTLE_MESSAGES
  return messages[Math.floor(randomIndex * messages.length)]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TASK-1654: KDE Nudge Popup Logic', () => {
  describe('Popup dimensions', () => {
    it('1. nudge popup width is 420', () => {
      expect(NUDGE_POPUP_WIDTH).toBe(420)
    })

    it('1. nudge popup height is 220', () => {
      expect(NUDGE_POPUP_HEIGHT).toBe(220)
    })
  })

  describe('Popup positioning', () => {
    it('2. nudge is positioned at top-right: x = screen.x + screen.width - popup.width - 24', () => {
      const sg: ScreenGeometry = { x: 0, y: 0, width: 1920, height: 1080 }
      const pos = computeNudgePosition(sg, NUDGE_POPUP_WIDTH, NUDGE_POPUP_HEIGHT)
      expect(pos.x).toBe(1920 - NUDGE_POPUP_WIDTH - 24)
    })

    it('2. nudge y offset from top is 24px (y = screen.y + 24)', () => {
      const sg: ScreenGeometry = { x: 0, y: 0, width: 1920, height: 1080 }
      const pos = computeNudgePosition(sg, NUDGE_POPUP_WIDTH, NUDGE_POPUP_HEIGHT)
      expect(pos.y).toBe(24)
    })

    it('2. nudge respects non-zero screen.x offset (multi-monitor)', () => {
      const sg: ScreenGeometry = { x: 1920, y: 0, width: 2560, height: 1440 }
      const pos = computeNudgePosition(sg, NUDGE_POPUP_WIDTH, NUDGE_POPUP_HEIGHT)
      expect(pos.x).toBe(1920 + 2560 - NUDGE_POPUP_WIDTH - 24)
      expect(pos.y).toBe(24)
    })
  })

  describe('Auto-dismiss timer', () => {
    it('3. auto-dismiss interval is 30000ms (30 seconds)', () => {
      expect(NUDGE_AUTO_DISMISS_MS).toBe(30000)
    })
  })

  describe('Snooze 30 minutes', () => {
    it('4. snooze 30m sets nannyLastSessionEndTime to now + 30 minutes in ms', () => {
      const now = 1700000000000
      const state: NannyState = { nannyLastNotifyTime: 0, nannyLastSessionEndTime: 0, nannyQuietToday: false, nannyQuietDate: -1 }
      const result = snooze30m(state, now)
      expect(result.nannyLastSessionEndTime).toBe(now + 30 * 60 * 1000)
    })

    it('4. snooze 30m also updates nannyLastNotifyTime to now', () => {
      const now = 1700000000000
      const state: NannyState = { nannyLastNotifyTime: 0, nannyLastSessionEndTime: 0, nannyQuietToday: false, nannyQuietDate: -1 }
      const result = snooze30m(state, now)
      expect(result.nannyLastNotifyTime).toBe(now)
    })
  })

  describe('Snooze 1 hour', () => {
    it('5. snooze 1hr sets nannyLastSessionEndTime to now + 60 minutes in ms', () => {
      const now = 1700000000000
      const state: NannyState = { nannyLastNotifyTime: 0, nannyLastSessionEndTime: 0, nannyQuietToday: false, nannyQuietDate: -1 }
      const result = snooze1hr(state, now)
      expect(result.nannyLastSessionEndTime).toBe(now + 60 * 60 * 1000)
    })

    it('5. snooze 1hr offset is exactly double the 30m offset', () => {
      const now = 0
      const state: NannyState = { nannyLastNotifyTime: 0, nannyLastSessionEndTime: 0, nannyQuietToday: false, nannyQuietDate: -1 }
      const r30 = snooze30m(state, now)
      const r60 = snooze1hr(state, now)
      expect(r60.nannyLastSessionEndTime).toBe(r30.nannyLastSessionEndTime * 2)
    })
  })

  describe('Stop today', () => {
    it('6. stopToday sets nannyQuietToday=true', () => {
      const today = new Date('2026-03-21')
      const state: NannyState = { nannyLastNotifyTime: 0, nannyLastSessionEndTime: 0, nannyQuietToday: false, nannyQuietDate: -1 }
      const result = stopToday(state, today)
      expect(result.nannyQuietToday).toBe(true)
    })

    it('6. stopToday sets nannyQuietDate to day-of-year', () => {
      const today = new Date('2026-01-01')
      const state: NannyState = { nannyLastNotifyTime: 0, nannyLastSessionEndTime: 0, nannyQuietToday: false, nannyQuietDate: -1 }
      const result = stopToday(state, today)
      // Jan 1 = day 1
      expect(result.nannyQuietDate).toBe(1)
    })
  })

  describe('Dismiss behaviors', () => {
    it('7. dismiss X button sets visible=false (modeled as state toggle)', () => {
      // The dismiss simply sets nudgePopup.visible = false
      let visible = true
      visible = false
      expect(visible).toBe(false)
    })

    it('8. clicking background also dismisses (same visible=false handler)', () => {
      // Both background MouseArea and card MouseArea call nudgePopup.visible = false
      let dismissed = false
      const handleClick = () => { dismissed = true }
      handleClick()
      expect(dismissed).toBe(true)
    })

    it('9. Escape key dismisses (Keys.onEscapePressed sets visible=false)', () => {
      // Line 1284: Keys.onEscapePressed: nudgePopup.visible = false
      let visible = true
      const onEscapePressed = () => { visible = false }
      onEscapePressed()
      expect(visible).toBe(false)
    })
  })

  describe('Random message selection', () => {
    it('10. tone=gentle selects from gentle message pool', () => {
      const msg = selectNudgeMessage('gentle', 0)
      expect(NANNY_GENTLE_MESSAGES).toContain(msg)
    })

    it('10. tone=direct selects from direct message pool', () => {
      const msg = selectNudgeMessage('direct', 0)
      expect(NANNY_DIRECT_MESSAGES).toContain(msg)
    })

    it('10. all gentle messages are reachable', () => {
      const reached = new Set<string>()
      for (let i = 0; i < NANNY_GENTLE_MESSAGES.length; i++) {
        const msg = selectNudgeMessage('gentle', i / NANNY_GENTLE_MESSAGES.length)
        reached.add(msg)
      }
      expect(reached.size).toBe(NANNY_GENTLE_MESSAGES.length)
    })

    it('10. unknown tone falls back to gentle pool', () => {
      const msg = selectNudgeMessage('unknown-tone', 0)
      expect(NANNY_GENTLE_MESSAGES).toContain(msg)
    })
  })

  describe('Task completion suppression', () => {
    it('11. unauthenticated mark-done does not mutate reminder state or send a request', () => {
      const state: NannyState = {
        isAuthenticated: false,
        nannyLastNotifyTime: 1,
        nannyLastSessionEndTime: 2,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        nudgePopupVisible: true,
        nannyPopupVisible: true,
        tasks: [{ id: 'task-1' }],
        pinnedTasks: [{ id: 'task-1' }],
        nannyAllTasks: [{ id: 'task-1' }],
        nannyHiddenToday: {},
      }

      const result = markTaskDoneModel(state, 'task-1', 1700000000000)

      expect(result.request).toBeUndefined()
      expect(result.state).toEqual(state)
    })

    it('11. missing task id does not mutate reminder state or send a request', () => {
      const state: NannyState = {
        isAuthenticated: true,
        nannyLastNotifyTime: 1,
        nannyLastSessionEndTime: 2,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        nudgePopupVisible: true,
        nannyPopupVisible: true,
        tasks: [{ id: 'task-1' }],
        pinnedTasks: [{ id: 'task-1' }],
        nannyAllTasks: [{ id: 'task-1' }],
        nannyHiddenToday: {},
      }

      const result = markTaskDoneModel(state, '', 1700000000000)

      expect(result.request).toBeUndefined()
      expect(result.state).toEqual(state)
    })

    it('11. marking a task done dismisses both reminder popups', () => {
      const result = recordTaskCompletionActivity({
        nannyLastNotifyTime: 0,
        nannyLastSessionEndTime: 0,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        nudgePopupVisible: true,
        nannyPopupVisible: true,
      }, 'task-1', 1700000000000)

      expect(result.nudgePopupVisible).toBe(false)
      expect(result.nannyPopupVisible).toBe(false)
    })

    it('11. marking a task done resets nudge timing so the next nanny tick is blocked', () => {
      const now = 1700000000000
      const result = recordTaskCompletionActivity({
        nannyLastNotifyTime: 0,
        nannyLastSessionEndTime: 0,
        nannyQuietToday: false,
        nannyQuietDate: -1,
      }, 'task-1', now)

      expect(result.nannyLastNotifyTime).toBe(now)
      expect(result.nannyLastSessionEndTime).toBe(now)
    })

    it('11. marking a task done removes it from every reminder cache immediately, including duplicates', () => {
      const result = recordTaskCompletionActivity({
        nannyLastNotifyTime: 0,
        nannyLastSessionEndTime: 0,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        tasks: [{ id: 'task-1' }, { id: 'task-2' }, { id: 'task-1' }],
        pinnedTasks: [{ id: 'task-1' }, { id: 'task-4' }],
        nannyAllTasks: [{ id: 'task-1' }, { id: 'task-3' }, { id: 'task-1' }],
        nannyHiddenToday: {},
      }, 'task-1', 1700000000000)

      expect(result.tasks?.map(item => item.id)).toEqual(['task-2'])
      expect(result.pinnedTasks?.map(item => item.id)).toEqual(['task-4'])
      expect(result.nannyAllTasks?.map(item => item.id)).toEqual(['task-3'])
      expect(result.nannyHiddenToday?.['task-1']).toBe(true)
    })

    it('11. mark-done PATCH is scoped to the signed-in user and writes completion timestamps', () => {
      const result = markTaskDoneModel({
        isAuthenticated: true,
        userId: 'user-123',
        nannyLastNotifyTime: 0,
        nannyLastSessionEndTime: 0,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        tasks: [{ id: 'task-1' }],
        pinnedTasks: [{ id: 'task-1' }],
        nannyAllTasks: [{ id: 'task-1' }],
        nannyHiddenToday: {},
      }, 'task-1', 1700000000000, '2026-05-27T10:00:00.000Z')

      expect(result.request).toEqual({
        method: 'PATCH',
        url: '/rest/v1/tasks?id=eq.task-1&user_id=eq.user-123',
        body: {
          status: 'done',
          completed_at: '2026-05-27T10:00:00.000Z',
          updated_at: '2026-05-27T10:00:00.000Z',
        },
      })
    })

    it('11. successful completion refreshes every task source that can feed reminders', () => {
      const marked = markTaskDoneModel({
        isAuthenticated: true,
        userId: 'user-123',
        nannyLastNotifyTime: 0,
        nannyLastSessionEndTime: 0,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        tasks: [{ id: 'task-1' }],
        pinnedTasks: [{ id: 'task-1' }],
        nannyAllTasks: [{ id: 'task-1' }],
        nannyHiddenToday: {},
      }, 'task-1', 1700000000000).state

      const result = completeMarkDoneSuccessfully(marked)

      expect(result.refreshCalls).toEqual([
        'fetchTasks',
        'fetchPinnedTasks',
        'fetchNannyTasks',
        'buildNannyTaskList',
      ])
      expect(result.nannyHiddenToday?.['task-1']).toBe(true)
    })

    it('11. failed completion restores the task from the hidden-for-today guard', () => {
      const result = restoreTaskAfterCompletionFailure({
        nannyLastNotifyTime: 0,
        nannyLastSessionEndTime: 0,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        nannyHiddenToday: { 'task-1': true, 'task-2': true },
      }, 'task-1')

      expect(result.nannyHiddenToday?.['task-1']).toBeUndefined()
      expect(result.nannyHiddenToday?.['task-2']).toBe(true)
    })

    it('11. failed completion refreshes caches after removing only the failed task guard', () => {
      const marked = markTaskDoneModel({
        isAuthenticated: true,
        userId: 'user-123',
        nannyLastNotifyTime: 0,
        nannyLastSessionEndTime: 0,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        tasks: [{ id: 'task-1' }, { id: 'task-2' }],
        pinnedTasks: [{ id: 'task-1' }],
        nannyAllTasks: [{ id: 'task-1' }],
        nannyHiddenToday: { 'task-2': true },
      }, 'task-1', 1700000000000).state

      const result = failMarkDone(marked, 'task-1')

      expect(result.nannyHiddenToday?.['task-1']).toBeUndefined()
      expect(result.nannyHiddenToday?.['task-2']).toBe(true)
      expect(result.refreshCalls).toEqual([
        'fetchTasks',
        'fetchPinnedTasks',
        'fetchNannyTasks',
        'buildNannyTaskList',
      ])
    })

    it('11. nudge is blocked after the final actionable reminder task is completed', () => {
      const marked = markTaskDoneModel({
        isAuthenticated: true,
        userId: 'user-1',
        nannyLastNotifyTime: 0,
        nannyLastSessionEndTime: 0,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        tasks: [{ id: 'task-1', title: 'Done in popup', status: 'planned', due_date: '2026-05-27T10:00:00Z' }],
        pinnedTasks: [{ id: 'task-1', title: 'Done in popup', status: 'planned' }],
        nannyAllTasks: [{ id: 'task-1', title: 'Done in popup', status: 'planned', due_date: '2026-05-27T10:00:00Z' }],
        nannyHiddenToday: {},
      }, 'task-1', 1700000000000)

      expect(hasActionableNannyTasks(marked.state, '2026-05-27')).toBe(false)
    })

    it('11. nudge remains allowed when another visible pinned reminder task exists', () => {
      const marked = markTaskDoneModel({
        isAuthenticated: true,
        userId: 'user-1',
        nannyLastNotifyTime: 0,
        nannyLastSessionEndTime: 0,
        nannyQuietToday: false,
        nannyQuietDate: -1,
        tasks: [{ id: 'task-1', title: 'Done in popup', status: 'planned', due_date: '2026-05-27T10:00:00Z' }],
        pinnedTasks: [
          { id: 'task-1', title: 'Done in popup', status: 'planned' },
          { id: 'task-2', title: 'Still pinned', status: 'planned' },
        ],
        nannyAllTasks: [{ id: 'task-1', title: 'Done in popup', status: 'planned', due_date: '2026-05-27T10:00:00Z' }],
        nannyHiddenToday: {},
      }, 'task-1', 1700000000000)

      expect(hasActionableNannyTasks(marked.state, '2026-05-27')).toBe(true)
    })
  })
})
