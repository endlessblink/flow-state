import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/auth/supabase', () => ({
  supabase: null,
  consumePendingProviderTokens: vi.fn().mockReturnValue(null),
}))

vi.mock('@/composables/useLocalApiBridge', () => ({
  syncLocalApiSession: vi.fn(),
  syncLocalApiRendererAuthState: vi.fn(),
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

describe('Auth Google sign-in in unconfigured builds', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('throws a clear configuration error instead of reading auth on null Supabase client', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow(
      'Supabase is not configured for this build'
    )

    expect(store.errorMessage).toContain('Supabase is not configured for this build')
  })
})
