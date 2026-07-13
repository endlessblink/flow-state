#!/usr/bin/env node
/**
 * FlowState local task API sidecar (TASK-1797)
 *
 * A tiny, localhost-only HTTP surface so another local app (Life OS Advisor)
 * can read FlowState tasks for context and create/update them on explicit
 * user approval. It also exposes a read-only active timer snapshot for the KDE
 * widget over loopback so desktop timer state is live even when cloud realtime
 * is delayed.
 *
 * Transport: Node's built-in `http` (no Express/Fastify). Reuses
 * `@supabase/supabase-js` (bundled by esbuild for the packaged app).
 *
 * Two auth modes:
 *   - service-role (standalone): `doppler run -- npm run api`. Uses
 *     SUPABASE_SERVICE_ROLE_KEY + FLOW_STATE_USER_ID from env. Your machine
 *     only — NEVER bundled into the shipped desktop app.
 *   - token (Electron utilityProcess): the spawning Electron main process posts
 *     the logged-in user's session over parentPort. Uses the anon key + the
 *     user's JWT, so every query is RLS-scoped to that user. No secret shipped.
 *
 * See server/local-api/README.md for the endpoint contract.
 */

'use strict'

const http = require('http')
const crypto = require('crypto')
const { mkdirSync } = require('fs')
const { join } = require('path')
const { createClient } = require('@supabase/supabase-js')
const { createAIMastraRuntime } = require('./ai-runtime.cjs')
const { executeDoneForNow } = require('./done-for-now.cjs')
const { executeMergeTasks } = require('./merge-tasks.cjs')
const { executeCanonicalTaskPatch } = require('./canonical-task-patch.cjs')
const { executeNotionActivation } = require('./notion-activation.cjs')
const { buildTaskSearchQuery, parseTaskSearchParams } = require('./task-search.cjs')
const { scopeTaskQuery } = require('./task-scope.cjs')

// --- Mode detection ---------------------------------------------------------
// parentPort exists only when launched as an Electron utilityProcess.
const PARENT_PORT = process.parentPort || null
const TOKEN_MODE = !!PARENT_PORT || process.env.FLOW_STATE_API_MODE === 'token'

// dotenv is only useful for the standalone service-role run; harmless otherwise.
if (!TOKEN_MODE) {
  try {
    require('dotenv').config({ path: '.env.local' })
  } catch {
    /* optional */
  }
}

// --- Config -----------------------------------------------------------------

const PORT = Number(process.env.FLOW_STATE_API_PORT) || 5577
const TOKEN = process.env.FLOW_STATE_API_TOKEN || ''
const DATA_DIR = process.env.FLOW_STATE_API_DATA_DIR || join(process.cwd(), '.flowstate-local-api')
const LOCAL_TIMER_INACTIVE_GRACE_MS = 15_000
const APP_VERSION = process.env.FLOW_STATE_APP_VERSION || 'unknown'

function logErr(msg) {
  console.error(`[local-api] ${msg}`)
}

mkdirSync(DATA_DIR, { recursive: true })

// --- Auth context (mutable) -------------------------------------------------
// { supabase, userId } once ready, or null. In service-role mode it is set
// once at startup; in token mode it is set/replaced when the parent posts a
// session, and cleared on sign-out.
let ctx = null
let aiRuntime = null
let localTimerSnapshot = null
let rendererAuthState = null
let activeWorkspaceId = null

function getAIRuntime() {
  if (!aiRuntime) {
    aiRuntime = createAIMastraRuntime({ dataDir: DATA_DIR })
  }
  return aiRuntime
}

function sanitizeRendererAuthState(state) {
  if (!state || typeof state !== 'object') return null
  return {
    isAuthenticated: !!state.isAuthenticated,
    hasUser: !!state.hasUser,
    canSyncRemotely: !!state.canSyncRemotely,
    reauthRequired: !!state.reauthRequired,
    isInitialized: !!state.isInitialized,
    updatedAt: Number(state.updatedAt) || Date.now(),
  }
}

function sanitizeActiveWorkspaceId(value) {
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined
}

function buildServiceRoleContext() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
  const userId = process.env.FLOW_STATE_USER_ID || ''
  if (!url || !key) {
    logErr(
      'Missing Supabase config. Set SUPABASE_URL (or VITE_SUPABASE_URL) and ' +
        'SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY). Tip: `doppler run -- npm run api`.',
    )
    process.exit(1)
  }
  if (!userId) {
    logErr(
      'Missing FLOW_STATE_USER_ID. Every row is scoped to your user_id ' +
        '(NOT the local seed a0eebc99-…). Set FLOW_STATE_USER_ID=<your-user-id>.',
    )
    process.exit(1)
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return { supabase, userId, activeWorkspaceId: null, signedUser: false }
}

