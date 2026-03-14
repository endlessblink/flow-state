# SOP-065: Recurrence Scheduler Deduplication

**Created:** 2026-03-14
**Bug:** BUG-1508 (recurring task infinite recreation loop)
**Status:** Active

## Overview

The recurrence scheduler (`useRecurrenceScheduler.ts`) creates clone tasks for recurring tasks whose next due date has arrived. This document explains the deduplication architecture that prevents duplicate clones from being created.

## The Problem

Duplicate recurring task clones are created when the user refreshes the page rapidly. The root cause is a race condition between `createTask`'s async Supabase write and the next page load's `loadFromDatabase`:

```
Refresh 1: loadFromDatabase() → no clone in DB → scheduler creates clone → createTask starts async DB write
Refresh 2 (3s later): loadFromDatabase() → clone from Refresh 1 NOT YET in DB → scheduler creates ANOTHER clone
Refresh 3 (3s later): same pattern → third clone
```

In-memory guards (`hasActiveSuccessor`, `hasTodayClone`) cannot prevent this because `_rawTasks` is rebuilt from scratch on each page load from Supabase, which doesn't have the pending clone yet.

## Architecture: Three-Layer Dedup

### Layer 1: localStorage Lock (cross-refresh, 60s TTL)

```
Key: flowstate-recurrence-lock-YYYY-MM-DD
Value: Unix timestamp (ms) of last scheduler run
TTL: 60 seconds
```

Before processing ANY recurring tasks, the scheduler checks this lock. If a run occurred within 60 seconds (on ANY page load), the scheduler skips entirely. This is the **primary guard** against rapid-refresh duplicates.

**File:** `src/composables/useRecurrenceScheduler.ts:30-40`

### Layer 2: In-Memory Active Successor Check

For each done recurring task, check if ANY non-done task exists in the same recurrence chain. This catches clones that were created in a previous session and are now in `_rawTasks`.

```typescript
const hasActiveSuccessor = taskStore._rawTasks.some(t =>
    !t._soft_deleted &&
    t.status !== 'done' &&
    t.id !== task.id &&
    (t.recurrenceParentId === chainId || t.id === chainId)
)
```

**File:** `src/composables/useRecurrenceScheduler.ts:46-51`

### Layer 3: In-Memory Today-Clone Check

Even if no active successor is found (e.g., the user completed today's clone already), check if any task in the chain has `dueDate` matching today. Uses `substring(0, 10)` to normalize `2026-03-14T00:00:00+00:00` to `2026-03-14`.

```typescript
const hasTodayClone = taskStore._rawTasks.some(t =>
    !t._soft_deleted &&
    (t.recurrenceParentId === chainId || t.id === chainId) &&
    t.id !== task.id &&
    t.dueDate?.substring(0, 10) === today
)
```

**File:** `src/composables/useRecurrenceScheduler.ts:60-65`

## Scheduler Placement

The scheduler runs INSIDE `backgroundRefresh()` in `useAppInitialization.ts`, AFTER `loadFromDatabase()` completes. This ensures `_rawTasks` has fresh Supabase data when Layers 2 and 3 run.

```
App Init → Cache Load → isDataReady=true → backgroundRefresh (fire-and-forget):
  1. loadFromDatabase()     ← fresh data from Supabase
  2. reapplyPendingWrites() ← merge offline changes
  3. processDeferred()      ← scheduler runs HERE
```

**CRITICAL:** The scheduler must NEVER run outside `backgroundRefresh`. Running it on stale cached data (before the Supabase fetch) defeats Layers 2 and 3.

**File:** `src/composables/app/useAppInitialization.ts:322-331`

## Recurrence Chain Model

```
Original Task (done, recurrenceCount: 0, recurrenceParentId: null)
  └─→ Clone 1 (done, recurrenceCount: 1, recurrenceParentId: original.id)
  └─→ Clone 2 (done, recurrenceCount: 2, recurrenceParentId: original.id)
  └─→ Clone 3 (todo, recurrenceCount: 3, recurrenceParentId: original.id)  ← active
```

- `chainId = task.recurrenceParentId || task.id` — the original task's ID ties the chain
- Every clone carries `recurrenceParentId` pointing to the original
- `recurrenceCount` is monotonically increasing (DB-authoritative, not overwritten by smart-merge)

## Status Mapping Gotcha

The app uses `status: 'todo'` internally, but the Supabase mapper stores it as `planned`. When reading back:
- `planned` in DB → `planned` in `_rawTasks` (NOT converted to `todo`)
- The scheduler checks `t.status !== 'done'` — `planned !== done` is true, so the successor IS found

## Cleanup Runbook

If duplicate recurring clones appear in production:

```bash
# 1. Diagnose — find duplicates
doppler run -- node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase.from('tasks').select('id, title, due_date, recurrence_count, created_at')
    .eq('is_deleted', false).not('recurrence_rule', 'is', null).order('title').order('created_at');
  const groups = new Map();
  for (const t of data) {
    const key = t.title + '|' + (t.due_date ? t.due_date.substring(0, 10) : 'null');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  for (const [key, g] of groups) {
    if (g.length > 1) console.log(key.slice(0,50), '- dupes:', g.length - 1);
  }
})();
"

# 2. Clean — soft-delete duplicates (keep oldest)
doppler run -- node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { data } = await supabase.from('tasks').select('id, title, due_date, created_at')
    .eq('is_deleted', false).not('recurrence_rule', 'is', null).order('title').order('created_at');
  const groups = new Map();
  for (const t of data) {
    const key = t.title + '|' + (t.due_date ? t.due_date.substring(0, 10) : 'null');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const ids = [];
  for (const [, g] of groups) { if (g.length > 1) ids.push(...g.slice(1).map(r => r.id)); }
  if (ids.length === 0) { console.log('No duplicates!'); return; }
  console.log('Soft-deleting', ids.length, 'duplicates...');
  await supabase.from('tasks')
    .update({ is_deleted: true, deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .in('id', ids);
  console.log('Done!');
})();
"
```

## Related

- `src/composables/useRecurrenceScheduler.ts` — scheduler implementation
- `src/composables/app/useAppInitialization.ts:322-331` — scheduler placement
- `src/stores/tasks/taskOperations.ts:476-528` — clone-on-complete (inline path)
- `src/stores/tasks/taskPersistence.ts:339` — `DB_AUTHORITATIVE_FIELDS` includes `recurrenceCount`
- `docs/sop/SOP-064-task-permanent-delete.md` — tombstone architecture (related to chain termination)
