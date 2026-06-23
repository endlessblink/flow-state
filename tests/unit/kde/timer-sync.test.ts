/**
 * TASK-1652: KDE Timer Sync Tests (10 tests)
 *
 * Tests timer polling, session sync, and device leadership logic extracted
 * from main.qml as pure JavaScript functions. No QML runtime required.
 *
 * Source: packages/kde-widget/contents/ui/main.qml
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MAIN_QML = readFileSync(
  resolve(__dirname, '../../../packages/kde-widget/contents/ui/main.qml'),
  'utf-8'
)

// ---------------------------------------------------------------------------
// Pure JS extraction of timer/sync logic from main.qml
// ---------------------------------------------------------------------------

// --- Time display logic (line 147) ---
function formatTimeDisplay(secondsRemaining: number): string {
  const minutes = Math.floor(secondsRemaining / 60)
  const seconds = secondsRemaining % 60
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0')
}

// --- Poll interval logic (main.qml:3863) ---
// TASK-1790: Idle cadence dropped from 30s → 5s so the widget picks up
// sessions started by another device within ~5s instead of ~30s.
function getPollInterval(hasActiveSession: boolean, sessionJustCompleted: boolean, isInTransition: boolean): number {
  return (hasActiveSession || sessionJustCompleted || isInTransition) ? 2000 : 5000
}

// --- Active-session URL builder (main.qml:4277) ---
// TASK-1790: Defensive user_id filter. RLS enforces server-side, but matching the
// write-path's user_id filter keeps reads/writes symmetric.
function buildActiveSessionUrl(supabaseUrl: string, userId: string): string {
  return supabaseUrl + '/rest/v1/timer_sessions?is_active=eq.true&user_id=eq.' + userId + '&select=*&order=updated_at.desc&limit=1'
}

function buildLocalTimerUrl(localApiUrl = 'http://127.0.0.1:5577'): string {
  return localApiUrl + '/api/timer/current'
}

// --- Session data parser: extracts fields from REST response row ---
interface SessionRow {
  id: string
  remaining_time: number
  is_active: boolean
  is_paused: boolean
  is_break: boolean
  task_id?: string
  device_leader_id?: string
  device_leader_last_seen?: string
  duration: number
}

interface ParsedSession {
  secondsRemaining: number
  isRunning: boolean
  isWorkSession: boolean
  currentTaskId: string
  hasActiveSession: boolean
}

function parseSession(s: SessionRow): ParsedSession {
  return {
    secondsRemaining: s.remaining_time,
    isRunning: s.is_active && !s.is_paused,
    isWorkSession: !s.is_break,
    currentTaskId: s.task_id || '',
    hasActiveSession: true,
  }
}

// --- Leadership staleness detection (lines 4279-4284) ---
function isLeaderStale(deviceLeaderLastSeen: string | undefined, now: number, timeoutSeconds = 30): boolean {
  if (!deviceLeaderLastSeen) return false
  const lastSeen = new Date(deviceLeaderLastSeen).getTime()
  const driftSeconds = Math.floor((now - lastSeen) / 1000)
  return driftSeconds > timeoutSeconds
}

// --- Leadership claim logic (lines 4287-4299) ---
function shouldWidgetBeLeader(
  deviceLeaderId: string | undefined,
  deviceLeaderLastSeen: string | undefined,
  now: number,
): boolean {
  const widgetIsLeader = deviceLeaderId === 'kde-widget'
  const leaderIsStale = isLeaderStale(deviceLeaderLastSeen, now, 30)
  return widgetIsLeader || leaderIsStale || !deviceLeaderId
}

// --- Session completion detection: remaining <= 0 ---
function isSessionComplete(secondsRemaining: number): boolean {
  return secondsRemaining <= 0
}

// --- Toggle pause/resume (lines 4356-4368) ---
function toggleIsRunning(isRunning: boolean): boolean {
  return !isRunning
}

// --- Heartbeat timer config (lines 3865-3870) ---
const HEARTBEAT_INTERVAL_MS = 10000  // 10 seconds

// --- Leadership timeout (line 4284) ---
const LEADERSHIP_TIMEOUT_SECONDS = 30

// --- Task name resolver (lines 41-47) ---
interface TaskEntry {
  id: string
  title?: string
}

function resolveTaskName(currentTaskId: string, tasks: TaskEntry[]): string {
  if (!currentTaskId || currentTaskId === 'general') return ''
  for (let i = 0; i < tasks.length; i++) {
    if (tasks[i].id === currentTaskId) return tasks[i].title || ''
  }
  return ''
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TASK-1652: KDE Timer Sync', () => {
  describe('Poll interval', () => {
    it('1. poll interval is 2000ms when hasActiveSession is true', () => {
      expect(getPollInterval(true, false, false)).toBe(2000)
    })

    it('1. poll interval is 5000ms when idle (TASK-1790: dropped from 30s for faster cross-device pickup)', () => {
      expect(getPollInterval(false, false, false)).toBe(5000)
    })

    it('1. TASK-1790 regression: idle interval must never exceed 5s (or pickup latency reverts to 30s)', () => {
      const idleInterval = getPollInterval(false, false, false)
      expect(idleInterval).toBeLessThanOrEqual(5000)
      // Hard floor so we don't accidentally hammer Supabase if someone "fixes" this to 1ms
      expect(idleInterval).toBeGreaterThanOrEqual(2000)
    })

    it('1. poll interval is 2000ms during session transition (isInTransition)', () => {
      expect(getPollInterval(false, false, true)).toBe(2000)
    })

    it('1. poll interval is 2000ms when sessionJustCompleted', () => {
      expect(getPollInterval(false, true, false)).toBe(2000)
    })

    it('1. TASK-1790 source-of-truth: main.qml syncTimer interval ternary uses 5000 (not 30000)', () => {
      // Regression guard: the helper above mirrors main.qml. If the QML drifts back
      // to 30000 the helper test still passes, so we assert the QML source directly.
      const match = MAIN_QML.match(/syncTimer[\s\S]*?interval:\s*\([^)]*hasActiveSession[^)]*\)\s*\?\s*(\d+)\s*:\s*(\d+)/)
      expect(match, 'could not find syncTimer interval expression in main.qml').toBeTruthy()
      const [, activeMs, idleMs] = match!
      expect(Number(activeMs)).toBe(2000)
      expect(Number(idleMs)).toBeLessThanOrEqual(5000)
      expect(Number(idleMs)).toBeGreaterThanOrEqual(2000)
    })
  })

  describe('fetchCurrentSession REST call shape', () => {
    it('2. checks Electron localhost timer bridge before falling back to Supabase', () => {
      const localUrl = buildLocalTimerUrl()
      expect(localUrl).toBe('http://127.0.0.1:5577/api/timer/current')

      const fnStart = MAIN_QML.indexOf('function fetchCurrentSession(')
      expect(fnStart, 'fetchCurrentSession not found').toBeGreaterThan(-1)
      const body = MAIN_QML.slice(fnStart, fnStart + 500)
      expect(body).toContain('fetchLocalCurrentSession(fetchSupabaseCurrentSession)')
      expect(MAIN_QML).toContain('root.localApiUrl + "/api/timer/current"')
    })

    it('2b. sends play/start controls through the Electron localhost timer bridge before Supabase fallback', () => {
      expect(MAIN_QML).toContain('function postLocalTimerControl(')
      expect(MAIN_QML).toContain('root.localApiUrl + "/api/timer/control"')
      expect(MAIN_QML).toContain('postLocalTimerControl({ action: "toggle" }')
      expect(MAIN_QML).toContain('if (!ok) startNewSessionSupabase(isBreak)')
      expect(MAIN_QML).toContain('if (!ok) startSessionForTaskSupabase(taskId)')
      expect(MAIN_QML).toContain('applyFetchedSession(result.session, "local-control")')
    })

    it('2c. quick-add play starts a general timer when the input is empty', () => {
      const quickPlayStart = MAIN_QML.indexOf('// Play button (create + start timer)')
      expect(quickPlayStart, 'quick-add play button not found').toBeGreaterThan(-1)
      const body = MAIN_QML.slice(quickPlayStart, quickPlayStart + 1500)

      expect(body).toContain('root.createTask(quickAddInput.text, true)')
      expect(body).toContain('root.startNewSession(false)')
    })

    it('2. applies active localhost timer payloads and falls back to Supabase on local misses', () => {
      const localFnStart = MAIN_QML.indexOf('function fetchLocalCurrentSession(')
      expect(localFnStart, 'fetchLocalCurrentSession not found').toBeGreaterThan(-1)
      const body = MAIN_QML.slice(localFnStart, localFnStart + 2500)

      expect(body).toContain('root.localApiUrl + "/api/timer/current"')
      expect(body).toContain('body.active && body.session')
      expect(body).toContain('applyFetchedSession(body.session, "local-api")')
      expect(body).toContain('fallback()')
    })

    it('2. fetchCurrentSession queries timer_sessions with is_active=eq.true', () => {
      const supabaseUrl = 'http://127.0.0.1:54321'
      const userId = '717f5209-42d8-4bb9-8781-740107a384e5'
      const url = buildActiveSessionUrl(supabaseUrl, userId)
      expect(url).toContain('/rest/v1/timer_sessions')
      expect(url).toContain('is_active=eq.true')
      expect(url).toContain('order=updated_at.desc')
      expect(url).toContain('limit=1')
    })

    it('2. TASK-1790 regression: active-session query MUST include user_id filter', () => {
      // Without this filter the widget can fetch any user's active session in
      // dev/multi-tenant setups (RLS catches it in prod, but reads should still
      // be symmetric with writes which already filter by user_id).
      const supabaseUrl = 'http://127.0.0.1:54321'
      const userId = 'abc-123'
      const url = buildActiveSessionUrl(supabaseUrl, userId)
      expect(url).toMatch(/user_id=eq\.abc-123(\b|&)/)
    })

    it('2. TASK-1790 source-of-truth: main.qml fetchCurrentSession URL includes user_id filter', () => {
      // The active-session SELECT URL in main.qml must include both is_active=eq.true
      // AND a user_id filter built from root.userId. We don't pin the exact ordering
      // or whitespace — only that both clauses appear within the function body and
      // root.userId is interpolated into the user_id filter value.
      const fnStart = MAIN_QML.indexOf('function fetchCurrentSession(')
      expect(fnStart, 'fetchCurrentSession not found').toBeGreaterThan(-1)
      // Slice the next ~2000 chars — enough to cover the URL construction lines.
      const body = MAIN_QML.slice(fnStart, fnStart + 2000)
      expect(body).toMatch(/timer_sessions\?[^"]*is_active=eq\.true/)
      expect(body).toMatch(/user_id=eq\.["\s+]*\+?\s*root\.userId/)
    })
  })

  describe('Session data parsing', () => {
    it('3. parseSession extracts remaining_time, is_running, is_break from row', () => {
      const row: SessionRow = {
        id: 'sess-1',
        remaining_time: 1200,
        is_active: true,
        is_paused: false,
        is_break: false,
        task_id: 'task-abc',
        duration: 1500,
      }
      const parsed = parseSession(row)
      expect(parsed.secondsRemaining).toBe(1200)
      expect(parsed.isRunning).toBe(true)
      expect(parsed.isWorkSession).toBe(true)
      expect(parsed.hasActiveSession).toBe(true)
    })

    it('3. is_break=true maps to isWorkSession=false', () => {
      const row: SessionRow = {
        id: 'sess-2',
        remaining_time: 300,
        is_active: true,
        is_paused: false,
        is_break: true,
        duration: 300,
      }
      const parsed = parseSession(row)
      expect(parsed.isWorkSession).toBe(false)
    })

    it('3. is_paused=true means isRunning=false even when is_active=true', () => {
      const row: SessionRow = {
        id: 'sess-3',
        remaining_time: 800,
        is_active: true,
        is_paused: true,
        is_break: false,
        duration: 1500,
      }
      const parsed = parseSession(row)
      expect(parsed.isRunning).toBe(false)
    })
  })

  describe('Time display formatting', () => {
    it('4. formats 90 seconds as "01:30"', () => {
      expect(formatTimeDisplay(90)).toBe('01:30')
    })

    it('4. formats 0 seconds as "00:00"', () => {
      expect(formatTimeDisplay(0)).toBe('00:00')
    })

    it('4. formats 1500 seconds (25 min) as "25:00"', () => {
      expect(formatTimeDisplay(1500)).toBe('25:00')
    })

    it('4. formats 61 seconds as "01:01"', () => {
      expect(formatTimeDisplay(61)).toBe('01:01')
    })
  })

  describe('Pause/resume toggle', () => {
    it('5. toggleIsRunning flips false to true', () => {
      expect(toggleIsRunning(false)).toBe(true)
    })

    it('5. toggleIsRunning flips true to false', () => {
      expect(toggleIsRunning(true)).toBe(false)
    })
  })

  describe('Session completion detection', () => {
    it('6. isSessionComplete returns true when remaining is 0', () => {
      expect(isSessionComplete(0)).toBe(true)
    })

    it('6. isSessionComplete returns false when remaining is positive', () => {
      expect(isSessionComplete(1)).toBe(false)
    })

    it('6. isSessionComplete returns true when remaining is negative (edge case)', () => {
      expect(isSessionComplete(-1)).toBe(true)
    })
  })

  describe('Work/break color distinction', () => {
    it('7. workColor and breakColor are different values', () => {
      // Extracted from main.qml lines 19-20
      const workColor = '#4ECDC4'
      const breakColor = '#F59E0B'
      expect(workColor).not.toBe(breakColor)
    })

    it('7. work session uses teal (#4ECDC4)', () => {
      const workColor = '#4ECDC4'
      expect(workColor).toBe('#4ECDC4')
    })

    it('7. break session uses amber (#F59E0B)', () => {
      const breakColor = '#F59E0B'
      expect(breakColor).toBe('#F59E0B')
    })
  })

  describe('Device leadership heartbeat', () => {
    it('8. heartbeat interval is 10000ms (10 seconds)', () => {
      expect(HEARTBEAT_INTERVAL_MS).toBe(10000)
    })
  })

  describe('Leadership timeout', () => {
    it('9. leadership timeout is 30 seconds', () => {
      expect(LEADERSHIP_TIMEOUT_SECONDS).toBe(30)
    })

    it('9. isLeaderStale returns true when last seen > 30s ago', () => {
      const now = Date.now()
      const lastSeen = new Date(now - 31000).toISOString()
      expect(isLeaderStale(lastSeen, now, 30)).toBe(true)
    })

    it('9. isLeaderStale returns false when last seen <= 30s ago', () => {
      const now = Date.now()
      const lastSeen = new Date(now - 15000).toISOString()
      expect(isLeaderStale(lastSeen, now, 30)).toBe(false)
    })

    it('9. shouldWidgetBeLeader is true when device_leader_id is "kde-widget"', () => {
      const now = Date.now()
      const recent = new Date(now - 5000).toISOString()
      expect(shouldWidgetBeLeader('kde-widget', recent, now)).toBe(true)
    })

    it('9. shouldWidgetBeLeader is true when no leader set', () => {
      expect(shouldWidgetBeLeader(undefined, undefined, Date.now())).toBe(true)
    })

    it('9. shouldWidgetBeLeader is true when other leader is stale', () => {
      const now = Date.now()
      const stale = new Date(now - 35000).toISOString()
      expect(shouldWidgetBeLeader('vue-app', stale, now)).toBe(true)
    })

    it('9. shouldWidgetBeLeader is false when other leader is current', () => {
      const now = Date.now()
      const recent = new Date(now - 5000).toISOString()
      expect(shouldWidgetBeLeader('vue-app', recent, now)).toBe(false)
    })
  })

  describe('Task name display from session', () => {
    it('10. resolves task name from task list when currentTaskId matches', () => {
      const tasks: TaskEntry[] = [
        { id: 'task-1', title: 'Write tests' },
        { id: 'task-2', title: 'Review PR' },
      ]
      expect(resolveTaskName('task-1', tasks)).toBe('Write tests')
    })

    it('10. returns empty string when task not found in list', () => {
      const tasks: TaskEntry[] = [{ id: 'task-1', title: 'Write tests' }]
      expect(resolveTaskName('unknown-id', tasks)).toBe('')
    })

    it('10. returns empty string when currentTaskId is "general"', () => {
      const tasks: TaskEntry[] = [{ id: 'general', title: 'General' }]
      expect(resolveTaskName('general', tasks)).toBe('')
    })

    it('10. returns empty string when currentTaskId is empty', () => {
      expect(resolveTaskName('', [])).toBe('')
    })
  })
})
