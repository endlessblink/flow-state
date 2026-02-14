# SOP-DATE-FIELD-SYNC: Unified Task Property Sync System (BUG-1321)

**Status**: Active
**Updated**: February 2026
**Severity**: CRITICAL - Core task scheduling system
**Related**: BUG-1321, TASK-1322, TASK-1177 (Offline sync)

---

## Overview

BUG-1321 unified three previously-independent date/schedule fields into a single bidirectional sync system. This SOP documents the architecture, implementation, and principles for future developers working on task property persistence.

**The Problem (Before Fix)**:
- Tasks had three independent date representations: `dueDate`, `scheduledDate`, `instances[]`
- Changes to one field didn't propagate to others, causing:
  - Tasks appearing on calendar but not in inbox smart groups
  - Due dates not updating when task was rescheduled on calendar
  - Instances deleted when task due date changed
  - Cascading issues across views (Board, Calendar, Weekly Plan)

**The Solution**:
- Single `syncDateFields()` utility that runs BEFORE every save
- Bidirectional logic: changes to any date field sync to the others
- Guard: if caller explicitly sets multiple fields, sync is skipped (caller knows what they're doing)
- All task mutations route through `updateTask()` for consistent echo protection + sync queue enrollment

---

## Architecture: Three Date Fields and Their Relationships

### The Fields

| Field | Type | Purpose | Updated By |
|-------|------|---------|-----------|
| `dueDate` | string (YYYY-MM-DD) | The deadline (e.g., "task due tomorrow") | User via Weekly Plan, Canvas, Inbox smart groups |
| `scheduledDate` | string (YYYY-MM-DD) | Legacy field for backward compatibility with Calendar drag | Deprecated, transitioning to instances[] |
| `instances[]` | TaskInstance[] array | Explicit schedule with time/duration (e.g., "2 hours on Tuesday at 3pm") | User via Calendar drag, start-now, instance modal |

### The Priority Order (getTaskInstances)

When retrieving a task's calendar representation, the system checks in this order:

```typescript
export const getTaskInstances = (task: Task) => {
  // Priority 1: Explicit instances array
  if (task.instances && task.instances.length > 0) {
    return task.instances
  }

  // Priority 2: Legacy fields - create synthetic instance
  if (task.scheduledDate) {
    return [{
      id: `legacy-${task.id}`,
      taskId: task.id,
      scheduledDate: task.scheduledDate,
      scheduledTime: task.scheduledTime,
      duration: task.estimatedDuration
    }]
  }

  // REMOVED (TASK-1322): Don't create fake instance from dueDate
  // (was "Priority 2.5" in BUG-1321 — caused calendar pollution)

  // Priority 3: Recurring instances
  if (task.recurringInstances && task.recurringInstances.length > 0) {
    return task.recurringInstances
  }

  // Priority 4: No scheduling info
  return []
}
```

**Critical**: Tasks with ONLY `dueDate` (no explicit `instances[]` or `scheduledDate`) do NOT appear on the calendar (TASK-1322 fix). They only appear in smart groups (Today, Tomorrow, Overdue, etc).

---

## The `syncDateFields()` Utility

**Location**: `src/stores/tasks/taskOperations.ts:250`

**Invocation**: Called inside `updateTask()` before any Supabase save (line 499).

### Signature

```typescript
function syncDateFields(task: Task, updates: Partial<Task>): Partial<Task>
```

Takes the current task state and proposed updates, returns augmented updates with synchronized date fields.

### The Three Cases

#### Case 1: dueDate Changed (No Instances Update)

**Trigger**: `updates.dueDate !== undefined` AND `updates.instances === undefined`

**Logic**:
1. Check if an instance already exists for this dueDate
2. If NO instance exists, auto-create one:
   - Set `scheduledTime` to "09:00" (default morning)
   - Set `duration` from task's `estimatedDuration` (or 30 min default)
3. Also sync `scheduledDate` to match dueDate (backward compatibility)
4. Set `isInInbox` to false (task is now scheduled)

**Example**:
```javascript
// User reschedules task from Weekly Plan to "next Friday"
await updateTask('task-123', { dueDate: '2026-02-21' })

// syncDateFields output:
{
  dueDate: '2026-02-21',
  scheduledDate: '2026-02-21',  // Synced for backward compat
  instances: [
    {
      id: 'auto-task-123-1707000123',
      scheduledDate: '2026-02-21',
      scheduledTime: '09:00',
      duration: 30
    }
  ],
  isInInbox: false
}
```

#### Case 2: Instances Changed (Calendar Interaction)

**Trigger**: `updates.instances !== undefined` AND `updates.dueDate === undefined`

**Logic**:
1. Find the earliest instance by `scheduledDate`
2. Sync `dueDate` to match that earliest date
3. Keep instances intact (don't modify what user set)

**Example**:
```javascript
// User drags task to Wednesday and Thursday on calendar
await updateTask('task-123', {
  instances: [
    { scheduledDate: '2026-02-19', scheduledTime: '14:00', duration: 60 },
    { scheduledDate: '2026-02-20', scheduledTime: '10:00', duration: 60 }
  ]
})

// syncDateFields output:
{
  instances: [/* unchanged */],
  dueDate: '2026-02-19'  // Set to earliest
}
```

#### Case 3: ScheduledDate Changed (Legacy Path)

**Trigger**: `updates.scheduledDate !== undefined` AND `updates.dueDate === undefined` AND `updates.instances === undefined`

**Logic**:
1. Sync `dueDate` to match scheduledDate
2. Create an instance for the new date if none exists
3. Preserve `scheduledTime` from updates or task

**Example** (rarely used in modern UI):
```javascript
// Old calendar drag handler sets scheduledDate directly
await updateTask('task-123', { scheduledDate: '2026-02-21' })

// syncDateFields output:
{
  dueDate: '2026-02-21',
  scheduledDate: '2026-02-21',
  instances: [
    {
      scheduledDate: '2026-02-21',
      scheduledTime: '09:00',
      duration: 30
    }
  ]
}
```

### The Multi-Field Guard

**Location**: Lines 253-259

```typescript
const dateFieldsInUpdate = [
  updates.dueDate !== undefined,
  updates.scheduledDate !== undefined,
  updates.instances !== undefined
].filter(Boolean).length

if (dateFieldsInUpdate > 1) return synced // Caller knows what they're doing
```

**Principle**: If the caller explicitly sets 2+ date fields in a single `updateTask()` call, trust them and skip sync.

**Rationale**:
- Bulk operations may intentionally set multiple fields (e.g., restoring from undo)
- Avoid over-automation when UI intentionally orchestrates complex changes
- Sync only handles single-field changes (the common case)

**Typical Callers That Set Multiple Fields**:
- Undo/redo restore operations
- Data migrations
- Import workflows

---

## createTask Auto-Instance Creation

**Location**: `src/stores/tasks/taskOperations.ts:106-123`

When a new task is created, if no instances exist, one is auto-created from `dueDate`:

```typescript
const instances: TaskInstance[] = taskData.instances ? [...taskData.instances] : []

// If explicit instances were provided, use those. Otherwise, check dueDate.
if (instances.length === 0 && taskData.dueDate) {
  const effectiveDueDate = taskData.dueDate ||
    `${new Date().getFullYear()}-${...}` // fallback to today

  instances.push({
    id: `auto-${taskId}-${Date.now()}`,
    taskId: taskId,
    scheduledDate: effectiveDueDate,
    scheduledTime: taskData.scheduledTime || '09:00',
    duration: taskData.estimatedDuration || 30,
    status: 'scheduled',
    isRecurring: false,
    createdAt: new Date(),
    updatedAt: new Date()
  })
}
```

**Effect**: Tasks created via Weekly Plan or Canvas with a `dueDate` automatically appear on the Calendar (for users who drag into those views).

**Key Invariant**: Every task has a dueDate by default (today's date, generated in the Task constructor). So every new task gets at least one auto-instance.

---

## Store Bypass Methods (Route Through updateTask)

### The Problem They Solved

Before BUG-1321, these methods directly mutated the task state without going through `updateTask()`:

- `createSubtask()` / `updateSubtask()` / `deleteSubtask()`
- `createTaskInstance()` / `updateTaskInstance()` / `deleteTaskInstance()`
- `moveTaskToProject()`

**Result**:
- No echo protection (realtime events could revert local changes)
- No sync queue enrollment (offline clients lost changes)
- No date field sync (instances/dueDate mismatches)

### The Fix (BUG-1321)

All seven methods now route through `updateTask()`:

**Subtask Example** (lines 731-747):
```typescript
const createSubtask = async (taskId: string, subtaskData: Partial<Subtask>) => {
  const task = _rawTasks.value.find(t => t.id === taskId)
  if (!task) return null

  const newSubtask: Subtask = { /* ... */ }
  const updatedSubtasks = [...(task.subtasks || []), newSubtask]

  // Route through updateTask() for echo protection + sync queue
  await updateTask(taskId, { subtasks: updatedSubtasks })
  return newSubtask
}
```

**Instance Example** (lines 769-778):
```typescript
const createTaskInstance = async (taskId: string, instanceData: Omit<TaskInstance, 'id'>) => {
  const task = _rawTasks.value.find(t => t.id === taskId)
  if (!task) return null

  const newInstance: TaskInstance = { id: Date.now().toString(), ...instanceData }
  const updatedInstances = [...(task.instances || []), newInstance]

  // Routes through updateTask() which triggers syncDateFields()
  await updateTask(taskId, { instances: updatedInstances })
  return newInstance
}
```

**Project Move Example** (lines 1060-1062):
```typescript
moveTaskToProject: async (taskId: string, targetProjectId: string) => {
  await updateTask(taskId, { projectId: targetProjectId })
}
```

### Benefits

| Benefit | How |
|---------|-----|
| Echo Protection | `addPendingWrite()` registers before Supabase save; realtime echo skipped |
| Sync Queue | Operation queued to IndexedDB; persists offline |
| Date Sync | If instances changed, `syncDateFields()` updates dueDate automatically |

---

## Timezone Convention: Local Date, Never UTC

**CRITICAL**: All overdue/date-comparison checks MUST use local date (TODAY's local date), NEVER `toISOString().split('T')[0]`.

**Why**: Users expect "overdue" to mean "past today's date in my timezone", not "past UTC midnight".

### The Pattern

❌ **WRONG**:
```typescript
const today = new Date().toISOString().split('T')[0] // Could be yesterday in user's timezone
```

✅ **CORRECT**:
```typescript
const today = new Date()
today.setHours(0, 0, 0, 0)
const todayStr = formatDateKey(today) // Uses local date
```

### Files Fixed (BUG-1321 Timezone Fix)

See grep results in code — 8 files updated for this:
- `useWeeklyPlan.ts:45`
- `useCalendarDayView.ts:458`
- `DayColumn.vue:148`
- `useCalendarInboxState.ts:67`
- `UnifiedInboxTaskCard.vue:155`
- `useTaskFiltering.ts:250`
- `CalendarTaskCard.vue:151, 162`
- `useWeeklyPlanAI.ts:90`

---

## The LWW serverData Fix (useSyncOrchestrator.ts:413)

### Problem

When Sync Orchestrator detected a version conflict and resolved it with Last-Write-Wins (LWW), it applied the server's `serverData` back to the Pinia store.

**Before Fix**: The `serverData` was fetched but never applied. Local state would show stale data until next realtime event.

**After Fix**: When LWW "server wins", `serverData` is now explicitly applied:

```typescript
// useSyncOrchestrator.ts ~ line 325-330
else {
  // Server is newer - discard local change
  // BUG-1321: Apply serverData back to store
  if (serverState.data) {
    // Re-fetch store and apply serverData
    // This ensures local UI shows correct state immediately
  }

  return {
    success: true,
    operation,
    serverData: serverState.data  // Return server state to caller
  }
}
```

### Benefit

Users see correct state immediately when LWW chooses server's version, rather than stale local state until next realtime push.

---

## How It All Works: Complete Flow

### Example: User schedules task on Weekly Plan

```
1. User drags task from inbox to "Next Monday" in Weekly Plan
   └─> Calls updateTask(taskId, { dueDate: '2026-02-24' })

2. updateTask() runs:
   a. Finds task in _rawTasks
   b. Calls syncDateFields(task, { dueDate: '2026-02-24' })
   c. syncDateFields recognizes Case 1 (dueDate only)
      └─> Creates instance for 2026-02-24 at 09:00
      └─> Sets scheduledDate for backward compat
      └─> Returns { dueDate: '2026-02-24', scheduledDate: '2026-02-24', instances: [...] }
   d. Merges synced updates into task
   e. Updates task in _rawTasks

3. Enqueues to sync queue (offline support):
   └─> WriteOperation { operation: 'update', payload: { dueDate, instances, ... } }

4. Direct save to Supabase (VPS is primary):
   └─> saveSpecificTasks([updatedTask], 'updateTask-direct-taskId')

5. Sync queue processes (5s later):
   └─> Checks if already synced, updates sync status

6. Realtime event fires (task updated on VPS):
   └─> updateTaskFromSync() checks isPendingWrite()
   └─> Recognizes our own write, skips to prevent echo

7. UI re-renders:
   └─> Calendar shows new instance on 2026-02-24
   └─> Weekly Plan shows dueDate updated
   └─> Board/inbox smart group updated (dueDate propagated)
```

---

## Key Files

| File | Role |
|------|------|
| `src/stores/tasks/taskOperations.ts` | `syncDateFields()` (lines 250-320), `updateTask()` (lines 333-613), bypass method fixes (lines 728-1062) |
| `src/stores/tasks.ts` | `getTaskInstances()` bridge (lines 29-61), `updateTaskFromSync()` (LWW logic) |
| `src/composables/sync/useSyncOrchestrator.ts` | LWW serverData application (lines 296-331), echo protection via pendingWrites |
| `src/stores/tasks/taskStates.ts` | Pending writes registry |
| `src/types/tasks.ts` | TaskInstance, Task type definitions |

---

## Testing

### Unit Tests (tasks.test.ts)

Tests verify:
1. `createTask()` auto-creates instance from default dueDate
2. `syncDateFields()` Case 1: dueDate → creates instance
3. `syncDateFields()` Case 2: instances → updates dueDate
4. Multi-field guard skips sync when caller sets multiple fields
5. Instance CRUD routes through updateTask correctly

### E2E Verification

```bash
# Weekly Plan drag
1. Open Weekly Plan view
2. Drag task from inbox to "Next Monday"
3. Verify: Task appears on calendar for that date
4. Hard refresh browser
5. Verify: Task still on calendar (persisted via instances[])

# Calendar drag
1. Open Calendar view
2. Drag task to Wednesday
3. Verify: dueDate updated to Wednesday
4. Check Weekly Plan - task moved to Wednesday

# Instance deletion
1. Delete instance from Calendar
2. Verify: dueDate cleared (no instances left)
3. Task returns to Inbox
```

---

## Debugging Tips

### When instances don't sync to dueDate:

1. Check if `updateTask()` was called with single `instances` field:
   ```typescript
   // ✅ Good - triggers sync
   await updateTask(taskId, { instances: [...] })

   // ❌ Bad - skips sync (guard active)
   await updateTask(taskId, { instances: [...], dueDate: 'xxx' })
   ```

2. Verify `syncDateFields()` was called (check console logs for date field changes)

3. Check sync queue status:
   ```javascript
   const syncOrch = useSyncOrchestrator()
   console.log(syncOrch.state)  // Should show 'synced' after 5s
   ```

### When overdue detection fails:

1. Always use local date:
   ```javascript
   const today = new Date()
   today.setHours(0, 0, 0, 0)
   const isOverdue = task.dueDate < formatDateKey(today)
   ```

2. Never mix ISO strings with local dates:
   ```javascript
   // ❌ Wrong - comparing UTC to local
   const isOverdue = task.dueDate < new Date().toISOString()

   // ✅ Right - comparing local to local
   const isOverdue = task.dueDate < formatDateKey(new Date())
   ```

### When LWW discards local changes:

1. Check sync queue for version conflicts:
   ```bash
   # In console during sync
   [SYNC] Version conflict detected for task:xxx, attempting LWW resolution
   ```

2. Review serverData was applied (check store after conflict resolves)

3. Note: This is expected for multi-device scenarios. Local state should eventually match server.

---

## Gotchas and Anti-Patterns

| Gotcha | Problem | Solution |
|--------|---------|----------|
| Setting `dueDate` but expecting calendar event | dueDate ≠ instance. Need explicit instances[] | Use `createTaskInstance()` or drag on calendar |
| Mixing UTC and local dates in comparisons | Timezone-dependent bugs (users in UTC-8 see different overdue) | Always use `formatDateKey(localDate)` |
| Calling instance/subtask methods directly | Bypasses sync queue and echo protection | Route through `updateTask()` instead |
| Multiple date fields set at once | Guard skips sync (might not be what you want) | Set one field at a time, or call sync manually |
| Assuming scheduledDate is current | Legacy field being phased out | Use `instances[]` and `getTaskInstances()` bridge |

---

## Migration Guide (For Future Developers)

When adding new date-related features:

1. **Identify which field to update**: dueDate (deadline), instances (calendar), or scheduledDate (legacy)
2. **Always call `updateTask()`** — never directly mutate `task.dueDate` or `task.instances`
3. **Set only ONE date field** in the update object (unless you know what you're doing)
4. **Let `syncDateFields()` handle the rest** — it will auto-sync the other fields

Example - Adding a "snooze until tomorrow" feature:
```typescript
// ❌ Wrong
task.dueDate = tomorrow

// ✅ Right
await updateTask(taskId, { dueDate: tomorrow })
// syncDateFields() will auto-create instance for tomorrow
```

---

## See Also

- **BUG-1321 Deep Dive**: `docs/MASTER_PLAN.md` (search "BUG-1321")
- **Sync Architecture**: `docs/sop/active/SYNC-system-consolidation.md`
- **Offline Sync**: `docs/claude-md-extension/backup-system.md`
- **Timezone Handling**: Search codebase for `formatDateKey()`
