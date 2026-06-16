import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncLocalApiSession } from '@/composables/useLocalApiBridge'

function installElectronApi() {
  const setLocalApiSession = vi.fn().mockResolvedValue({ ok: true })
  const clearLocalApiSession = vi.fn().mockResolvedValue({ ok: true })
  Object.defineProperty(window, 'electronAPI', {
    value: {
      isElectron: true,
      setLocalApiSession,
      clearLocalApiSession,
    },
    configurable: true,
  })
  return { setLocalApiSession, clearLocalApiSession }
}

describe('useLocalApiBridge', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'electronAPI')
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

  it('clears the Local API sidecar instead of forwarding an expired reconnect-grace session', () => {
    const api = installElectronApi()

    syncLocalApiSession({
      access_token: 'expired-access-token',
      refresh_token: 'refresh-token',
      expires_at: Math.floor(Date.now() / 1000) - 60,
      user: { id: 'user-1' },
    } as never)

    expect(api.setLocalApiSession).not.toHaveBeenCalled()
    expect(api.clearLocalApiSession).toHaveBeenCalledOnce()
  })
})
