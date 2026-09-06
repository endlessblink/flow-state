import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GoTrueClient } from '@supabase/auth-js'
import { beginElectronPkceAttempt, createLazyAuthStorage } from '../authStorage'

describe('Electron pending PKCE verifier ownership', () => {
  const key = 'electron-pkce-regression'
  const verifierKey = `${key}-code-verifier`
  let endAttempt: (() => Promise<void>) | undefined
  let values: Record<string, unknown>

  beforeEach(() => {
    values = {}
    ;(window as any).electronAPI = {
      isElectron: true,
      storeGet: vi.fn(async (name: string) => values[name] ?? null),
      storeSet: vi.fn(async (name: string, value: unknown) => { values[name] = value }),
    }
  })

  afterEach(async () => {
    await endAttempt?.()
    endAttempt = undefined
    delete (window as any).electronAPI
  })

  it.each(['_saveSession', '_removeSession'] as const)(
    'exchanges the original verifier after installed auth-js %s during OAuth',
    async (interruption) => {
      const storage = createLazyAuthStorage()!
      const fetchMock = vi.fn(async (_url: unknown, options?: RequestInit) => {
        const body = JSON.parse(String(options?.body))
        expect(body.code_verifier).toBe(JSON.parse(String(values[verifierKey])))
        expect(body.code_verifier).toBeTruthy()
        return new Response(JSON.stringify({
          access_token: 'test-access-token', refresh_token: 'test-refresh-token',
          expires_in: 3600, token_type: 'bearer', user: { id: 'test-user' },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      })
      const client = new GoTrueClient({
        url: 'https://auth.example.test', storageKey: key, storage,
        flowType: 'pkce', autoRefreshToken: false, detectSessionInUrl: false,
        fetch: fetchMock,
      })
      await client.initialize()
      endAttempt = beginElectronPkceAttempt(key)
      await client.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } })
      const verifier = await storage.getItem(verifierKey)
      expect(verifier).toBeTruthy()
      const internals = client as unknown as {
        _saveSession: (session: unknown) => Promise<void>
        _removeSession: () => Promise<void>
      }
      if (interruption === '_saveSession') await internals._saveSession({ user: { id: 'old-user' } })
      else await internals._removeSession()
      expect(await storage.getItem(verifierKey)).toBe(verifier)
      expect((await client.exchangeCodeForSession('test-code')).error).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await endAttempt()
      expect(await storage.getItem(verifierKey)).toBeNull()
    },
  )

  it('preserves only its exact verifier while allowing normal session removal', async () => {
    const storage = createLazyAuthStorage()!
    endAttempt = beginElectronPkceAttempt(key)
    for (const name of [key, verifierKey, 'other-code-verifier']) await storage.setItem(name, 'value')
    for (const name of [key, verifierKey, 'other-code-verifier']) await storage.removeItem(name)
    expect(await storage.getItem(key)).toBeNull()
    expect(await storage.getItem('other-code-verifier')).toBeNull()
    expect(await storage.getItem(verifierKey)).toBe('value')
    await endAttempt()
    await storage.setItem(verifierKey, 'later')
    await storage.removeItem(verifierKey)
    expect(await storage.getItem(verifierKey)).toBeNull()
  })

  it('rejects overlap until cleanup settles and stale cleanup cannot affect the next attempt', async () => {
    endAttempt = beginElectronPkceAttempt(key)
    expect(() => beginElectronPkceAttempt(key)).toThrow()
    let release!: () => void
    ;(window as any).electronAPI.storeSet.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve }))
    const oldEnd = endAttempt
    const cleanup = oldEnd()
    expect(() => beginElectronPkceAttempt(key)).toThrow()
    release()
    await cleanup
    endAttempt = beginElectronPkceAttempt(key)
    const storage = createLazyAuthStorage()!
    await storage.setItem(verifierKey, 'new-verifier')
    await oldEnd()
    expect(await storage.getItem(verifierKey)).toBe('new-verifier')
  })
})
