# FlowState Local Task API (TASK-1797)

A tiny **localhost-only** HTTP API so another local app (Life OS Advisor) can
read FlowState tasks for context and create/update them on explicit user
approval. It also exposes a read-only active timer snapshot for the KDE widget,
so timers started in the Electron app are visible locally without waiting for
cloud realtime. No new runtime deps — Node's `http` + the existing
`@supabase/supabase-js`.

It runs in one of two modes:

### Token mode (default in the desktop app) — recommended

The Electron desktop app auto-spawns this sidecar as a `utilityProcess` while
you are signed in so the KDE widget can read the timer bridge. Task endpoints
remain disabled for external apps until you enable **Settings → Account → Local
Task API (Life OS)**. The app forwards your logged-in Supabase session (anon key
+ your access-token JWT), so every query is **RLS-scoped to you** — no
service-role key, nothing secret shipped. Settings shows the port and a
per-machine **bearer token**; paste that token into Life OS.

You don't run anything by hand for this mode — just toggle it on in Settings.

### Service-role mode (standalone, your machine only) — headless / app-closed

For running without the desktop app open (e.g. a headless box). Uses the
service-role key + an explicit user_id from env. **Never bundled into the shipped
app.**

```bash
# VPS production — Doppler provides SUPABASE creds:
FLOW_STATE_USER_ID=<your-prod-user-id> doppler run -- npm run api

# Local self-hosted Supabase:
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key> \
FLOW_STATE_USER_ID=a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11 \
  npm run api
```

Find your prod `user_id` (prints only your own id, no other users):

```bash
doppler run -- bash -c 'curl -s "$VITE_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"' \
  | python3 -c "import sys,json;[print(u['id']) for u in json.load(sys.stdin).get('users',[]) if u.get('email')=='endlessblink@gmail.com']"
```

## Config (env)

| Var | Default | Notes |
|-----|---------|-------|
| `FLOW_STATE_API_PORT` | `5577` | Listen port. |
| `FLOW_STATE_API_TOKEN` | _(unset)_ | If set, requests must send `Authorization: Bearer <token>`. In token mode the Electron app generates & injects one automatically (shown in Settings). |
| `FLOW_STATE_API_MODE` | _(auto)_ | `token` forces token mode; otherwise token mode is auto-selected when spawned as an Electron `utilityProcess`. |
| `FLOW_STATE_USER_ID` | service-role only | Scopes every row (service-role mode). Ignored in token mode (derived from the session). |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | service-role only | REST URL (first non-empty wins). |
| `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SERVICE_KEY` | service-role only | Service-role key (bypasses RLS). |

Both modes bind to `127.0.0.1` only and reject non-loopback `Host` headers
(`403`). In token mode, data routes return `503 { "error": "not signed in" }`
until the app forwards a session (and after sign-out).

## Endpoint contract

### `GET /api/health`
```json
{ "ok": true }
```

### `GET /api/timer/current`
Loopback-only read endpoint used by the KDE widget. It does not require the Life
OS bearer token, but it does require the Electron app to be signed in and to have
forwarded a session to the sidecar.

```json
// active
{ "active": true, "session": {
  "id": "uuid", "task_id": "uuid-or-general", "duration": 1500,
  "remaining_time": 1461, "is_active": true, "is_paused": false,
  "is_break": false, "device_leader_id": "electron-device-id",
  "device_leader_last_seen": "2026-05-27T10:15:00.000Z"
} }

// inactive
{ "active": false, "session": null }
```

### `GET /api/tasks?status=todo&due=today&limit=25`
`status` optional (`todo` / `open` | `done`; omitted = all open). `due` optional
(`today` | `overdue` | `open` for no due date | `YYYY-MM-DD`). Capped at 25 items.
```json
{ "tasks": [
  { "id": "uuid", "title": "Draft Q3 plan", "status": "todo",
    "priority": "high", "dueDate": "2026-06-01", "projectId": "uuid-or-null" }
] }
```

### `GET /api/assistant/context`
Bearer-protected read-only summary for local personal-assistant clients such as
Hermes. It is user-scoped through the same Local Task API auth context and
returns aggregates rather than raw task dumps, full AI chat history, or secrets.
Optional tables fail soft via `available: false` / zero counts so older local
schemas can still serve basic task pressure.

```json
{
  "ok": true,
  "taskPressure": {
    "sampledOpenTasks": 25,
    "todayCount": 1,
    "overdueCount": 12,
    "noDateCount": 4,
    "highPriorityOpenCount": 3,
    "doneLast7DaysCount": 8
  },
  "focusPatterns": {
    "recentTimerSessionCount": 10,
    "completedFocusMinutesApprox": 180,
    "pomodoroHistoryCount30d": 22,
    "quickSortSessionCount30d": 3
  },
  "projectSignals": [
    { "projectId": "uuid", "name": "Arthouse", "openTaskCount": 5 }
  ],
  "assistantMemory": {
    "aiConversationCount30d": 4,
    "projectContextCount": 6,
    "taskContextCount": 12,
    "memoryEventCount30d": 9,
    "clarificationEventCount30d": 2,
    "parameterBeliefCount": 7,
    "recommendationFeedbackCount30d": 1
  }
}
```

