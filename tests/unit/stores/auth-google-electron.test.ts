import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const {
  mockSignInWithOAuth,
  mockExchangeCodeForSession,
  mockSetSession,
  mockIsBlockedByBrave,
  mockRecordBlockedResource,
} = vi.hoisted(() => ({
  mockSignInWithOAuth: vi.fn(),
  mockExchangeCodeForSession: vi.fn(),
  mockSetSession: vi.fn(),
  mockIsBlockedByBrave: vi.fn().mockReturnValue(false),
  mockRecordBlockedResource: vi.fn(),
}))

vi.mock('@/services/auth/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mockSignInWithOAuth,
      exchangeCodeForSession: mockExchangeCodeForSession,
      setSession: mockSetSession,
    },
  },
  consumePendingProviderTokens: vi.fn().mockReturnValue(null),
}))

vi.mock('@/utils/braveProtection', () => ({
  isBlockedByBrave: mockIsBlockedByBrave,
  recordBlockedResource: mockRecordBlockedResource,
}))

vi.mock('@/composables/useLocalApiBridge', () => ({
  syncLocalApiSession: vi.fn(),
}))

vi.mock('@/utils/guestModeStorage', () => ({
  clearGuestData: vi.fn(),
  clearGuestSessionId: vi.fn(),
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

describe('Auth Google sign-in in Electron', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    delete (window as any).Capacitor
    ;(window as any).electronAPI = {
      isElectron: true,
      oauthStart: vi.fn().mockResolvedValue(24892),
      oauthWaitForCallback: vi.fn().mockResolvedValue('http://127.0.0.1:24892?code=auth-code'),
      oauthCancel: vi.fn().mockResolvedValue(undefined),
      openExternal: vi.fn().mockRejectedValue(new Error('xdg-open failed')),
    }
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://api.in-theflow.com/auth/v1/authorize?provider=google' },
      error: null,
    })
  })

  it('uses the allow-listed loopback redirect and cancels the server when browser launch fails', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow('Failed to open browser for authentication')

    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        skipBrowserRedirect: true,
        redirectTo: 'http://127.0.0.1:24892',
      }),
    })
    expect((window as any).electronAPI.openExternal).toHaveBeenCalledWith(
      'https://api.in-theflow.com/auth/v1/authorize?provider=google'
    )
    expect((window as any).electronAPI.oauthCancel).toHaveBeenCalledTimes(1)
    expect((window as any).electronAPI.oauthWaitForCallback).not.toHaveBeenCalled()
  })
})
