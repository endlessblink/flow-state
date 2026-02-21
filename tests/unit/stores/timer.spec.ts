import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const mockFetchActiveTimerSession = vi.fn()
const mockSaveActiveTimerSession = vi.fn()
const mockClaimTimerLeadership = vi.fn(() => true)
const mockBroadcastTimerSession = vi.fn()
const mockSetTimerCallbacks = vi.fn()
const mockRequestWakeLock = vi.fn().mockResolvedValue(undefined)
const mockReleaseWakeLock = vi.fn()

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchActiveTimerSession: mockFetchActiveTimerSession,
    saveActiveTimerSession: mockSaveActiveTimerSession,
    insertPomodoroHistory: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/composables/useCrossTabSync', () => ({
  getCrossTabSync: () => ({
    claimTimerLeadership: mockClaimTimerLeadership,
    broadcastTimerSession: mockBroadcastTimerSession,
    setTimerCallbacks: mockSetTimerCallbacks
  })
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    isAuthenticated: true
  })
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
    updateSetting: vi.fn()
  })
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    tasks: [],
    _rawTasks: [],
    updateTask: vi.fn()
  })
}))

vi.mock('@/composables/useWakeLock', () => ({
  useWakeLock: () => ({
    requestWakeLock: mockRequestWakeLock,
    releaseWakeLock: mockReleaseWakeLock
  })
}))

vi.mock('@/composables/useTauriStartup', () => ({
  isTauri: () => false
}))

vi.mock('@/composables/useGamificationHooks', () => ({
  useGamificationHooks: () => ({
    onPomodoroCompleted: vi.fn().mockResolvedValue(undefined)
  })
}))

vi.mock('@/i18n', () => ({
  default: {
    global: {
      t: (key: string) => key
    }
  }
}))

