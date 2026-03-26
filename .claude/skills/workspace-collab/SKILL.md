---
name: workspace-collab
description: "Guide implementation of multi-user workspace collaboration for FlowState (TASK-1533 epic, 26 sub-tasks). Use when working on ANY task from TASK-1533 through TASK-1559, or when touching workspace switching, invite flows, task assignment, task comments, workspace presence, multi-tenant RLS policies, tombstone visibility, cross-tab workspace isolation, or offline sync queue workspace scoping. Also triggers on: 'workspace', 'collaboration', 'shared workspace', 'invite member', 'workspace_id', 'assigned_to', 'task comments', 'presence online', 'workspace RLS'. This skill contains locked-in architectural decisions that MUST be followed — deviating risks data leakage between workspaces."
---

# Workspace Collaboration Implementation Guide

This skill contains the complete architectural blueprint for FlowState's multi-user workspace collaboration system. Every decision documented here has been researched, validated, and locked in. Follow these patterns exactly — they exist to prevent data leakage, sync corruption, and RLS bypass.

## Current State (~60% Built)

Before implementing anything, understand what already exists:

| Component | Status | Location |
|-----------|--------|----------|
| DB migration (tables, columns, RLS) | Applied locally | `supabase/migrations/20260317000000_workspace_collaboration.sql` |
| Workspace tables (5) | Exist in local DB | `workspaces`, `workspace_members`, `workspace_invites`, `task_comments`, `workspace_activity` |
| `workspace_id` + `assigned_to` on tasks | Columns exist | `tasks` table |
| Pinia workspace store | 324 lines, functional | `src/stores/workspace.ts` |
| Sidebar workspace switcher | 768 lines, complete | `src/components/sidebar/SidebarWorkspaceSwitcher.vue` |
| Workspace types | 38 lines | `src/types/workspace.ts` |
| Supabase mappers | Updated | `src/utils/supabaseMappers.ts` (lines 379, 412, 455, 471, 576, 661) |
| DB composables (tasks/groups/projects) | Accept `workspaceId` param | `useTasksDatabase.ts`, `useGroupsDatabase.ts`, `useProjectsDatabase.ts` |
| Sync orchestrator | Captures workspace at enqueue | `src/composables/sync/useSyncOrchestrator.ts` (lines 30-39, 280-282, 785) |
| Realtime subscriptions | Workspace-aware filters | `src/composables/supabase/useRealtimeSubscription.ts` (lines 13-28) |
| App initialization | Passes activeWorkspaceId | `src/composables/app/useAppInitialization.ts` (line 846) |

**CRITICAL**: The VPS production database state must be verified before any workspace feature goes live. Run:
```bash
ssh -i ~/.ssh/id_ed25519 ${VPS_USER:-root}@${VPS_HOST} \
  "docker exec supabase-db psql -U postgres -c \"SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='workspaces'\""
```

## Phase Map

| Phase | Tasks | Status | Risk |
|-------|-------|--------|------|
| 1. Foundation (DB + stores) | TASK-1534→1546 | ~80% done | 3/5 |
| 2. Sync Safety | TASK-1547→1550 | ~90% done | **4/5** |
| 3. Collaboration Features | TASK-1551→1554 | ~30% done | 2/5 |
| 4. Polish & UX | TASK-1555→1559 | ~10% done | 1/5 |

---

## Architectural Decisions (LOCKED IN)

These are non-negotiable. Do not deviate without explicit user approval.

### 1. RLS Pattern — SECURITY DEFINER Helper

All RLS policies use a centralized membership lookup function. This avoids recursive RLS on `workspace_members` and is the Supabase-recommended pattern.

```sql
-- Place in `private` schema to prevent direct client access
CREATE OR REPLACE FUNCTION private.user_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wm.workspace_id
  FROM public.workspace_members wm
  WHERE wm.user_id = auth.uid()
    AND wm.deleted_at IS NULL
$$;

REVOKE ALL ON FUNCTION private.user_workspace_ids() FROM public;
GRANT EXECUTE ON FUNCTION private.user_workspace_ids() TO authenticated;
```

