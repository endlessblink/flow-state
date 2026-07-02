/**
 * BUG-1898 (part 2): the auth reconnect grace period must be BOUNDED.
 *
 * Today `isOfflineGracePeriod` only ever clears on a successful token refresh.
 * When the refresh token is permanently dead (400 "Already Used"),
 * performTokenRefresh exhausts its retries while online and neither
 * reschedules nor surfaces anything — the app stays write-blocked
 * (`canSyncRemotely === false`) until restart, silently dropping syncs.
 *
 * Contract under test: after GRACE_MAX_MS in grace with refresh still failing,
 * the store flags `reauthRequired = true` so the UI can prompt a re-login.
 * A successful refresh before (or after) the deadline clears grace and never
 * flags / un-flags re-auth.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

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
  mockSyncLocalApiSession,
} = vi.hoisted(() => {
  type AuthCallback = (event: string, session: unknown) => void
  let _listeners: AuthCallback[] = []
  const mockOnAuthStateChange = vi.fn((cb: AuthCallback) => {
    _listeners.push(cb)
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  ;(mockOnAuthStateChange as unknown as { _reset: () => void })._reset = () => { _listeners = [] }
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
    mockSyncLocalApiSession: vi.fn(),
  }
})

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      refreshSession: mockRefreshSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
    realtime: { setAuth: mockRealtimeSetAuth, disconnect: mockRealtimeDisconnect },
    from: mockFromTable,
  },
  consumePendingProviderTokens: vi.fn().mockReturnValue(null),
  persistAuthSessionBackup: mockPersistAuthSessionBackup,
  restoreAuthSessionFromBackup: mockRestoreAuthSessionFromBackup,
  clearAuthSessionBackup: mockClearAuthSessionBackup,
}))
vi.mock('@/utils/guestModeStorage', () => ({ clearGuestData: vi.fn(), clearGuestSessionId: vi.fn() }))
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
  invalidateCache: { onAuthChange: vi.fn(), all: vi.fn() },
}))
vi.mock('@/composables/useLocalApiBridge', () => ({ syncLocalApiSession: mockSyncLocalApiSession }))
vi.mock('@/constants/dbTables', () => ({ DB_TABLES: { TASKS: 'tasks', PROJECTS: 'projects' } }))
vi.mock('@/utils/platform', () => ({ isTauri: vi.fn().mockReturnValue(false) }))
vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({ _rawTasks: [], loadFromDatabase: vi.fn().mockResolvedValue(undefined), clearAll: vi.fn() }),
}))
vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({ loadFromDatabase: vi.fn().mockResolvedValue(undefined), clearAll: vi.fn() }),
}))
vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({ loadWorkspaces: vi.fn().mockResolvedValue(undefined), clearAll: vi.fn() }),
}))
vi.mock('@/stores/projects', () => ({
  useProjectStore: () => ({ loadProjectsFromDatabase: vi.fn().mockResolvedValue(undefined) }),
}))
vi.mock('@/services/offline/readCacheDB', () => ({ clearReadCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/stores/settings', () => ({
  useSettingsStore: () => ({
    googleProviderToken: null,
    googleProviderTokenExpiry: null,
    googleProviderRefreshToken: null,
    googleConnected: false,
    updateSetting: vi.fn(),
  }),
}))

import { useAuthStore, GRACE_MAX_MS, GRACE_RETRY_MS } from '@/stores/auth'

function buildMockSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'access-token-001',
    refresh_token: 'refresh-token-001',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: 'user-test-001', email: 'user@test.dev' },
    ...overrides,
  }
}

async function enterGraceViaBackupRestore(store: ReturnType<typeof useAuthStore>) {
  // Same path as auth-flow test 8d: Supabase reports no session, Electron
  // backup restores one → signed-in shell + offline grace.
  mockGetSession
    .mockResolvedValueOnce({ data: { session: null }, error: null })
    .mockResolvedValueOnce({ data: { session: null }, error: null })
  mockRestoreAuthSessionFromBackup.mockResolvedValue(buildMockSession())
  await store.initialize()
  expect(store.isOfflineGracePeriod).toBe(true)
}

describe('BUG-1898: bounded reconnect grace with explicit re-auth state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    vi.clearAllMocks()
    // Default: refresh keeps failing with a permanently dead token
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { name: 'AuthError', message: 'Invalid Refresh Token: Already Used', status: 400 },
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('exports a finite GRACE_MAX_MS bound', () => {
    expect(GRACE_MAX_MS).toBeGreaterThan(0)
    expect(GRACE_MAX_MS).toBeLessThanOrEqual(30 * 60 * 1000)
  })

  it('flags reauthRequired after GRACE_MAX_MS when refresh never recovers', async () => {
    const store = useAuthStore()
    await enterGraceViaBackupRestore(store)
    expect(store.reauthRequired).toBe(false)

    await vi.advanceTimersByTimeAsync(GRACE_MAX_MS + 60_000)

    expect(store.isAuthenticated, 'signed-in shell must survive — no hard sign-out').toBe(true)
    expect(
      store.reauthRequired,
      'grace expired with refresh still dead but no re-auth state was surfaced — app stays silently write-blocked forever'
    ).toBe(true)
  })

  it('grace auto-retries the refresh and clears without flagging when it recovers before the deadline', async () => {
    const store = useAuthStore()
    await enterGraceViaBackupRestore(store)

    // Network comes back: the next periodic grace retry succeeds
    mockRefreshSession.mockResolvedValue({ data: { session: buildMockSession() }, error: null })
    await vi.advanceTimersByTimeAsync(GRACE_RETRY_MS + 1_000)
    expect(
      store.isOfflineGracePeriod,
      'grace has no self-recovery — a successful refresh on the retry cadence must clear it'
    ).toBe(false)

    await vi.advanceTimersByTimeAsync(GRACE_MAX_MS + 60_000)
    expect(store.reauthRequired, 'recovered session must not flag re-auth').toBe(false)
  })

  it('clears reauthRequired once a later refresh finally succeeds', async () => {
    const store = useAuthStore()
    await enterGraceViaBackupRestore(store)
    await vi.advanceTimersByTimeAsync(GRACE_MAX_MS + 60_000)
    expect(store.reauthRequired).toBe(true)

    mockRefreshSession.mockResolvedValue({ data: { session: buildMockSession() }, error: null })
    await vi.advanceTimersByTimeAsync(GRACE_RETRY_MS + 1_000)

    expect(store.isOfflineGracePeriod).toBe(false)
    expect(store.reauthRequired, 're-auth flag must clear after successful recovery').toBe(false)
  })
})
