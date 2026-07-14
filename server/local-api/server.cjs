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

// --- Subtask helpers --------------------------------------------------------

const subtaskMutationReceipts = new Map()

function normalizeSubtasks(subtasks) {
  return Array.isArray(subtasks) ? subtasks.filter((item) => item && typeof item === 'object') : []
}

function validateSubtaskMutationMetadata(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body required' }
  if (body.preview !== undefined && typeof body.preview !== 'boolean') {
    return { ok: false, error: 'preview must be a boolean when provided' }
  }
  const preview = body.preview !== false
  const requestId = typeof body.requestId === 'string' ? body.requestId.trim() : ''
  if (!preview && !requestId) {
    return { ok: false, error: 'requestId required when preview is false' }
  }
  return { ok: true, preview, requestId }
}

function buildSubtaskReceipt(action, taskId, subtask, requestId, replayed = false) {
  return {
    requestId: requestId || null,
    action,
    taskId,
    subtaskId: subtask.id,
    replayed,
  }
}

function receiptKey(userId, taskId, requestId) {
  return `${userId}:${taskId}:${requestId}`
}

function deterministicSubtaskId(userId, taskId, requestId, index = 0) {
  const hex = crypto.createHash('sha256')
    .update(`${userId}:${taskId}:${requestId}:${index}`)
    .digest('hex')
    .slice(0, 32)
    .split('')
  hex[12] = '5'
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const value = hex.join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function rememberSubtaskResponse(key, response) {
  subtaskMutationReceipts.set(key, response)
  if (subtaskMutationReceipts.size > 500) {
    subtaskMutationReceipts.delete(subtaskMutationReceipts.keys().next().value)
  }
}

function replaySubtaskResponse(key, res) {
  const cached = subtaskMutationReceipts.get(key)
  if (!cached) return false
  send(res, 200, {
    ...cached,
    receipt: { ...cached.receipt, replayed: true },
  })
  return true
}

function applySubtaskOperations(userId, taskId, requestId, initial, operations, now) {
  const subtasks = [...initial]
  const results = []
  for (const [operationIndex, operation] of operations.entries()) {
    if (!operation || !['create', 'update', 'delete'].includes(operation.action)) {
      return { ok: false, error: 'operation action must be create|update|delete' }
    }
    if (operation.action === 'create') {
      const title = typeof operation.title === 'string' ? operation.title.trim() : ''
      if (!title) return { ok: false, error: 'create operation title required' }
      const subtaskId = deterministicSubtaskId(userId, taskId, requestId, operationIndex)
      const existingIndex = subtasks.findIndex((item) => item.id === subtaskId)
      if (existingIndex !== -1) {
        results.push({ action: 'create', subtask: subtasks[existingIndex], replayed: true })
        continue
      }
      const subtask = {
        id: subtaskId, parentTaskId: taskId, title, description: '',
        completedPomodoros: 0, isCompleted: false, createdAt: now, updatedAt: now,
      }
      const order = operation.order === undefined ? subtasks.length : Number(operation.order)
      if (!Number.isInteger(order) || order < 0) return { ok: false, error: 'order must be a non-negative integer' }
      subtasks.splice(Math.min(order, subtasks.length), 0, subtask)
      results.push({ action: 'create', subtask })
      continue
    }
    const subtaskId = typeof operation.subtaskId === 'string' ? operation.subtaskId.trim() : ''
    const index = subtasks.findIndex((item) => item.id === subtaskId)
    if (index === -1 && operation.action === 'delete') {
      results.push({ action: 'delete', subtask: { id: subtaskId }, replayed: true })
      continue
    }
    if (index === -1) return { ok: false, error: 'subtask not found' }
    const current = subtasks[index]
    if (operation.action === 'delete') {
      subtasks.splice(index, 1)
      results.push({ action: 'delete', subtask: current })
      continue
    }
    const updated = { ...current, updatedAt: now }
    if (operation.title !== undefined) {
      const title = typeof operation.title === 'string' ? operation.title.trim() : ''
      if (!title) return { ok: false, error: 'title cannot be empty' }
      updated.title = title
    }
    if (operation.completed !== undefined) {
      if (typeof operation.completed !== 'boolean') return { ok: false, error: 'completed must be a boolean' }
      updated.isCompleted = operation.completed
    }
    subtasks.splice(index, 1)
    const order = operation.order === undefined ? index : Number(operation.order)
    if (!Number.isInteger(order) || order < 0) return { ok: false, error: 'order must be a non-negative integer' }
    subtasks.splice(Math.min(order, subtasks.length), 0, updated)
    results.push({ action: 'update', subtask: updated })
  }
  return { ok: true, subtasks, results }
}

// --- Route handlers ---------------------------------------------------------

async function handleGetTasks(url, res) {
  const { supabase, userId } = ctx
  const statusParam = url.searchParams.get('status') // 'todo' | 'open' | 'done' | null
  const dueParam = url.searchParams.get('due') // 'today' | 'overdue' | 'open' | YYYY-MM-DD | null
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Math.min(Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 25, 25)

  if (statusParam && statusParam !== 'todo' && statusParam !== 'open' && statusParam !== 'done') {
    return send(res, 400, { error: 'status must be todo|open|done' })
  }

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
  }))
  send(res, 200, { tasks })
}

