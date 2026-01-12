# SOP: Sync Loop Fix - Task Position Reset Bug

**Date**: 2025-12-16
**Status**: Fixed
**Bug ID**: BUG-012 / ISSUE-006
**Priority**: P0-CRITICAL
**Related**: MASTER_PLAN.md

## Overview

Live sync was causing constant database reloads every second, which reset all task positions on the canvas and created an infinite sync loop. The SyncStatus component showed "initializing" repeatedly and task positions were constantly being reverted.

## Symptoms

1. SyncStatus showed "initializing" every second instead of stable "just now"
2. Task positions on canvas kept resetting to original locations
3. Console showed repeated database load messages
4. UI felt "jumpy" as everything kept refreshing

## Root Cause Analysis

### Cause 1: Debug Code Modifying Tasks on Every Load

In `src/stores/tasks.ts`, the `addTestCalendarInstances()` debug function was being called on every `loadFromDatabase()`:

```typescript
// Line 932 - PROBLEM
addTestCalendarInstances()
```

This function used `Date.now()` timestamps, meaning it created "new" data on every call, triggering the reactive system.

### Cause 2: Missing Guard Against Auto-Save During Load

The watch on `tasks` was triggering auto-save even during database loads:

```typescript
// Watch triggers saveState() on any task change
watch(
  () => tasks.value,
  () => {
    saveState()  // This was firing during loadFromDatabase()
  },
  { deep: true }
)
```

### The Loop

1. Live sync pulls changes from remote
2. `loadFromDatabase()` is called
3. `addTestCalendarInstances()` modifies tasks with new timestamps
4. Watch detects change, triggers auto-save
5. Auto-save pushes to remote
6. Remote receives "new" data
7. Live sync detects changes, pulls again
8. Go to step 2 - INFINITE LOOP

## Solution Applied

### Fix 1: Disable Debug Code

```typescript
// Line 932 - FIXED
// DEBUG: DISABLED - was causing infinite sync loop by modifying tasks on every load
// addTestCalendarInstances()
```

### Fix 2: Add Load Guard Flag

```typescript
// Line 152 - NEW
// Flag to prevent auto-save during database loads (prevents sync loops)
let isLoadingFromDatabase = false

// Lines 868-869 - Set flag at start of load
// Set flag to prevent auto-save during load (prevents sync loop)
isLoadingFromDatabase = true

// Lines 966-968 - Reset flag after load
// Reset flag after loading complete
isLoadingFromDatabase = false
console.log('✅ Database load complete, auto-save re-enabled')

// Lines 983-987 - Check flag in watch
// SYNC LOOP FIX: Skip watch during database loads (prevents sync -> load -> save -> sync loop)
if (isLoadingFromDatabase) {
  console.log('⏸️ Skipping auto-save during database load')
  return
}
```

## Files Modified

| File | Changes |
|------|---------|
| `src/stores/tasks.ts` | Added `isLoadingFromDatabase` flag, guard in watch, commented debug code |

## Verification Steps

1. Start the app with live sync enabled
2. SyncStatus should show stable "Online" and "just now"
3. Move tasks on canvas
4. Wait 10+ seconds - positions should remain stable
5. Check console - no repeated "initializing" messages

## Important Notes

### Vite HMR Limitation

Changes to Pinia stores (like `tasks.ts`) may not be picked up by Vite's Hot Module Replacement. **A full dev server restart is required**:

```bash
# Kill existing processes
bash kill-pomo.sh  # or: npm run kill

# Restart dev server
npm run dev
```

### Prevention

When adding debug code that modifies reactive state:
1. Use a one-time flag to prevent repeated execution
2. Never use `Date.now()` or random values in code paths that can run multiple times
3. Consider using `console.log` only instead of state modification for debugging

## Related Documentation

- MASTER_PLAN.md - Known Issues section (ISSUE-006)
- MASTER_PLAN.md - Sync Issues section (BUG-012)
- `src/composables/useReliableSyncManager.ts` - Live sync implementation