/**
 * Token mode: (re)build the context from a session posted by the Electron main
 * process. Uses the anon key; setSession makes PostgREST carry the user JWT so
 * RLS scopes every query to that user. The renderer is the sole token
 * refresher, so autoRefreshToken is off here.
 */
async function applySession(msg) {
  const { supabaseUrl, anonKey, accessToken, refreshToken, userId } = msg || {}
  if (!supabaseUrl || !anonKey || !accessToken || !userId) {
    logErr('Ignoring incomplete session message')
    return
  }
  try {
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    })
    if (error) {
      logErr(`setSession failed: ${error.message}`)
      return
    }
    ctx = { supabase, userId, activeWorkspaceId, signedUser: true }
  } catch (e) {
    logErr(`applySession error: ${e && e.message}`)
  }
}

// --- Status mapping (self-contained copy of toDbStatus, see supabaseMappers.ts:477) ---
// App uses 'todo'|'done'; DB CHECK allows planned|in_progress|done|backlog|on_hold.
const toDbStatus = (s) => (s === 'done' ? 'done' : 'planned')
const fromDbStatus = (s) => (s === 'done' ? 'done' : 'todo')

const VALID_PRIORITIES = new Set(['low', 'medium', 'high'])
const isValidPriority = (p) => p === null || VALID_PRIORITIES.has(p)

// --- Helpers ----------------------------------------------------------------

function send(res, status, body) {
  const json = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  })
  res.end(json)
}

function notifyTaskMutation(operation, taskId) {
  if (!PARENT_PORT || !taskId) return
  PARENT_PORT.postMessage({ type: 'taskMutation', operation, taskId })
}

