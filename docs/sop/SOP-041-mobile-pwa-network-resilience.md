# SOP-041: Mobile PWA Network Resilience

**Created**: 2026-01-30
**Related**: BUG-1107, BUG-352
**Status**: Active

## Overview

Mobile PWA connections are less reliable than desktop. All Supabase fetch functions must use `withRetry()` wrapper for network resilience.

## Problem

Mobile devices experience:
- Intermittent network connectivity
- Slower connection speeds
- Network timeouts
- JWT clock skew issues

Without retry logic, these cause `TypeError: Failed to fetch` errors that crash the sync.

## Solution: withRetry() Pattern

### Location
`src/composables/useSupabaseDatabase.ts`

### The withRetry() Function

```typescript
const withRetry = async <T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries = 3
): Promise<T> => {
  // Handles:
  // - JWT clock skew errors
  // - Auth errors (401/403) with exponential backoff
  // - Network errors ("Failed to fetch", "Network Error", "Service Unavailable")
}
```

### Required Pattern for ALL Fetch Functions

```typescript
// ❌ WRONG - No retry, will fail on mobile
const fetchSomething = async () => {
  try {
    const { data, error } = await supabase
      .from('table')
      .select('*')
    if (error) throw error
    return data
  } catch (e) {
    handleError(e, 'fetchSomething')
    return []
  }
}

// ✅ CORRECT - With retry wrapper
const fetchSomething = async () => {
  try {
    return await withRetry(async () => {
      const { data, error } = await supabase
        .from('table')
        .select('*')
      if (error) throw error
      return data ?? []
    }, 'fetchSomething')
  } catch (e) {
    handleError(e, 'fetchSomething')
    return []
  }
}
```

## Functions That MUST Use withRetry()

| Function | Table | Status |
|----------|-------|--------|
| `fetchTasks` | tasks | ✅ Has withRetry |
| `fetchProjects` | projects | ✅ Has withRetry |
| `fetchGroups` | groups | ✅ Has withRetry |
| `fetchTrash` | tasks | ✅ Has withRetry |
| `fetchNotifications` | notifications | ✅ Has withRetry |
| `fetchActiveTimerSession` | timer_sessions | ✅ Has withRetry |
| `fetchUserSettings` | user_settings | ⚠️ Check |
| `fetchQuickSortHistory` | quick_sort_sessions | ⚠️ Check |

## When Adding New Fetch Functions

1. **Always wrap Supabase queries in `withRetry()`**
2. **Pass the function name as context** for error reporting
3. **Keep the outer try/catch** for final error handling
4. **Return empty array/null** on failure (don't throw to UI)

## Testing Mobile Resilience

1. Use Chrome DevTools → Network → Throttle to "Slow 3G"
2. Open mobile PWA
3. Verify no "Failed to fetch" errors appear
4. Check console for retry attempts: `[withRetry] Retrying fetchX...`

## Related Files

- `src/composables/useSupabaseDatabase.ts` - All fetch functions
- `src/utils/errorHandler.ts` - Error reporting (ErrorCategory.SYNC)
- `src/sw.ts` - Service worker (NetworkOnly for Supabase)
