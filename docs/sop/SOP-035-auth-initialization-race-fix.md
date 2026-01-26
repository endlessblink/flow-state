# SOP-035: Auth Initialization Race Condition Fix

**Bug**: BUG-1086
**Created**: 2026-01-26
**Status**: REVIEW

## Problem Summary

On VPS production (in-theflow.com), users experienced authentication issues:
1. Unexpected sign-out
2. Sign-in not persisting after refresh
3. Intermittent blank screen

Console showed multiple `[AUTH:xxx] Initializing auth...` logs (3x instead of 1x).

## Root Cause Analysis

### Issue 1: Triple Auth Initialization Race Condition

`authStore.initialize()` was being called from 3 places simultaneously:

| File | Line | How Called | Problem |
|------|------|------------|---------|
| `src/router/index.ts` | 130 | `await authStore.initialize()` | Correct |
| `src/composables/app/useAppInitialization.ts` | 35 | `await authStore.initialize()` | Correct |
| `src/layouts/AppSidebar.vue` | 430 | `authStore.initialize()` | **NO AWAIT - fire-and-forget!** |

The guard `if (isInitialized.value) return` only worked AFTER the first call set `isInitialized = true` at the END of initialization. This meant all 3 calls could start before any completed.

### Issue 2: Duplicate SIGNED_IN Handler

`onAuthStateChange` was firing `SIGNED_IN` event multiple times:
- On visibility change (tab focus)
- On realtime reconnection
- On token refresh

Each event triggered a full store reload, causing:
- Performance degradation
- Potential state conflicts
- Multiple `breakGroupCycles` calls

## Solution

### Fix 1: Remove Duplicate Auth Init

**File**: `src/layouts/AppSidebar.vue`

```diff
- // Initialize auth
- authStore.initialize()
+ // BUG-1086: REMOVED fire-and-forget authStore.initialize() call
+ // Auth is already initialized by router guard and useAppInitialization
```

### Fix 2: Add Promise Lock for Concurrent Callers

**File**: `src/stores/auth.ts`

```typescript
// BUG-1086: Promise lock to prevent concurrent initialization attempts
let initPromise: Promise<void> | null = null

const initialize = async (): Promise<void> => {
  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise
  }
  if (isInitialized.value) return

  // Create promise BEFORE async work starts
  initPromise = (async () => {
    try {
      // ... initialization logic
    } finally {
      isLoading.value = false
      isInitialized.value = true
    }
  })()

  return initPromise
}
```

### Fix 3: Guard Against Duplicate SIGNED_IN Handling

**File**: `src/stores/auth.ts`

```typescript
// BUG-1086: Track which user we've already handled SIGNED_IN for
let handledSignInForUserId: string | null = null

// In onAuthStateChange callback:
if (_event === 'SIGNED_OUT') {
  handledSignInForUserId = null  // Reset on sign-out
}

if (_event === 'SIGNED_IN' && newSession?.user) {
  if (handledSignInForUserId === newSession.user.id) {
    console.log('SIGNED_IN already handled for this user, skipping reload')
    return
  }
  handledSignInForUserId = newSession.user.id
  // ... reload stores
}
```

## Verification

After deploying, check the browser console:

### Expected (Fixed)
```
[AUTH:xxx] Initializing auth...
[AUTH:xxx] Fetching session from localStorage...
[AUTH:xxx] Session found: true user@email.com
[AUTH] Scheduling token refresh in 55 minutes
👤 [AUTH:xxx] Auth state changed: INITIAL_SESSION userId: 717f5209
👤 [AUTH:xxx] Auth state changed: SIGNED_IN userId: 717f5209
👤 [AUTH:xxx] User signed in - reloading stores...
✅ [AUTH:xxx] Stores reloaded after sign-in
👤 [AUTH:xxx] Auth state changed: SIGNED_IN userId: 717f5209
👤 [AUTH:xxx] SIGNED_IN already handled for this user, skipping reload
```

### Before (Broken)
```
[AUTH:xxx] Initializing auth...
[AUTH:xxx] Fetching session from localStorage...
[AUTH:xxx] Initializing auth...  <!-- DUPLICATE -->
[AUTH:xxx] Fetching session from localStorage...
[AUTH:xxx] Initializing auth...  <!-- TRIPLICATE -->
[AUTH:xxx] Fetching session from localStorage...
👤 [AUTH:xxx] User signed in - reloading stores...
👤 [AUTH:xxx] User signed in - reloading stores...  <!-- DUPLICATE -->
👤 [AUTH:xxx] User signed in - reloading stores...  <!-- TRIPLICATE -->
```

## Test Cases

- [ ] Sign in → refresh → still signed in
- [ ] Sign in → close browser → reopen → still signed in
- [ ] Sign in with Brave shields ON → see warning banner
- [ ] Guest mode → sign in → data loads correctly
- [ ] Console shows only ONE `Initializing auth...` log
- [ ] Console shows only ONE `User signed in - reloading stores...` (subsequent show "skipping")

## Related Files

- `src/stores/auth.ts` - Main fix location
- `src/layouts/AppSidebar.vue` - Removed duplicate init
- `src/router/index.ts` - Primary auth init (unchanged)
- `src/composables/app/useAppInitialization.ts` - Secondary auth init (unchanged)

## Commits

1. `f422fce` - fix(auth): BUG-1086 prevent triple auth initialization race condition
2. `f9c4c32` - fix(auth): BUG-1086 prevent duplicate SIGNED_IN store reloads
