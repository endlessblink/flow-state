import { ipcMain, app, BrowserWindow, utilityProcess, type UtilityProcess } from 'electron'
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
const SESSION_APPLY_TIMEOUT_MS = 5_000

interface SessionMessage {
  supabaseUrl: string
  anonKey: string
  accessToken: string
  refreshToken: string
  userId: string
}

interface SessionDeliveryMessage extends SessionMessage {
  generation: number
}

interface SessionDeliveryResult {
  ok: boolean
  code?: 'superseded' | 'session_apply_timeout' | 'sidecar_stopped'
  generation: number
  userId?: string
}

interface TimerSnapshotMessage {
  active: boolean
  updatedAt: number
  session: Record<string, unknown> | null
}

interface RendererAuthStateMessage {
  isAuthenticated: boolean
  hasUser: boolean
  canSyncRemotely: boolean
  reauthRequired: boolean
  isInitialized: boolean
  updatedAt: number
}

interface WorkspaceContextMessage {
  activeWorkspaceId: string | null
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
let latestSession: SessionDeliveryMessage | null = null
let sessionGeneration = 0
const pendingSessionDeliveries = new Map<number, {
  userId: string
  timeout: ReturnType<typeof setTimeout>
  resolve: (result: SessionDeliveryResult) => void
}>()
let latestTimerSnapshot: TimerSnapshotMessage | null = null
let latestRendererAuthState: RendererAuthStateMessage | null = null
let latestWorkspaceContext: WorkspaceContextMessage | null = null
let lastStartAttemptAt: number | null = null
let lastSidecarPath: string | null = null
let sidecarPathExists = false
let lastChildExit: { code: number | null; signal: string | null; at: number } | null = null
let lastChildError: { message: string; at: number } | null = null
let lastChildMessageType: string | null = null
let lastChildMessageAt: number | null = null

function settleSessionDelivery(generation: number, result: SessionDeliveryResult) {
  const pending = pendingSessionDeliveries.get(generation)
  if (!pending) return
  clearTimeout(pending.timeout)
  pendingSessionDeliveries.delete(generation)
  pending.resolve(result)
}

function supersedePendingSessionDeliveries() {
  for (const generation of [...pendingSessionDeliveries.keys()]) {
    settleSessionDelivery(generation, { ok: false, code: 'superseded', generation })
  }
}

function waitForSessionApplied(generation: number, userId: string): Promise<SessionDeliveryResult> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      settleSessionDelivery(generation, {
        ok: false,
        code: 'session_apply_timeout',
        generation,
      })
    }, SESSION_APPLY_TIMEOUT_MS)
    pendingSessionDeliveries.set(generation, { userId, timeout, resolve })
  })
}

function sidecarPath() {
  // localApi.cjs lives in dist-electron/ipc/, while the bundled sidecar is
  // emitted next to main.cjs in dist-electron/.
  return join(__dirname, '..', 'local-api-server.cjs')
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return String(error || 'unknown error')
}

function logLifecycle(event: string, details: Record<string, unknown> = {}) {
  console.info('[local-api]', {
    event,
    enabled: config.enabled,
    port: config.port,
    listening,
    childPid: child?.pid ?? null,
    ...details,
  })
}

