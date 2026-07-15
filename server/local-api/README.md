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
This route is a filtered sample, not an exhaustive inventory. `hasMore=true` is
conservative because the capped route does not prove that the returned page is
the whole matching set.
```json
{ "complete": false, "scope": "filtered_sample", "limit": 25, "hasMore": true,
  "tasks": [
  { "id": "uuid", "title": "Draft Q3 plan", "status": "todo",
    "priority": "high", "dueDate": "2026-06-01", "projectId": "uuid-or-null" }
] }
```

### `GET /api/tasks/inventory?limit=100`

Returns a complete, bearer-protected snapshot of every open task visible in the
authenticated personal or workspace scope. Full mode follows stable keyset pages
internally, verifies that the scoped canonical task change sequence stayed fixed,
and emits `total` only after every page succeeds without a concurrent membership
change. Consumers must require `fresh=true`, `complete=true`, and the stable
`changeSequence` before treating `total` as exact.

For explicit paging, use `mode=page`; pass the opaque `nextCursor` only with that
mode. Stateless page responses always use `complete=false` and never expose a
global `total`, including the terminal page. A failed page also includes a typed
error. Soft-deleted, done, and completion-history rows are excluded.

```json
{
  "source": "flowstate",
  "scope": "all open tasks visible to the authenticated user",
  "capturedAt": "2026-07-14T12:00:00.000Z",
  "appVersion": "1.4.260",
  "fresh": true,
  "complete": true,
  "changeSequence": 12345,
  "total": 61,
  "items": [
    { "id": "uuid", "title": "Draft Q3 plan", "status": "todo",
      "canonicalRevision": 7 }
  ],
  "page": { "limit": 100, "nextCursor": null, "hasMore": false }
}
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

### `GET /api/tasks/search?q=laundry&limit=25`

Searches living task titles in the renderer's exact active workspace. `q` is
required, trimmed, treated literally, and capped at 200 characters; `limit` is
optional and capped at 25. Personal scope is pinned to the signed-in user's
`workspace_id IS NULL` rows. Shared workspace scope relies on the signed-in
client's membership RLS, so collaborator-created rows remain visible.
Completion-history records and soft-deleted rows are excluded.
This route is also a filtered sample and cannot provide an exact total.

```json
{
  "ok": true,
  "query": "laundry",
  "complete": false,
  "scope": "filtered_sample",
  "limit": 25,
  "hasMore": true,
  "tasks": [
    {
      "id": "exact-task-id",
      "title": "Send laundry",
      "status": "todo",
      "priority": "high",
      "dueDate": "2026-07-13",
      "projectId": null,
      "workspaceId": null,
      "recurrenceRule": null,
      "recurrenceParentId": null,
      "recurrenceCount": 0,
      "isCompletionRecord": false,
      "canonicalRevision": 7,
      "updatedAt": "2026-07-13T09:00:00.000Z"
    }
  ]
}
```

### `POST /api/tasks`
Preview-first canonical create. `title` is required; `priority` is
`low|medium|high|null`; `status`, when supplied, must be `planned`. The preview
returns a deterministic `taskId`; apply must echo that exact ID plus the
server-issued approval fields.
```json
// preview body
{ "operationId": "stable-client-operation-id", "baseRevision": 0,
  "payload": { "title": "Draft Q3 plan", "priority": "high" } }

// apply body: copy taskId, previewDigest, previewExpiresAt, and requestHash
// from the exact preview and set preview:false
```

### `PATCH /api/tasks/:id`
Preview-first canonical patch for `title`, `description`, `priority`, `dueDate`,
and `progress`. Obtain `canonicalRevision` from task reads and use it as
`baseRevision`. The preview does not mutate the task.
```json
// preview body
{ "operationId": "stable-client-operation-id", "baseRevision": 7,
  "patch": { "title": "Clarified next action", "priority": "high" } }

// preview response
{ "ok": true, "result": "preview", "contractVersion": "task-v1",
  "operationId": "stable-client-operation-id", "baseRevision": 7,
  "previewDigest": "server-issued-digest", "previewExpiresAt": "…",
  "normalizedPayload": { "title": "Clarified next action", "priority": "high" },
  "readBack": { "id": "task-id", "canonicalRevision": 7 } }
