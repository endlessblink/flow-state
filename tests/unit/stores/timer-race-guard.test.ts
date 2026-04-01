/**
 * BUG-TIMER-RACE: Regression tests for the isStarting guard in useTimerSync.
 *
 * The race condition: startTimer() calls clearExistingSession() (async),
 * then saveTimerSessionWithLeadership() (async). Between these two awaits,
 * the follower poll (every 3s) can fire, find no active session (it was just
 * cleared), and null out currentSession. The isStarting guard blocks both
 * followerPoll and resyncFromDatabase during this window.
 *
 * Guard location: src/composables/timer/useTimerSync.ts:130-131
 * Checked at: line 139 (followerPoll) and line 717 (resyncFromDatabase)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import type { PomodoroSession } from '@/stores/timer'

// ── Mocks ────────────────────────────────────────────────────────────

// Capture interval callbacks in order: [0]=countdown, [1]=heartbeat, [2]=followerPoll
const intervalCallbacks: Array<() => Promise<void> | void> = []

vi.mock('@vueuse/core', () => ({
  useIntervalFn: (callback: () => Promise<void> | void, _interval: number, _opts?: unknown) => {
    intervalCallbacks.push(callback)
    return { pause: vi.fn(), resume: vi.fn() }
  },
}))

vi.mock('@/config/timing', () => ({
  PENDING_WRITE_TIMEOUT_MS: 5000,
}))

import { useTimerSync, type TimerSyncDeps } from '@/composables/timer/useTimerSync'

// ── Helpers ──────────────────────────────────────────────────────────

function makeSession(overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id: 'aa0e8400-e29b-41d4-a716-446655440099',
    taskId: 'bb0e8400-e29b-41d4-a716-446655440099',
    startTime: new Date(),
    duration: 1500,
    remainingTime: 1200,
    isActive: true,
    isPaused: false,
    isBreak: false,
    ...overrides,
  }
}

function makeDeps(overrides: Partial<TimerSyncDeps> = {}): TimerSyncDeps {
  return {
    currentSession: ref<PomodoroSession | null>(null),
    completedSessions: ref<PomodoroSession[]>([]),
    isLeader: ref(false),
    isDeviceLeader: ref(false), // Follower by default (required for poll to run)
    hasLoadedSession: ref(true), // Skip initializeSync to isolate guard tests
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

// ── Tests ────────────────────────────────────────────────────────────

describe('BUG-TIMER-RACE: isStarting guard in useTimerSync', () => {
  beforeEach(() => {
    intervalCallbacks.length = 0
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('followerPoll does NOT call fetchActiveTimerSession when isStarting=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(null)
    const deps = makeDeps({ fetchActiveTimerSession: fetchMock })
    const sync = useTimerSync(deps)

    // Set the guard (simulating timer.ts startTimer sequence)
    sync.setStartingGuard(true)

    // The follower poll is the 3rd interval registered (index 2)
    // [0]=countdown, [1]=heartbeat, [2]=followerPoll
    expect(intervalCallbacks.length).toBe(3)
    const followerPoll = intervalCallbacks[2]
    await followerPoll()

    // fetchActiveTimerSession should NOT have been called — isStarting blocks it
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('followerPoll calls fetchActiveTimerSession when isStarting=false (normal operation)', async () => {
    const session = makeSession()
    const fetchMock = vi.fn().mockResolvedValue(session)
    const deps = makeDeps({
      fetchActiveTimerSession: fetchMock,
      isDeviceLeader: ref(false), // Must be follower for poll to run
    })
    const sync = useTimerSync(deps)

    // Guard is NOT set — normal operation
    // followerPoll at index 2
    const followerPoll = intervalCallbacks[2]
    await followerPoll()

    // Follower poll should have called fetch
    expect(fetchMock).toHaveBeenCalled()
  })

  it('resyncFromDatabase is blocked when isStarting=true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(null)
    const deps = makeDeps({ fetchActiveTimerSession: fetchMock })
    const sync = useTimerSync(deps)

    sync.setStartingGuard(true)

    // resyncFromDatabase has a 1s debounce — we need to wait past it
    // Call twice with time gap to bypass debounce
    await sync.resyncFromDatabase()

    // Fetch should NOT be called because isStarting blocks resync at line 717
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resyncFromDatabase works after guard is released', async () => {
    const session = makeSession()
    const fetchMock = vi.fn().mockResolvedValue(session)
    const deps = makeDeps({ fetchActiveTimerSession: fetchMock })
    const sync = useTimerSync(deps)

    // Set and release guard
    sync.setStartingGuard(true)
    sync.setStartingGuard(false)

    await sync.resyncFromDatabase()

    expect(fetchMock).toHaveBeenCalled()
  })

  it('currentSession survives when guard protects against poll during async start gap', async () => {
    const fetchMock = vi.fn().mockResolvedValue(null) // Poll would find nothing
    const deps = makeDeps({
      fetchActiveTimerSession: fetchMock,
      isDeviceLeader: ref(false),
    })
    const sync = useTimerSync(deps)

    // 1. Set guard BEFORE async operations (as timer.ts does)
    sync.setStartingGuard(true)

    // 2. Place session in currentSession (simulating timer.ts between the awaits)
    const session = makeSession()
    deps.currentSession.value = session

    // 3. Follower poll fires during the gap
    const followerPoll = intervalCallbacks[2]
    await followerPoll()

    // 4. Session should STILL be there — poll was blocked by guard
    expect(deps.currentSession.value).toBeTruthy()
    expect(deps.currentSession.value?.id).toBe(session.id)

    // 5. Release guard
    sync.setStartingGuard(false)
  })
})
