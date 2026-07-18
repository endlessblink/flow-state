import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

/**
 * BUG-1918 regression: after signing out and back in, the canvas stayed on its empty state and
 * sidebar counts stayed 0 until a manual refresh.
 *
 * Cause: the SIGNED_IN handler loaded tasks/projects/canvas BEFORE workspaces. Task and canvas
 * fetches are workspace-scoped and read `activeWorkspaceId`, which is only restored inside
 * `loadWorkspaces()` — so they queried a null workspace, came back empty, and nothing reloaded once
 * the workspace arrived. Lanes were never reloaded at all.
 *
 * These tests record the real call ORDER, so reverting the fix turns them red.
 */

const calls: string[] = []

const { mockOnAuthStateChange, mockGetSession } = vi.hoisted(() => {
  type AuthCallback = (event: string, session: unknown) => void
  let listeners: AuthCallback[] = []
  const mockOnAuthStateChange = vi.fn((cb: AuthCallback) => {
    listeners.push(cb)
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  ;(mockOnAuthStateChange as any)._fire = (event: string, session: unknown) =>
    Promise.all(listeners.map(cb => cb(event, session)))
  ;(mockOnAuthStateChange as any)._reset = () => { listeners = [] }
  return { mockOnAuthStateChange, mockGetSession: vi.fn() }
})

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    realtime: { setAuth: vi.fn(), disconnect: vi.fn() },
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockResolvedValue({ data: [], error: null }) })),
  },
  supabaseConfig: { url: 'https://api.example.test', anonKey: 'anon' },
  consumePendingProviderTokens: vi.fn().mockReturnValue(null),
  persistAuthSessionBackup: vi.fn().mockResolvedValue(undefined),
  restoreAuthSessionFromBackup: vi.fn().mockResolvedValue(false),
  clearAuthSessionBackup: vi.fn().mockResolvedValue(undefined),
  persistPrimaryAuthSession: vi.fn().mockResolvedValue(undefined),
  readPersistedAuthSessionCandidate: vi.fn().mockResolvedValue(null),
  readPersistedAuthIdentity: vi.fn().mockResolvedValue(null),
  persistAuthIdentity: vi.fn().mockResolvedValue(undefined),
  clearPersistedAuthIdentity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utils/guestModeStorage', () => ({ clearGuestData: vi.fn(), clearGuestSessionId: vi.fn() }))
vi.mock('@/utils/braveProtection', () => ({ isBlockedByBrave: () => false, recordBlockedResource: vi.fn() }))
vi.mock('@/utils/platform', () => ({ isTauri: () => false }))
vi.mock('@/constants/dbTables', () => ({ DB_TABLES: { TASKS: 'tasks', PROJECTS: 'projects' } }))
vi.mock('@/services/offline/readCacheDB', () => ({ clearReadCache: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/composables/useLocalApiBridge', () => ({
  syncLocalApiSession: vi.fn(),
  syncLocalApiRendererAuthState: vi.fn(),
}))
vi.mock('@/composables/useSupabaseDatabase', () => ({
  useSupabaseDatabase: () => ({}),
  invalidateCache: { onAuthChange: vi.fn(), all: () => calls.push('invalidateCache') },
}))
vi.mock('@/stores/settings', () => ({ useSettingsStore: () => ({ updateSetting: vi.fn() }) }))

// Data stores: record call order.
vi.mock('@/stores/workspace', () => ({
  useWorkspaceStore: () => ({
    loadWorkspaces: async () => { calls.push('workspaces') },
    clearAll: vi.fn(),
  }),
}))
vi.mock('@/stores/tasks', () => ({
  useTaskStore: () => ({
    _rawTasks: [],
    loadFromDatabase: async () => { calls.push('tasks') },
    clearAll: vi.fn(),
  }),
}))
vi.mock('@/stores/canvas', () => ({
  useCanvasStore: () => ({
    loadFromDatabase: async () => { calls.push('canvas') },
    clearAll: vi.fn(),
  }),
}))
vi.mock('@/stores/projects', () => ({
  useProjectStore: () => ({
    loadProjectsFromDatabase: async () => { calls.push('projects') },
  }),
}))
vi.mock('@/stores/lanes', () => ({
  useLaneStore: () => ({
    loadLanesFromDatabase: async () => { calls.push('lanes') },
  }),
}))

import { useAuthStore } from '@/stores/auth'

const session = {
  access_token: 'a',
  refresh_token: 'r',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: 'user-signin-001', email: 'e@x.test' },
}

async function signInFromSignedOut() {
  mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
  const store = useAuthStore()
  await store.initialize()
  calls.length = 0
  await (mockOnAuthStateChange as any)._fire('SIGNED_IN', session)
  // let the handler's dynamic imports settle
  await new Promise(r => setTimeout(r, 0))
  return store
}

describe('SIGNED_IN store reload (BUG-1918)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    calls.length = 0
    ;(mockOnAuthStateChange as any)._reset()
    vi.clearAllMocks()
  })

  it('loads workspaces BEFORE tasks and canvas', async () => {
    await signInFromSignedOut()
    expect(calls).toContain('workspaces')
    expect(calls).toContain('tasks')
    expect(calls.indexOf('workspaces')).toBeLessThan(calls.indexOf('tasks'))
    expect(calls.indexOf('workspaces')).toBeLessThan(calls.indexOf('canvas'))
  })

  it('reloads lanes too', async () => {
    await signInFromSignedOut()
    expect(calls).toContain('lanes')
  })

  it('invalidates the SWR cache before fetching', async () => {
    await signInFromSignedOut()
    expect(calls.indexOf('invalidateCache')).toBeLessThan(calls.indexOf('workspaces'))
  })

  it('reloads every core store', async () => {
    await signInFromSignedOut()
    for (const store of ['workspaces', 'projects', 'tasks', 'canvas', 'lanes']) {
      expect(calls).toContain(store)
    }
  })
})