function toSafeTask(record, detailed = false) {
  const task = {
    id: record.id,
    title: record.title,
    status: fromDbStatus(record.status),
    priority: record.priority ?? null,
    dueDate: toDateOnly(record.due_date),
    projectId: record.project_id ?? null,
  }
  if (!detailed) return task
  return {
    ...task,
    description: record.description || '',
    progress: Number(record.progress) || 0,
    dueTime: record.due_time || null,
    tags: Array.isArray(record.tags) ? record.tags : [],
    subtasks: normalizeSubtasks(record.subtasks),
    instances: normalizeTaskInstances(record.instances),
    recurrence: record.recurrence_rule
      ? {
          rule: record.recurrence_rule,
          parentId: record.recurrence_parent_id || null,
          count: Number(record.recurrence_count) || 0,
          isCompletionRecord: record.is_completion_record === true,
        }
      : null,
    isInInbox: record.is_in_inbox === true,
    canvas: record.position || null,
    createdAt: record.created_at || null,
    updatedAt: record.updated_at || null,
    completedAt: record.completed_at || null,
  }
}

async function handleGetTask(id, res) {
  const { supabase, userId } = ctx
  const { data, error } = await supabase.from('tasks')
    .select('id,title,description,status,priority,progress,due_date,due_time,project_id,tags,subtasks,instances,recurrence_rule,recurrence_parent_id,recurrence_count,is_completion_record,is_in_inbox,position,created_at,updated_at,completed_at')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .maybeSingle()
  if (error) return send(res, 500, { error: error.message })
  if (!data) return send(res, 404, { error: 'not found' })
  return send(res, 200, { ok: true, task: toSafeTask(data, true) })
}

