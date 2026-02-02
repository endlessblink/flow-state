# SOP-040: Cross-Device Position Sync

**Status**: Active
**Created**: 2026-02-02
**Related**: BUG-1124, TASK-131, TASK-142

## Overview

This SOP documents how canvas positions sync between Tauri desktop app and web app (PWA) when both connect to the same VPS Supabase instance.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Tauri App     │────▶│  VPS Supabase        │◀────│   Web App (PWA) │
│ (Desktop)       │     │  api.in-theflow.com  │     │ in-theflow.com  │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
         │                       │                           │
         │  Realtime WebSocket   │   Realtime WebSocket      │
         └───────────────────────┴───────────────────────────┘
```

Both apps connect to the same Supabase instance and receive realtime updates via WebSocket.

## Position Sync Flow

### When User Drags a Task

1. **Drag ends** → `useCanvasInteractions.ts:onNodeDragStop`
2. **Position saved** → `taskStore.updateTask()` with new `canvasPosition`
3. **Version incremented** → `positionVersion++` in `taskOperations.ts`
4. **Supabase update** → `useSupabaseDatabase.saveTask()`
5. **Realtime broadcast** → Supabase sends change to all connected clients

### When Realtime Update Arrives

1. **Event received** → `useAppInitialization.ts:onTaskChange`
2. **Data mapped** → `fromSupabaseTask()` converts DB fields to app fields
3. **Version check** → `updateTaskFromSync()` in `tasks.ts`
4. **Position applied** → If remote is newer, position is updated

## Version Conflict Resolution

The position version system prevents stale updates from overwriting fresh positions.

| Local Version | Remote Version | Action |
|---------------|----------------|--------|
| Higher | Lower | Preserve local (remote is stale) |
| Equal | Equal | Compare `updatedAt` timestamps |
| Lower | Higher | Accept remote (remote is newer) |

### Timestamp Comparison (When Versions Match)

```typescript
if (remoteUpdated > localUpdated) {
  // Remote is newer - accept remote position
} else {
  // Local is newer or same - preserve local
}
```

## Key Files

| File | Purpose |
|------|---------|
| `src/composables/app/useAppInitialization.ts` | Realtime handlers for tasks/groups |
| `src/stores/tasks.ts` | `updateTaskFromSync()` with version logic |
| `src/utils/supabaseMappers.ts` | `fromSupabaseTask()`, `fromSupabaseGroup()` |
| `src/composables/canvas/useCanvasInteractions.ts` | Drag handlers |
| `src/stores/tasks/taskOperations.ts` | Position version increment |

## Common Issues

### 1. Positions Not Syncing (Groups)

**Symptom**: Group positions change in one app but not the other.

**Root Cause**: Realtime handler not using `fromSupabaseGroup` mapper.

**Fix**: Ensure `onGroupChange` in `useAppInitialization.ts` maps data:
```typescript
const mappedGroup = fromSupabaseGroup(newDoc as SupabaseGroup)
canvas.updateGroupFromSync(mappedGroup.id, mappedGroup)
```

### 2. Position Reverts After Drag

**Symptom**: Task jumps back to old position after dragging.

**Root Cause**: Stale realtime event arriving after drag completes.

**Fix**: Position version system should block stale updates. Check:
- Is `positionVersion` being incremented on drag?
- Is version comparison working in `updateTaskFromSync()`?

### 3. Both Apps Show Different Positions

**Symptom**: Same task appears at different positions on each device.

**Root Cause**: Split-brain from simultaneous edits with same version.

**Fix**: Timestamp comparison now breaks ties. Ensure clocks are reasonably synced.

## Debugging

### Enable Position Logging

In development mode, position sync logs automatically. Look for:
```
[TASKS:POS] Accepting remote position for "Task name"
[TASKS:POS] Blocked stale sync for "Task name"
```

### Check Realtime Connection

In browser console:
```
📡 [REALTIME] Connected! 🟢
📡 [REALTIME] TASK event received: { ... }
```

### Verify Supabase URL

Check which Supabase instance the app is using:
```
[Supabase] Using envUrl for Tauri: "https://api.in-theflow.com"
```

Both Tauri and web should show the same URL for sync to work.

## Related SOPs

- `SOP-035-auth-initialization-race-fix.md` - Auth must be ready before realtime
- `docs/sop/canvas/CANVAS-POSITION-SYSTEM.md` - Canvas geometry invariants
