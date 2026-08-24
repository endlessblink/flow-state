#!/usr/bin/env node
'use strict'

const fs = require('fs')
const http = require('http')
const { execFileSync } = require('child_process')
const { join } = require('path')

const DEFAULT_USER_DATA_DIR = '/home/endlessblink/.config/flow-state'
const USER_DATA_DIR = process.env.FLOWSTATE_USER_DATA_DIR || DEFAULT_USER_DATA_DIR
const CONFIG_PATH = process.env.FLOWSTATE_LOCAL_API_CONFIG || join(USER_DATA_DIR, 'local-api.json')
const STORE_PATH = process.env.FLOWSTATE_STORE_PATH || join(USER_DATA_DIR, 'store.json')
const LOCAL_API = process.env.FLOWSTATE_LOCAL_API_URL || 'http://127.0.0.1:5577'
const PROCESS_FIXTURE = process.env.FLOWSTATE_PROCESS_LIST_FIXTURE || ''
const RESPONSE_FIXTURE = process.env.FLOWSTATE_LIVE_BOUNDARY_RESPONSE_FIXTURE || ''
const TIMER_ACTIVE_STALE_MS = Number(process.env.FLOWSTATE_LIVE_TIMER_ACTIVE_STALE_MS || 30_000)

function readJson(path) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(path, 'utf8')) }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

function readLocalApiConfig() {
  const result = readJson(CONFIG_PATH)
  if (!result.ok) return { exists: fs.existsSync(CONFIG_PATH), readable: false, error: result.error }
  return {
    exists: true,
    readable: true,
    enabled: !!result.data.enabled,
    port: Number(result.data.port) || null,
    tokenPresent: typeof result.data.token === 'string' && result.data.token.length > 0,
    tokenLength: typeof result.data.token === 'string' ? result.data.token.length : 0,
    token: typeof result.data.token === 'string' ? result.data.token : '',
  }
}

function readStoreSummary() {
  const result = readJson(STORE_PATH)
  if (!result.ok) return { exists: fs.existsSync(STORE_PATH), readable: false }
  const data = result.data && typeof result.data === 'object' ? result.data : {}
  const keys = Object.keys(data)
  const authKeys = keys.filter((key) => /auth/i.test(key)).sort()
  // BUG-1933: a null primary key alongside a populated backup is the "signed in on screen, signed
  // out on disk" state — the sidecar and the next launch both see nothing.
  const primaryAuthNull = 'flowstate-supabase-auth' in data && data['flowstate-supabase-auth'] === null
  const backupPresent = !!data['flowstate-supabase-auth-backup-v1']
  return {
    exists: true,
    readable: true,
    keyCount: keys.length,
    authKeyCount: authKeys.length,
    primaryAuthNull,
    backupPresent,
    hasAuthMaterial: JSON.stringify(data).includes('access_token') || JSON.stringify(data).includes('refresh_token'),
    hasUserLikeValue: JSON.stringify(data).includes('"user"') || JSON.stringify(data).includes('user_metadata'),
    authKeys,
  }
}

function processList() {
  try {
    if (PROCESS_FIXTURE) return fs.readFileSync(PROCESS_FIXTURE, 'utf8')
    return execFileSync('ps', ['-eo', 'pid,ppid,cmd'], { encoding: 'utf8' })
  } catch {
    return ''
  }
}

function processSummary(raw) {
  const lines = String(raw || '')
    .split('\n')
    .filter((line) => /FlowState|flow-state|\/flowstate(?:\s|$)|flowstate-local-api|local-api-server/i.test(line))
  const flowStateLines = lines.filter((line) =>
    !/flowstate-local-api|local-api-server/i.test(line) &&
    /(?:^|\/)(?:flowstate|flowstate\.appimage|flow-state)(?:\s|$)/i.test(line),
  )
  // BUG-1932: Electron derives userData from $HOME, so a launcher that rewrites HOME (agent
  // sandbox, systemd unit, container) runs against a pristine, empty profile — a phantom sign-out —
  // and binds the Local API port with a token no other client can read. Only some process lines
  // carry --user-data-dir (the main AppImage line does not), so compare only the ones that do
  // rather than requiring every line to mention the real profile.
  const userDataDirs = []
  for (const line of flowStateLines) {
    const match = /--user-data-dir=(\S+)/.exec(line)
    if (match) userDataDirs.push(match[1])
  }
  const foreignUserDataDirs = [...new Set(userDataDirs.filter((dir) => dir !== USER_DATA_DIR))]

  return {
    flowStateProcessCount: flowStateLines.length,
    localApiProcessCount: lines.filter((line) => /flowstate-local-api|local-api-server/i.test(line)).length,
    usesRealUserData: flowStateLines.some((line) => line.includes(USER_DATA_DIR)),
    foreignUserDataDirs,
  }
}

function getJson(pathname, token, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const url = new URL(pathname, LOCAL_API)
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const req = http.get(url, { timeout: timeoutMs, headers }, (res) => {
      let raw = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        raw += chunk
      })
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: JSON.parse(raw) })
        } catch {
          resolve({ ok: false, status: res.statusCode, json: null })
        }
      })
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', (error) => resolve({ ok: false, status: null, error: error.message, json: null }))
  })
}

function readResponseFixture() {
  if (!RESPONSE_FIXTURE) return null
  const result = readJson(RESPONSE_FIXTURE)
  if (!result.ok || !result.data || typeof result.data !== 'object') return null
  return result.data
}