/** Reject anything that isn't a loopback Host header. */
function isLoopbackHost(hostHeader) {
  if (!hostHeader) return false
  const host = hostHeader.split(':')[0].toLowerCase()
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1'
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    let tooBig = false
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 1_000_000) {
        tooBig = true
        req.destroy()
      }
    })
    req.on('end', () => {
      if (tooBig) return reject(new Error('body too large'))
      if (!raw.trim()) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

/** YYYY-MM-DD from a timestamptz string (contract returns date-only). */
const toDateOnly = (ts) => (typeof ts === 'string' ? ts.slice(0, 10) : null)

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_ONLY_RE = /^\d{2}:\d{2}$/

function localDateOnly(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function nextDateOnly(dateOnly) {
  const [y, m, d] = dateOnly.split('-').map(Number)
  return localDateOnly(new Date(y, m - 1, d + 1))
}

function isValidDateOnly(dateOnly) {
  if (!DATE_ONLY_RE.test(dateOnly)) return false
  const [y, m, d] = dateOnly.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

function isValidTimeOnly(timeOnly) {
  if (!TIME_ONLY_RE.test(timeOnly)) return false
  const [h, m] = timeOnly.split(':').map(Number)
  return Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function normalizeTaskInstances(instances) {
  return Array.isArray(instances) ? instances.filter((item) => item && typeof item === 'object') : []
}

function validateTaskInstanceInput(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body required' }
  if (!isValidDateOnly(body.scheduledDate)) {
    return { ok: false, error: 'scheduledDate must be YYYY-MM-DD' }
  }
  if (!isValidTimeOnly(body.scheduledTime)) {
    return { ok: false, error: 'scheduledTime must be HH:mm' }
  }
  const duration = Number(body.duration)
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
    return { ok: false, error: 'duration must be an integer from 1 to 1440 minutes' }
  }
  if (body.preview !== undefined && typeof body.preview !== 'boolean') {
    return { ok: false, error: 'preview must be a boolean when provided' }
  }
  return { ok: true }
}

function buildTaskInstance(body) {
  return {
    id: crypto.randomUUID(),
    scheduledDate: body.scheduledDate,
    scheduledTime: body.scheduledTime,
    duration: Number(body.duration),
  }
}

function buildTaskInstanceResponse(task, instance, preview) {
  return {
    ok: true,
    preview,
    task: { id: task.id, title: task.title },
    instance,
  }
}

// --- Route handlers ---------------------------------------------------------

async function handleSearchTasks(url, res) {
  const parsed = parseTaskSearchParams(url.searchParams)
  if (!parsed.ok) return send(res, 400, { ok: false, error: parsed.error })

  const input = { query: parsed.query, limit: parsed.limit }
  const { data, error } = await buildTaskSearchQuery(ctx, input)
  if (error) {
    return send(res, 500, {
      ok: false,
      error: { code: 'search_failed', message: 'tasks could not be searched' },
    })
  }

  const tasks = (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    status: fromDbStatus(row.status),
    priority: row.priority ?? null,
    dueDate: toDateOnly(row.due_date),
    projectId: row.project_id ?? null,
    workspaceId: row.workspace_id ?? null,
    recurrenceRule: row.recurrence_rule ?? null,
    recurrenceParentId: row.recurrence_parent_id ?? null,
    recurrenceCount: row.recurrence_count ?? 0,
    isCompletionRecord: row.is_completion_record === true,
    canonicalRevision: row.canonical_revision,
    updatedAt: row.updated_at,
  }))

  send(res, 200, { ok: true, query: input.query, tasks })
}

async function handleGetTasks(url, res) {
  const { supabase } = ctx
  const statusParam = url.searchParams.get('status') // 'todo' | 'open' | 'done' | null
  const dueParam = url.searchParams.get('due') // 'today' | 'overdue' | 'open' | YYYY-MM-DD | null
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Math.min(Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 25, 25)

  if (statusParam && statusParam !== 'todo' && statusParam !== 'open' && statusParam !== 'done') {
    return send(res, 400, { error: 'status must be todo|open|done' })
  }

  let query = supabase
    .from('tasks')
    .select('id,title,status,priority,due_date,project_id,workspace_id,canonical_revision')
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(limit)
  query = scopeTaskQuery(ctx, query)

  // status=done → done; status=todo or omitted → all open (non-done)
  if (statusParam === 'done') query = query.eq('status', 'done')
  else query = query.neq('status', 'done')

  if (dueParam) {
    if (dueParam === 'open') {
      query = query.is('due_date', null)
    } else if (dueParam === 'overdue') {
      query = query.lt('due_date', localDateOnly())
    } else {
      const dueDate = dueParam === 'today' ? localDateOnly() : dueParam
      if (!isValidDateOnly(dueDate)) {
        return send(res, 400, { error: 'due must be today|overdue|open|YYYY-MM-DD' })
      }
      query = query.gte('due_date', dueDate).lt('due_date', nextDateOnly(dueDate))
    }
  }

  const { data, error } = await query
  if (error) return send(res, 500, { error: error.message })

  const tasks = (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    status: fromDbStatus(r.status),
    priority: r.priority ?? null,
    dueDate: toDateOnly(r.due_date),
    projectId: r.project_id ?? null,
    workspaceId: r.workspace_id ?? null,
    canonicalRevision: r.canonical_revision,
  }))
  send(res, 200, { tasks })
}

async function handleCreateTask(req, res) {
  const { supabase, userId } = ctx
  const body = await readJsonBody(req)

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return send(res, 400, { error: 'title required' })

  const priority = body.priority === undefined ? null : body.priority
  if (!isValidPriority(priority)) {
    return send(res, 400, { error: 'priority must be low|medium|high or null' })
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const row = {
    id,
    user_id: userId,
    title,
    description: typeof body.description === 'string' ? body.description : '',
    status: 'planned', // default todo
    priority,
    due_date: body.dueDate ?? null,
    project_id: body.projectId ?? null,
    progress: 0,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  }

  const { error } = await supabase.from('tasks').insert(row)
  if (error) return send(res, 500, { error: error.message })
  notifyTaskMutation('create', id)
  send(res, 200, { ok: true, task: { id } })
}

async function handlePatchTask(id, req, res) {
  const body = await readJsonBody(req)
  const result = await executeCanonicalTaskPatch(ctx, id, body, notifyTaskMutation)
  send(res, result.status, result.body)
}

async function handleNotionActivation(req, res) {
  const body = await readJsonBody(req)
  const result = await executeNotionActivation(ctx, body, notifyTaskMutation)
  return send(res, result.status, result.body)
}

async function handleGetTask(id, res) {
  const { supabase } = ctx
  let query = supabase
    .from('tasks')
    .select('id,title,status,priority,due_date,project_id,recurrence_rule,recurrence_parent_id,recurrence_count,is_completion_record,instances,workspace_id,canonical_revision,updated_at')
    .eq('id', id)
    .eq('is_deleted', false)
  query = scopeTaskQuery(ctx, query)
  const { data: task, error } = await query.maybeSingle()
  if (error) return send(res, 500, { error: { code: 'read_failed', message: 'task could not be read' }, ok: false })
  if (!task) return send(res, 404, { error: { code: 'not_found', message: 'task not found' }, ok: false })

  send(res, 200, {
    ok: true,
    task: {
      id: task.id,
      title: task.title,
      status: fromDbStatus(task.status),
      priority: task.priority,
      dueDate: toDateOnly(task.due_date),
      projectId: task.project_id,
      recurrenceRule: task.recurrence_rule,
      recurrenceParentId: task.recurrence_parent_id,
      recurrenceCount: task.recurrence_count,
      isCompletionRecord: task.is_completion_record,
      instances: normalizeTaskInstances(task.instances),
      workspaceId: task.workspace_id,
      canonicalRevision: task.canonical_revision,
      updatedAt: task.updated_at,
    },
  })
}

async function handleDoneForNow(id, req, res) {
  const body = await readJsonBody(req)
  const doneForNowContext = {
    ...ctx,
    activeWorkspaceId: ctx.activeWorkspaceId,
  }
  const result = await executeDoneForNow(doneForNowContext, id, body, notifyTaskMutation)
  send(res, result.status, result.body)
}

async function handleMergeTasks(survivorId, req, res) {
  const body = await readJsonBody(req)
  const result = await executeMergeTasks(ctx, survivorId, body, notifyTaskMutation)
  send(res, result.status, result.body)
}

async function handleGetTaskInstances(id, res) {
  const { supabase, userId } = ctx
  const { data: existing, error } = await supabase
    .from('tasks')
    .select('id,title,instances')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) return send(res, 500, { error: error.message })
  if (!existing) return send(res, 404, { error: 'not found' })

  send(res, 200, {
    ok: true,
    task: { id: existing.id, title: existing.title },
    instances: normalizeTaskInstances(existing.instances),
  })
}

