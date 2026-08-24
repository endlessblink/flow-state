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

/**
 * `%DIR%` in processList is replaced with the fixture's real userData dir, so a test only exercises
 * the BUG-1932 foreign-profile check when it deliberately names some other directory.
 */
function fixtureEnv(
  diagnostics: Record<string, unknown>,
  processList: string,
  store?: Record<string, unknown>,
) {
  const dir = mkdtempSync(join(tmpdir(), 'flowstate-live-boundary-'))
  const processFixture = join(dir, 'processes.txt')
  const responseFixture = join(dir, 'responses.json')
  writeFileSync(join(dir, 'local-api.json'), JSON.stringify({ enabled: true, port: 5577, token: 'redacted-token' }))
  writeFileSync(join(dir, 'store.json'), JSON.stringify(store ?? {
    'flowstate-supabase-auth': { access_token: 'not-printed', refresh_token: 'not-printed', user: {} },
  }))
  writeFileSync(processFixture, processList.replaceAll('%DIR%', dir))
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
      runBoundary(fixtureEnv(diagnostics, '123 1 /home/endlessblink/.local/bin/FlowState.AppImage --user-data-dir=%DIR%'))
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

  // ── BUG-1932 / BUG-1933 watchdog coverage ──────────────────────────────────

  const healthyDiagnostics = {
    appVersion: '1.4.241',
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

  it('BUG-1932: fails when a process runs against a foreign profile (HOME hijack)', () => {
    // The literal shape of the real incident: the Hermes agent sandbox nests its profile inside
    // the real home, so a naive prefix check would call this legitimate.
    const hermes = '/home/endlessblink/.hermes/profiles/office-work/home/.config/flow-state'
    try {
      runBoundary(fixtureEnv(healthyDiagnostics, `123 1 /tmp/.mount_x/flowstate --type=renderer --user-data-dir=${hermes}`))
      throw new Error('expected command to fail')
    } catch (error) {
      const output = String((error as { stdout?: Buffer | string }).stdout || '')
      expect(output).toContain('foreign-profile-instance')
      expect(output).toContain(hermes)
    }
  })

  it('BUG-1932: passes when every --user-data-dir names the real profile', () => {
    const output = runBoundary(
      fixtureEnv(healthyDiagnostics, '123 1 /tmp/.mount_x/flowstate --type=renderer --user-data-dir=%DIR%')
    )
    expect(JSON.parse(output).failures).toEqual([])
  })

  it('fails closed when separate Electron artifact roots are running together', () => {
    const processList = [
      '123 1 /tmp/.mount_flowstate427/FlowState.AppImage --app-path=/tmp/.mount_flowstate427/resources/app.asar --user-data-dir=%DIR%',
      '456 123 /tmp/.mount_flowstate429/flowstate --type=renderer --app-path=/tmp/.mount_flowstate429/resources/app.asar --user-data-dir=%DIR%',
    ].join('\n')
    let output = ''
    try {
      runBoundary(fixtureEnv(healthyDiagnostics, processList))
      throw new Error('expected command to fail')
    } catch (error) {
      output = String((error as { stdout?: Buffer | string }).stdout || '')
    }
    const report = JSON.parse(output)
    expect(report.processes.runtimeSources).toEqual([
      '/tmp/.mount_flowstate427/resources/app.asar',
      '/tmp/.mount_flowstate429/resources/app.asar',
    ])
    expect(report.failures).toContain(
      'competing-runtime-sources:/tmp/.mount_flowstate427/resources/app.asar,/tmp/.mount_flowstate429/resources/app.asar',
    )
  })

  it('BUG-1933: fails when the primary auth key is null but a backup exists', () => {
    // Signed in on screen, signed out on disk — the sidecar and the next launch both see nothing.
    const store = {
      'flowstate-supabase-auth': null,
      'flowstate-supabase-auth-backup-v1': JSON.stringify({ savedAt: 1, session: { refresh_token: 'not-printed' } }),
    }
    try {
      runBoundary(fixtureEnv(healthyDiagnostics, '123 1 /tmp/.mount_x/flowstate', store))
      throw new Error('expected command to fail')
    } catch (error) {
      const output = String((error as { stdout?: Buffer | string }).stdout || '')
      expect(output).toContain('auth-primary-null-with-backup')
      expect(output).not.toContain('not-printed')
    }
  })

  it('BUG-1933: fails when the renderer is signed in but the sidecar has no auth context', () => {
    const diagnostics = { ...healthyDiagnostics, hasAuthContext: false }
    try {
      runBoundary(fixtureEnv(diagnostics, '123 1 /tmp/.mount_x/flowstate'))
      throw new Error('expected command to fail')
    } catch (error) {
      const output = String((error as { stdout?: Buffer | string }).stdout || '')
      expect(output).toContain('sidecar-blind-while-renderer-signed-in')
    }
  })

  it('classifies an expired signed-in shell as re-auth required, not a blind sidecar', () => {
    const diagnostics = {
      ...healthyDiagnostics,
      hasAuthContext: false,
      rendererAuthState: {
        ...healthyDiagnostics.rendererAuthState,
        canSyncRemotely: false,
        reauthRequired: true,
      },
    }
    try {
      runBoundary(fixtureEnv(diagnostics, '123 1 /tmp/.mount_x/flowstate'))
      throw new Error('expected command to fail')
    } catch (error) {
      const output = String((error as { stdout?: Buffer | string }).stdout || '')
      expect(output).toContain('renderer-reauth-required')
      expect(output).not.toContain('sidecar-blind-while-renderer-signed-in')
    }
  })

  it('classifies reconnect grace as a warning while the sidecar waits for fresh auth', () => {
    const diagnostics = {
      ...healthyDiagnostics,
      hasAuthContext: false,
      rendererAuthState: {
        ...healthyDiagnostics.rendererAuthState,
        canSyncRemotely: false,
        reauthRequired: false,
      },
    }
    const output = runBoundary(
      fixtureEnv(diagnostics, '123 1 /tmp/.mount_x/flowstate'),
    )
    const report = JSON.parse(output)
    expect(report.ok).toBe(true)
    expect(report.failures).not.toContain('sidecar-blind-while-renderer-signed-in')
    expect(report.warnings).toContain('renderer-auth-refresh-pending')
  })

  it('BUG-1933: a signed-out renderer with no sidecar context is not a failure', () => {
    const diagnostics = {
      ...healthyDiagnostics,
      hasAuthContext: false,
      rendererAuthState: { ...healthyDiagnostics.rendererAuthState, isAuthenticated: false, hasUser: false, canSyncRemotely: false },
    }
    const output = runBoundary(fixtureEnv(diagnostics, '123 1 /tmp/.mount_x/flowstate'))
    expect(JSON.parse(output).failures).toEqual([])
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

  it('skips the live probe when only the regression runner mentions FlowState', () => {
    const output = runBoundary(
      fixtureEnv(healthyDiagnostics, '4152844 1598 /home/endlessblink/.local/share/flowstate/run-daily-regression-hunt-clean.sh --notify'),
    )
    const report = JSON.parse(output)

    expect(report.processes.flowStateProcessCount).toBe(0)
    expect(report.skipped).toBe(true)
    expect(report.failures).toEqual([])
    expect(report.warnings).toContain('FlowState desktop app is not running; live boundary probe skipped.')
  })

  it('does not count the diagnostic wrapper itself as a running desktop app', () => {
    const output = runBoundary(
      fixtureEnv(healthyDiagnostics, '/bin/sh -c /home/endlessblink/.cargo/bin/lean-ctx -c node scripts/diagnose-live-boundary.cjs'),
    )
    const report = JSON.parse(output)
    expect(report.processes.flowStateProcessCount).toBe(0)
    expect(report.skipped).toBe(true)
    expect(report.failures).toEqual([])
  })
})