async function handleSearchTasks(url, res) {
  const { supabase, userId } = ctx
  const query = (url.searchParams.get('q') || '').trim()
  const limitParam = Number(url.searchParams.get('limit'))
  const limit = Math.min(Number.isInteger(limitParam) && limitParam > 0 ? limitParam : 25, 25)
  if (!query) return send(res, 400, { error: 'q required' })
  if (query.length > 200) return send(res, 400, { error: 'q must be at most 200 characters' })

  // PostgREST `.or()` uses commas/parentheses as syntax. Replace those control
  // characters rather than letting a search term alter the filter expression.
  const safeQuery = query.replace(/[,()*]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!safeQuery) return send(res, 400, { error: 'q must contain searchable text' })
  const pattern = `*${safeQuery}*`
  const { data, error } = await supabase.from('tasks')
    .select('id,title,status,priority,due_date,project_id,updated_at')
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .or(`title.ilike.${pattern},description.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(limit)
  if (error) return send(res, 500, { error: error.message })
  return send(res, 200, { ok: true, tasks: (data || []).map((record) => toSafeTask(record)) })
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

async function handleNotionTaskActivation(req, res) {
  const { supabase } = ctx
  const body = await readJsonBody(req)
  const preview = body.preview !== false
  const notion = body.notion && typeof body.notion === 'object' ? body.notion : {}
  const task = body.task && typeof body.task === 'object' ? body.task : {}
  const operationId = typeof body.operationId === 'string' ? body.operationId.trim() : ''
  if (!operationId) return send(res, 400, { error: 'operationId required' })
  if (!preview && !(typeof body.previewDigest === 'string' && body.previewDigest.trim())) {
    return send(res, 400, { error: 'previewDigest required when preview is false' })
  }
  if (!preview && !(typeof body.previewExpiresAt === 'string' && body.previewExpiresAt.trim())) {
    return send(res, 400, { error: 'previewExpiresAt required when preview is false' })
  }

  const { data, error } = await supabase.rpc('activate_notion_task', {
    p_operation_id: operationId,
    p_notion_page_id: notion.pageId,
    p_notion_data_source_id: notion.dataSourceId,
    p_notion_url: notion.url,
    p_notion_last_edited_at: notion.lastEditedAt,
    p_title: task.title,
    p_description: task.description || '',
    p_priority: task.priority ?? null,
    p_due_date: task.dueDate ?? null,
    p_project_id: task.projectId ?? null,
    p_work_block: body.workBlock ?? null,
    p_preview: preview,
    p_preview_digest: body.previewDigest || null,
    p_preview_expires_at: body.previewExpiresAt || null,
  })
  if (error) return send(res, 500, { error: error.message })
  if (!data || typeof data !== 'object') {
    return send(res, 500, { error: 'Notion activation returned an invalid response' })
  }
  if (data.error) {
    const conflictCodes = new Set([
      'idempotency_conflict', 'stale_preview', 'preview_expired',
    ])
    const code = data.error && data.error.code
    return send(res, conflictCodes.has(code) ? 409 : 400, data)
  }
  const receipt = data.receipt && typeof data.receipt === 'object' ? data.receipt : null
  if (!preview && receipt && receipt.entityId) {
    notifyTaskMutation('create', receipt.entityId)
  }
  send(res, 200, data)
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
  notifyTaskMutation('update', id)
  send(res, 200, { ok: true })
}

const DONE_FOR_NOW_CONFLICTS = new Set([
  'idempotency_conflict',
  'stale_preview',
  'occurrence_already_completed',
])

function doneForNowErrorStatus(code) {
  if (code === 'unauthorized') return 401
  if (code === 'task_not_found') return 404
  if (DONE_FOR_NOW_CONFLICTS.has(code)) return 409
  if (code === 'operation_failed') return 500
  return 400
}

async function handleDoneForNow(id, req, res) {
  const { supabase } = ctx
  const body = await readJsonBody(req)
  const preview = body.preview !== false

  if (body.preview !== undefined && typeof body.preview !== 'boolean') {
    return send(res, 400, { error: 'preview must be a boolean' })
  }
  if (body.nextDueDate !== undefined && !isValidDateOnly(body.nextDueDate)) {
    return send(res, 400, { error: 'nextDueDate must be YYYY-MM-DD' })
  }
  if (!preview && (typeof body.requestId !== 'string' || !body.requestId.trim())) {
    return send(res, 400, { error: 'requestId required when preview is false' })
  }
  if (!preview && (typeof body.previewVersion !== 'string' || !body.previewVersion.trim())) {
    return send(res, 400, { error: 'previewVersion required when preview is false' })
  }

  const { data, error } = await supabase.rpc('done_for_now_task', {
    p_task_id: id,
    p_preview: preview,
    p_request_id: preview ? null : body.requestId.trim(),
    p_preview_version: preview ? null : body.previewVersion.trim(),
    p_next_due_date: body.nextDueDate ?? null,
  })
  if (error) {
    return send(res, 500, { error: { code: 'operation_failed', message: error.message } })
  }
  if (!data || data.ok !== true) {
    const typedError = data && data.error && typeof data.error === 'object'
      ? data.error
      : { code: 'operation_failed', message: 'Done for now returned no result' }
    return send(res, doneForNowErrorStatus(typedError.code), { error: typedError })
  }

  // `state` contains exact rows for renderer reconciliation. It is intentionally
  // not part of the assistant-facing Local API response.
  const { state: _rendererState, ...safeResult } = data
  if (!preview) notifyTaskMutation('update', id)
  return send(res, 200, safeResult)
}

const MERGE_TASK_CONFLICTS = new Set([
  'idempotency_conflict',
  'stale_preview',
  'merge_conflict',
  'recurring_merge_unsupported',
])

function mergeTaskErrorStatus(code) {
  if (code === 'unauthorized') return 401
  if (code === 'survivor_not_found' || code === 'duplicate_not_found') return 404
  if (MERGE_TASK_CONFLICTS.has(code)) return 409
  if (code === 'operation_failed') return 500
  return 400
}

async function handleMergeTasks(survivorTaskId, req, res) {
  const { supabase } = ctx
  const body = await readJsonBody(req)
  const preview = body.preview !== false
  const duplicateTaskId = typeof body.duplicateTaskId === 'string'
    ? body.duplicateTaskId.trim()
    : ''

  if (!duplicateTaskId) return send(res, 400, { error: 'duplicateTaskId required' })
  if (duplicateTaskId === survivorTaskId) {
    return send(res, 400, { error: { code: 'same_task', message: 'Survivor and duplicate must be different tasks' } })
  }
  if (body.preview !== undefined && typeof body.preview !== 'boolean') {
    return send(res, 400, { error: 'preview must be a boolean' })
  }
  if (!preview && (typeof body.requestId !== 'string' || !body.requestId.trim())) {
    return send(res, 400, { error: 'requestId required when preview is false' })
  }
  if (!preview && (typeof body.previewVersion !== 'string' || !body.previewVersion.trim())) {
    return send(res, 400, { error: 'previewVersion required when preview is false' })
  }

  const { data, error } = await supabase.rpc('merge_tasks', {
    p_survivor_task_id: survivorTaskId,
    p_duplicate_task_id: duplicateTaskId,
    p_preview: preview,
    p_request_id: preview ? null : body.requestId.trim(),
    p_preview_version: preview ? null : body.previewVersion.trim(),
  })
  if (error) {
    return send(res, 500, { error: { code: 'operation_failed', message: error.message } })
  }
  if (!data || data.ok !== true) {
    const typedError = data && data.error && typeof data.error === 'object'
      ? data.error
      : { code: 'operation_failed', message: 'Merge returned no result' }
    return send(res, mergeTaskErrorStatus(typedError.code), { error: typedError })
  }

  if (!preview) {
    notifyTaskMutation('update', survivorTaskId)
    notifyTaskMutation('delete', duplicateTaskId)
  }
  return send(res, 200, data)
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

// --- Subtask handlers -------------------------------------------------------

async function findTaskForSubtasks(id, fields = 'id,title,subtasks') {
  const { supabase, userId } = ctx
  return await supabase
    .from('tasks')
    .select(fields)
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .maybeSingle()
}

async function handleGetSubtasks(id, res) {
  const { data: existing, error } = await findTaskForSubtasks(id, 'id,title,subtasks')
  if (error) return send(res, 500, { error: error.message })
  if (!existing) return send(res, 404, { error: 'not found' })
  send(res, 200, {
    ok: true,
    task: { id: existing.id, title: existing.title },
    subtasks: normalizeSubtasks(existing.subtasks),
  })
}

async function handleCreateSubtask(id, req, res) {
  const { supabase, userId } = ctx
  const body = await readJsonBody(req)
  const metadata = validateSubtaskMutationMetadata(body)
  if (!metadata.ok) return send(res, 400, { error: metadata.error })
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return send(res, 400, { error: 'title required' })
  const order = body.order === undefined ? null : Number(body.order)
  if (order !== null && (!Number.isInteger(order) || order < 0)) {
    return send(res, 400, { error: 'order must be a non-negative integer' })
  }
  const { data: existing, error } = await findTaskForSubtasks(id)
  if (error) return send(res, 500, { error: error.message })
  if (!existing) return send(res, 404, { error: 'not found' })

  const key = metadata.requestId && receiptKey(userId, id, metadata.requestId)
  if (!metadata.preview && key && replaySubtaskResponse(key, res)) return
  const now = new Date().toISOString()
  const deterministicId = metadata.requestId
    ? deterministicSubtaskId(userId, id, metadata.requestId)
    : crypto.randomUUID()
  const persisted = normalizeSubtasks(existing.subtasks).find((item) => item.id === deterministicId)
  if (!metadata.preview && persisted) {
    const response = {
      ok: true, preview: false, subtask: persisted,
      receipt: buildSubtaskReceipt('create', id, persisted, metadata.requestId, true),
    }
    if (key) rememberSubtaskResponse(key, response)
    return send(res, 200, response)
  }
  const subtask = {
    id: deterministicId, parentTaskId: id, title, description: '',
    completedPomodoros: 0, isCompleted: false, createdAt: now, updatedAt: now,
  }
  const current = normalizeSubtasks(existing.subtasks)
  const insertAt = order === null ? current.length : Math.min(order, current.length)
  const updatedSubtasks = [...current]
  updatedSubtasks.splice(insertAt, 0, subtask)
  const response = {
    ok: true, preview: metadata.preview, subtask,
    receipt: buildSubtaskReceipt('create', id, subtask, metadata.requestId),
  }
  if (metadata.preview) return send(res, 200, response)
  const { error: updateError } = await supabase.from('tasks')
    .update({ subtasks: updatedSubtasks, updated_at: now })
    .eq('id', id).eq('user_id', userId).eq('is_deleted', false)
  if (updateError) return send(res, 500, { error: updateError.message })
  rememberSubtaskResponse(key, response)
  send(res, 200, response)
}

async function handlePatchSubtask(id, subtaskId, req, res) {
  const { supabase, userId } = ctx
  const body = await readJsonBody(req)
  const metadata = validateSubtaskMutationMetadata(body)
  if (!metadata.ok) return send(res, 400, { error: metadata.error })
  const { data: existing, error } = await findTaskForSubtasks(id)
  if (error) return send(res, 500, { error: error.message })
  if (!existing) return send(res, 404, { error: 'not found' })
  const current = normalizeSubtasks(existing.subtasks)
  const index = current.findIndex((item) => item.id === subtaskId)
  if (index === -1) return send(res, 404, { error: 'subtask not found' })

  const key = metadata.requestId && receiptKey(userId, id, metadata.requestId)
  if (!metadata.preview && key && replaySubtaskResponse(key, res)) return
  const requestedOrder = body.order === undefined ? null : Number(body.order)
  const alreadyApplied = !metadata.preview
    && (body.title === undefined || (typeof body.title === 'string' && current[index].title === body.title.trim()))
    && (body.completed === undefined || current[index].isCompleted === body.completed)
    && (requestedOrder === null || requestedOrder === index)
  if (alreadyApplied) {
    const response = {
      ok: true, preview: false, subtask: current[index],
      receipt: buildSubtaskReceipt('update', id, current[index], metadata.requestId, true),
    }
    if (key) rememberSubtaskResponse(key, response)
    return send(res, 200, response)
  }
  const updated = { ...current[index], updatedAt: new Date().toISOString() }
  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return send(res, 400, { error: 'title cannot be empty' })
    updated.title = title
  }
  if (body.completed !== undefined) {
    if (typeof body.completed !== 'boolean') return send(res, 400, { error: 'completed must be a boolean' })
    updated.isCompleted = body.completed
  }
  const order = requestedOrder
  if (order !== null && (!Number.isInteger(order) || order < 0)) {
    return send(res, 400, { error: 'order must be a non-negative integer' })
  }
  if (body.title === undefined && body.completed === undefined && order === null) {
    return send(res, 400, { error: 'provide at least one field to update' })
  }
  const updatedSubtasks = current.filter((item) => item.id !== subtaskId)
  updatedSubtasks.splice(order === null ? index : Math.min(order, updatedSubtasks.length), 0, updated)
  const response = {
    ok: true, preview: metadata.preview, subtask: updated,
    receipt: buildSubtaskReceipt('update', id, updated, metadata.requestId),
  }
  if (metadata.preview) return send(res, 200, response)
  const { error: updateError } = await supabase.from('tasks')
    .update({ subtasks: updatedSubtasks, updated_at: updated.updatedAt })
    .eq('id', id).eq('user_id', userId).eq('is_deleted', false)
  if (updateError) return send(res, 500, { error: updateError.message })
  rememberSubtaskResponse(key, response)
  send(res, 200, response)
}

async function handleDeleteSubtask(id, subtaskId, req, res) {
  const { supabase, userId } = ctx
  const body = await readJsonBody(req)
  const metadata = validateSubtaskMutationMetadata(body)
  if (!metadata.ok) return send(res, 400, { error: metadata.error })
  const { data: existing, error } = await findTaskForSubtasks(id)
  if (error) return send(res, 500, { error: error.message })
  if (!existing) return send(res, 404, { error: 'not found' })
  const current = normalizeSubtasks(existing.subtasks)
  const key = metadata.requestId && receiptKey(userId, id, metadata.requestId)
  const subtask = current.find((item) => item.id === subtaskId)
  if (!subtask) {
    if (!metadata.preview && metadata.requestId) {
      const missing = { id: subtaskId }
      const response = {
        ok: true, preview: false, subtask: missing,
        receipt: buildSubtaskReceipt('delete', id, missing, metadata.requestId, true),
      }
      if (key) rememberSubtaskResponse(key, response)
      return send(res, 200, response)
    }
    return send(res, 404, { error: 'subtask not found' })
  }

  if (!metadata.preview && key && replaySubtaskResponse(key, res)) return
  const updatedSubtasks = current.filter((item) => item.id !== subtaskId)
  const response = {
    ok: true, preview: metadata.preview, subtask,
    receipt: buildSubtaskReceipt('delete', id, subtask, metadata.requestId),
  }
  if (metadata.preview) return send(res, 200, response)
  const { error: updateError } = await supabase.from('tasks')
    .update({ subtasks: updatedSubtasks, updated_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', userId).eq('is_deleted', false)
  if (updateError) return send(res, 500, { error: updateError.message })
  rememberSubtaskResponse(key, response)
  send(res, 200, response)
}

async function handleSubtaskBatch(id, req, res) {
  const { supabase, userId } = ctx
  const body = await readJsonBody(req)
  const metadata = validateSubtaskMutationMetadata(body)
  if (!metadata.ok) return send(res, 400, { error: metadata.error })
  if (!Array.isArray(body.operations) || body.operations.length < 1 || body.operations.length > 50) {
    return send(res, 400, { error: 'operations must contain 1 to 50 items' })
  }
  const { data: existing, error } = await findTaskForSubtasks(id)
  if (error) return send(res, 500, { error: error.message })
  if (!existing) return send(res, 404, { error: 'not found' })
  const key = metadata.requestId && receiptKey(userId, id, metadata.requestId)
  if (!metadata.preview && key && replaySubtaskResponse(key, res)) return
  const now = new Date().toISOString()
  const applied = applySubtaskOperations(
    userId,
    id,
    metadata.requestId,
    normalizeSubtasks(existing.subtasks),
    body.operations,
    now,
  )
  if (!applied.ok) return send(res, 400, { error: applied.error })
  const response = {
    ok: true,
    preview: metadata.preview,
    operations: applied.results,
    receipt: {
      requestId: metadata.requestId || null,
      action: 'batch',
      taskId: id,
      operationCount: applied.results.length,
      replayed: false,
    },
  }
  if (metadata.preview) return send(res, 200, response)
  const { error: updateError } = await supabase.from('tasks')
    .update({ subtasks: applied.subtasks, updated_at: now })
    .eq('id', id).eq('user_id', userId).eq('is_deleted', false)
  if (updateError) return send(res, 500, { error: updateError.message })
  rememberSubtaskResponse(key, response)
  send(res, 200, response)
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
      return await handleNotionTaskActivation(req, res)
    }
    const doneForNowMatch = path.match(/^\/api\/tasks\/([^/]+)\/done-for-now$/)
    if (req.method === 'POST' && doneForNowMatch) {
      return await handleDoneForNow(decodeURIComponent(doneForNowMatch[1]), req, res)
    }
    const mergeTasksMatch = path.match(/^\/api\/tasks\/([^/]+)\/merge$/)
    if (req.method === 'POST' && mergeTasksMatch) {
      return await handleMergeTasks(decodeURIComponent(mergeTasksMatch[1]), req, res)
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
    const subtasksMatch = path.match(/^\/api\/tasks\/([^/]+)\/subtasks$/)
    if (req.method === 'GET' && subtasksMatch) {
      return await handleGetSubtasks(decodeURIComponent(subtasksMatch[1]), res)
    }
    if (req.method === 'POST' && subtasksMatch) {
      return await handleCreateSubtask(decodeURIComponent(subtasksMatch[1]), req, res)
    }
    const subtaskBatchMatch = path.match(/^\/api\/tasks\/([^/]+)\/subtasks\/batch$/)
    if (req.method === 'POST' && subtaskBatchMatch) {
      return await handleSubtaskBatch(decodeURIComponent(subtaskBatchMatch[1]), req, res)
    }
    const subtaskDeleteMatch = path.match(/^\/api\/tasks\/([^/]+)\/subtasks\/([^/]+)\/delete$/)
    if (req.method === 'POST' && subtaskDeleteMatch) {
      return await handleDeleteSubtask(
        decodeURIComponent(subtaskDeleteMatch[1]),
        decodeURIComponent(subtaskDeleteMatch[2]),
        req,
        res,
      )
    }
    const subtaskMatch = path.match(/^\/api\/tasks\/([^/]+)\/subtasks\/([^/]+)$/)
    if (req.method === 'PATCH' && subtaskMatch) {
      return await handlePatchSubtask(
        decodeURIComponent(subtaskMatch[1]),
        decodeURIComponent(subtaskMatch[2]),
        req,
        res,
      )
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
