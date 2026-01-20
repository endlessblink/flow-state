# SOP-013: Immutable Task ID System

**Created**: 2026-01-20
**Status**: Active
**Related Task**: TASK-344

---

## Overview

The Immutable Task ID System ensures that every task has a globally unique identifier that can NEVER be reused by the system. Once a task ID is created, that ID is permanently reserved - even after the task is deleted.

This prevents:
- Duplicate tasks created by sync operations
- Zombie tasks resurrected from backup restores
- Race conditions during concurrent task creation
- System-generated duplicates (Claude Code automation, imports)

## Core Principle

```
┌─────────────────────────────────────────────────────────────────────┐
│              TASK ID LIFECYCLE (IMMUTABLE)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Task Created                                                       │
│       │                                                              │
│       ▼                                                              │
│   ┌──────────────┐                                                   │
│   │ ID = UUID    │ ◄─── crypto.randomUUID()                          │
│   │ e.g. abc-123 │      Always generates NEW unique ID               │
│   └──────────────┘                                                   │
│       │                                                              │
│       ├──────────────────────────────────────────────────┐           │
│       ▼                                                  ▼           │
│   ACTIVE STATE                                     SOFT-DELETED      │
│   (tasks table)                                    (is_deleted=true) │
│   ID is RESERVED                                   ID is RESERVED    │
│       │                                                  │           │
│       └──────────────────────────────────────────────────┤           │
│                                                          ▼           │
│                                                    HARD-DELETED      │
│                                                    (removed from     │
│                                                     tasks table)     │
│                                                          │           │
│                                                          ▼           │
│                                                    ┌─────────────┐   │
│                                                    │ TOMBSTONE   │   │
│                                                    │ Created     │   │
│                                                    │ (permanent) │   │
│                                                    └─────────────┘   │
│                                                    ID is RESERVED    │
│                                                    FOREVER           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Who Can Create Tasks?

| Actor | Creates New ID? | Can Use Existing ID? |
|-------|-----------------|----------------------|
| User (UI action) | Yes, always new UUID | No |
| User (duplicate action) | Yes, always new UUID | No |
| Backup Restore | No | Blocked if exists/tombstoned |
| Sync Operation | No | Blocked if exists/tombstoned |
| Import Tool | No | Blocked if exists/tombstoned |
| Undo/Redo | Yes (uses original ID) | Only for undo of recent delete |

## Implementation Layers

### Layer 1: Database (PostgreSQL/Supabase)

**Migration**: `supabase/migrations/20260120000002_immutable_task_ids.sql`

#### Permanent Tombstones

```sql
-- Task tombstones never expire (NULL expires_at)
ALTER TABLE public.tombstones ALTER COLUMN expires_at DROP NOT NULL;

UPDATE public.tombstones
SET expires_at = NULL
WHERE entity_type = 'task';
```

#### Auto-Tombstone Trigger

```sql
-- Automatically create tombstone when task is hard-deleted
CREATE TRIGGER trg_task_tombstone
    BEFORE DELETE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION create_task_tombstone();
```

#### Safe Create RPC Function

```sql
-- Transaction-safe task creation with duplicate/tombstone check
CREATE FUNCTION safe_create_task(
    p_task_id uuid,
    p_user_id uuid,
    p_title text,
    -- ... other params
) RETURNS jsonb AS $$
BEGIN
    -- 1. Check if task exists (active or soft-deleted)
    -- 2. Check if task is tombstoned
    -- 3. Only insert if both checks pass
    -- 4. Handle race conditions with FOR UPDATE SKIP LOCKED
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Return Values**:
| Status | Meaning |
|--------|---------|
| `created` | Task was successfully created |
| `exists` | Task ID already in use (active or soft-deleted) |
| `tombstoned` | Task ID was permanently deleted |
| `error` | Database error occurred |

### Layer 2: Application (TypeScript)

**File**: `src/composables/useSupabaseDatabase.ts`

#### safeCreateTask()

```typescript
const safeCreateTask = async (task: Task): Promise<SafeCreateTaskResult> => {
    // 1. Try RPC function (more efficient)
    const { data, error } = await supabase.rpc('safe_create_task', { ... })

    // 2. Fall back to manual check if RPC unavailable
    if (error) return await safeCreateTaskManual(task, userId)

    return result
}
```

#### checkTaskIdsAvailability()

