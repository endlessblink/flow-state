import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const modulePath = resolve(process.cwd(), 'server/local-api/auth-availability.cjs')

describe('Local API missing auth context classification', () => {
  it('ships a privacy-safe classifier used before protected routes', () => {
    expect(existsSync(modulePath)).toBe(true)
  })

  it.skipIf(!existsSync(modulePath))('requires a fresh sign-in after reconnect grace expires', () => {
    const { classifyMissingAuthContext } = require(modulePath)
    expect(classifyMissingAuthContext({
      isAuthenticated: true,
      hasUser: true,
      canSyncRemotely: false,
      reauthRequired: true,
      isInitialized: true,
    })).toEqual({
      status: 503,
      body: {
        error: 'reauth_required',
        action: 'sign_in_again',
      },
    })
  })

  it.skipIf(!existsSync(modulePath))('classifies the real initialized cached-shell heartbeat as re-auth required', () => {
    const { classifyMissingAuthContext } = require(modulePath)
    expect(classifyMissingAuthContext({
      isAuthenticated: false,
      hasUser: true,
      canSyncRemotely: false,
      reauthRequired: true,
      isInitialized: true,
    })).toEqual({
      status: 503,
      body: {
        error: 'reauth_required',
        action: 'sign_in_again',
      },
    })
  })

  it.skipIf(!existsSync(modulePath))('reports bounded refresh grace without claiming sign-out', () => {
    const { classifyMissingAuthContext } = require(modulePath)
    expect(classifyMissingAuthContext({
      isAuthenticated: true,
      hasUser: true,
      canSyncRemotely: false,
      reauthRequired: false,
      isInitialized: true,
    })).toEqual({
      status: 503,
      body: {
        error: 'reauth_required',
        action: 'wait_or_sign_in_again',
      },
    })
  })

  it.skipIf(!existsSync(modulePath))('reports a genuine renderer-to-sidecar delivery fault', () => {
    const { classifyMissingAuthContext } = require(modulePath)
    expect(classifyMissingAuthContext({
      isAuthenticated: true,
      hasUser: true,
      canSyncRemotely: true,
      reauthRequired: false,
      isInitialized: true,
    })).toEqual({
      status: 503,
      body: {
        error: 'sidecar_auth_bridge_failed',
        action: 'restart_or_sign_in_again',
      },
    })
  })

  it.skipIf(!existsSync(modulePath))('keeps a truly signed-out sidecar fail-closed', () => {
    const { classifyMissingAuthContext } = require(modulePath)
    expect(classifyMissingAuthContext(null)).toEqual({
      status: 503,
      body: { error: 'signed_out' },
    })
  })
})
