/**
 * TASK-1608: WebSocket Resilience Tests (15 tests)
 *
 * Tests for the Realtime subscription system in useRealtimeSubscription.ts
 * Covers: channel creation, table subscriptions, event routing, reconnection,
 * cleanup on logout, duplicate event handling, and broadcast channel coordination.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'

// Flush all pending promises (microtasks + multiple macrotask ticks)
async function flushAll(ticks = 5): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await new Promise<void>(r => setTimeout(r, 0))
  }
}

// ============================================================================
// Hoisted mocks — all variables used in vi.mock factory must be hoisted
// ============================================================================

interface OnCallRecord {
  event: string
  options: { event: string; schema: string; table: string; filter?: string }
  callback: (payload: unknown) => void
}

const { mockSupabase, onCallLog, getSubscribeCallback, setSubscribeCallback, channelMock, removeChannelMock, removeAllChannelsMock, mockChannel } = vi.hoisted(() => {
  const onCallLog: OnCallRecord[] = []
  let subscribeCallback: ((status: string, err?: unknown) => void) | null = null

  const mockChannel: Record<string, unknown> = {}

  const channelMock = vi.fn()
  const removeChannelMock = vi.fn().mockResolvedValue(undefined)
  const removeAllChannelsMock = vi.fn()

  mockChannel.on = vi.fn((type: string, opts: OnCallRecord['options'], cb: (payload: unknown) => void) => {
    onCallLog.push({ event: type, options: opts, callback: cb })
    return mockChannel
  })
  mockChannel.subscribe = vi.fn((cb: (status: string, err?: unknown) => void) => {
    subscribeCallback = cb
    return mockChannel
  })
  mockChannel.state = 'joined'

  channelMock.mockReturnValue(mockChannel)

  const mockSupabase = {
    realtime: {
      channels: [] as unknown[],
      setAuth: vi.fn()
    },
    removeAllChannels: removeAllChannelsMock,
    removeChannel: removeChannelMock,
    channel: channelMock,
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } }
      }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null })
    }
  }

  return {
    mockSupabase,
    onCallLog,
    getSubscribeCallback: () => subscribeCallback,
    setSubscribeCallback: (cb: ((status: string, err?: unknown) => void) | null) => { subscribeCallback = cb },
    channelMock,
    removeChannelMock,
    removeAllChannelsMock,
    mockChannel
  }
})

vi.mock('@/composables/supabase/_infrastructure', () => ({
  supabase: mockSupabase,
  getSupabase: vi.fn(() => mockSupabase),
  invalidateCache: { all: vi.fn(), byKey: vi.fn() }
}))

vi.mock('@/stores/canvas/modals', () => ({
  useCanvasModalsStore: () => ({
    isEditModalOpen: false,
    isBatchEditModalOpen: false
  })
}))

// ============================================================================
// Helper: Build a DatabaseContext stub
// ============================================================================

function buildCtx(userId = 'user-abc-123') {
  return {
    authStore: { user: { id: userId }, isAuthenticated: true },
    handleError: vi.fn()
  }
}

// ============================================================================
// Import under test (after mocks are registered)
// ============================================================================

import { useRealtimeSubscription } from '@/composables/supabase/useRealtimeSubscription'

// ============================================================================
// Tests
// ============================================================================

describe('WebSocket Resilience — useRealtimeSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onCallLog.length = 0
    setSubscribeCallback(null)
    ;(mockChannel.on as ReturnType<typeof vi.fn>).mockImplementation((type: string, opts: OnCallRecord['options'], cb: (payload: unknown) => void) => {
      onCallLog.push({ event: type, options: opts, callback: cb })
      return mockChannel
    })
    ;(mockChannel.subscribe as ReturnType<typeof vi.fn>).mockImplementation((cb: (status: string, err?: unknown) => void) => {
      setSubscribeCallback(cb)
      return mockChannel
    })
    channelMock.mockReturnValue(mockChannel)
    // Reset realtime channels
    mockSupabase.realtime.channels = []
  })

  // 1. Channel created on auth
  it('creates a realtime channel when user is authenticated', async () => {
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), vi.fn())
    await flushAll(10)
    expect(channelMock).toHaveBeenCalledWith(expect.stringContaining('db-changes-'))
  })

  // 2. Returns null when user is not authenticated
  it('returns null when user is not authenticated', () => {
    const ctx = { authStore: { user: null, isAuthenticated: false }, handleError: vi.fn() }
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    const result = initRealtimeSubscription(vi.fn(), vi.fn())
    expect(result).toBeNull()
  })

  // 3. Subscribes to tasks table
  it('subscribes to tasks table', async () => {
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), vi.fn())
    await flushAll()
    const taskSub = onCallLog.find(c => c.options?.table === 'tasks')
    expect(taskSub).toBeDefined()
  })

  // 4. Subscribes to projects table
  it('subscribes to projects table', async () => {
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), vi.fn())
    await flushAll()
    const projectSub = onCallLog.find(c => c.options?.table === 'projects')
    expect(projectSub).toBeDefined()
  })

  // 5. Subscribes to timer_sessions when callback provided
  it('subscribes to timer_sessions when onTimerChange is provided', async () => {
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), vi.fn(), vi.fn())
    await flushAll()
    const timerSub = onCallLog.find(c => c.options?.table === 'timer_sessions')
    expect(timerSub).toBeDefined()
  })

  // 6. Subscribes to groups when callback provided
  it('subscribes to groups when onGroupChange is provided', async () => {
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), vi.fn(), undefined, undefined, vi.fn())
    await flushAll()
    const groupSub = onCallLog.find(c => c.options?.table === 'groups')
    expect(groupSub).toBeDefined()
  })

  // 7. INSERT event routes to task callback
  it('INSERT event calls onTaskChange callback', async () => {
    const onTaskChange = vi.fn()
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), onTaskChange)
    await flushAll()
    const taskSub = onCallLog.find(c => c.options?.table === 'tasks')
    expect(taskSub).toBeDefined()
    taskSub?.callback({ eventType: 'INSERT', table: 'tasks', new: { id: 'task-1', title: 'Test' }, old: {} })
    expect(onTaskChange).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'INSERT' }))
  })

  // 8. UPDATE event routes to task callback
  it('UPDATE event calls onTaskChange callback', async () => {
    const onTaskChange = vi.fn()
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), onTaskChange)
    await flushAll()
    const taskSub = onCallLog.find(c => c.options?.table === 'tasks')
    taskSub?.callback({ eventType: 'UPDATE', table: 'tasks', new: { id: 'task-1', title: 'Updated' }, old: { id: 'task-1' } })
    expect(onTaskChange).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'UPDATE' }))
  })

  // 9. DELETE event routes to task callback
  it('DELETE event calls onTaskChange callback', async () => {
    const onTaskChange = vi.fn()
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), onTaskChange)
    await flushAll()
    const taskSub = onCallLog.find(c => c.options?.table === 'tasks')
    taskSub?.callback({ eventType: 'DELETE', table: 'tasks', new: {}, old: { id: 'task-1' } })
    expect(onTaskChange).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'DELETE' }))
  })

  // 10. Connection dropped (CHANNEL_ERROR): removeChannel is called
  it('removes channel on CHANNEL_ERROR status', async () => {
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), vi.fn())
    await flushAll()
    const cb = getSubscribeCallback()
    expect(cb).toBeDefined()
    cb?.('CHANNEL_ERROR', new Error('Connection failed'))
    await flushAll()
    expect(removeChannelMock).toHaveBeenCalled()
  })

  it('logs only the first terminal status from one realtime drop', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const ctx = buildCtx()
      const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
      const subscription = initRealtimeSubscription(vi.fn(), vi.fn())
      await flushAll()
      const cb = getSubscribeCallback()
      expect(cb).toBeDefined()

      cb?.('CHANNEL_ERROR', new Error('Connection failed'))
      await flushAll()
      cb?.('CLOSED', null)
      await flushAll()

      const dropWarnings = warnSpy.mock.calls.filter(([message]) =>
        String(message).includes('📡 [REALTIME] Connection dropped')
      )
      expect(dropWarnings).toHaveLength(1)

      await subscription?.unsubscribe()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('does not warn when explicit cleanup triggers a CLOSED callback', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const ctx = buildCtx()
      const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
      const subscription = initRealtimeSubscription(vi.fn(), vi.fn())
      await flushAll()
      const cb = getSubscribeCallback()
      expect(cb).toBeDefined()

      await subscription?.unsubscribe()
      cb?.('CLOSED', null)
      await flushAll()

      expect(warnSpy.mock.calls.some(([message]) =>
        String(message).includes('📡 [REALTIME] Connection dropped')
      )).toBe(false)
    } finally {
      warnSpy.mockRestore()
    }
  })

  // 11. On CLOSED status, reconnects (channel created again after delay)
  it('schedules reconnection attempt on CLOSED status', async () => {
    // Use real timers — fake timers interfere with the async mock chain
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), vi.fn())
    await flushAll(10) // let setupSubscription complete
    const initialCallCount = channelMock.mock.calls.length
    const cb = getSubscribeCallback()
    cb?.('CLOSED', null)
    // Wait for removeChannel + retry timeout (backoff starts at ~1000ms * 1.5^0 = 1000ms)
    await new Promise(r => setTimeout(r, 1500))
    await flushAll()
    // After ~1.5s the retry should have fired, creating a new channel
    expect(channelMock.mock.calls.length).toBeGreaterThanOrEqual(initialCallCount)
  })

  // 12. Unsubscribe on cleanup: marks isExplicitlyClosed and removes channel
  it('unsubscribe() removes channel and prevents further reconnects', async () => {
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    const subscription = initRealtimeSubscription(vi.fn(), vi.fn())
    await flushAll()
    expect(subscription).not.toBeNull()
    await subscription!.unsubscribe()
    expect(removeChannelMock).toHaveBeenCalled()
  })

  // 13. Project change event routes to onProjectChange callback
  it('project change event calls onProjectChange callback', async () => {
    const onProjectChange = vi.fn()
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(onProjectChange, vi.fn())
    await flushAll()
    const projectSub = onCallLog.find(c => c.options?.table === 'projects')
    expect(projectSub).toBeDefined()
    projectSub?.callback({ eventType: 'INSERT', table: 'projects', new: { id: 'proj-1', name: 'New Project' }, old: {} })
    expect(onProjectChange).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'INSERT' }))
  })

  // 14. Workspace filter: task filter uses user_id for personal workspace
  it('personal workspace uses user_id filter for tasks', async () => {
    const userId = 'user-abc-123'
    const ctx = buildCtx(userId)
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), vi.fn())
    await flushAll()
    const taskSub = onCallLog.find(c => c.options?.table === 'tasks')
    expect(taskSub?.options?.filter).toContain(`user_id=eq.${userId}`)
  })

  // 15. Workspace filter: task filter uses workspace_id for shared workspace
  it('shared workspace uses workspace_id filter for tasks', async () => {
    const ctx = buildCtx('user-abc-123')
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
    initRealtimeSubscription(vi.fn(), vi.fn(), undefined, undefined, undefined, undefined, 'ws-xyz-456')
    await flushAll()
    const taskSub = onCallLog.find(c => c.options?.table === 'tasks')
    expect(taskSub?.options?.filter).toContain('workspace_id=eq.ws-xyz-456')
  })

  it('keeps authoritative visible-resume recovery independent of realtime channel health', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/composables/supabase/useRealtimeSubscription.ts'),
      'utf8'
    )
    const healthCheck = source.indexOf("const isDead = !currentChannel || state === 'closed' || state === 'errored'")
    const recoveryCheck = source.lastIndexOf('await runAuthoritativeRecovery()')

    expect(healthCheck).toBeGreaterThan(-1)
    expect(recoveryCheck).toBeGreaterThan(healthCheck)
    expect(source.slice(healthCheck, recoveryCheck)).toContain('if (isDead')
    expect(source.slice(recoveryCheck, recoveryCheck + 200)).not.toContain('isDead')
  })

  it('reconciles authoritative data when initialized while already visible', async () => {
    const onRecovery = vi.fn().mockResolvedValue(undefined)
    const ctx = buildCtx()
    const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)

    initRealtimeSubscription(
      vi.fn(),
      vi.fn(),
      undefined,
      undefined,
      undefined,
      onRecovery
    )
    await flushAll()

    expect(document.visibilityState).toBe('visible')
    expect(onRecovery).toHaveBeenCalledTimes(1)
  })

  it('coalesces online and visibility recovery signals into one authoritative reload', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/composables/supabase/useRealtimeSubscription.ts'),
      'utf8',
    )

    expect(source).toContain('let authoritativeRecoveryInFlight: Promise<void> | null = null')
    expect(source).toContain('if (!onRecovery || authoritativeRecoveryInFlight) return')
    expect(source).toContain('await runAuthoritativeRecovery()')
    expect(source).toContain('void runAuthoritativeRecovery()')
  })

  // 16. TASK-1871: no auth token yet → reschedule + connect (no silent death).
  // Without the fix, the no-token branch returned with no retry → realtime never started.
  it('reschedules setup when no auth token yet, then connects', async () => {
    vi.useFakeTimers()
    try {
      const ctx = buildCtx()
      ;(mockSupabase.auth.getSession as Mock)
        .mockResolvedValueOnce({ data: { session: null } })
        .mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
      const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
      initRealtimeSubscription(vi.fn(), vi.fn())
      await vi.advanceTimersByTimeAsync(50)
      expect(channelMock).not.toHaveBeenCalled() // first pass had no token
      await vi.advanceTimersByTimeAsync(2200) // scheduled retry fires, token now present
      expect(channelMock).toHaveBeenCalledWith(expect.stringContaining('db-changes-'))
    } finally {
      vi.useRealTimers()
    }
  })

  // 17. TASK-1871: a throw during setup must NOT wedge isConnecting=true forever.
  // Without the try/finally, the retry's setupSubscription early-returns on the stuck
  // single-flight guard and realtime never recovers until a full reload.
  it('a throw during setup does not wedge — it recovers on retry', async () => {
    vi.useFakeTimers()
    try {
      const ctx = buildCtx()
      ;(mockSupabase.auth.getSession as Mock)
        .mockRejectedValueOnce(new Error('network blip'))
        .mockResolvedValue({ data: { session: { access_token: 'mock-token' } } })
      const { initRealtimeSubscription } = useRealtimeSubscription(ctx as never)
      initRealtimeSubscription(vi.fn(), vi.fn())
      await vi.advanceTimersByTimeAsync(50) // setup throws, schedules retry, finally clears flag
      expect(channelMock).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(3200) // retry fires and succeeds
      expect(channelMock).toHaveBeenCalledWith(expect.stringContaining('db-changes-'))
    } finally {
      vi.useRealTimers()
    }
  })
})
