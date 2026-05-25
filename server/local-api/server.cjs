#!/usr/bin/env node
/**
 * FlowState local task API sidecar (TASK-1797)
 *
 * A tiny, localhost-only HTTP surface so another local app (Life OS Advisor)
 * can read FlowState tasks for context and create/update them on explicit
 * user approval. Additive: writes go to the same Supabase `tasks` table the
 * Vue app already subscribes to via realtime, so the UI keeps syncing.
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
const { createClient } = require('@supabase/supabase-js')

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

function logErr(msg) {
  console.error(`[local-api] ${msg}`)
}

// --- Auth context (mutable) -------------------------------------------------
// { supabase, userId } once ready, or null. In service-role mode it is set
// once at startup; in token mode it is set/replaced when the parent posts a
// session, and cleared on sign-out.
let ctx = null

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
  return { supabase, userId }
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
    ctx = { supabase, userId }
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

// --- Route handlers ---------------------------------------------------------

async function handleGetTasks(url, res) {
  const { supabase, userId } = ctx
  const statusParam = url.searchParams.get('status') // 'todo' | 'done' | null
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Math.min(Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 25, 25)

  let query = supabase
    .from('tasks')
    .select('id,title,status,priority,due_date,project_id')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(limit)

  // status=done → done; status=todo or omitted → all open (non-done)
  if (statusParam === 'done') query = query.eq('status', 'done')
  else query = query.neq('status', 'done')

  const { data, error } = await query
  if (error) return send(res, 500, { error: error.message })

  const tasks = (data || []).map((r) => ({
    id: r.id,
    title: r.title,
    status: fromDbStatus(r.status),
    priority: r.priority ?? null,
    dueDate: toDateOnly(r.due_date),
    projectId: r.project_id ?? null,
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
  send(res, 200, { ok: true, task: { id } })
}

async function handlePatchTask(id, req, res) {
  const { supabase, userId } = ctx
  // Verify the row exists for this user (and isn't soft-deleted).
  const { data: existing, error: findErr } = await supabase
    .from('tasks')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (findErr) return send(res, 500, { error: findErr.message })
  if (!existing) return send(res, 404, { error: 'not found' })

  const body = await readJsonBody(req)
  const update = { updated_at: new Date().toISOString() }

  if (body.status !== undefined) {
    if (body.status !== 'todo' && body.status !== 'done') {
      return send(res, 400, { error: 'status must be todo|done' })
    }
    update.status = toDbStatus(body.status)
    if (body.status === 'done') {
      update.completed_at = new Date().toISOString()
      if (body.progress === undefined) update.progress = 100
    } else {
      update.completed_at = null
    }
  }
  if (body.title !== undefined) {
    const t = typeof body.title === 'string' ? body.title.trim() : ''
    if (!t) return send(res, 400, { error: 'title cannot be empty' })
    update.title = t
  }
  if (body.priority !== undefined) {
    if (!isValidPriority(body.priority)) {
      return send(res, 400, { error: 'priority must be low|medium|high or null' })
    }
    update.priority = body.priority
  }
  if (body.dueDate !== undefined) update.due_date = body.dueDate ?? null
  if (body.progress !== undefined) {
    const n = Number(body.progress)
    if (!Number.isFinite(n)) return send(res, 400, { error: 'progress must be a number' })
    update.progress = n
  }

  const { error } = await supabase.from('tasks').update(update).eq('id', id).eq('user_id', userId)
  if (error) return send(res, 500, { error: error.message })
  send(res, 200, { ok: true })
}

// --- Server -----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  try {
    // Security: loopback-only Host + bearer token.
    if (!isLoopbackHost(req.headers.host)) {
      return send(res, 403, { error: 'forbidden host' })
    }
    if (TOKEN) {
      const auth = req.headers.authorization || ''
      if (auth !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'unauthorized' })
    }

    const url = new URL(req.url, `http://${req.headers.host}`)
    const path = url.pathname

    // Health is always available, even before a session arrives.
    if (req.method === 'GET' && path === '/api/health') {
      return send(res, 200, { ok: true })
    }

    // Data routes require an auth context (token mode: until the app signs in).
    if (!ctx) return send(res, 503, { error: 'not signed in' })

    if (req.method === 'GET' && path === '/api/tasks') {
      return await handleGetTasks(url, res)
    }
    if (req.method === 'POST' && path === '/api/tasks') {
      return await handleCreateTask(req, res)
    }
    const patchMatch = path.match(/^\/api\/tasks\/([^/]+)$/)
    if (req.method === 'PATCH' && patchMatch) {
      return await handlePatchTask(decodeURIComponent(patchMatch[1]), req, res)
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
      else if (msg.type === 'clear') ctx = null
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
