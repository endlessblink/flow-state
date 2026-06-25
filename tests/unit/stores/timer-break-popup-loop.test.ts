/**
 * BUG-1892: "Time for a break" popup loops endlessly until the app is closed.
 *
 * Root cause: completeSession() is NOT idempotent per session id. Its only top
 * guard is the concurrency lock `isCompleting`; it does not check
 * `completedSessionIds`, and that set self-deletes after 2 minutes
 * (PENDING_WRITE_TIMEOUT_MS). When the follower poll / resync re-adopts an
 * expired-but-still-active session row, onCountdownComplete -> completeSession
 * runs again for the SAME session and re-fires the OS notification — over and
 * over until the poll stops (app closed).
 *
 * These tests reproduce the loop at the store level by completing the SAME
 * session twice (and again after the 2-minute window) and asserting the
 * notification fires exactly once.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PomodoroSession } from '@/stores/timer'

// ── Hoisted mock so we can assert on the notification ──────────────────────────
const mockShowTimerNotification = vi.fn().mockResolvedValue(undefined)

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchActiveTimerSession: vi.fn().mockResolvedValue(null),
    saveActiveTimerSession: vi.fn().mockResolvedValue(undefined),
    claimLeadership: vi.fn().mockResolvedValue(true),
    insertPomodoroHistory: vi.fn().mockResolvedValue(undefined),
    fetchPomodoroHistory: vi.fn().mockResolvedValue([]),
  }),
  invalidateCache: { onAuthChange: vi.fn(), all: vi.fn() },
}))

vi.mock('@/composables/useCrossTabSync', () => ({
  getCrossTabSync: () => ({
    claimTimerLeadership: vi.fn(() => true),
    broadcastTimerSession: vi.fn(),
    setTimerCallbacks: vi.fn(),
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ isAuthenticated: true, user: { id: 'test-user-id' }, $subscribe: vi.fn(() => vi.fn()) }),
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
  useSyncOrchestrator: () => ({ enqueue: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }) }),
}))
vi.mock('@/utils/supabaseMappers', () => ({ toSupabaseTimerSession: vi.fn((s: unknown) => s) }))

vi.mock('@/composables/timer/useTimerNotifications', () => ({
  useTimerNotifications: () => ({
    showTimerNotification: mockShowTimerNotification,
    requestNotificationPermission: vi.fn().mockResolvedValue(undefined),
    setupServiceWorkerListener: vi.fn(),
    cleanupServiceWorkerListener: vi.fn(),
  }),
}))

vi.mock('@/composables/timer/useTimerAudio', () => ({
  useTimerAudio: () => ({ playStartSound: vi.fn(), playEndSound: vi.fn() }),
}))

import { useTimerStore } from '@/stores/timer'

const flushPromises = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }

function makeSession(overrides: Partial<PomodoroSession> = {}): PomodoroSession {
  return {
    id: 'sess-break-loop-0001',
    taskId: 'general',
    startTime: new Date(),
    duration: 1500,
    remainingTime: 0,
    isActive: true,
    isPaused: false,
    isBreak: false,
    ...overrides,
  }
}

describe('BUG-1892: break-completion notification is idempotent per session', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-25T10:00:00.000Z'))
    setActivePinia(createPinia())
    mockShowTimerNotification.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('completing the SAME session twice (poll re-adoption) fires the notification only once', async () => {
    const store = useTimerStore()
    const session = makeSession()

    // First completion (countdown hit 0)
    store.currentSession = session
    await store.completeSession()
    await flushPromises()
    expect(mockShowTimerNotification).toHaveBeenCalledTimes(1)

    // Follower poll / resync re-installs the SAME expired-active session → completeSession again
    store.currentSession = { ...session }
    await store.completeSession()
    await flushPromises()

    // Must NOT re-notify — this is the loop.
    expect(mockShowTimerNotification).toHaveBeenCalledTimes(1)
  })

  it('does NOT re-notify even after the 2-minute dedup window elapses (durable guard)', async () => {
    const store = useTimerStore()
    const session = makeSession({ id: 'sess-break-loop-0002' })

    store.currentSession = session
    await store.completeSession()
    await flushPromises()
    expect(mockShowTimerNotification).toHaveBeenCalledTimes(1)

    // Advance well past PENDING_WRITE_TIMEOUT_MS so any self-deleting guard would expire.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

    store.currentSession = { ...session }
    await store.completeSession()
    await flushPromises()

    expect(mockShowTimerNotification).toHaveBeenCalledTimes(1)
  })
})
