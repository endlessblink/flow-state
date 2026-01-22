# SOP-025: Tauri/WebKitGTK Vue Flow Reactivity

> **Note**: Renumbered from SOP-019 to SOP-025 to resolve ID conflict with SOP-019-multi-agent-file-locking.md

**Created**: 2026-01-22
**Status**: Active
**Related**: BUG-357

---

## Problem

In Tauri desktop apps (which use WebKitGTK on Linux), Vue's reactivity system doesn't always properly track Pinia store changes. This causes two specific issues with Vue Flow canvas nodes:

1. **Stale node data when opening modals**: Vue Flow stores task data as shallow clones (`{ ...task }`) in node.data. When a task is updated elsewhere, the node data becomes stale.

2. **UI not updating after edits**: After saving changes via the edit modal, the task card on canvas doesn't reflect the new values because Vue's computed properties don't re-evaluate.

---

## Root Cause

### Issue 1: Stale Data in triggerEdit

```typescript
// BEFORE (broken): Uses potentially stale props.task
const triggerEdit = (task: Task) => {
    props.editCallback(task)  // task is from Vue Flow node.data - stale!
}
```

Vue Flow creates nodes with `data: { task: { ...task } }` during sync. This shallow clone is a snapshot that doesn't update when the store changes.

### Issue 2: Missing Sync After Save

```typescript
// BEFORE (broken): Store updates but Vue Flow nodes don't refresh
taskStore.updateTask(id, updates)
emit('close')  // Node still shows old data
```

In Tauri/WebKitGTK, Vue's computed properties in `useTaskNodeState` don't properly track Pinia store changes, so the node display doesn't update automatically.

---

## Solution

### Fix 1: Always Fetch Fresh Task from Store

```typescript
// AFTER (fixed): Always get fresh task from store
const triggerEdit = (task: Task) => {
    const freshTask = taskStore.tasks.find(t => t.id === task.id) || task
    props.editCallback(freshTask)
}
```

**File**: `src/composables/canvas/node/useTaskNodeActions.ts`

### Fix 2: Force Canvas Sync After Save

```typescript
// AFTER (fixed): Trigger sync to refresh Vue Flow nodes
taskStore.updateTask(id, updates)
canvasUiStore.requestSync('user:manual')  // Force node refresh
emit('close')
```

**File**: `src/composables/tasks/useTaskEditActions.ts`

---

## When to Apply This Pattern

Apply these patterns when:

1. **Opening modals from Vue Flow nodes**: Always look up the entity from the store by ID instead of using `props.data` directly.

2. **Updating entities displayed in Vue Flow**: After any store update that should reflect in Vue Flow nodes, call `canvasUiStore.requestSync('user:manual')`.

---

## Allowed Sync Sources

The `requestSync()` function is gated to prevent feedback loops. Only these sources trigger a sync:

```typescript
const USER_ACTION_SOURCES = [
    'user:drag-drop',
    'user:create',
    'user:delete',
    'user:undo',
    'user:redo',
    'user:resize',
    'user:connect',
    'user:context-menu',
    'user:manual'  // <-- Use this for edit modal saves
]
```

Automated sources like `'auto'`, `'watcher'`, `'reconcile'` are blocked to prevent sync loops.

---

## Testing Checklist

When modifying Vue Flow node interactions in Tauri:

- [ ] Test in Tauri app (not just browser)
- [ ] Double-click to edit shows correct task data
- [ ] After saving, task card updates immediately
- [ ] Works after multiple rapid edits
- [ ] Works with Hebrew/RTL text

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/composables/canvas/node/useTaskNodeActions.ts` | Node click/edit handlers |
| `src/composables/tasks/useTaskEditActions.ts` | Edit modal save logic |
| `src/composables/canvas/node/useTaskNodeState.ts` | Reactive task display (computed from store) |
| `src/stores/canvas/canvasUi.ts` | Sync trigger management |
| `src/composables/canvas/useCanvasSync.ts` | Vue Flow node creation from store |

---

## Related Issues

- **BUG-291**: Task update UI delay (fixed with direct updateTask instead of updateTaskWithUndo)
- **BUG-357**: Edit modal shows wrong task + edits don't update (this SOP)
