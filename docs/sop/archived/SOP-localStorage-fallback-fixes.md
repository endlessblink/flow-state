# SOP: localStorage Fallback Fixes for Authenticated Users

**Created**: January 9, 2026
**Task Reference**: TASK-150
**Status**: Verified Working

---

## Problem Statement

Deleted canvas groups reappeared after page refresh, even though the Supabase soft-delete operation succeeded.

## Root Cause Analysis

### Investigation Path

1. **Initial Symptom**: User deletes groups → Groups reappear on refresh
2. **First Hypothesis**: `deleteGroup()` not setting `is_deleted: true` correctly
3. **Discovery**: Delete was failing with 400 Bad Request due to non-existent `deleted_at` column
4. **Second Discovery**: After fixing the 400 error, groups STILL reappeared
5. **Root Cause Found**: `loadFromDatabase()` in `canvas.ts` had a localStorage fallback

### The Actual Bug

```typescript
// canvas.ts - BEFORE FIX (lines 161-166)
// Supabase returned empty - try localStorage as fallback
const localGroups = loadGroupsFromLocalStorage()
if (localGroups.length > 0) {
  _rawGroups.value = localGroups  // ← RESURRECTS DELETED GROUPS!
  console.log(`✅ [FALLBACK] Using ${localGroups.length} groups from localStorage (Supabase empty)`)
}
```

**Flow that caused the bug:**
1. User is authenticated, has 3 groups in Supabase
2. User deletes all 3 groups (marked `is_deleted: true` in Supabase)
3. `fetchGroups()` correctly returns empty (filters `is_deleted: false`)
4. Code sees empty result, falls back to localStorage
5. localStorage has the old 3 groups (never cleared)
6. Deleted groups reappear!

---

## Solution Applied

### Fix 1: Remove localStorage Fallback for Authenticated Users

**File**: `src/stores/canvas.ts`
**Lines**: 146-166

```typescript
// AFTER FIX
// TASK-150 FIX: When authenticated, Supabase is the source of truth
// Don't fall back to localStorage which may have stale/deleted groups
_rawGroups.value = loadedGroups  // Always use Supabase result

if (loadedGroups.length > 0) {
  console.log(`✅ [SUPABASE] Loaded ${loadedGroups.length} canvas groups:`, loadedGroups.map(g => g.name))
  // ... position logging ...
} else {
  console.log(`📭 [SUPABASE] No groups in database (all deleted or none created)`)
}

// NOTE: Authenticated users use Supabase as single source of truth
// No localStorage fallback - empty means empty
```

### Fix 2: Ensure deleteGroup Uses Correct Schema

**File**: `src/composables/useSupabaseDatabase.ts`
**Lines**: 456-484

The `groups` table does NOT have a `deleted_at` column (unlike `tasks` and `projects`). The delete operation must only set `is_deleted: true`:

```typescript
const deleteGroup = async (groupId: string): Promise<void> => {
  // ...
  const { data, error, count } = await supabase
    .from('groups')
    // FIX: Column 'deleted_at' does not exist in schema. Use 'is_deleted' only.
    .update({ is_deleted: true })
    .eq('id', groupId)
    .eq('user_id', userId)
    .select('id, is_deleted', { count: 'exact' })
  // ...
}
```

---

## Verification Steps

### Manual Test

1. Start dev server: `npm run dev`
2. Login with authenticated account
3. Create 2-3 canvas groups
4. Delete all groups
5. Refresh page (Ctrl+R)
6. **Expected**: Canvas is empty (no groups)
7. **Before fix**: Deleted groups would reappear

### Console Logs to Verify

**Successful delete:**
```
🗑️ [SUPABASE-DELETE-GROUP] Starting soft-delete for group: group-xxx
🗑️ [SUPABASE-DELETE-GROUP] Result - error: none, affected: 1
✅ [SUPABASE-DELETE-GROUP] Group group-xxx marked as deleted
```

**Successful load (empty):**
```
📭 [SUPABASE] No groups in database (all deleted or none created)
```

**WRONG (old behavior):**
```
✅ [FALLBACK] Using 3 groups from localStorage (Supabase empty)
```

---

## Schema Reference

### groups table (Supabase)

| Column | Type | Notes |
|--------|------|-------|
| id | text | Primary key |
| user_id | uuid | FK to auth.users |
| name | text | Required |
| is_deleted | boolean | Soft delete flag |
| position_json | jsonb | {x, y, width, height} |
| ... | ... | Other columns |

**Note**: `deleted_at` column does NOT exist on `groups` table. Only `tasks` and `projects` have `deleted_at`.

---

## Prevention Checklist

When adding localStorage fallbacks in the future:

- [ ] **Never fall back to localStorage for authenticated users** when Supabase returns empty
- [ ] Empty from remote = empty locally (respect deletions)
- [ ] localStorage fallback is ONLY appropriate for:
  - Network failure recovery (with clear warning to user)
  - Guest mode (ephemeral sessions)
- [ ] Always check if table schema matches the update payload
- [ ] Use `.select()` with `.count('exact')` to verify rows affected

---

## Related Files

| File | Purpose |
|------|---------|
| `src/stores/canvas.ts` | Canvas store with group loading logic |
| `src/composables/useSupabaseDatabase.ts` | Supabase operations including deleteGroup |
| `supabase/migrations/20260105000000_initial_schema.sql` | Schema definition |
| `docs/MASTER_PLAN.md` | Task tracking (TASK-150) |

---

## Lessons Learned

1. **Source of truth principle**: For authenticated users, the remote database is ALWAYS the source of truth. localStorage is a cache, not a backup.

2. **Empty is valid**: An empty result from the database is a valid state. Don't "helpfully" populate from cache.

3. **Schema awareness**: Different tables can have different columns. Always check the actual schema before assuming a column exists.

4. **Debug systematically**: The initial 400 error was a red herring. The real bug was in the load path, not the delete path.
