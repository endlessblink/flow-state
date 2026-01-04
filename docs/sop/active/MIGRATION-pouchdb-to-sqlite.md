# MIGRATION-pouchdb-to-sqlite

**Category**: Database Migration
**Status**: Active
**Last Updated**: January 4, 2026
**Related Bug**: BUG-087
**Related Task**: TASK-093 (Database Engine Migration Phase 2)

---

## Overview

This SOP documents the fixes applied to the PouchDB to SQLite (PowerSync) migration utility. The migration is part of TASK-093, replacing the unstable IndexedDB adapter with PowerSync SQLite WASM for crash-proof local storage.

### Problems Addressed

1. **Tasks showing placeholder titles** - "Recovered Task (1766666932...)" instead of actual titles
2. **Deleted content reappearing** - Old deleted tasks kept coming back after migration
3. **Canvas NaN errors** - SVG rendering errors due to null/undefined canvas positions

---

## Root Cause Analysis

### Issue 1: Nested Data Structure Not Handled

**Symptom**: Tasks displayed as "Recovered Task (1766666932...)" instead of real titles like "להכין את שיעור 3 לפוסטודיו"

**Root Cause**: PouchDB documents use a nested structure for individual task storage:

```typescript
// Actual PouchDB document structure
{
  _id: "task-1766666932123",
  type: "task",
  data: {           // <-- DATA IS NESTED HERE
    title: "Real task title",
    status: "planned",
    projectId: "123"
  }
}
```

The original migration code looked for `doc.title` (flat structure) instead of `doc.data.title` (nested structure).

### Issue 2: Deleted Documents Imported

**Symptom**: Old deleted content kept reappearing after each migration run

**Root Cause**:
1. Migration imported ALL PouchDB documents, including those marked as deleted
2. Self-healing migration logic detected "empty" SQLite and re-ran import
3. Deleted documents have various deletion markers that weren't checked:
   - `data.deleted`
   - `data.isDeleted`
   - `data.is_deleted`
   - `doc._deleted` (PouchDB internal)

### Issue 3: Untitled Groups That Won't Delete

**Symptom**: Canvas shows "Untitled Group" boxes that can't be deleted and keep reappearing

**Root Cause**:
1. Group documents in PouchDB also use nested structure `{ type: 'section', data: { name: '...' } }`
2. Original `convertGroupDoc()` didn't check `doc.data`, only `doc.name`
3. When name couldn't be found, fallback to "Untitled Group" was used
4. These corrupted groups kept being re-imported on each migration

### Issue 4: Canvas Position NaN Errors

**Symptom**: Console filled with SVG rect attribute errors:
```
Error: <rect> attribute x: Expected length, "NaN"
Error: <rect> attribute y: Expected length, "NaN"
```

**Root Cause**: Canvas positions defaulted to `null` when missing, which became `NaN` when used in calculations.

---

## Solution Implementation

### Fix 1: Handle Nested Data Structure

**File**: `src/utils/migratePouchToSql.ts`

**Pattern Applied**: Extract nested data before accessing fields

```typescript
// In convertTaskDoc()
function convertTaskDoc(doc: any): SqlTask | null {
    // Handle nested data structure: some docs have { type: 'task', data: { title: '...' } }
    const data = doc.data || doc;

    // Check multiple possible title fields (PouchDB schemas vary)
    const title = data.title || data.content || data.name || data.text ||
                  data.label || data.summary || doc.title || doc.content || doc.name;
    // ...
}

// In convertTaskDocWithTitle()
function convertTaskDocWithTitle(doc: any, title: string): SqlTask {
    // Handle nested data structure: { type: 'task', data: { ... } }
    const d = doc.data || doc;

    // Now access fields from 'd' (the actual data object)
    const completedPomos = d.completedPomodoros ?? d.totalPomodoros ?? 0;
    // ...
}
```

### Fix 2: Skip Deleted Documents During Migration

