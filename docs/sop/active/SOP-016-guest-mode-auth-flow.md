# SOP-016: Guest Mode & Auth Flow

> **Status**: Active
> **Last Updated**: 2026-02-16
> **Related Tasks**: TASK-349, BUG-339, TASK-1339

## Overview

FlowState supports two modes of operation:
1. **Guest Mode** - localStorage-backed data (tasks, groups, filters persist across refreshes)
2. **Authenticated Mode** - Persistent data stored in Supabase

This SOP documents the data flow between these modes and common pitfalls.

## Guest Mode Behavior

### Persistent Guest Data (TASK-1339)

Guest tasks, groups, filters, and UI state persist across page refreshes via localStorage:
- Tasks created in guest mode survive refresh (stored in `flowstate-guest-tasks`)
- Canvas groups persist (`flowstate-guest-groups`)
- Filters and view state persist (`flowstate-filters`, `flowstate-ui-state`)
- Quick Sort history persists
- Users can sign in to migrate guest data to Supabase for cross-device sync

### Transient Keys (cleared on startup)

Only non-essential keys are cleared on guest startup. Located in `src/utils/guestModeStorage.ts`:

```typescript
const GUEST_EPHEMERAL_KEYS = [
  // Canvas transient state (locks expire, viewport recalculated)
  'flowstate-canvas-has-initial-fit',
  'flowstate-canvas-locks',
  // Backups, emojis, offline queue, etc.
]
```

### Why Persist?

1. **Usability** - Guests can explore the app across multiple sessions without losing work
2. **Conversion** - Users who invest time in guest mode are more likely to sign up
3. **Sign-in migration** - Guest data seamlessly migrates to Supabase on sign-in

## Auth Flow

### Sign-In Flow

```
User clicks "Sign In"
        │
        ▼
┌──────────────────────────────────────┐
│ supabase.auth.signInWithPassword()   │
└──────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────┐
│ migrateGuestData()                   │
│                                      │
│ 1. Check if already migrated         │
│ 2. Read guest tasks from localStorage│
│ 3. If no guest tasks:                │
│    → Load user data from Supabase    │
│    → Return                          │
│ 4. If guest tasks exist:             │
│    → Dedupe against existing tasks   │
│    → Create unique tasks in Supabase │
│    → Clear guest localStorage        │
│    → Load from Supabase              │
└──────────────────────────────────────┘
        │
        ▼
    User sees their tasks
```

### Sign-Out Flow

```
User clicks "Sign Out"
        │
        ▼
┌──────────────────────────────────────┐
│ signOut() in auth.ts                 │
│                                      │
│ 1. Clear Supabase session            │
│ 2. Clear auth state (user, session)  │
│ 3. taskStore.clearAll()              │
│ 4. canvasStore.clearAll()            │
│ 5. clearGuestData()                  │
└──────────────────────────────────────┘
        │
        ▼
    User sees empty guest mode
```

## Common Pitfalls & Fixes

### Pitfall 1: Sign-in doesn't load tasks

**Symptom**: User signs in, but canvas is empty until page refresh.

**Cause**: `migrateGuestData()` returns early without loading from database.

**Fix**: Always call `loadFromDatabase()` even when no guest tasks exist:

```typescript
if (allGuestTasks.length === 0) {
  // CRITICAL: Still need to load user's existing data!
  await taskStore.loadFromDatabase()
  await canvasStore.loadFromDatabase()
  return
}
```

### Pitfall 2: User data shows after sign-out

**Symptom**: After signing out, user still sees their tasks.

**Cause**: Task store not cleared during sign-out.

**Fix**: Clear all stores in `signOut()`:

```typescript
const signOut = async () => {
  await supabase.auth.signOut()

  // Clear auth state
  user.value = null
  session.value = null

  // Clear data stores
  taskStore.clearAll()
  canvasStore.clearAll()

  // Clear localStorage
  clearGuestData()
}
```

### Pitfall 3: CSS conflicts hide components

**Symptom**: Inbox panel doesn't appear or appears in wrong position.

**Cause**: CSS specificity conflicts between layout files and component styles.

**Fix**: Use more specific selectors or `!important` when necessary. The layout CSS in `canvas-view-layout.css` uses `:deep()` which can override component scoped styles.

## Testing Checklist

Before releasing auth changes:

- [ ] Guest mode: Create task → refresh page → tasks should still be there
- [ ] Guest mode: Create task → sign in (email/password) → tasks migrated
- [ ] Sign out: User tasks should not be visible
- [ ] Sign in: User tasks should load immediately (no refresh needed)
- [ ] OAuth sign-in: User data loads after redirect
- [ ] Inbox panel visible in canvas view

## File Reference

| File | Purpose |
|------|---------|
| `src/stores/auth.ts` | Auth state, sign-in/out, migration |
| `src/utils/guestModeStorage.ts` | Guest ephemeral key definitions |
| `src/stores/tasks.ts` | Task store with `clearAll()` |
| `src/stores/canvas.ts` | Canvas store with `clearAll()` |
| `src/composables/useAppInitialization.ts` | App startup sequence |

## Related Documentation

- [SOP-AUTH-reliability.md](./SOP-AUTH-reliability.md) - Auth reliability improvements
- [CLAUDE.md](../../../CLAUDE.md) - Main project documentation
