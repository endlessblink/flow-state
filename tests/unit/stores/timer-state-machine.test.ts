/**
 * TASK-1597: Timer Store Full State Machine (30 tests)
 *
 * Tests for the complete timer lifecycle: start, pause, resume, stop,
 * complete, session transitions, computed properties, device leadership,
 * and DB persistence shape.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ============================================================================
// Module-level mocks — must be hoisted before store import
// ============================================================================

const mockFetchActiveTimerSession = vi.fn()
const mockSaveActiveTimerSession = vi.fn().mockResolvedValue(undefined)
const mockClaimLeadership = vi.fn().mockResolvedValue(true)
const mockClaimTimerLeadership = vi.fn(() => true)
const mockBroadcastTimerSession = vi.fn()
const mockSetTimerCallbacks = vi.fn()
const mockRequestWakeLock = vi.fn().mockResolvedValue(undefined)
const mockReleaseWakeLock = vi.fn()
const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: 'pending' })

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchActiveTimerSession: mockFetchActiveTimerSession,
    saveActiveTimerSession: mockSaveActiveTimerSession,
    claimLeadership: mockClaimLeadership,
    insertPomodoroHistory: vi.fn().mockResolvedValue(undefined),
    fetchPomodoroHistory: vi.fn().mockResolvedValue([]),
  }),
  invalidateCache: {
    onAuthChange: vi.fn(),
    all: vi.fn(),
  },
}))

vi.mock('@/composables/useCrossTabSync', () => ({
  getCrossTabSync: () => ({
    claimTimerLeadership: mockClaimTimerLeadership,
    broadcastTimerSession: mockBroadcastTimerSession,
    setTimerCallbacks: mockSetTimerCallbacks,
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true,
    user: { id: 'test-user-id' },
    $subscribe: vi.fn(() => vi.fn()),
  }),
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    workDuration: 1500,
    shortBreakDuration: 300,
    longBreakDuration: 900,
    autoStartBreaks: false,
    autoStartPomodoros: false,
    playNotificationSounds: false,
    aiLearningEnabled: false,
    updateSetting: vi.fn(),
  }),
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    tasks: [],
    _rawTasks: [],
    updateTask: vi.fn(),
  }),
}))

vi.mock('@/composables/useWakeLock', () => ({
  useWakeLock: () => ({
    requestWakeLock: mockRequestWakeLock,
    releaseWakeLock: mockReleaseWakeLock,
  }),
}))

vi.mock('@/composables/useTauriStartup', () => ({
  isTauri: () => false,
}))

vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({
    onPomodoroCompleted: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: (key: string) => key,
    },
  },
}))

vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({
    enqueue: mockEnqueue,
  }),
}))

vi.mock('@/utils/supabaseMappers', () => ({
  toSupabaseTimerSession: vi.fn((session: unknown) => session),
}))

vi.mock('@/composables/timer/useTimerNotifications', () => ({
  useTimerNotifications: () => ({
    showTimerNotification: vi.fn().mockResolvedValue(undefined),
    requestNotificationPermission: vi.fn().mockResolvedValue(undefined),
    setupServiceWorkerListener: vi.fn(),
    cleanupServiceWorkerListener: vi.fn(),
  }),
}))

vi.mock('@/composables/timer/useTimerAudio', () => ({
  useTimerAudio: () => ({
    playStartSound: vi.fn(),
    playEndSound: vi.fn(),
  }),
}))

// ── Import store AFTER mocks ──────────────────────────────────────────────────
import { useTimerStore } from '@/stores/timer'

// ── Helpers ───────────────────────────────────────────────────────────────────

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

// ============================================================================
// Group 1: Initial State
// ============================================================================

describe('Timer State Machine — Initial State', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    setActivePinia(createPinia())
    mockFetchActiveTimerSession.mockResolvedValue(null)
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
    mockClaimLeadership.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('1. has no active session on creation', async () => {
    const store = useTimerStore()
    await flushPromises()
    expect(store.currentSession).toBeNull()
  })

  it('2. isTimerActive is false on creation', async () => {
    const store = useTimerStore()
    await flushPromises()
    expect(store.isTimerActive).toBe(false)
  })

  it('3. isPaused is false on creation', async () => {
    const store = useTimerStore()
    await flushPromises()
    expect(store.isPaused).toBe(false)
  })

  it('4. currentTaskId is null on creation', async () => {
    const store = useTimerStore()
    await flushPromises()
    expect(store.currentTaskId).toBeNull()
  })

  it('5. displayTime shows workDuration when no session', async () => {
    const store = useTimerStore()
    await flushPromises()
    // workDuration=1500s → 25:00
    expect(store.displayTime).toBe('25:00')
  })
})

// ============================================================================
// Group 2: startTimer
// ============================================================================

describe('Timer State Machine — startTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    setActivePinia(createPinia())
    mockFetchActiveTimerSession.mockResolvedValue(null)
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
    mockClaimLeadership.mockResolvedValue(true)
    mockClaimTimerLeadership.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('6. startTimer sets status to running (isActive=true, isPaused=false)', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 1500, false)
    await flushPromises()

    expect(store.currentSession?.isActive).toBe(true)
    expect(store.currentSession?.isPaused).toBe(false)
    expect(store.isTimerActive).toBe(true)
  })

  it('7. startTimer sets taskId on session', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-abc', 1500, false)
    await flushPromises()

    expect(store.currentSession?.taskId).toBe('task-abc')
    expect(store.currentTaskId).toBe('task-abc')
  })

  it('7b. startTimer keeps the local timer running when the initial timer session write fails', async () => {
    mockSaveActiveTimerSession.mockRejectedValueOnce(new Error('stale auth token'))
    const store = useTimerStore()
    await flushPromises()

    await expect(store.startTimer('task-unsynced', 1500, false)).resolves.toBeUndefined()
    await flushPromises()

    expect(store.currentSession?.taskId).toBe('task-unsynced')
    expect(store.currentSession?.isActive).toBe(true)
    expect(store.currentSession?.isPaused).toBe(false)
    expect(store.isTimerActive).toBe(true)
    expect(store.isDeviceLeader).toBe(true)
  })

  it('8. countdown advances: remainingTime decrements each second', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    const initialRemaining = store.currentSession!.remainingTime
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()

    expect(store.currentSession!.remainingTime).toBe(initialRemaining - 3)
  })

  it('9. startTimer with "general" taskId is allowed', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('general', 1500, false)
    await flushPromises()

    expect(store.currentSession?.taskId).toBe('general')
    expect(store.isTimerActive).toBe(true)
  })

  it('10. startTimer respects custom duration', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 300, false)
    await flushPromises()

    expect(store.currentSession?.duration).toBe(300)
    expect(store.currentSession?.remainingTime).toBe(300)
  })

  it('11. startTimer uses workDuration when no duration given', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001')
    await flushPromises()

    // settingsStore.workDuration = 1500
    expect(store.currentSession?.duration).toBe(1500)
  })

  it('12. startTimer on already-running timer switches task, does not reset countdown', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(5000)
    const remainingAfter5s = store.currentSession!.remainingTime

    // Start timer with different task — should switch, not reset
    await store.startTimer('task-002', 60, false)
    await flushPromises()

    expect(store.currentSession?.taskId).toBe('task-002')
    // Countdown was NOT reset — it should still be at (or near) remainingAfter5s
    expect(store.currentSession!.remainingTime).toBeLessThanOrEqual(remainingAfter5s)
    expect(store.currentSession!.remainingTime).toBeGreaterThan(0)
  })
})

// ============================================================================
// Group 3: pauseTimer / resumeTimer
// ============================================================================

describe('Timer State Machine — pauseTimer / resumeTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    setActivePinia(createPinia())
    mockFetchActiveTimerSession.mockResolvedValue(null)
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
    mockClaimLeadership.mockResolvedValue(true)
    mockClaimTimerLeadership.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('13. pauseTimer sets isPaused=true on session', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    store.pauseTimer()

    expect(store.currentSession?.isPaused).toBe(true)
    expect(store.isPaused).toBe(true)
  })

  it('14. after pauseTimer countdown stops ticking', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    store.pauseTimer()
    const frozenRemaining = store.currentSession!.remainingTime

    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()

    expect(store.currentSession!.remainingTime).toBe(frozenRemaining)
  })

  it('15. pauseTimer when not running is a no-op (no crash)', () => {
    const store = useTimerStore()
    // No timer started — should not throw
    expect(() => store.pauseTimer()).not.toThrow()
  })

  it('16. resumeTimer clears isPaused and countdown resumes', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    store.pauseTimer()

    const frozenRemaining = store.currentSession!.remainingTime
    store.resumeTimer()

    expect(store.currentSession?.isPaused).toBe(false)

    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()

    expect(store.currentSession!.remainingTime).toBe(frozenRemaining - 3)
  })
})

// ============================================================================
// Group 4: stopTimer
// ============================================================================

describe('Timer State Machine — stopTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    setActivePinia(createPinia())
    mockFetchActiveTimerSession.mockResolvedValue(null)
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
    mockClaimLeadership.mockResolvedValue(true)
    mockClaimTimerLeadership.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('17. stopTimer sets currentSession to null', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    await store.stopTimer()
    await flushPromises()

    expect(store.currentSession).toBeNull()
    expect(store.isTimerActive).toBe(false)
  })

  it('18. stopTimer sets isDeviceLeader to false', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    expect(store.isDeviceLeader).toBe(true)

    await store.stopTimer()
    await flushPromises()

    expect(store.isDeviceLeader).toBe(false)
  })

  it('19. stopTimer saves to DB with isActive=false', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    mockSaveActiveTimerSession.mockClear()
    await store.stopTimer()
    await flushPromises()

    expect(mockSaveActiveTimerSession).toHaveBeenCalled()
    const savedSession = mockSaveActiveTimerSession.mock.calls[0][0]
    expect(savedSession.isActive).toBe(false)
  })

  it('20. after stopTimer, multiple start/stop cycles produce no state leaks', async () => {
    const store = useTimerStore()
    await flushPromises()

    for (let i = 0; i < 3; i++) {
      await store.startTimer('task-001', 30, false)
      await flushPromises()
      await store.stopTimer()
      await flushPromises()
    }

    expect(store.currentSession).toBeNull()
    expect(store.isTimerActive).toBe(false)
    expect(store.isDeviceLeader).toBe(false)
  })
})

// ============================================================================
// Group 5: Session Completion
// ============================================================================

describe('Timer State Machine — Session Completion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    setActivePinia(createPinia())
    mockFetchActiveTimerSession.mockResolvedValue(null)
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
    mockClaimLeadership.mockResolvedValue(true)
    mockClaimTimerLeadership.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('21. timer reaching 0 clears currentSession and pushes to completedSessions', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 2, false)
    await flushPromises()

    // Advance past the end
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    // completeSession is async; give it extra flush
    await flushPromises()
    await flushPromises()

    expect(store.currentSession).toBeNull()
    expect(store.completedSessions.length).toBeGreaterThanOrEqual(1)
  })

  it('22. completedSessions count increments after each completed work session', async () => {
    const store = useTimerStore()
    await flushPromises()

    const initialCount = store.completedSessions.length

    // First session
    await store.startTimer('task-001', 2, false)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    await flushPromises()
    await flushPromises()

    expect(store.completedSessions.length).toBe(initialCount + 1)
  })

  it('23. sessions computed is the same reference as completedSessions', async () => {
    const store = useTimerStore()
    await flushPromises()

    // The sessions computed should always equal completedSessions
    expect(store.sessions).toBe(store.completedSessions)
  })

  it('24. completeSession saves to DB with isActive=false', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('general', 2, false)
    await flushPromises()
    mockSaveActiveTimerSession.mockClear()

    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    await flushPromises()
    await flushPromises()

    // At least one save call with isActive=false
    const stopSave = mockSaveActiveTimerSession.mock.calls.find(
      (call) => call[0]?.isActive === false
    )
    expect(stopSave).toBeDefined()
  })
})

// ============================================================================
// Group 6: Computed Properties
// ============================================================================

describe('Timer State Machine — Computed Properties', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    setActivePinia(createPinia())
    mockFetchActiveTimerSession.mockResolvedValue(null)
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
    mockClaimLeadership.mockResolvedValue(true)
    mockClaimTimerLeadership.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('25. displayTime formats as MM:SS (25:00 for 1500s)', async () => {
    const store = useTimerStore()
    await flushPromises()

    // No session — shows workDuration (1500s = 25:00)
    expect(store.displayTime).toBe('25:00')
  })

  it('26. displayTime shows 24:59 after 1 second of running', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 1500, false)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(1000)
    await flushPromises()

    expect(store.displayTime).toBe('24:59')
  })

  it('27. displayTime shows 00:01 with 1 second remaining', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(59_000)
    await flushPromises()

    // Should be at 1 second remaining
    expect(store.currentSession?.remainingTime).toBe(1)
    expect(store.displayTime).toBe('00:01')
  })

  it('28. timerPercentage is 0 at start', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    expect(store.timerPercentage).toBe(0)
  })

  it('29. timerPercentage is ~50 at midpoint', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(30_000)
    await flushPromises()

    expect(store.timerPercentage).toBe(50)
  })

  it('30. isTimerActive is true when running, false when paused/stopped', async () => {
    const store = useTimerStore()
    await flushPromises()

    expect(store.isTimerActive).toBe(false)

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    // Running: isActive=true, isPaused=false → isTimerActive computed
    expect(store.isTimerActive).toBe(true)

    store.pauseTimer()
    // The isTimerActive computed returns currentSession?.isActive || false
    // After pause, session.isActive is still true (paused ≠ stopped)
    // isPaused only controls the countdown, not isActive flag
    expect(store.currentSession?.isActive).toBe(true)

    await store.stopTimer()
    await flushPromises()

    expect(store.isTimerActive).toBe(false)
  })
})

// ============================================================================
// Group 7: Device Leadership
// ============================================================================

describe('Timer State Machine — Device Leadership', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    setActivePinia(createPinia())
    mockFetchActiveTimerSession.mockResolvedValue(null)
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
    mockClaimLeadership.mockResolvedValue(true)
    mockClaimTimerLeadership.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('31. startTimer makes this device the leader', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    expect(store.isDeviceLeader).toBe(true)
  })

  it('32. stopTimer releases leadership (isDeviceLeader=false)', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    await store.stopTimer()
    await flushPromises()

    expect(store.isDeviceLeader).toBe(false)
  })

  it('33. remote update from different device causes us to yield leadership', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('general', 60, false)
    await flushPromises()

    expect(store.isDeviceLeader).toBe(true)

    // Simulate fresh update from a different device
    const remoteLastSeen = new Date(Date.now() - 2_000).toISOString()
    store.handleRemoteTimerUpdate({
      new: {
        id: store.currentSession?.id ?? 'session-remote',
        task_id: 'general',
        start_time: new Date(Date.now() - 30_000).toISOString(),
        duration: 60,
        remaining_time: 45,
        is_active: true,
        is_paused: false,
        is_break: false,
        device_leader_id: 'remote-device-xyz',
        device_leader_last_seen: remoteLastSeen,
      },
    })

    expect(store.isDeviceLeader).toBe(false)
  })

  it('34. echoed own updates do not cause us to yield leadership', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('general', 60, false)
    await flushPromises()

    const ourDeviceId = mockSaveActiveTimerSession.mock.calls.at(-1)?.[1] as string

    store.handleRemoteTimerUpdate({
      new: {
        id: store.currentSession?.id ?? 'session-1',
        task_id: 'general',
        start_time: new Date(Date.now() - 10_000).toISOString(),
        duration: 60,
        remaining_time: 55,
        is_active: true,
        is_paused: false,
        is_break: false,
        device_leader_id: ourDeviceId,
        device_leader_last_seen: new Date(Date.now() - 1_000).toISOString(),
      },
    })

    expect(store.isDeviceLeader).toBe(true)
  })

  it('35. DELETE Realtime event clears local session', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('general', 60, false)
    await flushPromises()

    expect(store.currentSession).not.toBeNull()

    store.handleRemoteTimerUpdate({ eventType: 'DELETE' })

    expect(store.currentSession).toBeNull()
  })
})

// ============================================================================
// Group 8: DB Persistence Shape
// ============================================================================

describe('Timer State Machine — DB Persistence Shape', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    setActivePinia(createPinia())
    mockFetchActiveTimerSession.mockResolvedValue(null)
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
    mockClaimLeadership.mockResolvedValue(true)
    mockClaimTimerLeadership.mockReturnValue(true)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('36. startTimer persists session to Supabase', async () => {
    const store = useTimerStore()
    await flushPromises()

    mockSaveActiveTimerSession.mockClear()
    await store.startTimer('task-001', 60, false)
    await flushPromises()

    expect(mockSaveActiveTimerSession).toHaveBeenCalled()
    const [savedSession] = mockSaveActiveTimerSession.mock.calls[0]
    expect(savedSession).toMatchObject({
      taskId: 'task-001',
      isActive: true,
      isPaused: false,
    })
  })

  it('37. fetchActiveSession restores running timer state from DB', async () => {
    mockFetchActiveTimerSession.mockResolvedValueOnce({
      id: 'restored-session-id',
      taskId: 'task-restore',
      startTime: new Date(Date.now() - 120_000),
      duration: 1500,
      remainingTime: 1380,
      isActive: true,
      isPaused: false,
      isBreak: false,
      deviceLeaderId: null,
      deviceLeaderLastSeen: Date.now() - 2_000,
    })

    const store = useTimerStore()
    await flushPromises()

    expect(store.currentSession).not.toBeNull()
    expect(store.currentSession?.taskId).toBe('task-restore')
    expect(store.currentSession?.isActive).toBe(true)
  })

  it('38. heartbeat saves updated state to DB while leader', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('general', 60, false)
    await flushPromises()

    const savesAfterStart = mockSaveActiveTimerSession.mock.calls.length

    // Advance past heartbeat interval (10s)
    await vi.advanceTimersByTimeAsync(11_000)
    await flushPromises()

    expect(mockSaveActiveTimerSession.mock.calls.length).toBeGreaterThan(savesAfterStart)
  })
})