**File**: `src/utils/migratePouchToSql.ts`

**Pattern Applied**: Check all possible deletion markers before importing

```typescript
// In the main migration loop
for (const row of allDocs.rows) {
    const doc = row.doc as any;
    if (!doc || doc._id.startsWith('_')) continue;

    // SKIP DELETED DOCUMENTS - they should stay deleted!
    const data = doc.data || doc;
    if (data.deleted || data.isDeleted || data.is_deleted || doc._deleted) {
        console.log(`[MIGRATION] Skipping deleted doc: ${doc._id}`);
        continue;
    }

    // Continue with import...
}
```

### Fix 3: Add Permanent Purge Function

**File**: `src/utils/migratePouchToSql.ts`

**Pattern Applied**: Hard DELETE for soft-deleted records

```typescript
/**
 * PERMANENTLY delete all soft-deleted records from SQLite
 * This ensures deleted content never comes back
 */
export async function purgeDeletedRecords(): Promise<{ tasks: number; projects: number; groups: number }> {
    console.log('[PURGE] Permanently removing all soft-deleted records...');

    try {
        const db = await PowerSyncService.getInstance();

        // Count before delete
        const taskCount = await db.get('SELECT COUNT(*) as count FROM tasks WHERE is_deleted = 1');
        const projectCount = await db.get('SELECT COUNT(*) as count FROM projects WHERE is_deleted = 1');
        const groupCount = await db.get('SELECT COUNT(*) as count FROM groups WHERE is_deleted = 1');

        // HARD DELETE all soft-deleted records
        await db.execute('DELETE FROM tasks WHERE is_deleted = 1');
        await db.execute('DELETE FROM projects WHERE is_deleted = 1');
        await db.execute('DELETE FROM groups WHERE is_deleted = 1');

        const result = {
            tasks: taskCount?.count || 0,
            projects: projectCount?.count || 0,
            groups: groupCount?.count || 0
        };

        console.log(`✅ [PURGE] Permanently deleted: ${result.tasks} tasks, ${result.projects} projects, ${result.groups} groups`);
        return result;

    } catch (e) {
        console.error('❌ [PURGE] Failed:', e);
        throw e;
    }
}

// Expose on window for easy console access
if (typeof window !== 'undefined') {
    (window as any).purgeDeleted = purgeDeletedRecords;
}
```

### Fix 4: Handle Nested Data for Groups

**File**: `src/utils/migratePouchToSql.ts`

**Pattern Applied**: Same as tasks - check `doc.data || doc` and skip invalid groups

```typescript
function convertGroupDoc(doc: any): SqlGroup | null {
    // Handle nested data structure: some docs have { type: 'section', data: { name: '...' } }
    const d = doc.data || doc;
    const now = new Date().toISOString();

    // Extract name from various possible fields
    const name = d.title || d.name || doc.title || doc.name;

    // Skip groups without a valid name - they're corrupted/incomplete
    if (!name || name.trim() === '' || name === 'Untitled Group') {
        console.warn(`[MIGRATION] Skipping group without valid name: ${doc._id}`);
        return null;  // Skip this group entirely
    }

    return {
        id: doc._id,
        name: name,
        // ... rest of fields using 'd' (the actual data object)
    };
}
```

### Fix 5: Add Purge Untitled Groups Function

**File**: `src/utils/migratePouchToSql.ts`

**Pattern Applied**: Hard DELETE for corrupted groups

```typescript
export async function purgeUntitledGroups(): Promise<number> {
    const db = await PowerSyncService.getInstance();

    await db.execute(
        `DELETE FROM groups WHERE name = 'Untitled Group' OR name = '' OR name IS NULL`
    );

    return deletedCount;
}

// Exposed as window.purgeUntitledGroups()
```

### Fix 6: Default Canvas Positions to 0,0

**File**: `src/utils/migratePouchToSql.ts`

**Pattern Applied**: Use nullish coalescing with 0 as fallback

