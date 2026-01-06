# SOP: Timer Session UUID Validation Fix

**Category**: SYNC
**Status**: Active Reference
**Last Updated**: January 6, 2026
**Related Task**: BUG-002

---

## Overview

This SOP documents the fix for a PostgreSQL UUID type error when saving timer sessions. Invalid session IDs (Unix timestamps instead of UUIDs) caused Supabase to reject save operations.

---

## The Problem

### Symptoms
1. Error notification: `Sync Error(saveActiveTimerSession): invalid input syntax for type uuid: "1767688720801"`
2. Timer sessions fail to persist to Supabase
3. Cross-device timer sync broken

### Root Cause

The `toSupabaseTimerSession()` mapper passed the session ID directly to Supabase without validation:

```typescript
// BEFORE: ID passed through without validation
export function toSupabaseTimerSession(session: any, userId: string, deviceId: string): SupabaseTimerSession {
    return {
        id: session.id,  // Could be a timestamp like "1767688720801"
        // ...
    }
}
```

The Supabase `timer_sessions.id` column requires a valid UUID format. When a session had a legacy/corrupted ID (Unix timestamp), the database rejected the insert/update.

**How timestamp IDs occurred:**
- Legacy code may have used `Date.now()` for session IDs
- Session restored from localStorage with old format
- Data migration from PouchDB didn't convert IDs

---

## The Solution

Added UUID validation in the mapper - if the ID is invalid, generate a new UUID:

```typescript
// AFTER: Validate and sanitize session ID
export function toSupabaseTimerSession(session: any, userId: string, deviceId: string): SupabaseTimerSession {
    // SAFETY: Validate session ID - generate new UUID if invalid
    const validSessionId = isValidUUID(session.id) ? session.id : crypto.randomUUID()

    if (!isValidUUID(session.id)) {
        console.warn(`[SUPABASE-MAPPER] Timer session had invalid ID: "${session.id}", generated new UUID: ${validSessionId}`)
    }

    return {
        id: validSessionId,
        // ...
    }
}
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/utils/supabaseMappers.ts` | Added UUID validation to `toSupabaseTimerSession()` |
| `src/utils/supabaseMappers.ts` | Added UUID validation to `toSupabaseQuickSortSession()` |

---

## Key Pattern: Defensive UUID Handling

When saving data to Supabase UUID columns, always validate:

```typescript
const isValidUUID = (str: string | null | undefined): boolean => {
    if (!str) return false
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(str)
}

// In mapper function:
const validId = isValidUUID(data.id) ? data.id : crypto.randomUUID()
```

---

## Related SOPs

- [SYNC-supabase-circular-loop-fix.md](./SYNC-supabase-circular-loop-fix.md) - UUID validation for projects/tasks
- [TASKS-raw-safety-pattern.md](./TASKS-raw-safety-pattern.md) - Store safety patterns

---

## Verification

After applying this fix:
1. Timer sessions save without UUID errors
2. Console shows warning if invalid ID detected (for debugging)
3. New valid UUID generated transparently - no user impact
