/**
 * TASK-1814 — LIVE real-integration smoke test for the subscription bridge.
 *
 * Proves the full real chain in one run: real prod Supabase auth → real VPS bridge
 * (https://in-theflow.com/ai-bridge) → real Claude AND Codex → a real tool-call comes
 * back. This is the piece the stubbed Playwright e2e cannot cover. It makes exactly
 * TWO live subscription calls (one claude, one codex).
 *
 * RUN (you, with Doppler so prod creds are present — the assistant is blocked from them):
 *   doppler run -- node tests/manual/live-bridge-smoke.mjs
 *
 * Needs in env (Doppler provides): VITE_SUPABASE_URL (or SUPABASE_URL),
 * VITE_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY), SUPABASE_SERVICE_ROLE_KEY.
 * Creates a throwaway test user on prod auth and DELETES it at the end.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://api.in-theflow.com').replace(/\/$/, '')
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const BRIDGE_URL = (process.env.VITE_AI_BRIDGE_URL || 'https://in-theflow.com/ai-bridge').replace(/\/$/, '')

if (!ANON || !SERVICE_ROLE) {
  console.error('❌ Missing creds. Run with:  doppler run -- node tests/manual/live-bridge-smoke.mjs')
  console.error(`   SUPABASE_URL=${SUPABASE_URL}  anon=${ANON ? 'set' : 'MISSING'}  service_role=${SERVICE_ROLE ? 'set' : 'MISSING'}`)
  process.exit(2)
}

const TEST_EMAIL = `bridge-smoke-${Date.now()}@flowstate.test`
const TEST_PASSWORD = `Sm0ke!${Date.now()}aB`

// Compact version of the app's text-tools system prompt (TASK-1814 framing).
const SYSTEM = [
  'You are FlowState AI, the assistant INSIDE the FlowState task app.',
  '## TOOL USE — you act THROUGH the app (no native/MCP tools).',
  'You are wired into FlowState: every tool call you emit IS executed against the user\'s REAL task database and results return to you. You DO have full access to the user\'s tasks. NEVER claim you lack access, NEVER ask where tasks are stored.',
  'To act, output a line containing EXACTLY one tool call (and nothing else): tool_name({"param":"value"})',
  'Tools: list_tasks(status?), get_overdue_tasks(), search_tasks(query), mark_task_done(task), create_task(title,dueDate?)',
  'EXAMPLE: "what are my overdue tasks?" -> get_overdue_tasks({})',
  'Current tasks (sample): "Design landing page" (high), "Buy groceries" (low).',
].join('\n')

const TOOL_RE = /\b(list_tasks|get_overdue_tasks|search_tasks|mark_task_done|create_task)\s*\(/

async function adminCreateUser() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD, email_confirm: true }),
  })
  if (!r.ok) throw new Error(`createUser failed: ${r.status} ${await r.text()}`)
  return (await r.json()).id
}
async function adminDeleteUser(id) {
  if (!id) return
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}` },
  }).catch(() => {})
}
async function signIn() {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  if (!r.ok) throw new Error(`signIn failed: ${r.status} ${await r.text()}`)
  return (await r.json()).access_token
}
async function callBridge(token, brain, userMsg) {
  const t0 = Date.now()
  const r = await fetch(`${BRIDGE_URL}/v1/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ brain, stream: false, messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userMsg },
    ] }),
  })
  const ms = Date.now() - t0
  if (!r.ok) return { ok: false, ms, detail: `${r.status} ${await r.text()}` }
  const data = await r.json()
  return { ok: true, ms, content: data.content || '', model: data.model }
}

let userId
let exit = 0
try {
  console.log(`▶ creating throwaway prod user ${TEST_EMAIL} …`)
  userId = await adminCreateUser()
  const token = await signIn()
  console.log('▶ got real prod session token. Hitting the LIVE bridge…\n')

  for (const brain of ['claude', 'codex']) {
    const res = await callBridge(token, brain, 'what are my overdue tasks?')
    if (!res.ok) { console.log(`❌ ${brain}: bridge error — ${res.detail}`); exit = 1; continue }
    const emittedTool = TOOL_RE.test(res.content)
    const verdict = emittedTool ? '✅ emitted a tool-call' : '⚠️ no tool-call'
    if (!emittedTool) exit = 1
    console.log(`${verdict}  [${brain}] ${res.ms}ms  model=${res.model}`)
    console.log(`   → ${res.content.replace(/\n/g, ' ').slice(0, 160)}\n`)
  }
} catch (e) {
  console.error('❌ smoke test error:', e.message)
  exit = 1
} finally {
  await adminDeleteUser(userId)
  console.log('▶ cleaned up throwaway user.')
}
console.log(exit === 0 ? '\n🎉 LIVE e2e PASS — real auth → real bridge → real brains emit tool-calls.' : '\n❌ LIVE e2e had failures (see above).')
process.exit(exit)
