// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { createClient } from '@supabase/supabase-js'

const source = readFileSync('server/local-api/server.cjs', 'utf8')
const applySessionSource = source.slice(source.indexOf('async function applySession('), source.indexOf('// --- Status mapping'))
const token = (expiry: number) => [
  { alg: 'HS256', typ: 'JWT' },
  { sub: 'synthetic-user', exp: expiry },
].map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.c3ludGhldGlj'

afterEach(() => vi.useRealTimers())

describe('Electron sidecar refresh ownership with installed Supabase SDK', () => {
  it('never refreshes expired or replaced sessions and carries the supplied JWT on queries', async () => {
    vi.useFakeTimers()
    const requests: { url: string; authorization: string | null }[] = []
    const clients: ReturnType<typeof createClient>[] = []
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, authorization: new Headers(init?.headers).get('authorization') })
      return new Response(JSON.stringify(url.includes('/auth/')
        ? { error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' }
        : []), { status: url.includes('/auth/') ? 400 : 200, headers: { 'Content-Type': 'application/json' } })
    })
    const scope = {
      ctx: null as { supabase: ReturnType<typeof createClient> } | null,
      authSubscription: null,
      activeWorkspaceId: null,
      PARENT_PORT: { postMessage: vi.fn() },
      logErr: vi.fn(),
      createClient: (url: string, key: string, options: Parameters<typeof createClient>[2]) => {
        const client = createClient(url, key, { ...options, global: { fetch } })
        if (!options?.accessToken) clients.push(client)
        return client
      },
    }
    const applySession = runInNewContext(`${applySessionSource}; applySession`, scope)
    try {
      for (const expiry of [1, Math.floor(Date.now() / 1000) + 60]) {
        const accessToken = token(expiry)
        await applySession({ supabaseUrl: 'http://127.0.0.1:54321', anonKey: 'synthetic-anon', accessToken, refreshToken: 'synthetic-refresh', userId: 'synthetic-user' })
        expect(requests.filter(request => request.url.includes('/auth/'))).toEqual([])
        expect(scope.ctx, JSON.stringify(scope.logErr.mock.calls)).not.toBeNull()
        if (!scope.ctx) throw new Error('Session context was not created')
        await scope.ctx.supabase.from('tasks').select('id')
        expect(requests.at(-1)?.authorization).toBe(`Bearer ${accessToken}`)
      }
      await vi.advanceTimersByTimeAsync(180_000)
      expect(requests.filter(request => request.url.includes('/auth/'))).toEqual([])
    } finally {
      await Promise.all(clients.map(client => client.auth.stopAutoRefresh()))
    }
  })
})
