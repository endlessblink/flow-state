---
status: pending
priority: p2
issue_id: 006
tags: [code-review, architecture, broken-feature, timer]
dependencies: []
---

# Timer Cross-Device Sync is Completely Broken

## Problem Statement

The file `src/composables/useTimerChangesSync.ts` (249 lines) relies entirely on `window.pomoFlowDb` (PouchDB instance) which no longer exists. The entire timer sync feature is non-functional.

**Why it matters:** Timer sessions are not syncing across devices, which may be a critical feature for users.

## Findings

**Source:** Architecture Strategist Agent

**Affected File:** `src/composables/useTimerChangesSync.ts`

**Evidence:**
```typescript
// This file references window.pomoFlowDb throughout
// But window.pomoFlowDb is no longer set anywhere in the codebase
const db = window.pomoFlowDb  // undefined!
```

**Impact:**
- Timer state not synced between devices
- Active timer sessions lost on device switch
- Break/focus state inconsistent across tabs

## Proposed Solutions

### Solution 1: Rewrite Using Supabase Realtime (Recommended)

Implement timer sync using Supabase Realtime subscriptions:

```typescript
import { useSupabaseDatabase } from './useSupabaseDatabase'

export function useTimerChangesSync() {
  const supabase = useSupabaseDatabase()

  const subscribeToTimerChanges = () => {
    return supabase.initRealtimeSubscription(
      null, null,
      (payload) => handleTimerChange(payload)  // onTimerChange callback
    )
  }
  // ... rest of implementation
}
```

**Pros:** Proper Supabase integration, real-time sync
**Cons:** Full rewrite required
**Effort:** Large
**Risk:** Medium

### Solution 2: Delete and Document Feature Gap

```bash
rm src/composables/useTimerChangesSync.ts
# Update docs to note timer sync is local-only
```

**Pros:** Removes broken code
**Cons:** Feature loss
**Effort:** Small
**Risk:** Low (feature already broken)

### Solution 3: Stub with TODO

Convert to stub similar to other deprecated composables:

```typescript
/**
 * STUB: Timer sync via PouchDB removed Jan 2026
 * TODO (TASK-XXX): Implement via Supabase Realtime
 */
export function useTimerChangesSync() {
  console.warn('[useTimerChangesSync] STUB - timer sync disabled')
  return { subscribe: () => {}, unsubscribe: () => {} }
}
```

**Pros:** Prevents runtime errors, documents gap
**Cons:** Feature remains broken
**Effort:** Small
**Risk:** Low

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- src/composables/useTimerChangesSync.ts

**Components:** Timer sync, cross-device state

## Acceptance Criteria

- [ ] Timer sync either works via Supabase OR is documented as unavailable
- [ ] No runtime errors from undefined `window.pomoFlowDb`
- [ ] If stubbed, console warning appears in dev mode only

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-08 | Finding identified | Architecture Strategist review |

## Resources

- Supabase Realtime: https://supabase.com/docs/guides/realtime