**Every table policy follows this shape:**
```sql
CREATE POLICY "entity_select" ON public.entity
FOR SELECT TO authenticated
USING (
  -- Personal rows (no workspace)
  (workspace_id IS NULL AND user_id = auth.uid())
  OR
  -- Shared workspace rows
  (workspace_id IS NOT NULL AND workspace_id = ANY(ARRAY(SELECT private.user_workspace_ids())))
);
```

**Required index**: `CREATE INDEX ON workspace_members (user_id, workspace_id);`

**Tables that stay user_id only (intentionally personal)**:
- `timer_sessions`, `pomodoro_history` — timer is personal
- `user_settings` — per-user preferences
- `user_gamification`, `user_challenges` — dormant but personal
- `ai_conversations` — personal AI chat
- `push_subscriptions` — per-device

### 2. Tombstones — Workspace-Scoped Visibility

Tombstones MUST carry `workspace_id` so all workspace members can see deletions. Without this, User B's sync will miss User A's deletes on shared tasks, causing ghost resurrection.

```sql
-- The tombstone table needs workspace_id
ALTER TABLE tombstones ADD COLUMN workspace_id uuid NULL;

-- Filter tombstones by workspace membership, NOT by actor
-- Old (broken for shared): WHERE user_id = auth.uid()
-- New (correct): WHERE workspace_id IS NULL AND user_id = auth.uid()
--                OR workspace_id = ANY(ARRAY(SELECT private.user_workspace_ids()))
```

`deleted_by` is for audit/attribution only, never for visibility filtering.

### 3. IndexedDB Offline Sync Queue

**IRON RULE: Never derive workspace scope from the active tab at dequeue time.**

Each queued operation is immutable about its workspace:
- `workspace_id: null` = personal workspace (this is the default for all pre-migration entries)
- `workspace_id: "uuid"` = that exact shared workspace

```typescript
// Queue operation shape
interface QueueOp {
  id: string
  entity: 'task' | 'project' | 'group'
  action: 'insert' | 'update' | 'delete'
  workspaceId: string | null  // IMMUTABLE — set at enqueue time, never changed
  entityId: string
  payload: Record<string, unknown>
  createdAt: string
  schemaVersion: number
}
```

**Migration strategy for stale entries:**
1. Stamp all existing entries as `workspace_id: null` (personal)
2. Never auto-inject the current active workspace
3. If user switches workspace while offline, queued writes from workspace A stay tagged as A

### 4. BroadcastChannel — Per-Workspace Isolation

Use separate channels per workspace to prevent cross-workspace reactivity:

```typescript
const channelName = computed(() =>
  workspaceId.value
    ? `flowstate-sync:${workspaceId.value}`
    : 'flowstate-sync:personal'
)

// ALWAYS close old channel before opening new one on workspace switch
function setupBroadcast() {
  teardownBroadcast()
  bc = new BroadcastChannel(channelName.value)
  bc.onmessage = (ev) => {
    // Double-guard: check payload workspace even though channel is scoped
    if (ev.data.workspaceId !== currentWorkspaceId.value) return
    applyRemoteMutation(ev.data)
  }
}
```

### 5. Workspace Switch Sequence

The order matters to prevent race conditions:

```
1. Set `isSwitching = true` (show loading state)
2. Pause outgoing sync queue processing
3. Untrack presence (`channel.untrack()`)
4. Remove Realtime channels (`supabase.removeChannel()`)
5. Close BroadcastChannel
6. Clear workspace-scoped Pinia store state
7. Set new workspace context (route/store)
8. Fetch snapshot for new workspace (tasks, projects, groups)
9. Recreate Realtime channels + BroadcastChannel
10. Resume sync queue
11. Set `isSwitching = false`
```

### 6. Presence — Separate from Data Subscriptions

