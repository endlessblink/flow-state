/**
 * FlowState AI Bridge (TASK-1814)
 *
 * A tiny, dependency-free HTTP server that wraps the local `claude` and `codex`
 * CLIs so the FlowState web PWA + Electron app can use the user's *subscriptions*
 * (no per-token API billing) as a first-class AI brain.
 *
 * Runs on the VPS behind Caddy at https://<site>/ai-bridge. Both brains are
 * equal peers — the client picks `brain: 'claude' | 'codex'` per request.
 *
 * SECURITY MODEL
 *  - Every request must carry a valid Supabase access token (HS256 JWT signed
 *    with SUPABASE_JWT_SECRET). Unauthenticated requests get 401.
 *  - CORS is locked to ALLOWED_ORIGIN (the app's origin).
 *  - Per-user (JWT `sub`) rate limiting.
 *  - Binds to 127.0.0.1 by default; Caddy terminates TLS and proxies.
 *  - The Claude token is read from CLAUDE_CODE_OAUTH_TOKEN (env file, root-only).
 *    It is NEVER returned to the client or logged.
 *
 * If a brain's credentials are dead, the server responds 502 with
 * { error: 'brain_unavailable' } so the client transparently falls back to Groq.
 *
 * Run: node server.mjs   (env via /root/.flowstate-ai-bridge.env or systemd)
 */

import http from 'node:http'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'

// ── Config ───────────────────────────────────────────────────────────────
const PORT = Number(process.env.AI_BRIDGE_PORT || 8788)
const HOST = process.env.AI_BRIDGE_HOST || '127.0.0.1'
// Comma-separated allowlist + sensible defaults (prod web is same-origin; these
// cover dev localhost and Electron's file:// renderer which sends Origin: null).
const DEFAULT_ORIGINS = ['https://in-theflow.com', 'http://localhost:5546', 'http://localhost:3000', 'null']
const ALLOWED_ORIGINS = (() => {
  const env = (process.env.AI_BRIDGE_ALLOWED_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean)
  return Array.from(new Set([...env, ...DEFAULT_ORIGINS]))
})()
const PRIMARY_ORIGIN = ALLOWED_ORIGINS[0]
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || ''
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '')
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''
const CLAUDE_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN || ''
const REQUESTS_PER_MIN = Number(process.env.AI_BRIDGE_RPM || 30)
const MAX_CLI_MS = Number(process.env.AI_BRIDGE_TIMEOUT_MS || 120_000)
const MAX_BODY_BYTES = 256 * 1024
// Dev escape hatch: when AI_BRIDGE_DEV=1 + no JWT_SECRET, auth is skipped and
// AI_BRIDGE_BRAIN_CMD (e.g. a stub) replaces the real CLIs. Never set in prod.
const DEV = process.env.AI_BRIDGE_DEV === '1'
const STUB_CMD = process.env.AI_BRIDGE_BRAIN_CMD || ''

// ── JWT (HS256) verification — dependency-free ─────────────────────────────
function b64urlToBuf(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

/** Local HS256 verify (used only when SUPABASE_JWT_SECRET is provided). */
function verifyJwtLocal(token) {
  if (!token || !JWT_SECRET) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts
  let header, payload
  try {
    header = JSON.parse(b64urlToBuf(headerB64).toString('utf8'))
    payload = JSON.parse(b64urlToBuf(payloadB64).toString('utf8'))
  } catch { return null }
  if (header.alg !== 'HS256') return null
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest()
  const got = b64urlToBuf(sigB64)
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null
  if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null
  return payload
}

// Positive cache for endpoint validations: token -> { sub, exp(ms) }
const authCache = new Map()
const AUTH_CACHE_TTL_MS = 60_000

/** Validate a Supabase access token via GoTrue /auth/v1/user (server-side sig check). */
async function verifyJwtRemote(token) {
  if (!token) return null
  const hit = authCache.get(token)
  if (hit && Date.now() < hit.cachedUntil) return { sub: hit.sub }
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const user = await r.json()
    if (!user?.id) return null
    authCache.set(token, { sub: user.id, cachedUntil: Date.now() + AUTH_CACHE_TTL_MS })
    return { sub: user.id }
  } catch { return null }
}

/** Returns { sub } if the token is valid, else null. Mode by env config. */
async function authenticate(token) {
  if (DEV && !JWT_SECRET && !SUPABASE_URL) return { sub: 'dev-user' }
  if (JWT_SECRET) return verifyJwtLocal(token)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) return verifyJwtRemote(token)
  return null
}

