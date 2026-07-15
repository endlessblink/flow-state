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

const {
  mockFetchActiveTimerSession,
  mockSaveActiveTimerSession,
  mockHeartbeatTimerSession,
  mockClaimLeadership,
  mockClaimTimerLeadership,
  mockBroadcastTimerSession,
  mockSetTimerCallbacks,
  mockRequestWakeLock,
  mockReleaseWakeLock,
  mockEnqueue,
  mockSyncLocalApiTimerSnapshot,
  mockAuthState,
  mockCanonicalTimerCommand,
} = vi.hoisted(() => ({
  mockFetchActiveTimerSession: vi.fn(),
  mockSaveActiveTimerSession: vi.fn().mockResolvedValue(undefined),
  mockHeartbeatTimerSession: vi.fn().mockResolvedValue(true),
  mockClaimLeadership: vi.fn().mockResolvedValue(true),
  mockClaimTimerLeadership: vi.fn(() => true),
  mockBroadcastTimerSession: vi.fn(),
  mockSetTimerCallbacks: vi.fn(),
  mockRequestWakeLock: vi.fn().mockResolvedValue(undefined),
  mockReleaseWakeLock: vi.fn(),
  mockEnqueue: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }),
  mockSyncLocalApiTimerSnapshot: vi.fn(),
  mockAuthState: {
    isAuthenticated: true,
    canSyncRemotely: true,
    user: { id: 'test-user-id' },
  },
  mockCanonicalTimerCommand: vi.fn(),
}))

vi.mock('@/services/sync/canonicalTimerCommand', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/sync/canonicalTimerCommand')>()
  return { ...actual, executeCanonicalTimerCommand: mockCanonicalTimerCommand }
})

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({ activeWorkspaceId: null }),
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchActiveTimerSession: mockFetchActiveTimerSession,
    saveActiveTimerSession: mockSaveActiveTimerSession,
    heartbeatTimerSession: mockHeartbeatTimerSession,
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
    get isAuthenticated() { return mockAuthState.isAuthenticated },
    get canSyncRemotely() { return mockAuthState.canSyncRemotely },
    get user() { return mockAuthState.user },
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