```typescript
export function useWorkspacePresence(workspaceId: Ref<string | null>, userId: Ref<string>) {
  const channel = ref<any>(null)
  const members = ref<Record<string, any[]>>({})

  const connect = async () => {
    disconnect()
    if (!workspaceId.value) return

    channel.value = supabase.channel(`presence:${workspaceId.value}`, {
      config: { presence: { key: userId.value } },
    })

    channel.value.on('presence', { event: 'sync' }, () => {
      members.value = channel.value.presenceState()
    })

    await channel.value.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await channel.value.track({
          user_id: userId.value,
          workspace_id: workspaceId.value,
          tab_state: document.visibilityState === 'visible' ? 'active' : 'idle',
          online_at: new Date().toISOString(),
        })
      }
    })
  }

  // Tab visibility = 'idle', NOT 'offline'
  // 'offline' only when channel disconnects or heartbeat expires
  document.addEventListener('visibilitychange', () => {
    channel.value?.track({
      tab_state: document.visibilityState === 'visible' ? 'active' : 'idle',
      online_at: new Date().toISOString(),
    })
  })
}
```

### 7. Invite Flow — Hashed Tokens + Edge Function

**Schema:**
```sql
CREATE TABLE public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email citext NOT NULL,
  role text NOT NULL DEFAULT 'member',
  token_hash text NOT NULL UNIQUE,  -- SHA-256 hash, never store raw token
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  accepted_at timestamptz NULL,
  accepted_by uuid NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Security rules:**
- Raw token in the link only, SHA-256 hash in the database
- Email matching: invitee's auth email must match invite email
- One-time use: `accepted_at IS NOT NULL` → reject
- Expiry: `expires_at < now()` → reject
- Revocation: `revoked_at IS NOT NULL` → reject
- Deferred invites: store token in localStorage, accept after signup/login

### 8. Task Comments — Flat + Scoped Subscription

```sql
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL,
  reply_to_comment_id uuid NULL REFERENCES public.task_comments(id) ON DELETE CASCADE,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.task_comments (task_id, created_at);