```

After explicit approval, repeat the exact operation, revision, patch, issued
digest, and expiry with `"preview": false`. Success is reported only with a
validated committed receipt containing the canonical revision, change sequence,
read-back projection, and read-back hash. Retrying the same operation is safe
and returns a replayed durable receipt.

Generic status changes are intentionally unsupported. Recurring completion uses
the operation below so history and cadence cannot be bypassed; other completion
flows must use their domain-specific canonical command.

This canonical patch endpoint requires token mode with the signed-in user's JWT.
Standalone service-role mode returns `signed_user_required`; a configured user ID
is not accepted as a substitute for the actor proven by `auth.uid()`.

### `POST /api/integrations/notion/activations`

Preview-first activation of one exact Notion page into personal FlowState. The
request carries a stable operation ID, Notion page/data-source provenance, the
task projection, and an optional exact calendar work block.

```json
{
  "operationId": "stable-global-operation-id",
  "notion": {
    "pageId": "notion-page-id",
    "dataSourceId": "notion-data-source-id",
    "url": "https://www.notion.so/notion-page-id",
    "lastEditedAt": "2026-07-14T08:00:00Z"
  },
  "task": {
    "title": "Clarify the next project action",
    "description": "Bounded context from Notion",
    "priority": "high",
    "dueDate": "2026-07-15T12:00:00Z",
    "projectId": null
  },
  "workBlock": {
    "scheduledDate": "2026-07-14",
    "scheduledTime": "10:30",
    "duration": 25
  }
}
```

Preview is the default and durably binds the exact normalized request to the
returned digest and expiry without creating a task or work block. Apply repeats
the exact body with `"preview": false`, `previewDigest`, and
`previewExpiresAt`. A valid commit returns the `notion-activation-v1` canonical
receipt with task revision, update timestamp, change sequence, read-back hash,
and provenance. Retrying an already committed operation replays that receipt
even after preview expiry.

Active provenance is unique per signed-in user. A later approved operation for
the same Notion page reuses the FlowState task and still appends its optional
exact work block atomically. The route is personal-scope only, rejects
service-role mode, and notifies the renderer only after validating the complete
canonical response.

### `GET /api/tasks/:id`

Returns one exact, user/workspace-scoped task plus its recurrence state and
embedded occurrence instances. This is the read-back endpoint for approved
mutations; a missing, deleted, cross-user, or out-of-workspace task is reported
as `404`.

### `POST /api/tasks/:id/complete`

Completes one exact non-recurring task through the canonical preview/apply
contract (TASK-1958). Preview is the default and performs no writes; it issues
an approval digest bound to the exact request and task revision:

```json
{ "operationId": "stable-client-generated-id", "baseRevision": 3 }
```

The preview response proves the current state (`readBack.status`), states that
`completedAt` will be set (`willSetCompletedAt`), and returns `previewDigest`
plus `previewExpiresAt`. After explicit approval, apply re-sends the exact
binding:

```json
{
  "preview": false,
  "operationId": "stable-client-generated-id",
  "baseRevision": 3,
  "previewDigest": "sha256-hex-from-preview",
  "previewExpiresAt": "timestamp-from-preview"
}
```

Apply is one database transaction that sets `status` to `done`, stamps
`completedAt`, and returns a committed canonical receipt (`action:
"complete"`) with read-back and `readBackHash`. Identical retries replay the
stored receipt. Recurring identity fails closed: a task with a recurrence
rule, a chain parent, or a completion-history record returns `recurring_task`
and must use `done-for-now` instead. Other typed errors include
`not_authenticated`, `not_found`, `already_completed`, `stale_revision`,
`idempotency_conflict`, `preview_mismatch`, `preview_expired`, and
`approval_receipt_required`.

### `POST /api/tasks/:id/done-for-now`

Completes one occurrence without completing the recurring definition. Preview
is the default and performs no writes. It calculates the next date with the
same daily/weekly/monthly/yearly recurrence rules used by the UI and returns a
`previewVersion` tied to the exact task state.

```json
{ "preview": true, "nextDueDate": "2026-07-16" }
```

`nextDueDate` is optional. When omitted, cadence chooses it; when supplied it
must be a later valid occurrence date within the recurrence end condition. The
preview identifies the current date, proposed next date, recurrence rule/count,
and the three writes that apply will make.

After explicit approval, reuse the preview verbatim and add a stable request ID:

```json
{
  "preview": false,
  "nextDueDate": "2026-07-16",
  "previewVersion": "preview-state-hash",
  "requestId": "stable-client-generated-id"
}
```

Apply is one database transaction. It inserts the completed occurrence/history
row, advances the living recurring row, creates exactly one next embedded
occurrence, stores an idempotency receipt, then emits the same renderer
reconciliation notices used by FlowState. Identical retries return the stored
receipt; reusing a request ID with different payload returns
`idempotency_conflict`. A changed task returns `state_conflict` and requires a
new preview. Other typed errors include `not_authenticated`, `not_found`,
`not_recurring`, `already_completed`, `invalid_next_date`,
`approval_receipt_required`, and `recurrence_transaction_failed`.

The receipt contains real completion-record and next-instance IDs, dates,
status, completion time, recurrence count/rule, and request/preview IDs. Search
excludes completion-history rows while the living task remains discoverable;
Today, Inbox, and Canvas consume the advanced living task. The Electron bridge
publishes the active workspace and performs an authoritative reload of affected
IDs, so the running UI updates without a restart while unrelated optimistic
writes remain protected.

This endpoint requires migration `20260713010000_done_for_now_rpc.sql` and a
rebuilt/relaunched Electron application. The transactional RPC intentionally
requires an authenticated user session; service-role headless mode cannot use
it as a substitute for the signed-in app boundary.

### `POST /api/tasks/:survivorId/merge`

Safely consolidates one exact duplicate into one exact survivor. FlowState does
not infer duplicates from titles: callers must supply `duplicateTaskId`, and
preview is mandatory/default before apply.

```json
{ "duplicateTaskId": "duplicate-id", "preview": true }
```

Preview performs no writes. It returns a state-bound `previewVersion`, the
survivor and duplicate identities, the duplicate's `soft_delete` disposition,
and exact counts for work blocks, subtasks, attachments, comments, task context,
Canvas links, and tags to transfer. Recurrence-chain, completion-history,
project, Canvas, schedule, parent, embedded-ID, status, or assistant-context
conflicts are rejected with typed errors instead of choosing silently.

After explicit approval, reuse the exact preview choices:

```json
{
  "duplicateTaskId": "duplicate-id",
  "preview": false,
  "previewVersion": "preview-state-hash",
  "requestId": "stable-client-generated-id"
}
```

Apply runs in one database transaction. It unions compatible embedded work
blocks, subtasks, attachments, tags, reminders, notes, and mini-Canvas edges;
transfers comments, task context, project links, timer/history references, and
representable Canvas links; then soft-deletes the duplicate last. The archived
source row and task audit remain available for history/restore. Identical
retries return the same receipt, while a reused request ID with changed input
returns `idempotency_conflict` and changed live state returns `state_conflict`.
The Electron bridge reconciles the survivor update and duplicate removal in the
running UI without a restart.

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

### Subtasks

`GET /api/tasks/:id/subtasks` lists the ordered embedded subtasks for one task.
`POST /api/tasks/:id/subtasks`, `PATCH /api/tasks/:id/subtasks/:subtaskId`, and
`POST /api/tasks/:id/subtasks/:subtaskId/delete` preview by default. Set
`preview` to `false` and provide a stable `requestId` only after approval.
Applied retries are idempotent and return a receipt without duplicating work.

`POST /api/tasks/:id/subtasks/batch` accepts 1-50 `create`, `update`, or `delete`
operations and applies the approved batch as one task-row update.

### Task lifecycle actions

`POST /api/tasks/:id/delete`, `POST /api/tasks/:id/restore`, and
`POST /api/tasks/:id/reopen` use the same preview/apply contract as create.
Supply the exact current `canonicalRevision` as `baseRevision`. Apply requires
the preview digest, expiry, request hash, and stable operation ID. Receipts prove
the committed revision, change sequence, read-back, and tombstone state.
Recurring tasks cannot use `reopen`; use the recurrence-aware done-for-now
command. The legacy bare `DELETE /api/tasks/:id` mutation is intentionally not
available.

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
