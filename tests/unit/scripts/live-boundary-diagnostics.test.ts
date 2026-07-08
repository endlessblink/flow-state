import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const scriptPath = 'scripts/diagnose-live-boundary.cjs'

function runBoundary(env: Record<string, string>) {
  return execFileSync('node', [scriptPath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
}

function fixtureEnv(diagnostics: Record<string, unknown>, processList: string) {
  const dir = mkdtempSync(join(tmpdir(), 'flowstate-live-boundary-'))
  const processFixture = join(dir, 'processes.txt')
  const responseFixture = join(dir, 'responses.json')
  writeFileSync(join(dir, 'local-api.json'), JSON.stringify({ enabled: true, port: 5577, token: 'redacted-token' }))
  writeFileSync(join(dir, 'store.json'), JSON.stringify({
    'flowstate-supabase-auth': { access_token: 'not-printed', refresh_token: 'not-printed', user: {} },
  }))
  writeFileSync(processFixture, processList)
  writeFileSync(responseFixture, JSON.stringify({
    health: { ok: true, status: 200, json: { ok: true } },
    diagnostics: { ok: true, status: 200, json: diagnostics },
    assistantContext: {
      ok: true,
      status: 200,
      json: {
        ok: true,
        taskPressure: { overdue: 0 },
        assistantMemory: { availability: { aiConversationSummaries: true } },
      },
    },
  }))
  return {
    FLOWSTATE_LOCAL_API_URL: 'http://127.0.0.1:5577',
    FLOWSTATE_USER_DATA_DIR: dir,
    FLOWSTATE_LOCAL_API_CONFIG: join(dir, 'local-api.json'),
    FLOWSTATE_STORE_PATH: join(dir, 'store.json'),
    FLOWSTATE_PROCESS_LIST_FIXTURE: processFixture,
    FLOWSTATE_LIVE_BOUNDARY_RESPONSE_FIXTURE: responseFixture,
  }
}

describe('live boundary diagnostics', () => {
  it('fails when the sidecar has auth but the renderer heartbeat says signed out', () => {
    const diagnostics = {
      appVersion: '1.4.239',
      hasAuthContext: true,
      rendererAuthState: {
        isAuthenticated: false,
        hasUser: false,
        canSyncRemotely: false,
        reauthRequired: false,
        isInitialized: true,
        ageMs: 100,
      },
      hasLocalTimerSnapshot: true,
      localSnapshotActive: false,
      localSnapshotAgeMs: 100,
      currentTimerBranch: 'local-snapshot-inactive-fresh',
      supabaseActiveSessionFound: false,
    }

    try {
      runBoundary(fixtureEnv(diagnostics, '123 1 /home/endlessblink/.local/bin/FlowState.AppImage --user-data-dir=/tmp/foo'))
      throw new Error('expected command to fail')
    } catch (error) {
      const output = String((error as { stdout?: Buffer | string }).stdout || '')
      expect(output).toContain('renderer-signed-out-while-sidecar-authenticated')
      expect(output).not.toContain('redacted-token')
      expect(output).not.toContain('not-printed')
    }
  })

  it('fails when the live KDE timer snapshot is missing while the app is running', () => {
    const diagnostics = {
      appVersion: '1.4.239',
      hasAuthContext: true,
      rendererAuthState: {
        isAuthenticated: true,
        hasUser: true,
        canSyncRemotely: true,
        reauthRequired: false,
        isInitialized: true,
        ageMs: 100,
      },
      hasLocalTimerSnapshot: false,
      localSnapshotActive: false,
      localSnapshotAgeMs: null,
      currentTimerBranch: 'supabase-inactive',
      supabaseActiveSessionFound: false,
    }

    try {
      runBoundary(fixtureEnv(diagnostics, '123 1 /home/endlessblink/.local/bin/FlowState.AppImage'))
      throw new Error('expected command to fail')
    } catch (error) {
      const output = String((error as { stdout?: Buffer | string }).stdout || '')
      expect(output).toContain('missing-renderer-timer-snapshot')
    }
  })

  it('passes when renderer auth and timer heartbeats are fresh', () => {
    const diagnostics = {
      appVersion: '1.4.239',
      hasAuthContext: true,
      rendererAuthState: {
        isAuthenticated: true,
        hasUser: true,
        canSyncRemotely: true,
        reauthRequired: false,
        isInitialized: true,
        ageMs: 100,
      },
      hasLocalTimerSnapshot: true,
      localSnapshotActive: true,
      localSnapshotAgeMs: 100,
      currentTimerBranch: 'local-snapshot-active',
      supabaseActiveSessionFound: true,
    }

    const output = runBoundary(fixtureEnv(diagnostics, '123 1 /home/endlessblink/.local/bin/FlowState.AppImage'))
    const report = JSON.parse(output)
    expect(report.ok).toBe(true)
    expect(report.failures).toEqual([])
  })

  it('counts the packaged lowercase flowstate process as the running Electron app', () => {
    const diagnostics = {
      appVersion: '1.4.239',
      hasAuthContext: true,
      rendererAuthState: {
        isAuthenticated: true,
        hasUser: true,
        canSyncRemotely: true,
        reauthRequired: false,
        isInitialized: true,
        ageMs: 100,
      },
      hasLocalTimerSnapshot: true,
      localSnapshotActive: true,
      localSnapshotAgeMs: 100,
      currentTimerBranch: 'local-snapshot-active',
      supabaseActiveSessionFound: true,
    }

    const output = runBoundary(fixtureEnv(diagnostics, '3932158 3931658 /tmp/.mount_fs/flowstate --type=utility'))
    const report = JSON.parse(output)
    expect(report.processes.flowStateProcessCount).toBe(1)
    expect(report.skipped).toBe(false)
  })
})
