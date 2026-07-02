/**
 * BUG-1897 / BUG-1898: A stopped timer must STAY stopped.
 *
 * BUG-1897 — commit 196b171a reordered stopTimer to clear local state first and
 * swallow remote-save failures. When `saveActiveTimerSession` fails, the
 * Supabase row stays is_active=true and the follower poll — which stopTimer
 * itself resumes — re-adopts the "active" session within one 15s cycle,
 * resurrecting the timer on the Vue app (and, via the sidecar's Supabase
 * fallback, on the KDE widget). The `completedSessionIds` guard exists on the
 * Realtime path (useTimerSync.ts) but NOT on the follower-poll adoption paths.
 *
 * BUG-1898 — during the auth reconnect grace (`canSyncRemotely === false`)
 * stopTimer skips BOTH the direct save AND the sync-queue enqueue, so the stop
 * never reaches Supabase at all and KDE keeps showing the timer active.
 *
 * Part 1 tests the poll adoption guard at the composable level.
 * Part 2 tests stop durability at the store level.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref, nextTick } from 'vue'
import type { PomodoroSession } from '@/stores/timer'

async function flushAsync() {
  await nextTick()
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

// ── Part 1: follower poll must not re-adopt a just-stopped session ──────────

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

function makeSyncDeps(overrides: Partial<TimerSyncDeps> = {}): TimerSyncDeps {
  return {
    currentSession: ref<PomodoroSession | null>(null),
    completedSessions: ref<PomodoroSession[]>([]),
    isLeader: ref(false),
    isDeviceLeader: ref(false),
    hasLoadedSession: ref(true),
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

function makeStaleActiveSession(id: string, overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id,
    taskId: 'aa0e8400-e29b-41d4-a716-446655440001',
    startTime: new Date(),
    duration: 1500,
    remainingTime: 900,
    isActive: true,
    isPaused: false,
    isBreak: false,
    ...overrides,
  }
}

describe('BUG-1897 Part 1: follower poll ignores sessions this device already stopped', () => {
  beforeEach(() => {
    intervals.length = 0
    vi.clearAllMocks()
  })

  it('poll does NOT re-adopt an active session whose id is in completedSessionIds', async () => {
    // Repro: user stops the timer, remote save fails, row stays is_active=true.
    // stopTimer added the id to completedSessionIds and resumed this poll.
    const stoppedId = 'cc0e8400-e29b-41d4-a716-446655440042'
    const currentSession = ref<PomodoroSession | null>(null)
    const staleRow = makeStaleActiveSession(stoppedId, {
      // fresh leader heartbeat: NOT the stale-leader branch
      deviceLeaderLastSeen: Date.now(),
    } as Partial<PomodoroSession>)
    const deps = makeSyncDeps({
      currentSession,
      completedSessionIds: new Set([stoppedId]),
      fetchActiveTimerSession: vi.fn().mockResolvedValue(staleRow),
    })
    useTimerSync(deps)

    const followerPoll = intervals[FOLLOWER_POLL_INDEX]
    await followerPoll.callback()
    await flushAsync()

    expect(
      currentSession.value,
      'poll re-adopted a session this device already stopped — timer resurrects'
    ).toBeNull()
  })

  it('poll does NOT claim leadership of a stale-leader session this device already stopped', async () => {
    // Same repro but the row's leader heartbeat is stale (>30s), which routes
    // through the leadership-claim branch — it must be guarded too.
    const stoppedId = 'cc0e8400-e29b-41d4-a716-446655440043'
    const currentSession = ref<PomodoroSession | null>(null)
    const claimLeadership = vi.fn().mockResolvedValue(true)
    const staleRow = makeStaleActiveSession(stoppedId, {
      deviceLeaderLastSeen: Date.now() - 120_000,
    } as Partial<PomodoroSession>)
    const deps = makeSyncDeps({
      currentSession,
      completedSessionIds: new Set([stoppedId]),
      fetchActiveTimerSession: vi.fn().mockResolvedValue(staleRow),
      claimLeadership,
    })
    useTimerSync(deps)

    const followerPoll = intervals[FOLLOWER_POLL_INDEX]
    await followerPoll.callback()
    await flushAsync()

    expect(currentSession.value, 'stale-leader branch resurrected a stopped session').toBeNull()
    expect(claimLeadership, 'device claimed leadership of its own stopped session').not.toHaveBeenCalled()
  })
})

// ── Part 2: stopTimer must durably persist is_active=false ──────────────────

const mockEnqueue = vi.fn().mockResolvedValue({ id: 1, status: 'pending' })
const mockSaveActiveTimerSession = vi.fn().mockResolvedValue(undefined)

// Mutable auth state so individual tests can flip reconnect-grace on/off.
const authState = {
  isAuthenticated: true,
  canSyncRemotely: true,
  user: { id: 'test-user-id' } as { id: string } | null,
  $subscribe: vi.fn(() => vi.fn()),
}

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchActiveTimerSession: vi.fn().mockResolvedValue(null),
    saveActiveTimerSession: mockSaveActiveTimerSession,
    claimLeadership: vi.fn().mockResolvedValue(true),
    insertPomodoroHistory: vi.fn().mockResolvedValue(undefined),
    fetchPomodoroHistory: vi.fn().mockResolvedValue([]),
  }),
  invalidateCache: { onAuthChange: vi.fn(), all: vi.fn() },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authState,
}))

vi.mock('@/composables/useCrossTabSync', () => ({
  getCrossTabSync: () => ({
    claimTimerLeadership: vi.fn(() => true),
    broadcastTimerSession: vi.fn(),
    setTimerCallbacks: vi.fn(),
  }),
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    workDuration: 1500, shortBreakDuration: 300, longBreakDuration: 900,
    autoStartBreaks: false, autoStartPomodoros: false, playNotificationSounds: false,
    aiLearningEnabled: false, updateSetting: vi.fn(),
  }),
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({ tasks: [], _rawTasks: [], updateTask: vi.fn() }),
}))

vi.mock('@/composables/useWakeLock', () => ({
  useWakeLock: () => ({ requestWakeLock: vi.fn().mockResolvedValue(undefined), releaseWakeLock: vi.fn() }),
}))

vi.mock('@/composables/useTauriStartup', () => ({ isTauri: () => false }))
vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({ onPomodoroCompleted: vi.fn().mockResolvedValue(undefined) }),
}))
vi.mock('@/i18n', () => ({ default: { global: { t: (k: string) => k } } }))
vi.mock('@/composables/sync/useSyncOrchestrator', () => ({
  useSyncOrchestrator: () => ({ enqueue: mockEnqueue }),
}))
vi.mock('@/utils/supabaseMappers', () => ({
  toSupabaseTimerSession: vi.fn((s: PomodoroSession, userId: string) => ({
    id: s.id,
    user_id: userId,
    is_active: s.isActive,
  })),
}))
vi.mock('@/composables/useLocalApiBridge', () => ({
  syncLocalApiTimerSnapshot: vi.fn(),
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
  useTimerAudio: () => ({ playStartSound: vi.fn(), playEndSound: vi.fn() }),
}))

import { useTimerStore } from '@/stores/timer'

function makeStoreSession(overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id: 'sess-stop-durability-01',
    taskId: 'general',
    startTime: new Date(),
    duration: 1500,
    remainingTime: 600,
    isActive: true,
    isPaused: false,
    isBreak: false,
    ...overrides,
  }
}

describe('BUG-1897/BUG-1898 Part 2: stopTimer durably persists is_active=false', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockEnqueue.mockClear()
    mockSaveActiveTimerSession.mockClear()
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
    authState.isAuthenticated = true
    authState.canSyncRemotely = true
    authState.user = { id: 'test-user-id' }
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('BUG-1897: when the direct save FAILS, the stop is still queued as is_active=false', async () => {
    // Direct save rejects (network blip / RLS) — the stop must survive via the
    // sync queue so the server row does not stay is_active=true forever.
    mockSaveActiveTimerSession.mockRejectedValue(new Error('network down'))
    const store = useTimerStore()
    store.currentSession = makeStoreSession()

    await store.stopTimer()
    await flushAsync()

    expect(store.currentSession).toBeNull()
    const stopOps = mockEnqueue.mock.calls
      .map(([op]) => op as { entityType: string; payload?: { is_active?: boolean } })
      .filter(op => op.entityType === 'timer_session' && op.payload?.is_active === false)
    expect(
      stopOps.length,
      'no is_active=false correction queued after failed direct save — server row stays active and the timer resurrects'
    ).toBeGreaterThan(0)
  })

  it('BUG-1898: a stop during auth reconnect-grace is queued for later sync', async () => {
    // canSyncRemotely=false (reconnect grace) but the user is still signed in.
    // The direct write is correctly gated — but the stop MUST be enqueued so it
    // drains once auth recovers. Today it is silently dropped and KDE keeps
    // showing the timer active.
    authState.canSyncRemotely = false
    const store = useTimerStore()
    store.currentSession = makeStoreSession({ id: 'sess-grace-stop-01' })

    await store.stopTimer()
    await flushAsync()

    expect(store.currentSession).toBeNull()
    expect(mockSaveActiveTimerSession, 'direct write must stay gated during grace').not.toHaveBeenCalled()
    const stopOps = mockEnqueue.mock.calls
      .map(([op]) => op as { entityType: string; entityId?: string; payload?: { is_active?: boolean } })
      .filter(op => op.entityType === 'timer_session' && op.payload?.is_active === false)
    expect(
      stopOps.length,
      'stop during reconnect-grace was dropped entirely — never reaches Supabase, KDE stays active'
    ).toBeGreaterThan(0)
  })

  it('regression pin: stop with healthy auth enqueues the is_active=false op', async () => {
    const store = useTimerStore()
    store.currentSession = makeStoreSession({ id: 'sess-healthy-stop-01' })

    await store.stopTimer()
    await flushAsync()

    const stopOps = mockEnqueue.mock.calls
      .map(([op]) => op as { entityType: string; payload?: { is_active?: boolean } })
      .filter(op => op.entityType === 'timer_session' && op.payload?.is_active === false)
    expect(stopOps.length).toBeGreaterThan(0)
  })
})
