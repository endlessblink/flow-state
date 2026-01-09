# SOP: Canvas Group Resurrection Fix

**Related Bugs**: BUG-060, BUG-061
**Created**: January 9, 2026
**Status**: RESOLVED

## Problem

Deleted canvas groups (Friday, Saturday, Today) kept reappearing after page refresh, making it impossible to have an empty canvas.

## Root Causes

### BUG-060: Auth Watcher Didn't Clear Deleted Groups
**Location**: `src/stores/canvas.ts:636-648`

The auth watcher in canvas.ts only set groups if Supabase returned groups, but didn't clear localStorage-loaded groups if Supabase returned empty (all deleted).

```typescript
// BEFORE (broken)
if (loadedGroups.length > 0) {
  _rawGroups.value = loadedGroups
}
// BUG: If Supabase returns empty, localStorage groups persisted!
```

### BUG-061: OverdueCollector Auto-Creating Groups
**Location**: `src/composables/canvas/useCanvasOverdueCollector.ts:187-242`

The `ensureActionGroups()` function auto-created Friday/Saturday groups on every app startup if they didn't exist. When groups were deleted from Supabase, they no longer existed, so the function recreated them.

## Solution

### Fix 1: Always Set Groups from Supabase (BUG-060)
```typescript
// AFTER - ALWAYS set from Supabase, even if empty
_rawGroups.value = loadedGroups // Respects deletions
```

### Fix 2: Disable Auto-Creation (BUG-061)
```typescript
const ensureActionGroups = async () => {
    console.log(`[OverdueCollector] ensureActionGroups DISABLED - users create groups manually`)
    return
    // ... rest commented out
}
```

## Files Modified

| File | Change |
|------|--------|
| `src/stores/canvas.ts` | Auth watcher always sets `_rawGroups.value` |
| `src/composables/canvas/useCanvasOverdueCollector.ts` | Disabled `ensureActionGroups()` auto-creation |

## Verification

1. Delete all groups from Supabase:
   ```sql
   DELETE FROM groups WHERE is_deleted = false;
   ```
2. Hard refresh app (Ctrl+Shift+R)
3. Canvas should remain empty
4. No groups should auto-create

## Related Context

- Groups can be manually created via canvas context menu (right-click)
- `ensureOverdueGroup()` still exists but only triggers if overdue tasks exist on canvas
- Future consideration: Add user settings toggle for automation preferences

## Rollback Procedure

To restore auto-creation behavior:
1. Remove `return` statement from `ensureActionGroups()` function
2. Uncomment the disabled code block

**Warning**: This will cause Friday/Saturday groups to auto-create on every startup.
