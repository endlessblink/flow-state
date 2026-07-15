import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const {
  authState,
  mockCanonical,
  mockEnqueue,
  mockFetchActive,
  mockSaveActive,
  mockHeartbeat,
  mockClaimCrossTab,
  mockShowNotification,
} = vi.hoisted(() => ({
  authState: { canSyncRemotely: true, user: { id: 'user-1' } as { id: string } | null },
  mockCanonical: vi.fn(),
  mockEnqueue: vi.fn().mockResolvedValue({ id: 1, status: 'pending' }),
  mockFetchActive: vi.fn().mockResolvedValue(null),
  mockSaveActive: vi.fn().mockResolvedValue(undefined),
  mockHeartbeat: vi.fn().mockResolvedValue(true),
  mockClaimCrossTab: vi.fn(() => true),
  mockShowNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/sync/canonicalTimerCommand', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/sync/canonicalTimerCommand')>()
  return { ...actual, executeCanonicalTimerCommand: mockCanonical }
})
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchActiveTimerSession: mockFetchActive,
    saveActiveTimerSession: mockSaveActive,
    heartbeatTimerSession: mockHeartbeat,
    claimLeadership: vi.fn().mockResolvedValue(true),
    fetchPomodoroHistory: vi.fn().mockResolvedValue([]),
    insertPomodoroHistory: vi.fn().mockResolvedValue(undefined),
  }),
  invalidateCache: { onAuthChange: vi.fn(), all: vi.fn() },
}))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({
  get canSyncRemotely() { return authState.canSyncRemotely },
  get isAuthenticated() { return Boolean(authState.user) },
  get user() { return authState.user },
  $subscribe: vi.fn(() => vi.fn()),
}) }))
vi.mock('@/stores/workspace', () => ({ useWorkspaceStore: () => ({ activeWorkspaceId: null }) }))
vi.mock('@/stores/settings', () => ({ useSettingsStore: () => ({
  workDuration: 1500, shortBreakDuration: 300, longBreakDuration: 900,
  autoStartBreaks: false, autoStartPomodoros: false, playNotificationSounds: false,
  aiLearningEnabled: false, updateSetting: vi.fn(),
}) }))
vi.mock('@/stores/tasks', () => ({ useTaskStore: () => ({ tasks: [], _rawTasks: [], updateTask: vi.fn() }) }))
vi.mock('@/composables/useCrossTabSync', () => ({ getCrossTabSync: () => ({
  claimTimerLeadership: mockClaimCrossTab, broadcastTimerSession: vi.fn(), setTimerCallbacks: vi.fn(),
}) }))
vi.mock('@/composables/useWakeLock', () => ({ useWakeLock: () => ({
  requestWakeLock: vi.fn().mockResolvedValue(undefined), releaseWakeLock: vi.fn(),
}) }))
vi.mock('@/composables/sync/useSyncOrchestrator', () => ({ useSyncOrchestrator: () => ({ enqueue: mockEnqueue }) }))
vi.mock('@/composables/useLocalApiBridge', () => ({ syncLocalApiTimerSnapshot: vi.fn() }))
vi.mock('@/composables/timer/useTimerNotifications', () => ({ useTimerNotifications: () => ({
  showTimerNotification: mockShowNotification, requestNotificationPermission: vi.fn(),
  setupServiceWorkerListener: vi.fn(), cleanupServiceWorkerListener: vi.fn(),
}) }))
vi.mock('@/composables/timer/useTimerAudio', () => ({ useTimerAudio: () => ({ playStartSound: vi.fn(), playEndSound: vi.fn() }) }))
vi.mock('@/composables/useTauriStartup', () => ({ isTauri: () => false }))
vi.mock('@/composables/useGamificationHooks', () => ({ useGamificationHooks: () => ({ onPomodoroCompleted: vi.fn() }) }))
vi.mock('@/i18n', () => ({ default: { global: { t: (key: string) => key } } }))