// ── Per-user rate limiting (in-memory token bucket) ────────────────────────
const buckets = new Map() // sub -> { tokens, ts }
function allow(sub) {
  const now = Date.now()
  const refillPerMs = REQUESTS_PER_MIN / 60_000
  const b = buckets.get(sub) || { tokens: REQUESTS_PER_MIN, ts: now }
  b.tokens = Math.min(REQUESTS_PER_MIN, b.tokens + (now - b.ts) * refillPerMs)
  b.ts = now
  if (b.tokens < 1) { buckets.set(sub, b); return false }
  b.tokens -= 1
  buckets.set(sub, b)
  return true
}

// ── Prompt assembly ────────────────────────────────────────────────────────
function splitMessages(messages) {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n')
  const convo = messages
    .filter(m => m.role !== 'system')
    .map(m => (m.role === 'assistant' ? `Assistant: ${m.content}` : m.content))
    .join('\n\n')
  return { system, prompt: convo || system }
}

// ── CLI invocation (streaming) ──────────────────────────────────────────────
// Both CLIs boot a full agent per call; the slow part is MCP-server startup, so
// we disable it (claude: empty strict mcp-config; codex: --ignore-user-config).
// Claude 38s→~4s, Codex hang→~6s. stdin is closed so codex doesn't block on it.

function looksLikeAuthError(s) {
  return /authentication_error|Invalid authentication|Failed to authenticate|401 .*unauth|not logged in|please run .*login|invalid_grant|token (?:has )?expired/i.test(s)
}

function codedErr(code, msg) { const e = new Error(msg); e.code = code; return e }

function brainCommand(brain, { system, prompt }) {
  if (STUB_CMD) return { cmd: STUB_CMD, args: [brain, prompt], env: process.env }
  if (brain === 'codex') {
    const full = system ? `${system}\n\n${prompt}` : prompt
    // --ignore-user-config skips MCP/config boot; exec defaults: sandbox read-only, approval never.
    return {
      cmd: 'codex',
      args: ['exec', '--skip-git-repo-check', '--ignore-user-config', '--json', full],
      env: process.env,
      cwd: '/tmp',
    }
  }
  // claude: disable MCP boot (the slow part) + stream partial tokens
  const args = [
    '-p', prompt,
    '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
  ]
  if (system) args.push('--append-system-prompt', system)
  const env = { ...process.env }
  if (CLAUDE_TOKEN) env.CLAUDE_CODE_OAUTH_TOKEN = CLAUDE_TOKEN
  return { cmd: 'claude', args, env }
}

/** Incremental text fragment from one parsed JSONL event (null if not text). */
function extractDelta(brain, ev) {
  if (brain === 'codex') {
    // Codex emits the assistant message whole at item.completed
    if (ev?.type === 'item.completed' && ev.item?.type === 'agent_message' && typeof ev.item.text === 'string') {
      return ev.item.text
    }
    return null
  }
  // claude stream-json + partial messages → token deltas
  if (ev?.type === 'stream_event' && ev.event?.type === 'content_block_delta') {
    const t = ev.event.delta?.text
    return typeof t === 'string' ? t : null
  }
  return null
}

/** Full text from a terminal event, used only if no partial deltas streamed. */
function extractFull(brain, ev) {
  if (brain === 'codex') return null // handled by extractDelta
  if (ev?.type === 'assistant' && Array.isArray(ev.message?.content)) {
    return ev.message.content.filter(c => c?.type === 'text').map(c => c.text).join('')
  }
  return null
}

/**
 * Stream a brain response. Calls onDelta(text) as fragments arrive.
 * Resolves { model } on success; rejects with coded error (BRAIN_AUTH/BRAIN_FAIL).
 */