function evaluate({ config, processes, health, diagnostics, assistantContext, store }) {
  const failures = []
  const warnings = []

  if (processes.flowStateProcessCount === 0) {
    return { skipped: true, failures, warnings: ['FlowState desktop app is not running; live boundary probe skipped.'] }
  }

  // BUG-1932: a FlowState process pointed at a profile that isn't the real one. It will show a
  // Sign In screen no matter how healthy auth is, and it fights for port 5577 with a token no
  // other client can read.
  if (processes.foreignUserDataDirs && processes.foreignUserDataDirs.length > 0) {
    failures.push(`foreign-profile-instance:${processes.foreignUserDataDirs.join(',')}`)
  }

  // BUG-1933: signed in on screen, signed out on disk.
  if (store && store.readable && store.primaryAuthNull && store.backupPresent) {
    failures.push('auth-primary-null-with-backup')
  }

  if (!config.exists || !config.readable) {
    failures.push('local-api-config-unreadable')
    return { skipped: false, failures, warnings }
  }
  if (!config.enabled) {
    warnings.push('local-api-disabled')
    return { skipped: true, failures, warnings }
  }
  if (!config.tokenPresent) failures.push('local-api-token-missing')
  if (!health.ok) failures.push(`local-api-health-unavailable:${health.status || health.error || 'unknown'}`)
  if (!diagnostics.ok) {
    failures.push(`timer-diagnostics-unavailable:${diagnostics.status || diagnostics.error || 'unknown'}`)
    return { skipped: false, failures, warnings }
  }

  const body = diagnostics.json || {}
  const rendererAuth = body.rendererAuthState
  if (body.hasAuthContext && !rendererAuth) {
    failures.push('missing-renderer-auth-heartbeat')
  }
  if (body.hasAuthContext && rendererAuth && rendererAuth.isInitialized && (!rendererAuth.isAuthenticated || !rendererAuth.hasUser)) {
    failures.push('renderer-signed-out-while-sidecar-authenticated')
  }
  // Distinguish an actual renderer -> sidecar delivery failure from the cached signed-in shell.
  // The shell intentionally survives a failed refresh for offline work, but it has no usable JWT
  // to forward. Once grace expires the actionable fault is re-authentication, not a blind sidecar.
  if (!body.hasAuthContext && rendererAuth && rendererAuth.isInitialized && rendererAuth.isAuthenticated && rendererAuth.hasUser) {
    if (rendererAuth.reauthRequired) {
      failures.push('renderer-reauth-required')
    } else if (rendererAuth.canSyncRemotely) {
      failures.push('sidecar-blind-while-renderer-signed-in')
    } else {
      warnings.push('renderer-auth-refresh-pending')
    }
  }
  if (rendererAuth && rendererAuth.ageMs > 60_000) {
    failures.push('stale-renderer-auth-heartbeat')
  }

  if (!body.hasLocalTimerSnapshot) {
    failures.push('missing-renderer-timer-snapshot')
  }
  if (body.currentTimerBranch === 'local-snapshot-inactive-stale') {
    failures.push('stale-inactive-timer-snapshot')
  }
  if (body.localSnapshotActive && typeof body.localSnapshotAgeMs === 'number' && body.localSnapshotAgeMs > TIMER_ACTIVE_STALE_MS) {
    failures.push('stale-active-timer-snapshot')
  }
  if (!assistantContext.ok && assistantContext.status !== 404) {
    warnings.push(`assistant-context-unavailable:${assistantContext.status || assistantContext.error || 'unknown'}`)
  }

  return { skipped: false, failures, warnings }
}

async function main() {
  const config = readLocalApiConfig()
  const store = readStoreSummary()
  const processes = processSummary(processList())
  const token = config.token || ''
  const fixture = readResponseFixture()
  const health = fixture?.health || await getJson('/api/health', '')
  const diagnostics = fixture?.diagnostics || await getJson('/api/timer/diagnostics', token)
  const assistantContext = fixture?.assistantContext || await getJson('/api/assistant/context', token)
  delete config.token

  const result = evaluate({ config, processes, health, diagnostics, assistantContext, store })
  const safeDiagnostics = diagnostics.json
    ? {
        status: diagnostics.status,
        appVersion: diagnostics.json.appVersion,
        hasAuthContext: diagnostics.json.hasAuthContext,
        rendererAuthState: diagnostics.json.rendererAuthState,
        hasLocalTimerSnapshot: diagnostics.json.hasLocalTimerSnapshot,
        localSnapshotActive: diagnostics.json.localSnapshotActive,
        localSnapshotAgeMs: diagnostics.json.localSnapshotAgeMs,
        currentTimerBranch: diagnostics.json.currentTimerBranch,
        supabaseActiveSessionFound: diagnostics.json.supabaseActiveSessionFound,
      }
    : { status: diagnostics.status, error: diagnostics.error || null }

  const report = {
    ok: result.failures.length === 0,
    skipped: result.skipped,
    capturedAt: new Date().toISOString(),
    localApiConfig: config,
    store,
    processes,
    health: { ok: health.ok, status: health.status || null },
    timerDiagnostics: safeDiagnostics,
    assistantContext: {
      ok: assistantContext.ok,
      status: assistantContext.status || null,
      hasTaskPressure: !!assistantContext.json?.taskPressure,
      assistantMemoryAvailability: assistantContext.json?.assistantMemory?.availability || null,
    },
    failures: result.failures,
    warnings: result.warnings,
  }

  console.log(JSON.stringify(report, null, 2))
  if (!report.ok) process.exit(1)
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error)
  process.exit(1)
})