import { CanonicalTimerCommandError, type CanonicalTimerCommandRequest } from '@/services/sync/canonicalTimerCommand'
import { useTimerStore } from '@/stores/timer'

function canonicalResult(request: CanonicalTimerCommandRequest) {
  const revision = request.action === 'start' ? 1 : request.baseRevision + 1
  const isExtend = request.action === 'extend'
  const readBack = {
    id: request.sessionId, workspaceId: request.workspaceId, taskId: request.taskId ?? 'task-1',
    startTime: request.startedAt ?? '2026-07-16T07:00:00.000Z',
    duration: isExtend ? 1500 + (request.extensionSeconds ?? 0) : request.durationSeconds ?? 1500,
    remainingTime: request.durationSeconds ?? request.remainingSeconds ?? request.extensionSeconds ?? 900,
    isActive: request.action !== 'stop',
    isPaused: request.action === 'pause', isBreak: request.isBreak ?? false,
    completedAt: request.action === 'stop' ? '2026-07-16T07:20:00.000Z' : null,
    deviceLeaderId: request.deviceId, canonicalRevision: revision,
    canonicalUpdatedAt: '2026-07-16T07:20:00.000Z',
  }
  return { receipt: { status: 'committed' }, readBack, replacedSessions: [] }
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('TASK-1965 renderer canonical timer authority', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-16T07:00:00.000Z'))
    setActivePinia(createPinia())
    authState.canSyncRemotely = true
    authState.user = { id: 'user-1' }
    mockCanonical.mockReset().mockImplementation((_client, request) => Promise.resolve(canonicalResult(request)))
    mockEnqueue.mockClear()
    mockFetchActive.mockClear().mockResolvedValue(null)
    mockSaveActive.mockClear().mockResolvedValue(undefined)
    mockHeartbeat.mockClear().mockResolvedValue(true)
    mockClaimCrossTab.mockReset().mockReturnValue(true)
    mockShowNotification.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('starts through canonical authority and reconciles the exact canonical read-back', async () => {
    const store = useTimerStore()
    await flush()
    await store.startTimer('task-1', 1500, false)

    expect(mockCanonical).toHaveBeenCalledTimes(1)
    const request = mockCanonical.mock.calls[0][1] as CanonicalTimerCommandRequest
    expect(request).toMatchObject({ action: 'start', baseRevision: 0, taskId: 'task-1', durationSeconds: 1500 })
    expect(request.operationId).toBe(`web:timer:start:${request.sessionId}:0`)
    expect(store.currentSession).toMatchObject({ id: request.sessionId, canonicalRevision: 1, workspaceId: null })
    expect(mockSaveActive).not.toHaveBeenCalled()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })

  it('uses explicit revision-bound pause, resume, and stop commands without direct writes', async () => {
    const store = useTimerStore()
    await flush()
    await store.startTimer('task-1', 1500, false)
    await store.pauseTimer()
    await store.resumeTimer()
    await store.stopTimer()

    const requests = mockCanonical.mock.calls.map(call => call[1] as CanonicalTimerCommandRequest)
    expect(requests.map(item => [item.action, item.baseRevision])).toEqual([
      ['start', 0], ['pause', 1], ['resume', 2], ['stop', 3],
    ])
    expect(requests.slice(1).every(item => Number.isInteger(item.remainingSeconds))).toBe(true)
    expect(requests.slice(1).every(item => item.operationId === `web:timer:${item.action}:${item.sessionId}:${item.baseRevision}`)).toBe(true)
    expect(store.currentSession).toBeNull()
    expect(mockSaveActive).not.toHaveBeenCalled()
  })

  it('preserves signed-user task switching and extension as explicit canonical actions', async () => {
    const store = useTimerStore()
    await flush()
    await store.startTimer('task-1', 1500, false)
    await vi.advanceTimersByTimeAsync(12_000)
    const remaining = store.currentSession!.remainingTime
    await store.startTimer('task-2', 1500, false)

    const switched = mockCanonical.mock.calls.map(call => call[1] as CanonicalTimerCommandRequest)
      .find(request => request.action === 'switch_task')
    expect(switched).toMatchObject({ taskId: 'task-2', remainingSeconds: remaining })

    await store.stopTimer()
    await store.addExtraTime(300)
    const extended = mockCanonical.mock.calls.map(call => call[1] as CanonicalTimerCommandRequest)
      .find(request => request.action === 'extend')
    expect(extended).toMatchObject({ extensionSeconds: 300 })
    expect(store.currentSession).toMatchObject({ isActive: true, remainingTime: 300, canonicalPending: false })
  })

  it('durably queues the same stable command and keeps only a local projection on transport loss', async () => {
    mockCanonical.mockRejectedValueOnce(new CanonicalTimerCommandError(
      'canonical_timer_transport_failed', 'offline',
    ))
    const store = useTimerStore()
    await flush()
    await store.startTimer('task-1', 1500, false)

    const request = mockCanonical.mock.calls[0][1] as CanonicalTimerCommandRequest
    expect(store.currentSession).toMatchObject({ id: request.sessionId, canonicalRevision: 1 })
    expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'timer_session', operation: 'create', entityId: request.sessionId,
      baseVersion: 0, canonicalTimerCommand: request,
    }))
    expect(mockSaveActive).not.toHaveBeenCalled()
  })

  it('reconciles an own-device realtime receipt after a queued start commits', async () => {
    mockCanonical.mockRejectedValueOnce(new CanonicalTimerCommandError(
      'canonical_timer_transport_failed', 'offline',
    ))
    const store = useTimerStore()
    await flush()
    await store.startTimer('task-1', 1500, false)

    const request = mockCanonical.mock.calls[0][1] as CanonicalTimerCommandRequest
    expect(store.currentSession).toMatchObject({ canonicalPending: true })

    store.handleRemoteTimerUpdate({
      eventType: 'INSERT',
      new: {
        id: request.sessionId,
        workspace_id: request.workspaceId,
        task_id: request.taskId,
        start_time: request.startedAt,
        duration: request.durationSeconds,
        remaining_time: request.durationSeconds,
        is_active: true,
        is_paused: false,
        is_break: false,
        completed_at: null,
        device_leader_id: request.deviceId,
        device_leader_last_seen: new Date().toISOString(),
        canonical_revision: 1,
      },
    })

    expect(store.currentSession).toMatchObject({
      id: request.sessionId,
      canonicalPending: false,
      canonicalRevision: 1,
    })
    await vi.advanceTimersByTimeAsync(11_000)
    expect(mockHeartbeat).toHaveBeenCalled()
  })

  it('reconciles queued serverData when Realtime misses the canonical commit', async () => {
    mockCanonical.mockRejectedValueOnce(new CanonicalTimerCommandError(
      'canonical_timer_transport_failed', 'offline',
    ))
    const store = useTimerStore()
    await flush()
    await store.startTimer('task-1', 1500, false)
    const request = mockCanonical.mock.calls[0][1] as CanonicalTimerCommandRequest
    expect(store.currentSession).toMatchObject({ canonicalPending: true })

    store.applyCanonicalTimerReadBack(canonicalResult(request).readBack)

    expect(store.currentSession).toMatchObject({ canonicalPending: false, canonicalRevision: 1 })
    await vi.advanceTimersByTimeAsync(11_000)
    expect(mockHeartbeat).toHaveBeenCalled()
  })

  it('fails closed and does not project a rejected canonical start', async () => {
    mockCanonical.mockRejectedValueOnce(new CanonicalTimerCommandError('leader_conflict', 'held'))
    const store = useTimerStore()
    await flush()

    await expect(store.startTimer('task-1', 1500, false)).rejects.toMatchObject({ code: 'leader_conflict' })
    expect(store.currentSession).toBeNull()
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockSaveActive).not.toHaveBeenCalled()
  })

  it('rolls back local completion when the canonical stop is rejected', async () => {
    const store = useTimerStore()
    await flush()
    await store.startTimer('task-1', 1, false)
    mockCanonical.mockRejectedValueOnce(new CanonicalTimerCommandError('stale_revision', 'changed', 2))

    await vi.advanceTimersByTimeAsync(1500)
    await flush()

    expect(store.currentSession).toMatchObject({ isActive: true, isPaused: true })
    expect(store.completedSessions).toHaveLength(0)
    expect(mockEnqueue).not.toHaveBeenCalled()
    expect(mockShowNotification).not.toHaveBeenCalled()
  })

  it('lets canonical leader authority reject a start after local cross-tab leadership fails', async () => {
    mockClaimCrossTab.mockReturnValue(false)
    mockCanonical.mockRejectedValueOnce(new CanonicalTimerCommandError('leader_conflict', 'remote leader'))
    const store = useTimerStore()
    await flush()

    await expect(store.startTimer('task-1', 1500, false)).rejects.toMatchObject({ code: 'leader_conflict' })
    expect(store.currentSession).toBeNull()
  })

  it('keeps the canonical revision stable across heartbeat persistence before pause', async () => {
    const store = useTimerStore()
    await flush()
    await store.startTimer('task-1', 1500, false)
    await vi.advanceTimersByTimeAsync(11_000)
    await store.pauseTimer()

    const pause = mockCanonical.mock.calls.map(call => call[1] as CanonicalTimerCommandRequest)
      .find(request => request.action === 'pause')
    expect(mockHeartbeat).toHaveBeenCalled()
    expect(pause?.baseRevision).toBe(1)
  })

  it('retires an abandoned remote session through canonical stop authority', async () => {
    mockFetchActive.mockResolvedValueOnce({
      id: '00000000-0000-4000-8000-000000000099',
      workspaceId: null,
      taskId: 'task-1',
      startTime: new Date('2026-07-16T03:00:00.000Z'),
      duration: 1500,
      remainingTime: 600,
      isActive: true,
      isPaused: false,
      isBreak: false,
      deviceLeaderId: 'old-device',
      deviceLeaderLastSeen: new Date('2026-07-16T05:00:00.000Z').getTime(),
      canonicalRevision: 7,
      canonicalPending: false,
    })
    useTimerStore()
    await flush()

    const request = mockCanonical.mock.calls.map(call => call[1] as CanonicalTimerCommandRequest)
      .find(item => item.sessionId === '00000000-0000-4000-8000-000000000099')
    expect(request).toMatchObject({
      action: 'stop',
      baseRevision: 7,
      operationId: 'web:timer:stop:00000000-0000-4000-8000-000000000099:7',
    })
  })

  it('durably queues abandoned-session retirement on canonical transport loss', async () => {
    mockFetchActive.mockResolvedValueOnce({
      id: '00000000-0000-4000-8000-000000000098', workspaceId: null, taskId: 'task-1',
      startTime: new Date('2026-07-16T03:00:00.000Z'), duration: 1500, remainingTime: 500,
      isActive: true, isPaused: false, isBreak: false, deviceLeaderId: 'old-device',
      deviceLeaderLastSeen: new Date('2026-07-16T05:00:00.000Z').getTime(),
      canonicalRevision: 6, canonicalPending: false,
    })
    mockCanonical.mockRejectedValueOnce(new CanonicalTimerCommandError(
      'canonical_timer_transport_failed', 'offline',
    ))
    useTimerStore()
    await flush()

    await vi.waitFor(() => {
      expect(mockEnqueue).toHaveBeenCalledWith(expect.objectContaining({
        entityType: 'timer_session', entityId: '00000000-0000-4000-8000-000000000098',
        canonicalTimerCommand: expect.objectContaining({ action: 'stop', baseRevision: 6, remainingSeconds: 500 }),
      }))
    })
  })
})
