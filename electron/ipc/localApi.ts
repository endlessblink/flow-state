import { ipcMain, app, BrowserWindow, utilityProcess, type UtilityProcess } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs'
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
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
    chmodSync(dir, 0o700)
    writeFileSync(configPath(), JSON.stringify(cfg, null, 2), { encoding: 'utf-8', mode: 0o600 })
    chmodSync(configPath(), 0o600)
  } catch (e) {
    console.error('[local-api] failed to persist config:', e)
  }
}

let config: LocalApiConfig = { enabled: false, token: '', port: DEFAULT_PORT }
let child: UtilityProcess | null = null
let listening = false
let desiredRunning = false
let finalShutdownRequested = false
let childGeneration = 0
let lifecyclePromise: Promise<void> | null = null
let reconcileRequested = false
let restartTimer: ReturnType<typeof setTimeout> | null = null
let restartAttempt = 0
const RESTART_BACKOFF_MS = [100, 500, 1_000, 2_000, 5_000] as const
const FINAL_SHUTDOWN_EXIT_TIMEOUT_MS = 5_000

interface ActiveChild {
  process: UtilityProcess
  generation: number
  exitPromise: Promise<void>
  killRequested: boolean
}

let activeChild: ActiveChild | null = null
// Latest session pushed from the renderer; re-sent whenever the child (re)starts.
let latestSession: SessionMessage | null = null
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

function spawnChild() {
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
    scheduleRestart()
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
    scheduleRestart()
    return
  }

  const startedChild = child
  const generation = ++childGeneration
  let resolveExit!: () => void
  const exitPromise = new Promise<void>((resolve) => {
    resolveExit = resolve
  })
  activeChild = {
    process: startedChild,
    generation,
    exitPromise,
    killRequested: false,
  }
  logLifecycle('fork-returned', { childPid: startedChild.pid, generation })

  startedChild.on('spawn', () => {
    logLifecycle('spawn', { childPid: startedChild.pid, generation })
  })

  startedChild.on('message', (msg: unknown) => {
    if (activeChild?.process !== startedChild || activeChild.generation !== generation) return
    const m = msg as {
      type?: string
      port?: number
      operation?: string
      taskId?: string
      session?: Record<string, unknown>
      accessToken?: string
      refreshToken?: string
      userId?: string
    }
    lastChildMessageType = typeof m?.type === 'string' ? m.type : 'unknown'
    lastChildMessageAt = Date.now()
    logLifecycle('message', { messageType: lastChildMessageType })
    if (m && m.type === 'listening') {
      listening = true
      restartAttempt = 0
      // Forward the current session once the server is up.
      if (latestSession) startedChild.postMessage({ type: 'session', ...latestSession })
      if (latestTimerSnapshot) startedChild.postMessage({ type: 'timerSnapshot', snapshot: latestTimerSnapshot })
      if (latestRendererAuthState) startedChild.postMessage({ type: 'rendererAuthState', state: latestRendererAuthState })
      if (latestWorkspaceContext) startedChild.postMessage({ type: 'workspaceContext', ...latestWorkspaceContext })
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
    } else if (m?.type === 'timerMutation' && m.session && typeof m.session === 'object') {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('localApi:timerMutation', m.session)
      }
    } else if (
      m?.type === 'sessionRefresh'
      && latestSession
      && m.userId === latestSession.userId
      && typeof m.accessToken === 'string'
      && m.accessToken
      && typeof m.refreshToken === 'string'
      && m.refreshToken
    ) {
      latestSession = {
        ...latestSession,
        accessToken: m.accessToken,
        refreshToken: m.refreshToken,
      }
    }
  })

  startedChild.on('error', (error) => {
    lastChildError = { message: safeErrorMessage(error), at: Date.now() }
    logLifecycle('error', { error: lastChildError.message })
  })

  startedChild.on('exit', (code) => {
    lastChildExit = {
      code: typeof code === 'number' ? code : null,
      signal: null,
      at: Date.now(),
    }
    const current = activeChild?.process === startedChild && activeChild.generation === generation
    const intentionallyStopped = current && activeChild?.killRequested
    logLifecycle(current ? 'exit' : 'stale-exit', { ...lastChildExit, generation })
    resolveExit()
    if (!current) return
    activeChild = null
    child = null
    listening = false
    if (!intentionallyStopped && desiredRunning && !finalShutdownRequested) scheduleRestart()
  })
}

function scheduleRestart() {
  if (restartTimer || finalShutdownRequested || !desiredRunning) return
  const delay = RESTART_BACKOFF_MS[Math.min(restartAttempt, RESTART_BACKOFF_MS.length - 1)]
  restartAttempt += 1
  logLifecycle('restart-scheduled', { delay, restartAttempt })
  restartTimer = setTimeout(() => {
    restartTimer = null
    void queueReconcile()
  }, delay)
}

function waitForExitOrTimeout(current: ActiveChild, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (exited: boolean) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(exited)
    }
    const timeout = setTimeout(() => finish(false), timeoutMs)
    void current.exitPromise.then(() => finish(true))
  })
}

async function reconcileChildLifecycle() {
  do {
    reconcileRequested = false
    const current = activeChild
    if (finalShutdownRequested || !desiredRunning) {
      if (current) {
        if (!current.killRequested) {
          current.killRequested = true
          try {
            current.process.kill()
          } catch {
            /* wait for the process exit event if kill raced with termination */
          }
        }
        if (finalShutdownRequested) {
          const exited = await waitForExitOrTimeout(current, FINAL_SHUTDOWN_EXIT_TIMEOUT_MS)
          if (!exited && activeChild === current) {
            logLifecycle('final-exit-timeout', {
              generation: current.generation,
              timeoutMs: FINAL_SHUTDOWN_EXIT_TIMEOUT_MS,
            })
            throw new Error(
              `Local API child generation ${current.generation} did not exit within ${FINAL_SHUTDOWN_EXIT_TIMEOUT_MS}ms`,
            )
          }
        } else {
          await current.exitPromise
        }
      }
    } else if (!current) {
      spawnChild()
    }
  } while (reconcileRequested)
}

function queueReconcile(): Promise<void> {
  reconcileRequested = true
  if (lifecyclePromise) return lifecyclePromise

  const run = reconcileChildLifecycle()
  lifecyclePromise = run
  const finishRun = () => {
    if (lifecyclePromise !== run) return
    lifecyclePromise = null
    if (reconcileRequested) void queueReconcile()
  }
  void run.then(finishRun, finishRun)
  return run
}

function startChild() {
  if (finalShutdownRequested) {
    logLifecycle('start-skipped-final-shutdown')
    return
  }
  desiredRunning = true
  if (restartTimer) return
  void queueReconcile()
}

function stopChild() {
  desiredRunning = false
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  void queueReconcile()
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

/** Called from main on quit to tear down the sidecar and permanently suppress restarts. */
export async function shutdownLocalApi(): Promise<void> {
  finalShutdownRequested = true
  desiredRunning = false
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  do {
    await queueReconcile()
    // A request can arrive after a synchronous reconcile has returned but before
    // its promise-finally clears the serialized lifecycle slot. Loop until the
    // final stop has observed and reaped the active generation.
    await Promise.resolve()
  } while (activeChild || lifecyclePromise || reconcileRequested)
}
