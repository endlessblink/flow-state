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
  mockSetSession,
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
  mockPersistPrimaryAuthSession,
  mockReadPersistedAuthSessionCandidate,
  mockPersistAuthIdentity,
  mockReadPersistedAuthIdentity,
  mockClearPersistedAuthIdentity,
  mockClearPrimaryAuthSession,
  mockClearTaskStore,
  mockClearCanvasStore,
  mockClearWorkspaceStore,
  mockClearProjectStore,
  mockClearLaneStore,
  mockClearCanvasImages,
  mockLoadWorkspaces,
  mockLoadProjectsFromDatabase,
  mockLoadTasksFromDatabase,
  mockLoadCanvasFromDatabase,
  mockLoadLanesFromDatabase,
  mockClearWriteQueue,
  mockDeleteReadCacheScopesForUser,
  mockSyncLocalApiSession,
  mockSyncLocalApiRendererAuthState,
  mockInvalidateAuthCache,
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
    mockSetSession: vi.fn(),
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
    mockPersistPrimaryAuthSession: vi.fn(),
    mockReadPersistedAuthSessionCandidate: vi.fn(),
    mockPersistAuthIdentity: vi.fn(),
    mockReadPersistedAuthIdentity: vi.fn(),
    mockClearPersistedAuthIdentity: vi.fn(),
    mockClearPrimaryAuthSession: vi.fn(),
    mockClearTaskStore: vi.fn(),
    mockClearCanvasStore: vi.fn(),
    mockClearWorkspaceStore: vi.fn(),
    mockClearProjectStore: vi.fn(),
    mockClearLaneStore: vi.fn(),
    mockClearCanvasImages: vi.fn(),
    mockLoadWorkspaces: vi.fn(),
    mockLoadProjectsFromDatabase: vi.fn(),
    mockLoadTasksFromDatabase: vi.fn(),
    mockLoadCanvasFromDatabase: vi.fn(),
    mockLoadLanesFromDatabase: vi.fn(),
    mockClearWriteQueue: vi.fn(),
    mockDeleteReadCacheScopesForUser: vi.fn(),
    mockSyncLocalApiSession: vi.fn(),
    mockSyncLocalApiRendererAuthState: vi.fn(),
    mockInvalidateAuthCache: vi.fn(),
  }
})

// ============================================================================
// Module-level vi.mock calls — hoisted before imports
// ============================================================================

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      setSession: mockSetSession,
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
  persistPrimaryAuthSession: mockPersistPrimaryAuthSession,
  readPersistedAuthSessionCandidate: mockReadPersistedAuthSessionCandidate,
  persistAuthIdentity: mockPersistAuthIdentity,
  readPersistedAuthIdentity: mockReadPersistedAuthIdentity,
  clearPersistedAuthIdentity: mockClearPersistedAuthIdentity,
  clearPrimaryAuthSession: mockClearPrimaryAuthSession,
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
    onAuthChange: mockInvalidateAuthCache,
    all: vi.fn(),
  },
}))

vi.mock('@/composables/useLocalApiBridge', () => ({
  syncLocalApiSession: mockSyncLocalApiSession,
  syncLocalApiRendererAuthState: mockSyncLocalApiRendererAuthState,
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
    loadFromDatabase: mockLoadTasksFromDatabase,
    clearAll: mockClearTaskStore,
  }),
}))

vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    loadFromDatabase: mockLoadCanvasFromDatabase,
    clearAll: mockClearCanvasStore,
  }),
}))

vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    loadWorkspaces: mockLoadWorkspaces,
    clearAll: mockClearWorkspaceStore,
  }),
}))

vi.mock('@/stores/projects', () => ({
  useProjectStore: () => ({
    loadProjectsFromDatabase: mockLoadProjectsFromDatabase,
    clearAll: mockClearProjectStore,
  }),
}))

vi.mock('@/stores/lanes', () => ({
  useLaneStore: () => ({
    loadLanesFromDatabase: mockLoadLanesFromDatabase,
    clearAll: mockClearLaneStore,
  }),
}))