async function handlePostTaskInstance(id, req, res) {
  const { supabase, userId } = ctx
  const body = await readJsonBody(req)
  const validation = validateTaskInstanceInput(body)
  if (!validation.ok) return send(res, 400, { error: validation.error })

  const { data: existing, error: findErr } = await supabase
    .from('tasks')
    .select('id,title,status,priority,due_date,instances')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (findErr) return send(res, 500, { error: findErr.message })
  if (!existing) return send(res, 404, { error: 'not found' })

  const preview = body.preview !== false
  const proposedInstance = buildTaskInstance(body)
  if (preview) {
    return send(res, 200, buildTaskInstanceResponse(existing, proposedInstance, true))
  }

  const updatedInstances = [...normalizeTaskInstances(existing.instances), proposedInstance]
  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('tasks')
    .update({ instances: updatedInstances, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_deleted', false)
  if (updateErr) return send(res, 500, { error: updateErr.message })

  send(res, 200, buildTaskInstanceResponse(existing, proposedInstance, false))
}

async function handleDeleteTask(id, res) {
  const { supabase, userId } = ctx
  // Verify first so callers get a stable 404 for unknown, cross-user, or already-deleted ids.
  const { data: existing, error: findErr } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (findErr) return send(res, 500, { error: findErr.message })
  if (!existing) return send(res, 404, { error: 'not found' })

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('tasks')
    .update({ is_deleted: true, deleted_at: now, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_deleted', false)
  if (error) return send(res, 500, { error: error.message })
  notifyTaskMutation('delete', id)
  send(res, 200, { ok: true })
}

async function handleGetCurrentTimer(res) {
  const { supabase, userId } = ctx
  const { data, error } = await supabase
    .from('timer_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return send(res, 500, { error: error.message })
  if (!data) return send(res, 200, { active: false, session: null })

  send(res, 200, { active: true, session: data })
}

async function handleGetTimerDiagnostics(res) {
  const hasLocalTimerSnapshot = !!(localTimerSnapshot && typeof localTimerSnapshot === 'object')
  const localSnapshotUpdatedAt = hasLocalTimerSnapshot
    ? Number(localTimerSnapshot.updatedAt) || null
    : null
  const localSnapshotAgeMs = localSnapshotUpdatedAt
    ? Math.max(0, Date.now() - localSnapshotUpdatedAt)
    : null
  const localSnapshotActive = hasLocalTimerSnapshot
    ? !!(localTimerSnapshot.active && localTimerSnapshot.session)
    : false

  let currentTimerBranch = 'no-local-snapshot'
  if (hasLocalTimerSnapshot && localSnapshotActive) {
    currentTimerBranch = 'local-snapshot-active'
  } else if (hasLocalTimerSnapshot && localSnapshotAgeMs !== null) {
    currentTimerBranch = localSnapshotAgeMs > LOCAL_TIMER_INACTIVE_GRACE_MS
      ? 'local-snapshot-inactive-stale'
      : 'local-snapshot-inactive-fresh'
  }

  let supabaseActiveSessionFound = null
  let supabaseLookupOk = null
  if (ctx) {
    const { data, error } = await ctx.supabase
      .from('timer_sessions')
      .select('id')
      .eq('user_id', ctx.userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    supabaseLookupOk = !error
    supabaseActiveSessionFound = !!data
    if (!hasLocalTimerSnapshot && !error) {
      currentTimerBranch = data ? 'supabase-active' : 'supabase-inactive'
    }
  } else if (!hasLocalTimerSnapshot) {
    currentTimerBranch = 'unsigned-no-local-snapshot'
  }

  send(res, 200, {
    appVersion: APP_VERSION,
    mode: TOKEN_MODE ? 'token' : 'service-role',
    hasAuthContext: !!ctx,
    rendererAuthState: rendererAuthState
      ? {
          isAuthenticated: rendererAuthState.isAuthenticated,
          hasUser: rendererAuthState.hasUser,
          canSyncRemotely: rendererAuthState.canSyncRemotely,
          reauthRequired: rendererAuthState.reauthRequired,
          isInitialized: rendererAuthState.isInitialized,
          ageMs: Math.max(0, Date.now() - rendererAuthState.updatedAt),
        }
      : null,
    hasLocalTimerSnapshot,
    localSnapshotActive,
    localSnapshotAgeMs,
    localInactiveGraceMs: LOCAL_TIMER_INACTIVE_GRACE_MS,
    currentTimerBranch,
    supabaseLookupOk,
    supabaseActiveSessionFound,
  })
}

function getLocalTimerResponse() {
  if (!localTimerSnapshot || typeof localTimerSnapshot !== 'object') return null
  const updatedAt = Number(localTimerSnapshot.updatedAt) || Date.now()
  const snapshotAgeMs = Math.max(0, Date.now() - updatedAt)
  if (!localTimerSnapshot.active || !localTimerSnapshot.session) {
    if (snapshotAgeMs > LOCAL_TIMER_INACTIVE_GRACE_MS) return null
    return { active: false, session: null, source: 'local-snapshot' }
  }

  const session = { ...localTimerSnapshot.session }
  if (session.is_active && !session.is_paused) {
    const driftSeconds = Math.max(0, Math.floor(snapshotAgeMs / 1000))
    session.remaining_time = Math.max(0, Number(session.remaining_time || 0) - driftSeconds)
    if (session.remaining_time <= 0) {
      if (snapshotAgeMs > LOCAL_TIMER_INACTIVE_GRACE_MS) return null
      return { active: false, session: null, source: 'local-snapshot' }
    }
  }
  session.device_leader_last_seen = new Date().toISOString()
  return { active: true, session, source: 'local-snapshot' }
}

async function handlePostTimerControl(req, res) {
  const { supabase, userId } = ctx
  const body = await readJsonBody(req)
  const action = typeof body.action === 'string' ? body.action : ''

  if (action === 'toggle') {
    const { data: session, error: findErr } = await supabase
      .from('timer_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (findErr) return send(res, 500, { error: findErr.message })
    if (!session) return send(res, 404, { error: 'no active timer' })

    const update = {
      is_paused: !session.is_paused,
      device_leader_id: 'kde-widget',
      device_leader_last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabase
      .from('timer_sessions')
      .update(update)
      .eq('id', session.id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (error) return send(res, 500, { error: error.message })
    return send(res, 200, { ok: true, active: true, session: data })
  }

  if (action === 'start') {
    const duration = Number(body.duration)
    if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60 * 60) {
      return send(res, 400, { error: 'duration must be a positive number of seconds' })
    }

    const taskId = typeof body.taskId === 'string' && body.taskId.trim()
      ? body.taskId.trim()
      : 'general'
    const isBreak = body.isBreak === true
    const now = new Date().toISOString()
    const id = crypto.randomUUID()

    const { error: clearErr } = await supabase
      .from('timer_sessions')
      .update({ is_active: false, completed_at: now, updated_at: now })
      .eq('user_id', userId)
      .eq('is_active', true)
    if (clearErr) return send(res, 500, { error: clearErr.message })

    const row = {
      id,
      user_id: userId,
      task_id: taskId,
      start_time: now,
      duration,
      remaining_time: duration,
      is_active: true,
      is_paused: false,
      is_break: isBreak,
      device_leader_id: 'kde-widget',
      device_leader_last_seen: now,
    }

    const { data, error } = await supabase
      .from('timer_sessions')
      .insert(row)
      .select('*')
      .single()
    if (error) return send(res, 500, { error: error.message })
    return send(res, 200, { ok: true, active: true, session: data })
  }

  send(res, 400, { error: 'action must be toggle|start' })
}

// --- Assistant context -------------------------------------------------------

async function handleGetAssistantContext(res) {
  const { supabase, userId } = ctx
  const today = localDateOnly()
  const tomorrow = nextDateOnly(today)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const safeCount = async (query) => {
    const { count, error } = await query
    if (error) return { available: false, count: 0 }
    return { available: true, count: Number(count || 0) }
  }

  const safeRows = async (query) => {
    const { data, error } = await query
    if (error) return { available: false, rows: [] }
    return { available: true, rows: data || [] }
  }

  const [
    openTasks,
    todayTasks,
    overdueTasks,
    noDateTasks,
    highPriorityTasks,
    recentDoneTasks,
    projects,
    timerSessions,
    pomodoroHistory,
    quickSortSessions,
    gamification,
    aiConversations,
    aiUsage,
    projectContexts,
    taskContexts,
    memoryEvents,
    clarificationEvents,
    parameterBeliefs,
    recommendationFeedback,
  ] = await Promise.all([
    safeRows(supabase.from('tasks').select('id,title,status,priority,due_date,project_id,updated_at').eq('user_id', userId).eq('is_deleted', false).neq('status', 'done').order('updated_at', { ascending: false }).limit(100)),
    safeCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_deleted', false).neq('status', 'done').gte('due_date', today).lt('due_date', tomorrow)),
    safeCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_deleted', false).neq('status', 'done').lt('due_date', today)),
    safeCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_deleted', false).neq('status', 'done').is('due_date', null)),
    safeCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_deleted', false).neq('status', 'done').eq('priority', 'high')),
    safeCount(supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('is_deleted', false).eq('status', 'done').gte('completed_at', weekAgo)),
    safeRows(supabase.from('projects').select('id,name,updated_at').eq('user_id', userId).eq('is_deleted', false).limit(100)),
    safeRows(supabase.from('timer_sessions').select('id,task_id,duration,remaining_time,is_active,is_paused,is_break,created_at,updated_at,completed_at').eq('user_id', userId).gte('created_at', monthAgo).order('updated_at', { ascending: false }).limit(50)),
    safeCount(supabase.from('pomodoro_history').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthAgo)),
    safeCount(supabase.from('quick_sort_sessions').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthAgo)),
    safeRows(supabase.from('user_gamification').select('level,xp,current_streak,longest_streak,last_activity_date,updated_at').eq('user_id', userId).limit(1)),
    safeCount(supabase.from('ai_conversations').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('updated_at', monthAgo)),
    safeRows(supabase.from('ai_usage_log').select('date,provider,model,input_tokens,output_tokens,request_count').eq('user_id', userId).gte('date', monthAgo.slice(0, 10)).order('date', { ascending: false }).limit(30)),
    safeCount(supabase.from('project_contexts').select('project_id', { count: 'exact', head: true }).eq('user_id', userId)),
    safeCount(supabase.from('task_contexts').select('task_id', { count: 'exact', head: true }).eq('user_id', userId)),
    safeCount(supabase.from('memory_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthAgo)),
    safeCount(supabase.from('ai_clarification_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthAgo)),
    safeCount(supabase.from('ai_parameter_beliefs').select('id', { count: 'exact', head: true }).eq('user_id', userId)),
    safeCount(supabase.from('ai_recommendation_feedback').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthAgo)),
  ])

  const taskRows = openTasks.rows
  const projectNames = new Map(projects.rows.map((p) => [p.id, p.name || p.id]))
  const projectCounts = new Map()
  for (const task of taskRows) {
    const key = task.project_id || 'inbox'
    projectCounts.set(key, (projectCounts.get(key) || 0) + 1)
  }

  const projectSignals = Array.from(projectCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([projectId, openTaskCount]) => ({
      projectId: projectId === 'inbox' ? null : projectId,
      name: projectId === 'inbox' ? 'Inbox / no project' : projectNames.get(projectId) || projectId,
      openTaskCount,
    }))

  const timerRows = timerSessions.rows
  const completedFocusSeconds = timerRows
    .filter((s) => s.completed_at || (Number(s.duration || 0) > Number(s.remaining_time || 0) && !s.is_active))
    .reduce((sum, s) => sum + Math.max(0, Number(s.duration || 0) - Number(s.remaining_time || 0)), 0)

  const aiUsageRows = aiUsage.rows
  const aiUsageTotals = aiUsageRows.reduce(
    (acc, row) => {
      acc.inputTokens += Number(row.input_tokens || 0)
      acc.outputTokens += Number(row.output_tokens || 0)
      acc.requestCount += Number(row.request_count || 0)
      return acc
    },
    { inputTokens: 0, outputTokens: 0, requestCount: 0 },
  )

  send(res, 200, {
    ok: true,
    generatedAt: new Date().toISOString(),
    window: { today, since: { weekAgo, monthAgo } },
    taskPressure: {
      sampledOpenTasks: taskRows.length,
      todayCount: todayTasks.count,
      overdueCount: overdueTasks.count,
      noDateCount: noDateTasks.count,
      highPriorityOpenCount: highPriorityTasks.count,
      doneLast7DaysCount: recentDoneTasks.count,
      unavailable: [todayTasks, overdueTasks, noDateTasks, highPriorityTasks, recentDoneTasks]
        .some((r) => !r.available),
    },
    focusPatterns: {
      recentTimerSessionCount: timerRows.length,
      completedFocusMinutesApprox: Math.round(completedFocusSeconds / 60),
      pomodoroHistoryCount30d: pomodoroHistory.count,
      quickSortSessionCount30d: quickSortSessions.count,
      timerDataAvailable: timerSessions.available,
      pomodoroHistoryAvailable: pomodoroHistory.available,
      quickSortAvailable: quickSortSessions.available,
    },
    projectSignals,
    gamification: {
      available: gamification.available && gamification.rows.length > 0,
      profile: gamification.rows[0] || null,
    },
    assistantMemory: {
      aiConversationCount30d: aiConversations.count,
      aiUsageLogAvailable: aiUsage.available,
      aiUsage30d: aiUsageTotals,
      projectContextCount: projectContexts.count,
      taskContextCount: taskContexts.count,
      memoryEventCount30d: memoryEvents.count,
      clarificationEventCount30d: clarificationEvents.count,
      parameterBeliefCount: parameterBeliefs.count,
      recommendationFeedbackCount30d: recommendationFeedback.count,
      availability: {
        aiConversations: aiConversations.available,
        projectContexts: projectContexts.available,
        taskContexts: taskContexts.available,
        memoryEvents: memoryEvents.available,
        clarificationEvents: clarificationEvents.available,
        parameterBeliefs: parameterBeliefs.available,
        recommendationFeedback: recommendationFeedback.available,
      },
    },
  })
}

async function handleAIClarificationStart(req, res) {
  const body = await readJsonBody(req)
  const runId = typeof body.runId === 'string' && body.runId.trim()
    ? body.runId.trim()
    : crypto.randomUUID()
  const result = await getAIRuntime().start(body.input || body, runId)
  send(res, 200, { ok: true, ...result })
}

async function handleAIClarificationResume(runId, req, res) {
  const body = await readJsonBody(req)
  const result = await getAIRuntime().resume(runId, body.resumeData || body)
  send(res, 200, { ok: true, ...result })
}

// --- Server -----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    // Security: loopback-only Host + bearer token.
    if (!isLoopbackHost(req.headers.host)) {
      return send(res, 403, { error: 'forbidden host' })
    }
    const url = new URL(req.url, `http://${req.headers.host}`)
    const path = url.pathname

    // Health and the KDE timer snapshot are loopback-only and intentionally do
    // not require the Life OS bearer token. Task routes below remain protected.
    if (req.method === 'GET' && path === '/api/health') {
      return send(res, 200, { ok: true })
    }

    if (req.method === 'GET' && path === '/api/timer/current') {
      const localTimer = getLocalTimerResponse()
      if (localTimer) return send(res, 200, localTimer)
      if (!ctx) return send(res, 503, { error: 'not signed in' })
      return await handleGetCurrentTimer(res)
    }

    if (req.method === 'GET' && path === '/api/timer/diagnostics') {
      return await handleGetTimerDiagnostics(res)
    }

    // Data routes require an auth context (token mode: until the app signs in).
    if (!ctx) return send(res, 503, { error: 'not signed in' })

    if (req.method === 'POST' && path === '/api/timer/control') {
      return await handlePostTimerControl(req, res)
    }

    if (TOKEN) {
      const auth = req.headers.authorization || ''
      if (auth !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' })
    }

    if (req.method === 'GET' && path === '/api/tasks') {
      return await handleGetTasks(url, res)
    }
    if (req.method === 'GET' && path === '/api/tasks/search') {
      return await handleSearchTasks(url, res)
    }
    if (req.method === 'GET' && path === '/api/assistant/context') {
      return await handleGetAssistantContext(res)
    }
    if (req.method === 'POST' && path === '/api/tasks') {
      return await handleCreateTask(req, res)
    }
    if (req.method === 'POST' && path === '/api/integrations/notion/activations') {
      return await handleNotionActivation(req, res)
    }
    if (req.method === 'POST' && path === '/api/ai/clarifications/start') {
      return await handleAIClarificationStart(req, res)
    }
    const clarificationResumeMatch = path.match(/^\/api\/ai\/clarifications\/([^/]+)\/resume$/)
    if (req.method === 'POST' && clarificationResumeMatch) {
      return await handleAIClarificationResume(decodeURIComponent(clarificationResumeMatch[1]), req, res)
    }
    const taskInstancesMatch = path.match(/^\/api\/tasks\/([^/]+)\/instances$/)
    if (req.method === 'GET' && taskInstancesMatch) {
      return await handleGetTaskInstances(decodeURIComponent(taskInstancesMatch[1]), res)
    }
    if (req.method === 'POST' && taskInstancesMatch) {
      return await handlePostTaskInstance(decodeURIComponent(taskInstancesMatch[1]), req, res)
    }
    const doneForNowMatch = path.match(/^\/api\/tasks\/([^/]+)\/done-for-now$/)
    if (req.method === 'POST' && doneForNowMatch) {
      return await handleDoneForNow(decodeURIComponent(doneForNowMatch[1]), req, res)
    }
    const mergeTasksMatch = path.match(/^\/api\/tasks\/([^/]+)\/merge$/)
    if (req.method === 'POST' && mergeTasksMatch) {
      return await handleMergeTasks(decodeURIComponent(mergeTasksMatch[1]), req, res)
    }
    const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/)
    if (req.method === 'GET' && taskMatch) {
      return await handleGetTask(decodeURIComponent(taskMatch[1]), res)
    }
    if (req.method === 'PATCH' && taskMatch) {
      return await handlePatchTask(decodeURIComponent(taskMatch[1]), req, res)
    }
    if (req.method === 'DELETE' && taskMatch) {
      return await handleDeleteTask(decodeURIComponent(taskMatch[1]), res)
    }

    send(res, 404, { error: 'not found' })
  } catch (err) {
    // Never let an exception escape the handler.
    send(res, 500, { error: err && err.message ? err.message : 'internal error' })
  }
})

// --- Bootstrap --------------------------------------------------------------

if (TOKEN_MODE) {
  // Wait for the Electron main process to post the user's session.
  if (PARENT_PORT) {
    PARENT_PORT.on('message', (e) => {
      const msg = e && e.data
      if (!msg || typeof msg !== 'object') return
      if (msg.type === 'session') applySession(msg)
      else if (msg.type === 'clear') {
        ctx = null
        rendererAuthState = {
          isAuthenticated: false,
          hasUser: false,
          canSyncRemotely: false,
          reauthRequired: false,
          isInitialized: rendererAuthState ? rendererAuthState.isInitialized : false,
          updatedAt: Date.now(),
        }
      }
      else if (msg.type === 'timerSnapshot') localTimerSnapshot = msg.snapshot || null
      else if (msg.type === 'rendererAuthState') rendererAuthState = sanitizeRendererAuthState(msg.state)
      else if (msg.type === 'workspaceContext') {
        const sanitizedWorkspaceId = sanitizeActiveWorkspaceId(msg.activeWorkspaceId)
        if (sanitizedWorkspaceId !== undefined) {
          activeWorkspaceId = sanitizeActiveWorkspaceId(msg.activeWorkspaceId)
          if (ctx) ctx = { ...ctx, activeWorkspaceId }
        }
      }
    })
  }
} else {
  // Standalone service-role: ready immediately.
  ctx = buildServiceRoleContext()
}

server.listen(PORT, '127.0.0.1', () => {
  const mode = TOKEN_MODE ? 'token' : 'service-role'
  console.log(
    `[local-api] FlowState task API on http://127.0.0.1:${PORT} ` +
      `(mode ${mode}, auth ${TOKEN ? 'on' : 'off'})`,
  )
  // Let the parent know we're listening (token mode).
  if (PARENT_PORT) PARENT_PORT.postMessage({ type: 'listening', port: PORT })
})

process.on('exit', () => {
  if (aiRuntime) {
    try {
      aiRuntime.close()
    } catch {
      /* ignore */
    }
  }
})
