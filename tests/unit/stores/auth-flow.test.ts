/**
 * TASK-1598: Auth Flow Tests (25 tests)
 *
 * Tests for useAuthStore: initialization, login/logout, token refresh,
 * guest mode, computed properties, and auth state change events.
 *
 * Pattern: vi.hoisted() for mocks that vi.mock factories reference, because
 * vi.mock is hoisted to the top of the file before regular variable declarations.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ============================================================================
// Hoisted mock functions (accessible in vi.mock factories)
// ============================================================================

const {
  mockGetSession,
  mockSignInWithPassword,
  mockSignOut,
  mockRefreshSession,
  mockOnAuthStateChange,
  mockRealtimeSetAuth,
  mockRealtimeDisconnect,
  mockFromTable,
  mockPersistAuthSessionBackup,
  mockRestoreAuthSessionFromBackup,
  mockClearAuthSessionBackup,
} = vi.hoisted(() => {
  type AuthCallback = (event: string, session: unknown) => void
  let _listeners: AuthCallback[] = []

  const mockOnAuthStateChange = vi.fn((cb: AuthCallback) => {
    _listeners.push(cb)
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })

  // Expose the listeners list so tests can fire events
  ;(mockOnAuthStateChange as { _getListeners: () => AuthCallback[] })._getListeners = () => _listeners
  ;(mockOnAuthStateChange as { _reset: () => void })._reset = () => { _listeners = [] }

  return {
    mockGetSession: vi.fn(),
    mockSignInWithPassword: vi.fn(),
    mockSignOut: vi.fn(),
    mockRefreshSession: vi.fn(),
    mockOnAuthStateChange,
    mockRealtimeSetAuth: vi.fn(),
    mockRealtimeDisconnect: vi.fn(),
    mockFromTable: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    mockPersistAuthSessionBackup: vi.fn(),
    mockRestoreAuthSessionFromBackup: vi.fn(),
    mockClearAuthSessionBackup: vi.fn(),
  }
})

// ============================================================================
// Module-level vi.mock calls — hoisted before imports
// ============================================================================

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      refreshSession: mockRefreshSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    realtime: {
      setAuth: mockRealtimeSetAuth,
      disconnect: mockRealtimeDisconnect,
    },
    from: mockFromTable,
  },
  consumePendingProviderTokens: vi.fn().mockReturnValue(null),
  persistAuthSessionBackup: mockPersistAuthSessionBackup,
  restoreAuthSessionFromBackup: mockRestoreAuthSessionFromBackup,
  clearAuthSessionBackup: mockClearAuthSessionBackup,
}))

vi.mock('@/utils/guestModeStorage', () => ({
  clearGuestData: vi.fn(),
  clearGuestSessionId: vi.fn(),
}))

vi.mock('@/utils/braveProtection', () => ({
  isBlockedByBrave: vi.fn().mockReturnValue(false),
  recordBlockedResource: vi.fn(),
}))

vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({
    fetchTasks: vi.fn().mockResolvedValue([]),
    fetchGroups: vi.fn().mockResolvedValue([]),
    fetchProjects: vi.fn().mockResolvedValue([]),
    safeCreateTask: vi.fn().mockResolvedValue({ status: 'created' }),
  }),
  invalidateCache: {
    onAuthChange: vi.fn(),
    all: vi.fn(),
  },
}))

vi.mock('@/constants/dbTables', () => ({
  DB_TABLES: { TASKS: 'tasks', PROJECTS: 'projects' },
}))

vi.mock('@/utils/platform', () => ({
  isTauri: vi.fn().mockReturnValue(false),
}))

vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    _rawTasks: [],
    loadFromDatabase: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn(),
  }),
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    loadFromDatabase: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn(),
  }),
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    loadWorkspaces: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn(),
  }),
}))

vi.mock('@/stores/projects', () => ({
  useProjectStore: () => ({
    loadProjectsFromDatabase: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  clearReadCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    googleProviderToken: null,
    googleProviderTokenExpiry: null,
    googleProviderRefreshToken: null,
    googleConnected: false,
    updateSetting: vi.fn(),
  }),
}))

// ── Import store AFTER mocks ──────────────────────────────────────────────────
import { useAuthStore } from '@/stores/auth'

// ============================================================================
// Type aliases for test helpers
// ============================================================================

type MockUser = {
  id: string
  email: string
  app_metadata?: { role?: string }
  user_metadata?: { role?: string }
  identities?: Array<{ provider: string }>
}

type MockSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  user: MockUser
}

// ============================================================================
// Test factory helpers
// ============================================================================

const buildMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: 'user-test-001',
  email: 'test@flowstate.app',
  ...overrides,
})

const buildMockSession = (overrides: Partial<MockSession> = {}): MockSession => ({
  access_token: 'access-token-xyz',
  refresh_token: 'refresh-token-xyz',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: buildMockUser(),
  ...overrides,
})

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

type AuthListenersMock = {
  _getListeners: () => Array<(event: string, session: unknown) => void>
  _reset: () => void
}

const fireAuthStateChange = (event: string, session: MockSession | null) => {
  const listeners = (mockOnAuthStateChange as unknown as AuthListenersMock)._getListeners()
  listeners.forEach((cb) => cb(event, session))
}

const resetAuthListeners = () => {
  ;(mockOnAuthStateChange as unknown as AuthListenersMock)._reset()
}

// ============================================================================
// Group 1: Initial State
// ============================================================================

describe('Auth Flow — Initial State', () => {
  beforeEach(() => {
    resetAuthListeners()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSignOut.mockResolvedValue({ error: null })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockPersistAuthSessionBackup.mockResolvedValue(undefined)
    mockRestoreAuthSessionFromBackup.mockResolvedValue(false)
    mockClearAuthSessionBackup.mockResolvedValue(undefined)
  })

  it('1. isAuthenticated is false before initialize()', () => {
    const store = useAuthStore()
    expect(store.isAuthenticated).toBe(false)
  })

  it('2. user is null before initialize()', () => {
    const store = useAuthStore()
    expect(store.user).toBeNull()
  })

  it('3. isInitialized is false before initialize()', () => {
    const store = useAuthStore()
    expect(store.isInitialized).toBe(false)
  })
})

// ============================================================================
// Group 2: initialize()
// ============================================================================

describe('Auth Flow — initialize()', () => {
  beforeEach(() => {
    resetAuthListeners()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({ error: null })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockPersistAuthSessionBackup.mockResolvedValue(undefined)
    mockRestoreAuthSessionFromBackup.mockResolvedValue(false)
    mockClearAuthSessionBackup.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('4. initialize() sets isInitialized=true', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isInitialized).toBe(true)
  })

  it('5. initialize() with active session sets isAuthenticated=true and user', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAuthenticated).toBe(true)
    expect(store.user).not.toBeNull()
    expect(store.user?.id).toBe('user-test-001')
  })

  it('6. initialize() without session leaves isAuthenticated=false', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('7. initialize() called twice completes without error (idempotent)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()
    await store.initialize()

    // Both calls complete — isInitialized true, no crash
    expect(store.isInitialized).toBe(true)
  })

  it('8. error during initialize() sets initializationFailed=true', async () => {
    mockGetSession.mockRejectedValue(new Error('Network failure'))

    const store = useAuthStore()
    await store.initialize()

    expect(store.initializationFailed).toBe(true)
    expect(store.isAuthenticated).toBe(false)
    expect(store.isInitialized).toBe(true)
  })

  it('8b. initialize() restores a missing primary Electron auth session from backup', async () => {
    const session = buildMockSession()
    mockGetSession
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({ data: { session }, error: null })
    mockRestoreAuthSessionFromBackup.mockResolvedValue(true)

    const store = useAuthStore()
    await store.initialize()

    expect(mockRestoreAuthSessionFromBackup).toHaveBeenCalledOnce()
    expect(mockGetSession).toHaveBeenCalledTimes(2)
    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.id).toBe('user-test-001')
  })

  it('8c. initialize() persists a backup when a valid session is found', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(mockPersistAuthSessionBackup).toHaveBeenCalledWith(session)
  })
})

// ============================================================================
// Group 3: signInWithPassword
// ============================================================================

describe('Auth Flow — signInWithPassword', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    resetAuthListeners()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSignOut.mockResolvedValue({ error: null })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockPersistAuthSessionBackup.mockResolvedValue(undefined)
    mockRestoreAuthSessionFromBackup.mockResolvedValue(false)
    mockClearAuthSessionBackup.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('9. successful login sets isAuthenticated=true', async () => {
    const session = buildMockSession()
    mockSignInWithPassword.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    })

    const store = useAuthStore()
    await store.initialize()
    await store.signInWithPassword('test@flowstate.app', 'password123')
    await flushPromises()

    expect(store.isAuthenticated).toBe(true)
  })

  it('10. successful login stores userId', async () => {
    const session = buildMockSession()
    mockSignInWithPassword.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    })

    const store = useAuthStore()
    await store.initialize()
    await store.signInWithPassword('test@flowstate.app', 'password123')
    await flushPromises()

    expect(store.user?.id).toBe('user-test-001')
  })

  it('11. successful login stores email', async () => {
    const session = buildMockSession()
    mockSignInWithPassword.mockResolvedValue({
      data: { session, user: session.user },
      error: null,
    })

    const store = useAuthStore()
    await store.initialize()
    await store.signInWithPassword('test@flowstate.app', 'password123')
    await flushPromises()

    expect(store.user?.email).toBe('test@flowstate.app')
  })

  it('12. failed login: isAuthenticated stays false and error is thrown', async () => {
    const signInError = { message: 'Invalid credentials', status: 400 }
    mockSignInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: signInError,
    })

    const store = useAuthStore()
    await store.initialize()

    await expect(
      store.signInWithPassword('bad@email.com', 'wrongpass')
    ).rejects.toBeDefined()

    expect(store.isAuthenticated).toBe(false)
  })
})

// ============================================================================
// Group 4: signOut
// ============================================================================

describe('Auth Flow — signOut', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    resetAuthListeners()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockPersistAuthSessionBackup.mockResolvedValue(undefined)
    mockRestoreAuthSessionFromBackup.mockResolvedValue(false)
    mockClearAuthSessionBackup.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('13. signOut clears user and session', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })
    mockSignOut.mockResolvedValue({ error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAuthenticated).toBe(true)

    await store.signOut()
    await flushPromises()

    expect(store.user).toBeNull()
    expect(store.isAuthenticated).toBe(false)
  })

  it('14. signOut removes localStorage token key', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })
    mockSignOut.mockResolvedValue({ error: null })

    localStorage.setItem('flowstate-supabase-auth', 'some-token-data')

    const store = useAuthStore()
    await store.initialize()
    await store.signOut()
    await flushPromises()

    expect(localStorage.getItem('flowstate-supabase-auth')).toBeNull()
    expect(mockClearAuthSessionBackup).toHaveBeenCalledOnce()
  })
})

// ============================================================================
// Group 5: Token Refresh
// ============================================================================

describe('Auth Flow — Token Refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    resetAuthListeners()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({ error: null })
    mockPersistAuthSessionBackup.mockResolvedValue(undefined)
    mockRestoreAuthSessionFromBackup.mockResolvedValue(false)
    mockClearAuthSessionBackup.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('15. valid session schedules a proactive refresh timer', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const session = buildMockSession({ expires_at: expiresAt })
    mockGetSession.mockResolvedValue({ data: { session }, error: null })
    mockRefreshSession.mockResolvedValue({ data: { session }, error: null })

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    const store = useAuthStore()
    await store.initialize()

    // A refresh timer should have been scheduled (non-zero delay)
    const timerCalls = setTimeoutSpy.mock.calls.filter(
      (call) => typeof call[0] === 'function' && (call[1] as number) > 1000
    )
    expect(timerCalls.length).toBeGreaterThan(0)
  })

  it('16. TOKEN_REFRESHED event updates session access_token', async () => {
    const initialSession = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session: initialSession }, error: null })
    mockRefreshSession.mockResolvedValue({ data: { session: initialSession }, error: null })

    const store = useAuthStore()
    await store.initialize()

    const newSession = buildMockSession({ access_token: 'new-access-token-999' })
    fireAuthStateChange('TOKEN_REFRESHED', newSession)
    await flushPromises()

    expect(store.session?.access_token).toBe('new-access-token-999')
  })
})

// ============================================================================
// Group 6: Computed Properties
// ============================================================================

describe('Auth Flow — Computed Properties', () => {
  beforeEach(() => {
    resetAuthListeners()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSignOut.mockResolvedValue({ error: null })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockPersistAuthSessionBackup.mockResolvedValue(undefined)
    mockRestoreAuthSessionFromBackup.mockResolvedValue(false)
    mockClearAuthSessionBackup.mockResolvedValue(undefined)
  })

  it('17. isAdmin is false for regular users', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAdmin).toBe(false)
  })

  it('18. isAdmin is true for users with admin role in app_metadata', async () => {
    const adminUser = buildMockUser({ app_metadata: { role: 'admin' } })
    const session = buildMockSession({ user: adminUser })
    mockGetSession.mockResolvedValue({ data: { session }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAdmin).toBe(true)
  })

  it('19. user.id is exposed correctly after login', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.user?.id).toBe('user-test-001')
  })

  it('20. errorMessage is null when no error', () => {
    const store = useAuthStore()
    expect(store.errorMessage).toBeNull()
  })
})

// ============================================================================
// Group 7: Guest Mode
// ============================================================================

describe('Auth Flow — Guest Mode', () => {
  beforeEach(() => {
    resetAuthListeners()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSignOut.mockResolvedValue({ error: null })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockPersistAuthSessionBackup.mockResolvedValue(undefined)
    mockRestoreAuthSessionFromBackup.mockResolvedValue(false)
    mockClearAuthSessionBackup.mockResolvedValue(undefined)
  })

  it('21. before initialize(), user is null and isAuthenticated is false', () => {
    const store = useAuthStore()
    // No initialize() called — purely initial state
    expect(store.isAuthenticated).toBe(false)
    expect(store.user).toBeNull()
  })

  it('22. initialize() with no session completes without error', async () => {
    const store = useAuthStore()
    await expect(store.initialize()).resolves.toBeUndefined()
    expect(store.isInitialized).toBe(true)
    expect(store.isAuthenticated).toBe(false)
  })
})

// ============================================================================
// Group 8: Auth State Change Events
// ============================================================================

describe('Auth Flow — onAuthStateChange Events', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-21T10:00:00.000Z'))
    resetAuthListeners()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockSignOut.mockResolvedValue({ error: null })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('23. SIGNED_IN event updates user and session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAuthenticated).toBe(false)

    const session = buildMockSession()
    fireAuthStateChange('SIGNED_IN', session)
    await flushPromises()

    expect(store.user).not.toBeNull()
    expect(store.session?.access_token).toBe('access-token-xyz')
  })

  it('24. SIGNED_OUT event clears user and session (after grace period)', async () => {
    // TASK-1794: A transient SIGNED_OUT (no recoverable session) is NOT cleared
    // synchronously — it is deferred behind a 2s grace timer to avoid flashing the
    // login screen on Electron focus-change refresh races. With no session recovered,
    // the timer elapses and clears auth state.
    const session = buildMockSession()
    // initialize → has session; every subsequent getSession (double-check + grace recheck) → null
    mockGetSession
      .mockResolvedValueOnce({ data: { session }, error: null })
      .mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAuthenticated).toBe(true)

    fireAuthStateChange('SIGNED_OUT', null)
    await flushPromises()

    // Grace period: still signed in immediately after the transient SIGNED_OUT
    expect(store.user).not.toBeNull()

    // Advance past the 2s grace timer; recheck finds no session → state cleared
    await vi.advanceTimersByTimeAsync(2100)

    expect(store.user).toBeNull()
    expect(store.session).toBeNull()
  })

  it('24b. transient SIGNED_OUT followed by SIGNED_IN keeps user signed in (no flicker)', async () => {
    // TASK-1794: The Electron flicker path — a spurious SIGNED_OUT is quickly followed
    // by a valid session event, which must cancel the pending clear with no logout flash.
    const session = buildMockSession()
    mockGetSession
      .mockResolvedValueOnce({ data: { session }, error: null })
      .mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()
    expect(store.isAuthenticated).toBe(true)

    fireAuthStateChange('SIGNED_OUT', null)
    await flushPromises()
    expect(store.user).not.toBeNull() // deferred, not cleared

    // Valid session re-appears before the grace timer fires → cancels the pending clear
    fireAuthStateChange('TOKEN_REFRESHED', session)
    await flushPromises()

    // Even after the grace window, the user stays signed in
    await vi.advanceTimersByTimeAsync(2100)
    expect(store.user).not.toBeNull()
    expect(store.session?.access_token).toBe('access-token-xyz')
  })

  it('25. retryInitialization resets failure state and allows fresh attempt', async () => {
    mockGetSession.mockRejectedValueOnce(new Error('Init error'))

    const store = useAuthStore()
    await store.initialize()

    expect(store.initializationFailed).toBe(true)

    // Allow next attempt to succeed
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    await store.retryInitialization()

    expect(store.initializationFailed).toBe(false)
    expect(store.isInitialized).toBe(true)
  })
})
