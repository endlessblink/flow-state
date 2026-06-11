# SOP-064: Task Permanent Delete Architecture

**Created:** 2026-03-07
**Bug:** BUG-1477
**Status:** Active

## Overview

Permanent task deletion involves two operations: removing the task row and creating a tombstone (prevents resurrection during sync/restore). The ordering and interaction of these operations is critical.

## Architecture

### Database Triggers on `tasks` Table

| Trigger | Type | Function | Purpose |
|---------|------|----------|---------|
| `trg_task_tombstone` | BEFORE DELETE | `create_task_tombstone()` | Auto-creates tombstone when task row is deleted |
| `update_tasks_updated_at` | BEFORE UPDATE | `update_updated_at_column()` | Timestamps |
| `trigger_increment_task_position_version` | BEFORE UPDATE | `increment_task_position_version()` | Canvas sync |

### Delete Flow

```
App calls: supabase.from('tasks').delete().eq('id', taskId)
  └─→ BEFORE DELETE trigger: trg_task_tombstone
       └─→ INSERT INTO tombstones (upsert)
  └─→ Row deleted
```

The `trg_task_tombstone` trigger handles tombstone creation automatically. **The app code must NOT call `recordTombstone()` separately** — doing so is redundant and was the source of BUG-1477.

Exception: if `.delete().select('id')` returns zero rows, first run a fallback
`select('id').eq('id', taskId).maybeSingle()`. If that fallback returns a visible
row, surface a DELETE-policy/RLS failure. If it returns no row and no error, the
task is already absent or inaccessible to this session; treat the delete as
idempotently complete and upsert a permanent task tombstone to stop local-cache
resurrection. Do not create this fallback tombstone when the fallback select
itself errors.

### Code Path

**File:** `src/composables/supabase/useTasksDatabase.ts` → `permanentlyDeleteTask()`

```typescript
const { data, error } = await supabase.from('tasks').delete().eq('id', taskId).select('id')
if (error) throw error
if (data?.length) return // DB trigger handled tombstone

const { data: stillThere, error: visibilityError } = await supabase
  .from('tasks')
  .select('id')
  .eq('id', taskId)
  .maybeSingle()
if (visibilityError) throw visibilityError
if (stillThere) throw new Error('visible task row was not deleted')

// Only the already-absent zero-row path writes this manual anti-resurrection tombstone.
await supabase.from('tombstones').upsert({ user_id, entity_type: 'task', entity_id: taskId })
```

## Bug History

### BUG-1477: Zombie Tasks (Mar 2026)

**Symptom:** Deleted tasks reappeared after page reload.

**Root Cause (original, pre-fix):** `permanentlyDeleteTask` called `recordTombstone()` FIRST, then `.delete()`. If the delete failed (network/timeout), the tombstone existed but the task row remained with `is_deleted: false`. The app loads tasks with `is_deleted = false` and showed the "zombie".

**Root Cause (trigger conflict):** After reversing the order (delete first, tombstone second), adding an AFTER INSERT trigger on `tombstones` to auto-delete task rows caused PostgreSQL error 27000: "tuple to be deleted was already modified by an operation triggered by the current command". The `trg_task_tombstone` BEFORE DELETE trigger on `tasks` already inserts a tombstone during the DELETE — our AFTER INSERT trigger on `tombstones` then tried to DELETE the same row again.

**Fix:**
1. Removed manual `recordTombstone()` call from `permanentlyDeleteTask()` — the `trg_task_tombstone` DB trigger handles it
2. Removed the redundant AFTER INSERT trigger on `tombstones`
3. Retroactive cleanup removed 9 zombie tasks from production, 16 from local

## Rules

1. **Never call `recordTombstone('task', ...)` after a successful task delete** — the DB trigger does it
2. **Never add triggers on `tombstones` that modify `tasks`** — causes circular trigger conflict
3. **`recordTombstone()` is still valid for non-task entities** (groups, projects) that don't have BEFORE DELETE triggers
4. **Soft-delete (`is_deleted: true`) and permanent delete (`.delete()`) are separate operations** — soft-delete goes to trash, permanent delete removes the row
5. **Zero-row task deletes are idempotent only after fallback visibility check** — visible rows still fail; fallback select errors still fail; absent rows get a permanent tombstone

## Diagnostic

If a task keeps reappearing after deletion:

```sql
-- Check if task exists in DB
SELECT id, title, is_deleted FROM tasks WHERE id = '<task-id>';

-- Check if tombstone exists
SELECT * FROM tombstones WHERE entity_id = '<task-id>';

-- If task exists WITH tombstone: zombie bug — delete manually
DELETE FROM tasks WHERE id = '<task-id>';

-- List all triggers on tasks table
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid = 'tasks'::regclass AND NOT tgisinternal;
```
