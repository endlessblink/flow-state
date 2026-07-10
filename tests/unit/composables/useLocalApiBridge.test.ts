import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncLocalApiRendererAuthState, syncLocalApiSession } from '@/composables/useLocalApiBridge'

function installElectronApi() {
  const setLocalApiSession = vi.fn().mockResolvedValue({ ok: true })
  const clearLocalApiSession = vi.fn().mockResolvedValue({ ok: true })
  const setLocalApiRendererAuthState = vi.fn().mockResolvedValue({ ok: true })
  Object.defineProperty(window, 'electronAPI', {
    value: {
      isElectron: true,
      setLocalApiSession,
      clearLocalApiSession,
      setLocalApiRendererAuthState,
    },
    configurable: true,
  })
  return { setLocalApiSession, clearLocalApiSession, setLocalApiRendererAuthState }
}

describe('useLocalApiBridge', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI')
    vi.restoreAllMocks()
  })

  it('forwards a fresh Electron session to the Local API sidecar', () => {
    const api = installElectronApi()

    syncLocalApiSession({
      access_token: 'fresh-access-token',
      refresh_token: 'refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-1' },
    } as never)

    expect(api.setLocalApiSession).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: 'fresh-access-token',
      refreshToken: 'refresh-token',
      userId: 'user-1',
    }))
    expect(api.clearLocalApiSession).not.toHaveBeenCalled()
  })

  it('neither forwards nor clears on an expired reconnect-grace session', () => {
    const api = installElectronApi()

    syncLocalApiSession({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token',
      expires_at: Math.floor(Date.now() / 1000) - 60,
      user: { id: 'user-1' },
    } as never)

    // Still must not forward an expired token (the original invariant).
    expect(api.setLocalApiSession).not.toHaveBeenCalled()
    // BUG-1933: but clearing here blinded the sidecar — and with it the KDE widget and agent
    // tools — while the app showed signed-in. Hold the last good context; this watcher re-fires
    // once the refresh lands. Only a real sign-out clears.
    expect(api.clearLocalApiSession).not.toHaveBeenCalled()
  })

  it('clears the Local API sidecar on a real sign-out', () => {
    const api = installElectronApi()
    syncLocalApiSession(null)
    expect(api.clearLocalApiSession).toHaveBeenCalledOnce()
    expect(api.setLocalApiSession).not.toHaveBeenCalled()
  })

  it('forwards only non-secret renderer auth state to the Local API sidecar', () => {
    const api = installElectronApi()
    vi.spyOn(Date, 'now').mockReturnValue(1_777_777)

    syncLocalApiRendererAuthState({
      isAuthenticated: true,
      hasUser: true,
      canSyncRemotely: true,
      reauthRequired: false,
      isInitialized: true,
    })

    expect(api.setLocalApiRendererAuthState).toHaveBeenCalledWith({
      isAuthenticated: true,
      hasUser: true,
      canSyncRemotely: true,
      reauthRequired: false,
      isInitialized: true,
      updatedAt: 1_777_777,
    })
    expect(JSON.stringify(api.setLocalApiRendererAuthState.mock.calls)).not.toMatch(/access|refresh|token|anonKey|user-1/i)
  })
})
