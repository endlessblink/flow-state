# Local Agent MCP Architecture

**Status**: Implemented locally through TASK-1806
**Scope**: Local-only desktop agent access
**Last updated**: 2026-05-20

## Decision

FlowState will expose local AI agent access through a thin stdio MCP server backed by a FlowState-owned desktop bridge and agent command layer.

The MCP server must not directly read or write Supabase, IndexedDB, localStorage, or Pinia raw state. It delegates to FlowState commands, and those commands route through existing app state, stores, domain services, sync queue, and validation rules.

Public API access is out of scope for this phase.

## Target Architecture

```text
Local AI Agent
  -> FlowState MCP server over stdio
  -> FlowState desktop bridge
  -> renderer agent command layer
  -> existing Pinia/domain actions
  -> IndexedDB write queue / Supabase / realtime sync
```

The MCP server is a protocol adapter. FlowState remains the authority for behavior, validation, sync, and UI-visible state.

## Threat Model

Primary risks:

- Malicious prompt injection causes the agent to request unsafe actions.
- A local process attempts to call the bridge without user consent.
- A tool bypasses workspace scoping and leaks shared workspace data.
- A tool writes directly to storage and skips sync/tombstone rules.
- A repeated tool call creates duplicate tasks or duplicate edits.
- A write races with realtime or offline sync and clobbers newer state.
- A destructive action deletes or corrupts user data without a clear approval step.

Primary mitigations:

- Use stdio MCP by default, not unauthenticated localhost HTTP.
- Keep the bridge disabled unless local agent access is explicitly enabled.
- Validate every command app-side, even if the MCP schema validates input.
- Scope every operation to either personal workspace or a specific shared workspace.
- Default writes to dry-run diffs before execution.
- Require approval for destructive, bulk, or workspace-affecting writes.
- Log allowed, denied, dry-run, and write operations.
- Route writes through existing app actions and sync paths.

## Hard Bans

Agents and MCP tools must never:

- Use Supabase service-role keys.
- Execute raw SQL.
- Write directly to Supabase tables.
- Write directly to IndexedDB.
- Write directly to localStorage.
- Mutate `_rawTasks`, `_rawProjects`, `_rawGroups`, or other raw Pinia state directly.
- Expose permanent delete tools in the initial local-agent system.
- Treat personal workspace as an unfiltered all-workspaces query.
- Make hidden background writes without audit logging.

## Transport Rules

Preferred transport: stdio MCP.

Why:

- No network listener.
- No DNS rebinding surface.
- No browser-origin confusion.
- Easier per-client launch and shutdown.

If a local loopback bridge is required between MCP and Electron:

- Bind only to `127.0.0.1` or a Unix socket.
- Generate a random per-session token.
- Pass the token only through process environment or an equivalent local-only channel.
- Never log the token.
- Reject requests without the token.
- Reject non-loopback clients.
- Validate `Host` and `Origin` headers if HTTP is used.
- Shut down the bridge when agent access is disabled or the app exits.

## Workspace Scoping

Every command must resolve one of these contexts:

- `personal`: rows where `workspace_id IS NULL`.
- `active`: the currently selected FlowState workspace.
- `workspace:<id>`: a specific shared workspace the current user can access.

Rules:

- `personal` must never mean all workspaces.
- Shared workspace access must be validated against current user membership.
- Cross-workspace reads and writes must be denied.
- Tool outputs must include the workspace context used.
- Write diffs must show the target workspace before approval.

## Read-Only Phase

Initial MCP tools should be read-only:

- `flowstate_get_context`
- `flowstate_list_workspaces`
- `flowstate_get_active_workspace`
- `flowstate_search_tasks`
- `flowstate_get_task`
- `flowstate_list_projects`
- `flowstate_get_today`
- `flowstate_get_sync_status`

Read tools must exclude soft-deleted records by default and clearly report sync/offline status when relevant.

## Local Setup

FlowState's MCP server is launched by an external local agent over stdio:

```bash
npm run mcp:flowstate
```

For a quick tool-surface smoke test without attaching an agent:

```bash
npm run mcp:flowstate -- --list-tools
```