function startChild() {
  if (child) {
    logLifecycle('start-skipped-already-running')
    return
  }
  const path = sidecarPath()
  lastStartAttemptAt = Date.now()
  lastSidecarPath = path
  sidecarPathExists = existsSync(path)
  lastChildExit = null
  lastChildError = null
  lastChildMessageType = null
  lastChildMessageAt = null
  logLifecycle('start-attempt', { sidecarPath: path, sidecarPathExists })
  if (!sidecarPathExists) {
    const message = `sidecar bundle missing at ${path}`
    lastChildError = { message, at: Date.now() }
    console.error(`[local-api] ${message} — run electron:build-main`)
    return
  }
  listening = false
  try {
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
  } catch (error) {
    lastChildError = { message: safeErrorMessage(error), at: Date.now() }
    logLifecycle('fork-threw', { error: lastChildError.message })
    child = null
    listening = false
    return
  }

  const spawnedChild = child
  logLifecycle('fork-returned', { childPid: spawnedChild.pid })

  spawnedChild.on('spawn', () => {
    if (child !== spawnedChild) return
    logLifecycle('spawn', { childPid: spawnedChild.pid })
  })

  spawnedChild.on('message', (msg: unknown) => {
    if (child !== spawnedChild) return
    const m = msg as {
      type?: string
      port?: number
      operation?: string
      taskId?: string
      generation?: number
      userId?: string
    }
    lastChildMessageType = typeof m?.type === 'string' ? m.type : 'unknown'
    lastChildMessageAt = Date.now()
    logLifecycle('message', { messageType: lastChildMessageType })
    if (m && m.type === 'listening') {
      listening = true
      // Forward the current session once the server is up.
      if (latestSession) spawnedChild.postMessage({ type: 'session', ...latestSession })
      if (latestTimerSnapshot) spawnedChild.postMessage({ type: 'timerSnapshot', snapshot: latestTimerSnapshot })
      if (latestRendererAuthState) spawnedChild.postMessage({ type: 'rendererAuthState', state: latestRendererAuthState })
      if (latestWorkspaceContext) spawnedChild.postMessage({ type: 'workspaceContext', ...latestWorkspaceContext })
    } else if (m?.type === 'sessionApplied') {
      const generation = m.generation
      const pending = typeof generation === 'number'
        ? pendingSessionDeliveries.get(generation)
        : undefined
      if (
        pending
        && latestSession
        && generation === latestSession.generation
        && m.userId === latestSession.userId
        && m.userId === pending.userId
      ) {
        settleSessionDelivery(generation, {
          ok: true,
          generation,
          userId: m.userId,
        })
      }
    } else if (
      m?.type === 'taskMutation'
      && (m.operation === 'create' || m.operation === 'update' || m.operation === 'delete')
      && typeof m.taskId === 'string'
      && m.taskId
    ) {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('localApi:taskMutation', {
          operation: m.operation,
          taskId: m.taskId,
        })
      }
    }
  })

  spawnedChild.on('error', (error) => {
    if (child !== spawnedChild) return
    lastChildError = { message: safeErrorMessage(error), at: Date.now() }
    logLifecycle('error', { error: lastChildError.message })
  })

  spawnedChild.on('exit', () => {
    if (child !== spawnedChild) return
    lastChildExit = {
      code: null,
      signal: null,
      at: Date.now(),
    }
    logLifecycle('exit', lastChildExit)
    child = null
    listening = false
    for (const generation of [...pendingSessionDeliveries.keys()]) {
      settleSessionDelivery(generation, { ok: false, code: 'sidecar_stopped', generation })
    }
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

function pushRendererAuthState() {
  if (!child || !latestRendererAuthState) return
  if (listening) child.postMessage({ type: 'rendererAuthState', state: latestRendererAuthState })
}

function pushWorkspaceContext() {
  if (!child || !latestWorkspaceContext) return
  if (listening) child.postMessage({ type: 'workspaceContext', ...latestWorkspaceContext })
}

export function registerLocalApiHandlers() {
  config = loadConfig()
  // Persist (ensures a token exists on first run).
  saveConfig(config)

  ipcMain.handle('localApi:setSession', async (_e, session: SessionMessage) => {
    if (!session || !session.accessToken || !session.userId) return { ok: false }
    supersedePendingSessionDeliveries()
    const generation = ++sessionGeneration
    latestSession = { ...session, generation }
    const applied = waitForSessionApplied(generation, session.userId)
    startChild()
    pushSession()
    return await applied
  })

  ipcMain.handle('localApi:clearSession', () => {
    supersedePendingSessionDeliveries()
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

  ipcMain.handle('localApi:setRendererAuthState', (_e, state: RendererAuthStateMessage) => {
    if (!state || typeof state.isAuthenticated !== 'boolean' || typeof state.hasUser !== 'boolean') {
      return { ok: false }
    }
    latestRendererAuthState = {
      isAuthenticated: !!state.isAuthenticated,
      hasUser: !!state.hasUser,
      canSyncRemotely: !!state.canSyncRemotely,
      reauthRequired: !!state.reauthRequired,
      isInitialized: !!state.isInitialized,
      updatedAt: Number(state.updatedAt) || Date.now(),
    }
    if (config.enabled || child) {
      startChild()
      pushRendererAuthState()
    }
    return { ok: true }
  })

  ipcMain.handle('localApi:setWorkspaceContext', (_e, state: WorkspaceContextMessage) => {
    if (!state || (
      state.activeWorkspaceId !== null
      && (typeof state.activeWorkspaceId !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(state.activeWorkspaceId))
    )) {
      return { ok: false }
    }
    latestWorkspaceContext = { activeWorkspaceId: state.activeWorkspaceId }
    if (config.enabled || child) {
      startChild()
      pushWorkspaceContext()
    }
    return { ok: true }
  })

  ipcMain.handle('localApi:setEnabled', (_e, enabled: boolean) => {
    config.enabled = !!enabled
    saveConfig(config)
    logLifecycle('set-enabled', { requestedEnabled: !!enabled })
    if (config.enabled) {
      startChild()
      pushSession()
      pushRendererAuthState()
      pushWorkspaceContext()
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
    lastStartAttemptAt,
    lastSidecarPath,
    sidecarPathExists,
    lastChildExit,
    lastChildError,
    lastChildMessageType,
    lastChildMessageAt,
    hasLatestSession: !!latestSession,
    rendererAuthState: latestRendererAuthState
      ? {
          isAuthenticated: latestRendererAuthState.isAuthenticated,
          hasUser: latestRendererAuthState.hasUser,
          canSyncRemotely: latestRendererAuthState.canSyncRemotely,
          reauthRequired: latestRendererAuthState.reauthRequired,
          isInitialized: latestRendererAuthState.isInitialized,
          ageMs: Math.max(0, Date.now() - latestRendererAuthState.updatedAt),
        }
      : null,
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
  for (const generation of [...pendingSessionDeliveries.keys()]) {
    settleSessionDelivery(generation, { ok: false, code: 'sidecar_stopped', generation })
  }
  stopChild()
}
