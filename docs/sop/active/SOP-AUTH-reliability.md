# SOP: Auth Reliability (BUG-339)

> **Status**: Active
> **Created**: 2026-01-21
> **Last Updated**: 2026-01-21
> **Related**: TASK-344 (Immutable Task ID System)

## Overview

This SOP documents the auth reliability fixes for FlowState, addressing:
- Random signouts in Tauri desktop app
- Task duplication during guest-to-user migration
- Guest mode localStorage contamination
- Session token expiration handling

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Auth Flow                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Guest Mode                    Authenticated Mode                │
│  ───────────                   ──────────────────               │
│  localStorage                  Supabase                         │
│  (flowstate-guest-tasks)       (tasks table + RLS)              │
│                                                                  │
│         ┌──────────────────────────────────────┐                │
│         │         Sign In Flow                  │                │
│         │                                       │                │
│         │  1. Auth via Supabase                │                │
│         │  2. Check migration flag              │                │
│         │  3. Fetch existing user tasks         │                │
│         │  4. Generate content fingerprints     │                │
│         │  5. Filter duplicates                 │                │
│         │  6. safeCreateTask() for each         │                │
│         │  7. Set migration flag                │                │
│         │  8. Clear guest localStorage          │                │
│         │  9. Reload from Supabase              │                │
│         └──────────────────────────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Principles

### 1. Immutable Task IDs (TASK-344)

- **Same ID = Same Task**: A task ID uniquely identifies a task forever
- **No ID Reuse**: Deleted task IDs are tombstoned, cannot be recreated
- **Preserve on Migration**: Guest tasks keep their original IDs when migrated

```typescript
// CORRECT - preserve ID
const result = await db.safeCreateTask(task) // Uses task.id

// WRONG - generates new ID
await taskStore.createTask({ ...task, id: undefined })
```

### 2. Guest Mode Isolation

- Guest tasks stored in `flowstate-guest-tasks` localStorage key
- **Only save to localStorage when NOT authenticated**
- Clear guest data when user signs in (after migration)

```typescript
// In taskPersistence.ts
if (!authStore.isAuthenticated) {
    saveTasksToLocalStorage()  // Guest mode only
} else {
    localStorage.removeItem(GUEST_TASKS_KEY)  // Clear if signed in
}
```

### 3. Proactive Token Refresh

- Schedule refresh 5 minutes before token expiry
- Prevents session loss during extended use
- Reschedule after each successful refresh

```typescript
const scheduleTokenRefresh = (expiresAt: number) => {
    const refreshBufferMs = 5 * 60 * 1000 // 5 minutes
    const timeUntilRefresh = expiresAt * 1000 - Date.now() - refreshBufferMs
    refreshTimer = setTimeout(performTokenRefresh, timeUntilRefresh)
}
```

## Duplicate Prevention Layers

### Layer 1: Migration Flag
```typescript
const migrationKey = `flowstate-migrated-${user.value.id}`
if (localStorage.getItem(migrationKey)) {
    return // Already migrated for this user
}
```

### Layer 2: Content Fingerprinting
```typescript
const fingerprint = `${title.toLowerCase().trim()}|${dueDate}|${status}`
const existingFingerprints = new Set(existingTasks.map(t => fingerprint(t)))
const uniqueTasks = guestTasks.filter(t => !existingFingerprints.has(fingerprint(t)))
```

### Layer 3: ID Check (safeCreateTask)
```typescript
const result = await db.safeCreateTask(task)
// Returns: { status: 'created' | 'exists' | 'tombstoned', taskId }
```

### Layer 4: Guest Mode Deduplication
```typescript
// On load from localStorage
const seenIds = new Set()
const uniqueTasks = tasks.filter(task => {
    if (seenIds.has(task.id)) return false
    seenIds.add(task.id)
    return true
})
```

## Tauri-Specific Configuration

### Environment Variables
```bash
# For Tauri builds - use full URL (WebView doesn't support relative paths)
VITE_SUPABASE_URL=http://127.0.0.1:54321

# For PWA/Web - use relative path (proxied by Caddy)
VITE_SUPABASE_URL=/supabase
```

### JWT Key Format
```bash
# CORRECT - JWT format for local Supabase
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# WRONG - new sb_publishable format doesn't work with REST API
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```

### Generate Correct Keys
```bash
node scripts/generate-supabase-keys.cjs
```

## Troubleshooting

### "JWT issued at future" Error
1. Check system time sync: `date && docker exec supabase_auth_flow-state date`
2. Restart auth service: `docker restart supabase_auth_flow-state`
3. Clear localStorage and re-login

### 401 Unauthorized on API Calls
1. Verify JWT key format (must be JWT, not sb_publishable)
2. Regenerate keys: `npm run generate:keys`
3. Rebuild app: `npm run tauri build`

### Tasks Duplicating on Sign-In
1. Check migration flag: `localStorage.getItem('flowstate-migrated-<userId>')`
2. Verify safeCreateTask is being used (not createTask)
3. Check for legacy localStorage keys: `pomoflow-guest-tasks`

### Guest Mode Task Congestion
1. Check deduplication logs: `[GUEST-MODE] Removed X duplicate tasks`
2. Verify only guest mode saves to localStorage
3. Clear localStorage: `rm -rf ~/.local/share/com.pomoflow.desktop/localstorage/*`

## Files Reference

| File | Purpose |
|------|---------|
| `src/stores/auth.ts` | Auth store, migration logic, token refresh |
| `src/stores/tasks/taskPersistence.ts` | Guest localStorage, deduplication |
| `src/utils/guestModeStorage.ts` | Clear guest data, legacy keys |
| `src/composables/app/useAppInitialization.ts` | App startup, clear stale data |
| `src/services/auth/supabase.ts` | Supabase client config |
| `src/composables/useSupabaseDatabase.ts` | safeCreateTask implementation |

## Testing Checklist

- [ ] Sign in with password → loads user tasks from Supabase
- [ ] Sign out → guest mode, localStorage used
- [ ] Create tasks in guest mode → saved to localStorage
- [ ] Sign in again → guest tasks migrated (no duplicates)
- [ ] Close app, reopen → session persists (no re-login needed)
- [ ] Leave app open 1+ hours → token auto-refreshes (no signout)
- [ ] Guest mode restart → no duplicate accumulation