function streamBrain(brain, msgs, onDelta) {
  return new Promise((resolve, reject) => {
    const { cmd, args, env, cwd } = brainCommand(brain, msgs)
    const child = spawn(cmd, args, { env, cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    const model = brain === 'codex' ? 'gpt (codex)' : 'claude'
    let buf = '', stderr = '', emitted = false, fullFallback = '', settled = false

    const finish = (fn) => { if (!settled) { settled = true; clearTimeout(timer); fn() } }
    const timer = setTimeout(() => finish(() => { child.kill('SIGKILL'); reject(codedErr('BRAIN_FAIL', 'timeout')) }), MAX_CLI_MS)

    child.stdout.on('data', (chunk) => {
      buf += chunk.toString()
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        if (STUB_CMD) { emitted = true; onDelta(line + '\n'); continue }
        let ev
        try { ev = JSON.parse(line) } catch { continue }
        const d = extractDelta(brain, ev)
        if (d) { emitted = true; onDelta(d); continue }
        const f = extractFull(brain, ev)
        if (typeof f === 'string' && f) fullFallback = f
      }
    })
    child.stderr.on('data', (d) => { stderr += d.toString() })

    child.on('error', (err) => finish(() => reject(codedErr('BRAIN_FAIL', err.message))))
    child.on('close', (exitCode) => finish(() => {
      if (looksLikeAuthError(stderr + buf)) return reject(codedErr('BRAIN_AUTH', 'auth failed'))
      if (!emitted && fullFallback) { emitted = true; onDelta(fullFallback) }
      if (!emitted) return reject(codedErr('BRAIN_FAIL', (stderr.trim() || `exit ${exitCode}`).slice(0, 200)))
      resolve({ model })
    }))
  })
}

async function collectBrain(brain, msgs) {
  let content = ''
  const { model } = await streamBrain(brain, msgs, (t) => { content += t })
  return { content: content.trim(), model }
}

// ── HTTP plumbing ────────────────────────────────────────────────────────────
function cors(res, origin) {
  const allow = (origin && (ALLOWED_ORIGINS.includes(origin) || DEV)) ? origin : PRIMARY_ORIGIN
  res.setHeader('Access-Control-Allow-Origin', allow)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
}
function json(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json' })
  res.end(JSON.stringify(obj))
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let n = 0, chunks = []
    req.on('data', c => { n += c.length; if (n > MAX_BODY_BYTES) { reject(new Error('body too large')); req.destroy() } else chunks.push(c) })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || ''
  cors(res, origin)
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  if (req.method === 'GET' && req.url === '/health') {
    // Cheap liveness — does NOT call the model (no quota burn).
    return json(res, 200, {
      ok: true,
      brains: { claude: Boolean(CLAUDE_TOKEN || DEV), codex: true },
      origins: ALLOWED_ORIGINS,
    })
  }

  if (req.method !== 'POST' || req.url !== '/v1/chat') return json(res, 404, { error: 'not_found' })

  const auth = req.headers.authorization || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  const claims = await authenticate(token)
  if (!claims) return json(res, 401, { error: 'unauthorized' })
  const sub = claims.sub || 'anon'
  if (!allow(sub)) return json(res, 429, { error: 'rate_limited' })

  let body
  try { body = JSON.parse(await readBody(req)) } catch { return json(res, 400, { error: 'bad_json' }) }
  const brain = body.brain === 'codex' ? 'codex' : 'claude'
  const messages = Array.isArray(body.messages) ? body.messages : []
  if (!messages.length) return json(res, 400, { error: 'no_messages' })
  const { system, prompt } = splitMessages(messages)

  const started = Date.now()

  // Streaming (default): Server-Sent Events with token deltas.
  if (body.stream !== false) {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
    try {
      const { model } = await streamBrain(brain, { system, prompt }, (t) => send({ delta: t }))
      send({ done: true, brain, model })
      console.log(`[ai-bridge] ${brain} ok(stream) sub=${sub.slice(0, 8)} ${Date.now() - started}ms`)
    } catch (e) {
      console.error(`[ai-bridge] ${brain} FAIL sub=${sub.slice(0, 8)} code=${e.code || '?'} ${String(e.message || e).slice(0, 200)}`)
      send({
        error: e.code === 'BRAIN_AUTH' ? 'brain_unavailable' : 'brain_failed',
        reason: e.code === 'BRAIN_AUTH' ? 'auth' : String(e.message || e).slice(0, 120),
        brain,
      })
    }
    res.end()
    return
  }

  // Non-streaming fallback (JSON).
  try {
    const out = await collectBrain(brain, { system, prompt })
    console.log(`[ai-bridge] ${brain} ok sub=${sub.slice(0, 8)} ${Date.now() - started}ms len=${out.content.length}`)
    return json(res, 200, { brain, model: out.model, content: out.content, ms: Date.now() - started })
  } catch (e) {
    console.error(`[ai-bridge] ${brain} FAIL sub=${sub.slice(0, 8)} code=${e.code || '?'} ${String(e.message || e).slice(0, 200)}`)
    if (e.code === 'BRAIN_AUTH') return json(res, 502, { error: 'brain_unavailable', brain, reason: 'auth' })
    return json(res, 502, { error: 'brain_failed', brain, message: String(e.message || e) })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[ai-bridge] listening on http://${HOST}:${PORT}  origins=${ALLOWED_ORIGINS.join(',')}  dev=${DEV}`)
})
