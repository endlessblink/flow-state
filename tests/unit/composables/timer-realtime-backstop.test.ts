/**
 * TASK-1790: Regression tests for the follower-poll Realtime backstop.
 *
 * Background:
 *   Commit f616303a removed `resumeFollowerPoll()` from idle-transition sites and
 *   made `initializeSync()`'s no-active-session branch rely solely on Supabase
 *   Realtime to detect sessions started by other devices. Documented Realtime
 *   drops (BUG-1320: CLOSED/TIMED_OUT/CHANNEL_ERROR) then left the Vue app
 *   permanently deaf to sessions started by the KDE widget.
 *
 *   Fix: poll runs continuously (15s cadence) as a backstop for Realtime.
 *
 * These tests fail if the regression is reintroduced.
 *
 * Source: src/composables/timer/useTimerSync.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PomodoroSession } from '@/stores/timer'

const SYNC_SRC = readFileSync(
  resolve(__dirname, '../../../src/composables/timer/useTimerSync.ts'),
  'utf-8'
)
const TIMER_STORE_SRC = readFileSync(
  resolve(__dirname, '../../../src/stores/timer.ts'),
  'utf-8'
)

async function flushAsync() {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
}

// ── Mocks ────────────────────────────────────────────────────────────

// Capture interval callbacks AND their pause/resume controls in order:
// [0]=countdown, [1]=heartbeat, [2]=followerPoll
interface IntervalRecord {
  callback: () => Promise<void> | void
  intervalMs: number
  pause: ReturnType<typeof vi.fn>
  resume: ReturnType<typeof vi.fn>
}
const intervals: IntervalRecord[] = []

vi.mock('@vueuse/core', () => ({
  useIntervalFn: (callback: () => Promise<void> | void, interval: number) => {
    const record: IntervalRecord = {
      callback,
      intervalMs: interval,
      pause: vi.fn(),
      resume: vi.fn(),
    }
    intervals.push(record)
    return { pause: record.pause, resume: record.resume }
  },
}))

vi.mock('@/config/timing', () => ({
  PENDING_WRITE_TIMEOUT_MS: 5000,
}))

import { useTimerSync, type TimerSyncDeps } from '@/composables/timer/useTimerSync'

// ── Helpers ──────────────────────────────────────────────────────────

function makeDeps(overrides: Partial<TimerSyncDeps> = {}): TimerSyncDeps {
  return {
    currentSession: ref<PomodoroSession | null>(null),
    completedSessions: ref<PomodoroSession[]>([]),
    isLeader: ref(false),
    isDeviceLeader: ref(false),
    hasLoadedSession: ref(false),
    deviceId: 'device-test',
    completedSessionIds: new Set<string>(),
    crossTabSync: {
      claimTimerLeadership: vi.fn().mockReturnValue(true),
      broadcastTimerSession: vi.fn(),
      setTimerCallbacks: vi.fn(),
      isTimerLeader: ref(false),
      timerLeaderState: ref(null),
      isListening: ref(true),
      currentTabId: ref('tab-1'),
      pendingLocalOperations: ref(new Map()),
      initialize: vi.fn(),
      cleanup: vi.fn(),
      trackLocalOperation: vi.fn(),
      broadcastTaskOperation: vi.fn(),
      broadcastUIStateChange: vi.fn(),
      broadcastCanvasChange: vi.fn(),
    } as unknown as TimerSyncDeps['crossTabSync'],
    fetchActiveTimerSession: vi.fn().mockResolvedValue(null),
    saveActiveTimerSession: vi.fn().mockResolvedValue(undefined),
    claimLeadership: vi.fn().mockResolvedValue(true),
    requestWakeLock: vi.fn().mockResolvedValue(undefined),
    releaseWakeLock: vi.fn(),
    authStore: { isAuthenticated: true },
    onCountdownComplete: vi.fn(),
    ...overrides,
  }
}

const FOLLOWER_POLL_INDEX = 2

// ── Tests ────────────────────────────────────────────────────────────

describe('TASK-1790: follower poll as Realtime backstop', () => {
  beforeEach(() => {
    intervals.length = 0
    vi.clearAllMocks()
  })

  describe('Cadence', () => {
    it('follower poll interval is at most 15s (cheap enough to run continuously as Realtime backstop)', () => {
      useTimerSync(makeDeps())
      const followerPoll = intervals[FOLLOWER_POLL_INDEX]
      expect(followerPoll, 'follower poll interval not registered').toBeTruthy()
      // 15s = 15000ms. Lower is fine. Higher would slow cross-device pickup.
      expect(followerPoll.intervalMs).toBeLessThanOrEqual(15_000)
      // Floor: 3s. Below this we'd be back to BUG-1085's noise.
      expect(followerPoll.intervalMs).toBeGreaterThanOrEqual(3_000)
    })
  })

  describe('No-session branch: regression of f616303a', () => {
    it('follower poll does NOT pause itself when fetch returns null (must stay alive as Realtime backstop)', async () => {
      // Pre-regression behaviour: when poll found no session it called pauseFollowerPoll().
      // That left the Vue app deaf if Realtime missed an INSERT from another device.
      // Post-fix: poll keeps ticking even when DB has no active session.
      const deps = makeDeps({
        fetchActiveTimerSession: vi.fn().mockResolvedValue(null),
        isDeviceLeader: ref(false),
        currentSession: ref<PomodoroSession | null>(null),
      })
      useTimerSync(deps)

      const followerPoll = intervals[FOLLOWER_POLL_INDEX]
      await followerPoll.callback()

      expect(followerPoll.pause).not.toHaveBeenCalled()
    })

    it('initializeSync starts follower poll when DB has no active session (Realtime-miss backstop)', async () => {
      // The exact regression: KDE widget starts a session AFTER Vue init.
      // Realtime should fire, but documented as flaky (BUG-1320). Without
      // the poll backstop, Vue stays at 25:00 forever.
      // initializeSync is auto-called by the auth watcher with immediate:true.
      const fetchMock = vi.fn().mockResolvedValue(null)
      const deps = makeDeps({
        fetchActiveTimerSession: fetchMock,
        hasLoadedSession: ref(false),
        authStore: { isAuthenticated: true },
      })
      useTimerSync(deps)
      await flushAsync()
      // Ensure fetchActiveTimerSession ran (proves we entered initializeSync's body)
      expect(fetchMock).toHaveBeenCalled()
      await flushAsync()

      const followerPoll = intervals[FOLLOWER_POLL_INDEX]
      expect(followerPoll.resume).toHaveBeenCalled()
    })

    it('source-of-truth: useTimerSync no-session init branch calls resumeFollowerPoll', () => {
      // Guard against future code edits that re-strip the resume call.
      // Match the comment we left at the fix site + the resume call.
      expect(SYNC_SRC).toMatch(/TASK-1790[\s\S]{0,400}resumeFollowerPoll\(\)/)
    })
  })

  describe('30s failure-backoff resume', () => {
    it('source-of-truth: backoff retry condition does NOT gate on currentSession.value', () => {
      // Pre-regression: `if (!isDeviceLeader.value && currentSession.value)` — meant
      // an idle device that had a transient network blip would never re-poll.
      // Post-fix: drops the currentSession check so the poll resumes regardless.
      //
      // Asserting against the source is more reliable than trying to drive the
      // 30s setTimeout through fake timers + isPolling guard interactions.
      const failureBlock = SYNC_SRC.match(
        /consecutiveFailures >= 3[\s\S]{0,1200}?resumeFollowerPoll\(\)/
      )
      expect(failureBlock, 'failure-backoff block not found').toBeTruthy()
      expect(
        failureBlock![0],
        'backoff retry must not require currentSession.value — that was the BUG-1085 regression for idle devices'
      ).not.toMatch(/currentSession\.value\s*\)/)
    })
  })

  describe('Class-of-bug: idle Vue device picks up session started elsewhere', () => {
    // The exact symptom from the TASK-1790 screenshot:
    // - Vue boots with no active session (DB empty at init)
    // - KDE widget starts a session AFTER Vue init
    // - Realtime doesn't fire (or fires before subscription is ready)
    // - Vue must rely on the follower poll to discover the new session
    //
    // This simulates that flow at the composable level so future refactors
    // can't quietly break it.
    it('follower poll discovers an externally-created session after idle init', async () => {
      const fetchMock = vi.fn().mockResolvedValue(null)
      const currentSession = ref<PomodoroSession | null>(null)
      const deps = makeDeps({
        fetchActiveTimerSession: fetchMock,
        currentSession,
        isDeviceLeader: ref(false),
        hasLoadedSession: ref(false),
      })
      useTimerSync(deps)

      // 1. Init completes with no session (poll backstop must arm)
      await flushAsync()
      const followerPoll = intervals[FOLLOWER_POLL_INDEX]
      expect(followerPoll.resume).toHaveBeenCalled()
      expect(currentSession.value).toBeNull()

      // 2. KDE widget writes a session to the DB. Realtime drops it.
      //    The next poll cycle finds it.
      const externalSession: PomodoroSession = {
        id: 'cc0e8400-e29b-41d4-a716-446655440099',
        taskId: '7009f622-e45f-428e-be41-f0e0900ee549',
        startTime: new Date(),
        duration: 1500,
        remainingTime: 1461,
        isActive: true,
        isPaused: false,
        isBreak: false,
      }
      fetchMock.mockResolvedValue(externalSession)

      // 3. Tick the poll
      await followerPoll.callback()

      // 4. Vue side now sees the session — the symptom (`25:00` stuck) is gone
      expect(currentSession.value).not.toBeNull()
      expect(currentSession.value?.id).toBe(externalSession.id)
      expect(currentSession.value?.isActive).toBe(true)
    })

    it('poll does NOT silently stop when DB is empty (regression catcher)', async () => {
      // The bug: pauseFollowerPoll() was called when DB returned null, killing
      // the backstop. This guards against any future "optimization" that
      // re-introduces a self-pause path.
      const deps = makeDeps({
        fetchActiveTimerSession: vi.fn().mockResolvedValue(null),
        isDeviceLeader: ref(false),
      })
      useTimerSync(deps)
      const followerPoll = intervals[FOLLOWER_POLL_INDEX]

      await followerPoll.callback()
      await followerPoll.callback()
      await followerPoll.callback()

      // No pause across three idle ticks — poll must keep running.
      expect(followerPoll.pause).not.toHaveBeenCalled()
    })
  })

  describe('timer.ts idle-transition sites: regression of f616303a', () => {
    it('source-of-truth: stopTimer path resumes follower poll after clearing currentSession', () => {
      // f616303a stripped `sync.resumeFollowerPoll()` here. Without it, a device
      // that stopped a timer would stop listening for sessions started elsewhere.
      const stopBlock = TIMER_STORE_SRC.match(
        /currentSession\.value = null[\s\S]{0,400}broadcastSession\(\)[\s\S]{0,600}/
      )
      expect(stopBlock, 'stop path not found').toBeTruthy()
      expect(stopBlock![0]).toMatch(/sync\.resumeFollowerPoll\(\)/)
    })

    it('source-of-truth: completeSession path resumes follower poll after isDeviceLeader=false', () => {
      // The second site f616303a stripped — completion transition.
      const completeBlock = TIMER_STORE_SRC.match(
        /isDeviceLeader\.value = false[\s\S]{0,400}finally\s*\{/
      )
      expect(completeBlock, 'completeSession finally region not found').toBeTruthy()
      expect(completeBlock![0]).toMatch(/sync\.resumeFollowerPoll\(\)/)
    })
  })
})