import { useTimerStore } from '@/stores/timer'

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('TimerStore cross-device sync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-21T12:00:00.000Z'))
    setActivePinia(createPinia())
    mockFetchActiveTimerSession.mockReset()
    mockSaveActiveTimerSession.mockReset()
    mockClaimTimerLeadership.mockReset()
    mockClaimTimerLeadership.mockReturnValue(true)
    mockBroadcastTimerSession.mockReset()
    mockSetTimerCallbacks.mockReset()
    mockRequestWakeLock.mockClear()
    mockReleaseWakeLock.mockClear()
    mockFetchActiveTimerSession.mockResolvedValue(null)
    mockSaveActiveTimerSession.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('claims leadership when loaded session leader heartbeat is stale', async () => {
    mockFetchActiveTimerSession.mockResolvedValueOnce({
      id: 'session-1234567890',
      taskId: 'general',
      startTime: new Date(Date.now() - 30_000),
      duration: 1500,
      remainingTime: 1200,
      isActive: true,
      isPaused: false,
      isBreak: false,
      deviceLeaderId: 'remote-device',
      deviceLeaderLastSeen: Date.now() - 31_000
    })

    const store = useTimerStore()
    await flushPromises()

    expect(store.isDeviceLeader).toBe(true)
    expect(mockClaimTimerLeadership).toHaveBeenCalled()
    expect(mockSaveActiveTimerSession).toHaveBeenCalled()
  })

  it('writes heartbeat updates while acting as device leader', async () => {
    const store = useTimerStore()
    await flushPromises()

    mockFetchActiveTimerSession.mockResolvedValue(null)
    await store.startTimer('general', 60, false)

    const callsAfterStart = mockSaveActiveTimerSession.mock.calls.length
    expect(callsAfterStart).toBeGreaterThan(0)

    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()

    expect(mockSaveActiveTimerSession.mock.calls.length).toBeGreaterThan(callsAfterStart)
  })

  it('yields leadership and syncs session from remote device updates', async () => {
    const store = useTimerStore()
    await flushPromises()
    await store.startTimer('general', 60, false)

    expect(store.isDeviceLeader).toBe(true)

    const remoteHeartbeat = new Date(Date.now() - 5_000).toISOString()
    store.handleRemoteTimerUpdate({
      new: {
        id: store.currentSession?.id ?? 'session-1234567890',
        task_id: 'general',
        start_time: new Date(Date.now() - 30_000).toISOString(),
        duration: 60,
        remaining_time: 50,
        is_active: true,
        is_paused: false,
        is_break: false,
        device_leader_id: 'remote-device',
        device_leader_last_seen: remoteHeartbeat
      }
    })

    expect(store.isDeviceLeader).toBe(false)
    expect(store.currentSession).not.toBeNull()
    expect(store.currentSession?.deviceLeaderId).toBe('remote-device')
    expect(store.currentSession?.remainingTime).toBe(45)
  })

  it('toggles heartbeat persistence when leadership callbacks hand off ownership', async () => {
    const store = useTimerStore()
    await flushPromises()
    await store.startTimer('general', 60, false)

    const callbacks = mockSetTimerCallbacks.mock.calls.at(-1)?.[0] as {
      onBecomeLeader: () => void
      onLoseLeadership: () => void
    }

    const callsBeforeHandoff = mockSaveActiveTimerSession.mock.calls.length
    callbacks.onLoseLeadership()
    await vi.advanceTimersByTimeAsync(12_000)
    await flushPromises()
    expect(store.isDeviceLeader).toBe(false)
    expect(mockSaveActiveTimerSession.mock.calls.length).toBe(callsBeforeHandoff)

    callbacks.onBecomeLeader()
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()
    expect(store.isDeviceLeader).toBe(true)
    expect(mockSaveActiveTimerSession.mock.calls.length).toBeGreaterThan(callsBeforeHandoff)
  })

  it('claims leadership from follower poll when remote heartbeat becomes stale', async () => {
    mockFetchActiveTimerSession
      .mockResolvedValueOnce({
        id: 'session-1234567890',
        taskId: 'general',
        startTime: new Date(Date.now() - 10_000),
        duration: 1500,
        remainingTime: 1200,
        isActive: true,
        isPaused: false,
        isBreak: false,
        deviceLeaderId: 'remote-device',
        deviceLeaderLastSeen: Date.now() - 5_000
      })
      .mockResolvedValueOnce({
        id: 'session-1234567890',
        taskId: 'general',
        startTime: new Date(Date.now() - 10_000),
        duration: 1500,
        remainingTime: 1200,
        isActive: true,
        isPaused: false,
        isBreak: false,
        deviceLeaderId: 'remote-device',
        deviceLeaderLastSeen: Date.now() - 31_000
      })

    const store = useTimerStore()
    await flushPromises()
    expect(store.isDeviceLeader).toBe(false)

    await vi.advanceTimersByTimeAsync(3_100)
    await flushPromises()

    expect(store.isDeviceLeader).toBe(true)
    expect(mockClaimTimerLeadership).toHaveBeenCalled()
    expect(mockSaveActiveTimerSession).toHaveBeenCalled()
  })

  it('ignores fresh echoed updates from our own device leader id', async () => {
    const store = useTimerStore()
    await flushPromises()
    await store.startTimer('general', 60, false)

    const ourDeviceId = mockSaveActiveTimerSession.mock.calls.at(-1)?.[1] as string
    const previousRemaining = store.currentSession?.remainingTime

    store.handleRemoteTimerUpdate({
      new: {
        id: store.currentSession?.id ?? 'session-1234567890',
        task_id: 'general',
        start_time: new Date(Date.now() - 10_000).toISOString(),
        duration: 60,
        remaining_time: 5,
        is_active: true,
        is_paused: false,
        is_break: false,
        device_leader_id: ourDeviceId,
        device_leader_last_seen: new Date(Date.now() - 2_000).toISOString()
      }
    })

    expect(store.isDeviceLeader).toBe(true)
    expect(store.currentSession?.remainingTime).toBe(previousRemaining)
  })

  it('clears local session on realtime DELETE payloads', async () => {
    const store = useTimerStore()
    await flushPromises()
    await store.startTimer('general', 60, false)

    expect(store.currentSession).not.toBeNull()
    store.handleRemoteTimerUpdate({ eventType: 'DELETE' })

    expect(store.currentSession).toBeNull()
    expect(mockReleaseWakeLock).toHaveBeenCalled()
  })
})