vi.mock('@/stores/canvasImages', () => ({
  useCanvasImagesStore: () => ({ clearAll: mockClearCanvasImages }),
}))

vi.mock('@/services/offline/readCacheDB', () => ({
  clearReadCache: vi.fn().mockResolvedValue(undefined),
  getReadCacheScope: vi.fn(() => ({ userId: 'user-123', workspaceId: null })),
  deleteReadCacheScopesForUser: mockDeleteReadCacheScopesForUser,
}))

vi.mock('@/services/offline/writeQueueDB', () => ({
  clearAll: mockClearWriteQueue,
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
import { LOCAL_API_AUTH_HEARTBEAT_MS, useAuthStore } from '@/stores/auth'

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
  _getListeners: () => Array<(event: string, session: unknown) => unknown>
  _reset: () => void
}

const fireAuthStateChange = async (event: string, session: MockSession | null) => {
  const listeners = (mockOnAuthStateChange as unknown as AuthListenersMock)._getListeners()
  const callbackResults = listeners.map((cb) => cb(event, session))
  await vi.advanceTimersByTimeAsync(0)
  await flushPromises()
  return callbackResults
}

const resetAuthListeners = () => {
  ;(mockOnAuthStateChange as unknown as AuthListenersMock)._reset()
}

beforeEach(() => {
  mockPersistAuthIdentity.mockResolvedValue(undefined)
  mockReadPersistedAuthIdentity.mockResolvedValue(null)
  mockClearPersistedAuthIdentity.mockResolvedValue(undefined)
  mockClearPrimaryAuthSession.mockResolvedValue(undefined)
})

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
    mockSetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockPersistAuthSessionBackup.mockResolvedValue(undefined)
    mockRestoreAuthSessionFromBackup.mockResolvedValue(false)
    mockClearAuthSessionBackup.mockResolvedValue(undefined)
    mockReadPersistedAuthSessionCandidate.mockResolvedValue(null)
    mockPersistPrimaryAuthSession.mockResolvedValue(undefined)
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
    mockSetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockPersistAuthSessionBackup.mockResolvedValue(undefined)
    mockRestoreAuthSessionFromBackup.mockResolvedValue(false)
    mockClearAuthSessionBackup.mockResolvedValue(undefined)
    mockReadPersistedAuthSessionCandidate.mockResolvedValue(null)
    mockPersistPrimaryAuthSession.mockResolvedValue(undefined)
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

  it('4b. exposes the persisted account as restoring while getSession is still pending', async () => {
    const persistedSession = buildMockSession({
      access_token: 'expired-persisted-token',
      expires_at: Math.floor(Date.now() / 1000) - 60,
    })
    let resolveGetSession!: (value: { data: { session: MockSession }, error: null }) => void
    mockReadPersistedAuthSessionCandidate.mockResolvedValue(persistedSession)
    mockGetSession.mockReturnValue(new Promise(resolve => { resolveGetSession = resolve }))

    const store = useAuthStore()
    const initialization = store.initialize()
    await flushPromises()

    expect(store.user?.id).toBe('user-test-001')
    expect(store.isAuthenticated).toBe(false)
    expect(store.isRestoringSession).toBe(true)
    expect(store.canSyncRemotely).toBe(false)
    expect(store.isInitialized).toBe(false)

    const freshSession = buildMockSession({ access_token: 'fresh-session-token' })
    resolveGetSession({ data: { session: freshSession }, error: null })
    await initialization

    expect(store.isRestoringSession).toBe(false)
    expect(store.canSyncRemotely).toBe(true)
  })

  it('4c. keeps a persisted identity write-blocked when getSession fails during restoration', async () => {
    const persistedSession = buildMockSession({
      access_token: 'unconfirmed-persisted-token',
      expires_at: Math.floor(Date.now() / 1000) - 60,
    })
    mockReadPersistedAuthSessionCandidate.mockResolvedValue(persistedSession)
    mockGetSession.mockRejectedValue(new Error('auth storage unavailable'))

    const store = useAuthStore()
    await store.initialize()

    expect(store.user?.id).toBe('user-test-001')
    expect(store.isAuthenticated).toBe(true)
    expect(store.isRestoringSession).toBe(true)
    expect(store.isOfflineGracePeriod).toBe(true)
    expect(store.canSyncRemotely).toBe(false)
    expect(store.initializationFailed).toBe(false)
    expect(mockSyncLocalApiSession).not.toHaveBeenCalled()
  })

  it('4d. restores the remembered account after its dead token was removed on a prior launch', async () => {
    const rememberedUser = buildMockUser({ id: 'remembered-after-restart' })
    mockReadPersistedAuthSessionCandidate.mockResolvedValue(null)
    mockReadPersistedAuthIdentity.mockResolvedValue(rememberedUser)
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockRestoreAuthSessionFromBackup.mockResolvedValue(null)

    const store = useAuthStore()
    await store.initialize()

    expect(store.user?.id).toBe(rememberedUser.id)
    expect(store.session).toBeNull()
    expect(store.isAuthenticated).toBe(true)
    expect(store.isRestoringSession).toBe(true)
    expect(store.reauthRequired).toBe(true)
  })

  it('4e. keeps an identity-only account write-blocked when startup session validation errors', async () => {
    const rememberedUser = buildMockUser({ id: 'remembered-after-storage-error' })
    mockReadPersistedAuthSessionCandidate.mockResolvedValue(null)
    mockReadPersistedAuthIdentity.mockResolvedValue(rememberedUser)
    mockGetSession.mockRejectedValue(new Error('auth storage temporarily unavailable'))

    const store = useAuthStore()
    await store.initialize()

    expect(store.user?.id).toBe(rememberedUser.id)
    expect(store.session).toBeNull()
    expect(store.isAuthenticated).toBe(true)
    expect(store.isRestoringSession).toBe(true)
    expect(store.reauthRequired).toBe(true)
    expect(store.initializationFailed).toBe(false)
    expect(store.canSyncRemotely).toBe(false)
  })

  it('5. initialize() with active session sets isAuthenticated=true and user', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAuthenticated).toBe(true)
    expect(store.isRestoringSession).toBe(false)
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
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    mockSetSession.mockResolvedValueOnce({ data: { session }, error: null })
    mockRestoreAuthSessionFromBackup.mockResolvedValue(session)

    const store = useAuthStore()
    await store.initialize()

    expect(mockRestoreAuthSessionFromBackup).toHaveBeenCalledOnce()
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    expect(mockGetSession).toHaveBeenCalledOnce()
    expect(store.isAuthenticated).toBe(true)
    expect(store.isRestoringSession).toBe(false)
    expect(store.user?.id).toBe('user-test-001')
  })

  it('8d. initialize() keeps the signed-in shell when Electron backup restore succeeds but Supabase still reports no session', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    mockSetSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    mockRestoreAuthSessionFromBackup.mockResolvedValue(session)

    const store = useAuthStore()
    await store.initialize()

    expect(mockRestoreAuthSessionFromBackup).toHaveBeenCalledOnce()
    expect(mockSetSession).toHaveBeenCalledOnce()
    expect(mockGetSession).toHaveBeenCalledOnce()
    expect(store.isAuthenticated).toBe(true)
    expect(store.isRestoringSession).toBe(true)
    expect(store.canSyncRemotely).toBe(false)
    expect(store.user?.id).toBe('user-test-001')
    expect(store.isOfflineGracePeriod).toBe(true)
  })

  it('8d2. initialize() does not re-save a dead Electron backup refresh token', async () => {
    const restoredSession = buildMockSession({
      access_token: 'expired-restored-access-token',
      expires_at: Math.floor(Date.now() / 1000) - 60,
    })
    mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    mockSetSession.mockResolvedValueOnce({
      data: { session: null },
      error: { name: 'AuthError', message: 'Invalid Refresh Token: Already Used', status: 400 },
    })
    mockRestoreAuthSessionFromBackup.mockResolvedValue(restoredSession)

    const store = useAuthStore()
    await store.initialize()

    expect(mockClearAuthSessionBackup).toHaveBeenCalledOnce()
    expect(mockPersistAuthSessionBackup).not.toHaveBeenCalled()
    expect(store.isAuthenticated).toBe(true)
    expect(store.isRestoringSession).toBe(true)
    expect(store.canSyncRemotely).toBe(false)
    expect(store.user?.id).toBe('user-test-001')
    expect(store.isOfflineGracePeriod).toBe(true)
    expect(store.reauthRequired).toBe(true)
    expect(mockPersistPrimaryAuthSession).not.toHaveBeenCalled()
  })

  it('8e. initialize() keeps the signed-in shell when an expired Electron session cannot refresh immediately', async () => {
    const expiredSession = buildMockSession({
      expires_at: Math.floor(Date.now() / 1000) - 60,
    })
    mockGetSession.mockResolvedValue({ data: { session: expiredSession }, error: null })
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthError', message: 'Refresh failed during update restart', status: 408 },
    })

    const store = useAuthStore()
    await store.initialize()

    expect(mockRefreshSession).toHaveBeenCalledOnce()
    expect(store.isAuthenticated).toBe(true)
    expect(store.isRestoringSession).toBe(true)
    expect(store.user?.id).toBe('user-test-001')
    expect(store.isOfflineGracePeriod).toBe(true)

    // BUG-1933: supabase-js nulls the primary key when the refresh fails. The reconnect shell must
    // re-persist it, or store.json keeps `flowstate-supabase-auth: null` while the UI shows
    // signed-in — the sidecar and the next launch then see no session.
    expect(mockPersistPrimaryAuthSession).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ id: 'user-test-001' }) })
    )
  })

  it('8e2. online retry exhaustion after update keeps the signed-in shell instead of signing out', async () => {
    vi.useFakeTimers()
    const originalOnline = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    try {
      const expiredSession = buildMockSession({
        expires_at: Math.floor(Date.now() / 1000) - 60,
      })
      mockGetSession.mockResolvedValue({ data: { session: expiredSession }, error: null })
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { name: 'AuthError', message: 'Invalid Refresh Token: Already Used', status: 400 },
      })

      const store = useAuthStore()
      await store.initialize()

      expect(store.isAuthenticated).toBe(true)
      expect(store.isRestoringSession).toBe(true)
      expect(store.canSyncRemotely).toBe(false)
      expect(store.isOfflineGracePeriod).toBe(true)

      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      window.dispatchEvent(new Event('online'))
      await flushPromises()
      await vi.advanceTimersByTimeAsync(13_000)
      await flushPromises()

      expect(mockRefreshSession.mock.calls.length).toBeGreaterThanOrEqual(4)
      expect(store.isAuthenticated).toBe(true)
      expect(store.isRestoringSession).toBe(true)
      expect(store.user?.id).toBe('user-test-001')
      expect(store.canSyncRemotely).toBe(false)
      expect(store.isOfflineGracePeriod).toBe(true)
      expect(store.initializationFailed).toBe(false)
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnline, configurable: true })
      vi.useRealTimers()
    }
  })

  it('8f. reconnect grace retries refresh and republishes a fresh session to the Electron Local API bridge', async () => {
    vi.useFakeTimers()
    try {
      const expiredSession = buildMockSession({
        access_token: 'expired-access-token',
        expires_at: Math.floor(Date.now() / 1000) - 60,
      })
      const freshSession = buildMockSession({
        access_token: 'fresh-recovered-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      })
      mockGetSession.mockResolvedValue({ data: { session: expiredSession }, error: null })
      mockRefreshSession
        .mockResolvedValueOnce({
          data: { session: null },
          error: { name: 'AuthError', message: 'Refresh failed during update restart', status: 408 },
        })
        .mockResolvedValueOnce({
          data: { session: freshSession },
          error: null,
        })

      const store = useAuthStore()
      await store.initialize()

      expect(store.session?.access_token).toBe('expired-access-token')
      expect(store.isOfflineGracePeriod).toBe(true)

      await vi.advanceTimersByTimeAsync(1000)
      await flushPromises()

      expect(mockRefreshSession).toHaveBeenCalledTimes(2)
      expect(store.session?.access_token).toBe('fresh-recovered-access-token')
      expect(store.isOfflineGracePeriod).toBe(false)
      expect(store.canSyncRemotely).toBe(true)
      expect(mockSyncLocalApiSession).toHaveBeenCalledWith(expect.objectContaining({
        access_token: 'fresh-recovered-access-token',
      }))
    } finally {
      vi.useRealTimers()
    }
  })

  it('8g. refreshes the Electron Local API renderer auth heartbeat before diagnostics marks it stale', async () => {
    vi.useFakeTimers()
    try {
      const session = buildMockSession()
      mockGetSession.mockResolvedValue({ data: { session }, error: null })

      const store = useAuthStore()
      await store.initialize()
      await flushPromises()
      mockSyncLocalApiRendererAuthState.mockClear()

      await vi.advanceTimersByTimeAsync(LOCAL_API_AUTH_HEARTBEAT_MS)
      await flushPromises()

      expect(mockSyncLocalApiRendererAuthState).toHaveBeenCalledWith({
        isAuthenticated: true,
        hasUser: true,
        canSyncRemotely: true,
        reauthRequired: false,
        isInitialized: true,
      })
    } finally {
      vi.useRealTimers()
    }
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

  it('12b. SIGNED_IN can replace a remembered recovery account without inheriting its local data', async () => {
    const rememberedUser = buildMockUser({
      id: 'remembered-user-001',
      email: 'old-account@flowstate.app',
    })
    const newUser = buildMockUser({
      id: 'new-user-002',
      email: 'new-account@flowstate.app',
    })
    const newSession = buildMockSession({
      access_token: 'new-account-access-token',
      refresh_token: 'new-account-refresh-token',
      user: newUser,
    })
    mockReadPersistedAuthSessionCandidate.mockResolvedValue(null)
    mockReadPersistedAuthIdentity.mockResolvedValue(rememberedUser)
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockRestoreAuthSessionFromBackup.mockResolvedValue(null)
    mockSignOut.mockResolvedValue({ error: null })
    mockLoadWorkspaces.mockResolvedValue(undefined)
    mockLoadProjectsFromDatabase.mockResolvedValue(undefined)
    mockLoadTasksFromDatabase.mockResolvedValue(undefined)
    mockLoadCanvasFromDatabase.mockResolvedValue(undefined)
    mockLoadLanesFromDatabase.mockResolvedValue(undefined)

    const store = useAuthStore()
    await store.initialize()

    expect(store.user?.id).toBe('remembered-user-001')
    expect(store.isRestoringSession).toBe(true)
    expect(store.reauthRequired).toBe(true)

    await fireAuthStateChange('SIGNED_IN', newSession)
    await flushPromises()

    expect(mockSignOut).not.toHaveBeenCalled()
    expect(mockClearTaskStore).toHaveBeenCalledOnce()
    expect(mockClearCanvasStore).toHaveBeenCalledOnce()
    expect(mockClearWorkspaceStore).toHaveBeenCalledOnce()
    expect(mockClearProjectStore).toHaveBeenCalledOnce()
    expect(mockClearLaneStore).toHaveBeenCalledOnce()
    expect(mockClearCanvasImages).toHaveBeenCalledOnce()
    expect(mockClearWriteQueue).toHaveBeenCalledOnce()
    expect(store.user?.id).toBe('new-user-002')
    expect(store.session?.access_token).toBe('new-account-access-token')
    expect(store.isAuthenticated).toBe(true)
    expect(store.isRestoringSession).toBe(false)
    expect(store.reauthRequired).toBe(false)
    await vi.waitFor(() => expect(mockLoadWorkspaces).toHaveBeenCalledOnce(), { timeout: 5000 })
    expect(mockLoadTasksFromDatabase).toHaveBeenCalledOnce()
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
    expect(mockClearPersistedAuthIdentity).toHaveBeenCalledOnce()
    expect(mockClearPrimaryAuthSession).toHaveBeenCalledOnce()
  })

  it('14b. signOut clears all account metadata and pending writes before guest mode', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })
    mockSignOut.mockResolvedValue({ error: null })

    const store = useAuthStore()
    await store.initialize()
    await store.signOut()

    expect(mockClearProjectStore).toHaveBeenCalledOnce()
    expect(mockClearLaneStore).toHaveBeenCalledOnce()
    expect(mockClearCanvasImages).toHaveBeenCalledOnce()
    expect(mockClearWriteQueue).toHaveBeenCalledOnce()
    expect(mockDeleteReadCacheScopesForUser).toHaveBeenCalledWith('user-123')
  })

  it('14c. signOut durably clears the primary session even when auth-js returns an error', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })
    mockSignOut.mockResolvedValue({ error: new Error('server unavailable') })

    const store = useAuthStore()
    await store.initialize()
    await store.signOut()

    expect(mockClearPrimaryAuthSession).toHaveBeenCalledOnce()
    expect(store.user).toBeNull()
    expect(store.session).toBeNull()
  })

  it('14d. failed durable cleanup aborts sign-out instead of allowing backup resurrection', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })
    mockClearAuthSessionBackup.mockRejectedValueOnce(new Error('disk unavailable'))

    const store = useAuthStore()
    await store.initialize()
    await store.signOut()

    expect(mockClearPrimaryAuthSession).not.toHaveBeenCalled()
    expect(store.user?.id).toBe(session.user.id)
    expect(store.session?.refresh_token).toBe(session.refresh_token)
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
    await fireAuthStateChange('TOKEN_REFRESHED', newSession)
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

  it('22a. auth-js callbacks return synchronously before any Supabase recheck', async () => {
    const session = buildMockSession()
    mockGetSession
      .mockResolvedValueOnce({ data: { session }, error: null })
      .mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()
    mockGetSession.mockClear()

    const callbackResultsPromise = fireAuthStateChange('SIGNED_OUT', null)
    const listeners = (mockOnAuthStateChange as unknown as AuthListenersMock)._getListeners()
    const immediateResult = listeners[0]?.('USER_UPDATED', null)

    expect(immediateResult).toBeUndefined()
    expect(mockGetSession).not.toHaveBeenCalled()
    await callbackResultsPromise
  })

  it('23. SIGNED_IN event updates user and session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAuthenticated).toBe(false)

    const session = buildMockSession()
    await fireAuthStateChange('SIGNED_IN', session)
    await flushPromises()

    expect(store.user).not.toBeNull()
    expect(store.session?.access_token).toBe('access-token-xyz')
  })

  it('24. passive SIGNED_OUT never clears the remembered account', async () => {
    const session = buildMockSession()
    // initialize → has session; every subsequent getSession (double-check + grace recheck) → null
    mockGetSession
      .mockResolvedValueOnce({ data: { session }, error: null })
      .mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()

    expect(store.isAuthenticated).toBe(true)

    await fireAuthStateChange('SIGNED_OUT', null)
    await flushPromises()

    // The account shell remains immediately and permanently. Only signOut() may clear it.
    expect(store.user).not.toBeNull()
    await vi.advanceTimersByTimeAsync(2100)

    expect(store.user?.id).toBe(session.user.id)
    expect(store.session?.access_token).toBe(session.access_token)
    expect(store.reauthRequired).toBe(true)
    expect(mockPersistAuthIdentity).toHaveBeenCalledWith(session.user)
    expect(mockPersistPrimaryAuthSession).not.toHaveBeenCalledWith(session)
  })

  it('24a. repeated passive SIGNED_OUT events still cannot erase the account', async () => {
    const session = buildMockSession()
    mockGetSession
      .mockResolvedValueOnce({ data: { session }, error: null })
      .mockResolvedValue({ data: { session: null }, error: null })

    const store = useAuthStore()
    await store.initialize()
    await fireAuthStateChange('SIGNED_OUT', null)
    await fireAuthStateChange('SIGNED_OUT', null)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(store.user?.id).toBe(session.user.id)
    expect(store.session?.user.id).toBe(session.user.id)
  })

  it('24a2. null INITIAL_SESSION after identity recovery cannot erase the remembered account', async () => {
    const rememberedUser = buildMockUser({ id: 'remembered-initial-session' })
    mockReadPersistedAuthSessionCandidate.mockResolvedValue(null)
    mockReadPersistedAuthIdentity.mockResolvedValue(rememberedUser)
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockRestoreAuthSessionFromBackup.mockResolvedValue(null)

    const store = useAuthStore()
    await store.initialize()
    mockInvalidateAuthCache.mockClear()

    await fireAuthStateChange('INITIAL_SESSION', null)
    await flushPromises()

    expect(store.user?.id).toBe(rememberedUser.id)
    expect(store.session).toBeNull()
    expect(store.isRestoringSession).toBe(true)
    expect(store.reauthRequired).toBe(true)
    expect(mockInvalidateAuthCache).not.toHaveBeenCalledWith(null)
  })

  it('24a3. a passive null-session event cannot clear the active account or its cache ownership', async () => {
    const session = buildMockSession()
    mockGetSession.mockResolvedValue({ data: { session }, error: null })

    const store = useAuthStore()
    await store.initialize()
    mockInvalidateAuthCache.mockClear()

    await fireAuthStateChange('USER_UPDATED', null)
    await flushPromises()

    expect(store.user?.id).toBe(session.user.id)
    expect(store.session?.access_token).toBe(session.access_token)
    expect(store.reauthRequired).toBe(true)
    expect(mockInvalidateAuthCache).not.toHaveBeenCalledWith(null)
  })

  it('24a4. passive reconnect cannot silently switch the remembered account', async () => {
    const remembered = buildMockUser({ id: 'account-a' })
    mockReadPersistedAuthIdentity.mockResolvedValue(remembered)
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockRestoreAuthSessionFromBackup.mockResolvedValue(null)

    const store = useAuthStore()
    await store.initialize()
    const otherSession = buildMockSession({ user: buildMockUser({ id: 'account-b' }) })

    await fireAuthStateChange('TOKEN_REFRESHED', otherSession)

    expect(store.user?.id).toBe('account-a')
    expect(store.session).toBeNull()
    expect(store.reauthRequired).toBe(true)
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' })
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

    await fireAuthStateChange('SIGNED_OUT', null)
    await flushPromises()
    expect(store.user).not.toBeNull() // deferred, not cleared

    // Valid session re-appears before the grace timer fires → cancels the pending clear
    await fireAuthStateChange('TOKEN_REFRESHED', session)
    await flushPromises()

    // Even after the grace window, the user stays signed in
    await vi.advanceTimersByTimeAsync(2100)
    expect(store.user).not.toBeNull()
    expect(store.session?.access_token).toBe('access-token-xyz')
  })

  it('24c. preserves auth event order when SIGNED_OUT validation is slow', async () => {
    const initial = buildMockSession({ access_token: 'initial-token' })
    const refreshed = buildMockSession({ access_token: 'fresh-token' })
    let resolveRecheck!: (value: { data: { session: null } }) => void
    const slowRecheck = new Promise<{ data: { session: null } }>(resolve => { resolveRecheck = resolve })
    mockGetSession
      .mockResolvedValueOnce({ data: { session: initial }, error: null })
      .mockReturnValueOnce(slowRecheck as never)

    const store = useAuthStore()
    await store.initialize()
    const listeners = (mockOnAuthStateChange as unknown as AuthListenersMock)._getListeners()
    listeners[0]?.('SIGNED_OUT', null)
    listeners[0]?.('TOKEN_REFRESHED', refreshed)
    await vi.advanceTimersByTimeAsync(0)

    resolveRecheck({ data: { session: null } })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(0)
    await flushPromises()

    expect(store.session?.access_token).toBe('fresh-token')
    expect(store.reauthRequired).toBe(false)
    expect(store.isRestoringSession).toBe(false)
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
