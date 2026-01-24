# SOP-032: Store Auth-Wait Initialization Pattern

**Created**: 2026-01-24
**Related Tasks**: BUG-1045, BUG-339
**Status**: Active

## Problem

Pinia stores that auto-initialize during store creation can race with auth initialization, causing them to load empty data or localStorage (guest mode) instead of authenticated Supabase data.

**Symptoms**:
- View loads empty, populates only after page restart
- Data appears on second load but not first
- Works locally but fails on fresh sessions

## Root Cause

When a store calls `initialize()` synchronously during `defineStore()`:

```typescript
// ❌ BAD - races with auth
export const useMyStore = defineStore('my-store', () => {
  const initialize = async () => {
    await loadFromDatabase()  // Auth not ready yet!
  }
  if (typeof window !== 'undefined') {
    initialize()  // Fires immediately when store first accessed
  }
})
```

**Timeline**:
1. App mounts → `useAppInitialization` starts `authStore.initialize()` (async)
2. Router navigates → Component accesses `useMyStore()`
3. **RACE**: Store's `initialize()` fires synchronously
4. `loadFromDatabase()` checks `authStore.isAuthenticated` → FALSE
5. Store loads empty/localStorage data
6. Later: auth completes, but store already has wrong data

## Solution

**Remove auto-init from stores. Let `useAppInitialization.ts` be the sole orchestrator.**

### Step 1: Remove Auto-Init

```typescript
// ✅ GOOD - no auto-init
export const useMyStore = defineStore('my-store', () => {
  // BUG-XXX FIX: REMOVED auto-init on store creation
  // Initialization now happens ONLY from useAppInitialization.ts AFTER auth.
  // Same pattern as BUG-339 fix in tasks.ts.
  //
  // REMOVED CODE:
  // const initialize = async () => { ... }
  // if (typeof window !== 'undefined') { initialize() }

  const loadFromDatabase = async () => {
    // Keep this function - it's called explicitly
  }

  return { loadFromDatabase, ... }
})
```

### Step 2: Ensure App Initialization Calls Load

Verify `src/composables/app/useAppInitialization.ts` includes your store:

```typescript
// After auth is ready
await Promise.all([
  taskStore.loadFromDatabase(),
  projectStore.loadProjectsFromDatabase(),
  canvasStore.loadFromDatabase(),  // ← Add your store here
])
```

### Step 3: Add Auth Watcher (if needed)

If your store needs to reload when auth state changes (login/logout):

```typescript
// In useAppInitialization.ts or the store itself
watch(
  () => authStore.isAuthenticated,
  async (isAuth, wasAuth) => {
    if (isAuth && !wasAuth) {
      await myStore.loadFromDatabase()
    }
  }
)
```

## Stores Using This Pattern

| Store | Fixed In | Notes |
|-------|----------|-------|
| `tasks.ts` | BUG-339 | First implementation |
| `canvas.ts` | BUG-1045 | Same pattern |

## Key Files

- `src/composables/app/useAppInitialization.ts` - Central orchestrator
- `src/stores/auth.ts` - Auth state management
- `src/stores/tasks.ts` - Reference implementation (BUG-339)
- `src/stores/canvas.ts` - Reference implementation (BUG-1045)

## Verification

After applying the fix:
1. Hard refresh (Ctrl+Shift+R) - data should load immediately
2. Navigate away and back - data should persist
3. Check console for load timing logs

## Anti-Patterns to Avoid

```typescript
// ❌ Auto-init in store definition
if (typeof window !== 'undefined') { initialize() }

// ❌ Checking auth synchronously before it's ready
if (authStore.isAuthenticated) { loadData() }

// ❌ Multiple competing initialization paths
// (store auto-init + app init + component mount)
```
