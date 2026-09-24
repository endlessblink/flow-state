import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { SCHEMA_VERSION, buildApiReadiness } = require(
  '../../../server/local-api/api-readiness.cjs',
)

describe('Local API readiness contract', () => {
  const base = { mode: 'token', appVersion: 'test-version' }

  it('reports authenticated task readiness', () => {
    expect(buildApiReadiness({ ...base, ctx: { userId: 'redacted-in-test' } })).toEqual({
      status: 200,
      body: {
        schemaVersion: SCHEMA_VERSION,
        service: 'task-api',
        live: true,
        mode: 'token',
        appVersion: 'test-version',
        ok: true,
        ready: true,
        auth: 'ready',
        capabilities: { taskReads: true, taskMutations: true },
      },
    })
  })

  it('distinguishes a live but signed-out sidecar', () => {
    expect(buildApiReadiness({ ...base, ctx: null, rendererAuthState: null })).toMatchObject({
      status: 503,
      body: {
        live: true,
        ok: false,
        ready: false,
        auth: 'signed_out',
        capabilities: { taskReads: false, taskMutations: false },
      },
    })
  })

  it('preserves the actionable re-auth state for agents', () => {
    expect(buildApiReadiness({
      ...base,
      ctx: null,
      rendererAuthState: {
        isAuthenticated: true,
        hasUser: true,
        canSyncRemotely: false,
        reauthRequired: true,
        isInitialized: true,
      },
    })).toMatchObject({
      status: 503,
      body: { auth: 'reauth_required', action: 'sign_in_again' },
    })
  })

  it('reports an initialized bridge failure without exposing session data', () => {
    const result = buildApiReadiness({
      ...base,
      ctx: null,
      rendererAuthState: {
        isAuthenticated: true,
        hasUser: true,
        canSyncRemotely: true,
        reauthRequired: false,
        isInitialized: true,
      },
    })

    expect(result).toMatchObject({
      status: 503,
      body: { auth: 'sidecar_auth_bridge_failed', action: 'restart_or_sign_in_again' },
    })
    expect(JSON.stringify(result)).not.toMatch(/secret|refresh|accessToken|refreshToken/i)
  })
})