```

Subscribe only to the task being viewed (not all workspace comments):
```typescript
const channel = supabase
  .channel(`task-comments:${taskId.value}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'task_comments',
    filter: `task_id=eq.${taskId.value}`,
  }, handleCommentChange)
  .subscribe()
```

Optimistic insert: create with client-generated UUID, render immediately, replace on server confirmation or show error on failure.

---

## Files That Need Workspace-Awareness

These files still hardcode `.eq('user_id', userId)` and need updating for shared workspace tasks:

| File | Functions | Action |
|------|-----------|--------|
| `src/composables/supabase/useTasksDatabase.ts` | `fetchDeletedTaskIds`, `safeCreateTaskManual` | Add workspace filter |
| `src/composables/supabase/useGroupsDatabase.ts` | `deleteGroup`, `fetchDeletedGroupIds` | Add workspace filter |
| `src/composables/supabase/useProjectsDatabase.ts` | `fetchDeletedProjectIds` | Add workspace filter |
| `src/composables/supabase/_tombstone.ts` | Tombstone queries | Add workspace_id column + filter |
| `src/composables/supabase/usePinnedTasksDatabase.ts` | Pin queries | Needs assessment |
| `src/composables/supabase/useWorkProfileDatabase.ts` | Profile queries | Leave as user_id (personal) |
| `src/composables/supabase/useTimerDatabase.ts` | Timer queries | Leave as user_id (personal) |
| `src/composables/supabase/useSettingsDatabase.ts` | Settings queries | Leave as user_id (personal) |
| `src/services/ai/chatPersistence.ts` | Chat queries | Leave as user_id (personal) |
| `src/composables/usePushSubscription.ts` | Push queries | Leave as user_id (personal) |

---

## Critical Risks & Mitigations

### CRITICAL: Stale Queue → Wrong Workspace
**Risk**: Old IndexedDB entries without `workspace_id` get injected with the active workspace at dequeue time, writing personal tasks into a shared workspace.
**Mitigation**: Stamp all existing entries as `workspace_id: null`. Never derive scope from active tab. Add schema version to queue entries.

### CRITICAL: RLS Migration on Production
**Risk**: The migration rewrites 32+ RLS policies. A bug could lock users out or leak data.
**Mitigation**: Verify local migration is correct with RLS test matrix (see Testing). Apply to production only after full local verification. Have rollback migration ready.

### HIGH: Tombstone Cross-Workspace Visibility
**Risk**: User B's sync misses User A's tombstones for shared tasks → ghost resurrection.
**Mitigation**: Add `workspace_id` to tombstones table. Filter by workspace membership, not by actor.

### MEDIUM: Backup Validation False Positives
**Risk**: `fetchDeletedTaskIds` uses `user_id` only — shared deleted tasks won't appear in User B's validation.
**Mitigation**: Update fetch functions to include workspace-scoped queries.

---

## Testing Strategy

### RLS Test Matrix (Minimum Required)

| Test | Expected |
|------|----------|
| User A reads own personal tasks | See only A's tasks where `workspace_id IS NULL` |
| User B reads A's personal tasks | Zero rows returned |
| User A + B in shared workspace, A reads tasks | See shared workspace tasks |
| User C (not member) reads shared tasks | Zero rows returned |
| User A reads workspace_members for own workspace | See all members |
| User A reads workspace_members for other workspace | Zero rows returned |

### E2E with Playwright (Two Users)

```typescript
// Two browser contexts with separate auth
const userA = await browser.newContext({ storageState: 'tests/.auth/user-a.json' })
const userB = await browser.newContext({ storageState: 'tests/.auth/user-b.json' })

// Test: A creates task in shared workspace, B sees it
// Test: A deletes shared task, B's sync picks up tombstone
// Test: Invite flow end-to-end (generate → accept → member appears)
// Test: Presence join/idle/leave
```

### Offline Queue Test

1. Force offline in context A
2. Create a personal task (queued with `workspace_id: null`)
3. Switch to shared workspace
4. Reconnect
5. Assert: queued task was written to personal scope, NOT shared workspace

---

## Sub-Task Reference

### Phase 1: Foundation
- **TASK-1534**: DB migration — workspace tables _(likely done)_
- **TASK-1535**: Add workspace_id to tasks/projects/groups _(likely done)_
- **TASK-1536**: SECURITY DEFINER function _(likely done)_
- **TASK-1537**: Rewrite 32+ RLS policies _(likely done)_
- **TASK-1538**: Realtime publication for new tables _(likely done)_
- **TASK-1539**: Workspace Pinia store _(done — 324 lines)_
- **TASK-1540**: Update supabaseMappers _(done)_
- **TASK-1541**: Task filtering by workspace _(NOT done)_
- **TASK-1542**: Pass workspace to fetchTasks _(done at DB layer)_
- **TASK-1543**: Filter projects by workspace _(done at DB layer, store integration incomplete)_
- **TASK-1544**: Filter canvas groups by workspace _(done at DB layer, store integration incomplete)_
- **TASK-1545**: Workspace switcher UI _(done — 768 lines)_
- **TASK-1546**: Auth integration _(partially done)_

### Phase 2: Sync Safety
- **TASK-1547**: Sync queue workspace_id injection _(done)_
- **TASK-1548**: Realtime workspace-aware subscriptions _(done)_
- **TASK-1549**: Cross-tab sync workspace isolation _(NOT done — main gap)_
- **TASK-1550**: Guest mode isolation _(partially done)_

### Phase 3: Collaboration Features
- **TASK-1551**: Invite flow _(partially done — RPC exists, no email/notification)_
- **TASK-1552**: Task assignment UI _(NOT done — column exists, no UI)_
- **TASK-1553**: Task comments _(NOT done — table exists, no composable/UI)_
- **TASK-1554**: Activity feed _(NOT done — table exists, no composable/UI)_

### Phase 4: Polish
- **TASK-1555**: Partner-friendly UX _(NOT done)_
- **TASK-1556**: Hebrew translations _(NOT done)_
- **TASK-1557**: Member management UI _(NOT done)_
- **TASK-1558**: Empty states _(NOT done)_
- **TASK-1559**: Presence _(NOT done)_

---

## Implementation Checklist

Before claiming any workspace task is done:

- [ ] RLS test matrix passes for the affected table
- [ ] Offline queue entries maintain correct workspace scope
- [ ] Cross-tab broadcast includes workspaceId guard
- [ ] Tombstones use workspace_id for visibility (not user_id)
- [ ] No hardcoded `.eq('user_id')` on shared-entity queries
- [ ] Workspace switch doesn't leak state from previous workspace
- [ ] Guest mode returns empty/disabled workspace state
- [ ] Production VPS migration state verified
