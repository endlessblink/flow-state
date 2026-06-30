import { ipcMain, app, utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { randomBytes } from 'crypto'

/**
 * Local Task API (TASK-1797) — Electron side.
 *
 * Spawns the bundled sidecar (`dist-electron/local-api-server.cjs`) as a
 * utilityProcess in TOKEN mode and forwards the logged-in user's Supabase
 * session to it. The sidecar uses the anon key + that user's JWT, so every
 * query is RLS-scoped — no service-role key is ever shipped.
 *
 * Task mutation/read endpoints stay off by default; the sidecar still starts
 * when Electron has a signed-in session so the KDE widget can read the active
 * timer over localhost without waiting for cloud realtime.
 */

const DEFAULT_PORT = 5577

interface SessionMessage {
  supabaseUrl: string
  anonKey: string
  accessToken: string
  refreshToken: string
  userId: string
}

interface TimerSnapshotMessage {
  active: boolean
  updatedAt: number
  session: Record<string, unknown> | null
}

interface LocalApiConfig {
  enabled: boolean
  token: string
  port: number
}

const configPath = () => join(app.getPath('userData'), 'local-api.json')

function loadConfig(): LocalApiConfig {
  try {
    if (existsSync(configPath())) {
      const raw = JSON.parse(readFileSync(configPath(), 'utf-8'))
      return {
        enabled: !!raw.enabled,
        token: typeof raw.token === 'string' && raw.token ? raw.token : randomBytes(24).toString('hex'),
        port: Number(raw.port) || DEFAULT_PORT,
      }
    }
  } catch {
    /* fall through to defaults */
  }
  return { enabled: false, token: randomBytes(24).toString('hex'), port: DEFAULT_PORT }
}

function saveConfig(cfg: LocalApiConfig) {
  try {
    const dir = join(configPath(), '..')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf-8')
  } catch (e) {
    console.error('[local-api] failed to persist config:', e)
  }
}

let config: LocalApiConfig = { enabled: false, token: '', port: DEFAULT_PORT }
let child: UtilityProcess | null = null
let listening = false
// Latest session pushed from the renderer; re-sent whenever the child (re)starts.
let latestSession: SessionMessage | null = null
let latestTimerSnapshot: TimerSnapshotMessage | null = null

function sidecarPath() {
  // localApi.cjs lives in dist-electron/ipc/, while the bundled sidecar is
  // emitted next to main.cjs in dist-electron/.
  return join(__dirname, '..', 'local-api-server.cjs')
}

function startChild() {
  if (child) return
  const path = sidecarPath()
  if (!existsSync(path)) {
    console.error(`[local-api] sidecar bundle missing at ${path} — run electron:build-main`)
    return
  }
  listening = false
  child = utilityProcess.fork(path, [], {
    serviceName: 'flowstate-local-api',
    stdio: 'inherit',
    env: {
      ...process.env,
      FLOW_STATE_API_MODE: 'token',
      FLOW_STATE_API_TOKEN: config.token,
      FLOW_STATE_API_PORT: String(config.port),
      FLOW_STATE_API_DATA_DIR: app.getPath('userData'),
      FLOW_STATE_APP_VERSION: app.getVersion(),
    },
  })

  child.on('message', (msg: unknown) => {
    const m = msg as { type?: string; port?: number }
    if (m && m.type === 'listening') {
      listening = true
      // Forward the current session once the server is up.
      if (latestSession) child?.postMessage({ type: 'session', ...latestSession })
      if (latestTimerSnapshot) child?.postMessage({ type: 'timerSnapshot', snapshot: latestTimerSnapshot })
    }
  })

  child.on('exit', () => {
    child = null
    listening = false
  })
}

function stopChild() {
  if (!child) return
  try {
    child.kill()
  } catch {
    /* ignore */
  }
  child = null
  listening = false
}

function pushSession() {
  if (!child || !latestSession) return
  // If the server has signalled 'listening' we can post immediately; otherwise
  // the 'listening' handler will flush it.
  if (listening) child.postMessage({ type: 'session', ...latestSession })
}

function pushTimerSnapshot() {
  if (!child || !latestTimerSnapshot) return
  if (listening) child.postMessage({ type: 'timerSnapshot', snapshot: latestTimerSnapshot })
}

export function registerLocalApiHandlers() {
  config = loadConfig()
  // Persist (ensures a token exists on first run).
  saveConfig(config)

  ipcMain.handle('localApi:setSession', (_e, session: SessionMessage) => {
    if (!session || !session.accessToken || !session.userId) return { ok: false }
    latestSession = session
    startChild()
    pushSession()
    return { ok: true }
  })

  ipcMain.handle('localApi:clearSession', () => {
    latestSession = null
    if (child && listening) child.postMessage({ type: 'clear' })
    if (!config.enabled && !latestTimerSnapshot) stopChild()
    return { ok: true }
  })

  ipcMain.handle('localApi:setTimerSnapshot', (_e, snapshot: TimerSnapshotMessage) => {
    if (!snapshot || typeof snapshot.active !== 'boolean') return { ok: false }
    latestTimerSnapshot = snapshot
    startChild()
    pushTimerSnapshot()
    return { ok: true }
  })

  ipcMain.handle('localApi:setEnabled', (_e, enabled: boolean) => {
    config.enabled = !!enabled
    saveConfig(config)
    if (config.enabled) {
      startChild()
      pushSession()
    } else if (!latestSession && !latestTimerSnapshot) {
      stopChild()
    }
    return { ok: true, enabled: config.enabled }
  })

  ipcMain.handle('localApi:getToken', () => config.token)

  ipcMain.handle('localApi:status', () => ({
    enabled: config.enabled,
    running: config.enabled && !!child,
    listening: config.enabled && listening,
    childRunning: !!child,
    childPid: child?.pid ?? null,
    appVersion: app.getVersion(),
    hasLatestSession: !!latestSession,
    hasLatestTimerSnapshot: !!latestTimerSnapshot,
    latestTimerSnapshotActive: !!(latestTimerSnapshot?.active && latestTimerSnapshot.session),
    latestTimerSnapshotAgeMs: latestTimerSnapshot?.updatedAt
      ? Math.max(0, Date.now() - latestTimerSnapshot.updatedAt)
      : null,
    port: config.port,
  }))
}

/** Called from main on quit to tear down the sidecar. */
export function shutdownLocalApi() {
  stopChild()
}