```typescript
// Canvas & Spatial - IMPORTANT: Default to 0,0 if missing to avoid NaN errors
canvas_position_x: d.canvasPosition?.x ?? d.canvas_position_x ?? 0,
canvas_position_y: d.canvasPosition?.y ?? d.canvas_position_y ?? 0,
is_in_inbox: jsBoolToSql(d.isInInbox ?? d.is_in_inbox ?? true),
```

---

## Console Commands

### List All Groups
```javascript
// Run in browser console
await window.listGroups();
// Output: 📋 [DEBUG] 5 groups in SQLite:
//   → group-123: "High Priority" (priority)
//   → group-456: "Untitled Group" (custom) [DELETED]
```

### Check for Soft-Deleted Records
```javascript
// Run in browser console
const db = await window.PowerSyncService?.getInstance();
const tasks = await db?.getAll('SELECT id, title FROM tasks WHERE is_deleted = 1');
console.log('Soft-deleted tasks:', tasks);
```

### Purge Untitled/Corrupted Groups
```javascript
// Run in browser console
await window.purgeUntitledGroups();
// Output: ✅ [PURGE] Permanently deleted 3 untitled groups
```

### Permanently Purge ALL Deleted Records
```javascript
// Run in browser console
await window.purgeDeleted();
// Output: ✅ [PURGE] Permanently deleted: 15 tasks, 2 projects, 0 groups
```

### Force Re-run Migration
```javascript
// Run in browser console
await window.migrate();
```

---

## Verification Checklist

- [ ] Create a new task → Should save with proper title
- [ ] Close and reopen app → Task should persist
- [ ] Delete a task → Should be soft-deleted (is_deleted = 1)
- [ ] Run `window.purgeDeleted()` → Should permanently remove deleted records
- [ ] Canvas tasks should render without NaN errors in console
- [ ] Tasks should display actual titles, not "Recovered Task (xxxxx...)"

---

## Related Files

| File | Purpose |
|------|---------|
| `src/utils/migratePouchToSql.ts` | Main migration utility with all fixes |
| `src/services/database/PowerSyncDatabase.ts` | SQLite database service |
| `src/services/database/SqlDatabaseTypes.ts` | SQL type definitions |
| `src/stores/tasks/taskPersistence.ts` | Task persistence layer |

---

## Anti-Patterns to Avoid

1. **Never assume flat document structure** - Always check `doc.data || doc`
2. **Never import without checking deletion status** - Check all deletion markers
3. **Never use null for canvas positions** - Default to 0,0 to prevent NaN
4. **Never trust self-healing migration alone** - Deletion markers must be respected

---

## Rollback Procedure

If issues occur after migration:

1. **Restore from Golden Backup**:
   ```javascript
   // Check if golden backup exists
   const backup = localStorage.getItem('pomo_flow_golden_backup');
   if (backup) {
       const data = JSON.parse(backup);
       console.log('Golden backup has', data.tasks?.length, 'tasks');
       // Manual restoration may be needed
   }
   ```

2. **Clear SQLite and Re-migrate**:
   ```javascript
   // Nuclear option - clear SQLite and start fresh
   const db = await window.PowerSyncService?.getInstance();
   await db?.execute('DELETE FROM tasks');
   await db?.execute('DELETE FROM projects');
   await db?.execute('DELETE FROM groups');
   await window.migrate();
   ```

3. **Fall back to PouchDB** (if SQLite is completely broken):
   - Disable PowerSync in `vite.config.ts`
   - Remove SQLite initialization from `useAppInitialization.ts`
   - Restore PouchDB-only persistence

---

## Future Improvements

1. **Add migration validation** - Compare counts between PouchDB and SQLite
2. **Add progress reporting** - Show migration progress in UI
3. **Add dry-run mode** - Preview what will be migrated before committing
4. **Add conflict detection** - Handle cases where SQLite has newer data than PouchDB