### `POST /api/tasks`
`title` required; `priority` ∈ `low|medium|high|null`; `status` defaults to `todo`.
```json
// body
{ "title": "Draft Q3 plan", "description": "", "priority": "high",
  "dueDate": "2026-06-01", "projectId": "uuid-optional" }
// 200
{ "ok": true, "task": { "id": "new-uuid" } }
```

### `PATCH /api/tasks/:id`
Any subset of fields. `status` ∈ `todo|done`. Marking `done` sets `completed_at`
and (unless `progress` is given) `progress: 100`.
```json
// body
{ "status": "done", "title": "…", "priority": "low", "dueDate": "…", "progress": 100 }
// 200
{ "ok": true }
// 404 (unknown id for this user)
{ "error": "not found" }
```

### `GET /api/tasks/:id/instances`
Returns the calendar/time-block instances for one user-owned, non-deleted task.
This is bearer-protected and never returns the full task body.

```json
// 200
{
  "ok": true,
  "task": { "id": "task-uuid", "title": "Draft Q3 plan" },
  "instances": [
    { "id": "instance-uuid", "scheduledDate": "2026-07-08", "scheduledTime": "10:30", "duration": 25 }
  ]
}
// 404 (unknown, cross-user, or deleted task)
{ "error": "not found" }
```

### `POST /api/tasks/:id/instances`
Creates a FlowState calendar task instance/time block after an explicit preview.
This is the scheduling primitive for Hermes: chat asks the question, FlowState
stores/renders the approved block.

Required body:

```json
{
  "scheduledDate": "2026-07-08",
  "scheduledTime": "10:30",
  "duration": 25,
  "preview": true
}
```

Preview is safe and non-mutating. If `preview` is omitted, the endpoint defaults
to preview mode.

```json
// preview response
{
  "ok": true,
  "preview": true,
  "task": { "id": "task-uuid", "title": "Draft Q3 plan" },
  "instance": {
    "id": "new-instance-uuid",
    "scheduledDate": "2026-07-08",
    "scheduledTime": "10:30",
    "duration": 25
  }
}
```

Apply only after user approval:

```json
// body
{ "scheduledDate": "2026-07-08", "scheduledTime": "10:30", "duration": 25, "preview": false }

// 200
{
  "ok": true,
  "preview": false,
  "task": { "id": "task-uuid", "title": "Draft Q3 plan" },
  "instance": {
    "id": "new-instance-uuid",
    "scheduledDate": "2026-07-08",
    "scheduledTime": "10:30",
    "duration": 25
  }
}
```

Safety notes:

- Verifies the task exists, belongs to the Local API auth user, and is not deleted.
- Validates `scheduledDate` as `YYYY-MM-DD`, `scheduledTime` as `HH:mm`, and `duration` as 1-1440 minutes.
- Appends to `tasks.instances[]`, the same calendar instance shape FlowState renders.
- Does not change task status, title, priority, due date, or project.
- Does not overwrite existing instances and does not delete tasks.
- Response includes only task id/title plus the created/proposed instance; it never includes tokens, auth headers, sessions, subtasks, descriptions, or raw backlog dumps.

### `DELETE /api/tasks/:id`
Soft-deletes a task for the current user (`is_deleted=true`, `deleted_at=now`).
```json
// 200
{ "ok": true }
// 404 (unknown, cross-user, or already deleted id)
{ "error": "not found" }
```

Every response is JSON. Errors are `{ "error": "<message>" }` — the handler
never throws past itself.

## Life OS connector (~30 lines)

In token mode the bearer token is **required** — copy it from FlowState's
Settings → Account → Local Task API and set it as `FLOW_STATE_API_TOKEN` for Life OS.

```ts
const BASE = 'http://127.0.0.1:5577'
const TOKEN = process.env.FLOW_STATE_API_TOKEN // from FlowState Settings (token mode)
const headers = { 'Content-Type': 'application/json', ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }) }

export async function getTasks(opts: { status?: 'todo' | 'open' | 'done'; due?: 'today' | 'overdue' | 'open' | string } = {}) {
  const q = new URLSearchParams()
  if (opts.status) q.set('status', opts.status)
  if (opts.due) q.set('due', opts.due)
  const suffix = q.size ? `?${q}` : ''
  const r = await fetch(`${BASE}/api/tasks${suffix}`, { headers })
  return (await r.json()).tasks as Array<{ id: string; title: string; status: string; priority: string | null; dueDate: string | null; projectId: string | null }>
}

export async function createTask(input: { title: string; description?: string; priority?: 'low' | 'medium' | 'high' | null; dueDate?: string; projectId?: string }) {
  const r = await fetch(`${BASE}/api/tasks`, { method: 'POST', headers, body: JSON.stringify(input) })
  return r.json() // { ok, task: { id } }
}

export async function updateTask(id: string, patch: { status?: 'todo' | 'done'; title?: string; priority?: 'low' | 'medium' | 'high' | null; dueDate?: string; progress?: number }) {
  const r = await fetch(`${BASE}/api/tasks/${id}`, { method: 'PATCH', headers, body: JSON.stringify(patch) })
  return r.json() // { ok: true } or { error }
}

export async function deleteTask(id: string) {
  const r = await fetch(`${BASE}/api/tasks/${id}`, { method: 'DELETE', headers })
  return r.json() // { ok: true } or { error }
}
```
