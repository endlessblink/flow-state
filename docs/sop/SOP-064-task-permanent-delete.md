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

### Code Path

**File:** `src/composables/supabase/useTasksDatabase.ts` → `permanentlyDeleteTask()`

```typescript
// CORRECT: Just delete. DB trigger handles tombstone.
await supabase.from('tasks').delete().eq('id', taskId)

// WRONG: Don't also call recordTombstone — causes conflict with DB trigger
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

1. **Never call `recordTombstone('task', ...)` when permanently deleting** — the DB trigger does it
2. **Never add triggers on `tombstones` that modify `tasks`** — causes circular trigger conflict
3. **`recordTombstone()` is still valid for non-task entities** (groups, projects) that don't have BEFORE DELETE triggers
4. **Soft-delete (`is_deleted: true`) and permanent delete (`.delete()`) are separate operations** — soft-delete goes to trash, permanent delete removes the row

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