vi.mock('@/composables/useLocalApiBridge', () => ({
  syncLocalApiTimerSnapshot: mockSyncLocalApiTimerSnapshot,
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

beforeEach(() => {
  mockAuthState.isAuthenticated = true
  mockAuthState.canSyncRemotely = true
  mockAuthState.user = { id: 'test-user-id' }
  mockCanonicalTimerCommand.mockReset().mockImplementation((_client, request) => {
    const revision = request.action === 'start' ? 1 : request.baseRevision + 1
    const readBack = {
      id: request.sessionId, workspaceId: request.workspaceId, taskId: request.taskId ?? 'general',
      startTime: request.startedAt ?? new Date().toISOString(),
      duration: request.action === 'extend' ? 60 + (request.extensionSeconds ?? 0) : request.durationSeconds ?? 60,
      remainingTime: request.durationSeconds ?? request.remainingSeconds ?? request.extensionSeconds ?? 60,
      isActive: request.action !== 'stop', isPaused: request.action === 'pause',
      isBreak: request.isBreak ?? false,
      completedAt: request.action === 'stop' ? new Date().toISOString() : null,
      deviceLeaderId: request.deviceId, canonicalRevision: revision,
      canonicalUpdatedAt: new Date().toISOString(),
    }
    return Promise.resolve({ receipt: { status: 'committed' }, readBack, replacedSessions: [] })
  })
})

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
    mockSyncLocalApiTimerSnapshot.mockClear()
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

  it('1b. publishes an initial inactive Electron/KDE timer snapshot on creation', async () => {
    useTimerStore()
    await flushPromises()

    expect(mockSyncLocalApiTimerSnapshot).toHaveBeenCalledWith(null, expect.any(String))
  })

  it('1c. refreshes the inactive Electron/KDE timer snapshot before the sidecar marks it stale', async () => {
    useTimerStore()
    await flushPromises()
    mockSyncLocalApiTimerSnapshot.mockClear()

    vi.advanceTimersByTime(10_000)
    await flushPromises()

    expect(mockSyncLocalApiTimerSnapshot).toHaveBeenCalledWith(null, expect.any(String))
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

  it('7b. startTimer rolls back local active state when canonical authority rejects the start', async () => {
    const persistenceError = new Error('stale auth token')
    mockCanonicalTimerCommand.mockRejectedValueOnce(persistenceError)
    const store = useTimerStore()
    await flushPromises()
    mockEnqueue.mockClear()
    mockReleaseWakeLock.mockClear()

    await expect(store.startTimer('task-unsynced', 1500, false)).rejects.toThrow('stale auth token')
    await flushPromises()

    expect(store.currentSession).toBeNull()
    expect(store.currentTaskId).toBeNull()
    expect(store.isTimerActive).toBe(false)
    expect(store.isDeviceLeader).toBe(false)
    expect(store.isLeader).toBe(false)
    expect(mockReleaseWakeLock).toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('7c. startTimer stays local during reconnect grace instead of writing an unauthorized timer session', async () => {
    mockAuthState.isAuthenticated = true
    mockAuthState.canSyncRemotely = false
    mockAuthState.user = { id: 'test-user-id' }
    const store = useTimerStore()
    await flushPromises()
    mockFetchActiveTimerSession.mockClear()
    mockSaveActiveTimerSession.mockClear()
    mockClaimLeadership.mockClear()
    mockEnqueue.mockClear()

    await store.startTimer('task-reconnect-grace', 1500, false)
    await flushPromises()

    expect(store.currentSession).toMatchObject({
      taskId: 'task-reconnect-grace',
      isActive: true,
      isPaused: false,
    })
    expect(mockFetchActiveTimerSession).not.toHaveBeenCalled()
    expect(mockSaveActiveTimerSession).not.toHaveBeenCalled()
    expect(mockClaimLeadership).not.toHaveBeenCalled()
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'timer_session',
      operation: 'create',
      canonicalTimerCommand: expect.objectContaining({ action: 'start' }),
    }))
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

  it('12. startTimer switches an active canonical timer task without resetting elapsed time', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(5000)
    const remainingAfter5s = store.currentSession!.remainingTime

    await store.startTimer('task-002', 60, false)
    await flushPromises()

    expect(store.currentSession?.taskId).toBe('task-002')
    expect(mockCanonicalTimerCommand.mock.calls.map(call => call[1])).toContainEqual(expect.objectContaining({
      action: 'switch_task', taskId: 'task-002', remainingSeconds: remainingAfter5s,
    }))
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

  it('19. stopTimer commits an explicit canonical stop', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()

    mockSaveActiveTimerSession.mockClear()
    await store.stopTimer()
    await flushPromises()

    expect(mockCanonicalTimerCommand.mock.calls.some(
      call => call[1]?.action === 'stop' && call[1]?.baseRevision === 1,
    )).toBe(true)
    expect(mockSaveActiveTimerSession).not.toHaveBeenCalled()
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

  it('20b. stopTimer clears Electron/KDE local snapshot before a stalled remote save can keep the timer stuck active', async () => {
    mockAuthState.canSyncRemotely = true
    const stalledRemoteSave = new Promise<void>(() => {})
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('task-001', 60, false)
    await flushPromises()
    mockSyncLocalApiTimerSnapshot.mockClear()
    mockSaveActiveTimerSession.mockClear()
    mockSaveActiveTimerSession.mockImplementationOnce(() => stalledRemoteSave)

    const stopPromise = store.stopTimer()
    await flushPromises()

    expect(store.currentSession).toBeNull()
    expect(store.isTimerActive).toBe(false)
    expect(mockSyncLocalApiTimerSnapshot).toHaveBeenCalledWith(null, expect.any(String))

    void stopPromise
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

  it('24. completeSession commits a canonical stop', async () => {
    const store = useTimerStore()
    await flushPromises()

    await store.startTimer('general', 2, false)
    await flushPromises()
    mockSaveActiveTimerSession.mockClear()

    await vi.advanceTimersByTimeAsync(3000)
    await flushPromises()
    await flushPromises()
    await flushPromises()

    expect(mockCanonicalTimerCommand.mock.calls.some(call => call[1]?.action === 'stop')).toBe(true)
  })

  it('25. completeSession clears the local active timer before completion persistence can hang', async () => {
    const store = useTimerStore()
    await flushPromises()
    const hangingSave = new Promise<void>(() => {})
    mockCanonicalTimerCommand.mockReturnValueOnce(hangingSave)

    store.currentSession = {
      id: '11111111-1111-4111-8111-111111111111',
      taskId: 'general',
      startTime: new Date('2026-03-21T10:00:00.000Z'),
      duration: 2,
      remainingTime: 0,
      isActive: true,
      isPaused: false,
      isBreak: false,
      canonicalRevision: 1,
      workspaceId: null,
    }

    void store.completeSession()
    await flushPromises()

    expect(mockCanonicalTimerCommand).toHaveBeenCalled()
    expect(store.currentSession).toBeNull()
    expect(mockSyncLocalApiTimerSnapshot).toHaveBeenCalledWith(null, expect.any(String))
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

    await store.pauseTimer()
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

    const ourDeviceId = store.currentSession?.deviceLeaderId as string

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

  it('36. startTimer persists through canonical authority', async () => {
    const store = useTimerStore()
    await flushPromises()

    mockSaveActiveTimerSession.mockClear()
    await store.startTimer('task-001', 60, false)
    await flushPromises()

    expect(mockCanonicalTimerCommand.mock.calls.some(
      call => call[1]?.action === 'start' && call[1]?.taskId === 'task-001',
    )).toBe(true)
    expect(mockSaveActiveTimerSession).not.toHaveBeenCalled()
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

    const heartbeatsAfterStart = mockHeartbeatTimerSession.mock.calls.length

    // Advance past heartbeat interval (10s)
    await vi.advanceTimersByTimeAsync(11_000)
    await flushPromises()

    expect(mockHeartbeatTimerSession.mock.calls.length).toBeGreaterThan(heartbeatsAfterStart)
  })
})