The desktop app owns the actual data bridge. The MCP process needs these environment variables, which are issued only when Local Agent Access is enabled inside the Electron app:

```bash
FLOWSTATE_AGENT_BRIDGE_URL=http://127.0.0.1:<session-port>
FLOWSTATE_AGENT_BRIDGE_TOKEN=<session-token>
```

Do not hardcode these values. Do not store the token in a repo file. The token is per local bridge session and must remain outside the renderer UI and preload public API.

Generic MCP client entry:

```json
{
  "mcpServers": {
    "flowstate": {
      "command": "npm",
      "args": ["run", "mcp:flowstate"],
      "cwd": "/absolute/path/to/flow-state"
    }
  }
}
```

Agent runtime requirements:

- FlowState desktop app must be running.
- Local Agent Access must be enabled in AI settings.
- The MCP client must launch the stdio command from this repo.
- Bridge traffic must stay on loopback HTTP only.
- Tool calls should expect structured denial/error/conflict results and not retry blindly.

Initial manual checks:

1. Start FlowState desktop.
2. Open AI settings and enable Local Agent Access.
3. Run `npm run mcp:flowstate -- --list-tools` and confirm read plus dry-run write tools are listed.
4. From an MCP client, call `flowstate_get_context` and confirm the returned workspace is the expected personal or active workspace.
5. Call a write tool with `dryRun: true`, an explicit `workspace`, and an `idempotencyKey`; confirm it appears in the in-app approval queue instead of mutating data.

## Safe Write Graduation

Write tools may be added only after read-only tools and workspace isolation tests are stable.

Initial write tools:

- `flowstate_create_task`
- `flowstate_update_task`
- `flowstate_complete_task`
- `flowstate_move_task_to_project`
- `flowstate_add_task_comment`
- `flowstate_soft_delete_task`

Required write behavior:

- `dryRun` defaults to `true`.
- Dry-run returns a structured before/after diff.
- Execution requires explicit confirmation or in-app approval.
- Write commands require an `idempotencyKey`.
- Destructive and bulk operations require in-app approval.
- Permanent delete remains unavailable.
- All writes go through existing FlowState actions and sync queue behavior.

Current local implementation exposes write tools as dry-run previews only. Approval decisions are recorded in the local in-app queue; real mutation execution remains intentionally unavailable until a later task wires approval to existing store/domain actions.

## Approval Policy

In-app approval is required for:

- Soft delete.
- Bulk updates.
- Workspace-affecting writes.
- Writes that change due dates, recurrence, project assignment, or canvas placement in bulk.
- Any future operation classified as destructive or high-risk.

Approval UI should show:

- Agent/client name.
- Tool name.
- Workspace.
- Affected records.
- Before/after diff.
- Risk level.
- Deny and approve-once actions.

Session-wide approval may be added later, but only for narrow low-risk operations.

## Audit Requirements

Audit entries should capture:

- Timestamp.
- Agent/client name.
- Transport.
- Tool name.
- Operation type: `read`, `dry_run`, `write`, or `denied`.
- Workspace context.
- Affected entity type and IDs.
- Arguments summary.
- Result status.
- Error or denial reason.

Denied and validation-failed calls are auditable events.

## Testing Requirements

Before any write tool ships, tests must cover:

- Personal workspace isolation.
- Shared workspace membership validation.
- Cross-workspace access denial.
- Soft-deleted records excluded from normal reads.
- Dry-run writes do not mutate app state.
- Confirmed writes route through existing store/domain actions.
- Soft delete does not perform permanent delete.
- Invalid inputs are rejected.
- Repeated idempotency keys do not duplicate operations.
- Offline writes surface queue/sync status correctly.
- Destructive and bulk writes require approval.

## Out of Scope

- Public REST API.
- Remote MCP server.
- OAuth token management for external services.
- Zapier, IFTTT, or webhook integrations.
- Permanent delete through agents.
- Raw database administration tools.

## Next Steps

1. Design `src/domain/agent/` command types and result contracts.
2. Implement read-only command handlers against current app state.
3. Add workspace isolation unit tests before MCP write tools exist.
4. Add stdio MCP server as a thin adapter over the bridge.
