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
  function electronAPI() {
    return (window as any).electronAPI
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    delete (window as any).Capacitor
    ;(window as any).electronAPI = {
      isElectron: true,
      oauthStart: vi.fn().mockResolvedValue(24892),
      oauthWaitForCallback: vi.fn().mockResolvedValue('http://127.0.0.1:24892?code=auth-code'),
      oauthCancel: vi.fn().mockResolvedValue(undefined),
      openExternal: vi.fn().mockResolvedValue(undefined),
    }
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://api.in-theflow.com/auth/v1/authorize?provider=google' },
      error: null,
    })
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null })
    mockSetSession.mockResolvedValue({ data: { session: {} }, error: null })
  })

  it('opens Google with the allow-listed loopback redirect and exchanges the PKCE callback code', async () => {
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await store.signInWithGoogle()

    expect(electronAPI().oauthStart).toHaveBeenCalledTimes(1)
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: expect.objectContaining({
        skipBrowserRedirect: true,
        redirectTo: 'http://127.0.0.1:24892',
      }),
    })
    expect(electronAPI().openExternal).toHaveBeenCalledWith(
      'https://api.in-theflow.com/auth/v1/authorize?provider=google'
    )
    expect(electronAPI().oauthWaitForCallback).toHaveBeenCalledTimes(1)
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('auth-code')
    expect(mockSetSession).not.toHaveBeenCalled()
    expect(electronAPI().oauthCancel).not.toHaveBeenCalled()
  })

  it('falls back to setting an implicit session when the callback returns tokens in the hash', async () => {
    electronAPI().oauthWaitForCallback.mockResolvedValue(
      'http://127.0.0.1:24892/#access_token=access-token&refresh_token=refresh-token'
    )
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await store.signInWithGoogle()

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    })
  })

  it('surfaces Electron callback-server start failures before requesting an OAuth URL', async () => {
    electronAPI().oauthStart.mockRejectedValue(new Error('port unavailable'))
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow('Failed to start OAuth server')

    expect(mockSignInWithOAuth).not.toHaveBeenCalled()
    expect(electronAPI().openExternal).not.toHaveBeenCalled()
    expect(electronAPI().oauthWaitForCallback).not.toHaveBeenCalled()
    expect(electronAPI().oauthCancel).not.toHaveBeenCalled()
  })

  it('cancels the local callback server when Supabase cannot produce a Google OAuth URL', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: new Error('provider unavailable'),
    })
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow('provider unavailable')

    expect(electronAPI().oauthCancel).toHaveBeenCalledTimes(1)
    expect(electronAPI().openExternal).not.toHaveBeenCalled()
    expect(electronAPI().oauthWaitForCallback).not.toHaveBeenCalled()
  })

  it('cancels the local callback server when Supabase returns no provider URL', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: null,
    })
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow('Failed to generate OAuth URL')

    expect(electronAPI().oauthCancel).toHaveBeenCalledTimes(1)
    expect(electronAPI().openExternal).not.toHaveBeenCalled()
    expect(electronAPI().oauthWaitForCallback).not.toHaveBeenCalled()
  })

  it('uses the allow-listed loopback redirect and cancels the server when browser launch fails', async () => {
    electronAPI().openExternal.mockRejectedValue(new Error('xdg-open failed'))
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
    expect(electronAPI().openExternal).toHaveBeenCalledWith(
      'https://api.in-theflow.com/auth/v1/authorize?provider=google'
    )
    expect(electronAPI().oauthCancel).toHaveBeenCalledTimes(1)
    expect(electronAPI().oauthWaitForCallback).not.toHaveBeenCalled()
  })

  it('surfaces OAuth provider errors returned to the loopback callback', async () => {
    electronAPI().oauthWaitForCallback.mockResolvedValue(
      'http://127.0.0.1:24892?error=access_denied&error_description=Denied'
    )
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow('OAuth error: Denied')

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    expect(mockSetSession).not.toHaveBeenCalled()
  })

  it('surfaces PKCE session exchange failures after a valid code callback', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: null,
      error: new Error('code exchange failed'),
    })
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow('code exchange failed')

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('auth-code')
    expect(mockSetSession).not.toHaveBeenCalled()
  })

  it('surfaces implicit-session failures after a token callback', async () => {
    electronAPI().oauthWaitForCallback.mockResolvedValue(
      'http://127.0.0.1:24892/#access_token=access-token&refresh_token=refresh-token'
    )
    mockSetSession.mockResolvedValue({
      data: null,
      error: new Error('set session failed'),
    })
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow('set session failed')

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    })
  })

  it('rejects a completed callback that contains no code or provider tokens', async () => {
    electronAPI().oauthWaitForCallback.mockResolvedValue('http://127.0.0.1:24892/')
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow('No authorization code or access token')

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    expect(mockSetSession).not.toHaveBeenCalled()
  })

  it('surfaces local OAuth callback wait failures without attempting a session exchange', async () => {
    electronAPI().oauthWaitForCallback.mockRejectedValue(new Error('timeout'))
    const { useAuthStore } = await import('@/stores/auth')
    const store = useAuthStore()

    await expect(store.signInWithGoogle()).rejects.toThrow('OAuth callback failed')

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    expect(mockSetSession).not.toHaveBeenCalled()
  })
})