```typescript
// Batch check for restore/import operations
const checkTaskIdsAvailability = async (taskIds: string[]): Promise<TaskIdAvailability[]>
```

### Layer 3: Backup Restore

**File**: `src/composables/useBackupSystem.ts`

```typescript
// Each task is restored using safeCreateTask()
for (const task of tasksToRestore) {
    const result = await db.safeCreateTask(task)

    if (result.status === 'created') {
        created++
    } else {
        skipped++  // Logged to audit table
    }
}
```

### Layer 4: Audit Trail

**Table**: `task_dedup_audit`

```sql
CREATE TABLE public.task_dedup_audit (
    id uuid PRIMARY KEY,
    user_id uuid,
    operation varchar(50),     -- 'restore', 'sync', 'create', 'safe_create'
    task_id text,
    decision varchar(50),      -- 'created', 'skipped_exists', 'skipped_tombstoned'
    reason text,
    backup_source varchar(255),
    created_at timestamptz
);
```

## Usage Examples

### Creating a Task (User Action)

```typescript
// Always generates new UUID - no duplicate risk
const taskStore = useTaskStore()
await taskStore.createTask({ title: 'New Task' })
// ID = crypto.randomUUID() = "abc-123-..."
```

### Restoring from Backup

```typescript
const backupSystem = useBackupSystem()

// 1. Analyze what can be restored (dry run)
const analysis = await backupSystem.analyzeRestore(backupData)
// analysis.tasks.available = 5
// analysis.tasks.existsActive = 2
// analysis.tasks.tombstoned = 1

// 2. Execute restore (only available tasks)
await backupSystem.restoreFromBackup(backupData)
// Console: "[Backup] Task restore complete: 5 created, 3 skipped"
```

### Checking ID Availability

```typescript
const db = useSupabaseDatabase()
const results = await db.checkTaskIdsAvailability(['id-1', 'id-2', 'id-3'])

// results:
// [
//   { taskId: 'id-1', status: 'available', reason: 'Task ID is available' },
//   { taskId: 'id-2', status: 'active', reason: 'Task exists in database' },
//   { taskId: 'id-3', status: 'tombstoned', reason: 'Task ID is tombstoned' }
// ]
```

## Verification

### Test 1: Existing Task Blocked

```sql
-- Task exists
SELECT id FROM tasks WHERE id = 'abc-123';
-- Returns 1 row

-- Try to create with same ID
SELECT safe_create_task('abc-123', ...);
-- Returns: { "status": "exists", "message": "Task with this ID already exists" }
```

### Test 2: Tombstoned Task Blocked

```sql
-- Delete task permanently
DELETE FROM tasks WHERE id = 'abc-123';
-- Trigger auto-creates tombstone

-- Check tombstone exists
SELECT * FROM tombstones WHERE entity_id = 'abc-123';
-- Returns 1 row with expires_at = NULL

-- Try to recreate
SELECT safe_create_task('abc-123', ...);
-- Returns: { "status": "tombstoned", "message": "Task ID was permanently deleted" }
```

### Test 3: Audit Trail

```sql
SELECT operation, task_id, decision, reason
FROM task_dedup_audit
WHERE user_id = '...'
ORDER BY created_at DESC
LIMIT 10;
```

## Migration

To apply the immutable task ID system:

```bash
# Push migration to Supabase
supabase db push

# Verify migration applied
supabase migration list
```

## Key Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260120000002_immutable_task_ids.sql` | Database schema changes |
| `src/composables/useSupabaseDatabase.ts` | `safeCreateTask()`, `checkTaskIdsAvailability()` |
| `src/composables/useBackupSystem.ts` | Dedup-aware backup restore |
| `src/stores/tasks/taskPersistence.ts` | Dedup-aware import |
| `src/stores/tasks/taskOperations.ts` | User task creation (always new UUID) |

## Troubleshooting

### "Task ID already exists" on restore

**Expected behavior**. The task already exists in your database. Check if you need to delete it first, or if the backup is outdated.

### "Task ID was permanently deleted"

**Expected behavior**. You previously deleted this task and cannot restore it with the same ID. The backup data is preserved but the ID is tombstoned.

### Audit table growing too large

```sql
-- Optional: Clean up old audit entries (keeps last 30 days)
DELETE FROM task_dedup_audit
WHERE created_at < NOW() - INTERVAL '30 days';
```

---

**Last Updated**: 2026-01-20
