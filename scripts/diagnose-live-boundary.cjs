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
  return {
    exists: true,
    readable: true,
    keyCount: keys.length,
    authKeyCount: authKeys.length,
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
    .filter((line) => /FlowState|flow-state|flowstate-local-api|local-api-server/i.test(line))
  return {
    flowStateProcessCount: lines.filter((line) => /FlowState|flow-state/i.test(line)).length,
    localApiProcessCount: lines.filter((line) => /flowstate-local-api|local-api-server/i.test(line)).length,
    usesRealUserData: lines.some((line) => line.includes(USER_DATA_DIR)),
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

function evaluate({ config, processes, health, diagnostics, assistantContext }) {
  const failures = []
  const warnings = []

  if (processes.flowStateProcessCount === 0) {
    return { skipped: true, failures, warnings: ['FlowState desktop app is not running; live boundary probe skipped.'] }
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

  const result = evaluate({ config, processes, health, diagnostics, assistantContext })
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
